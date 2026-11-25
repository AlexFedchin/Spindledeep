"""How near her skin is to what she holds, frame by frame, from the same vertices that are rendered.

    blender -b --factory-startup -P scripts/cine/touch.py -- <shot> [step]

For every hand of the shot: while it holds, the gap (mm, negative = inside) of palm, fingers and thumb; how far the arm fell
short of the hand (must be 0: otherwise the hand is not where it was solved) and the sharpest wrist. Also how far each foot
fell short of its footprint. Writes .cache/touch/<shot>.json."""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
argv = sys.argv[sys.argv.index('--') + 1:]
shot, step = argv[0], int(argv[1]) if len(argv) > 1 else 2
import lib  # noqa: E402
import shots  # noqa: E402
import shots_intro  # noqa: E402

out = os.path.join(HERE, '.cache', 'touch'); os.makedirs(out, exist_ok=True)
sc = shots.SHOTS[shot](out, True)
rows = []
A = shots_intro.ACTORS[-1] if shots_intro.ACTORS else None
for f in range(sc.frame_start, sc.frame_end + 1, step):
    sc.frame_current = f
    if A:
        A.miss = {1: 0.0, -1: 0.0}; A.bend = {1: 0.0, -1: 0.0}
    for fn in lib.FRAME_FNS:
        fn(f)
    row = {'f': f, 'hands': [], 'miss': dict(A.miss) if A else {}, 'bend': {k: math.degrees(v) for k, v in A.bend.items()} if A else {}, 'foot': getattr(shots_intro, 'FOOT', [0])[0]}
    for r in shots_intro.REPORT:
        for s, (held, g) in r(f).items():
            row['hands'].append((s, bool(held), [round(x * 1000, 2) for x in g]))
    rows.append(row)
json.dump(rows, open(os.path.join(out, shot + '.json'), 'w'))
held = [(r['f'], s, g) for r in rows for s, h, g in r['hands'] if h]
print('REPORT', shot, 'frames', len(rows), 'reach short max mm', {k: round(max(r['miss'][k] for r in rows) * 1000, 1) for k in (1, -1)} if A else '',
      'wrist max deg', {k: round(max(r['bend'][k] for r in rows)) for k in (1, -1)} if A else '', 'foot short max mm', round(max(r['foot'] for r in rows) * 1000, 1))
def spans(sel):
    out = []
    for r in rows:
        if sel(r):
            if out and r['f'] - out[-1][1] <= step:
                out[-1][1] = r['f']
            else:
                out.append([r['f'], r['f']])
    return out


if A:
    for s in (1, -1):
        print('REPORT  hand', s, 'wrist over 65 deg at', spans(lambda r: r['bend'][s] > 65), '| arm too short at', spans(lambda r: r['miss'][s] > 0.001))
n = max(len(r['hands']) for r in rows)
for i in range(n):
    h = [(r['f'], *r['hands'][i]) for r in rows if i < len(r['hands'])]
    hh = [x for x in h if x[2]]
    if hh:
        mid = hh[len(hh) // 2][3]
        print('REPORT  hold', i, 'hand', hh[0][1], 'frames', hh[0][0], '-', hh[-1][0], '| gap mm palm %.1f fingers %s thumb %.1f' % (mid[0], mid[1:5], mid[5]), '| nearest over the hold', min(min(x[3]) for x in hh), '..', max(min(x[3]) for x in hh))
    loose = [(min(x[3]), x[0]) for x in h if not x[2]]
    if loose:
        print('REPORT  hold', i, 'when free: deepest mm', min(loose))
