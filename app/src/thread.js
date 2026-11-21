// The red thread. Particles from home (index 0) to the doll:
//   [0, fixedN)       tied down behind the last peg: frozen, safe, dimmer
//   [liveStart, n)    the warm part since the last peg: simulated (Verlet), chewable
//   dead[i]           severed thread (moths, ink): grey, gives no light
// While gripped, the live part ends at a pivot particle and the rest is a taut polyline through
// `pivots` (rock corners it wrapped around, hooks it snagged) to the doll, of free length `Lfree`.
import { clamp } from './util.js';

export const SP = 0.25;            // rest spacing (m)
const CAP = 6000;
const GRAV = -16;
const RAD = 0.05;

export class Thread {
  constructor(T) {
    this.T = T;
    this.x = new Float32Array(CAP); this.y = new Float32Array(CAP);
    this.ox = new Float32Array(CAP); this.oy = new Float32Array(CAP);
    this.wear = new Float32Array(CAP); this.contact = new Uint8Array(CAP); this.dead = new Uint8Array(CAP);
    this.poly = new Float32Array(CAP * 5 + 80); // x, y, state, arc-from-doll, wear
    this.polyN = 0;
    this.waves = [];
    this.reset(0, 0);
  }

  reset(ax, ay) {
    this.n = 1; this.fixedN = 1; this.liveStart = 1; this.anchored = true;
    this.x[0] = this.ox[0] = ax; this.y[0] = this.oy[0] = ay;
    this.dead.fill(0); this.wear.fill(0);
    this.locked = false; this.forced = false; this.pivots = []; this.Lfree = 0;
  }

  _push(px, py) {
    if (this.n >= CAP - 2) return false;
    const i = this.n++;
    this.x[i] = this.ox[i] = px; this.y[i] = this.oy[i] = py;
    this.wear[i] = 0; this.contact[i] = 0; this.dead[i] = 0;
    return true;
  }
  get anchorIdx() { return this.liveStart - 1; }

  // yarn spent since the last peg (what the doll's body pays for)
  used(bx, by) {
    let L = Math.max(0, this.n - this.liveStart) * SP;
    if (this.locked) {
      for (let k = 1; k < this.pivots.length; k++) L += Math.hypot(this.pivots[k].x - this.pivots[k - 1].x, this.pivots[k].y - this.pivots[k - 1].y);
      L += this.Lfree;
    } else {
      const l = this.n - 1;
      L += Math.hypot(bx - this.x[l], by - this.y[l]);
    }
    return L;
  }

  // ── tie / mend / cut / respawn ─────────────────────────────────────────
  tie(px, py) {
    if (this.locked) this.release(px, py);
    if (!this.anchored) {
      // a loose end tied to a peg: the free piece becomes part of the tied path
      for (let i = this.liveStart; i < this.n; i++) this.dead[i] = 0;
    }
    this._push(px, py);
    this.fixedN = this.n; this.liveStart = this.n; this.anchored = true;
  }
  // the loose end near the dead end: join them again
  mendIndex() {
    // last dead particle in the active stretch (the severed end), if any
    for (let i = this.liveStart - 1; i >= this.fixedN; i--) if (this.dead[i]) return i;
    return -1;
  }
  mend() {
    const k = this.mendIndex();
    if (k < 0) return;
    for (let i = this.fixedN; i <= k; i++) { this.dead[i] = 0; this.wear[i] = 0; }
    this.n = k + 1; this.liveStart = this.fixedN; this.anchored = true;
  }
  cut(i) {
    if (i < this.liveStart || i >= this.n) return;
    if (this.locked) { this.locked = false; this.forced = false; this.pivots = []; }
    for (let j = this.liveStart; j <= i; j++) this.dead[j] = 1;
    this.liveStart = i + 1;
    this.anchored = false;
  }
  // drop everything after the last peg (death)
  rewind() {
    this.n = this.fixedN; this.liveStart = this.fixedN; this.anchored = true;
    this.locked = false; this.forced = false; this.pivots = [];
    for (let i = this.fixedN; i < CAP && i < this.n + 4; i++) this.dead[i] = 0;
  }

  // ── grip: freeze the thread at its last contact; the doll hangs from it ───────
  grip(bx, by, forced = false, slack = 0) {
    if (!this.anchored || this.locked) return false;
    let i0 = this.anchorIdx;
    for (let i = this.n - 1; i >= this.liveStart; i--) {
      if (this.contact[i] && Math.hypot(this.x[i] - bx, this.y[i] - by) > 0.45) { i0 = i; break; }
    }
    let arc = 0;
    for (let i = i0 + 1; i < this.n; i++) arc += Math.hypot(this.x[i] - this.x[i - 1], this.y[i] - this.y[i - 1]);
    arc += Math.hypot(bx - this.x[this.n - 1], by - this.y[this.n - 1]);
    this.n = i0 + 1;
    const p = this._clear(this.x[i0], this.y[i0]);
    this.pivots = [{ x: p[0], y: p[1], sign: 0, hook: null }];
    const straight = Math.hypot(bx - p[0], by - p[1]);
    this.Lfree = Math.max(straight, Math.min(arc, straight + 2.5)) + slack;
    this.locked = true; this.forced = forced;
    return true;
  }
  release(bx, by) {
    if (!this.locked) return;
    const pts = this.pivots.map((p) => [p.x, p.y]);
    pts.push([bx, by]);
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [cx, cy] = pts[k];
      const L = Math.hypot(cx - ax, cy - ay), m = Math.floor(L / SP);
      for (let j = 1; j <= m; j++) { const t = (j * SP) / Math.max(L, 1e-6); this._push(ax + (cx - ax) * t, ay + (cy - ay) * t); }
    }
    this.locked = false; this.forced = false; this.pivots = [];
  }
  _clear(px, py, want = 0.14) {
    let x = px, y = py;
    for (let k = 0; k < 4; k++) {
      const d = this.T.d(x, y);
      if (d >= want) break;
      const [gx, gy] = this.T.grad(x, y);
      x += gx * (want - d + 0.01); y += gy * (want - d + 0.01);
    }
    return [x, y];
  }
  hasHook(h) { return this.pivots.some((p) => p.hook === h); }
  snag(h, bx, by) {
    const P = this.pivots[this.pivots.length - 1];
    const sign = (h.x - P.x) * (by - h.y) - (h.y - P.y) * (bx - h.x);
    this.pivots.push({ x: h.x, y: h.y, sign: sign || 1, hook: h });
    this.Lfree = Math.max(0.8, Math.hypot(bx - h.x, by - h.y));
  }
  // wrap around rock corners / unwrap when the thread swings back past them
  wrap(bx, by) {
    const T = this.T;
    // unwrap
    while (this.pivots.length > 1) {
      const C = this.pivots[this.pivots.length - 1], A = this.pivots[this.pivots.length - 2];
      if (C.hook) break;   // a thread through a ring stays through it, however far back she swings
      const s = (C.x - A.x) * (by - C.y) - (C.y - A.y) * (bx - C.x);
      if (s * C.sign < 0) {
        this.pivots.pop();
        this.Lfree += Math.hypot(C.x - A.x, C.y - A.y);
      } else break;
    }
    // wrap
    for (let guard = 0; guard < 3; guard++) {
      const P = this.pivots[this.pivots.length - 1];
      const dx = bx - P.x, dy = by - P.y, L = Math.hypot(dx, dy);
      if (L < 0.6) return;
      // march, ignoring the first bit next to the pivot
      let hit = false, mt = 0, md = 1e9;
      for (let k = 1; k < 28; k++) {
        const t = 0.25 / L + (1 - 0.35 / L) * (k / 28);
        const d = T.d(P.x + dx * t, P.y + dy * t);
        if (d < md) { md = d; mt = t; }
        if (d < 0.02) hit = true;
      }
      if (!hit) return;
      const c = this._clear(P.x + dx * mt, P.y + dy * mt, 0.16);
      const dc = Math.hypot(c[0] - P.x, c[1] - P.y);
      if (dc < 0.3 || Math.hypot(bx - c[0], by - c[1]) < 0.35) return;
      const sign = (c[0] - P.x) * (by - c[1]) - (c[1] - P.y) * (bx - c[0]);
      this.pivots.push({ x: c[0], y: c[1], sign: sign || 1, hook: null });
      this.Lfree = Math.max(0.4, this.Lfree - dc);
    }
  }
  // keep the doll within Lfree of the top pivot. returns [nx, ny, overshoot] or null
  constrain(bx, by) {
    const P = this.pivots[this.pivots.length - 1];
    const dx = bx - P.x, dy = by - P.y, d = Math.hypot(dx, dy);
    if (d <= this.Lfree || d < 1e-6) return null;
    return [dx / d, dy / d, d - this.Lfree];
  }

  // ── per-frame: pay out, take up slack, simulate the warm part ─────────
  update(dt, bx, by, budgetLeft, wantFree) {
    const T = this.T;
    if (!this.locked) {
      // take up slack when the doll walks back along its thread
      for (let g = 0; g < 4; g++) {
        const last = this.n - 1;
        if (last < this.liveStart) break;
        const pi = last - 1;
        const d1 = Math.hypot(bx - this.x[pi], by - this.y[pi]);
        if (d1 < 0.5 && (pi >= this.liveStart - 1 || !this.anchored)) { this.n--; } else break;
      }
      // pay out
      let budget = budgetLeft;
      for (let g = 0; g < 40; g++) {
        const last = this.n - 1;
        const lx = this.x[last], ly = this.y[last];
        const d = Math.hypot(bx - lx, by - ly);
        if (d <= (g === 0 ? 0.55 : 0.3)) break;
        if (budget <= 0) break;
        if (!this.anchored && this.liveStart >= this.n) { this._push(bx, by); break; }
        this._push(lx + (bx - lx) * SP / d, ly + (by - ly) * SP / d);
        budget -= SP;
      }
    }
    // Verlet on the live stretch
    const s0 = this.liveStart, n = this.n;
    if (n - s0 > 0) {
      const g = GRAV * dt * dt;
      for (let i = s0; i < n; i++) {
        const vx = (this.x[i] - this.ox[i]) * 0.985, vy = (this.y[i] - this.oy[i]) * 0.985;
        this.ox[i] = this.x[i]; this.oy[i] = this.y[i];
        this.x[i] += vx; this.y[i] += vy + g;
        this.contact[i] = 0;
      }
      const endX = this.locked ? null : bx, endY = by;
      for (let it = 0; it < 12; it++) {
        // pinned end at the doll (or at the pivot particle when gripped: last particle is fixed)
        if (endX !== null) {
          const l = n - 1;
          if (l >= s0) {
            const dx = endX - this.x[l], dy = endY - this.y[l], d = Math.hypot(dx, dy);
            if (d > SP) { const k = (d - SP) / d; this.x[l] += dx * k; this.y[l] += dy * k; }
          }
        }
        for (let i = Math.max(s0, 1); i < n; i++) {
          const j = i - 1;
          const fixedJ = j < s0 && this.anchored ? true : j < s0 ? null : false;
          if (fixedJ === null) continue;            // severed start: no constraint behind it
          const fixedI = this.locked && i === n - 1; // the grip pivot particle holds still
          const dx = this.x[i] - this.x[j], dy = this.y[i] - this.y[j], d = Math.hypot(dx, dy);
          if (d <= SP || d < 1e-6) continue;
          const diff = (d - SP) / d;
          if (fixedJ && fixedI) continue;
          if (fixedJ) { this.x[i] -= dx * diff; this.y[i] -= dy * diff; }
          else if (fixedI) { this.x[j] += dx * diff; this.y[j] += dy * diff; }
          else { this.x[i] -= dx * diff * 0.5; this.y[i] -= dy * diff * 0.5; this.x[j] += dx * diff * 0.5; this.y[j] += dy * diff * 0.5; }
        }
        if (it % 3 === 2 || it === 11) {
          for (let i = s0; i < n; i++) {
            const d = T.d(this.x[i], this.y[i]);
            if (d < RAD) {
              const [gx, gy] = T.grad(this.x[i], this.y[i]);
              this.x[i] += gx * (RAD - d); this.y[i] += gy * (RAD - d);
              this.contact[i] = 1;
            }
          }
        }
      }
      // friction: thread on rock grips
      for (let i = s0; i < n; i++) if (this.contact[i]) { this.ox[i] += (this.x[i] - this.ox[i]) * 0.6; this.oy[i] += (this.y[i] - this.oy[i]) * 0.6; }
      if (this.locked && n - 1 >= s0) {
        const p = this.pivots[0];
        this.x[n - 1] = this.ox[n - 1] = p.x; this.y[n - 1] = this.oy[n - 1] = p.y;
      }
    }
    // pluck waves travel from the doll toward home
    for (const w of this.waves) { w.s += w.speed * dt; w.life -= dt; }
    this.waves = this.waves.filter((w) => w.life > 0 && w.s < this.totalArc + 2);
  }

  pluck(strength = 1) { this.waves.push({ s: 0, speed: 38, life: 7, amp: 0.22 * strength }); }

  // Build the full polyline doll → home with arc lengths (used by drawing, lights, moths, waves).
  // state: 0 frozen, 1 live, 2 dead, 3 taut (gripped), 4 break (no segment before this point)
  buildPoly(bx, by) {
    const P = this.poly; let k = 0, arc = 0;
    let lx = bx, ly = by;
    const put = (x, y, st, wr = 0) => {
      arc += st === 4 ? 0 : Math.hypot(x - lx, y - ly);
      P[k] = x; P[k + 1] = y; P[k + 2] = st; P[k + 3] = arc; P[k + 4] = wr; k += 5; lx = x; ly = y;
    };
    put(bx, by, 3);
    if (this.locked) {
      for (let j = this.pivots.length - 1; j >= 0; j--) put(this.pivots[j].x, this.pivots[j].y, 3);
    }
    const startI = this.n - 1;
    for (let i = startI; i >= 0; i--) {
      let st = this.dead[i] ? 2 : i >= this.liveStart ? 1 : 0;
      if (!this.anchored && i === this.liveStart - 1 && i < this.n - 1) st = 4;        // gap at the severed end
      if (!this.anchored && i === startI && this.liveStart >= this.n) st = 4;
      put(this.x[i], this.y[i], st, this.wear[i]);
    }
    this.polyN = k / 5;
    this.totalArc = arc;
    return this.polyN;
  }
  // wave displacement for a point at arc s (render only)
  waveAt(s) {
    let a = 0;
    for (const w of this.waves) {
      const x = (s - w.s) / 1.4;
      if (Math.abs(x) < 3) a += Math.exp(-x * x) * Math.sin((s - w.s) * 4.0) * w.amp * clamp(1 - w.s / 260, 0.15, 1);
    }
    return a;
  }
}
