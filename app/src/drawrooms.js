// What stands and hangs in the rooms under the Hall, round the Hush and below the Treadles: drawn behind everything that moves,
// in dim tone, the same every time. Nothing here can be touched.
import { mulberry, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;

function make(T) {
  const r = mulberry(88), out = [];
  const roof = (x, y) => { let t = y; for (let k = 0; k < 300 && T.d(x, t) > 0.02; k++) t += 0.08; return t; };
  const floor = (x, y) => T.ground(x, y, 14);
  const add = (kind, x, y, o = {}) => out.push({ kind, x, y, s: 0.85 + r() * 0.35, t: 0.16 + r() * 0.12, f: r() < 0.5 ? -1 : 1, q: r() * 100, ...o });
  // the Weighing Room: pans on cords, and heaps of weights
  for (let x = 12; x < 42; x += 2.1 + r() * 1.6) { const t = roof(x, -255); add('pan', x, t, { len: 1.6 + r() * 4.2 }); }
  for (const x of [17, 20.6, 32, 35.4, 40.6]) add('weights', x, floor(x, -255));
  // the Pews: benches in rows, two deep, somebody small on some of them
  for (const [row, tone] of [[1, 0.13], [0, 0.22]]) for (let x = 4.8 + row; x < 31; x += 3.1) if (x < 11.2 || x > 24.8) add('pew', x, floor(x, -277), { t: tone, s: row ? 0.75 : 1, doll: r() < 0.45, row });
  for (let x = 13; x < 24; x += 2.6) add('pew', x, -281 + 0.2, { t: 0.1, s: 0.7, doll: r() < 0.3, row: 2, hung: roof(x, -276) });
  // the Slabs and the Pin Walk: sleeves hanging, pins standing
  for (let x = 24; x < 69; x += 1.5 + r() * 1.9) add('sleeve', x, roof(x, -297), { len: 1.2 + r() * 2.4 });
  for (let x = 25; x < 87; x += 1.9 + r() * 2.6) { const up = r() < 0.5; add('pin', x, up ? roof(x, -309) + 0.2 : floor(x, -308) - 0.2, { len: 1.6 + r() * 3.2, up, tilt: (r() - 0.5) * 0.5 }); }
  // the bobbin's lane and the lower room: posts, beams, racks of spools, heddle wires
  for (let x = 40; x < 100; x += 7.4) { add('post', x, floor(x, -401), { top: roof(x, -401) }); if (r() < 0.8) add('rack', x + 3.6, floor(x + 3.6, -401) + 2.4 + r() * 1.2); }
  for (let x = 36; x < 98; x += 6.3) { add('post', x, floor(x, -417), { top: roof(x, -417) }); if (r() < 0.7) add('wires', x + 3, roof(x + 3, -417), { len: 2.4 + r() * 3 }); }
  // (2026-11-27) the Stores: shelves of great empty bobbins on every gallery, posts holding the galleries up, bales of wool on chains
  const r2 = mulberry(89), add2 = (kind, x, y, o = {}) => out.push({ kind, x, y, s: 0.85 + r2() * 0.35, t: 0.15 + r2() * 0.12, f: r2() < 0.5 ? -1 : 1, q: r2() * 100, ...o });
  for (const [a, b, top] of [[127, 195, -358.3], [143, 215, -369.8], [125, 197, -381.4], [143, 215, -393.0], [129, 213, -404.6]]) {
    for (let x = a + 3 + r2() * 3; x < b - 2.5; x += 6.5 + r2() * 4) add2('shelf', x, top, { h: 3.2 + r2() * 1.6, n: 3 + ((r2() * 2) | 0), w: 1.2 + r2() * 0.6 });
    for (let x = a + 4; x < b - 2; x += 13 + r2() * 6) add2('post', x, floor(x, top + 1), { top: roof(x, top + 1) });
    for (let x = a + 6 + r2() * 5; x < b - 4; x += 9 + r2() * 9) { const t = roof(x, top + 2); if (t - top > 6) add2('bale', x, t, { len: 1.2 + r2() * Math.min(3, t - top - 6) }); }
  }
  // the Drying Loft: skeins hung over poles to dry, long ago
  for (const x of [115.4, 118.7, 122.0]) add2('skeins', x, roof(x, -380), { n: 4 + ((r2() * 3) | 0) });
  // the Dry Falls: a bucket on a chain in the Cistern, and a windlass beam over the shaft's foot
  add2('well', 219.5, roof(219.5, -192), { len: 3.6 });
  add2('well', 226.8, roof(226.8, -192), { len: 2.2 });
  return out.filter((o) => o.y !== null && o.y !== undefined);
}

export function drawRooms(D, ctx) {
  const y = D.cam[1], falls = y < -140 && y > -212 && D.cam[0] > 100;
  if (!falls && (y > -244 || y < -428)) return;
  D.rooms ||= make(D.w.T);
  const k = D.k, X = (x) => D.sx(x), Y = (v) => D.sy(v), lw = (m) => Math.max(0.7, m * k);
  const line = (x0, y0, x1, y1, v, w) => { ctx.strokeStyle = g(v); ctx.lineWidth = lw(w); ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke(); };
  const poly = (p, v, s = 0.03, w = 0.016) => { ctx.beginPath(); p.forEach(([x, yy], i) => (i ? ctx.lineTo(X(x), Y(yy)) : ctx.moveTo(X(x), Y(yy)))); ctx.closePath(); ctx.fillStyle = g(v); ctx.fill(); if (s !== null) { ctx.strokeStyle = g(s); ctx.lineWidth = lw(w); ctx.stroke(); } };
  for (const o of D.rooms) {
    if (!D.vis(o.x, o.y, 8)) continue;
    const { x, s, t } = o, sway = Math.sin(D.time * 0.5 + o.q) * 0.04;
    if (o.kind === 'pan') {
      const b = o.y - o.len;
      line(x, o.y + 0.1, x + sway, b + 0.6, t + 0.1, 0.02);
      for (const e of [-1, 0, 1]) line(x + sway, b + 0.6, x + sway + e * 0.42 * s, b, t + 0.06, 0.014);
      ctx.beginPath(); ctx.ellipse(X(x + sway), Y(b), 0.46 * s * k, 0.12 * s * k, 0, 0, Math.PI); ctx.fillStyle = g(t + 0.06); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.016); ctx.stroke();
      line(x + sway - 0.46 * s, b, x + sway + 0.46 * s, b, t + 0.24, 0.02);
      if (o.q % 3 < 1.6) poly([[x + sway - 0.16, b], [x + sway + 0.16, b], [x + sway + 0.1, b + 0.26], [x + sway - 0.1, b + 0.26]], t, 0.03);
      if (o.q % 5 < 1.2) { ctx.beginPath(); ctx.ellipse(X(x + sway + 0.1), Y(b + 0.12), 0.17 * k, 0.13 * k, 0.3, 0, TAU); ctx.fillStyle = g(t + 0.12); ctx.fill(); }
    } else if (o.kind === 'weights') {
      const r = mulberry((o.q * 1000) | 0);
      for (let i = 0; i < 6; i++) { const wx = x - 0.9 + r() * 1.8, h = 0.16 + r() * 0.3, w = h * 0.7; poly([[wx - w, o.y - 0.05], [wx + w, o.y - 0.05], [wx + w * 0.7, o.y + h], [wx - w * 0.7, o.y + h]], t + r() * 0.08, 0.03); ctx.strokeStyle = g(t + 0.1); ctx.lineWidth = lw(0.03); ctx.beginPath(); ctx.arc(X(wx), Y(o.y + h + 0.06), 0.06 * k, 0, TAU); ctx.stroke(); }
    } else if (o.kind === 'pew') {
      const w = 1.25 * s, by = o.y, f = o.f;
      if (o.hung) { for (const e of [-0.9, 0.9]) line(x + e * w, by + 0.4 * s, x + e * w * 0.9, o.hung, t + 0.06, 0.015); }
      poly([[x - w, by + 0.42 * s], [x + w, by + 0.42 * s], [x + w, by + 0.5 * s], [x - w, by + 0.5 * s]], t + 0.06);
      poly([[x - w, by + 0.62 * s], [x + w, by + 0.62 * s], [x + w, by + 1.15 * s], [x - w, by + 1.15 * s]], t);
      for (const e of [-1, 1]) poly([[x + e * w - 0.06, by], [x + e * w + 0.06, by], [x + e * w + 0.06, by + 1.25 * s], [x + e * w - 0.06, by + 1.25 * s]], t + 0.03);
      for (let q = -0.8; q < 0.9; q += 0.28) line(x + q * w, by + 0.65 * s, x + q * w, by + 1.12 * s, t * 0.5, 0.012);
      if (o.doll) {
        const dx = x + f * 0.35 * s, dy = by + 0.5 * s;
        ctx.fillStyle = g(t + 0.1); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.014);
        ctx.beginPath(); ctx.ellipse(X(dx), Y(dy + 0.16 * s), 0.14 * s * k, 0.18 * s * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(X(dx + f * 0.05), Y(dy + 0.4 * s), 0.12 * s * k, 0.115 * s * k, f * 0.4, 0, TAU); ctx.fill(); ctx.stroke();
      }
    } else if (o.kind === 'sleeve') {
      const b = o.y - o.len, w = 0.17 * s;
      poly([[x - w * 1.2, o.y + 0.2], [x + w * 1.2, o.y + 0.2], [x + w + sway, b + 0.2], [x + w * 0.9 + sway * 1.6, b], [x - w * 0.9 + sway * 1.6, b], [x - w + sway, b + 0.2]], t, 0.03);
      for (let q = 0.1; q < 1; q += 0.09) line(x - w + sway * q, o.y - o.len * q, x + w + sway * q, o.y - o.len * q - 0.03, t * 0.55, 0.01);
      for (let q = -2; q < 3; q++) line(x + q * w * 0.38 + sway * 1.6, b, x + q * w * 0.38 + sway * 1.6, b + 0.18, t + 0.14, 0.018);
    } else if (o.kind === 'pin') {
      const e = o.up ? -1 : 1, x1 = x + o.tilt * o.len, y1 = o.y + e * o.len;
      line(x, o.y, x1, y1, 0.03, 0.085); line(x, o.y, x1, y1, t + 0.14, 0.05);
      ctx.beginPath(); ctx.arc(X(x1), Y(y1), 0.15 * s * k, 0, TAU); ctx.fillStyle = g(t + 0.12); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.016); ctx.stroke();
    } else if (o.kind === 'post') {
      const w = 0.2;
      poly([[x - w, o.y - 0.2], [x + w, o.y - 0.2], [x + w * 0.9, o.top + 0.3], [x - w * 0.9, o.top + 0.3]], t + 0.03);
      for (let q = -1; q < 2; q++) line(x + q * 0.09, o.y, x + q * 0.08, o.top, t * 0.5, 0.012);
      for (const e of [-1, 1]) line(x, o.top - 1.2, x + e * 1.1, o.top + 0.1, t + 0.02, 0.16);
    } else if (o.kind === 'rack') {
      for (let j = 0; j < 2; j++) {
        const yy = o.y + j * 1.1;
        line(x - 1.5, yy, x + 1.5, yy, t + 0.04, 0.09); line(x - 1.5, yy + 0.04, x + 1.5, yy + 0.04, t + 0.2, 0.012);
        for (let q = -1.3; q < 1.4; q += 0.42) { const h = 0.3 + ((o.q * (q + 3)) % 0.22), xx = x + q; poly([[xx - 0.13, yy + 0.05], [xx + 0.13, yy + 0.05], [xx + 0.13, yy + 0.1], [xx + 0.08, yy + 0.12], [xx + 0.08, yy + h], [xx + 0.13, yy + h + 0.03], [xx + 0.13, yy + h + 0.07], [xx - 0.13, yy + h + 0.07], [xx - 0.13, yy + h + 0.03], [xx - 0.08, yy + h], [xx - 0.08, yy + 0.12], [xx - 0.13, yy + 0.1]], t + 0.05); }
      }
    } else if (o.kind === 'shelf') {
      // a tall rack of boards, two uprights, a great bobbin or a gap in each bay; the boards sag a little
      const w = o.w * s, h = o.h * s, by = o.y, r = mulberry((o.q * 997) | 0);
      for (const e of [-1, 1]) poly([[x + e * w - 0.07, by - 0.05], [x + e * w + 0.07, by - 0.05], [x + e * w + 0.06, by + h], [x + e * w - 0.06, by + h]], t + 0.04);
      line(x - w, by + h * 0.98, x + w, by + h * 0.6, t * 0.6, 0.02);      // a brace
      for (let j = 0; j < o.n; j++) {
        const yy = by + 0.25 + j * (h - 0.3) / o.n;
        poly([[x - w - 0.1, yy], [x + w + 0.1, yy], [x + w + 0.1, yy + 0.08], [x, yy + 0.05], [x - w - 0.1, yy + 0.08]], t + 0.08, 0.03, 0.012);
        for (let q = -w + 0.3; q < w - 0.15; q += 0.55 + r() * 0.25) {
          if (r() < 0.22) continue;
          const bh = 0.45 + r() * 0.35, bw = 0.2 + r() * 0.06, fl = r() < 0.2;
          if (fl) { ctx.beginPath(); ctx.ellipse(X(x + q), Y(yy + 0.2), bh * 0.55 * k, 0.2 * k, 0, 0, TAU); ctx.fillStyle = g(t + 0.05); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.012); ctx.stroke(); continue; }      // one fallen over
          poly([[x + q - bw, yy + 0.08], [x + q + bw, yy + 0.08], [x + q + bw, yy + 0.14], [x + q + bw * 0.55, yy + 0.16], [x + q + bw * 0.55, yy + bh - 0.08], [x + q + bw, yy + bh - 0.06], [x + q + bw, yy + bh], [x + q - bw, yy + bh], [x + q - bw, yy + bh - 0.06], [x + q - bw * 0.55, yy + bh - 0.08], [x + q - bw * 0.55, yy + 0.16], [x + q - bw, yy + 0.14]], t + 0.1 + r() * 0.06, 0.03, 0.012);
          if (r() < 0.35) for (let u = 0.2; u < bh - 0.15; u += 0.05) line(x + q - bw * 0.55, yy + u, x + q + bw * 0.55, yy + u + 0.01, t + 0.22, 0.008);      // a little old yarn left on it
        }
      }
    } else if (o.kind === 'bale') {
      // a bale of raw wool in a net, on a chain
      const b = o.y - o.len, bw = 0.6 * s, bh = 0.75 * s, sw = sway * 1.5;
      for (let u = 0; u < o.len; u += 0.16) { ctx.beginPath(); ctx.ellipse(X(x + sw * u / o.len), Y(o.y - u), 0.035 * k, 0.07 * k, 0, 0, TAU); ctx.strokeStyle = g(t + 0.12); ctx.lineWidth = lw(0.012); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(X(x + sw), Y(b - bh * 0.5), bw * k, bh * 0.55 * k, 0, 0, TAU); ctx.fillStyle = g(t + 0.14); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.016); ctx.stroke();
      for (let q = -2; q <= 2; q++) line(x + sw + q * bw * 0.35, b + 0.02, x + sw + q * bw * 0.42, b - bh * 1.02, t * 0.6, 0.01);
      for (let q = 1; q <= 3; q++) line(x + sw - bw * 0.95, b - bh * q * 0.25, x + sw + bw * 0.95, b - bh * q * 0.25, t * 0.6, 0.01);
    } else if (o.kind === 'skeins') {
      // a pole across, skeins hung over it in loops
      const by = o.y - 0.5;
      line(x - 1.6, by, x + 1.6, by, t + 0.08, 0.06); line(x - 1.6, o.y, x - 1.6, by, t, 0.015); line(x + 1.6, o.y, x + 1.6, by, t, 0.015);
      for (let j = 0; j < o.n; j++) {
        const sx = x - 1.3 + j * 2.6 / Math.max(1, o.n - 1), len = 0.9 + ((o.q * (j + 2)) % 0.7), sw2 = sway * (1 + j * 0.2);
        // a hank folded over the pole: a long pale teardrop, twisted, its strands showing
        const bx = sx + sw2, hw = 0.13 * s;
        ctx.beginPath(); ctx.moveTo(X(sx - hw * 0.6), Y(by)); ctx.bezierCurveTo(X(sx - hw * 1.3), Y(by - len * 0.4), X(bx - hw), Y(by - len), X(bx), Y(by - len * 1.05));
        ctx.bezierCurveTo(X(bx + hw), Y(by - len), X(sx + hw * 1.3), Y(by - len * 0.4), X(sx + hw * 0.6), Y(by)); ctx.closePath();
        ctx.fillStyle = g(t + 0.34 + (j & 1) * 0.08); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.014); ctx.stroke();
        for (let q = 0.15; q < 0.95; q += 0.16) line(sx - hw * (1 - q * 0.6) + (bx - sx) * q, by - len * q, sx + hw * (1 - q * 0.6) + (bx - sx) * q, by - len * q - 0.08, t + 0.12, 0.01);
      }
    } else if (o.kind === 'well') {
      // a chain from the roof, a bucket on its hook
      const b = o.y - o.len, sw = sway * 1.2;
      for (let u = 0; u < o.len; u += 0.15) { ctx.beginPath(); ctx.ellipse(X(x + sw * u / o.len), Y(o.y - u), 0.03 * k, 0.065 * k, (u * 7) % 2 > 1 ? 0 : 1.2, 0, TAU); ctx.strokeStyle = g(t + 0.12); ctx.lineWidth = lw(0.012); ctx.stroke(); }
      poly([[x + sw - 0.26, b - 0.1], [x + sw + 0.26, b - 0.1], [x + sw + 0.2, b - 0.62], [x + sw - 0.2, b - 0.62]], t + 0.1);
      line(x + sw - 0.26, b - 0.1, x + sw, b + 0.2, t + 0.1, 0.012); line(x + sw + 0.26, b - 0.1, x + sw, b + 0.2, t + 0.1, 0.012);
      for (const q of [-0.22, -0.36, -0.5]) line(x + sw - 0.24, b + q, x + sw + 0.24, b + q, t * 0.5, 0.01);
    } else if (o.kind === 'wires') {
      for (let q = -6; q < 7; q++) line(x + q * 0.1, o.y + 0.1, x + q * 0.1 + sway, o.y - o.len + Math.sin(q * 2 + o.q) * 0.25, t + 0.1, 0.012);
      line(x - 0.75, o.y - o.len * 0.5, x + 0.75, o.y - o.len * 0.5, t + 0.06, 0.07);
    }
  }
}
