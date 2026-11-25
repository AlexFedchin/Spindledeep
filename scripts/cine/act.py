"""Acting for the knitter (Blender side): hands that touch what they hold, arms that follow the hands, feet that stay
where they are put.

Contact. `Hand.grasp` takes a thing's signed distance field (written in the thing's own frame) and a way of coming at it:
the hand is brought in until the palm meets the surface, then each finger is closed joint by joint until its own skin does,
the thumb last. What comes back is the hand's place in the thing's frame and the finger pose, so from then on the thing
leads and the hand is bolted to it: they cannot drift apart or sink into each other. The skin used is the model's own
(the same vertices and weights Blender deforms), so what is solved is what is rendered.

Feet. `Walk` plants footsteps on the ground and keeps each one still until its heel lifts; the hips travel over them,
drop, sway and turn; legs are two-bone IK. Every heel strike is an event the soundtrack reads (see `ev` in shots_intro)."""
import math

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector as V

import lib
import oldlady

# every pose is written for the left hand: fingers [(curl1, curl2, spread)] x4 index→little, thumb ((x, y, z), (x, y, z))
OPEN = {'f': [(0.18, 0.14, 0.05), (0.15, 0.12, 0.0), (0.16, 0.13, -0.03), (0.2, 0.16, -0.08)], 't': ((-0.1, 0.0, 0.0), (0.0, 0.05, 0.0))}
WIDE = {'f': [(-0.22, -0.05, 0.06), (-0.22, -0.05, 0.01), (-0.2, -0.05, -0.03), (-0.18, -0.05, -0.09)], 't': ((-0.35, -0.35, 0.0), (0.0, -0.1, 0.0))}
RELAX = {'f': [(0.35, 0.3, 0.0)] * 4, 't': ((0.15, 0.15, 0.0), (0.0, 0.2, 0.0))}
FIST = {'f': [(1.25, 1.1, 0.0)] * 4, 't': ((0.5, 0.6, 0.0), (0.0, 0.6, 0.0))}
PINCH = {'f': [(0.85, 0.55, 0.0), (1.2, 1.0, 0.0), (1.35, 1.1, 0.0), (1.4, 1.1, 0.0)], 't': ((0.55, 0.3, 0.0), (0.0, 0.25, 0.0))}


def mix(a, b, k):
    L = lambda x, y: x + (y - x) * k
    return {'f': [tuple(L(x, y) for x, y in zip(p, q)) for p, q in zip(a['f'], b['f'])],
            't': tuple(tuple(L(x, y) for x, y in zip(p, q)) for p, q in zip(a['t'], b['t']))}


def ss(f, a, b):
    """0 → 1 between frames a and b, eased"""
    if b <= a:
        return 1.0 if f >= b else 0.0
    t = min(1.0, max(0.0, (f - a) / (b - a)))
    return t * t * t * (t * (6 * t - 15) + 10)


def mlerp(A, B, k):
    """between two rigid matrices"""
    la, qa, _ = A.decompose(); lb, qb, _ = B.decompose()
    if qa.dot(qb) < 0:
        qb = -qb
    return Matrix.Translation(la.lerp(lb, k)) @ qa.slerp(qb, k).to_matrix().to_4x4()


def rigid(loc, rot=None):
    m = rot.to_4x4() if isinstance(rot, Matrix) else (Euler(rot).to_matrix().to_4x4() if rot is not None else Matrix.Identity(4))
    return Matrix.Translation(V(loc)) @ m


def hand_rot(fingers, palm):
    """rotation of a hand whose fingers point along `fingers` and whose palm faces `palm` (either hand)"""
    z = -V(fingers).normalized()
    x = -V(palm); x = (x - z * x.dot(z)).normalized()
    return Matrix((x, z.cross(x), z)).transposed()


# ── distance fields (numpy, vectorised) ────────────────────────────────────
def sd_ellipsoid(c, r):
    c = np.array(c, float); r = np.array(r, float)

    def d(p):
        q = p - c
        k0 = np.linalg.norm(q / r, axis=1); k1 = np.linalg.norm(q / (r * r), axis=1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
    return d


def sd_capsule(a, b, r):
    a = np.array(a, float); b = np.array(b, float)

    def d(p):
        ab = b - a
        t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
        return np.linalg.norm(p - (a + t[:, None] * ab), axis=1) - r
    return d


def sd_plane(n, d0):
    n = np.array(n, float); n = n / np.linalg.norm(n)
    return lambda p: p @ n - d0


def sd_union(*fs):
    return lambda p: np.min([f(p) for f in fs], axis=0)


def sd_doll(parts=('body', 'head')):
    fs = []
    if 'body' in parts:
        fs.append(sd_ellipsoid(*lib.DOLL_BODY))
    if 'head' in parts:
        fs.append(sd_ellipsoid(*lib.DOLL_HEAD))
    return sd_union(*fs)


class Hand:
    def __init__(self, act, s):
        self.act, self.s = act, s
        P = act.P
        sd = 'l' if s == 1 else 'r'
        rig = P['rig']
        pos = lambda n: (rig.matrix_world @ rig.data.bones[n].matrix_local).translation
        Rf = oldlady._frame(pos(f'hand.{sd}') - pos(f'forearm_stretch.{sd}'), V((0, 0, 1)))
        Hb = Matrix.Translation(pos(f'hand.{sd}')) @ Rf.to_4x4()
        self.m = 1.0 if s == 1 else -1.0
        # joints: 0 palm, 1.. three per finger, 13.. three for the thumb. offsets are parent-local (no rotation at rest)
        fobj = lambda n: bpy.data.objects[f'{act.name}_{n}']
        self.joints = [(fobj(f'f{s}{k}a'), fobj(f'f{s}{k}b'), fobj(f'f{s}{k}c')) for k in range(4)] + [(fobj(f'th{s}a'), fobj(f'th{s}b'), fobj(f'th{s}c'))]
        self.off = [[np.array(o.location) for o in tri] for tri in self.joints]
        idx = {f'hand.{sd}': 0, f'forearm_stretch.{sd}': 0}
        for k, fn in enumerate(oldlady.FINGERS):
            idx[f'{fn}1_base.{sd}'] = 0
            for j in range(3):
                idx[f'{fn}{j + 1}.{sd}'] = 1 + k * 3 + j
        for j in range(3):
            idx[f'thumb{j + 1}.{sd}'] = 13 + j
        body = next(o for o in P['meshes'] if o.name.endswith('_Body'))
        names = {g.index: g.name for g in body.vertex_groups}
        mw = body.matrix_world
        Hi = Hb.inverted()
        vs, ws, lab, vid = [], [], [], {}
        for v in body.data.vertices:
            w = np.zeros(16); fore = 0.0
            for g in v.groups:
                n = names[g.group]
                if n in idx:
                    w[idx[n]] += g.weight
                    if n.startswith('forearm'):
                        fore += g.weight
            t = w.sum()
            if t < 0.6 or fore > 0.5 * t:
                continue
            vid[v.index] = len(vs)
            vs.append(Hi @ (mw @ v.co)); ws.append(w / t)
            j = int(w.argmax()); lab.append(0 if j == 0 else 1 + (j - 1) // 3)
        self.v0 = np.array([list(v) for v in vs]); self.w = np.array(ws); self.lab = np.array(lab)
        self.jlab = self.w.argmax(1)
        self.tris = [tuple(vid[i] for i in p.vertices) for p in body.data.polygons if all(i in vid for i in p.vertices)]
        # bind offsets (cumulative)
        self.bind = np.zeros((16, 3))
        for k in range(5):
            acc = np.zeros(3)
            for j in range(3):
                acc = acc + self.off[k][j]; self.bind[1 + k * 3 + j] = acc
        pal = self.v0[(self.lab == 0) & (self.v0[:, 0] < self.v0[self.lab == 0][:, 0].mean()) & (self.v0[:, 2] < -0.03)]
        self.palm = pal.mean(0)

    # ── posing ──
    def _eul(self, p, j):
        if j < 4:
            a, b, sp = p['f'][j]
            return ((sp * self.m, a, 0), (0, b, 0), (0, b * 0.75, 0))
        (x, y, z), (x2, y2, z2) = p['t']
        return ((x * self.m, y, z * self.m), (x2 * self.m, y2, z2 * self.m), (x2 * self.m * 0.8, y2 * 0.8, z2 * self.m * 0.8))

    def mats(self, p):
        D = np.zeros((16, 3, 4)); D[0, :, :3] = np.eye(3)
        for k in range(5):
            R = np.eye(3); t = np.zeros(3)
            for j, e in enumerate(self._eul(p, k)):
                t = t + R @ self.off[k][j]
                R = R @ np.array(Euler(e).to_matrix())
                i = 1 + k * 3 + j
                D[i, :, :3] = R; D[i, :, 3] = t - R @ self.bind[i]
        return D

    def skin(self, p):
        """the hand's skin for a pose, in the hand's frame"""
        D = self.mats(p)
        x = np.einsum('jab,nb->nja', D[:, :, :3], self.v0) + D[:, :, 3][None]
        return np.einsum('nj,nja->na', self.w, x)

    def tips(self, p):
        """where the pads of index and thumb are"""
        v = self.skin(p)
        out = []
        for j in (3, 15):
            sel = v[self.jlab == j]
            out.append(sel.mean(0))
        return out

    def pose(self, p):
        for k, tri in enumerate(self.joints):
            e = self._eul(p, k)
            tri[0].rotation_euler = e[0]; tri[1].rotation_euler = e[1]          # the third joint follows by its driver

    # ── contact ──
    def grasp(self, sdf, R, at, approach=None, opened=WIDE, close=(1.5, 1.5), tol=0.0008, thumb=((0.75, 0.75, 0.0), (0.1, 0.9, 0.0)),
              fingers=(0, 1, 2, 3), palm=True, spread=None, back=None, use_thumb=True):
        """close this hand on a thing. `R` hand rotation in the thing's frame, `at` the point the palm is brought to,
        `approach` the direction it moves (default: the way the palm faces). Returns {'G': 4x4, 'pose': p, 'n': approach}"""
        R = np.array(R.to_3x3()) if isinstance(R, Matrix) else np.array(R)
        n = -R[:, 0] if approach is None else np.array(V(approach).normalized())
        at = np.array(at, float)
        p = {'f': [tuple(x) for x in opened['f']], 't': opened['t']}
        vh = self.skin(p) @ R.T
        c = R @ self.palm
        sel = np.ones(len(vh), bool) if not palm else ((self.lab == 0) | True)
        d = -0.16
        def dist(dd):
            return float(sdf(vh[sel] + (at - c) + n * dd).min())
        while dist(d) > -tol and d < 0.1:
            d += 0.002
        lo, hi = d - 0.002, d
        for _ in range(14):
            m = (lo + hi) / 2
            if dist(m) > -tol:
                lo = m
            else:
                hi = m
        o = at - c + n * lo
        G = Matrix.Translation(V(o)) @ Matrix(R.tolist()).to_4x4()
        self.close(p, G, sdf, close, tol, thumb, fingers, use_thumb)
        return {'G': G, 'pose': p, 'n': V(n), 'open': opened}

    def close(self, p, G, sdf, close=(1.5, 1.5), tol=0.0008, thumb=((0.75, 0.75, 0.0), (0.1, 0.9, 0.0)), fingers=(0, 1, 2, 3), use_thumb=True):
        """close fingers (in place, p) until each meets the surface"""
        R = np.array(G.to_3x3()); o = np.array(G.translation)
        def clear(k):
            v = self.skin(p)[self.lab == k + 1] @ R.T + o
            return float(sdf(v).min()) > -tol
        for k in fingers:
            a, b, sp = p['f'][k]
            for step in (0.04, 0.01):
                while a < close[0]:
                    p['f'][k] = (a + step, b, sp)
                    if not clear(k):
                        break
                    a += step
                p['f'][k] = (a, b, sp)
            for step in (0.04, 0.01):
                while b < close[1]:
                    p['f'][k] = (a, b + step, sp)
                    if not clear(k):
                        break
                    b += step
                p['f'][k] = (a, b, sp)
        if use_thumb:
            t0 = p['t']
            lerp = lambda q: tuple(tuple(x + (y - x) * q for x, y in zip(a, b)) for a, b in zip(t0, thumb))
            q = 0.0
            while q < 1.0:
                p['t'] = lerp(q + 0.02)
                if not clear(4):
                    break
                q += 0.02
            p['t'] = lerp(q)
            # then the last joints of the thumb
            (a, (x, y, z)) = p['t']
            while y < 1.2:
                p['t'] = (a, (x, y + 0.02, z))
                if not clear(4):
                    break
                y += 0.02
            p['t'] = (a, (x, y, z))
        return p

    def gap(self, p, G, sdf):
        """nearest approach of palm, each finger and thumb to the surface (m; negative = inside), for the report"""
        v = self.skin(p) @ np.array(G.to_3x3()).T + np.array(G.translation)
        d = sdf(v)
        return [float(d[self.lab == k].min()) for k in range(6)]


class Actor:
    def __init__(self, root, P):
        self.root, self.P, self.name = root, P, root.name
        self.sp = {f'{self.name}_sp1': 0.45, f'{self.name}_sp2': 0.3, f'{self.name}_sp3': 0.25}
        for s in (1, -1):
            P[f'arm{s}'].rotation_euler = (0, 0, 0)
        self.hand = {s: Hand(self, s) for s in (1, -1)}
        self.hips0 = V(P['hips'].location)
        self.miss = {1: 0.0, -1: 0.0}
        self.bend = {1: 0.0, -1: 0.0}
        self.phi0 = {1: 0.0, -1: 0.0}
        self.tw = (0.2, 0.75)
        bpy.context.view_layer.update()

    def W(self, o):
        """world matrix from the controls' own values (no depsgraph: it is called inside the frame handler)"""
        e = o.rotation_euler
        k = self.sp.get(o.name)
        if k is not None:
            t = self.P['torso'].rotation_euler
            e = Euler((t[0] * k, t[1] * k, t[2] * k))
        m = Matrix.Translation(o.location) @ Euler(e).to_matrix().to_4x4()
        return self.W(o.parent) @ m if o.parent else m

    def arm(self, s, M, pole=None, pull=0.0):
        """bring the hand to the world matrix M (rotation and place both exact). Sets shoulder, elbow, wrist."""
        P = self.P
        sh, fore, hand = P[f'sh{s}'], P[f'fore{s}'], P[f'hand{s}']
        L1, L2 = P['L1'], P['L2']
        pm = self.W(sh.parent) @ Matrix.Translation(sh.location)
        S = pm.translation.copy(); Rp = pm.to_3x3().normalized()
        side = Rp @ V((s, 0, 0))
        pole = V(pole) if pole is not None else (side * 0.6 + Rp @ V((0, 0.5, -0.6)))
        pole.normalize()
        T = M.translation
        D = T - S
        d = min(max(D.length, 0.05), (L1 + L2) * 0.9995)
        self.miss[s] = max(self.miss[s], D.length - d)
        u = D.normalized()
        ca = max(-1.0, min(1.0, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))
        a = math.acos(ca)
        v = pole - u * pole.dot(u); v.normalize()
        E = S + (u * math.cos(a) + v * math.sin(a)) * L1
        Wr = S + u * d
        du = (E - S).normalized(); df = (Wr - E).normalized()
        Rs0 = lib._basis(du, side)
        Rf0 = lib._basis(df, Rs0 @ V((1, 0, 0)))
        Rh = M.to_3x3().normalized()
        X = Rh @ V((1, 0, 0)); X = X - df * X.dot(df)
        x0 = Rf0 @ V((1, 0, 0))
        phi = math.atan2(df.dot(x0.cross(X)), x0.dot(X)) if X.length > 1e-5 else 0.0
        c = self.phi0[s]
        while phi - c > math.pi:
            phi -= 2 * math.pi
        while phi - c < -math.pi:
            phi += 2 * math.pi
        # the turn of the hand is shared: some at the shoulder, most in the forearm, the rest at the wrist
        Rs = Matrix.Rotation(phi * self.tw[0], 3, du) @ Rs0
        Rf = Matrix.Rotation(phi * self.tw[1], 3, df) @ Rf0
        Rw = Rf.inverted() @ Rh
        self.bend[s] = max(self.bend[s], (Rf @ V((0, 0, -1))).angle(Rh @ V((0, 0, -1))))
        sh.rotation_euler = (Rp.inverted() @ Rs).to_euler()
        fore.rotation_euler = (Rs.inverted() @ Rf).to_euler()
        hand.rotation_euler = Rw.to_euler()

    def hand_world(self, s):
        return self.W(self.P[f'hand{s}'])

    def look(self, target, f=None, limit=0.6, amount=1.0):
        """turn neck and head toward a world point (call after the torso is set)"""
        P = self.P
        P['head'].rotation_euler = (0, 0, 0)
        H = self.W(P['head'])
        d = H.to_3x3().inverted() @ (V(target) - (H.translation + H.to_3x3() @ V((0, -0.04, 0.06))))
        yaw = math.atan2(d.x, -d.y); pit = math.atan2(-d.z, math.hypot(d.x, d.y))
        c = lambda x, l: max(-l, min(l, x)) * amount
        P['head'].rotation_euler = (c(pit, limit + 0.2), 0, c(yaw, limit))

    # ── legs ──
    def leg(self, s, ankle, footR, knee_fwd, up=None):
        """two-bone leg: ankle to a world point, the foot's world rotation, the knee bent toward knee_fwd"""
        P = self.P
        th, sn, ft = P[f'thigh{s}'], P[f'shin{s}'], P[f'foot{s}']
        hm = self.W(P['hips'])
        Rh = hm.to_3x3().normalized()
        H = hm @ th.location
        d1, d2 = V(sn.location), V(ft.location)
        L1, L2 = d1.length, d2.length
        D = ankle - H
        d = min(max(D.length, 0.2), (L1 + L2) * 0.9985)
        u = D.normalized()
        a = math.acos(max(-1, min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))))
        v = knee_fwd - u * knee_fwd.dot(u); v.normalize()
        K = H + (u * math.cos(a) + v * math.sin(a)) * L1
        A = H + u * d
        side = knee_fwd.cross(V((0, 0, 1)) if up is None else V(up))           # her +x when facing -y along knee_fwd (up: for a body that is not upright)
        side = -side
        def fr(dr, x):
            return lib._basis(dr, x)
        Rt = fr(K - H, side) @ fr(d1, V((1, 0, 0))).transposed()
        Rs = fr(A - K, side) @ fr(d2, V((1, 0, 0))).transposed()
        th.rotation_euler = (Rh.inverted() @ Rt).to_euler()
        sn.rotation_euler = (Rt.inverted() @ Rs).to_euler()
        ft.rotation_euler = (Rs.inverted() @ footR).to_euler()
        return (A - ankle).length


# ── walking ────────────────────────────────────────────────────────────────
class Path:
    """a smooth way over the ground through (x, y) points, by length"""
    def __init__(self, pts):
        pts = [np.array(p[:2], float) for p in pts]
        ext = [2 * pts[0] - pts[1]] + pts + [2 * pts[-1] - pts[-2]]
        out = []
        for i in range(1, len(ext) - 2):
            p0, p1, p2, p3 = ext[i - 1:i + 3]
            for t in np.linspace(0, 1, 40, endpoint=False):
                out.append(0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t ** 3))
        out.append(pts[-1])
        self.p = np.array(out)
        self.s = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(self.p, axis=0), axis=1))])
        self.len = float(self.s[-1])

    def at(self, s):
        # beyond the ends it runs straight on
        if s < 0:
            d = self.p[1] - self.p[0]; d /= np.linalg.norm(d)
            return self.p[0] + d * s
        if s > self.len:
            d = self.p[-1] - self.p[-2]; d /= np.linalg.norm(d)
            return self.p[-1] + d * (s - self.len)
        return np.array([np.interp(s, self.s, self.p[:, 0]), np.interp(s, self.s, self.p[:, 1])])

    def dir(self, s):
        d = self.at(s + 0.12) - self.at(s - 0.12)
        return d / (np.linalg.norm(d) + 1e-9)

    def heading(self, s):
        d = self.dir(s)
        return math.atan2(d[0], -d[1])


class Walk:
    """plan = [('go', frame the first foot lifts, distance, steps, frames per step), ...] on a Path. ground(x, y) → z."""
    TOE = V((0.0, -0.105, -0.05)); HEEL = V((0.0, 0.045, -0.06))

    def __init__(self, act, path, plan, frames, ground=lambda x, y: 0.0, width=0.085, lift=0.055, lean=0.12, drop=0.05, first=-1, sway=0.022, start=0.0, steps_z=None, roll=0.035):
        self.act, self.path, self.ground = act, path, ground
        self.width, self.lift, self.lean, self.drop, self.sway, self.roll = width, lift, lean, drop, sway, roll
        self.plants = {1: [(-1e6, start)], -1: [(-1e6, start)]}       # (strike frame, s)
        self.swings = {1: [], -1: []}                                    # (lift frame, strike frame, s0, s1)
        self.strikes = []                                                # (frame, foot, s)
        cur = {1: start, -1: start}
        foot = first
        s = start
        for (_, f0, dist, n, T) in plan:
            L = dist / max(1, n - 1)
            for k in range(n):
                tgt = min(s + (k + 1) * L, s + dist)
                a = f0 + k * T; b = a + T * 0.86
                self.swings[foot].append((a, b, cur[foot], tgt))
                self.strikes.append((b, foot, tgt))
                cur[foot] = tgt; foot = -foot
            s += dist
        self.N = frames
        F = np.arange(-30, frames + 60)
        self.F0 = -30
        fs = {sd: np.array([self._foot_s(sd, f) for f in F]) for sd in (1, -1)}
        mean = (fs[1] + fs[-1]) / 2
        T = plan[0][4] if plan else 14
        w = np.exp(-0.5 * (np.arange(-24, 25) / (T * 0.45)) ** 2); w /= w.sum()
        pad = np.pad(mean, 24, mode='edge')
        self.bs = np.convolve(pad, w, mode='valid')
        # which foot carries her: -1..1, smoothed
        car = np.array([self._carry(f) for f in F])
        pad = np.pad(car, 24, mode='edge')
        w2 = np.exp(-0.5 * (np.arange(-24, 25) / (T * 0.28)) ** 2); w2 /= w2.sum()
        self.car = np.convolve(pad, w2, mode='valid')
        dd = (fs[1] - fs[-1]) / 2
        self.lead = np.convolve(np.pad(dd, 24, mode='edge'), w2, mode='valid')
        # what the body rides on: the lower of the two feet (going down a step it has to be low enough for the leading leg)
        gz = np.array([min(self._foot_z(1, f), self._foot_z(-1, f)) for f in F])
        wz = np.exp(-0.5 * (np.arange(-24, 25) / (T * 0.22)) ** 2); wz /= wz.sum()
        self.gz = np.convolve(np.pad(gz, 24, mode='edge'), wz, mode='valid')

    def _foot_z(self, sd, f):
        sw = self._swing(sd, f)
        if not sw:
            return self.spot(sd, self._foot_s(sd, f))[0].z
        a, b, s0, s1 = sw
        za, zb = self.spot(sd, s0)[0].z, self.spot(sd, s1)[0].z
        t = (f - a) / (b - a)
        return za + (zb - za) * (ss(t, 0.1, 0.85) if zb < za else ss(t, 0.0, 1.0))

    def _swing(self, sd, f):
        for (a, b, s0, s1) in self.swings[sd]:
            if a <= f < b:
                return a, b, s0, s1
        return None

    def _foot_s(self, sd, f):
        s = self.plants[sd][0][1]
        for (a, b, s0, s1) in self.swings[sd]:
            if f >= b:
                s = s1
            elif f >= a:
                t = (f - a) / (b - a)
                return s0 + (s1 - s0) * (t * t * (3 - 2 * t))
        return s

    def _carry(self, f):
        l, r = self._swing(1, f), self._swing(-1, f)
        return -1.0 if l else (1.0 if r else 0.0)

    def _i(self, arr, f):
        return float(np.interp(f, np.arange(self.F0, self.F0 + len(arr)), arr))

    def spot(self, sd, s):
        """where a footstep at s stands: world point of the sole under the ankle, heading"""
        p = self.path.at(s); d = self.path.dir(s)
        nrm = np.array([-d[1], d[0]])                   # left of the way
        h = self.path.heading(s)
        # her +x side (s = 1) is to the left when she faces along the way
        q = p + nrm * self.width * sd
        return V((q[0], q[1], self.ground(q[0], q[1]))), h

    def pose(self, f):
        act = self.act; P = act.P
        bs = self._i(self.bs, f); car = self._i(self.car, f); lead = self._i(self.lead, f)
        p = self.path.at(bs); d = self.path.dir(bs); nrm = np.array([-d[1], d[0]])
        h = self.path.heading(bs)
        sp = (self._i(self.bs, f + 1) - self._i(self.bs, f - 1)) / 2 * 24       # m/s
        go = min(1.0, abs(sp) / 0.35)
        root = act.root
        q = p + nrm * self.sway * car
        root.location = V((q[0], q[1], self._i(self.gz, f)))
        root.rotation_euler = (0, 0, h)
        yaw = max(-0.16, min(0.16, lead * 0.45))                                   # the hip of the leading leg goes forward
        st = max(abs(lead) - 0.02, 0.0)
        hips = P['hips']
        hips.location = act.hips0 + V((0, 0, -self.drop * (0.35 + 0.65 * go) - 0.9 * st * st + 0.008 * abs(car) * go))
        # left leg ahead (lead > 0, her +x side): the pelvis turns so +x goes forward (-y)
        hips.rotation_euler = (0.04 * go, -self.roll * car, -yaw)
        P['torso'].rotation_euler = (0.3 + self.lean * go, self.roll * 0.9 * car, 1.35 * yaw)
        P['neck'].rotation_euler = (0.22 - self.lean * 0.5 * go, 0, 0)
        err = 0.0
        for sd in (1, -1):
            sw = self._swing(sd, f)
            hf = self.path.heading(self._foot_s(sd, f))
            pitch = 0.0; up = 0.0
            if sw:
                a, b, s0, s1 = sw
                t = (f - a) / (b - a)
                A, ha = self.spot(sd, s0); B, hb = self.spot(sd, s1)
                k = t * t * (3 - 2 * t)
                base = A.lerp(B, k); hf = ha + ((hb - ha + math.pi) % (2 * math.pi) - math.pi) * k
                big = min(1.0, (s1 - s0) / 0.3)
                rise = max(0.0, B.z - A.z)
                up = (self.lift * (0.5 + 0.5 * big) + rise * 0.6) * math.sin(math.pi * t) ** 1.2
                if B.z < A.z - 0.05:                    # going down: hold the height, then let the foot down
                    base.z = A.z + (B.z - A.z) * ss(t, 0.3, 1.0)
                pitch = (0.55 * (1 - t) ** 2 * (1 - t) - 0.28 * t ** 3 * 1.0 + 0.28 * max(0, t - 0.85) / 0.15 * 0.0) * big
            else:
                s0 = self._foot_s(sd, f)
                base, hf = self.spot(sd, s0)
                # since its strike / until its lift
                last = [x for x in self.swings[sd] if x[1] <= f]
                nxt = [x for x in self.swings[sd] if x[0] > f]
                if last:
                    big = min(1.0, (last[-1][3] - last[-1][2]) / 0.3)
                    pitch = -0.28 * big * (1 - min(1.0, (f - last[-1][1]) / 3.0))
                if nxt:
                    big = min(1.0, (nxt[0][3] - nxt[0][2]) / 0.3)
                    t = 1 - (nxt[0][0] - f) / 6.0
                    if t > 0:
                        pitch = 0.55 * big * t * t
            Rz = Matrix.Rotation(hf, 3, 'Z')
            Rx = Matrix.Rotation(pitch, 3, 'X')
            piv = self.TOE if pitch > 0 else self.HEEL
            rest = V((0.0, 0.0, 0.066))
            off = piv + Rx @ (-piv)
            ankle = base + Rz @ (rest + off) + V((0, 0, up))
            e = act.leg(sd, ankle, Rz @ Rx, Rz @ V((0.0, -1.0, 0.0)))
            err = max(err, e)
        self.err = err
        return bs, sp


# ── fine work ──────────────────────────────────────────────────────────────
def dense(H, v, label):
    """skin points of one finger, thick enough to measure between"""
    out = []
    ok = H.lab == label
    for t in H.tris:
        if all(ok[i] for i in t):
            q = v[list(t)]
            c = q.mean(0)
            out.append(c[None]); out.append((q + np.roll(q, 1, 0)) / 2); out.append((q + c) / 2)
    return np.concatenate(out + [v[ok]])


def pinch(H, r=0.0012, rest=((1.05, 0.85), (1.2, 0.95), (1.25, 1.0))):
    """index and thumb pads closed on something thin (radius r) and nothing else: (pose, the point held, in the hand's
    frame, what is left between the skins beyond the thing itself). Searched, not guessed: the two pads' own skin."""
    base = [(0.8, 0.5, 0.0)] + [(a, b, 0.0) for a, b in rest]

    def cloud(p, label, jl):
        v = H.skin(p)
        ok = (H.lab == label) & (H.jlab >= jl)
        out = [v[ok]]
        for t in H.tris:
            if all(ok[i] for i in t):
                q = v[list(t)]; c = q.mean(0)
                out += [c[None], (q + np.roll(q, 1, 0)) / 2, (q + c) / 2]
        return np.concatenate(out)
    I = []
    for a in np.linspace(0.55, 1.15, 6):
        for b in np.linspace(0.35, 1.05, 5):
            p = {'f': [(a, b, 0.0)] + base[1:], 't': OPEN['t']}
            I.append(((a, b), cloud(p, 1, 3)))
    p = {'f': base, 't': OPEN['t']}
    oth = H.skin(p)[(H.lab >= 2) & (H.lab <= 4)]
    best = None
    for x in np.linspace(-0.2, 1.2, 10):
        for y in np.linspace(-0.2, 1.0, 9):
            for t in (0.0, 0.25, 0.5):
                p = {'f': base, 't': ((x, y, 0.0), (0.0, t, 0.0))}
                T = cloud(p, 5, 15)
                near = np.linalg.norm(T[::3, None] - oth[None], axis=2).min()
                for (ab, C) in I:
                    if np.linalg.norm(C.mean(0) - T.mean(0)) > 0.03:
                        continue
                    D = np.linalg.norm(C[::2, None] - T[None, ::2], axis=2)
                    m = D.min()
                    cost = abs(m - 2 * r - 0.0006) + (0.004 if near < 0.002 else 0.0) + 0.001 * (abs(ab[0] - 0.8) + abs(ab[1] - 0.6)) + 0.0012 * t
                    # the pads should lie toward each other, not edge to edge
                    cost += 0.02 * max(0.0, np.linalg.norm(C.mean(0) - T.mean(0)) - 0.016)
                    if best is None or cost < best[0]:
                        i, j = np.unravel_index(D.argmin(), D.shape)
                        best = (cost, {'f': [(ab[0], ab[1], 0.0)] + base[1:], 't': ((x, y, 0.0), (0.0, t, 0.0))}, (C[::2][i] + T[::2][j]) / 2, m - 2 * r)
    return best[1], V(best[2]), float(best[3])


def rod_grip(H, r=0.0025, half=0.12, z=-0.074, slant=0.0):
    """a rod across the hand (slant 0: along its Y, like a handle; more: toward the fingers, like a knife), close under the palm
    and held by fingers and thumb: (pose, where its middle is in the hand, its field, its direction out of the thumb's side)"""
    v = H.skin(WIDE)
    d = V((0, -H.m * math.cos(slant), -math.sin(slant)))
    x = -0.06
    ends = lambda xx: ((V((xx, 0, z)) - d * half), (V((xx, 0, z)) + d * half))

    def sd(xx):
        return float(sd_capsule(*ends(xx), r)(v[H.lab == 0]).min())
    while sd(x) > 0.0 and x < 0.03:
        x += 0.0005
    x -= 0.003
    f = sd_capsule(*ends(x), r)
    p = {'f': [tuple(q) for q in OPEN['f']], 't': OPEN['t']}
    H.close(p, Matrix.Identity(4), f, close=(1.25, 1.35), tol=0.0006, use_thumb=False)
    for k in (1, 2, 3):                       # a finger that finds nothing lies beside its neighbour, it does not curl up alone
        a, b, sp = p['f'][k]; a0, b0, _ = p['f'][k - 1]
        p['f'][k] = (min(a, a0 + 0.45), min(b, b0 + 0.5), sp)
    thumb_to(H, p, Matrix.Identity(4), f)
    return p, V((x, 0, z)), f, d


def thumb_to(H, p, G, sdf, want=0.0, xs=(-0.5, 1.15), ys=(-0.3, 1.1), tips=(0.0, 0.3, 0.6, 0.9)):
    """lay the thumb on the surface: of all the ways it can stand, the one whose skin is nearest `want` from it, not deeper"""
    R = np.array(G.to_3x3()); o = np.array(G.translation)
    sel = H.lab == 5
    best = None
    for x in np.linspace(*xs, 12):
        for y in np.linspace(*ys, 12):
            for t in tips:
                p['t'] = ((x, y, 0.0), (0.0, t, 0.0))
                v = H.skin(p)
                d = float(sdf(v[sel] @ R.T + o).min())
                # not through the palm or the fingers
                cost = abs(d - want) + (0.02 if d < -0.0009 else 0.0) + 0.002 * t + 0.0015 * abs(x - 0.3) + 0.001 * abs(y - 0.3)
                if best is None or cost < best[0]:
                    best = (cost, p['t'])
    p['t'] = best[1]
    return p
