// The light of the thread, as something she can use. Rules only (world.js calls it; drawkindle.js draws it):
//  · dimming: held, the thread's light and hers go down to almost nothing for a few breaths. Moths lose her, the hands feel her from
//    less far, what follows the thread is slower, and eyes get used to the dark: everything that has its own light shows brighter
//  · resting: at a few seats she can sit down, and the place comes out
import * as L from './level.js';
import { clamp } from './util.js';

export const DIM = { down: 2.6, up: 3.4, max: 4.5, back: 0.6, again: 1.4 };

export class Kindle {
  constructor(W) {
    this.W = W;
    this.breath = DIM.max; this.spent = false;
    W.dim = 0; W.rest = { k: 0, at: null };
    this.seats = L.RESTS.map(([x, y, flip]) => { let y0 = y + 0.4; for (let k = 0; k < 60 && W.T.d(x, y0) < 0.1; k++) y0 += 0.05; return { x, y: (W.T.ground(x, y0, 6) ?? y) - 0.02, flip: flip || 1, used: false }; });
    this.places = L.PLACES.map((q) => ({ ...q, seen: false }));
  }

  onRespawn() { this.W.dim = 0; this.breath = DIM.max; this.spent = false; this.stand(); }
  stand() { this.W.rest.at = null; }

  // E with nothing else to do
  act() {
    const W = this.W;
    if (W.rest.at) { this.stand(); return true; }
    const s = this.seat();
    if (s) { W.rest.at = s; s.used = true; W.dim = 0; W.emit('sit', { x: s.x, y: s.y }); return true; }
    return false;
  }
  seat() { const p = this.W.player; return p.grounded && !this.W.rest.at ? this.seats.find((s) => Math.abs(s.x - p.x) < 0.8 && Math.abs(s.y + 0.3 - p.y) < 0.9) : null; }

  update(dt, inp, live) {
    const W = this.W, p = W.player;
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

  save() { return { places: this.places.map((q) => q.seen) }; }
  load(s) {
    if (!s) return;
    (s.places || []).forEach((v, i) => { if (this.places[i]) this.places[i].seen = v; });
  }
}
