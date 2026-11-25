// The shelves of the upper ways (level.js SHELVES): what they hang by. The rock of each is in the terrain; here the roots that
// grew round it (the Root Gardens) or the yarn and the chair seat it is made of (the Hall of Chairs), and a pale edge so it can
// be found in the dark. Drawn behind the doll.
import * as L from './level.js';
import { mulberry, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;

function make(T) {
  const r = mulberry(77);
  return L.SHELVES.map(([x0, x1, y, kind]) => {
    const roof = (x) => { let t = y + 0.4; for (let k = 0; k < 400 && T.d(x, t) > 0; k++) t += 0.1; return t; };
    const c = (x0 + x1) / 2, w = x1 - x0, hang = [];
    if (kind === 'root') {
      for (let q = 0; q < 4; q++) {
        const s = q < 2 ? (q ? 1 : -1) : 0, bx = c + (q < 2 ? s * w * 0.5 : (r() - 0.5) * w * 0.8), tx = bx + (r() - 0.5) * 2.6 + s * 0.5;
        hang.push({ bx, by: y - 0.1 - r() * 0.3, tx, ty: roof(tx) + 0.4, w: 0.05 + r() * 0.09, b: (r() - 0.5) * 1.6, under: r() * 0.6 + 0.25, dir: s || (r() < 0.5 ? 1 : -1) });
      }
    } else {
      const ty = roof(c) + 0.3;
      hang.push({ c, knot: Math.min(ty - 0.5, y + 2.6 + r() * 0.8), ty, sway: r() * 6 });
    }
    return { x0, x1, y, kind, c, w, hang, tassels: Array.from({ length: 7 }, () => [x0 + r() * w, 0.15 + r() * 0.5]), rock: (r() - 0.5) * 0.1 };
  });
}

// a twisted yarn between two points
function strand(D, ctx, x0, y0, x1, y1) {
  const k = D.k, X = (x) => D.sx(x), Y = (y) => D.sy(y);
  for (const [lw, tone] of [[0.085, 0.03], [0.055, 0.5]]) { ctx.strokeStyle = g(tone); ctx.lineWidth = Math.max(1, lw * k); ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke(); }
  const L0 = Math.hypot(x1 - x0, y1 - y0), n = Math.min(90, Math.floor(L0 / 0.16)), ux = (x1 - x0) / L0, uy = (y1 - y0) / L0;
  ctx.strokeStyle = g(0.14); ctx.lineWidth = Math.max(0.6, 0.012 * k); ctx.beginPath();
  for (let q = 1; q < n; q++) {
    const a = q / n, px = x0 + (x1 - x0) * a, py = y0 + (y1 - y0) * a;
    ctx.moveTo(X(px - uy * 0.03 - ux * 0.03), Y(py + ux * 0.03 - uy * 0.03)); ctx.lineTo(X(px + uy * 0.03 + ux * 0.03), Y(py - ux * 0.03 + uy * 0.03));
  }
  ctx.stroke();
}

export function drawShelves(D, ctx, ectx) {
  const k = D.k, t = D.time;
  D.shelves ||= make(D.w.T);
  const X = (x) => D.sx(x), Y = (y) => D.sy(y);
  for (const s of D.shelves) {
    const tall = s.hang[0].ty;
    if (!D.vis(s.c, (s.y + tall) / 2, (tall - s.y) / 2 + 3)) continue;
    if (s.kind === 'root') {
      // the stone itself: a flat slab, worn at the ends
      ctx.fillStyle = g(0.46); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, 0.022 * k);
      ctx.beginPath(); ctx.moveTo(X(s.x0 + 0.04), Y(s.y - 0.2)); ctx.quadraticCurveTo(X(s.x0 + 0.04), Y(s.y), X(s.x0 + 0.3), Y(s.y)); ctx.lineTo(X(s.x1 - 0.3), Y(s.y)); ctx.quadraticCurveTo(X(s.x1 - 0.04), Y(s.y), X(s.x1 - 0.04), Y(s.y - 0.2));
      ctx.quadraticCurveTo(X(s.x1 - 0.1), Y(s.y - 0.5), X(s.x1 - 0.5), Y(s.y - 0.5)); ctx.lineTo(X(s.x0 + 0.4), Y(s.y - 0.54)); ctx.quadraticCurveTo(X(s.x0 + 0.06), Y(s.y - 0.5), X(s.x0 + 0.04), Y(s.y - 0.2)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = g(0.16); ctx.lineWidth = Math.max(0.7, 0.012 * k);
      for (let q = 0; q < 3; q++) { const yy = s.y - 0.14 - q * 0.13; ctx.beginPath(); ctx.moveTo(X(s.x0 + 0.1 + q * 0.17), Y(yy)); ctx.quadraticCurveTo(X(s.c), Y(yy - 0.03), X(s.x1 - 0.5 + q * 0.14), Y(yy + 0.02)); ctx.stroke(); }
      for (const h of s.hang) {
        const mx = (h.bx + h.tx) / 2 + h.b + Math.sin(t * 0.4 + h.bx) * 0.05, my = (h.by + h.ty) / 2;
        for (const [lw, tone] of [[h.w * 2 + 0.05, 0.04], [h.w * 2, 0.3], [h.w * 0.5, 0.48]]) {
          ctx.strokeStyle = g(tone); ctx.lineWidth = Math.max(1, lw * k);
          ctx.beginPath(); ctx.moveTo(X(h.tx), Y(h.ty)); ctx.quadraticCurveTo(X(mx), Y(my), X(h.bx), Y(h.by));
          // it goes on round the stone and lets a tail hang
          ctx.quadraticCurveTo(X(h.bx - h.dir * 0.1), Y(s.y - 0.6), X(h.bx - h.dir * 0.35), Y(s.y - 0.62 - h.under));
          ctx.stroke();
        }
      }
      ctx.strokeStyle = g(0.2); ctx.lineWidth = Math.max(0.8, k * 0.02);
      for (const [x, l] of s.tassels) { ctx.beginPath(); ctx.moveTo(X(x), Y(s.y - 0.5)); ctx.quadraticCurveTo(X(x + 0.08), Y(s.y - 0.5 - l * 0.5), X(x - 0.05 + Math.sin(t + x) * 0.03), Y(s.y - 0.5 - l)); ctx.stroke(); }
    } else {
      // two ends of yarn from the seat to a knot, and one twisted strand from there to the roof
      const h = s.hang[0], hx = h.c + Math.sin(t * 0.5 + h.sway) * 0.03;
      strand(D, ctx, hx, h.knot, h.c, h.ty);
      for (const e of [-1, 1]) strand(D, ctx, s.c + e * (s.w / 2 - 0.12), s.y - 0.25, hx, h.knot);
      ctx.fillStyle = g(0.5); ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1, 0.02 * k);
      ctx.beginPath(); ctx.ellipse(X(hx), Y(h.knot), 0.12 * k, 0.15 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // the seat: boards and one rocker of a chair, with the fringe of the shawl that was on it
      ctx.fillStyle = g(0.34);
      ctx.fillRect(X(s.x0 - 0.1), Y(s.y + 0.01), (s.w + 0.2) * k, 0.2 * k); ctx.strokeRect(X(s.x0 - 0.1), Y(s.y + 0.01), (s.w + 0.2) * k, 0.2 * k);
      ctx.strokeStyle = g(0.05);
      for (let q = 1; q < 5; q++) { const x = X(s.x0 + s.w * q / 5); ctx.beginPath(); ctx.moveTo(x, Y(s.y + 0.01)); ctx.lineTo(x, Y(s.y - 0.19)); ctx.stroke(); }
      ctx.strokeStyle = g(0.24); ctx.lineWidth = Math.max(1.4, 0.07 * k);
      ctx.beginPath(); ctx.arc(X(s.c), Y(s.y + 1.1), 1.85 * k, Math.PI * 0.33 + s.rock, Math.PI * 0.67 + s.rock); ctx.stroke();
      ctx.strokeStyle = g(0.4); ctx.lineWidth = Math.max(0.8, 0.02 * k);
      for (const [x, l] of s.tassels) { ctx.beginPath(); ctx.moveTo(X(x), Y(s.y - 0.16)); ctx.quadraticCurveTo(X(x + 0.04), Y(s.y - 0.16 - l * 0.4), X(x + Math.sin(t * 1.1 + x * 3) * 0.04), Y(s.y - 0.16 - l * 0.75)); ctx.stroke(); }
    }
    // the edge, just enough to be seen across the dark
    const gr = ectx.createLinearGradient(X(s.x0), 0, X(s.x1), 0);
    gr.addColorStop(0, 'rgba(200,205,220,0)'); gr.addColorStop(0.5, 'rgba(200,205,220,0.15)'); gr.addColorStop(1, 'rgba(200,205,220,0)');
    ectx.fillStyle = gr; ectx.fillRect(X(s.x0), Y(s.y + 0.05), s.w * k, Math.max(2, 0.09 * k));
  }
}
