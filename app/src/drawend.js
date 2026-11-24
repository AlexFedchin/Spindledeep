// Drawing for the bottom of the world: the arms that come out of the earth, the people who came when they were called,
// the dark that rises, and the thing that calls. Pictures (assets/art/sprites) are lit tone on nothing, made by
// scripts/art (caller.py, facework.py, cutout.py); the engraving and the lights do the rest, so most of it is never seen.
import * as L from './level.js';
import { clamp, mulberry, smooth, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;
export const SPRITES = ['arm0', 'arm1', 'arms', 'back0', 'back1', 'back2', 'back3', 'front0', 'front1', 'front2', 'front3',
  'crawl', 'crawlhead', 'call0', 'call1', 'call2', 'call3', 'call4', 'call5'];

// the thing's picture is 13 m tall at `scale 1`; places in it, as fractions of the picture (see cutout.py META)
export const THING = { h: 12.4, x: 18.6, aspect: 1.1706, neck: [0.192, 0.29] };

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
    const side = h.i % 2 ? 1 : -1;
    for (let i = 0; i <= 12; i++) {
      const s = i / 12, bow = Math.sin(s * Math.PI) * Math.min(0.7, len * 0.07) * side + Math.sin(t * 5 + s * 5 + h.i) * 0.04 * (h.grab ? 2 : 1) * s;
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
  const r = D.w.deep.rise;
  for (const f of c) {
    if (!D.vis(f.x, f.y + 1, 3)) continue;
    const im = D.img?.[(f.turned ? 'front' : 'back') + f.kind];
    const woke = r.woke ? clamp(r.t * 1.2, 0, 1) : 0;
    const h = f.h * (1 + woke * 0.05 * Math.sin(D.time * 23 + f.x));      // when it wakes they all shake
    img(D, ctx, im, f.x, f.y - 0.06, h, { flip: f.flip, dark: f.tone, rot: f.lean });
    img(D, ectx, im, f.x, f.y - 0.06, h, { flip: f.flip, rot: f.lean, alpha: f.turned ? 0.055 : 0.03 });
  }
}

// ── the dark that rises ──────────────────────────────────────────────────
export function drawDark(D, ctx, ectx) {
  const w = D.w, r = w.deep.rise;
  if (D.cam[1] > -420 || r.level <= r.y0 + 0.05 || !D.vis(60, r.level, 70)) return;
  const k = D.k, top = r.level, t = D.time;
  const xa = Math.max(r.x0, D.cam[0] - D.viewW / 2 - 3), xb = Math.min(r.x1, D.cam[0] + D.viewW / 2 + 3);
  const surf = (x) => top + 0.5 * Math.sin(x * 0.45 + t * 0.8) + 0.3 * Math.sin(x * 1.3 - t * 1.9) - 0.4;
  const im = D.img?.arms;
  // rows of arms, the back one higher and dimmer; each stretch of them heaves on its own
  const rows = (c2, a, dark) => {
    if (!im) return;
    for (const [dx, up, hh, tone] of [[1.7, 1.15, 3.6, 0.5], [0, 0.35, 3.2, 0.9]]) {
      const W = hh * im.width / im.height * 0.92;
      for (let i = Math.floor((xa - dx) / W) - 1; i * W + dx < xb + W; i++) {
        const x = i * W + dx, j = Math.sin(i * 12.9898 + dx) * 43758.5453, f = j - Math.floor(j);
        const heave = 0.45 * Math.sin(t * (1.6 + f) + f * 9) + 0.25 * Math.sin(t * 5.1 + f * 20);
        if (!D.vis(x, surf(x) + 1, W + 2)) continue;
        img(D, c2, im, x, surf(x) + up + heave - 0.9, hh, { flip: f > 0.5 ? 1 : -1, alpha: a, dark: dark ? tone : 1, rot: 0.06 * Math.sin(t * 2.3 + f * 7) });
      }
    }
  };
  rows(ctx, 1, true);
  ectx.save(); rows(ectx, 0.05, false); ectx.restore();
  // below them nothing at all: not even the lines of the engraving
  const below = (c2) => {
    c2.beginPath(); c2.moveTo(D.sx(xa), D.sy(r.y0 - 2));
    for (let x = xa; x <= xb; x += 0.4) c2.lineTo(D.sx(x), D.sy(surf(x) - 0.15 + 0.25 * Math.sin(x * 5.3 + t * 3)));
    c2.lineTo(D.sx(xb), D.sy(r.y0 - 2)); c2.closePath(); c2.fill();
  };
  ctx.fillStyle = g(0); below(ctx);
  ectx.save(); ectx.globalCompositeOperation = 'destination-out'; ectx.fillStyle = '#000'; below(ectx); ectx.restore();
}

// it comes up the far wall after her on all fours, in jerks, never quite in the light
export function drawCrawler(D, ctx, ectx) {
  const c = D.w.deep.crawler;
  if (!c || !c.on || D.cam[1] > -430 || !D.vis(c.x, c.y, 14)) return;
  const im = D.img?.crawl, hd = D.img?.crawlhead, s = 11;
  const tw = 0.05 * Math.sin(D.time * 31) * c.jerk;
  const rot = Math.PI / 2 - 0.12 + tw;
  for (const [cx, a, d] of [[ctx, 1, 0.62], [ectx, 0.05, 1]]) {
    img(D, cx, im, c.x, c.y, s, { rot, ax: 0.5, ay: 0.5, alpha: a, dark: d });
    // the head, hung from the neck, twisted round to look
    const W = s * (im ? im.width / im.height : 1.5), nx = (THING.neck[0] - 0.5) * W, ny = (THING.neck[1] - 0.5) * s;
    const px = c.x + (nx * Math.cos(rot) - ny * Math.sin(rot)), py = c.y - (nx * Math.sin(rot) + ny * Math.cos(rot));
    img(D, cx, hd, px, py, s * 0.24, { rot: rot - 0.9 + c.look * 1.2, ax: 0.78, ay: 0.3, alpha: a, dark: d });
  }
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
  const th = w.thing, low = th ? th.head : 0, fl = (1 + Math.sin(D.time * 15) * 0.1) * (1 - low * 0.45), lean = 0.04 + low * 0.1;
  const gr = ectx.createRadialGradient(CX, CY - 0.5 * k, 0, CX, CY - 0.5 * k, 1.5 * k);
  gr.addColorStop(0, `rgba(255,200,120,${0.8 * fl})`); gr.addColorStop(0.15, `rgba(255,140,60,${0.28 * fl})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ectx.fillStyle = gr; ectx.fillRect(CX - 1.5 * k, CY - 2 * k, 3 * k, 3 * k);
  ectx.fillStyle = `rgba(255,220,150,${fl})`; ectx.beginPath(); ectx.ellipse(CX + lean * k, CY - 0.5 * k, 0.04 * k, 0.1 * k * fl, lean * 3, 0, TAU); ectx.fill();
}

// ── the thing over the gallery ───────────────────────────────────────────
// It has been standing over the place the whole time: what look like pale pillars are its arms and legs. `w.thing`
// { head 0..1 (how far its head has come down), face 0..1 (turned to her), mouth 0..1, lift (a camera-space zoom), gone }
export function thingAt(w) {
  const T = THING, y0 = w.remainsY - 0.12, W = T.h * T.aspect;
  const x0 = T.x - W / 2;
  return { x0, y0, W, nx: x0 + T.neck[0] * W, ny: y0 + T.h * (1 - T.neck[1]) };
}
export function drawThing(D, ctx, ectx) {
  const w = D.w, th = w.thing, f = w.finale;
  if (!th || th.gone || !D.vis(16, f.y + 6, 16)) return;
  const A = thingAt(w), im = D.img?.crawl, t = D.time, k = D.k;
  const breathe = 1 + 0.006 * Math.sin(t * 0.9);
  if (!th.bare) img(D, ctx, im, THING.x, A.y0, THING.h * breathe, { dark: (0.8 + 0.2 * smooth(0.4, 0.9, th.head)) * (1 - 0.85 * (th.only || 0)) });
  if (th.glow && !th.bare) img(D, ectx, im, THING.x, A.y0, THING.h * breathe, { alpha: th.glow * 0.06 });
  // the neck: as long as it needs to be
  const sway = 0.12 * Math.sin(t * 0.7) * (1 - th.face);
  const hx = A.nx + (th.hx - A.nx) * th.head + sway, hy = A.ny + (th.hy - A.ny) * th.head;
  const n = 22, P = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n, bend = Math.sin(s * Math.PI) * (-2.4 * th.head);
    P.push([A.nx + (hx - A.nx) * s + bend, A.ny + (hy - A.ny) * s + Math.sin(s * Math.PI) * 0.5 * th.head]);
  }
  if (th.head > 0.02 && !th.bare) {
    const wd = (s) => (0.62 - 0.22 * Math.sin(s * Math.PI) * th.head + (1 - s) * 0.5 * (1 - s)) * 0.75;
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) / n, [ax, ay] = P[i], [bx, by] = P[i + 1], l = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / l, ny = (bx - ax) / l;
      const w0 = wd(i / n), w1 = wd((i + 1) / n);
      const G = ctx.createLinearGradient(D.sx(ax + nx * w0), D.sy(ay + ny * w0), D.sx(ax - nx * w0), D.sy(ay - ny * w0));
      const v = (0.36 + 0.06 * Math.sin(i * 2.1)) * (1 - 0.6 * (th.only || 0) * (1 - s * s));                         // rings of skin, tendons
      G.addColorStop(0, g(0.02)); G.addColorStop(0.22, g(v * 0.45)); G.addColorStop(0.45, g(v)); G.addColorStop(0.58, g(v * 0.6)); G.addColorStop(0.7, g(v * 0.95)); G.addColorStop(1, g(0.03));
      ctx.fillStyle = G;
      ctx.beginPath(); ctx.moveTo(D.sx(ax + nx * w0), D.sy(ay + ny * w0)); ctx.lineTo(D.sx(bx + nx * w1), D.sy(by + ny * w1)); ctx.lineTo(D.sx(bx - nx * w1), D.sy(by - ny * w1)); ctx.lineTo(D.sx(ax - nx * w0), D.sy(ay - ny * w0)); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = g(v * 0.5); ctx.lineWidth = 0.5; ctx.stroke();
    }
  }
  // the head: hanging in profile until it turns
  const hh = 4.0 * (th.size || 1), prof = 1 - smooth(0.2, 0.65, th.face);
  if (prof > 0) img(D, ctx, D.img?.crawlhead, hx, hy, 2.9, { ax: 0.78, ay: 0.3, alpha: prof, dark: 0.95, rot: 0.25 * th.head + 0.05 * Math.sin(t * 2.2) * th.head });
  if (th.face > 0.2) {
    const a = smooth(0.2, 0.65, th.face), m = clamp(th.mouth, 0, 1) * 5, i = Math.min(4, Math.floor(m)), fr = m - i;
    const j = th.jit ? (Math.random() - 0.5) * 0.06 * th.jit : 0;
    const o = { ax: 0.5, ay: 0.36, rot: 0.04 * Math.sin(t * 1.1) + j, alpha: a };
    img(D, ctx, D.img?.['call' + i], hx + j, hy, hh, o);
    if (fr > 0.02) img(D, ctx, D.img?.['call' + (i + 1)], hx + j, hy, hh, { ...o, alpha: a * fr });
    if (th.glow) { ectx.save(); ectx.globalAlpha = 1; img(D, ectx, D.img?.['call' + Math.round(m)], hx + j, hy, hh, { ...o, alpha: a * th.glow * 0.35 }); ectx.restore(); }
  }
}

// ── coming up the thread ─────────────────────────────────────────────────
// after the two threads are tied. What can be seen of it is arms: each takes hold of the thread ahead, holds that very
// place while the rest is hauled past it, lets go, and reaches over the others for the next. Where they come from there
// is only a place with no light in it. `w.climber` { x, y (its middle), hands: [[x, y, grip 0..1]...], a }
export function drawClimber(D, ctx, ectx) {
  const c = D.w.climber;
  if (!c || !c.hands || !D.vis(c.x, c.y, 18)) return;
  const k = D.k, t = D.time, X = D.sx(c.x), Y = D.sy(c.y), R = 3.6 * k;
  const line = (h, i) => {
    const [hx, hy] = h, dx = hx - c.x, dy = hy - c.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, pts = [];
    const bow = (i % 2 ? 1 : -1) * (0.5 + 0.35 * (i % 3)) * Math.min(1.4, l * 0.28);
    for (let q = 0; q <= 10; q++) { const s = q / 10, b = Math.sin(s * Math.PI) * bow; pts.push([c.x + dx * s + nx * b, c.y + dy * s + ny * b]); }
    return pts;
  };
  c.hands.forEach((h, i) => arm(D, ctx, D.img?.[i % 2 ? 'arm1' : 'arm0'], line(h, i), 1.25, 0.72, 1, 0.9));
  // the dark it comes out of covers the arms from the elbow back
  const G = ctx.createRadialGradient(X, Y, R * 0.2, X, Y, R);
  G.addColorStop(0, g(0, 1)); G.addColorStop(0.62, g(0, 0.98)); G.addColorStop(1, g(0, 0));
  ctx.fillStyle = G; ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.fill();
  ectx.save(); ectx.globalCompositeOperation = 'destination-out';
  const G2 = ectx.createRadialGradient(X, Y, R * 0.2, X, Y, R); G2.addColorStop(0, 'rgba(0,0,0,1)'); G2.addColorStop(0.7, 'rgba(0,0,0,0.9)'); G2.addColorStop(1, 'rgba(0,0,0,0)');
  ectx.fillStyle = G2; ectx.beginPath(); ectx.arc(X, Y, R, 0, TAU); ectx.fill(); ectx.restore();
  // just the hands give back a little light
  c.hands.forEach((h, i) => { const P = line(h, i); arm(D, ectx, D.img?.[i % 2 ? 'arm1' : 'arm0'], P.slice(5), 1.25, 0.72, 0.06); });
}
