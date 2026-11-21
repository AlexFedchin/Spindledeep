// The doll: a small yarn creature. Circle collider on the SDF, platformer feel, and the thread verbs.
import { clamp, damp } from './util.js';

const R = 0.3;
const RUN = 5.0, ACC_G = 42, ACC_A = 20, GRAV = 30, JUMP = 10.6, MAXFALL = 21;
// swinging: the doll is small and weak. A catch soaks up most of her speed, the arc is slow (low
// swing gravity, a little slack on the catch), and she only builds height by leaning into each swing.
export const SWING = { grav: 0.34, catchKeep: 0.25, catchSlack: 0.25, pumpWith: 7.5, pumpAgainst: 2.0, drag: 0.32, letgoCap: 9 };
export const SNAG_R = 2.2;

export class Player {
  constructor(T) { this.T = T; this.r = R; this.reset(0, 0); }

  reset(x, y) {
    Object.assign(this, {
      x, y, vx: 0, vy: 0, facing: 1, grounded: false, coyote: 0, jumpBuf: 0, jumping: false,
      gripLock: false, nx: 0, ny: 1, walk: 0, squash: 0, landV: 0, air: 0, tieT: 0, swingT: 0,
      dead: false, deadT: 0, scale: 1, events: [],
    });
  }
  get bx() { return this.x - this.facing * 0.08; }
  get by() { return this.y + 0.06; }

  _collide(gates) {
    const T = this.T;
    let pushed = false;
    for (let it = 0; it < 4; it++) {
      const d = T.d(this.x, this.y);
      if (d >= R) break;
      const [gx, gy] = T.grad(this.x, this.y);
      this.x += gx * (R - d); this.y += gy * (R - d);
      const vn = this.vx * gx + this.vy * gy;
      if (vn < 0) { this.vx -= gx * vn; this.vy -= gy * vn; }
      if (gy > 0.55) { this.grounded = true; this.nx = gx; this.ny = gy; }
      if (gy < -0.6 && this.vy > 0) this.vy *= 0.3;   // bonk
      pushed = true;
    }
    for (const g of gates) {
      if (g.open >= 1) continue;
      const cx = clamp(this.x, g.x0, g.x1), cy = clamp(this.y, g.y0, g.y1);
      const dx = this.x - cx, dy = this.y - cy, d = Math.hypot(dx, dy);
      if (d < R && d > 1e-5) {
        const k = (R - d) / d; this.x += dx * k; this.y += dy * k;
        const nx = dx / d, ny = dy / d, vn = this.vx * nx + this.vy * ny;
        if (vn < 0) { this.vx -= nx * vn; this.vy -= ny * vn; }
        if (ny > 0.55) this.grounded = true;
      }
    }
    return pushed;
  }

  update(dt, inp, th, ctx) {
    const T = this.T;
    this.events.length = 0;
    if (this.dead) { this.deadT += dt; return; }
    const ax = inp.axisX, ay = inp.axisY;
    if (ax) this.facing = Math.sign(ax);
    if (inp.pressed.jump) this.jumpBuf = 0.13;
    if (!inp.held.grip) this.gripLock = false;

    // grip / release
    const budgetLeft = ctx.budgetLeft();
    // holding grip in the air while flying toward a ring: wait until the ring is in reach instead of
    // catching on the ledge behind (so an early press is forgiving, but rings are only grabbed up close)
    let waitRing = false;
    if (!this.grounded && inp.held.grip && !th.locked) {
      for (const hk of ctx.hooks) {
        const dx = hk.x - this.bx, dy = hk.y - this.by, d = Math.hypot(dx, dy);
        if (d < 5 && d > SNAG_R && dy > -1.6 && dx * this.vx > 0) { waitRing = true; break; }
      }
    }
    if (inp.held.grip && !this.gripLock && !th.locked && th.anchored && !waitRing) {
      // in the air a grip gives a little slack, so pressing it early in a jump still carries you to a ring
      if (th.grip(this.bx, this.by, false, this.grounded ? 0 : 1.2)) this.events.push('grip');
    }
    if (!inp.held.grip && th.locked && !th.forced) { th.release(this.bx, this.by); this.events.push('release'); }
    if (!th.locked && th.anchored && budgetLeft <= 0.02 && this._wantsAway(th, ax)) {
      if (th.grip(this.bx, this.by, true)) this.events.push('taut');
    }
    if (th.locked && th.forced) {
      const P = th.pivots[th.pivots.length - 1];
      if (Math.hypot(this.bx - P.x, this.by - P.y) < th.Lfree - 0.6 || inp.held.grip) { th.forced = false; if (!inp.held.grip) th.release(this.bx, this.by); }
    }

    const SUB = 3, h = dt / SUB;
    const wasGrounded = this.grounded;
    for (let s = 0; s < SUB; s++) {
      const g = this.grounded;
      // horizontal control
      if (th.locked && !g) {
        // pump: leaning with the swing adds height, leaning against it barely does anything
        this.vx += ax * (ax * this.vx > 0 ? SWING.pumpWith : SWING.pumpAgainst) * h;
        this.vx *= Math.exp(-SWING.drag * h); this.vy *= Math.exp(-SWING.drag * 0.5 * h);
      } else {
        const target = ax * RUN, acc = g ? ACC_G : ACC_A;
        const dv = target - this.vx;
        this.vx += clamp(dv, -acc * h, acc * h);
        if (g && !ax) this.vx = damp(this.vx, 0, 16, h);
      }
      // reel
      if (th.locked) {
        if (ay > 0) th.Lfree = Math.max(0.55, th.Lfree - 3.6 * h * ay);
        if (ay < 0 && !th.forced && ctx.budgetLeft() > 0) th.Lfree += 4.4 * h * -ay;
      }
      // gravity
      const swinging = th.locked && !g;
      this.vy = Math.max(this.vy - GRAV * (swinging ? SWING.grav : 1) * h, -MAXFALL);
      if (g && !this.jumping) {
        // stick to slopes when idle
        if (!ax && this.vy < 0) this.vy = Math.max(this.vy, -2);
      }
      this.x += this.vx * h; this.y += this.vy * h;
      this.grounded = false;
      this._collide(ctx.gates);
      if (!this.grounded) {
        const d = T.d(this.x, this.y - 0.08);
        if (d < R && this.vy <= 0.5) {
          const [gx, gy] = T.grad(this.x, this.y - 0.08);
          if (gy > 0.55) { this.grounded = true; this.nx = gx; this.ny = gy; }
        }
      }
      // the thread
      if (th.locked && this.grounded && !th.forced && ctx.budgetLeft() > 0) {
        // on the ground a held thread still pays out as you walk; it only catches once you fall
        const P = th.pivots[th.pivots.length - 1];
        const dd = Math.hypot(this.bx - P.x, this.by - P.y);
        if (dd > th.Lfree) th.Lfree = dd;
      }
      if (th.locked) {
        th.wrap(this.bx, this.by);
        const c = th.constrain(this.bx, this.by);
        if (c) {
          const [nx, ny, over] = c;
          this.x -= nx * over; this.y -= ny * over;
          const vr = this.vx * nx + this.vy * ny;
          if (vr > 0) { this.vx -= nx * vr; this.vy -= ny * vr; }
          this._collide(ctx.gates);
        }
      }
    }
    // jump
    if (this.grounded) { this.coyote = 0.1; this.jumping = false; } else this.coyote -= dt;
    this.jumpBuf -= dt;
    if (this.jumpBuf > 0) {
      if (this.coyote > 0) {
        this.vy = JUMP; this.jumping = true; this.jumpBuf = 0; this.coyote = 0; this.grounded = false;
        this.squash = -0.25; this.events.push('jump');
      } else if (th.locked && !this.grounded) {
        // let go mid-swing with a little lift
        th.release(this.bx, this.by);
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > SWING.letgoCap) { this.vx *= SWING.letgoCap / sp; this.vy *= SWING.letgoCap / sp; }
        this.vy = Math.max(this.vy, 0) + 5; this.vx += this.facing * 1.0;
        this.jumping = true; this.jumpBuf = 0; this.gripLock = true;
        this.squash = -0.25; this.events.push('letgo');
      }
    }
    if (this.jumping && !inp.held.jump && this.vy > 0 && !th.locked) { this.vy *= 0.45; this.jumping = false; }
    // hooks: a held thread in the air snags on a ring
    if (th.locked && !this.grounded) {
      let best = null, bd = SNAG_R;
      for (const hk of ctx.hooks) {
        const d = Math.hypot(hk.x - this.bx, hk.y - this.by);
        if (d < bd && hk.y > this.by - 0.2 && !th.hasHook(hk) && T.ray(hk.x, hk.y - 0.2, this.bx, this.by, 0.02) < 0) { best = hk; bd = d; }
      }
      if (best) {
        th.snag(best, this.bx, this.by); th.Lfree += SWING.catchSlack;
        this.vx *= SWING.catchKeep; this.vy *= SWING.catchKeep;
        this.events.push('snag'); best.ring = 1;
      }
    }
    // landing / animation bookkeeping
    if (this.grounded && !wasGrounded) {
      this.landV = -this.vy;
      if (this.air > 0.18) { this.squash = clamp(this.air * 0.5, 0.15, 0.45); this.events.push('land'); }
      this.air = 0;
    }
    if (!this.grounded) this.air += dt;
    this.squash = damp(this.squash, 0, 10, dt);
    this.walk += Math.abs(this.vx) * dt * (this.grounded ? 2.4 : 0.6);
    if (this.grounded && Math.abs(this.vx) > 0.8) {
      const step = Math.floor(this.walk / Math.PI);
      if (step !== this._step) { this._step = step; this.events.push('step'); }
    }
    this.tieT = Math.max(0, this.tieT - dt);
    this.swingT += dt;
  }

  _wantsAway(th, ax) {
    const l = th.n - 1;
    const dx = this.bx - th.x[l], dy = this.by - th.y[l];
    return Math.hypot(dx, dy) > 0.2 && (dx * ax > 0 || dy < -0.05 || !this.grounded);
  }
}
