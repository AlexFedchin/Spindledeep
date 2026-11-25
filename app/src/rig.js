// What the thread can work (data in level.js: the hooks with `sink` or `pull`, SPINDLES, BOBBINS, and the gates with `rig`):
//  · a sinking ring goes down under her while she hangs from it and lifts a door; let go, it creeps back up and the door comes down
//  · a pull: catch it in the air, land still holding, and wind in: it slides toward her and stays where it is left
//  · a spindle turns while the thread runs past it; a door opens when all of its spindles turn at once
//  · a bobbin rolls up and down its lane and crushes; it fouls on a thread lying across its way, and stands a while
// Rules only (world.js calls it, drawrig.js draws it); it says what happened through the world's events.
import * as L from './level.js';
import { clamp } from './util.js';

export const SINK = { down: 0.4, up: 0.3, at: 0.36, hold: 6.5, lift: 1.5, drop: 0.35 };
export const STRIP = { hold: 0.62, back: 3.4 };
export const BOB = { foul: 4.2, rest: 2.6, cost: 4 };

export class Rig {
  constructor(W) {
    this.W = W;
    this.sinks = W.hooks.filter((h) => h.sink);
    for (const h of this.sinks) { h.off = 0; h.top = h.y; h.home = [h.x, h.y]; }
    this.pulls = W.hooks.filter((h) => h.pull);
    for (const h of this.pulls) { h.f = 0; h.from = h.x; h.tick = 0; }
    this.spindles = L.SPINDLES.map((s, i) => ({ ...s, i, on: false, a: i * 1.3, v: 0 }));
    this.bobbins = L.BOBBINS.map((b, i) => ({ ...b, i, x: b.x1, y: b.y + b.r, dir: -1, a: 0, st: 'roll', t: 0, free: 0, v: 0 }));
    this.gates = Object.fromEntries(W.gates.filter((g) => g.rig).map((g) => [g.id, g]));
    for (const g of Object.values(this.gates)) { g.base = g.y0; g.hold = 0; g.end = g.x0; }
    this.n = 0;
  }
  // a strip of cloth she stands on tears away, and hangs back in its place a little later
  _strips(dt) {
    const p = this.W.player;
    for (const g of this.W.gates) {
      if (!g.give) continue;
      g.t = (g.t || 0) + dt;
      const on = !p.dead && p.grounded && p.x > g.x0 - 0.3 && p.x < g.x1 + 0.3 && Math.abs(p.y - g.y1 - p.r) < 0.16;
      if (g.open < 1) {
        if (on && !g.load) { g.load = true; g.t = 0; this.W.emit('stripGo', { x: (g.x0 + g.x1) / 2, y: g.y1 }); }
        if (g.load && g.t > STRIP.hold) { g.open = 1; g.load = false; g.t = 0; this.W.emit('stripTear', { x: (g.x0 + g.x1) / 2, y: g.y1 }); }
      } else if (g.t > STRIP.back && Math.hypot(p.x - (g.x0 + g.x1) / 2, p.y - g.y1) > 2.2) { g.open = 0; g.t = 0; }
    }
  }
  save() { return { pulls: this.pulls.map((h) => +h.f.toFixed(3)) }; }
  load(s) { (s.pulls || []).forEach((f, i) => { if (this.pulls[i]) { this.pulls[i].f = f; this._place(this.pulls[i]); } }); }

  _place(h) {
    h.x = h.from + h.pull.dx * h.f;
    const g = this.gates[h.pull.gate];
    if (!g) return;
    if (g.bridge) { g.x0 = g.end - g.len * h.f; g.open = h.f > 0.01 ? 0 : 1; } else this._lift(g, h.f);
  }
  _lift(g, open) { g.open = open; g.y0 = g.base + (g.y1 - g.base) * clamp(open, 0, 1) * 0.97; }

  // before the doll moves: what hangs from a moving ring goes with it
  pre() { for (const q of this.W.thread.pivots) if (q.hook && (q.hook.sink || q.hook.pull)) { q.x = q.hook.x; q.y = q.hook.y; } }

  update(dt, inp) {
    const W = this.W, p = W.player, th = W.thread, last = th.locked ? th.pivots[th.pivots.length - 1] : null, hook = last && last.hook;
    this._strips(dt);
    // ── sinking rings ──
    for (const h of this.sinks) {
      const load = hook === h && !p.grounded && !p.dead;
      const was = h.off;
      h.off = clamp(h.off + (load ? SINK.down : -SINK.up) * dt, 0, h.sink.dist);
      if (h.sway && !h.ay0) h.ay0 = h.ay;
      if (h.sway) h.ay = h.ay0 - h.off; else h.y = h.top - h.off;
      const g = this.gates[h.sink.gate];
      if (!g) continue;
      if (load && h.off / h.sink.dist > SINK.at) {
        if (g.open < 0.05 && !g.said) { g.said = true; W.emit('doorUp', { x: (g.x0 + g.x1) / 2, y: g.base }); }
        g.hold = SINK.hold;
      }
      g.hold = Math.max(0, g.hold - dt);
      const o0 = g.open;
      this._lift(g, clamp(g.open + (g.hold > 0 ? SINK.lift : -SINK.drop) * dt, 0, 1));
      if (g.open > 0.5) g.said = false;
      if (o0 > 0 && g.open === 0) W.emit('doorDown', { x: (g.x0 + g.x1) / 2, y: g.base });
      if (load && Math.floor(h.off / 0.2) !== Math.floor(was / 0.2)) W.emit('ratchet', { x: h.x, y: h.y });
    }
    // ── pulls ──
    for (const h of this.pulls) {
      h.drag = 0;
      if (hook !== h || !p.grounded || h.f >= 1) continue;
      if ((p.x - h.x) * Math.sign(h.pull.dx) < -0.6) continue;
      if (inp.axisY > 0) {
        h.drag = 1;
        const f0 = h.f;
        h.f = Math.min(1, h.f + dt * (h.pull.speed ?? 1.3) / Math.abs(h.pull.dx));
        this._place(h);
        if (Math.floor(h.f * 9) !== Math.floor(f0 * 9)) W.emit('ratchet', { x: h.x, y: h.y });
        if (h.f >= 1) W.emit('latched', { x: h.x, y: h.y });
      }
    }
    // ── spindles: every few steps, only near her ──
    if (this.n++ % 8 === 0) {
      for (const s of this.spindles) {
        if (Math.hypot(s.x - p.x, s.y - p.y) > 60) continue;
        const on = this._crosses(s);
        if (on !== s.on) { s.on = on; W.emit(on ? 'spindle' : 'spindleOff', { x: s.x, y: s.y, i: s.i }); }
      }
    }
    for (const s of this.spindles) { s.v += ((s.on ? 1 : 0) - s.v) * Math.min(1, dt * 2); s.a += s.v * dt * 5; }
    for (const g of Object.values(this.gates)) {
      if (!g.spindles) continue;
      const mine = this.spindles.filter((s) => s.gate === g.id), all = mine.length && mine.every((s) => s.on);
      if (all && g.open === 0) W.emit('doorUp', { x: (g.x0 + g.x1) / 2, y: g.base });
      // (once she is through, it stays: the thread behind her may shift)
      if (all || g.past) { this._lift(g, Math.min(1, g.open + 0.8 * dt)); if (g.open >= 1 && (p.x - g.x0) * g.dir > 1.5) g.past = true; } else this._lift(g, Math.max(0, g.open - 0.35 * dt));
    }
    // ── bobbins ──
    for (const b of this.bobbins) this._bobbin(b, dt);
  }

  // does the thread (all of it, laid or live) run past this spindle, with nothing between?
  _crosses(s) {
    const th = this.W.thread, P = th.poly, n = th.polyN;
    for (let k = 1; k < n; k++) {
      const o = k * 5, st = P[o + 2];
      if (st === 2) continue;
      const bx = P[o], by = P[o + 1], ax = P[o - 5], ay = P[o - 4];
      if (Math.min(ax, bx) > s.x + s.r || Math.max(ax, bx) < s.x - s.r || Math.min(ay, by) > s.y + s.r || Math.max(ay, by) < s.y - s.r) continue;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6, t = clamp(((s.x - ax) * dx + (s.y - ay) * dy) / l2, 0, 1);
      const qx = ax + dx * t, qy = ay + dy * t;
      if (Math.hypot(s.x - qx, s.y - qy) < s.r && this.W.T.ray(s.x, s.y, qx, qy, -0.05) < 0) return true;
    }
    return false;
  }

  _bobbin(b, dt) {
    const W = this.W, p = W.player, th = W.thread;
    const near = p.x > b.x0 - 24 && p.x < b.x1 + 24 && Math.abs(p.y - b.y) < 14;
    if (!near) { b.x = b.x1; b.dir = -1; b.st = 'roll'; b.v = 0; b.free = 0; return; }
    b.t += dt; b.free = Math.max(0, b.free - dt);
    if (b.st === 'foul') {
      b.v = 0;
      if (b.t > BOB.foul) { b.st = 'roll'; b.free = BOB.rest; W.emit('bobFree', { x: b.x, y: b.y }); }
      return;
    }
    b.v += (b.dir * b.speed - b.v) * Math.min(1, dt * 1.6);
    b.x += b.v * dt; b.a += b.v * dt / b.r;
    if (b.dir > 0 ? b.x > b.x1 : b.x < b.x0) { b.dir = -b.dir; W.emit('bobTurn', { x: b.x, y: b.y }); }
    if (Math.floor(b.a / 0.9) !== b.k) { b.k = Math.floor(b.a / 0.9); W.emit('bobRoll', { x: b.x, y: b.y - b.r }); }
    // the thread lying across its way, just where it touches down
    if (b.free <= 0 && Math.abs(b.v) > 1) {
      const fx = b.x + Math.sign(b.v) * b.r * 0.55;
      for (let i = 0; i < th.n; i++) {
        if (th.dead[i] || Math.abs(th.x[i] - fx) > 0.25 || th.y[i] > b.y - b.r + 0.55 || th.y[i] < b.y - b.r - 0.5) continue;
        if (Math.hypot(th.x[i] - p.x, th.y[i] - p.y) < 1.1) continue;      // not the bit she is standing on
        b.st = 'foul'; b.t = 0; b.fx = th.x[i]; b.fy = th.y[i]; W.hurt += BOB.cost;
        W.emit('foul', { x: b.x, y: b.y });
        break;
      }
    }
    if (!p.dead && !W.ending && Math.abs(b.v) > 0.4 && Math.hypot(p.x - b.x, p.y - b.y) < b.r + p.r * 0.75) W._die('crushed');
  }
  onRespawn() { for (const b of this.bobbins) { b.x = b.x1; b.dir = -1; b.st = 'roll'; b.v = 0; b.free = 1; } for (const h of this.sinks) h.off = 0; for (const g of this.W.gates) if (g.give) { g.open = 0; g.load = false; } }
}
