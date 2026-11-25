"""Render one shot.  blender -b -P scripts/cine/render.py -- <shot> [--preview] [--still=F] [--frames=a-b]
Writes EXR passes to scripts/cine/.cache/frames/<shot>/ (post.py turns them into engraved frames)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib  # noqa: E402

import bpy  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
shot = argv[0]
opts = dict((a[2:].split('=', 1) + ['1'])[:2] for a in argv[1:] if a.startswith('--'))
preview = 'preview' in opts

import lib  # noqa: E402
import shots  # noqa: E402

out = os.path.join(HERE, '.cache', 'frames' + ('_prev' if preview else ''), shot)
os.makedirs(out, exist_ok=True)
sc = shots.SHOTS[shot](out, preview)
# camera intrinsics per frame, for post.py's line spacing
import json  # noqa: E402
cam = sc.camera
lens = {}
for f in range(sc.frame_start, sc.frame_end + 1):
    v = cam.data.lens
    ad = cam.data.animation_data
    if ad and ad.action:
        for fc in ad.action.fcurves:
            if fc.data_path == 'lens':
                v = fc.evaluate(f)
    lens[f] = v
tgt = bpy.data.objects.get(cam.get('tgt', ''))
fwd = {}
for f in range(sc.frame_start, sc.frame_end + 1):
    c = lib.eval_fc(cam, 'location', f, cam.location)
    t = lib.eval_fc(tgt, 'location', f, tgt.location) if tgt else c + lib.V((0, 1, 0))
    fwd[f] = list(t - c)
json.dump({'sensor': cam.data.sensor_width, 'lens': lens, 'fwd': fwd, 'w': sc.render.resolution_x}, open(os.path.join(out, 'camera.json'), 'w'))
import shots_intro  # noqa: E402
json.dump(shots_intro.EVENTS, open(os.path.join(out, 'events.json'), 'w'), indent=0)     # what the soundtrack hears, frame by frame
if 'events' in opts:
    print('EVENTS', shot, len(shots_intro.EVENTS), flush=True); sys.exit(0)
if 'frames' in opts:
    a, b = opts['frames'].split('-'); sc.frame_start, sc.frame_end = int(a), int(b)
if 'still' in opts:
    f = int(opts['still'])
    sc.frame_start = sc.frame_end = f
if 'stills' in opts:                                       # several frames from one build
    for f in (int(x) for x in opts['stills'].split(',')):
        sc.frame_start = sc.frame_end = f
        bpy.ops.render.render(animation=True)
    print('RENDERED', shot, opts['stills'], flush=True); sys.exit(0)
if 'save' in opts:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, shot + '.blend'))
bpy.ops.render.render(animation=True)
print('RENDERED', shot, sc.frame_start, sc.frame_end, flush=True)
