// What lives down here and takes notice of her: weak lights that grow on the rock (and answer a pluck, a step, the dark), beasts
// that run, hang, swim and hide, and, below them, loose ends of thread that turn toward her. No rules: nothing here touches her, and
// the world runs the same without it (main.js makes it beside the drawer). Beasts live only above the Hush; from the Hush down
// nothing does, and what moves is thread. Placed from the rock itself with a fixed seed, so a place is always the same place.
import * as L from './level.js';
import { clamp, mulberry, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;

// weak lights by place: [from y, to y, what, how far apart (m), colour, reach (m), strength]. `on`: which faces it likes
const GLOW = [
  [-8, -46, 'frost', 8.5, [0.62, 0.74, 0.95], 2.6, 0.15, 'wall'],
  [-46, -103, 'caps', 7.5, [0.62, 0.88, 0.74], 2.8, 0.22, 'floor'],
  [-104, -150, 'lichen', 10, [0.80, 0.84, 0.95], 2.8, 0.15, 'any'],
  [-150, -196, 'wetglow', 11, [0.55, 0.72, 0.86], 2.9, 0.15, 'wall'],
  [-209, -262, 'stub', 13, [1.0, 0.68, 0.36], 2.4, 0.2, 'floor'],
  [-262, -340, 'vein', 15, [0.72, 0.74, 0.82], 2.3, 0.1, 'any'],
  [-340, -430, 'ember', 13, [1.0, 0.6, 0.32], 2.4, 0.18, 'floor'],
  [-430, -536, 'lint', 15, [0.74, 0.72, 0.78], 2.6, 0.11, 'any'],
];
// beasts: [from y, to y, what, how many to look for a place for]
const BEASTS = [
  [8, -4, 'crow', 4], [-8, -60, 'bat', 11], [-46, -103, 'beetle', 34], [-46, -103, 'fly', 26], [-104, -147, 'bat', 9], [-104, -122, 'beetle', 14],
  [-150, -196, 'fish', 9], [-150, -190, 'bat', 5], [-209, -262, 'mouse', 16],
  [-262, -340, 'end', 46], [-340, -430, 'end', 34], [-430, -538, 'end', 40],
];
// (2026-11-27) east of the old world: bats and beetles in the Dry Falls, loose ends of thread in the Stores
const BEASTS_EAST = [[-150, -198, 'bat', 12], [-165, -197, 'beetle', 16], [-349, -412, 'end', 30]];

// walk from a point in the air to the nearest rock along a direction; null if too far
function cast(T, x, y, dx, dy, max) {
  let t = 0;
  for (let k = 0; k < 120 && t < max; k++) { const d = T.d(x + dx * t, y + dy * t); if (d < 0.03) return [x + dx * t, y + dy * t]; t += Math.max(d, 0.04); }
  return null;
}

export function growGlows(T) {
  const r = mulberry(2026), out = [], lamps = L.LIGHTS, pegs = L.PEGS;
  const taken = (x, y, m) => out.some((q) => Math.hypot(q.x - x, q.y - y) < m) || lamps.some((q) => Math.hypot(q.x - x, q.y - y) < m * 0.7 && q.i > 0.4)
    || pegs.some((q) => Math.hypot(q.x - x, q.y - y) < 3.5) || L.SECRETS.some((s) => x > s.hide[0] - 1 && x < s.hide[2] + 1 && y > s.hide[1] - 1 && y < s.hide[3] + 1)
    || L.THORNS.some(([a, b, yr]) => x > a - 2 && x < b + 2 && y < yr + 6 && y > yr - 12) || L.INK.some((k) => x > k.x0 && x < k.x1 && y < k.y + 0.6 && y > k.y - 8)
    || L.GATES.some((q) => x > q.x0 - 1 && x < q.x1 + 1 && y > q.y0 - 1.4 && y < q.y1 + 1.4) || (x < 46 && y < -420 && y > -452) || (y < -532);
  // (2026-11-27) the old world first, with its own seed, so nothing in it moves; then the ground east of it, seeded apart
  const pass = (r, xa, xw, n0) => { for (const [y0, y1, kind, gap, c, reach, i, on] of GLOW) {
    for (let n = 0; n < n0; n++) {
      const x = xa + r() * xw, y = y1 + r() * (y0 - y1), d = T.d(x, y);
      if (d < 0.5 || d > 7) continue;
      const a = on === 'floor' ? -Math.PI / 2 : on === 'wall' ? (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.7 : r() * TAU;
      const h = cast(T, x, y, Math.cos(a), Math.sin(a), 8);
      if (!h || h[1] > y0 || h[1] < y1) continue;
      const [nx, ny] = T.grad(h[0], h[1]);
      if (on === 'floor' && ny < 0.8) continue;
      if (on === 'wall' && Math.abs(nx) < 0.55) continue;
      if (taken(h[0], h[1], gap)) continue;
      out.push({ x: h[0], y: h[1], nx, ny, kind, c, r: reach, i, b: 1, seed: r(), ph: r() * TAU, dim: 0 });
    }
  } };
  pass(r, 2, 116, 2600);
  pass(mulberry(2027), L.OLD_W + 2, L.WORLD.w - L.OLD_W - 4, 2600);
  return out;
}

export class Life {
  constructor(W) {
    this.W = W;
    this.glows = W.glows;
    const T = W.T, r = mulberry(77);
    this.beasts = [];
    // (the ground east of the old world has its own list and seed: BEASTS_EAST)
    for (const [y0, y1, kind, n, east] of [...BEASTS, ...BEASTS_EAST.map((b) => [...b, true])]) {
      let left = n;
      const rr = east ? (this._re ||= mulberry(78)) : r;
      for (let k = 0; k < n * 60 && left > 0; k++) {
        const r = rr, x = east ? L.OLD_W + 3 + r() * (L.WORLD.w - L.OLD_W - 6) : 3 + r() * 114, y = y1 + r() * (y0 - y1), d = T.d(x, y);
        if (kind === 'fish') { const p = L.INK[0]; this.beasts.push({ kind, x: p.x0 + 4 + r() * (p.x1 - p.x0 - 8), y: p.y, t: r() * 20, seed: r(), vx: 0, dir: r() < 0.5 ? -1 : 1, up: 0, nx: 0, ny: 1 }); left--; continue; }
        if (kind === 'crow') { const gx = [33.4, 25.2, 47.0, 7.6][left - 1]; const gy = T.ground(gx, 9, 14); if (gy !== null) this.beasts.push({ kind, x: gx, y: gy, hx: gx, hy: gy, t: r() * 9, seed: r(), st: 'sit', vx: 0, vy: 0, flap: 0, face: r() < 0.5 ? -1 : 1, nx: 0, ny: 1 }); left--; continue; }
        if (d < 0.4 || d > 9) continue;
        const a = kind === 'bat' ? Math.PI / 2 + (r() - 0.5) * 0.5 : kind === 'mouse' ? -Math.PI / 2 : r() * TAU;
        const h = cast(T, x, y, Math.cos(a), Math.sin(a), 10);
        if (!h || h[1] < y1 || h[1] > y0) continue;
        const [nx, ny] = T.grad(h[0], h[1]);
        if (kind === 'bat' && ny > -0.75) continue;
        if (kind === 'mouse' && ny < 0.85) continue;
        if (L.SECRETS.some((s) => h[0] > s.hide[0] - 1 && h[0] < s.hide[2] + 1 && h[1] > s.hide[1] - 1 && h[1] < s.hide[3] + 1)) continue;
        if (kind === 'end' && (this.beasts.some((b) => b.kind === 'end' && Math.hypot(b.x - h[0], b.y - h[1]) < 2.4) || ny > 0.8 && r() < 0.6 || (h[0] < 46 && h[1] < -420 && h[1] > -452))) continue;
        const N = kind === 'bat' ? 1 + ((r() * 4) | 0) : 1;
        for (let q = 0; q < N; q++) this.beasts.push({ kind, x: h[0] + q * 0.22 - N * 0.1, y: h[1], hx: h[0] + q * 0.22 - N * 0.1, hy: h[1], nx, ny, t: r() * 20, seed: r(), st: 'sit', vx: 0, vy: 0, flap: r() * 6, face: r() < 0.5 ? -1 : 1, a: 0, len: 0.5 + r() * 0.9, tip: [0, 0], calm: 0, sp: 0 });
        left--;
      }
    }
    // a bat group's ones must each hang from their own bit of roof
    for (const b of this.beasts) if (b.kind === 'bat') { const h = cast(T, b.hx, b.hy - 0.5, 0, 1, 2); if (h) { b.hy = b.y = h[1]; } }
    this.sounds = [];
  }

  // how much light is on a spot: her, and the thread when it is near
  _lit(x, y) {
    const W = this.W, p = W.player;
    let l = p.dead ? 0 : Math.max(0, 1 - Math.hypot(p.x - x, p.y + 0.3 - y) / 4.2);
    const P = W.thread.poly, n = W.thread.polyN;
    for (let k = 0; k < n; k += 4) { const d = Math.abs(P[k * 5] - x) + Math.abs(P[k * 5 + 1] - y); if (d < 3) l = Math.max(l, (1 - d / 3) * 0.7); }
    return l;
  }

  update(dt, D) {
    const W = this.W, p = W.player, T = W.T, vis = (x, y, m = 4) => D.vis(x, y, m);
    if (!dt) return;
    const loud = this.loud = Math.max(0, (this.loud || 0) - dt * 1.4);
    const waves = W.thread.waves;
    const near = (x, y, m) => waves.some((w) => w.fx !== undefined && Math.hypot(w.fx - x, w.fy - y) < m);
    const speed = Math.hypot(p.vx, p.vy), calm = speed < 0.4 && !p.dead, sit = W.rest ? W.rest.k : 0;
    // ── weak lights ──
    for (const q of this.glows) {
      if (!vis(q.x, q.y, 6)) { q.b += (1 - q.b) * Math.min(1, dt); continue; }
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      let to = 0.75 + 0.25 * Math.sin(W.time * 0.8 + q.ph);
      const plant = q.kind === 'caps' || q.kind === 'lichen' || q.kind === 'wetglow' || q.kind === 'frost';
      if (near(q.x, q.y, 3.4)) q.sing = 1;                          // a pluck passing by
      q.sing = Math.max(0, (q.sing || 0) - dt * 0.4);
      if (plant) { to += q.sing * 2.4; if (d < 1.3 && speed > 1) { q.shut = 1; } q.shut = Math.max(0, (q.shut || 0) - dt * 0.3); to *= 1 - 0.75 * q.shut; } else to += q.sing * 0.8;
      to *= 1 + 0.8 * sit;
      if (q.kind === 'stub' && W.hallOut !== undefined) to = 0;         // (what goes past them on the way up puts them out)
      q.b += (to - q.b) * Math.min(1, dt * (to > q.b ? 5 : 1.6));
    }
    // ── beasts ──
    for (const b of this.beasts) {
      if (Math.hypot(b.x - p.x, b.y - p.y) > 34) { if (b.st === 'fly') { b.st = 'sit'; b.x = b.hx; b.y = b.hy; b.vx = b.vy = 0; } continue; }
      b.t += dt;
      const dx = p.x - b.x, dy = p.y + 0.2 - b.y, d = Math.hypot(dx, dy) || 1;
      const scare = near(b.x, b.y, 3.2) || (loud > 0.5 && d < 9) || (d < 2.6 && speed > 3);
      switch (b.kind) {
        case 'bat': case 'crow': {
          const bat = b.kind === 'bat';
          if (b.st === 'sit') {
            b.x = b.hx; b.y = b.hy; b.stir = clamp((b.stir || 0) + ((d < 5 ? 0.7 : -0.5)) * dt, 0, 1);
            const go = bat ? scare || (d < 2.2 && this._lit(b.x, b.y) > 0.35) : d < 3.4 || (d < 7 && speed > 4.4 && b.seed > 0.5);
            if (go && !sit) { b.st = 'fly'; b.ft = 0; b.vx = -dx / d * 3 + (b.seed - 0.5) * 3; b.vy = bat ? -2.2 : 3.4; this.say(bat ? 'cloth' : 'leaf', b, 0.16, bat ? 1.7 : 1.1); }
          } else {
            b.ft += dt; b.flap += dt * (bat ? 22 : 15);
            let tx, ty;
            if (b.ft < (bat ? 3.5 : 5) + b.seed * 3) { tx = b.x + Math.cos(b.ft * 1.9 + b.seed * 9) * 4 - dx / d * 2; ty = (bat ? b.hy - 1.6 : b.hy + 6) + Math.sin(b.ft * 2.7 + b.seed * 5) * 1.6; }
            else { tx = b.hx; ty = b.hy - (bat ? 0.1 : -0.1); if (Math.hypot(tx - b.x, ty - b.y) < 0.35) { b.st = 'sit'; b.face = b.vx < 0 ? -1 : 1; b.stir = 0; break; } if (d < 4 && b.ft < 16) { tx = b.x - dx; ty = b.hy + (bat ? -1.5 : 5); } }
            const l = Math.hypot(tx - b.x, ty - b.y) || 1, sp = bat ? 4.4 : 5.2;
            b.vx += ((tx - b.x) / l * sp - b.vx) * Math.min(1, dt * 2.6) + Math.sin(b.t * 9 + b.seed * 9) * dt * 12;
            b.vy += ((ty - b.y) / l * sp - b.vy) * Math.min(1, dt * 2.6) + Math.cos(b.t * 7 + b.seed * 7) * dt * 10;
            b.x += b.vx * dt; b.y += b.vy * dt;
            const q = T.d(b.x, b.y); if (q < 0.3 && b.ft > 0.3 && Math.hypot(b.hx - b.x, b.hy - b.y) > 0.6) { const [gx, gy] = T.grad(b.x, b.y); b.x += gx * (0.3 - q); b.y += gy * (0.3 - q); b.vx += gx * 2; b.vy += gy * 2; }
          }
          break;
        }
        case 'beetle': case 'mouse': {
          // it keeps to the rock's face. In the light it runs for the dark; let alone, and she still, it comes out to look at her
          const mouse = b.kind === 'mouse', lit = this._lit(b.x, b.y);
          let want = 0;
          const ax = -b.ny, ay = b.nx, along = dx * ax + dy * ay;       // the tangent, and which way along it she is
          if (scare || (lit > 0.42 && !calm)) { want = -Math.sign(along || 1) * (mouse ? 3.6 : 2.4); b.calm = 0; b.frozen = 0; if (!b.run) this.say(mouse ? 'scratch' : 'beetle', b, 0.1, 1.4); b.run = 1; }
          else {
            b.run = 0;
            b.calm = calm ? b.calm + dt : 0;
            if ((b.calm > 2.5 || sit > 0.4) && d < 9 && d > (sit ? 0.7 : 1.5)) want = Math.sign(along) * (mouse ? 0.9 : 0.55) * (Math.sin(b.t * 1.7 + b.seed * 9) > -0.1 ? 1 : 0);
            else if (Math.sin(b.t * 0.5 + b.seed * 20) > 0.55) want = (b.seed > 0.5 ? 1 : -1) * (Math.sin(b.t * 0.11 + b.seed * 6) > 0 ? 1 : -1) * (mouse ? 0.8 : 0.35);
          }
          b.sp += (want - b.sp) * Math.min(1, dt * 7);
          if (Math.abs(b.sp) > 0.02) {
            let nx = b.x + ax * b.sp * dt, ny = b.y + ay * b.sp * dt;
            for (let k = 0; k < 3; k++) { const q = T.d(nx, ny), [gx, gy] = T.grad(nx, ny); nx -= gx * (q - 0.03); ny -= gy * (q - 0.03); }
            const [gx, gy] = T.grad(nx, ny);
            if ((mouse && gy < 0.6) || Math.hypot(nx - b.hx, ny - b.hy) > 7 || Math.hypot(nx - b.x, ny - b.y) > 0.3) b.sp *= -0.2;
            else { b.x = nx; b.y = ny; b.nx += (gx - b.nx) * Math.min(1, dt * 12); b.ny += (gy - b.ny) * Math.min(1, dt * 12); b.face = b.sp > 0 ? 1 : -1; b.leg = (b.leg || 0) + Math.abs(b.sp) * dt * 26; }
          }
          break;
        }
        case 'fly': {
          // fireflies round the roots: they gather where she sits still, and go out when the thread is plucked
          const tx = calm && d < 8 ? p.x + Math.cos(b.t * 0.6 + b.seed * 9) * (1.4 - 0.4 * sit) : b.hx + Math.sin(b.t * 0.31 + b.seed * 9) * 2.6 + b.nx * 1.2;
          const ty = calm && d < 8 ? p.y + 0.8 + Math.sin(b.t * 0.83 + b.seed * 5) * 0.8 : b.hy + Math.cos(b.t * 0.43 + b.seed * 5) * 1.4 + b.ny * 1.4;
          b.x += clamp(tx - b.x, -1, 1) * dt * 0.9; b.y += clamp(ty - b.y, -1, 1) * dt * 0.9;
          const q = T.d(b.x, b.y); if (q < 0.25) { const [gx, gy] = T.grad(b.x, b.y); b.x += gx * (0.25 - q); b.y += gy * (0.25 - q); }
          if (scare) b.out = 3 + b.seed * 2;
          b.out = Math.max(0, (b.out || 0) - dt);
          break;
        }
        case 'fish': {
          // something under the ink that follows the light of the thread across it
          const pool = L.INK[0], over = p.y < pool.y + 12 && p.x > pool.x0 - 4 && p.x < pool.x1 + 4;
          let tx = b.x + b.dir * 3;
          if (over && d < 22) tx = p.x + (b.seed - 0.5) * 7;
          b.vx += (clamp(tx - b.x, -1, 1) * (over ? 1.5 : 0.5) - b.vx) * Math.min(1, dt * 0.8);
          b.x = clamp(b.x + b.vx * dt, pool.x0 + 1, pool.x1 - 1);
          if (b.x < pool.x0 + 2 || b.x > pool.x1 - 2) b.dir = -b.dir;
          if (T.d(b.x, pool.y) < 0.5) b.x -= b.vx * dt * 1.2;
          const rise = scare || (over && Math.sin(b.t * 0.7 + b.seed * 12) > 0.93);
          if (rise && b.up <= 0 && T.d(b.x, pool.y) > 0.6) { b.up = 1; if (vis(b.x, b.y)) { this.say('plop', b, 0.2, 0.7); } }
          b.up = Math.max(0, b.up - dt * 0.6);
          break;
        }
        case 'end': {
          // a loose end of thread in the wall: it turns to her light, shrinks from a pluck, and in the dark it hangs
          const lit = this._lit(b.x, b.y), see = d < 6 ? (1 - d / 6) : 0;
          const pull = scare ? -1 : see * (0.5 + 0.5 * clamp(lit * 2, 0, 1));
          b.a += (pull - b.a) * Math.min(1, dt * (scare ? 9 : 1.4));
          b.ta = [dx / d, dy / d];
          break;
        }
      }
    }
  }
  // a small sound of one of them, seldom (main.js plays them)
  say(group, b, vol, rate) { if ((this.quiet || 0) > this.W.time) return; this.quiet = this.W.time + 0.5; this.sounds.push({ group, x: b.x, y: b.y, vol, rate }); }

  draw(D, ctx, ectx) {
    const k = D.k, t = D.time, W = this.W;
    for (const q of this.glows) {
      if (!D.vis(q.x, q.y, 2) || W.hiddenAt(q.x, q.y)) continue;
      drawGlow(D, ctx, ectx, q, t, k);
    }
    for (const b of this.beasts) {
      if (!D.vis(b.x, b.y, 2)) continue;
      const X = D.sx(b.x), Y = D.sy(b.y);
      ctx.save(); ctx.translate(X, Y);
      if (b.kind === 'bat') drawBat(ctx, b, k, t);
      else if (b.kind === 'crow') drawCrow(ctx, b, k, t);
      else if (b.kind === 'beetle') drawBeetle(ctx, b, k);
      else if (b.kind === 'mouse') drawMouse(ctx, b, k, t);
      else if (b.kind === 'end') drawEnd(ctx, b, k, t);
      else if (b.kind === 'fish') drawFish(ctx, ectx, b, k, t, X, Y);
      ctx.restore();
      if (b.kind === 'fly') {
        const on = b.out > 0 ? 0 : Math.max(0, Math.sin(t * 1.1 + b.seed * 30)) ** 2;
        if (on < 0.02) continue;
        const R = 0.32 * k, gr = ectx.createRadialGradient(X, Y, 0, X, Y, R);
        gr.addColorStop(0, `rgba(215,255,190,${0.6 * on})`); gr.addColorStop(0.18, `rgba(150,220,140,${0.22 * on})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ectx.fillStyle = gr; ectx.fillRect(X - R, Y - R, 2 * R, 2 * R);
      }
    }
  }
}

// ── pictures ─────────────────────────────────────────────────────────────
function halo(ectx, X, Y, R, c, a) {
  const gr = ectx.createRadialGradient(X, Y, 0, X, Y, R), f = (m) => `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${m})`;
  gr.addColorStop(0, f(a)); gr.addColorStop(0.35, f(a * 0.25)); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ectx.fillStyle = gr; ectx.fillRect(X - R, Y - R, 2 * R, 2 * R);
}
function drawGlow(D, ctx, ectx, q, t, k) {
  const X = D.sx(q.x), Y = D.sy(q.y), r = mulberry((q.seed * 1e6) | 0), b = clamp(q.b, 0, 2.4), ink = Math.max(0.8, 0.018 * k);
  ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.atan2(q.nx, q.ny));       // up = out of the rock
  ctx.lineWidth = ink; ctx.strokeStyle = g(0.03);
  if (q.kind === 'caps') {
    for (let i = 0; i < 4; i++) {
      const x = (r() - 0.5) * 0.9 * k, h = (0.14 + r() * 0.28) * k * (1 - 0.35 * (q.shut || 0)), w = (0.06 + r() * 0.07) * k, lean = (r() - 0.5) * 0.12 * k;
      ctx.strokeStyle = g(0.5); ctx.lineWidth = Math.max(1, 0.03 * k); ctx.beginPath(); ctx.moveTo(x, 0.04 * k); ctx.quadraticCurveTo(x, -h * 0.5, x + lean, -h); ctx.stroke();
      ctx.fillStyle = g(0.8); ctx.strokeStyle = g(0.03); ctx.lineWidth = ink; ctx.beginPath(); ctx.ellipse(x + lean, -h, w, w * 0.65, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
      const c = Math.cos(Math.atan2(q.nx, q.ny)), s = Math.sin(Math.atan2(q.nx, q.ny)), gx = X + (x + lean) * c + h * s, gy = Y + (x + lean) * s - h * c;
      halo(ectx, gx, gy, w * 2.6, q.c, 0.28 * b);
    }
  } else if (q.kind === 'stub' || q.kind === 'ember') {
    const h = (q.kind === 'stub' ? 0.16 + r() * 0.16 : 0.1) * k, w = 0.055 * k;
    if (q.kind === 'stub') { ctx.fillStyle = g(0.8); ctx.beginPath(); ctx.rect(-w, -h, 2 * w, h + 0.05 * k); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, 0.02 * k, w * 2.1, w * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    else { ctx.fillStyle = g(0.3); ctx.beginPath(); ctx.moveTo(-0.12 * k, 0.03 * k); ctx.lineTo(-0.08 * k, -h); ctx.lineTo(0.08 * k, -h); ctx.lineTo(0.12 * k, 0.03 * k); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = g(0.06); ctx.beginPath(); ctx.arc(0, -h, 0.09 * k, Math.PI, TAU); ctx.stroke(); }
    const fl = 1 + Math.sin(t * 13 + q.ph) * 0.12 + Math.sin(t * 7.1 + q.ph * 2) * 0.1;
    halo(ectx, X, Y - h - 0.06 * k, 0.75 * k, q.c, 0.3 * Math.min(1.3, b) * fl);
    ectx.fillStyle = `rgba(255,215,150,${0.75 * Math.min(1, b)})`; ectx.beginPath(); ectx.ellipse(X, Y - h - 0.05 * k, 0.022 * k, 0.06 * k * fl, 0, 0, TAU); ectx.fill();
  } else if (q.kind === 'vein' || q.kind === 'lint') {
    // pale threads caught in the rock
    ctx.lineWidth = Math.max(0.8, 0.014 * k);
    for (let i = 0; i < 5; i++) {
      const x = (r() - 0.5) * 0.8 * k, l = (0.2 + r() * 0.5) * k, sw = Math.sin(t * 0.7 + q.ph + i) * 0.05 * k;
      ctx.strokeStyle = g(0.75); ctx.beginPath(); ctx.moveTo(x, 0.05 * k); ctx.bezierCurveTo(x + sw, -l * 0.4, x - sw * 2, -l * 0.8, x + sw * 2 + (r() - 0.5) * 0.2 * k, -l); ctx.stroke();
    }
    halo(ectx, X + q.nx * 0.2 * k, Y - q.ny * 0.2 * k, 0.7 * k, q.c, 0.08 * b);
  } else {
    // frost, lichen, wet glow: a patch of small flat discs along the face
    const n = q.kind === 'frost' ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 1.3 * k, s = (0.03 + r() * 0.06) * k * (1 - 0.4 * (q.shut || 0)), y = (0.02 - r() * 0.05) * k;
      ctx.fillStyle = g(0.62 + r() * 0.3); ctx.beginPath();
      if (q.kind === 'frost') { ctx.moveTo(x - s * 0.4, 0.04 * k); ctx.lineTo(x + (r() - 0.5) * s, y - s * 2.6); ctx.lineTo(x + s * 0.4, 0.04 * k); ctx.closePath(); } else ctx.ellipse(x, y, s * 1.3, s * 0.55, 0, 0, TAU);
      ctx.fill(); ctx.stroke();
    }
    halo(ectx, X + q.nx * 0.18 * k, Y - q.ny * 0.18 * k, 0.8 * k, q.c, 0.09 * b);
  }
  ctx.restore();
}
function drawBat(ctx, b, k, t) {
  const s = 0.17 * k * (0.85 + b.seed * 0.3);
  ctx.fillStyle = g(0.2); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(0.8, 0.016 * k);
  if (b.st === 'sit') {
    ctx.rotate(Math.sin(t * 1.1 + b.seed * 9) * 0.05 + Math.sin(t * 24) * 0.06 * (b.stir || 0));
    ctx.beginPath(); ctx.moveTo(0, -0.02 * k); ctx.bezierCurveTo(-s * 0.75, s * 0.4, -s * 0.6, s * 1.3, -s * 0.12, s * 1.75); ctx.lineTo(0, s * 1.55); ctx.lineTo(s * 0.12, s * 1.75); ctx.bezierCurveTo(s * 0.6, s * 1.3, s * 0.75, s * 0.4, 0, -0.02 * k); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = g(0.42); ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.2); ctx.lineTo(-s * 0.22, s * 1.3); ctx.moveTo(s * 0.1, s * 0.2); ctx.lineTo(s * 0.22, s * 1.3); ctx.stroke();
    if ((b.stir || 0) > 0.3) { ctx.fillStyle = g(0.95); ctx.beginPath(); ctx.arc(-s * 0.1, s * 1.45, s * 0.07, 0, TAU); ctx.arc(s * 0.1, s * 1.45, s * 0.07, 0, TAU); ctx.fill(); }
  } else {
    const f = Math.sin(b.flap);
    ctx.rotate(clamp(b.vx * 0.06, -0.5, 0.5));
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -s * 0.2); ctx.quadraticCurveTo(sd * s * 0.9, -s * (0.5 + f * 0.9), sd * s * 1.7, -s * f * 0.7); ctx.quadraticCurveTo(sd * s * 1.2, s * (0.15 - f * 0.3), sd * s * 0.9, s * 0.35); ctx.quadraticCurveTo(sd * s * 0.5, s * 0.1, 0, s * 0.3); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.26, s * 0.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
}
function drawCrow(ctx, b, k, t) {
  const s = 0.3 * k;
  ctx.fillStyle = g(0.1); ctx.strokeStyle = g(0.5); ctx.lineWidth = Math.max(0.8, 0.014 * k);
  if (b.st === 'sit') {
    ctx.scale(b.face, 1); const peck = Math.sin(t * 0.9 + b.seed * 9) > 0.86 ? 0.5 : 0;
    ctx.beginPath(); ctx.ellipse(0, -s * 0.62, s * 0.5, s * 0.3, 0.35, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.5); ctx.lineTo(-s * 0.95, -s * 0.2); ctx.lineTo(-s * 0.4, -s * 0.4); ctx.fill();
    ctx.save(); ctx.translate(s * 0.34, -s * 0.86); ctx.rotate(peck); ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * 0.16, -s * 0.06); ctx.lineTo(s * 0.46, s * 0.04); ctx.lineTo(s * 0.14, s * 0.08); ctx.fill(); ctx.fillStyle = g(0.85); ctx.beginPath(); ctx.arc(s * 0.06, -s * 0.04, s * 0.04, 0, TAU); ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.36); ctx.lineTo(-s * 0.08, 0); ctx.moveTo(s * 0.08, -s * 0.36); ctx.lineTo(s * 0.1, 0); ctx.stroke();
  } else {
    const f = Math.sin(b.flap); ctx.scale(b.vx < 0 ? -1 : 1, 1);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.18, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * 0.1, 0); ctx.quadraticCurveTo(-s * 0.3, -s * f, -s * 0.9, -s * f * 1.1); ctx.quadraticCurveTo(-s * 0.1, -s * f * 0.4, s * 0.2, 0); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.05); ctx.lineTo(s * 0.8, s * 0.02); ctx.lineTo(s * 0.4, s * 0.08); ctx.fill();
  }
}
function drawBeetle(ctx, b, k) {
  const s = 0.09 * k * (0.8 + b.seed * 0.5);
  ctx.rotate(Math.atan2(b.nx, b.ny)); ctx.scale(-b.face, 1);
  ctx.strokeStyle = g(0.4); ctx.lineWidth = Math.max(0.7, 0.012 * k);
  for (let i = -1; i <= 1; i++) { const a = Math.sin((b.leg || 0) + i * 2) * 0.35; ctx.beginPath(); ctx.moveTo(i * s * 0.5, -s * 0.4); ctx.lineTo(i * s * 0.8 + a * s, 0.02 * k); ctx.stroke(); }
  ctx.fillStyle = g(0.28); ctx.strokeStyle = g(0.03); ctx.beginPath(); ctx.ellipse(0, -s * 0.6, s, s * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = g(0.65); ctx.beginPath(); ctx.arc(-s * 0.1, -s * 0.55, s * 0.6, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.9, -s * 0.6); ctx.quadraticCurveTo(s * 1.3, -s * 1.1, s * 1.6, -s * 0.9 + Math.sin(b.t * 5) * s * 0.2); ctx.stroke();
}
function drawMouse(ctx, b, k, t) {
  const s = 0.15 * k;
  ctx.rotate(Math.atan2(b.nx, b.ny)); ctx.scale(-b.face, 1);
  ctx.strokeStyle = g(0.5); ctx.lineWidth = Math.max(0.8, 0.014 * k); ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 0.2); ctx.quadraticCurveTo(-s * 1.6, -s * 0.1 + Math.sin(t * 3 + b.seed * 9) * s * 0.3, -s * 2.0, -s * 0.5); ctx.stroke();
  ctx.fillStyle = g(0.48); ctx.strokeStyle = g(0.03); ctx.beginPath(); ctx.moveTo(-s * 0.9, 0); ctx.bezierCurveTo(-s * 1.0, -s * 0.9, s * 0.1, -s * 1.0, s * 0.6, -s * 0.55); ctx.lineTo(s * 1.15, -s * 0.2); ctx.quadraticCurveTo(s * 0.8, 0, s * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.72, s * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = g(0.02); ctx.beginPath(); ctx.arc(s * 0.82, -s * 0.36, s * 0.06, 0, TAU); ctx.fill();
}
function drawEnd(ctx, b, k, t) {
  // rooted in the rock; hangs down, sways, leans toward her
  const l = b.len, sw = Math.sin(t * 0.8 + b.seed * 9) * 0.07, pull = b.a, ta = b.ta || [0, 0];
  const up = Math.max(0, b.ny), rest = [b.nx * 0.35 + sw + up * (b.seed - 0.5) * 0.5, b.ny * 0.35 - 0.55 * (1 - up * 1.1)];
  const dir = [rest[0] + ta[0] * Math.max(0, pull) * 1.5 - ta[0] * Math.max(0, -pull) * 0.4, rest[1] + ta[1] * Math.max(0, pull) * 1.5 + Math.max(0, pull) * 0.35];
  const m = Math.hypot(dir[0], dir[1]) || 1, L1 = l * (1 - 0.5 * Math.max(0, -pull)), ex = dir[0] / m * L1, ey = dir[1] / m * L1;
  const mx = b.nx * L1 * 0.45 + ex * 0.25, my = b.ny * L1 * 0.45 + ey * 0.25, cr = Math.sin(t * 2.3 + b.seed * 20) * 0.06 * (0.3 + Math.max(0, pull));
  for (const [w, v] of [[0.045, 0.03], [0.024, 0.66]]) {
    ctx.strokeStyle = g(v); ctx.lineWidth = Math.max(0.8, w * k);
    ctx.beginPath(); ctx.moveTo(-b.nx * 0.06 * k, b.ny * 0.06 * k); ctx.bezierCurveTo(mx * k, -my * k, (ex * 0.75 + cr) * k, -(ey * 0.75 + cr) * k, (ex + cr) * k, -ey * k); ctx.stroke();
  }
  // frayed at the tip
  ctx.strokeStyle = g(0.66); ctx.lineWidth = Math.max(0.6, 0.01 * k);
  const an = Math.atan2(-ey, ex);
  for (const a of [-0.5, 0, 0.55]) { ctx.beginPath(); ctx.moveTo((ex + cr) * k, -ey * k); ctx.lineTo((ex + cr) * k + Math.cos(an + a) * 0.08 * k, -ey * k + Math.sin(an + a) * 0.08 * k); ctx.stroke(); }
}
function drawFish(ctx, ectx, b, k, t, X, Y) {
  // only what it does to the ink: a wake that follows, and now and then a back
  const a = clamp(Math.abs(b.vx) * 0.7, 0.1, 0.8);
  ctx.strokeStyle = g(0.8, a); ctx.lineWidth = Math.max(0.8, 0.02 * k);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0.02 * k); ctx.quadraticCurveTo(-Math.sign(b.vx || 1) * 0.5 * k, 0.02 * k, -Math.sign(b.vx || 1) * 1.1 * k, (0.02 + s * 0.06) * k); ctx.stroke(); }
  if (b.up > 0) {
    const h = Math.sin(b.up * Math.PI) * 0.22 * k;
    ctx.fillStyle = g(0.14); ctx.strokeStyle = g(0.6); ctx.beginPath(); ctx.ellipse(0, 0.04 * k, 0.55 * k, h, 0, Math.PI, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = g(0.8, b.up); ctx.beginPath(); ctx.ellipse(0, 0.04 * k, (0.7 + (1 - b.up) * 1.6) * k, 0.07 * k, 0, 0, TAU); ctx.stroke();
  }
}
