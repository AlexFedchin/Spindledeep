"""Is every sound on its movement? Reads the finished film's sound (or the foley stem edit.py leaves) and, for every event,
finds where the attack really is (first reaching half of its loudest).

    <art venv>/python scripts/cine/synccheck.py [intro|cut|outro]

1. the stem: for each struck event the attack within 80 ms of its frame, in ms from the frame's start.
2. the film: the whole mix against the stem by correlation, so a delay added by the encoder or the container would show.
One frame is 41.7 ms. Prints a table by kind and the worst; writes .cache/<film>_sync.json."""
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
SR = 48000
NAME = sys.argv[1] if len(sys.argv) > 1 else 'intro'
stem = np.load(os.path.join(CACHE, NAME + '_foley.npy'))
E = json.load(open(os.path.join(CACHE, NAME + '_events.json')))


def env(x, ms):
    n = int(ms * SR / 1000)
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same') + 1e-14)


rows = []
for i, e in enumerate(E):
    if e['lasts']:
        continue
    c = int(e['t'] * SR)
    a, b = c - int(0.08 * SR), c + int(0.08 * SR)
    if a < 0 or b > len(stem):
        continue
    s = env(stem[a: b], 4.0)
    near = any(abs(o['t'] - e['t']) < 0.10 and o is not e for o in E)
    # the moment of a sound is where it first reaches half of its loudest (near its frame)
    k = int(np.argmax(s > 0.5 * s.max()))
    off = round(k / SR * 1000) - 80
    rows.append({'kind': e['kind'], 'shot': e['shot'], 'f': e['f'], 'off': off, 'crowded': near})
kinds = {}
for r in rows:
    if not r['crowded']:
        kinds.setdefault(r['kind'], []).append(r['off'])
for k, v in sorted(kinds.items()):
    print(f'{k:13s} n={len(v):3d}  attack {min(v):+4d} .. {max(v):+4d} ms, median {int(np.median(v)):+d}')
al = [x for v in kinds.values() for x in v]
print('events', len(E), 'struck and alone', len(al), 'within one frame', sum(abs(x) <= 42 for x in al), 'within half a frame', sum(abs(x) <= 21 for x in al))
film = os.path.join(HERE, '..', '..', 'app', 'assets', 'cine', NAME + '.mp4')
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', film, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
mix = np.frombuffer(raw, np.float32)
n = min(len(mix), len(stem))
hp = lambda x: np.diff(x, prepend=0)
best = []
for k in range(0, n - 6 * SR, 5 * SR):
    a, b = hp(stem[k:k + 6 * SR]), hp(mix[k:k + 6 * SR])
    if np.abs(a).max() < 0.02:
        continue
    N = 1 << 20
    c = np.fft.irfft(np.conj(np.fft.rfft(a, N)) * np.fft.rfft(b, N), N)
    w = int(0.12 * SR)
    c2 = np.concatenate([c[-w:], c[:w]])
    j = int(np.argmax(c2)) - w
    best.append((round(j / SR * 1000, 2), round(float(c2.max() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9)), 2)))
best = [x for x in best if x[1] > 0.25]
print('film against stem, ms (correlation):', best)
probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,start_time,duration', '-of', 'csv=p=0', film], capture_output=True, text=True).stdout
print('streams (type, start, length):', probe.split())
json.dump({'rows': rows, 'film': best}, open(os.path.join(CACHE, NAME + '_sync.json'), 'w'))
