// The Dry Falls is not quite dry (the user, 2026-11-27): water still gathers on the stone teeth and drops, rings out on the floor, and the
// walls sweat along seams that glisten as the light catches them. Drawing only: nothing here touches her. Drips: L.WATER_DRIPS; the
// seams are found on the rock itself (a fixed seed), on walls and roofs east of the old world between the Falls' top and the Underway.
import * as L from './level.js';
import { mulberry, TAU, clamp } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;
const GRAV = 14;

function make(T) {
  // a drop hangs from the lowest point of the rock above the hint
  const drips = L.WATER_DRIPS.map(([x, y], i) => {
    let ty = y; for (let k = 0; k < 200 && T.d(x, ty) > 0; k++) ty += 0.05;
    for (let k = 0; k < 200 && T.d(x, ty) < 0.01; k++) ty -= 0.02;
    const fy = T.ground(x, ty - 0.1, 40);
    return { x, y: ty, floor: fy ?? ty - 30, t: (i * 0.37) % 1 * 3, per: 2.4 + ((i * 0.61) % 1) * 3.2, fall: null, rings: [], i };
  });
  // seams: start on a wall or roof, run down the face
  const r = mulberry(31), seeps = [];
  for (let n = 0; n < 6000 && seeps.length < 80; n++) {
    const x = L.OLD_W + 1 + r() * (L.WORLD.w - L.OLD_W - 4), y = -150 - r() * 48, d = T.d(x, y);
    if (d < 0.1 || d > 4) continue;
    const [gx, gy] = T.grad(x, y);
    let px = x - gx * d, py = y - gy * d;
    const [nx, ny] = T.grad(px, py);
    if (ny > 0.45) continue;                                                  // not on floors
    if (seeps.some((q) => Math.hypot(q.x - px, q.y - py) < 2.6)) continue;
    const pts = [[px, py]], seed = r();
    for (let s = 0; s < 40; s++) {
      const [ax, ay] = T.grad(px, py);
      let tx = -ay, ty = ax; if (ty > 0) { tx = -tx; ty = -ty; }           // along the face, downhill
      if (ty > -0.25) break;                                                  // the face has levelled out: the seam ends
      px += tx * 0.13 + (r() - 0.5) * 0.04; py += ty * 0.13;
      const dd = T.d(px, py); px -= ax * (dd - 0.015); py -= ay * (dd - 0.015);
      pts.push([px, py]);
    }
    if (pts.length < 7) continue;
    seeps.push({ x: pts[0][0], y: pts[0][1], pts, seed, w: 0.03 + 0.04 * r() });
  }
  return { drips, seeps };
}

export function drawFalls(D, ctx, ectx) {
  const c = D.cam;
  if (c[0] + D.viewW / 2 < L.OLD_W - 14 || c[1] > -138 || c[1] < -214) return;
  const F = (D.falls ||= make(D.w.T)), k = D.k, t = D.time, dt = Math.min(0.05, D.dtLast || 0), X = (x) => D.sx(x), Y = (y) => D.sy(y);
  const lw = (m) => Math.max(0.6, m * k);
  // the seams: a dark wet stain down the stone, a wet line in it, and glints that slide down it
  for (const s of F.seeps) {
    if (!D.vis(s.x, s.y - 1.5, 5)) continue;
    const P = s.pts;
    ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.strokeStyle = g(0.05, 0.55); ctx.lineWidth = lw(s.w * 2.2); ctx.stroke();
    ctx.strokeStyle = g(0.62, 0.7); ctx.lineWidth = lw(0.012); ctx.stroke();
    for (let q = 0; q < 2; q++) {
      const u = ((t * (0.08 + 0.05 * s.seed) + s.seed + q * 0.5) % 1) * (P.length - 1), j = Math.floor(u), f = u - j, a = P[j], b = P[Math.min(P.length - 1, j + 1)];
      const gx = X(a[0] + (b[0] - a[0]) * f), gy = Y(a[1] + (b[1] - a[1]) * f);
      ctx.fillStyle = g(0.95); ctx.beginPath(); ctx.arc(gx, gy, Math.max(0.8, 0.018 * k), 0, TAU); ctx.fill();
      ectx.fillStyle = 'rgba(190,210,235,0.28)'; ectx.beginPath(); ectx.arc(gx, gy, Math.max(1.2, 0.05 * k), 0, TAU); ectx.fill();
    }
  }
  // the drips: a bead swells on the tip, lets go, falls, and rings out on the floor
  for (const d of F.drips) {
    const near = D.vis(d.x, (d.y + d.floor) / 2, Math.abs(d.y - d.floor) / 2 + 4);
    d.t += dt;
    if (!d.fall && d.t > d.per) { d.fall = { y: d.y - 0.03, v: 0 }; d.t = 0; }
    if (d.fall) {
      d.fall.v += GRAV * dt; d.fall.y -= d.fall.v * dt;
      if (d.fall.y <= d.floor) {
        d.rings.push({ t: 0 }); d.fall = null;
        if (near) {
          D.spawn('grit', d.x, d.floor + 0.04, 3, { speed: 0.9, vy: 1.4, life: 0.5, r: 0.5 });
          if (Math.abs(d.x - D.w.player.x) < 16 && Math.abs(d.floor - D.w.player.y) < 10) D.w.emit('waterdrip', { x: d.x, y: d.floor });
        }
      }
    }
    for (const q of d.rings) q.t += dt;
    d.rings = d.rings.filter((q) => q.t < 1.4);
    if (!near) continue;
    const bead = d.fall ? 0.2 : clamp(d.t / d.per, 0, 1);
    ctx.fillStyle = g(0.9); ctx.strokeStyle = g(0.05); ctx.lineWidth = lw(0.008);
    ctx.beginPath(); ctx.ellipse(X(d.x), Y(d.y - 0.02 - 0.03 * bead), (0.012 + 0.02 * bead) * k, (0.016 + 0.034 * bead) * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ectx.fillStyle = `rgba(200,220,240,${0.12 + 0.25 * bead})`; ectx.beginPath(); ectx.arc(X(d.x), Y(d.y - 0.04), Math.max(1, 0.05 * k), 0, TAU); ectx.fill();
    if (d.fall) {
      const len = clamp(d.fall.v * 0.035, 0.03, 0.4);
      ctx.strokeStyle = g(0.92); ctx.lineWidth = lw(0.022); ctx.beginPath(); ctx.moveTo(X(d.x), Y(d.fall.y + len)); ctx.lineTo(X(d.x), Y(d.fall.y)); ctx.stroke();
      ectx.strokeStyle = 'rgba(200,220,240,0.35)'; ectx.lineWidth = Math.max(1, 0.03 * k); ectx.beginPath(); ectx.moveTo(X(d.x), Y(d.fall.y + len)); ectx.lineTo(X(d.x), Y(d.fall.y)); ectx.stroke();
    }
    // a little wet patch where they land, and the rings going out over it
    ctx.fillStyle = g(0.08, 0.6); ctx.beginPath(); ctx.ellipse(X(d.x), Y(d.floor + 0.01), 0.28 * k, 0.035 * k, 0, 0, TAU); ctx.fill();
    for (const q of d.rings) {
      const a = 1 - q.t / 1.4, rr = 0.06 + q.t * 0.32;
      ctx.strokeStyle = g(0.85, a * 0.8); ctx.lineWidth = lw(0.01); ctx.beginPath(); ctx.ellipse(X(d.x), Y(d.floor + 0.015), rr * k, rr * 0.16 * k, 0, 0, TAU); ctx.stroke();
    }
  }
}
