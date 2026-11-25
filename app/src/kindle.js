// The light of the thread, as something she can use. Rules only (world.js calls it; drawkindle.js draws it):
//  · a knot of light: tied into the thread where she stands, it stays burning there when she goes on. It costs yarn until she winds
//    back past it (she takes it up again) or ties on at a pole (then it burns there for good). What comes for warmth comes to it:
//    moths circle it and leave the thread alone, and a hand in the earth will close on it instead of her, and put it out
//  · dimming: held, the thread's light and hers go down to almost nothing for a few breaths. Moths lose her, the hands feel her from
//    less far, what follows the thread is slower, and eyes get used to the dark: everything that has its own light shows brighter
//  · resting: at a few seats she can sit down, and the place comes out
import * as L from './level.js';
import { clamp } from './util.js';

export const KNOT = { cost: 5, keep: 12, most: 3, r: 6.0, i: 0.72 };
export const DIM = { down: 2.6, up: 3.4, max: 4.5, back: 0.6, again: 1.4 };

export class Kindle {
  constructor(W) {
    this.W = W;
    this.knots = [];
    this.breath = DIM.max; this.spent = false;
    W.dim = 0; W.rest = { k: 0, at: null };
    this.seats = L.RESTS.map(([x, y, flip]) => { let y0 = y + 0.4; for (let k = 0; k < 60 && W.T.d(x, y0) < 0.1; k++) y0 += 0.05; return { x, y: (W.T.ground(x, y0, 6) ?? y) - 0.02, flip: flip || 1, used: false }; });
    this.places = L.PLACES.map((q) => ({ ...q, seen: false }));
  }

  // yarn the burning knots hold (the tied-down ones hold none)
  get cost() { const s = this.W.thread.fixedN; let n = 0; for (const k of this.knots) if (k.i >= s) n++; return n * KNOT.cost; }
  canTie() {
    const W = this.W, th = W.thread, p = W.player;
    if (!p.grounded || th.locked || !th.anchored || th.n <= th.fixedN + 3 || W.rest.at) return false;
    let n = 0;
    for (const k of this.knots) { if (k.i >= th.fixedN) n++; if (Math.hypot(k.x - p.x, k.y - p.y) < 1.6) return false; }
    return n < KNOT.most && W.budgetLeft() > KNOT.cost + KNOT.keep;
  }
  tie() {
    const W = this.W, th = W.thread, i = th.n - 1;
    this.knots.push({ i, x: th.x[i], y: th.y[i], vy: 0, b: 0, seed: Math.random() });
    W.emit('knot', { x: th.x[i], y: th.y[i] });
  }
  out(k, why) { this.knots.splice(this.knots.indexOf(k), 1); this.W.emit(why, { x: k.x, y: k.y }); }
  nearest(x, y, m) { let b = null, bd = m; for (const k of this.knots) { const d = Math.hypot(k.x - x, k.y - y); if (d < bd) { bd = d; b = k; } } return b; }

  onRespawn() { const s = this.W.thread.fixedN; this.knots = this.knots.filter((k) => k.i < s); this.W.dim = 0; this.breath = DIM.max; this.spent = false; this.stand(); }
  stand() { this.W.rest.at = null; }

  // E with nothing else to do
  act() {
    const W = this.W, p = W.player;
    if (W.rest.at) { this.stand(); return true; }
    const s = this.seat();
    if (s) { W.rest.at = s; s.used = true; W.dim = 0; W.emit('sit', { x: s.x, y: s.y }); return true; }
    if (this.canTie()) { this.tie(); return true; }
    if (p.grounded && !W.thread.locked) W.emit('knotNo', { x: p.x, y: p.y });
    return false;
  }
  seat() { const p = this.W.player; return p.grounded && !this.W.rest.at ? this.seats.find((s) => Math.abs(s.x - p.x) < 0.8 && Math.abs(s.y + 0.3 - p.y) < 0.9) : null; }

  update(dt, inp, live) {
    const W = this.W, th = W.thread, p = W.player, T = W.T;
    // ── the knots ──
    for (const k of [...this.knots]) {
      k.b = Math.min(1, k.b + dt * 1.6);
      if (k.i < th.n) {
        if (th.dead[k.i]) { this.out(k, 'knotOut'); continue; }
        k.x = th.x[k.i]; k.y = th.y[k.i]; k.vy = 0;
      } else if (th.locked) {
        // the thread is held taut further back: it lies (or falls) where it was
        if (T.d(k.x, k.y - 0.02) > 0.07) { k.vy -= 12 * dt; k.y += k.vy * dt; if (T.d(k.x, k.y) < 0.07) { const [gx, gy] = T.grad(k.x, k.y), d = T.d(k.x, k.y); k.x += gx * (0.07 - d); k.y += gy * (0.07 - d); k.vy = 0; } }
      } else this.out(k, 'knotBack');
    }
    // ── dimming ──
    const want = live && inp.held.dim && !p.dead && !this.spent && !W.rest.at;
    W.dim = clamp(W.dim + (want ? DIM.down : -DIM.up) * dt, 0, 1);
    if (W.dim > 0.3 && want) { this.breath -= dt; if (this.breath <= 0) { this.spent = true; W.emit('dimSpent', { x: p.x, y: p.y }); } }
    else this.breath = Math.min(DIM.max, this.breath + dt * DIM.back);
    if (this.spent && this.breath > DIM.again && !inp.held.dim) this.spent = false;
    if (want && !this.was) W.emit('dim', { x: p.x, y: p.y });
    this.was = want;
    // ── sitting ──
    const r = W.rest;
    if (r.at) {
      if (p.dead || !live || Math.abs(p.x - r.at.x) > 1.2 || inp.axisX || inp.pressed.jump || inp.held.grip) this.stand();
      else { p.x += (r.at.x - p.x) * Math.min(1, dt * 5); p.vx = 0; p.facing = r.at.flip; r.t = (r.t || 0) + dt; }
    } else r.t = 0;
    r.k = clamp(r.k + (r.at ? 0.5 : -1.1) * dt, 0, 1);
    // ── places with a name ──
    for (const q of this.places) if (!q.seen && ((p.x - q.x) / q.rx) ** 2 + ((p.y - q.y) / q.ry) ** 2 < 1) { q.seen = true; W.emit('place', { name: q.name, x: p.x, y: p.y }); }
  }

  lights(vis, t) {
    const out = [];
    for (const k of this.knots) if (vis(k.x, k.y)) {
      const fl = 1 + Math.sin(t * 5.1 + k.seed * 9) * 0.05 + Math.sin(t * 2.3 + k.seed * 20) * 0.05;
      out.push({ x: k.x, y: k.y + 0.28, r: KNOT.r, i: KNOT.i * k.b * fl, c: [1.0, 0.45, 0.3], soft: 10 });
    }
    return out;
  }
  save() { const s = this.W.thread.fixedN; return { knots: this.knots.filter((k) => k.i < s).map((k) => k.i), places: this.places.map((q) => q.seen) }; }
  load(s) {
    if (!s) return;
    const th = this.W.thread;
    this.knots = (s.knots || []).filter((i) => i < th.n).map((i) => ({ i, x: th.x[i], y: th.y[i], vy: 0, b: 1, seed: (i * 0.37) % 1 }));
    (s.places || []).forEach((v, i) => { if (this.places[i]) this.places[i].seen = v; });
  }
}
