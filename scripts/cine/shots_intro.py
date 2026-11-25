"""The prologue (app/assets/cine/intro.mp4), second staging (2026-11-25): the storm, the window, her needles, the doll's
eye sewn on, the dark at the glass, the thread tied round it, the doll set on the sill by her own two hands, the door, her
walk to the pit, the doll alone, the doll's mitten closing on the thread.

Rules the user set: hands touch what they hold (act.py: never inside, never hovering) and the doll moves with them; she
walks, she never glides; every camera move is strictly linear (no easing, no hand-held drift); every sound is on its
movement: shots say what is heard and when with `ev`, from the same numbers that move things, and edit.py only reads that."""
import math

import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector as V

import act
import lib
import sets
from act import OPEN, PINCH, RELAX, hand_rot, mix, mlerp, rigid, sd_capsule, sd_doll, sd_ellipsoid, sd_plane, sd_union, ss
from lib import cam_keys, empty, light, parent, prim, M
from shots import shot, keys, light_keys, node_keys

TABLE = dict(table=(0.34, 0.80), table_x=(-0.3, 1.0), spool=(0.62, 0.72, 0.79))
SILL = V((-0.34, 0.135, 1.0145))       # the doll's root when it stands on the sill (top at 1.0; its soles are at -0.014)

EVENTS = []          # [{f, kind, vol, pan, ...}] of the shot being built
ACTORS = []          # the figures of the shot (for touch.py)
FOOT = [0.0]         # how far the worst foot fell short this frame
REPORT = []          # what checks want to know about the shot: callables f -> dict


def ev(f, kind, vol=1.0, pan=0.0, **kw):
    EVENTS.append({'f': round(float(f), 3), 'kind': kind, 'vol': vol, 'pan': pan, **kw})


def begin(frames, out, preview, origin=(0, 0.4, 1.0), **kw):
    lib.ORIGIN = V(origin)
    EVENTS.clear(); REPORT.clear(); ACTORS.clear(); FOOT[0] = 0.0; lib.FRAME_FNS.clear(); lib.SNOWS.clear()
    return lib.new_scene(frames, out, preview=preview, **kw)


def camera(lens, a, b, frames, fstop=None):
    """a straight move at one speed: a = (place, looked at), b likewise"""
    cam, tgt = lib.camera(lens=lens if not isinstance(lens, tuple) else lens[0], fstop=fstop)
    L = lens if isinstance(lens, tuple) else (lens, lens)
    kf = []
    for f, (p, t, *foc), l in ((1, a, L[0]), (frames, b, L[1])):
        p, t = V(p), V(t)
        kf.append((f, p, t, l, foc[0] if foc else (p - t).length))
    cam_keys(cam, tgt, kf, ease='LINEAR')
    return cam, tgt


def hearth(e, loc=(0.4, 3.2, 0.7)):
    h = light('POINT', 'hearth', loc, e, color=(1.0, 0.5, 0.22), size=0.05)
    lib.flicker(h, e, 0.14, 0.5, 9)
    return h


def aim(o, at):
    o.rotation_euler = (V(at) - o.location).to_track_quat('-Z', 'Y').to_euler()


def actor(kr, kp):
    A = act.Actor(kr, kp); ACTORS.append(A)
    return A


class Hold:
    """a hand that takes hold of a moving thing: rest → in front of it, open → on it, closed → back.
    where(f) is the thing's world matrix. Frames: a0 leave rest, a1 at the pre-grasp, a2 touching, a3 fingers closed;
    optionally b0 fingers open, b1 clear, b2 at the rest again."""
    def __init__(self, A, s, g, where, rest, a, b=None, back=0.06, rest_pose=RELAX, pole=None, rest2=None, aside=None, via=None, via2=None, freeze=False):
        self.A, self.s, self.g, self.where, self.rest, self.a, self.b = A, s, g, where, rest, a, b
        self.back, self.rest_pose, self.pole, self.rest2 = back, rest_pose, pole, rest2 or rest
        self.aside = V(aside) if aside is not None else None
        self.via, self.via2 = via, via2 or via
        self.freeze = freeze                       # what it lets go of goes its own way
        H = A.hand[s]
        self.open = mix(g['open'], g['pose'], 0.25)

    def at(self, f):
        w = self.where(min(f, self.b[0]) if self.freeze and self.b else f)
        g = self.g['G']
        n = self.g['n']
        off = -n * self.back + (self.aside or V((0, 0, 0)))
        on = w @ g
        pre = w @ Matrix.Translation(off) @ g
        a0, a1, a2, a3 = self.a
        if f < a1:
            k = ss(f, a0, a1); M = self.curve(self.rest, self.via, pre, k); p = mix(self.rest_pose, self.open, ss(f, (a0 + a1) / 2, a1))
        elif f < a3:
            M = mlerp(pre, on, ss(f, a1, a2)); p = mix(self.open, self.g['pose'], ss(f, a2 - 2, a3))
        else:
            M, p = on, self.g['pose']
        if self.b:
            b0, b1, b2 = self.b
            if f >= b0:
                M = mlerp(on, pre, ss(f, b0 + 4, b1)); p = mix(self.g['pose'], self.open, ss(f, b0, b0 + 7))
            if f >= b1:
                M = self.curve(pre, self.via2, self.rest2, ss(f, b1, b2)); p = mix(self.open, self.rest_pose, ss(f, b1, b2))
        return M, p

    @staticmethod
    def curve(a, v, b, k):
        return mlerp(a, b, k) if v is None else mlerp(mlerp(a, v, k), mlerp(v, b, k), k)

    def held(self, f):
        return f >= self.a[2] and (not self.b or f <= self.b[0] + 4)

    def set(self, f):
        M, p = self.at(f)
        self.A.arm(self.s, M, self.pole)
        self.A.hand[self.s].pose(p)


def hold_doll(A, s, z=0.098, y=0.022, tilt=0.15, turn=0.4):
    """a hand on the doll's side from behind it (its back to her): the palm on its flank, fingers round to its chest, thumb
    along its back. In the doll's own frame."""
    palm = V((-s, -turn, 0.0)).normalized()
    fing = V((-s * turn, -1, -tilt))
    return A.hand[s].grasp(sd_doll(('body',)), hand_rot(fing, palm), (s * 0.07, y, z), thumb=((0.35, 0.95, 0.0), (0.1, 0.5, 0.0)), close=(1.2, 1.0))


def doll_arms(dp, f, k):
    """the doll's arms: hanging (k = 0) to lying up over the hands that hold it (k = 1)"""
    for s in (-1, 1):
        dp[f'arm{s}'].rotation_euler = (-0.15 * k, -s * (0.35 + 0.95 * k), 0)


def report(A, hands, where, sdf):
    """for the checks: how far skin is from the thing, per frame"""
    def r(f):
        out = {}
        for h in hands:
            Mh, p = h.at(f)
            G = where(f).inverted() @ Mh
            out[h.s] = (h.held(f), A.hand[h.s].gap(p, G, sdf))
        return out
    REPORT.append(r)


# ── the storm ──────────────────────────────────────────────────────────────
@shot(exposure=1.35)
def I1(out, preview):
    """the Brink in a blizzard: a straight track across the storm, past the black mouth of the pit to the cottage and its one lit
    window (sideways, so that the lines on the snow stand still: see I7)"""
    sc = begin(168, out, preview, origin=(0, -4, 1))
    f_ = V((0.196, 0.981, 0)); r_ = V((0.981, -0.196, 0))
    t0 = V((13.6, -2.6, 1.0)); t1 = t0 - r_ * 14.6
    cam, tgt = camera(33, (t0 - f_ * 19 + V((0, 0, 3.0)), t0), (t1 - f_ * 19 + V((0, 0, 3.0)), t1), 168)
    sets.exterior(sc, cam, tgt, storm=True, snow_box=((-30, -24, -0.5), (34, -4, 12)), snow_n=12000)
    lib.SNOWS[-1].streak = 0.04
    s2 = lib.Snow('snow_far', 9000, (-40, -8, -0.5), (60, 32, 18), wind=(7.5, 1.0, -1.8), gust=0.5, streak=0.04, width=0.018, cam=cam, tgt=tgt, material=M()['flake'], seed=9)
    lib.SNOWS.append(s2)
    return sc


@shot(exposure=1.25)  # auto=1.7
def I5S(out, preview):
    """from outside, through the glass: she leans to the window with the doll in both hands, sets it on the sill, straightens
    it, lets it go; one hand comes back and rests on its head a moment"""
    N = 236
    sc = begin(N, out, preview, origin=(-0.34, 0.15, 1.15), pos_lo=(-4, -3, -1), pos_size=10.0)
    c0, c1 = V((-0.06, -0.86, 1.4)), V((-0.2, -0.78, 1.37))
    cam, tgt = camera(38, (c0, (-0.37, 0.2, 1.215)), (c1, (-0.36, 0.2, 1.2)), N, fstop=5.6)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, outside_snow=False, **TABLE)
    window_low()
    mats = M()
    prim('cube', 'backwall', loc=(0, 3.7, 1.3), scale=(2.7, 0.05, 1.4), material=mats['plank'])
    sn = lib.Snow('snow_out', 900, (-1.6, -1.6, 0.5), (1.4, -0.13, 2.3), wind=(2.6, 0.2, -0.9), gust=0.5, streak=0.018, width=0.005, cam=cam, tgt=tgt, material=mats['flake'], seed=8, near=0.3)
    lib.SNOWS.append(sn)
    hearth(45, (1.6, 2.6, 0.8))
    k = light('AREA', 'coldkey', (-0.95, 0.0, 1.75), 15, color=(0.66, 0.76, 1.0), size=0.5); aim(k, (-0.36, 0.25, 1.15))
    R['glass'].data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.05
    d, dp = R['doll'], R['dparts']
    bpy.context.view_layer.update()
    ring_tube('redloop', d)
    trail = lib.tube('redline', [V((0, 0, k * 1e-3)) for k in range(50)], 0.0016, mats['red'])
    kr, kp = lib.knitter('knitter', (-0.47, 0.64, 0.0), mats, seated=False)
    A = actor(kr, kp)
    kr.rotation_euler = (0, 0, 0.12)

    T_DOWN, T_STRAIGHT, T_OPEN = 78, 104, 122
    hover = SILL + V((0.03, 0.17, 0.16))
    def doll_loc(f):
        a = V((-0.36, 0.25, 1.17)).lerp(hover, ss(f, -10, 46))
        p = a.lerp(SILL, ss(f, 40, T_DOWN))
        p.z -= 0.0015 * ss(f, T_DOWN - 2, T_DOWN + 2)                # wool gives a little when it lands
        return p
    def doll_rot(f):
        tip = 0.16 * (1 - ss(f, 44, T_DOWN))
        return Euler((tip, 0.06 * (1 - ss(f, 30, T_DOWN)), 0.30 - 0.18 * ss(f, 10, 60) - 0.12 * ss(f, T_STRAIGHT - 14, T_STRAIGHT)))
    where = lambda f: rigid(doll_loc(f), doll_rot(f))
    g = {s: hold_doll(A, s) for s in (1, -1)}
    rest = {1: rigid(V((-0.2, 0.34, 1.0)), hand_rot((0.1, -0.4, -1), (-0.4, 0.2, 0))), -1: rigid(V((-0.62, 0.36, 1.0)), hand_rot((-0.1, -0.4, -1), (0.4, 0.2, 0)))}
    H = {s: Hold(A, s, g[s], where, rest[s], (-60, -40, -30, -20), (T_OPEN, T_OPEN + 16, T_OPEN + 36), back=0.045,
                 pole=(s * 0.6, 0.45, -0.8)) for s in (1, -1)}
    # the hand on its head
    P0, P1, P2, P3 = T_OPEN + 36, T_OPEN + 60, T_OPEN + 84, T_OPEN + 104
    head_where = lambda f: where(f)
    gh = A.hand[-1].grasp(sd_doll(('head',)), hand_rot((0.35, -1, -0.25), (0.25, 0.0, -1)), (-0.012, 0.012, 0.325), close=(0.9, 0.7), thumb=((0.3, 0.4, 0), (0.0, 0.3, 0)))
    HH = Hold(A, -1, gh, where, rest[-1], (P0, P1 - 8, P1, P1 + 6), (P2, P2 + 12, P3 + 20), back=0.05, pole=(-0.9, 0.35, -0.4),
              via=rigid(V((-0.68, 0.40, 1.50)), hand_rot((0.3, -1, -0.1), (0.2, 0, -1))), rest2=rigid(V((-0.6, 0.46, 1.3)), hand_rot((0.3, -1, -0.1), (0.2, 0, -1))), rest_pose=OPEN)

    def upd(f):
        kp['torso'].rotation_euler = (0.62 + 0.06 * ss(f, 20, T_DOWN) - 0.1 * ss(f, T_OPEN + 4, T_OPEN + 40) + 0.08 * ss(f, P0, P1) - 0.1 * ss(f, P2, P3), 0, -0.02)
        kp['hips'].rotation_euler = (0.1, 0, 0)
        kp['neck'].rotation_euler = (0.05, 0, 0)
        A.look(doll_loc(f) + V((0, 0, 0.2)))
        d.location = doll_loc(f); d.rotation_euler = doll_rot(f)
        a_ = where(f) @ V((0.02, 0.066, 0.108))
        e_ = V((a_.x + 0.03, 0.318, 1.0018))
        mid_ = lib.catenary(a_, e_, 0.02 + 0.3 * max(0.0, a_.y - 0.25), 24, lift=lambda q: 1.0018 if q.y < 0.322 else 0.0)
        lib.tube_update(trail, mid_ + [e_ + V((0.006 + 0.10 * (i / 25), 0.006 + 0.06 * (i / 25), -0.208 * (i / 25) ** 1.2)) for i in range(26)])
        held = 1 - ss(f, T_OPEN, T_OPEN + 14)
        doll_arms(dp, f, held)
        nod = ss(f, P1 - 2, P1 + 4) * (1 - ss(f, P2, P2 + 8))
        dp['headpiv'].rotation_euler = (0.0, 0, 0)
        dp['tuft'].rotation_euler = (0.35 * math.sin(f * 0.9) * math.exp(-max(0, f - T_DOWN) / 7.0) * (f > T_DOWN) + 0.5 * nod, 0, 0)
        H[1].set(f)
        (HH if f >= P0 else H[-1]).set(f)
    lib.FRAME_FNS.append(upd)
    report(A, [H[1], H[-1]], where, sd_doll(('body',)))
    report(A, [HH], where, sd_doll(('head',)))
    ev(T_DOWN, 'setdown', 1.0)
    ev(T_STRAIGHT - 12, 'wool_turn', 0.7)
    ev(T_OPEN + 1, 'cloth_let', 0.7)
    ev(P1, 'pat', 0.8)
    ev(P2 + 2, 'cloth_let', 0.4)
    lib.register_frames()
    return sc


def window_low():
    """the window's bottom rail a little lower, so the doll's feet can be seen from outside"""
    for o in bpy.data.objects:
        if o.name.startswith('iframe') and abs(o.location.z - 1.0) < 1e-3:
            o.location.z = 0.965; o.scale.z = 0.045


# ── the window, and her needles ────────────────────────────────────────────
class Knitting:
    """her hands at work: two needles, the piece hanging from them, the yarn. One stitch every `T` frames, always the same
    four moves: in (the right needle goes into the next loop, steel on steel), round (the right forefinger throws the yarn),
    through (it is drawn back with the new loop), off (the left needle is pulled out of the old one)."""
    ROWS, COLS, PITCH = 22, 16, 0.0056

    def __init__(self, A, mats, X0, T=26, f0=0, yarn_from=None, fine=True):
        self.A, self.T, self.f0, self.X0, self.fine = A, T, f0, V(X0), fine
        self.grip = {s: act.rod_grip(A.hand[s], slant=0.75) for s in (1, -1)}
        self.dir = {s: V((-s * 0.84, -0.40, 0.26)).normalized() for s in (1, -1)}
        L = self.L = 0.25
        self.nd = {}
        for s in (1, -1):
            e = empty(f'knr{s}')
            for o in (prim('cone', f'kn{s}', material=mats['needle'], vertices=14, radius1=0.0026, radius2=0.0024, depth=L),
                      prim('cone', f'knt{s}', loc=(0, 0, L / 2 + 0.009), material=mats['needle'], vertices=14, radius1=0.0024, radius2=0.0004, depth=0.018),
                      prim('sphere', f'knb{s}', loc=(0, 0, -L / 2), scale=(0.006, 0.006, 0.006), material=mats['darkwood'], segments=14, ring_count=8)):
                parent(o, e, keep=False)
            self.nd[s] = e
        self.yarn_from = yarn_from
        pts = 10 * self.COLS + 1
        self.rows = [lib.tube(f'kr{r}', [V((i * 1e-3, 0, r * 1e-3)) for i in range(pts)], 0.0017, mats['wool_grey'], 6) for r in range(self.ROWS)] if fine else []
        self.loops = [lib.tube(f'kl{i}', [V((0, 0, k * 1e-3)) for k in range(13)], 0.0016, mats['wool_grey'], 6) for i in range(self.COLS)] if fine else []
        self.yarn = lib.tube('kyarn', [V((0, 0, k * 1e-3)) for k in range(40)], 0.0016, mats['wool_grey'], 6) if yarn_from is not None else None

    def phase(self, f):
        x = (f - self.f0) / self.T
        return math.floor(x), x - math.floor(x)

    def needle(self, s, f):
        """tip and direction of a needle"""
        n, p = self.phase(f)
        d = self.dir[s].copy()
        X = self.X0 + V((0, 0, 0.004 * math.sin(f * 0.11)))
        if s == -1:
            go = ss(p, 0.0, 0.2) - ss(p, 0.52, 0.70)
            dip = ss(p, 0.02, 0.2) - ss(p, 0.5, 0.72)
            up = ss(p, 0.5, 0.64) - ss(p, 0.74, 0.98)
            d = (d + V((0, 0.10, -0.16)) * dip + V((0, 0, 0.16)) * up).normalized()
            tip = X + V((0.001, -0.006 * dip + 0.004, -0.006 * dip + 0.010 * up)) + d * (-0.006 + 0.022 * go)
            # while the yarn is thrown the whole hand goes round a little
            th = ss(p, 0.22, 0.5) * 2 * math.pi
            r = 0.005 * math.sin(math.pi * ss(p, 0.22, 0.5))
            tip = tip + V((0, math.cos(th) * r, math.sin(th) * r))
        else:
            off = ss(p, 0.72, 0.82) - ss(p, 0.86, 1.0)
            d = (d + V((0, 0.05, 0.05)) * off).normalized()
            tip = X + d * (0.012 - 0.015 * off)
        return tip, d

    def hand_m(self, s, f):
        tip, d = self.needle(s, f)
        # the hand's frame from the needle it holds: needle along the grip's own direction, the back of the hand up and out
        g = self.grip[s][3]
        up = V((s * 0.35, 0.3, 1.0))
        x = (up - d * up.dot(d)).normalized()
        W = Matrix((x, d, x.cross(d))).transposed()
        gx = V((1, 0, 0))
        R = W @ Matrix((gx, g, gx.cross(g)))
        at = tip - d * 0.112
        return Matrix.Translation(at - R @ self.grip[s][1]) @ R.to_4x4()

    def right_pose(self, f):
        n, p = self.phase(f)
        k = math.sin(math.pi * ss(p, 0.2, 0.54))
        pose = self.grip[-1][0]
        fl = list(pose['f']); a, b, sp = fl[0]
        fl[0] = (a - 0.75 * k, b - 0.5 * k, sp + 0.12 * k)
        return {'f': fl, 't': pose['t']}

    def set(self, f):
        A = self.A
        n, p = self.phase(f)
        tip, d = {}, {}
        for s in (1, -1):
            tip[s], d[s] = self.needle(s, f)
            self.nd[s].location = tip[s] - d[s] * (self.L / 2 + 0.018)
            self.nd[s].rotation_euler = d[s].to_track_quat('Z', 'Y').to_euler()
            A.hand[s].pose(self.right_pose(f) if s == -1 else self.grip[s][0])
            A.arm(s, self.hand_m(s, f), (s * 0.62, 0.3, -0.75))
        if not self.fine:
            return
        C = self.COLS; half = C // 2; P = self.PITCH
        top = [tip[-1] - d[-1] * (0.012 + (half - 1 - i + p) * P) for i in range(half)]      # her right needle: farthest first
        top += [tip[1] - d[1] * (0.012 + (j + 1 - p) * P) for j in range(half)]
        # the piece swings a little behind the hands
        b0, b1 = self.needle(-1, f - 3)[0], self.needle(1, f - 3)[0]
        lag = np.array(((b0 + b1) - (tip[1] + tip[-1])) / 2)
        mid = (top[half - 1] + top[half]) / 2
        T = np.array([list(v) for v in top])
        uu = (np.arange(C) - (C - 1) / 2) * P * 0.98
        rows = np.zeros((self.ROWS, C, 3))
        for r in range(self.ROWS):
            k = 1 - math.exp(-r / 3.0)
            base = np.array([mid.x, mid.y - 0.010, mid.z - 0.008])
            tgt = np.stack([base[0] + uu, np.full(C, base[1]) + 0.006 * np.sin(uu * 90 + r * 0.25) * k, np.full(C, base[2])], 1)
            q = T * (1 - k) + tgt * k
            q[:, 2] = T[:, 2] * (1 - k) + base[2] * k - r * 0.0049 - 0.006
            rows[r] = q + lag * (r / self.ROWS) ** 1.5 * 1.6
        self._knit(rows)
        for i in range(C):                                                                   # loops over the needles
            s = -1 if i < half else 1
            c = np.array(top[i]); dd = np.array(d[s])
            side = np.cross(dd, [0, 0, 1.0]); side /= np.linalg.norm(side); upv = np.cross(side, dd)
            pts = []
            for k in range(13):
                a = math.pi * (-0.28 + 1.56 * k / 12)
                pts.append(V(c + (side * math.cos(a) + upv * math.sin(a)) * 0.0046 + dd * (0.0012 * (k / 12 - 0.5))))
            pts[0] = V(rows[0][i] + side * 0.001); pts[-1] = V(rows[0][i] - side * 0.001)
            lib.tube_update(self.loops[i], pts)
        if self.yarn:
            Mw = self.hand_m(-1, f)
            pad = Mw @ V(A.hand[-1].tips(self.right_pose(f))[0]) + Mw.to_3x3() @ V((0.008, 0, 0))
            th = ss(p, 0.24, 0.52) * 2 * math.pi
            e = tip[-1] - d[-1] * 0.006 + V((0, math.cos(th), math.sin(th))) * 0.004 * math.sin(math.pi * ss(p, 0.24, 0.52))
            a2 = lib.catenary(pad, V(self.yarn_from), 0.05, 27, lift=lambda q: 0.7935)
            lib.tube_update(self.yarn, lib.catenary(e, pad, 0.004, 14) + a2[1:])

    def _knit(self, rows):
        C = self.COLS
        t = np.arange(10 * C + 1) / 10.0                  # in stitches
        x = t - 0.5 + 0.24 * np.sin(4 * np.pi * t)
        vy = -0.62 * np.cos(2 * np.pi * t)                # up and down through the rows
        zz = np.cos(4 * np.pi * t) * 0.0011
        xi = np.clip(x, 0, C - 1.0001); i0 = xi.astype(int); fx = (xi - i0)[:, None]
        ext = x - xi
        for r in range(self.ROWS):
            rr = np.clip(r + 0.5 + vy, 0, self.ROWS - 1.0001); r0 = rr.astype(int); fr = (rr - r0)[:, None]
            r1 = np.minimum(r0 + 1, self.ROWS - 1)
            a = rows[r0, i0] * (1 - fx) + rows[r0, i0 + 1] * fx
            b = rows[r1, i0] * (1 - fx) + rows[r1, i0 + 1] * fx
            q = a * (1 - fr) + b * fr
            q[:, 0] += ext * self.PITCH
            q[:, 1] += zz
            lib.tube_update(self.rows[r], [V(v) for v in q])

    def events(self, frames, vol=1.0, pan=0.0):
        n = 0
        while self.f0 + n * self.T <= frames:
            a = self.f0 + n * self.T
            for p, kind, v in ((0.19, 'needle_in', 0.9), (0.36, 'yarn', 0.5), (0.60, 'needle_draw', 0.5), (0.80, 'needle_off', 0.8)):
                f = a + p * self.T
                if 1 <= f <= frames:
                    ev(f, kind, v * vol, pan, n=n)
            n += 1


def needle_mat():
    m = M()
    if 'needle' not in m:
        lib.mat('needle', (0.55, 0.55, 0.57), rough=0.3, metal=0.9, spec=0.8)
        m = M()
    return m


@shot(exposure=0.9)
def I2(out, preview):
    """the window, close: snow streaming past the glass; inside, her silhouette at her needles against the warm room, the
    spinning wheel beside her"""
    N = 120
    sc = begin(N, out, preview, origin=(-1.5, 0, 1.4))
    cam, tgt = camera(52, ((-1.0, -4.9, 1.68), (-1.55, 0.2, 1.55), 5.0), ((-1.4, -3.75, 1.62), (-1.55, 0.2, 1.55), 3.85), N, fstop=4.0)
    sets.exterior(sc, cam, tgt, storm=True, snow_box=((-8, -9, -0.3), (5, -0.25, 4.5)), snow_n=7000, window_alpha=0.14, snow_width=0.006)
    lib.SNOWS[-1].streak = 0.04
    mats = needle_mat()
    kr, kp = lib.knitter('knitter_in', (-1.45, 1.05, 0.33), mats, seated=True)
    A = actor(kr, kp)
    prim('cube', 'stool_in', loc=(-1.45, 1.2, 0.57), scale=(0.2, 0.2, 0.24), material=mats['darkwood'])
    sets.spinning_wheel('wheel_in', (-0.4, 1.8, 0.25), mats)
    K = Knitting(A, mats, kr.location + V((0, -0.34, 0.93)), T=26, f0=-9, fine=False)
    sw = prim('cube', 'swatch', scale=(0.05, 0.003, 0.055), material=mats['wool_grey'])

    def upd(f):
        kp['torso'].rotation_euler = (0.3 + 0.015 * math.sin(f * 0.13), 0, 0.02 * math.sin(f * 0.21))
        kp['head'].rotation_euler = (0.22 + 0.03 * math.sin(f * 0.07), 0, 0.05 * math.sin(f * 0.05))
        K.set(f)
        sw.location = K.X0 + V((0, 0.006, -0.07)); sw.rotation_euler = (0, 0.05 * math.sin(f * 0.24), 0)
    lib.FRAME_FNS.append(upd)
    K.events(N, 0.22)
    lib.register_frames()
    return sc


@shot(exposure=1.0)
def I2K(out, preview):
    """her hands, close: stitch after stitch, the grey piece hanging from the needles"""
    N = 156
    sc = begin(N, out, preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    X0 = V((0.0, 0.77, 0.955))
    cam, tgt = camera(50, ((0.20, 0.23, 1.10), X0 + V((0.0, 0.0, -0.028))), ((0.10, 0.28, 1.09), X0 + V((0, 0, -0.03))), N, fstop=5.0)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sit', knitter_on=False, outside_snow=False, **TABLE)
    R['doll'].location = (0.28, 0.62, 0.804); R['doll'].rotation_euler = (0, 0, -0.6)
    mats = needle_mat()
    hearth(60, (-1.3, 2.4, 0.9))
    R['candle']['light'].data.energy = 7.0
    k = light('AREA', 'workkey', (0.55, 0.25, 1.55), 5.0, color=(1.0, 0.72, 0.45), size=0.3); aim(k, X0)
    kr, kp = lib.knitter('knitter', (0.0, 1.12, 0.0), mats, seated=True)
    prim('cube', 'kstool', loc=(0, 1.22, 0.24), scale=(0.22, 0.2, 0.24), material=mats['darkwood'])
    A = actor(kr, kp)
    ball = prim('sphere', 'yarnball_t', loc=(-0.2, 0.62, 0.835), scale=(0.045, 0.045, 0.045), material=mats['wool_grey'], segments=32, ring_count=20)
    K = Knitting(A, mats, X0, T=26, f0=-6, yarn_from=(-0.18, 0.64, 0.868))

    def upd(f):
        kp['torso'].rotation_euler = (0.34 + 0.012 * math.sin(f * 0.13), 0, 0.0)
        kp['neck'].rotation_euler = (0.2, 0, 0)
        kp['head'].rotation_euler = (0.2 + 0.02 * math.sin(f * 0.09), 0, 0)
        ball.rotation_euler = (0.25 * math.sin(f * 0.05), f * 0.03, 0)
        K.set(f)
    lib.FRAME_FNS.append(upd)
    REPORT.append(lambda f: {s: (True, A.hand[s].gap(K.grip[s][0], Matrix.Identity(4), K.grip[s][2])) for s in (1, -1)})
    K.events(N, 1.0)
    lib.register_frames()
    return sc


# ── the table: the eye, the dark, the thread ───────────────────────────────
SPOOL = V((0.62, 0.72, 0.79))


def over(p):
    """the top of whatever is under a thread in the corner by the window"""
    if p.y < 0.322 and abs(p.x) < 0.75:
        return 1.0018
    if -0.3 < p.x < 1.0 and 0.338 < p.y < 0.80:
        return 0.7918
    return 0.002


def seated(mats, y=1.12, x=0.0):
    kr, kp = lib.knitter('knitter', (x, y, 0.0), mats, seated=True)
    prim('cube', 'kstool', loc=(x, y + 0.1, 0.24), scale=(0.22, 0.2, 0.24), material=mats['darkwood'])
    return kr, kp, actor(kr, kp)


def ring_tube(name, d, lift=0.0022, r=0.0017, n=64, off=-0.004):
    """a turn of red thread round the doll's waist, fixed to it"""
    pts = [p for p, _ in lib.doll_ring((0.05, 0, 1), off, lift, n)]
    t = lib.tube(name, pts + [pts[0]], r, M()['red'])
    parent(t, d, keep=False)
    return t


@shot(exposure=1.0)
def I3(out, preview):
    """the table by candlelight, from above: the doll on its back between her hands; the needle goes in under its button eye,
    she lets go of it, takes it by the point on the other side, and draws the red thread through, three times"""
    N = 210
    sc = begin(N, out, preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    D0 = Matrix.Translation(V((-0.02, 0.43, 0.8485))) @ Euler((-math.pi / 2 + 0.075, 0, 0.06)).to_matrix().to_4x4()
    hc = D0 @ V(lib.DOLL_HEAD[0])
    cam, tgt = camera((46, 46), ((0.17, 0.20, 1.35), hc + V((-0.010, 0.022, 0.030))), ((0.11, 0.24, 1.30), hc + V((-0.010, 0.026, 0.032))), N, fstop=5.6)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='lying', knitter_on=False, outside_snow=False, **TABLE)
    mats = needle_mat()
    kr, kp, A = seated(mats, y=1.0, x=-0.02)
    d, dp = R['doll'], R['dparts']
    hearth(80, (-1.2, 2.6, 0.9))
    k = light('AREA', 'workkey', (0.45, 0.35, 1.6), 5.5, color=(1.0, 0.72, 0.45), size=0.25); aim(k, hc)

    T = 66                                     # frames of one stitch
    F0 = 8
    # in the doll's frame: in on one side of the button, out on the other
    def on_face(x, z):
        c, r = lib.DOLL_HEAD
        y = -r[1] * math.sqrt(max(0, 1 - ((x - c[0]) / r[0]) ** 2 - ((z - c[2]) / r[2]) ** 2))
        return V((x, y, z))
    Ain, Bout = on_face(-0.051, 0.251), on_face(-0.009, 0.259)
    L = 0.105
    u0 = (Bout - Ain).normalized()
    needle = empty('needle')
    parent(prim('cone', 'needle_b', loc=(0, 0, -L * 0.40), material=mats['needle'], vertices=12, radius1=0.0011, radius2=0.0012, depth=L * 0.8), needle, keep=False)
    parent(prim('cone', 'needle_p', loc=(0, 0, -0.008), material=mats['needle'], vertices=12, radius1=0.0012, radius2=0.0002, depth=0.016), needle, keep=False)
    parent(prim('torus', 'needle_e', loc=(0, 0, -L * 0.8 - 0.004), rot=(math.pi / 2, 0, 0), major_radius=0.0026, minor_radius=0.0008, material=mats['needle']), needle, keep=False)
    EYE = L * 0.8 + 0.004
    thread = lib.tube('stitch', [V((0, 0, k * 1e-3)) for k in range(30)], 0.0012, mats['red'])
    # the thread that is already in: a short way under the button on each side
    done = [lib.tube(f'done{k}', [V((0, 0, j * 1e-3)) for j in range(8)], 0.0012, mats['red']) for k in range(3)]
    for k, t in enumerate(done):
        o = V((0, 0, 0.004 * (k - 1)))
        a, b = Ain + o, Ain + o + V((0.012, 0, 0))
        lib.tube_update(t, [on_face(a.x + (b.x - a.x) * j / 7, a.z) + V((0, -0.001, 0)) for j in range(8)])
        parent(t, d, keep=False)

    def tug(f):
        n, p = divmod(f - F0, T)
        p = p / T
        return 1.0 if f < F0 else 0.0 + (math.sin(math.pi * ss(p, 0.70, 0.86)) if f >= F0 else 0)

    def dollm(f):
        t = 0.0 if f < F0 else tug(f)
        push = math.sin(math.pi * ss(((f - F0) % T) / T, 0.14, 0.34)) if f >= F0 else 0
        return D0 @ rigid((0, 0, 0), (-0.018 * t + 0.010 * push, 0.015 * t, 0.02 * t))

    def state(f):
        """needle: tip and direction (world), where along it she holds it (from the tip), is she holding"""
        n = math.floor((f - F0) / T); p = ((f - F0) / T) - n
        W = dollm(f)
        Wr = W.to_3x3()
        ain, u = W @ Ain, (Wr @ u0).normalized()
        up = V((0, 0, 1))
        # waiting in the air: thread drawn out, the needle turned back toward the eye
        wait_tip = ain - u * 0.05 + up * 0.055 + V((0, 0.02, 0)); wait_u = (u + up * -0.55).normalized()
        pre_tip = ain - u * 0.012 + up * 0.004; pre_u = (u + up * -0.10).normalized()
        in_tip = W @ Bout + u * 0.022
        out_tip = in_tip + u * 0.075 + up * 0.012
        far_tip = hc + V((0.085, 0.045, 0.135)); far_u = V((0.62, 0.25, 0.74)).normalized()
        rear, front = L * 0.8 - 0.006, 0.011
        if p < 0.14 or n < 0:
            k = ss(p, 0.0, 0.14) if n >= 0 else 0
            tip, uu, g = wait_tip.lerp(pre_tip, k), wait_u.lerp(pre_u, k), rear
        elif p < 0.34:
            k = ss(p, 0.14, 0.32)
            tip, uu, g = pre_tip.lerp(in_tip, k), pre_u.lerp(u, min(1, k * 2)), rear
        elif p < 0.50:
            tip, uu, g = in_tip, u, (rear if p < 0.42 else front)
        elif p < 0.72:
            k = ss(p, 0.50, 0.72)
            q = in_tip.lerp(out_tip, k).lerp(out_tip.lerp(far_tip, k), k)
            tip, uu, g = q, u.lerp(far_u, ss(p, 0.58, 0.72)), front
        else:
            k = ss(p, 0.80, 1.0)
            h = V((0.0, 0.03, 0.06)) * math.sin(math.pi * k)
            pull = math.sin(math.pi * ss(p, 0.70, 0.86)) * 0.006
            tip = far_tip.lerp(wait_tip, k) + h + far_u * pull
            uu, g = far_u.lerp(wait_u, k), front + (rear - front) * ss(p, 0.84, 0.97)
        return tip, uu.normalized(), g, p, n

    # her right hand
    H = A.hand[-1]
    pose, pin, gap = act.pinch(H, 0.0013)
    print('REPORT pinch needle gap mm', gap * 1000)
    openp = mix(pose, {'f': [(0.5, 0.35, 0.03)] + pose['f'][1:], 't': OPEN['t']}, 0.8)
    R_rear = hand_rot((0.72, -0.45, -0.52), (0.5, 0.15, -0.8))
    R_front = hand_rot((0.35, -0.55, -0.75), (0.75, 0.35, -0.1))

    def right(f):
        tip, uu, g, p, n = state(f)
        at = tip - uu * g
        Rk = ss(p, 0.38, 0.48) - ss(p, 0.84, 0.99) if n >= 0 else 0.0
        q = R_rear.to_quaternion().slerp(R_front.to_quaternion(), Rk).to_matrix()
        pp = pose
        if n >= 0 and 0.34 < p < 0.50:
            # lets go, over the button, down on the point again
            rear_at, front_at = tip - uu * (L * 0.8 - 0.006), tip - uu * 0.011
            k = ss(p, 0.355, 0.485)
            at = rear_at.lerp(front_at, k) + V((-0.006, 0.012, 0.030)) * math.sin(math.pi * k)
            o = ss(p, 0.335, 0.37) - ss(p, 0.462, 0.50)
            pp = mix(pose, openp, o)
        M_ = Matrix.Translation(at - q @ pin) @ q.to_4x4()
        return M_, pp

    # her left hand cups its head the whole time
    gl = A.hand[1].grasp(sd_doll(('head',)), hand_rot((-0.15, 0.2, -1), (-1, 0.10, -0.1)), (0.084, 0.012, 0.262), close=(0.9, 0.7), thumb=((0.25, 0.6, 0), (0, 0.4, 0)))
    HL = Hold(A, 1, gl, dollm, rigid((0.3, 0.8, 0.9)), (-9, -8, -7, -6), pole=(0.95, 0.5, -0.1))

    def upd(f):
        kp['hips'].rotation_euler = (0.06, 0, 0)
        kp['torso'].rotation_euler = (0.46 + 0.015 * math.sin(f * 0.05), 0, 0.10)
        kp['neck'].rotation_euler = (0.2, 0, 0); kp['head'].rotation_euler = (0.24, 0, 0.03 * math.sin(f * 0.06))
        W = dollm(f)
        d.matrix_world = W
        for s in (-1, 1):
            dp[f'arm{s}'].rotation_euler = (0.0, -s * 0.6, 0)
        tip, uu, g, p, n = state(f)
        needle.location = tip; needle.rotation_euler = uu.to_track_quat('Z', 'Y').to_euler()
        eye = tip - uu * EYE
        b = W @ Bout
        # the thread: from where it last came out of the wool to the needle's eye; on the way in, through
        if n >= 0 and 0.14 <= p < 0.5:
            src = W @ (Ain + V((0, -0.001, 0.004)))
            slack = 0.085
        elif n >= 0 and 0.5 <= p < 0.86:
            src = b
            slack = 0.0
        else:
            src = W @ (Ain + V((0, -0.001, 0.004))) if n < 0 or p < 0.14 else b
            slack = 0.10 * (ss(p, 0.82, 1.0) if n >= 0 and p > 0.5 else 1.0)
        dist = (eye - src).length
        sag = math.sqrt(max(0.0, slack * slack)) * 0.6
        def lift(q):
            # over the doll's face, never through it
            l = W.inverted() @ q
            c, r = lib.DOLL_HEAD
            e = ((l.x - c[0]) / r[0]) ** 2 + ((l.z - c[2]) / r[2]) ** 2
            zz = (W @ V((l.x, c[1] - r[1] * math.sqrt(max(0, 1 - e)) - 0.0015, l.z))).z if e < 1 else 0.7915
            return zz
        pts = lib.catenary(src, eye, sag, 30, lift=lift)
        pts[0] = src
        if n >= 0 and 0.5 <= p < 0.86 and (tip - b).dot(uu) < EYE:
            # the eye is still inside the wool: nothing shows outside yet
            pts = [b + (eye - b) * 0.0 + V((0, 0, -0.004 - 1e-4 * j)) for j in range(30)]
        lib.tube_update(thread, pts)
        M_, pp = right(f)
        A.arm(-1, M_, (-0.8, 0.5, -0.35)); A.hand[-1].pose(pp)
        HL.set(f)
    lib.FRAME_FNS.append(upd)
    report(A, [HL], dollm, sd_doll(('head',)))

    def rep(f):
        tip, uu, g, p, n = state(f)
        M_, pp = right(f)
        held = not (n >= 0 and 0.335 < p < 0.50)
        a, b = M_.inverted() @ tip, M_.inverted() @ (tip - uu * EYE)
        return {-1: (held, A.hand[-1].gap(pp, Matrix.Identity(4), sd_capsule(a, b, 0.0013)))}
    REPORT.append(rep)
    for n in range(4):
        b = F0 + n * T
        for p, kind, v in ((0.17, 'stab', 0.8), (0.30, 'needle_wool', 0.5), (0.485, 'pinch', 0.4), (0.52, 'thread_draw', 0.9), (0.745, 'thread_taut', 0.8)):
            f = b + p * T
            if f <= N:
                ev(f, kind, v, dur=(0.72 - 0.52) * T / 24 if kind == 'thread_draw' else None)
    lib.register_frames()
    return sc


@shot(exposure=0.9)
def I4(out, preview):
    """over her shoulder to the window: the candle flame bends toward the glass, frost creeps across it, and she lifts her
    head to the dark outside"""
    N = 144
    sc = begin(N, out, preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = camera((30, 32), ((0.66, 2.05, 1.26), (-0.06, 0.0, 1.27)), ((0.6, 1.9, 1.25), (-0.06, 0.0, 1.34)), N, fstop=4)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='lying', knitter_on=False, **TABLE)
    mats = needle_mat()
    kr, kp, A = seated(mats, y=0.98)
    d, dp = R['doll'], R['dparts']
    D0 = Matrix.Translation(V((-0.02, 0.43, 0.8485))) @ Euler((-math.pi / 2 + 0.075, 0, 0.06)).to_matrix().to_4x4()
    hearth(90)
    fl = R['candle']['flame']; cl = R['candle']['light']
    fl.visible_shadow = False                  # it used to shade its own light until it bent, and the room lit up in two frames
    keys(fl, 'rotation_euler', [(1, (0, 0, 0)), (50, (0, 0, 0)), (78, (-0.55, 0, 0)), (110, (-0.7, 0, 0)), (144, (-0.6, 0, 0))])
    keys(fl, 'scale', [(1, (0.006, 0.006, 0.016)), (50, (0.006, 0.006, 0.016)), (90, (0.005, 0.005, 0.024)), (144, (0.004, 0.004, 0.02))])
    light_keys(cl, [(1, 7.0), (50, 7.0), (90, 4.0), (144, 3.0)])
    b = [n for n in R['glass'].data.materials[0].node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    node_keys(b.inputs['Alpha'], [(1, 0.18), (55, 0.2), (140, 0.62)])
    node_keys(b.inputs['Emission Strength'], [(1, 0.05), (140, 0.35)])
    where = lambda f: D0
    gl = A.hand[1].grasp(sd_doll(('head',)), hand_rot((-0.15, 0.2, -1), (-1, 0.10, -0.1)), (0.084, 0.012, 0.262), close=(0.9, 0.7), thumb=((0.25, 0.6, 0), (0, 0.4, 0)))
    HL = Hold(A, 1, gl, where, rigid((0.3, 0.8, 0.9)), (-9, -8, -7, -6), pole=(0.9, 0.5, -0.5))
    gr = A.hand[-1].grasp(sd_doll(('body',)), hand_rot((0.2, 0.4, -1), (0.75, 0.65, 0)), (-0.062, -0.028, 0.16), close=(0.9, 0.8))
    HR = Hold(A, -1, gr, where, rigid((-0.3, 0.8, 0.9)), (-9, -8, -7, -6), pole=(-0.9, 0.5, -0.5))

    def upd(f):
        up = ss(f, 62, 108)
        kp['hips'].rotation_euler = (0.18, 0, 0)
        kp['torso'].rotation_euler = (0.55 - 0.10 * up + 0.012 * math.sin(f * 0.16), 0, 0.04)
        kp['neck'].rotation_euler = (0.15 - 0.25 * up, 0, 0)
        kp['head'].rotation_euler = (0.25 - 0.5 * up, 0, 0.10 * up)
        d.matrix_world = D0
        for s in (-1, 1):
            dp[f'arm{s}'].rotation_euler = (0.0, -s * 0.6, 0)
        HL.set(f); HR.set(f)
    lib.FRAME_FNS.append(upd)
    report(A, [HL], where, sd_doll(('head',))); report(A, [HR], where, sd_doll(('body',)))
    ev(52, 'flame_bend', 0.8)
    ev(58, 'frost', 0.7)
    ev(72, 'breath', 0.8)
    lib.register_frames()
    return sc


@shot(exposure=1.0)
def I5(out, preview):
    """the doll stands on the table in her left hand; her right draws the red thread tight round it, lets the end go, takes
    its other side, and the two hands lift it up out of the frame"""
    N = 204
    sc = begin(N, out, preview, pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = camera(44, ((0.40, 0.12, 1.27), (-0.035, 0.60, 0.955)), ((0.31, 0.10, 1.27), (-0.025, 0.61, 0.985)), N, fstop=4.5)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sit', knitter_on=False, outside_snow=False, **TABLE)
    mats = M()
    kr, kp, A = seated(mats, y=0.99)
    hearth(80, (-1.2, 2.6, 0.9))
    k = light('AREA', 'workkey', (0.6, 0.12, 1.5), 5.0, color=(1.0, 0.72, 0.45), size=0.25); aim(k, (0, 0.6, 0.95))
    d, dp, spool = R['doll'], R['dparts'], R['spool']
    P0 = V((-0.02, 0.60, 0.8045))
    T_PULL0, T_TIGHT, T_TUG, T_LET, T_HOLD, T_LIFT = 10, 62, 80, 96, 132, 146

    def lift_k(f):
        return ss(f, T_LIFT, N + 24)

    def where(f):
        tug = math.sin(math.pi * ss(f, T_TIGHT - 6, T_TIGHT + 6)) + 0.8 * math.sin(math.pi * ss(f, T_TUG - 4, T_TUG + 6))
        kk = lift_k(f)
        loc = P0 + V((0.0, 0.06, 0.30)) * kk + V((-0.004, 0, 0)) * tug
        return rigid(loc, (0.02 * kk, -0.018 * tug, 0.34 - 0.2 * kk))
    KNOT = lib.doll_ring((0.05, 0, 1), -0.004, 0.0022, 64)
    iK = min(range(64), key=lambda i: (KNOT[i][0] - V((-0.052, -0.05, 0.11))).length)
    iS = min(range(64), key=lambda i: (KNOT[i][0] - V((0.06, -0.035, 0.11))).length)
    ring = lib.tube('redloop', [V((0, 0, k * 1e-3)) for k in range(65)], 0.0017, mats['red'])
    tail = lib.tube('redtail', [V((0, 0, k * 1e-3)) for k in range(26)], 0.0016, mats['red'])
    line = lib.tube('redline', [V((0, 0, k * 1e-3)) for k in range(40)], 0.0016, mats['red'])
    knot = prim('sphere', 'redknot', scale=(0.0042, 0.0034, 0.0036), material=mats['red'], segments=14, ring_count=8)

    def loose(f):
        return 0.42 * (1 - ss(f, T_PULL0, T_TIGHT)) - 0.015 * (ss(f, T_TUG - 4, T_TUG + 2))

    def ring_pts(f):
        k = loose(f); W = where(f)
        out_ = []
        for i, (q, g) in enumerate(KNOT):
            sagz = -0.016 * k / 0.42 * (0.5 - 0.5 * math.cos(2 * math.pi * (i - iK) / 64))
            out_.append(W @ (q + V((g.x, g.y, 0)) * 0.062 * max(0.0, k) + g * min(0.0, k) * 0.06 + V((0, 0, sagz))))
        return out_
    # right hand: pinching the tail's end part, drawing it away from the knot
    H = A.hand[-1]
    pose, pin, gap = act.pinch(H, 0.0016)
    Rr = hand_rot((0.72, -0.60, -0.35), (0.45, 0.1, -0.9))

    def pin_at(f):
        W = where(f)
        kn = ring_pts(f)[iK]
        a = V((-0.075, -0.015, 0.045)); b = V((-0.185, 0.02, 0.085))
        k = ss(f, T_PULL0, T_TIGHT)
        tug = ss(f, T_TUG - 4, T_TUG + 2) - ss(f, T_TUG + 5, T_TUG + 14)
        base = (where(1) @ KNOT[iK][0])
        return base + a.lerp(b, k) + V((-0.018, 0.004, 0.008)) * tug

    def right_pull(f):
        return Matrix.Translation(pin_at(f) - Rr @ pin) @ Rr.to_4x4(), pose
    gl, gr = hold_doll(A, 1), hold_doll(A, -1)
    HL = Hold(A, 1, gl, where, rigid((0.3, 0.8, 0.9)), (-9, -8, -7, -6), pole=(0.95, 0.35, -0.15))
    letM, _ = right_pull(T_LET)
    print('REPORT pinch thread gap mm', gap * 1000)
    HR = Hold(A, -1, gr, where, letM, (T_LET + 3, T_HOLD - 12, T_HOLD, T_HOLD + 7), pole=(-0.95, 0.35, -0.15), back=0.05, rest_pose=mix(pose, OPEN, 0.5))

    def upd(f):
        kk = lift_k(f)
        kp['hips'].rotation_euler = (0.16, 0, 0)
        kp['torso'].rotation_euler = (0.56 + 0.04 * ss(f, 1, T_TIGHT) - 0.24 * kk, 0, 0.10 - 0.05 * ss(f, T_PULL0, T_TIGHT) + 0.06 * ss(f, T_LET, T_HOLD))
        kp['neck'].rotation_euler = (0.2, 0, 0)
        W = where(f)
        A.look(W @ V((0, 0, 0.14 + 0.1 * kk)))
        d.matrix_world = W
        for s in (-1, 1):
            h = 1.0 if s == 1 else ss(f, T_HOLD - 8, T_HOLD + 2)
            dp[f'arm{s}'].rotation_euler = (-0.15 * h, -s * (0.35 + 0.95 * h), 0)
        pts = ring_pts(f)
        lib.tube_update(ring, pts + [pts[0]])
        kn = pts[iK]
        knot.location = kn + (W.to_3x3() @ KNOT[iK][1]) * 0.002
        # the tail: taut to her fingers and a hand's breadth beyond them, then let go and fallen down its side
        if f <= T_LET + 2:
            p = pin_at(f)
            t = [kn.lerp(p, i / 15) + V((0, 0, -0.02 * (1 - ss(f, T_PULL0, T_PULL0 + 22)) * math.sin(math.pi * i / 15))) for i in range(16)]
            t += [p + V((-0.012 * i / 10 * 3, -0.01 * i / 10, -0.075 * (i / 10) ** 1.2)) for i in range(1, 11)]
        else:
            k = min(1.0, ((f - T_LET - 2) / 9.0) ** 2)
            p = pin_at(T_LET)
            t0 = [kn.lerp(p, i / 15) for i in range(16)] + [p + V((-0.012 * i / 10 * 3, -0.01 * i / 10, -0.075 * (i / 10) ** 1.2)) for i in range(1, 11)]
            g = W.to_3x3() @ KNOT[iK][1]
            hang = [kn + g * (0.004 + 0.006 * math.sin(min(1, i / 12) * math.pi)) + V((0, 0, -0.0058 * i)) for i in range(26)]
            sw = math.sin((f - T_LET) * 0.5) * math.exp(-(f - T_LET) / 14.0) * 0.012 * k
            t = [a.lerp(b, k) + V((sw * i / 25, sw * i / 25, 0)) for i, (a, b) in enumerate(zip(t0, hang))]
            for q in t:
                q.z = max(q.z, 0.7918)
        lib.tube_update(tail, t)
        a = pts[iS]; b = SPOOL + V((-0.024, 0, 0.04))
        sag = 0.10 * (1 - ss(f, T_PULL0, T_TIGHT)) + 0.03
        lib.tube_update(line, lib.catenary(a, b, sag + 0.02 * (1 - kk), 40, lift=over))
        spool.rotation_euler = (0, 0, -1.6 * ss(f, T_PULL0, T_TIGHT) - 9.0 * kk)
        if f <= T_LET + 3:
            M_, pp = right_pull(f)
            pp = mix(pp, mix(pose, OPEN, 0.5), ss(f, T_LET - 2, T_LET + 3))
            A.arm(-1, M_, (-0.8, 0.5, -0.4)); A.hand[-1].pose(pp)
        else:
            HR.set(f)
        HL.set(f)
    lib.FRAME_FNS.append(upd)
    report(A, [HL, HR], where, sd_doll(('body',)))
    REPORT.append(lambda f: {-1: (f < T_LET - 2, A.hand[-1].gap(pose, Matrix.Identity(4), sd_capsule(right_pull(f)[0].inverted() @ ring_pts(f)[iK], right_pull(f)[0].inverted() @ pin_at(f), 0.0016)))})
    ev(T_PULL0 + 8, 'thread_draw', 0.8, dur=(T_TIGHT - T_PULL0 - 10) / 24)
    ev(T_TIGHT, 'cinch', 0.9)
    ev(T_TUG, 'cinch', 0.6)
    ev(T_LET + 1, 'pinch', 0.3)
    ev(T_HOLD, 'take', 0.8)
    ev(T_LIFT + 8, 'lift', 0.7)
    ev(T_LIFT + 14, 'spool', 0.6, dur=(N - T_LIFT - 14) / 24)
    lib.register_frames()
    return sc


# ── the door and the walk ──────────────────────────────────────────────────
class Lantern:
    """the lantern in her right hand: the hand grips the top of the handle, the lantern hangs from it and swings with her steps"""
    def __init__(self, A, mats, energy):
        self.A = A
        self.root, self.light = lib.lantern('lantern', (0, 0, 0), mats, energy=energy)
        lib.stick(self.root, self.root)
        self.grip = act.rod_grip(A.hand[-1], r=0.004, half=0.02, z=-0.082)
        self.at = V((-0.235, -0.17, 0.865))

    def set(self, f, up=0.0, swing=(0.0, 0.0)):
        A = self.A
        W = A.W(A.root)
        # fingers down, palm to her thigh, the handle running fore and aft through the fist
        R = W.to_3x3() @ hand_rot((0.05, -0.25 - 0.6 * up, -1), (1, 0.1, 0))
        wrist = W @ (self.at + V((0.03, -0.10, 0.13)) * up + V((0, -0.10 * swing[0], 0.012 * abs(swing[0]))))
        M_ = Matrix.Translation(wrist) @ R.to_4x4()
        A.hand[-1].pose(self.grip[0])
        A.arm(-1, M_, W.to_3x3() @ V((-0.6, 0.8, -0.4)))
        rod = M_ @ self.grip[1]
        ax = (M_.to_3x3() @ V((0, 1, 0))); ax.z *= 0.25; ax.normalize()
        z = V((0, 0, 1))
        q = Matrix.Rotation(swing[0] * 0.35, 3, V((-ax.y, ax.x, 0)).normalized()) @ Matrix.Rotation(swing[1] * 0.22, 3, ax)
        x = ax
        y = z.cross(x).normalized(); x = y.cross(z)
        Rl = q @ Matrix((x, y, z)).transposed()
        self.root.matrix_world = Matrix.Translation(rod - Rl @ V((0, 0, 0.235))) @ Rl.to_4x4()
        return M_


def walk_events(w, frames, kind, vol=1.0, pan=lambda f: 0.0):
    for (f, foot, s) in w.strikes:
        if 1 <= f <= frames:
            ev(f, kind, vol, pan(f), foot=foot)


def belt(A):
    """where the grey thread is tied: at the back of her belt"""
    return A.W(A.P['hips']) @ V((0.02, 0.135, 0.11))


@shot(exposure=1.0)  # auto=7.0
def I6(out, preview):
    """the door: she walks to it with her lantern, lays her hand on it and pushes; the wind takes it out of her hand, snow comes
    in, the candle dies; she walks out into the white, the grey thread paying out from the latch to her belt"""
    N = 200
    sc = begin(N, out, preview, origin=(-2.2, 1.8, 0.9), pos_lo=(-6, -3, -1), pos_size=12.0)
    cam, tgt = camera(28, ((0.55, 3.2, 1.15), (-2.1, 1.76, 0.90)), ((-0.5, 2.72, 1.15), (-2.6, 1.70, 0.92)), N, fstop=6)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, outside_snow=False, **TABLE)
    R['doll'].location = SILL
    mats = M()
    kr, kp = lib.knitter('knitter', (-0.9, 2.4, 0.0), mats, seated=False)
    A = actor(kr, kp)
    L = Lantern(A, mats, 36)
    hearth(150, (2.2, 1.9, 1.2))
    bpy.data.objects.remove(bpy.data.objects['fogbox'])          # close to a lamp the haze is grain, and the grain crawls
    prim('cube', 'ilintel', loc=(-2.6, 1.68, 2.10), scale=(0.13, 0.62, 0.13), material=mats['darkwood'])
    prim('cube', 'ileftend', loc=(-2.62, 4.2, 1.3), scale=(0.12, 0.72, 1.35), material=mats['plank'])
    # outdoors: a snowfield, drifts against the step, the white dark beyond; the light of it comes from above the eaves, out of
    # her way (it used to stand in the doorway: walking through it she shut it off, and the whole door blinked black)
    g = prim('plane', 'osnow', loc=(-8.75, 1.7, -0.035), scale=(6, 9, 1), material=mats['snow'])
    lib.displace(g, 0.10, 1.2, subdiv=6, axis='Z')
    prim('cube', 'ostep', loc=(-2.98, 1.68, -0.06), scale=(0.30, 0.6, 0.06), material=mats['stone'])
    prim('plane', 'obackdrop', loc=(-13.5, 1.7, 4), rot=(0, math.radians(90), 0), scale=(9, 22, 1), material=lib.mat('obackdrop', (0.02, 0.02, 0.03), rough=1.0, emit=(0.30, 0.34, 0.42), estr=0.5))
    cold = light('AREA', 'doorcold', (-5.6, 0.2, 4.6), 0.0, color=(0.62, 0.72, 1.0), size=2.4); aim(cold, (-2.6, 1.7, 0.9))
    T_LATCH, T_PUSH, T_FREE, T_OPEN = 70, 74, 87, 100
    OUT0 = 91
    light_keys(cold, [(1, 0.0), (T_PUSH, 0.0), (T_OPEN, 420.0), (N, 420.0)])
    door = R['door']

    def door_a(f):
        a = 13 * ss(f, T_PUSH, T_FREE + 1) + 83 * (max(0.0, min(1.0, (f - T_FREE) / (T_OPEN - T_FREE))) ** 2)
        if f > T_OPEN:
            a = 96 - 9 * math.sin(math.pi * min(1.0, (f - T_OPEN) / 12.0)) * (f < T_OPEN + 12)
        a -= 46 * ss(f, 164, 190)
        return a
    where = lambda f: Matrix.Translation(door.location) @ Matrix.Rotation(math.radians(door_a(f)), 4, 'Z')
    path = act.Path([(-1.0, 2.5), (-1.6, 2.22), (-2.05, 2.0), (-2.3, 1.90), (-2.75, 1.72), (-3.6, 1.66), (-5.4, 1.62)])
    s_stop = min((abs(path.at(s)[0] + 2.27), s) for s in np.linspace(0, path.len, 800))[1]

    def gz(x, y):
        return 0.0 if x > -2.66 else (-0.0 if x > -3.28 else -0.045)
    W_ = act.Walk(A, path, [('go', -10, s_stop, 5, 15), ('go', OUT0, 2.95, 9, 13)], N, ground=gz, width=0.085, lift=0.05, first=1)
    # her left hand on the door
    gd = A.hand[1].grasp(sd_plane((1, 0, 0), 0.04), hand_rot((0.0, 0.45, 1), (-1, 0, 0)), (0.04, 0.56, 1.16), close=(0.5, 0.4), thumb=((0.2, 0.3, 0), (0, 0.2, 0)), opened=act.WIDE)

    def side(f, sw):
        return A.W(kr) @ rigid((0.235, -0.04 - 0.14 * sw, 0.80), hand_rot((0.0, -0.12 - 0.3 * sw, -1), (-1, 0.15, 0)))

    H = Hold(A, 1, gd, where, rigid((0, 0, 0)), (44, 60, 69, 73), (T_FREE, T_FREE + 6, T_FREE + 24), back=0.06, pole=(0.2, -0.5, -0.85), rest_pose=RELAX, freeze=True)
    sn = lib.Snow('snow_in', 2600, (-6.0, 0.4, 0.0), (-0.9, 3.0, 2.4), wind=(5.4, 0.2, -0.7), gust=0.6, streak=0.028, width=0.007, cam=cam, tgt=tgt, material=mats['flake'], seed=4, near=1.0)
    # the snow comes in through the open part of the door and no sooner, and spreads from there
    sn.front = lambda f: -2.7 + max(0.0, (f - T_FREE) * 0.11) if f > T_FREE else -50.0
    sn.keep = lambda p: (p[:, 0] < -2.75) | ((np.abs(p[:, 1] - 1.68) < 0.46 + (p[:, 0] + 2.6) * 0.75) & (p[:, 2] < 2.0 + 0.2 * (p[:, 0] + 2.6)))
    lib.SNOWS.append(sn)
    light_keys(R['candle']['light'], [(1, 7.0), (T_FREE, 7.0), (T_OPEN + 6, 0.0), (N, 0.0)])
    fl = R['candle']['flame']
    keys(fl, 'scale', [(1, (0.006, 0.006, 0.016)), (T_FREE, (0.006, 0.006, 0.016)), (T_OPEN, (0.003, 0.003, 0.02)), (T_OPEN + 6, (0.0001, 0.0001, 0.0001))])
    grey = lib.tube('greythread', [V((0, 0, k * 1e-3)) for k in range(40)], 0.0018, mats['grey_thread'])

    def upd(f):
        door.rotation_euler = (0, 0, math.radians(door_a(f)))
        bs, sp = W_.pose(f)
        lead = W_._i(W_.lead, f); car = W_._i(W_.car, f)
        lean = ss(f, 58, 72) * (1 - ss(f, T_FREE - 4, T_FREE + 8))
        t = kp['torso'].rotation_euler
        kp['torso'].rotation_euler = (t[0] + 0.10 * lean, t[1], t[2] - 0.10 * lean)
        # out of doors she bends into the wind
        out_ = ss(f, OUT0 + 10, OUT0 + 40)
        t = kp['torso'].rotation_euler
        kp['torso'].rotation_euler = (t[0] + 0.12 * out_, t[1], t[2])
        kp['head'].rotation_euler = (0.1 + 0.12 * out_, 0, 0.12 * ss(f, 40, 60) * (1 - ss(f, 92, 104)))
        sw = max(-1.0, min(1.0, lead / 0.16)) * min(1.0, abs(sp) / 0.3)
        H.rest = side(f, sw); H.rest2 = H.rest
        H.via2 = A.W(kr) @ rigid((0.40, -0.27, 0.98), hand_rot((0.0, -0.7, -0.6), (-1, 0.1, 0)))      # round her, not through her
        H.set(f)
        L.set(f, 0.0, (sw * 0.5, car * 0.8))
        FOOT[0] = W_.err
        latch = where(f) @ V((0.075, 0.86, 1.05))
        lib.tube_update(grey, lib.catenary(latch, belt(A), 0.10 + 0.22 * ss(f, 60, 190), 40, lift=lambda q: 0.004 if q.x > -2.66 else -0.03))
    lib.FRAME_FNS.append(upd)
    report(A, [H], where, sd_plane((1, 0, 0), 0.04))
    REPORT.append(lambda f: {-1: (True, A.hand[-1].gap(L.grip[0], Matrix.Identity(4), L.grip[2]))})
    for (f, foot, s) in W_.strikes:
        if 1 <= f <= N:
            x = path.at(s)[0]
            ev(f, 'step_wood' if x > -2.68 else 'step_snow', 1.0 if x > -2.68 else 0.8, -0.15 if x > -2 else -0.3)
            ev(f + 1, 'lantern', 0.35, 0.0)
    ev(69, 'palm_door', 0.8, -0.2); ev(T_LATCH + 1, 'latch', 1.0, -0.2)
    ev(T_PUSH, 'hinge', 0.8, -0.3, dur=(T_OPEN - T_PUSH) / 24)
    ev(T_FREE, 'gust', 1.0, -0.2); ev(T_OPEN, 'door_bang', 1.0, -0.3); ev(T_OPEN + 4, 'candle_out', 0.7)
    ev(164, 'hinge', 0.7, -0.3, dur=1.0)
    EVENTS.append({'f': T_FREE, 'kind': 'wind_open', 'vol': 1, 'pan': 0})
    lib.register_frames()
    return sc


def snow_rim(h):
    """the pit's edge, close to: the snowfield's coarse grid ends in steps there and the rock ring stands out of it. The rock's
    top ring is brought down under the snow, the grid is cut well back, and a smooth collar of snow joins the two"""
    import bmesh
    cx, cy, rx, ry = sets.PIT
    w = bpy.data.objects['pit_wall']
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(w.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    w.modifiers.clear(); w.data = me
    seg = 72
    ring = []
    for i in range(seg):
        v = me.vertices[i].co
        v.z = h(v.x, v.y) - 0.06
        ring.append((v.x, v.y))
    for p in me.polygons:
        p.use_smooth = True
    gm = bpy.data.objects['ground'].data
    e = lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    bm = bmesh.new(); bm.from_mesh(gm)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if e(*f.calc_center_median()[:2]) < 1.5], context='FACES')
    bm.to_mesh(gm); bm.free()
    N, R = 288, 14
    vs, fs = [], []
    for j in range(R + 1):
        t = j / R
        for i in range(N):
            u = i / N * seg; k = int(u); f = u - k
            x = ring[k][0] * (1 - f) + ring[(k + 1) % seg][0] * f; y = ring[k][1] * (1 - f) + ring[(k + 1) % seg][1] * f
            a = math.atan2((y - cy) / ry, (x - cx) / rx)
            ox, oy = cx + math.cos(a) * rx * 1.40, cy + math.sin(a) * ry * 1.40
            x, y = cx + (x - cx) * 0.985, cy + (y - cy) * 0.985
            qx, qy = x + (ox - x) * t, y + (oy - y) * t
            z = h(qx, qy) + 0.004 * t - 0.07 * max(0.0, 1 - t * 5) ** 2           # rounded over at the edge
            vs.append((qx, qy, z))
    for j in range(R):
        for i in range(N):
            a = j * N + i; b = j * N + (i + 1) % N
            fs.append((a, a + N, b + N, b))
    lib.mesh_obj('snow_collar', vs, fs, M()['snow'], smooth=True)


@shot(exposure=1.3)
def I7(out, preview):
    """outside, beside her: bent into the storm she walks the last steps to the pit, her lantern swinging, the grey thread on the
    snow behind her; she stops at the lip and holds the light out over it; then she goes down the stone steps, and it with her.
    The camera only ever goes sideways, along her way: the lines engraved on the snow run the same way, so they stand still (any
    move toward or away from the snow sweeps them past faster than 24 frames can show, and they strobe)"""
    N = 216
    sc = begin(N, out, preview, origin=(19.5, 2.5, 0))
    H_ = V((0.912, 0.410, 0))
    LIP = V((19.75, 3.62, 0))
    D1 = 3.0
    start = LIP - H_ * D1
    n_ = V((-H_.y, H_.x, 0)).normalized()
    ca, cb = LIP - H_ * 1.75 - n_ * 5.6 + V((0, 0, 1.30)), LIP + H_ * 0.55 - n_ * 5.6 + V((0, 0, 1.30))
    cam, tgt = camera(36, (ca, ca + n_ * 6 + V((0, 0, -0.72))), (cb, cb + n_ * 6 + V((0, 0, -0.72))), N)
    sets.exterior(sc, cam, tgt, storm=True, snow_box=((8, -8, -0.6), (34, 16, 8)), snow_n=5200, snow_width=0.007)
    lib.SNOWS[-1].near = 1.6; lib.SNOWS[-1].streak = 0.04       # a flake's stroke is as long as its way in one frame: shorter, it blinks
    mats = M()
    from mathutils.bvhtree import BVHTree
    import shots_cut
    ground_at = shots_cut.ground_h()
    h_ = lambda x, y: float(ground_at(np.array([x]), np.array([y]))[0])
    snow_rim(h_)
    vs, fs = [], []
    for nm in ('ground', 'snow_collar'):
        m_ = bpy.data.objects[nm].data
        o_ = len(vs)
        vs += [v.co.copy() for v in m_.vertices]; fs += [tuple(i + o_ for i in q.vertices) for q in m_.polygons]
    bvh = BVHTree.FromPolygons(vs, fs)

    def snow_z(x, y):
        h = bvh.ray_cast(V((x, y, 60)), V((0, 0, -1)))
        return h[0].z if h[0] else None
    zl = h_(*(LIP - H_ * 0.25)[:2])
    RUN, RISE = 0.33, 0.27

    def gz(x, y):
        a = (V((x, y, 0)) - LIP).dot(H_)
        k = math.floor(a / RUN + 0.5)
        if a < 0.17:
            z = snow_z(x, y)
            z = zl if z is None else z
            # trodden flat by the lip
            t = ss(a, -0.9, -0.1)
            return z * (1 - t) + zl * t
        return zl - RISE * k
    rot = math.atan2(H_.y, H_.x)
    # the way down: slabs let into the pit's wall
    lipslab = prim('cube', 'lipslab', loc=LIP - H_ * 0.24 + V((0, 0, zl - 0.30)), rot=(0, 0, rot), scale=(0.44, 0.62, 0.30), material=mats['stone'])
    for k in range(1, 11):
        c = LIP + H_ * (RUN * k) + V((0, 0, zl - RISE * k - 0.45))
        o = prim('cube', f'stair{k}', loc=c, rot=(0, 0, rot + 0.03 * math.sin(k * 2.1)), scale=(RUN * 0.56, 0.60 + 0.05 * math.sin(k * 3.7), 0.45), material=mats['stone'])
    path = act.Path([LIP - H_ * 12, LIP - H_ * 6, LIP - H_ * 3, LIP, LIP + H_ * 6])
    s0 = path.len - 6 - D1
    OUT0 = 150
    kr, kp = lib.knitter('knitter', tuple(start), mats, seated=False)
    A = actor(kr, kp)
    T1 = 14
    W_ = act.Walk(A, path, [('go', -8, D1, 9, T1), ('go', OUT0, RUN * 7, 8, 15)], N, ground=gz, width=0.085, lift=0.075, lean=0.22, drop=0.06, first=1, start=s0, sway=0.026)
    L = Lantern(A, mats, 34)
    light_keys(L.light, [(1, 34.0), (150, 34.0), (200, 900.0), (N, 900.0)])

    def ground_pt(s, up=0.008):
        p = path.at(s)
        return V((p[0], p[1], gz(p[0], p[1]) + up))
    grey = lib.tube('greythread', [V((0, 0, k * 1e-3)) for k in range(90)], 0.005, mats['grey_thread'])
    # her footprints: the ones behind her, and each new one when the foot has come down
    pm = lib.mat('print', (0.33, 0.36, 0.43), rough=0.9)
    foot = 1; s = s0 - 0.36
    marks = []
    while s > s0 - 6.5:
        marks.append((-99, foot, s)); foot = -foot; s -= 0.36
    marks += [(f, ft, s) for (f, ft, s) in W_.strikes if s <= s0 + D1 - 0.5]
    for i, (f, ft, s) in enumerate(marks):
        q, h = W_.spot(ft, s)
        q.z = (snow_z(q.x, q.y) or q.z)
        fw = V((math.sin(h), -math.cos(h), 0))
        o = prim('sphere', f'print{i}', loc=q + fw * 0.045 + V((0, 0, 0.003)), rot=(0, 0, h), scale=(0.048, 0.125, 0.012), material=pm, segments=20, ring_count=8)
        if f > 0:
            o.hide_render = True; o.keyframe_insert('hide_render', frame=1)
            o.hide_render = False; o.keyframe_insert('hide_render', frame=int(math.ceil(f + 4)))

    def upd(f):
        bs, sp = W_.pose(f)
        lead = W_._i(W_.lead, f); car = W_._i(W_.car, f)
        hold = ss(f, 122, 138) * (1 - ss(f, 146, 166))
        down = ss(f, OUT0, OUT0 + 30)
        t = kp['torso'].rotation_euler
        kp['torso'].rotation_euler = (t[0] + 0.14 * hold + 0.05 * down, t[1], t[2])
        kp['head'].rotation_euler = (0.16 + 0.22 * hold + 0.1 * down, 0, 0)
        sw = max(-1.0, min(1.0, lead / 0.16)) * min(1.0, abs(sp) / 0.3)
        # the left arm: across her against the wind, swinging a little
        Wm = A.W(kr)
        A.arm(1, Wm @ rigid((0.235, -0.06 - 0.12 * sw, 0.82), hand_rot((-0.1, -0.2 - 0.3 * sw, -1), (-1, 0.15, 0))), Wm.to_3x3() @ V((0.6, 0.8, -0.3)))
        A.hand[1].pose(RELAX)
        damp = math.sin((f - 112) * 0.28) * math.exp(-max(0.0, f - 112) / 18.0) * (f > 112) * 0.5
        L.set(f, hold, (sw * 0.6 + damp, car * 0.9))
        FOOT[0] = W_.err
        b = belt(A)
        far = [ground_pt(x) for x in np.linspace(max(bs - 9.5, 0.2), bs - 0.9, 70)]
        lib.tube_update(grey, far + [far[-1].lerp(b, (i + 1) / 20) + V((0, 0, -0.10 * math.sin(math.pi * (i + 1) / 20) * (1 - (i + 1) / 20))) for i in range(20)])
    lib.FRAME_FNS.append(upd)
    REPORT.append(lambda f: {-1: (True, A.hand[-1].gap(L.grip[0], Matrix.Identity(4), L.grip[2]))})
    for (f, ft, s) in W_.strikes:
        if 1 <= f <= N:
            stone = s > s0 + D1 - 0.5
            ev(f, 'step_stone' if stone else 'step_snow', (0.8 if stone else 1.0) * (1 - 0.5 * max(0, f - 150) / 100), 0.15)
            ev(f + 1, 'lantern', 0.4, 0.15)
    ev(126, 'lantern', 0.7, 0.15)
    lib.register_frames()
    return sc


# ── the doll alone ─────────────────────────────────────────────────────────
def sill_line(d, n=60, slack=0.0):
    """the red thread from the doll's back, over the sill's edge, down to the table and across it to the spool"""
    a = d.matrix_world @ V((0.02, 0.068, 0.108))
    pts = []
    key = [a, V((a.x + 0.015, 0.25, 1.0018 + 0.02 * slack)), V((a.x + 0.03, 0.316, 1.0018)), V((a.x + 0.034, 0.3235, 0.998)), V((a.x + 0.05, 0.332, 0.96)),
           V((a.x + 0.16, 0.36, 0.84)), V((a.x + 0.25, 0.40, 0.7922)), V((0.30, 0.60, 0.7922)), SPOOL + V((-0.026, 0, 0.012))]
    # smooth through the key points (centripetal enough for this)
    ext = [key[0] * 2 - key[1]] + key + [key[-1] * 2 - key[-2]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1:i + 3]
        for j in range(n // 8):
            t = j / (n // 8)
            q = (p1 * 2 + (p2 - p0) * t + (p0 * 2 - p1 * 5 + p2 * 4 - p3) * t * t + (p1 * 3 - p0 - p2 * 3 + p3) * t ** 3) * 0.5
            pts.append(q)
    pts.append(key[-1])
    for q in pts:
        q.z = max(q.z, over(q)) if q.y < 0.31 or q.y > 0.345 else q.z
    return pts


@shot(exposure=0.8)
def I8(out, preview):
    """the doll on the windowsill, from behind, facing the storm; the room is cold and dark now; the red thread runs from its
    waist over the sill to the spool on the table; the door bangs in the wind, and the bang shakes it"""
    N = 168
    sc = begin(N, out, preview, origin=(-0.34, 0.15, 1.1), pos_lo=(-4, -3, -1), pos_size=10.0)
    cam, tgt = camera(50, ((0.03, 1.62, 1.30), (-0.31, 0.12, 1.12)), ((-0.16, 1.18, 1.22), (-0.33, 0.12, 1.13)), N, fstop=2.8)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, candle_lit=False, **TABLE)
    mats = M()
    d, dp = R['doll'], R['dparts']
    d.location = SILL
    bpy.context.view_layer.update()
    ring_tube('redloop', d)
    lib.tube('redline', sill_line(d), 0.0016, mats['red'])
    door = R['door']
    B1, B2 = 76, 92
    # the wind throws it shut: it speeds up all the way, strikes, bounces, strikes again
    def door_a(f):
        if f < 52:
            return 62 + 2.5 * math.sin(f * 0.11)
        if f < B1:
            t = (f - 52) / (B1 - 52)
            a0 = 62 + 2.5 * math.sin(52 * 0.11)
            return a0 * (1 - t * t * (0.35 + 0.65 * t))
        if f < B2:
            t = (f - B1) / (B2 - B1)
            return 13 * 4 * t * (1 - t)
        return 9 * ss(f, 112, 150)
    cold = light('AREA', 'doorcold', (-5.2, 0.4, 4.2), 180.0, color=(0.62, 0.72, 1.0), size=2.0); aim(cold, (-2.6, 1.7, 0.9))

    def upd(f):
        door.rotation_euler = (0, 0, math.radians(door_a(f)))
        j = 0.0
        for b, a in ((B1, 1.0), (B2, 0.4)):
            if f >= b:
                j += a * math.sin((f - b) * 1.9) * math.exp(-(f - b) / 5.0)
        dp['tuft'].rotation_euler = (0.35 * j, 0.1 * j, 0)
        dp['headpiv'].rotation_euler = (0.018 * j, 0, 0.0)
        d.rotation_euler = (0.006 * j, 0, 0)
    lib.FRAME_FNS.append(upd)
    ev(54, 'hinge', 0.6, 0.5, dur=(B1 - 54) / 24)
    ev(B1, 'door_bang', 1.0, 0.5); ev(B2, 'door_bang', 0.45, 0.5)
    ev(114, 'hinge', 0.3, 0.5, dur=1.2)
    EVENTS.append({'f': B1, 'kind': 'wind_shut', 'vol': 1, 'pan': 0})
    lib.register_frames()
    return sc


@shot(exposure=1.15)  # auto=2.5
def I9(out, preview):
    """from outside again, the doll's face behind the glass, the room black behind it. Nothing; then its head turns a very
    little toward where she went; and its mitten closes on the thread"""
    N = 156
    sc = begin(N, out, preview, origin=(-0.34, 0.1, 1.2), pos_lo=(-4, -3, -1), pos_size=10.0)
    c = SILL + V((0.0, 0, 0.185))
    cam, tgt = camera(46, ((-0.14, -0.74, 1.33), c + V((0.014, 0, -0.018))), ((-0.21, -0.60, 1.30), c + V((0.014, 0, -0.025))), N, fstop=4.0)
    R = sets.interior(sc, cam, tgt, night=True, doll_pose='sill', knitter_on=False, candle_lit=False, outside_snow=False, **TABLE)
    window_low()
    mats = M()
    d, dp = R['doll'], R['dparts']
    d.location = SILL
    bpy.context.view_layer.update()
    R['glass'].data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.05
    bpy.data.objects['moonwin'].data.energy = 9
    k = light('AREA', 'coldkey', (-1.0, 0.0, 1.9), 34.0, color=(0.66, 0.76, 1.0), size=0.5); aim(k, SILL + V((0, 0.05, 0.15)))
    gl = light('POINT', 'glint', (0.05, -0.55, 1.75), 2.0, color=(0.8, 0.85, 1.0), size=0.03)
    rim = light('AREA', 'rim', (0.5, 0.7, 1.5), 4.0, color=(0.6, 0.7, 1.0), size=0.4); aim(rim, SILL + V((0, 0, 0.2)))
    sn = lib.Snow('snow_out', 900, (-1.6, -1.6, 0.5), (1.4, -0.13, 2.3), wind=(2.6, 0.2, -0.9), gust=0.5, streak=0.018, width=0.005, cam=cam, tgt=tgt, material=mats['flake'], seed=8, near=0.3)
    lib.SNOWS.append(sn)
    ring_tube('redloop', d)
    # the thread from its front, down past its hand and back along its side over the sill
    T_HEAD, T_ARM, T_GRIP = 44, 80, 104
    arm, th = dp['arm1'], dp['mthumb1']
    line = lib.tube('redline', [V((0, 0, k * 1e-3)) for k in range(61)], 0.0017, mats['red'])
    hang = lib.tube('redfront', [V((0, 0, k * 1e-3)) for k in range(30)], 0.0017, mats['red'])
    iS = min(range(64), key=lambda i: (lib.doll_ring((0.05, 0, 1), -0.004, 0.0022, 64)[i][0] - V((0.045, -0.055, 0.11))).length)
    ringp = [p for p, _ in lib.doll_ring((0.05, 0, 1), -0.004, 0.0022, 64)]

    def palm(f):
        """the inside of its mitten, in the doll's frame"""
        a = arm.rotation_euler
        return V(arm.location) + Euler(a).to_matrix() @ V((0.0, -0.016, -0.092))

    def upd(f):
        dp['headpiv'].rotation_euler = (0.05 * ss(f, T_HEAD, T_HEAD + 12) - 0.02 * ss(f, T_HEAD + 18, T_HEAD + 30), 0.05 * ss(f, T_HEAD, T_HEAD + 20), 0.20 * ss(f, T_HEAD, T_HEAD + 26))
        dp['tuft'].rotation_euler = (0.0, 0.14 * math.sin((f - T_HEAD) * 0.6) * math.exp(-max(0, f - T_HEAD) / 12.0) * (f > T_HEAD), 0)
        k = ss(f, T_ARM, T_GRIP)
        arm.rotation_euler = (-0.62 * k, -0.35 + 0.42 * k, 0.0)
        dp['arm-1'].rotation_euler = (0, 0.35, 0)
        c_ = ss(f, T_GRIP - 2, T_GRIP + 5)
        th.rotation_euler = (-0.75 + 1.15 * c_, 0, 0)
        pull = ss(f, T_GRIP + 8, T_GRIP + 22)
        arm.rotation_euler = (arm.rotation_euler[0] - 0.10 * pull, arm.rotation_euler[1], 0)
        W = d.matrix_world
        a0 = W @ ringp[iS]
        pm = W @ palm(f)
        # the thread hangs in a loop in front of it; when the mitten gets there it goes through the hand
        rest = W @ V((0.052, -0.085, 0.052))
        mid = rest.lerp(pm, ss(f, T_GRIP - 8, T_GRIP))
        end = W @ V((0.094, 0.02, -0.013))
        p1 = [a0.lerp(mid, i / 14) + V((0.006 * math.sin(math.pi * i / 14), -0.012 * math.sin(math.pi * i / 14) * (1 - 0.6 * pull), -0.018 * math.sin(math.pi * i / 14) * (1 - pull))) for i in range(15)]
        p2 = [mid.lerp(end, (i + 1) / 15) + V((0.01 * math.sin(math.pi * (i + 1) / 15), -0.008 * math.sin(math.pi * (i + 1) / 15), -0.016 * math.sin(math.pi * (i + 1) / 15) * (1 - 0.7 * pull))) for i in range(15)]
        pts = p1 + p2
        for q in pts:
            q.z = max(q.z, 1.0018)
            l = W.inverted() @ q                                  # never through the wool
            c, r = lib.DOLL_BODY
            e = math.sqrt(sum(((l[j] - c[j]) / r[j]) ** 2 for j in range(3)))
            if e < 1.02:
                l2 = V(c) + (l - V(c)) * (1.02 / max(e, 1e-4)); q.xyz = W @ l2
        lib.tube_update(hang, pts)
        e0 = pts[-1]
        rest_ = [e0 + (V((e0.x + 0.06, 0.318, 1.0018)) - e0) * (i / 30) + V((0.012 * math.sin(i * 0.35), 0, 0)) * (1 - i / 30) for i in range(31)]
        rest_ += [V((e0.x + 0.06 + 0.10 * (i / 30), 0.3235 + 0.06 * (i / 30), 1.0 - 0.208 * (i / 30) ** 1.3)) for i in range(30)]
        lib.tube_update(line, rest_)
    lib.FRAME_FNS.append(upd)
    ev(T_HEAD + 2, 'wool_head', 1.0); ev(T_ARM + 2, 'wool_arm', 0.8); ev(T_GRIP + 1, 'wool_grip', 1.0); ev(T_GRIP + 12, 'thread_taut', 0.6)
    EVENTS.append({'f': T_HEAD - 18, 'kind': 'hush', 'vol': 1, 'pan': 0})
    lib.register_frames()
    return sc
