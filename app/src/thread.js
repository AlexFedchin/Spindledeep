// The red thread. Particles from home (index 0) to the doll:
//   [0, fixedN)       tied down behind the last peg: frozen, safe, dimmer
//   [liveStart, n)    the warm part since the last peg: simulated (Verlet), chewable
//   dead[i]           severed thread (moths, ink): grey, gives no light
// While gripped, the live part ends at a pivot particle and the rest is a taut polyline through
// `pivots` (rock corners it wrapped around, hooks it snagged) to the doll, of free length `Lfree`.
// It never passes through rock: particles and the spans between them are kept out of it, a span that would cross a
// thin lip is put back where it was, taut spans bend round every corner in the way, and what is drawn (buildPoly) is
// laid along the rock's face wherever a straight span would still cut in (route.js).
import { clamp } from './util.js';
import { depthAlong, clearLine, route, hug } from './route.js';

export const SP = 0.25;            // rest spacing (m)
const CAP = 6000;
const GRAV = -16;
const RAD = 0.075;                 // the engraved rock face is broken by a few centimetres either side of the collision field
const FACE = 0.065;                // a drawn thread lies at least this far out of the rock
const VMAX = 0.3;                  // fastest a particle moves in one step (m): 36 m/s, above her fastest fall

export class Thread {
  constructor(T) {
    this.T = T;
    this.x = new Float32Array(CAP); this.y = new Float32Array(CAP);
    this.ox = new Float32Array(CAP); this.oy = new Float32Array(CAP);
    this.lx = new Float32Array(CAP); this.ly = new Float32Array(CAP);      // where each particle last stood clear of rock
    this.wear = new Float32Array(CAP); this.contact = new Uint8Array(CAP); this.dead = new Uint8Array(CAP);
    this.poly = new Float32Array(CAP * 15 + 400); // x, y, state, arc-from-doll, wear
    this.polyN = 0;
    this.waves = [];
    this.reset(0, 0);
  }

  reset(ax, ay) {
    this.n = 1; this.fixedN = 1; this.liveStart = 1; this.anchored = true;
    this._fix = null;
    this.x[0] = this.ox[0] = ax; this.y[0] = this.oy[0] = ay;
    this.dead.fill(0); this.wear.fill(0);
    this.locked = false; this.forced = false; this.pivots = []; this.Lfree = 0; this.loose = false;
  }
  // bitten through at her hand: the end comes away from the doll and falls, and nothing more is paid out
  letGo() {
    if (this.locked) { this.locked = false; this.forced = false; this.pivots = []; }
    this.loose = true; this.anchored = false;
    // the stretch since the last peg goes on swinging and settles where it falls
    if (this.liveStart > this.fixedN) this.liveStart = this.fixedN;
  }

  _push(px, py) {
    if (this.n >= CAP - 2) return false;
    const i = this.n++;
    this.x[i] = this.ox[i] = this.lx[i] = px; this.y[i] = this.oy[i] = this.ly[i] = py;
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
    // the last bit to the peg is laid as thread too (round a lip if there is one), not jumped in one straight span
    const l = this.n - 1, ax = this.x[l], ay = this.y[l];
    const R = clearLine(this.T, ax, ay, px, py, 0) ? [[ax, ay], [px, py]] : route(this.T, ax, ay, px, py, 3) || [[ax, ay], [px, py]];
    for (let k = 1; k < R.length; k++) this._lay(R[k - 1][0], R[k - 1][1], R[k][0], R[k][1]);
    this._push(px, py);
    this._fix = null;
    this.fixedN = this.n; this.liveStart = this.n; this.anchored = true;
  }
  _lay(ax, ay, cx, cy) {
    const L = Math.hypot(cx - ax, cy - ay), m = Math.floor(L / SP);
    for (let j = 1; j <= m; j++) { const t = (j * SP) / Math.max(L, 1e-6); this._push(ax + (cx - ax) * t, ay + (cy - ay) * t); }
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
    this.n = k + 1; this.liveStart = this.fixedN; this.anchored = true; this._fix = null;
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
    // the taut line follows the thread's own way from its last contact to the doll: straight where it can, round every
    // corner of rock in between where it can't (it used to go straight from the contact, through whatever was there)
    const last = this.n - 1, T = this.T;
    const first = this._clear(this.x[i0], this.y[i0]);
    const P = [{ x: first[0], y: first[1], sign: 0, hook: null }];
    let k = i0;
    for (let guard = 0; guard < 24; guard++) {
      const A = P[P.length - 1];
      if (clearLine(T, A.x, A.y, bx, by, 0)) break;
      let q = last;
      while (q > k + 1 && !clearLine(T, A.x, A.y, this.x[q], this.y[q], 0)) q--;
      if (q <= k) break;
      k = q;
      const c = this._clear(this.x[q], this.y[q], 0.16);
      if (Math.hypot(c[0] - A.x, c[1] - A.y) < 0.25) continue;
      if (Math.hypot(bx - c[0], by - c[1]) < 0.3) break;
      P.push({ x: c[0], y: c[1], sign: 0, hook: null });
    }
    for (let j = 1; j < P.length; j++) {
      const A = P[j - 1], Q = P[j], nx = j + 1 < P.length ? P[j + 1].x : bx, ny = j + 1 < P.length ? P[j + 1].y : by;
      Q.sign = (Q.x - A.x) * (ny - Q.y) - (Q.y - A.y) * (nx - Q.x) || 1;
    }
    let arc = 0;
    for (let i = k + 1; i < this.n; i++) arc += Math.hypot(this.x[i] - this.x[i - 1], this.y[i] - this.y[i - 1]);
    arc += Math.hypot(bx - this.x[last], by - this.y[last]);
    this.n = i0 + 1;
    this.pivots = P;
    const E = P[P.length - 1], straight = Math.hypot(bx - E.x, by - E.y);
    this.Lfree = Math.max(straight, Math.min(arc, straight + 2.5)) + slack;
    this.locked = true; this.forced = forced;
    return true;
  }
  release(bx, by) {
    if (!this.locked) return;
    const pts = this.pivots.map((p) => [p.x, p.y]);
    pts.push([bx, by]);
    for (let k = 1; k < pts.length; k++) this._lay(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
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
    this._corners(P, h.x, h.y);
    const A = this.pivots[this.pivots.length - 1];
    const sign = (h.x - A.x) * (by - h.y) - (h.y - A.y) * (bx - h.x);
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
    for (let guard = 0; guard < 4; guard++) {
      const P = this.pivots[this.pivots.length - 1];
      const dx = bx - P.x, dy = by - P.y, L = Math.hypot(dx, dy);
      if (L < 0.6) return;
      // march, ignoring the first bit next to the pivot and the last next to the doll
      let mt = 0, md = 1e9, t = 0.25;
      for (let k = 0; k < 200 && t < L - 0.1; k++) {
        const d = T.d(P.x + dx * t / L, P.y + dy * t / L);
        if (d < md) { md = d; mt = t / L; }
        t += clamp(Math.abs(d) * 0.9, 0.06, 1.5);
      }
      if (md >= 0.02) return;
      // a line that has got well inside the rock has no one corner to bend on: take the way round
      if (md < -0.25 && this._corners(P, bx, by)) return;
      const c = this._clear(P.x + dx * mt, P.y + dy * mt, 0.16);
      const dc = Math.hypot(c[0] - P.x, c[1] - P.y);
      if (dc < 0.3 || Math.hypot(bx - c[0], by - c[1]) < 0.35) return;
      this._corners(P, c[0], c[1]);
      const A = this.pivots[this.pivots.length - 1];
      const sign = (c[0] - A.x) * (by - c[1]) - (c[1] - A.y) * (bx - c[0]);
      this.pivots.push({ x: c[0], y: c[1], sign: sign || 1, hook: null });
      this.Lfree = Math.max(0.4, this.Lfree - Math.hypot(c[0] - A.x, c[1] - A.y));
    }
  }
  // bend the taut line from pivot P to (x, y) round rock in the way: pushes the corners between them as pivots
  _corners(P, x, y) {
    const T = this.T;
    if (depthAlong(T, P.x, P.y, x, y) > -0.12) return false;
    const R = route(T, P.x, P.y, x, y, 4);
    if (!R || R.length < 3) return false;
    let any = false;
    for (let j = 1; j < R.length - 1; j++) {
      const A = this.pivots[this.pivots.length - 1], [cx, cy] = R[j], [nx, ny] = R[j + 1];
      const dc = Math.hypot(cx - A.x, cy - A.y);
      if (dc < 0.2) continue;
      this.pivots.push({ x: cx, y: cy, sign: (cx - A.x) * (ny - cy) - (cy - A.y) * (nx - cx) || 1, hook: null });
      this.Lfree = Math.max(0.4, this.Lfree - dc);
      any = true;
    }
    return any;
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
    if (!this.locked && !this.loose) {
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
        // round a lip: lay the thread over the rock's face, not through the corner
        if (this.anchored && d > 0.2 && depthAlong(T, lx, ly, bx, by) < 0) {
          const s = Math.min(1, SP / d), c = this._clear(lx + (bx - lx) * s, ly + (by - ly) * s, RAD);
          if (Math.hypot(c[0] - lx, c[1] - ly) > 0.08 && depthAlong(T, lx, ly, c[0], c[1]) > -0.1) { this._push(c[0], c[1]); budget -= SP; continue; }
        }
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
        this.lx[i] = this.x[i]; this.ly[i] = this.y[i];
        let vx = (this.x[i] - this.ox[i]) * 0.985, vy = (this.y[i] - this.oy[i]) * 0.985;
        // no faster than she can fall: a stretched chain let go could otherwise whip a metre in a frame
        const v = Math.hypot(vx, vy); if (v > VMAX) { vx *= VMAX / v; vy *= VMAX / v; }
        this.ox[i] = this.x[i]; this.oy[i] = this.y[i];
        this.x[i] += vx; this.y[i] += vy + g;
        this.contact[i] = 0;
      }
      const endX = this.locked || this.loose ? null : bx, endY = by;
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
          const fixedJ = j < s0 && (this.anchored || this.loose) ? true : j < s0 ? null : false;      // (let go: still tied at the peg)
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
        {          // every pass: a thread pulled over a corner stays on it (every third pass let it lift off and land back, frame to frame)
          for (let i = s0; i < n; i++) {
            const d = T.d(this.x[i], this.y[i]);
            if (d >= RAD) continue;
            // one that got right into the rock goes back out the side it came in by (in a thin slab the nearest face can be
            // the far one, and the thread jumped through)
            if (d < 0 && this._back(i)) continue;
            const [gx, gy] = T.grad(this.x[i], this.y[i]);
            this.x[i] += gx * (RAD - d); this.y[i] += gy * (RAD - d);
            this.contact[i] = 1;
          }
          // the spans between them too: a lip of rock can stand between two particles that are both clear
          for (let i = Math.max(s0, 1); i < n; i++) {
            const j = i - 1;
            if (j < s0 && !this.anchored && !this.loose) continue;
            const mx = (this.x[i] + this.x[j]) / 2, my = (this.y[i] + this.y[j]) / 2, d = T.d(mx, my);
            if (d >= RAD * 0.8) continue;
            let px, py;
            const qx = (this.lx[i] + this.lx[j]) / 2, qy = (this.ly[i] + this.ly[j]) / 2;
            if (d < 0 && T.d(qx, qy) > 0) {
              // a span cut into the rock: back out to the side it was on at the start of the frame
              const f = Math.max(0, T.ray(qx, qy, mx, my, 0)), hx = qx + (mx - qx) * f, hy = qy + (my - qy) * f, [nx, ny] = T.grad(hx, hy);
              px = hx - mx + nx * RAD * 0.8; py = hy - my + ny * RAD * 0.8;
              const L = Math.hypot(px, py); if (L > 0.5) { px *= 0.5 / L; py *= 0.5 / L; }
            } else {
              const [gx, gy] = T.grad(mx, my), k = Math.min(RAD * 0.8 - d, 0.2);
              px = gx * k; py = gy * k;
            }
            this.x[i] += px; this.y[i] += py;
            if (j >= s0) { this.x[j] += px; this.y[j] += py; }
            this.contact[i] = 1;
          }
        }
      }
      // a span that still ends up across rock (its ends pushed out on opposite sides of a thin lip): both ends go back
      // to where they last stood, which was clear, and lose their speed
      for (let pass = 0; pass < 2; pass++) for (let i = Math.max(s0, 1); i < n; i++) {
        const j = i - 1;
        if (j < s0 && !this.anchored && !this.loose) continue;
        if (T.d((this.x[i] + this.x[j]) / 2, (this.y[i] + this.y[j]) / 2) > 0.2 || depthAlong(T, this.x[j], this.y[j], this.x[i], this.y[i]) > -0.1) continue;
        for (const k of [i, j]) if (k >= s0) { this.x[k] = this.ox[k] = this.lx[k]; this.y[k] = this.oy[k] = this.ly[k]; }
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

  // particle i is inside rock: put it where its way from the start of the frame (clear) first met the rock, just outside
  _back(i) {
    const T = this.T, ax = this.lx[i], ay = this.ly[i];
    if (T.d(ax, ay) <= 0) return false;
    const f = T.ray(ax, ay, this.x[i], this.y[i], 0);
    if (f < 0) return false;
    const hx = ax + (this.x[i] - ax) * f, hy = ay + (this.y[i] - ay) * f, [nx, ny] = T.grad(hx, hy), dh = T.d(hx, hy);
    this.x[i] = hx + nx * (RAD - dh); this.y[i] = hy + ny * (RAD - dh);
    this.contact[i] = 1;
    return true;
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
    const T = this.T, cap = P.length - 10;
    // a point, with any rock between it and the last one gone round (the drawn line never cuts through it)
    // (the moving thread is laid out as far as its particles stand, so a corner it slides over is drawn as the same curve
    // whichever particles are on it; laid nearer, the corner popped between a chord and a curve from frame to frame)
    const to = (x, y, st, wr = 0) => {
      if (st !== 4 && k > 0) hug(T, lx, ly, x, y, (hx, hy) => { if (k < cap) put(hx, hy, st, wr); }, st === 0 ? FACE : RAD);
      if (k < cap) put(x, y, st, wr);
    };
    if (this.loose) { const l = this.n - 1; put(this.x[l], this.y[l], 4); }      // let go: nothing joins it to the doll
    else put(bx, by, 3);
    if (this.locked) for (let j = this.pivots.length - 1; j >= 0; j--) to(this.pivots[j].x, this.pivots[j].y, 3);
    const startI = this.n - 1;
    const state = (i) => {
      if (!this.anchored && !this.loose && i === this.liveStart - 1 && i < this.n - 1) return 4;        // gap at the severed end
      if (!this.anchored && !this.loose && i === startI && this.liveStart >= this.n) return 4;
      return this.dead[i] ? 2 : i >= this.liveStart ? 1 : 0;
    };
    for (let i = startI; i >= this.fixedN; i--) to(this.x[i], this.y[i], state(i), this.wear[i]);
    // the tied-down part never moves: worked out once per tie
    const F = this._fixed();
    for (let q = 0; q < F.length && k < cap; q += 3) {
      const st = state(F[q + 2]);
      if (q === 0) to(F[q], F[q + 1], st); else put(F[q], F[q + 1], st);
    }
    this.polyN = k / 5;
    this.totalArc = arc;
    return this.polyN;
  }
  // [x, y, particle] from the last tie back to home, with the points that lay it along the rock in between
  _fixed() {
    if (this._fix && this._fix.n === this.fixedN) return this._fix.a;
    const a = [];
    for (let i = this.fixedN - 1; i >= 0; i--) {
      if (i < this.fixedN - 1) hug(this.T, this.x[i + 1], this.y[i + 1], this.x[i], this.y[i], (x, y) => a.push(x, y, i), FACE);
      a.push(this.x[i], this.y[i], i);
    }
    this._fix = { n: this.fixedN, a };
    return a;
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
