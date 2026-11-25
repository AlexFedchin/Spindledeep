"""Everything drawn, printed, scratched or stamped on the keepsakes, as flat maps for build.py.
    <art venv>/python scripts/props3d/maps.py      -> scripts/props3d/.cache/*.png
Heights: grey 0.5 is the surface, lighter stands out, darker is cut in."""
import math
import os
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
C = os.path.join(HERE, '.cache')
F = os.path.normpath(os.path.join(HERE, '..', '..', 'app', 'assets', 'fonts'))
FELL, FELLI, FELLSC = (os.path.join(F, n) for n in ('IMFeENrm28P.ttf', 'IMFeENit28P.ttf', 'IMFeENsc28P.ttf'))
HAND = 'C:/Windows/Fonts/segoesc.ttf'
PEA = 'pea_11.png'
rnd = random.Random(5)


def font(p, s):
    return ImageFont.truetype(p, s)


def noise(w, h, cell, seed, octaves=4):
    r = np.random.default_rng(seed)
    out, amp, tot = np.zeros((h, w), np.float32), 1.0, 0.0
    for o in range(octaves):
        c = max(2, int(cell / 2 ** o))
        g = r.random((h // c + 3, w // c + 3)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize(((w // c + 3) * c, (h // c + 3) * c), Image.BICUBIC)
        out += np.asarray(im, np.float32)[:h, :w] / 255 * amp
        tot += amp
        amp *= 0.55
    return out / tot


# ink laid by a hand: each letter a little off, the pen running dry and wet
def hand(d_img, xy, text, size, ink=40, jitter=1.0, seed=0, slope=0.0, fnt=HAND):
    r = random.Random(seed)
    x, y = xy
    f = font(fnt, size)
    base = y
    drift = 0.0
    for ch in text:
        drift = drift * 0.8 + r.uniform(-1, 1) * size * 0.012 * jitter
        w = f.getlength(ch)
        if ch.strip():
            t = Image.new('L', (int(w + size * 1.6), int(size * 2.4)), 0)
            ImageDraw.Draw(t).text((size * 0.5, size * 0.4), ch, font=f, fill=255, stroke_width=max(1, round(size / 34)), stroke_fill=255)
            t = t.rotate(r.uniform(-2.2, 2.2) * jitter, resample=Image.BICUBIC, center=(size * 0.8, size))
            k = r.uniform(0.84, 1.0)
            t = t.point(lambda v, k=k: int(v * k))
            layer = Image.new('L', d_img.size, 0)
            layer.paste(t, (int(x - size * 0.5), int(base - size * 0.4 + drift + slope * (x - xy[0]))))
            d_img.paste(Image.composite(Image.new('L', d_img.size, ink), d_img, layer), (0, 0))
        x += w * (1 + r.uniform(-0.03, 0.03) * jitter)
    return x


def wobbly(d, pts, fill, width, r, amp=1.5):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / 9))
        for i in range(n):
            t = i / n
            out.append((x0 + (x1 - x0) * t + r.uniform(-amp, amp), y0 + (y1 - y0) * t + r.uniform(-amp, amp)))
    out.append(pts[-1])
    d.line(out, fill=fill, width=width, joint='curve')


# old paper: fibres, foxing, water marks, dirt toward the edges
def paper(w, h, seed, base=212, edge=0.5):
    a = np.full((h, w), float(base), np.float32)
    a += (noise(w, h, 260, seed) - 0.5) * 46 + (noise(w, h, 26, seed + 1) - 0.5) * 16 + (np.random.default_rng(seed).random((h, w)) - 0.5) * 7
    fib = Image.new('L', (w, h), 128)
    d = ImageDraw.Draw(fib)
    r = random.Random(seed)
    for _ in range(w * h // 1400):
        x, y, t, l = r.uniform(0, w), r.uniform(0, h), r.uniform(0, 6.28), r.uniform(8, 30)
        d.line([(x, y), (x + math.cos(t) * l, y + math.sin(t) * l)], fill=r.choice([112, 118, 140, 146]), width=1)
    a += (np.asarray(fib.filter(ImageFilter.GaussianBlur(0.7)), np.float32) - 128) * 0.55
    yy, xx = np.mgrid[0:h, 0:w]
    e = np.minimum(np.minimum(xx, w - xx) / w, np.minimum(yy, h - yy) / h * h / w)
    a -= np.clip(1 - e / 0.09, 0, 1) ** 1.6 * 62 * edge * (0.5 + noise(w, h, 120, seed + 2))
    for _ in range(46):                                            # foxing
        x, y, q = r.uniform(0, w), r.uniform(0, h), r.uniform(3, 17) * w / 1000
        a -= np.exp(-(((xx - x) ** 2 + (yy - y) ** 2) / (q * q))) * r.uniform(8, 34)
    for _ in range(2):                                             # a water mark: a pale pool with a dark shore
        x, y, q = r.uniform(0.1, 0.9) * w, r.uniform(0.1, 0.9) * h, r.uniform(0.16, 0.3) * w
        dist = np.hypot(xx - x, yy - y) + (noise(w, h, 130, seed + 5) - 0.5) * 170 * w / 1000
        a -= np.exp(-((dist - q) / (7 * w / 1000)) ** 2) * 30 + (dist < q) * 5
    return a


def fold(a, x0, y0, x1, y1, deep=34, seed=0):
    h, w = a.shape
    yy, xx = np.mgrid[0:h, 0:w]
    L = math.hypot(x1 - x0, y1 - y0)
    s = ((xx - x0) * (y1 - y0) - (yy - y0) * (x1 - x0)) / L + (noise(w, h, 60, seed) - 0.5) * 6
    k = 0.45 + noise(w, h, 40, seed + 9) * 1.1
    a -= np.exp(-(s / 2.2) ** 2) * deep * k
    a += np.exp(-((s - 5) / 4.5) ** 2) * deep * 0.45 * k
    a -= np.exp(-((s + 12) / 16) ** 2) * deep * 0.22
    return a


def save(a, name, mode='L'):
    if isinstance(a, np.ndarray):
        a = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    a.save(os.path.join(C, name))


# ── the spool's end: the rule scratched round it with a needle, every stroke gone over twice ──
def spool():
    S = 1024
    im = Image.new('L', (S, S), 0)
    text = 'NEVER NAME THEM'
    r = random.Random(3)
    glyph = {'N': [(0, 1, 0, 0), (0, 0, 1, 1), (1, 1, 1, 0)], 'E': [(1, 0, 0, 0), (0, 0, 0, 1), (0, 1, 1, 1), (0, .5, .8, .5)], 'V': [(0, 0, .5, 1), (.5, 1, 1, 0)],
             'R': [(0, 1, 0, 0), (0, 0, .9, .1), (.9, .1, .85, .45), (.85, .45, 0, .5), (.25, .5, 1, 1)], 'A': [(0, 1, .5, 0), (.5, 0, 1, 1), (.2, .62, .8, .62)],
             'M': [(0, 1, 0.05, 0), (0.05, 0, .5, .75), (.5, .75, .95, 0), (.95, 0, 1, 1)], 'T': [(0, 0, 1, 0), (.5, 0, .5, 1)], 'H': [(0, 0, 0, 1), (1, 0, 1, 1), (0, .5, 1, .5)]}
    cw, R0, a = 46, 350, -math.pi / 2 - 1.28
    for ch in text:
        if ch == ' ':
            a += 0.13
            continue
        for x0, y0, x1, y1 in glyph[ch]:
            for k in range(4):
                P = []
                for x, y in ((x0, y0), (x1, y1)):
                    ang = a + (x * cw + r.uniform(-2.2, 2.2)) / R0
                    rad = R0 + 40 - y * 78 + r.uniform(-2.4, 2.4)
                    P.append((S / 2 + math.cos(ang) * rad, S / 2 + math.sin(ang) * rad))
                d = ImageDraw.Draw(im)
                d.line(P, fill=r.randint(150, 255), width=r.choice([4, 5, 7]))
        a += (cw + 20) / R0
    d = ImageDraw.Draw(im)
    for _ in range(90):                                            # slips of the needle, and years of handling
        t, q, l = r.uniform(0, 6.28), r.uniform(120, 500), r.uniform(10, 90)
        b = r.uniform(0, 6.28)
        x, y = S / 2 + math.cos(t) * q, S / 2 + math.sin(t) * q
        d.line([(x, y), (x + math.cos(b) * l, y + math.sin(b) * l)], fill=r.randint(30, 90), width=r.choice([1, 1, 2]))
    save(im.filter(ImageFilter.GaussianBlur(0.8)), 'spool_end.png')


# ── the coat button: laurel round the rim, a beaded ring, pick and hammer are worn to a ghost under the holes ──
def button():
    S = 2048
    im = Image.new('L', (S, S), 128)
    d = ImageDraw.Draw(im)
    c = S / 2

    def ring(r0, r1, v):
        d.ellipse([c - r1 * c, c - r1 * c, c + r1 * c, c + r1 * c], fill=v)
        d.ellipse([c - r0 * c, c - r0 * c, c + r0 * c, c + r0 * c], fill=128)
    for k in range(120):                                           # beads
        t = k / 120 * 6.2832
        x, y = c + math.cos(t) * 0.86 * c, c + math.sin(t) * 0.86 * c
        d.ellipse([x - 19, y - 19, x + 19, y + 19], fill=205)
    for k in range(64):                                            # laurel, two leaves to a stem, meeting at the top
        t = k / 64 * 6.2832 - math.pi / 2
        sgn = 1 if k < 32 else -1
        for s in (-1, 1):
            a = t + math.pi / 2 * sgn + s * 0.55 * sgn
            x0, y0 = c + math.cos(t) * 0.665 * c, c + math.sin(t) * 0.665 * c
            L = 92
            pts = []
            for q in range(13):
                u = q / 12
                w = math.sin(u * math.pi) ** 0.8 * 21
                pts.append((u * L, w))
            poly = pts + [(x, -y) for x, y in reversed(pts)]
            d.polygon([(x0 + math.cos(a) * x - math.sin(a) * y, y0 + math.sin(a) * x + math.cos(a) * y) for x, y in poly], fill=196)
            d.line([(x0, y0), (x0 + math.cos(a) * L * 0.9, y0 + math.sin(a) * L * 0.9)], fill=150, width=5)
        d.line([(c + math.cos(t) * 0.665 * c, c + math.sin(t) * 0.665 * c), (c + math.cos(t + 0.1) * 0.665 * c, c + math.sin(t + 0.1) * 0.665 * c)], fill=185, width=9)
    for r0, v in ((0.50, 190), (0.79, 180)):
        d.ellipse([c - r0 * c, c - r0 * c, c + r0 * c, c + r0 * c], outline=v, width=12)
    im = im.filter(ImageFilter.GaussianBlur(5))
    worn = noise(S, S, 500, 8)
    a = 128 + (np.asarray(im, np.float32) - 128) * np.clip(1.5 - worn * 1.25, 0.25, 1)
    # dents and scratches
    r = random.Random(9)
    sc = Image.new('L', (S, S), 128)
    sd = ImageDraw.Draw(sc)
    for _ in range(150):
        x, y, t, l = r.uniform(0, S), r.uniform(0, S), r.gauss(0.6, 0.7), r.uniform(20, 420)
        sd.line([(x, y), (x + math.cos(t) * l, y + math.sin(t) * l)], fill=r.choice([96, 106, 112]), width=r.choice([1, 2, 2, 3]))
    sd.line([(1290, 330), (1580, 760)], fill=20, width=13)
    sd.line([(1310, 350), (1600, 740)], fill=70, width=6)
    a += np.asarray(sc.filter(ImageFilter.GaussianBlur(1)), np.float32) - 128
    yy, xx = np.mgrid[0:S, 0:S]
    for _ in range(26):
        x, y, q = r.uniform(0, S), r.uniform(0, S), r.uniform(10, 46)
        a -= np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (q * q)) * r.uniform(12, 46)
    save(a, 'button_h.png')


# ── the thimble: staggered pits by the hundred, plain band, engraved scroll, rolled rim. u round it, v up it ──
def thimble():
    W, H = 4096, 2048
    im = Image.new('L', (W, H), 128)
    d = ImageDraw.Draw(im)
    n, rows = 64, 19
    for j in range(rows):
        v = 0.36 + j * 0.0285
        for i in range(n):
            x = (i + (j % 2) * 0.5) / n * W
            y = (1 - v) * H
            for dx in (-W, 0, W):
                d.ellipse([x + dx - 23, y - 21, x + dx + 23, y + 21], fill=26)
                d.ellipse([x + dx - 16, y - 13, x + dx + 16, y + 17], fill=6)
    im = im.filter(ImageFilter.GaussianBlur(4))
    d = ImageDraw.Draw(im)
    for v, w, f in ((0.335, 10, 66), (0.322, 6, 186), (0.1, 10, 70), (0.112, 6, 190)):
        d.line([(0, (1 - v) * H), (W, (1 - v) * H)], fill=f, width=w)
    for k in range(16):                                            # the scroll: a vine of C-curves with leaves and dots
        x0 = k / 16 * W
        s = 1 if k % 2 else -1
        cy = (1 - 0.215) * H
        pts = []
        for q in range(60):
            t = q / 59
            ang = t * 4.6
            R = 92 * (1 - t * 0.78)
            pts.append((x0 + 130 + math.cos(ang * s + math.pi) * R, cy + s * 40 + math.sin(ang * s + math.pi) * R * 0.95))
        for dx in (-W, 0, W):
            d.line([(x + dx, y) for x, y in pts], fill=40, width=9, joint='curve')
            d.line([(x0 + dx - 40, cy), (x0 + dx + 60, cy - s * 36), (x0 + dx + 130, cy + s * 4)], fill=52, width=8, joint='curve')
            for q, b in ((14, 0.6), (26, -0.5), (38, 0.8)):
                x, y = pts[q]
                a = math.atan2(pts[q + 1][1] - pts[q - 1][1], pts[q + 1][0] - pts[q - 1][0]) + b * s
                d.polygon([(x + dx, y), (x + dx + math.cos(a + 0.3) * 24, y + math.sin(a + 0.3) * 24), (x + dx + math.cos(a) * 46, y + math.sin(a) * 46), (x + dx + math.cos(a - 0.3) * 24, y + math.sin(a - 0.3) * 24)], fill=58)
            d.ellipse([x0 + dx + 240, cy - 12, x0 + dx + 258, cy + 6], fill=40)
    r = random.Random(4)
    for _ in range(420):
        x, y, t, l = r.uniform(0, W), r.uniform(0, H), r.uniform(0, 3.14), r.uniform(20, 240)
        d.line([(x, y), (x + math.cos(t) * l, y + math.sin(t) * l)], fill=r.choice([108, 114, 118, 138]), width=r.choice([1, 2, 2]))
    save(im.filter(ImageFilter.GaussianBlur(1.4)), 'thimble_h.png')
    # inside: where the name was, filed away in long strokes
    S = 1024
    a = np.full((S, S), 128, np.float32)
    f = Image.new('L', (S, S), 128)
    fd = ImageDraw.Draw(f)
    for _ in range(900):
        x, y = r.gauss(S / 2, 150), r.gauss(S / 2, 100)
        t, l = r.choice([0.35, 0.35, 0.3, -0.5]) + r.gauss(0, 0.08), r.uniform(50, 220)
        fd.line([(x - math.cos(t) * l, y - math.sin(t) * l), (x + math.cos(t) * l, y + math.sin(t) * l)], fill=r.choice([40, 70, 90, 190, 210]), width=r.choice([2, 2, 3, 4]))
    save(np.asarray(f.filter(ImageFilter.GaussianBlur(0.8)), np.float32) + a - 128, 'thimble_in.png')


# ── the seed packet ──
def seeds():
    W, H = 1400, 1960
    a = paper(W, H, 12, base=208)
    ink = Image.new('L', (W, H), 255)
    d = ImageDraw.Draw(ink)
    m = 70
    for k, w in ((0, 7), (17, 2), (38, 3)):
        d.rectangle([m + k, m + k, W - m - k, H - m - k], outline=40, width=w)
    for sx, sy in ((0, 0), (1, 0), (0, 1), (1, 1)):                 # printer's corners
        cx, cy = (W - m - 38 if sx else m + 38), (H - m - 38 if sy else m + 38)
        for q in range(4):
            R = 34 + q * 20
            d.arc([cx - R, cy - R, cx + R, cy + R], (180 if sx else 270) if sy else (90 if sx else 0), (270 if sx else 360) if sy else (180 if sx else 90), fill=50, width=4)
    # ruled bands behind the titles, as engravers shade them
    for y0, y1 in ((150, 170), (404, 424)):
        for y in range(y0, y1, 5):
            d.line([(180, y), (W - 180, y)], fill=70, width=2)
    f = font(FELLSC, 168)
    t = 'Sweet Peas'
    d.text(((W - f.getlength(t)) / 2, 190), t, font=f, fill=22)
    f2 = font(FELLI, 60)
    t = 'Lathyrus odoratus · mixed, old sorts'
    d.text(((W - f2.getlength(t)) / 2, 440), t, font=f2, fill=40)
    p = os.path.join(C, PEA)
    if os.path.exists(p):
        pea = Image.open(p).convert('L')
        pea = pea.crop((20, 20, pea.width - 20, pea.height - 20)).resize((760, 1010), Image.LANCZOS)
        b = np.asarray(pea, np.float32)
        lo, hi = np.percentile(b, 2), np.percentile(b, 80)
        b = np.clip((b - lo) / (hi - lo), 0, 1) * 255
        yy, xx = np.mgrid[0:b.shape[0], 0:b.shape[1]]
        e = ((xx / b.shape[1] - .5) / .5) ** 2 + ((yy / b.shape[0] - .5) / .5) ** 2
        k = np.clip((e - 0.86) / 0.14, 0, 1)
        b = b * (1 - k) + 255 * k
        ink.paste(Image.fromarray(b.astype(np.uint8)), ((W - 760) // 2, 530))
    d.ellipse([(W - 810) / 2, 514, (W + 810) / 2, 1556], outline=60, width=3)
    f3 = font(FELL, 46)
    for y, t in ((1716, 'sow under glass in February · plant out in April'), (1776, 'J. Harrow & Daughter, Seedsmen  ·  price 1d.')):
        d.text(((W - f3.getlength(t)) / 2, y), t, font=f3, fill=46)
    ink = ink.filter(ImageFilter.GaussianBlur(0.8))
    hand(ink, (640, 1580), 'for the spring', 92, ink=24, seed=8, slope=-0.05)
    I = np.asarray(ink, np.float32) / 255
    I = 1 - (1 - I) * (0.62 + 0.38 * np.clip(noise(W, H, 9, 3) * 2.2 - 0.45, 0, 1))       # worn print
    a = fold(a, 0, 1130, W, 1096, 40, 1)
    a = fold(a, 690, 0, 730, H, 22, 2)
    a = fold(a, W, 1500, 1060, H, 34, 6)
    out = np.minimum(a, a * (0.18 + 0.82 * I))
    save(out, 'seeds_front.png')
    a = paper(W, H, 31, base=200)
    b = Image.new('L', (W, H), 255)
    d = ImageDraw.Draw(b)
    f4 = font(FELL, 50)
    y = 520
    for t in ('Soak the seed one night in water.', 'Sow in pots, two inches deep,', 'and keep them from the mice.', '', 'They want the sun, and something', 'to climb. Give them a string',
              'and they will follow it', 'wherever it goes.', '', 'The more you cut, the more they come.'):
        d.text((190, y), t, font=f4, fill=56)
        y += 74
    d.rectangle([150, 470, W - 150, y + 50], outline=70, width=3)
    b = np.asarray(b.filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
    a = fold(a, 0, 1096, W, 1130, 36, 1)
    save(a * (0.25 + 0.75 * b), 'seeds_back.png')
    save(paper(W, 520, 44, base=190, edge=0.8), 'seeds_flap.png')


# ── the pattern: her hand, a chart, the doll drawn front and side ──
def pattern():
    W, H = 1800, 2400
    a = paper(W, H, 77, base=206)
    ink = Image.new('L', (W, H), 255)
    d = ImageDraw.Draw(ink)
    r = random.Random(21)
    y = 120
    hand(ink, (150, y), 'Little one', 118, ink=30, seed=1, slope=-0.008)
    wobbly(d, [(150, 300), (700, 292)], 50, 5, r)
    # the doll, front and side
    def ell(cx, cy, rx, ry, w=5, f=46, arc=(0, 360)):
        for k in range(2):
            p = [(cx + math.cos(math.radians(t)) * (rx + r.uniform(-2, 2)) + r.uniform(-1, 1), cy + math.sin(math.radians(t)) * (ry + r.uniform(-2, 2))) for t in range(arc[0], arc[1] + 1, 6)]
            d.line(p, fill=f, width=w - k * 2, joint='curve')
    cx, cy = 430, 640
    ell(cx, cy, 150, 140)
    ell(cx, cy + 270, 120, 145)
    for s in (-1, 1):
        wobbly(d, [(cx + s * 105, cy + 190), (cx + s * 190, cy + 290), (cx + s * 178, cy + 320), (cx + s * 112, cy + 262)], 46, 5, r)
        wobbly(d, [(cx + s * 70, cy + 385), (cx + s * 82, cy + 500), (cx + s * 24, cy + 500), (cx + s * 26, cy + 408)], 46, 5, r)
    wobbly(d, [(cx - 10, cy - 138), (cx - 40, cy - 235), (cx + 6, cy - 200), (cx + 34, cy - 250), (cx + 22, cy - 140)], 46, 4, r)
    for dx, dy in ((-1, -1), (1, 1), (-1, 1), (1, -1)):
        wobbly(d, [(cx - 58, cy - 10), (cx - 58 + dx * 22, cy - 10 + dy * 22)], 30, 6, r)
    ell(cx + 58, cy - 10, 26, 26, 5, 30)
    for q in ((-8, -8), (8, -8), (-8, 8), (8, 8)):
        d.ellipse([cx + 58 + q[0] - 3, cy - 10 + q[1] - 3, cx + 58 + q[0] + 3, cy - 10 + q[1] + 3], fill=30)
    wobbly(d, [(cx - 52, cy + 66), (cx + 52, cy + 66)], 24, 5, r)
    for k in range(7):
        wobbly(d, [(cx - 46 + k * 15, cy + 50), (cx - 44 + k * 15, cy + 84)], 24, 4, r, 1)
    for k in range(34):                                            # shading strokes down one side
        t = math.radians(-50 + k * 3.6)
        wobbly(d, [(cx + math.cos(t) * 146, cy + math.sin(t) * 136), (cx + math.cos(t) * 112 - 8, cy + math.sin(t) * 104 + 10)], 110, 2, r, 1)
    for k in range(30):
        t = math.radians(-50 + k * 4)
        wobbly(d, [(cx + math.cos(t) * 116, cy + 270 + math.sin(t) * 140), (cx + math.cos(t) * 84, cy + 280 + math.sin(t) * 108)], 110, 2, r, 1)
    # measures
    wobbly(d, [(180, 500), (180, 1140)], 90, 3, r)
    for yy_ in (500, 1140):
        wobbly(d, [(160, yy_), (200, yy_)], 90, 3, r)
    t = Image.new('L', (W, H), 255)
    hand(ink, (84, 800), '9 in.', 44, ink=70, seed=3)
    hand(ink, (640, 560), 'x', 54, ink=60, seed=4)
    wobbly(d, [(650, 606), (520, 636)], 100, 2, r)
    hand(ink, (640, 690), 'shut', 54, ink=40, seed=5)
    wobbly(d, [(632, 726), (492, 706)], 100, 2, r)
    hand(ink, (630, 900), 'stuff', 48, ink=70, seed=6)
    hand(ink, (630, 952), 'firm', 48, ink=70, seed=7)
    wobbly(d, [(622, 940), (540, 920)], 100, 2, r)
    # the chart
    x0, y0, c, nx, ny = 900, 400, 38, 20, 20
    for i in range(nx + 1):
        wobbly(d, [(x0 + i * c, y0), (x0 + i * c, y0 + ny * c)], 120 if i % 5 else 66, 2 if i % 5 else 4, r, 0.9)
    for j in range(ny + 1):
        wobbly(d, [(x0, y0 + j * c), (x0 + nx * c, y0 + j * c)], 120 if j % 5 else 66, 2 if j % 5 else 4, r, 0.9)
    for j in range(ny):
        for i in range(nx):
            q = (i - 9.5) ** 2 / 64 + (j - 10) ** 2 / 80
            on = 0.8 < q < 1.12 or (j in (7, 8) and i in (6, 13)) or (j == 13 and 5 < i < 14) or (j in (12, 14) and i % 2 == 0 and 5 < i < 14)
            if on:
                for k in range(5):
                    xa, ya = x0 + i * c + 4, y0 + j * c + 5 + k * 6.6
                    wobbly(d, [(xa, ya + r.uniform(-2, 2)), (xa + c - 9, ya + r.uniform(-2, 2))], 62, 4, r, 1)
    for j in range(0, ny, 5):
        hand(ink, (x0 + nx * c + 14, y0 + j * c - 6), str(ny - j), 30, ink=90, seed=j)
    hand(ink, (900, 1180), 'face, 20 rows', 46, ink=70, seed=9)
    # rows
    rows = ['cast on 12, join, 1 rnd plain', 'inc every 2nd st (18), rnd plain', 'inc every 3rd (24), 6 rnds plain', 'k2 tog all round, draw up',
            'head the same, but leave a gap', 'the width of two fingers to fill it', 'arms 4 st  x 9,  legs 5 st  x 8', 'her red for the heart. a ribbon.']
    y = 1290
    for k, t in enumerate(rows):
        hand(ink, (150, y), f'{k + 1}.', 54, ink=70, seed=40 + k)
        hand(ink, (230, y), t, 60, ink=46 + (k * 37) % 26, seed=50 + k, slope=-0.006)
        y += 84
    y = 2010
    hand(ink, (150, y), 'Sew the mouth shut, so it can tell it nothing.', 62, ink=18, seed=90, jitter=1.5)
    hand(ink, (150, y + 96), "No name, so it can't be called.", 62, ink=18, seed=91, jitter=1.6)
    for q in (206, 226):
        wobbly(d, [(140, y + q + 2), (1260, y + q - 10)], 16, 8, r, 2.2)
    for q in (0, 1, 2):
        wobbly(d, [(140, y + 226 + q * 2), (1250, y + 214 + q * 3)], 30, 4, r, 2)
    for _ in range(16):                                            # blots
        x, yy_, q = r.uniform(100, W - 100), r.uniform(100, H - 100), r.uniform(2, 9)
        d.ellipse([x - q, yy_ - q, x + q, yy_ + q * 0.9], fill=50)
    d.ellipse([1478, 2196, 1522, 2238], fill=22)
    ink = ink.filter(ImageFilter.GaussianBlur(0.9))
    I = np.asarray(ink, np.float32) / 255
    bleed = np.asarray(ink.filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
    I = 1 - (1 - I) * (0.8 + 0.2 * np.clip(noise(W, H, 40, 6) * 2 - 0.4, 0, 1))
    for args in ((0, 800, W, 790, 46, 3), (0, 1604, W, 1612, 46, 4), (904, 0, 892, H, 40, 5), (W, 260, 1500, 0, 30, 7), (0, 2100, 330, H, 30, 8)):
        a = fold(a, *args)
    out = a * (0.12 + 0.88 * I) * (0.9 + 0.1 * bleed)
    # a ring from a cup, a thumb's dirt
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.hypot(xx - 1380, yy - 1640) + (noise(W, H, 60, 2) - 0.5) * 12
    out -= np.exp(-((dist - 190) / 9) ** 2) * 30 * (0.4 + noise(W, H, 90, 4))
    save(out, 'pattern_front.png')
    b = paper(W, H, 91, base=192)
    for args in ((0, 800, W, 790, 40, 3), (0, 1604, W, 1612, 40, 4), (904, 0, 892, H, 36, 5)):
        b = fold(b, *args)
    ghost = np.asarray(ImageChops.invert(ink).transpose(Image.FLIP_LEFT_RIGHT).filter(ImageFilter.GaussianBlur(3)), np.float32)
    save(b - ghost * 0.09, 'pattern_back.png')


for fn in (spool, button, thimble, seeds, pattern):
    fn()
    print(fn.__name__)
