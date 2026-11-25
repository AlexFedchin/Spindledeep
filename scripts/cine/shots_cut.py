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


# the shots themselves are in shots_end.py (second staging)
