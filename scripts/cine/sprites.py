"""Pictures of the knitter for the game itself, rendered from the old-lady model (oldlady.py) and written as grey
tone with alpha to app/assets/art/sprites/ (the game's engraving shader turns tone into line work).

    blender -b -P scripts/cine/sprites.py -- [name ...]

knitter / knitter_bow / knitter_still: her at the top of the Loom, seated, facing right (the doll comes from the
right), hands in her lap on the grey thread; head up / bowed / slumped with her eyes shut.
face / face_shut: her face alone, front on (the faces in the cloth).
weaver_l / weaver_c / weaver_r / weaver_scream / weaver_shut: her head and shoulders, huge, lit from below; looking
left / ahead / right, screaming, eyes shut."""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402
from mathutils import Vector as V  # noqa: E402

import lib  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'app', 'assets', 'art', 'sprites')
TMP = os.path.join(HERE, '.cache', 'sprites')
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def scene(w, h):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    lib.FRAME_FNS.clear()
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.world = bpy.data.worlds.new('w'); sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.15
    return sc


def cam(sc, loc, tgt, ortho=None, lens=50):
    c = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(c)
    d = V(tgt) - V(loc)
    c.location = loc; c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if ortho:
        c.data.type = 'ORTHO'; c.data.ortho_scale = ortho
    else:
        c.data.lens = lens
    sc.camera = c


def lamp(sc, kind, loc, energy, tgt=(0, 0, 1), size=1.0):
    L = bpy.data.objects.new(kind, bpy.data.lights.new(kind, kind)); sc.collection.objects.link(L)
    L.location = loc; L.data.energy = energy
    if kind == 'AREA':
        L.data.size = size
    L.rotation_euler = (V(tgt) - V(loc)).to_track_quat('-Z', 'Y').to_euler()


def bone(P, name, rot):
    pb = P['rig'].pose.bones.get(name)
    if pb:
        pb.rotation_mode = 'XYZ'; pb.rotation_euler = rot


def eyes_shut(P):
    # the lids: Auto-Rig Pro's lid controllers swing down around the eye
    for s in ('l', 'r'):
        bone(P, f'c_eyelid_top.{s}', (-0.6, 0, 0))
        bone(P, f'c_eyelid_bot.{s}', (0.15, 0, 0))


def render(sc, name, tone=(0.0, 1.0)):
    raw = os.path.join(TMP, name + '.png')
    sc.render.filepath = raw
    bpy.ops.render.render(write_still=True)
    # grey tone with its alpha, contrast stretched so the engraving has the whole range to work with
    import numpy as np
    im = bpy.data.images.load(raw)
    px = np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4)[::-1]
    lum = px[..., 0] * 0.3 + px[..., 1] * 0.59 + px[..., 2] * 0.11
    a = px[..., 3]
    m = a > 0.5
    lo, hi = (np.percentile(lum[m], 2), np.percentile(lum[m], 98)) if m.any() else (0, 1)
    g = np.clip((lum - lo) / max(1e-4, hi - lo), 0, 1) * (tone[1] - tone[0]) + tone[0]
    out = np.dstack([g, g, g, a])
    o = bpy.data.images.new(name, im.size[0], im.size[1], alpha=True)
    o.pixels = out[::-1].ravel()
    o.filepath_raw = os.path.join(OUT, name + '.png'); o.file_format = 'PNG'
    o.save()
    print('SPRITE', name, im.size[0], im.size[1], flush=True)


def knitter(name, head, neck=0.22, shut=False):
    sc = scene(560, 760)
    root, P = lib.knitter('knitter', (0, 0, 0), {}, seated=True)
    P['torso'].rotation_euler = (0.32, 0, 0)
    P['neck'].rotation_euler = (neck, 0, 0)
    P['head'].rotation_euler = head
    bpy.context.view_layer.update()
    for s in (1, -1):
        lib.hand_pose(P, s, 'hold')
        lib.arm_to(P, s, V((s * 0.1, -0.3, 0.64)), pole=(s * 1.0, 0.3, -0.2), palm=(0, 0, -1))
    if shut:
        eyes_shut(P)
    # she faces -Y; seen from her right-front, she faces screen right
    cam(sc, (-2.6, -1.6, 0.95), (0, -0.12, 0.78), ortho=1.75)
    lamp(sc, 'AREA', (-1.2, -2.2, 2.2), 240, (0, 0, 0.9), 1.5)
    lamp(sc, 'AREA', (1.6, 1.2, 1.4), 60, (0, 0, 1.0), 1.0)
    render(sc, name, (0.06, 0.85))


def face(name, shut=False):
    sc = scene(420, 520)
    root, P = lib.knitter('knitter', (0, 0, 0), {}, seated=False)
    P['torso'].rotation_euler = (0, 0, 0); P['neck'].rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    if shut:
        eyes_shut(P)
    bpy.context.view_layer.update()
    h = P['head'].matrix_world.translation
    cam(sc, (h.x, h.y - 2.0, h.z + 0.1), (h.x, h.y, h.z + 0.09), ortho=0.36)
    lamp(sc, 'AREA', (0.4, -1.5, h.z + 0.8), 60, (0, 0, h.z), 1.2)
    lamp(sc, 'AREA', (-0.6, -1.0, h.z - 0.3), 15, (0, 0, h.z), 1.0)
    render(sc, name, (0.08, 0.9))


def weaver(name, look=0.0, scream=False, shut=False):
    sc = scene(900, 1100)
    root, P = lib.knitter('knitter', (0, 0, 0), {}, seated=False)
    P['torso'].rotation_euler = (0.1, 0, 0); P['neck'].rotation_euler = (-0.05, 0, look * 0.4)
    P['head'].rotation_euler = (-0.08, 0, look * 0.6)
    bpy.context.view_layer.update()
    for s in (1, -1):
        lib.hand_pose(P, s, 'relax')
        lib.arm_to(P, s, V((s * 0.32, -0.25, 1.15)), pole=(s * 1.0, 0.2, -0.5), palm=(0, -1, 0))
    if scream:
        bone(P, 'c_jawbone.x', (0.38, 0, 0))
    if shut:
        eyes_shut(P)
    bpy.context.view_layer.update()
    h = P['head'].matrix_world.translation
    cam(sc, (0, -3.2, h.z - 0.15), (0, 0, h.z - 0.18), ortho=0.95)
    lamp(sc, 'AREA', (0, -1.2, h.z - 1.2), 200, (0, 0, h.z), 1.0)      # from below, the cloth's own light
    lamp(sc, 'AREA', (1.4, 0.6, h.z + 0.6), 30, (0, 0, h.z), 0.8)
    render(sc, name, (0.05, 0.8))


JOBS = {
    'knitter': lambda: knitter('knitter', (-0.5, 0, 0.2), neck=0.05),
    'knitter_bow': lambda: knitter('knitter_bow', (0.5, 0, 0.05)),
    'knitter_still': lambda: knitter('knitter_still', (0.65, 0.12, 0.2), neck=0.35, shut=True),
    'face': lambda: face('face'),
    'face_shut': lambda: face('face_shut', shut=True),
    'weaver_l': lambda: weaver('weaver_l', -1.0),
    'weaver_c': lambda: weaver('weaver_c', 0.0),
    'weaver_r': lambda: weaver('weaver_r', 1.0),
    'weaver_scream': lambda: weaver('weaver_scream', 0.0, scream=True),
    'weaver_shut': lambda: weaver('weaver_shut', 0.0, shut=True),
}
for n in (argv or JOBS):
    JOBS[n]()
