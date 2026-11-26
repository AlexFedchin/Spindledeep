"""Spindledeep cinematics: cut the graded shots into a film, lay the soundtrack, encode for the game.

    <art venv>/python scripts/cine/edit.py intro|outro|cut [--draft]

Picture: graded PNG frames per shot (post.py) joined with cuts and dissolves; the prologue ends on an engraved
title card, the epilogue fades to paper. Sound: the game's own recordings (app/assets/audio, credited in its
CREDITS.md) placed on the edit's timeline, plus a few synthesised sounds (candle crackle, a breath).
Output: app/assets/cine/<film>.mp4 (H.264 + AAC; VP9 at 1080p failed to hardware-decode in Electron here)."""
import glob
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
CACHE = os.path.join(HERE, '.cache')
AUD = os.path.join(ROOT, 'app', 'assets', 'audio')
FONT = os.path.join(ROOT, 'app', 'assets', 'fonts', 'IMFeENsc28P.ttf')
FPS, SR = 24, 48000
W, H = 1920, 1080
INK = np.array([0.045, 0.04, 0.06]); PAPER = np.array([0.91, 0.86, 0.75]); RED = np.array([0.85, 0.12, 0.08])

# (shot, transition into this shot in frames: 0 = cut)
FILMS = {
    'intro': [('I1', 0), ('I2', 16), ('I2K', 0), ('I3', 0), ('I4', 0), ('I5', 10), ('I5S', 0), ('I6', 0), ('I7', 0), ('I8', 20), ('I9', 0), ('TITLE', 0)],      # shots_intro.py
    'cut': [('C1', 0), ('C2', 14), ('C3', 14), ('C4', 0), ('C5', 0)],      # shots_end.py: the bitten ending
    'outro': [('O2', 0), ('O1', 0), ('O3', 0), ('O4', 0), ('O5', 0), ('O6', 0), ('O7', 0)],      # shots_end.py: the tied ending; hard cuts. It opens where the game's ending leaves off, at the lip of the pit
    'names': [('N1', 0)],      # shots_end.py: after the titles of the bitten ending
}


def shot_frames(name, draft):
    d = os.path.join(CACHE, 'graded_prev' if draft else 'graded', name)
    return sorted(glob.glob(os.path.join(d, '*.png')))


def load(path):
    im = Image.open(path).convert('RGB')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def grain(f, a=0.02):
    rng = np.random.default_rng(f)
    return (rng.random((H, W, 1), dtype=np.float32) - 0.5) * a


def title_frames(n=110):
    """an engraved title: paper letters hatched with fine lines on the ink, a red thread drawing itself
    beneath, then the plate darkens away"""
    font = ImageFont.truetype(FONT, 150)
    small = ImageFont.truetype(FONT, 34)
    txt = 'SPINDLEDEEP'
    base = Image.new('L', (W, H), 0)
    dr = ImageDraw.Draw(base)
    bb = dr.textbbox((0, 0), txt, font=font, spacing=0)
    th = bb[3] - bb[1]
    tw = sum(dr.textlength(ch, font=font) + 14 for ch in txt) - 14
    x0, y0 = int((W - tw) / 2), H // 2 - th // 2 - 60
    # letter-spaced title
    cx = x0
    for ch in txt:
        dr.text((cx, y0), ch, font=font, fill=255)
        cx += dr.textlength(ch, font=font) + 14
    mask = np.asarray(base, dtype=np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    hatch = (np.abs(((yy * math.cos(0.05) - xx * math.sin(0.05)) / 4.6) % 1 - 0.5) * 2 > 0.28).astype(np.float32)
    letters = mask * (0.55 + 0.45 * hatch)
    sub = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sub).text((W // 2, y0 + th + 120), 'a small descent on a single red thread', font=small, fill=200, anchor='mm')
    sub = np.asarray(sub, dtype=np.float32) / 255
    out = []
    ly = y0 + th + 64
    for i in range(n):
        t = i / FPS
        a_in = min(1, t / 1.2)
        a_out = 1 - max(0, (t - (n / FPS - 1.0)) / 1.0)
        draw = min(1, max(0, (t - 0.6) / 1.4))
        img = np.ones((H, W, 3), np.float32) * INK
        vig = 1 - np.clip(((xx / W - 0.5) ** 2 + ((yy / H - 0.5) * 0.85) ** 2) ** 0.5 * 1.3 - 0.3, 0, 1) * 0.6
        img = img * vig[..., None]
        img += (PAPER - INK) * (letters * a_in)[..., None]
        img += (PAPER * 0.75 - INK) * (sub * max(0, min(1, (t - 1.6) / 1.0)))[..., None]
        # the thread
        xs, xe = W * 0.3, W * 0.3 + W * 0.4 * draw
        win = np.clip((xx - xs) / 60, 0, 1) * np.clip((xe - xx) / 40, 0, 1)          # soft ends, a bright drawing tip
        tip = np.exp(-((xx - xe) ** 2) / 800.0) * (draw < 1)
        line = np.exp(-((yy - ly - 3 * np.sin(xx * 0.01)) ** 2) / 2.0) * win
        glow = np.exp(-((yy - ly) ** 2) / 300.0) * win * 0.3 + np.exp(-((yy - ly) ** 2 + (xx - xe) ** 2) / 900.0) * tip * 0.8
        img += (line * 1.1 + glow)[..., None] * RED
        img = img * a_out + INK * (1 - a_out)
        out.append(np.clip(img + grain(i), 0, 1))
    return out


def picture(film, draft):
    seq = []
    cuts = {}
    for name, tr in FILMS[film]:
        if name == 'TITLE':
            fr = title_frames()
            cuts[name] = len(seq)
            seq.extend(('arr', f) for f in fr)
            continue
        if name == 'PAPER':
            continue
        fs = shot_frames(name, draft)
        if not fs:
            print('missing shot', name); continue
        start = len(seq) - tr
        cuts[name] = max(0, start)
        for i, p in enumerate(fs):
            j = start + i
            if j < len(seq):
                k = (i + 1) / (tr + 1)
                seq[j] = ('mix', seq[j], ('png', p), k)
            else:
                seq.append(('png', p))
    for e in film_events(film, cuts):                          # the dark blinks
        if e['kind'] == 'blink':
            for j in range(int(e['f']), int(e['to'])):
                i = cuts[e['shot']] + j - 1
                if i < len(seq):
                    seq[i] = ('black', None)
    if film in ('outro', 'cut', 'names'):
        seq.extend(('black', None) for _ in range(36 if film == 'names' else 60))
    return seq, cuts


def render_item(it, f):
    kind = it[0]
    if kind == 'png':
        return load(it[1])
    if kind == 'arr':
        return it[1]
    if kind == 'mix':
        a = render_item(it[1], f); b = render_item(it[2], f)
        return a * (1 - it[3]) + b * it[3]
    if kind == 'paper':
        a = render_item(it[1], f)
        p = np.ones_like(a) * PAPER + grain(f, 0.03)
        return a * (1 - it[2]) + p * it[2]
    if kind == 'black':
        return np.ones((H, W, 3), np.float32) * INK * 0.4
    if kind == 'paperhold':
        return np.ones((H, W, 3), np.float32) * PAPER + grain(f, 0.03)


# ── sound ──────────────────────────────────────────────────────────────────
def decode(name, af=None, rate=1.0):
    path = name if os.path.isabs(name) else os.path.join(AUD, name + '.ogg')
    filt = []
    if rate != 1.0:
        filt.append(f'asetrate={int(44100 * rate)},aresample={SR}')
    if af:
        filt.append(af)
    cmd = ['ffmpeg', '-v', 'error', '-i', path] + (['-af', ','.join(filt)] if filt else []) + ['-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


class Mix:
    def __init__(self, seconds):
        self.buf = np.zeros((int(seconds * SR) + SR, 2), np.float32)

    def add(self, x, t, vol=1.0, fade_in=0.0, fade_out=0.0, dur=None, pan=0.0):
        i0 = int(t * SR)
        if dur is not None:
            x = x[: int(dur * SR)]
        x = x * vol
        n = len(x)
        if n == 0 or i0 >= len(self.buf):
            return
        env = np.ones(n, np.float32)
        if fade_in:
            k = min(n, int(fade_in * SR)); env[:k] *= np.linspace(0, 1, k)
        if fade_out:
            k = min(n, int(fade_out * SR)); env[n - k:] *= np.linspace(1, 0, k)
        x = x * env[:, None]
        if pan:
            x = x * np.array([1 - max(0, pan), 1 + min(0, pan)], np.float32)
        n = min(n, len(self.buf) - i0)
        self.buf[i0:i0 + n] += x[:n]

    def bed(self, x, t0, t1, vol, fi=1.0, fo=1.0):
        """loop x between t0 and t1"""
        need = int((t1 - t0) * SR)
        if need <= 0:
            return
        reps = need // len(x) + 1
        y = np.tile(x, (reps, 1))[:need]
        self.add(y, t0, vol, fi, fo)


def crackle(seconds, seed=0):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    y = np.zeros(n, np.float32)
    for _ in range(int(seconds * 14)):
        i = rng.integers(0, n - 400)
        L = rng.integers(40, 300)
        y[i:i + L] += (rng.random(L) - 0.5) * np.exp(-np.arange(L) / (L / 4)) * rng.random() * 0.6
    hum = (rng.random(n) - 0.5) * 0.02
    k = np.ones(40) / 40
    hum = np.convolve(hum, k, mode='same')
    return np.stack([y + hum, y * 0.9 + hum], 1)


def breath(seconds, seed=1):
    """a long low exhale: filtered noise under a slow swell"""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    x = rng.random(n).astype(np.float32) - 0.5
    for k in (400, 200, 120):
        x = np.convolve(x, np.ones(k) / k, mode='same')
    t = np.linspace(0, 1, n)
    env = np.sin(np.pi * t) ** 2
    x = x / (np.abs(x).max() + 1e-6) * env
    return np.stack([x, x * 0.95], 1)


def film_events(film, cuts):
    """every sound the shots asked for, on the film's clock: [{t, kind, vol, pan, shot, ...}]"""
    import json
    out = []
    for name, _ in FILMS[film]:
        p = os.path.join(CACHE, 'frames', name, 'events.json')
        if name not in cuts or not os.path.exists(p):
            continue
        for e in json.load(open(p)):
            out.append({**e, 'shot': name, 't': cuts[name] / FPS + (e['f'] - 1) / FPS})
    return sorted(out, key=lambda e: e['t'])


def place_events(M, E, place, film):
    """lay every event with its contact moment on its frame; leaves the stem and the list for synccheck.py"""
    import foley
    import json
    count, log = {}, []
    stem = np.zeros_like(M.buf)
    for e in E:
        k = e['kind']
        if k in ('wind_open', 'wind_shut', 'hush', 'blink', 'stop', 'black', 'cutblack', 'voice'):
            continue
        if k == 'breath':
            M.add(breath(4.2), e['t'], 0.34 * e['vol']); continue
        if k == 'gust':
            g = decode('amb_wind', af='highpass=f=120'); M.add(g[int(9 * SR): int(12.5 * SR)], e['t'] - 0.05, 0.9, fade_in=0.15, fade_out=2.4); continue
        i = count.get(k, 0); count[k] = i + 1
        c, t0, g = foley.clip(k, i, e.get('dur'))
        pl = place.get(e['shot'], dict(lo=None, hi=None, g=1.0, room=0.14))
        x = foley.band(c, pl['lo'], pl['hi']) if (pl['lo'] or pl['hi']) else c
        if pl['room']:
            n = int(0.09 * SR); y = np.zeros(len(x) + n, np.float32); y[: len(x)] = x
            for d, gg in ((0.013, 1.0), (0.022, 0.8), (0.037, 0.55), (0.058, 0.35), (0.081, 0.2)):
                j = int(d * SR); y[j: j + len(x)] += x[: len(y) - j] * gg * pl['room']
            x = y
        # no two alike
        vary = 1.0 + 0.12 * math.sin(i * 2.4 + len(k))
        x2 = np.stack([x, x], 1)
        v = g * e['vol'] * pl['g'] * vary
        M.add(x2, e['t'] - t0, v, pan=e.get('pan', 0.0))
        i0 = int((e['t'] - t0) * SR)
        if i0 >= 0:
            m = min(len(x2), len(stem) - i0); stem[i0: i0 + m] += x2[:m] * v
        log.append({'t': e['t'], 'kind': k, 'shot': e['shot'], 'f': e['f'], 'lasts': k in foley.LAST})
    json.dump(log, open(os.path.join(CACHE, film + '_events.json'), 'w'), indent=0)
    np.save(os.path.join(CACHE, film + '_foley.npy'), stem.mean(1).astype(np.float32))


def dull(x, hz=2400):
    import foley
    return np.stack([foley.band(x[:, 0], None, hz), foley.band(x[:, 1], None, hz)], 1).astype(np.float32)


def voices(M, E):
    V = lambda n: os.path.join(ROOT, 'app', 'assets', 'voice', n + '.ogg')
    for e in E:
        if e['kind'] == 'voice':
            x = decode(V(e['name']))[int(e.get('at', 0) * SR):]
            M.add(x, e['t'], e['vol'], fade_out=0.05, dur=e['dur'], pan=e['pan'])
            if e.get('cave'):                                  # the walls have it too, a little after
                y = np.zeros((int(3.2 * SR), 2), np.float32); m = min(len(x), int(e['dur'] * SR)); y[:m] = x[:m]
                wet = np.zeros_like(y)
                for d, g, p in ((0.083, 0.30, 0.5), (0.131, 0.26, -0.5), (0.227, 0.22, 0.2), (0.341, 0.17, -0.7), (0.52, 0.12, 0.7), (0.79, 0.08, -0.2), (1.13, 0.05, 0.3)):
                    i = int(d * SR); wet[i:] += y[: len(y) - i] * g * np.array([1 - max(0, p), 1 + min(0, p)], np.float32)
                M.add(dull(wet), e['t'], e['vol'])
            if e.get('echo'):                                  # the far side of the valley says it back, and not in the same voice
                for k, (d, r, v, p) in enumerate(((1.9, 0.94, 0.16, -0.6), (3.4, 1.1, 0.12, 0.6), (4.8, 0.72, 0.18, -0.2))):
                    M.add(decode(V(e['name']), rate=r, af='highpass=f=250,lowpass=f=1500,aecho=0.8:0.6:240|520:0.4|0.25'), e['t'] + d, v, fade_in=0.4, fade_out=0.8, pan=p)


def cut_sound(M, cuts, at, T, wind):
    """the bitten ending: the storm lets go, meltwater, the title's music for the only time since; then the well; then chairs and names"""
    E = film_events('cut', cuts)
    when = lambda kind: next(e['t'] for e in E if e['kind'] == kind)
    t2, t3, t4, t5, t_stop, t_black = at('C2'), at('C3'), at('C4'), at('C5'), when('stop'), when('black')
    soft = decode('amb_wind', af='lowpass=f=700'); far = decode('amb_wind', af='lowpass=f=240')
    M.bed(wind, 0, 3.6, 0.5, fi=1.2, fo=2.8)
    M.bed(soft, 1.0, t4 + 0.4, 0.22, fi=3, fo=0.5)
    M.add(decode('mus_title'), 1.2, 0.34, fade_in=4, fade_out=3.2, dur=t4 + 0.6 - 1.2)
    M.bed(decode('amb_drips'), at('C1', 60), t4 + 0.2, 0.34, fi=3, fo=0.5)
    for f in (90, 140, 190):
        M.add(decode('trickle%d' % (f % 3 + 1)), at('C1', f), 0.16, fade_in=0.4, fade_out=0.6)
    M.bed(far, t4 - 0.6, t5 + 2.0, 0.8, fi=0.6, fo=2.5)
    M.bed(decode('amb_drips', af='lowpass=f=900,aecho=0.8:0.7:400|900:0.5|0.3'), t4, t_stop + 0.03, 0.30, fi=1, fo=0.03)
    M.bed(decode('amb_hall'), t5 + 0.5, t_stop + 0.03, 0.22, fi=3, fo=0.03)            # and all of it stops with the chairs
    place = {'C1': dict(lo=None, hi=None, g=1.0, room=0.0), 'C2': dict(lo=None, hi=None, g=2.2, room=0.0), 'C3': dict(lo=None, hi=None, g=3.2, room=0.0), 'C5': dict(lo=None, hi=None, g=1.0, room=0.3)}
    place_events(M, E, place, 'cut'); voices(M, E)
    M.add(decode('inhale', rate=1.1), t_black - 0.75, 0.4, fade_out=0.05, dur=0.83)


def outro_sound(M, cuts, at, T):
    """the tied ending: no music. Snow, wood, hands, her voice, and bare feet"""
    E = film_events('outro', cuts)
    still = decode('amb_wind', af='lowpass=f=300')
    t3, t4, t5, t6, t7 = at('O3'), at('O4'), at('O5'), at('O6'), at('O7')
    M.bed(still, 0, t3 - 0.02, 0.4, fi=1.5, fo=0.02)
    M.bed(decode('amb_wind', af='lowpass=f=160'), t3, t4 + 0.2, 0.3, fi=0.3, fo=0.3)
    M.bed(decode('amb_wind', af='lowpass=f=160'), t4, t5 + 0.1, 0.22, fi=0.3, fo=0.1)
    M.bed(decode('amb_wind', af='lowpass=f=520'), t5, t6 + 0.2, 0.34, fi=0.2, fo=0.3)
    M.bed(still, t6, t7 + 0.1, 0.34, fi=0.2, fo=0.15)
    M.bed(decode('amb_wind', af='lowpass=f=130'), t7, T - 1.2, 0.3, fi=0.2, fo=1.5)
    step = decode('snow1', af='lowpass=f=1300')                # a great many bare feet, in no hurry
    rng = np.random.default_rng(3)
    for k in range(230):
        M.add(step, t6 + rng.random() * (t7 - t6 - 0.4), 0.07 + 0.06 * rng.random(), pan=float(rng.uniform(-0.8, 0.8)))
    place = {'O1': dict(lo=None, hi=None, g=1.0, room=0.0), 'O2': dict(lo=None, hi=None, g=1.0, room=0.0), 'O4': dict(lo=None, hi=2600, g=1.1, room=0.12),
             'O5': dict(lo=None, hi=None, g=2.4, room=0.0), 'O6': dict(lo=None, hi=None, g=1.0, room=0.0)}
    place_events(M, E, place, 'outro'); voices(M, E)


def names_sound(M, cuts, at, T):
    """after the titles: the bottom of the well, what moves on the walls, the names that are left; from very far up, at half its
    speed, what is left of the tune"""
    E = film_events('names', cuts)
    M.bed(decode('amb_pit', af='lowpass=f=400'), 0, T - 1.2, 0.30, fi=2.5, fo=1.6)
    M.bed(decode('amb_drips', af='lowpass=f=1400,aecho=0.8:0.7:400|900:0.5|0.3'), 0.4, T - 1.2, 0.22, fi=2, fo=1.2)
    M.bed(decode('amb_breath', af='lowpass=f=900'), 2.0, T - 1.0, 0.20, fi=4, fo=0.4)
    # the cave itself: its air, the far end of it, water somewhere, things that fall in the dark
    CAVE = 'aecho=0.8:0.75:180|470|1150:0.45|0.32|0.2'
    M.bed(decode('amb_cave', af='lowpass=f=2400,' + CAVE), 0, T - 1.0, 0.62, fi=2.0, fo=1.4)
    M.bed(decode('amb_deep', af='lowpass=f=520'), 0, T - 1.0, 0.42, fi=3.0, fo=1.4)
    rg = np.random.default_rng(7)
    t = 1.2
    while t < T - 3:                                            # drips, near and far, never in step
        far = rg.random()
        nm = ['drip', 'plop1', 'plop2'][int(rg.integers(3))]
        M.add(decode(nm, af=f'lowpass=f={int(5200 - 4200 * far)},' + CAVE, rate=float(rg.uniform(0.85, 1.15))), t, 0.50 - 0.32 * far, pan=float(rg.uniform(-0.8, 0.8)))
        t += float(rg.uniform(1.1, 2.9))
    for at, nm, v, p in ((3.6, 'trickle1', 0.26, 0.6), (5.5, 'trickle2', 0.24, 0.6), (7.4, 'trickle3', 0.22, 0.6), (15.0, 'trickle1', 0.2, -0.5), (16.9, 'trickle3', 0.2, -0.5)):
        M.add(decode(nm, af='lowpass=f=1800,' + CAVE), at, v, fade_in=0.3, fade_out=0.4, pan=p)
    for at, nm, v, p in ((6.3, 'dirt2', 0.32, -0.6), (11.8, 'stones2', 0.27, 0.7), (19.6, 'dirt1', 0.24, 0.3), (23.0, 'stones4', 0.21, -0.4)):
        M.add(decode(nm, af='lowpass=f=1500,' + CAVE), at, v, pan=p)             # grit and pebbles let go somewhere up the walls
    M.add(decode('rumble2', af='lowpass=f=220'), 9.0, 0.34, fade_in=2.5, fade_out=3.5)     # the rock settles, far off
    M.add(decode('mus_title', rate=0.5, af='lowpass=f=700,aecho=0.8:0.8:600|1100:0.4|0.3'), 1.0, 0.20, fade_in=5, fade_out=4, dur=T - 5.0)
    place_events(M, E, {'N1': dict(lo=None, hi=None, g=1.0, room=0.35)}, 'names'); voices(M, E)


def intro_sound(M, cuts, at, T, wind, wind_in):
    """the prologue. Beds follow the picture; every other sound is an event the shot itself wrote from the numbers its
    movement is made of (shots_intro.ev), and lands with its contact moment on that frame (foley.py). No chimes, no harp:
    when the doll wakes there is wool, and nothing else."""
    import foley
    E = film_events('intro', cuts)
    when = lambda kind: next((e['t'] for e in E if e['kind'] == kind), None)
    t_open, t_shut, t_hush = when('wind_open'), when('wind_shut'), when('hush')
    t_k, t_5s, t_6, t_8, t_9, t_t = at('I2K'), at('I5S'), at('I6'), at('I8'), at('I9'), at('TITLE')
    # music: under the storm and the work, gone before the door shuts
    M.add(decode('mus_title'), 1.5, 0.25, fade_in=5, fade_out=6, dur=t_shut - 0.3 - 1.5)
    # the storm: outside / through the walls / outside at the glass / through the walls / the door / outside / the room again
    M.bed(wind, 0, t_k, 0.95, fi=2.5, fo=0.25)
    M.bed(wind_in, t_k - 0.2, t_5s + 0.1, 0.34, fi=0.3, fo=0.2)
    M.bed(wind, t_5s - 0.05, t_6 + 0.1, 0.42, fi=0.25, fo=0.2)
    M.bed(wind_in, t_6 - 0.05, t_open + 0.2, 0.45, fi=0.25, fo=0.2)
    M.bed(wind, t_open - 0.02, t_8 + 0.6, 1.0, fi=0.3, fo=0.9)
    M.bed(wind, t_8, t_shut + 0.06, 0.6, fi=0.6, fo=0.12)                   # through the open door
    M.bed(wind_in, t_shut - 0.05, t_9 + 0.2, 0.6, fi=0.05, fo=0.4)
    M.bed(decode('amb_wind', af='lowpass=f=1500'), t_9 - 0.1, t_hush + 1.2, 0.4, fi=0.3, fo=1.6)     # outside the glass, then it holds its breath
    M.bed(decode('amb_wind', af='lowpass=f=160'), t_hush, t_t + 1.0, 0.35, fi=1.4, fo=1.0)
    M.bed(wind, t_t + 0.6, T, 0.34, fi=1.6, fo=2.2)
    room = crackle(t_open - t_k + 0.2)
    M.add(room[: int((t_5s - t_k) * SR)], t_k, 0.26, fade_in=0.4, fade_out=0.15)
    M.add(room[int((t_6 - t_k) * SR):], t_6, 0.26, fade_in=0.1, fade_out=0.2)
    # what each place does to a sound
    place = {**{k: dict(lo=None, hi=None, g=1.8, room=0.12) for k in ('I2K', 'I3', 'I4', 'I5')}, 'I2': dict(lo=None, hi=750, g=0.8, room=0.0), 'I5S': dict(lo=None, hi=2600, g=1.15, room=0.12), 'I7': dict(lo=None, hi=None, g=1.0, room=0.0),
             'I9': dict(lo=None, hi=5000, g=1.15, room=0.0)}
    place_events(M, E, place, 'intro')
    # the title: the thread drawn under it, as it is drawn
    tt = at('TITLE')
    M.add(np.stack([foley.sustained('thread_draw', 1.4, 1)] * 2, 1), tt + 0.6, 0.16, pan=0.0)


def soundtrack(film, cuts, nframes):
    T = nframes / FPS
    M = Mix(T + 2)
    at = lambda shot, frame=1: cuts.get(shot, 0) / FPS + (frame - 1) / FPS
    wind = decode('amb_wind')
    wind_in = decode('amb_wind', af='lowpass=f=550,lowpass=f=550')
    if film == 'intro':
        intro_sound(M, cuts, at, T, wind, wind_in)
    elif film == 'cut':
        cut_sound(M, cuts, at, T, wind)
    elif film == 'names':
        names_sound(M, cuts, at, T)
    else:
        outro_sound(M, cuts, at, T)
    y = M.buf[: int((T + 0.5) * SR)]
    peak = np.abs(y).max()
    if peak > 0.98:
        y = y / peak * 0.98
    path = os.path.join(CACHE, f'{film}.wav')
    import wave
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    return path


def main():
    film = sys.argv[1]
    draft = '--draft' in sys.argv
    seq, cuts = picture(film, draft)
    od = os.path.join(CACHE, 'edit', film)
    os.makedirs(od, exist_ok=True)
    for old in glob.glob(os.path.join(od, '*.jpg')):
        os.remove(old)
    for f, it in enumerate(seq):
        img = render_item(it, f)
        Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(od, f'{f:05d}.jpg'), quality=95)
        if f % 120 == 0:
            print('edit', film, f, '/', len(seq), flush=True)
    wav = soundtrack(film, cuts, len(seq))
    out_dir = os.path.join(ROOT, 'app', 'assets', 'cine')
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f'{film}.mp4')
    crf = '40' if draft else '31'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(od, '%05d.jpg'), '-i', wav,
                    '-c:v', 'libx264', '-crf', '23', '-preset', 'slow', '-tune', 'grain', '-maxrate', '7M', '-bufsize', '12M',
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', '-shortest', out], check=True)
    print('wrote', out, os.path.getsize(out) // 1024, 'KB', len(seq), 'frames', flush=True)
    print('cuts', {k: round(v / FPS, 2) for k, v in cuts.items()})


if __name__ == '__main__':
    main()
