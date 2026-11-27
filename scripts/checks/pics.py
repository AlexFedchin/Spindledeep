"""Picture check: the same views of the game drawn by two versions of it, compared.
   python scripts/checks/pics.py                      the working tree against HEAD (what a change did to how the game looks)
   python scripts/checks/pics.py --ref=d27d8a4        against another commit
   python scripts/checks/pics.py roots hush           only those views;  --size=2560x1080  another shape of window (both are kept apart)
Views are in SPOTS below (pole to start from, optional place to stand, optional view height). Old versions run from a copy of their
app/ code over today's assets (electron --src), so nothing in the working tree is stashed. Runs are invisible (--smoke).
Writes .cache/pics/<version>-<size>/<view>.png, side-by-side sheets, and a table of how much each view changed and where.
Exit code 1 if the game reported errors. A view that changed is not a failure: look at it, then decide."""
import io, json, os, shutil, subprocess, sys, tarfile, tempfile
from PIL import Image, ImageDraw
import numpy as np
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CACHE = os.path.join(ROOT, 'scripts', 'checks', '.cache', 'pics')
# name: (pole, (x, y) or None, view height or None)
SPOTS = {
    'title': None,
    'brink': (11, (30, 1.5), 15), 'throat': (12, None, 19), 'throat_l5': (1, None, 15), 'throat_deep': (1, (60, -56.5), 18),
    'gardens': (2, (24, -59), 16), 'roots': (3, None, 13), 'g2': (3, (27, -80.5), 16),
    'bell': (4, None, 17), 'bell_mid': (5, None, 17), 'bell_e': (6, None, 17), 'shaft': (6, (109, -140), 17),
    'mere': (8, None, 19), 'mere_w': (9, None, 17), 'hall': (10, None, 17), 'hall_mid': (13, (33, -245.5), 17),
    'orchard': (3, (66, -87), 16), 'orchard_e': (3, (84, -87), 17), 'long': (18, (64, -340.6), 15), 'long_e': (18, (88, -340.6), 15),
    'weigh': (31, None, 15), 'pews': (33, None, 16),
    'h1': (14, None, 15), 'h2': (15, None, 15), 'slabs': (35, None, 15), 'pins': (37, None, 15), 'hush': (17, None, 15), 'hush_e': (16, None, 15),
    'tread': (19, None, 18), 'heddle': (21, None, 18), 'lane': (40, None, 16), 'lower': (42, None, 16), 'well': (29, None, 16),
    'seat_throat': (12, (64.5, -33), 11), 'seat_gardens': (2, (24.5, -60.4), 11), 'seat_orchard': (3, (72.5, -87.6), 11),
    'seat_mere': (7, (102.5, -193.8), 11), 'seat_hall': (9, (19.5, -193.8), 11), 'seat_long': (18, (75, -340.8), 11), 'seat_beam': (41, (44, -420.6), 11),
    'loom_in': (23, None, 20), 'cloth': (24, None, 14), 'n2': (45, None, 18), 'machine': (47, None, 16), 'beam': (28, (36, -442), 12),
}
HIDE = "document.head.insertAdjacentHTML('beforeend','<style>.card,#card,#hint,#hints,#sub,#subs,#subtitle,#toast,#prompt,#hud,#yarn{opacity:0!important;visibility:hidden!important}</style>');"
SEED = "(()=>{let a=7;Math.random=()=>{a=(a+0x6d2b79f5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}})();"


def src_of(rev):
    d = os.path.join(CACHE, 'src-' + rev)
    if not os.path.isdir(d):
        data = subprocess.run(['git', 'archive', rev, 'app/src', 'app/index.html'], cwd=ROOT, capture_output=True, check=True).stdout
        os.makedirs(CACHE, exist_ok=True)
        with tempfile.TemporaryDirectory() as t:
            tarfile.open(fileobj=io.BytesIO(data)).extractall(t, filter='data')
            shutil.copytree(os.path.join(t, 'app'), d)
    return d


def render(out, names, size, src=None):
    os.makedirs(out, exist_ok=True)
    steps = [{'js': SEED + HIDE + '0', 'wait': 2500, **({'out': os.path.join(out, 'title.png')} if 'title' in names else {})}]
    for n in names:
        if n == 'title': continue
        peg, at, vh = SPOTS[n]
        # (a pole's own view keeps the thread's real length; elsewhere the yarn is let run long)
        go = f'__SD.go({at[0]},{at[1]});__SD.W.hurt=-400;' if at else ''
        steps.append({'js': f"{SEED}__SD.viewLock={vh or 'null'};__SD.from({peg});{go}0", 'wait': 3600, 'out': os.path.join(out, n + '.png')})
    lst = os.path.join(out, 'shots.json')
    json.dump(steps, open(lst, 'w'))
    env = {k: v for k, v in os.environ.items() if k != 'ELECTRON_RUN_AS_NODE'}
    exe = os.path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
    cmd = [exe, '.', '--smoke=' + os.path.join(out, 'x.png'), '--shots=' + lst, f'--size={size}'] + ([f'--src={src}'] if src else [])
    r = subprocess.run(cmd, cwd=ROOT, env=env, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    ok = 'SMOKE OK' in r.stdout
    if not ok: print(r.stdout[-1500:], r.stderr[-800:])
    return ok


def compare(a, b, names, sheet):
    rows, cells = [], []
    for n in names:
        fa, fb = os.path.join(a, n + '.png'), os.path.join(b, n + '.png')
        if not (os.path.exists(fa) and os.path.exists(fb)): continue
        A, B = Image.open(fa).convert('L'), Image.open(fb).convert('L')
        # (the fine lines move by a pixel anywhere: what counts is the tone of small blocks)
        s = (A.width // 16, A.height // 16)
        x, y = (np.asarray(im.resize(s, Image.BOX), dtype=float) for im in (A, B))
        d = np.abs(x - y); j, i = np.unravel_index(d.argmax(), d.shape)
        rows.append((n, d.mean(), (d > 10).mean() * 100, y.mean() - x.mean(), (int(i * 16), int(j * 16)), d.max()))
        w = 800; h = round(w * A.height / A.width)
        row = Image.new('RGB', (w * 2 + 6, h + 18), (12, 11, 16))
        row.paste(Image.open(fa).convert('RGB').resize((w, h)), (0, 18)); row.paste(Image.open(fb).convert('RGB').resize((w, h)), (w + 6, 18))
        ImageDraw.Draw(row).text((4, 3), f'{n}   mean {d.mean():.2f}   changed {(d > 10).mean() * 100:.1f} %   lighter by {y.mean() - x.mean():+.2f}', fill=(232, 220, 196))
        cells.append(row)
    print(f'{"view":12} {"mean":>6} {"changed":>8} {"lighter":>8}   most at')
    for n, m, c, l, p, mx in sorted(rows, key=lambda r: -r[1]): print(f'{n:12} {m:6.2f} {c:7.1f}% {l:+8.2f}   {p[0]},{p[1]} ({mx:.0f})')
    for k in range(0, len(cells), 4):
        part = cells[k:k + 4]
        im = Image.new('RGB', (part[0].width, sum(c.height for c in part)))
        y = 0
        for c in part: im.paste(c, (0, y)); y += c.height
        im.save(f'{sheet}{k // 4}.jpg', quality=86)
    print('sheets:', sheet + '*.jpg')


if __name__ == '__main__':
    opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    names = [a for a in sys.argv[1:] if not a.startswith('--')] or list(SPOTS)
    size = opt.get('size', '1600x900')
    rev = subprocess.run(['git', 'rev-parse', '--short', opt.get('ref', 'HEAD')], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    ref, now = os.path.join(CACHE, f'{rev}-{size}'), os.path.join(CACHE, f'now-{size}')
    need = [n for n in names if not os.path.exists(os.path.join(ref, n + '.png'))]
    ok = True
    if need: ok = render(ref, need, size, src_of(rev)) and ok
    if '--refonly' not in sys.argv:
        ok = render(now, names, size) and ok
        compare(ref, now, names, os.path.join(CACHE, f'sheet-{size}-'))
    sys.exit(0 if ok else 1)
