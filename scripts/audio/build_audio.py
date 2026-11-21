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
    'mus_mere': 'Ossuary 5 - Rest', 'mus_loom': 'Peaceful Desolation', 'mus_end': 'Heartbreaking',
}


@recipe('music')
def _():
    for name, title in MUSIC.items():
        run(['-i', km(title), '-af', 'loudnorm=I=-20:TP=-1.5:LRA=11', '-ar', str(SR), '-c:a', 'libvorbis', '-q:a', '3', os.path.join(OUT, name + '.ogg')])
        print('  ', name, '<-', title)


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
