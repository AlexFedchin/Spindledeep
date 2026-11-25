// What the thread works (rig.js), drawn: the doors of needles, the sinking rings' weights, the handles on their rails, the
// spindles, the bobbin, the pew that slides out over the trench, the mat across the hole. Grey tone on the sprite canvas.
import * as L from './level.js';
import { mulberry, TAU, clamp } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;

export function drawRig(D, ctx, ectx) {
  const R = D.w.rig;
  if (!R) return;
  const k = D.k, X = (x) => D.sx(x), Y = (y) => D.sy(y), lw = (m, min = 0.8) => Math.max(min, m * k);
  const line = (x0, y0, x1, y1, v, w, a = 1) => { ctx.strokeStyle = g(v, a); ctx.lineWidth = lw(w); ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke(); };
  const poly = (p, v, s = 0.04, w = 0.02) => { ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.closePath(); if (v !== null) { ctx.fillStyle = g(v); ctx.fill(); } if (s !== null) { ctx.strokeStyle = g(s); ctx.lineWidth = lw(w); ctx.stroke(); } };
  const disc = (x, y, r, v, s = 0.04, w = 0.02) => { ctx.beginPath(); ctx.arc(X(x), Y(y), r * k, 0, TAU); if (v !== null) { ctx.fillStyle = g(v); ctx.fill(); } if (s !== null) { ctx.strokeStyle = g(s); ctx.lineWidth = lw(w); ctx.stroke(); } };

  // ── doors: long needles through a bar, drawn up into the roof ──
  for (const gt of D.w.gates) {
    if (gt.give) { drawStrip(D, ctx, gt, { X, Y, lw, line }); continue; }
    if (gt.id === 'mat') { drawMat(D, ctx, gt, { X, Y, lw, line, poly }); continue; }
    if (!gt.rig || gt.bridge || !D.vis((gt.x0 + gt.x1) / 2, (gt.base + gt.y1) / 2, 8)) continue;
    const c = (gt.x0 + gt.x1) / 2, up = gt.y0 - gt.base, H = gt.y1 - gt.base, clip = gt.y1 + 0.3;
    ctx.save(); ctx.beginPath(); ctx.rect(X(c - 2), Y(clip), 4 * k, (clip - gt.base + 0.4) * k); ctx.clip();
    for (let i = 0; i < 5; i++) {
      const x = c - 0.44 + i * 0.22, b = gt.base + up + (i % 2) * 0.12;
      poly([[x - 0.05, b + 0.5], [x, b], [x + 0.05, b + 0.5], [x + 0.045, b + H + 1], [x - 0.045, b + H + 1]], 0.42 + (i % 2) * 0.1, 0.03, 0.018);
      line(x + 0.02, b + 0.5, x + 0.02, b + H, 0.72, 0.008);
    }
    for (let y = gt.base + up + 0.7; y < gt.base + up + H + 1; y += 1.5) {
      poly([[c - 0.62, y], [c + 0.62, y + 0.03], [c + 0.62, y + 0.19], [c - 0.62, y + 0.16]], 0.3, 0.03, 0.02);
      for (let q = -2; q < 3; q++) { line(c + q * 0.22 - 0.08, y - 0.04, c + q * 0.22 + 0.08, y + 0.22, 0.6, 0.025); line(c + q * 0.22 + 0.08, y - 0.04, c + q * 0.22 - 0.08, y + 0.22, 0.5, 0.02); }
    }
    ctx.restore();
    // a door that is about to come down trembles in the light
    if (gt.hold > 0 && gt.hold < 2) { ectx.strokeStyle = `rgba(230,210,180,${0.12 + 0.1 * Math.sin(D.time * 22)})`; ectx.lineWidth = lw(0.04); ectx.beginPath(); ectx.moveTo(X(c - 0.6), Y(gt.y0)); ectx.lineTo(X(c + 0.6), Y(gt.y0)); ectx.stroke(); }
  }
  // ── the pew ──
  const br = R.gates.bridge;
  if (br && D.vis(22, br.y1, 14)) {
    const x0 = br.x0 - 0.1, x1 = br.end + 8;
    ctx.save(); ctx.beginPath(); ctx.rect(X(x0), Y(br.y1 + 2), (br.end + 5.2 - x0) * k, 6 * k); ctx.clip();
    if (br.x0 < br.end - 0.05) {
      poly([[x0, br.y1], [x1, br.y1], [x1, br.y0], [x0, br.y0]], 0.36, 0.03, 0.02);
      line(x0, br.y1 - 0.03, br.end, br.y1 - 0.03, 0.66, 0.015);
      for (let q = 0.4; q < br.end - x0; q += 1.1) line(x0 + q, br.y1 - 0.1, x0 + q + 0.7, br.y1 - 0.12, 0.2, 0.01);
      poly([[x0, br.y1 + 0.12], [x0 + 0.16, br.y1 + 0.12], [x0 + 0.16, br.y0 - 0.16], [x0, br.y0 - 0.16]], 0.44, 0.03);
    }
    ctx.restore();
  }
  // ── handles ──
  for (const h of R.pulls) {
    if (!D.vis(h.x, h.y, 8)) continue;
    const a = h.from + 0.5 * Math.sign(-h.pull.dx), b = h.from + h.pull.dx - 0.5 * Math.sign(-h.pull.dx), y = h.y + 0.5;
    poly([[a, y + 0.07], [b, y + 0.07], [b, y - 0.05], [a, y - 0.05]], 0.26, 0.03);
    for (let q = 0.1; q < 1; q += 0.12) line(a + (b - a) * q, y + 0.07, a + (b - a) * q + 0.06, y - 0.05, 0.1, 0.02);
    let top = y; for (let i = 0; i < 80 && D.w.T.d(a, top) > 0; i++) top += 0.15;
    for (const x of [a, b]) { let t2 = y; for (let i = 0; i < 90 && D.w.T.d(x, t2) > -0.1; i++) t2 += 0.15; line(x, y, x, t2, 0.05, 0.07); line(x, y, x, t2, 0.34, 0.03); }
    disc(h.x, y, 0.13, 0.4, 0.03, 0.025); line(h.x, y, h.x, h.y + 0.18, 0.06, 0.05);
    ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.1); ctx.beginPath(); ctx.arc(X(h.x), Y(h.y), 0.2 * k, 0, TAU); ctx.stroke();
    ctx.strokeStyle = g(h.f >= 1 ? 0.4 : 0.66); ctx.lineWidth = lw(0.06); ctx.stroke();
    poly([[h.x - 0.28, h.y - 0.16], [h.x + 0.28, h.y - 0.16], [h.x + 0.26, h.y - 0.27], [h.x - 0.26, h.y - 0.27]], 0.5, 0.03);
    if (h.f < 1) { const gr = ectx.createRadialGradient(X(h.x), Y(h.y), 0, X(h.x), Y(h.y), 0.8 * k); gr.addColorStop(0, `rgba(220,205,180,${0.12 + 0.05 * Math.sin(D.time * 2)})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); ectx.fillStyle = gr; ectx.fillRect(X(h.x) - 0.8 * k, Y(h.y) - 0.8 * k, 1.6 * k, 1.6 * k); }
  }
  // ── the weights on the sinking rings: a collar on the chain, and the cord away to the door ──
  for (const h of R.sinks) {
    if (!D.vis(h.x, h.y, 9)) continue;
    const y = h.y + 0.75;
    poly([[h.x - 0.2, y], [h.x + 0.2, y], [h.x + 0.28, y + 0.42], [h.x - 0.28, y + 0.42]], 0.3, 0.03, 0.025);
    line(h.x - 0.16, y + 0.1, h.x - 0.2, y + 0.36, 0.6, 0.02);
    const gt = R.gates[h.sink.gate];
    if (gt) {
      let roof = h.top + 0.6; for (let i = 0; i < 90 && D.w.T.d(h.x, roof) > 0.06; i++) roof += 0.1;
      const c = (gt.x0 + gt.x1) / 2; let roof2 = gt.base + 2; for (let i = 0; i < 120 && D.w.T.d(c, roof2) > 0.06; i++) roof2 += 0.1;
      ctx.strokeStyle = g(0.5); ctx.lineWidth = lw(0.022); ctx.beginPath(); ctx.moveTo(X(h.x), Y(roof)); ctx.quadraticCurveTo(X((h.x + c) / 2), Y(Math.min(roof, roof2) - 0.35 - 0.25 * (1 - gt.open)), X(c), Y(roof2)); ctx.stroke();
    }
  }
  // ── spindles ──
  for (const s of R.spindles) {
    if (!D.vis(s.x, s.y, 3)) continue;
    let gy = s.y; for (let i = 0; i < 40 && D.w.T.d(s.x, gy) > 0; i++) gy -= 0.05;
    line(s.x, gy, s.x, s.y + 0.62, 0.05, 0.1); line(s.x, gy, s.x, s.y + 0.62, 0.5, 0.05);
    // the whorl: a disc seen edge on, turning (its spokes go by), and wool on it once it has run
    const w = 0.42;
    ctx.save(); ctx.translate(X(s.x), Y(s.y + 0.14));
    ctx.fillStyle = g(0.4); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.025);
    ctx.beginPath(); ctx.ellipse(0, 0, w * k, 0.11 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = g(0.12); ctx.lineWidth = lw(0.02);
    for (let q = 0; q < 6; q++) { const a = s.a + q * TAU / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * w * k * 0.94, Math.sin(a) * 0.1 * k); ctx.stroke(); }
    ctx.restore();
    poly([[s.x - 0.13, s.y + 0.2], [s.x + 0.13, s.y + 0.2], [s.x + 0.04, s.y + 0.6], [s.x - 0.04, s.y + 0.6]], 0.3 + 0.1 * s.v, 0.03);
    for (let q = 0; q < 6; q++) line(s.x - 0.11 + q * 0.008, s.y + 0.24 + q * 0.05, s.x + 0.11 - q * 0.008, s.y + 0.26 + q * 0.05, 0.14, 0.012);
    if (s.v > 0.02) { const gr = ectx.createRadialGradient(X(s.x), Y(s.y + 0.3), 0, X(s.x), Y(s.y + 0.3), 1.1 * k); gr.addColorStop(0, `rgba(255,60,45,${0.2 * s.v})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); ectx.fillStyle = gr; ectx.fillRect(X(s.x) - 1.1 * k, Y(s.y + 0.3) - 1.1 * k, 2.2 * k, 2.2 * k); }
  }
  // ── the bobbin ──
  for (const b of R.bobbins) {
    if (!D.vis(b.x, b.y, 4)) continue;
    const jit = b.st === 'foul' ? Math.sin(D.time * 50) * 0.02 * Math.min(1, b.t / 4) : 0, x = b.x + jit;
    // gutters of its lane are in the rock; the rail it runs on is worn into the floor
    disc(x, b.y, b.r, 0.26, 0.02, 0.05);
    ctx.save(); ctx.translate(X(x), Y(b.y)); ctx.rotate(b.a);
    ctx.strokeStyle = g(0.05); ctx.lineWidth = lw(0.03);
    for (let q = 0; q < 8; q++) { const a = q * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.3 * k, Math.sin(a) * 0.3 * k); ctx.lineTo(Math.cos(a) * (b.r - 0.08) * k, Math.sin(a) * (b.r - 0.08) * k); ctx.stroke(); }
    // grain of the flange's boards, and what is caught on it
    const r = mulberry(4);
    ctx.strokeStyle = g(0.38); ctx.lineWidth = lw(0.012);
    for (let q = 0; q < 26; q++) { const a = r() * TAU, d = 0.4 + r() * (b.r - 0.6), l = 0.1 + r() * 0.3; ctx.beginPath(); ctx.arc(0, 0, d * k, a, a + l); ctx.stroke(); }
    ctx.strokeStyle = g(0.6); ctx.lineWidth = lw(0.02);
    ctx.beginPath(); ctx.arc(0, 0, (b.r - 0.05) * k, 0, TAU); ctx.stroke();
    for (let q = 0; q < 5; q++) { const a = r() * TAU; ctx.strokeStyle = g(0.5); ctx.lineWidth = lw(0.02); ctx.beginPath(); ctx.moveTo(Math.cos(a) * b.r * 0.9 * k, Math.sin(a) * b.r * 0.9 * k); ctx.quadraticCurveTo(Math.cos(a + 0.3) * b.r * 1.25 * k, Math.sin(a + 0.3) * b.r * 1.25 * k, Math.cos(a + 0.5) * b.r * 1.02 * k, Math.sin(a + 0.5) * b.r * 1.02 * k); ctx.stroke(); }
    ctx.restore();
    disc(x, b.y, 0.34, 0.14, 0.02, 0.03); disc(x, b.y, 0.16, 0.02, 0.4, 0.015);
    if (b.st === 'foul') {
      ectx.strokeStyle = 'rgba(255,50,40,0.7)'; ectx.lineWidth = lw(0.03, 1.4);
      for (let q = 0; q < 3; q++) { ectx.beginPath(); ectx.arc(X(x), Y(b.y), (b.r + 0.02) * k, Math.PI * 0.5 - 0.5 - q * 0.3, Math.PI * 0.5 + 0.7 + q * 0.5); ectx.stroke(); }
    }
  }
}

// the mat woven across the hole in the Hall
function drawMat(D, ctx, gt, { X, Y, lw, line }) {
  if (!D.vis((gt.x0 + gt.x1) / 2, gt.y1, 6)) return;
  const T = D.w.T;
  gt.span ||= (() => { let a = (gt.x0 + gt.x1) / 2, b = a; while (T.d(a, gt.y1 - 0.2) > -0.1 && a > gt.x0) a -= 0.08; while (T.d(b, gt.y1 - 0.2) > -0.1 && b < gt.x1) b += 0.08; return [a, b]; })();
  const [a, b] = gt.span;
  for (let q = 0; q < 4; q++) {
    const y = gt.y1 - 0.06 - q * 0.13;
    for (const [w, v] of [[0.12, 0.03], [0.085, 0.36 + (q % 2) * 0.1]]) {
      ctx.strokeStyle = g(v); ctx.lineWidth = lw(w); ctx.beginPath();
      for (let x = a; x <= b; x += 0.12) { const yy = y + Math.sin(x * 9 + q * Math.PI) * 0.03 - 0.05 * Math.sin((x - a) / (b - a) * Math.PI); x === a ? ctx.moveTo(X(x), Y(yy)) : ctx.lineTo(X(x), Y(yy)); }
      ctx.stroke();
    }
  }
  for (let x = a + 0.1, i = 0; x < b; x += 0.21, i++) { line(x, gt.y1 + 0.01, x + 0.05, gt.y1 - 0.5, 0.14, 0.02); if (i % 3 === 0) line(x, gt.y1 - 0.48, x + Math.sin(i) * 0.06, gt.y1 - 0.75 - (i % 5) * 0.12, 0.4, 0.015); }
}

// a strip of the cloth hung on threads: it shivers under her, then swings down by one end
function drawStrip(D, ctx, gt, { X, Y, lw, line }) {
  const c = (gt.x0 + gt.x1) / 2;
  if (!D.vis(c, gt.y1, 7)) return;
  const w = gt.x1 - gt.x0, gone = gt.open >= 1, t = gt.t || 0, sh = gt.load ? Math.sin(D.time * 44) * 0.04 : 0;
  const fall = gone ? Math.min(1, t / 0.5) : 0, a = -fall * 1.5, side = Math.sin(gt.x0 * 7) > 0 ? 1 : -1;
  for (const e of [-1, 1]) if (!gone || e === side) line(c + e * (w / 2 - 0.1), gt.y1, c + e * (w / 2 - 0.1) + sh, gt.y1 + 9, 0.3, 0.014);
  ctx.save(); ctx.translate(X(c + side * w / 2), Y(gt.y1 + (gone ? 0 : sh))); ctx.rotate(-a * side);
  const k = D.k, q = -side;
  for (let j = 0; j < 3; j++) {
    const y = (0.06 + j * 0.13) * k;
    for (const [lw2, v] of [[0.13, 0.03], [0.095, 0.42 + (j % 2) * 0.1]]) { ctx.strokeStyle = g(v); ctx.lineWidth = lw(lw2); ctx.beginPath(); for (let x = 0; x <= w + 0.01; x += 0.1) { const yy = y + Math.sin(x * 10 + j * Math.PI) * 0.025 * k; if (x === 0) ctx.moveTo(q * x * k, yy); else ctx.lineTo(q * x * k, yy); } ctx.stroke(); }
  }
  ctx.strokeStyle = g(0.14); ctx.lineWidth = lw(0.018);
  for (let x = 0.1; x < w; x += 0.2) { ctx.beginPath(); ctx.moveTo(q * x * k, 0); ctx.lineTo(q * (x + 0.04) * k, 0.4 * k); ctx.stroke(); }
  ctx.strokeStyle = g(0.5); for (let x = 0.15; x < w; x += 0.34) { ctx.beginPath(); ctx.moveTo(q * x * k, 0.4 * k); ctx.lineTo(q * (x + Math.sin(x * 9) * 0.05) * k, (0.6 + (x * 7 % 0.4)) * k); ctx.stroke(); }
  ctx.restore();
}
