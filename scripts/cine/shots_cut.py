"""The film of the bitten ending (app/assets/cine/cut.mp4): C1 the thaw, C2 her window, C3 the lip of the pit, C4 down it,
C5 the bottom. Same cameras as the prologue's storm wherever the prologue stood in the same place, so it reads as that night
undone. Spoilers: docs/STORY.md."""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Vector as V

import lib
import sets
from lib import cam_keys, light, prim, M
from shots import shot, keys, light_keys, node_keys

CUT = ['C1', 'C2', 'C3', 'C4', 'C5']


# ── the thaw ───────────────────────────────────────────────────────────────
def thaw_mat(m, pairs, under=(0.075, 0.07, 0.045), scale=0.55):
    """a snow material that melts off in patches as a value goes 0 → 1, showing wet ground; returns nothing (keys are set)"""
    nt = m.node_tree
    b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    n1 = nt.nodes.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = scale; n1.inputs['Detail'].default_value = 9
    nt.links.new(geo.outputs['Position'], n1.inputs['Vector'])
    val = nt.nodes.new('ShaderNodeValue')
    node_keys(val.outputs[0], pairs)
    # snow left where noise > threshold
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
    sub = nt.nodes.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'
    nt.links.new(n1.outputs['Fac'], sub.inputs[0]); nt.links.new(val.outputs[0], sub.inputs[1])
    nt.links.new(sub.outputs[0], mr.inputs['Value'])
    mr.inputs['From Min'].default_value = -0.035; mr.inputs['From Max'].default_value = 0.035
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 6; n2.inputs['Detail'].default_value = 8
    nt.links.new(geo.outputs['Position'], n2.inputs['Vector'])
    g2 = nt.nodes.new('ShaderNodeMix'); g2.data_type = 'RGBA'
    g2.inputs[6].default_value = (*[c * 0.55 for c in under], 1); g2.inputs[7].default_value = (*[c * 1.8 for c in under], 1)
    nt.links.new(n2.outputs['Fac'], g2.inputs[0])
    nt.links.new(g2.outputs[2], mix.inputs[6]); mix.inputs[7].default_value = (0.86, 0.88, 0.92, 1)
    nt.links.new(mr.outputs['Result'], mix.inputs[0])
    nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    b.inputs['Subsurface Weight'].default_value = 0.0


def ground_h():
    """height of the built ground at (x, y) (its vertices are a 0.6 m grid)"""
    me = bpy.data.objects['ground'].data
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    xs = np.arange(-70, 90.01, 0.6); ys = np.arange(-50, 110.01, 0.6)
    Z = co[:, 2].reshape(len(ys), len(xs))

    def h(x, y):
        i = np.clip((x + 70) / 0.6, 0, len(xs) - 1.001); j = np.clip((y + 50) / 0.6, 0, len(ys) - 1.001)
        i0 = i.astype(int); j0 = j.astype(int); u = i - i0; v = j - j0
        return Z[j0, i0] * (1 - u) * (1 - v) + Z[j0, i0 + 1] * u * (1 - v) + Z[j0 + 1, i0] * (1 - u) * v + Z[j0 + 1, i0 + 1] * u * v
    return h


def _free(x, y, rim=1.0):
    cx, cy, rx, ry = sets.PIT
    pit = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > rim
    house = ~((np.abs(x) < 4.2) & (y > -0.75) & (y < 5.8)) & ~((x > -6.6) & (x < -3.6) & (y > -0.4) & (y < 2.0))
    return pit & house


def grown(name, verts0, verts1, faces, mat, pairs):
    """a mesh with a shape key from verts0 to verts1, keyed"""
    o = lib.mesh_obj(name, verts0, faces, mat)
    o.shape_key_add(name='Basis')
    k = o.shape_key_add(name='grown')
    k.data.foreach_set('co', np.asarray(verts1, np.float32).ravel())
    if pairs[-1][0] <= 1:              # already grown
        k.value = 1.0
        return o
    for f, v in pairs:
        k.value = v; k.keyframe_insert('value', frame=f)
    return o


def meadow(box, n_grass, n_flower, t0, t1, seed=3, tall=0.2, rim=1.05):
    """grass and small pale flowers pushing up through the melt"""
    h = ground_h()
    rng = np.random.default_rng(seed)
    grass = lib.mat('grass', (0.12, 0.15, 0.06), rough=0.9)
    petal = lib.mat('petal', (0.95, 0.9, 0.86), rough=0.7)
    x0, y0, x1, y1 = box
    for part in range(3):
        n = n_grass // 3
        x = x0 + rng.random(n) * (x1 - x0); y = y0 + rng.random(n) * (y1 - y0)
        ok = _free(x, y, rim); x, y = x[ok], y[ok]; n = len(x)
        z = h(x, y) - 0.02
        a = rng.random(n) * math.tau; L = tall * (0.4 + rng.random(n)); w = 0.006 + 0.006 * rng.random(n)
        dx, dy = np.cos(a) * w, np.sin(a) * w
        lean = 0.35 * L; b = rng.random(n) * math.tau
        base1 = np.stack([x - dx, y - dy, z], 1); base2 = np.stack([x + dx, y + dy, z], 1)
        tip = np.stack([x + np.cos(b) * lean, y + np.sin(b) * lean, z + L], 1)
        v1 = np.stack([base1, base2, tip], 1).reshape(-1, 3); v0 = np.stack([base1, base2, np.stack([x, y, z - 0.03], 1)], 1).reshape(-1, 3)
        f = np.arange(n * 3).reshape(-1, 3).tolist()
        d = (t1 - t0) * 0.25 * part
        grown(f'grass{part}', v0, v1, f, grass, [(1, 0.0), (t0 + d, 0.0), (t0 + d + (t1 - t0) * 0.45, 1.0)])
    n = n_flower
    if not n:
        return
    x = x0 + rng.random(n) * (x1 - x0); y = y0 + rng.random(n) * (y1 - y0)
    ok = _free(x, y, rim); x, y = x[ok], y[ok]; n = len(x)
    z = h(x, y); L = tall * (0.6 + 0.6 * rng.random(n))
    v0, v1, f = [], [], []
    for i in range(n):
        c = V((x[i], y[i], z[i] + L[i])); r = 0.022 + 0.018 * rng.random(); ph = rng.random() * 6
        for k in range(5):
            q = ph + k * math.tau / 5
            d = V((math.cos(q), math.sin(q), 0)); s = V((-d.y, d.x, 0)) * r * 0.5
            base = len(v1)
            v1 += [c, c + d * r * 0.6 + s + V((0, 0, r * 0.4)), c + d * r * 1.3 + V((0, 0, r * 0.25)), c + d * r * 0.6 - s + V((0, 0, r * 0.4))]
            v0 += [V((x[i], y[i], z[i] - 0.04))] * 4
            f.append((base, base + 1, base + 2, base + 3))
    grown('flowers', [tuple(v) for v in v0], [tuple(v) for v in v1], f, petal, [(1, 0.0), (t0 + (t1 - t0) * 0.5, 0.0), (t1, 1.0)])


def melt_props(t0, t1):
    """the snow on roofs and sills sinks and goes; the icicles shorten"""
    for o in list(bpy.data.objects):
        n = o.name
        if n.startswith(('roofsnow', 'shed_roofsnow', 'sill_snow', 'chimneysnow')):
            s = o.scale.copy()
            keys(o, 'scale', [(1, tuple(s)), (t0, tuple(s)), (t1, (s.x * 0.99, s.y * 0.99, s.z * 0.02))])
            p = o.location.copy()
            keys(o, 'location', [(1, tuple(p)), (t0, tuple(p)), (t1, (p.x, p.y, p.z - (0.02 if n.startswith('sill') else 0.2)))])
            o.hide_render = False; o.keyframe_insert('hide_render', frame=1)
            o.hide_render = True; o.keyframe_insert('hide_render', frame=t1)
        elif n.startswith('ice'):
            s = o.scale.copy(); q = t0 + (hash(n) % 40) * (t1 - t0) / 60
            keys(o, 'scale', [(1, tuple(s)), (q, tuple(s)), (min(t1, q + (t1 - t0) * 0.4), (s.x * 0.2, s.y * 0.2, s.z * 0.03))])


def daybreak(sc, t0, t1, lo=0.16):
    """from the storm's last grey to a low sun"""
    bg = [n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND'][0]
    s = bg.inputs['Strength'].default_value
    node_keys(bg.inputs['Strength'], [(1, s * lo), (t0, s * lo), (t1, s)])
    for nm in ('sun', 'skyfill'):
        o = bpy.data.objects.get(nm)
        if o:
            e = o.data.energy
            light_keys(o, [(1, e * lo * 0.35), (t0, e * lo * 0.35), (t1, e)])


def last_snow(box, n, f1, seed=12, cam=None, tgt=None):
    """a few flakes coming straight down, the last of them before frame f1"""
    s = lib.Snow('lastsnow', n, box[0], box[1], wind=(0.35, 0.05, -0.75), gust=0.3, streak=0.02, width=0.014, cam=cam, tgt=tgt, material=M()['flake'], seed=seed)
    lib.SNOWS.append(s); lib.register_frames()
    keys(s.obj, 'location', [(1, (0, 0, 0)), (f1 * 0.45, (0, 0, 0)), (f1, (0, 0, -(box[1][2] - box[0][2])))], interp='LINEAR')


# ── the shots ──────────────────────────────────────────────────────────────
@shot(exposure=1.0)  # auto=1.9
def C1(out, preview):
    """the Brink from where the prologue first showed it: the storm is over, it gets light, the snow goes off the roof and the
    ground in patches, and grass comes up to the lip of the pit"""
    sc = lib.new_scene(192, out, preview=preview)
    cam, tgt = lib.camera(lens=30)
    cam_keys(cam, tgt, [(1, (-15, -30, 9.5), (8, 4, -0.5), 30, None), (192, (-9.5, -22, 5.6), (4.5, 2.5, 0.6), 34, None)])
    sets.exterior(sc, cam, tgt, storm=False, dawn=True, window_glow=0.0, window_alpha=0.2)
    if bpy.data.objects.get('smoke'):
        bpy.data.objects['smoke'].hide_render = True          # nobody is at home to keep the fire
    daybreak(sc, 10, 130, lo=0.22)
    thaw_mat(M()['snow'], [(1, 0.12), (30, 0.2), (60, 0.34), (192, 0.63)], under=(0.13, 0.12, 0.07))
    melt_props(50, 176)
    meadow((-16, -24, 24, 8), 80000, 2600, 70, 180, tall=0.34)
    last_snow(((-30, -34, -0.5), (18, 4, 14)), 2600, 70, cam=cam, tgt=tgt)
    return sc


@shot(exposure=1.15)
def C2(out, preview):
    """her window, from where the prologue looked in at her: nobody there. The sill is bare and wet, and the sweet peas she kept
    for the spring are coming up past it"""
    sc = lib.new_scene(144, out, preview=preview, pos_lo=(-12, -12, -2), pos_size=30.0)
    cam, tgt = lib.camera(lens=50, fstop=4.0)
    cam_keys(cam, tgt, [(1, (-0.8, -5.4, 1.6), (-1.55, 0.2, 1.45), 50, 5.6), (144, (-1.45, -3.1, 1.5), (-1.55, 0.2, 1.42), 55, 3.2)])
    sets.exterior(sc, cam, tgt, storm=False, dawn=True, window_glow=0.0, window_alpha=0.05)
    if bpy.data.objects.get('smoke'):
        bpy.data.objects['smoke'].hide_render = True
    mats = M()
    # the room: her stool and the wheel, both empty, with a little morning on them
    prim('cube', 'stool_in', loc=(-1.45, 1.2, 0.49), scale=(0.2, 0.2, 0.24), material=mats['darkwood'])
    sets.spinning_wheel('wheel_in', (-1.2, 1.9, 0.45), mats)[0].rotation_euler = (0, 0, math.radians(75))
    bpy.data.objects['in_backwall'].hide_render = True
    prim('cube', 'in_dark', loc=(-1.0, 3.4, 1.6), scale=(2.6, 0.05, 1.5), material=mats['darkwood'])
    light('AREA', 'in_day', (-2.6, 0.7, 2.4), 16, color=(0.85, 0.88, 1.0), size=0.7, rot=(math.radians(-40), math.radians(-30), 0))
    thaw_mat(mats['snow'], [(1, 0.4), (144, 0.72)], scale=1.2)
    melt_props(1, 90)
    green = lib.mat('stem', (0.16, 0.2, 0.08), rough=0.8); petal = lib.mat('petal2', (0.95, 0.86, 0.86), rough=0.6)
    rng = np.random.default_rng(8)
    for i in range(9):
        x = -2.35 + i * 0.2 + rng.uniform(-0.05, 0.05); top = 1.15 + rng.random() * 0.75; y = -0.42 + rng.uniform(-0.05, 0.05); ph = rng.random() * 6
        pts = [V((x + 0.05 * math.sin(ph + s * 7), y + 0.04 * math.cos(ph + s * 6), 0.02 + s * top)) for s in np.linspace(0, 1, 22)]
        c = lib.curve_obj(f'vine{i}', pts, bevel=0.006, material=green)
        d0 = 6 + i * 3
        c.data.bevel_factor_end = 0.0; c.data.keyframe_insert('bevel_factor_end', frame=1)
        c.data.keyframe_insert('bevel_factor_end', frame=d0)
        c.data.bevel_factor_end = 1.0; c.data.keyframe_insert('bevel_factor_end', frame=d0 + 80)
        for k in range(7):
            s = 0.3 + 0.7 * k / 7; p = pts[int(s * 21)]; side = 1 if k % 2 else -1
            leaf = prim('sphere', f'leaf{i}_{k}', loc=p + V((side * 0.05, -0.02, 0.01)), rot=(0.4, side * 0.5, ph + k), scale=(0.05, 0.012, 0.026), material=green, segments=10, ring_count=6)
            f0 = d0 + 80 * s; z = leaf.scale.copy()
            keys(leaf, 'scale', [(1, (0.0001,) * 3), (f0, (0.0001,) * 3), (f0 + 18, tuple(z))])
            if k >= 3:
                q = p + V((-side * 0.04, -0.05, 0.02))
                for w in (-1, 0, 1):
                    pt = prim('sphere', f'pet{i}_{k}{w}', loc=q + V((w * 0.022, 0.01 * (w == 0), 0.03 * (w == 0))), rot=(0.35, w * 0.6, 0), scale=((0.02, 0.008, 0.024) if w else (0.034, 0.006, 0.032)), material=petal, segments=12, ring_count=8)
                    z = pt.scale.copy()
                    keys(pt, 'scale', [(1, (0.0001,) * 3), (f0 + 10, (0.0001,) * 3), (f0 + 34, tuple(z))])
    meadow((-6, -4.5, 4, -0.6), 9000, 160, 1, 120, tall=0.16)
    return sc


@shot(exposure=1.15)
def C3(out, preview):
    """the pit in the morning: grass and flowers up to the lip, and her dead thread coming over the ground and going down into
    it; the camera goes to the edge, and over"""
    sc = lib.new_scene(144, out, preview=preview)
    cx, cy, rx, ry = sets.PIT
    cam, tgt = lib.camera(lens=32)
    sets.exterior(sc, cam, tgt, storm=False, dawn=True, window_glow=0.0, window_alpha=0.2)
    if bpy.data.objects.get('smoke'):
        bpy.data.objects['smoke'].hide_render = True
    mats = M()
    h = ground_h()
    gz = lambda x, y: float(h(np.array([x]), np.array([y]))[0])
    thaw_mat(mats['snow'], [(1, 0.7), (144, 0.7)])
    melt_props(1, 2)
    meadow((9, -6, 27, 12), 70000, 2600, -60, 1, tall=0.2, rim=1.12)
    # the lip the thread goes over, nearest the cottage
    ang = math.radians(212)
    lip = V((cx + rx * 1.02 * math.cos(ang), cy + ry * 1.02 * math.sin(ang), 0)); lip.z = gz(lip.x, lip.y)
    inn = V((cx - lip.x, cy - lip.y, 0)).normalized()
    door = V((2.25, -0.5, 0.0))
    pts = []
    for i in range(44):
        t = i / 44; p = door.lerp(lip, t); p.y += math.sin(t * 7) * 0.35 * math.sin(math.pi * t); p.z = gz(p.x, p.y) + 0.03; pts.append(p)
    # over the rim of rock as it really lies, then straight down off its edge
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    wall = bpy.data.objects['pit_wall'].evaluated_get(dg)
    for k in range(60):
        q = lip + inn * (k * 0.04)
        hit, loc, *_ = wall.ray_cast(wall.matrix_world.inverted() @ V((q.x, q.y, 4.0)), V((0, 0, -1)))
        z = (wall.matrix_world @ loc).z if hit else -9
        if z < pts[-1].z - 0.5 and k > 3:
            break
        pts.append(V((q.x, q.y, max(z, gz(q.x, q.y) if k < 2 else -9) + 0.02)))
    pts += [pts[-1] + inn * 0.06 + V((0, 0, 0.035)), pts[-1] + inn * 0.13 + V((0, 0, 0.05)), pts[-1] + inn * 0.19 + V((0, 0, 0.0))]
    end = pts[-1] + inn * 0.02
    pts += [V((end.x + 0.03 * math.sin(k), end.y, end.z - 0.25 - k * 0.9)) for k in range(9)]
    lib.tube('greythread', pts, 0.012, mats['grey_thread'])
    a = lip - inn * 6.5 + V((-0.8, 0, 1.5)); b = lip - inn * 2.2 + V((0.1, 0, 1.15)); c = lip + inn * 1.4 + V((0, 0, 1.5))
    cam_keys(cam, tgt, [(1, a, lip + V((0, 0, 0.1)), 32, None), (70, b, lip + inn * 1.0 + V((0, 0, -0.5)), 32, None), (144, c, lip + inn * 2.6 + V((0, 0, -7.0)), 30, None)])
    return sc


@shot(exposure=1.0)  # auto=0.4
def C4(out, preview):
    """down the well, looking up: the ring of morning gets smaller and goes"""
    sc = lib.new_scene(108, out, preview=preview)
    cam, tgt = lib.camera(lens=24)
    w = sets.shaft(sc, cam, tgt, M(), height=120)
    w.scale = (1.3, 0.92, 1.0); w.rotation_euler = (0, 0, 2.2)
    mats = M()
    top = 104.0
    cam_keys(cam, tgt, [(1, (0.5, 0.2, 92), (0.0, 0.0, 104), 24, None), (108, (-0.2, 0.3, 30), (0.1, 0.0, 104), 24, None)])
    prim('plane', 'sky', loc=(0, 0, top + 6), rot=(math.pi, 0, 0), scale=(30, 30, 1), material=lib.emissive('daysky', (1.0, 0.86, 0.7), 1.1, aux=(0, 0, 0.15)))
    lamp = light('AREA', 'day', (0, 0, top + 2), 9000, color=(1.0, 0.85, 0.68), size=6.0)
    # her thread, broken off a little way down
    lib.tube('greythread', [V((1.6 + 0.05 * math.sin(k * 0.9), -0.6 + 0.04 * math.cos(k), top - k * 0.8)) for k in range(58)], 0.02, mats['grey_thread'])
    light_keys(lamp, [(1, 9000), (60, 9000), (108, 1200)])
    # the walls keep a little of it all the way down
    near = light('POINT', 'wall', (0, 0, 100), 900, color=(0.9, 0.82, 0.75), size=0.5)
    keys(near, 'location', [(1, (0, 0, 99)), (108, (0.1, 0, 39))], interp='LINEAR')
    light_keys(near, [(1, 900), (40, 700), (84, 160), (104, 0)])
    return sc


@shot(exposure=1.0)  # auto=1.6
def C5(out, preview):
    """the bottom: what sits in her chair has the doll in its lap, and whispers in its ear; at the very end it looks up"""
    sc = lib.new_scene(264, out, preview=preview, pos_lo=(-12, -12, -2), pos_size=30.0)
    cam, tgt = lib.camera(lens=50, fstop=2.8)
    c0 = V((0.0, 0.42, 0.86)); d0 = V((-0.04, 0.25, 0.93))
    p0 = lib.frame_pos(c0, (0.34, -0.93, 0.1), 0.62, 50, 0.85); p1 = lib.frame_pos(d0, (0.2, -0.97, 0.06), 0.26, 50, 0.85)
    cam_keys(cam, tgt, [(1, p0, c0, 50, (p0 - c0).length), (264, p1, d0, 50, (p1 - d0).length)])
    mats = M()
    S = sets.loom_cave(sc, cam, tgt, mats)
    kp = S['kparts']
    # nothing of the cave between the camera and the chair (the camera starts outside its near wall)
    cave = bpy.data.objects['cave']
    bpy.context.view_layer.objects.active = cave
    for md in list(cave.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
    bm = bmesh.new(); bm.from_mesh(cave.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (cave.matrix_world @ f.calc_center_median()).y < 0.6], context='FACES')
    bm.to_mesh(cave.data); bm.free()
    for nm in ('loomfill', 'loomrim'):
        bpy.data.objects[nm].data.energy = 0.0
    light_keys(S['candle']['light'], [(1, 0.0), (264, 0.0)]); S['candle']['flame'].hide_render = True
    # what little day gets this far comes straight down behind them; a breath of it from the front, so the doll can be seen
    top = light('SPOT', 'well', (-0.5, 1.5, 4.6), 2600, color=(0.72, 0.8, 1.0), size=0.4, rot=(math.radians(-14), 0, 0), spot=math.radians(50))
    front = light('AREA', 'front', (0.75, -1.8, 1.2), 34, color=(0.8, 0.84, 1.0), size=0.7, rot=(math.radians(82), 0, math.radians(22)))
    light_keys(top, [(1, 0.0), (34, 2600), (250, 2600), (263, 0)])
    light_keys(front, [(1, 0.0), (50, 34), (250, 34), (262, 0.0)])
    if kp.get('oldlady'):
        import oldlady
        oldlady.shawl(kp, mats['wool_shawl'], lib)
    droot, dp = lib.doll('doll', (-0.085, 0.29, 0.668), 1.0, mats)
    droot.rotation_euler = (0.12, 0, 0.06)
    # her head comes down to it, the wrong way over, a little at a time
    keys(kp['head'], 'rotation_euler', [(1, (0.1, 0, 0)), (70, (0.1, 0, 0)), (92, (0.08, 0, -0.2)), (132, (0.08, 0, -0.2)), (154, (0.08, 0, -0.38)), (198, (0.08, 0, -0.38)), (222, (0.1, 0.05, -0.55)), (245, (0.1, 0.05, -0.55)), (249, (-0.04, 0, 0.22)), (264, (-0.04, 0, 0.22))])
    keys(kp['torso'], 'rotation_euler', [(1, (0.0, 0, 0)), (80, (0.04, 0, 0)), (228, (0.27, 0, 0)), (264, (0.27, 0, 0))])
    bpy.context.view_layer.update()
    lib.hand_pose(kp, 1, 'relax'); lib.hand_pose(kp, -1, 'relax')
    lib.arm_to(kp, 1, V((0.012, 0.325, 0.78)), pole=(1.0, 0.5, -0.4), palm=(-1.0, 0.0, 0.1))
    lib.arm_to(kp, -1, V((-0.185, 0.325, 0.76)), pole=(-1.0, 0.4, -0.4), palm=(1.0, 0.0, 0.1))
    # the doll's thread, bitten: a grey end from its waist over the knee
    lib.tube('bitten', lib.catenary(V((-0.01, 0.235, 0.74)), V((0.12, 0.02, 0.35)), sag=0.03, n=16), 0.0025, mats['grey_thread'])
    keys(dp['head'], 'rotation_euler', [(1, (0, 0, 0)), (200, (0, 0, 0)), (240, (0.06, 0, -0.1)), (264, (0.06, 0, -0.1))])
    return sc
