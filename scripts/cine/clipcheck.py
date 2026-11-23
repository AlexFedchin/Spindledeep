"""Find things passing through each other in a shot: builds the shot, steps to the given frames and tests mesh
overlaps (BVH) between groups that must never touch inside each other.

    blender -b -P scripts/cine/clipcheck.py -- <shot> [frame ...]      (default: 8 frames spread over the shot)

Groups: the knitter's arms and hands; her head; her body (torso, skirt, legs); the doll; the furniture and room.
Pairs that are meant to touch (a hand on the doll, a body on its seat) still count if they go *through* each other:
every overlap is printed with the deepest-looking parts so it can be judged. Exit code 0 always; read the report."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
shot = argv[0]
import lib  # noqa: E402
import shots  # noqa: E402

out = os.path.join(HERE, '.cache', 'clip', shot)
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'encoding.txt'), 'w').write('0 0 0 1')
sc = shots.SHOTS[shot](out, True)
frames = [int(a) for a in argv[1:]] or [round(sc.frame_start + (sc.frame_end - sc.frame_start) * k / 7) for k in range(8)]


def ol_part(bone):
    """the model's skin is one mesh per garment: split it by the bone that weighs most on each vertex. The upper arm
    and the neck are left out, so neighbouring parts never 'overlap' along their shared seam."""
    side = '1' if bone.endswith('.l') else '-1'
    if any(k in bone for k in ('forearm', 'hand', 'index', 'middle', 'ring', 'pinky', 'thumb')):
        return 'arm' + side
    if bone.startswith('arm_') or bone.startswith('shoulder') or bone.startswith('neck'):
        return None
    if bone.startswith('head') or bone.startswith('c_') or bone.startswith('tong'):
        return 'head'
    return 'body'


def group(o):
    n = o.name
    if '_ol_' in n:
        return 'ol' if o.type == 'MESH' and not o.hide_render else None
    if o.type != 'MESH' or o.hide_render:
        return None
    if n.startswith('knitter'):
        if any(k in n for k in ('_upper', '_lower', '_elbow', '_shoulder', '_cuff', '_wrist', '_palm', '_knuckle', '_vein', '_f-', '_f1', '_thumb', '_kneedle', '_swatch')):
            side = '-1' if ('-1' in n) else '1'
            return 'arm' + side
        if any(k in n for k in ('_cranium', '_jaw', '_chin', '_cheek', '_socket', '_lid', '_bag', '_ear', '_lobe', '_rim', '_temple', '_bridge', '_brow', '_nose', '_mouth', '_fold', '_hair', '_bun', '_pin')):
            return 'head'
        return 'body'
    if n.startswith('doll'):
        return 'doll'
    if any(n.startswith(k) for k in ('snow', 'flake', 'outside', 'win_glass', 'iglass', 'red', 'stitch', 'grey', 'needle', 'lantern', 'candle', 'cave', 'cfloor', 'warp', 'smoke', 'wisp', 'fogbox')):
        return None
    return 'room'


# pairs that must not interpenetrate (body↔room is reported only for real furniture, not the floor it stands on)
PAIRS = [('arm1', 'head'), ('arm-1', 'head'), ('arm1', 'arm-1'), ('arm1', 'body_front'), ('arm-1', 'body_front'),
         ('arm1', 'room'), ('arm-1', 'room'), ('head', 'room'), ('body', 'room'), ('doll', 'room'), ('arm1', 'doll'), ('arm-1', 'doll'), ('head', 'doll')]
SKIP_ROOM = ('ifloor', 'iboard', 'floor', 'kstool', 'stool_in', 'seat', 'ground')   # what she sits/stands on


def trees():
    dg = bpy.context.evaluated_depsgraph_get()
    T = {}
    for o in sc.objects:
        g = group(o)
        if not g:
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        if not me or not len(me.polygons):
            ev.to_mesh_clear(); continue
        mw = ev.matrix_world
        verts = [mw @ v.co for v in me.vertices]
        polys = [tuple(p.vertices) for p in me.polygons]
        if g == 'ol':
            names = {vg.index: vg.name for vg in o.vertex_groups}
            part = []
            for v in me.vertices:
                best = max(v.groups, key=lambda e: e.weight, default=None)
                part.append(ol_part(names.get(best.group, '')) if best else None)
            ev.to_mesh_clear()
            for gname in ('arm1', 'arm-1', 'head', 'body'):
                sub = [p for p in polys if all(part[i] == gname for i in p)]
                if sub:
                    T[f'{o.name}_{gname.replace("body", "body")}'.replace('_body', '_body')] = (gname, BVHTree.FromPolygons(verts, sub))
            continue
        ev.to_mesh_clear()
        T[o.name] = (g, BVHTree.FromPolygons(verts, polys))
    return T


for f in frames:
    sc.frame_set(f)
    T = trees()
    hits = {}
    names = list(T)
    for i, a in enumerate(names):
        ga, ta = T[a]
        for b in names[i + 1:]:
            gb, tb = T[b]
            for x, y in PAIRS:
                xa = 'body' if x == 'body_front' else x
                if {ga, gb} == {xa, y} or (ga == xa and gb == y) or (gb == xa and ga == y):
                    if 'room' in (ga, gb) and any(k in (b if gb == 'room' else a) for k in SKIP_ROOM) and 'body' in (ga, gb):
                        continue
                    if x == 'body_front' and not any(k in (b if gb == 'body' else a) for k in ('_body', '_cardigan', '_lap', '_apron')):
                        continue
                    n = len(ta.overlap(tb))
                    if n:
                        hits.setdefault(f'{x}~{y}', []).append((n, a, b))
                    break
    print(f'FRAME {f}:', 'clean' if not hits else '')
    for k, v in sorted(hits.items()):
        v.sort(reverse=True)
        print(f'  {k}: ' + '; '.join(f'{a} x {b} ({n})' for n, a, b in v[:6]))
print('CLIPCHECK DONE', shot)
