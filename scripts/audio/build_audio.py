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
