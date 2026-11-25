"""The films' foley: what a shot's events (shots_intro.ev) sound like, and where in each sound the thing happens.

Every clip carries its own contact moment `t0` (the attack found in the recording, not its start), and `play` puts that
moment on the event's frame. Clips are cut out of recordings by machine: attacks that stand alone (quiet before, gone soon
after), ranked by how clean they are. All recordings are CC0 (ids below; scripts/audio fetches them)."""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, '..', 'audio')))
SR = 48000
_REC, _BANK = {}, {}
SOFT = ('yarn', 'needle_wool', 'pinch', 'wool_turn', 'wool_head', 'wool_arm', 'candle_out')     # no edge of their own: they begin with the movement


def rec(sid):
    """a source recording, mono 48 kHz"""
    if sid not in _REC:
        import subprocess
        if isinstance(sid, int):
            from sources import fs
            p = fs(sid)
        else:
            p = os.path.normpath(os.path.join(HERE, '..', '..', 'app', 'assets', 'audio', sid + '.ogg'))
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
        _REC[sid] = np.frombuffer(raw, np.float32).copy()
    return _REC[sid]


def env(x, ms=3.0):
    n = max(1, int(ms * SR / 1000))
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same'))


def band(x, lo=None, hi=None, order=1):
    """simple zero-phase band limiting in the frequency domain"""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (4 * order))
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (4 * order))
    return np.fft.irfft(X * g, len(x)).astype(np.float32)


def rate(x, r):
    n = int(len(x) / r)
    return np.interp(np.arange(n) * r, np.arange(len(x)), x).astype(np.float32)


def hits(sid, n=8, pre=0.06, post=0.2, quiet=0.08, lo=None, hi=None, level=(0.0, 1.0), sort='clean', only=None):
    """n attacks of a recording that stand alone: [(clip, t0)]"""
    x = rec(sid)
    if lo or hi:
        x = band(x, lo, hi)
    if only:
        x = x[int(only[0] * SR): int(only[1] * SR)]
    e = env(x, 2.0); step = int(0.001 * SR)
    ee = e[::step]
    # rise: how much louder the next few ms are than the 80 ms before
    k = int(quiet * 1000)
    c = np.cumsum(np.concatenate([[0], ee]))
    before = np.array([(c[i] - c[max(0, i - k)]) / max(1, i - max(0, i - k)) for i in range(len(ee))])
    peak = np.array([ee[i:i + 12].max() if i + 12 < len(ee) else 0 for i in range(len(ee))])
    ratio = peak / (before + 1e-5 + 0.02 * np.median(ee))
    cand = []
    i = 0
    order = np.argsort(-ratio)
    taken = np.zeros(len(ee), bool)
    for j in order[:6000]:
        if taken[j] or j < pre * 1000 + 2 or j + post * 1000 + 2 > len(ee):
            continue
        # the attack itself: steepest point of the envelope near here
        seg = ee[max(0, j - 4): j + 16]
        a = max(0, j - 4) + int(np.argmax(np.diff(seg)))
        taken[max(0, j - 150): j + 150] = True
        after = ee[a + int(post * 800): a + int(post * 1000)].mean() if a + int(post * 1000) < len(ee) else 1
        pk = ee[a:a + 30].max()
        cand.append((pk, ratio[j] / (1 + 12 * after / (pk + 1e-6)), a))
        if len(cand) > n * 6:
            break
    if not cand:
        return []
    pks = np.array([c_[0] for c_ in cand]); lo_, hi_ = np.quantile(pks, level[0]), np.quantile(pks, level[1])
    cand = [c_ for c_ in cand if lo_ <= c_[0] <= hi_]
    cand.sort(key=lambda c_: -c_[1])
    out = []
    for pk, q, a in cand[:n]:
        s0 = int(a * step - pre * SR); s1 = int(a * step + post * SR)
        y = x[s0:s1].copy()
        f = int(pre * 0.8 * SR); y[:f] *= np.linspace(0, 1, f) ** 2
        f = int(post * 0.6 * SR); y[-f:] *= np.linspace(1, 0, f) ** 1.5
        out.append((y / (np.abs(y).max() + 1e-6), pre))
    return out


def steady(sid, dur, n=4, lo=None, hi=None, only=None):
    """n stretches of a recording with even, unbroken energy: for things that go on (thread drawn, cloth rubbed)"""
    x = rec(sid)
    if lo or hi:
        x = band(x, lo, hi)
    if only:
        x = x[int(only[0] * SR): int(only[1] * SR)]
    e = env(x, 25.0)[:: int(0.01 * SR)]
    w = int(dur * 100)
    if len(e) <= w + 2:
        return [x / (np.abs(x).max() + 1e-6)]
    sc = []
    for i in range(0, len(e) - w, 3):
        s = e[i:i + w]
        sc.append((np.median(s) / (s.std() + 0.25 * np.median(s) + 1e-6) * np.median(s) ** 0.5, i))
    sc.sort(reverse=True)
    out, used = [], []
    for q, i in sc:
        if any(abs(i - u) < w for u in used):
            continue
        used.append(i)
        y = x[i * int(0.01 * SR): (i + w) * int(0.01 * SR)].copy()
        out.append(y / (np.abs(y).max() + 1e-6))
        if len(out) >= n:
            break
    return out


def shape(x, dur, a=0.08, r=0.3):
    """stretch/trim to dur with a soft start and end"""
    n = int(dur * SR)
    y = np.tile(x, n // len(x) + 1)[:n].copy() if len(x) < n else x[:n].copy()
    if len(x) < n:                                  # hide the seam
        for k in range(len(x), n, len(x)):
            f = int(0.03 * SR); s0, s1 = max(0, k - f), min(n, k + f)
            y[s0:s1] *= 1 - 0.8 * np.hanning(s1 - s0)
    A, B = max(1, int(a * n)), max(1, int(r * n))
    y[:A] *= np.sin(np.linspace(0, np.pi / 2, A)); y[-B:] *= np.sin(np.linspace(np.pi / 2, 0, B))
    return y


def thump(f0=90, dur=0.16, seed=0, noise=0.25):
    """a soft body: a short low knock under a breath of noise"""
    rng = np.random.default_rng(seed)
    t = np.arange(int(dur * SR)) / SR
    y = np.sin(2 * np.pi * f0 * t * (1 - 0.9 * t)) * np.exp(-t / (dur / 4.5))
    z = band(rng.standard_normal(len(t)).astype(np.float32), 200, 1400) * np.exp(-t / (dur / 7))
    y = y + noise * z
    y[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return (y / np.abs(y).max()).astype(np.float32)


def puff(dur=0.35, seed=1):
    rng = np.random.default_rng(seed)
    n = int(dur * SR); t = np.linspace(0, 1, n)
    y = band(rng.standard_normal(n).astype(np.float32), 250, 1800)
    y *= np.minimum(t / 0.06, 1) * np.exp(-t * 4.5)
    return y / np.abs(y).max()


def mixd(*parts):
    """parts = (clip, t0, gain, delay): one clip with a common contact moment"""
    pre = max(t0 - d for _, t0, _, d in parts)
    end = max(len(c) / SR - t0 + d for c, t0, _, d in parts)
    y = np.zeros(int((pre + end) * SR) + 2, np.float32)
    for c, t0, g, d in parts:
        i = int((pre - t0 + d) * SR)
        y[i:i + len(c)] += c * g
    return y, pre


def bank(name):
    """the variants of a kind of hit, made once"""
    if name in _BANK:
        return _BANK[name]
    B = None
    if name in ('needle_in', 'needle_off', 'needle_draw'):
        lv = {'needle_in': (0.55, 0.95), 'needle_off': (0.3, 0.7), 'needle_draw': (0.0, 0.3)}[name]
        B = hits(505487, 8, 0.02, 0.13, 0.05, lo=700, level=lv)
        if name == 'needle_off':
            B = [(rate(c, 0.92), t / 0.92) for c, t in B]
        B = [mixd((c, t, 1.0, 0), (wool(0.16, i), 0.05, 0.10, 0.01)) for i, (c, t) in enumerate(B)]
    elif name == 'yarn':
        B = [(shape(s, 0.26, 0.4, 0.5), 0.06) for s in steady(188208, 0.3, 6, 500)]
    elif name == 'stab':
        B = [mixd((c, t, 0.8, 0), (thump(150, 0.07, i, 0.6), 0.0, 0.5, 0.004)) for i, (c, t) in enumerate(hits(563779, 6, 0.02, 0.10, 0.05, lo=250, hi=6000, level=(0.3, 0.8)))]
    elif name == 'needle_wool':
        B = [(shape(s, 0.22, 0.2, 0.6), 0.04) for s in steady(563779, 0.3, 5, 600, 9000)]
    elif name == 'pinch':
        B = [(shape(s, 0.12, 0.2, 0.6), 0.03) for s in steady(188208, 0.2, 6, 900)]
    elif name == 'thread_taut':
        B = [mixd((c, t, 1.0, 0), (wool(0.2, i), 0.06, 0.25, 0)) for i, (c, t) in enumerate(hits(563779, 6, 0.03, 0.14, 0.06, lo=350, level=(0.5, 1.0)))]
    elif name == 'cinch':
        c = rec('grip'); t = float(np.argmax(env(c, 5)) / SR)
        B = [mixd((wool(0.42, 1), 0.03, 0.6, 0), (hits(563779, 4, 0.03, 0.12, 0.06, lo=300)[k][0], 0.03, 0.55, 0), (c, t, 0.5, 0.02)) for k in range(2)]
    elif name in ('take', 'lift', 'cloth_let', 'cloth'):
        ids = {'take': 435291, 'lift': 435289, 'cloth_let': 435289, 'cloth': 435291}[name]
        B = hits(ids, 5, 0.06, 0.32, 0.06, lo=150, level=(0.2, 0.9))
        if name == 'take':
            B = [mixd((c, t, 0.9, 0), (thump(120, 0.10, i, 0.8), 0.0, 0.25, 0)) for i, (c, t) in enumerate(B)]
    elif name == 'setdown':
        # wool feet on a board: felt, then the little weight of it through the wood
        w = hits('st_wood1', 1, 0.01, 0.25, 0.005) or [(rec('st_wood1'), 0.01)]
        B = [mixd((thump(105, 0.2, 3, 0.5), 0.0, 0.8, 0), (band(w[0][0], 60, 900), w[0][1], 0.7, 0.003), (wool(0.3, 4), 0.0, 0.35, 0.012), (thump(125, 0.12, 5, 0.6), 0.0, 0.25, 0.055))]
    elif name == 'pat':
        B = [mixd((thump(140, 0.10, 7, 1.2), 0.0, 0.5, 0), (wool(0.32, 8), 0.0, 0.6, 0.0))]
    elif name == 'wool_turn':
        B = [(wool(0.5, 11), 0.03)]
    elif name == 'palm_door':
        B = [(band(c, 70, 2500), t) for c, t in hits(862895, 3, 0.02, 0.3, 0.05, level=(0.0, 0.5))]
    elif name == 'latch':
        B = hits(370731, 4, 0.03, 0.35, 0.06, lo=120, level=(0.5, 1.0))
    elif name == 'door_bang':
        x = rec(389811); e = env(x, 3); a = int(np.argmax(np.diff(e[:: 48]))) * 48
        B = [(x[max(0, a - 1500): a + int(1.6 * SR)] / np.abs(x).max(), min(a, 1500) / SR)]
        B[0][0][-int(0.8 * SR):] *= np.linspace(1, 0, int(0.8 * SR)) ** 1.5
    elif name == 'lantern':
        B = hits(516739, 8, 0.02, 0.22, 0.05, lo=500, level=(0.0, 0.5))
    elif name == 'candle_out':
        B = [(puff(), 0.02)]
    elif name.startswith('step_'):
        fam = {'step_wood': ['st_wood%d' % i for i in range(1, 7)], 'step_snow': ['snow1', 'snow2', 'snow3'], 'step_stone': ['st_grit%d' % i for i in range(1, 5)]}[name]
        B = []
        for i, f in enumerate(fam):
            x = rec(f); e = env(x, 4); a = int(np.argmax(e > 0.35 * e.max()))
            y = x / (np.abs(x).max() + 1e-6)
            if name == 'step_wood':                       # a grown body in shoes: lower, with some floor under it
                y = rate(y, 0.8); a = int(a / 0.8)
                B.append(mixd((y, a / SR, 1.0, 0), (thump(72, 0.2, i, 0.3), 0.0, 0.5, 0)))
            else:
                B.append((y, a / SR))
    elif name == 'wool_head':
        # no music: the sound of a stuffed neck being turned for the first time. Slow, dry, close
        B = [mixd((band(shape(wool_raw(1.0, 2), 1.0, 0.35, 0.5), 180, 3800), 0.10, 0.9, 0), (band(shape(wool_raw(1.0, 5), 0.5, 0.2, 0.6), 400, 5000), 0.05, 0.35, 0.28))]
    elif name == 'wool_arm':
        B = [(band(shape(wool_raw(0.9, 7), 0.9, 0.3, 0.5), 250, 4500), 0.03)]
    elif name == 'wool_grip':
        c = rec('grip'); t = float(np.argmax(env(c, 5)) / SR)
        B = [mixd((wool(0.5, 9), 0.04, 0.8, 0), (band(c, 120, 3500), t, 0.5, 0.0), (hits(563779, 3, 0.03, 0.12, 0.06, lo=350)[1][0], 0.03, 0.22, 0.05))]
    if not B:
        raise KeyError('no foley for ' + name)
    out = []
    for c, t in B:
        c = np.asarray(c, np.float32)
        if name not in SOFT:                              # the moment itself: where it first reaches half of its loudest
            e = env(c, 4.0); t = float(np.argmax(e > 0.5 * e.max())) / SR
        out.append((c, t))
    _BANK[name] = out
    return _BANK[name]


def wool_raw(dur, k=0):
    b = steady(188208, max(0.4, dur), 10, 200)
    return b[k % len(b)]


def wool(dur, k=0):
    """a rub of wool"""
    return shape(wool_raw(dur, k), dur, 0.3, 0.5)


def sustained(name, dur, k=0):
    """things that last exactly as long as their movement"""
    if name == 'thread_draw':
        b = steady(563779, 0.8, 5, 500, 9000)
        y = shape(b[k % len(b)], dur, 0.15, 0.2)
        w = shape(wool_raw(dur, k), dur, 0.2, 0.3)
        return y * 0.8 + w * 0.5
    if name == 'hinge':
        x = rec(870437)
        e = env(x, 30)
        b = steady(870437, 0.9, 3, 120, 6000)
        return shape(b[k % len(b)], dur, 0.06, 0.2)
    if name == 'spool':
        x = rec('roll1'); return shape(x / np.abs(x).max(), dur, 0.1, 0.4)
    if name == 'frost':
        x = rate(band(rec(737896), 400), 2.4); n = int(dur * SR)
        e = env(x, 40); i = int(np.argmax(np.convolve(e, np.ones(n // 8) / (n // 8), mode='same')[n:-n])) if len(x) > 2 * n else 0
        return shape(x[i:i + n] / (np.abs(x[i:i + n]).max() + 1e-6), dur, 0.5, 0.4)
    if name == 'flame_bend':
        x = rec('flame'); return shape(x / np.abs(x).max(), dur, 0.3, 0.5)
    raise KeyError(name)


GAIN = {'needle_in': 0.34, 'needle_off': 0.26, 'needle_draw': 0.16, 'yarn': 0.16, 'stab': 0.30, 'needle_wool': 0.14, 'pinch': 0.10, 'thread_draw': 0.20,
        'thread_taut': 0.28, 'cinch': 0.36, 'take': 0.34, 'lift': 0.26, 'cloth_let': 0.22, 'cloth': 0.2, 'setdown': 0.36, 'pat': 0.32, 'wool_turn': 0.22, 'palm_door': 0.32,
        'latch': 0.36, 'door_bang': 0.95, 'lantern': 0.14, 'candle_out': 0.18, 'step_wood': 0.27, 'step_snow': 0.44, 'step_stone': 0.42, 'wool_head': 0.36,
        'wool_arm': 0.28, 'wool_grip': 0.36, 'hinge': 0.34, 'spool': 0.14, 'frost': 0.12, 'flame_bend': 0.25}
LAST = ('thread_draw', 'hinge', 'spool', 'frost', 'flame_bend')
DUR = {'frost': 3.0, 'flame_bend': 1.4, 'hinge': 1.0, 'spool': 1.5, 'thread_draw': 0.6}


def clip(kind, i, dur=None):
    """(samples, where in them the thing happens, gain) for the i-th event of its kind"""
    if kind in LAST:
        return sustained(kind, dur or DUR[kind], i), 0.0, GAIN[kind]
    b = bank(kind)
    c, t = b[i % len(b)]
    return c, t, GAIN[kind]


SOURCES = [505487, 563779, 188208, 435289, 435291, 862895, 370731, 389811, 870437, 516739, 737896]


if __name__ == '__main__':
    # what came out: for every kind, how many variants, how long, and how far the loudest moment is from the stated contact
    for k in GAIN:
        if k in LAST:
            c = sustained(k, DUR[k]); print(f'{k:12s} lasting {len(c) / SR:.2f}s rms {np.sqrt((c * c).mean()):.3f}')
            continue
        b = bank(k)
        off = [1000 * (np.argmax(env(c, 4)) / SR - t) for c, t in b]
        print(f'{k:12s} {len(b)} variants, {np.mean([len(c) / SR for c, _ in b]):.2f}s, loudest {min(off):.0f}..{max(off):.0f} ms from contact')
