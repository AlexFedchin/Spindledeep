// Drawing for the bottom of the world: the arms that come out of the earth, the people who came when they were called,
// the dark that rises, and what is left of her. The thing itself is a real figure (stage.js, figure.js). Pictures (assets/art/sprites) are lit tone on nothing, made by
// scripts/art (caller.py, facework.py, cutout.py); the engraving and the lights do the rest, so most of it is never seen.
import * as L from './level.js';
import { clamp, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;
export const SPRITES = ['arm0', 'arm1', 'arms', 'back0', 'back1', 'back2', 'back3', 'front0', 'front1', 'front2', 'front3'];

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
  const th = w.thing, low = th ? Math.min(0.6, th.lean || 0) : 0, fl = (1 + Math.sin(D.time * 15) * 0.1) * (1 - low * 0.45), lean = 0.04 + low * 0.1;
  const gr = ectx.createRadialGradient(CX, CY - 0.5 * k, 0, CX, CY - 0.5 * k, 1.5 * k);
  gr.addColorStop(0, `rgba(255,200,120,${0.8 * fl})`); gr.addColorStop(0.15, `rgba(255,140,60,${0.28 * fl})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ectx.fillStyle = gr; ectx.fillRect(CX - 1.5 * k, CY - 2 * k, 3 * k, 3 * k);
  ectx.fillStyle = `rgba(255,220,150,${fl})`; ectx.beginPath(); ectx.ellipse(CX + lean * k, CY - 0.5 * k, 0.04 * k, 0.1 * k * fl, lean * 3, 0, TAU); ectx.fill();
}
