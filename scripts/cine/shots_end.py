"""The films of the two endings, second staging (2026-11-25): C1-C5 the bitten one (app/assets/cine/cut.mp4), O1-O7 the tied one
(outro.mp4). Same rules as shots_intro.py: cameras strictly linear, hands that touch, feet that stay, every sound an event of the
movement. The cameras repeat the prologue's wherever they stand in its places, so both films read as that night come back.
Spoilers: docs/STORY.md. The content of O1-O7 stays out of summaries and pages."""
import math
import os
import subprocess

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector as V
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils import noise as mnoise

import act
import lib
import sets
import shots_cut
from act import OPEN, RELAX, WIDE, hand_rot, mix, mlerp, rigid, sd_capsule, sd_doll, sd_ellipsoid, sd_plane, sd_union, ss
from lib import empty, light, parent, prim, M
from shots import shot, keys, light_keys, node_keys
from shots_cut import ground_h, grown, meadow, thaw_mat
from shots_intro import (ACTORS, EVENTS, FOOT, REPORT, SILL, TABLE, Hold, Lantern, actor, aim, begin, camera, ev, hearth, hold_doll, report, ring_tube,
                         sill_line, snow_rim, window_low)

ROOT = os.path.normpath(os.path.join(lib.os.path.dirname(os.path.abspath(__file__)), '..', '..'))
F_ = V((0.196, 0.981, 0)); R_ = V((0.981, -0.196, 0))       # the prologue's first camera: where it looks, and its right


# ── tools ──────────────────────────────────────────────────────────────────
def voice_env(name, fps=24):
    """how open a mouth is, frame by frame, from the recording itself (0..1)"""
    p = os.path.join(ROOT, 'app', 'assets', 'voice', name + '.ogg')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', '24000', '-af', 'highpass=f=120,lowpass=f=3800', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    n = int(len(x) / 24000 * fps) + 1
    k = 24000 // fps
    e = np.array([np.sqrt((x[i * k:(i + 1) * k] ** 2).mean() + 1e-12) if (i + 1) * k <= len(x) else 0 for i in range(n)])
    e = e / (np.quantile(e[e > 1e-4], 0.93) + 1e-9)
    e = np.clip(e, 0, 1.15) ** 0.7
    return np.convolve(e, [0.2, 0.6, 0.2], 'same')


class Face:
    """jaw, eyes and lids of the model, on top of whatever the head does"""
    def __init__(self, kp, teeth=True):
        pb = kp['rig'].pose.bones
        self.j = pb['c_jawbone.x']
        self.e = [pb['c_eye.l'], pb['c_eye.r']]
        self.lt = [pb[f'c_eyelid_top_0{i}.{s}'] for s in 'lr' for i in (1, 2, 3)]
        self.lb = [pb[f'c_eyelid_bot_0{i}.{s}'] for s in 'lr' for i in (1, 2)]
        for b in [self.j] + self.e + self.lt + self.lb:
            b.rotation_mode = 'XYZ'
        if teeth:
            for o in kp['meshes']:
                if 'Teeth' in o.name or 'Tongue' in o.name:
                    o.hide_render = False

    def set(self, jaw=0.0, yaw=0.0, pitch=0.0, wide=0.0):
        """jaw 0..1; eyes yaw (+ to her left) and pitch (+ up); wide: lids drawn back"""
        self.j.rotation_euler = (0.42 * jaw, 0, 0)
        for b in self.e:
            b.rotation_euler = (pitch, 0, yaw)
        for b in self.lt:
            b.rotation_euler = (0.28 * wide, 0, 0)
        for b in self.lb:
            b.rotation_euler = (-0.12 * wide, 0, 0)


class PetalFall:
    """one petal, falling the way petals do: swinging from side to side, turning"""
    def __init__(self, name, mat, size=0.02):
        n = 7
        vs, fs = [], []
        for j in range(n):
            for i in range(n):
                u, v = i / (n - 1) * 2 - 1, j / (n - 1)
                w = math.sin(math.pi * min(1, v * 0.92 + 0.06)) ** 0.7
                vs.append((u * w * size * 0.8, (v - 0.5) * size * 2, size * (0.45 * u * u * w + 0.35 * (v - 0.4) ** 2)))
        for j in range(n - 1):
            for i in range(n - 1):
                a = j * n + i; fs.append((a, a + 1, a + n + 1, a + n))
        self.o = lib.mesh_obj(name, vs, fs, mat, smooth=True)

    def set(self, p, t, calm=1.0):
        self.o.location = p
        self.o.rotation_euler = (0.9 * math.sin(t * 2.1) * calm, 0.8 * math.sin(t * 1.55 + 1) * calm, t * 0.6 * calm + 0.4)


def petal_mat():
    m = M()
    if 'petal2' not in m:
        lib.mat('petal2', (0.93, 0.80, 0.82), rough=0.6, sss=0.2)
        lib.mat('petal3', (0.62, 0.50, 0.72), rough=0.6, sss=0.2)
        lib.mat('petalfall', (0.93, 0.80, 0.82), rough=0.6, emit=(0.95, 0.8, 0.78), estr=0.35)
        lib.mat('stem', (0.13, 0.19, 0.07), rough=0.8)
        m = M()
    return m


# ── BITTEN ─────────────────────────────────────────────────────────────────
class Melt:
    """where the snow goes and when: one map (0 first, 1 last) that the snow's material reads and the grass grows by. It starts where
    it would: at the walls that face the sun, round trunks, along the pit's dark rim; large bays first, frayed into small ones"""
    X0, Y0, X1, Y1, RES = -72.0, -52.0, 92.0, 112.0, 7          # metres, texels per metre

    def __init__(self):
        rng = np.random.default_rng(12)
        W, H = int((self.X1 - self.X0) * self.RES), int((self.Y1 - self.Y0) * self.RES)
        yy, xx = np.mgrid[0:H, 0:W]
        x = self.X0 + xx / self.RES; y = self.Y0 + yy / self.RES

        def noise(scale):
            n = np.zeros((H, W), np.float32); amp = 1.0; tot = 0
            for o in range(5):
                gx, gy = x * scale * 2 ** o, y * scale * 2 ** o
                g = rng.random((int(abs(self.Y1 - self.Y0) * scale * 2 ** o) + 4, int(abs(self.X1 - self.X0) * scale * 2 ** o) + 4)).astype(np.float32)
                gx = gx - self.X0 * scale * 2 ** o; gy = gy - self.Y0 * scale * 2 ** o
                i, j = gx.astype(int), gy.astype(int); u, v = gx - i, gy - j
                u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v)
                n += amp * ((g[j, i] * (1 - u) + g[j, i + 1] * u) * (1 - v) + (g[j + 1, i] * (1 - u) + g[j + 1, i + 1] * u) * v)
                tot += amp; amp *= 0.55
            return n / tot
        f = noise(0.10) * 0.62 + noise(0.7) * 0.38
        f = (f - f.mean()) / f.std() * 0.11 + 0.62
        for (cx, cy, r, w) in ((0.0, 0.6, 5.2, 0.5), (-5.0, 0.5, 2.4, 0.3), (8.5, 9, 1.5, 0.28), (12.5, 4, 1.4, 0.28), (-12, 7, 1.7, 0.28), (33, 16, 1.6, 0.25)):
            d = np.hypot(x - cx, y - cy); f -= w * np.clip(1 - (d - r * 0.6) / (r * 1.3), 0, 1) ** 1.5
        cx, cy, rx, ry = sets.PIT
        e = np.hypot((x - cx) / rx, (y - cy) / ry); f -= 0.35 * np.clip(1 - (e - 1.0) / 0.7, 0, 1) ** 1.6
        f += 0.10 * np.clip((y - 20) / 30, 0, 1)
        self.f = np.clip(f, 0, 1).astype(np.float32); self.W, self.H = W, H

    def at(self, x, y):
        i = np.clip(((np.asarray(x) - self.X0) * self.RES).astype(int), 0, self.W - 1); j = np.clip(((np.asarray(y) - self.Y0) * self.RES).astype(int), 0, self.H - 1)
        return self.f[j, i]

    def material(self, m, pairs):
        im = bpy.data.images.new('melt', self.W, self.H, float_buffer=True, is_data=True)
        px = np.ones((self.H, self.W, 4), np.float32); px[:, :, :3] = self.f[:, :, None]
        im.pixels.foreach_set(px.ravel()); im.pack()
        nt = m.node_tree
        b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
        geo = nt.nodes.new('ShaderNodeNewGeometry'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1 / (self.X1 - self.X0), 1 / (self.Y1 - self.Y0), 0)
        mp.inputs['Location'].default_value = (-self.X0 / (self.X1 - self.X0), -self.Y0 / (self.Y1 - self.Y0), 0)
        nt.links.new(geo.outputs['Position'], mp.inputs['Vector'])
        tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = im; tx.interpolation = 'Cubic'; tx.extension = 'EXTEND'; nt.links.new(mp.outputs[0], tx.inputs['Vector'])
        val = nt.nodes.new('ShaderNodeValue'); node_keys(val.outputs[0], pairs)
        for fc in nt.animation_data.action.fcurves:
            for kp_ in fc.keyframe_points:
                kp_.interpolation = 'LINEAR'
        sub = nt.nodes.new('ShaderNodeMath'); sub.operation = 'SUBTRACT'; nt.links.new(tx.outputs['Color'], sub.inputs[0]); nt.links.new(val.outputs[0], sub.inputs[1])
        mr = nt.nodes.new('ShaderNodeMapRange'); nt.links.new(sub.outputs[0], mr.inputs['Value'])
        mr.inputs['From Min'].default_value = -0.05; mr.inputs['From Max'].default_value = 0.05
        ramp = nt.nodes.new('ShaderNodeValToRGB'); nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
        cr = ramp.color_ramp
        cr.elements[0].position = 0.0; cr.elements[0].color = (0.085, 0.08, 0.045, 1)
        cr.elements[1].position = 1.0; cr.elements[1].color = (0.86, 0.88, 0.92, 1)
        for p, c in ((0.36, (0.06, 0.052, 0.04, 1)), (0.5, (0.36, 0.37, 0.38, 1)), (0.62, (0.74, 0.76, 0.8, 1))):
            e = cr.elements.new(p); e.color = c
        n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 5.0; n2.inputs['Detail'].default_value = 8
        nt.links.new(geo.outputs['Position'], n2.inputs['Vector'])
        g2 = nt.nodes.new('ShaderNodeMix'); g2.data_type = 'RGBA'; g2.blend_type = 'MULTIPLY'; g2.inputs[0].default_value = 0.45
        nt.links.new(ramp.outputs['Color'], g2.inputs[6]); nt.links.new(n2.outputs['Fac'], g2.inputs[7])
        nt.links.new(g2.outputs[2], b.inputs['Base Color']); b.inputs['Subsurface Weight'].default_value = 0.0

    def grass(self, box, n, nf, pairs, tall=0.25, seed=3, after=14, rise=46, bins=9):
        """blades and flowers that come up only once the snow over them has gone"""
        h = ground_h(); rng = np.random.default_rng(seed)
        gm = lib.mat('grass', (0.12, 0.15, 0.06), rough=0.9); pm = lib.mat('petal', (0.95, 0.9, 0.86), rough=0.7)
        fr, va = np.array([q[0] for q in pairs], float), np.array([q[1] for q in pairs], float)
        x0, y0, x1, y1 = box

        def spots(k):
            x = x0 + rng.random(k) * (x1 - x0); y = y0 + rng.random(k) * (y1 - y0)
            ok = shots_cut._free(x, y, 1.05); x, y = x[ok], y[ok]
            t = np.interp(self.at(x, y) + 0.04, va, fr, left=-99, right=9999)
            return x, y, t
        x, y, t = spots(n)
        for b in range(bins):
            lo, hi = np.quantile(t[t < 9000], [b / bins, (b + 1) / bins]) if (t < 9000).any() else (0, 0)
            q = (t >= lo) & (t < hi + 1e-6) & (t < 9000)
            if not q.any():
                continue
            X, Y = x[q], y[q]; k = len(X); z = h(X, Y) - 0.02
            a = rng.random(k) * math.tau; L = tall * (0.4 + rng.random(k)); w = 0.006 + 0.006 * rng.random(k); dx, dy = np.cos(a) * w, np.sin(a) * w
            lean = 0.35 * L; c = rng.random(k) * math.tau
            b1, b2 = np.stack([X - dx, Y - dy, z], 1), np.stack([X + dx, Y + dy, z], 1)
            v1 = np.stack([b1, b2, np.stack([X + np.cos(c) * lean, Y + np.sin(c) * lean, z + L], 1)], 1).reshape(-1, 3)
            v0 = np.stack([b1, b2, np.stack([X, Y, z - 0.03], 1)], 1).reshape(-1, 3)
            f0 = max(2.0, float(hi) + after)
            grown(f'grass{b}', v0, v1, np.arange(k * 3).reshape(-1, 3).tolist(), gm, [(1, 0.0), (f0, 0.0), (f0 + rise, 1.0)])
        x, y, t = spots(nf)
        q = t < 120
        X, Y, TT = x[q], y[q], t[q]
        for b in range(3):
            lo, hi = np.quantile(TT, [b / 3, (b + 1) / 3]) if len(TT) else (0, 0)
            v0, v1, f = [], [], []
            for X_, Y_, t_ in zip(X, Y, TT):
                if not (lo <= t_ <= hi):
                    continue
                z = float(h(np.array([X_]), np.array([Y_]))[0]); L = tall * (0.6 + 0.6 * rng.random()); c = V((X_, Y_, z + L)); r = 0.022 + 0.018 * rng.random(); ph = rng.random() * 6
                for k in range(5):
                    an = ph + k * math.tau / 5; d = V((math.cos(an), math.sin(an), 0)); sd = V((-d.y, d.x, 0)) * r * 0.5; base = len(v1)
                    v1 += [c, c + d * r * 0.6 + sd + V((0, 0, r * 0.4)), c + d * r * 1.3 + V((0, 0, r * 0.25)), c + d * r * 0.6 - sd + V((0, 0, r * 0.4))]
                    v0 += [V((X_, Y_, z - 0.04))] * 4; f.append((base, base + 1, base + 2, base + 3))
            if v1:
                f0 = max(40.0, hi + 60)
                grown(f'flowers{b}', [tuple(v) for v in v0], [tuple(v) for v in v1], f, pm, [(1, 0.0), (f0, 0.0), (f0 + 40, 1.0)])


class RoofSnow:
    """one side of the roof's snow: a soft sheet that cracks across, slides faster and faster, the eave's part first, and goes to
    pieces as it passes the edge: rounded lumps and powder that fall, burst on the ground, lie in a ridge and melt. The sheet is
    one mesh and the pieces another, both moved by numpy"""
    G = 3.0

    def __init__(self, s, go, mat):
        o = bpy.data.objects[f'roofsnow{s}']
        bpy.context.view_layer.update()
        mw = o.matrix_world.copy(); self.s, self.go = s, go
        a = o.rotation_euler.y
        self.down = np.array([s * math.cos(abs(a)), 0, -math.sin(abs(a))]); self.up = np.array([s * math.sin(abs(a)), 0, math.cos(abs(a))])
        sx, sy, sz = o.scale
        self.L, self.W = 2 * sx, 2 * sy
        e = mw @ V((s * 1.0, 0, -1.0))                                # the middle of the eave's lower edge
        self.eave = np.array(e)
        rng = np.random.default_rng(7 + s)
        self.rng = rng
        # the sheet: u from ridge (0) to eave (L), v along the house
        self.nu, self.nv = 60, 90
        u = np.linspace(0, self.L, self.nu); v = np.linspace(-self.W / 2, self.W / 2, self.nv)
        self.U, self.Vv = np.meshgrid(u, v, indexing='ij')
        bump = 0.06 * np.sin(self.U * 3.1 + 1) * np.sin(self.Vv * 2.3) + 0.05 * np.sin(self.U * 1.3 + self.Vv * 1.7) + 0.02 * np.sin(self.U * 9 + self.Vv * 7)
        edge = np.minimum(np.minimum(self.Vv + self.W / 2, self.W / 2 - self.Vv), np.minimum(self.U + 0.2, self.L - self.U + 0.06))
        self.th = (0.28 + bump) * np.sqrt(np.clip(edge / 0.22, 0, 1))
        self.wave = 0.35 * np.abs(np.sin(self.Vv * 0.9 + s)) + 0.10 * np.sin(self.Vv * 4.3)      # seconds later, along the eave
        # it lets go in bands, with a crack between
        band = np.floor((self.L - self.U) / 1.15 + 0.12 * np.sin(self.Vv * 2.1)).clip(0, 6)
        self.t0 = go + 24 * (band * 0.62 + self.wave)
        ii = np.arange(self.nu * self.nv).reshape(self.nu, self.nv)
        F = np.stack([ii[:-1, :-1], ii[1:, :-1], ii[1:, 1:], ii[:-1, 1:]], -1).reshape(-1, 4)
        if s < 0:
            F = F[:, ::-1]
        self.o = lib.mesh_obj(f'sheet{s}', np.zeros((self.nu * self.nv, 3)).tolist(), F.tolist(), mat, smooth=True)
        o.hide_render = True
        # the pieces: what passes the eave at a time becomes lumps there
        n = 2200
        self.n = n
        pu = rng.random(n) * self.L; pv = (rng.random(n) - 0.5) * self.W * 0.97
        bnd = np.floor((self.L - pu) / 1.15 + 0.12 * np.sin(pv * 2.1)).clip(0, 6)
        t0 = go + 24 * (bnd * 0.62 + 0.35 * np.abs(np.sin(pv * 0.9 + s)) + 0.10 * np.sin(pv * 4.3))
        d = np.maximum(0.05, self.L - pu)
        te = np.sqrt(2 * d / self.G)
        self.tl = t0 + te * 24                                         # frame it leaves the edge
        vel = (self.G * te)[:, None] * self.down[None] * (0.85 + 0.3 * rng.random((n, 1))) + rng.normal(0, 1, (n, 3)) * np.array([0.35, 0.25, 0.25])
        self.vel = vel
        self.p0 = self.eave[None] + np.stack([np.zeros(n), pv, np.zeros(n)], 1) + self.up[None] * (rng.random((n, 1)) * 0.26)
        self.r = np.where(rng.random(n) < 0.42, 0.02 + 0.04 * rng.random(n), 0.06 + 0.13 * rng.random(n) ** 1.8)
        z1 = 0.05 + self.r * 0.3 + 0.20 * rng.random(n) * np.exp(-(rng.normal(0, 1, n) ** 2))
        if s < 0:                                                       # the woodshed's roof is in the way of some
            z1 = np.where((self.p0[:, 1] < 1.9) & (self.p0[:, 1] > -0.7), 2.22 + 0.12 * (0.6 - self.p0[:, 1]) * -1 + self.r * 0.3, z1)
        vz = vel[:, 2]; h = np.maximum(0.2, self.p0[:, 2] - z1)
        self.tf = (vz + np.sqrt(vz * vz + 2 * 9.8 * h)) / 9.8
        self.hit = self.tl + self.tf * 24
        self.rest = self.p0 + vel * self.tf[:, None]; self.rest[:, 2] = z1
        self.hop = rng.random(n) * 0.10 * (self.r < 0.085) ; self.out = rng.normal(0, 0.35, (n, 2)) * (self.r < 0.085)[:, None]
        self.ax = rng.random((n, 3)) * 6; self.spin = rng.normal(0, 4, (n, 3)); self.mel = 0.5 + rng.random(n)
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
        T = np.array([v_.co[:] for v_ in bm.verts]); Fi = np.array([[x.index for x in f_.verts] for f_ in bm.faces]); bm.free()
        self.T = T * (1 + 0.22 * np.sin(T[:, :1] * 3.1 + 1) * np.cos(T[:, 1:2] * 2.7) + 0.10 * np.sin(T[:, 2:] * 6))
        m = len(T); self.m = m
        faces = (Fi[None] + (np.arange(n) * m)[:, None, None]).reshape(-1, 3)
        self.q = lib.mesh_obj(f'lumps{s}', np.zeros((n * m, 3)).tolist(), faces.tolist(), mat, smooth=True)

    def set(self, f):
        t = np.clip((f - self.t0) / 24, 0, None)
        sl = 0.5 * self.G * t * t
        U = self.U + sl
        gone = np.clip((U - self.L) / 0.25, 0, 1)
        th = self.th * (1 - gone) ** 0.7
        # before it goes it sags a little and cracks show: the sheet thins at the bands' edges as they part
        dU = np.gradient(U, axis=0) / (self.L / (self.nu - 1))
        th = th / np.clip(dU, 1.0, 6.0) ** 1.5
        th = np.where(dU > 2.6, 0.0, th)
        P = self.eave[None, None] + (np.minimum(U, self.L + 0.02) - self.L)[..., None] * self.down + self.Vv[..., None] * np.array([0, 1, 0]) + (th - 0.02 * (th < 0.01))[..., None] * self.up
        me = self.o.data; me.vertices.foreach_set('co', P.reshape(-1).astype(np.float32)); me.update()
        tp = (f - self.tl) / 24
        fly = np.clip(tp, 0, self.tf)
        pos = self.p0 + self.vel * fly[:, None]; pos[:, 2] -= 4.9 * fly ** 2
        after = np.clip(tp - self.tf, 0, None)
        k = 1 - np.exp(-after / 0.16)
        pos[:, :2] += self.out * k[:, None]
        pos[:, 2] += self.hop * np.sin(np.pi * np.clip(after / 0.35, 0, 1)) * 3
        land = after > 0
        pos[land, 2] = np.maximum(pos[land, 2], self.rest[land, 2])
        melt = 1 - np.clip((after - 0.5) / (2.4 * self.mel), 0, 1) ** 1.5
        r = self.r * (tp > -0.02) * melt
        sq = 1 - 0.35 * k                                               # it flattens where it lands
        a = self.ax + self.spin * fly[:, None]
        ca, sa = np.cos(a[:, 2]), np.sin(a[:, 2]); cb, sb = np.cos(a[:, 0]), np.sin(a[:, 0])
        T = np.repeat(self.T[None], self.n, 0)
        y, z = T[:, :, 1] * cb[:, None] - T[:, :, 2] * sb[:, None], T[:, :, 1] * sb[:, None] + T[:, :, 2] * cb[:, None]
        x, y = T[:, :, 0] * ca[:, None] - y * sa[:, None], T[:, :, 0] * sa[:, None] + y * ca[:, None]
        C = np.stack([x, y, z * sq[:, None]], -1) * r[:, None, None] + pos[:, None]
        me = self.q.data; me.vertices.foreach_set('co', C.reshape(-1).astype(np.float32)); me.update()


def board_shutters(mats):
    """the two shutters as they were built: five boards with gaps, two battens across, on the side that shows"""
    bpy.context.view_layer.update()
    for nm in ('shutterL', 'shutterR'):
        o = bpy.data.objects[nm]
        M = Matrix.LocRotScale(o.location, o.rotation_euler, None)
        sx, sy, sz = o.scale
        o.hide_render = True
        w = 2 * sx / 5
        for k in range(5):
            b = prim('cube', f'{nm}_b{k}', scale=(w / 2 - 0.006, sy * 0.8, sz - 0.012 * ((k * 3) % 4)), material=mats['plank'])
            b.matrix_world = M @ Matrix.Translation((-sx + w * (k + 0.5), 0.004 * ((k * 2) % 3), 0)) @ Matrix.Diagonal((*b.scale, 1))
        bk = prim('cube', f'{nm}_back', scale=(sx - 0.01, sy * 0.2, sz - 0.05), material=mats['darkwood'])
        bk.matrix_world = M @ Matrix.Translation((0, sy * 0.9, 0)) @ Matrix.Diagonal((*bk.scale, 1))
        for z in (-0.62, 0.62):
            b = prim('cube', f'{nm}_t{z}', scale=(sx - 0.03, 0.014, 0.05), material=mats['plank'])
            b.matrix_world = M @ Matrix.Translation((0, -sy - 0.006, z * sz)) @ Matrix.Diagonal((*b.scale, 1))


def no_smoke():
    if bpy.data.objects.get('smoke'):
        bpy.data.objects['smoke'].hide_render = True          # nobody is at home to keep the fire


def dawn_up(sc, t0, t1, lo, sun_rot=None):
    bg = [n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND'][0]
    s = bg.inputs['Strength'].default_value
    node_keys(bg.inputs['Strength'], [(1, s * lo), (t0, s * lo), (t1, s)])
    for nm in ('sun', 'skyfill'):
        o = bpy.data.objects.get(nm)
        if o:
            e = o.data.energy
            light_keys(o, [(1, e * lo * 0.3), (t0, e * lo * 0.3), (t1, e)])


@shot(exposure=1.0)  # auto=1.9
def C1(out, preview):
    """the Brink, on the very track the prologue opened with: the storm is over. It gets light; the snow lets go of the roof and
    slides off; the ground comes through from the house outward, and grass after it"""
    N = 216
    sc = begin(N, out, preview, origin=(0, -4, 1))
    t0 = V((13.6, -2.6, 1.0)); t1 = t0 - R_ * 14.6
    cam, tgt = camera(33, (t0 - F_ * 19 + V((0, 0, 3.0)), t0), (t1 - F_ * 19 + V((0, 0, 3.0)), t1), N)
    sets.exterior(sc, cam, tgt, storm=False, dawn=True, window_glow=0.0, window_alpha=0.2)
    no_smoke()
    dawn_up(sc, 6, 120, 0.2)
    clean = M()['snow'].copy(); clean.name = 'snowclean'
    for o in bpy.data.objects:                                # only the ground melts by the map; what lies on things slides off or sinks
        if o.type == 'MESH' and o.name != 'ground':
            for sl_ in o.material_slots:
                if sl_.material and sl_.material.name == 'snow':
                    sl_.material = clean
    melt = Melt(); PAIRS = [(1, 0.06), (40, 0.24), (N, 0.86)]
    melt.material(M()['snow'], PAIRS)
    melt.grass((-14, -16, 24, 8), 120000, 2600, PAIRS, tall=0.26)
    mats = M()
    board_shutters(mats)
    sl = {s: RoofSnow(s, g, bpy.data.materials['snowclean']) for s, g in ((1, 104), (-1, 140))}
    for nm in ('icef_', 'ice1_', 'ice-1_'):
        for o in bpy.data.objects:
            if o.name.startswith(nm):
                z = o.scale.copy(); q = 46 + (sum(map(ord, o.name)) % 37) * 2.0
                keys(o, 'scale', [(1, tuple(z)), (q, tuple(z)), (min(N, q + 60), (z.x * 0.15, z.y * 0.15, z.z * 0.03))])
    for nm in ('shed_roofsnow', 'sill_snow', 'chimneysnow'):
        for o in bpy.data.objects:
            if o.name.startswith(nm):
                z = o.scale.copy(); p0 = o.location.copy()
                keys(o, 'scale', [(1, tuple(z)), (60, tuple(z)), (190, (z.x * 0.96, z.y * 0.9, z.z * 0.02))])
                keys(o, 'location', [(1, tuple(p0)), (60, tuple(p0)), (190, (p0.x, p0.y, p0.z - z.z * 0.95))])
    drops = [(prim('sphere', f'edrop{k}', scale=(0.018, 0.018, 0.04), material=mats['snow'], segments=8, ring_count=6), rng_, x_) for k, (rng_, x_) in enumerate(zip(np.random.default_rng(4).random(14), -3.6 + 7.2 * np.random.default_rng(5).random(14)))]

    def upd(f):
        for q in sl.values():
            q.set(f)
        for k, (o, ph, x) in enumerate(drops):
            T = 30 + 22 * ph
            u = ((f + ph * 60) % T) / T
            z = 3.2 - 4.9 * (max(0, u - 0.4) * T / 24) ** 2
            o.location = (x, -0.62, max(-0.2, z)); o.hide_render = f < 40 or z < 0
    lib.FRAME_FNS.append(upd)
    for s, g in ((1, 1.0), (-1, 0.8)):
        first = float(sl[s].t0.min()); big = np.sort(sl[s].hit[sl[s].r > 0.12])
        ev(first, 'roof_slide', g, 0.25 * s, dur=(float(big[-1]) - first) / 24)
        last = -99.0
        for f in big:                                           # a thud for each of the big ones that does not fall on another's heels
            if f - last > 3.2 and f < N:
                ev(float(f), 'snow_fall', g * (0.4 + 0.25 * math.sin(f) ** 2), 0.3 * s); last = float(f)
    for k, (o, ph, x) in enumerate(drops):
        T = 30 + 22 * ph
        for m in range(12):
            f = (m + 0.4) * T - ph * 60 + math.sqrt(3.2 / 4.9) * 24
            if 44 <= f <= N:
                ev(f, 'drop', 0.25 + 0.3 * ph, float(np.clip(x / 8, -0.6, 0.6)))
    lib.register_frames()
    return sc


class Vine:
    """a sweet pea climbing one of the wool threads she strung across her window: the stem is drawn up by its turning tip; leaves in
    pairs, tendrils that catch the thread, flowers that open from folded buds"""
    def __init__(self, i, base, top, seed, t0, t1, mats):
        rng = np.random.default_rng(seed)
        self.t0, self.t1 = t0, t1
        self.base, self.top = V(base), V(top)
        self.ph = rng.random() * 6; self.turns = 3.2 + rng.random() * 1.2
        self.tube = lib.tube(f'vine{i}', [V((0, 0, k * 1e-3)) for k in range(50)], 0.0055, mats['stem'])
        lib.tube(f'string{i}', [self.base.lerp(self.top, k / 15) for k in range(16)], 0.0018, mats['grey_thread'])
        self.parts = []
        n = 8
        for k in range(n):
            s = 0.16 + 0.8 * k / n + 0.03 * rng.random()
            side = 1 if k % 2 else -1
            e = empty(f'vl{i}_{k}')
            for q in (-1, 1):
                lf = self.leaf(f'vleaf{i}_{k}_{q}', 0.075 * (1.15 - 0.45 * s) * (0.8 + 0.4 * rng.random()), mats['stem'])
                parent(lf, e, keep=False); lf.rotation_euler = (0.25, q * 0.5, q * 0.55)
                lf.location = (q * 0.012, 0.012, 0)
            td = lib.tube(f'tend{i}_{k}', [V((0.0, 0.045 + 0.02 * a, 0)) + V((0.016 * math.cos(a * 5) * a, 0.0, 0.016 * math.sin(a * 5) * a)) for a in np.linspace(0, 1, 18)], 0.0012, mats['stem'])
            parent(td, e, keep=False)
            self.parts.append(('leaf', s, e, side, rng.random() * 6, None))
            if k >= 2 and rng.random() < 0.72:
                for w in range(1 + int(rng.random() < 0.55)):
                    fl = self.flower(f'vf{i}_{k}_{w}', mats, 1.25 + 0.35 * rng.random(), 'petal2' if (i + k + w) % 3 else 'petal3')
                    self.parts.append(('flower', s + 0.02 + 0.035 * w, fl[0], -side if w == 0 else side, rng.random() * 6, fl[1]))

    @staticmethod
    def leaf(name, L, mat):
        vs, fs = [], []
        for j in range(8):
            v = j / 7
            w = L * 0.42 * math.sin(math.pi * min(1, v * 0.95 + 0.02)) ** 0.8
            for u in (-1, -0.5, 0, 0.5, 1):
                vs.append((u * w, v * L * 1.6, 0.1 * L * (u * u) - 0.25 * L * v * v))
        for j in range(7):
            for i in range(4):
                a = j * 5 + i; fs.append((a, a + 1, a + 6, a + 5))
        return lib.mesh_obj(name, vs, fs, mat, smooth=True)

    @staticmethod
    def petal(name, w, h, cup, mat, notch=0.0, frill=0.0, seed=0):
        vs, fs = [], []
        n, m = 13, 11
        for j in range(m):
            v = j / (m - 1)
            W = w * (math.sin(math.pi * min(1.0, 0.08 + 0.80 * v)) ** 0.75)
            for i in range(n):
                u = i / (n - 1) * 2 - 1
                y = v * h * (1 - notch * (1 - abs(u)) ** 2 * v * v) * (1 - 0.16 * u * u * v)
                z = cup * (u * u * W * 1.6 - v * v * h * 0.35) + frill * v * v * math.sin(u * 9 + seed)
                vs.append((u * W, z, y))
        for j in range(m - 1):
            for i in range(n - 1):
                a = j * n + i; fs.append((a, a + 1, a + n + 1, a + n))
        return lib.mesh_obj(name, vs, fs, mat, smooth=True)

    def flower(self, name, mats, size=1.0, col='petal2'):
        root = empty(name); root['size'] = size
        stalk = lib.tube(name + '_st', [V((0, -0.05 * a, 0.02 * a)) for a in np.linspace(0, 1, 6)], 0.0022, mats['stem']); parent(stalk, root, keep=False)
        hd = empty(name + '_h', (0, -0.05, 0.02)); parent(hd, root, keep=False)
        P = {}
        for key, args in (('std', (0.032, 0.048, 0.10, 0.22, 0.0016)), ('wl', (0.016, 0.034, 0.3, 0.0, 0.0008)), ('wr', (0.016, 0.034, 0.3, 0.0, 0.0008)), ('keel', (0.009, 0.026, 0.5, 0.0, 0.0))):
            w, h, cup, notch, fr = args
            o = self.petal(name + key, w, h, cup, mats[col], notch, fr, sum(map(ord, name)) % 7)
            parent(o, hd, keep=False); P[key] = o
        cal = prim('sphere', name + '_c', scale=(0.008, 0.008, 0.010), material=mats['stem'], segments=12, ring_count=8); parent(cal, hd, keep=False)
        return root, P

    def at(self, s):
        p = self.base.lerp(self.top, s)
        a = self.ph + self.turns * 2 * math.pi * s
        r = 0.011 * (1 - 0.3 * s)
        return p + V((math.cos(a) * r, math.sin(a) * r, 0))

    def set(self, f):
        g = max(0.0, min(1.0, (f - self.t0) / (self.t1 - self.t0)))
        g = 1 - (1 - g) ** 1.6
        pts = []
        for k in range(50):
            s = g * k / 49
            p = self.at(s)
            # the last hand's breadth is free and circles, feeling for the thread
            free = max(0.0, 1 - (g - s) / 0.10) if g > 0 else 0
            a = f * 0.075 + self.ph
            p = p + V((math.cos(a), math.sin(a) * 0.7, 0)) * 0.03 * free ** 2 * (1 if g < 0.995 else 0.6)
            pts.append(p)
        lib.tube_update(self.tube, pts)
        for (kind, s, e, side, j, P) in self.parts:
            age = (g - s)
            k = ss(age, 0.02, 0.17) if kind == 'leaf' else ss(age, 0.04, 0.24)
            e.location = self.at(min(s, max(g, 1e-3)))
            sway = 0.05 * math.sin(f * 0.09 + j)
            if kind == 'leaf':
                e.scale = (max(1e-4, k),) * 3
                e.rotation_euler = (0.9 - 1.0 * k + sway, 0, (0.9 if side > 0 else -0.9) + math.pi + sway)
            else:
                e.scale = (max(1e-4, e['size'] * (0.35 * min(1, k * 4) + 0.65 * k)),) * 3
                e.rotation_euler = (0.55 - 0.35 * k + sway + 0.25 * math.sin(j * 2), 0.25 * math.sin(j * 3), side * (0.35 + 0.5 * abs(math.sin(j))) + sway)
                o = ss(k, 0.35, 1.0)
                P['std'].rotation_euler = (0.95 - 1.15 * o, 0, 0)
                P['wl'].rotation_euler = (1.15 - 0.35 * o, -0.15 - 0.55 * o, 0.3); P['wr'].rotation_euler = (1.15 - 0.35 * o, 0.15 + 0.55 * o, -0.3)
                P['keel'].rotation_euler = (1.45, 0, 0)


@shot(exposure=1.1)
def C2(out, preview):
    """her window, from where the prologue looked in at her: nobody there. Her sweet peas climb the wool she strung for them; the
    flowers open; one lets a petal go"""
    N = 192
    sc = begin(N, out, preview, origin=(-1.5, 0, 1.4), pos_lo=(-12, -12, -2), pos_size=30.0)
    cam, tgt = camera(50, ((-1.30, -3.9, 1.50), (-1.75, 0.2, 1.47), 3.75), ((-1.62, -3.35, 1.50), (-1.62, 0.2, 1.50), 3.15), N, fstop=5.6)
    sets.exterior(sc, cam, tgt, storm=False, dawn=True, window_glow=0.0, window_alpha=0.05)
    no_smoke()
    mats = petal_mat()
    board_shutters(mats)
    prim('cube', 'stool_in', loc=(-1.45, 1.2, 0.57), scale=(0.2, 0.2, 0.24), material=mats['darkwood'])
    sets.spinning_wheel('wheel_in', (-1.1, 1.75, 0.5), mats)[0].rotation_euler = (0, 0, math.radians(75))
    bpy.data.objects['in_backwall'].hide_render = True
    prim('cube', 'in_dark', loc=(-1.0, 3.4, 1.6), scale=(2.6, 0.05, 1.5), material=mats['darkwood'])
    light('AREA', 'in_day', (-2.6, 0.7, 2.4), 18, color=(0.85, 0.88, 1.0), size=0.7, rot=(math.radians(-40), math.radians(-30), 0))
    sk = light('AREA', 'face', (-3.4, -2.6, 2.6), 55, color=(1.0, 0.86, 0.7), size=0.8); aim(sk, (-1.6, -0.3, 1.5))
    thaw_mat(mats['snow'], [(1, 0.42), (N, 0.74)], scale=1.2)
    s0 = bpy.data.objects['sill_snow']; z0 = s0.scale.copy(); l0 = s0.location.copy()
    vines = []
    rng = np.random.default_rng(8)
    for i in range(9):
        x = -2.42 + i * 0.215 + rng.uniform(-0.03, 0.03)
        top = 2.2 + rng.uniform(-0.04, 0.04)
        vines.append(Vine(i, (x, -0.43 + rng.uniform(-0.02, 0.02), 0.45), (-1.6 + (x + 1.6) * (0.62 + 0.25 * rng.random()), -0.27, top), 20 + i, -46 + 8 * ((i * 5) % 9), 130 + 9 * ((i * 4) % 9), mats))
    prim('cube', 'stringbar', loc=(-1.55, -0.25, 2.21), scale=(1.05, 0.02, 0.02), material=mats['darkwood'])
    pet = PetalFall('petal1', mats['petalfall'], 0.017)
    P0 = V((-1.28, -0.42, 1.72)); T_LET = 132
    drops = [(prim('sphere', f'sdrop{k}', scale=(0.006, 0.006, 0.011), material=mats['snow'], segments=8, ring_count=6), 22 + 9 * k, -2.2 + 0.43 * k) for k in range(4)]

    def upd(f):
        for v in vines:
            v.set(f)
        k = ss(f, 1, 120)
        s0.scale = (z0.x * (1 - 0.15 * k), z0.y * (1 - 0.3 * k), z0.z * (1 - 0.97 * k)); s0.location = l0 - V((0, 0, 0.03 * k)); s0.hide_render = f > 120
        t = max(0.0, (f - T_LET) / 24)
        v = 0.42 * (t - 0.35 * (1 - math.exp(-t / 0.35)))
        pet.set(P0 + V((0.10 * math.sin(t * 2.1), -0.03 * math.sin(t * 1.5), -v)), t * 1.2, min(1, t * 2))
        pet.o.hide_render = f < T_LET - 1
        for (o, T, x) in drops:
            u = (f % T) / T; z = 0.94 - 4.9 * (max(0, u - 0.5) * T / 24) ** 2
            o.location = (x, -0.33, z); o.hide_render = f > 130 or z < 0.1
    lib.FRAME_FNS.append(upd)
    for (o, T, x) in drops:
        m = 0
        while (m + 0.5) * T < 126:
            ev((m + 0.5) * T + math.sqrt(0.84 / 4.9) * 24, 'drop', 0.5, 0.2); m += 1
    ev(T_LET, 'petal', 0.6, 0.1)
    for f in (18, 60, 101):
        ev(f, 'leaf', 0.5, 0.1)
    lib.register_frames()
    return sc


@shot(exposure=1.45)
def C3(out, preview):
    """the very track of her walk to the pit, in the morning, with no one on it: grass and flowers, her dead thread lying through
    them to the edge and over. A petal goes the same way, and down"""
    N = 180
    sc = begin(N, out, preview, origin=(19.0, 3.0, 0))
    H_ = V((0.912, 0.410, 0)).normalized(); n_ = V((-H_.y, H_.x, 0))
    LIP = V((19.75, 3.62, 0))
    ca, cb = LIP - H_ * 1.9 - n_ * 4.1 + V((0, 0, 1.55)), LIP + H_ * 1.3 - n_ * 4.1 + V((0, 0, 1.55))
    cam, tgt = camera(36, (ca, ca + n_ * 6 + V((0, 0, -1.95))), (cb, cb + n_ * 6 + V((0, 0, -1.95))), N)
    sets.exterior(sc, cam, tgt, storm=False, dawn=True, window_glow=0.0, window_alpha=0.2)
    no_smoke()
    h = ground_h(); hh = lambda x, y: float(h(np.array([x]), np.array([y]))[0])
    mats = petal_mat()
    thaw_mat(mats['snow'], [(1, 0.9), (N, 0.9)], under=(0.10, 0.088, 0.05))
    snow_rim(hh)
    vs, fs = [], []
    for nm in ('ground', 'snow_collar'):
        m_ = bpy.data.objects[nm].data; o_ = len(vs)
        vs += [v.co.copy() for v in m_.vertices]; fs += [tuple(i + o_ for i in q.vertices) for q in m_.polygons]
    soil = BVHTree.FromPolygons(vs, fs)

    def has(x, y, rim=1.0):
        u = (x - LIP.x) * H_.x + (y - LIP.y) * H_.y; w = (x - LIP.x) * n_.x + (y - LIP.y) * n_.y
        w0 = w - 0.10 * np.sin(u * 1.3) - 0.05 * np.sin(u * 3.1)
        off = (np.abs(w0) < 0.075) | ((w0 < 0.1) & (w0 > -TALL[0]))                 # nothing grows right by the thread
        return np.array([soil.ray_cast(V((a, b, 30)), V((0, 0, -1)))[0] is not None for a, b in zip(x, y)]) & ~off
    TALL = [0.0]
    keep_ = (shots_cut.ground_h, shots_cut._free)
    shots_cut.ground_h = lambda: (lambda x, y: np.array([(soil.ray_cast(V((a, b, 30)), V((0, 0, -1)))[0] or V((0, 0, -9))).z for a, b in zip(x, y)]))
    shots_cut._free = has
    meadow((13, -1.5, 24, 9), 90000, 900, -60, 1, tall=0.13, seed=3)
    TALL[0] = 1.6
    meadow((16, 0.5, 22, 7), 40000, 0, -60, 1, tall=0.28, seed=5)
    shots_cut.ground_h, shots_cut._free = keep_
    for o in bpy.data.objects:                                # the morning moves through it
        if o.data and getattr(o.data, 'shape_keys', None):
            kb = o.data.shape_keys.key_blocks.get('grown')
            if kb:
                for f in range(1, N + 1, 6):
                    kb.value = 0.97 + 0.07 * math.sin(f * 0.16 + sum(map(ord, o.name)) % 5); kb.keyframe_insert('value', frame=f)
    # her thread on the ground, over the edge of the snow's old collar, and down off the rock
    vs, fs = [], []
    for nm in ('ground', 'snow_collar', 'pit_wall'):
        m_ = bpy.data.objects[nm].data; o_ = len(vs)
        vs += [v.co.copy() for v in m_.vertices]; fs += [tuple(i + o_ for i in q.vertices) for q in m_.polygons]
    bvh = BVHTree.FromPolygons(vs, fs)

    def top(p):
        hit = bvh.ray_cast(V((p.x, p.y, 30)), V((0, 0, -1)))
        return hit[0].z if hit[0] else -9
    pts = []
    s = -9.0
    while s < 4:
        p = LIP + H_ * s + n_ * (0.10 * math.sin(s * 1.3) + 0.05 * math.sin(s * 3.1))
        z = top(p)
        if pts and z < pts[-1].z - 0.35:
            break
        p.z = z + 0.075 * min(1.0, max(0.0, (0.3 - s) / 0.5)) + 0.014; pts.append(p); s += 0.09
    e = pts[-1]
    pts += [e + H_ * (0.05 * k) + V((0, 0, 0.012 - 0.05 * k * k)) for k in range(1, 4)]
    e = pts[-1]
    pts += [e + H_ * 0.02 + V((0.02 * math.sin(k * 0.8), 0, -0.14 * k)) for k in range(1, 30)]
    lib.tube('greythread', pts, 0.014, mats['grey_thread'])
    dk = mats['rock'].copy(); dk.name = 'rockdeep'; [n for n in dk.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0].inputs['Base Color'].default_value = (0.012, 0.011, 0.012, 1)
    bpy.data.objects['pit_wall'].data.materials[0] = dk
    pet = PetalFall('petal1', mats['petalfall'], 0.05)

    def upd(f):
        t = f / 24
        s = -5.4 + 1.18 * t + 0.12 * math.sin(t * 1.9)
        p = LIP + H_ * s + n_ * (0.45 + 0.14 * math.sin(t * 1.4))
        if s < 0.9:
            p.z = max(top(p), -0.5) + 0.22 + 0.10 * math.sin(t * 2.6)
            upd.z = p.z
        else:
            p.z = upd.z - 0.5 * max(0.0, (s - 0.9) / 1.18) ** 1.3 * 1.5
        pet.set(p, t * 1.8)
    upd.z = 0.2
    lib.FRAME_FNS.append(upd)
    for f in (14, 50, 92, 120):
        ev(f, 'leaf', 0.6, 0.2)
    ev(128, 'pit_breath', 0.7, 0.1)
    lib.register_frames()
    return sc


@shot(exposure=1.0)  # auto=0.45
def C4(out, preview):
    """down the well, looking up, sinking: the ring of morning gets smaller; the end of her thread stirs; a petal comes down after us"""
    N = 132
    sc = begin(N, out, preview, origin=(0, 0, 0), pos_lo=(-30, -30, -30), pos_size=160.0)
    top = 104.0
    cam, tgt = camera(24, ((0.4, 0.1, 93), (0.0, 0.0, top)), ((0.0, 0.2, 52), (0.0, 0.0, top)), N)
    w = sets.shaft(sc, cam, tgt, M(), height=120)
    w.scale = (1.3, 0.92, 1.0); w.rotation_euler = (0, 0, 2.2)
    # lines that run up the shaft, so that sinking past them moves nothing: the field is the angle round it
    mt = bpy.data.materials['rock'].copy(); mt.name = 'rockwell'; w.data.materials[0] = mt
    nt = mt.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sp.inputs[0])
    at = nt.nodes.new('ShaderNodeMath'); at.operation = 'ARCTAN2'; nt.links.new(sp.outputs['Y'], at.inputs[0]); nt.links.new(sp.outputs['X'], at.inputs[1])
    cb = nt.nodes.new('ShaderNodeCombineXYZ')
    for op, ax in (('COSINE', 'X'), ('COSINE', 'Y'), ('SINE', 'Z')):
        n_ = nt.nodes.new('ShaderNodeMath'); n_.operation = op; nt.links.new(at.outputs[0], n_.inputs[0])
        m_ = nt.nodes.new('ShaderNodeMath'); m_.operation = 'MULTIPLY'; m_.inputs[1].default_value = 4.0; nt.links.new(n_.outputs[0], m_.inputs[0]); nt.links.new(m_.outputs[0], cb.inputs[ax])
    a = next(n for n in nt.nodes if n.type == 'OUTPUT_AOV' and n.aov_name == 'pos'); nt.links.new(cb.outputs[0], a.inputs['Color'])
    mats = petal_mat()
    prim('plane', 'sky', loc=(0, 0, top + 6), rot=(math.pi, 0, 0), scale=(30, 30, 1), material=lib.emissive('daysky', (1.0, 0.86, 0.7), 1.1, aux=(0, 0, 0.15)))
    lamp = light('AREA', 'day', (0, 0, top + 2), 9000, color=(1.0, 0.85, 0.68), size=6.0)
    light_keys(lamp, [(1, 9000), (70, 8000), (N, 2200)])
    near = light('POINT', 'wall', (0, 0, 100), 900, color=(0.9, 0.82, 0.75), size=0.5)
    keys(near, 'location', [(1, (0, 0, 98)), (N, (0.1, 0, 62))], interp='LINEAR')
    light_keys(near, [(1, 420), (60, 420), (104, 160), (128, 0)])
    line = lib.tube('greythread', [V((0, 0, k * 1e-2)) for k in range(60)], 0.02, mats['grey_thread'])
    pet = [PetalFall(f'petal{k}', mats['petalfall'], 0.07) for k in range(3)]
    # it comes over the lip, lies down the rock and hangs free where the rock falls back
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); ev_o = w.evaluated_get(dg); me_ = ev_o.to_mesh()
    wall = BVHTree.FromPolygons([w.matrix_world @ v.co for v in me_.vertices], [tuple(q.vertices) for q in me_.polygons]); ev_o.to_mesh_clear()
    an = math.atan2(-0.6, 1.7); out_d = V((math.cos(an), math.sin(an), 0))
    def rock(z):
        hit = wall.ray_cast(V((0, 0, z)), out_d)[0]
        return hit.to_2d().length if hit is not None else 9.9
    zr = next(z for z in np.arange(106.0, 100, -0.05) if rock(z) < 9)
    base = [out_d * (rock(zr - 0.05) + q) + V((0, 0, zr + 0.06 - 0.05 * q * q)) for q in (2.0, 1.5, 1.0, 0.6, 0.3, 0.1)]
    r_ = rock(zr - 0.05) - 0.05
    for k in range(54):
        z = zr - 0.05 - 22 * k / 53
        r_ = min(r_, rock(z) - 0.05)                              # never pushed into the rock, and it does not cling under an overhang
        base.append(out_d * r_ + V((0, 0, z)))
    for _ in range(3):
        base = base[:7] + [q.lerp((a_ + b_) / 2, 0.5) for a_, q, b_ in zip(base[6:], base[7:-1], base[8:])] + base[-1:]
    in_ = -out_d; sd_ = V((-out_d.y, out_d.x, 0))

    def upd(f):
        t = f / 24
        pts = []
        for k, q in enumerate(base):
            u = max(0.0, (k - 12) / 47)
            sw = u ** 2 * 0.35
            pts.append(q + in_ * (sw * (1 + math.sin(t * 0.9 + u * 2.2))) + sd_ * (sw * math.cos(t * 0.7 + u * 2) + 0.03 * math.sin(k * 0.9) * min(1, k / 8)))
        lib.tube_update(line, pts)
        for k, p in enumerate(pet):
            z = 101.5 - 4.0 * k - 8.6 * t
            p.set(V((0.5 * math.sin(t * 1.3 + k * 2) + 0.25 * (k - 1), 0.45 * math.cos(t * 1.1 + k * 2.4), z)), t * 2 + k)
    lib.FRAME_FNS.append(upd)
    ev(20, 'well_drop', 0.5, 0.2); ev(58, 'well_drop', 0.4, -0.3); ev(96, 'well_drop', 0.35, 0.1)
    lib.register_frames()
    return sc


# ── what sits in her chair ─────────────────────────────────────────────────
class Rocker:
    """a rocking chair that rolls on its runners: everything parented to `o` goes with it"""
    R = 0.95

    def __init__(self, name, loc, yaw, mats, full=True):
        self.base = empty(name + '_b', loc); self.base.rotation_euler = (0, 0, yaw)
        self.o = empty(name); self.o.parent = self.base
        w = mats['darkwood']
        add = lambda o: parent(o, self.o, keep=False)
        # runners: arcs of radius R
        for x in (-0.27, 0.27):
            pts = [V((x, math.sin(a) * self.R, self.R - math.cos(a) * self.R + 0.022)) for a in np.linspace(-0.52, 0.56, 22)]
            add(lib.tube(name + f'_run{x}', pts, 0.022, w, 8))
        for (x, y, z0, z1, r, dy) in [(-0.26, -0.24, 0.07, 0.66, 0.02, 0.0), (0.26, -0.24, 0.07, 0.66, 0.02, 0.0), (-0.25, 0.26, 0.07, 0.46, 0.02, 0.0), (0.25, 0.26, 0.07, 0.46, 0.02, 0.0)]:
            add(lib.tube(name + f'_leg{x}{y}', [V((x, y + dy * k / 6, z0 + (z1 - z0) * k / 6)) for k in range(7)], r, w, 10))
        add(prim('cube', name + '_seat', loc=(0, 0.02, 0.435), rot=(0.06, 0, 0), scale=(0.285, 0.29, 0.02), material=w))
        for x in (-0.25, 0.25):                              # back posts, leaning
            add(lib.tube(name + f'_post{x}', [V((x, 0.28 + 0.16 * (k / 10) ** 1.2, 0.44 + 0.72 * k / 10)) for k in range(11)], 0.02, w, 10))
        for k in range(6 if full else 4):
            x = -0.185 + 0.37 * k / (5 if full else 3)
            add(lib.tube(name + f'_spin{k}', [V((x, 0.285 + 0.145 * (j / 8) ** 1.2, 0.46 + 0.62 * j / 8)) for j in range(9)], 0.010, w, 8))
        add(lib.tube(name + '_crest', [V((-0.28 + 0.56 * k / 12, 0.435 - 0.02 * math.sin(math.pi * k / 12), 1.12 + 0.045 * math.sin(math.pi * k / 12))) for k in range(13)], 0.032, w, 10))
        for x in (-0.27, 0.27):
            add(lib.tube(name + f'_arm{x}', [V((x, 0.33 - 0.62 * k / 10, 0.665 + 0.012 * math.sin(k * 0.6))) for k in range(11)], 0.022, w, 10))
        lib.stick(self.o, self.o)

    def set(self, th):
        """rolled by th: + leans back"""
        self.o.rotation_euler = (-th, 0, 0)
        # rolling without slipping about the runner's centre at height R
        c = V((0, 0, self.R))
        R = Matrix.Rotation(-th, 3, 'X')
        self.o.location = c - R @ c + V((0, self.R * th, 0))


@shot(exposure=1.0)  # auto=1.6
def C5(out, preview):
    """the bottom: a hall of empty rocking chairs, all of them moving; in hers, what wears her, the doll on its knee: it strokes the
    doll's head, rocks, and whispers names into its ear, one after another. A petal comes down out of the dark and lands. Every
    chair stops. It looks up"""
    N = 336
    sc = begin(N, out, preview, origin=(0, 0.2, 0.95), pos_lo=(-12, -9, -2), pos_size=24.0)
    sc.eevee.volumetric_end = 30
    mats = petal_mat()
    lib.world(sc, top=(0, 0, 0), horizon=(0.002, 0.002, 0.003), strength=1.0, fog=0.0)
    c0, c1 = V((0.0, 0.30, 0.86)), V((-0.01, 0.20, 0.985))
    cam, tgt = camera(50, (c0 + V((1.10, -2.30, 0.10)), c0), (c1 + V((0.46, -1.42, 0.02)), c1), N, fstop=4.0)
    fl = prim('plane', 'cfloor', loc=(0, 4, 0), scale=(14, 12, 1), material=mats['rock'])
    lib.displace(fl, 0.05, 0.6, subdiv=6, axis='Z'); fl.location.z = -0.035
    top = light('SPOT', 'well', (-0.25, 0.75, 5.2), 1300, color=(0.72, 0.8, 1.0), size=0.35, spot=math.radians(26)); aim(top, (-0.05, 0.25, 0.5))
    front = light('AREA', 'front', (1.3, -1.7, 1.15), 26, color=(0.8, 0.84, 1.0), size=0.7); aim(front, (0, 0.05, 1.15))
    back = light('AREA', 'hall', (0, 7.5, 4.6), 420, color=(0.6, 0.7, 1.0), size=4.0); aim(back, (0, 4.0, 0))
    T_LAND, T_STOP, T_LOOK, T_END = 246, 250, 284, 326
    light_keys(top, [(1, 0.0), (30, 1300), (T_END - 4, 1300), (T_END, 0)])
    light_keys(front, [(1, 0.0), (46, 26), (T_END - 4, 26), (T_END, 0)])
    light_keys(back, [(1, 0.0), (70, 420), (T_END - 4, 420), (T_END, 0)])
    # the others
    rng = np.random.default_rng(6)
    others = []
    k = 0
    for row in range(4):
        for col in range(7):
            x = -5.4 + col * 1.8 + (0.9 if row % 2 else 0) + rng.uniform(-0.2, 0.2); y = 2.5 + row * 1.7 + rng.uniform(-0.2, 0.2)
            if abs(x) < 0.7 and row == 0:
                continue
            r = Rocker(f'rk{k}', (x, y, 0), rng.uniform(-0.5, 0.5), mats, full=False)
            others.append((r, rng.random() * 6, 0.055 + 0.03 * rng.random(), 0.92 + 0.16 * rng.random())); k += 1
    R = Rocker('hers', (0, 0, 0), 0.0, mats)
    kr, kp = lib.knitter('knitter', (0, 0.03, 0.005), mats, seated=True)
    kr.parent = R.o
    A = actor(kr, kp); face = Face(kp)
    d, dp = lib.doll('doll', (0, 0, 0), 1.0, mats)
    ringt = lib.tube('greyring', [p for p, _ in lib.doll_ring((0.05, 0, 1), -0.004, 0.0022, 64)] + [lib.doll_ring((0.05, 0, 1), -0.004, 0.0022, 64)[0][0]], 0.0017, mats['grey_thread']); parent(ringt, d, keep=False)
    tail = lib.tube('bitten', [V((0, 0, k * 1e-3)) for k in range(26)], 0.0019, mats['grey_thread'])
    D0 = rigid((-0.055, -0.265, 0.585), (-0.06, 0.02, 0.16))           # on its knee, in the chair's frame
    PER = 66.0

    def stopk(f):
        return 1 - ss(f, T_STOP, T_STOP + 5)

    def rock(f):
        g = min(f, T_STOP)
        a = 0.075 * math.sin(2 * math.pi * g / PER)
        if f > T_STOP:                                        # it does not come to rest: it is held
            a *= 1.0
        return a

    def chair(f):
        th = rock(f)
        Rm = Matrix.Rotation(-th, 4, 'X'); c = V((0, 0, R.R))
        return Matrix.Translation(c - Rm.to_3x3() @ c + V((0, R.R * th, 0))) @ Rm
    where = lambda f: chair(f) @ D0
    head_where = where
    # left hand round its body
    gl = A.hand[1].grasp(sd_doll(('body',)), hand_rot((-0.35, -0.75, -0.45), (-1, 0.35, 0.1)), (0.066, 0.026, 0.115), close=(1.15, 1.0), thumb=((0.35, 0.9, 0.0), (0.1, 0.5, 0.0)))
    HL = Hold(A, 1, gl, where, rigid((0.3, 0.8, 0.9)), (-9, -8, -7, -6), pole=(0.9, 0.45, -0.5))
    # right hand strokes its head, from the crown down the back of it: the hand is fitted at every step of the way
    steps = []
    for j in range(13):
        a = -0.55 + 1.75 * j / 12
        n_ = V((-0.30, math.sin(a), math.cos(a))).normalized()
        t_ = V((0.18, math.cos(a), -math.sin(a)))
        c, r = lib.DOLL_HEAD
        at = V(c) + V((n_.x * r[0], n_.y * r[1], n_.z * r[2]))
        steps.append(A.hand[-1].grasp(sd_doll(('head',)), hand_rot(-t_ * 1.0 + V((0.25, 0, 0)), -n_), at, close=(0.75, 0.6), thumb=((0.3, 0.45, 0), (0.0, 0.3, 0))))
    STROKE = 80.0                  # the chairs stop while the hand lies over its brow

    def stroke(f):
        g = min(f, T_STOP)
        u = (g % STROKE) / STROKE
        if u < 0.66:
            return ss(u, 0.02, 0.64), 0.0
        return 1 - ss(u, 0.70, 0.98), math.sin(math.pi * ss(u, 0.66, 1.0)) * 0.05

    def right(f):
        s, lift = stroke(f)
        x = s * 12; i = min(11, int(x)); k = x - i
        G = mlerp(steps[i]['G'], steps[i + 1]['G'], k); p = mix(steps[i]['pose'], steps[i + 1]['pose'], k)
        n = steps[i]['n']
        G = Matrix.Translation(-V(n) * lift) @ G
        if lift:
            p = mix(p, OPEN, min(0.5, lift * 9))
        return G, p, lift
    env = voice_env('names')
    T_VOICE = 62
    VEND = T_STOP
    # it says a name, waits, and leans in closer for the next
    quiet = np.convolve(env, np.ones(9) / 9, 'same')
    pet = PetalFall('petal1', mats['petalfall'], 0.014)
    v_ = A.hand[-1].skin(right(T_LAND)[1]); near = v_[(np.abs(v_[:, 2] + 0.062) < 0.02) & (np.abs(v_[:, 1]) < 0.014)]
    LANDH = V((float(near[:, 0].max()) + 0.002, 0.0, -0.062))

    def upd(f):
        th = rock(f)
        R.set(th)
        for (r, ph, amp, w) in others:
            g = min(f, T_STOP)
            r.set(amp * math.sin(2 * math.pi * g / (PER * w) + ph))
        W = chair(f)
        # feet stay on the floor while the chair rolls
        breath = 0.012 * math.sin(f * 0.11) * stopk(f)
        close = ss(f, 50, 150)
        up = ss(f, T_LOOK, T_LOOK + 5)                            # at once
        say = env[int(f - T_VOICE)] if 0 <= f - T_VOICE < len(env) and f < VEND else 0.0
        q = quiet[int(f - T_VOICE)] if 0 <= f - T_VOICE < len(quiet) and f < VEND else 0.0
        kp['hips'].rotation_euler = (0.02, 0, 0)
        kp['torso'].rotation_euler = (0.26 + 0.12 * close + breath - 0.14 * up, 0.10 * close * (1 - up), -0.06 * close * (1 - up))
        kp['neck'].rotation_euler = (0.10 - 0.10 * close - 0.10 * up, 0.16 * close * (1 - up), 0)
        kp['head'].rotation_euler = (0.14 - 0.10 * close + 0.04 * q - 0.22 * up, (0.06 + 0.46 * close + 0.04 * math.sin(f * 0.037)) * (1 - up) - 0.10 * up, 0.10 * close * (1 - up) + 0.03 * math.sin(f * 0.05) * (1 - up) + 0.16 * up)
        if up > 0:                                                # at us, exactly
            a_ = Euler(kp['head'].rotation_euler)
            A.look(lib.eval_fc(cam, 'location', f, cam.location), limit=1.1)
            b_ = kp['head'].rotation_euler
            kp['head'].rotation_euler = (a_.x + (b_.x - a_.x) * up, a_.y * (1 - up) - 0.10 * up, a_.z + (b_.z - a_.z) * up)
        face.set(jaw=min(1, 0.62 * say) + 0.0 * up, yaw=-0.35 * close * (1 - up), pitch=-0.25 * (1 - up), wide=1.0 * up)
        d.matrix_world = W @ D0
        nudge = 0.05 * q * stopk(f)
        for s in (-1, 1):
            dp[f'arm{s}'].rotation_euler = (-0.10, -s * (0.42 if s == -1 else 1.05), 0)
        sK, lift = stroke(f)
        dp['headpiv'].rotation_euler = (0.0, 0.0, 0.0)
        dp['tuft'].rotation_euler = (0.55 * math.sin(math.pi * min(1, sK * 2.2)) * (lift == 0) * stopk(f), 0, 0)
        G, p, lf = right(f)
        HW = W @ D0 @ G
        A.arm(-1, HW, (-0.9, 0.55, -0.35)); A.hand[-1].pose(p)
        HL.set(f)
        err = 0
        for s in (1, -1):
            err = max(err, A.leg(s, V((s * 0.085, -0.46, 0.072)), Matrix.Rotation(s * 0.12, 3, 'Z'), V((s * 0.12, -1.0, 0.25))))
        FOOT[0] = err
        # the bitten end
        a0 = W @ D0 @ V((0.03, -0.062, 0.108))
        pts = [a0 + V((0.004 * k, -0.0035 * k, 0)) + V((0, 0, -0.0009 * k * k)) for k in range(26)]
        lib.tube_update(tail, pts)
        # the petal
        land = HW @ LANDH                                          # on the back of the hand that strokes
        t = (f - T_LAND) / 24
        if f < T_LAND:
            p_ = land + V((0.10 * math.sin(t * 2.4) * min(1, -t), 0.05 * math.sin(t * 1.9) * min(1, -t), -0.42 * t))
            pet.set(p_, t * 1.4, min(1.0, -t * 1.2) if t < 0 else 0)
        else:
            pet.o.location = land; pet.o.rotation_euler = (HW.to_3x3() @ Matrix.Rotation(math.pi / 2, 3, 'Y')).to_euler()
        pet.o.hide_render = f < 120
    lib.FRAME_FNS.append(upd)
    report(A, [HL], where, sd_doll(('body',)))
    REPORT.append(lambda f: {-1: (right(f)[2] == 0.0, A.hand[-1].gap(right(f)[1], right(f)[0], sd_doll(('head',))))})
    # sounds: hers creaks at each end of its roll; the hall answers; the hand on the wool; the names; the petal; the stop
    h = 0
    while True:
        f = PER * (0.25 + 0.5 * h)
        if f > T_STOP:
            break
        if f >= 1:
            ev(f, 'rocker', 0.8 if h % 2 else 0.65, 0.05)
        h += 1
    for (r, ph, amp, w) in others[:14]:
        for h in range(12):
            f = PER * w * (0.25 + 0.5 * h - ph / (2 * math.pi))
            if 20 <= f < T_STOP:
                ev(f, 'rocker_far', 0.35, float(np.clip(r.base.location.x / 6, -0.8, 0.8)))
    k = 0
    while k * STROKE < T_STOP:
        f = k * STROKE + 0.04 * STROKE
        if f >= 1:
            ev(f, 'stroke', 0.8, -0.1, dur=0.6 * STROKE / 24)
        k += 1
    EVENTS.append({'f': T_VOICE, 'kind': 'voice', 'name': 'names', 'vol': 0.85, 'pan': 0.0, 'dur': (VEND - T_VOICE) / 24})
    ev(T_LAND, 'petal_land', 0.8, 0.0)
    EVENTS.append({'f': T_STOP, 'kind': 'stop', 'vol': 1, 'pan': 0})
    ev(T_STOP + 1, 'rocker_stop', 0.8, 0.0)
    ev(T_LOOK + 1, 'neck', 1.0, 0.0)
    EVENTS.append({'f': T_END - 2, 'kind': 'black', 'vol': 1, 'pan': 0})
    lib.register_frames()
    return sc


# ── TIED ───────────────────────────────────────────────────────────────────
def window_off(f0, lamps=('in_lamp', 'win_spill')):
    """the window's light goes out at f0, all at once"""
    for nm in lamps:
        o = bpy.data.objects.get(nm)
        if o:
            e = o.data.energy
            light_keys(o, [(1, e), (f0 - 1, e), (f0, 0.0)])
            for fc in o.data.animation_data.action.fcurves:
                for k in fc.keyframe_points:
                    k.interpolation = 'CONSTANT'
                for m in list(fc.modifiers):
                    fc.modifiers.remove(m)
    for nm in ('glass', 'in_wall'):
        m = bpy.data.materials.get(nm)
        if m:
            b = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
            v = b.inputs['Emission Strength'].default_value
            node_keys(b.inputs['Emission Strength'], [(1, v), (f0 - 1, v), (f0, 0.0)])
            a = [n for n in m.node_tree.nodes if n.type == 'OUTPUT_AOV' and n.aov_name == 'aux'][0]
            c = tuple(a.inputs['Color'].default_value)
            node_keys(a.inputs['Color'], [(1, c), (f0 - 1, c), (f0, (0, 0, 0, 1))])
            for fc in m.node_tree.animation_data.action.fcurves:
                for k in fc.keyframe_points:
                    k.interpolation = 'CONSTANT'


def tug(f, beats, up=3.0, down=9.0):
    """0..1: how hard the line is being pulled, a pull at each beat"""
    v = 0.0
    for b in beats:
        if f >= b - up:
            v = max(v, ss(f, b - up, b) * (1 - ss(f, b, b + down)))
    return v


BEATS = [22, 52, 80, 106, 130, 152]


@shot(exposure=1.0)  # auto=0.95
def O1(out, preview):
    N = 204
    sc = begin(N, out, preview, origin=(8, 0, 0.5))
    t0 = V((8.6, -1.2, 0.9)); t1 = t0 - R_ * 9.6
    cam, tgt = camera(33, (t0 - F_ * 10.5 + V((0, 0, 1.3)), t0), (t1 - F_ * 10.5 + V((0, 0, 1.3)), t1), N)
    sets.exterior(sc, cam, tgt, storm=False)
    no_smoke()
    h = ground_h(); hh = lambda x, y: float(h(np.array([x]), np.array([y]))[0])
    snow_rim(hh)
    mats = M()
    OFF = 174
    window_off(OFF)
    # the red line: out of the pit, over the snow, to her window
    a, b = V((19.9, 3.7, 0)), V((-1.5, -0.34, 1.04))
    base = []
    way = act.Path([(19.9, 3.7), (14.5, 1.5), (9.0, -0.6), (4.6, -1.35), (1.4, -1.2), (-1.5, -0.34)])
    for k in range(120):
        u = k / 119; q_ = way.at(way.len * u); p = V((q_[0], q_[1], 0))
        g = hh(p.x, p.y)
        z = g + 0.02 if u < 0.9 else g + 0.02 + (1.04 - g) * ((u - 0.9) / 0.1) ** 1.2
        base.append(V((p.x, p.y, z)))
    base[0].z = -0.5
    line = lib.tube('redline', base, 0.016, mats['red'])
    # what came out of the pit walks along it, the way she used to come home, and stops at the window
    kr, kp = lib.knitter('knitter', (9, 0, 0), mats, seated=False)
    A = actor(kr, kp)
    hw = act.Path([(19.9, 3.7), (14.5, 1.5), (9.0, -0.6), (4.6, -1.35), (1.4, -1.45), (-1.48, -1.30)])
    D = 10.2; S0 = hw.len - D
    W_ = act.Walk(A, hw, [('go', -6, D, 17, 9.8)], N, ground=lambda x, y: hh(x, y), width=0.075, lift=0.07, lean=0.02, drop=0.06, first=1, start=S0, sway=0.016)
    pm = lib.mat('print', (0.33, 0.36, 0.43), rough=0.9)
    foot = 1; q_ = S0 - 0.5
    marks = []
    while q_ > S0 - 6:
        marks.append((-99, foot, q_)); foot = -foot; q_ -= 0.62
    for i, (f, ft, q_) in enumerate(marks + [(f, ft, q_) for (f, ft, q_) in W_.strikes]):
        q, hd = W_.spot(ft, q_)
        fw = V((math.sin(hd), -math.cos(hd), 0))
        o_ = prim('sphere', f'print{i}', loc=q + fw * 0.045 + V((0, 0, 0.003)), rot=(0, 0, hd), scale=(0.05, 0.13, 0.012), material=pm, segments=20, ring_count=8)
        if f > 0:
            o_.hide_render = True; o_.keyframe_insert('hide_render', frame=1)
            o_.hide_render = False; o_.keyframe_insert('hide_render', frame=int(math.ceil(f + 4)))
    win = V((-1.52, 0.1, 1.40))

    def upd(f):
        W_.pose(f)
        t = kp['torso'].rotation_euler
        kp['torso'].rotation_euler = (t[0] - 0.22, t[1], t[2])          # more upright than she ever was
        A.look(win, limit=0.9, amount=1.0)                              # and it does not take its eyes off the window
        Wm = A.W(kr)
        for sd in (1, -1):                                              # its arms hang; it has not learned to swing them
            A.hand[sd].pose(RELAX)
            A.arm(sd, Wm @ rigid((sd * 0.225, -0.05, 0.80), hand_rot((0, -0.06, -1), (-sd, 0.1, 0))), Wm.to_3x3() @ V((sd * 0.6, 0.8, -0.3)))
        FOOT[0] = W_.err
    lib.FRAME_FNS.append(upd)
    for (f, ft, q_) in W_.strikes:
        if 1 <= f <= N:
            p_ = hw.at(q_)
            ev(f, 'step_snow', 0.85, max(-0.5, min(0.5, (p_[0] - (8.6 - 9.4 * f / N)) / 7)))
    ev(OFF, 'lamp_out', 1.0, -0.1)
    lib.register_frames()
    return sc


def arms_only(kp):
    """leave of a figure only its arms: the rest stays in the dark below"""
    for o in kp['meshes']:
        if o.hide_render:
            continue
        names = {g.index: g.name for g in o.vertex_groups}
        arm_ = []
        for v in o.data.vertices:
            best = max(v.groups, key=lambda g: g.weight, default=None)
            n = names.get(best.group, '') if best else ''
            arm_.append(any(k in n for k in ('arm_stretch', 'forearm', 'hand', 'index', 'middle', 'ring', 'pinky', 'thumb')))
        bm = bmesh.new(); bm.from_mesh(o.data)
        bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not all(arm_[v.index] for v in f.verts)], context='FACES')
        bm.to_mesh(o.data); bm.free()


@shot(exposure=1.0)  # auto=2.3
def O2(out, preview):
    N = 168
    sc = begin(N, out, preview, origin=(19.5, 3.0, -0.2))
    H_ = V((0.912, 0.410, 0)).normalized(); n_ = V((-H_.y, H_.x, 0))
    LIP = V((19.75, 3.62, 0))
    sets.exterior(sc, None, None, storm=False, interior=False, window_glow=0.0)
    h = ground_h(); hh = lambda x, y: float(h(np.array([x]), np.array([y]))[0])
    snow_rim(hh)
    mats = M()
    vs, fs = [], []
    for nm in ('ground', 'snow_collar'):
        m_ = bpy.data.objects[nm].data; o_ = len(vs)
        vs += [v.co.copy() for v in m_.vertices]; fs += [tuple(i + o_ for i in q.vertices) for q in m_.polygons]
    bvh = BVHTree.FromPolygons(vs, fs)

    def top(x, y):
        hit = bvh.ray_cast(V((x, y, 30)), V((0, 0, -1)))
        return hit[0].z if hit[0] else None
    # where the snow ends, along the way out (H_) for a place t to the side of it
    def edge(t):
        s = -1.4
        while s < 1.6:
            p = LIP + H_ * s + n_ * t
            z = top(p.x, p.y)
            if z is None or z < top(*(p - H_ * 0.05)[:2]) - 0.06:
                return s
            s += 0.02
        return s
    cA = LIP - H_ * (1.75 - edge(0)) - n_ * 0.20; cB = LIP - H_ * (1.75 - edge(0)) + n_ * 0.10
    zc = top(*(LIP - H_ * 0.6)[:2])
    e0 = edge(0.0)
    look = LIP + H_ * (e0 + 0.12) + V((0, 0, zc + 0.10))
    cam, tgt = camera(42, (V((cA.x, cA.y, zc + 0.55)), look - n_ * 0.12), (V((cB.x, cB.y, zc + 0.55)), look + n_ * 0.18), N, fstop=5.6)
    k = light('AREA', 'moonkey', tuple(LIP - H_ * 1.2 - n_ * 2.6 + V((0, 0, 2.6))), 34, color=(0.7, 0.78, 1.0), size=0.6); aim(k, look)
    fl_ = light('SPOT', 'face', tuple(LIP - H_ * 0.9 - n_ * 0.9 + V((0, 0, zc + 0.25))), 0.0, color=(0.75, 0.82, 1.0), size=0.1, spot=math.radians(24)); aim(fl_, LIP + H_ * (e0 + 0.2) + V((0, 0, zc + 0.36)))
    light_keys(fl_, [(1, 0), (136, 0), (160, 34), (N, 34)])
    rimL = light('AREA', 'moonrim', tuple(LIP + H_ * 2.4 + n_ * 1.6 + V((0, 0, 2.4))), 26, color=(0.6, 0.7, 1.0), size=0.8); aim(rimL, look)

    class Grab:
        """one arm out of the dark: up past the edge, over it, down flat on the snow; the fingers dig, and it takes weight"""
        def __init__(self, A, s, t, back, t0, yaw=0.0, full=False):
            self.A, self.s, self.t0, self.full = A, s, t0, full
            H = A.hand[s]
            e = edge(t)
            q = LIP + H_ * (e - back) + n_ * t
            z = top(q.x, q.y)
            zx = (top(q.x + 0.1, q.y) - top(q.x - 0.1, q.y)) / 0.2; zy = (top(q.x, q.y + 0.1) - top(q.x, q.y - 0.1)) / 0.2
            nn = V((-zx, -zy, 1)).normalized()
            self.sdf = sd_plane(tuple(nn), nn.dot(V((q.x, q.y, z))) - 0.004)
            f = Matrix.Rotation(yaw, 3, 'Z') @ (-H_)
            self.g = H.grasp(self.sdf, hand_rot(f + nn * 0.12, -nn), (q.x, q.y, z), close=(0.5, 0.5), thumb=((0.25, 0.25, 0), (0, 0.2, 0)))
            # dug in: fingers bent, tips pressed
            self.dig = mix(self.g['pose'], {'f': [(a + 0.28, b + 0.5, sp) for a, b, sp in self.g['pose']['f']], 't': self.g['pose']['t']}, 1.0)
            self.nn, self.q = nn, V((q.x, q.y, z))
            self.sh = self.g['G'].translation + H_ * 0.24 + V((0, 0, -0.27))

        def at(self, f):
            t0 = self.t0
            G = self.g['G']
            low = Matrix.Translation(H_ * 0.42 + V((0, 0, -0.62))) @ G
            over = Matrix.Translation(H_ * 0.10 + V((0, 0, 0.20))) @ G
            R_up = Matrix.Rotation(-0.9, 4, n_)
            def about(M_, k):
                c = Matrix.Translation(M_.translation); return c @ Matrix.Rotation(0.9 * k, 4, n_ * -1.0) @ c.inverted() @ M_
            u1, u2 = ss(f, t0 - 15, t0 - 5), ss(f, t0 - 6, t0)
            M_ = mlerp(mlerp(about(low, 1), about(over, 1), u1), G, u2)
            p = mix(WIDE, self.g['pose'], ss(f, t0 - 3, t0 + 1))
            d = ss(f, t0 + 4, t0 + 11)
            slide = 0.022 * d + 0.004 * math.sin(f * 0.23 + self.t0) * d
            tang = (H_ - self.nn * H_.dot(self.nn)).normalized()
            M_ = Matrix.Translation(tang * slide) @ M_
            p = mix(p, self.dig, d)
            return M_, p

        def set(self, f, pole=None):
            M_, p = self.at(f)
            self.A.arm(self.s, M_, pole or (H_ * 0.5 + n_ * (-self.s) * 0.5 + V((0, 0, -0.5))))
            self.A.hand[self.s].pose(p)
    ROTZ = math.atan2(-H_.x, H_.y)               # a figure's facing (its -y) turned to -H_, out of the pit
    face_out = math.atan2(-H_.x, H_.y)
    grabs = []
    # the one that comes: both its hands first
    kr, kp = lib.knitter('knitter', tuple(LIP + H_ * 0.5), mats, seated=False)
    A0 = actor(kr, kp); fc = Face(kp, teeth=False)
    kr.rotation_euler = (0, 0, face_out)
    P = [(-1, -0.18, 0.13, 112, 0.12), (1, 0.18, 0.16, 124, -0.10)]
    sideof = {s: None for s in (1, -1)}
    # its left (+x) lies on which side of the frame
    lx = (Matrix.Rotation(face_out, 3, 'Z') @ V((1, 0, 0))).dot(n_)
    for s, t, back, t0, yaw in P:
        grabs.append(Grab(A0, s, abs(t) * (1 if (s * lx) > 0 else -1), back, t0, yaw, True))
    # and others, arms only
    extra = [(-0.47, 0.15, 30, -0.2), (0.45, 0.17, 58, 0.2), (0.74, 0.22, 74, 0.3), (-0.78, 0.22, 86, -0.35), (-0.30, 0.22, 95, -0.1), (1.04, 0.2, 102, 0.35)]
    EX = []
    for k_, (t, back, t0, yaw) in enumerate(extra):
        kr2, kp2 = lib.knitter(f'other{k_}', (0, 0, 0), mats, seated=False)
        arms_only(kp2)
        A2 = act.Actor(kr2, kp2); kr2.rotation_euler = (0, 0, face_out)
        s = 1 if k_ % 2 else -1
        A2.P[f'arm{-s}'].location = A2.P[f'arm{-s}'].location + V((0, 0, -30))     # the other arm of this rig is away
        G_ = Grab(A2, s, t, back, t0, yaw)
        EX.append((kr2, A2, G_, s))
    line = lib.tube('redline', [V((0, 0, k * 1e-3)) for k in range(60)], 0.006, mats['red'])
    LEND = LIP + H_ * (edge(0.30) - 0.03) + n_ * 0.30
    RISE0 = 126

    def upd(f):
        # the body hangs from its hands; after they are all there it comes up
        up = ss(f, RISE0, 162)
        first = ss(f, 96, 118)
        e_ = LIP + H_ * (e0 + 0.21)
        kr.location = V((e_.x, e_.y, zc - 2.32 + 0.80 * first + 0.06 * ss(f, 124, 132) + 0.30 * up))
        kp['hips'].rotation_euler = (0.06, 0, 0)
        kp['torso'].rotation_euler = (0.20 + 0.12 * up, 0, 0.05 * math.sin(f * 0.11) * (1 - up))
        kp['neck'].rotation_euler = (0.35 - 0.3 * up, 0, 0)
        kp['head'].rotation_euler = (0.55 - 0.98 * ss(f, 140, 160), 0.34 * ss(f, 144, 162), 0)
        fc.set(jaw=0.12 * up, pitch=0.22 * up, wide=0.8 * up)
        for g in grabs:
            g.set(f)
        for (kr2, A2, G_, s) in EX:
            # its shoulder keeps under its hand
            M_, p = G_.at(f)
            kr2.location = V((0, 0, 0))
            S = A2.W(A2.P[f'sh{s}']).translation
            want = G_.sh + V((0, 0, -0.45)) * (1 - ss(f, G_.t0 - 16, G_.t0 - 2))
            kr2.location = want - S
            G_.set(f)
            kr2.hide_render = True
        a = LIP + H_ * (e0 - 1.6) + n_ * 0.36; pts = []
        for j in range(40):
            p = a.lerp(LEND, j / 39); z = top(p.x, p.y); z = z if z is not None else (pts[-1].z - 0.02 if pts else zc); pts.append(V((p.x, p.y, z + 0.008 + 0.012 * tug(f, [30, 58, 74, 86, 112, 124, 146]) * math.sin(math.pi * j / 39))))
        e2 = pts[-1]
        pts += [e2 + H_ * (0.02 + 0.10 * (j / 20) ** 0.5) + V((0, 0, -1.4 * (j / 20) ** 1.6)) for j in range(1, 21)]
        lib.tube_update(line, pts)
    lib.FRAME_FNS.append(upd)

    def rep(f):
        out_ = {}
        for g in grabs:
            M_, p = g.at(f)
            out_[g.s] = (g.t0 <= f <= g.t0 + 3, A0.hand[g.s].gap(p, M_, g.sdf))
        return out_
    REPORT.append(rep)
    for g in grabs + [x[2] for x in EX]:
        ev(g.t0, 'palm_snow', 1.0 if g in grabs else 0.8, float(np.clip((g.q - LIP).dot(n_), -0.8, 0.8)))
        ev(g.t0 + 6, 'dig', 0.6, float(np.clip((g.q - LIP).dot(n_), -0.8, 0.8)))
    ev(RISE0 + 2, 'heave', 0.8, 0.0, dur=(160 - RISE0) / 24)
    EVENTS.append({'f': N, 'kind': 'cutblack', 'vol': 1, 'pan': 0})
    lib.register_frames()
    return sc


@shot(exposure=1.0)  # auto=4.0
def O3(out, preview):
    N = 150
    sc = begin(N, out, preview, origin=(-1.8, 1.9, 1.1), pos_lo=(-6, -3, -1), pos_size=12.0)
    cam, tgt = camera(30, ((0.15, 2.32, 1.30), (-2.6, 1.68, 1.12)), ((-0.12, 2.26, 1.30), (-2.6, 1.68, 1.12)), N, fstop=5.6)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, candle_lit=False, outside_snow=False, **TABLE)
    R['doll'].location = SILL
    bpy.data.objects.remove(bpy.data.objects['fogbox'])
    mats = M()
    prim('cube', 'ilintel', loc=(-2.6, 1.68, 2.10), scale=(0.13, 0.62, 0.13), material=mats['darkwood'])
    prim('cube', 'ileftend', loc=(-2.62, 4.2, 1.3), scale=(0.12, 0.72, 1.35), material=mats['plank'])
    bpy.data.objects['outside_snow'].hide_render = True
    g = prim('plane', 'osnow', loc=(-8.75, 1.7, -0.035), scale=(6, 9, 1), material=mats['snow'])
    lib.displace(g, 0.10, 1.2, subdiv=6, axis='Z')
    prim('cube', 'ostep', loc=(-2.98, 1.68, -0.06), scale=(0.30, 0.6, 0.06), material=mats['stone'])
    prim('plane', 'obackdrop', loc=(-13.5, 1.7, 4), rot=(0, math.radians(90), 0), scale=(9, 22, 1), material=lib.mat('obackdrop', (0.02, 0.02, 0.03), rough=1.0, emit=(0.05, 0.06, 0.085), estr=0.5))
    cold = light('AREA', 'doorcold', (-5.6, 0.2, 4.6), 110.0, color=(0.62, 0.72, 1.0), size=2.4); aim(cold, (-3.2, 1.7, 0.6))
    R['door'].rotation_euler = (0, 0, math.radians(92))
    fill = light('AREA', 'facefill', (0.05, 1.35, 0.75), 0.0, color=(0.7, 0.8, 1.0), size=0.2); aim(fill, (-0.80, 2.1, 1.32))
    kr, kp = lib.knitter('knitter', (-3.0, 1.68, 0.0), mats, seated=False)
    A = actor(kr, kp); face = Face(kp)
    B1, B2, B3 = (50, 56), (92, 99), (136, N)

    def upd(f):
        st = 0 if f < B1[1] else 1 if f < B2[1] else 2
        kr.hide_render = True
        for o in kp['meshes']:
            o.hide_render = st == 0 or ('Teeth' in o.name and st < 2) or ('Tongue' in o.name and st < 2)
        if st <= 1:
            kr.location = (-2.86, 1.66, -0.0); kr.rotation_euler = (0, 0, math.radians(90 + 6))
            kp['hips'].rotation_euler = (0.10, 0.02, 0); kp['hips'].location = A.hips0 + V((0, 0, -0.02))
            kp['torso'].rotation_euler = (0.46, 0.05 * math.sin(f * 0.09), 0)
            kp['neck'].rotation_euler = (0.1, 0.12, 0); kp['head'].rotation_euler = (0.05, 0.42 + 0.03 * math.sin(f * 0.12), 0)
            face.set()
            fill.data.energy = 0.0
            for s in (1, -1):
                A.hand[s].pose(RELAX)
                A.arm(s, A.W(kr) @ rigid((s * 0.25, -0.22, 0.62), hand_rot((0, -0.1, -1), (-s, 0.1, 0))), None)
                A.leg(s, A.W(kr) @ V((s * 0.085, 0.03, 0.07)), A.W(kr).to_3x3(), A.W(kr).to_3x3() @ V((0, -1, 0)))
        else:
            k = ss(f, B2[1], B3[0])
            kr.location = (-1.14, 2.10, 0.0); kr.rotation_euler = (0, 0, math.radians(98))
            kp['hips'].rotation_euler = (0.06, 0, 0)
            kp['torso'].rotation_euler = (0.42, 0, 0)
            # the head comes upright from the wrong way, little by little
            kp['neck'].rotation_euler = (-0.05, 0.25 * (1 - k), 0); kp['head'].rotation_euler = (-0.30, 1.15 - 1.0 * k, 0.05)
            face.set(jaw=0.10 + 0.25 * ss(f, 118, 134), wide=1.0, pitch=0.05)
            fill.data.energy = 7.0
            for s in (1, -1):
                A.hand[s].pose(RELAX)
                A.arm(s, A.W(kr) @ rigid((s * 0.22, -0.1, 0.75), hand_rot((0, -0.1, -1), (-s, 0.1, 0))), None)
                A.leg(s, A.W(kr) @ V((s * 0.085, 0.03, 0.07)), A.W(kr).to_3x3(), A.W(kr).to_3x3() @ V((0, -1, 0)))
    lib.FRAME_FNS.append(upd)
    for a, b in (B1, B2, B3):
        EVENTS.append({'f': a, 'kind': 'blink', 'vol': 1, 'pan': 0, 'dur': (b - a) / 24, 'to': b})
    ev(B1[0], 'board', 1.0, -0.2); ev(B2[0], 'board', 1.2, 0.0); ev(104, 'neck', 0.9, 0.0); ev(B3[0], 'board', 0.6, 0.0)
    lib.register_frames()
    return sc


@shot(exposure=1.15)  # auto=3.6
def O4(out, preview):
    N = 198
    sc = begin(N, out, preview, origin=(-0.34, 0.15, 1.15), pos_lo=(-4, -3, -1), pos_size=10.0)
    # the camera that watched her put it there
    c0, c1 = V((-0.06, -0.86, 1.40)), V((-0.2, -0.78, 1.37))
    cam, tgt = camera(38, (c0, (-0.37, 0.2, 1.235)), (c1, (-0.36, 0.2, 1.23)), N, fstop=5.6)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, outside_snow=False, candle_lit=False, **TABLE)
    window_low()
    bpy.data.objects.remove(bpy.data.objects['fogbox'])
    mats = M()
    k = light('SPOT', 'coldkey', (-0.62, -0.55, 1.80), 5.5, color=(0.66, 0.76, 1.0), size=0.10, spot=math.radians(26)); aim(k, SILL + V((0, 0, 0.16)))
    bpy.data.objects['fill'].data.energy = 0.0; bpy.data.objects['moonwin'].data.energy = 2.5
    [n for n in sc.world.node_tree.nodes if n.type == 'BACKGROUND'][0].inputs['Strength'].default_value = 0.0      # nothing shows behind it until it is there
    R['glass'].data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.05
    R['glass'].hide_render = True                              # the light lay on the pane like a lamp
    d, dp = R['doll'], R['dparts']
    d.location = SILL; bpy.context.view_layer.update()
    ring_tube('redloop', d)
    lib.tube('redline', sill_line(d), 0.0016, mats['red'])
    kr, kp = lib.knitter('knitter', (-0.21, 0.62, 0.0), mats, seated=False)
    A = actor(kr, kp); face = Face(kp); kr.rotation_euler = (0, 0, -0.16)
    T_IN, T_HAND, T_SAY = 22, 92, 100
    env = voice_env('home')
    fl = light('AREA', 'facelight', (0.30, -0.10, 1.66), 0.0, color=(0.7, 0.8, 1.0), size=0.15); aim(fl, (-0.22, 0.32, 1.38))
    light_keys(fl, [(1, 0), (30, 0), (78, 5.0), (N - 18, 5.0), (N - 6, 0)])
    where = lambda f: rigid(SILL, (0, 0, 0))
    gh = A.hand[-1].grasp(sd_doll(('head',)), hand_rot((0.35, -1, -0.25), (0.25, 0.0, -1)), (-0.012, 0.012, 0.325), close=(0.9, 0.7), thumb=((0.3, 0.4, 0), (0.0, 0.3, 0)))
    HH = Hold(A, -1, gh, where, rigid((-0.46, 0.66, 0.95), hand_rot((0.1, -0.5, -0.8), (0.4, 0, -0.4))), (42, T_HAND - 9, T_HAND, T_HAND + 6), back=0.05, pole=(-0.9, 0.35, -0.4),
              via=rigid(V((-0.66, 0.42, 1.5)), hand_rot((0.3, -1, -0.1), (0.2, 0, -1))), rest_pose=OPEN)
    gb = hold_doll(A, 1)
    HB = Hold(A, 1, gb, where, rigid((-0.12, 0.56, 1.0), hand_rot((0.1, -0.6, -0.6), (-0.6, 0.2, 0))), (50, T_HAND + 8, T_HAND + 18, T_HAND + 26), back=0.05, pole=(0.6, 0.45, -0.8), rest_pose=OPEN)

    def upd(f):
        i = ss(f, T_IN, 84)
        say = env[int(f - T_SAY)] if 0 <= f - T_SAY < len(env) else 0.0
        us = ss(f, 160, 168)                                     # it looks up from the doll, at the window
        kp['hips'].rotation_euler = (0.02 + 0.08 * i, 0, 0)
        kp['torso'].rotation_euler = (0.10 + 0.40 * i + 0.01 * math.sin(f * 0.1), 0, -0.02)
        kp['neck'].rotation_euler = (0.05, 0.10 * i, 0)
        A.look(SILL + V((0, 0, 0.30)), amount=1.0)
        e = kp['head'].rotation_euler
        a = Euler(e)
        A.look(V((-0.16, -0.78, 1.40)), limit=0.9)
        b = kp['head'].rotation_euler
        kp['head'].rotation_euler = (a.x + (b.x - a.x) * us + 0.03 * say, 0.16 * i * (1 - us) + 0.0, a.z + (b.z - a.z) * us)
        face.set(jaw=min(1.0, 0.75 * say), pitch=-0.15 * (1 - us), wide=0.9 * us)
        hld = ss(f, T_HAND + 10, T_HAND + 20)
        dp['arm1'].rotation_euler = (-0.15 * hld, -(0.35 + 0.95 * hld), 0); dp['arm-1'].rotation_euler = (0, 0.35, 0)
        dp['tuft'].rotation_euler = (0.5 * ss(f, T_HAND - 2, T_HAND + 4), 0, 0)
        HH.set(f); HB.set(f)
    lib.FRAME_FNS.append(upd)
    report(A, [HH], where, sd_doll(('head',))); report(A, [HB], where, sd_doll(('body',)))
    ev(30, 'board', 0.5, 0.0)
    ev(T_HAND, 'pat', 0.9, 0.0); ev(T_HAND + 18, 'take', 0.7, 0.0)
    EVENTS.append({'f': T_SAY, 'kind': 'voice', 'name': 'home', 'vol': 1.0, 'pan': 0.0, 'dur': 2.2})
    ev(161, 'neck', 0.35, 0.0)
    lib.register_frames()
    return sc


class Walkers:
    """a great many people walking, each planting real steps: one mesh, moved by numpy"""
    def __init__(self, name, paths, n, v=0.62, L=0.34, seed=3, spread=0.4, gap=0.9, height=None, edge=None, scale=1.0, start=0.0, mats=None):
        rng = np.random.default_rng(seed)
        self.v, self.edge, self.hf = v, edge, height
        self.P = [act.Path(p) for p in paths]
        who = []
        for pi, P in enumerate(self.P):
            s = start - rng.random() * gap
            for k in range(n):
                who.append((pi, s, rng.normal(0, spread), rng.random(), scale * (0.88 + 0.2 * rng.random()), L * (0.9 + 0.2 * rng.random())))
                s -= gap * (0.55 + 0.9 * rng.random())
        self.pi = np.array([w[0] for w in who]); self.s0 = np.array([w[1] for w in who]); self.off = np.array([w[2] for w in who]); self.ph = np.array([w[3] for w in who])
        self.sc = np.array([w[4] for w in who]); self.L = np.array([w[5] for w in who])
        self.n = len(who)
        # a template: gown, head, hair, arms; legs are put in by hand
        T, F, C = [], [], []
        def ring(z, rx, ry, y0, m=9):
            b = len(T)
            for i in range(m):
                a = i / m * math.tau; T.append((math.cos(a) * rx, math.sin(a) * ry + y0, z))
            return b
        def tube(levels, m=9):
            bs = [ring(*l, m) for l in levels]
            for a, b in zip(bs, bs[1:]):
                for i in range(m):
                    F.append((a + i, a + (i + 1) % m, b + (i + 1) % m, b + i))
            F.append(tuple(bs[0] + i for i in range(m))[::-1]); F.append(tuple(bs[-1] + i for i in range(m)))
        tube([(0.30, 0.22, 0.19, 0.0), (0.62, 0.18, 0.15, 0.0), (0.95, 0.15, 0.12, -0.01), (1.22, 0.17, 0.11, -0.03), (1.33, 0.13, 0.09, -0.04), (1.38, 0.05, 0.05, -0.05)])
        nb = len(T); self.body = (0, nb)
        tube([(1.36, 0.045, 0.045, -0.06), (1.42, 0.075, 0.085, -0.09), (1.52, 0.085, 0.10, -0.10), (1.60, 0.05, 0.06, -0.10)], 8)
        self.head = (nb, len(T)); nh = len(T)
        for sd in (-1, 1):
            for (z, x, y) in ((1.28, 0.175, -0.03), (1.02, 0.21, -0.04), (0.78, 0.20, -0.08)):
                ring(z, 0.038, 0.038, y, 6)
                for i in range(len(T) - 6, len(T)):
                    T[i] = (T[i][0] + sd * x, T[i][1], T[i][2])
            b = len(T) - 18
            for r in (0, 1):
                for i in range(6):
                    F.append((b + r * 6 + i, b + r * 6 + (i + 1) % 6, b + r * 6 + 6 + (i + 1) % 6, b + r * 6 + 6 + i))
        self.arm = (nh, len(T)); nl = len(T)
        for sd in (-1, 1):                                        # legs: knee-long boxes, hip to foot (moved every frame)
            b = len(T)
            for q in range(8):
                T.append((0, 0, 0))
            for fc in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
                F.append(tuple(b + i for i in fc))
        self.T = np.array(T, float); self.nl = nl; m = len(T); self.m = m
        faces = [tuple(i + k * m for i in f) for k in range(self.n) for f in F]
        me = bpy.data.meshes.new(name); me.from_pydata(np.zeros((self.n * m, 3)).tolist(), [], faces); me.update()
        for pl in me.polygons:
            pl.use_smooth = True
        self.o = lib.link(bpy.data.objects.new(name, me)); me.materials.append(mats or lib.mat('gown', (0.72, 0.72, 0.74), rough=0.9))
        lib.FRAME_FNS.append(self.set)

    def where(self, s):
        xy = np.zeros((self.n, 2)); d = np.zeros((self.n, 2))
        for pi, P in enumerate(self.P):
            q = self.pi == pi
            if q.any():
                ss_ = s[q]
                for out_, sx in ((xy, ss_), ):
                    x = np.interp(sx, P.s, P.p[:, 0]); y = np.interp(sx, P.s, P.p[:, 1])
                    d0 = P.p[1] - P.p[0]; d0 = d0 / np.linalg.norm(d0)
                    neg = sx < 0
                    x = np.where(neg, P.p[0, 0] + d0[0] * sx, x); y = np.where(neg, P.p[0, 1] + d0[1] * sx, y)
                    out_[q] = np.stack([x, y], 1)
                a = np.stack([np.interp(ss_ + 0.15, P.s, P.p[:, 0]) - np.interp(ss_ - 0.15, P.s, P.p[:, 0]), np.interp(ss_ + 0.15, P.s, P.p[:, 1]) - np.interp(ss_ - 0.15, P.s, P.p[:, 1])], 1)
                a = np.where((ss_ < 0.2)[:, None], d0[None], a)
                d[q] = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-9)
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        return xy + nrm * self.off[:, None], d, nrm

    def steps(self, cam, f0, f1, near, every=1.0):
        """the frames on which feet come down within `near` metres of the camera: (frame, pan, loudness), no two closer than `every`"""
        out = []
        for i in range(self.n):
            for k in (0, 0.5):
                a, b = [(self.s0[i] + self.v * (f - 1) / 24) / (2 * self.L[i]) + self.ph[i] + k for f in (f0, f1)]
                for m in range(math.ceil(a), math.floor(b) + 1):
                    f = f0 + (f1 - f0) * (m - a) / (b - a)
                    xy, d, n_ = self.where(self.s0 + self.v * (f - 1) / 24)
                    if self.edge is not None and self.edge(xy[i:i + 1, 0], xy[i:i + 1, 1])[0] > -0.1:
                        continue
                    r = math.hypot(xy[i, 0] - cam[0], xy[i, 1] - cam[1])
                    if r < near:
                        out.append((f, max(-0.8, min(0.8, (xy[i, 0] - cam[0]) / r * 1.0)), min(1.0, 8.0 / r)))
        out.sort(); r = []
        for q in out:
            if not r or q[0] - r[-1][0] >= every:
                r.append(q)
        return r

    def set(self, f):
        t = (f - 1) / 24
        s = self.s0 + self.v * t
        xy, d, nrm = self.where(s)
        z = self.hf(xy[:, 0], xy[:, 1])
        fall = np.zeros(self.n)
        if self.edge is not None:
            e = self.edge(xy[:, 0], xy[:, 1])                     # metres past the edge (negative: still on the snow)
            tf = np.clip(e / self.v, 0, None); fall = 4.9 * tf ** 2
            z = np.where(e > 0, np.where(np.isfinite(z), z, 0), z) - fall
        ph = (s / (2 * self.L) + self.ph) % 1.0
        bob = -0.018 * np.abs(np.cos(2 * np.pi * ph)); sway = 0.025 * np.sin(2 * np.pi * ph)
        T = np.repeat(self.T[None], self.n, 0)
        # arms hang and barely swing; heads bowed; a lean
        sw = 0.10 * np.sin(2 * np.pi * ph)
        a0, a1 = self.arm
        mid = (a0 + a1) // 2
        for lo, hi, sg in ((a0, mid, 1), (mid, a1, -1)):
            T[:, lo:hi, 1] += (1.28 - T[:, lo:hi, 2]) * (sw * sg)[:, None]
        lean = 0.06
        T[:, :self.nl, 1] -= (T[:, :self.nl, 2] - 0.3) * lean
        T[:, self.head[0]:self.head[1], 1] -= 0.05; T[:, self.head[0]:self.head[1], 2] -= 0.03
        T[:, :self.nl, 2] += bob[:, None]; T[:, :self.nl, 0] += sway[:, None]
        for k, sd in enumerate((-1, 1)):
            p = (ph + (0.5 if sd > 0 else 0.0)) % 1.0
            stance = p < 0.5
            u = (p - 0.5) / 0.5
            su = u * u * (3 - 2 * u)
            rel = np.where(stance, 0.5 - 2 * p, -0.5 + su)
            fy = -rel * self.L / self.sc                          # forward is -y
            fz = np.where(stance, 0.0, 0.09 * np.sin(np.pi * np.clip(u, 0, 1)))
            b = self.nl + k * 8
            for q, (dx, dy) in enumerate(((-0.05, -0.05), (0.05, -0.05), (0.05, 0.05), (-0.05, 0.05))):
                T[:, b + q] = np.stack([sd * 0.09 + dx + sway, dy + 0 * fy, np.full(self.n, 0.55) + bob], 1)
                T[:, b + 4 + q] = np.stack([np.full(self.n, sd * 0.08 + dx * 0.8), fy + dy * 1.5 - 0.02, fz], 1)
        tip = np.clip(fall * 0.5, 0, 1.3)
        c, si = np.cos(tip)[:, None], np.sin(tip)[:, None]
        y_, z_ = T[:, :, 1].copy(), T[:, :, 2].copy()
        T[:, :, 1] = y_ * c - z_ * si; T[:, :, 2] = y_ * si + z_ * c
        T *= self.sc[:, None, None]
        # local +x → her left of the way; local -y → forward
        X = T[:, :, 0:1] * nrm[:, :2][:, None]
        Y = -T[:, :, 1:2] * d[:, None]
        out_ = np.empty((self.n, self.m, 3))
        out_[:, :, :2] = xy[:, None] + X + Y
        out_[:, :, 2] = T[:, :, 2] + np.nan_to_num(z)[:, None]
        me = self.o.data
        me.vertices.foreach_set('co', out_.reshape(-1).astype(np.float32)); me.update()


@shot(exposure=1.0)  # auto=1.6
def O5(out, preview):
    N = 228
    sc = begin(N, out, preview, origin=(0, 6, 8), pos_lo=(-120, -20, -30), pos_size=260.0)
    sc.eevee.volumetric_end = 10
    lib.world(sc, top=(0.010, 0.013, 0.02), horizon=(0.035, 0.04, 0.055), strength=1.0)
    light('SUN', 'moon', (0, 0, 20), 0.75, color=(0.7, 0.78, 1.0), size=math.radians(1.5), rot=(math.radians(55), 0, math.radians(-38)))
    mats = M()
    cam, tgt = camera(32, ((1.5, -7.0, 10.15), (1.3, 12, 8.35)), ((-0.6, -7.0, 10.15), (-0.8, 12, 8.35)), N)
    # a brow of snow in front, the valley below it, hills behind
    xs = np.concatenate([np.arange(-120, -30, 2.0), np.arange(-30, 30, 0.5), np.arange(30, 122, 2.0)]); ys = np.concatenate([np.arange(-9, 12, 0.35), np.arange(12, 70, 1.0), np.arange(70, 232, 2.5)])
    X, Y = np.meshgrid(xs, ys)
    def H(x, y):
        fl = sets._fbm(x, y, 4, 1) * 0.35
        brow = 8.3 - 0.0 * y
        k = 1 / (1 + np.exp(-(y - 14 - 1.5 * np.sin(x * 0.08)) / 5.0))
        val = -7 + 0.012 * (x * 0.6) ** 2 * 0.4 + fl * 2 + 0.02 * np.clip(y - 60, 0, 99)
        hill = np.clip((y - 110) / 90, 0, 1) ** 1.5 * (30 + 9 * np.sin(x * 0.045 + 1) + 6 * np.sin(x * 0.11) + 13 * np.abs(sets._fbm(x * 1.2, y * 0.9, 5, 7)) + 5 * np.abs(sets._fbm(x * 4, y * 3, 3, 4))) + np.clip((np.abs(x) - 50) / 60, 0, 1) ** 2 * 20
        return brow * (1 - k) + val * k + hill * k + sets._fbm(x * 2, y * 2, 3, 2) * 0.06
    Z = H(X, Y)
    nx, ny = len(xs), len(ys)
    ii = np.arange(nx * ny).reshape(ny, nx)
    quads = np.stack([ii[:-1, :-1], ii[:-1, 1:], ii[1:, 1:], ii[1:, :-1]], -1).reshape(-1, 4)
    lib.mesh_obj('ground', np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1).tolist(), quads.tolist(), mats['snow'], smooth=True)
    # the village: houses along lanes, the church among them
    rng = np.random.default_rng(9)
    hv, hf, rv, rf, wv, wf, wt = [], [], [], [], [], [], []
    houses = []
    tries = 0
    while len(houses) < 210 and tries < 9000:
        tries += 1
        x = rng.normal(0, 24); y = 44 + abs(rng.normal(0, 22))
        if abs(x) > 58 or y > 112:
            continue
        lane = math.sin(x * 0.16 + y * 0.05) * 5 + (y % 11) - 5.5
        if abs(lane) < 0.9 or any((x - a) ** 2 + (y - b) ** 2 < 16 for a, b, *_ in houses):
            continue
        houses.append((x, y, rng.uniform(-0.5, 0.5), 1.3 + 0.7 * rng.random(), 1.0 + 0.5 * rng.random(), 1.5 + 0.5 * rng.random()))
    houses.append((6.0, 62.0, 0.2, 1.8, 2.6, 2.4))
    for (x, y, a, w, d_, hgt) in houses:
        z = float(H(np.array(x), np.array(y))) - 0.15
        R3 = Matrix.Rotation(a, 3, 'Z')
        pt = lambda u, v, q: tuple(V((x, y, z)) + R3 @ V((u, v, q)))
        b = len(hv)
        hv += [pt(-w, -d_, 0), pt(w, -d_, 0), pt(w, d_, 0), pt(-w, d_, 0), pt(-w, -d_, hgt), pt(w, -d_, hgt), pt(w, d_, hgt), pt(-w, d_, hgt), pt(-w, 0, hgt + d_ * 0.9), pt(w, 0, hgt + d_ * 0.9)]
        hf += [(b, b + 1, b + 5, b + 4), (b + 1, b + 2, b + 6, b + 9, b + 5), (b + 2, b + 3, b + 7, b + 6), (b + 3, b, b + 4, b + 8, b + 7)]
        b = len(rv); o = 0.22
        rv += [pt(-w - o, -d_ - o, hgt - o * 0.7), pt(w + o, -d_ - o, hgt - o * 0.7), pt(w + o, 0, hgt + d_ * 0.9 + 0.18), pt(-w - o, 0, hgt + d_ * 0.9 + 0.18), pt(w + o, d_ + o, hgt - o * 0.7), pt(-w - o, d_ + o, hgt - o * 0.7)]
        rf += [(b, b + 1, b + 2, b + 3), (b + 3, b + 2, b + 4, b + 5)]
        dist = math.hypot(x, y - 10)
        t_off = 34 + 120 * np.clip((dist - 34) / 74, 0, 1) ** 0.85 + rng.normal(0, 5)
        for (u, q) in ((-0.5 * w, 0.75), (0.5 * w, 0.75)):
            if rng.random() < 0.12:
                continue
            b = len(wv); e = 0.30
            wv += [pt(u - e, -d_ - 0.03, q - 0.25 + 0.2), pt(u + e, -d_ - 0.03, q - 0.25 + 0.2), pt(u + e, -d_ - 0.03, q + 0.65), pt(u - e, -d_ - 0.03, q + 0.65)]
            wf.append((b, b + 1, b + 2, b + 3)); wt += [float(t_off + rng.normal(0, 3))] * 4
    lib.mesh_obj('vh', hv, hf, mats['log']); rr = lib.mesh_obj('vr', rv, rf, mats['snow']); sd = rr.modifiers.new('s', 'SOLIDIFY'); sd.thickness = 0.16
    cx, cy = 6.0, 59.6; cz = float(H(np.array(cx), np.array(cy)))
    prim('cube', 'tower', loc=(cx, cy, cz + 2.6), scale=(0.8, 0.8, 2.8), material=mats['stone']); prim('cone', 'spire', loc=(cx, cy, cz + 7.3), scale=(1.25, 1.25, 1.9), material=mats['snow'], vertices=4, rot=(0, 0, 0.785))
    wm = bpy.data.materials.new('vwin'); wm.use_nodes = True; nt = wm.node_tree; nt.nodes.clear()
    out_ = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (1.0, 0.62, 0.28, 1)
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = 'toff'
    val = nt.nodes.new('ShaderNodeValue'); node_keys(val.outputs[0], [(1, 1.0), (N, float(N))])
    for fc in nt.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = 'LINEAR'
    gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; nt.links.new(at.outputs['Fac'], gt.inputs[0]); nt.links.new(val.outputs[0], gt.inputs[1])
    mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = 5.0; nt.links.new(gt.outputs[0], mu.inputs[0]); nt.links.new(mu.outputs[0], em.inputs['Strength']); nt.links.new(em.outputs[0], out_.inputs['Surface'])
    cb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(gt.outputs[0], cb.inputs['Z'])
    lib._aov(nt, out_, cb.outputs[0])
    w_ = lib.mesh_obj('vwins', wv, wf, wm); atr = w_.data.attributes.new('toff', 'FLOAT', 'POINT'); atr.data.foreach_set('value', np.array(wt, np.float32))
    # trees
    bark = lib.mat('bark', (0.05, 0.045, 0.04), rough=0.95)
    for i, (x, y, hh_) in enumerate([(-9, 9, 6.5), (11, 8, 5.5)]):
        lib.bare_tree(f'tree{i}', (x, y, float(H(np.array(x), np.array(y)))), hh_, 41 + i, bark)
    # what calls them
    kr, kp = lib.knitter('knitter', (0, 0, 0), mats, seated=False)
    A = actor(kr, kp)
    kx, ky = 2.35, 0.6
    gz = float(H(np.array(kx), np.array(ky)))
    kr.location = (kx, ky, gz); kr.rotation_euler = (0, 0, math.pi - 0.25)
    lib.stick(kr, kr)
    env = voice_env('call')
    SAY = 14
    g_ = {s: None for s in (1, -1)}

    def upd(f):
        e = env[int(f - SAY)] if 0 <= f - SAY < len(env) else 0.0
        kp['hips'].rotation_euler = (0.04, 0, 0)
        kp['torso'].rotation_euler = (0.16 - 0.10 * e + 0.02 * math.sin(f * 0.08), 0, 0.05 * math.sin(f * 0.05))
        kp['neck'].rotation_euler = (0.0 - 0.10 * e, 0.12, 0); kp['head'].rotation_euler = (-0.06 - 0.14 * e, 0.16, 0.25 * math.sin(f * 0.035))
        W = A.W(kr)
        H_m = A.W(kp['head'])
        for s in (1, -1):
            A.hand[s].pose({'f': [(0.22, 0.2, 0.0)] * 4, 't': ((0.2, 0.1, 0), (0, 0.1, 0))})
            up_ = ss(f, -4, 10) * (1 - ss(f, 128, 152))
            m = H_m @ rigid((s * 0.085, -0.135, -0.015), hand_rot((-s * 0.1, -0.45, 1), (-s, 0.25, 0)))
            m = Matrix.Translation((H_m.to_3x3() @ V((0, 0, -0.10)))) @ m
            rest = W @ rigid((s * 0.24, -0.08, 0.80), hand_rot((0, -0.1, -1), (-s, 0.1, 0)))
            A.arm(s, mlerp(rest, m, up_), W.to_3x3() @ V((s * 0.8, 0.2, -0.6)))
            A.leg(s, W @ V((s * 0.085, 0.03, 0.07)), W.to_3x3(), W.to_3x3() @ V((0, -1, 0)))
    lib.FRAME_FNS.append(upd)
    # when the last light has gone, they come up the road
    road = [(-26, 64), (-14, 50), (-4, 40), (-9, 30), (-3, 22), (-5, 15), (-2.5, 9), (-3.2, 3), (-4.6, -4)]
    Wk = Walkers('people', [road], 90, v=1.3, gap=0.42, spread=1.0, seed=5, height=lambda x, y: H(x, y), start=62.0, mats=lib.mat("gowndark", (0.06, 0.06, 0.065), rough=0.95))
    Wk.o.hide_render = True; Wk.o.keyframe_insert('hide_render', frame=1)
    Wk.o.hide_render = False; Wk.o.keyframe_insert('hide_render', frame=84)
    for f, pan, g in Wk.steps((0.5, -7.0), 100, N, 17.0, 3.0):
        ev(f, 'bare_snow', 0.55 * g * ss(f, 100, 150), pan)
    EVENTS.append({'f': SAY, 'kind': 'voice', 'name': 'call', 'vol': 0.9, 'pan': 0.15, 'dur': 4.9, 'echo': 1})
    ts = sorted(set(round(t) for t in wt))
    for k, t in enumerate(ts[::7]):
        if t < N:
            ev(t, 'shutter', 0.35, float(rng.uniform(-0.6, 0.6)))
    lib.register_frames()
    return sc


@shot(exposure=1.0)  # auto=1.15
def O6(out, preview):
    N = 180
    sc = begin(N, out, preview, origin=(21, 3, 0))
    cx, cy, rx, ry = sets.PIT
    ca, cb = V((20.5, -14.0, 8.2)), V((24.6, -14.0, 8.2))
    cam, tgt = camera(30, (ca, ca + V((1.6, 16, -6.6))), (cb, cb + V((1.6, 16, -6.6))), N)
    sets.exterior(sc, cam, tgt, storm=False, window_glow=0.0, interior=False, window_alpha=0.3)
    no_smoke()
    h = ground_h()
    hh = lambda x, y: float(h(np.array([x]), np.array([y]))[0])
    snow_rim(hh)
    e_ = lambda x, y: np.hypot((x - cx) / rx, (y - cy) / ry)
    edge = lambda x, y: (1.02 - e_(x, y)) * 6.3
    rng = np.random.default_rng(11)
    paths = []
    for k in range(17):
        a = k / 17 * math.tau + rng.uniform(-0.14, 0.14); bend = rng.uniform(-0.7, 0.7)
        p = []
        for r in np.linspace(4.6, 0.25, 12):
            an = a + bend * (r - 1) / 3.6
            p.append((cx + math.cos(an) * rx * r, cy + math.sin(an) * ry * r))
        paths.append(p)
    W = Walkers('people', paths, 34, v=0.62, gap=1.15, spread=0.30, seed=8, height=lambda x, y: h(x, y), edge=edge, start=26.5)
    # the snow trodden where they come
    tm = lib.mat('trod', (0.42, 0.45, 0.52), rough=0.9)
    for k, p in enumerate(paths):
        P = act.Path(p); vs, fs = [], []
        m = 120
        for j in range(m):
            s = P.len * j / (m - 1); c = P.at(s); d = P.dir(s); nrm = np.array([-d[1], d[0]])
            if e_(c[0], c[1]) < 1.06:
                break
            for q in (-1, -0.33, 0.33, 1):
                w = 0.42 + 0.14 * math.sin(j * 1.7 + k + q * 2)
                x, y = c + nrm * q * w
                vs.append((x, y, hh(x, y) + 0.012 - 0.0 * abs(q)))
        n = len(vs) // 4
        for j in range(n - 1):
            for q in range(3):
                i = j * 4 + q; fs.append((i, i + 1, i + 5, i + 4))
        lib.mesh_obj(f'trod{k}', vs, fs, tm, smooth=True)
    for f, pan, g in W.steps(ca.lerp(cb, 0.5), 1, N, 24.0, 2.5):
        ev(f, 'bare_snow', 0.75 * g, pan)
    lib.register_frames()
    return sc


@shot(exposure=0.8)  # auto=7.0
def O7(out, preview):
    N = 156
    sc = begin(N, out, preview, origin=(-0.34, 0.15, 1.1), pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = camera(50, ((0.03, 1.62, 1.30), (-0.31, 0.12, 1.12)), ((-0.16, 1.18, 1.22), (-0.33, 0.12, 1.13)), N, fstop=2.8)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, candle_lit=False, outside_snow=False, **TABLE)
    bpy.data.objects.remove(bpy.data.objects['fogbox'])
    mats = M()
    d, dp = R['doll'], R['dparts']
    d.location = SILL; bpy.context.view_layer.update()
    ring_tube('redloop', d)
    base = sill_line(d)
    line = lib.tube('redline', base, 0.0016, mats['red'])
    b = [n for n in R['glass'].data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    IN, OUT = 62, 92                                                # something breathes in behind us, and out
    node_keys(b.inputs['Alpha'], [(1, 0.12), (OUT + 4, 0.12), (OUT + 34, 0.5), (N, 0.46)])
    node_keys(b.inputs['Emission Strength'], [(1, 0.03), (OUT + 4, 0.03), (OUT + 34, 0.2), (N, 0.16)])
    for nm, e in (('moonwin', None), ('fill', None)):
        o = bpy.data.objects[nm]; v = o.data.energy
        light_keys(o, [(1, v), (124, v), (150, 0.0)])
    TUG = [20, 44]

    def upd(f):
        k = tug(f, TUG, 2.0, 12.0)
        breath = -0.28 * ss(f, IN, IN + 20) * (1 - ss(f, OUT - 4, OUT + 4)) + 0.55 * ss(f, OUT, OUT + 8) * (1 - ss(f, OUT + 14, OUT + 40))
        dp['tuft'].rotation_euler = (breath + 0.05 * math.sin(f * 0.8) * abs(breath) + 0.25 * k, 0, 0)
        d.rotation_euler = (-0.035 * k, 0, 0.0)                     # pulled, it leans back and is let go; its feet stay
        dp['headpiv'].rotation_euler = (-0.05 * k, 0, 0.0)
        for s in (-1, 1):
            dp[f'arm{s}'].rotation_euler = (-0.5 if s == 1 else 0, -s * (0.35 - 0.2 * (s == 1)), 0)
        pts = []
        for i, q in enumerate(base):
            u = i / (len(base) - 1)
            pts.append(q + V((0, -0.004 * k * (1 - u), 0.010 * k * math.sin(math.pi * min(1, u * 2.4)) if u < 0.42 else 0)))
        lib.tube_update(line, pts)
    lib.FRAME_FNS.append(upd)
    for t in TUG:
        ev(t, 'thread_taut', 0.9, 0.0)
    ev(IN, 'breath_in', 1.0, 0.0); ev(OUT, 'breath_out', 0.8, 0.0)
    lib.register_frames()
    return sc


# ── on all fours ───────────────────────────────────────────────────────────
class Crawler:
    """the knitter's body on hands and feet along a surface, belly to it. surf(s, off) -> (point, normal, the way on): where the
    surface is, s metres along the way and off metres to its right. Hands and feet are planted and stay until they lift; diagonal
    pairs move together. At s = k * L (+ 0.1 L) all four are down"""
    def __init__(self, kr, kp, surf, L=0.26, height=0.235, hand=(0.345, 0.235), foot=(-0.30, 0.34)):
        self.kr, self.kp, self.surf, self.L, self.h, self.hd, self.ft = kr, kp, surf, L, height, hand, foot
        self.A = actor(kr, kp); self.face = Face(kp)
        self.limbs = {('h', 1): 0.0, ('f', -1): 0.0, ('h', -1): 0.5, ('f', 1): 0.5}
        self.D = 0.6
        lib.stick(kr, kr)

    def rest(self, s):
        """the nearest place at or after s with everything down"""
        return (math.ceil(s / self.L - 0.1) + 0.1) * self.L

    def place(self, key, s):
        """(point, normal, way on) of a hand or foot, and how far it is lifted"""
        c, off = self.hd if key[0] == 'h' else self.ft
        L2 = 2 * self.L
        x = s / L2 + self.limbs[key]
        k = math.floor(x); fr = x - k
        at = lambda k: self.surf(L2 * (k - self.limbs[key]) + c + self.L * self.D, -key[1] * off)
        p, n, t = at(k)
        if fr <= self.D:
            return p, n, t, 0.0
        u = ss(fr, self.D, 1.0)
        p1, n1, t1 = at(k + 1)
        lift = math.sin(math.pi * u) * (0.11 if key[0] == 'h' else 0.07)
        n2 = n.lerp(n1, u).normalized()
        return p.lerp(p1, u) + n2 * lift, n2, t.lerp(t1, u).normalized(), lift

    def set(self, s, look=None, amount=1.0, jaw=0.0, still=0.0, bob=1.0, f=0.0):
        A, kp = self.A, self.kp
        P = V((0, 0, 0)); N = V((0, 0, 0)); T = V((0, 0, 0))
        for q in (-0.3, -0.1, 0.1, 0.3, 0.5):                  # the body rides over what its hands are on
            p, n, t = self.surf(s + q, 0.0); P += p - t * q; N += n; T += t
        P /= 5; N.normalize(); T.normalize()
        x = s / (2 * self.L)
        yaw = 0.10 * math.sin(2 * math.pi * x) * bob
        T = (T - N * T.dot(N)).normalized(); R = T.cross(N)
        T = (T * math.cos(yaw) + R * math.sin(yaw)).normalized(); R = T.cross(N)
        M = Matrix((-R, N, T)).transposed()                    # her left, her back, the way her head points
        hips = P + N * (self.h + 0.02 * math.sin(4 * math.pi * x) * bob + 0.008 * math.sin(f * 0.13))
        self.kr.rotation_euler = M.to_euler()
        self.kr.location = hips - M @ A.hips0
        kp['hips'].rotation_euler = (0, 0, 0)
        kp['torso'].rotation_euler = (-0.06, 0.10 * math.sin(2 * math.pi * x) * bob, 0)
        kp['neck'].rotation_euler = (-0.55, 0, 0); kp['head'].rotation_euler = (-0.45, 0, 0)
        for _ in range(4):                                     # on broken rock a hold can be past its reach: the body leans to it
            shift = V((0, 0, 0))
            for sd in (1, -1):
                p, n, t, lift = self.place(('h', sd), s)
                out = t.cross(n) * -sd
                fd = (t * 0.92 + out * 0.38 - n * 0.06).normalized()
                sh = kp[f'sh{sd}']; S = (A.W(sh.parent) @ Matrix.Translation(sh.location)).translation
                D = (p + n * 0.034 - fd * 0.07) - S
                e = D.length - (kp['L1'] + kp['L2']) * 0.985
                if e > 0:
                    shift += D.normalized() * e
            if shift.length < 1e-5:
                break
            self.kr.location += shift
        if look is not None and amount > 0:                   # the head comes back over its own shoulders, as far as it needs to
            h = kp['head']; rest = Euler(h.rotation_euler).to_quaternion()
            kp['neck'].rotation_euler = (-0.55 - 0.40 * amount, 0, 0)
            b = Euler((-1.15, 0, 0)); h.rotation_euler = b
            H = A.W(h); d = H.to_3x3().inverted() @ (V(look) - (H.translation + H.to_3x3() @ V((0, -0.04, 0.06))))
            c_ = lambda x, l: max(-l, min(l, x))
            q = (b.to_matrix() @ Matrix.Rotation(c_(math.atan2(d.x, -d.y), 1.1), 3, 'Z') @ Matrix.Rotation(c_(math.atan2(-d.z, math.hypot(d.x, d.y)), 0.8), 3, 'X')).to_quaternion()
            h.rotation_euler = rest.slerp(q, amount).to_euler()
        self.face.set(jaw=jaw, wide=0.8)
        for sd in (1, -1):
            p, n, t, lift = self.place(('h', sd), s)
            r = t.cross(n)                                      # right of the way
            out = r * -sd
            fd = (t * 0.92 + out * 0.38 - n * 0.06).normalized()
            spread = [(0.10 + 0.3 * min(1, lift * 8), 0.10, 0.05)] * 4
            A.hand[sd].pose({'f': spread, 't': ((-0.1, 0.1, 0), (0, 0.1, 0))})
            # the heel of the hand is where the wrist's frame ends: the palm lies on the rock
            A.arm(sd, Matrix.Translation(p + n * 0.034 - fd * 0.07) @ hand_rot(fd, -n).to_4x4(), out * 0.75 + n * 0.8 - t * 0.1)
            p, n, t, lift = self.place(('f', sd), s)
            r = t.cross(n); out = r * -sd
            td = (t * 0.55 + out * 0.85).normalized()
            td = (td - n * td.dot(n)).normalized()
            Rf = Matrix(((-td).cross(n), -td, n)).transposed()
            an = p + n * 0.085 - td * 0.05
            hp = A.W(kp['hips']) @ kp[f'thigh{sd}'].location
            A.leg(sd, an, Rf, (out * 0.9 + n * 0.55 + t * 0.35).normalized(), up=(hp - an).normalized())

    def steps(self, s_of, f0, f1):
        """(frame, key, point) of every time a hand or foot comes down, for a way s_of(frame)"""
        out = []
        for key, o in self.limbs.items():
            last = None
            for q in range(int(f0 * 8), int(f1 * 8)):
                k = math.floor(s_of(q / 8) / (2 * self.L) + o)
                if last is not None and k > last:
                    out.append((q / 8, key, self.surf(2 * self.L * (k - o) + (self.hd if key[0] == 'h' else self.ft)[0] + self.L * self.D, 0)[0]))
                last = k
        return sorted(out, key=lambda q: q[0])


def wall_way(bvh, C, pts):
    """a way over the inside of a cave through (heading, height) angles seen from C (degrees), as a surf for Crawler"""
    d = lambda a, e: V((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
    P = act.Path([(math.radians(a), math.radians(e)) for a, e in pts])
    hit = lambda v: bvh.ray_cast(C, v)
    L3 = [hit(d(*q))[0] for q in P.p]
    L3 = [q for q in L3 if q is not None]
    for _ in range(6):
        L3 = L3[:1] + [(a + b * 2 + c) / 4 for a, b, c in zip(L3, L3[1:], L3[2:])] + L3[-1:]
    arr = np.array(L3); ln = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(arr, axis=0), axis=1))])

    def base(s):
        return V([float(np.interp(s, ln, arr[:, k])) for k in range(3)])

    def nrm(v):
        n = V((0, 0, 0))
        e1 = v.cross(V((0, 0, 1))).normalized(); e2 = v.cross(e1)
        for a, b in ((0, 0), (0.05, 0), (-0.05, 0), (0, 0.05), (0, -0.05)):
            h = hit((v + e1 * a + e2 * b).normalized())
            if h[0] is not None:
                n += h[1] * (1 if h[1].dot(v) < 0 else -1)
        return n.normalized()

    def surf(s, off):
        p = base(s); t = (base(s + 0.15) - base(s - 0.15)).normalized()
        v = (p - C).normalized(); n = nrm(v)
        t = (t - n * t.dot(n)).normalized()
        if off:
            v = (p + t.cross(n) * off - C).normalized()
            h = hit(v)
            if h[0] is not None:
                p = h[0]; n = nrm(v)
                t = (t - n * t.dot(n)).normalized()
        else:
            h = hit(v)
            if h[0] is not None:
                p = h[0]
        return p, n, t
    surf.len = float(ln[-1])
    return surf


# names.ogg: where each name starts (s) and how long it lasts
NAMES = [(0.0, 0.80), (1.47, 0.86), (2.98, 0.74), (4.28, 0.68), (5.82, 0.92), (7.44, 0.77), (8.87, 0.84), (10.41, 0.76), (11.77, 0.68), (13.27, 0.62), (14.76, 0.89), (16.37, 0.68), (17.80, 0.63)]


@shot(exposure=1.0)  # auto=1.2 soft=0.6
def N1(out, preview):
    """after the titles of the bitten ending: the doll on the floor at the bottom, in what light comes down the well; behind it,
    along the walls, what is down there with it goes round and tries the names that are left. The view goes back and back"""
    N = 600
    sc = begin(N, out, preview, origin=(0, 0.3, 0.8), pos_lo=(-12, -12, -2), pos_size=20.0)
    sc.eevee.volumetric_end = 30
    mats = petal_mat()
    lib.world(sc, top=(0, 0, 0), horizon=(0, 0, 0), strength=1.0)
    CA, CB = V((0.12, -3.0, 0.55)), V((0.0, -7.3, 1.10))
    cam, tgt = camera(26, (CA, (0.02, 0, 0.42)), (CB, (0.0, 0, 2.38)), N)
    # the cave: a dome over a floor, long toward us, the well in its roof
    H = 5.3
    vs, fs, drs, dbs = [], [], [], []; seg = 420
    zs = list(np.linspace(-0.5, H, 190)) + list(np.linspace(H + 0.15, 12.0, 60))
    for z in zs:
        for k in range(seg):
            a = k / seg * math.tau
            wob = 0.28 * math.sin(a * 3 + z * 0.8) + 0.2 * math.sin(a * 5 - z * 1.3 + 1) + 0.13 * math.sin(a * 9 + z * 2.1)
            r0 = 3.5 + 5.8 * max(0.0, -math.sin(a)) ** 1.4 + wob
            nk = 0.92 + 0.10 * math.sin(a * 4 + z) + 0.05 * math.sin(a * 9 - z * 2)
            r = nk if z >= H else nk + (r0 - nk) * math.sqrt(max(0.0, 1 - max(0.0, z / H) ** 2.6))
            q = min(1.0, r / 2.0)
            p = V((math.cos(a) * r, math.sin(a) * r, z))
            db = 0.55 * mnoise.fractal(p * 0.32, 0.6, 2.0, 3) * q          # outcrops and hollows, no two alike
            # beds of rock that wander, thicken, thin and give out; each lip breaks off over the one below
            bw = z * 1.5 + 1.1 * mnoise.noise(p * 0.25 + V((3, 1, 7))) + 0.4 * mnoise.noise(p * 0.9)
            fb = bw - math.floor(bw); idx = math.floor(bw)
            ok = max(0.0, min(1.0, 0.5 + 0.9 * mnoise.noise(V((idx * 1.7, a * 1.3, 0.5)))))
            dr = -(0.04 + 0.28 * ok) * fb ** 2.5 * q
            # the beds split into blocks of every size: cracks between them, each block standing out its own way
            dd, pp = mnoise.voronoi(p * 1.1 + V((0, 0, idx * 0.37)), distance_metric='DISTANCE', exponent=2.5)
            dr += -0.14 * max(0.0, 1 - (dd[1] - dd[0]) / 0.12) * q
            dr += 0.13 * mnoise.noise(pp[0] * 3.1) * q
            vs.append((math.cos(a) * r, math.sin(a) * r, z)); drs.append(dr); dbs.append(db)
    for j in range(len(zs) - 1):
        for k in range(seg):
            a, b = j * seg + k, j * seg + (k + 1) % seg
            fs.append((a, a + seg, b + seg, b))
    deep = mats['rock'].copy(); deep.name = 'rockcave'
    [n for n in deep.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0].inputs['Base Color'].default_value = (0.035, 0.033, 0.036, 1)
    w = lib.mesh_obj('cavewall', vs, fs, deep, smooth=True)
    lib.displace(w, 0.34, 0.9)
    pale = mats['rock'].copy(); pale.name = 'rockfloor'          # grit and dust: lighter than the walls, so the little light shows on it
    [n for n in pale.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0].inputs['Base Color'].default_value = (0.09, 0.085, 0.09, 1)
    fl = prim('plane', 'cavefloor', loc=(0, -2, 0), scale=(8, 9, 1), material=pale)
    lib.displace(fl, 0.10, 0.8, subdiv=7, axis='Z'); fl.location.z = -0.06
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()

    def tree(o):
        e = o.evaluated_get(dg); m = e.to_mesh()
        t = BVHTree.FromPolygons([o.matrix_world @ v.co for v in m.vertices], [tuple(q.vertices) for q in m.polygons]); e.to_mesh_clear()
        return t
    wall, ground = tree(w), tree(fl)
    # the rock is broken into beds and blocks everywhere but along its way, which its hands and feet have worn down
    C = V((0, 0.3, 1.5))
    WAY = [(-14, -14), (14, -15), (40, -10), (66, -3), (92, 8), (116, 14), (138, 17), (158, 25), (168, 37), (150, 45), (122, 50), (98, 52), (78, 55), (60, 59), (30, 64)]
    s0 = wall_way(wall, C, WAY)
    kd = KDTree(int(s0.len / 0.08) + 2)
    for k, q in enumerate(np.arange(0, s0.len, 0.08)):
        kd.insert(s0(float(q), 0)[0], k)
    kd.balance()
    vg = w.vertex_groups.new(name='rough')
    for k, v in enumerate(w.data.vertices):
        dist = kd.find(v.co)[2]
        wt = 0.5 + 0.5 * ss(dist, 0.3, 1.0)
        dm = drs[k] * wt + dbs[k] * (0.15 + 0.85 * ss(dist, 0.4, 1.6))
        x, y = v.co.x, v.co.y; rr = math.hypot(x, y) or 1.0
        v.co.x += x / rr * dm; v.co.y += y / rr * dm
        vg.add([k], wt, 'REPLACE')
    vo = lib.displace(w, 0.30, 0.55, tex='VORONOI')             # broken faces: blocks with cracks between them
    vo.texture.weight_1, vo.texture.weight_2 = -1.0, 1.0; vo.texture.noise_intensity = 1.6; vo.vertex_group = 'rough'
    lib.displace(w, 0.07, 0.18).vertex_group = 'rough'
    w.data.update(); bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
    wall = tree(w)
    gz = lambda x, y: ground.ray_cast(V((x, y, 2)), V((0, 0, -1)))[0].z
    rng = np.random.default_rng(21)
    for k in range(46):                                           # what has come down the well: stones
        a = rng.uniform(0, math.tau); r = 0.55 + 2.6 * rng.random() ** 0.7; x, y = math.cos(a) * r, math.sin(a) * r * 0.9
        if y < -0.3 and abs(x) < 0.9:
            continue
        q = 0.02 + 0.10 * rng.random() ** 2.5
        b = prim('ico', f'stone{k}', loc=(x, y, gz(x, y) + q * 0.3), rot=tuple(rng.random(3) * 6), scale=(q * 1.3, q, q * 0.8), material=mats['rock'], subdivisions=2)
    # the light that comes down
    WASH = [((0.0, -0.9, 3.3), (0.0, 3.6, 1.9), 50), ((0.5, -0.6, 3.3), (3.4, 1.2, 1.5), 30), ((-0.5, -0.6, 3.3), (-3.4, 1.2, 1.9), 26), ((0, 0.0, 2.6), (0.0, 0.8, 5.3), 4)]
    glow = light('POINT', 'shaft', (0.0, -0.1, 7.6), 110, color=(0.80, 0.86, 1.0), size=0.4)
    key = light('SPOT', 'well', (0.0, 0.05, 11.0), 3600, color=(0.80, 0.86, 1.0), size=1.6, spot=math.radians(22)); aim(key, (0, 0, 0))
    key.data.spot_blend = 1.0; key.data.volume_factor = 2.6
    bounce = light('AREA', 'bounce', (0, 0.25, 0.10), 10, color=(0.66, 0.74, 1.0), size=1.5); bounce.rotation_euler = (math.pi, 0, 0)
    GRAZE = [((0.0, 1.5, 4.2), (0.0, 4.6, 1.8), 260), ((1.5, 0.6, 4.2), (4.0, 1.6, 1.6), 270), ((-1.5, 0.6, 4.2), (-4.0, 1.6, 2.0), 250), ((1.5, -0.8, 4.2), (3.6, -0.9, 1.6), 150), ((-1.5, -0.8, 4.2), (-3.6, -0.9, 1.6), 150)]
    graze = [light('SPOT', f'graze{k}', at, e, color=(0.62, 0.7, 1.0), size=0.8, spot=math.radians(85)) for k, (at, to, e) in enumerate(GRAZE)]
    for o, (at, to, e) in zip(graze, GRAZE):
        aim(o, to); o.data.volume_factor = 0.0; o.data.spot_blend = 1.0
    side = [light('AREA', f'side{k}', at, e, color=(0.62, 0.7, 1.0), size=0.9) for k, (at, to, e) in enumerate(WASH)]
    for o, (at, to, e) in zip(side, WASH):
        aim(o, to); o.data.volume_factor = 0.0
    front = light('SPOT', 'front', (0.75, -1.5, 0.42), 7.0, color=(0.72, 0.8, 1.0), size=0.6, spot=math.radians(45)); aim(front, (0, 0, 0.15)); front.data.volume_factor = 0.0; front.data.spot_blend = 1.0; bounce.data.volume_factor = 0.0
    # the doll, sitting, its head down, the bitten end of the thread before it
    d, dp = lib.doll('doll', (0, 0, 0), 1.0, mats)
    dim = mats['wool_grey'].copy(); dim.name = 'wool_dim'          # grey wool, damp and dusty down here: under light from straight above it went to paper
    bs = [n for n in dim.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    bs.inputs['Base Color'].default_value = (0.15, 0.145, 0.14, 1)
    for nm in ('Sheen Weight', 'Sheen'):
        if nm in bs.inputs:
            bs.inputs[nm].default_value = 0.25
    for o in bpy.data.objects:
        if o.name.startswith('doll') and o.type == 'MESH':
            for i, m_ in enumerate(o.data.materials):
                if m_ is not None and m_.name.startswith('wool_grey'):
                    o.data.materials[i] = dim
    z0 = gz(0, 0)
    d.location = (0, 0, z0 - 0.026); d.rotation_euler = (0, 0, 0.16)
    for s in (-1, 1):
        hip = empty(f'hip{s}', (s * 0.034, -0.02, 0.048)); parent(hip, d, keep=False)
        for nm, at in ((f'doll_leg{s}', (0, 0, -0.028)), (f'doll_foot{s}', (0.002 * s, -0.010, -0.066))):
            o = bpy.data.objects[nm]; o.parent = hip; o.matrix_parent_inverse = Matrix.Identity(4); o.location = at
        hip.rotation_euler = (-1.42, 0, s * 0.22)
    lib.stick(d, d)
    ring = [p for p, _ in lib.doll_ring((0.05, 0, 1), -0.004, 0.0022, 64)]
    rt = lib.tube('greyring', ring + [ring[0]], 0.0017, mats['grey_thread']); parent(rt, d, keep=False)
    M0 = Matrix.Translation(d.location) @ Euler(d.rotation_euler).to_matrix().to_4x4()
    st = M0 @ ring[16]
    way = [st, st + V((0.0, -0.03, -0.06))]
    for q in ((0.06, -0.16), (0.13, -0.24), (0.24, -0.27), (0.33, -0.22), (0.35, -0.13), (0.29, -0.09), (0.23, -0.14), (0.25, -0.22), (0.31, -0.25)):
        way.append(V((q[0], q[1], gz(*q) + 0.004)))
    way = [a.lerp(b, u) for a, b in zip(way, way[1:]) for u in (0, 0.25, 0.5, 0.75)] + [way[-1]]
    for q in way[8:]:
        q.z = gz(q.x, q.y) + 0.003
    for _ in range(4):
        way = way[:1] + [(a + b * 2 + c) / 4 for a, b, c in zip(way, way[1:], way[2:])] + way[-1:]
    lib.tube('bitten', way, 0.0021, mats['grey_thread'])
    # petals: some lie here already; two more come down
    for k, (x, y, a) in enumerate(((-0.30, -0.12, 0.5), (0.42, 0.18, 2.2), (-0.16, 0.34, 4.0), (0.10, -0.40, 1.2), (-0.55, 0.22, 3.0), (0.62, -0.26, 5.2))):
        pf = PetalFall(f'lie{k}', mats['petalfall'], 0.015); pf.set(V((x, y, gz(x, y) + 0.010)), 0.0); pf.o.rotation_euler = (0.2 * math.sin(a), 0.15, a)
    fallp = [(PetalFall('fallA', mats['petalfall'], 0.015), V((-0.20, -0.16, 0)), 40, 118), (PetalFall('fallB', mats['petalfall'], 0.015), V((0.36, 0.05, 0)), 262, 372)]
    # its way: low on the right, round the back, up the left, over the roof to the mouth of the well
    surf = wall_way(wall, C, WAY)
    on_way = [surf(q, 0)[0] for q in np.arange(0, surf.len, 0.2)]
    for k in range(70):
        a = rng.uniform(0, math.tau); v = V((math.cos(a), math.sin(a), 0))
        h0 = wall.ray_cast(V((0, 0, 0.35)), v)[0]
        if h0 is None or (h0 - V((0, 0, 0.35))).length < 2.2:
            continue
        q = 0.18 + 0.55 * rng.random() ** 2
        at = h0 - v * q * rng.uniform(0.1, 0.8); at.z = gz(at.x, at.y) + q * 0.25
        if min((at - p).length for p in on_way) < q + 0.7 or abs(at.x) < 1.6 and at.y < 0:
            continue
        b = prim('ico', f'block{k}', loc=at, rot=tuple(rng.random(3) * 6), scale=(q * 1.2, q * rng.uniform(0.7, 1.1), q * rng.uniform(0.5, 0.9)), material=deep, subdivisions=1)
        lib.displace(b, q * 0.25, 0.4)
    kr, kp = lib.knitter('knitter', (0, 0, 0), mats, seated=False)
    cr = Crawler(kr, kp, surf, height=0.215)
    # the names that are left, and when: it stops to say each, and listens; then goes on
    SAY = [(5, 90), (6, 148), (7, 206), (8, 264), (9, 322), (10, 428), (11, 498)]
    TOT = surf.len - 1.1
    fr = [0.0, 0.125, 0.26, 0.40, 0.53, 0.66, 0.83, 0.96]               # how far along it is at each stop (first: before it comes)
    stops = [cr.rest(q * TOT) for q in fr]
    env = voice_env('names')
    legs = []                                                     # (from frame, to frame, from s, to s)
    prev_end = 34
    for k, (i, f) in enumerate(SAY):
        legs.append((prev_end, f - 4, stops[k], stops[k + 1]))
        prev_end = f + NAMES[i][1] * 24 + (8 if k != 4 else 44)

    def s_of(f):
        s = legs[0][2]
        for a, b, u, v in legs:
            if f >= a:
                s = u + (v - u) * ss(f, a, b)
        return s

    def saying(f):
        """(how open the mouth, how much it attends to the doll)"""
        j = 0.0; att = 0.0
        for i, f0 in SAY:
            at, ln = NAMES[i]
            if f0 <= f <= f0 + ln * 24 + 2:
                e = int(round(at * 24 + f - f0)); j = max(j, env[e] if e < len(env) else 0.0)
            att = max(att, ss(f, f0 - 6, f0 + 1) * (1 - ss(f, f0 + ln * 24 + 8, f0 + ln * 24 + 20)))
        return j, att
    T_NEAR = SAY[4][1]                                            # the one name that makes it look up
    T_OVER = SAY[6][1] - 30                                        # it comes over the mouth of the well

    near = light('POINT', 'near', (0, 0, 3), 90.0, color=(0.62, 0.7, 1.0), size=0.6); near.data.volume_factor = 0.0
    light_keys(near, [(1, 0.0), (40, 90.0), (N - 60, 90.0), (N - 22, 0)])

    def upd(f):
        j, att = saying(f)
        p_, n_, t_ = surf(s_of(f), 0); near.location = p_ + n_ * 1.0 + (C - p_).normalized() * 0.3
        cr.set(s_of(f), look=(d.location + V((0, 0, 0.22))), amount=att, jaw=0.75 * j, f=f)
        nod = 0.50 - 0.46 * ss(f, T_NEAR + 14, T_NEAR + 40) * (1 - ss(f, T_NEAR + 66, T_NEAR + 110))
        dp['headpiv'].rotation_euler = (nod + 0.012 * math.sin(f * 0.05), 0.05, 0.10 * ss(f, T_NEAR + 14, T_NEAR + 46) * (1 - ss(f, T_NEAR + 66, T_NEAR + 110)))
        for s in (-1, 1):
            dp[f'arm{s}'].rotation_euler = (-0.42, -s * 0.30, 0)
        for pf, at, a, b in fallp:
            g = gz(at.x, at.y) + 0.010
            u = max(0.0, (f - a) / (b - a))
            if u < 1:
                t = (f - a) / 24
                pf.set(V((at.x + 0.10 * math.sin(t * 2.0) * (1 - u), at.y + 0.06 * math.cos(t * 1.6) * (1 - u), g + 2.6 * (1 - u))), t * 2.2)
            else:
                pf.set(V((at.x, at.y, g)), (b - a) / 24 * 2.2)
            pf.o.hide_render = f < a
    lib.FRAME_FNS.append(upd)
    light_keys(key, [(1, 0.0), (26, 3600), (T_OVER, 3600), (T_OVER + 34, 1050), (N - 60, 900), (N - 22, 0)])
    light_keys(glow, [(1, 0.0), (26, 110), (N - 60, 110), (N - 22, 0)])
    light_keys(bounce, [(1, 0.0), (40, 10), (T_OVER, 10), (T_OVER + 34, 2.2), (N - 60, 2.2), (N - 22, 0)])
    for o, (at, to, e) in zip(graze, GRAZE):
        light_keys(o, [(1, 0.0), (60, e), (T_OVER, e), (T_OVER + 34, e * 0.5), (N - 60, e * 0.45), (N - 22, 0)])
    for o, (at, to, e) in zip(side, WASH):
        light_keys(o, [(1, 0.0), (60, e), (T_OVER, e), (T_OVER + 34, e * 0.55), (N - 60, e * 0.5), (N - 22, 0)])
    light_keys(front, [(1, 0.0), (30, 7.0), (T_OVER, 7.0), (T_OVER + 34, 3.0), (N - 60, 3.0), (N - 22, 0)])
    fb = lib.fog_box(0.035, color=(0.8, 0.86, 1.0), aniso=0.3, bounds=((-2.0, -2.0, -0.1), (2.0, 2.0, 11)))
    nt = fb.data.materials[0].node_tree                          # thickest down the middle of the shaft, nothing at the box's sides
    vol = [n for n in nt.nodes if n.type == 'PRINCIPLED_VOLUME'][0]
    g = nt.nodes.new('ShaderNodeNewGeometry'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(g.outputs['Position'], sp.inputs[0])
    cx = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(sp.outputs['X'], cx.inputs['X']); nt.links.new(sp.outputs['Y'], cx.inputs['Y'])
    ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; nt.links.new(cx.outputs[0], ln.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
    mr.inputs['From Min'].default_value = 1.6; mr.inputs['From Max'].default_value = 0.3
    mr.inputs['To Min'].default_value = 0.0; mr.inputs['To Max'].default_value = 0.035
    nt.links.new(ln.outputs['Value'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], vol.inputs['Density'])
    # sounds
    camx = 0.0
    for f, kd, p in cr.steps(s_of, 1, N):
        if f < N - 30:
            ev(f, 'palm_rock' if kd[0] == 'h' else 'toe_rock', 0.6 if kd[0] == 'h' else 0.4, max(-0.8, min(0.8, p.x / 4.2)))
    for k, (i, f) in enumerate(SAY):
        p = surf(stops[k + 1], 0)[0]
        ev(f - 5, 'neck', 0.5, max(-0.8, min(0.8, p.x / 4.2)))
        EVENTS.append({'f': f, 'kind': 'voice', 'name': 'names', 'at': max(0.0, NAMES[i][0] - 0.02), 'vol': 0.95, 'pan': max(-0.7, min(0.7, p.x / 4.5)), 'dur': NAMES[i][1] + 0.12, 'cave': 1})
    ev(fallp[0][3], 'petal_land', 0.5, -0.1); ev(fallp[1][3], 'petal_land', 0.5, 0.1)
    ev(T_NEAR + 16, 'wool_turn', 0.5, 0.0); ev(T_NEAR + 68, 'wool_turn', 0.4, 0.0)
    for f in (22, 190, 310, 400, 470):
        ev(f, 'well_drop', 0.4, float(rng.uniform(-0.5, 0.5)))
    ev(N - 22, 'cutblack', 1.0, 0.0)
    lib.register_frames()
    return sc
