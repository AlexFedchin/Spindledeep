// Drawing for the bottom of the world: the arms that come out of the earth, the people who came when they were called,
// the dark that rises, and what is left of her. The thing itself is a real figure (stage.js, figure.js). Pictures (assets/art/sprites) are lit tone on nothing, made by
// scripts/art (caller.py, facework.py, cutout.py); the engraving and the lights do the rest, so most of it is never seen.
import * as L from './level.js';
import { clamp, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;
export const SPRITES = ['arm0', 'arm1', 'arms'];      // (the called are drawn by hand since 2026-11-27)

function img(D, ctx, im, x, y, h, { flip = 1, rot = 0, alpha = 1, dark = 1, ax = 0.5, ay = 1, w = 0 } = {}) {
  if (!im || alpha <= 0) return false;
  const k = D.k, H = h * k, W = w ? w * k : H * im.width / im.height;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(D.sx(x), D.sy(y)); if (rot) ctx.rotate(rot); ctx.scale(flip, 1);
  if (dark !== 1) ctx.filter = `brightness(${dark})`;
  ctx.drawImage(im, -W * ax, -H * ay, W, H);
  ctx.restore();
  return true;
}

// an arm along a bent line from the rock (pts[0]) to the palm (last point): the hand keeps its size and shape, the forearm
// behind it is stretched as long as it has to be
function arm(D, ctx, im, pts, hand, width, alpha = 1, dark = 1) {
  if (!im) return;
  const k = D.k, n = pts.length, HV = 0.42;            // the top 42 % of the picture is the hand and wrist
  ctx.save(); ctx.globalAlpha *= alpha;
  if (dark !== 1) ctx.filter = `brightness(${dark})`;
  const [tx, ty] = pts[n - 1], [qx, qy] = pts[n - 3];
  let acc = 0; const len = [0];
  for (let i = 1; i < n; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); len.push(acc); }
  const wrist = Math.max(0, acc - hand * 0.45);
  // the forearm, in slices from the rock to the wrist
  for (let i = 1; i < n; i++) {
    const a = len[i - 1], b = Math.min(wrist, len[i]);
    if (b <= a) break;
    const f = (b - a) / (len[i] - len[i - 1] || 1);
    const [ax, ay] = pts[i - 1], bx = ax + (pts[i][0] - ax) * f, by = ay + (pts[i][1] - ay) * f;
    const va = 1 - (1 - HV) * (a / Math.max(wrist, 0.01)), vb = 1 - (1 - HV) * (b / Math.max(wrist, 0.01));
    const L0 = Math.hypot(bx - ax, by - ay) * k;
    ctx.save();
    ctx.translate(D.sx(bx), D.sy(by)); ctx.rotate(Math.atan2(D.sy(by) - D.sy(ay), D.sx(bx) - D.sx(ax)) + Math.PI / 2);
    ctx.drawImage(im, 0, vb * im.height, im.width, Math.max(1, (va - vb) * im.height), -width * k / 2, -0.6, width * k, L0 + 1.8);
    ctx.restore();
  }
  // the hand
  const ang = Math.atan2(-(ty - qy), tx - qx) + Math.PI / 2;
  const f = clamp((wrist - 0) / Math.max(acc, 1e-3), 0, 1), ix = Math.max(1, len.findIndex((v) => v >= wrist));
  const u = (wrist - len[ix - 1]) / (len[ix] - len[ix - 1] || 1);
  const wx = pts[ix - 1][0] + (pts[ix][0] - pts[ix - 1][0]) * u, wy = pts[ix - 1][1] + (pts[ix][1] - pts[ix - 1][1]) * u;
  ctx.translate(D.sx(wx), D.sy(wy)); ctx.rotate(ang);
  const hh = hand * k;
  ctx.drawImage(im, 0, 0, im.width, HV * im.height, -width * k / 2, -hh, width * k, hh);
  ctx.restore();
}

// ── the hands in the Hush ────────────────────────────────────────────────
export function drawHands(D, ctx, ectx) {
  const k = D.k, t = D.time;
  for (const h of D.w.deep.hands) {
    if (!D.vis(h.ax, h.ay, h.reach + 2)) continue;
    const X0 = D.sx(h.ax), Y0 = D.sy(h.ay), tan = Math.atan2(-h.ny, h.nx) + Math.PI / 2;
    const moving = h.st === 'stir';
    if (moving) {
      // the earth over it works loose: the only warning
      const j = 0.05 * Math.sin(t * 46 + h.i);
      ctx.fillStyle = g(0.3); ctx.strokeStyle = g(0.02); ctx.lineWidth = Math.max(1, k * 0.02);
      ctx.save(); ctx.translate(X0 + j * k, Y0); ctx.rotate(tan);
      ctx.beginPath(); ctx.ellipse(0, 0, (0.3 + h.t * 0.5) * k, (0.08 + h.t * 0.22) * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      ectx.fillStyle = `rgba(190,196,215,${0.10 + 0.12 * h.t})`; ectx.beginPath(); ectx.arc(X0, Y0, (0.35 + 0.4 * h.t) * k, 0, TAU); ectx.fill();
      if (Math.random() < 0.6) D.spawn('puff', h.ax + (Math.random() - 0.5) * 0.7, h.ay + h.ny * 0.1, 1, { speed: 0.6, vx: h.nx * 0.8, vy: h.ny * 0.8 - 0.9, life: 0.7, r: 0.5 });
    }
    const len = h.ext;
    if (len < 0.12) continue;
    const ux = (h.tx - h.ax) / len, uy = (h.ty - h.ay) / len, nx = -uy, ny = ux, pts = [];
    // it bows toward the open side, and never further than the air round its middle (an arm is never drawn into rock)
    const T = D.w.T, mx = h.ax + ux * len / 2, my = h.ay + uy * len / 2, room = (sd) => T.d(mx + nx * sd * 0.5, my + ny * sd * 0.5);
    if (h.side === undefined) h.side = h.i % 2 ? 1 : -1;
    if (room(h.side) < 0.25 && room(-h.side) > room(h.side)) h.side = -h.side;
    const side = h.side, amp = Math.max(0, Math.min(0.7, len * 0.07, T.d(mx, my) - 0.12));
    for (let i = 0; i <= 12; i++) {
      const s = i / 12, bow = Math.sin(s * Math.PI) * amp * side + Math.sin(t * 5 + s * 5 + h.i) * 0.04 * (h.grab ? 2 : 1) * s;
      pts.push([h.ax + ux * len * s + nx * bow, h.ay + uy * len * s + ny * bow]);
    }
    // the hole it came out of
    ctx.fillStyle = g(0.01);
    ctx.save(); ctx.translate(X0, Y0); ctx.rotate(tan); ctx.beginPath(); ctx.ellipse(0, 0, 0.42 * k, 0.17 * k, 0, 0, TAU); ctx.fill(); ctx.restore();
    const im = D.img?.[h.i % 2 ? 'arm1' : 'arm0'], open = h.grab ? 0.72 : 1;
    arm(D, ctx, im, pts, 1.0 * open, 0.62, 1, 0.95);
    arm(D, ectx, im, pts, 1.0 * open, 0.62, 0.09, 1);        // enough of it shows in the dark to see it coming
  }
}

// ── the people who came when they were called ────────────────────────────
export function drawCalled(D, ctx, ectx) {
  const c = D.w.deep.called;
  if (!c || D.cam[1] > -500) return;
  const r = D.w.deep.rise, k = D.k, t = D.time;
  const lw = (m) => Math.max(0.7, m * k);
  for (const f of c) {
    if (!D.vis(f.x, f.y + 1, 3)) continue;
    const woke = r.woke ? clamp(r.t * 1.2, 0, 1) : 0;
    const h = f.h * (1 + woke * 0.04 * Math.sin(t * 23 + f.x)), moving = Math.abs(f.x - (f.px ?? f.x)) > 1e-4; f.px = f.x;
    f.sw = (f.sw || 0) + ((moving ? 1 : 0) - (f.sw || 0)) * 0.05;
    clothes(D, ctx, ectx, f, h, t, lw, k);
  }
}
// (2026-11-27, the user found the photographs of people unclear and did not like them) the called, by hand: the nightclothes each one
// was called down in, standing as if someone were still in them. No head, no hands. Backs to her; turned, the open collar is all there is,
// stretched like a mouth. kind: 0 a long nightgown, 1 a nightshirt over trousers, 2 a nightgown and shawl, 3 a long coat thrown over.
function clothes(D, ctx, ectx, f, h, t, lw, k) {
  const X = (dx) => D.sx(f.x + dx * f.flip), Y = (dy) => D.sy(f.y - 0.04 + dy);
  const child = h < 1.45, kind = f.kind, front = f.turned, tone = 0.5 + 0.32 * f.tone, swing = Math.sin(t * (1.1 + f.tone) + f.i) * (0.015 + 0.05 * (f.sw || 0));
  const sh = h * 0.8, hem = kind === 1 ? h * 0.42 : h * (child ? 0.1 : 0.06), w = h * (child ? 0.15 : 0.13), lean = f.lean * h;
  ctx.save();
  ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.016);
  // trousers under a nightshirt, empty at the ankle
  if (kind === 1) for (const e of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(X(e * w * 0.15), Y(hem + 0.05)); ctx.lineTo(X(e * w * 0.85), Y(hem + 0.05)); ctx.lineTo(X(e * w * 0.7 + swing * 0.5), Y(0.06)); ctx.lineTo(X(e * w * 0.2 + swing * 0.5), Y(0.06)); ctx.closePath();
    ctx.fillStyle = g(tone - 0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = g(0.02); ctx.beginPath(); ctx.ellipse(X(e * w * 0.45 + swing * 0.5), Y(0.07), w * 0.24 * k, 0.03 * k, 0, 0, TAU); ctx.fill();
  }
  // the body of it: shoulders, a little fall to the waist, out to the hem; the hem swings
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(X(-w * 0.95 + lean), Y(sh));
    ctx.quadraticCurveTo(X(-w * 1.08 + lean * 0.6), Y(sh * 0.6), X(-w * (kind === 1 ? 1.0 : 1.32) + swing), Y(hem));
    for (let q = -1; q <= 1; q += 0.25) ctx.lineTo(X(q * w * (kind === 1 ? 1.0 : 1.32) + swing + Math.sin(q * 9 + f.i) * 0.012), Y(hem + (Math.abs(q * 7 + f.i) % 1) * 0.04));
    ctx.quadraticCurveTo(X(w * 1.08 + lean * 0.6), Y(sh * 0.6), X(w * 0.95 + lean), Y(sh));
    ctx.quadraticCurveTo(X(lean), Y(sh + 0.06), X(-w * 0.95 + lean), Y(sh));
    ctx.closePath();
  };
  body(); ctx.fillStyle = g(kind === 3 ? tone - 0.2 : tone); ctx.fill(); ctx.stroke();
  // folds hanging from the shoulders
  ctx.lineWidth = lw(0.01);
  for (let q = -0.7; q <= 0.71; q += 0.35) { ctx.strokeStyle = g(tone - 0.2); ctx.beginPath(); ctx.moveTo(X(q * w * 0.7 + lean * 0.9), Y(sh * 0.92)); ctx.quadraticCurveTo(X(q * w * 0.95 + lean * 0.4), Y(sh * 0.5), X(q * w * 1.2 + swing), Y(hem + 0.05)); ctx.stroke(); }
  // a shawl over the shoulders, or a coat's lapels
  if (kind === 2) { ctx.beginPath(); ctx.moveTo(X(-w * 1.05 + lean), Y(sh + 0.02)); ctx.lineTo(X(w * 1.05 + lean), Y(sh + 0.02)); ctx.lineTo(X(w * 0.2 + lean * 0.7), Y(sh * 0.62)); ctx.lineTo(X(-w * 0.3 + lean * 0.7), Y(sh * 0.66)); ctx.closePath(); ctx.fillStyle = g(tone - 0.25); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.014); ctx.stroke();
    ctx.strokeStyle = g(tone - 0.35); ctx.lineWidth = lw(0.008); for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.moveTo(X(-w * 0.8 + q * 0.4 * w + lean), Y(sh)); ctx.lineTo(X(-w * 0.2 + q * 0.1 * w + lean * 0.7), Y(sh * 0.68)); ctx.stroke(); } }
  if (kind === 3 && front) for (const e of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(e * w * 0.2 + lean), Y(sh)); ctx.lineTo(X(e * w * 0.55 + lean * 0.8), Y(sh * 0.7)); ctx.lineTo(X(e * w * 0.1 + lean * 0.7), Y(sh * 0.55)); ctx.strokeStyle = g(tone + 0.1); ctx.lineWidth = lw(0.014); ctx.stroke(); }
  // buttons down a nightshirt's front
  if (kind === 1 && front) { ctx.fillStyle = g(0.85); for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(X(lean * 0.8), Y(sh * (0.9 - q * 0.1)), 0.018 * k, 0, TAU); ctx.fill(); } }
  // sleeves, hanging empty; the cuffs open on nothing
  for (const e of [-1, 1]) {
    const sx = e * w * 0.95 + lean, cx = e * w * 1.12 + swing * 0.7 + lean * 0.3, cy = sh - h * (child ? 0.3 : 0.34);
    ctx.beginPath(); ctx.moveTo(X(sx - e * 0.02), Y(sh - 0.01)); ctx.quadraticCurveTo(X(sx + e * w * 0.35), Y(sh - h * 0.12), X(cx + e * w * 0.18), Y(cy));
    ctx.lineTo(X(cx - e * w * 0.2), Y(cy + 0.02)); ctx.quadraticCurveTo(X(sx - e * w * 0.15), Y(sh - h * 0.14), X(sx - e * w * 0.3), Y(sh - 0.05)); ctx.closePath();
    ctx.fillStyle = g((kind === 3 ? tone - 0.2 : tone) - 0.06); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.014); ctx.stroke();
    ctx.fillStyle = g(0.03); ctx.beginPath(); ctx.ellipse(X(cx), Y(cy + 0.01), w * 0.2 * k, 0.028 * k, 0, 0, TAU); ctx.fill();
  }
  // the collar: from behind, a dark sliver; turned toward her, the opening gapes, long and black
  ctx.fillStyle = g(0.01);
  if (front) {
    const gape = 1 + 0.2 * Math.sin(t * 2.3 + f.i);
    ctx.beginPath(); ctx.ellipse(X(lean), Y(sh - h * 0.035 * gape), w * 0.36 * k, h * 0.06 * gape * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = g(tone + 0.15); ctx.lineWidth = lw(0.012); ctx.beginPath(); ctx.ellipse(X(lean), Y(sh - h * 0.035 * gape), w * 0.38 * k, h * 0.063 * gape * k, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  } else { ctx.beginPath(); ctx.ellipse(X(lean), Y(sh + 0.01), w * 0.32 * k, 0.025 * k, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ── the dark that rises ──────────────────────────────────────────────────
// Earth, heaving up the Loom with the arms in it (the user, 2026-11-27: no cut-off arms showing, the dirt in detail). Back to front:
// a dim row of arms, the ridge of earth they come out of, the near arms, then the near earth with its clods, stones, roots and the
// grain of its layers. Every arm's foot stays under the earth in front of it. Nothing below the crest is drawn but black.
const hash = (i, s = 0) => { const j = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return j - Math.floor(j); };
export function drawDark(D, ctx, ectx) {
  const w = D.w, r = w.deep.rise;
  if (D.cam[1] > -420 || r.level <= r.y0 + 0.05 || !D.vis(60, r.level, 70)) return;
  const k = D.k, top = r.level, t = D.time, hv = r.heave || 0, p = w.player, dt = D.dtLast || 0;
  const xa = Math.max(r.x0, D.cam[0] - D.viewW / 2 - 3), xb = Math.min(r.x1, D.cam[0] + D.viewW / 2 + 3);
  if (top < D.cam[1] - D.viewH / 2 - 5) return;
  const X = (x) => D.sx(x), Y = (y) => D.sy(y), lw = (m) => Math.max(0.6, m * k);
  // the near face: long swells that travel, a quicker churn, and more of both while it gathers itself to heave
  const surf = (x) => top - 0.4 + (0.5 + 0.45 * hv) * Math.sin(x * 0.45 + t * 0.8) + 0.3 * Math.sin(x * 1.3 - t * 1.9) + 0.1 * Math.sin(x * 3.7 + t * 2.6);
  // the ridge behind it, a little higher
  const ridge = (x) => surf(x) + 0.8 + 0.35 * Math.sin(x * 0.7 - t * 0.6 + 1.3);
  // the crumbling edge of a face: small steps that stay with the ground (hashed by place, not by frame)
  // clods sit in it every CLOD m (where the hash lets one be); the face swells under each, so the crest is lumpy in outline
  const CLOD = 0.3, clod = (c, s) => { const q = hash(c, s); if (q > 0.62) return null; return { q, x: (c + hash(c, s + 1)) * CLOD, sz: 0.07 + 0.2 * hash(c, s + 2) ** 2 }; };
  const edge = (f, x, s) => {
    let y = f(x) + 0.06 * (hash(Math.floor(x / 0.11), s) - 0.5);
    for (let c = Math.floor(x / CLOD) - 1; c <= Math.floor(x / CLOD) + 1; c++) { const o = clod(c, s); if (o) { const u = (x - o.x) / (o.sz * 1.5); if (Math.abs(u) < 1) y = Math.max(y, f(x) + o.sz * 0.55 * (1 - u * u)); } }
    return y;
  };
  const face = (c2, f, s, step = 0.08) => {
    c2.beginPath(); c2.moveTo(X(xa), Y(r.y0 - 3));
    for (let x = Math.floor(xa / step) * step; x <= xb + step; x += step) c2.lineTo(X(x), Y(edge(f, x, s)));
    c2.lineTo(X(xb + step), Y(r.y0 - 3)); c2.closePath();
  };
  // the lowest the face comes across a picture's width: its foot goes under that
  const low = (f, x, hw) => { let m = Infinity; for (let j = -4; j <= 4; j++) m = Math.min(m, f(x + j / 4 * hw)); return m - 0.05; };
  const ims = D.img || {}, cluster = ims.arms, singles = [ims.arm0, ims.arm1].filter(Boolean);
  // a row of the clusters, standing in `f`: their feet at least `deep` m under it
  const clusters = (f, hh, dx, dark, deep, seed) => {
    if (!cluster) return;
    const Wd = hh * cluster.width / cluster.height * 0.9;
    for (let i = Math.floor((xa - dx) / Wd) - 1; i * Wd + dx < xb + Wd; i++) {
      const q = hash(i, seed), x = i * Wd + dx + (q - 0.5) * Wd * 0.3;
      const heave = 0.5 * (0.6 * Math.sin(t * (1.6 + q) + q * 9) + 0.4 * Math.sin(t * 5.1 + q * 20)) - 0.5;      // -1..0
      const h = hh * (0.85 + 0.3 * hash(i, seed + 1));
      if (!D.vis(x, f(x) + 1, Wd + 2)) continue;
      const foot = low(f, x, h * cluster.width / cluster.height * 0.5) - deep + heave * 0.6 + hv * 0.4;
      img(D, ctx, cluster, x, foot, h, { flip: q > 0.5 ? 1 : -1, dark, rot: 0.06 * Math.sin(t * 2.3 + q * 7) });
      img(D, ectx, cluster, x, foot, h, { flip: q > 0.5 ? 1 : -1, alpha: 0.04 * dark, rot: 0.06 * Math.sin(t * 2.3 + q * 7) });
    }
  };
  // single arms between the clusters; the ones near her lean toward her and come up further
  const reachers = (f, every, seed, dark) => {
    if (!singles.length) return;
    for (let i = Math.floor(xa / every) - 1; i * every < xb + every; i++) {
      const q = hash(i, seed); if (q < 0.25) continue;
      const x = i * every + (hash(i, seed + 2) - 0.5) * every * 0.7, im = singles[i & 1], dxp = p.x - x;
      const near = p.dead ? 0 : clamp(1 - Math.abs(dxp) / 7, 0, 1) * clamp(1 - (p.y - f(x)) / 9, 0, 1);
      const h = (1.7 + 1.1 * hash(i, seed + 3)) * (1 + 0.25 * near);
      const grope = Math.sin(t * (2.2 + q * 2) + q * 17);
      const rot = clamp(dxp * 0.05, -0.32, 0.32) * near + 0.12 * (q - 0.5) + 0.05 * grope;
      const foot = Math.min(low(f, x, h * 0.2 + Math.abs(rot) * h * 0.3) - 0.3, f(x) - h * 0.32 + 0.25 * near + 0.12 * grope + hv * 0.3);
      if (!D.vis(x, f(x) + h / 2, h)) continue;
      img(D, ctx, im, x, foot, h, { flip: hash(i, seed + 4) > 0.5 ? 1 : -1, dark, rot });
    }
  };
  // the ground's own marks: clods and stones sitting on a face, threads of root out of it, and the grain of its layers under it
  const dress = (f, seed, tone) => {
    // grain: broken lines along the face at a few depths, fading down into the black
    for (const [dd, v] of [[0.16, 0.75], [0.34, 0.6], [0.58, 0.46], [0.9, 0.32], [1.3, 0.2]]) {
      ctx.strokeStyle = g(v * tone); ctx.lineWidth = lw(0.022);
      for (let x0 = Math.floor(xa / 1.3) * 1.3; x0 < xb; x0 += 1.3) {
        const c = Math.floor(x0 / 1.3), a = x0 + hash(c, seed + dd * 10) * 0.5, b = a + 0.4 + hash(c, seed + dd * 20) * 0.7;
        ctx.beginPath();
        for (let x = a; x <= b; x += 0.12) { const y = f(x) - dd + 0.04 * Math.sin(x * 9 + c); x === a ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)); }
        ctx.stroke();
      }
    }
    // clods and stones on the crest; the earth shrugs them as it comes
    for (let c = Math.floor(xa / CLOD); c * CLOD < xb; c++) {
      const o = clod(c, seed); if (!o) continue;
      const { q, x, sz } = o, stone = hash(c, seed + 3) > 0.86;
      const jig = (0.02 + 0.05 * hv) * Math.sin(t * (7 + q * 5) + c);
      const cx = X(x), cy = Y(f(x) + sz * 0.5 + jig), n = 6, rot = hash(c, seed + 4) * TAU + jig * 3;
      // the hollow it sits in, in shadow
      ctx.fillStyle = g(0.01); ctx.beginPath(); ctx.ellipse(cx + sz * k * 0.15, cy + sz * k * 0.45, sz * k * 1.1, sz * k * 0.5, 0, 0, TAU); ctx.fill();
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const a = rot + j / n * TAU, rr = sz * k * (0.7 + 0.45 * hash(c * 7 + j, seed + 5));
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * (stone ? 0.75 : 0.85);
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = g((stone ? 0.85 : 0.5 + 0.3 * q) * tone); ctx.fill();
      ctx.strokeStyle = g(0.01); ctx.lineWidth = lw(0.028); ctx.stroke();
      // the side the thread lights
      ctx.strokeStyle = g((stone ? 1 : 0.92) * tone); ctx.lineWidth = lw(0.03);
      ctx.beginPath(); ctx.arc(cx, cy, sz * k * 0.55, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
    }
    // roots like hair, and here and there a strand of old yarn, out of the crest
    ctx.lineWidth = lw(0.012);
    for (let x0 = Math.floor(xa / 0.9) * 0.9; x0 < xb; x0 += 0.9) {
      const c = Math.round(x0 / 0.9), q = hash(c, seed + 6); if (q > 0.45) continue;
      const x = x0 + hash(c, seed + 7) * 0.9, y = f(x), len = 0.2 + 0.4 * hash(c, seed + 8), sw = 0.12 * Math.sin(t * 1.3 + c) + (hash(c, seed + 9) - 0.5) * 0.3;
      ctx.strokeStyle = g((q < 0.08 ? 0.85 : 0.55) * tone);
      ctx.beginPath(); ctx.moveTo(X(x), Y(y - 0.05)); ctx.quadraticCurveTo(X(x + sw * 0.4), Y(y + len * 0.6), X(x + sw), Y(y + len)); ctx.stroke();
    }
  };
  const fill = (f, s, crest) => {
    const gr = ctx.createLinearGradient(0, Y(top + 1.2), 0, Y(top - 2.6));
    gr.addColorStop(0, g(crest)); gr.addColorStop(0.3, g(crest * 0.55)); gr.addColorStop(0.7, g(crest * 0.15)); gr.addColorStop(1, g(0));
    ctx.fillStyle = gr; face(ctx, f, s); ctx.fill();
    ctx.strokeStyle = g(Math.min(1, crest * 1.8)); ctx.lineWidth = lw(0.024); face(ctx, f, s); ctx.stroke();
  };
  // back to front
  clusters(ridge, 3.3, 1.7, 0.42, 1.05, 3);
  fill(ridge, 11, 0.24); dress(ridge, 11, 0.7);
  reachers(surf, 2.9, 40, 0.62);
  clusters(surf, 3.0, 0, 0.86, 0.95, 5);
  reachers(surf, 3.7, 60, 0.95);
  fill(surf, 13, 0.42); dress(surf, 13, 1);
  // crumbs fall off the crest, more while it heaves
  if (dt && D.vis(p.x, top, 12)) for (let n = Math.random() < dt * (5 + 18 * hv) ? 1 : 0; n > 0; n--) {
    const x = D.cam[0] + (Math.random() - 0.5) * D.viewW * 0.9;
    D.spawn('grit', x, surf(x) + 0.15, 1, { speed: 0.6, vy: 1.2 + 1.5 * hv, life: 1.2, r: 0.6 + Math.random() });
  }
  // the glow layer sees none of it below the crest
  ectx.save(); ectx.globalCompositeOperation = 'destination-out'; ectx.fillStyle = '#000'; face(ectx, surf, 13); ectx.fill(); ectx.restore();
  // but its crest catches a cold breath of light, so the edge of it can be seen coming
  ectx.save(); ectx.strokeStyle = `rgba(170,180,200,${0.05 + 0.05 * hv})`; ectx.lineWidth = lw(0.02); face(ectx, surf, 13); ectx.stroke(); ectx.restore();
}

// ── what is left of her ──────────────────────────────────────────────────
export function drawRemains(D, ctx, ectx) {
  const w = D.w, f = w.finale, x = L.REMAINS.x;
  if (!D.vis(x, f.y, 6) || w.snuff > 0.6) return;
  const k = D.k, y = w.remainsY, X = D.sx(x), Y = D.sy(y) + 0.04 * k;
  // a small shape under a shawl, face to the floor, one sleeve out toward the dark; spectacles and needles beside it
  ctx.fillStyle = g(0.4); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.022);
  ctx.beginPath(); ctx.moveTo(X - 0.95 * k, Y); ctx.bezierCurveTo(X - 0.9 * k, Y - 0.3 * k, X - 0.6 * k, Y - 0.52 * k, X - 0.2 * k, Y - 0.46 * k);
  ctx.bezierCurveTo(X + 0.2 * k, Y - 0.42 * k, X + 0.8 * k, Y - 0.34 * k, X + 1.15 * k, Y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = g(0.16); ctx.lineWidth = Math.max(0.6, k * 0.012);
  for (let i = 0; i < 12; i++) { const u = i / 12; ctx.beginPath(); ctx.moveTo(X + (-0.8 + u * 1.8) * k, Y - 0.02 * k); ctx.quadraticCurveTo(X + (-0.72 + u * 1.75) * k, Y - 0.2 * k, X + (-0.55 + u * 1.5) * k, Y - (0.46 - u * 0.16) * k); ctx.stroke(); }
  // thin hair, fallen forward
  ctx.strokeStyle = g(0.75, 0.8); ctx.lineWidth = Math.max(0.6, k * 0.012);
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(X - 0.72 * k, Y - 0.3 * k + i * 0.02 * k); ctx.quadraticCurveTo(X - (0.95 + i * 0.03) * k, Y - 0.22 * k, X - (1.0 + i * 0.045) * k, Y - 0.01 * k); ctx.stroke(); }
  // the sleeve, flat, with nothing in it
  ctx.fillStyle = g(0.34); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.02);
  ctx.beginPath(); ctx.moveTo(X - 0.5 * k, Y - 0.12 * k); ctx.lineTo(X - 1.55 * k, Y - 0.07 * k); ctx.lineTo(X - 1.6 * k, Y + 0.01 * k); ctx.lineTo(X - 0.5 * k, Y + 0.02 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
  // spectacles
  ctx.strokeStyle = g(0.85); ctx.lineWidth = Math.max(0.8, k * 0.014);
  for (const s of [0, 0.17]) { ctx.beginPath(); ctx.ellipse(X - (1.95 - s) * k, Y - 0.06 * k, 0.07 * k, 0.06 * k, 0, 0, TAU); ctx.stroke(); }
  ectx.fillStyle = 'rgba(255,230,190,0.25)'; ectx.beginPath(); ectx.arc(X - 1.95 * k, Y - 0.07 * k, 0.03 * k, 0, TAU); ectx.fill();
  ctx.strokeStyle = g(0.7); ctx.lineWidth = Math.max(0.8, k * 0.016);
  ctx.beginPath(); ctx.moveTo(X + 1.3 * k, Y); ctx.lineTo(X + 2.1 * k, Y - 0.05 * k); ctx.moveTo(X + 1.4 * k, Y - 0.07 * k); ctx.lineTo(X + 2.15 * k, Y + 0.01 * k); ctx.stroke();
  // her knitting basket, shut, the lid tied down with a twist of grey yarn
  const BX = D.sx(L.BASKET.x), BY = D.sy(w.remainsY) + 0.04 * k, bw = 0.3 * k, bh = L.BASKET.h * k;
  ctx.fillStyle = g(0.42); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.018);
  ctx.beginPath(); ctx.moveTo(BX - bw * 0.86, BY); ctx.lineTo(BX - bw, BY - bh * 0.86); ctx.lineTo(BX + bw, BY - bh * 0.86); ctx.lineTo(BX + bw * 0.86, BY); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = Math.max(0.6, k * 0.01);
  for (let i = 1; i < 6; i++) { const yy = BY - bh * 0.86 * i / 6, ww = bw * (0.86 + 0.14 * i / 6); ctx.strokeStyle = g(i % 2 ? 0.22 : 0.6); ctx.beginPath(); ctx.moveTo(BX - ww, yy); ctx.lineTo(BX + ww, yy); ctx.stroke(); }      // the weave
  for (let i = -4; i <= 4; i++) { ctx.strokeStyle = g(0.25); ctx.beginPath(); ctx.moveTo(BX + i * bw * 0.2, BY); ctx.lineTo(BX + i * bw * 0.22, BY - bh * 0.86); ctx.stroke(); }
  ctx.fillStyle = g(0.5); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.018);
  ctx.beginPath(); ctx.ellipse(BX, BY - bh * 0.9, bw * 1.04, bh * 0.16, 0, 0, TAU); ctx.fill(); ctx.stroke();      // the lid
  ctx.strokeStyle = g(0.72); ctx.lineWidth = Math.max(0.8, k * 0.014);
  ctx.beginPath(); ctx.moveTo(BX - bw * 0.15, BY - bh * 1.02); ctx.quadraticCurveTo(BX, BY - bh * 0.7, BX + bw * 0.1, BY - bh * 0.4); ctx.stroke();
  ctx.strokeStyle = g(0.75); ctx.beginPath(); ctx.moveTo(BX + bw * 0.55, BY - bh * 0.95); ctx.lineTo(BX + bw * 1.25, BY - bh * 1.35); ctx.stroke();      // a needle out from under the lid
  // her candle
  const CX = D.sx(L.REMAINS.candle), CY = D.sy(w.finale.candleY);
  ctx.fillStyle = g(0.9); ctx.fillRect(CX - 0.06 * k, CY - 0.4 * k, 0.12 * k, 0.4 * k);
  if (w.candleOut !== undefined) {
    const a = Math.max(0, 1 - (w.time - w.candleOut) / 5);
    if (a > 0) { ctx.strokeStyle = g(0.6, a * 0.6); ctx.lineWidth = Math.max(1, 0.02 * k); ctx.beginPath(); ctx.moveTo(CX, CY - 0.42 * k);
      for (let i = 1; i < 8; i++) ctx.lineTo(CX + Math.sin(w.time * 1.3 + i * 0.9) * 0.05 * i * k, CY - (0.42 + i * 0.16) * k); ctx.stroke(); }
    const em = Math.max(0, 1 - (w.time - w.candleOut) / 2.2);
    if (em > 0) { ectx.fillStyle = `rgba(255,90,30,${em})`; ectx.beginPath(); ectx.arc(CX, CY - 0.43 * k, 0.025 * k, 0, TAU); ectx.fill(); }
    return;
  }
  // the flame leans away from the dark, toward her, and shrinks as the thing comes down
  const th = w.thing, low = th ? Math.min(0.6, th.lean || 0) : 0, fl = (1 + Math.sin(D.time * 15) * 0.1) * (1 - low * 0.45), lean = 0.04 + low * 0.1;
  const gr = ectx.createRadialGradient(CX, CY - 0.5 * k, 0, CX, CY - 0.5 * k, 1.5 * k);
  gr.addColorStop(0, `rgba(255,200,120,${0.8 * fl})`); gr.addColorStop(0.15, `rgba(255,140,60,${0.28 * fl})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ectx.fillStyle = gr; ectx.fillRect(CX - 1.5 * k, CY - 2 * k, 3 * k, 3 * k);
  ectx.fillStyle = `rgba(255,220,150,${fl})`; ectx.beginPath(); ectx.ellipse(CX + lean * k, CY - 0.5 * k, 0.04 * k, 0.1 * k * fl, lean * 3, 0, TAU); ectx.fill();
}
