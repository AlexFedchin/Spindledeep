"""Spindledeep cinematics: the shots. Each entry builds its set, camera and animation and returns the scene.
Frame counts are at 24 fps. Lenses are full-frame equivalents.

PROLOGUE: shots_intro.py (wordless).
EPILOGUE: see the shot docstrings (kept out of the player-facing pages on purpose)."""
import math

import bpy
from mathutils import Vector as V, Matrix

import lib
import sets
from lib import key, cam_keys, light, empty, prim, parent, M

SHOTS = {}
INTRO = ['I1', 'I2', 'I2K', 'I3', 'I4', 'I5', 'I5S', 'I6', 'I7', 'I8', 'I9']
OUTRO = ['O2', 'O1', 'O3', 'O4', 'O5', 'O6', 'O7']
CUT = ['C1', 'C2', 'C3', 'C4', 'C5']
NAMES = ['N1']
EXPOSURE = {}    # post exposure per shot


def shot(exposure=1.0):
    def deco(fn):
        SHOTS[fn.__name__] = fn
        EXPOSURE[fn.__name__] = exposure
        return fn
    return deco


def ease(o, mode='EASE_IN_OUT', interp='BEZIER'):
    for d in (o, getattr(o, 'data', None)):
        if d is not None and getattr(d, 'animation_data', None) and d.animation_data.action:
            for fc in d.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = interp; kp.easing = mode


def keys(o, path, pairs, index=-1, interp='BEZIER'):
    for f, v in pairs:
        if index >= 0:
            getattr(o, path)[index] = v
            o.keyframe_insert(path, index=index, frame=f)
        else:
            setattr(o, path, v)
            o.keyframe_insert(path, frame=f)
    ease(o, interp=interp)


def node_keys(sock, pairs):
    for f, v in pairs:
        sock.default_value = v
        sock.keyframe_insert('default_value', frame=f)


def light_keys(lamp, pairs):
    """animate a light's energy, keeping any flicker noise modifiers riding on top"""
    ld = lamp.data
    ad = ld.animation_data
    mods = []
    if ad and ad.action:
        for fc in ad.action.fcurves:
            if fc.data_path == 'energy':
                mods = [(m.scale, m.strength, m.phase) for m in fc.modifiers]
                ad.action.fcurves.remove(fc)
                break
    for f, v in pairs:
        ld.energy = v; ld.keyframe_insert('energy', frame=f)
    fc = [c for c in ld.animation_data.action.fcurves if c.data_path == 'energy'][0]
    peak = max(v for _, v in pairs) or 1
    for (sc_, st, ph) in mods:
        m = fc.modifiers.new('NOISE'); m.scale = sc_; m.strength = st * 0.6; m.phase = ph
        m.blend_in = 0; m.influence = 1.0
    return fc


def ground_z(x, y):
    return 0.02


# ── PROLOGUE ───────────────────────────────────────────────────────────────
# the prologue's shots are in shots_intro.py


# ── EPILOGUE ───────────────────────────────────────────────────────────────
def _threads_flow(mats):
    holder = empty('flow')
    holder['progress'] = 0.0
    m = lib.thread_mat('greyred', (0.85, 0.06, 0.04), 2.6, (1, 0, 0), progress_from=((0.55, 0.55, 0.56), holder))
    return holder, m


def _prog(holder, pairs):
    for f, v in pairs:
        holder['progress'] = v
        holder.keyframe_insert('["progress"]', frame=f)
    ease(holder)


@shot(exposure=1.0)
def E1(out, preview):
    """the Loom, very close: the doll's red thread knotted to her grey one; red light runs out of the knot and
    up the grey thread, strand by strand"""
    sc = lib.new_scene(144, out, preview=preview, pos_lo=(-12, -12, -2), pos_size=30.0)
    cam, tgt = lib.camera(lens=85, fstop=2.2)
    knot = V((0.06, 0.3, 0.64))
    p0 = lib.frame_pos(knot, (0.35, -0.9, 0.3), 0.09, 85, 0.9); p1 = lib.frame_pos(knot + V((0, 0.02, 0.05)), (0.3, -0.9, 0.25), 0.11, 85, 0.9)
    cam_keys(cam, tgt, [(1, p0, knot, 85, (p0 - knot).length), (144, p1, knot + V((0, 0.02, 0.05)), 85, (p1 - knot).length)])
    mats = M()
    L = sets.loom_cave(sc, cam, tgt, mats)
    holder, gm = _threads_flow(mats)
    red = lib.tube('red_in', lib.catenary(V((0.2, -0.2, 0.55)), knot, sag=0.05, n=20), 0.0018, mats['red'])
    grey = lib.tube('grey_out', [knot + V((math.sin(i * 0.4) * 0.02, i * 0.03, i * 0.06 + (i * i) * 0.004)) for i in range(40)], 0.0018, gm)
    prim('sphere', 'knot', loc=knot, scale=(0.006, 0.006, 0.006), material=mats['red'])
    _prog(holder, [(1, 0.0), (30, 0.0), (144, 1.0)])
    return sc


@shot(exposure=0.9)
def E2(out, preview):
    """her, in the chair, the doll in her lap; the grey of her shawl turns red row by row; her head bows"""
    sc = lib.new_scene(168, out, preview=preview, pos_lo=(-12, -12, -2), pos_size=30.0)
    cam, tgt = lib.camera(lens=50, fstop=2.8)
    c0 = V((0.0, 0.48, 0.82))
    p0 = lib.frame_pos(c0, (0.6, -0.8, 0.15), 0.75, 50, 0.85); p1 = lib.frame_pos(c0, (0.5, -0.85, 0.12), 0.6, 50, 0.85)
    cam_keys(cam, tgt, [(1, p0, c0, 50, (p0 - c0).length), (168, p1, c0 + V((0, 0, 0.03)), 50, (p1 - c0).length)])
    mats = M()
    L = sets.loom_cave(sc, cam, tgt, mats)
    kp = L['kparts']
    if kp.get('oldlady'):
        import oldlady
        oldlady.shawl(kp, mats['wool_shawl'], lib)      # her shawl, which turns red (the model came without one)
    droot, dp = lib.doll('doll', (0.0, 0.32, 0.668), 0.9, mats)      # on top of her lap, not sunk into it
    droot.rotation_euler = (0.15, 0, 0.0)
    # the shawl reddens: mix its base colour toward red over the shot
    sh = mats['wool_shawl']
    b = [n for n in sh.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    node_keys(b.inputs['Base Color'], [(1, (0.3, 0.29, 0.3, 1)), (40, (0.3, 0.29, 0.3, 1)), (168, (0.62, 0.05, 0.04, 1))])
    keys(kp['head'], 'rotation_euler', [(1, (0.2, 0, 0)), (90, (0.25, 0, 0)), (168, (0.62, 0, 0.08))])
    bpy.context.view_layer.update()
    lib.hand_pose(kp, 1, 'relax'); lib.hand_pose(kp, -1, 'relax')
    lib.arm_to(kp, 1, V((0.035, 0.44, 0.668 + 0.12)), pole=(1.0, 0.5, -0.4), palm=(0.0, -1.0, 0.1))   # a hand on its back
    lib.arm_to(kp, -1, V((-0.15, 0.3, 0.69)), pole=(-1.0, 0.3, -0.3), palm=(0.0, 0.0, -1.0))           # the other on her lap
    return sc


@shot(exposure=0.8)
def E3(out, preview):
    """the candle, close: it gutters and goes out; in the dark only the red thread still glows, rising away"""
    sc = lib.new_scene(96, out, preview=preview, pos_lo=(-12, -12, -2), pos_size=30.0)
    cam, tgt = lib.camera(lens=85, fstop=2.2)
    cam_keys(cam, tgt, [(1, (1.05, -0.35, 0.66), (0.65, 0.2, 0.62), 85, 0.68), (96, (1.0, -0.3, 0.7), (0.62, 0.25, 0.75), 85, 0.66)])
    mats = M()
    L = sets.loom_cave(sc, cam, tgt, mats)
    c = L['candle']
    keys(c['flame'], 'scale', [(1, (0.006, 0.006, 0.016)), (30, (0.006, 0.006, 0.016)), (44, (0.004, 0.004, 0.02)), (52, (0.0045, 0.0045, 0.012)), (60, (0.0001, 0.0001, 0.0001))])
    light_keys(c['light'], [(1, 28.0), (40, 28.0), (52, 10.0), (60, 0.0), (96, 0.0)])
    for nm, e0 in (('loomfill', 60.0), ('loomrim', 40.0)):
        light_keys(bpy.data.objects[nm], [(1, e0), (48, e0), (64, e0 * 0.08), (96, e0 * 0.05)])
    red = lib.tube('red_up', [V((0.3 + math.sin(i * 0.3) * 0.02, 0.35, 0.6 + i * 0.12)) for i in range(40)], 0.002, mats['red'])
    glow = light('POINT', 'redglow', (0.3, 0.35, 1.0), 2.0, color=(1, 0.15, 0.1), size=0.2)
    smoke = lib.tube('smokewisp', [V((0.65, 0.2, 0.62 + i * 0.02)) for i in range(20)], 0.0008, lib.mat('wisp', (0.6, 0.6, 0.6), alpha=0.4))
    smoke.hide_render = True; smoke.keyframe_insert('hide_render', frame=1)
    smoke.hide_render = False; smoke.keyframe_insert('hide_render', frame=60)
    return sc


@shot(exposure=0.8)
def E4(out, preview):
    """up the thread: a long rise through the dark beside the glowing red line, past a bell that rings as it
    passes, chains, roots, the old mine timbers, toward a growing light above"""
    sc = lib.new_scene(240, out, preview=preview, pos_lo=(-10, -10, -10), pos_size=80.0)
    cam, tgt = lib.camera(lens=26)
    cam_keys(cam, tgt, [(1, (-0.2, -1.6, 0.0), (0.7, 0.0, 3.5), 26, None), (240, (-0.1, -1.4, 50.0), (0.7, 0.0, 56.0), 26, None)])
    mats = M()
    sets.shaft(sc, cam, tgt, mats)
    pts = [V((0.7 + math.sin(z * 0.15) * 0.15, math.cos(z * 0.11) * 0.1, z)) for z in range(-6, 64, 1)]
    lib.tube('red_up', pts, 0.006, mats['red'])
    for z in range(-3, 62, 4):
        light('POINT', f'tl{z}', (0.7, 0, z), 3.0, color=(1, 0.18, 0.12), size=0.1, shadow=False)
    # passing things: a bell flower, chains, roots, a stalactite cluster, the mine frame
    bell = emissive_bell(mats, (2.2, 0.8, 9.0))
    bl = light('POINT', 'belllight', (2.0, 0.7, 8.8), 0.0, color=(0.85, 0.9, 1.0), size=0.2)
    light_keys(bl, [(1, 0.0), (36, 0.0), (44, 40.0), (90, 6.0)])
    for k in range(4):
        a = k * 1.7
        x, y = math.cos(a) * 2.6, math.sin(a) * 2.6
        for j in range(26):
            prim('torus', f'chain{k}_{j}', loc=(x, y, 18 + k * 1.3 - j * 0.12), rot=(math.pi / 2, 0, j * 1.57), major_radius=0.04, minor_radius=0.01, material=mats['iron'])
    for k in range(9):
        a = k * 0.8
        lib.tube(f'root{k}', [V((math.cos(a) * (3.1 - i * 0.12), math.sin(a) * (3.1 - i * 0.12), 28 - i * 0.35 + math.sin(i + k) * 0.1)) for i in range(14)], 0.03 * (1 - k * 0.05), mats['darkwood'])
    for k in range(5):
        a = 2.4 + k * 0.4
        prim('cone', f'stal{k}', loc=(math.cos(a) * 2.6, math.sin(a) * 2.6, 36 - k * 0.3), rot=(math.pi, 0, 0), scale=(0.25, 0.25, 1.2 + k * 0.3), material=mats['rock'], vertices=10)
    for x in (-1.2, 1.2):
        prim('cube', f'mine{x}', loc=(x - 1.5, 2.2, 43.5), scale=(0.1, 0.1, 1.2), material=mats['darkwood'])
    prim('cube', 'minecap', loc=(-1.5, 2.2, 44.7), scale=(1.4, 0.12, 0.12), material=mats['darkwood'])
    top = light('AREA', 'dawn', (0, 0, 60), 0.0, color=(1.0, 0.85, 0.65), size=8.0, rot=(math.pi, 0, 0))
    light_keys(top, [(1, 0.0), (140, 200.0), (240, 4000.0)])
    return sc


def emissive_bell(mats, loc):
    root = empty('bell', loc)
    m = lib.mat('bellmat', (0.85, 0.88, 0.95), rough=0.3, emit=(0.8, 0.85, 0.95), estr=0.8, aux=(0, 0, 1))
    b = prim('cone', 'bellcup', loc=(0, 0, 0), rot=(math.pi, 0, 0), scale=(0.35, 0.35, 0.45), material=m, vertices=24)
    parent(b, root, keep=False)
    stem = lib.tube('bellstem', [V((0, 0, 0.4 + i * 0.25)) + V((math.sin(i) * 0.1, 0, 0)) for i in range(10)], 0.02, mats['darkwood'])
    return root


@shot(exposure=1.4)
def E5(out, preview):
    """dawn, the storm gone: rising out of the pit's mouth into gold light; the red thread runs from the lip
    across the untouched snow to the cottage door; smoke climbs straight up"""
    sc = lib.new_scene(168, out, preview=preview)
    cam, tgt = lib.camera(lens=34)
    cam_keys(cam, tgt, [(1, (25.5, 5.0, -5.0), (24.0, 2.0, 3.0), 34, None), (60, (24.0, 2.0, 1.5), (14.0, 1.0, 1.6), 34, None), (168, (20.5, -4.5, 4.0), (1.0, 0.5, 1.6), 38, None)])
    sets.exterior(sc, cam, tgt, storm=False, dawn=True, window_glow=0.4)
    mats = M()
    pts = [V((20.0, 3.4, -6.0)), V((19.7, 3.3, -1.0)), V((19.4, 3.2, 0.02))]
    for i in range(1, 30):
        t = i / 29
        p = V((19.4, 3.2, 0.02)).lerp(V((2.25, -0.5, 0.02)), t)
        p.y += math.sin(t * 6) * 0.4
        pts.append(p)
    pts.append(V((2.25, -0.08, 1.0)))
    lib.tube('redline', pts, 0.008, mats['red'])
    return sc


@shot(exposure=1.2)
def E6(out, preview):
    """morning inside: sun through the frosted window, dust turning in the beam; the doll sits in her chair by
    the window wrapped in a shawl knitted red; the spinning wheel turns slowly on its own"""
    sc = lib.new_scene(192, out, preview=preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = lib.camera(lens=38, fstop=2.8)
    c0 = V((0.35, 0.5, 0.8))
    p0 = lib.frame_pos(c0, (1.0, 0.45, 0.3), 0.38, 38, 0.85); p1 = lib.frame_pos(c0, (1.0, 0.25, 0.22), 0.3, 40, 0.85)
    cam_keys(cam, tgt, [(1, p0, c0, 38, (p0 - c0).length), (192, p1, c0 + V((0, 0, 0.03)), 40, (p1 - c0).length)])
    R = sets.interior(sc, cam, tgt, night=False, knitter_on=False, candle_lit=False, doll_pose='none', red_shawl=True)
    mats = M()
    for o in list(bpy.data.objects):
        if o.name.startswith(('table', 'tleg', 'candle', 'sleeve', 'ribbon_loose', 'scissor', 'sring', 'spool')):
            o.hide_render = True
    R['wheel_root'].location = (-1.55, 1.0, 0.0)
    wood = mats['darkwood']
    cx, cy = 0.35, 0.55
    prim('cube', 'rseat', loc=(cx, cy, 0.42), scale=(0.24, 0.22, 0.03), material=wood)
    prim('cube', 'rback', loc=(cx, cy + 0.22, 0.8), rot=(-0.15, 0, 0), scale=(0.24, 0.03, 0.4), material=wood)
    for y in (cy - 0.2, cy + 0.2):
        prim('cube', 'rocker', loc=(cx, y, 0.03), scale=(0.3, 0.02, 0.025), material=wood)
    d = R['doll']
    d.location = (cx, cy - 0.02, 0.45); d.rotation_euler = (0, 0, 0.15); d.scale = (1.1, 1.1, 1.1)
    shawl = prim('torus', 'redshawl', loc=(cx, cy - 0.02, 0.62), major_radius=0.085, minor_radius=0.035, material=lib.mat('redwool', (0.62, 0.05, 0.04), rough=1.0, sheen=0.7, bump='knit', bump_scale=40, bump_str=0.5, aux=(0.35, 0, 0)))
    shawl.scale = (1.15, 1.1, 0.7)
    wheel = R['wheel']
    wheel.rotation_euler = (0, 0, 0); wheel.keyframe_insert('rotation_euler', index=0, frame=1)
    wheel.rotation_euler = (math.tau * 0.6, 0, 0); wheel.keyframe_insert('rotation_euler', index=0, frame=192)
    for fc in wheel.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    lib.tube('wheelred', lib.catenary(V((-1.5, 0.5, 0.42)), V((cx - 0.05, cy, 0.58)), sag=0.12, n=24), 0.0016, mats['red'])
    return sc


@shot(exposure=1.4)
def E7(out, preview):
    """outside the window looking in at the doll in the sun, then a long pull back: the cottage on its hill in
    the morning, smoke rising, one red thread across the snow to the pit; the picture fades to paper"""
    sc = lib.new_scene(192, out, preview=preview)
    cam, tgt = lib.camera(lens=50)
    cam_keys(cam, tgt, [(1, (-1.5, -2.4, 1.55), (-1.55, 0.6, 1.35), 50, None), (192, (-16, -40, 10), (6, 2, 1.0), 30, None)])
    sets.exterior(sc, cam, tgt, storm=False, dawn=True, window_glow=0.25, window_alpha=0.25)
    mats = M()
    droot, dp = lib.doll('doll', (-1.55, 0.55, 1.0), 1.4, mats)
    droot.rotation_euler = (0, 0, 0.1)
    prim('cube', 'insill', loc=(-1.55, 0.4, 0.96), scale=(0.7, 0.3, 0.03), material=mats['darkwood'])
    sh = prim('torus', 'redshawl', loc=(-1.55, 0.55, 1.24), major_radius=0.12, minor_radius=0.05, material=lib.mat('redwool', (0.62, 0.05, 0.04), rough=1.0, sheen=0.7, aux=(0.35, 0, 0)))
    sh.scale = (1.1, 1.1, 0.7)
    light('POINT', 'insun', (-1.2, 0.0, 2.0), 15, color=(1.0, 0.85, 0.6), size=0.3)
    pts = []
    for i in range(30):
        t = i / 29
        p = V((19.4, 3.2, 0.02)).lerp(V((2.25, -0.5, 0.02)), t); p.y += math.sin(t * 6) * 0.4
        pts.append(p)
    pts.append(V((2.25, -0.08, 1.0)))
    lib.tube('redline', pts, 0.01, mats['red'])
    return sc


# ── model review stills (not part of either film): python render.py -- K1 --still=1 ───────────────────
@shot(exposure=1.0)
def K1(out, preview):
    """the knitter at the table, three-quarter front, lit warm"""
    sc = lib.new_scene(1, out, preview=preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = lib.camera(lens=40, fstop=8)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='lying')
    c = V((0.0, 1.3, 0.8))
    cam_keys(cam, tgt, [(1, V((0.75, 0.42, 1.2)), c, 40, 1.3)])
    light('AREA', 'k1key', (0.8, 0.2, 1.8), 60, color=(1.0, 0.8, 0.6), size=1.0, rot=(0.9, 0, 0.5))
    return sc


@shot(exposure=1.0)
def K2(out, preview):
    """her face and hands, close"""
    sc = lib.new_scene(1, out, preview=preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = lib.camera(lens=60, fstop=8)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='lying')
    bpy.context.view_layer.update()
    h = R['kparts']['head'].matrix_world @ V((0, -0.04, 0.06))
    cam_keys(cam, tgt, [(1, h + V((0.16, -0.62, 0.06)), h + V((0, 0, -0.07)), 60, 0.64)])
    light('AREA', 'k2key', (0.6, 0.4, 1.6), 40, color=(1.0, 0.8, 0.6), size=0.8, rot=(1.0, 0, 0.6))
    return sc


@shot(exposure=1.0)
def K3(out, preview):
    """standing with the lantern, three-quarter"""
    sc = lib.new_scene(1, out, preview=preview, pos_lo=(-6, -3, -1), pos_size=12.0)
    cam, tgt = lib.camera(lens=28, fstop=8)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sit', knitter_on=False)
    mats = M()
    kr, kp = lib.knitter('knitter', (-0.9, 2.2, 0.0), mats, seated=False)
    kr.rotation_euler = (0, 0, math.radians(-30))
    c = V((-0.9, 2.2, 0.82))
    cam_keys(cam, tgt, [(1, V((-1.85, 0.55, 1.05)), c, 28, 1.9)])
    light('AREA', 'k3key', (0.4, 1.0, 1.9), 80, color=(1.0, 0.8, 0.6), size=1.2, rot=(0.9, 0, 0.6))
    return sc


import shots_intro  # noqa: E402,F401  (the prologue)
import shots_end  # noqa: E402,F401  (the two endings)
