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
    'mus_mere': 'Ossuary 5 - Rest', 'mus_loom': 'Peaceful Desolation',
}
# mus_end used to be 'Heartbreaking': a swelling, heroic orchestral cue that played over the tie, the credits and the
# epilogue film. The user found it completely unsuitable. It is now the dirge below, built from the game's own sounds.


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


@recipe('mus_end')
def _():
    """The dirge for the tie, the credits and the epilogue: no melody to lift it, nothing that resolves.
    A low drone a semitone against itself (it beats, slowly, like breathing through cloth), deep gong strokes from the
    singing bowl two octaves down, a harp that picks a falling line and stops before the last note, and the broken
    music box far off, slowed until it drags. 96 s, loops."""
    rng = np.random.default_rng(7)
    D = 96.0
    n = int(D * SR)
    t = np.arange(n) / SR
    y = np.zeros((n, 2), np.float32)
    # drone: A1 against B-flat1, an octave above that faint, each swelling on its own slow cycle (loop-safe periods)
    sw = lambda per, ph: 0.55 + 0.45 * np.sin(2 * np.pi * t / per + ph)
    for f, a, per, ph, pan in ((55.0, 0.30, 24, 0.0, -0.2), (58.27, 0.22, 32, 1.7, 0.25), (110.0, 0.06, 48, 0.6, 0.0), (164.8, 0.025, 19.2, 2.2, -0.4)):
        v = a * sw(per, ph) * np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * t / 7.5))
        y[:, 0] += v * (1 - pan) * 0.7; y[:, 1] += v * (1 + pan) * 0.7
    # a cold breath: band-limited noise under it all
    nz = rng.standard_normal((n, 2)).astype(np.float32)
    for k in (300, 120, 60):
        nz = np.stack([np.convolve(nz[:, c], np.ones(k) / k, mode='same') for c in range(2)], 1)
    y += nz / (np.abs(nz).max() + 1e-6) * 0.05 * sw(16, 0.4)[:, None]
    def put(x, at, g, pan=0.0):
        i = int(at * SR) % n
        m = min(len(x), n - i)
        y[i:i + m, 0] += x[:m, 0] * g * (1 - pan); y[i:i + m, 1] += x[:m, -1] * g * (1 + pan)
        if m < len(x):  # wrap the tail round so the loop point is seamless
            r = min(len(x) - m, n)
            y[:r, 0] += x[m:m + r, 0] * g * (1 - pan); y[:r, 1] += x[m:m + r, -1] * g * (1 + pan)
    A = lambda name: read(os.path.join(OUT, name + '.ogg'), 2)
    bowl, harp, box, bell = A('bowl'), A('harp'), A('skein'), A('bell')
    gong = _resample(bowl, 0.25)                      # two octaves down
    for k, at in enumerate((0.5, 22.0, 41.0, 64.0, 80.0)):
        put(gong, at, 0.55 if k % 2 == 0 else 0.4, pan=(-0.3, 0.3)[k % 2])
    # the harp: a falling line in A minor that never reaches home (A G F E D# ... and stops)
    line = [(0, 6.0), (-2, 9.0), (-4, 12.0), (-5, 15.5), (-6, 20.5),
            (0, 30.0), (-2, 33.0), (-4, 36.0), (-5, 39.5),
            (-12, 50.0), (-13, 54.0), (-17, 58.5),
            (0, 70.0), (-2, 73.0), (-4, 76.0), (-5, 79.5), (-6, 84.5)]
    for semis, at in line:
        x = _resample(harp, 2 ** ((semis - 12) / 12))
        put(x, at, 0.32, pan=float(rng.uniform(-0.4, 0.4)))
    # the broken music box, far away and dragging
    far = _resample(box, 0.62)[::-1].copy()           # backwards: it winds down instead of up
    for at in (26.0, 66.0):
        put(far * np.linspace(0, 1, len(far))[:, None] ** 2, at, 0.10, pan=0.5)
    put(_resample(bell, 0.35), 47.0, 0.18, pan=-0.5)    # one dead bell
    y = np.tanh(y * 1.2) / 1.2
    write('mus_end', y, 'lowpass=f=5200,highpass=f=28', lufs=-21, q=4)


@recipe('amb_beat')
def _():
    """the Loom working, somewhere below: a slow heavy wooden beat (the batten), a creak of treadles between, 12 s loop"""
    D = 12.0
    n = int(D * SR)
    y = np.zeros((n, 2), np.float32)
    A = lambda name: read(os.path.join(OUT, name + '.ogg'), 2)
    land, creak = A('land'), A('creak')
    thud = _resample(land, 0.32)
    k = _resample(creak, 0.6)[: int(1.6 * SR)].copy()
    k *= np.linspace(1, 0, len(k))[:, None] ** 1.5
    def put(x, at, g):
        i = int(at * SR) % n; m = min(len(x), n - i)
        y[i:i + m] += x[:m] * g
        if m < len(x):
            y[:len(x) - m] += x[m:] * g
    for j, at in enumerate([0.0, 3.0, 6.0, 9.0]):
        put(thud, at, 0.9 if j % 2 == 0 else 0.7)
        put(k, at + 1.5, 0.18)
    write('amb_beat', y, 'lowpass=f=1800,highpass=f=30,aecho=0.6:0.5:180|420:0.35|0.2', lufs=-27, q=3)


@recipe('mus_weaver')
def _():
    """the Loom: the dirge's drone gone wrong. A cluster of three low tones grinding against each other, a slow throb
    like a heart under cloth (0.75 Hz), the bowl struck far down, and the music box pulled out of tune. 64 s loop."""
    rng = np.random.default_rng(13)
    D = 64.0
    n = int(D * SR)
    t = np.arange(n) / SR
    y = np.zeros((n, 2), np.float32)
    throb = (0.5 + 0.5 * np.sin(2 * np.pi * 0.75 * t)) ** 3
    for f, a, pan in ((41.2, 0.32, -0.2), (43.65, 0.26, 0.2), (46.25, 0.2, 0.0), (82.4, 0.06, -0.4), (87.3, 0.05, 0.4)):
        v = a * (0.45 + 0.55 * throb) * np.sin(2 * np.pi * f * t + 0.4 * np.sin(2 * np.pi * t / 9.0))
        y[:, 0] += v * (1 - pan) * 0.7; y[:, 1] += v * (1 + pan) * 0.7
    nz = rng.standard_normal((n, 2)).astype(np.float32)
    for k in (200, 80):
        nz = np.stack([np.convolve(nz[:, c], np.ones(k) / k, mode='same') for c in range(2)], 1)
    y += nz / (np.abs(nz).max() + 1e-6) * 0.06 * (0.6 + 0.4 * np.sin(2 * np.pi * t / 16))[:, None]
    A = lambda name: read(os.path.join(OUT, name + '.ogg'), 2)
    gong = _resample(A('bowl'), 0.2)
    box = _resample(A('skein'), 0.55)
    def put(x, at, g, pan=0.0):
        i = int(at * SR) % n; m = min(len(x), n - i)
        y[i:i + m, 0] += x[:m, 0] * g * (1 - pan); y[i:i + m, 1] += x[:m, -1] * g * (1 + pan)
        if m < len(x):
            r = len(x) - m
            y[:r, 0] += x[m:, 0] * g * (1 - pan); y[:r, 1] += x[m:, -1] * g * (1 + pan)
    for at in (2.0, 18.0, 34.0, 50.0):
        put(gong, at, 0.5)
    for at, r in ((10.0, 0.97), (42.0, 1.03)):
        put(_resample(box, r), at, 0.09, pan=0.5 if r > 1 else -0.5)
    y = np.tanh(y * 1.3) / 1.3
    write('mus_weaver', y, 'lowpass=f=4200,highpass=f=25', lufs=-21, q=4)


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
