"""Spindledeep: cut the picks of caller.py / facework.py out of their black into sprites (grey tone, soft alpha).
    scripts/art/.cache/venv/Scripts/python.exe scripts/art/cutout.py     -> app/assets/art/sprites/*.webp"""
import os

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, '.cache', 'out', 'caller')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'app', 'assets', 'art', 'sprites'))
os.makedirs(OUT, exist_ok=True)


def load(n):
    return cv2.imread(os.path.join(D, n + '.png'), 0).astype(np.float32) / 255


def largest(m):
    n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
    return lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]) if n > 1 else m > 0


def lit(g, rect, lo=0.035, hi=0.10, floor=None, floor_lo=0.28, close=45):
    """what the light touches is there; the shadow side is left to the dark of the cave. `floor` (y fraction): below it the
    set's floor is lit too, so only clearly brighter things (feet, a hand) are kept"""
    h, w = g.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    y /= h; x /= w
    L = np.full_like(g, lo)
    if floor:
        L = lo + (floor_lo - lo) * np.clip((y - floor) / 0.06, 0, 1)
    b = cv2.GaussianBlur(g, (0, 0), 1.0)
    al = np.clip((b - L) / (hi - lo), 0, 1)
    x0, y0, x1, y1 = rect
    e = np.minimum(np.minimum((x - x0) / 0.02, (x1 - x) / 0.02), np.minimum((y - y0) / 0.01, (y1 - y) / 0.01))
    al *= np.clip(e, 0, 1)
    keep = largest(cv2.dilate((al > 0.25).astype(np.uint8), np.ones((25, 25), np.uint8)))
    # close the figure over its own shadows, so nothing behind shows through a dark chest
    body = cv2.morphologyEx((al > 0.3).astype(np.uint8) * keep.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close)))
    al = np.maximum(al * cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 3), cv2.GaussianBlur(cv2.erode(body, np.ones((5, 5), np.uint8)).astype(np.float32), (0, 0), 1.5))
    return np.clip(al, 0, 1)


def save(name, g, a, crop=True, maxh=900, gain=1.0):
    if crop:
        ys, xs = np.where(a > 0.05)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        g, a = g[y0:y1, x0:x1], a[y0:y1, x0:x1]
    if g.shape[0] > maxh:
        s = maxh / g.shape[0]
        g = cv2.resize(g, None, fx=s, fy=s, interpolation=cv2.INTER_AREA); a = cv2.resize(a, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    t = (np.clip(g * gain, 0, 1) * 255).astype(np.uint8)
    cv2.imwrite(os.path.join(OUT, name + '.webp'), np.dstack([t, t, t, (np.clip(a, 0, 1) * 255).astype(np.uint8)]), [cv2.IMWRITE_WEBP_QUALITY, 101])       # (101: lossless)
    print(name, t.shape[1], t.shape[0], flush=True)
    return t.shape


# ── the thing: body without its head, and the head alone ──
g = load('bend_31')
h, w = g.shape
legs = np.zeros((h, w), np.uint8)
legs[:640] = 1
for poly in ([(340, 630), (435, 630), (428, 720), (404, 762), (379, 768), (314, 788), (205, 791), (190, 772), (196, 758), (320, 726), (345, 700)],
             [(600, 630), (700, 630), (712, 735), (712, 764), (520, 764), (520, 744), (640, 684)], [(925, 630), (1035, 630), (1050, 700), (1046, 798), (925, 798), (925, 760), (985, 700)]):
    cv2.fillPoly(legs, [np.array(poly)], 1)
a = lit(g * np.maximum(legs, 0), (0.08, 0.02, 0.9, 0.985), floor=0.8, floor_lo=0.19, close=13)
# the floor it stands on is lit; keep the floor out below the ankles except the feet and hand themselves
yy, xx = np.mgrid[0:h, 0:w]
head = np.zeros((h, w), np.uint8)
poly = np.array([[130, 190], [300, 190], [352, 218], [346, 262], [338, 330], [345, 400], [130, 400]])
cv2.fillPoly(head, [poly], 1)
hs = cv2.GaussianBlur(head.astype(np.float32), (0, 0), 5)
ys, xs = np.where(a > 0.05)
box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
body = a * (1 - hs)
ab = np.zeros_like(a); ab[box[1]:box[3], box[0]:box[2]] = 1
by0, by1, bx0, bx1 = box[1], box[3], box[0], box[2]
save('crawl', g[by0:by1, bx0:bx1], body[by0:by1, bx0:bx1], crop=False, maxh=1000, gain=1.15)
print('META crawl aspect', (bx1 - bx0) / (by1 - by0), 'neck', (332 - bx0) / (bx1 - bx0), (262 - by0) / (by1 - by0), 'box', box)
save('crawlhead', g, a * cv2.GaussianBlur(head.astype(np.float32), (0, 0), 3), maxh=420, gain=1.15)

# ── arms, upright: hand at the top ──
for name, src, rect in (('arm0', 'offer_32', (0.385, 0.385, 0.515, 1.0)), ('arm1', 'offer_32', (0.602, 0.295, 0.742, 1.0))):
    g = load(src)
    h, w = g.shape
    x0, y0, x1, y1 = int(rect[0] * w), int(rect[1] * h), int(rect[2] * w), int(rect[3] * h)
    c = g[y0:y1, x0:x1]
    c = cv2.resize(c, None, fx=1.6, fy=1.6, interpolation=cv2.INTER_CUBIC)
    al = np.clip((cv2.GaussianBlur(c, (0, 0), 1.2) - 0.045) / 0.07, 0, 1)
    al *= cv2.GaussianBlur(largest(cv2.dilate((al > 0.2).astype(np.uint8), np.ones((9, 9), np.uint8))).astype(np.float32), (0, 0), 2)
    save(name, c, al, gain=1.25)
g = load('reach_33')
al = np.clip((cv2.GaussianBlur(g, (0, 0), 1.2) - 0.05) / 0.09, 0, 1)
h, w = g.shape
xx = np.mgrid[0:h, 0:w][1] / w
al *= np.clip(np.minimum(xx, 1 - xx) / 0.06, 0, 1)
save('arms', g[int(h * 0.03):], al[int(h * 0.03):], crop=False, maxh=560, gain=1.1)

# ── the called: from behind, and turned ──
for k, (b, rect, fl) in enumerate((('back_31', (0.08, 0.03, 0.66, 0.975), 0.88), ('back_32', (0.14, 0.01, 0.82, 0.99), 0.9), ('back_33', (0.22, 0.04, 0.74, 0.905), 0.84), ('backman_33', (0.18, 0.08, 0.74, 0.94), 0.86))):
    g = load(b)
    save(f'back{k}', g, lit(g, rect, floor=fl, lo=0.05 if k != 1 else 0.11, hi=0.12 if k != 1 else 0.2, floor_lo=0.32), maxh=520, gain=1.2)


def turned(g, cx, cy, s):
    """the face: no eyes, the mouth stretched black, the hair down"""
    h, w = g.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    for ex in (-0.36, 0.36):
        m = np.exp(-(((x - cx - ex * s) / (0.30 * s)) ** 2 + ((y - cy + 0.25 * s) / (0.22 * s)) ** 2) ** 2)
        g = g * (1 - m) + cv2.GaussianBlur(g, (0, 0), s * 0.22) * 0.55 * m
    m = np.clip(1.5 - 1.5 * (((x - cx) / (0.33 * s)) ** 2 + ((y - cy - 0.85 * s) / (0.78 * s)) ** 2), 0, 1)
    return g * (1 - m) + 0.005 * m


import json  # noqa: E402
picks = json.load(open(os.path.join(HERE, 'called.json')))
for k, p in enumerate(picks):
    g = load(p['src'])
    al = lit(g, p['rect'], floor=p['floor'], lo=0.05, hi=0.11, floor_lo=0.3)
    save(f'front{k}', turned(g, *p['face']), al, maxh=520, gain=1.2)

# ── the face, its mouth opening ──
for j in range(6):
    p = os.path.join(D, f'call_{j}.png')
    if not os.path.exists(p):
        continue
    g = load(f'call_{j}')
    h, w = g.shape
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    # everything but the face goes out: the black behind it, the shoulders, the ends of the plate
    e = ((x - w * 0.5) / (w * 0.53)) ** 4 + ((y - h * 0.44) / (h * 0.5)) ** 4
    chin = (0.655, 0.675, 0.715, 0.77, 0.83, 0.885)[j]
    al = np.clip(1.6 - 1.6 * e, 0, 1) * np.clip((cv2.GaussianBlur(g, (0, 0), 10) - 0.03) / 0.07, 0, 1)
    al *= np.clip((chin + 0.02 - y / h) / 0.05, 0, 1) * np.clip((y / h - 0.005) / 0.10, 0, 1)
    half = np.interp(y / h, [chin - 0.2, chin - 0.08, chin], [0.5, 0.36, 0.24])          # the jaw, not the shoulders
    al *= np.clip((half - np.abs(x / w - 0.5)) / 0.06, 0, 1)
    mouth = np.clip(1.4 - 1.4 * (((x - w * 0.53) / (w * 0.2)) ** 2 + ((y - h * (0.5 + (chin - 0.6) * 0.45)) / (h * (chin - 0.5))) ** 2), 0, 1)
    al = np.maximum(al, mouth * np.clip((chin - y / h) / 0.04, 0, 1))
    save(f'call{j}', np.clip((g - 0.05) / 0.72, 0, 1) ** 1.7, al, crop=False, maxh=1000)
