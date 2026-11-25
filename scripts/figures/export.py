"""A rigged model -> what the game's figure layer reads (app/src/figure.js): app/assets/figures/<name>.bin + .jpg + _n.jpg

    blender -b -P scripts/figures/export.py            (the knitter)

A new model needs only a new entry in MODELS: the file, its textures, and `joints`, which says which deform bone each game
joint sits at (a bone not listed goes to its nearest listed ancestor). Only positions are kept, so any bone roll or axis
convention works. Axes written: x right, y up, z toward the viewer; she faces +z with her feet at y 0.

The neck is cut at mid height and a tube of NECK joints is put inside it, so it can grow as long as it likes."""
import json
import math
import os
import re
import struct
import sys

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'app', 'assets', 'figures')
NECK = 14

FINGERS = ['index', 'middle', 'ring', 'pinky']
JOINTS = {'root': (None, 'root.x'), 'sp1': ('root', 'spine_01.x'), 'sp2': ('sp1', 'spine_02.x'), 'sp3': ('sp2', 'spine_03.x'),
          'neck': ('sp3', 'neck.x'), 'head': ('neck', 'head.x'), 'jaw': ('head', 'c_jawbone.x'),
          'eyeL': ('head', 'c_eye.l'), 'eyeR': ('head', 'c_eye.r')}
for S, s in (('L', 'l'), ('R', 'r')):
    JOINTS.update({'sho' + S: ('sp3', f'shoulder.{s}'), 'arm' + S: ('sho' + S, f'arm_stretch.{s}'), 'fore' + S: ('arm' + S, f'forearm_stretch.{s}'),
                   'hand' + S: ('fore' + S, f'hand.{s}'), 'thigh' + S: ('root', f'thigh_stretch.{s}'), 'leg' + S: ('thigh' + S, f'leg_stretch.{s}'),
                   'foot' + S: ('leg' + S, f'foot.{s}')})
    for f in FINGERS:
        for k in (1, 2, 3):
            JOINTS[f'{f}{k}{S}'] = (f'{f}{k - 1}{S}' if k > 1 else 'hand' + S, f'{f}{k}.{s}')
    for k in (1, 2, 3):
        JOINTS[f'thumb{k}{S}'] = (f'thumb{k - 1}{S}' if k > 1 else 'hand' + S, f'thumb{k}.{s}')


# parts: 0 skin, 1 eyes, 2 inside the mouth, 3 cloth, 4 the long neck
def part(n):
    return 1 if n == 'Eyes' else 2 if re.search('Teeth|Tongue', n) else 3 if n in ('Tops', 'Bottoms', 'Hats', 'Shoes') else 0


OL = os.path.join(ROOT, '..', 'old-lady-fbx')
MODELS = {'knitter': dict(
    fbx=os.path.join(OL, 'source', 'Old Lady_rig_Pro.fbx'), diffuse=os.path.join(OL, 'textures', 'Old_Lady_4_packed0_diffuse.png'),
    normal=os.path.join(OL, 'textures', 'Old_Lady_New_packed0_normal.jpeg'), joints=JOINTS, part=part)}


def run(name):
    M = MODELS[name]
    J = M['joints']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=M['fbx'], use_anim=False)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    names = list(J)
    idx = {n: i for i, n in enumerate(names)}
    bone2 = {b: n for n, (_, b) in J.items()}
    W = lambda v: np.array([v[0], v[2], -v[1]])
    pos = {n: W(arm.matrix_world @ arm.data.bones[b].head_local) for n, (_, b) in J.items()}
    par = [idx[J[n][0]] if J[n][0] else -1 for n in names]

    def joint_of(bn):
        b = arm.data.bones.get(bn)
        while b:
            if b.name in bone2:
                return bone2[b.name]
            b = b.parent
        return None
    base, top = pos['neck'], pos['head']
    for k in range(NECK):
        names.append(f'n{k}'); idx[f'n{k}'] = len(names) - 1; par.append(idx['sp3'])
        pos[f'n{k}'] = base + (top - base) * (k / (NECK - 1))
    cut = base[1] + (top[1] - base[1]) * 0.45
    verts, tris, seen, neck_uv, ring = [], [], {}, [], []
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        me = o.data
        mw = o.matrix_world
        n3 = mw.to_3x3().inverted().transposed()
        me.calc_loop_triangles()
        uv = me.uv_layers.active.data
        gn = [g.name for g in o.vertex_groups]
        pt = M['part'](o.name)
        P = [W(mw @ v.co) for v in me.vertices]
        N = [W((n3 @ v.normal).normalized()) for v in me.vertices]
        # skin that faces other skin close by, round the mouth: the inside of it (must be black when the jaw drops)
        inside = set()
        if pt == 0:
            bvh = BVHTree.FromObject(o, bpy.context.evaluated_depsgraph_get())
            for v in me.vertices:
                q = P[v.index]
                if abs(q[0]) < 0.04 and pos['jaw'][1] - 0.085 < q[1] < pos['jaw'][1] + 0.01 and q[2] > pos['jaw'][2] and q[2] < 0.125:
                    no = v.normal.normalized()
                    if bvh.ray_cast(v.co + no * 0.0015 / mw.to_scale()[0], no, 0.05 / mw.to_scale()[0])[0] is not None:
                        inside.add(v.index)
            print(o.name, 'inside the mouth', len(inside))
        wt = []
        for v in me.vertices:
            acc = {}
            for g in v.groups:
                j = joint_of(gn[g.group]) if g.weight > 1e-3 else None
                if j is None:
                    continue
                if j == 'neck':                      # the old neck: below the cut it stays with the chest, above with the head
                    j = 'sp3' if P[v.index][1] < cut else 'head'
                acc[j] = acc.get(j, 0) + g.weight
            if 'sp3' in acc and 'head' in acc:       # nothing may hang between the two
                k = 'sp3' if P[v.index][1] < cut else 'head'
                acc[k] += acc.pop('head' if k == 'sp3' else 'sp3')
            if not acc:
                acc = {'head' if pt in (1, 2) else 'root': 1}
            t = sorted(acc.items(), key=lambda x: -x[1])[:4]
            s = sum(x[1] for x in t)
            wt.append([(idx[a], b / s) for a, b in t])
            if pt == 0 and abs(P[v.index][1] - cut) < 0.02 and abs(P[v.index][0]) < 0.09:
                ring.append(P[v.index])
        up = [any(names[a] in ('head', 'jaw', 'eyeL', 'eyeR') and b > .5 for a, b in w) for w in wt]
        for lt in me.loop_triangles:
            ids = list(lt.vertices)
            if len({up[i] for i in ids}) > 1:
                continue                             # the cut
            tri = []
            for li, vi in zip(lt.loops, ids):
                u = uv[li].uv
                key = (o.name, vi, round(u[0], 5), round(u[1], 5))
                if key not in seen:
                    seen[key] = len(verts)
                    verts.append((P[vi], N[vi], (u[0], 1 - u[1]), wt[vi], 2 if vi in inside else pt))
                if pt == 0 and abs(P[vi][1] - cut) < 0.03 and P[vi][2] > 0:
                    neck_uv.append((u[0], 1 - u[1]))
                tri.append(seen[key])
            tris.append(tri)
    ring = np.array(ring)
    c = (ring.min(0) + ring.max(0)) / 2
    rx, rz = (ring.max(0) - ring.min(0))[0] / 2, min(0.066, (ring.max(0) - ring.min(0))[2] / 2)
    print('neck centre', c, 'radii', rx, rz, 'cut', cut, 'uv', len(neck_uv), 'base', base, 'top', top)
    nu = neck_uv[len(neck_uv) // 2]
    SEG, RINGS = 20, NECK * 5
    first = len(verts)
    for r in range(RINGS + 1):
        t = r / RINGS
        p = base + (top - base) * t
        f = min(max(t * (NECK - 1), 0), NECK - 1 - 1e-6)
        k = int(f)
        w = f - k
        for s in range(SEG + 1):
            a = s / SEG * 2 * math.pi
            rad = 0.9 * (1 + 0.06 * math.cos(a * 5) + 0.03 * math.cos(a * 9 + 1)) * (1 + 0.018 * math.sin(r * 2.1 + 2 * math.sin(a * 2)))
            n = np.array([math.cos(a) / rx, 0, math.sin(a) / rz])
            q = np.array([c[0] + math.cos(a) * rx * rad, p[1], c[2] + (p[2] - (base[2] + top[2]) / 2) + math.sin(a) * rz * rad])
            verts.append((q, n / np.linalg.norm(n), (nu[0] + 0.004 * math.cos(a), nu[1] + 0.006 * math.sin(t * 9)), [(idx[f'n{k}'], 1 - w), (idx[f'n{k + 1}'], w)], 4))
    for r in range(RINGS):
        for s in range(SEG):
            a = first + r * (SEG + 1) + s
            b = a + SEG + 1
            tris += [[a, b, a + 1], [a + 1, b, b + 1]]
    floor = np.array([0, min(v[0][1] for v in verts), 0])
    buf = bytearray()
    for p, n, u, w, pt in verts:
        w = list(w) + [(0, 0)] * (4 - len(w))
        q = [round(x[1] * 255) for x in w]
        q[0] += 255 - sum(q)
        buf += struct.pack('<8f', *(p - floor), *n, *u) + struct.pack('<4B', *[x[0] for x in w]) + struct.pack('<4B', *q) + struct.pack('<f', pt)
    head = json.dumps({'names': names, 'parents': par, 'pos': [[round(float(x), 5) for x in pos[n] - floor] for n in names],
                       'nv': len(verts), 'ni': len(tris) * 3, 'stride': 44, 'neck': NECK}).encode()
    head += b' ' * (-len(head) % 4)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + '.bin'), 'wb') as f:
        f.write(struct.pack('<I', len(head)) + head + buf + np.array(tris, dtype='<u4').tobytes())
    for k, suf in (('diffuse', ''), ('normal', '_n')):
        im = bpy.data.images.load(M[k])
        im.scale(1024, 1024)
        if k == 'diffuse':
            a = np.array(im.pixels[:], dtype=np.float32).reshape(-1, 4)
            g = a[:, :3] @ np.array([.3, .59, .11], dtype=np.float32)
            a[:, :3] = g[:, None]
            a[:, 3] = 1
            im.pixels = a.ravel().tolist()
        im.file_format = 'JPEG'
        im.filepath_raw = os.path.join(OUT, name + suf + '.jpg')
        im.save(quality=88)
    print('verts', len(verts), 'tris', len(tris), 'joints', len(names))


run(sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'knitter')
