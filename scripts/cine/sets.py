"""Spindledeep cinematics: the sets. Exterior (the Brink in a storm or at dawn), the cottage interior
(night or morning), the Loom, and the shaft. Coordinates: metres, X right, Y away from the usual camera, Z up."""
import math
import random

import bpy
import numpy as np
from mathutils import Vector as V

import lib
from lib import prim, link, mesh_obj, curve_obj, light, empty, parent, key, M

PIT = (26.0, 7.0, 7.5, 5.5)     # centre x, y and radii of the Throat's mouth


def _fbm(x, y, oct=4, seed=0):
    rng = np.random.default_rng(seed)
    ph = rng.random((oct, 2)) * 100
    s = 0; a = 1; f = 1
    for i in range(oct):
        s = s + a * np.sin(x * 0.11 * f + ph[i, 0]) * np.cos(y * 0.13 * f + ph[i, 1])
        a *= 0.5; f *= 2.03
    return s


def ground(mats, storm=True):
    """the snowfield: a levelled yard round the cottage, drifts, hills behind, and the black mouth of the pit"""
    cx, cy, rx, ry = PIT
    xs = np.arange(-70, 90.01, 0.6); ys = np.arange(-50, 110.01, 0.6)
    X, Y = np.meshgrid(xs, ys)
    Z = _fbm(X, Y, 5, 1) * 0.35 + _fbm(X * 3, Y * 3, 3, 2) * 0.06
    Z += np.clip((Y - 25) / 60, 0, 1) ** 1.6 * 14 + np.clip((Y - 60) / 40, 0, 1) * 10 * (0.6 + 0.4 * np.sin(X * 0.05))
    yard = np.exp(-(((X - 0) / 9) ** 4 + ((Y - 2.5) / 7) ** 4))
    Z = Z * (1 - yard) + (-0.02) * yard
    e = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2
    Z -= np.clip(1.6 - e, 0, 1.6) ** 2 * 0.5          # the snow sags toward the lip
    nx, ny = len(xs), len(ys)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            fx, fy = xs[i] + 0.3, ys[j] + 0.3
            if ((fx - cx) / rx) ** 2 + ((fy - cy) / ry) ** 2 < 1.0:
                continue
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    g = mesh_obj('ground', verts, faces, mats['snow'], smooth=True)
    # the pit's throat: rings of rock dropping into the dark
    rings, seg = 26, 72
    vs, fs = [], []
    rng = np.random.default_rng(5)
    for k in range(rings):
        z = -k * 1.6
        grow = 1.0 + 0.12 * math.sin(k * 0.7) - 0.004 * k
        for s in range(seg):
            a = s / seg * math.tau
            n = 1 + 0.08 * math.sin(a * 5 + k) + 0.05 * math.sin(a * 11 + k * 2.3) + rng.random() * 0.04
            vs.append((cx + math.cos(a) * rx * grow * n, cy + math.sin(a) * ry * grow * n, z + 0.15))
    for k in range(rings - 1):
        for s in range(seg):
            a = k * seg + s; b = k * seg + (s + 1) % seg
            fs.append((a, b, b + seg, a + seg))
    w = mesh_obj('pit_wall', vs, fs, mats['rock'], smooth=True)
    lib.displace(w, 0.5, 2.5)
    floor = prim('plane', 'pit_dark', loc=(cx, cy, -9), scale=(rx * 1.4, ry * 1.4, 1), material=mats['black'])
    return g


def cottage(mats, window_glow=1.0, interior=True, door_open=0.0, window_alpha=0.62):
    """the knitter's log cottage, front facing -Y, 7.6 m wide, floor at z=0"""
    W, D, H = 7.6, 5.0, 3.3
    x0, x1 = -W / 2, W / 2
    win = (-2.2, -0.9, 1.0, 2.1)
    door = (1.3, 2.3, 0.0, 2.15)
    objs = []
    random.seed(11)
    objs += lib.log_wall('front', x0, x1, 0.25, H, 0.0, mat_log=mats['log'], mat_end=mats['logend'], gaps=[win, door])
    objs += lib.log_wall('back', x0, x1, 0.25, H, D, mat_log=mats['log'], mat_end=mats['logend'])
    for side, x in (('left', x0), ('right', x1)):
        ws = lib.log_wall(side, 0.0, D, 0.25 + 0.155, H - 0.15, 0.0, mat_log=mats['log'], mat_end=mats['logend'])
        for o in ws:
            # rotate the wall about the corner so it runs along Y
            o.location = V((x, o.location.x, o.location.z))
            o.rotation_euler = (math.pi / 2, 0, 0)
        objs += ws
    # stone footing
    for i, x in enumerate(np.arange(x0 - 0.2, x1 + 0.2, 0.55)):
        s = prim('cube', f'foot_{i}', loc=(x + 0.27, -0.05, 0.1), scale=(0.26, 0.2, 0.17), material=mats['stone'])
        lib.displace(s, 0.03, 0.2, subdiv=2)
    # gables and roof
    ridge = H + 0.25 + 2.6
    for y in (-0.02, D + 0.02):
        mesh_obj('gable', [(x0 - 0.2, y, H + 0.2), (x1 + 0.2, y, H + 0.2), (0, y, ridge)], [(0, 1, 2)], mats['plank'])
    for s in (-1, 1):
        ang = math.atan2(ridge - H, W / 2 + 0.9)
        L = math.hypot(W / 2 + 0.9, ridge - H)
        cxr = s * (W / 4 + 0.45) / 1.0
        r = prim('cube', f'roof{s}', loc=(s * (W / 2 + 0.9) / 2, D / 2, (ridge + H) / 2 + 0.05), rot=(0, s * ang, 0), scale=(L / 2 + 0.1, D / 2 + 0.6, 0.09), material=mats['shingle'])
        sn = prim('cube', f'roofsnow{s}', loc=(s * (W / 2 + 0.9) / 2 - s * 0.02, D / 2, (ridge + H) / 2 + 0.24), rot=(0, s * ang, 0), scale=(L / 2 + 0.05, D / 2 + 0.62, 0.14), material=mats['snow'])
        lib.displace(sn, 0.12, 0.6, subdiv=3)
        # icicles along the eave
        for k in range(14):
            ix = s * (W / 2 + 0.85) + random.uniform(-0.1, 0.1)
            iy = -0.55 + k * (D + 1.1) / 14
            if s < 0 and abs(iy) < 0.6:
                pass
            ic = prim('cone', f'ice{s}_{k}', loc=(ix, iy, H + 0.08 - 0.12), rot=(math.pi, 0, 0), scale=(0.02, 0.02, 0.1 + random.random() * 0.18), material=mats['snow'], vertices=6)
    # front eave icicles
    for k in range(18):
        ix = x0 + 0.2 + k * (W - 0.4) / 18
        prim('cone', f'icef_{k}', loc=(ix, -0.62, H + 0.02), rot=(math.pi, 0, 0), scale=(0.018, 0.018, 0.08 + random.random() * 0.22), material=mats['snow'], vertices=6)
    # chimney
    ch = prim('cube', 'chimney', loc=(2.2, D * 0.6, ridge - 0.2), scale=(0.35, 0.35, 1.3), material=mats['stone'])
    lib.displace(ch, 0.03, 0.3, subdiv=2)
    prim('cube', 'chimneysnow', loc=(2.2, D * 0.6, ridge + 1.13), scale=(0.4, 0.4, 0.07), material=mats['snow'])
    # window: frame, mullions, glass that glows and lets her silhouette through
    wx0, wx1, wz0, wz1 = win
    glass = lib.mat('glass', (1.0, 0.75, 0.45), rough=0.2, emit=(1.0, 0.62, 0.3), estr=1.2 * window_glow * window_alpha, alpha=window_alpha, aux=(0, 0, 1))
    prim('plane', 'win_glass', loc=((wx0 + wx1) / 2, 0.0, (wz0 + wz1) / 2), rot=(math.pi / 2, 0, 0), scale=((wx1 - wx0) / 2, (wz1 - wz0) / 2, 1), material=glass)
    for (lx, lz, sx, sz) in [((wx0 + wx1) / 2, wz0, (wx1 - wx0) / 2 + 0.08, 0.05), ((wx0 + wx1) / 2, wz1, (wx1 - wx0) / 2 + 0.08, 0.05),
                             (wx0, (wz0 + wz1) / 2, 0.05, (wz1 - wz0) / 2), (wx1, (wz0 + wz1) / 2, 0.05, (wz1 - wz0) / 2),
                             ((wx0 + wx1) / 2, (wz0 + wz1) / 2, 0.025, (wz1 - wz0) / 2), ((wx0 + wx1) / 2, (wz0 + wz1) / 2, (wx1 - wx0) / 2, 0.025)]:
        prim('cube', 'win_frame', loc=(lx, -0.06, lz), scale=(sx, 0.06, sz), material=mats['darkwood'])
    prim('cube', 'sill_out', loc=((wx0 + wx1) / 2, -0.18, wz0 - 0.06), scale=((wx1 - wx0) / 2 + 0.15, 0.14, 0.04), material=mats['darkwood'])
    prim('cube', 'sill_snow', loc=((wx0 + wx1) / 2, -0.2, wz0 - 0.0), scale=((wx1 - wx0) / 2 + 0.12, 0.13, 0.03), material=mats['snow'])
    # shutters, one hanging crooked. The front logs bulge out to y = -0.17, so the boards sit just in front of
    # that (they used to be buried in the logs); the loose one swings out from its hinge edge, never into the wall
    yf = -0.17 - 0.03 - 0.006
    prim('cube', 'shutterL', loc=(wx0 - 0.38, yf, (wz0 + wz1) / 2), scale=(0.3, 0.03, 0.56), material=mats['plank'])
    a = 0.35
    sh = prim('cube', 'shutterR', loc=(wx1 + 0.1 + 0.3 * math.cos(a), yf - 0.3 * math.sin(a), (wz0 + wz1) / 2 - 0.08), rot=(0, 0.18, -a), scale=(0.3, 0.03, 0.56), material=mats['plank'])
    # door
    dx0, dx1, dz0, dz1 = door
    hinge = empty('door_hinge', (dx0, -0.02, 0.0))
    dr = prim('cube', 'door', loc=((dx1 - dx0) / 2, 0, (dz1 - dz0) / 2), scale=((dx1 - dx0) / 2, 0.05, (dz1 - dz0) / 2), material=mats['plank'])
    parent(dr, hinge, keep=False)
    for z in (0.4, 1.7):
        b = prim('cube', f'hingeband{z}', loc=(0.3, -0.06, z), scale=(0.32, 0.01, 0.03), material=mats['iron'])
        parent(b, hinge, keep=False)
    hinge.rotation_euler = (0, 0, -door_open)
    prim('cube', 'doorstep', loc=((dx0 + dx1) / 2, -0.35, 0.06), scale=(0.6, 0.3, 0.08), material=mats['stone'])
    # inside: a warm room the window shows (back wall, a lamp), floor
    if interior:
        prim('cube', 'in_floor', loc=(0, D / 2, 0.24), scale=(W / 2, D / 2, 0.02), material=mats['plank'])
        prim('cube', 'in_ceiling', loc=(0, D / 2, H + 0.15), scale=(W / 2, D / 2, 0.02), material=mats['plank'])
        prim('cube', 'in_backwall', loc=(-1.0, 2.6, 1.6), scale=(2.0, 0.05, 1.5), material=lib.mat('in_wall', (0.55, 0.42, 0.3), rough=0.9, bump='wood', bump_scale=4, bump_str=0.2, emit=(1.0, 0.6, 0.3), estr=0.8 * window_glow, aux=(0, 0, 0.6)))
        L = light('POINT', 'in_lamp', (-1.3, 1.8, 1.2), 160 * window_glow, color=(1.0, 0.58, 0.28), size=0.05)
        lib.flicker(L, 160 * window_glow, 0.12, 0.9, 3)
        # the window's warm spill on the snow outside
        sp = light('SPOT', 'win_spill', (-1.55, 0.3, 1.6), 260 * window_glow, color=(1.0, 0.6, 0.3), size=0.4, rot=(math.radians(-62), 0, 0), spot=math.radians(70))
        lib.flicker(sp, 260 * window_glow, 0.12, 0.9, 3)
    return {'hinge': hinge, 'ridge': ridge, 'win': win, 'door': door, 'D': D}


def woodshed(mats):
    x0, x1 = -6.3, -3.85
    prim('cube', 'shed_back', loc=((x0 + x1) / 2, 1.6, 1.0), scale=((x1 - x0) / 2, 0.05, 1.0), material=mats['plank'])
    for x in (x0, x1 - 0.05):
        prim('cube', f'shed_post{x}', loc=(x, -0.2, 0.9), scale=(0.06, 0.06, 0.95), material=mats['darkwood'])
    prim('cube', 'shed_roof', loc=((x0 + x1) / 2, 0.6, 2.05), rot=(0.12, 0, 0), scale=((x1 - x0) / 2 + 0.2, 1.25, 0.05), material=mats['shingle'])
    s = prim('cube', 'shed_roofsnow', loc=((x0 + x1) / 2, 0.58, 2.17), rot=(0.12, 0, 0), scale=((x1 - x0) / 2 + 0.18, 1.25, 0.08), material=mats['snow'])
    lib.displace(s, 0.06, 0.4, subdiv=3)
    lib.woodpile('pile', x0 + 0.1, x1 - 0.1, 0.0, 1.5, 0.0, 913, mats)
    # chopping block with the axe
    blk = prim('cyl', 'block', loc=(-7.0, -0.6, 0.22), scale=(0.28, 0.28, 0.22), material=mats['log'], vertices=24)
    hx = prim('cyl', 'axe_haft', loc=(-6.85, -0.6, 0.62), rot=(0, 0.6, 0), scale=(0.02, 0.02, 0.38), material=mats['plank'], vertices=8)
    prim('cube', 'axe_head', loc=(-7.05, -0.6, 0.43), rot=(0, 0.6, 0), scale=(0.1, 0.012, 0.05), material=mats['iron'])


def trees(mats):
    bark = lib.mat('bark', (0.06, 0.055, 0.05), rough=0.95, bump='noise', bump_scale=30, bump_str=0.3)
    for i, (x, y, h) in enumerate([(-12, 7, 7.5), (8.5, 9, 6.0), (12.5, 4, 4.4), (33, 16, 8), (40, 9, 6.2), (-22, 14, 7), (52, 18, 7)]):
        lib.bare_tree(f'tree{i}', (x, y, 0.0), h, 31 + i, bark)


def fence(mats):
    for i in range(7):
        x = -9.5 - i * 1.6
        prim('cube', f'fpost{i}', loc=(x, -1.5 + i * 0.2, 0.55), rot=(0, (i % 3 - 1) * 0.08, 0), scale=(0.05, 0.05, 0.6), material=mats['darkwood'])
        if i < 6 and i != 3:
            prim('cube', f'frail{i}', loc=(x - 0.8, -1.4 + i * 0.2, 0.8), rot=(0, 0, 0.12), scale=(0.82, 0.03, 0.035), material=mats['darkwood'])


def smoke(storm=True):
    """chimney smoke as a volume: streams downwind in the storm, rises straight at dawn"""
    m = bpy.data.materials.new('smoke'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Color'].default_value = (0.5, 0.5, 0.52, 1)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.5; nz.inputs['Detail'].default_value = 6
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    gr = nt.nodes.new('ShaderNodeTexGradient'); gr.gradient_type = 'SPHERICAL'
    nt.links.new(tc.outputs['Object'], gr.inputs['Vector'])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    nt.links.new(nz.outputs['Fac'], mul.inputs[0]); nt.links.new(gr.outputs['Fac'], mul.inputs[1])
    ramp = nt.nodes.new('ShaderNodeMath'); ramp.operation = 'MULTIPLY'; ramp.inputs[1].default_value = 3.0
    nt.links.new(mul.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], vol.inputs['Density'])
    nt.links.new(vol.outputs['Volume'], out.inputs['Volume'])
    if storm:
        o = prim('cube', 'smoke', loc=(5.6, 3.0, 7.2), rot=(0, 0.25, 0), scale=(3.6, 0.6, 0.7), material=m)
    else:
        o = prim('cube', 'smoke', loc=(2.2, 3.0, 10.5), scale=(0.9, 0.9, 3.2), material=m)
    # drift the noise through the domain over time
    mp.inputs['Location'].default_value = (0, 0, 0)
    mp.inputs['Location'].keyframe_insert('default_value', frame=1)
    mp.inputs['Location'].default_value = (-6, 0, 0) if storm else (0, 0, -4)
    mp.inputs['Location'].keyframe_insert('default_value', frame=400)
    for fc in m.node_tree.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    return o


def exterior(sc, cam, tgt, storm=True, dawn=False, snow_box=None, snow_n=9000, window_glow=1.0, door_open=0.0, interior=True, window_alpha=0.62, snow_width=0.008):
    mats = M()
    if dawn:
        lib.world(sc, top=(0.18, 0.22, 0.32), horizon=(0.9, 0.62, 0.42), strength=1.2, fog=0.006, fog_color=(1.0, 0.85, 0.7), aniso=0.5,
                  fog_bounds=((-120, -80, -0.6), (140, 160, 60)))
        light('SUN', 'sun', (0, 0, 20), 3.2, color=(1.0, 0.78, 0.55), size=math.radians(1.5), rot=(math.radians(84), 0, math.radians(-120)))
        light('SUN', 'skyfill', (0, 0, 20), 0.35, color=(0.6, 0.7, 0.95), size=math.radians(40), rot=(math.radians(20), 0, math.radians(60)), shadow=False)
    else:
        lib.world(sc, top=(0.012, 0.015, 0.022), horizon=(0.05, 0.055, 0.07), strength=1.0, fog=0.012 if storm else 0.006, fog_color=(0.62, 0.66, 0.75), aniso=0.25,
                  fog_bounds=((-120, -80, -0.6), (140, 160, 60)))
        light('SUN', 'moon', (0, 0, 20), 1.1, color=(0.7, 0.78, 1.0), size=math.radians(2), rot=(math.radians(52), 0, math.radians(-35)))
    ground(mats, storm)
    info = cottage(mats, window_glow=window_glow, interior=interior, door_open=door_open, window_alpha=window_alpha)
    woodshed(mats)
    trees(mats)
    fence(mats)
    smoke(storm and not dawn)
    if storm and snow_box:
        lo, hi = snow_box
        s = lib.Snow('snow', snow_n, lo, hi, wind=(7.5, 1.0, -1.8), gust=0.5, streak=0.022, width=snow_width, cam=cam, tgt=tgt, material=mats['flake'])
        lib.SNOWS.append(s); lib.register_frames()
    return info


# ── interior ───────────────────────────────────────────────────────────────
def spinning_wheel(name, loc, mats, spin_frames=None, red=False):
    root = empty(name, loc)
    wood = mats['darkwood']
    wheel = empty(name + '_wheel', (0, 0, 0.62)); parent(wheel, root, keep=False)
    rim = prim('torus', name + '_rim', loc=(0, 0, 0), rot=(0, math.pi / 2, 0), major_radius=0.32, minor_radius=0.018, material=wood)
    parent(rim, wheel, keep=False)
    for k in range(10):
        a = k * math.tau / 10
        sp = prim('cyl', name + f'_spoke{k}', loc=(0, math.cos(a) * 0.16, math.sin(a) * 0.16), rot=(a + math.pi / 2, 0, 0), scale=(0.008, 0.008, 0.16), material=wood, vertices=8)
        parent(sp, wheel, keep=False)
    hub = prim('cyl', name + '_hub', rot=(0, math.pi / 2, 0), scale=(0.04, 0.04, 0.05), material=wood, vertices=12)
    parent(hub, wheel, keep=False)
    for (y, z, ry, L) in [(-0.25, 0.3, 0.3, 0.32), (0.25, 0.3, -0.3, 0.32), (0.0, 0.62, 0, 0.0)]:
        if L:
            lg = prim('cyl', name + f'_leg{y}', loc=(0.05, y, z), rot=(ry, 0, 0), scale=(0.02, 0.02, L), material=wood, vertices=8)
            parent(lg, root, keep=False)
    bench = prim('cube', name + '_bench', loc=(0.05, -0.1, 0.12), rot=(0, 0, 0), scale=(0.08, 0.5, 0.03), material=wood)
    parent(bench, root, keep=False)
    for y in (-0.45, 0.3):
        lg = prim('cyl', name + f'_foot{y}', loc=(0.05, y, 0.06), scale=(0.02, 0.02, 0.07), material=wood, vertices=8)
        parent(lg, root, keep=False)
    fly = prim('cyl', name + '_flyer', loc=(0.05, -0.5, 0.42), rot=(0, math.pi / 2, 0), scale=(0.035, 0.035, 0.08), material=mats['red'] if red else mats['wool_grey'], vertices=12)
    parent(fly, root, keep=False)
    band = lib.curve_obj(name + '_band', [(0.0, 0.0, 0.62 + 0.32), (0.04, -0.25, 0.7), (0.05, -0.5, 0.45), (0.04, -0.25, 0.35), (0.0, 0.0, 0.62 - 0.32)], bevel=0.002, material=mats['grey_thread'])
    parent(band, root, keep=False)
    if spin_frames:
        f0, f1, turns = spin_frames
        wheel.rotation_euler = (0, 0, 0); wheel.keyframe_insert('rotation_euler', index=0, frame=f0)
        wheel.rotation_euler = (turns * math.tau, 0, 0); wheel.keyframe_insert('rotation_euler', index=0, frame=f1)
        for fc in wheel.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    return root, wheel


def interior(sc, cam, tgt, night=True, outside_snow=True, candle_lit=True, knitter_on=True, doll_pose='lying', red_shawl=False):
    """a corner of the cottage: the window wall (y=0, facing +Y into the room), a table under the window,
    the door in the left wall, a shelf and the spinning wheel"""
    mats = M()
    R = {}
    if night:
        lib.world(sc, top=(0.004, 0.005, 0.008), horizon=(0.008, 0.009, 0.013), strength=1.0, fog=0.012, fog_color=(0.9, 0.85, 0.8), aniso=0.3)
    else:
        lib.world(sc, top=(0.25, 0.3, 0.4), horizon=(0.9, 0.7, 0.5), strength=0.6, fog=0.05, fog_color=(1.0, 0.92, 0.82), aniso=0.6)
    random.seed(4)
    # walls
    lib.log_wall('iwin', -2.6, 2.6, 0.0, 2.6, 0.0, r=0.15, mat_log=mats['log'], mat_end=mats['logend'], gaps=[(-0.6, 0.6, 1.0, 2.0)], overhang=0.0)
    lw = lib.log_wall('ileft', 0.0, 3.5, 0.0, 2.6, 0.0, r=0.15, mat_log=mats['log'], mat_end=mats['logend'], gaps=[(1.2, 2.15, 0.0, 2.0)], overhang=0.0)
    for o in lw:
        o.location = V((-2.6, o.location.x, o.location.z)); o.rotation_euler = (math.pi / 2, 0, 0)
    rw = lib.log_wall('iright', 0.0, 3.5, 0.0, 2.6, 0.0, r=0.15, mat_log=mats['log'], mat_end=mats['logend'], overhang=0.0)
    for o in rw:
        o.location = V((2.6, o.location.x, o.location.z)); o.rotation_euler = (math.pi / 2, 0, 0)
    prim('cube', 'ifloor', loc=(0, 1.8, -0.02), scale=(2.7, 2.0, 0.02), material=mats['plank'])
    for k in range(10):
        prim('cube', f'iboard{k}', loc=(-2.6 + k * 0.54, 1.8, 0.001), scale=(0.004, 2.0, 0.002), material=mats['darkwood'])
    prim('cube', 'iceil', loc=(0, 1.8, 2.62), scale=(2.7, 2.0, 0.03), material=mats['plank'])
    for k in range(4):
        prim('cube', f'ibeam{k}', loc=(0, 0.4 + k * 1.0, 2.5), scale=(2.7, 0.08, 0.1), material=mats['darkwood'])
    # window: frame, mullions, a deep sill, glass with frost that can creep across it
    frost = lib.mat('frost', (0.85, 0.9, 1.0), rough=0.3, alpha=0.18, emit=(0.5, 0.55, 0.65), estr=0.05)
    R['glass'] = prim('cube', 'iglass', loc=(0, -0.02, 1.5), scale=(0.6, 0.006, 0.5), material=frost)
    for (lx, lz, sx, sz) in [(0, 1.0, 0.68, 0.05), (0, 2.0, 0.68, 0.05), (-0.62, 1.5, 0.05, 0.5), (0.62, 1.5, 0.05, 0.5), (0, 1.5, 0.02, 0.5), (0, 1.5, 0.6, 0.02)]:
        prim('cube', 'iframe', loc=(lx, 0.02, lz), scale=(sx, 0.05, sz), material=mats['darkwood'])
    R['sill'] = prim('cube', 'isill', loc=(0, 0.16, 0.97), scale=(0.75, 0.16, 0.03), material=mats['darkwood'])
    # outside the window: night (snow streaks, a far ridge) or morning (bright snow)
    if night:
        prim('plane', 'outside', loc=(0, -14, 2), rot=(math.pi / 2, 0, 0), scale=(30, 12, 1), material=lib.mat('outside', (0.02, 0.025, 0.035), rough=1.0, emit=(0.02, 0.025, 0.04), estr=0.6))
        prim('cube', 'outside_snow', loc=(0, -6, -0.2), scale=(20, 6, 0.8), material=mats['snow'])
        light('AREA', 'moonwin', (0.3, -1.2, 2.4), 25, color=(0.6, 0.7, 1.0), size=1.4, rot=(math.radians(60), 0, 0))
        if outside_snow:
            s = lib.Snow('snow_out', 2500, (-5, -6, -1), (5, -0.15, 4), wind=(4.0, 0.5, -1.2), gust=0.5, streak=0.04, width=0.008, cam=cam, tgt=tgt, material=mats['flake'], seed=8)
            lib.SNOWS.append(s); lib.register_frames()
    else:
        prim('plane', 'outside', loc=(0, -14, 2), rot=(math.pi / 2, 0, 0), scale=(30, 12, 1), material=lib.mat('outside', (0.9, 0.85, 0.8), rough=1.0, emit=(1.0, 0.9, 0.78), estr=1.6, aux=(0, 0, 1)))
        prim('cube', 'outside_snow', loc=(0, -6, -0.2), scale=(20, 6, 0.8), material=mats['snow'])
        sun = light('SUN', 'sun', (0, -5, 5), 6.0, color=(1.0, 0.8, 0.58), size=math.radians(1.0), rot=(math.radians(62), 0, math.radians(165)))
        light('AREA', 'skywin', (0, -0.8, 1.6), 30, color=(0.85, 0.9, 1.0), size=1.2, rot=(math.radians(90), 0, 0))
    # table under the window
    prim('cube', 'table', loc=(0, 0.7, 0.76), scale=(0.85, 0.42, 0.03), material=mats['plank'])
    for (x, y) in [(-0.78, 0.35), (0.78, 0.35), (-0.78, 1.05), (0.78, 1.05)]:
        prim('cube', 'tleg', loc=(x, y, 0.37), scale=(0.035, 0.035, 0.37), material=mats['darkwood'])
    R['candle'] = lib.candle('candle', (0.42, 0.55, 0.79), mats, height=0.13, lit=candle_lit, energy=7.0 if night else 0.0, seed=2) if candle_lit else lib.candle('candle', (0.42, 0.55, 0.79), mats, height=0.05, lit=False)
    # scraps: a coat sleeve, the ribbon, scissors, spool of red thread, a needle
    sl = prim('cyl', 'sleeve', loc=(-0.45, 0.75, 0.82), rot=(math.pi / 2, 0, 0.6), scale=(0.05, 0.035, 0.2), material=mats['coat'], vertices=16)
    lib.curve_obj('ribbon_loose', [(-0.62, 0.45, 0.795), (-0.5, 0.52, 0.80), (-0.42, 0.42, 0.795), (-0.3, 0.5, 0.80), (-0.22, 0.46, 0.795)], bevel=0.0, material=mats['ribbon'])
    rb = bpy.data.objects['ribbon_loose']; rb.data.extrude = 0.008
    for s in (-1, 1):
        prim('cube', f'scissor{s}', loc=(0.12, 0.95, 0.795), rot=(0, 0, 0.4 + s * 0.12), scale=(0.07, 0.006, 0.002), material=mats['iron'])
        prim('torus', f'sring{s}', loc=(0.05 + s * 0.012, 0.92 - s * 0.012, 0.795), major_radius=0.014, minor_radius=0.003, material=mats['iron'])
    spool = empty('spool', (0.62, 0.85, 0.79))
    for z in (0.0, 0.07):
        e = prim('cyl', f'spool_end{z}', loc=(0, 0, z + 0.005), scale=(0.03, 0.03, 0.005), material=mats['plank'], vertices=20); parent(e, spool, keep=False)
    w = prim('cyl', 'spool_red', loc=(0, 0, 0.04), scale=(0.024, 0.024, 0.032), material=mats['red'], vertices=20); parent(w, spool, keep=False)
    R['spool'] = spool
    # the doll
    if doll_pose == 'lying':
        droot, dp = lib.doll('doll', (-0.05, 0.62, 0.862), 1.0, mats)     # lying on the table top (0.79), not in it
        droot.rotation_euler = (-math.pi / 2 + 0.12, 0, 0.25)
    elif doll_pose == 'sill':
        droot, dp = lib.doll('doll', (0.0, 0.12, 0.99), 1.0, mats)
    else:
        droot, dp = lib.doll('doll', (0, 0.6, 0.805), 1.0, mats)          # feet on the table top, not in it
    R['doll'], R['dparts'] = droot, dp
    # the spinning wheel and its stool
    R['wheel_root'], R['wheel'] = spinning_wheel('wheel', (1.75, 1.5, 0.0), mats, red=red_shawl)
    # shelf on the right wall: jars, yarn balls
    prim('cube', 'shelf', loc=(2.45, 1.4, 1.65), scale=(0.15, 0.6, 0.02), material=mats['darkwood'])
    for k in range(5):
        if k % 2:
            prim('sphere', f'yarnball{k}', loc=(2.45, 0.95 + k * 0.22, 1.73), scale=(0.07, 0.07, 0.065), material=mats['wool_grey' if k != 3 else 'wool_dark'], segments=16, ring_count=10)
        else:
            prim('cyl', f'jar{k}', loc=(2.45, 0.95 + k * 0.22, 1.75), scale=(0.05, 0.05, 0.09), material=lib.mat(f'jar{k}', (0.5, 0.55, 0.5), rough=0.15, alpha=0.5), vertices=16)
    # door in the left wall, hinged at y=1.2; the grey thread knotted round its latch
    hinge = empty('idoor_hinge', (-2.58, 1.2, 0.0))
    d = prim('cube', 'idoor', loc=(0.0, 0.47, 1.0), scale=(0.04, 0.47, 1.0), material=mats['plank']); parent(d, hinge, keep=False)
    for z in (0.35, 1.65):
        b = prim('cube', 'idband', loc=(0.05, 0.3, z), scale=(0.008, 0.3, 0.025), material=mats['iron']); parent(b, hinge, keep=False)
    latch = prim('cube', 'ilatch', loc=(0.07, 0.86, 1.05), scale=(0.02, 0.06, 0.012), material=mats['iron']); parent(latch, hinge, keep=False)
    R['door'] = hinge
    # the knitter at the table, seen mostly as her shadow on the wall
    if knitter_on:
        kr, kp = lib.knitter('knitter', (0.0, 1.45, 0.0), mats, seated=True)
        R['knitter'], R['kparts'] = kr, kp
        stool = prim('cube', 'kstool', loc=(0, 1.55, 0.24), scale=(0.22, 0.2, 0.24), material=mats['darkwood'])
        R['stool'] = stool
    # a cold fill so the dark keeps shape
    light('AREA', 'fill', (0.5, 3.5, 2.2), 3.0 if night else 10.0, color=(0.6, 0.65, 0.8), size=3.0, rot=(math.radians(60), 0, math.radians(180)), shadow=False)
    return R


# ── the Loom ───────────────────────────────────────────────────────────────
def loom_cave(sc, cam, tgt, mats=None, progress_obj=None):
    mats = mats or M()
    lib.world(sc, top=(0.0, 0.0, 0.0), horizon=(0.003, 0.002, 0.002), strength=1.0, fog=0.012, fog_color=(0.85, 0.7, 0.6), aniso=0.4, fog_bounds=((-8, -6, -1), (8, 10, 8)))
    light('AREA', 'loomfill', (2.5, -2.5, 3.0), 60, color=(1.0, 0.75, 0.55), size=3.0, rot=(math.radians(50), 0, math.radians(40)), shadow=False)
    light('AREA', 'loomrim', (-1.5, 2.2, 2.2), 40, color=(1.0, 0.3, 0.2), size=1.5, rot=(math.radians(-60), 0, math.radians(200)))
    cave = prim('ico', 'cave', loc=(0, 3, 3), scale=(9, 8, 6), material=mats['rock'], subdivisions=5)
    for p in cave.data.polygons:
        p.use_smooth = True
    cave.data.flip_normals() if hasattr(cave.data, 'flip_normals') else None
    lib.displace(cave, 1.2, 1.2)
    fl = prim('plane', 'cfloor', loc=(0, 2, 0), scale=(12, 12, 1), material=mats['rock'])
    lib.displace(fl, 0.25, 0.8, subdiv=5, axis='Z')
    # the great loom behind her: posts, beams, warp threads, a half-woven grey cloth
    for x in (-2.2, 2.2):
        prim('cube', f'loompost{x}', loc=(x, 3.2, 1.8), scale=(0.1, 0.1, 1.8), material=mats['darkwood'])
    for z in (0.5, 3.4):
        prim('cyl', f'loombeam{z}', loc=(0, 3.2, z), rot=(0, math.pi / 2, 0), scale=(0.09, 0.09, 2.3), material=mats['darkwood'], vertices=16)
    prim('cube', 'cloth', loc=(0, 3.18, 1.0), scale=(2.0, 0.01, 0.5), material=mats['wool_grey'])
    for k in range(60):
        x = -2.0 + k * 4.0 / 59
        lib.curve_obj(f'warp{k}', [(x, 3.2, 1.5), (x, 3.2, 3.32)], bevel=0.0018, material=mats['grey_thread'], order=2)
    # her chair
    wood = mats['darkwood']
    # the back stands behind her shawl (which reaches y = 0.90); it used to cut through her back and arm
    prim('cube', 'seat', loc=(0, 0.66, 0.45), scale=(0.3, 0.33, 0.03), material=wood)
    prim('cube', 'chairback', loc=(0, 0.98, 0.95), rot=(-0.12, 0, 0), scale=(0.3, 0.03, 0.5), material=wood)
    for (x, y) in [(-0.27, 0.36), (0.27, 0.36), (-0.27, 0.95), (0.27, 0.95)]:
        prim('cyl', 'cleg', loc=(x, y, 0.22), scale=(0.025, 0.025, 0.23), material=wood, vertices=8)
    kr, kp = lib.knitter('knitter', (0.0, 0.62, 0.0), mats, seated=True)
    # stool with the candle
    prim('cyl', 'cstool', loc=(0.65, 0.2, 0.25), scale=(0.16, 0.16, 0.25), material=wood, vertices=16)
    cnd = lib.candle('lcandle', (0.65, 0.2, 0.5), mats, height=0.09, lit=True, energy=28.0, seed=5)
    return {'knitter': kr, 'kparts': kp, 'candle': cnd}


def shaft(sc, cam, tgt, mats=None, height=60):
    mats = mats or M()
    lib.world(sc, top=(0.0, 0.0, 0.0), horizon=(0.0, 0.0, 0.0), strength=1.0, fog=0.06, fog_color=(0.9, 0.75, 0.7), aniso=0.5)
    rings, seg = 40, 48
    vs, fs = [], []
    for k in range(rings):
        z = -height * 0.1 + k * height / rings
        for s in range(seg):
            a = s / seg * math.tau
            r = 3.4 + 0.6 * math.sin(a * 3 + k * 0.4) + 0.4 * math.sin(a * 7 - k * 0.9)
            vs.append((math.cos(a) * r, math.sin(a) * r, z))
    for k in range(rings - 1):
        for s in range(seg):
            a = k * seg + s; b = k * seg + (s + 1) % seg
            fs.append((a, a + seg, b + seg, b))
    w = mesh_obj('shaftwall', vs, fs, mats['rock'], smooth=True)
    lib.displace(w, 0.6, 1.8)
    return w
