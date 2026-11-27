// Drawing for kindle.js: the seats, and what stands in the two quiet places (the Orchard's
// trees, which hang from the roof by their roots' other ends; the Long Room's lines of cloth, which turn as she goes by).
import * as L from './level.js';
import { clamp, mulberry, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;

function make(T) {
  const r = mulberry(404), trees = [], cloths = [];
  const roof = (x, y) => { let t = y; for (let k = 0; k < 160 && T.d(x, t) > 0; k++) t += 0.1; return t; };
  const floor = (x, y) => T.ground(x, y, 12);
  for (const [x, h, par] of [[61.5, 4.6, 0], [66.5, 6.2, 1], [71.2, 7.0, 0], [76.4, 7.4, 1], [82.0, 7.2, 0], [87.6, 6.6, 1], [92.2, 5.0, 0]]) {
    const y = roof(x, -84), br = [];
    const grow = (x0, y0, a, len, w, n) => {
      const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      br.push([x0, y0, x1, y1, w, (r() - 0.5) * len * 0.5]);
      if (n <= 0) { if (r() < 0.4) br.push([x1, y1, null, 0.05 + r() * 0.04, r() * TAU]); return; }
      const m = n > 2 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
      for (let i = 0; i < m; i++) grow(x1, y1, a + (r() - 0.5) * 0.7 + (i - (m - 1) / 2) * 0.62, len * (0.62 + r() * 0.18), w * 0.6, n - 1);
    };
    grow(x, y + 0.4, -Math.PI / 2 + (r() - 0.5) * 0.2, h * 0.34, 0.26, 4);
    trees.push({ x, y, br, tone: par ? 0.34 : 0.58, par });
  }
  for (let i = 0; i < 26; i++) {
    const x = 55 + i * 1.75 + (r() - 0.5) * 0.7, top = roof(x, -338), w = 0.5 + r() * 0.7, f = floor(x, -337.5);
    if (f === null || top - f < 3) continue;
    const y = top - 0.5 - r() * 0.8;
    cloths.push({ x, top, y, w, h: 0.9 + r() * 1.3, ph: r() * 9, a: 0, v: 0, tone: 0.3 + r() * 0.35, back: i % 3 === 0, kind: (r() * 4) | 0 });
  }
  // one line runs through them all
  return { trees, cloths };
}

export function drawPlaces(D, ctx, ectx) {
  const W = D.w, k = D.k, t = D.time, p = W.player, X = (x) => D.sx(x), Y = (y) => D.sy(y);
  const S = D.places ||= make(W.T);
  if (D.vis(76, -84, 24)) for (const tr of S.trees) {
    if (!D.vis(tr.x, tr.y - 3, 6)) continue;
    const sw = Math.sin(t * 0.35 + tr.x) * 0.06;
    for (const b of tr.br) {
      const q = (y) => sw * (tr.y - y);
      if (b[2] === null) {
        // a pale fruit nobody picked
        ctx.fillStyle = g(0.72); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(0.8, 0.016 * k);
        ctx.beginPath(); ctx.ellipse(X(b[0] + q(b[1])), Y(b[1] - b[3]), b[3] * k, b[3] * 1.15 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ectx.fillStyle = `rgba(190,225,205,${(0.10 + 0.05 * Math.sin(t * 0.9 + b[4] * 3)) * (1 + 1.6 * (W.dim || 0))})`; ectx.beginPath(); ectx.arc(X(b[0] + q(b[1])), Y(b[1] - b[3]), b[3] * 1.3 * k, 0, TAU); ectx.fill();
        continue;
      }
      const [x0, y0, x1, y1, w, bend] = b, mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
      for (const [lw, v] of [[w + 0.03, 0.03], [w, tr.tone], [w * 0.35, tr.tone + 0.18]]) {
        if (lw === w * 0.35 && w < 0.05) continue;
        ctx.strokeStyle = g(v); ctx.lineWidth = Math.max(0.7, lw * k);
        ctx.beginPath(); ctx.moveTo(X(x0 + q(y0)), Y(y0)); ctx.quadraticCurveTo(X(mx + q(my)), Y(my), X(x1 + q(y1)), Y(y1)); ctx.stroke();
      }
    }
  }
  if (D.vis(78, -338, 30)) {
    ctx.strokeStyle = g(0.45); ctx.lineWidth = Math.max(0.8, 0.018 * k); ctx.beginPath();
    S.cloths.forEach((c, i) => { const q = S.cloths[i + 1]; if (!q) return; ctx.moveTo(X(c.x), Y(c.y)); ctx.quadraticCurveTo(X((c.x + q.x) / 2), Y((c.y + q.y) / 2 - 0.14), X(q.x), Y(q.y)); }); ctx.stroke();
    for (const c of S.cloths) {
      const d = p.x - c.x, close = Math.abs(d) < 2.2 && Math.abs(p.y - c.y) < 5 ? 1 - Math.abs(d) / 2.2 : 0;
      c.v += (-c.a * 9 + close * p.vx * 1.3 + Math.sin(t * 0.6 + c.ph) * 0.25 - c.v * 1.5) * (D.dtLast || 0); c.a += c.v * (D.dtLast || 0);
      if (!D.vis(c.x, c.y, 3)) continue;
      const ti = clamp(c.a, -0.7, 0.7), tone = c.tone * (c.back ? 0.55 : 1), hw = c.w / 2;
      ctx.save(); ctx.translate(X(c.x), Y(c.y)); ctx.rotate(-ti * 0.5);
      ctx.strokeStyle = g(0.4); ctx.lineWidth = Math.max(0.8, 0.016 * k); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -(c.top - c.y) * k); ctx.stroke();
      ctx.fillStyle = g(tone); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(0.8, 0.018 * k);
      const h = c.h * k, w = hw * k, fl = Math.sin(t * 1.1 + c.ph) * 0.05 * k + ti * 0.5 * k;
      ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.quadraticCurveTo(w * 0.9 + fl * 0.4, h * 0.5, w + fl, h * (c.kind === 1 ? 0.8 : 1));
      if (c.kind === 2) { ctx.lineTo(w * 0.35 + fl, h * 0.98); ctx.lineTo(w * 0.3 + fl, h * 0.6); ctx.lineTo(-w * 0.3 + fl, h * 0.6); ctx.lineTo(-w * 0.35 + fl, h * 0.98); } else ctx.quadraticCurveTo(fl, h * 1.06, -w + fl, h);
      ctx.lineTo(-w + fl, h * 0.95); ctx.quadraticCurveTo(-w * 0.9 + fl * 0.4, h * 0.5, -w, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = g(tone * 0.55); ctx.lineWidth = Math.max(0.6, 0.01 * k);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * w * 0.5, 0.06 * k); ctx.quadraticCurveTo(i * w * 0.45 + fl * 0.3, h * 0.5, i * w * 0.5 + fl, h * 0.9); ctx.stroke(); }
      ctx.restore();
    }
  }
  // ── seats: a flat stone with something folded on it ──
  for (const s of W.kindle.seats) {
    if (!D.vis(s.x, s.y, 2)) continue;
    const x = X(s.x), y = Y(s.y);
    ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(0.9, 0.02 * k);
    ctx.fillStyle = g(0.36); ctx.beginPath(); ctx.moveTo(x - 0.5 * k, y + 0.06 * k); ctx.lineTo(x - 0.44 * k, y - 0.13 * k); ctx.quadraticCurveTo(x, y - 0.19 * k, x + 0.46 * k, y - 0.12 * k); ctx.lineTo(x + 0.5 * k, y + 0.06 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = g(0.62); ctx.beginPath(); ctx.moveTo(x - 0.27 * k, y - 0.16 * k); ctx.quadraticCurveTo(x, y - 0.25 * k, x + 0.27 * k, y - 0.16 * k); ctx.lineTo(x + 0.3 * k, y - 0.1 * k); ctx.quadraticCurveTo(x, y - 0.17 * k, x - 0.3 * k, y - 0.1 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = g(0.25); ctx.lineWidth = Math.max(0.6, 0.01 * k); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + i * 0.1 * k, y - 0.2 * k); ctx.lineTo(x + i * 0.11 * k, y - 0.13 * k); ctx.stroke(); }
    // a stub of candle at the seat's end, always burning, so a seat is seen from far off (its light: world.js lights)
    const cx = x + 0.38 * s.flip * k, cb = y - 0.12 * k, ch = 0.17 * k, cw = 0.045 * k;
    ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(0.8, 0.014 * k); ctx.fillStyle = g(0.8);
    ctx.beginPath(); ctx.moveTo(cx - cw, cb); ctx.lineTo(cx - cw, cb - ch); ctx.quadraticCurveTo(cx, cb - ch - 0.02 * k, cx + cw, cb - ch); ctx.lineTo(cx + cw, cb); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = g(0.7); ctx.beginPath(); ctx.ellipse(cx + cw * 0.9, cb - ch * 0.55, 0.012 * k, 0.04 * k, 0, 0, TAU); ctx.fill();           // a run of wax down its side
    ctx.beginPath(); ctx.ellipse(cx, cb + 0.005 * k, cw * 2.2, 0.025 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();                              // the pool it stands in
    const fl = Math.sin(t * 9.1 + s.x) * 0.5 + Math.sin(t * 13.7 + s.x * 2) * 0.3, fh = (0.13 + 0.02 * fl) * k * (W.rest.at === s ? 1.25 : 1), fx = cx + 0.012 * fl * k, fb = cb - ch - 0.012 * k;
    ctx.strokeStyle = g(0.05); ctx.lineWidth = Math.max(0.8, 0.012 * k); ctx.beginPath(); ctx.moveTo(cx, cb - ch); ctx.lineTo(cx, fb); ctx.stroke();   // wick
    const flame = (c) => { c.beginPath(); c.moveTo(fx, fb - fh); c.quadraticCurveTo(cx + 0.05 * k, fb - fh * 0.3, cx, fb + 0.01 * k); c.quadraticCurveTo(cx - 0.05 * k, fb - fh * 0.3, fx, fb - fh); c.fill(); };
    ctx.fillStyle = g(1); flame(ctx);
    // the flame glows (emission layer): a halo and the flame itself
    const hy = fb - fh * 0.4, hr = 0.5 * k * (1 + 0.04 * fl), hg = ectx.createRadialGradient(cx, hy, 0, cx, hy, hr);
    hg.addColorStop(0, 'rgba(255,190,120,0.4)'); hg.addColorStop(0.18, 'rgba(255,160,90,0.16)'); hg.addColorStop(0.55, 'rgba(255,130,70,0.04)'); hg.addColorStop(1, 'rgba(255,120,60,0)');
    ectx.fillStyle = hg; ectx.beginPath(); ectx.arc(cx, hy, hr, 0, TAU); ectx.fill();
    ectx.fillStyle = 'rgba(255,225,170,0.95)'; flame(ectx);
  }
}
