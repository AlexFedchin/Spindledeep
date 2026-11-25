"""Spindledeep: turn chosen backdrop paintings into the renderer's packed tone maps.

    python scripts/art/pack.py            # every pick in PICKS
Each output app/assets/art/<zone>.webp is 1024x1024 RGBA:
  R = far tone (foreground painted out)   G = full tone
  B = near matte (depth-split, soft)       A = depth (1 = nearest)
The engraving shader draws the far layer and the near layer with different parallax and line work.
Depth: Depth Anything V2 Small (Apache-2.0). Run with scripts/art/.cache/venv/Scripts/python.exe.
"""
import os
import sys

import cv2
import numpy as np
import torch
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'app', 'assets', 'art')
SRC = os.path.join(HERE, '.cache', 'out')
S = 1024

# zone -> (engine/file, near threshold as a depth quantile)
PICKS = {
    'brink': ('sdxl/sky_12.png', 0.80),
    'throat': ('realvis/throat_12.png', 0.72),
    'gardens': ('sdxl/gardens_12.png', 0.70),
    'bells': ('realvis/bells_11.png', 0.70),
    'mere': ('sdxl/mere_12.png', 0.72),
    'loom': ('realvis/loom_11.png', 0.70),
    'hush': ('realvis/hush_13.png', 0.72),
    'treadles': ('realvis/treadles_12.png', 0.70),
    'loomdeep': ('realvis/loomdeep_11.png', 0.74),
}

_depth = None


def depth_map(img):
    global _depth
    if _depth is None:
        from transformers import pipeline
        _depth = pipeline('depth-estimation', model=os.path.join(HERE, '.cache', 'models', 'depth'),
                          device=0 if torch.cuda.is_available() else -1)
    d = np.asarray(_depth(img)['predicted_depth'].squeeze().cpu().numpy(), np.float32)
    d = cv2.resize(d, img.size, interpolation=cv2.INTER_CUBIC)
    return (d - d.min()) / (d.max() - d.min() + 1e-6)


def tone(rgb):
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    lo, hi = np.percentile(g, 1), np.percentile(g, 99.5)
    return np.clip((g - lo) / (hi - lo + 1e-6), 0, 1)


def pack(zone, rel, q):
    img = Image.open(os.path.join(SRC, rel)).convert('RGB')
    if img.height > img.width:      # portrait shafts: keep them portrait inside the square
        pass
    img = img.resize((S, S), Image.LANCZOS)
    rgb = np.asarray(img)
    d = depth_map(img)
    thr = float(np.quantile(d, q))
    m = np.clip((d - thr) / 0.06, 0, 1)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.GaussianBlur(m, (0, 0), 1.6)
    hole = (cv2.dilate((m > 0.05).astype(np.uint8), np.ones((15, 15), np.uint8)) * 255)
    small = cv2.resize(rgb, (S // 2, S // 2), interpolation=cv2.INTER_AREA)
    fill = cv2.inpaint(small, cv2.resize(hole, (S // 2, S // 2), interpolation=cv2.INTER_NEAREST), 9, cv2.INPAINT_TELEA)
    fill = cv2.resize(fill, (S, S), interpolation=cv2.INTER_CUBIC)
    k = cv2.GaussianBlur(hole.astype(np.float32) / 255, (0, 0), 5)[..., None]
    far = (rgb * (1 - k) + fill * k).astype(np.uint8)
    out = np.dstack([tone(far), tone(rgb), m, d])
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray((out * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, zone + '.webp'), lossless=True, quality=100, method=6, exact=True)
    print(zone, os.path.getsize(os.path.join(OUT, zone + '.webp')) // 1024, 'KB', flush=True)


if __name__ == '__main__':
    for z in (sys.argv[1:] or PICKS):
        pack(z, *PICKS[z])
