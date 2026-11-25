"""Spindledeep cinematics: turn Blender's data passes into the game's intaglio engraving (GPU, torch).

Same recipe as app/src/shaders.js: tone → expose() → engrave() with a main line family that cross-hatches in
the darks, ink (0.045, 0.04, 0.06) on paper (0.91, 0.86, 0.75) tinted by the light, red thread and warm lamps
added on top as glow, burnt plate edges. Unlike the game's screen-space lines, film lines are anchored in the
world (from the position pass) so they stick to surfaces as the camera moves: walls and figures get
horizontal contour lines, floors get lines receding along the ground, the sky gets screen lines.

    <art venv>/python scripts/cine/post.py <frames dir> <out dir> [--exposure=1.0] [--first=1] [--last=N] [--boil=4]
"""
import glob
import math
import os
import sys

os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '1'
import cv2  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402
import torch.nn.functional as F  # noqa: E402

dev = 'cuda'
INK = torch.tensor([0.045, 0.04, 0.06], device=dev).view(3, 1, 1)
PAPER = torch.tensor([0.91, 0.86, 0.75], device=dev).view(3, 1, 1)
RED = torch.tensor([1.0, 0.16, 0.12], device=dev).view(3, 1, 1)
CAM = {}
AUTO = {}
CONTRAST = 1.25
OUT_W, OUT_H = 1920, 1080
DEBUG = None
LOCK = True
BOIL = 1.0


def load(path):
    a = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if a is None:
        raise FileNotFoundError(path)
    a = a.astype(np.float32) / (65535.0 if a.dtype == np.uint16 else 255.0)
    if a.ndim == 2:
        a = a[:, :, None]
    if a.shape[2] >= 3:
        a = a[:, :, [2, 1, 0]]          # BGR → RGB
    return torch.from_numpy(np.ascontiguousarray(a)).to(dev).permute(2, 0, 1)


def fract(x):
    return x - torch.floor(x)          # like WGSL fract(); torch.frac keeps the sign of negatives


def hash2(x, y):
    q = fract(torch.stack([x * 123.34, y * 456.21]))
    d = (q[0] * (q[0] + 45.32) + q[1] * (q[1] + 45.32))
    q = q + d
    return fract(q[0] * q[1])


def vnoise(x, y):
    ix, iy = torch.floor(x), torch.floor(y)
    fx, fy = x - ix, y - iy
    wx, wy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = hash2(ix, iy); b = hash2(ix + 1, iy); c = hash2(ix, iy + 1); d = hash2(ix + 1, iy + 1)
    return (a + (b - a) * wx) + ((c + (d - c) * wx) - (a + (b - a) * wx)) * wy


def line_field(phase, f, aa):
    t = torch.abs(fract(phase) - 0.5) * 2
    ink_w = 1 - f.clamp(0, 1)
    return smoothstep(ink_w - aa, ink_w + aa, t)


def smoothstep(e0, e1, x):
    t = ((x - e0) / (e1 - e0 + 1e-6)).clamp(0, 1)
    return t * t * (3 - 2 * t)


def engrave(v, ph1, ph2, aa, cross=1.0):
    f = v.clamp(0, 1)
    single = line_field(ph1, f, aa)
    fc = torch.sqrt(f)
    crossed = line_field(ph1, fc, aa) * line_field(ph2, fc, aa)
    k = smoothstep(torch.tensor(0.66, device=dev), torch.tensor(0.42, device=dev), f) * smoothstep(torch.tensor(0.1, device=dev), torch.tensor(0.26, device=dev), f) * cross
    return single + (crossed - single) * k


def blur(x, s):
    k = int(s * 3) | 1
    g = torch.exp(-((torch.arange(k, device=dev) - k // 2) ** 2) / (2 * s * s)); g = g / g.sum()
    c = x.shape[0]
    x = F.conv2d(x[None], g.view(1, 1, 1, k).repeat(c, 1, 1, 1), padding=(0, k // 2), groups=c)
    x = F.conv2d(x, g.view(1, 1, k, 1).repeat(c, 1, 1, 1), padding=(k // 2, 0), groups=c)
    return x[0]


def world_phase(P, dep, sp_world, axis, s0=0.004):
    """iso-lines of dot(P, axis) with spacing ~sp_world, blended between octaves so density stays even"""
    l = torch.log2((sp_world / s0).clamp(min=1e-6))
    l0 = torch.floor(l); fr = l - l0
    d = (P * axis.view(3, 1, 1)).sum(0)
    return d / (s0 * torch.pow(2.0, l0)), d / (s0 * torch.pow(2.0, l0 + 1)), fr


def load_pos(fdir, f):
    Praw = load(os.path.join(fdir, f'pos_{f:04d}.png'))[:3]
    pf = os.path.join(fdir, f'posf_{f:04d}.png')
    if os.path.exists(pf):
        fine = load(pf)[:3]
        Praw = torch.where((Praw > 0.002) & (Praw < 0.998), (torch.round(Praw * 256 - fine) + fine) / 256, Praw)
    return Praw


def process(fdir, f, exposure, boil, first_k=None):
    tag = f'{f:04d}'
    enc = [float(x) for x in open(os.path.join(fdir, 'encoding.txt')).read().split()]
    beauty = load(os.path.join(fdir, f'beauty_{tag}.png'))[:3] ** 2 * 16
    Praw = load_pos(fdir, f)
    P = Praw * enc[3] + torch.tensor(enc[:3], device=dev).view(3, 1, 1)
    aux = load(os.path.join(fdir, f'aux_{tag}.png'))[:3]
    dep = torch.exp(load(os.path.join(fdir, f'depth_{tag}.png'))[0] * math.log(1001.0)) - 1
    nrm = load(os.path.join(fdir, f'normal_{tag}.png'))[:3] * 2 - 1
    # passes are rendered small; the engraving is drawn at the output size from smoothly upsampled data
    if beauty.shape[1] != OUT_H:
        up = lambda x: F.interpolate(x[None], size=(OUT_H, OUT_W), mode='bilinear', align_corners=False)[0]
        beauty, Praw, aux, nrm = up(beauty), up(Praw), up(aux), up(nrm)
        dep = up(dep[None])[0]
        P = Praw * enc[3] + torch.tensor(enc[:3], device=dev).view(3, 1, 1)
    C, H, W = beauty.shape
    # blown snow is drawn on top later; underneath it, fill the geometry passes from the surroundings so
    # thousands of flake edges don't break the line field
    fm = (aux[1:2] > 0.02).float()
    if fm.sum() > 0:
        keep = 1 - fm
        def fill(x, s=6.0):
            num = blur(x * keep, s); den = blur(keep, s).clamp(min=1e-4)
            return x * keep + (num / den) * fm
        Praw = fill(Praw); P = Praw * enc[3] + torch.tensor(enc[:3], device=dev).view(3, 1, 1)
        dep = fill(dep[None])[0]; nrm = fill(nrm)
        beauty_bg = fill(beauty)
    else:
        beauty_bg = beauty
    yy, xx = torch.meshgrid(torch.arange(H, device=dev, dtype=torch.float32), torch.arange(W, device=dev, dtype=torch.float32), indexing='ij')
    sky = (dep > 380) | (Praw.abs().sum(0) < 1e-6)
    sky0 = sky                  # exposure is measured against the true sky only, so the look of a shot doesn't shift
    # surfaces outside the shot's encoded position box come out clamped (constant P, zero gradient), so world-
    # anchored lines there are pure noise and flicker frame to frame: engrave them like the sky instead
    clip = ((Praw < 0.003) | (Praw > 0.997)).any(0).float()
    sky = sky | (blur(clip[None], 2.0)[0] > 0.3)
    # metres per pixel per metre of depth (from the position pass where surfaces are smooth)
    camj = CAM.get(fdir)
    if camj is None:
        import json
        camj = CAM[fdir] = json.load(open(os.path.join(fdir, 'camera.json')))
    lens = camj['lens'].get(str(f)) or list(camj['lens'].values())[0]
    k = camj['sensor'] / lens / W                       # metres per pixel per metre of depth (horizontal fit)
    sp_px = 4.6 * H / 1080.0
    aa = 1.15 / sp_px
    sp_world = sp_px * k * dep.clamp(max=500)
    # boil: the plate is re-engraved a few times a second, lines shift slightly
    bseed = (f // boil) * 7.13
    wob = (vnoise(xx * 0.012 + bseed, yy * 0.012 - bseed) - 0.5) * 0.35 + (vnoise(xx * 0.05 - bseed, yy * 0.05) - 0.5) * 0.12
    wob = wob * BOIL
    # tone
    lumv = (beauty_bg * torch.tensor([0.3, 0.52, 0.18], device=dev).view(3, 1, 1)).sum(0)
    if AUTO.get(fdir) is None and 'fixed' in AUTO:
        AUTO[fdir] = AUTO['fixed']        # --auto=V: shots that start in the dark (the first frame decides otherwise)
    if AUTO.get(fdir) is None:
        sel = (~sky0) & (aux[1] < 0.02)
        med = torch.quantile(lumv[sel][::7], 0.6) if sel.any() else torch.tensor(0.05, device=dev)
        AUTO[fdir] = float((0.2 / med.clamp(min=1e-4)).clamp(0.4, 60))
        print('auto exposure', fdir, round(AUTO[fdir], 2), flush=True)
    v = 1 - torch.exp(-lumv.clamp(min=0) * 3.0 * exposure * AUTO[fdir])
    v = ((v - 0.5) * CONTRAST + 0.5).clamp(0.0, 0.9)      # highlights keep a hairline, like a real plate
    # world-anchored line families, spaced by their real on-screen density so foreshortened ground and
    # sloped hills never alias: lines are iso-contours of dot(P, axis); the octave comes from the screen
    # gradient of that field; per pixel the family that reads most horizontal on screen wins
    # one axis for the whole shot: if it turned with the camera, the lines would sweep over everything that is far from
    # the origin (snow outside crawled eight lines a second during a 9 degree pan, seen as flicker)
    fws = np.array(list(camj['fwd'].values()), dtype=np.float64)[:, :2]
    fws = fws / np.maximum(np.linalg.norm(fws, axis=1, keepdims=True), 1e-9)
    fw = fws.mean(0) if LOCK else (camj['fwd'].get(str(f)) or list(camj['fwd'].values())[0])
    fg = torch.tensor([float(fw[0]), float(fw[1]), 0.0], device=dev); fg = fg / fg.norm().clamp(min=1e-6)
    AZ = torch.tensor([0.0, 0.0, 1.0], device=dev)
    AX = torch.tensor([0.55, -0.4, 0.73], device=dev); AX = AX / AX.norm()
    valid = ~sky
    def fam(axis, mult=1.0):
        d = (P * axis.view(3, 1, 1)).sum(0)
        def mm(a, b):   # min-modulus difference: ignores the jump at silhouettes
            return torch.where(a.abs() < b.abs(), a, b)
        dx = torch.zeros_like(d); dy = torch.zeros_like(d)
        dx[:, 1:-1] = mm(d[:, 2:] - d[:, 1:-1], d[:, 1:-1] - d[:, :-2])
        dy[1:-1, :] = mm(d[2:, :] - d[1:-1, :], d[1:-1, :] - d[:-2, :])
        g = torch.sqrt(dx * dx + dy * dy)
        g = blur(g[None], 2.0)[0].clamp(min=1e-7)
        horiz = blur((dy.abs() / g)[None], 3.0)[0].clamp(0, 1)
        l = torch.log2(sp_px * mult * g / 0.002)
        l0 = torch.floor(l); fr = l - l0
        s0 = 0.002 * torch.pow(2.0, l0)
        return d / s0, d / (s0 * 2), fr, horiz, g
    z0, z1, zfr, zh, zg = fam(AZ)
    f0, f1, ffr, fh, fgm = fam(fg)
    # cross-hatching only shows in the darks: screen-space at the game's angle, like the game's plates
    xph = (-math.sin(-0.6) * xx + math.cos(-0.6) * yy) / (sp_px * 1.1)
    x0 = x1 = xph; xfr = torch.zeros_like(xph)
    def eng2(p0, p1, fr, c0, c1, cfr):
        m0 = engrave(v, p0 + wob, c0 + wob * 0.7, aa); m1 = engrave(v, p1 + wob, c1 + wob * 0.7, aa)
        return m0 * (1 - fr) + m1 * fr
    m_z = eng2(z0, z1, zfr, x0, x1, xfr)
    m_f = eng2(f0, f1, ffr, x0, x1, xfr)
    wz = smoothstep(torch.tensor(-0.15, device=dev), torch.tensor(0.15, device=dev), zh - fh)
    nzs = blur(nrm[2:3].abs(), 5.0)[0]
    wz = wz * (1 - smoothstep(torch.tensor(0.45, device=dev), torch.tensor(0.7, device=dev), nzs))   # floors and slopes: lines across the ground
    # a family whose field barely changes across the surface (fwd lines on a wall facing the camera, z lines on
    # flat ground) has a near-zero gradient: its octave then comes from position-pass noise and its lines boil
    # from frame to frame. Wherever one family is several times better defined than the other, use that one.
    r = torch.log2(blur(zg[None], 4.0)[0]) - torch.log2(blur(fgm[None], 4.0)[0])
    wz = torch.maximum(wz, smoothstep(torch.tensor(1.5, device=dev), torch.tensor(3.0, device=dev), r))
    wz = wz * (1 - smoothstep(torch.tensor(1.5, device=dev), torch.tensor(3.0, device=dev), -r))
    mask = m_f + (m_z - m_f) * wz
    if DEBUG:
        def dbg(name, x, lo=0.0, hi=1.0):
            y = ((x - lo) / (hi - lo)).clamp(0, 1)
            cv2.imwrite(os.path.join(DEBUG, name + '.png'), (y.cpu().numpy() * 255).astype(np.uint8))
        yy0, xx0 = (int(v) for v in os.environ.get('PROBE', '430,1500').split(','))
        print('probe2 zg', float(zg[yy0, xx0]), 'fg', float(fgm[yy0, xx0]), 'r', float(r[yy0, xx0]), 'wz', float(wz[yy0, xx0]), 'nzs', float(nzs[yy0, xx0]), 'dep', float(dep[yy0, xx0]), 'ffr', float(ffr[yy0, xx0]), 'f0', float(f0[yy0, xx0]))
        print('probe v', float(v[yy0, xx0]), 'z0', float(z0[yy0, xx0]), 'z1', float(z1[yy0, xx0]), 'zfr', float(zfr[yy0, xx0]), 'wob', float(wob[yy0, xx0]), 'mz', float(m_z[yy0, xx0]), 'aa', aa, 'zg', float(zg[yy0, xx0]))
        dbg('wz', wz); dbg('zh', zh); dbg('fh', fh); dbg('mz', m_z); dbg('mf', m_f); dbg('v', v)
        dbg('zg', torch.log10(zg), -5, -1); dbg('fg', torch.log10(fgm), -5, -1); dbg('sky', sky.float()); dbg('dep', dep, 0, 60)
    # sky: screen-space lines like the game's backdrops (softer, no cross-hatching)
    ang = 0.06
    ph_sky = (-math.sin(ang) * xx + math.cos(ang) * yy) / (sp_px * 1.3) + wob
    m_sky = engrave(v, ph_sky, ph_sky, 2.4 / (sp_px * 1.3), cross=0.0)
    m_sky = m_sky * 0.55 + 0.45 * v
    mask = torch.where(sky, m_sky, mask)
    # depth fog lifts far things toward paper a little, like aerial perspective in a print
    # (the beauty already carries the volumetric haze; this just keeps the far plate from going muddy)
    # blown snow: bright paper strokes regardless of tone
    snow = aux[1].clamp(0, 1)
    mask = mask + (1 - mask) * snow * 0.9
    # burnt plate edges
    uvx, uvy = xx / W, yy / H
    vg = torch.sqrt(((uvx - 0.5)) ** 2 + ((uvy - 0.5) * 0.85) ** 2)
    mask = mask * (1 - smoothstep(torch.tensor(0.52, device=dev), torch.tensor(0.86, device=dev), vg) * 0.85)
    # colour: paper tinted by the light, ink deep blue-black
    tint = beauty / lumv.clamp(min=1e-4)
    tint = tint.clamp(0, 1.6)
    tintC = 1 + (tint - 1) * 0.55 * smoothstep(torch.tensor(0.0, device=dev), torch.tensor(0.05, device=dev), lumv)
    grain = vnoise(xx * 0.9, yy * 0.9) * 0.06 + vnoise(xx * 0.08, yy * 0.08) * 0.07 + vnoise(xx * 0.02, yy * 0.6) * 0.03
    paperC = PAPER * (0.9 + grain) * tintC
    inkC = INK * (0.85 + vnoise(xx * 0.3, yy * 0.3) * 0.3)
    col = inkC + (paperC - inkC) * mask
    # glow: the red thread and the warm lamps keep their colour and bloom; a breath of red in the ink
    red = aux[0].clamp(0, 1)
    warm = aux[2].clamp(0, 1)
    emis = beauty * (red + warm).clamp(0, 1)
    emis = emis / (1 + emis * 0.25)
    glow = blur(emis, 3) * 0.6 + blur(emis, 12) * 0.5 + blur(emis, 40) * 0.35
    col = col + glow * 0.9 + emis * 0.55
    redlight = blur(beauty * red, 60)
    col = col + redlight * torch.tensor([0.11, 0.035, 0.03], device=dev).view(3, 1, 1) * 4
    # film grain
    gr = (hash2(xx + f * 13.7, yy - f * 7.1) - 0.5) * 0.025
    col = col + gr
    return col.clamp(0, 1), k


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    fdir, odir = args[0], args[1]
    os.makedirs(odir, exist_ok=True)
    frames = sorted(int(os.path.basename(p)[7:11]) for p in glob.glob(os.path.join(fdir, 'beauty_*.png')))
    first = int(opts.get('first', frames[0])); last = int(opts.get('last', frames[-1]))
    exposure = float(opts.get('exposure', 1.0)); boil = int(opts.get('boil', 4))
    global CONTRAST, DEBUG, OUT_W, OUT_H, LOCK, BOIL
    LOCK = opts.get('lock', '1') == '1'; BOIL = float(opts.get('wobble', 1.0))
    if 'size' in opts:
        OUT_W, OUT_H = (int(x) for x in opts['size'].split('x'))
    DEBUG = opts.get('debug')
    if 'auto' in opts:
        AUTO['fixed'] = float(opts['auto'])
    CONTRAST = float(opts.get('contrast', CONTRAST))
    kfix = None
    for f in frames:
        if f < first or f > last:
            continue
        with torch.no_grad():
            col, k = process(fdir, f, exposure, boil)
        out = (col.permute(1, 2, 0).cpu().numpy() * 255 + 0.5).astype(np.uint8)[:, :, ::-1]
        cv2.imwrite(os.path.join(odir, f'{f:04d}.png'), out)
        if f % 24 == 0:
            print('post', f, flush=True)


if __name__ == '__main__':
    main()
