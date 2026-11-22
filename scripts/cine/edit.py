"""Spindledeep cinematics: cut the graded shots into a film, lay the soundtrack, encode for the game.

    <art venv>/python scripts/cine/edit.py intro|outro [--draft]

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
    'intro': [('I1', 0), ('I2', 16), ('I3', 0), ('I4', 0), ('I5', 10), ('I6', 0), ('I7', 0), ('I8', 20), ('I9', 0), ('TITLE', 0)],
    'outro': [('E2', 0), ('E3', 0), ('E4', 12), ('E5', 0), ('E6', 18), ('E7', 18), ('PAPER', 0)],
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
    if film == 'outro':
        n = len(seq)
        for j in range(n - 48, n):
            k = (j - (n - 48)) / 47
            seq[j] = ('paper', seq[j], k * k * (3 - 2 * k))
        seq.extend(('paperhold', None) for _ in range(24))
        # the coda (docs/STORY.md, sealed): a hard cut off the paper to the window at night, then black
        cuts['CODA'] = len(seq)
        seq.extend(('png', p) for p in shot_frames('I4', draft)[:70])
        seq.extend(('black', None) for _ in range(40))
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


def soundtrack(film, cuts, nframes):
    T = nframes / FPS
    M = Mix(T + 2)
    at = lambda shot, frame=1: cuts.get(shot, 0) / FPS + (frame - 1) / FPS
    wind = decode('amb_wind')
    wind_in = decode('amb_wind', af='lowpass=f=550,lowpass=f=550')
    if film == 'intro':
        M.add(decode('mus_title'), 1.5, 0.32, fade_in=5, fade_out=4, dur=at('TITLE', 1) + 3.5 - 1.5)
        # exterior storm vs. muffled inside
        M.bed(wind, 0, at('I3'), 0.95, fi=2.5, fo=0.4)
        M.bed(wind_in, at('I3') - 0.4, at('I6', 50), 0.55, fi=0.4, fo=0.3)
        M.add(crackle(at('I6', 74) - at('I3')), at('I3'), 0.5, fade_in=0.5, fade_out=0.2)
        M.add(breath(4.2), at('I4', 48), 0.8)
        M.add(decode('chime', rate=0.5), at('I4', 70), 0.12, fade_in=0.5)
        M.add(decode('release'), at('I3', 62), 0.35); M.add(decode('release'), at('I3', 170), 0.35)
        M.add(decode('tie'), at('I5', 52), 0.7)
        M.add(decode('grip'), at('I5', 100), 0.4)
        M.add(decode('creak', rate=1.3), at('I6', 44), 0.6, fade_out=0.4, dur=1.6)
        M.bed(wind, at('I6', 50), at('I8'), 1.0, fi=0.5, fo=0.6)
        M.add(decode('release', rate=0.6), at('I6', 70), 0.5)
        step = decode('snow1')
        for k in range(10):
            M.add(step, at('I7', 6 + k * 13), 0.12, pan=0.3)
        M.bed(wind_in, at('I8') - 0.6, at('TITLE'), 0.7, fi=0.6, fo=0.5)
        M.add(decode('land', rate=0.5), at('I8', 84), 1.0)
        M.add(decode('creak', rate=1.6), at('I8', 80), 0.45, dur=0.8, fade_out=0.3)
        M.add(decode('harp', rate=0.75), at('I9', 46), 0.45)
        M.add(decode('grip'), at('I9', 98), 0.5)
        M.add(decode('harp', rate=0.5), at('TITLE', 14), 0.6)
        M.add(decode('chime', rate=0.75), at('TITLE', 30), 0.25)
        M.bed(wind, at('TITLE'), T, 0.35, fi=0.5, fo=2.5)
    else:
        M.add(decode('mus_end'), 0.0, 0.5, fade_in=3, fade_out=5, dur=at('CODA') + 0.1)
        cave = decode('amb_cave')
        M.bed(cave, 0, at('E5'), 0.35, fi=2, fo=1.2)
        M.add(crackle(at('E3', 60)), 0, 0.35, fade_out=0.3)
        M.add(decode('mend'), at('E2', 30), 0.4)
        M.add(decode('release', rate=0.5), at('E3', 58), 0.45)
        M.add(decode('bell'), at('E4', 42), 0.7); M.add(decode('bowl'), at('E4', 42), 0.4)
        M.add(decode('chime', rate=0.75), at('E4', 200), 0.4, fade_in=0.4)
        M.bed(decode('amb_wind', af='lowpass=f=900'), at('E5'), at('CODA'), 0.12, fi=2, fo=1)
        M.bed(wind_in, at('CODA'), at('CODA', 72), 0.8, fi=0.02, fo=0.05)
        M.add(breath(2.6), at('CODA', 8), 1.0)
        M.add(decode('creak', rate=0.55), at('E6', 1), 0.25, fade_in=1.5, fade_out=1.5, dur=7.5)
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
