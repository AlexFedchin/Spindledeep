"""What the player's session logs say, stretch by stretch: how long each takes, how often it is tried, what kills there, how much yarn is
left, and what is used.   python scripts/checks/logs.py [folder] [--since=2026-11-25] [--version=1.2.0]
The folder defaults to the player's own logs (%APPDATA%/Spindledeep/logs). Sections are written since 1.2.0; from older logs only the
deaths and the poles are read (time between two ties, deaths between them)."""
import collections
import glob
import os
import re
import sys
from datetime import datetime

opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
folder = next((a for a in sys.argv[1:] if not a.startswith('--')), os.path.join(os.environ.get('APPDATA', ''), 'Spindledeep', 'logs'))
S = collections.defaultdict(lambda: dict(n=0, t=[], tries=[], deaths=collections.Counter(), low=[], still=0.0, plucks=0, knots=0, dims=0, rest=0.0))
order, runs, found, files = [], [], collections.Counter(), 0
SEC = re.compile(r'section (\S+)>(\S+) · ([\d.]+) s · tries (\d+) · deaths (\d+)(?: \(([^)]*)\))? · lowest yarn (-?\d+) of (\d+) · standing ([\d.]+) s · sitting (\d+) s · plucks (\d+)(?: · knots (\d+))? · dims (\d+)')
for f in sorted(glob.glob(os.path.join(folder, 'session-*.log'))):
    if opt.get('since', '') > os.path.basename(f)[8:]:
        continue
    L = open(f, encoding='utf-8').read().splitlines()
    if 'version' in opt and (not L or opt['version'] not in L[0]):
        continue
    files += 1
    has = any('] section ' in x for x in L)
    pole, t0, dead = None, None, []
    for x in L:
        m = SEC.search(x)
        if m:
            k = (m[1], m[2])
            if k not in order: order.append(k)
            s = S[k]; s['n'] += 1; s['t'].append(float(m[3])); s['tries'].append(int(m[4])); s['low'].append(int(m[7]))
            s['deaths'].update([d for d in (m[6] or '').split(',') if d]); s['still'] += float(m[9]); s['rest'] += float(m[10]); s['plucks'] += int(m[11]); s['knots'] += int(m[12] or 0); s['dims'] += int(m[13])
        r = re.search(r'run over · (\S+)', x)
        if r: runs.append(r[1])
        r = re.search(r'\] (?:found (.+)|hidden room opens · (.+))', x)
        if r: found[r[1] or r[2]] += 1
        if has: continue
        # logs from before sections
        ts = re.match(r'(\S+Z) ', x)
        ts = datetime.fromisoformat(ts[1].replace('Z', '+00:00')) if ts else None
        if 'NEW RUN' in x or 'continue run' in x:
            c = re.search(r'from pole (\d+)', x); pole, t0, dead = (c[1] if c else '0'), ts, []
        d = re.search(r'death · (\S+)', x)
        if d: dead.append(d[1])
        m = re.search(r'tied to pole (\d+)', x)
        if m and pole is not None and m[1] != pole:
            k = (pole, m[1])
            if k not in order: order.append(k)
            s = S[k]; s['n'] += 1; s['t'].append((ts - t0).total_seconds()); s['tries'].append(len(dead) + 1); s['deaths'].update(dead)
            pole, t0, dead = m[1], ts, []
med = lambda a: sorted(a)[len(a) // 2] if a else 0
print(f'{files} sessions · {len(runs)} runs over {" ".join(runs)}')
print(f'{"stretch":>10} {"times":>6} {"median":>8} {"longest":>8} {"tries":>6} {"most":>5} {"yarn left":>10}  deaths')
for k in order:
    s = S[k]
    print(f'{k[0] + " > " + k[1]:>10} {s["n"]:6} {med(s["t"]):7.1f}s {max(s["t"]):7.1f}s {sum(s["tries"]) / s["n"]:6.1f} {max(s["tries"]):5} {min(s["low"]) if s["low"] else "-":>10}  '
          + ', '.join(f'{c} x{n}' for c, n in s['deaths'].most_common()) + (f'   [plucks {s["plucks"] / s["n"]:.1f}, knots {s["knots"] / s["n"]:.1f}, dims {s["dims"] / s["n"]:.1f}]' if s['plucks'] + s['knots'] + s['dims'] else ''))
hard = sorted(order, key=lambda k: -sum(S[k]['deaths'].values()))[:5]
print('most deaths: ' + ', '.join(f'{k[0]}>{k[1]} ({sum(S[k]["deaths"].values())})' for k in hard if S[k]['deaths']))
if found: print('found: ' + ', '.join(f'{n} x{c}' for n, c in found.most_common()))
