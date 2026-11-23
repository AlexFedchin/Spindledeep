// The deep's machinery, below the Hall of Chairs: rings swinging on chains, ropes and warp threads to climb, the
// knitted hands in the Hush's walls, the heddles and needles that slam, and the cloth that rises in the Loom.
// Rules only (world.js calls it; draw.js draws it); it emits events through the world like everything else.
import * as L from './level.js';
import { clamp } from './util.js';

const TAU = Math.PI * 2;
// a stamper's cycle, as a fraction of its period: at rest, shaking (the warning), the slam, held, drawn back
const REST = 0.42, SHAKE = 0.64, SLAM = 0.69, HOLD = 0.8;

export class Deep {
  constructor(W) {
    this.W = W;
    const T = W.T;
    this.ropes = L.ROPES.map(([x, y0, y1], i) => ({ x, y0, y1, i, warp: y0 < -430 }));
    // each hand grows out of the nearest rock, along its face
    this.hands = L.HANDS.map(([x, y, reach], i) => {
      let px = x, py = y;
      for (let k = 0; k < 120; k++) {
        const d = T.d(px, py);
        if (d < 0.04) break;
        const [gx, gy] = T.grad(px, py);
        px -= gx * Math.min(d, 0.2); py -= gy * Math.min(d, 0.2);
      }
      const [nx, ny] = T.grad(px, py);
      return { ax: px, ay: py, nx, ny, reach, ext: 0, tx: px, ty: py, dx: nx, dy: ny, i, grab: false, seen: false };
    });
    this.stampers = L.STAMPERS.map((s, i) => ({ ...s, i, f: 0, shake: 0, phase: 'rest' }));
    this.rise = { ...L.RISE, level: L.RISE.y0, on: false, t: 0, done: false, woke: false };
    this.lastPluck = -99;
  }

  // before the doll moves: rings swing and drag any thread caught in them along
  pre() {
    const W = this.W, t = W.time;
    for (const h of W.hooks) {
      if (!h.sway) continue;
      const [len, amp, per, ph] = h.sway;
      const a = amp * Math.sin(TAU * t / per + ph);
      h.x = h.ax + len * Math.sin(a); h.y = h.ay - len * Math.cos(a);
      h.a = a;
    }
    for (const q of W.thread.pivots) if (q.hook && q.hook.sway) { q.x = q.hook.x; q.y = q.hook.y; }
  }

  onPluck() {
    this.lastPluck = this.W.time;
    const p = this.W.player;
    for (const h of this.hands) if (Math.hypot(h.ax - p.x, h.ay - p.y) < 12 && h.ext > 0.3) { h.ext = Math.max(0, h.ext - 3.5); this.W.emit('recoil', { x: h.tx, y: h.ty }); }
  }

  onRespawn() {
    for (const h of this.hands) { h.ext = 0; h.grab = false; }
    const r = this.rise;
    if (r.on || r.level > r.y0) { r.on = false; r.t = 0; r.level = Math.max(r.y0, Math.min(r.level, this.W.checkpoint.y - r.back)); }
  }

  update(dt) {
    const W = this.W, p = W.player, t = W.time;
    // ── hands: they reach for anything that stays quiet ──
    const lit = W.bells.filter((b) => b.lit > 0.5);
    const calm = t - this.lastPluck < 3.2;
    for (const h of this.hands) {
      const dx = p.x - h.ax, dy = p.y + 0.1 - h.ay, d = Math.hypot(dx, dy);
      if (h.grab) { h.tx = p.x; h.ty = p.y; continue; }
      const nearBell = lit.some((b) => Math.hypot(b.x - h.ax, b.y + 1 - h.ay) < 7 || Math.hypot(b.x - p.x, b.y + 1 - p.y) < 5.5);
      const want = !p.dead && !W.ending && d < h.reach + 0.6 && !calm && !nearBell && dx * h.nx + dy * h.ny > 0;
      if (want) {
        if (h.ext < 0.05) W.emit('reach', { x: h.ax, y: h.ay });
        h.ext = Math.min(Math.min(h.reach, d + 0.2), h.ext + dt * 3.4);
        // the arm leans toward the doll, out of the wall
        const ux = dx / (d || 1), uy = dy / (d || 1);
        h.dx += (ux - h.dx) * Math.min(1, dt * 4); h.dy += (uy - h.dy) * Math.min(1, dt * 4);
      } else {
        h.ext = Math.max(0, h.ext - dt * (calm || nearBell ? 9 : 5));
        h.dx += (h.nx - h.dx) * Math.min(1, dt * 2); h.dy += (h.ny - h.dy) * Math.min(1, dt * 2);
      }
      const l = Math.hypot(h.dx, h.dy) || 1;
      h.tx = h.ax + h.dx / l * h.ext; h.ty = h.ay + h.dy / l * h.ext;
      if (!p.dead && !W.ending && Math.hypot(h.tx - p.x, h.ty - p.y - 0.1) < 0.55) { h.grab = true; W._die('hands'); }
    }
    // ── heddles and needles ──
    for (const s of this.stampers) {
      const u = ((t + s.ph) / s.per) % 1;
      const prev = s.phase;
      if (u < REST) { s.f = 0; s.shake = 0; s.phase = 'rest'; }
      else if (u < SHAKE) { s.f = 0; s.shake = (u - REST) / (SHAKE - REST); s.phase = 'shake'; }
      else if (u < SLAM) { s.f = (u - SHAKE) / (SLAM - SHAKE); s.shake = 0; s.phase = 'slam'; }
      else if (u < HOLD) { s.f = 1; s.phase = 'hold'; }
      else { s.f = 1 - (u - HOLD) / (1 - HOLD); s.phase = 'back'; }
      const near = Math.hypot((s.r[0] + s.r[2]) / 2 + s.dir[0] * s.dist / 2 - p.x, (s.r[1] + s.r[3]) / 2 + s.dir[1] * s.dist / 2 - p.y) < 22;
      if (near && prev !== s.phase) {
        if (s.phase === 'shake') W.emit('stampWarn', { x: s.r[0], y: s.r[1], kind: s.kind });
        if (s.phase === 'hold') W.emit('stamp', { x: (s.r[0] + s.r[2]) / 2 + s.dir[0] * s.dist, y: s.r[1] + s.dir[1] * s.dist, kind: s.kind });
      }
      if (!p.dead && !W.ending && s.f > 0.12) {
        const [x0, y0, x1, y1] = this.swept(s);
        const cx = clamp(p.x, x0, x1), cy = clamp(p.y, y0, y1);
        if (Math.hypot(p.x - cx, p.y - cy) < p.r * 0.9) W._die(s.kind === 'needle' ? 'needle' : 'crushed');
      }
    }
    // ── the cloth rising in the Loom ──
    const r = this.rise, ci = W.checkpoint.i;
    if (W.ending && !r.done) { r.done = true; r.on = false; }
    if (ci === r.stop && !r.done) { r.done = true; r.on = false; W.emit('riseStop', { x: p.x, y: p.y }); }
    if (!r.on && !r.done && ci >= r.peg && ci < r.stop && !p.dead && Math.hypot(p.x - W.checkpoint.x, p.y - W.checkpoint.y) > 2.5) {
      r.on = true; r.t = 0;
      W.emit('rise', { first: !r.woke, x: p.x, y: p.y });
      r.woke = true;
    }
    if (r.on) {
      r.t += dt;
      if (r.t > r.delay) r.level = Math.min(r.y1, r.level + r.speed * dt);
      // it takes her once it has really risen and closed over her (the floor it starts from is not flat to the centimetre)
      if (!p.dead && r.level > r.y0 + 0.4 && p.y < r.level - 0.25 && p.x > r.x0 && p.x < r.x1) W._die('cloth');
    } else if (r.done) r.level = Math.max(r.y0, r.level - dt * 0.6);
  }

  // the stamper's whole body at this moment (rest rect stretched along its direction)
  swept(s) {
    const [x0, y0, x1, y1] = s.r, e = s.dist * s.f;
    const ex = s.dir[0] * e, ey = s.dir[1] * e;
    return [Math.min(x0, x0 + ex), Math.min(y0, y0 + ey), Math.max(x1, x1 + ex), Math.max(y1, y1 + ey)];
  }

  ropeNear(x, y, m = 0.6) {
    for (const r of this.ropes) if (Math.abs(x - r.x) < m && y > r.y0 - 0.2 && y < r.y1 + 0.4) return r;
    return null;
  }
}
