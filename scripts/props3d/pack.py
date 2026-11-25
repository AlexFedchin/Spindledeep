"""Baked passes (.cache/<name>_*.npy from build.py) -> app/assets/props/<name>.webp (colour; alpha = gloss) and <name>_n.jpg (normals,
in the game's axes).   <art venv>/python scripts/props3d/pack.py <name ...|all>"""
import glob
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
C = os.path.join(HERE, '.cache')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'app', 'assets', 'props'))
names = sys.argv[1:]
if not names or 'all' in names:
    names = [os.path.basename(p)[:-8] for p in glob.glob(os.path.join(C, '*_col.npy'))]
for n in names:
    col, rough, nrm, ao = (np.load(os.path.join(C, f'{n}_{k}.npy')).astype(np.float32) for k in ('col', 'rough', 'nrm', 'ao'))
    a = np.clip(ao[..., :1], 0, 1) ** 0.9
    rgb = np.clip(col * (0.25 + 0.75 * a), 0, 1) ** (1 / 2.2)
    gloss = np.clip(1 - rough[..., 0], 0.02, 1)
    im = np.concatenate([rgb, gloss[..., None]], -1)
    Image.fromarray(np.round(im * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, n + '.webp'), quality=90, alpha_quality=90, exact=True, method=6)
    v = nrm * 2 - 1
    v = np.stack([v[..., 0], v[..., 2], -v[..., 1]], -1)
    v /= np.linalg.norm(v, axis=-1, keepdims=True) + 1e-6
    Image.fromarray(np.round((v * 0.5 + 0.5) * 255).astype(np.uint8)).save(os.path.join(OUT, n + '_n.jpg'), quality=93, subsampling=0)
    print(n, [os.path.getsize(os.path.join(OUT, n + e)) // 1024 for e in ('.bin', '.webp', '_n.jpg')], 'KB')
