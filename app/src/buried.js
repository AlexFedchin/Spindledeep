// What lies in the ground on purpose: old bones, shells, roots, broken pots, set into the rock under the floors and behind the
// walls. They are drawn first and flagged (blue channel), and the engraving shader cuts them into the rock's own lines, so they
// are lit and fade into the dark exactly as the rock does, and are not there at all where there is air or no light.
// Placed by the rock itself: every point of one has to be well inside it. Beasts above the Hush, people only from the Hush down.
import * as L from './level.js';
import { mulberry, TAU } from './util.js';

const tone = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},255,${a})`;      // v < 0.7: the shader tells them by blue - red
const BONE = 0.64, DIM = 0.52, INK = 0.0;

// half width and half height of each kind, metres (before scale)
const SIZE = {
  root: [0.75, 0.4], shell: [0.2, 0.2], shard: [0.28, 0.2], bone: [0.42, 0.12], pair: [0.44, 0.3], skull: [0.32, 0.2], ribs: [0.62, 0.36],
  spine: [0.75, 0.22], antler: [0.5, 0.36], fish: [0.48, 0.16], claw: [0.3, 0.2], hand: [0.3, 0.26], head: [0.24, 0.28],
};
// by depth: what may lie there, commonest first
const ZONES = [
  [-6, ['root', 'root', 'shell']],
  [-46, ['bone', 'shell', 'skull', 'root', 'pair', 'shard']],
  [-103, ['root', 'bone', 'root', 'skull', 'shard', 'ribs', 'antler']],
  [-150, ['bone', 'pair', 'ribs', 'antler', 'spine', 'skull']],
  [-208, ['fish', 'shell', 'fish', 'spine', 'bone']],
  [-262, ['bone', 'shard', 'pair', 'ribs', 'skull']],
  [-340, ['claw', 'pair', 'hand', 'spine', 'bone']],
  [-430, ['pair', 'ribs', 'hand', 'bone', 'spine']],
  [-600, ['ribs', 'head', 'pair', 'hand', 'spine']],
];

export function placeBuried(T) {
  const r = mulberry(1907), out = [];
  const X0 = L.WORLD.x0 + 3, X1 = L.WORLD.x0 + L.WORLD.w - 3, Y0 = L.WORLD.y0 + 6;
  for (let tries = 0; tries < 12000; tries++) {
    const x = X0 + r() * (X1 - X0), y = -0.6 + r() * (Y0 + 0.6), d = T.d(x, y);
    if (d > -0.45 || d < -1.0) continue;
    const zone = (ZONES.find((z) => y > z[0]) || ZONES[ZONES.length - 1])[1];
    const pick = r(), kind = zone[Math.floor(pick * Math.sqrt(pick) * zone.length)];
    const s = 1.2 + r() * 0.5, [hw, hh] = SIZE[kind], [gx, gy] = T.grad(x, y);
    // it lies along the rock face, give or take
    const rot = Math.atan2(-gx, gy) + (r() - 0.5) * 0.9, flip = r() < 0.5 ? -1 : 1, seed = (r() * 1e6) | 0;
    // far enough from the others, and from the hidden rooms' rock (which is gone once it has crumbled)
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 8)) continue;
    if (L.SECRETS.some((q) => x > q.hide[0] - 1 && x < q.hide[2] + 1 && y > q.hide[1] - 1 && y < q.hide[3] + 1)) continue;
    if (y > -456 && y < -430 && x < 45) continue;      // nothing under the top of the Loom
    if (L.SHELVES.some(([a, b, top]) => x > a - 1 && x < b + 1 && Math.abs(y - top) < 1.5)) continue;
    // behind a face she can pass: a room of air, not a pocket
    if (T.d(x + gx * (1.2 - d), y + gy * (1.2 - d)) < 0.7) continue;
    const c = Math.cos(rot), n = Math.sin(rot);
    let ok = true;
    for (let i = -2; i <= 2 && ok; i++) for (let j = -1; j <= 1; j++) {
      const px = i / 2 * hw * s, py = j * hh * s;
      if (T.d(x + px * c - py * n, y + px * n + py * c) > -0.22) { ok = false; break; }
    }
    if (ok) out.push({ kind, x, y, s, rot, flip, seed });
  }
  return out;
}

export function drawBuried(D, ctx) {

  for (const b of D.buried) {
    if (!D.vis(b.x, b.y, 1.2)) continue;
    const u = D.k * b.s;
    ctx.save();
    ctx.translate(D.sx(b.x), D.sy(b.y)); ctx.rotate(-b.rot); ctx.scale(u * b.flip, -u);          // metres, y up
    KIND[b.kind](new Stylus(ctx), mulberry(b.seed));
    ctx.restore();
  }
}

class Stylus {
  constructor(c) { this.c = c; }
  path(p, close) { const c = this.c; c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (close) c.closePath(); }
  ink(w = 0.02) { const c = this.c; c.strokeStyle = tone(INK); c.lineWidth = w; c.stroke(); }
  // a shape with an inked edge
  fill(v, w) { this.c.fillStyle = tone(v); this.c.fill(); this.ink(w); }
  poly(p, v, w) { this.path(p, true); this.fill(v, w); }
  ell(x, y, rx, ry, rot, v, w) { this.c.beginPath(); this.c.ellipse(x, y, rx, ry, rot, 0, TAU); this.fill(v, w); }
  hole(x, y, rx, ry, rot = 0) { this.c.beginPath(); this.c.ellipse(x, y, rx, ry, rot, 0, TAU); this.c.fillStyle = tone(INK); this.c.fill(); }
  // a tapering curved rod with an inked edge, as ribs and roots are
  rod(x0, y0, cx, cy, x1, y1, w0, w1, v) {
    const a = [], b = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, q = 1 - t, x = q * q * x0 + 2 * q * t * cx + t * t * x1, y = q * q * y0 + 2 * q * t * cy + t * t * y1;
      const dx = 2 * q * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * q * (cy - y0) + 2 * t * (y1 - cy), l = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) / 2;
      a.push([x - dy / l * w, y + dx / l * w]); b.unshift([x + dy / l * w, y - dx / l * w]);
    }
    this.poly([...a, ...b], v, Math.min(0.02, 0.008 + w0 * 0.2));
  }
  // a long bone between two points, knuckled at both ends
  bone(x0, y0, x1, y1, w, v) {
    const l = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / l, uy = (y1 - y0) / l;
    const P = (t, o) => [x0 + ux * t - uy * o, y0 + uy * t + ux * o];
    const k = w * 1.15;
    this.poly([P(-k * 0.3, k * 0.25), P(-k * 0.55, k * 0.75), P(0, k), P(k * 0.8, w * 0.5), P(l - k * 0.8, w * 0.45), P(l, k * 0.95), P(l + k * 0.55, k * 0.7), P(l + k * 0.3, 0),
      P(l + k * 0.5, -k * 0.7), P(l, -k * 0.9), P(l - k * 0.8, -w * 0.45), P(k * 0.8, -w * 0.5), P(0, -k * 0.95), P(-k * 0.5, -k * 0.65)], v, Math.min(0.02, 0.006 + w * 0.2));
  }
}

const KIND = {
  root(S, r) {
    const b = (r() - 0.5) * 0.3;
    S.rod(-0.75, 0.1, -0.1, 0.3 + b, 0.72, -0.16, 0.1, 0.02, 0.3);
    S.rod(-0.25, 0.14, 0.05, -0.1, 0.2, -0.36, 0.05, 0.012, 0.3);
    S.rod(0.15, 0.1, 0.4, 0.2, 0.62, 0.3, 0.04, 0.01, 0.3);
  },
  // a coiled shell from when all of this was under the sea
  shell(S) {
    S.ell(0, 0, 0.19, 0.18, 0, DIM);
    const c = S.c; c.beginPath();
    for (let a = 0; a < TAU * 2.4; a += 0.2) { const q = 0.18 * Math.exp(-a * 0.13); if (a) c.lineTo(Math.cos(a) * q, Math.sin(a) * q); else c.moveTo(q, 0); }
    S.ink(0.02);
    for (let a = 0; a < TAU; a += 0.42) { S.path([[Math.cos(a) * 0.17, Math.sin(a) * 0.165], [Math.cos(a + 0.12) * 0.115, Math.sin(a + 0.12) * 0.11]]); S.ink(0.012); }
  },
  shard(S) {
    S.poly([[-0.26, -0.08], [-0.2, 0.14], [0.02, 0.18], [0.1, 0.04], [0.02, -0.12]], DIM);
    S.path([[-0.23, 0.04], [0.06, 0.1]]); S.ink(0.014);
    S.poly([[0.14, -0.14], [0.16, 0.02], [0.28, 0.02], [0.26, -0.16]], DIM - 0.06);
  },
  bone(S) { S.bone(-0.36, 0, 0.36, 0.02, 0.085, BONE); },
  pair(S) { S.bone(-0.34, -0.16, 0.32, 0.18, 0.08, DIM); S.bone(-0.32, 0.18, 0.36, -0.1, 0.085, BONE); },
  // some long-jawed beast
  skull(S) {
    S.poly([[-0.3, -0.02], [-0.26, 0.11], [-0.12, 0.18], [0.02, 0.13], [0.16, 0.08], [0.31, 0.02], [0.3, -0.05], [0.08, -0.06], [-0.04, -0.12], [-0.2, -0.12]], BONE);
    S.hole(-0.06, 0.05, 0.055, 0.045, -0.2); S.hole(0.23, 0.02, 0.035, 0.016, -0.3);
    S.rod(-0.16, -0.13, 0.05, -0.2, 0.28, -0.1, 0.05, 0.025, DIM);
    for (let x = 0.1; x < 0.29; x += 0.045) { S.path([[x, -0.05], [x + 0.005, -0.085]]); S.ink(0.014); }
  },
  ribs(S, r) {
    for (let i = 0; i < 6; i++) {
      const x = -0.46 + i * 0.18, h = 0.5 + Math.sin((i + 0.8) / 6.6 * Math.PI) * 0.16, gone = r() < 0.18 ? 0.45 : 1;
      S.rod(x, 0.26, x + 0.24, 0.2 - h * 0.35, x + 0.06 * gone, 0.26 - h * gone, 0.05, 0.02, i % 2 ? BONE : DIM);
    }
    for (let i = 0; i < 9; i++) S.ell(-0.56 + i * 0.135, 0.28 + Math.sin(i * 0.5) * 0.02, 0.055, 0.05, 0.2, BONE, 0.016);
  },
  spine(S, r) {
    const b = (r() - 0.5) * 0.3;
    for (let i = 0; i < 12; i++) {
      const t = i / 11, x = -0.7 + t * 1.4, y = Math.sin(t * Math.PI) * b, s = 1.1 - t * 0.6;
      S.path([[x, y + 0.04 * s], [x - 0.06 * s, y + 0.14 * s]]); S.ink(0.05 * s); S.c.strokeStyle = tone(DIM); S.c.lineWidth = 0.03 * s; S.c.stroke();
      S.ell(x, y, 0.055 * s, 0.05 * s, 0, BONE, 0.016);
    }
  },
  antler(S) {
    S.rod(-0.46, -0.3, -0.2, 0.3, 0.46, 0.2, 0.08, 0.02, BONE);
    S.rod(-0.3, -0.02, -0.4, 0.15, -0.34, 0.34, 0.05, 0.015, BONE); S.rod(-0.06, 0.13, -0.08, 0.25, 0.0, 0.36, 0.045, 0.012, BONE); S.rod(0.18, 0.17, 0.2, 0.24, 0.28, 0.33, 0.04, 0.012, BONE);
  },
  fish(S) {
    S.rod(-0.2, 0.01, 0.1, 0.03, 0.36, 0, 0.035, 0.02, BONE);
    for (let i = 0; i < 9; i++) { const x = -0.14 + i * 0.05, h = 0.14 - i * 0.011; for (const e of [-1, 1]) S.rod(x, 0.015, x + 0.03, e * h * 0.6, x + 0.07, e * h, 0.018, 0.01, DIM); }
    S.poly([[-0.46, -0.01], [-0.36, 0.09], [-0.2, 0.1], [-0.19, -0.07], [-0.34, -0.08]], BONE); S.hole(-0.36, 0.02, 0.025, 0.025);
    S.poly([[0.35, 0.0], [0.48, 0.11], [0.45, 0.0], [0.48, -0.11]], DIM);
  },
  // finger bones, come loose
  claw(S, r) {
    for (let i = 0; i < 4; i++) { const x = -0.24 + i * 0.16, a = (r() - 0.5) * 0.7; S.bone(x, -0.14, x + Math.sin(a) * 0.15, 0.0, 0.05, i % 2 ? BONE : DIM); S.bone(x + Math.sin(a) * 0.22, 0.04, x + Math.sin(a) * 0.3, 0.14, 0.042, BONE); }
  },
  // the bones of a hand, spread
  hand(S) {
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.26, l = [0.15, 0.2, 0.22, 0.2, 0.15][i], cx = (i - 2) * 0.05;
      const P = (q) => [cx + Math.sin(a) * q, -0.14 + Math.cos(a) * q];
      S.bone(...P(0.02), ...P(0.02 + l * 0.55), 0.046, DIM); S.bone(...P(0.06 + l * 0.6), ...P(0.05 + l), 0.04, BONE); S.bone(...P(0.1 + l), ...P(0.07 + l * 1.4), 0.034, BONE);
    }
    S.bone(-0.05, -0.26, -0.03, -0.16, 0.06, DIM); S.bone(0.05, -0.26, 0.03, -0.16, 0.055, DIM);
  },
  // a skull lying on its side
  head(S) {
    S.poly([[-0.2, 0.02], [-0.2, 0.15], [-0.1, 0.25], [0.05, 0.26], [0.17, 0.17], [0.19, 0.04], [0.17, -0.03], [0.2, -0.09], [0.14, -0.12], [0.13, -0.2], [0.02, -0.22], [-0.02, -0.1], [-0.12, -0.06]], DIM);
    S.hole(0.1, 0.02, 0.05, 0.045); S.hole(0.175, -0.065, 0.018, 0.03); S.path([[0.04, -0.14], [0.14, -0.14]]); S.ink(0.018);
  },
};
