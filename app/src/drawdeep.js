// Drawing for the deep (deep.js): ropes and warp threads, heddles and needles, the Hall of Chairs, the old red thread.
// The hands, the called, the dark and the thing at the bottom are in drawend.js.
// Grey tone on the sprite canvas like everything else (the engraving shader lights it); glows on the additive one.
import * as L from './level.js';
import { clamp, mulberry, TAU } from './util.js';
import { SPRITES, drawHands, drawCalled, drawDark, drawCrawler, drawRemains, drawThing, drawClimber } from './drawend.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;
export function loadSprites() {
  const out = {};
  return Promise.all(SPRITES.map((n) => new Promise((res) => {
    const im = new Image();
    // decoded up front and kept as a bitmap: the first draw of a big picture must not hitch in the middle of a scare
    im.onload = () => createImageBitmap(im).then((b) => { out[n] = b; res(); }, () => { out[n] = im; res(); });
    im.onerror = () => res();
    im.src = 'assets/art/sprites/' + n + '.png';
  }))).then(() => out);
}

export function drawDeep(D, ctx, ectx) {
  const w = D.w;
  if (w.climber) drawClimber(D, ctx, ectx);
  if (D.cam[1] > -200) return;
  D._ectx = ectx;
  drawChairs(D, ctx, ectx);
  drawOldThread(D, ctx, ectx);
  drawWarpBack(D, ctx);
  drawCrawler(D, ctx, ectx);
  drawCalled(D, ctx, ectx);
  drawRopes(D, ctx, ectx);
  drawStampers(D, ctx, ectx);
  drawDark(D, ctx, ectx);
  drawThing(D, ctx, ectx);
  drawRemains(D, ctx, ectx);
  drawHands(D, ctx, ectx);
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
  const out = w.hallOut !== undefined, stir = out ? Math.exp(-(w.time - w.hallOut) * 0.25) : 0;       // every chair rocking after it
  for (const c of D.chairRows) if (D.vis(c.x, c.y, 3)) chair(D, ctx, c.x, c.y, c.s, c.tone, Math.sin(t * (0.5 + stir * 2) + c.ph) * 0.02 * (c.row + 1) * (0.6 + stir * 5), true, c.doll);
  // hers, in front: empty, the candle beside it still burning (until something goes past it on the way up)
  const ch = w.chair;
  chair(D, ctx, ch.x, ch.y - 0.05, 1.0, 0.62, Math.sin(t * 0.7) * 0.03, true, false);
  const CX = D.sx(34.2), CY = D.sy(ch.candleY), k = D.k;
  ctx.fillStyle = g(0.9); ctx.fillRect(CX - 0.06 * k, CY - 0.45 * k, 0.12 * k, 0.45 * k);
  if (out) return;
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
