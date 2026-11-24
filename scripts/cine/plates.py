"""Spindledeep: the epilogue film (2026-11-24). Seven nearly still plates, engraved like everything else.

    <art venv>/python scripts/cine/plates.py gen [--seeds=3]      # the pictures (SDXL) and their depth -> .cache/plates/
    <art venv>/python scripts/cine/plates.py sheet <plate>        # contact sheet of the seeds
    <art venv>/python scripts/cine/plates.py film [--draft] [plates...]  # move through them, engrave, -> .cache/graded/<plate>/
Each plate is a picture with a depth map; the camera creeps through it (parallax), parts of it are moved or lit
frame by frame in the functions below. edit.py cuts them and lays the sound. The content is kept out of summaries.
"""
import math
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
ART = os.path.join(ROOT, 'scripts', 'art')
PL = os.path.join(HERE, '.cache', 'plates')
SPR = os.path.join(ROOT, 'app', 'assets', 'art', 'sprites')
sys.path.insert(0, ART); sys.path.insert(0, HERE)
W, H = 1920, 1080
os.makedirs(PL, exist_ok=True)

STYLE = ('black and white photograph from 1890, night, extreme darkness, deep black shadows, one faint cold light, film grain, stillness, dread, highly detailed')
NEG = ('color, text, watermark, logo, frame, border, cartoon, anime, cgi, 3d render, painting, daylight, sun, bright sky, modern, car, electric pole, smiling, gore, blood, lowres, blurry')
GEN = {
    'O1': 'a small old log cabin alone on a snowy hilltop at night, its front door standing wide open on a pitch black room, dark windows, deep untouched snow, dead bare trees, no wind, black sky',
    'O2': 'a round old stone well half buried in snow at night, seen from close above, pitch black inside, long pale bony fingers of two hands hooked over the stone rim from inside',
    'O3': 'the dark inside of an old log cabin at night seen from across the room, an open doorway with snow and night outside, an impossibly tall thin naked pale hairless figure standing in the doorway stooped under the door frame, arms hanging to its knees, head bowed, silhouette',
    'O5': 'a wide snowy mountain valley at night seen from a high hilltop, a large village of hundreds of tiny houses with small lit windows far below, dark mountains, black sky without moon',
    'O6': 'aerial view straight down on a vast empty snowfield at night, long lines of hundreds of tiny people in pale nightgowns walking one behind another toward one huge round black pit in the snow',
}


def gen(seeds):
    import torch
    from generate import load
    pipe = load('realvis')
    for n, p in GEN.items():
        for k in range(seeds):
            path = os.path.join(PL, f'{n}_{k}.png')
            if os.path.exists(path):
                continue
            im = pipe(p, prompt_2=p + ', ' + STYLE, negative_prompt=NEG + ('' if n in ('O2', 'O3', 'O6') else ', people'), width=1344, height=768,
                      num_inference_steps=32, guidance_scale=5.5, generator=torch.Generator('cpu').manual_seed(60 + k)).images[0]
            im.convert('L').save(path)
            print(n, k, flush=True)


# chosen seed per plate
PICK = {'O1': 3, 'O2': 2, 'O3': 2, 'O5': 2, 'O6': 1}


def tone(name):
    if name in ('O4', 'O7'):        # the doll, from the prologue's own frames (Blender beauty passes)
        src = {'O4': ('I9', 80), 'O7': ('I8', 150)}[name]
        a = cv2.imread(os.path.join(HERE, '.cache', 'frames', src[0], f'beauty_{src[1]:04d}.png'), cv2.IMREAD_UNCHANGED).astype(np.float32) / 65535
        a = a[:, :, [2, 1, 0]] ** 2 * 16
        lum = (a * np.array([0.3, 0.52, 0.18], np.float32)).sum(2)
        return cv2.resize(lum, (W, H), interpolation=cv2.INTER_CUBIC), cv2.resize(a, (W, H), interpolation=cv2.INTER_CUBIC)
    g = cv2.imread(os.path.join(PL, f'{name}_{PICK[name]}.png'), 0).astype(np.float32) / 255
    g = cv2.resize(g, (W, int(W * g.shape[0] / g.shape[1])), interpolation=cv2.INTER_CUBIC)
    y0 = (g.shape[0] - H) // 2
    return g[y0:y0 + H], None


_dep = None


def depth(g, name):
    """1 = near. From the beauty frames' own depth where there is one, else Depth Anything"""
    global _dep
    p = os.path.join(PL, f'{name}_depth.npy')
    if os.path.exists(p):
        return np.load(p)
    import torch
    from PIL import Image
    from transformers import pipeline
    if _dep is None:
        _dep = pipeline('depth-estimation', model=os.path.join(ART, '.cache', 'models', 'depth'), device=-1)
    im = Image.fromarray((np.clip(g / max(1e-3, np.percentile(g, 99.5)), 0, 1) ** 0.6 * 255).astype(np.uint8)).convert('RGB')
    d = np.asarray(_dep(im)['predicted_depth'].squeeze().cpu().numpy(), np.float32)
    d = cv2.resize(d, (W, H), interpolation=cv2.INTER_CUBIC)
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    d = cv2.GaussianBlur(d, (0, 0), 3)
    np.save(p, d)
    return d


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)


def sprite(name, h, rot=0.0, flip=False):
    im = cv2.imread(os.path.join(SPR, name + '.png'), cv2.IMREAD_UNCHANGED).astype(np.float32) / 255
    s = h / im.shape[0]
    im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
    if flip:
        im = im[:, ::-1]
    if rot:
        hh, ww = im.shape[:2]; R = int(math.hypot(hh, ww)) + 2
        c = np.zeros((R, R, 4), np.float32); c[(R - hh) // 2:(R - hh) // 2 + hh, (R - ww) // 2:(R - ww) // 2 + ww] = im
        im = cv2.warpAffine(c, cv2.getRotationMatrix2D((R / 2, R / 2), rot, 1), (R, R), flags=cv2.INTER_CUBIC)
    return im[:, :, 0], im[:, :, 3]


def paste(g, t, a, x, y, gain=1.0):
    """put a sprite with its centre at (x, y)"""
    h, w = t.shape
    x0, y0 = int(x - w / 2), int(y - h / 2)
    X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if X1 <= X0 or Y1 <= Y0:
        return g
    s = np.s_[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
    g[Y0:Y1, X0:X1] = g[Y0:Y1, X0:X1] * (1 - a[s]) + t[s] * gain * a[s]
    return g


# ── each plate: frames, camera (zoom from->to, drift px), parallax strength, and what happens ──
PLATES = {
    'O1': dict(n=120, zoom=(1.0, 1.10), drift=(0, 6), par=34),
    'O2': dict(n=96, zoom=(1.08, 1.0), drift=(0, -8), par=26),
    'O3': dict(n=144, zoom=(1.0, 1.05), drift=(0, 0), par=22),
    'O4': dict(n=132, zoom=(1.0, 1.06), drift=(0, 0), par=0),
    'O5': dict(n=168, zoom=(1.12, 1.0), drift=(0, 0), par=18),
    'O6': dict(n=168, zoom=(1.25, 1.0), drift=(0, 0), par=10),
    'O7': dict(n=120, zoom=(1.0, 1.05), drift=(0, 0), par=0),
}


def act(name, g, f, n, st):
    """the plate's tone at frame f"""
    t = f / 24.0
    if name == 'O1':
        # the two windows go out, one and then the other
        for (wx, wy), t0 in zip(st['win'], (2.6, 3.5)):
            m = np.exp(-(((st['mx'] - wx) / 64) ** 2 + ((st['my'] - wy) / 60) ** 2) ** 2)
            k = smooth(t0, t0 + 0.08, t)
            g = g * (1 - m * k) + g * 0.05 * m * k
    if name == 'O2':
        # out of the black, one after another, and each takes hold of the rim
        for j, (ang, t0, nm, hh) in enumerate(((100, 0.9, 'arm1', 640), (62, 1.6, 'arm0', 600), (142, 2.0, 'arm0', 620), (20, 2.5, 'arm1', 560), (176, 2.75, 'arm1', 560), (84, 3.0, 'arm0', 620), (120, 3.2, 'arm1', 600))):
            e = smooth(t0, t0 + 0.42, t)
            if e <= 0:
                continue
            A = math.radians(ang); cx, cy = st['c']; ca, sa = math.cos(A), math.sin(A)
            rim = 1 / math.hypot(ca / 540, sa / 455)
            tip = 120 + (rim - 120 + 46 + 14 * math.sin(j * 2.3)) * e - 18 * smooth(t0 + 0.42, t0 + 0.65, t)
            tt, aa = st['arm'][j]
            z = paste(g.copy(), tt, aa, cx + ca * (tip - hh / 2), cy + sa * (tip - hh / 2), 0.8)
            side = np.clip(((st['mx'] - cx) * ca + (st['my'] - cy) * sa - 90) / 160, 0, 1)      # out of the dark in the middle, never across it
            g = g * (1 - side) + z * side
    if name == 'O3':
        # an open door. The dark blinks; then it is not empty; then it is near
        k = 0 if t < 2.2 else 1 if t < 3.8 else 2
        if 2.2 <= t < 2.45 or 3.8 <= t < 4.1 or t > 5.6:
            return g * 0.0
        g = g * (1 - st['door']) + 0.0 * st['door']
        if k:
            nm, hh, x, y, gain = (('face1', 0, 0.555 * W, 0.40 * H, 0.42), ('face2', 0, 0.54 * W, 0.62 * H, 0.75))[k - 1]
            tt, aa = st[nm]
            z = np.zeros_like(g)
            z = paste(z, tt, aa, x, y + 2.2 * (t - (2.45 if k == 1 else 4.1)), gain)
            if k == 1:
                g = np.maximum(g, z * st['door'])
            else:
                g = np.maximum(g * 0.25, z)
    if name == 'O4':
        # fingers come down over the doll's head from behind, and rest there, and stroke it
        e = smooth(1.6, 3.4, t)
        for j, (sx, sy, rot, nm, hh) in enumerate(((0.34, -0.36, 168, 'arm1', 1050), (0.60, -0.40, 196, 'arm0', 1000))):
            tt, aa = st['arm'][j]
            y = (sy + (0.60 + 0.03 * j) * smooth(1.6 + 0.35 * j, 3.6 + 0.35 * j, t)) * H + 10 * math.sin(max(0, t - 3.8) * 2.6 + j) * e
            g = paste(g, tt * (0.35 + 0.1 * j), aa * 0.98, sx * W + 14 * math.sin(max(0, t - 3.8) * 1.3) * e, y)
    if name == 'O5':
        # lights go out, the nearest first
        m = st['lights']; cut = st['order'] < smooth(0.7, 6.2, t) * 1.04 - 0.02
        g = g * (1 - m) + (g * (1 - cut) + st['bg'] * cut) * m
    if name == 'O6':
        # they walk: long lines of them, from every side, and nobody stops at the edge
        g = g.copy(); cx, cy = W / 2, H / 2
        for q in st['walk']:
            r = q['r0'] - q['v'] * t
            if r < 150 * (0.82 + 0.2 * abs(math.cos(q['a']))):
                continue
            an = q['a'] + q['bend'] * (r / 900) + 0.008 * math.sin(t * 5 + q['p'])
            x, y = cx + math.cos(an) * r + q['dx'], cy + math.sin(an) * r * 0.82 + q['dy']
            if not (8 < x < W - 8 and 12 < y < H - 12):
                continue
            x, y, h = int(x), int(y), q['h']
            cv2.line(g, (x, y), (x + int(h * 1.5), y + int(h * 0.5)), 0.015, 3, cv2.LINE_AA)        # its shadow
            cv2.line(g, (x, y), (x, y - h), q['t'], 4, cv2.LINE_AA)
            cv2.circle(g, (x, y - h - 2), 2, q['t'] * 0.75, -1, cv2.LINE_AA)
        g = g * (1 - smooth(5.9, 6.95, t))
    if name == 'O7':
        g = g * (1 - smooth(3.6, 4.9, t))
    if name == 'O1':
        g = g * smooth(0, 1.6, t)
    if name == 'O5':
        g = g * (1 - smooth(6.3, 6.95, t) * 0.6)
    return g


def setup(name, g, d):
    st = {}
    my, mx = np.mgrid[0:H, 0:W].astype(np.float32)
    st['mx'], st['my'] = mx, my
    if name == 'O1':
        b = cv2.GaussianBlur(g, (0, 0), 9); b[: int(H * 0.5)] = 0; b[int(H * 0.8):] = 0
        y, x = np.unravel_index(np.argmax(b), b.shape); pts = [(x, y)]
        b[:, max(0, x - 110):x + 110] = 0
        y, x = np.unravel_index(np.argmax(b), b.shape); pts.append((x, y))
        st['win'] = pts
    if name == 'O2':
        b = cv2.GaussianBlur(g, (0, 0), 50); y, x = np.unravel_index(np.argmin(b[:, W // 4:3 * W // 4]), (H, W // 2)); st['c'] = (x + W // 4, y)
        cx, cy = st['c']
        st['arm'] = [sprite(nm, hh, -ang - 90) for ang, nm, hh in ((100, 'arm1', 640), (62, 'arm0', 600), (142, 'arm0', 620), (20, 'arm1', 560), (176, 'arm1', 560), (84, 'arm0', 620), (120, 'arm1', 600))]
        st['rise'] = np.clip((np.hypot((mx - cx) / 1.12, (my - cy) / 0.9) - 120) / 130, 0, 1)
    if name == 'O3':
        d0 = np.clip(np.minimum((mx / W - 0.405) / 0.01, (0.685 - mx / W) / 0.01), 0, 1) * np.clip(np.minimum((my / H - 0.03) / 0.02, (0.90 - my / H) / 0.03), 0, 1)
        st['door'] = d0.astype(np.float32)
        st['face1'] = sprite('call0', 560, 14); st['face2'] = sprite('call1', 1500, 5)
    if name == 'O4':
        st['arm'] = [sprite('arm1', 1050, 172), sprite('arm0', 1000, 190)]
    if name == 'O5':
        hp = g - cv2.GaussianBlur(g, (0, 0), 14)
        l = (hp > 0.06) & (g > 0.16); l[: int(H * 0.44)] = False
        l = cv2.dilate(l.astype(np.uint8), np.ones((7, 7), np.uint8))
        # a house at a time: small cells, the nearest (lowest) first, with some luck in it
        rng = np.random.default_rng(4)
        cy, cx = np.mgrid[0:H, 0:W]
        size = np.where(cy > H * 0.6, 44, 20)
        ci, cj = cy // size, cx // size
        h = np.abs(np.sin(ci * 12.9898 + cj * 78.233 + size) * 43758.5453) % 1
        o = 1 - ci * size / H; o = (o - 0.1) / 0.5
        st['order'] = np.clip(o * 0.72 + h * 0.28, 0, 0.99).astype(np.float32)
        st['lights'] = cv2.GaussianBlur(l.astype(np.float32), (0, 0), 4).clip(0, 1) * 1.0
        st['bg'] = cv2.GaussianBlur(np.minimum(g, cv2.medianBlur((g * 255).astype(np.uint8), 31).astype(np.float32) / 255), (0, 0), 5) * 0.28
    if name == 'O6':
        rng = np.random.default_rng(11)
        st['walk'] = []
        for k in range(19):
            a0 = k / 19 * math.tau + rng.uniform(-0.3, 0.3); bend = rng.uniform(-1.1, 1.1); r = rng.uniform(140, 330); wide = rng.uniform(5, 34)
            for i in range(int(rng.integers(26, 70))):
                r += rng.uniform(7, 34)
                st['walk'].append(dict(a=a0, bend=bend, r0=r, v=15.0, p=rng.uniform(0, 6), dx=rng.normal(0, wide), dy=rng.normal(0, wide * 0.8), h=int(rng.integers(8, 13)), t=float(rng.uniform(0.6, 0.95))))
        st['walk'].sort(key=lambda q: q['a'])
    return st


def film(names, draft):
    import torch
    import post
    dev = post.dev
    yy, xx = torch.meshgrid(torch.arange(H, device=dev, dtype=torch.float32), torch.arange(W, device=dev, dtype=torch.float32), indexing='ij')
    for name in names:
        P = PLATES[name]
        g, rgb = tone(name)
        if rgb is None:
            lo, hi = np.percentile(g, 2), np.percentile(g, 99.7)
            g = np.clip((g - lo) / (hi - lo), 0, 1) ** 1.25 * 0.8
            if name == 'O6':          # night: the snow only just lighter than the hole in it
                y, x = np.mgrid[0:H, 0:W].astype(np.float32)
                g = g * 0.42 * np.clip(1.25 - 0.75 * np.hypot((x - W / 2) / W * 1.5, (y - H / 2) / H * 1.5), 0.25, 1)
                r = np.hypot(x - W / 2, (y - H / 2) / 0.82) + 14 * np.sin(np.arctan2(y - H / 2, x - W / 2) * 7) * 0.5
                g = g * np.clip((r - 138) / 26, 0, 1)
        else:
            g = np.clip(g / np.percentile(g, 99.3), 0, 1) ** 1.15 * {'O4': 0.62, 'O7': 0.5}[name]
        d = depth(g, name) if P['par'] else np.zeros((H, W), np.float32)
        st = setup(name, g, d)
        out = os.path.join(HERE, '.cache', 'graded', name)
        os.makedirs(out, exist_ok=True)
        for o in os.listdir(out):
            os.remove(os.path.join(out, o))
        red = None
        if rgb is not None:           # the doll's thread and heart keep their red
            red = np.clip(rgb[:, :, 0] - 1.8 * rgb[:, :, 1], 0, None); red = np.clip(red / (np.percentile(red, 99.9) + 1e-4), 0, 1)
        my, mx = np.mgrid[0:H, 0:W].astype(np.float32)
        for f in range(1, P['n'] + 1):
            if draft and f % 24 != 12:
                continue
            u = (f - 1) / (P['n'] - 1); e = u * u * (3 - 2 * u) * 0.5 + u * 0.5
            z = P['zoom'][0] + (P['zoom'][1] - P['zoom'][0]) * e
            a = act(name, g.copy(), f, P['n'], st)
            # the camera: zoom about the centre, nearer things move more
            px = P['par'] * (z - 1) * (d - 0.4)
            k = z + px * 0.01
            sx, sy = W / 2 + (mx - W / 2) / k, H / 2 + (my - H / 2) / k + P['drift'][1] * e * d
            a = cv2.remap(a, sx, sy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
            with torch.no_grad():
                v = torch.from_numpy(np.ascontiguousarray(a)).to(dev).float().clamp(0, 1)
                Gx = torch.from_numpy(np.ascontiguousarray(cv2.remap(cv2.GaussianBlur(g, (0, 0), 6), sx, sy, cv2.INTER_LINEAR))).to(dev).float()
                SX, SY = torch.from_numpy(sx).to(dev), torch.from_numpy(sy).to(dev)
                sp = 4.6; aa = 1.15 / sp; b = (f // 4) * 7.13
                wob = (post.vnoise(xx * 0.012 + b, yy * 0.012 - b) - 0.5) * 0.35 + (post.vnoise(xx * 0.05 - b, yy * 0.05) - 0.5) * 0.12
                # lines ride the picture's own relief, so they follow its forms and stick to them as it moves
                ph1 = (SY * math.cos(0.06) - SX * math.sin(0.06)) / sp + Gx * 6.0 + wob
                ph2 = (SY * math.cos(0.75) - SX * math.sin(0.75)) / (sp * 1.1) + Gx * 3.0 + wob * 0.7
                vv = ((v - 0.5) * 1.15 + 0.5).clamp(0, 0.9) * torch.where(v > 0.004, 1.0, 0.0)
                m = post.engrave(vv, ph1, ph2, aa)
                m = m * 0.82 + vv * 0.18
                vg = torch.sqrt((xx / W - 0.5) ** 2 + ((yy / H - 0.5) * 0.85) ** 2)
                m = m * (1 - post.smoothstep(torch.tensor(0.46, device=dev), torch.tensor(0.8, device=dev), vg) * 0.9)
                grain = post.vnoise(xx * 0.9, yy * 0.9) * 0.06 + post.vnoise(xx * 0.08, yy * 0.08) * 0.07 + post.vnoise(xx * 0.02, yy * 0.6) * 0.03
                tint = torch.tensor([0.93, 0.97, 1.06], device=dev).view(3, 1, 1)
                paper = post.PAPER * (0.88 + grain) * tint
                ink = post.INK * (0.8 + post.vnoise(xx * 0.3, yy * 0.3) * 0.3)
                col = ink + (paper - ink) * m
                if red is not None:
                    r = torch.from_numpy(np.ascontiguousarray(cv2.remap(red.astype(np.float32), sx, sy, cv2.INTER_LINEAR))).to(dev).float()[None]
                    k2 = float(v.max() > 0.05)
                    gl = (post.blur(r, 2) * 0.7 + post.blur(r, 14) * 0.4) * k2 * min(1.0, float(v.mean()) * 30)
                    col = col * (1 - (r * 0.8).clamp(0, 1)) + gl * torch.tensor([0.95, 0.13, 0.1], device=dev).view(3, 1, 1)
                col = col + (post.hash2(xx + f * 13.7, yy - f * 7.1) - 0.5) * 0.025
            im = (col.clamp(0, 1).permute(1, 2, 0).cpu().numpy() * 255 + 0.5).astype(np.uint8)[:, :, ::-1]
            cv2.imwrite(os.path.join(out, f'{f:04d}.png'), im)
        print('plate', name, flush=True)


if __name__ == '__main__':
    cmd = sys.argv[1]
    args = [a for a in sys.argv[2:] if not a.startswith('--')]
    if cmd == 'gen':
        gen(int(next((a.split('=')[1] for a in sys.argv if a.startswith('--seeds=')), 3)))
    elif cmd == 'film':
        film(args or list(PLATES), '--draft' in sys.argv)
