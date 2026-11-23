// Drawing for the deep (deep.js): ropes and warp threads, the hands in the Hush, heddles and needles, the Hall of
// Chairs, the old red thread, the cloth and its faces, the Weaver, and the knitter at the top of the Loom.
// Grey tone on the sprite canvas like everything else (the engraving shader lights it); glows on the additive one.
// Pictures of her (sprites/*.png) are rendered from the old-lady model by scripts/cine/sprites.py.
import * as L from './level.js';
import { clamp, mulberry, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;
export const SPRITES = ['knitter', 'knitter_bow', 'knitter_still', 'face', 'face_shut', 'weaver_l', 'weaver_c', 'weaver_r', 'weaver_scream', 'weaver_shut'];

export function loadSprites() {
  const out = {};
  return Promise.all(SPRITES.map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { out[n] = im; res(); };
    im.onerror = () => res();
    im.src = 'assets/art/sprites/' + n + '.png';
  }))).then(() => out);
}

// a picture of her standing on (x, y) with its foot at the bottom edge, h metres tall; dark multiplies it down
function sprite(D, ctx, im, x, y, h, flip = 1, dark = 1, alpha = 1) {
  if (!im) return false;
  const k = D.k, H = h * k, W = H * im.width / im.height;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(D.sx(x), D.sy(y)); ctx.scale(flip, 1);
  if (dark !== 1) ctx.filter = `brightness(${dark})`;
  ctx.drawImage(im, -W / 2, -H, W, H);
  ctx.restore();
  return true;
}

// the same picture added faintly to the glow layer: the cloth and the faces in it give off a little light of their own
function glow(D, ectx, im, x, y, h, a, flip = 1) {
  if (!im || a <= 0) return;
  const k = D.k, H = h * k, W = H * im.width / im.height;
  ectx.save(); ectx.globalAlpha = a;
  ectx.translate(D.sx(x), D.sy(y)); ectx.scale(flip, 1);
  ectx.drawImage(im, -W / 2, -H, W, H);
  ectx.restore();
}

export function drawDeep(D, ctx, ectx) {
  const w = D.w;
  if (D.cam[1] > -200) return;
  D._ectx = ectx;
  drawChairs(D, ctx, ectx);
  drawOldThread(D, ctx, ectx);
  drawWarpBack(D, ctx);
  drawWeaver(D, ctx, ectx);
  drawCloth(D, ctx, ectx);
  drawRopes(D, ctx, ectx);
  drawStampers(D, ctx, ectx);
  drawHands(D, ctx, ectx);
  drawKnitter(D, ctx, ectx);
}

// ── the Hall of Chairs ───────────────────────────────────────────────────
// a rocking chair seen from the side, with her shawl over it; s = scale, tone = how lit, rock = sway
function chair(D, ctx, x, y, s, tone, rock, shawl = true, doll = false) {
  const k = D.k * s, X = D.sx(x), Y = D.sy(y);
  ctx.save(); ctx.translate(X, Y); ctx.rotate(rock);
  ctx.strokeStyle = g(tone * 0.2); ctx.lineWidth = Math.max(1.2, 0.07 * k);
  ctx.beginPath(); ctx.arc(0, -2.2 * k, 2.25 * k, Math.PI * 0.38, Math.PI * 0.62); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.65 * k, -0.08 * k); ctx.lineTo(-0.55 * k, -0.85 * k); ctx.lineTo(0.6 * k, -0.85 * k); ctx.lineTo(0.65 * k, -0.08 * k);
  ctx.moveTo(0.55 * k, -0.85 * k); ctx.lineTo(0.8 * k, -2.3 * k);
  ctx.moveTo(-0.55 * k, -0.85 * k); ctx.lineTo(-0.35 * k, -1.0 * k);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, 0.04 * k);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0.58 * k + i * 0.04 * k, -0.9 * k - i * 0.28 * k); ctx.lineTo(0.2 * k + i * 0.06 * k, -1.05 * k - i * 0.25 * k); ctx.stroke(); }
  if (shawl) {
    ctx.fillStyle = g(tone * 0.9);
    ctx.beginPath(); ctx.moveTo(-0.5 * k, -0.85 * k); ctx.quadraticCurveTo(0.1 * k, -1.0 * k, 0.62 * k, -1.4 * k);
    ctx.lineTo(0.7 * k, -0.7 * k); ctx.quadraticCurveTo(0.2 * k, -0.4 * k, -0.45 * k, -0.35 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = g(tone * 0.45); ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-0.45 * k + i * 0.2 * k, -0.4 * k + i * 0.02 * k); ctx.lineTo(-0.4 * k + i * 0.2 * k, -0.25 * k + Math.sin(i) * 0.04 * k); ctx.stroke(); }
  }
  if (doll) {
    // a doll left sitting in the chair, head fallen to its chest
    ctx.fillStyle = g(tone * 0.75); ctx.strokeStyle = g(0.03); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0.05 * k, -1.08 * k, 0.2 * k, 0.24 * k, 0.1, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-0.08 * k, -1.42 * k, 0.15 * k, 0.14 * k, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.14 * k, -1.46 * k); ctx.lineTo(-0.06 * k, -1.38 * k); ctx.moveTo(-0.06 * k, -1.46 * k); ctx.lineTo(-0.14 * k, -1.38 * k); ctx.stroke();
  }
  ctx.restore();
}

function drawChairs(D, ctx, ectx) {
  const w = D.w;
  if (!D.vis(28, -240, 30)) return;
  const t = D.time, T = w.T;
  if (!D.chairRows) {
    // three rows, the back ones smaller and darker so the hall reads deep; one in four keeps a doll in its lap
    const r = mulberry(41), rows = [];
    for (const [row, s, tone, x0, x1, step] of [[2, 0.55, 0.22, 9, 41, 1.6], [1, 0.75, 0.34, 10, 41, 2.1], [0, 1.0, 0.5, 11, 40, 2.9]]) {
      for (let x = x0; x <= x1; x += step * (0.85 + r() * 0.3)) {
        if (row === 0 && Math.abs(x - L.CHAIR.x) < 2.2) continue;
        const gy = T.ground(x, -240, 12);
        if (gy === null) continue;
        rows.push({ x, y: gy - 0.04 + row * 0.25, s, tone, ph: r() * 6, doll: r() < 0.25, row });
      }
    }
    D.chairRows = rows.sort((a, b) => b.row - a.row);
  }
  for (const c of D.chairRows) if (D.vis(c.x, c.y, 3)) chair(D, ctx, c.x, c.y, c.s, c.tone, Math.sin(t * 0.5 + c.ph) * 0.02 * (c.row + 1) * 0.6, true, c.doll);
  // hers, in front: empty, the candle beside it still burning
  const ch = w.chair;
  chair(D, ctx, ch.x, ch.y - 0.05, 1.0, 0.62, Math.sin(t * 0.7) * 0.03, true, false);
  const CX = D.sx(34.2), CY = D.sy(ch.candleY), k = D.k;
  ctx.fillStyle = g(0.9); ctx.fillRect(CX - 0.06 * k, CY - 0.45 * k, 0.12 * k, 0.45 * k);
  const fl = 1 + Math.sin(D.time * 15) * 0.1;
  const gr = ectx.createRadialGradient(CX, CY - 0.55 * k, 0, CX, CY - 0.55 * k, 1.5 * k);
  gr.addColorStop(0, `rgba(255,200,120,${0.85 * fl})`); gr.addColorStop(0.15, `rgba(255,140,60,${0.3 * fl})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ectx.fillStyle = gr; ectx.fillRect(CX - 1.5 * k, CY - 2.05 * k, 3 * k, 3 * k);
  ectx.fillStyle = `rgba(255,220,150,${fl})`; ectx.beginPath(); ectx.ellipse(CX, CY - 0.55 * k, 0.04 * k, 0.1 * k * fl, 0, 0, TAU); ectx.fill();
}

// the faded red thread of a doll that came down seventy winters ago (memory m9 is knotted in it)
const OLD = [[55.5, -365.85], [58.5, -365.85], [61.4, -365.85], [64.5, -365.9], [67.2, -366.1], [69.7, -364], [69.8, -360.5], [70.6, -358.15], [76, -358.15], [86, -358.15]];
function drawOldThread(D, ctx, ectx) {
  if (!D.vis(70, -362, 20)) return;
  ctx.strokeStyle = g(0.3); ctx.lineWidth = Math.max(1, D.k * 0.014);
  ctx.beginPath();
  OLD.forEach(([x, y], i) => (i ? ctx.lineTo(D.sx(x), D.sy(y + Math.sin(x * 3.1) * 0.02)) : ctx.moveTo(D.sx(x), D.sy(y))));
  ctx.stroke();
  ectx.strokeStyle = 'rgba(140,40,30,0.35)'; ectx.lineWidth = 1.2;
  ectx.beginPath();
  OLD.forEach(([x, y], i) => (i ? ectx.lineTo(D.sx(x), D.sy(y)) : ectx.moveTo(D.sx(x), D.sy(y))));
  ectx.stroke();
}

// ── ropes and warp threads ───────────────────────────────────────────────
function ropeTop(D, r) {
  if (r.top === undefined) { let y = r.y1; for (let k = 0; k < 400 && D.w.T.d(r.x, y) > 0; k++) y += 0.25; r.top = y; }
  return r.top;
}
function drawWarpBack(D, ctx) {
  // the Loom's warp: hundreds of threads from the roof to the cloth, behind everything
  if (!D.vis(60, -492, 70) || D.cam[1] > -420) return;
  const k = D.k, lvl = D.w.deep.rise.level;
  ctx.lineWidth = Math.max(0.6, k * 0.008);
  for (let x = 6.5; x < 114; x += 1.55) {
    if (Math.abs(x - D.cam[0]) > D.viewW / 2 + 2) continue;
    const top = -430 - 18 * (1 - ((x - 60) / 56) ** 2) ** 0.5 * 0 - Math.abs(x - 60) * 0.5;
    ctx.strokeStyle = g(0.18 + 0.06 * Math.sin(x * 2.3));
    ctx.beginPath(); ctx.moveTo(D.sx(x), D.sy(Math.min(top, -432))); ctx.lineTo(D.sx(x + Math.sin(D.time * 0.3 + x) * 0.03), D.sy(lvl)); ctx.stroke();
  }
}
function drawRopes(D, ctx, ectx) {
  const k = D.k;
  for (const r of D.w.deep.ropes) {
    const top = ropeTop(D, r);
    if (!D.vis(r.x, (top + r.y0) / 2, (top - r.y0) / 2 + 4)) continue;
    const p = D.w.player, held = p.climb === r;
    const bend = (y) => (held ? Math.exp(-Math.abs(y - p.y) * 0.6) * 0.06 * Math.sin(D.time * 6) : 0) + Math.sin(D.time * 0.6 + y * 0.2 + r.i) * 0.04;
    if (r.warp) {
      // a warp thread: taut, pale, a little red where she has held it
      ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1.6, k * 0.05);
      ctx.beginPath(); ctx.moveTo(D.sx(r.x), D.sy(top)); ctx.lineTo(D.sx(r.x + bend(r.y0)), D.sy(r.y0 - 0.2)); ctx.stroke();
      ctx.strokeStyle = g(0.72); ctx.lineWidth = Math.max(0.8, k * 0.02); ctx.stroke();
    } else {
      // a hemp rope with knots every metre
      ctx.strokeStyle = g(0.05); ctx.lineWidth = Math.max(2, k * 0.09);
      ctx.beginPath(); ctx.moveTo(D.sx(r.x), D.sy(top));
      for (let y = top; y > r.y0 - 0.3; y -= 0.5) ctx.lineTo(D.sx(r.x + bend(y)), D.sy(y));
      ctx.stroke();
      ctx.strokeStyle = g(0.5); ctx.lineWidth = Math.max(1, k * 0.035); ctx.stroke();
      ctx.fillStyle = g(0.45);
      for (let y = r.y1; y > r.y0; y -= 1.0) { ctx.beginPath(); ctx.ellipse(D.sx(r.x + bend(y)), D.sy(y), 0.08 * k, 0.06 * k, 0, 0, TAU); ctx.fill(); }
    }
    // a pale breath along the rope so it can be found in the dark
    const near = Math.abs(p.x - r.x) < 5 && p.y > r.y0 - 3 && p.y < r.y1 + 3;
    ectx.strokeStyle = `rgba(220,215,200,${near ? 0.14 : 0.06})`; ectx.lineWidth = 2;
    ectx.beginPath(); ectx.moveTo(D.sx(r.x), D.sy(r.y1 + 1)); ectx.lineTo(D.sx(r.x), D.sy(r.y0)); ectx.stroke();
  }
}

// ── the hands ────────────────────────────────────────────────────────────
function drawHands(D, ctx, ectx) {
  const k = D.k, t = D.time;
  for (const h of D.w.deep.hands) {
    if (!D.vis(h.ax, h.ay, h.reach + 2)) continue;
    const L = h.ext, X0 = D.sx(h.ax), Y0 = D.sy(h.ay);
    // where it waits: a puckered seam in the cloth of the wall, faintly stirring
    ctx.fillStyle = g(0.32); ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1, k * 0.02);
    const stir = 0.03 * Math.sin(t * 1.3 + h.i);
    ctx.beginPath(); ctx.ellipse(X0, Y0, (0.32 + stir) * k, 0.16 * k, Math.atan2(-h.ny, h.nx) + Math.PI / 2, 0, TAU); ctx.fill(); ctx.stroke();
    if (L < 0.08) continue;
    const ux = (h.tx - h.ax) / L, uy = (h.ty - h.ay) / L, nx = -uy, ny = ux;
    // the sleeve: a long knitted tube that sags a little, thinner toward the wrist
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const s = i / 14, sag = Math.sin(s * Math.PI) * Math.min(0.5, L * 0.06) + Math.sin(t * 3 + s * 6 + h.i) * 0.03;
      pts.push([h.ax + ux * L * s + nx * sag, h.ay + uy * L * s + ny * sag - Math.sin(s * Math.PI) * Math.min(0.3, L * 0.03)]);
    }
    const wd = (s) => (0.24 - s * 0.1) * k;
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const s = i / 14; const X = D.sx(x + nx * wd(s) / k), Y = D.sy(y + ny * wd(s) / k); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
    for (let i = 14; i >= 0; i--) { const s = i / 14, [x, y] = pts[i]; ctx.lineTo(D.sx(x - nx * wd(s) / k), D.sy(y - ny * wd(s) / k)); }
    ctx.closePath(); ctx.fillStyle = g(0.5); ctx.fill(); ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1, k * 0.025); ctx.stroke();
    // a cold rim along the sleeve so a reaching arm reads in the dark (like the brambles' glints)
    ectx.strokeStyle = `rgba(190,198,225,${0.16 * Math.min(1, L / 2)})`; ectx.lineWidth = Math.max(1.5, k * 0.05);
    ectx.beginPath(); pts.forEach(([x, y], i) => (i ? ectx.lineTo(D.sx(x), D.sy(y)) : ectx.moveTo(D.sx(x), D.sy(y)))); ectx.stroke();
    ctx.strokeStyle = g(0.3); ctx.lineWidth = Math.max(0.6, k * 0.01);
    for (let i = 1; i < 14; i++) {
      const s = i / 14, [x, y] = pts[i];
      ctx.beginPath(); ctx.moveTo(D.sx(x + nx * wd(s) / k * 0.9), D.sy(y + ny * wd(s) / k * 0.9)); ctx.lineTo(D.sx(x - nx * wd(s) / k * 0.9), D.sy(y - ny * wd(s) / k * 0.9)); ctx.stroke();
    }
    // the hand: a mitten of grey wool with long fingers, open while it reaches, shut when it has her
    const [hx, hy] = pts[14], HX = D.sx(hx), HY = D.sy(hy), a = Math.atan2(-uy, ux);
    ctx.save(); ctx.translate(HX, HY); ctx.rotate(a);
    ctx.fillStyle = g(0.55); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.02);
    ctx.beginPath(); ctx.ellipse(0.12 * k, 0, 0.16 * k, 0.13 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
    const open = h.grab ? 0.1 : 0.55 + 0.2 * Math.sin(t * 7 + h.i);
    for (let f = 0; f < 4; f++) {
      const fa = (f - 1.5) * 0.28 * open;
      const l = (0.34 + (f === 1 || f === 2 ? 0.08 : 0)) * k;
      ctx.beginPath(); ctx.moveTo(0.2 * k, (f - 1.5) * 0.06 * k);
      ctx.quadraticCurveTo(0.2 * k + Math.cos(fa) * l * 0.6, (f - 1.5) * 0.06 * k + Math.sin(fa) * l * 0.6 + 0.05 * k * (1 - open),
        0.2 * k + Math.cos(fa) * l * (h.grab ? 0.5 : 1), (f - 1.5) * 0.06 * k + Math.sin(fa) * l + (h.grab ? 0.12 * k : 0));
      ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1.5, k * 0.06); ctx.stroke();
      ctx.strokeStyle = g(0.58); ctx.lineWidth = Math.max(0.8, k * 0.035); ctx.stroke();
    }
    ctx.restore();
    ectx.fillStyle = `rgba(190,195,215,${0.08 * Math.min(1, L)})`; ectx.beginPath(); ectx.arc(HX, HY, 0.5 * k, 0, TAU); ectx.fill();
  }
}

// ── heddles and needles ──────────────────────────────────────────────────
function drawStampers(D, ctx, ectx) {
  const k = D.k, w = D.w;
  for (const s of w.deep.stampers) {
    const [x0, y0, x1, y1] = w.deep.swept(s);
    if (!D.vis((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2 + 3)) continue;
    const jit = s.shake * 0.05 * Math.sin(D.time * 60 + s.i);
    if (s.kind === 'heddle') {
      // a heavy frame of timber strung with wire heddles, hung from the roof on chains
      const ex = s.dist * s.f, bot = s.r[1] - ex, top = s.r[3];
      let roof = top; for (let i = 0; i < 80 && w.T.d((x0 + x1) / 2, roof) > 0; i++) roof += 0.25;
      ctx.strokeStyle = g(0.1); ctx.lineWidth = Math.max(1, k * 0.03);
      for (const cx of [x0 + 0.3, x1 - 0.3]) for (let y = top + 0.2; y < roof; y += 0.24) { ctx.beginPath(); ctx.ellipse(D.sx(cx + jit), D.sy(y), 0.04 * k, 0.09 * k, 0, 0, TAU); ctx.stroke(); }
      const X0 = D.sx(x0 + jit), X1 = D.sx(x1 + jit), YT = D.sy(top + 0.6), YB = D.sy(bot);
      ctx.fillStyle = g(0.3); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.025);
      ctx.fillRect(X0, YT, X1 - X0, 0.35 * k); ctx.strokeRect(X0, YT, X1 - X0, 0.35 * k);
      ctx.fillRect(X0, YB - 0.45 * k, X1 - X0, 0.45 * k); ctx.strokeRect(X0, YB - 0.45 * k, X1 - X0, 0.45 * k);
      ctx.fillRect(X0, YT, 0.22 * k, YB - YT); ctx.fillRect(X1 - 0.22 * k, YT, 0.22 * k, YB - YT);
      ectx.strokeStyle = `rgba(200,190,170,${0.12 + 0.25 * s.shake})`; ectx.lineWidth = Math.max(1.2, k * 0.03);
      ectx.strokeRect(X0, YT, X1 - X0, YB - YT);
      ctx.strokeStyle = g(0.6); ctx.lineWidth = Math.max(0.6, k * 0.008);
      for (let x = x0 + 0.35; x < x1 - 0.3; x += 0.13) { ctx.beginPath(); ctx.moveTo(D.sx(x + jit), YT + 0.35 * k); ctx.lineTo(D.sx(x + jit), YB - 0.45 * k); ctx.stroke(); }
      if (s.shake > 0) for (let i = 0; i < 2; i++) if (Math.random() < s.shake * 0.4) D.spawn('puff', x0 + Math.random() * (x1 - x0), top - 0.2, 1, { speed: 0.3, vy: -1.5, life: 0.8, r: 0.6 });
    } else {
      // a knitting needle as long as a house, sliding out of the cloth wall
      const e = s.dist * s.f, yc = (s.r[1] + s.r[3]) / 2, xs = s.r[0], xt = s.r[2] + e + jit;
      ctx.fillStyle = g(0.62); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.02);
      ctx.beginPath(); ctx.moveTo(D.sx(xs), D.sy(yc + 0.16)); ctx.lineTo(D.sx(xt - 0.9), D.sy(yc + 0.12)); ctx.lineTo(D.sx(xt), D.sy(yc));
      ctx.lineTo(D.sx(xt - 0.9), D.sy(yc - 0.12)); ctx.lineTo(D.sx(xs), D.sy(yc - 0.16)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = g(0.9); ctx.lineWidth = Math.max(0.6, k * 0.012);
      ctx.beginPath(); ctx.moveTo(D.sx(xs), D.sy(yc + 0.08)); ctx.lineTo(D.sx(xt - 0.6), D.sy(yc + 0.05)); ctx.stroke();
      if (s.shake > 0 || s.f > 0) {
        ectx.fillStyle = `rgba(230,235,255,${0.25 * Math.max(s.shake, s.f)})`;
        ectx.beginPath(); ectx.arc(D.sx(xt), D.sy(yc), 0.35 * k, 0, TAU); ectx.fill();
      }
    }
  }
}

// ── the cloth, its faces, the Weaver ─────────────────────────────────────
function face(D, ctx, x, y, h, shut, tone) {
  const im = D.img?.[shut ? 'face_shut' : 'face'];
  if (sprite(D, ctx, im, x, y - h * 0.35, h, 1, tone)) { glow(D, D._ectx, im, x, y - h * 0.35, h, shut ? 0.02 : 0.05); return; }
  const k = D.k, X = D.sx(x), Y = D.sy(y), r = h * 0.45 * k;
  ctx.fillStyle = g(0.5 * tone); ctx.beginPath(); ctx.ellipse(X, Y, r * 0.8, r, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = g(0.04);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(X + s * r * 0.32, Y - r * 0.1, r * 0.13, shut ? r * 0.03 : r * 0.1, 0, 0, TAU); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(X, Y + r * 0.45, r * 0.18, shut ? r * 0.03 : r * 0.12, 0, 0, TAU); ctx.fill();
}
function drawCloth(D, ctx, ectx) {
  const w = D.w, r = w.deep.rise;
  if (!D.vis(60, r.level, 30) || D.cam[1] > -420) return;
  const k = D.k, top = r.level, shut = !!w.ending?.cut;
  const xa = Math.max(r.x0, D.cam[0] - D.viewW / 2 - 2), xb = Math.min(r.x1, D.cam[0] + D.viewW / 2 + 2);
  const surf = (x) => top + 0.25 * Math.sin(x * 0.7 + D.time * 0.9) + 0.12 * Math.sin(x * 2.1 - D.time * 1.7) * (r.on ? 1 : 0.3);
  if (top > r.y0 + 0.05) {
    // the risen cloth: a heaving mass of weave down to the floor
    ctx.beginPath(); ctx.moveTo(D.sx(xa), D.sy(r.y0 - 1));
    for (let x = xa; x <= xb; x += 0.5) ctx.lineTo(D.sx(x), D.sy(surf(x)));
    ctx.lineTo(D.sx(xb), D.sy(r.y0 - 1)); ctx.closePath();
    ctx.fillStyle = g(0.32); ctx.fill();
    ctx.strokeStyle = g(0.2); ctx.lineWidth = Math.max(0.6, k * 0.012);
    for (let y = top - 0.3; y > Math.max(r.y0, D.cam[1] - D.viewH / 2 - 1); y -= 0.32) {
      ctx.beginPath(); ctx.moveTo(D.sx(xa), D.sy(y));
      for (let x = xa; x <= xb; x += 1) ctx.lineTo(D.sx(x), D.sy(y + 0.06 * Math.sin(x * 3 + y * 7)));
      ctx.stroke();
    }
    ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1.5, k * 0.04);
    ctx.beginPath(); for (let x = xa; x <= xb; x += 0.5) (x === xa ? ctx.moveTo(D.sx(x), D.sy(surf(x))) : ctx.lineTo(D.sx(x), D.sy(surf(x)))); ctx.stroke();
  }
  // faces in the weave, along its surface: all the same face
  for (let x = Math.ceil(xa / 3.4) * 3.4; x < xb; x += 3.4) {
    const j = Math.round(x / 3.4), y = surf(x) - 0.55 - (j % 2) * 0.5;
    face(D, ctx, x + Math.sin(j * 1.7) * 0.6, y, 1.2 - (j % 3) * 0.15, shut || (j % 5 === 0 && !r.on), 0.85);
  }
}
function drawWeaver(D, ctx, ectx) {
  const w = D.w, r = w.deep.rise;
  if (!r.woke || D.cam[1] > -420) return;
  const p = w.player, t = D.time;
  // she rises out of the cloth on the far side of the Loom, as high as the cloth has come
  const x = 74, y = r.level - 8, h = 40;
  const ending = w.ending, shut = !!ending?.cut;
  const look = p.x < x - 25 ? 'weaver_l' : p.x > x + 6 ? 'weaver_r' : 'weaver_c';
  const scream = r.on && (r.t < 3.0 || (r.t % 11) < 1.2);
  const im = D.img?.[shut ? 'weaver_shut' : scream ? 'weaver_scream' : look];
  const sink = shut ? Math.min(1, (ending.t - 4) / 10) : 0;
  glow(D, ectx, im, x, y - sink * h * 0.7, h, (0.045 + 0.02 * Math.sin(t * 0.7)) * (1 - Math.max(0, sink)));
  if (!sprite(D, ctx, im, x, y - sink * h * 0.7, h, 1, 0.9, 1 - Math.max(0, sink) * 0.8)) {
    // stand-in: a vast pale head
    const k = D.k;
    ctx.fillStyle = g(0.35); ctx.beginPath(); ctx.ellipse(D.sx(x), D.sy(y + h * 0.55), h * 0.3 * k, h * 0.4 * k, 0, 0, TAU); ctx.fill();
  }
}

// ── her, at the top ──────────────────────────────────────────────────────
function drawKnitter(D, ctx, ectx) {
  const w = D.w, f = w.finale;
  if (!D.vis(f.x, f.y, 6)) return;
  const k = D.k, e = w.ending;
  const name = e && !e.cut && e.t > 3 ? 'knitter_bow' : e && e.cut && e.t > 6 ? 'knitter_still' : 'knitter';
  // woven in to the waist: the picture stands in the cloth hanging off the beam, the lower half lost in the weave
  const x = f.x - 1.5, y = f.y - 0.9;
  glow(D, ectx, D.img?.[name], x, y, 2.6, w.candleOut !== undefined ? 0.03 : 0.08);
  if (!sprite(D, ctx, D.img?.[name], x, y, 2.6, 1, 1.15)) {
    ctx.fillStyle = g(0.45); ctx.beginPath(); ctx.ellipse(D.sx(x), D.sy(y + 1.3), 0.35 * k, 0.6 * k, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(D.sx(x), D.sy(y + 2.0), 0.2 * k, 0, TAU); ctx.fill();
  }
  // the cloth she is woven into, hanging down the face of the beam
  ctx.fillStyle = g(0.36); ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1, k * 0.02);
  ctx.beginPath(); ctx.moveTo(D.sx(x - 1.0), D.sy(y + 0.95));
  ctx.quadraticCurveTo(D.sx(x), D.sy(y + 1.15), D.sx(x + 1.0), D.sy(y + 0.95));
  ctx.lineTo(D.sx(x + 1.4), D.sy(y - 6.5)); ctx.lineTo(D.sx(x - 1.6), D.sy(y - 6.5)); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = g(0.22); ctx.lineWidth = Math.max(0.6, k * 0.01);
  for (let yy = y + 0.8; yy > y - 6.4; yy -= 0.25) { ctx.beginPath(); ctx.moveTo(D.sx(x - 1.1), D.sy(yy)); ctx.lineTo(D.sx(x + 1.1), D.sy(yy - 0.04)); ctx.stroke(); }
  // her candle on the beam
  const CX = D.sx(19), CY = D.sy(f.candleY);
  ctx.fillStyle = g(0.9); ctx.fillRect(CX - 0.06 * k, CY - 0.45 * k, 0.12 * k, 0.45 * k);
  if (w.candleOut !== undefined) {
    const a = Math.max(0, 1 - (w.time - w.candleOut) / 6);
    if (a > 0) { ctx.strokeStyle = g(0.6, a * 0.6); ctx.lineWidth = Math.max(1, 0.02 * k); ctx.beginPath(); ctx.moveTo(CX, CY - 0.47 * k);
      for (let i = 1; i < 8; i++) ctx.lineTo(CX + Math.sin(w.time * 1.3 + i * 0.9) * 0.05 * i * k, CY - (0.47 + i * 0.16) * k); ctx.stroke(); }
    return;
  }
  const fl = 1 + Math.sin(D.time * 15) * 0.1;
  const gr = ectx.createRadialGradient(CX, CY - 0.55 * k, 0, CX, CY - 0.55 * k, 1.5 * k);
  gr.addColorStop(0, `rgba(255,200,120,${0.85 * fl})`); gr.addColorStop(0.15, `rgba(255,140,60,${0.3 * fl})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ectx.fillStyle = gr; ectx.fillRect(CX - 1.5 * k, CY - 2.05 * k, 3 * k, 3 * k);
  ectx.fillStyle = `rgba(255,220,150,${fl})`; ectx.beginPath(); ectx.ellipse(CX, CY - 0.55 * k, 0.04 * k, 0.1 * k * fl, 0, 0, TAU); ectx.fill();
}
