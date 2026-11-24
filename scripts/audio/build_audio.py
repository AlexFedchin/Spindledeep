"""Spindledeep — sound build. Stock recordings → app/assets/audio/*.ogg, plus CREDITS (sounds section).

Sources: Freesound.org CC0 previews (fetched by id; non-CC0 is refused) and Kevin MacLeod (CC BY 4.0).
Requires Python 3.10+, numpy, ffmpeg on PATH.
    python scripts/audio/build_audio.py [names...]
"""
import os
import subprocess
import sys
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'app', 'assets', 'audio')
sys.path.insert(0, HERE)
from sources import fs, km, meta  # noqa: E402

SR = 44100


def run(args):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr)


def read(path, ch=2):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy()


def onsets(x, thr_db=-30, min_gap=0.18):
    """Start samples of distinct hits (envelope rises above threshold after a quiet gap)."""
    m = np.abs(x).max(1)
    win = int(0.005 * SR)
    env = np.convolve(m, np.ones(win) / win, mode='same')
    thr = 10 ** (thr_db / 20) * env.max()
    out, last = [], -10 ** 9
    above = env > thr
    for i in np.flatnonzero(above[1:] & ~above[:-1]):
        if i - last > min_gap * SR:
            out.append(max(0, i - int(0.008 * SR)))
            last = i
    return out


def fade(x, fin=0.005, fout=0.05):
    n = len(x)
    a, b = min(n // 2, int(fin * SR)), min(n // 2, int(fout * SR))
    if a: x[:a] *= np.linspace(0, 1, a)[:, None]
    if b: x[-b:] *= np.linspace(1, 0, b)[:, None] ** 2
    return x


def loopify(x, xf=2.0):
    """Seamless loop: crossfade the tail into the head (equal power)."""
    n = int(xf * SR)
    head, tail = x[:n].copy(), x[-n:].copy()
    t = np.linspace(0, np.pi / 2, n)[:, None]
    body = x[n:-n] if len(x) > 3 * n else x[n:]
    return np.concatenate([tail * np.cos(t) + head * np.sin(t), body[:len(body)]])[: len(x) - n]


def write(name, x, filt=None, lufs=None, peak=None, q=4, mono=False):
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        w = os.path.join(td, 'a.f32')
        x.astype(np.float32).tofile(w)
        af = [filt] if filt else []
        if lufs is not None:
            af.append(f'loudnorm=I={lufs}:TP=-1.5:LRA=11')
        args = ['-f', 'f32le', '-ar', str(SR), '-ac', str(x.shape[1]), '-i', w]
        if af:
            args += ['-af', ','.join(af)]
        if peak is not None and not af:
            pk = np.abs(x).max() + 1e-9
            x = x * (10 ** (peak / 20) / pk)
            x.astype(np.float32).tofile(w)
        args += ['-ar', str(SR), '-ac', '1' if mono else str(x.shape[1]), '-c:a', 'libvorbis', '-q:a', str(q), os.path.join(OUT, name + '.ogg')]
        run(args)


def seg(path, t0, t1, ch=2):
    x = read(path, ch)
    return x[int(t0 * SR): int(t1 * SR)]


def hit(sid, k, dur, thr=-30, ch=1):
    x = read(fs(sid), ch)
    o = onsets(x, thr)
    s = o[k % len(o)]
    y = x[s: s + int(dur * SR)].copy()
    return fade(y, 0.002, min(0.08, dur / 3))


def norm(x, db):
    return x * (10 ** (db / 20) / (np.abs(x).max() + 1e-9))


RECIPES = {}


def recipe(name):
    def deco(f):
        RECIPES[name] = f
        return f
    return deco


# ── ambience beds ───────────────────────────────────────────────────────────
@recipe('amb_wind')
def _():
    write('amb_wind', loopify(seg(fs(505999), 40, 100)), 'lowpass=f=7000', lufs=-24, q=3)


@recipe('amb_cave')
def _():
    write('amb_cave', loopify(seg(fs(740041), 90, 150)), 'highpass=f=30', lufs=-26, q=3)


@recipe('amb_drips')
def _():
    write('amb_drips', loopify(seg(fs(177958), 10, 70)), 'highpass=f=150', lufs=-27, q=3)


@recipe('amb_ink')
def _():
    write('amb_ink', loopify(seg(fs(315915), 5, 50)), 'asetrate=44100*0.82,aresample=44100,lowpass=f=2600', lufs=-27, q=3)


@recipe('amb_hum')
def _():
    write('amb_hum', loopify(seg(fs(516566), 20, 80)), 'lowpass=f=3000', lufs=-29, q=3)


# ── the doll ────────────────────────────────────────────────────────────────
@recipe('steps')
def _():
    for i, k in enumerate([0, 2, 4, 6]):
        write(f'step{i + 1}', norm(hit(757485, k, 0.32, -26), -5), 'highpass=f=90', mono=True)
    for i, k in enumerate([1, 3, 5]):
        write(f'snow{i + 1}', norm(hit(614137, k, 0.42, -24), -6), 'highpass=f=120', mono=True)


@recipe('moves')
def _():
    write('jump', norm(hit(435289, 1, 0.32, -24), -6), 'highpass=f=200', mono=True)
    write('land', norm(read(fs(843665), 1)[: int(0.6 * SR)], -4), 'highpass=f=60', mono=True)
    write('grip', norm(hit(435291, 2, 0.35, -24), -6), 'highpass=f=150', mono=True)
    write('release', norm(hit(435289, 4, 0.3, -24), -8), 'highpass=f=200', mono=True)
    write('mend', norm(hit(435291, 5, 0.5, -24), -7), 'asetrate=44100*1.15,aresample=44100', mono=True)


@recipe('thread')
def _():
    write('creak', loopify(seg(fs(862995), 4, 34, 1), 1.5), 'highpass=f=180', lufs=-22, mono=True)
    write('tie', norm(hit(596513, 0, 1.3, -26), -4), 'highpass=f=100', mono=True)
    write('snag', norm(hit(624487, 0, 0.9, -24), -4), 'highpass=f=150', mono=True)
    write('cut', norm(hit(719005, 1, 0.6, -24), -4), 'highpass=f=150', mono=True)
    write('tear', norm(hit(757519, 0, 1.8, -26), -3), 'highpass=f=80', mono=True)
    write('chew', norm(hit(719005, 3, 0.14, -20), -9), 'highpass=f=900,asetrate=44100*1.4,aresample=44100', mono=True)


@recipe('music_instruments')
def _():
    x = hit(490979, 0, 2.6, -30, ch=2)
    write('harp', norm(x, -3), 'highpass=f=90')
    write('bell', norm(read(fs(452379), 2)[: int(1.9 * SR)], -3))
    write('bowl', norm(fade(read(fs(841989), 2)), -4))
    write('chime', norm(fade(read(fs(553214), 2)[: int(4.5 * SR)], 0.003, 1.5), -6))
    write('gate', norm(fade(seg(fs(616335), 0, 9), 0.01, 3.0), -3))
    write('skein', norm(fade(seg(fs(195355), 2, 6.5), 0.05, 1.5), -6))


@recipe('world')
def _():
    write('moth', loopify(seg(fs(498180), 3, 23), 1.0), 'highpass=f=250', lufs=-20)
    write('drip', norm(hit(162116, 2, 1.4, -28), -4), 'highpass=f=200', mono=True)
    write('splash', norm(fade(seg(fs(315915), 20.2, 21.0, 1), 0.003, 0.3), -4), 'lowpass=f=4000', mono=True)


# ── music (Kevin MacLeod, CC BY 4.0) ─────────────────────────────────────────
MUSIC = {
    'mus_title': 'Ossuary 6 - Air', 'mus_gardens': 'Ossuary 1 - A Beginning', 'mus_gallery': 'Ossuary 2 - Turn',
    'mus_mere': 'Ossuary 5 - Rest',
}
# 'Peaceful Desolation' (brass) used to play in the Hall of Chairs. The user asked for it never to be used again in this game.
@recipe('music')
def _():
    for name, title in MUSIC.items():
        run(['-i', km(title), '-af', 'loudnorm=I=-20:TP=-1.5:LRA=11', '-ar', str(SR), '-c:a', 'libvorbis', '-q:a', '3', os.path.join(OUT, name + '.ogg')])
        print('  ', name, '<-', title)


def _resample(x, rate):
    """play x at `rate` (0.5 = an octave down, twice as long)"""
    n = int(len(x) / rate)
    t = np.arange(n) * rate
    return np.stack([np.interp(t, np.arange(len(x)), x[:, c]) for c in range(x.shape[1])], 1).astype(np.float32)


@recipe('amb_beat')
def _():
    """the Loom working, somewhere below: a slow heavy wooden beat (the batten), a creak of treadles between, 12 s loop"""
    D = 12.0
    n = int(D * SR)
    y = np.zeros((n, 2), np.float32)
    A = lambda name: read(os.path.join(OUT, name + '.ogg'), 2)
    land = A('land')
    thud = _resample(land, 0.32)
    k = _resample(A('wood'), 0.7)          # a wooden treadle, not the rope creak: no thread sounds in a bed that never stops
    def put(x, at, g):
        i = int(at * SR) % n; m = min(len(x), n - i)
        y[i:i + m] += x[:m] * g
        if m < len(x):
            y[:len(x) - m] += x[m:] * g
    for j, at in enumerate([0.0, 3.0, 6.0, 9.0]):
        put(thud, at, 0.9 if j % 2 == 0 else 0.7)
        put(k, at + 1.5, 0.18)
    write('amb_beat', y, 'lowpass=f=1800,highpass=f=30,aecho=0.6:0.5:180|420:0.35|0.2', lufs=-27, q=3)


def mono2(x, pan=0.0):
    x = x[:, 0] if x.ndim == 2 else x
    return np.stack([x * (1 - max(0, pan)), x * (1 + min(0, pan))], 1).astype(np.float32)


def put(y, x, at, g=1.0):
    """add x (n,2) into the loop y at time `at`, wrapping the tail"""
    n, i = len(y), int(at * SR) % len(y)
    m = min(len(x), n - i)
    y[i:i + m] += x[:m] * g
    if m < len(x):
        r = min(len(x) - m, n)
        y[:r] += x[m:m + r] * g


def brown(n, seed, k=(400, 160, 60)):
    z = np.random.default_rng(seed).standard_normal((n, 2)).astype(np.float32)
    for q in k:
        z = np.stack([np.convolve(z[:, c], np.ones(q) / q, mode='same') for c in range(2)], 1)
    return z / (np.abs(z).max() + 1e-6)


@recipe('dirt')
def _():
    """a hand breaking out of packed earth: a soft low thump, a burst of soil, stones and crumbs raining off it (and the
    crumbs alone, for the warning before it). Dug earth and falling debris recordings, no rope or thread in it."""
    rng = np.random.default_rng(3)
    dig, fall, rocks = read(fs(415303), 1), read(fs(569745), 1), read(fs(567251), 1)
    do, fo, ro = onsets(dig, -20, 0.5), onsets(fall, -30, 0.3), onsets(rocks, -24, 0.3)
    for j in range(3):
        n = int(1.9 * SR)
        y = np.zeros((n, 1), np.float32)
        def lay(x, o, k, at, dur, g, rate=1.0):
            z = x[o[k % len(o)]:][: int(dur * SR * rate)].copy()
            z = norm(fade(_resample(z, rate), 0.002, 0.25), 0)
            i = int(at * SR); m = min(len(z), n - i)
            y[i:i + m] += z[:m] * g
        t = np.arange(int(0.35 * SR)) / SR
        y[: len(t), 0] += 0.8 * np.sin(2 * np.pi * (62 * t - 40 * t * t)) * np.exp(-t * 11)      # the ground giving way
        lay(dig, do, j, 0.0, 0.75, 0.9, 0.8)
        lay(dig, do, j + 3, 0.05, 0.5, 0.5, 1.15)
        lay(rocks, ro, j + 1, 0.16, 0.8, 0.35, 0.9)
        lay(fall, fo, j, 0.3, 1.4, 0.45)
        y *= np.linspace(1, 0.6, n)[:, None]
        write(f'dirt{j + 1}', norm(y, -2), 'highpass=f=35,lowpass=f=7000', mono=True)
    for j in range(2):
        z = fade(fall[fo[(j * 2 + 1) % len(fo)]:][: int(0.8 * SR)].copy(), 0.03, 0.4)
        write(f'crumbs{j + 1}', norm(z, -8), 'highpass=f=200,lowpass=f=6000', mono=True)


@recipe('wood')
def _():
    """dry timber: the heddles' warning and the treadles (both used the rope creak before)"""
    x = read(fs(589868), 1)
    z = fade(x[int(6.38 * SR): int(7.3 * SR)].copy(), 0.004, 0.4)
    write('wood', norm(_resample(z, 0.75), -4), 'highpass=f=90,lowpass=f=4500', mono=True)


@recipe('horror')
def _():
    slap = read(fs(862895), 1)
    so = onsets(slap, -18, 0.2)
    for j in range(3):      # bare palms on stone, close
        write(f'palm{j + 1}', norm(fade(slap[so[(j * 3 + 2) % len(so)]:][: int(0.4 * SR)].copy(), 0.002, 0.2), -3), 'highpass=f=60,lowpass=f=4500', mono=True)
    drag = read(fs(578493), 1)
    write('drag', norm(fade(drag[int(4 * SR): int(8.5 * SR)].copy(), 0.2, 1.0), -4), 'highpass=f=50,lowpass=f=3800', mono=True)
    bone = read(fs(574752), 1)
    bo = onsets(bone, -20, 0.15)
    for j in range(2):
        write(f'bone{j + 1}', norm(fade(bone[bo[(j * 2) % len(bo)]:][: int(0.7 * SR)].copy(), 0.001, 0.3), -2), 'highpass=f=80', mono=True)
    # one long inhale, slowed until it is too big to be a person
    br = read(fs(835484), 1)[int(2.0 * SR): int(2.62 * SR)].copy()
    z = fade(_resample(br, 0.19), 0.5, 0.8)
    write('inhale', norm(z, -3), 'highpass=f=60,lowpass=f=2600,aecho=0.8:0.6:140|330:0.3|0.2', mono=True)
    # a hard low impact with nothing musical in it: what the dark does when it moves
    n = int(3.2 * SR)
    t = np.arange(n) / SR
    y = 0.9 * np.sin(2 * np.pi * (38 * t + 14 * np.exp(-t * 9))) * np.exp(-t * 2.2)
    y += brown(n, 9, (30, 12))[:, 0] * np.exp(-t * 7) * 0.8
    write('thud', norm(y[:, None].astype(np.float32), -1), 'lowpass=f=900', mono=True)


@recipe('amb_breath')
def _():
    """the bottom of the world breathing: two long breaths a minute's third apart, too slow, with a pause after each that is a
    little different every time. 40 s loop. No notes."""
    D = 40.0
    n = int(D * SR)
    y = np.zeros((n, 2), np.float32)
    inh = read(os.path.join(OUT, 'inhale.ogg'), 1)
    for at, r, g in ((0.5, 1.0, 0.8), (12.5, 0.86, 0.9), (21.0, 0.94, 0.75), (31.5, 0.8, 1.0)):
        z = _resample(inh, r)
        put(y, mono2(z, -0.2), at, g)
        put(y, mono2(_resample(z[::-1].copy(), 0.8), 0.25), at + len(z) / SR * 0.95, g * 0.5)     # and out again
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * 33 * t + 0.5 * np.sin(2 * np.pi * t / 10)) * (0.5 + 0.5 * np.sin(2 * np.pi * t / 8))
    y += (sub * 0.10)[:, None].astype(np.float32) + brown(n, 4) * 0.10
    write('amb_breath', y, 'lowpass=f=1500,highpass=f=24', lufs=-27, q=4)


@recipe('amb_hall')
def _():
    """the Hall of Chairs (2026-11-24; it had brass): no music. A room tone, wood settling now and then, and very far down,
    under the floor, people talking one at a time, too low to make out. 60 s loop."""
    D = 60.0
    n = int(D * SR)
    y = np.zeros((n, 2), np.float32)
    y += brown(n, 21, (900, 300, 80)) * 0.22
    rng = np.random.default_rng(41)
    vd = os.path.join(ROOT, 'app', 'assets', 'voice')
    k = 0
    for at in np.arange(2, 58, 4.6):
        for name in (('m1', 'm4', 'm2', 'm7', 'm5', 'm3')[k % 6],):
            p = os.path.join(vd, name + '.ogg')
            if os.path.exists(p):
                v = read(p, 1)
                i = int(rng.uniform(0, max(1, len(v) - 4 * SR)))
                z = fade(_resample(v[i: i + int(3.2 * SR)].copy(), float(rng.uniform(0.5, 0.75))), 0.8, 1.2)
                put(y, mono2(z, float(rng.uniform(-0.8, 0.8))), at + float(rng.uniform(0, 1)), 0.5)
        k += 1
    w = read(os.path.join(OUT, 'wood.ogg'), 1)
    for at, r in ((9, 0.6), (27.5, 0.5), (46, 0.65)):
        put(y, mono2(_resample(w, r), 0.4 if at > 20 else -0.5), at, 0.12)
    write('amb_hall', y, 'lowpass=f=420,highpass=f=40,aecho=0.7:0.6:300|700:0.35|0.25', lufs=-30, q=4)


# ── the detail pass (2026-11-24): what the doll walks on, what the place does on its own, what answers her ──
def best_hits(sid, n, dur, thr=-28, gap=0.18, lo=0.0, hi=1e9):
    """n distinct hits from a recording: the onsets closest in loudness to the middle of the pack (the loudest and the
    faintest are usually scuffs or knocks), spread over the take"""
    x = read(fs(sid), 1)
    o = [s for s in onsets(x, thr, gap) if lo <= s / SR <= hi and s + int(dur * SR) < len(x)]
    pk = np.array([np.abs(x[s: s + int(dur * SR)]).max() for s in o])
    med = np.median(pk)
    order = sorted(range(len(o)), key=lambda i: abs(np.log(pk[i] / med)))[: max(n, int(len(o) * 0.7))]
    order = sorted(order)
    n = min(n, len(order))
    take = [order[int(round(i * (len(order) - 1) / max(1, n - 1)))] for i in range(n)]
    return [fade(x[o[i]: o[i] + int(dur * SR)].copy(), 0.002, dur * 0.45) for i in take]


def filtered(x, filt):
    """x through an ffmpeg filter chain, back as an array"""
    with tempfile.TemporaryDirectory() as td:
        w = os.path.join(td, 'a.f32')
        x.astype(np.float32).tofile(w)
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', str(x.shape[1]), '-i', w, '-af', filt, '-f', 'f32le', '-'], capture_output=True).stdout
        return np.frombuffer(raw, np.float32).reshape(-1, x.shape[1]).copy()


def group(name, hits, db=-6, filt=None, rate=1.0):
    """a set of variants, levelled after filtering by their loudest 60 ms (so none of a set jumps out), peaks under -2 dB"""
    k = int(0.06 * SR)
    for i, h in enumerate(hits):
        x = _resample(h, rate) if rate != 1.0 else h
        if filt:
            x = filtered(x, filt)
        e = np.sqrt(np.convolve((x[:, 0] ** 2), np.ones(k) / k, 'valid').max()) if len(x) > k else np.sqrt((x ** 2).mean())
        g = 10 ** ((db - 12) / 20) / (e + 1e-9)
        x = x * min(g, 10 ** (-2 / 20) / (np.abs(x).max() + 1e-9))
        write(f'{name}{i + 1}', x, None, mono=True)
    print('  ', name, len(hits))


def band(n, seed, lo, hi):
    """noise between lo and hi Hz, n samples"""
    z = np.random.default_rng(seed).standard_normal(n)
    f = np.fft.rfft(z)
    fr = np.fft.rfftfreq(n, 1 / SR)
    f *= 1 / (1 + (lo / np.maximum(fr, 1e-3)) ** 4) / (1 + (fr / hi) ** 4)
    z = np.fft.irfft(f, n)
    return (z / (np.abs(z).max() + 1e-9)).astype(np.float32)


@recipe('detail_steps')
def _():
    group('st_wood', best_hits(369641, 6, 0.36, -26), -6, 'highpass=f=70,lowpass=f=6500')
    group('st_board', best_hits(459970, 3, 0.4, -24), -7, 'highpass=f=60,lowpass=f=3500')         # hollow, under the boards
    group('st_earth', best_hits(389454, 5, 0.34, -24), -6, 'highpass=f=60,lowpass=f=4200')
    group('st_leaf', best_hits(683958, 4, 0.4, -22, 0.3), -9, 'highpass=f=300,lowpass=f=9000')
    group('st_wet', best_hits(338106, 5, 0.34, -26), -7, 'highpass=f=120')
    group('st_soft', best_hits(234855, 5, 0.34, -24), -7, 'highpass=f=50,lowpass=f=1800')         # felt on wool
    group('st_grit', best_hits(257468, 4, 0.16, -24, 0.1), -10, 'highpass=f=700')
    group('cloth', best_hits(435289, 2, 0.4, -24, 0.4) + best_hits(435291, 3, 0.4, -24, 0.4), -9, 'highpass=f=220')
    # a heavier landing for each kind of ground: the footfall an octave down with a thump under it
    t = np.arange(int(0.5 * SR)) / SR
    for nm, sid, g in (('earth', 389454, 0.7), ('wood', 459970, 0.5), ('wet', 338106, 0.5), ('soft', 234855, 0.7)):
        h = best_hits(sid, 1, 0.4, -24)[0]
        z = np.zeros((int(0.6 * SR), 1), np.float32)
        a = norm(_resample(h, 0.62), -2)[: len(z)]
        z[: len(a)] += a
        z[: len(t), 0] += (g * np.sin(2 * np.pi * (78 * t - 45 * t * t)) * np.exp(-t * 16)).astype(np.float32)
        write(f'ld_{nm}', norm(z, -3), 'highpass=f=35,lowpass=f=5000', mono=True)


@recipe('detail_rock')
def _():
    x = read(fs(381547), 1)
    o = onsets(x, -26, 1.2)
    group('stones', [fade(x[s: s + int(1.7 * SR)].copy(), 0.004, 0.8) for s in o[:4]], -6, 'highpass=f=140')
    y = read(fs(668606), 1)
    oy = [s for s in onsets(y, -40, 0.35) if s / SR > 9.5]
    group('tick', [fade(y[s: s + int(0.35 * SR)].copy(), 0.001, 0.2) for s in oy[:4]], -6, 'highpass=f=200')   # one small stone
    d = read(fs(675728), 1)
    group('trickle', [fade(d[int(a * SR): int((a + 1.9) * SR)].copy(), 0.1, 1.0) for a in (9.0, 14.0, 18.2)], -8, 'highpass=f=160')
    g = read(fs(844329), 1)
    write('grind', norm(fade(g[int(5.2 * SR): int(9.6 * SR)].copy(), 0.15, 1.6), -4), 'highpass=f=40,lowpass=f=3500', mono=True)
    for i, (sid, a, b, r) in enumerate(((737428, 0, 7.5, 0.8), (574385, 1, 13.5, 0.8), (879260, 0, 7, 0.75))):
        write(f'rumble{i + 1}', norm(fade(_resample(read(fs(sid), 1)[int(a * SR): int(b * SR)], r), 0.5, 3.0), -5), 'highpass=f=24,lowpass=f=500', mono=True)
    ice = read(fs(737896), 1)       # a frozen lake under strain, slowed: the weight of the place settling
    for i, (a, b, r) in enumerate(((9.0, 11.5, 0.55), (23.0, 27.0, 0.5), (39.5, 43.0, 0.5), (52.2, 55.5, 0.55))):
        write(f'groan{i + 1}', norm(fade(_resample(ice[int(a * SR): int(b * SR)], r), 0.06, 2.0), -5), 'highpass=f=30,lowpass=f=1700', mono=True)


@recipe('detail_life')
def _():
    c = read(fs(495396), 1)
    oc = onsets(c, -18, 0.8)
    group('cricket', [fade(c[s: s + int(0.8 * SR)].copy(), 0.01, 0.25) for s in oc[3:15:4]], -10, 'highpass=f=1800')
    group('beetle', best_hits(831713, 4, 0.25, -24), -10, 'highpass=f=500')
    group('twig', best_hits(552006, 5, 0.3, -20, 0.5), -7, 'highpass=f=200')
    lv = read(fs(179338), 1)
    group('leaf', [fade(lv[int(a * SR): int((a + 0.75) * SR)].copy(), 0.15, 0.35) for a in (0.4, 2.6, 4.2, 6.2)], -10, 'highpass=f=500,afftdn=nr=14:nf=-34')
    # roots and beams taking weight: dry cracks slowed until they are timber (a leaning-tree recording was tried: it
    # ticks like a tightening rope, which the user does not want to hear)
    tw = best_hits(552006, 4, 0.5, -20, 0.5)
    tm = []
    for i, h in enumerate(tw):
        z = np.zeros((int(1.6 * SR), 1), np.float32)
        for at, r, g in ((0.0, 0.3, 1.0), (0.16 + 0.09 * i, 0.24, 0.5), (0.5 - 0.07 * i, 0.36, 0.25)):
            q = norm(_resample(h, r), 0) * g
            k = int(at * SR); m = min(len(q), len(z) - k)
            z[k:k + m] += q[:m]
        tm.append(fade(z, 0.002, 0.6))
    group('timber', tm, -7, 'highpass=f=50,lowpass=f=1300')
    ch = read(fs(235805), 1)
    group('chair', [fade(ch[int(a * SR): int((a + 1.5) * SR)].copy(), 0.03, 0.5) for a in (3.2, 7.6, 14.2, 20.8)], -8, 'highpass=f=90,lowpass=f=2400', 0.72)
    fl, fl2 = read(fs(406620), 1), read(fs(802578), 1)
    group('floor', [fade(h.copy(), 0.01, 0.2) for h in (fl[int(0.9 * SR): int(1.5 * SR)], fl[int(2.5 * SR): int(3.3 * SR)], fl[int(4.2 * SR): int(4.9 * SR)], fl2)], -8, 'highpass=f=80,lowpass=f=2600,afftdn=nr=10:nf=-36', 0.8)
    sc = read(fs(354094), 1)
    so = [int(a * SR) for a in (2.0, 5.0, 8.0, 11.0)]
    group('scratch', [fade(sc[a: a + int(1.0 * SR)].copy(), 0.08, 0.4) for a in so], -9, 'highpass=f=180,lowpass=f=3800', 0.8)
    lm = read(fs(582994), 1)
    group('loomwork', [fade(lm[int(a * SR): int((a + 2.8) * SR)].copy(), 0.4, 1.0) for a in (3.0, 9.0, 14.0)], -6, 'highpass=f=80,lowpass=f=1500', 0.6)


@recipe('detail_iron')
def _():
    r = read(fs(95275), 1)
    ro = onsets(r, -20, 0.6)
    group('ring', [fade(r[s: s + int(1.1 * SR)].copy(), 0.001, 0.6) for s in ro[:2]], -9, 'lowpass=f=5200', 0.62)
    k = read(fs(401622), 1)
    ko = onsets(k, -24, 0.5)
    group('chain', [fade(k[s: s + int(0.9 * SR)].copy(), 0.004, 0.45) for s in ko[:4]], -9, 'highpass=f=250,lowpass=f=6000', 0.8)
    q = read(fs(248021), 1)
    group('hinge', [fade(q[int(a * SR): int(b * SR)].copy(), 0.03, 0.2) for a, b in ((1.8, 2.3), (3.7, 4.1), (4.15, 4.6))], -10, 'highpass=f=200,lowpass=f=2800', 0.7)


@recipe('detail_water')
def _():
    p = read(fs(166325), 1)
    s = onsets(p, -30)[0]
    h = fade(p[s: s + int(0.4 * SR)].copy(), 0.002, 0.15)
    for i, r in enumerate((0.55, 0.75, 1.0)):
        write(f'plop{i + 1}', norm(_resample(h, r), -6), 'highpass=f=90', mono=True)
    b = read(fs(577880), 1)
    group('bubble', [fade(b[int(a * SR): int((a + 1.3) * SR)].copy(), 0.1, 0.5) for a in (0.8, 3.4, 6.0, 8.4)], -8, 'highpass=f=50,lowpass=f=1400', 0.7)
    write('lap', loopify(seg(fs(574869), 2, 40), 2.0), 'asetrate=44100*0.8,aresample=44100,highpass=f=80,lowpass=f=3000,acompressor=threshold=0.06:ratio=4:attack=3:release=120', lufs=-24, q=3)


@recipe('detail_beds')
def _():
    write('amb_pit', loopify(seg(fs(576970), 2, 70), 4.0), 'lowpass=f=1800', lufs=-24, q=3)
    write('amb_deep', loopify(_resample(seg(fs(454356), 4, 44), 0.7), 4.0), 'highpass=f=24,lowpass=f=220', lufs=-26, q=3)
    n = int(10 * SR)
    # a flame: a low flutter and dry pops
    rng = np.random.default_rng(8)
    t = np.arange(n) / SR
    y = band(n, 1, 60, 420) * (0.35 + 0.65 * np.abs(band(n, 2, 0.5, 9))) * 0.6 + band(n, 3, 1500, 6000) * 0.03
    m = int(0.012 * SR)
    for at in rng.uniform(0.1, 9.8, 26):
        i = int(at * SR)
        y[i:i + m] += (band(m, int(at * 999), 900, 5000) * np.exp(-np.arange(m) / (0.0025 * SR)) * rng.uniform(0.15, 0.6)).astype(np.float32)
    write('flame', loopify(np.stack([y, y], 1).astype(np.float32), 1.0), 'highpass=f=50', lufs=-24, q=3, mono=True)
    # the veil: a breath that never finishes
    v = np.stack([band(n, 5 + c, 500, 1500) * (0.45 + 0.4 * np.sin(2 * np.pi * t / 5 + c) + 0.15 * np.abs(band(n, 9, 0.5, 6))) for c in range(2)], 1)
    write('veil', loopify(v.astype(np.float32), 1.5), 'highpass=f=250', lufs=-27, q=3)
    # moving air, for falls and swings (the game filters it by her speed)
    a = np.stack([band(n, 20 + c, 80, 2500) for c in range(2)], 1)
    write('air', loopify(a, 1.0), None, lufs=-22, q=3)
    # a lit bell, still ringing: the middle of a singing bowl, held
    bw = read(fs(841989), 2)
    z = bw[int(0.5 * SR): int(2.1 * SR)]
    f0 = z * np.hanning(len(z))[:, None]
    hold = np.zeros((int(8 * SR) + len(z), 2), np.float32)
    for k in range(0, int(8 * SR), len(z) // 4):
        hold[k:k + len(z)] += f0
    write('bellhum', loopify(hold[len(z): -len(z)].astype(np.float32), 1.0), 'lowpass=f=3000', lufs=-26, q=3)


def credits():
    m = meta()
    lines = ['# Sound & music credits', '', '## Music', '',
             'Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0', '']
    lines += [f'- "{t}"' for t in MUSIC.values()]
    lines += ['', '## Sounds (Freesound.org, CC0 1.0)', '']
    for sid, v in sorted(m.items(), key=lambda kv: int(kv[0])):
        lines.append(f'- "{v["title"]}" by {v["user"]} — {v["url"]}')
    open(os.path.join(ROOT, 'app', 'assets', 'audio', 'CREDITS.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    want = sys.argv[1:]
    for name, f in RECIPES.items():
        if want and not any(w in name for w in want):
            continue
        f()
        print('built', name, flush=True)
    credits()
