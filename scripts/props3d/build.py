"""The keepsakes and the skein as real models -> app/assets/props/<name>.bin + .webp (colour, gloss) + _n.jpg (object-space normals)

    blender -b -P scripts/props3d/build.py -- <name ...|all> [--res=2048] [--draft]
    <art venv>/python scripts/props3d/pack.py <name ...|all>       (the baked passes -> webp/jpg)

Two kinds of part: `solid` (a mesh with a Cycles material, unwrapped and baked into one atlas) and `yarn` (tubes with no
texture: the game's prop shader spins the plies from u along and v round; only its occlusion is worked out here).
Flat maps (prints, scratches, relief) come from maps.py. Modelled with z up and the viewer at -y; written x right, y up, z to
the viewer, centred, the larger half extent 1."""
import json
import math
import os
import random
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
C = os.path.join(HERE, '.cache')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'app', 'assets', 'props'))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
opts = dict((a[2:].split('=', 1) + ['1'])[:2] for a in argv if a.startswith('--'))
RES = int(opts.get('res', 2048))
DRAFT = 'draft' in opts
if DRAFT:
    RES = 1024


# ── geometry ─────────────────────────────────────────────────────────────
def mesh(name, verts, faces, uv=None, smooth=True):
    """a mesh from numpy verts and quads/tris; uv: one per vertex, kept as the 'print' layer"""
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(int(i) for i in f) for f in faces])
    if uv is not None:
        lay = me.uv_layers.new(name='print')
        idx = np.empty(len(me.loops), np.int32)
        me.loops.foreach_get('vertex_index', idx)
        lay.data.foreach_set('uv', np.asarray(uv, np.float32)[idx].ravel())
    me.polygons.foreach_set('use_smooth', [smooth] * len(me.polygons))
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def grid_faces(nu, nv, close_u=False, close_v=False, off=0):
    f = []
    for i in range(nu if close_u else nu - 1):
        for j in range(nv if close_v else nv - 1):
            a, b = off + i * nv + j, off + ((i + 1) % nu) * nv + j
            jj = (j + 1) % nv
            f.append((a, b, off + ((i + 1) % nu) * nv + jj, off + i * nv + jj))
    return f


def resample(P, n):
    P = np.asarray(P, float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n)
    return np.stack([np.interp(t, d, P[:, k]) for k in range(P.shape[1])], 1)


def spline(P, n, closed=False):
    """Catmull-Rom through the points"""
    P = np.asarray(P, float)
    m = len(P)
    if closed:
        Q = np.vstack([P[-1], P, P[:2]])
        seg = m
    else:
        Q = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
        seg = m - 1
    t = np.linspace(0, seg, n, endpoint=not closed)
    i = np.minimum(t.astype(int), seg - 1)
    f = (t - i)[:, None]
    a, b, c, d = Q[i], Q[i + 1], Q[i + 2], Q[i + 3]
    return 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (3 * b - a - 3 * c + d) * f ** 3)


def lathe(name, prof, seg=128, shape=None, flip=False):
    """spin (r, z) round z; print uv: u round, v along the profile"""
    prof = np.asarray(prof, float)
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(prof, axis=0), axis=1))]
    v = d / d[-1]
    V, U = [], []
    for s in range(seg + 1):
        a = s / seg * 2 * math.pi
        for k, (r, z) in enumerate(prof):
            p = np.array([r * math.cos(a), r * math.sin(a), z])
            V.append(shape(p, a, r, z) if shape else p)
            U.append((s / seg, v[k]))
    F = grid_faces(seg + 1, len(prof))
    return mesh(name, V, [f[::-1] for f in F] if flip else F, U)


def outward(o):
    import bmesh
    b = bmesh.new()
    b.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    b.to_mesh(o.data)
    b.free()
    return o


def apply_mods(o):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    o.modifiers.clear()
    o.data = me
    return o


def mod(o, kind, **kw):
    m = o.modifiers.new(kind, kind)
    for k, v in kw.items():
        setattr(m, k, v)
    return apply_mods(o)


def vnoise3(P, scale, seed=0, octaves=3):
    """value noise for numpy points"""
    P = np.asarray(P, float) * scale + seed * 17.3
    out, amp = np.zeros(len(P)), 1.0
    tot = 0
    for _ in range(octaves):
        i = np.floor(P).astype(np.int64)
        f = P - i
        f = f * f * (3 - 2 * f)
        def h(dx, dy, dz):
            n = (i[:, 0] + dx) * 73856093 ^ (i[:, 1] + dy) * 19349663 ^ (i[:, 2] + dz) * 83492791
            n = (n ^ (n >> 13)) * 1274126177
            return ((n ^ (n >> 16)) & 0xffff) / 65535.0
        x0 = [[h(0, b, c) * (1 - f[:, 0]) + h(1, b, c) * f[:, 0] for c in (0, 1)] for b in (0, 1)]
        y0 = [x0[0][c] * (1 - f[:, 1]) + x0[1][c] * f[:, 1] for c in (0, 1)]
        out += amp * (y0[0] * (1 - f[:, 2]) + y0[1] * f[:, 2])
        tot += amp
        amp *= 0.5
        P = P * 2.03 + 7.1
    return out / tot


# ── yarn ──────────────────────────────────────────────────────────────────
class Yarn:
    """tubes collected as numpy arrays. kind 1: plied yarn, 2: loose fibre"""
    def __init__(self):
        self.P, self.N, self.UV, self.COL, self.KIND, self.F, self.n = [], [], [], [], [], [], 0

    def tube(self, pts, r, sides=7, col=(0.6, 0.6, 0.6), kind=1, closed=False, tw=1.0, cap=True):
        pts = np.asarray(pts, float)
        n = len(pts)
        r = np.broadcast_to(np.asarray(r, float), (n,))
        T = np.roll(pts, -1, 0) - np.roll(pts, 1, 0)
        if not closed:
            T[0], T[-1] = pts[1] - pts[0], pts[-1] - pts[-2]
        T /= np.linalg.norm(T, axis=1)[:, None] + 1e-12
        # parallel transport
        N = np.zeros_like(pts)
        ref = np.array([0, 0, 1.0]) if abs(T[0][2]) < 0.9 else np.array([1.0, 0, 0])
        N[0] = ref - T[0] * ref.dot(T[0])
        N[0] /= np.linalg.norm(N[0])
        for i in range(1, n):
            v = N[i - 1] - T[i] * N[i - 1].dot(T[i])
            N[i] = v / (np.linalg.norm(v) + 1e-12)
        B = np.cross(T, N)
        seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pts, axis=0), axis=1))]
        a = np.linspace(0, 2 * math.pi, sides + 1)
        dirs = N[:, None] * np.cos(a)[None, :, None] + B[:, None] * np.sin(a)[None, :, None]
        V = pts[:, None] + dirs * r[:, None, None]
        rm = max(1e-6, float(r.mean()))
        uv = np.zeros((n, sides + 1, 2))
        uv[..., 0] = (seg / rm * tw)[:, None]
        uv[..., 1] = a[None] / (2 * math.pi)
        col = np.asarray(col, float)
        col = np.broadcast_to(col if col.ndim == 2 else col[None], (n, 3))
        self.P.append(V.reshape(-1, 3))
        self.N.append(dirs.reshape(-1, 3))
        self.UV.append(uv.reshape(-1, 2))
        self.COL.append(np.repeat(col, sides + 1, 0))
        self.KIND.append(np.full(n * (sides + 1), kind))
        w = sides + 1
        i, j = np.meshgrid(np.arange(n - 1), np.arange(sides), indexing='ij')
        A = self.n + i * w + j
        q = np.stack([A, A + w, A + w + 1, A + 1], -1).reshape(-1, 4)
        self.F.append(np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]]))
        self.n += n * w

    def fuzz(self, pts, r, count, length, rng, col, thick=0.0016, lift=0.7, curl=1.0):
        """fibres that have worked loose from a strand"""
        pts = np.asarray(pts, float)
        m = len(pts)
        for _ in range(count):
            i = rng.integers(1, m - 2)
            t = pts[i + 1] - pts[i]
            t /= np.linalg.norm(t) + 1e-12
            d = rng.normal(size=3)
            d -= t * d.dot(t)
            d /= np.linalg.norm(d) + 1e-12
            L = length * rng.uniform(0.35, 1.25)
            p = pts[i] + d * r * 0.8
            v = t * rng.uniform(-1, 1) + d * lift
            v /= np.linalg.norm(v)
            k = rng.normal(size=3) * 1.6 * curl
            st = [p]
            for _ in range(6):
                v = v + np.cross(k, v) * 0.32 + rng.normal(size=3) * 0.12
                v /= np.linalg.norm(v)
                p = p + v * L / 6
                st.append(p)
            c = np.clip(np.asarray(col) * rng.uniform(0.8, 1.25), 0, 1)
            self.tube(st, np.linspace(thick, thick * 0.35, 7), 3, c, 2)

    def frayed(self, end, dirn, r, rng, col, L=0.12, n=9):
        """the cut end of a strand: its plies come apart into fibres"""
        dirn = np.asarray(dirn, float) / np.linalg.norm(dirn)
        for k in range(n):
            v = dirn + rng.normal(size=3) * 0.28
            v /= np.linalg.norm(v)
            p = np.asarray(end) + rng.normal(size=3) * r * 0.4
            cv = rng.normal(size=3) * 2.4
            st = [p]
            for _ in range(7):
                v = v + np.cross(cv, v) * 0.16
                v /= np.linalg.norm(v)
                p = p + v * L * rng.uniform(0.6, 1.2) / 7
                st.append(p)
            self.tube(st, np.linspace(r * 0.34, r * 0.06, 8), 4, np.clip(np.asarray(col) * rng.uniform(0.85, 1.15), 0, 1), 2)

    def arrays(self):
        if not self.P:
            return None
        return [np.concatenate(x) for x in (self.P, self.N, self.UV, self.COL, self.KIND, self.F)]


RED, RED2 = (0.46, 0.022, 0.026), (0.34, 0.016, 0.02)


# ── materials ─────────────────────────────────────────────────────────────
class Mat:
    """a small node writer: values are floats, tuples or sockets"""
    def __init__(self, name, metal=0.0, sheen=0.0):
        self.m = bpy.data.materials.new(name)
        self.m.use_nodes = True
        self.t = self.m.node_tree
        self.b = self.t.nodes['Principled BSDF']
        self.m['metal'], self.m['sheen'] = metal, sheen

    def node(self, kind, **ins):
        n = self.t.nodes.new(kind)
        for k, v in ins.items():
            if k.startswith('_'):
                setattr(n, k[1:], v)
        for k, v in ins.items():
            if not k.startswith('_'):
                self.put(n.inputs[int(k[1:]) if k[0] == 'i' and k[1:].isdigit() else k], v)
        return n

    def put(self, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            self.t.links.new(v, sock)
        elif sock.type == 'RGBA' and not isinstance(v, (tuple, list)):
            sock.default_value = (v, v, v, 1)
        elif sock.type == 'RGBA':
            sock.default_value = tuple(v)[:3] + (1,)
        else:
            sock.default_value = v

    def obj(self, scale=(1, 1, 1), rot=(0, 0, 0)):
        c = self.node('ShaderNodeTexCoord').outputs['Object']
        return self.node('ShaderNodeMapping', Vector=c, Scale=scale, Rotation=rot).outputs[0]

    def uv(self, scale=(1, 1, 1)):
        c = self.node('ShaderNodeUVMap', _uv_map='print').outputs[0]
        return self.node('ShaderNodeMapping', Vector=c, Scale=scale).outputs[0]

    def noise(self, v, scale, detail=6, rough=0.55, dist=0.0):
        return self.node('ShaderNodeTexNoise', Vector=v, Scale=scale, Detail=detail, Roughness=rough, Distortion=dist).outputs['Fac']

    def wave(self, v, scale, dist=2.0, detail=3, bands='X'):
        return self.node('ShaderNodeTexWave', _bands_direction=bands, Vector=v, Scale=scale, Distortion=dist, Detail=detail).outputs['Fac']

    def voro(self, v, scale, feature='DISTANCE_TO_EDGE'):
        return self.node('ShaderNodeTexVoronoi', _feature=feature, Vector=v, Scale=scale).outputs['Distance']

    def img(self, file, v, interp='Cubic', ext='EXTEND'):
        im = bpy.data.images.load(os.path.join(C, file), check_existing=True)
        im.colorspace_settings.name = 'Non-Color'
        return self.node('ShaderNodeTexImage', _image=im, _interpolation=interp, _extension=ext, Vector=v).outputs['Color']

    def ramp(self, f, *stops):
        n = self.node('ShaderNodeValToRGB', Fac=f)
        e = n.color_ramp.elements
        while len(e) < len(stops):
            e.new(0.5)
        for k, (p, c) in enumerate(stops):
            e[k].position = p
            e[k].color = (tuple(c) if isinstance(c, (tuple, list)) else (c, c, c)) + (1,)
        return n.outputs[0]

    def math(self, op, a, b=0.0, c=0.0, clamp=False):
        n = self.node('ShaderNodeMath', _operation=op, _use_clamp=clamp, i0=a, i1=b)
        if op in ('MULTIPLY_ADD',):
            self.put(n.inputs[2], c)
        return n.outputs[0]

    def mix(self, f, a, b, mode='MIX'):
        n = self.t.nodes.new('ShaderNodeMix')
        n.data_type = 'RGBA'
        n.blend_type = mode
        self.put(n.inputs[0], f)
        self.put(n.inputs[6], a)
        self.put(n.inputs[7], b)
        return n.outputs[2]

    def mul(self, a, b, f=1.0):
        return self.mix(f, a, b, 'MULTIPLY')

    def bump(self, h, strength=0.5, dist=0.02, n=None):
        k = self.node('ShaderNodeBump', Height=h, Strength=strength, Distance=dist)
        if n is not None:
            self.put(k.inputs['Normal'], n)
        return k.outputs[0]

    def point(self):
        return self.node('ShaderNodeNewGeometry').outputs['Pointiness']

    def ao(self, dist=0.1):
        return self.node('ShaderNodeAmbientOcclusion', _samples=12, Distance=dist).outputs['AO']

    def edge(self):                      # 1 on worn outer edges, 0 elsewhere
        return self.ramp(self.point(), (0.505, 0.0), (0.56, 1.0))

    def out(self, color, rough, normal=None):
        self.put(self.b.inputs['Base Color'], color)
        self.put(self.b.inputs['Roughness'], rough)
        if normal is not None:
            self.put(self.b.inputs['Normal'], normal)
        return self.m


def wood(name, light, dark, axis='Z', scale=1.0, end_img=None, wear=1.0, gloss=0.42):
    M = Mat(name)
    st = (6 * scale, 6 * scale, 0.45 * scale) if axis == 'Z' else (0.45 * scale, 6 * scale, 6 * scale)
    v = M.obj(st)
    n1 = M.noise(v, 3.2, 8, 0.62, 0.6)
    n2 = M.noise(v, 22, 4, 0.7)
    rings = M.wave(M.obj((1.0, 1.0, 0.12)), 5.5 * scale, 5, 4, 'X')
    c = M.ramp(M.math('ADD', M.math('MULTIPLY', n1, 0.9), M.math('MULTIPLY', rings, 0.1)), (0.28, dark), (0.5, tuple((a + b) / 2 for a, b in zip(light, dark))), (0.74, light))
    pores = M.ramp(n2, (0.36, 0.35), (0.47, 1.0))
    c = M.mul(c, pores, 0.75)
    grime = M.ramp(M.ao(0.16), (0.25, 0.2), (0.95, 1.0))
    c = M.mul(c, grime, 0.9)
    blot = M.ramp(M.noise(M.obj(), 2.6, 6), (0.35, 0.55), (0.62, 1.0))
    c = M.mul(c, blot, 0.7)
    c = M.mix(M.math('MULTIPLY', M.edge(), 0.55 * wear), c, tuple(min(1, x * 1.45) for x in light))
    cr = M.voro(M.obj((2.2, 2.2, 0.16)), 3.0)
    crack = M.ramp(cr, (0.0, 0.0), (0.012, 1.0))
    crack = M.mix(M.ramp(M.noise(M.obj(), 1.7), (0.5, 1.0), (0.58, 0.0)), crack, 1.0)
    c = M.mul(c, M.ramp(crack, (0, 0.16), (1, 1.0)))
    h = M.math('ADD', M.math('MULTIPLY', pores, 0.35), M.math('MULTIPLY', n1, 0.3))
    nrm = M.bump(h, 0.45, 0.012)
    nrm = M.bump(crack, 0.9, 0.02, nrm)
    nrm = M.bump(M.noise(M.obj(), 9, 3), 0.25, 0.03, nrm)
    if end_img:
        s = M.img(end_img, M.uv())
        g = M.node('ShaderNodeNewGeometry').outputs['Normal']
        up = M.ramp(M.node('ShaderNodeSeparateXYZ', Vector=g).outputs[2], (0.75, 0.0), (0.9, 1.0))
        up = M.mul(up, M.ramp(M.node('ShaderNodeSeparateXYZ', Vector=M.obj()).outputs[2], (0.3, 0.0), (0.4, 1.0)))
        s = M.mul(s, up)
        c = M.mul(c, M.ramp(s, (0.05, 1.0), (0.75, 0.10)))
        nrm = M.bump(M.math('SUBTRACT', 1.0, s), 1.0, 0.02, nrm)
    rough = M.ramp(n1, (0.3, gloss + 0.2), (0.7, gloss))
    return M.out(c, rough, nrm)


def metal(name, col, tarnish, height=None, hscale=0.02, hstr=1.0, gloss=0.22, uvscale=(1, 1, 1), green=0.0, scratch=1.0):
    M = Mat(name, metal=1.0)
    v = M.obj()
    n1 = M.noise(v, 4.5, 8, 0.65)
    n2 = M.noise(v, 26, 5, 0.7)
    cav = M.ramp(M.ao(0.07), (0.45, 1.0), (0.98, 0.0))
    t = M.math('ADD', M.math('MULTIPLY', cav, 1.15), M.ramp(n1, (0.52, 0.0), (0.76, 0.6)), clamp=True)
    c = M.mix(t, col, tarnish)
    if height is not None:
        hh = M.img(height, M.uv(uvscale), ext='REPEAT')
        c = M.mul(c, M.ramp(hh, (0.08, 0.2), (0.42, 1.0)))
        c = M.mix(M.ramp(hh, (0.52, 0.0), (0.8, 0.6)), c, tuple(min(1, x * 1.18) for x in col))
        nrm = M.bump(hh, hstr, hscale)
    else:
        nrm = None
    if green:
        g = M.math('MULTIPLY', M.ramp(M.noise(v, 7.5, 7, 0.7), (0.55, 0.0), (0.64, 1.0)), green, clamp=True)
        g = M.math('MULTIPLY', g, M.ramp(M.ao(0.12), (0.5, 1.0), (1.0, 0.45)), clamp=True)
        c = M.mix(g, c, (0.16, 0.27, 0.2))
    scr = M.ramp(M.noise(M.obj((1, 30, 4), (0.4, 0.2, 0.7)), 5, 3, 0.8), (0.42, 0.0), (0.5, 1.0))
    c = M.mul(c, M.ramp(scr, (0, 0.82), (1, 1)), scratch)
    c = M.mix(M.math('MULTIPLY', M.edge(), 0.8), c, tuple(min(1, x * 1.3) for x in col))
    nrm = M.bump(M.math('ADD', M.math('MULTIPLY', scr, 0.12 * scratch), M.math('MULTIPLY', n2, 0.2)), 0.35, 0.008, nrm)
    rough = M.math('ADD', M.math('MULTIPLY', t, 0.4), M.ramp(n2, (0.3, gloss), (0.75, gloss + 0.16)), clamp=True)
    if green:
        rough = M.math('ADD', rough, M.math('MULTIPLY', g, 0.5), clamp=True)
    return M.out(c, rough, nrm)


def horn(name, col, height=None):
    M = Mat(name)
    v = M.obj((1, 1, 2.2))
    n = M.noise(v, 3.0, 7, 0.6, 1.2)
    c = M.mix(M.ramp(n, (0.42, 0.0), (0.75, 1.0)), col, tuple(x * 3.2 for x in col))
    sc = M.ramp(M.noise(M.obj((2, 46, 3), (0.2, 0.1, 0.5)), 6, 2, 0.8), (0.36, 1.0), (0.44, 0.0))
    sc2 = M.ramp(M.noise(M.obj((40, 2, 3), (0.1, 0.3, -0.3)), 5, 2, 0.8), (0.36, 1.0), (0.43, 0.0))
    s = M.math('MAXIMUM', sc, sc2)
    c = M.mix(M.math('MULTIPLY', s, 0.35), c, (0.2, 0.19, 0.17))
    c = M.mix(M.math('MULTIPLY', M.edge(), 0.75), c, (0.22, 0.19, 0.15))
    dust = M.ramp(M.ao(0.09), (0.4, 0.75), (0.9, 0.0))
    c = M.mix(dust, c, (0.13, 0.12, 0.105))
    chips = M.ramp(M.voro(v, 9.0, 'F1'), (0.05, 1.0), (0.09, 0.0))
    chips = M.math('MULTIPLY', chips, M.ramp(M.noise(v, 2.0), (0.55, 0.0), (0.62, 1.0)))
    c = M.mix(chips, c, (0.16, 0.14, 0.12))
    nrm = M.bump(s, -0.12, 0.004)
    nrm = M.bump(chips, -0.6, 0.02, nrm)
    nrm = M.bump(M.noise(v, 7, 3), 0.12, 0.02, nrm)
    rough = M.math('ADD', 0.13, M.math('ADD', M.math('MULTIPLY', dust, 0.6), M.math('ADD', M.math('MULTIPLY', s, 0.22), M.math('MULTIPLY', chips, 0.5))), clamp=True)
    return M.out(c, rough, nrm)


def paper(name, file, tint=(1, 0.93, 0.8)):
    M = Mat(name)
    v = M.obj()
    im = M.img(file, M.uv())
    g = M.node('ShaderNodeGamma', Color=im, Gamma=1.9).outputs[0]
    c = M.mul(g, tint)
    c = M.mul(c, M.ramp(M.ao(0.12), (0.2, 0.45), (0.95, 1.0)), 0.8)
    c = M.mix(M.math('MULTIPLY', M.edge(), 0.4), c, (0.62, 0.56, 0.45))
    fib = M.noise(M.obj((1, 1, 1)), 46, 6, 0.7)
    nrm = M.bump(M.math('ADD', M.math('MULTIPLY', fib, 0.6), M.math('MULTIPLY', M.noise(v, 11, 5), 0.8)), 0.3, 0.012)
    nrm = M.bump(im, 0.12, 0.006, nrm)
    return M.out(c, 0.86, nrm)


def leather(name, col=(0.05, 0.03, 0.02), scuff=(0.3, 0.2, 0.13), toe=None, gloss=0.4):
    M = Mat(name)
    v = M.obj()
    cell = M.voro(v, 58)
    grain = M.ramp(cell, (0.0, 0.0), (0.09, 1.0))
    fine = M.noise(v, 70, 4, 0.7)
    n1 = M.noise(v, 4.0, 8, 0.62)
    c = M.mix(M.ramp(n1, (0.4, 0.0), (0.68, 0.7)), col, tuple(x * 2.0 for x in col))
    c = M.mul(c, M.ramp(grain, (0, 0.55), (1, 1)), 0.8)
    scf = M.noise(M.obj((3, 9, 9), (0, 0.3, 0.2)), 3.2, 8, 0.75)
    wear = M.ramp(scf, (0.5, 0.0), (0.62, 1.0))
    wear = M.math('MULTIPLY', wear, M.ramp(M.noise(v, 1.7, 3), (0.4, 0.15), (0.62, 1.0)))
    if toe is not None:                                     # worn through toward the toe
        x = M.node('ShaderNodeSeparateXYZ', Vector=M.obj()).outputs[0]
        tw = M.math('MULTIPLY', M.ramp(M.math('ADD', x, M.math('MULTIPLY', n1, 0.3)), (toe, 0.0), (toe + 0.22, 1.0)), M.ramp(fine, (0.35, 0.3), (0.6, 1.0)))
        wear = M.math('MAXIMUM', wear, tw)
    wear = M.math('MAXIMUM', wear, M.math('MULTIPLY', M.edge(), 0.9))
    c = M.mix(wear, c, scuff)
    c = M.mix(M.ramp(M.ao(0.09), (0.3, 0.8), (0.85, 0.0)), c, (0.012, 0.01, 0.009))
    mud = M.ramp(M.noise(v, 6.5, 8, 0.7), (0.58, 0.0), (0.68, 0.75))
    c = M.mix(mud, c, (0.2, 0.165, 0.125))
    creases = M.ramp(M.wave(M.obj((1, 0.3, 0.7), (0, 0.25, 0.2)), 3.4, 13, 5, 'X'), (0.0, 0.0), (0.16, 1.0))
    xx = M.node('ShaderNodeSeparateXYZ', Vector=M.obj()).outputs[0]
    cm = M.math('MULTIPLY', M.math('MULTIPLY', M.ramp(xx, (0.1, 0.0), (0.2, 1.0)), M.ramp(xx, (0.27, 1.0), (0.36, 0.0))), M.ramp(n1, (0.35, 0.2), (0.6, 0.9)))
    cr = M.mix(cm, 1.0, creases)
    c = M.mul(c, M.ramp(cr, (0, 0.5), (1, 1)))
    nrm = M.bump(M.math('ADD', M.math('MULTIPLY', grain, 0.5), M.math('MULTIPLY', fine, 0.4)), 0.35, 0.008)
    nrm = M.bump(cr, 0.55, 0.03, nrm)
    nrm = M.bump(M.math('ADD', wear, mud), 0.3, 0.012, nrm)
    rough = M.math('ADD', M.ramp(n1, (0.3, gloss), (0.7, gloss + 0.18)), M.math('ADD', M.math('MULTIPLY', wear, 0.32), M.math('MULTIPLY', mud, 0.4)), clamp=True)
    return M.out(c, rough, nrm)


def plain(name, col, rough=0.8, bump=0.3, scale=20):
    M = Mat(name)
    n = M.noise(M.obj(), scale, 6, 0.65)
    c = M.mul(col, M.ramp(n, (0.3, 0.6), (0.7, 1.1)))
    c = M.mul(c, M.ramp(M.ao(0.08), (0.2, 0.3), (0.9, 1.0)))
    return M.out(c, rough, M.bump(n, bump, 0.01))


# ── the items: → list of solid objects, a Yarn ────────────────────────────
def give(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def item_spool():
    rng = np.random.default_rng(4)
    prof = [(0.0, 0.47), (0.075, 0.47), (0.085, 0.5), (0.1, 0.505), (0.27, 0.505), (0.315, 0.497), (0.336, 0.478), (0.342, 0.45), (0.338, 0.42), (0.318, 0.395), (0.275, 0.372), (0.225, 0.35), (0.19, 0.325), (0.172, 0.295)]
    prof = prof[:1] + [(0.07, 0.3), (0.072, 0.47)][1:] + prof[2:]
    half = np.array(prof)
    half[0] = (0.07, 0.2)
    up = half
    dn = up[::-1] * [1, -1]
    P = np.vstack([up, dn])
    P = np.vstack([spline(P[1:-1], 190)])
    P = np.vstack([[(0.066, 0.0), (0.068, 0.3), (0.071, 0.46)], P, [(0.071, -0.46), (0.068, -0.3), (0.066, 0.0)]])

    def shape(p, a, r, z):                                  # turned by hand, dropped more than once
        k = 1 + 0.008 * math.sin(a + 1) + 0.005 * math.sin(3 * a + z * 4)
        q = np.array([p[0] * k, p[1] * k, p[2]])
        if r > 0.28 and z > 0.35:
            d = math.exp(-((a - 2.2) / 0.16) ** 2)
            q[:2] *= 1 - 0.07 * d
            q[2] -= 0.012 * d
        if r > 0.28 and z < -0.35:
            q[:2] *= 1 - 0.05 * math.exp(-((a - 4.6) / 0.1) ** 2)
        return q
    o = lathe('spool', P, 200, shape=shape, flip=True)
    # planar print for the scratched end
    me = o.data
    co = np.array([v.co[:] for v in me.vertices])
    idx = np.array([l.vertex_index for l in me.loops])
    me.uv_layers['print'].data.foreach_set('uv', ((co[idx][:, :2] / 0.74) + 0.5).astype(np.float32).ravel())
    give(o, wood('spool', (0.5, 0.31, 0.16), (0.16, 0.085, 0.04), end_img='spool_end.png'))
    Y = Yarn()
    # what is left of the thread: some turns still side by side, some slid over the others
    r = 0.0125

    def turns(z0, z1, n, rad, wob, seed, col):
        k = int(n * 46)
        t = np.linspace(0, n, k)
        a = t * 2 * math.pi + seed
        z = z0 + (z1 - z0) * t / n + wob * (vnoise3(np.stack([t * 0.9, t * 0 + seed, t * 0], 1), 1.0, seed) - 0.5)
        R = rad + 0.008 * vnoise3(np.stack([np.cos(a) * 2, np.sin(a) * 2, t * 0.3], 1), 1.0, seed + 3) + r
        return np.stack([np.cos(a) * R, np.sin(a) * R, z], 1)
    P0 = turns(-0.27, -0.015, 10.5, 0.172, 0.006, 1, RED)
    P1 = turns(0.0, 0.2, 4.6, 0.174, 0.05, 2, RED)
    P2 = turns(-0.23, 0.1, 5.4, 0.193, 0.11, 5, RED)
    for P in (P0, P1, P2):
        Y.tube(P, r, 8, RED)
        Y.fuzz(P, r, 90 if DRAFT else 240, 0.05, rng, (0.55, 0.06, 0.06), 0.0013)
    e = P2[-1]
    tail = spline([P2[-9], P2[-4], e, e + [0.1, -0.1, -0.03], e + [0.21, -0.16, -0.12], e + [0.27, -0.17, -0.3], e + [0.2, -0.15, -0.47], e + [0.27, -0.2, -0.58], e + [0.36, -0.2, -0.56]], 120)
    Y.tube(tail, r, 8, RED)
    Y.fuzz(tail, r, 60 if DRAFT else 130, 0.06, rng, (0.55, 0.06, 0.06), 0.0013)
    Y.frayed(tail[-1], tail[-1] - tail[-4], r, rng, RED, 0.13, 11)
    return [o], Y


def drill(o, holes, r, depth=1.0):
    for x, y in holes:
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=r, depth=depth, location=(x, y, 0))
        c = bpy.context.object
        m = o.modifiers.new('b', 'BOOLEAN')
        m.object, m.operation, m.solver = c, 'DIFFERENCE', 'EXACT'
        apply_mods(o)
        bpy.data.objects.remove(c)


def disc_print(o, R):
    me = o.data
    if 'print' not in me.uv_layers:
        me.uv_layers.new(name='print')
    co = np.array([v.co[:] for v in me.vertices])
    idx = np.array([l.vertex_index for l in me.loops])
    me.uv_layers['print'].data.foreach_set('uv', ((co[idx][:, :2] / (2 * R)) + 0.5).astype(np.float32).ravel())


def item_button():
    rng = np.random.default_rng(8)
    top = spline([(0.0, 0.052), (0.12, 0.053), (0.2, 0.056), (0.235, 0.06), (0.262, 0.074), (0.3, 0.085), (0.345, 0.082), (0.39, 0.076), (0.425, 0.079), (0.452, 0.09), (0.478, 0.092), (0.495, 0.078), (0.5, 0.055)], 84)
    bot = spline([(0.5, 0.05), (0.498, 0.02), (0.485, -0.005), (0.455, -0.02), (0.3, -0.03), (0.15, -0.028), (0.0, -0.028)], 26)
    P = np.vstack([top, bot])

    def shape(p, a, r, z):
        q = p.copy()
        if r > 0.47:
            q[:2] *= 1 + 0.006 * math.cos(a * 96)           # milled edge
        bend = 0.055 * math.exp(-(((p[0] - 0.36) / 0.2) ** 2 + ((p[1] + 0.3) / 0.22) ** 2))
        q[2] += -bend + 0.02 * p[0] * p[1]                  # somebody trod on it
        return q
    o = lathe('button', P, 384, shape=shape, flip=True)
    mod(o, 'WELD', merge_threshold=0.0004)
    H = [(-0.085, 0.085), (0.085, 0.085), (-0.085, -0.085), (0.085, -0.085)]
    drill(o, H, 0.036)
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons))
    mod(o, 'EDGE_SPLIT', split_angle=math.radians(50))
    disc_print(o, 0.5)
    give(o, metal('brass', (0.62, 0.42, 0.17), (0.07, 0.048, 0.026), 'button_h.png', 0.03, 1.0, gloss=0.26, green=1.0))
    Y = Yarn()
    col = (0.05, 0.045, 0.04)
    r = 0.0165
    # the thread it was sewn on with, torn off a coat
    for k, (ha, hb, lift) in enumerate(((0, 3, 0.10), (0, 3, 0.085), (1, 2, 0.118))):
        a, b = np.array(H[ha] + (0.0,)), np.array(H[hb] + (0.0,))
        j = np.array([0.012 * (k - 1), 0.01 * (1 - k), 0])
        P = spline([a + [-.02, .03, -0.34] + rng.normal(size=3) * 0.04, a + [0.0, 0, -0.12], a + j * 0.4 + [0, 0, 0.0], a + j + [0.012 * np.sign(b[0] - a[0]), 0.012 * np.sign(b[1] - a[1]), lift - 0.02],
                    (a + b) / 2 + j + [0, 0, lift], b + j - [0.012 * np.sign(b[0] - a[0]), 0.012 * np.sign(b[1] - a[1]), -(lift - 0.02)], b + j * 0.4, b + [0, 0, -0.12], b + [.03, -.04, -0.3] + rng.normal(size=3) * 0.05], 110)
        Y.tube(P, r, 8, col)
        Y.fuzz(P, r, 40 if DRAFT else 110, 0.06, rng, (0.12, 0.11, 0.1), 0.0015)
        for e, q in ((0, 5), (-1, -6)):
            Y.frayed(P[e], P[e] - P[q], r, rng, col, 0.16, 10)
    broke = spline([(0.085, 0.085, -0.2), (0.085, 0.085, 0.03), (0.1, 0.1, 0.11), (0.16, 0.12, 0.17), (0.2, 0.2, 0.16), (0.26, 0.22, 0.22)], 60)
    Y.tube(broke, r, 8, col)
    Y.fuzz(broke, r, 50, 0.06, rng, (0.12, 0.11, 0.1), 0.0015)
    Y.frayed(broke[-1], broke[-1] - broke[-4], r, rng, col, 0.14, 12)
    return [tip(o)], tip_yarn(Y)


# laid face up in Blender (z up); turned to face the viewer
def tip(o):
    me = o.data
    co = np.array([v.co[:] for v in me.vertices])
    me.vertices.foreach_set('co', np.stack([co[:, 0], -co[:, 2], co[:, 1]], 1).astype(np.float32).ravel())
    me.update()
    return o


def tip_yarn(Y):
    for A in (Y.P, Y.N):
        for k, a in enumerate(A):
            A[k] = np.stack([a[:, 0], -a[:, 2], a[:, 1]], 1)
    return Y


def item_eye():
    rng = np.random.default_rng(12)
    top = spline([(0.0, 0.04), (0.1, 0.042), (0.2, 0.05), (0.255, 0.062), (0.275, 0.085), (0.31, 0.118), (0.36, 0.14), (0.41, 0.142), (0.455, 0.125), (0.485, 0.09), (0.5, 0.045)], 84)
    bot = spline([(0.5, 0.04), (0.49, -0.01), (0.45, -0.05), (0.36, -0.075), (0.2, -0.085), (0.0, -0.085)], 26)

    def shape(p, a, r, z):
        q = p.copy()
        if z > 0 and 0.06 < r < 0.25:
            q[2] += 0.0035 * math.sin(r * 190)              # turning marks
        d = math.exp(-((a - 0.75) / 0.09) ** 2) * max(0, (r - 0.4) / 0.1)       # a chip out of the rim
        q[2] -= 0.07 * d * (1 if z > 0 else 0)
        q[:2] *= 1 - 0.05 * d
        return q
    o = lathe("eye", np.vstack([top, bot]), 200, shape=shape, flip=True)
    mod(o, 'WELD', merge_threshold=0.0004)
    H = [(-0.092, 0.092), (0.092, 0.092), (-0.092, -0.092), (0.092, -0.092)]
    drill(o, H, 0.04)
    mod(o, 'EDGE_SPLIT', split_angle=math.radians(46))
    disc_print(o, 0.5)
    give(o, horn('horn', (0.011, 0.01, 0.0105)))
    Y = Yarn()
    r = 0.02
    for k, (a, b) in enumerate(((0, 3), (1, 2), (0, 3), (1, 2))):
        A, B = np.array(H[a] + (0,)), np.array(H[b] + (0,))
        j = np.array([1, 1, 0]) * 0.013 * (1 if k > 1 else -1) * (1 if a == 1 else 1) if a == 1 else np.array([1, -1, 0]) * 0.0
        j = (np.array([1, 1, 0]) if a == 1 else np.array([1, -1, 0])) * 0.0135 * (1 if k > 1 else -1)
        s = np.sign(B - A) * 0.016
        h = 0.092 + 0.028 * (k % 2)
        P = spline([A + [0, 0, -0.16], A + j * 0.5 + [0, 0, 0.0], A + j + s + [0, 0, h - 0.018], (A + B) / 2 + j + [0, 0, h], B + j - s + [0, 0, h - 0.018], B + j * 0.5, B + [0, 0, -0.16]], 80)
        Y.tube(P, r, 9, RED)
        Y.fuzz(P, r, 40 if DRAFT else 120, 0.07, rng, (0.55, 0.07, 0.07), 0.0015)
    # cut from a face: red ends, and torn grey stitches still behind it
    A = np.array(H[1] + (-0.1,))
    for k in range(3):
        d = np.array([0.5 + 0.2 * k, 0.35 - 0.4 * k, 0.0])
        P = spline([A, A + [0.05, 0.02, -0.1], A + d * 0.5 + [0, 0, -0.12], A + d * 0.8 + [0.02, 0.05 * (k - 1), -0.05], A + d + [0.08, 0.1 * (k - 1), -0.02 + 0.05 * k]], 70)
        Y.tube(P, r, 8, RED2)
        Y.fuzz(P, r, 40 if DRAFT else 100, 0.07, rng, (0.5, 0.06, 0.06), 0.0015)
        Y.frayed(P[-1], P[-1] - P[-4], r, rng, RED, 0.17, 13)
    G = (0.3, 0.29, 0.275)
    for k in range(17):
        a = k / 17 * 6.283 + rng.uniform(-0.12, 0.12)
        u, v = np.array([math.cos(a), math.sin(a), 0]), np.array([-math.sin(a), math.cos(a), 0])
        L = rng.uniform(0.5, 0.66)
        P = spline([u * 0.16 + [0, 0, -0.12], u * 0.36 + v * 0.05 + [0, 0, -0.14], u * (L - 0.04) + v * rng.uniform(-.1, .1) + [0, 0, -0.12 + rng.uniform(-.03, .03)], u * L + v * rng.uniform(-.16, .16) + [0, 0, rng.uniform(-.2, -.02)]], 44)
        Y.tube(P, 0.026, 8, G)
        Y.fuzz(P, 0.026, 30 if DRAFT else 70, 0.07, rng, (0.4, 0.39, 0.37), 0.0015)
        Y.frayed(P[-1], P[-1] - P[-4], 0.026, rng, G, 0.12, 10)
    for k in range(5):                                      # a few rows of her knitting, what is left of the cheek
        a0 = rng.uniform(0, 6.28)
        t = np.linspace(a0, a0 + rng.uniform(2.2, 4.4), 150)
        R = 0.28 + 0.065 * k
        P = np.stack([np.cos(t) * (R + 0.03 * np.sin(t * 26)), np.sin(t) * (R + 0.03 * np.sin(t * 26)), -0.125 - 0.022 * np.cos(t * 52)], 1)
        Y.tube(P, 0.024, 7, G)
        Y.fuzz(P, 0.024, 40 if DRAFT else 90, 0.06, rng, (0.4, 0.39, 0.37), 0.0015)
    return [tip(o)], tip_yarn(Y)


def item_thimble():
    h, rb, rt = 0.92, 0.46, 0.33
    outer = [(rb + 0.035, 0.0), (rb + 0.052, 0.02), (rb + 0.05, 0.045), (rb + 0.022, 0.062), (rb, 0.075)]
    side = [(rb + (rt - rb) * t ** 1.15, 0.075 + (h * 0.8 - 0.075) * t) for t in np.linspace(0.04, 1, 40)]
    dome = [(rt * math.cos(a), h * 0.8 + (h * 0.2) * math.sin(a) ** 0.95) for a in np.linspace(0.06, math.pi / 2, 34)]
    out = np.array(outer + side + dome)
    out[-1, 0] = 0.0005
    out = resample(out, 150)
    inn = resample(np.array([(x * 0.93 if z > 0.1 else x - 0.035, z - 0.03 if z > 0.1 else z) for x, z in out[10:]][::-1]), 60)

    def shape(p, a, r, z):
        q = p.copy()
        d = math.exp(-(((a - 4.35) / 0.34) ** 2 + ((z - 0.42) / 0.16) ** 2))             # the dent
        q[:2] *= 1 - 0.17 * d
        k = 1 + 0.018 * math.cos(2 * (a - 0.6)) * (1 - z)                               # out of round at the mouth
        q[:2] *= k
        return q
    o = lathe("thimble", out, 180, shape=shape)
    give(o, metal('silver', (0.72, 0.7, 0.66), (0.045, 0.042, 0.04), 'thimble_h.png', 0.03, 1.0, gloss=0.16, uvscale=(1, 1, 1)))
    rim = lathe('rim', np.vstack([inn, [(rb + 0.005, 0.004), out[0]]]), 120, shape=shape)
    # inside: where the name was
    co = np.array([v.co[:] for v in rim.data.vertices])
    idx = np.array([l.vertex_index for l in rim.data.loops])
    ang = (np.arctan2(co[:, 1], co[:, 0]) - 1.57 + math.pi) % (2 * math.pi) - math.pi
    rim.data.uv_layers['print'].data.foreach_set('uv', np.stack([0.5 + ang[idx] * 0.45, 0.5 + (co[idx][:, 2] - 0.24) * 2.0], 1).astype(np.float32).ravel())
    give(rim, metal('silverin', (0.55, 0.53, 0.5), (0.035, 0.032, 0.03), 'thimble_in.png', 0.012, 1.0, gloss=0.3))
    for q in (o, rim):
        co = np.array([v.co[:] for v in q.data.vertices])
        co[:, 2] -= h / 2
        q.data.vertices.foreach_set('co', co.astype(np.float32).ravel())
        q.data.update()
    return [o, rim], Yarn()


def sheet(name, W, H, nu, nv, f, uvf=None, jag=0.0, seed=0):
    """a sheet x across, z up, facing -y; f(x, z) -> (x, y, z)"""
    rng = np.random.default_rng(seed)
    V, U = [], []
    for i in range(nu):
        for j in range(nv):
            u, v = i / (nu - 1), j / (nv - 1)
            x, z = (u - 0.5) * W, (v - 0.5) * H
            if jag:
                # the edge is worn in and out; the sheet near it goes with it, so front and back keep together
                for ax, e in ((0, min(u, 1 - u) * W), (1, min(v, 1 - v) * H)):
                    k = max(0.0, 1 - e / 0.05)
                    if k:
                        n = vnoise3(np.array([[z * 11 if ax == 0 else 3.3, x * 11 if ax else 7.7, np.sign(z if ax else x) * 5 + seed]]), 1.0, seed, 5)[0] - 0.3
                        if ax:
                            z -= np.sign(z) * max(0, n) * jag * k
                        else:
                            x -= np.sign(x) * max(0, n) * jag * k
            V.append(f(x, z))
            U.append((u, v) if uvf is None else uvf(u, v))
    o = mesh(name, V, grid_faces(nu, nv), U)
    return o


def item_seeds():
    W, H = 0.72, 1.0
    rs = random.Random(6)
    peas = [(rs.gauss(0, 0.16), rs.uniform(-0.44, -0.08), rs.uniform(0.026, 0.034)) for _ in range(46)]

    def swell(x, z):
        ex, ez = 1 - (2 * x / W) ** 2, 1 - (2 * z / H) ** 2
        b = max(0.0, ex) ** 0.5 * max(0.0, ez) ** 0.5
        y = 0.012 + 0.07 * b * (1.0 - 0.55 * (z + 0.5))
        bump = 0.0
        for px, pz, pr in peas:
            d = math.hypot(x - px, z - pz) / (pr * 1.25)
            if d < 1.6:
                bump = max(bump, pr * 0.62 * math.exp(-d * d * 1.4))
        y += bump * min(1, b * 1.5)
        y += 0.01 * math.sin(x * 19 + z * 7) * b + 0.012 * math.sin(z * 23 - x * 9) * b
        for (a, c, s) in ((0.07, 0.01, 1), (-0.02, 0.35, -1)):      # creases
            d = (z - a - x * 0.06) / 0.012
            y -= 0.0035 * math.exp(-d * d)
        dx = (x - 0.012) / 0.01
        return y - 0.004 * math.exp(-dx * dx)

    def front(x, z):
        y = -swell(x, z)
        c = max(0, (x / W + 0.5) + (0.5 - z / H) - 1.72)            # one corner curls up
        return (x - c * 0.06, y - c * 0.16 - c * c * 0.5, z + c * 0.10)

    n = 120 if DRAFT else 170
    f = sheet('front', W, H, n, int(n * 1.4), front, jag=0.012, seed=3)
    b = sheet('back', W, H, 90, 126, lambda x, z: (x, swell(x, z) * 0.8, z), lambda u, v: (1 - u, v), jag=0.008, seed=3)
    me = b.data
    me.flip_normals()

    def flap(x, z):                                                 # folded over the top, torn open once and pressed shut
        t = (0.5 * 0.26 - z) / 0.26
        tear = 0.028 * (vnoise3(np.array([[x * 13, 0, 1]]), 1.0, 2, 4)[0] - 0.4)
        zz = H / 2 + 0.006 - t * (0.088 + tear)
        lift = 0.018 + 0.05 * t * t * (0.35 + 0.65 * max(0, x / W + 0.5)) + 0.01 * math.sin(x * 12)
        y = -swell(np.clip(x, -W / 2 * 0.99, W / 2 * 0.99), min(zz, H / 2 * 0.99)) - lift * min(1, t * 2.5)
        if t < 0.08:
            y += 0.02 * (1 - t / 0.08)
        return (x * 1.004, y, zz)
    fl = sheet('flap', W, 0.26, 120, 60, flap, seed=5)
    give(f, paper('pf', 'seeds_front.png', (0.9, 0.8, 0.62)))
    give(b, paper('pb', 'seeds_back.png', (0.85, 0.75, 0.58)))
    give(fl, paper('pl', 'seeds_flap.png', (0.8, 0.69, 0.52)))
    for q in (f, fl):
        mod(q, 'SOLIDIFY', thickness=0.005, offset=1)
    return [f, b, fl], Yarn()


def item_pattern():
    W, H = 0.75, 1.0

    def f(x, z):
        y = 0.0
        for zf, s in ((1 / 6 + 0.002, 1), (-0.168, -1)):            # folded in three, then in half
            d = z - zf
            y += s * 0.07 * (math.sqrt(d * d + 0.0006) - abs(zf))
        y -= 0.11 * (math.sqrt(x * x + 0.0004))
        y += 0.02 * math.sin(x * 8 + z * 5) * 0.6 + 0.01 * math.sin(z * 17 + x * 6)
        y += 0.006 * (vnoise3(np.array([[x * 10, z * 10, 0]]), 1.0, 4, 3)[0] - 0.5) * 4
        c = max(0.0, (x / W + 0.5) + (0.5 - z / H) - 1.86)          # the corner turned up
        c2 = max(0.0, (0.5 - x / W) + (0.5 + z / H) - 1.88)
        return (x - c * 0.55 - c * c * 0.4 + c2 * 0.2, y - c * 0.55 - c * 0.2 * math.sin(c * 4) - c2 * 0.5, z + c * 0.55 - c2 * 0.2)
    n = 120 if DRAFT else 170
    o = sheet('sheet', W, H, n, int(n * 1.33), f, jag=0.016, seed=9)
    give(o, paper('pat', 'pattern_front.png', (0.92, 0.82, 0.64)))
    b = sheet('sheetb', W, H, 110, 146, lambda x, z: tuple(np.array(f(x, z)) + [0, 0.004, 0]), jag=0.016, seed=9)
    b.data.flip_normals()
    give(b, paper('patb', 'pattern_back.png', (0.85, 0.75, 0.58)))
    return [o, b], Yarn()


def item_skein():
    rng = np.random.default_rng(3)
    Y = Yarn()
    r, R = 0.0165, 0.44
    P_all = []
    # wound: bundles of near-parallel turns, each bundle over the last in another direction
    layers = 26 if not DRAFT else 20
    for L in range(layers):
        ax = rng.normal(size=3)
        ax /= np.linalg.norm(ax)
        u = np.cross(ax, [0.3, 0.5, 0.81])
        u /= np.linalg.norm(u)
        w = np.cross(ax, u)
        n = 8
        k = n * 58
        t = np.linspace(0, n, k)
        a = t * 2 * math.pi
        # one band of turns on the ball, each a circle a little beside the last
        off = np.linspace(-1, 1, k) * 0.24 + 0.02 * np.sin(a * 2 + L) + rng.uniform(-0.12, 0.12)
        rad = R - 0.03 + 0.03 * (L / layers) + 0.010 * vnoise3(np.stack([np.cos(a) * 3, np.sin(a) * 3, t * 0.4], 1), 1.0, L)
        c = np.sqrt(np.maximum(0.02, 1 - off ** 2))
        P = (u[None] * np.cos(a)[:, None] + w[None] * np.sin(a)[:, None]) * c[:, None] + ax[None] * off[:, None]
        P = P * rad[:, None]
        P_all.append(P)
        col = np.array(RED) * rng.uniform(0.82, 1.12)
        Y.tube(P, r, 8, col)
        Y.fuzz(P, r, 60 if DRAFT else 120, 0.06, rng, (0.58, 0.07, 0.065), 0.0014, lift=1.0)
    # underneath, so no light comes through
    e = P_all[-1][-1]
    out = e / np.linalg.norm(e)
    s = np.sign(e[0]) or 1
    tail = spline([P_all[-1][-14], P_all[-1][-6], e, e + [0.10 * s, -0.10, -0.03], e * 1.02 + [0.2 * s, -0.16, -0.16], [0.6 * s, -0.22, -0.2], [0.66 * s, -0.2, -0.42], [0.56 * s, -0.24, -0.52], [0.68 * s, -0.22, -0.58], [0.82 * s, -0.2, -0.52]], 150)
    Y.tube(tail, r, 9, RED)
    Y.fuzz(tail, r, 60 if DRAFT else 170, 0.07, rng, (0.58, 0.07, 0.065), 0.0014, lift=1.0)
    Y.frayed(tail[-1], tail[-1] - tail[-4], r, rng, RED, 0.16, 14)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=R - 0.045)
    core = bpy.context.object
    core.data.uv_layers[0].name = 'print'
    give(core, plain('core', (0.10, 0.006, 0.007), 0.95))
    return [core], Y


def item_mitten():
    rng = np.random.default_rng(17)
    Y = Yarn()
    col, red = np.array((0.42, 0.40, 0.37)), np.array(RED) * 1.05
    nst = 44
    rows = 30 if not DRAFT else 22
    r = 0.0155
    H0, H1 = -0.62, 0.30

    def section(v):                                         # half width, half depth, at a height 0..1
        w = 0.285 + 0.115 * min(1, max(0, (v - 0.22) / 0.4)) ** 0.8
        w += 0.012 * math.sin(v * 9)
        if v < 0.24:
            w -= 0.02 * math.sin(v / 0.24 * math.pi)
        d = w * (0.47 + 0.05 * math.sin(v * 5))
        return w, d

    def surf(th, v, n, zoff):
        W = np.array([section(q) for q in np.atleast_1d(v)])
        w, d = W[:, 0] + n, W[:, 1] + n
        ct, st = np.cos(th), np.sin(th)
        e = 0.82
        x = w * np.sign(ct) * np.abs(ct) ** e
        y = d * np.sign(st) * np.abs(st) ** e
        z = H0 + (H1 - H0) * v + zoff
        # the hand that is not in it: a lean, a sag
        x = x + 0.05 * np.sin(v * 2.2) * v
        y = y + 0.03 * np.sin(v * 3 + x * 3)
        return np.stack([x, y, z], 1)
    rh = (H1 - H0) / rows
    ppn = 12
    cuff = int(rows * 0.3)
    for j in range(rows):
        k = nst * ppn
        t = np.linspace(0, nst, k + 1)
        i = t * 2 * math.pi
        rib = np.where((np.floor(t + 0.5).astype(int) % 4) < 2, 1.0, -1.0) if j < cuff else np.ones_like(t)
        rs = np.interp(t, np.arange(len(t)) / ppn, rib)
        sway = 0.10 * vnoise3(np.stack([t * 0.5, np.full_like(t, j * 0.6), t * 0], 1), 1.0, 5) - 0.05
        th = (t + 0.27 * np.sin(2 * i) + sway) / nst * 2 * math.pi
        v = (j + 0.5) / rows + t / nst / rows * 0
        dep = -0.017 * np.cos(2 * i)
        amp = rh * (0.92 + 0.1 * vnoise3(np.stack([t * 0.8, np.full_like(t, j), t * 0], 1), 1.0, 2))
        zoff = -np.cos(i) * amp
        nrm = dep * (rs if j < cuff else 1) + (rs * 0.02 if j < cuff else 0) + 0.006 * (vnoise3(np.stack([np.cos(th) * 3, np.sin(th) * 3, np.full_like(th, j * 0.3)], 1), 1.0, 7) - 0.5) * 3
        P = surf(th, np.full_like(t, v), nrm, zoff)
        c = red if j in (cuff + 2, cuff + 3, cuff + 5) else col * (0.93 + 0.14 * rng.random())
        Y.tube(P, r * (0.95 + 0.1 * rng.random()), 5 if DRAFT else 6, c)
        Y.fuzz(P, r, 30 if DRAFT else 64, 0.045, rng, np.clip(c * 1.15, 0, 1), 0.0013, lift=1.1)
    # the cast-on edge: a twisted cord round the cuff
    t = np.linspace(0, 2 * math.pi, 420)
    for ph in (0, math.pi):
        P = surf(t, np.full_like(t, 0.0), 0.013 * np.cos(t * nst + ph), 0.012 + 0.013 * np.sin(t * nst + ph))
        Y.tube(P, r, 6, col)
    # live loops drawn up over the needles
    nd = []
    W = section(1.0)
    top = H1 + 0.085
    for j, i in enumerate(np.arange(0, nst)):
        a = (i + 0.5) / nst * 2 * math.pi
        base = surf(np.array([a - 0.045, a + 0.045]), np.array([0.985, 0.985]), np.zeros(2), 0.0)
        side = -1 if math.sin(a) < 0 else 1
        m = base.mean(0)
        if j % 11 == 7:                                     # one here and there has slipped off and is running down
            P = spline([base[0], base[0] + [0, 0, 0.03], m + [0.01, 0, 0.055], base[1] + [0, 0, 0.03], base[1]], 22)
        else:
            q = np.array([m[0], side * 0.075 + m[1] * 0.15, top + 0.10 * (m[0] - 0.05) * side])
            P = spline([base[0], base[0] * 0.4 + q * 0.6 + [0, side * 0.012, -0.01], q + [-0.004, side * 0.026, 0.008], q + [0, 0, 0.03], q + [0.004, -side * 0.026, 0.008], base[1] * 0.4 + q * 0.6 - [0, side * 0.012, 0.01], base[1]], 34)
        Y.tube(P, r * 0.95, 6, col)
    # thumb: a small tube of its own
    n2, rows2 = 16, 11
    o0, ax = np.array([0.36, -0.02, -0.02]), np.array([0.62, -0.1, 0.62])
    ax = ax / np.linalg.norm(ax)
    e1 = np.cross(ax, [0, 1, 0]); e1 /= np.linalg.norm(e1)
    e2 = np.cross(ax, e1)
    for j in range(rows2):
        k = n2 * ppn
        t = np.linspace(0, n2, k + 1)
        i = t * 2 * math.pi
        th = (t + 0.27 * np.sin(2 * i)) / n2 * 2 * math.pi
        u = j / (rows2 - 1)
        R = 0.125 * math.sqrt(max(0.02, 1 - max(0, (u - 0.5) / 0.52) ** 2)) - 0.015 * np.cos(2 * i)
        s = j * 0.03 - np.cos(i) * 0.029
        P = o0 + ax * (s - 0.05)[:, None] + (e1 * (np.cos(th) * R)[:, None] + e2 * (np.sin(th) * R * 0.85)[:, None])
        Y.tube(P, r, 6, col * (0.93 + 0.14 * rng.random()))
        Y.fuzz(P, r, 20 if DRAFT else 50, 0.045, rng, np.clip(col * 1.15, 0, 1), 0.0013, lift=1.1)
    tipc = o0 + ax * (0.03 * rows2 - 0.06)
    for k in range(5):
        a = k * 1.256
        P = spline([tipc + e1 * math.cos(a) * 0.05 + e2 * math.sin(a) * 0.05 - ax * 0.02, tipc + e1 * math.cos(a) * 0.02 + ax * 0.004, tipc - ax * 0.03], 16)
        Y.tube(P, r, 6, col)
    # the working end, hanging
    s = surf(np.array([0.15]), np.array([0.99]), np.zeros(1), 0.0)[0]
    P = spline([s - [0.03, 0, 0.03], s + [0.02, -0.05, 0.03], s + [0.14, -0.12, 0.02], s + [0.24, -0.15, -0.14], s + [0.27, -0.16, -0.4], s + [0.2, -0.17, -0.6], s + [0.27, -0.17, -0.8], s + [0.36, -0.18, -0.86], s + [0.4, -0.18, -0.76]], 180)
    Y.tube(P, r, 8, col)
    Y.fuzz(P, r, 60 if DRAFT else 160, 0.06, rng, np.clip(col * 1.15, 0, 1), 0.0013)
    Y.frayed(P[-1], P[-1] - P[-4], r, rng, col, 0.12, 12)
    s = surf(np.array([3.6]), np.array([0.01]), np.zeros(1), 0.0)[0]
    P = spline([s + [0.02, 0, 0.03], s + [-0.03, -0.02, -0.04], s + [-0.02, -0.04, -0.16], s + [-0.09, -0.04, -0.24]], 60)
    Y.tube(P, r, 8, col)
    Y.frayed(P[-1], P[-1] - P[-4], r, rng, col, 0.1, 11)
    # two needles, bone dry wood, pointed at one end and knobbed at the other
    objs = []
    for side in (-1, 1):
        L = 1.62
        prof = [(0.0005, -L / 2), (0.006, -L / 2 + 0.02), (0.014, -L / 2 + 0.07), (0.0195, -L / 2 + 0.13), (0.021, -L / 2 + 0.2), (0.021, L / 2 - 0.1), (0.022, L / 2 - 0.06), (0.026, L / 2 - 0.055), (0.052, L / 2 - 0.04), (0.06, L / 2 - 0.005), (0.05, L / 2 + 0.028), (0.026, L / 2 + 0.045), (0.0005, L / 2 + 0.05)]
        o = lathe('needle', resample(spline(prof, 90), 130), 28)
        co = np.array([v.co[:] for v in o.data.vertices])
        a = math.radians(84 if side < 0 else -84)
        ca, sa = math.cos(a), math.sin(a)
        x, z = co[:, 0] * ca + co[:, 2] * sa, -co[:, 0] * sa + co[:, 2] * ca
        bend = 0.03 * (x / 0.8) ** 2
        nc = np.stack([x + 0.06 + side * 0.05, co[:, 1] + side * 0.075 + 0.02 + side * x * 0.0, z + top - bend + 0.008 + 0.0], 1)
        o.data.vertices.foreach_set('co', nc.astype(np.float32).ravel())
        o.data.update()
        give(o, wood(f'needle{side}', (0.46, 0.33, 0.2), (0.2, 0.12, 0.065), axis='X', scale=1.6, gloss=0.3))
        objs.append(o)
    # the dark inside it
    nt, nv = 64, 24
    V = []
    for a in np.linspace(0, 2 * math.pi, nt, endpoint=False):
        V.append(surf(np.full(nv, a), np.linspace(0.02, 0.97, nv), np.full(nv, -0.022), 0.0))
    inner = mesh('inner', np.concatenate(V), grid_faces(nt, nv, close_u=True), np.zeros((nt * nv, 2)))
    give(inner, plain('inner', (0.10, 0.095, 0.088), 0.95))
    objs.append(inner)
    return objs, Y


def item_shoe():
    rng = np.random.default_rng(23)
    # x: heel -0.5 .. toe 0.5. Plan half widths, inside (+y here is the far side) and outside
    X = np.array([-0.5, -0.47, -0.4, -0.28, -0.12, 0.04, 0.2, 0.32, 0.42, 0.48, 0.5])
    WO = np.array([0.02, 0.075, 0.122, 0.135, 0.122, 0.128, 0.165, 0.18, 0.15, 0.085, 0.02])
    WI = np.array([0.02, 0.07, 0.115, 0.12, 0.098, 0.104, 0.155, 0.172, 0.15, 0.085, 0.02])
    OFF = np.array([0.0, 0.0, 0.0, 0.0, 0.008, 0.015, 0.012, 0.004, -0.012, -0.02, -0.022])

    def at(arr, x):
        return np.interp(x, X, arr)
    xs = np.unique(np.r_[spline(np.stack([X, X * 0], 1), 130)[:, 0]])
    smooth = lambda arr: np.interp(xs, *spline(np.stack([X, arr], 1), 400).T)
    wo, wi, off = smooth(WO), smooth(WI), smooth(OFF)
    nx = len(xs)
    floor = lambda x: 0.016 * max(0, (x - 0.22) / 0.28) ** 2 * 3 + 0.006 * math.cos(x * 6)         # a little toe spring
    # topline: the height the upper reaches on each side; past `vamp` it closes over the toes
    def top(x):
        h = 0.20 + 0.13 * max(0.0, (-x - 0.12) / 0.38) ** 1.3
        return h - 0.04 * math.exp(-((x + 0.1) / 0.14) ** 2)
    VX = 0.10
    def crown(x):                                           # the vamp's ridge
        return 0.155 + 0.06 * max(0, 1 - (x - VX) / 0.3) - 0.11 * max(0, (x - 0.30) / 0.2) ** 2.2
    nv = 72
    V, UVs = [], []
    for k, x in enumerate(xs):
        fl = floor(x)
        for j in range(nv):
            s = -1 + 2 * j / (nv - 1)                       # -1 near side top edge, 0 under the sole, 1 far side top edge
            side = -1 if s < 0 else 1
            w = wo[k] if side < 0 else wi[k]
            q = abs(s)
            # the wall bulges above the sole and draws in to the topline
            if x < VX:
                h = top(x)
                if q < 0.4:
                    y, z = w * 0.97 * (q / 0.4), 0.0
                else:
                    t = (q - 0.4) / 0.6
                    y = w * (0.97 + 0.16 * math.sin(min(1, t * 1.15) * math.pi * 0.8) - 0.26 * t ** 2.2)
                    z = h * t ** 0.92
                # the throat line curves forward to the vamp
                g = max(0.0, (x - (VX - 0.11)) / 0.11)
                if q > 0.4 and g > 0:
                    t = (q - 0.4) / 0.6
                    c = crown(x)
                    a = t * math.pi / 2
                    yc, zc = w * 1.06 * math.cos(a) ** 0.8, c * math.sin(a) ** 0.85
                    e = g ** 2.5 * 0.82
                    y, z = y * (1 - e) + yc * e, z * (1 - e) + zc * e
            else:
                c = crown(x)
                if q < 0.4:
                    y, z = w * 0.97 * (q / 0.4), 0.0
                else:
                    t = (q - 0.4) / 0.6
                    a = t * math.pi / 2
                    y = w * 1.06 * max(0, math.cos(a)) ** 0.8
                    z = max(0.02, c) * math.sin(a) ** 0.85
            V.append((x, off[k] + side * y, fl + 0.045 + z))
            UVs.append((k / nx, j / nv))
    V = np.array(V)
    # years: slumped to one side, dented over the toes, the heel trodden down
    n = vnoise3(V, 5.5, 3) - 0.5
    z01 = np.clip((V[:, 2] - 0.06) / 0.25, 0, 1)
    V[:, 1] += 0.04 * n * z01 + 0.03 * z01 ** 2 * np.clip(-V[:, 0] + 0.1, 0, 1)
    V[:, 2] += 0.03 * n * z01 - 0.05 * np.exp(-((V[:, 0] - 0.34) / 0.09) ** 2 - ((V[:, 1] + 0.05) / 0.09) ** 2) * z01
    V[:, 2] -= 0.07 * np.exp(-((V[:, 0] + 0.48) / 0.07) ** 2) * np.clip((V[:, 2] - 0.2) / 0.15, 0, 1)
    faces = []
    hole = lambda c: (((c[0] - 0.437) / 0.05) ** 2 + ((c[1] + 0.045) / 0.062) ** 2 + ((c[2] - 0.14) / 0.06) ** 2) + 0.9 * (vnoise3(c[None] * 1.0, 26, 5)[0] - 0.5) < 0.8
    for f in grid_faces(nx, nv):
        c = V[list(f)].mean(0)
        if not hole(c):                                     # the toe worn through
            faces.append(f)
    up = mesh('upper', V, faces, UVs)
    mod(up, 'SOLIDIFY', thickness=0.012, offset=-1)
    mod(up, 'SUBSURF', levels=1, render_levels=1)
    outward(up)
    give(up, leather('upper', (0.05, 0.027, 0.018), (0.34, 0.22, 0.14), toe=0.3))
    # sole, welt, heel
    def outline(grow, n=160):
        a = np.stack([xs, off - wo * 1.0 - grow], 1)
        b = np.stack([xs, off + wi * 1.0 + grow], 1)[::-1]
        a[:, 0] = a[:, 0] * (1 + grow * 1.6)
        b[:, 0] = b[:, 0] * (1 + grow * 1.6)
        return resample(np.vstack([a, b, a[:1]]), n)[:-1]

    def slab(name, ol, z0, z1, m, bulge=0.01, clip=None):
        rings = [(0.985, z0), (1.0, z0 + 0.004), (1.0 + bulge, (z0 + z1) / 2), (1.0, z1 - 0.004), (0.985, z1)]
        cx = ol.mean(0)
        VV = []
        for s, z in rings:
            for p in ol:
                q = cx + (p - cx) * s
                VV.append((q[0], q[1], z + floor(q[0])))
        nn = len(ol)
        F = [tuple(reversed(x)) for x in grid_faces(len(rings), nn, close_v=True)]
        F.append(tuple(range(nn))[::-1])
        F.append(tuple(range((len(rings) - 1) * nn, len(rings) * nn)))
        o = mesh(name, VV, F, np.array(VV)[:, :2])
        mod(o, 'TRIANGULATE')
        outward(o)
        mod(o, 'EDGE_SPLIT', split_angle=math.radians(50))
        return give(o, m)
    solem = leather('sole', (0.1, 0.065, 0.04), (0.32, 0.24, 0.16), gloss=0.62)
    sole = slab('sole', outline(0.016), 0.008, 0.046, solem)
    hl = outline(0.012, 200)
    hl = hl[hl[:, 0] < -0.2]
    hl = hl[np.argsort(np.arctan2(hl[:, 1], hl[:, 0] + 0.33))]
    heel = slab('heel', hl, -0.05, 0.012, leather('heel', (0.06, 0.038, 0.024), (0.22, 0.16, 0.1), gloss=0.6), 0.004)
    # insole: the print of a foot
    ins_o = outline(-0.012)
    ins = slab('insole', ins_o, 0.048, 0.056, plain('insole', (0.11, 0.08, 0.055), 0.9, 0.5, 26))
    Y = Yarn()
    th = (0.36, 0.31, 0.24)
    ol = outline(0.006, 2)
    ol = resample(np.vstack([outline(0.008, 600)]), 92)
    for p, q in zip(ol[:-1], ol[1:]):                       # welt stitches
        m0, m1 = p * 0.85 + q * 0.15, p * 0.2 + q * 0.8
        z = 0.0475 + floor(p[0])
        P = spline([(m0[0], m0[1], z - 0.012), (m0[0], m0[1], z + 0.003), ((m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2, z + 0.006), (m1[0], m1[1], z + 0.003), (m1[0], m1[1], z - 0.012)], 12)
        Y.tube(P, 0.0048, 6, th, tw=0.6)
    # a binding round the topline, and its stitches
    edge = []
    for side in (0, nv - 1):
        e = [V[k * nv + side] for k in range(nx) if xs[k] < VX - 0.012 and xs[k] > -0.495]
        edge.append(e if side == 0 else e[::-1])
    E = spline(resample(np.vstack([edge[0][::-1], edge[1][::-1]]) if False else np.vstack([np.array(edge[0])[::-1], np.array(edge[1])[::-1]]), 60), 260)
    B = Yarn()
    ring = []
    sides = 8
    T = np.gradient(E, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    up_v = np.array([0, 0, 1.0])
    VV, FF = [], []
    for k in range(len(E)):
        s = np.cross(T[k], up_v)
        s /= np.linalg.norm(s) + 1e-9
        for a in range(sides):
            an = a / sides * 6.2832
            VV.append(E[k] + s * math.cos(an) * 0.0115 + up_v * math.sin(an) * 0.0135)
    bind = mesh('binding', VV, grid_faces(len(E), sides, close_v=True), np.zeros((len(VV), 2)))
    outward(bind)
    give(bind, leather('binding', (0.035, 0.021, 0.015), (0.2, 0.13, 0.085)))
    # the strap: over the instep, its buttonhole torn, the button gone
    def foot(x, side):
        k = int(np.argmin(np.abs(xs - x)))
        return V[k * nv + (nv - 4 if side > 0 else 3)]
    a, b = foot(-0.055, 1), foot(-0.04, -1)
    mid = (a + b) / 2
    C = spline([a + [0, 0.002, -0.06], a + [0, 0.012, 0.0], a * 0.72 + b * 0.28 + [0.005, 0, 0.05], mid + [0.01, 0, 0.072], a * 0.25 + b * 0.75 + [0.012, -0.008, 0.055], b + [0.012, -0.028, 0.012], b + [0.02, -0.052, -0.045], b + [0.035, -0.085, -0.075], b + [0.06, -0.115, -0.07]], 110)
    T = np.gradient(C, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    VV, FF = [], []
    nw = 15
    for k in range(len(C)):
        wdir = np.array([1.0, 0, 0]) - T[k] * T[k][0]
        wdir /= np.linalg.norm(wdir)
        u = k / (len(C) - 1)
        hw = 0.037 * (1 if u < 0.9 else math.sqrt(max(0.02, 1 - ((u - 0.9) / 0.1) ** 2)))
        nrm = np.cross(T[k], wdir)
        for q in range(nw):
            s = -1 + 2 * q / (nw - 1)
            VV.append(C[k] + wdir * s * hw + nrm * 0.004 * s * s * math.sin(u * 8))
    F = []
    for f in grid_faces(len(C), nw):
        k, q = f[0] // nw, f[0] % nw
        if 92 <= k <= 98 and 6 <= q <= 7:                   # the buttonhole
            continue
        F.append(f)
    strap = mesh('strap', VV, F, np.zeros((len(VV), 2)))
    mod(strap, 'SOLIDIFY', thickness=0.012, offset=0)
    mod(strap, 'SUBSURF', levels=1, render_levels=1)
    outward(strap)
    give(strap, leather('strap', (0.042, 0.025, 0.018), (0.25, 0.165, 0.105)))
    VV = np.array(VV).reshape(len(C), nw, 3)
    for q in (1, nw - 2):                                   # stitching along both edges of the strap
        L = VV[6:100, q]
        nr = np.cross(np.gradient(L, axis=0), [1, 0, 0])
        nr /= np.linalg.norm(nr, axis=1)[:, None] + 1e-9
        nr *= np.sign(nr[:, 2:3] + 1e-6)
        L = resample(L + nr * 0.0065, 46)
        for p, w in zip(L[:-1], L[1:]):
            Y.tube(spline([p * 0.85 + w * 0.15, (p + w) / 2 + [0, 0, 0.002], p * 0.2 + w * 0.8], 6), 0.0036, 5, th, tw=0.6)
    # stitches below the binding
    for side, jj in ((0, 5), (1, nv - 6)):
        L = np.array([V[k * nv + jj] for k in range(nx) if -0.47 < xs[k] < VX - 0.03])
        nrm = np.array([0, -1 if side == 0 else 1, 0.0])
        L = resample(L + nrm * 0.005, 52)
        for p, w in zip(L[:-1], L[1:]):
            Y.tube(spline([p * 0.85 + w * 0.15, (p + w) / 2 + nrm * 0.0025, p * 0.2 + w * 0.8], 6), 0.0036, 5, th, tw=0.6)
    # where the button was: a few threads
    s = foot(-0.02, -1) + np.array([0.02, -0.012, -0.07])
    for k in range(4):
        d = np.array([rng.uniform(-.04, .05), -0.04, rng.uniform(-.09, -.02)])
        P = spline([s + [0, 0.02, 0], s, s + d * 0.5 + [0, -0.02, 0.012], s + d, s + d * 1.4 + rng.normal(size=3) * 0.02], 30)
        Y.tube(P, 0.0055, 6, (0.4, 0.35, 0.28))
        Y.frayed(P[-1], P[-1] - P[-3], 0.0055, rng, (0.4, 0.35, 0.28), 0.04, 6)
    # what shows in the hole at the toe
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=(0.4, -0.02, 0.1))
    o = bpy.context.object
    o.scale = (0.075, 0.09, 0.042)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.uv_layers[0].name = 'print'
    give(o, plain('dark', (0.012, 0.01, 0.009), 0.95))
    objs = [up, sole, heel, ins, bind, strap, o]
    for q in objs:                                          # a small child's: short and stubby
        co = np.array([v.co[:] for v in q.data.vertices]) * [0.8, 1, 1]
        q.data.vertices.foreach_set('co', co.astype(np.float32).ravel())
        q.data.update()
    Y.P = [p * [0.8, 1, 1] for p in Y.P]
    return objs, Y


ITEMS = {k[5:]: f for k, f in list(globals().items()) if k.startswith('item_')}


# ── baking and writing ────────────────────────────────────────────────────
def run(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    pr = bpy.context.preferences.addons['cycles'].preferences
    for dev in ('OPTIX', 'CUDA'):
        try:
            pr.compute_device_type = dev
            pr.get_devices()
            for d in pr.devices:
                d.use = d.type == dev
            sc.cycles.device = 'GPU'
            break
        except TypeError:
            continue
    sc.cycles.samples = 24 if DRAFT else 48
    sc.render.bake.margin = 12
    sc.render.bake.use_clear = True
    objs, Y = ITEMS[name]()
    ya = Y.arrays()
    # one object, one atlas
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        if 'print' not in o.data.uv_layers:
            o.data.uv_layers.new(name='print')
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    me = ob.data
    lay = me.uv_layers.new(name='bake')
    me.uv_layers.active = lay
    lay.active_render = False
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(62), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    mod(ob, 'TRIANGULATE')
    me = ob.data
    me.uv_layers.active = me.uv_layers['bake']
    # yarn casts its shade on the rest
    yo = None
    if ya is not None:
        yo = mesh('yarn', ya[0], ya[5])
        give(yo, plain('y', (0.3, 0.3, 0.3)))
    ob.select_set(True)
    if yo:
        yo.select_set(False)
    bpy.context.view_layer.objects.active = ob

    def bake(kind, tag, **kw):
        im = bpy.data.images.new(tag, RES, RES, float_buffer=(kind == 'NORMAL'), alpha=False)
        im.colorspace_settings.name = 'Non-Color'
        nodes = []
        for m in me.materials:
            n = m.node_tree.nodes.new('ShaderNodeTexImage')
            n.image = im
            m.node_tree.nodes.active = n
            for q in m.node_tree.nodes:
                q.select = q == n
            nodes.append((m, n))
        bpy.ops.object.bake(type=kind, **kw)
        for m, n in nodes:
            m.node_tree.nodes.remove(n)
        a = np.empty(RES * RES * 4, np.float32)
        im.pixels.foreach_get(a)
        np.save(os.path.join(C, f'{name}_{tag}.npy'), a.reshape(RES, RES, 4)[::-1, :, :3].astype(np.float16))
    bake('DIFFUSE', 'col', pass_filter={'COLOR'})
    bake('ROUGHNESS', 'rough')
    bake('NORMAL', 'nrm', normal_space='OBJECT')
    sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.45
    bake('AO', 'ao')

    # vertices: solid, then yarn
    W = lambda v: np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1)
    nl = len(me.loops)
    vi = np.empty(nl, np.int32)
    me.loops.foreach_get('vertex_index', vi)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    nr = np.empty(nl * 3, np.float32)
    me.corner_normals.foreach_get('vector', nr)
    nr = nr.reshape(-1, 3)
    uv = np.empty(nl * 2, np.float32)
    me.uv_layers['bake'].data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2).copy()
    uv[:, 1] = 1 - uv[:, 1]
    pm = np.empty(len(me.polygons), np.int32)
    me.polygons.foreach_get('material_index', pm)
    mets = np.array([m.get('metal', 0.0) for m in me.materials], np.float32)
    met = np.repeat(mets[pm], 3)
    key = np.concatenate([vi[:, None].astype(np.float64), np.round(nr, 3), np.round(uv, 5), met[:, None]], 1)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    P = [co[vi[first]]]
    N = [nr[first]]
    U = [uv[first]]
    COL = [np.concatenate([np.full((len(first), 3), 1.0), np.ones((len(first), 1))], 1)]
    MT = [np.stack([np.zeros(len(first)), met[first], np.zeros(len(first)), np.zeros(len(first))], 1)]
    F = [inv.reshape(-1, 3)]
    base = len(first)
    if ya is not None:
        yp, yn, yu, yc, yk, yf = ya
        av = np.concatenate([co, yp])
        tri = np.empty(nl, np.int32)
        me.loops.foreach_get('vertex_index', tri)
        bvh = BVHTree.FromPolygons([Vector(v) for v in av], [tuple(t) for t in np.concatenate([tri.reshape(-1, 3), yf + len(co)])[:]], all_triangles=True)
        rng = np.random.default_rng(1)
        nrays = 10 if DRAFT else 24
        dirs = rng.normal(size=(nrays, 3))
        dirs /= np.linalg.norm(dirs, axis=1)[:, None]
        ao = np.ones(len(yp), np.float32)
        # strands are dense along their length: every vertex of kind 1, fibres are left open
        for i in np.where(yk == 1)[0]:
            n = yn[i]
            o = Vector(yp[i] + n * 0.004)
            hit = tot = 0.0
            for d in dirs:
                c = d.dot(n)
                if c < 0:
                    d, c = -d, -c
                w = c + 0.15
                tot += w
                if bvh.ray_cast(o, Vector(d), 0.4)[0] is not None:
                    hit += w
            ao[i] = 1 - hit / tot
        P.append(yp)
        N.append(yn)
        U.append(yu)
        COL.append(np.concatenate([np.clip(yc, 0, 1) ** (1 / 2.2), ao[:, None]], 1))
        MT.append(np.stack([yk / 255.0 * 1.0, np.zeros(len(yp)), np.zeros(len(yp)), np.zeros(len(yp))], 1))
        F.append(yf + base)
    P, N, U, COL, MT, F = (np.concatenate(x) for x in (P, N, U, COL, MT, F))
    P, N = W(P), W(N)
    lo, hi = P.min(0), P.max(0)
    if name in ('spool', 'skein', 'mitten'):                # centred on the thing itself, not on its loose end
        s = P[:base]
        if name != 'skein':
            lo, hi = np.minimum(s.min(0), lo * 0.0 + s.min(0)), s.max(0)
        else:
            lo, hi = s.min(0) * 1.12, s.max(0) * 1.12
    ctr, half = (lo + hi) / 2, float(np.max((hi - lo)[:2]) / 2)
    half = {'mitten': 0.56, 'eye': 0.6}.get(name, half)
    if name == 'mitten':
        ctr = np.array([0.04, -0.12, 0.0])
    if name == 'eye':
        ctr = np.zeros(3)
    P = (P - ctr) / half
    n8 = np.clip(np.round(N / (np.linalg.norm(N, axis=1)[:, None] + 1e-9) * 127), -127, 127).astype(np.int8)
    buf = np.zeros(len(P), dtype=[('p', '<f4', 3), ('n', 'i1', 4), ('u', '<f4', 2), ('c', 'u1', 4), ('m', 'u1', 4)])
    buf['p'], buf['u'] = P, U
    buf['n'][:, :3] = n8
    buf['c'] = np.clip(np.round(COL * 255), 0, 255)
    buf['m'] = np.clip(np.round(MT * 255), 0, 255)
    os.makedirs(OUT, exist_ok=True)
    head = json.dumps({'nv': len(P), 'ni': int(F.size), 'stride': 32}).encode()
    head += b' ' * (-len(head) % 4)
    with open(os.path.join(OUT, name + '.bin'), 'wb') as f:
        f.write(struct.pack('<I', len(head)) + head + buf.tobytes() + F.astype('<u4').tobytes())
    print('BUILT', name, 'verts', len(P), 'tris', len(F), 'solid', base)


for nm in (list(ITEMS) if 'all' in argv else [a for a in argv if a in ITEMS]):
    run(nm)
