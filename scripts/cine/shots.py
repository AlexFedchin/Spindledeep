"""Spindledeep cinematics: the shots. Each entry builds its set, camera and animation and returns the scene.
Frame counts are at 24 fps. Lenses are full-frame equivalents.

PROLOGUE (wordless, ~60 s): the storm, the window, her hands' shadow finishing the doll, the dark breathing at
the glass, the red thread tied round the doll's waist, the door opening on the storm, her lantern going down
into the pit, the doll on the sill, the doll's hand closing on the thread.
EPILOGUE: see the shot docstrings (kept out of the player-facing pages on purpose)."""
import math

import bpy
from mathutils import Vector as V, Matrix

import lib
import sets
from lib import key, cam_keys, light, empty, prim, parent, M

SHOTS = {}
INTRO = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9']
OUTRO = ['E2', 'E3', 'E4', 'E5', 'E6', 'E7']
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
@shot(exposure=1.35)
def I1(out, preview):
    """the Brink in a blizzard: high over the snow, the black mouth of the pit beside one lit window;
    a long slow descent and push to that window"""
    sc = lib.new_scene(168, out, preview=preview)
    cam, tgt = lib.camera(lens=28)
    cam_keys(cam, tgt, [(1, (-22, -40, 15), (9, 5, -1.0), 28, None), (168, (-6.0, -17, 2.6), (-1.2, 0.5, 1.6), 40, None)])
    lib.handheld(cam, 0.05, 0.4)
    sets.exterior(sc, cam, tgt, storm=True, snow_box=((-34, -46, -0.5), (16, -6, 16)), snow_n=14000)
    s2 = lib.Snow('snow_far', 9000, (-40, -8, -0.5), (60, 32, 18), wind=(7.5, 1.0, -1.8), gust=0.5, streak=0.03, width=0.018, cam=cam, tgt=tgt, material=M()['flake'], seed=9)
    lib.SNOWS.append(s2)
    return sc


@shot(exposure=0.9)
def I2(out, preview):
    """the window, close: snow streaming past the glass; inside, her silhouette bent over her work against the
    warm room, the spinning wheel beside her"""
    sc = lib.new_scene(120, out, preview=preview)
    cam, tgt = lib.camera(lens=50, fstop=4.0)
    cam_keys(cam, tgt, [(1, (-0.7, -6.8, 1.75), (-1.55, 0.2, 1.55), 50, 6.9), (120, (-1.4, -3.7, 1.62), (-1.55, 0.2, 1.55), 55, 3.8)])
    lib.handheld(cam, 0.012, 0.5)
    sets.exterior(sc, cam, tgt, storm=True, snow_box=((-8, -9, -0.3), (5, -0.25, 4.5)), snow_n=7000, window_alpha=0.14, snow_width=0.006)
    mats = M()
    kr, kp = lib.knitter('knitter_in', (-1.45, 1.05, 0.25), mats, seated=True)
    lib.knitting_needles(kp, 'knitter_in', mats)
    stool = prim('cube', 'stool_in', loc=(-1.45, 1.2, 0.49), scale=(0.2, 0.2, 0.24), material=mats['darkwood'])
    w, wheel = sets.spinning_wheel('wheel_in', (-0.4, 1.8, 0.25), mats, spin_frames=(1, 120, 1.2))
    # her hands working: the forearms dip in a slow rhythm
    for s, ph in ((-1, 0), (1, 12)):
        arm = kp[f'arm{s}']
        keys(arm, 'rotation_euler', [(1 + ph, (0.0, 0, 0)), (20 + ph, (0.18, 0, 0)), (40 + ph, (0.0, 0, 0)), (60 + ph, (0.2, 0, 0)), (80 + ph, (0.0, 0, 0)), (100 + ph, (0.17, 0, 0)), (120, (0.05, 0, 0))])
    keys(kp['head'], 'rotation_euler', [(1, (0.2, 0, 0)), (120, (0.28, 0, 0.05))])
    return sc


NEEDLE = [V((0, 0, 0)), V((0, 0, 0))]


def _carry(kr, kp):
    """standing knitter: right hand round the lantern's handle (lantern at root-local (0.24, -0.25, 0.62)), left hand
    pinching her grey thread a little forward of her hip. Returns the left pinch point in root space (for the thread)."""
    bpy.context.view_layer.update()
    lib.hand_pose(kp, 1, 'grip'); lib.hand_pose(kp, -1, 'pinch')
    mw = kr.matrix_world.copy()
    lib.arm_to(kp, 1, mw @ V((0.24, -0.25, 0.62 + 0.235)), offset=(-0.02, -0.004, -0.07))
    lib.arm_to(kp, -1, mw @ V((-0.2, -0.18, 0.8)), wrist=(0.3, 0, 0.3))
    bpy.context.view_layer.update()
    return mw.inverted() @ (kp['hand-1'].matrix_world @ lib.pinch_offset(kp, -1))


def _needle_path(f):
    """the needle going in and out of the doll's face, f = frame"""
    a = NEEDLE[0]; b = NEEDLE[1]
    cyc = [(1, a), (30, a), (62, b), (92, b * 0.25 + a * 0.75), (110, a), (140, a), (170, b), (192, b)]
    for (f0, p0), (f1, p1) in zip(cyc, cyc[1:]):
        if f0 <= f <= f1:
            t = (f - f0) / max(1, f1 - f0); t = t * t * (3 - 2 * t)
            return p0.lerp(p1, t)
    return cyc[-1][1]


@shot(exposure=1.0)
def I3(out, preview):
    """the table by candlelight, very close: the finished doll lying among the scraps it was made from — a coat
    sleeve, a ribbon — while a needle draws the last red stitch at its button eye; her shadow works on the wall"""
    sc = lib.new_scene(192, out, preview=preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = lib.camera(lens=40, fstop=2.8)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='lying')
    mats = M()
    kr, kp = R['knitter'], R['kparts']
    # she leans in over the work, the doll drawn to her edge of the table so her hands reach it (her chest stays
    # clear of the table edge at y 1.12)
    kr.location = (0.05, 1.36, 0.0); R['stool'].location.y = 1.46
    kp['torso'].rotation_euler = (0.2, 0, 0)
    kp['head'].rotation_euler = (0.22, 0, 0.1)        # her head stays back, out of the way of her working arm
    R['doll'].location = (-0.08, 0.72, 0.862)    # on the table (0.84 sank it 1.5 cm in); lying head toward her
    bpy.context.view_layer.update()
    eye = R['dparts']['eye'].matrix_world.translation.copy() + V((0, 0, 0.004))
    head = R['dparts']['head'].matrix_world.translation.copy()
    body = R['dparts']['body'].matrix_world.translation.copy()
    mid = (head + body) / 2
    c0 = mid + V((0.02, 0.0, 0.0))
    # wide enough to hold the doll, the needle's whole pull and the hands working it
    c0 = mid + V((0.06, 0.05, 0.06)); c1 = head + V((0.05, 0.04, 0.06))
    p0 = lib.frame_pos(c0, (0.9, -0.35, 0.5), 0.27, 40, 0.9); p1 = lib.frame_pos(c1, (0.9, -0.25, 0.55), 0.21, 40, 0.9)
    cam_keys(cam, tgt, [(1, p0, c0, 40, (p0 - c0).length), (192, p1, c1, 40, (p1 - c1).length)])
    lib.handheld(cam, 0.002, 0.5)
    # the hearth behind her throws her shadow big across the window wall
    hearth = light('POINT', 'hearth', (0.4, 3.2, 0.7), 140, color=(1.0, 0.5, 0.22), size=0.05)
    lib.flicker(hearth, 140, 0.18, 0.7, 9)
    NEEDLE[0] = eye + V((0.0, 0.0, 0.002)); NEEDLE[1] = eye + V((0.2, -0.02, 0.1))      # drawn out to her right, clear of her face
    needle = prim('cyl', 'needle', scale=(0.0012, 0.0012, 0.03), material=mats['iron'], vertices=8)
    stitch = lib.tube('stitch', [V((0, 0, 0))] * 16, 0.0011, mats['red'])
    # her hands: the right pinches the needle (the needle is where her fingers are), the left steadies the doll
    lib.hand_pose(kp, 1, 'pinch'); lib.hand_pose(kp, -1, 'hold')
    poff = lib.pinch_offset(kp, 1)
    lib.arm_to(kp, -1, head + V((-0.165, 0.025, 0.055)), pole=(-1.0, 0.3, -0.3), palm=(1.0, 0.0, -0.35))   # cupping the doll's head
    u = (NEEDLE[1] - NEEDLE[0]).normalized()                 # the needle lies along the pull; she holds its back end

    def upd(f):
        p = _needle_path(f)                                  # the needle's tip
        needle.location = p + u * 0.03
        needle.rotation_euler = u.to_track_quat('Z', 'Y').to_euler()
        back = p + u * 0.058
        d = back - eye
        pts = lib.catenary(eye, back, sag=0.004 + 0.02 * max(0.0, 0.12 - d.length), n=16)
        lib.tube_update(stitch, pts)
        lib.arm_to(kp, 1, p + u * 0.044, offset=poff, pole=(1.0, 0.55, -0.25), palm=(-0.5, 0.2, -0.85))
    lib.FRAME_FNS.append(upd)
    lib.register_frames()
    return sc


@shot(exposure=0.9)
def I4(out, preview):
    """over her shoulder to the window: the candle flame bends toward the glass, frost creeps across it, and she
    lifts her head to the dark outside — something out there has learned her name"""
    sc = lib.new_scene(144, out, preview=preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = lib.camera(lens=30, fstop=4)
    cam_keys(cam, tgt, [(1, (0.62, 2.25, 1.22), (-0.1, 0.0, 1.3), 30, 2.2), (144, (0.55, 2.05, 1.2), (-0.1, 0.0, 1.38), 32, 2.0)])
    lib.handheld(cam, 0.004, 0.4)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='lying')
    hearth = light('POINT', 'hearth', (0.4, 3.2, 0.7), 90, color=(1.0, 0.5, 0.22), size=0.05)
    lib.flicker(hearth, 90, 0.18, 0.7, 9)
    fl = R['candle']['flame']; cl = R['candle']['light']
    keys(fl, 'rotation_euler', [(1, (0, 0, 0)), (50, (0, 0, 0)), (78, (-0.55, 0, 0)), (110, (-0.7, 0, 0)), (144, (-0.6, 0, 0))])
    keys(fl, 'scale', [(1, (0.006, 0.006, 0.016)), (50, (0.006, 0.006, 0.016)), (90, (0.005, 0.005, 0.024)), (144, (0.004, 0.004, 0.02))])
    light_keys(cl, [(1, 7.0), (50, 7.0), (90, 4.0), (144, 3.0)])
    # frost creeps over the glass
    glass_mat = R['glass'].data.materials[0]
    b = [n for n in glass_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    node_keys(b.inputs['Alpha'], [(1, 0.18), (55, 0.2), (140, 0.62)])
    node_keys(b.inputs['Emission Strength'], [(1, 0.05), (140, 0.35)])
    kp = R['kparts']
    keys(kp['head'], 'rotation_euler', [(1, (0.25, 0, 0)), (60, (0.25, 0, 0)), (110, (-0.25, 0, 0.12)), (144, (-0.28, 0, 0.12))])
    return sc


@shot(exposure=1.0)
def I5(out, preview):
    """the doll sits up on the table; a loop of red thread drops over it and draws tight round its waist, the
    line running back to the spool; then her hands lift it out of the frame"""
    sc = lib.new_scene(144, out, preview=preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = lib.camera(lens=50, fstop=3.2)
    # from the window side, so her hands come in toward us and she stays soft behind the doll
    cam_keys(cam, tgt, [(1, (0.42, 0.33, 1.02), (-0.04, 0.86, 0.93), 50, 0.72), (144, (0.38, 0.3, 1.1), (-0.02, 0.92, 1.02), 50, 0.76)])
    lib.handheld(cam, 0.002, 0.5)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sit')
    mats = M()
    hearth = light('POINT', 'hearth', (0.4, 3.2, 0.7), 120, color=(1.0, 0.5, 0.22), size=0.05)
    lib.flicker(hearth, 120, 0.18, 0.7, 9)
    kr, kp = R['knitter'], R['kparts']
    kr.location = (0.05, 1.38, 0.0); R['stool'].location.y = 1.48
    kp['torso'].rotation_euler = (0.4, 0, 0)
    kp['head'].rotation_euler = (0.38, 0, 0.0)
    d = R['doll']
    d.location = (-0.05, 0.85, 0.805)
    d.rotation_euler = (0, 0, 0.45)       # facing the camera, its sides square to her hands
    loop = prim('torus', 'redloop', loc=(0, 0, 0.11), major_radius=1.0, minor_radius=0.0035 / 0.08, material=mats['red'])
    parent(loop, d, keep=False)
    loop.location = (0, 0, 0.11)
    keys(loop, 'scale', [(1, (0.0001, 0.0001, 0.0001)), (14, (0.2, 0.2, 0.2)), (30, (0.2, 0.2, 0.2)), (58, (0.082, 0.072, 0.082)), (144, (0.08, 0.07, 0.08))])
    keys(loop, 'location', [(14, (0, 0, 0.42)), (40, (0, 0, 0.16)), (58, (0, 0, 0.11))])
    line = lib.tube('redline', [V((0, 0, 0))] * 24, 0.0016, mats['red'])
    spool = R['spool']

    def upd(f):
        mw = d.matrix_world if f < 0 else None
        # evaluate the doll's world position from its keys
        dl = lib.eval_fc(d, 'location', f, d.location)
        a = dl + V((0.05, 0.05, 0.11))
        b = V(spool.location) + V((0, 0, 0.04))
        lib.tube_update(line, lib.catenary(b, a, sag=max(0.0, 0.05 - (a.z - 0.8) * 0.05), n=24, lift=lambda p: 0.795))
    lib.FRAME_FNS.append(upd)
    keys(d, 'location', [(1, (-0.05, 0.85, 0.805)), (92, (-0.05, 0.85, 0.805)), (104, (-0.05, 0.85, 0.84)), (144, (-0.05, 0.82, 0.89))])
    keys(kp['head'], 'rotation_euler', [(1, (0.38, 0, 0)), (100, (0.38, 0, 0)), (144, (0.22, 0, 0))])      # she lifts her eyes to it
    dp = R['dparts']
    for s in (-1, 1):                                       # the doll lifts its little arms as her hands come in
        keys(dp[f'arm{s}'], 'rotation_euler', [(68, (0, s * 0.35, 0)), (86, (-1.6, s * 0.12, 0))])
    keys(d, 'rotation_euler', [(92, (0, 0, 0.45)), (144, (0.04, 0, 0.5))])
    for s in (-1, 1):
        lib.hand_pose(kp, s, 'relax')
    bpy.context.view_layer.update()
    rest = {-1: V((-0.3, 1.1, 0.9)), 1: V((0.34, 1.12, 0.9))}     # resting on the table, clear of the doll and scissors

    def hands(f):
        dl = lib.eval_fc(d, 'location', f, d.location)
        dr = lib.eval_fc(d, 'rotation_euler', f, d.rotation_euler)
        k = min(1.0, max(0.0, (f - 56) / 32.0)); k = k * k * (3 - 2 * k)
        side = Matrix.Rotation(dr.z, 3, 'Z') @ V((1, 0, 0))     # the doll's own sides (its arms are raised out of the way)
        if side.x < 0:
            side = -side                                        # so each hand takes the side nearer to it
        for s in (-1, 1):
            g = dl + side * (s * (0.135 if s > 0 else 0.165)) + V((0, 0, 0.1))
            palm = V((0, 0, -1)).lerp(-side * s, k)              # palms down on the table → turned in to the doll
            lib.arm_to(kp, s, rest[s].lerp(g, k), pole=(s * 1.0, 0.3, 0.0), palm=palm)     # elbows out to the sides
    lib.FRAME_FNS.append(hands)
    lib.register_frames()
    return sc


@shot(exposure=0.85)
def I6(out, preview):
    """the door: her grey thread already knotted round the latch; she opens it on the storm, snow and wind burst
    in, the candle dies, and her lantern goes out into the white"""
    sc = lib.new_scene(144, out, preview=preview, pos_lo=(-6, -3, -1), pos_size=12.0)
    cam, tgt = lib.camera(lens=32, fstop=4)
    cam_keys(cam, tgt, [(1, (-0.3, 3.1, 1.45), (-2.35, 1.65, 1.15), 32, 2.4), (144, (-0.6, 2.9, 1.42), (-2.5, 1.65, 1.1), 32, 2.3)])
    lib.handheld(cam, 0.01, 0.6)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sit', knitter_on=False)
    mats = M()
    kr, kp = lib.knitter('knitter', (-0.9, 2.4, 0.0), mats, seated=False)
    lan, lan_l = lib.lantern('lantern', (0.24, -0.25, 0.62), mats, energy=45)
    parent(lan, kr, keep=False); lan.location = (0.24, -0.25, 0.62)
    lh = _carry(kr, kp)
    hearth = light('POINT', 'hearth', (0.8, 3.3, 0.8), 160, color=(1.0, 0.5, 0.22), size=0.05)
    lib.flicker(hearth, 160, 0.18, 0.7, 9)
    # walk to the door, open it, go out
    kr.rotation_euler = (0, 0, math.radians(-63))
    keys(kr, 'location', [(1, (-0.9, 2.4, 0.0)), (40, (-2.0, 1.85, 0.0)), (78, (-2.05, 1.7, 0.0)), (120, (-3.6, 1.65, -0.05)), (144, (-4.2, 1.65, -0.1))])
    keys(kr, 'rotation_euler', [(1, (0, 0, math.radians(-63))), (40, (0, 0, math.radians(-82))), (78, (0, 0, math.radians(-90)))])
    door = R['door']
    keys(door, 'rotation_euler', [(1, (0, 0, 0)), (44, (0, 0, 0)), (66, (0, 0, math.radians(95))), (122, (0, 0, math.radians(100))), (136, (0, 0, math.radians(55))), (144, (0, 0, math.radians(62)))])
    # the grey thread: from the latch out through the doorway after her
    grey = lib.tube('greythread', [V((0, 0, 0))] * 20, 0.0018, mats['grey_thread'])

    def upd(f):
        rz = lib.eval_fc(door, 'rotation_euler', f, door.rotation_euler).z
        hinge = V(door.location)
        latch = hinge + V((-math.sin(rz) * 0.86, math.cos(rz) * 0.86, 1.05))
        k = lib.eval_fc(kr, 'location', f, kr.location)
        rz = lib.eval_fc(kr, 'rotation_euler', f, kr.rotation_euler).z
        hand = k + Matrix.Rotation(rz, 3, 'Z') @ lh
        lib.tube_update(grey, lib.catenary(latch, hand, sag=0.25, n=20, lift=lambda p: 0.01))
    lib.FRAME_FNS.append(upd)
    # snow bursts in once the door is open; the candle dies; cold light from outside
    sn = lib.Snow('snow_in', 2500, (-5.0, 0.9, 0.0), (-1.2, 2.4, 2.3), wind=(5.0, 0.3, -0.6), gust=0.6, streak=0.03, width=0.007, cam=cam, tgt=tgt, material=mats['flake'], seed=4)
    lib.SNOWS.append(sn)
    sn.obj.hide_render = True; sn.obj.keyframe_insert('hide_render', frame=1)
    sn.obj.hide_render = False; sn.obj.keyframe_insert('hide_render', frame=58)
    cold = light('AREA', 'doorcold', (-3.4, 1.65, 1.2), 0.0, color=(0.6, 0.7, 1.0), size=1.2, rot=(0, math.radians(90), 0))
    light_keys(cold, [(1, 0.0), (48, 0.0), (70, 260.0), (144, 220.0)])
    light_keys(R['candle']['light'], [(1, 7.0), (56, 7.0), (74, 0.0), (144, 0.0)])
    fl = R['candle']['flame']
    keys(fl, 'scale', [(1, (0.006, 0.006, 0.016)), (58, (0.006, 0.006, 0.016)), (66, (0.003, 0.003, 0.02)), (74, (0.0001, 0.0001, 0.0001))])
    lib.register_frames()
    return sc


@shot(exposure=1.3)
def I7(out, preview):
    """outside, wide: her small lantern crossing the snow to the lip of the pit, the grey thread paying out
    behind her to the cottage door; at the edge she stops, then goes down, and the light sinks out of sight"""
    sc = lib.new_scene(168, out, preview=preview)
    cam, tgt = lib.camera(lens=42)
    cam_keys(cam, tgt, [(1, (5.5, -13.5, 4.2), (13.5, 1.0, 0.8), 42, None), (168, (7.0, -13.0, 4.0), (20.0, 4.0, -0.4), 45, None)])
    lib.handheld(cam, 0.03, 0.4)
    sets.exterior(sc, cam, tgt, storm=True, snow_box=((-6, -18, -0.5), (30, 8, 9)), snow_n=12000)
    mats = M()
    kr, kp = lib.knitter('knitter', (13, 0.5, 0.0), mats, seated=False)
    lan, lan_l = lib.lantern('lantern', (0.24, -0.25, 0.62), mats, energy=40)
    parent(lan, kr, keep=False); lan.location = (0.24, -0.25, 0.62)
    lh = _carry(kr, kp)
    kr.rotation_euler = (0, 0, math.radians(114))
    # she steps over the lip and goes down well inside the mouth (the pit wall is ~7 m out from its centre at (26, 7))
    keys(kr, 'location', [(1, (12.6, 0.4, 0.0)), (128, (19.4, 3.4, 0.0)), (140, (19.6, 3.5, 0.0)), (152, (20.5, 3.95, -0.35)), (168, (21.7, 4.6, -2.6))], interp='LINEAR')
    keys(kp['torso'], 'rotation_euler', [(1, (0.3, 0, 0)), (128, (0.3, 0, 0)), (140, (0.55, 0, 0)), (168, (0.5, 0, 0))])
    grey = lib.tube('greythread', [V((0, 0, 0))] * 40, 0.006, mats['grey_thread'])
    door = V((2.25, -0.08, 1.0))

    def upd(f):
        k = lib.eval_fc(kr, 'location', f, kr.location)
        hand = k + Matrix.Rotation(math.radians(114), 3, 'Z') @ lh
        pts = []
        for i in range(40):
            t = i / 39
            p = door.lerp(hand, t)
            # the thread lies on the snow between the door and her
            p.z = max(0.02, p.z * (abs(t - 0.5) * 2) ** 6) if 0.02 < t < 0.98 else p.z
            pts.append(p)
        lib.tube_update(grey, pts)
    lib.FRAME_FNS.append(upd)
    lib.register_frames()
    return sc


def _sill_thread(n_per=6):
    """the red thread from the doll's waist on the sill to the spool on the floor, lying on things instead of
    through them: across the sill top (z 1.0), round its front edge (y 0.32), down onto the table (top z 0.79),
    across the table, over its back edge (y 1.12) and down to the spool lying on the floor"""
    r = 0.0016 + 0.0015
    key = [V((0.03, 0.185, 1.10)), V((0.055, 0.25, 1.0 + r)), V((0.072, 0.318, 1.0 + r)), V((0.076, 0.322 + r * 0.7, 1.0 - r * 0.3)),
           V((0.08, 0.322 + r, 0.97)), V((0.09, 0.33, 0.84)), V((0.1, 0.345, 0.79 + r)), V((0.46, 1.1, 0.79 + r)),
           V((0.47, 1.12 + r * 0.7, 0.79 - r * 0.3)), V((0.48, 1.12 + r, 0.76)), V((0.56, 1.15, 0.25)), V((0.615, 1.163, 0.057))]
    pts = []
    for a, b in zip(key, key[1:]):
        for i in range(n_per):
            pts.append(a.lerp(b, i / n_per))
    pts.append(key[-1])
    return pts


def _sill_spool(R):
    # lying on its side on the floor (it used to sit half sunk into the boards)
    R['spool'].location = (0.6, 1.2, 0.031)
    R['spool'].rotation_euler = (math.pi / 2, 0, 0.4)


@shot(exposure=0.75)
def I8(out, preview):
    """the doll on the windowsill, from behind, facing the storm; the room is cold and dark now; the red thread
    runs from its waist across the sill and down to the spool on the floor; the door bangs in the wind"""
    sc = lib.new_scene(192, out, preview=preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = lib.camera(lens=50, fstop=2.8)
    cam_keys(cam, tgt, [(1, (0.42, 1.75, 1.28), (0.0, 0.12, 1.12), 50, 1.7), (192, (0.14, 0.95, 1.16), (0.0, 0.12, 1.12), 50, 0.85)])
    lib.handheld(cam, 0.003, 0.4)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, candle_lit=False)
    mats = M()
    d = R['doll']
    line = lib.tube('redline', _sill_thread(), 0.0016, mats['red'])
    _sill_spool(R)
    door = R['door']
    keys(door, 'rotation_euler', [(1, (0, 0, math.radians(60))), (70, (0, 0, math.radians(60))), (84, (0, 0, math.radians(3))), (88, (0, 0, math.radians(12))), (96, (0, 0, math.radians(1))), (150, (0, 0, math.radians(25))), (192, (0, 0, math.radians(40)))])
    cold = light('AREA', 'doorcold', (-3.4, 1.65, 1.2), 30.0, color=(0.6, 0.7, 1.0), size=1.2, rot=(0, math.radians(90), 0))
    keys(d, 'rotation_euler', [(1, (0, 0, 0)), (150, (0, 0, 0)), (192, (0.05, 0, -0.08))])
    return sc


@shot(exposure=0.9)
def I9(out, preview):
    """the doll's face in profile against the glass, very close: a glint crosses the button eye, the yarn tuft
    stirs, and its mitten hand closes on the red thread"""
    sc = lib.new_scene(120, out, preview=preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = lib.camera(lens=70, fstop=2.8)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, candle_lit=False)
    mats = M()
    d, dp = R['doll'], R['dparts']
    bpy.context.view_layer.update()
    hc = dp['head'].matrix_world.translation.copy() + V((0, 0, -0.03))
    p0 = lib.frame_pos(hc + V((0, 0, -0.06)), (1.0, 0.12, 0.12), 0.24, 70, 0.95); p1 = lib.frame_pos(hc, (1.0, 0.06, 0.08), 0.17, 70, 0.95)
    cam_keys(cam, tgt, [(1, p0, hc, 70, (p0 - hc).length), (120, p1, hc + V((0, 0, -0.01)), 70, (p1 - hc).length)])
    line = lib.tube('redline', _sill_thread(), 0.0016, mats['red'])
    _sill_spool(R)
    glint = light('POINT', 'glint', (0.4, -0.3, 1.5), 0.0, color=(0.8, 0.85, 1.0), size=0.02)
    keys(glint, 'location', [(30, (0.6, -0.4, 1.5)), (70, (-0.3, -0.4, 1.4))])
    light_keys(glint, [(1, 0.0), (34, 0.0), (48, 6.0), (62, 6.0), (76, 0.0)])
    keys(dp['tuft'], 'rotation_euler', [(1, (0, 0, 0)), (40, (0, 0, 0)), (52, (0.25, 0.15, 0)), (64, (-0.1, -0.05, 0)), (76, (0.05, 0, 0))])
    keys(dp['arm1'], 'rotation_euler', [(1, (0, 0.35, 0)), (78, (0, 0.35, 0)), (100, (0.5, 0.1, 0.2)), (120, (0.55, 0.05, 0.2))])
    keys(d, 'rotation_euler', [(1, (0, 0, 0)), (96, (0, 0, 0)), (120, (0.06, 0, 0.22))])
    return sc


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


import shots_cut  # noqa: E402,F401  (the bitten ending)
