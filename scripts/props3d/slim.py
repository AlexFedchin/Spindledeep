"""Makes the props in app/assets/props small, after build.py and pack.py (safe to run again): the models' positions and texture
coordinates are rounded to what can be seen (a 16 000th of the thing) and the file is gzipped (props3d.js unpacks it), normal
maps are saved a little lighter.   python scripts/props3d/slim.py"""
import glob
import gzip
import io
import json
import os
import struct

import numpy as np
from PIL import Image

OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app', 'assets', 'props'))
was = now = 0
for p in sorted(glob.glob(os.path.join(OUT, '*.bin'))):
    raw = open(p, 'rb').read()
    was += len(raw)
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    hl = struct.unpack('<I', raw[:4])[0]
    h = json.loads(raw[4:4 + hl])
    nv, st = h['nv'], h['stride']
    assert st == 32, p
    v = np.frombuffer(raw, np.uint8, nv * st, 4 + hl).reshape(nv, st).copy()
    # 0 position (3 f32), 12 normal, 16 uv (2 f32), 24 colour, 28 kind
    for a, n, q in ((0, 3, 2.0 ** 14), (16, 2, 2.0 ** 13)):
        f = v[:, a:a + 4 * n].copy().view('<f4')
        v[:, a:a + 4 * n] = (np.round(f * q) / q).astype('<f4').view(np.uint8).reshape(nv, 4 * n)
    data = raw[:4 + hl] + v.tobytes() + raw[4 + hl + nv * st:]
    z = io.BytesIO()
    with gzip.GzipFile(fileobj=z, mode='wb', compresslevel=9, mtime=0, filename='') as g:
        g.write(data)
    open(p, 'wb').write(z.getvalue())
    now += len(z.getvalue())
for p in sorted(glob.glob(os.path.join(OUT, '*_n.jpg'))):
    s = os.path.getsize(p)
    was += s
    im = Image.open(p)
    if not im.info.get('comment') == b'slim':
        z = io.BytesIO()
        im.convert('RGB').save(z, 'JPEG', quality=84, subsampling=0, optimize=True, comment=b'slim')
        if len(z.getvalue()) < s:
            im.close()
            open(p, 'wb').write(z.getvalue())
    now += os.path.getsize(p)
print(f'{was / 1e6:.1f} MB -> {now / 1e6:.1f} MB')
