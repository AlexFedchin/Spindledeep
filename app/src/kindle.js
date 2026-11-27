// The light of the thread, as something she can use. Rules only (world.js calls it; drawkindle.js draws it):
//  · resting: at a few seats she can sit down (a hop up and a plop: `SIT.down`), and the place comes out; she looks about her while
//    she sits, and any key gets her up again (a push and a hop: `SIT.up`) before she can be moved (the user, 2026-11-27); sitting mends her fraying (world.js), the moths leave her be,
//    and the first time at each seat, after a few breaths, she notices something there (L.REST_SAYS)
import * as L from './level.js';
import { clamp } from './util.js';

export const SIT = { down: 0.95, up: 0.8 };
const OLD_SEATS = ['69.6,-33.2', '28.5,-60.6', '78,-87.8', '107,-194', '15,-194', '80,-341', '49,-420.8', '223.5,-195', '117.5,-381.4', '194,-184'];

export class Kindle {
  constructor(W) {
    this.W = W;
    W.rest = { k: 0, at: null };
    // h: how high she sits (the seats' stone); view: what the camera opens out to while she sits there; key: the seat's place, for saves
    this.seats = L.RESTS.map(([x, y, flip, view]) => { let y0 = y + 0.4; for (let k = 0; k < 60 && W.T.d(x, y0) < 0.1; k++) y0 += 0.05; return { x, y: (W.T.ground(x, y0, 6) ?? y) - 0.02, flip: flip || 1, view, h: 0.19, key: `${x},${y}`, used: false, said: false }; });
    this.places = L.PLACES.map((q) => ({ ...q, seen: false }));
  }

  onRespawn() { this.stand(); }
  stand() { this.W.rest.at = null; this.W.rest.ph = null; }
  // she gets up: only once she is sat, and the ending's seat is never left
  rise() { const r = this.W.rest; if (r.at && r.ph === 'sit' && !r.at.held) { r.ph = 'up'; r.pt = 0; this.W.emit('getUp', { x: r.at.x, y: r.at.y }); } }

  // E with nothing else to do
  act() {
    const W = this.W;
    if (W.rest.at) { this.rise(); return true; }
    const s = this.seat();
    if (s) { W.rest.at = s; W.rest.ph = 'down'; W.rest.pt = 0; s.used = true; W.emit('sit', { x: s.x, y: s.y }); return true; }
    return false;
  }
  seat() { const p = this.W.player; return p.grounded && !this.W.rest.at ? this.seats.find((s) => Math.abs(s.x - p.x) < 0.8 && Math.abs(s.y + 0.3 - p.y) < 0.9) : null; }

  update(dt, inp, live) {
    const W = this.W, p = W.player;
    // ── sitting ──
    const r = W.rest;
    if (r.at) {
      if (p.dead || (!live && !r.at.held) || Math.abs(p.x - r.at.x) > 1.2) this.stand();      // (held: sat down by the ending, not by the player)
      else {
        if (!r.ph) { r.ph = 'down'; r.pt = 0; }
        r.pt += dt;
        if (r.ph === 'down' && r.pt >= SIT.down) { r.ph = 'sit'; r.pt = 0; }
        else if (r.ph === 'sit' && live && Object.keys(inp.pressed).some((k) => inp.pressed[k] && k !== 'pause')) this.rise();      // any key at all
        else if (r.ph === 'up' && r.pt >= SIT.up) { this.stand(); return; }
        p.x += (r.at.x - p.x) * Math.min(1, dt * 5); p.vx = 0; p.facing = r.at.flip; r.t = (r.t || 0) + dt;
        const i = this.seats.indexOf(r.at);
        if (i >= 0 && !r.at.said && r.ph === 'sit' && r.t > 3.2 && !W.voiceBusy && L.REST_SAYS[i]) { r.at.said = true; W.emit('restSay', { i, text: L.REST_SAYS[i], x: p.x, y: p.y }); }
      }
    } else r.t = 0;
    r.k = clamp(r.k + (r.at && r.ph !== 'up' ? 0.5 : -1.1) * dt, 0, 1);
    // ── places with a name ──
    for (const q of this.places) if (!q.seen && ((p.x - q.x) / q.rx) ** 2 + ((p.y - q.y) / q.ry) ** 2 < 1) { q.seen = true; W.emit('place', { name: q.name, x: p.x, y: p.y }); }
  }

  save() { return { places: this.places.map((q) => q.seen), saidAt: this.seats.filter((s) => s.said).map((s) => s.key) }; }
  load(s) {
    if (!s) return;
    (s.places || []).forEach((v, i) => { if (this.places[i]) this.places[i].seen = v; });
    // (older saves kept `said` by the seat's place in a list that has since lost two seats: OLD_SEATS says where each one was)
    const at = new Set(s.saidAt || (s.said || []).map((v, i) => (v ? OLD_SEATS[i] : null)).filter(Boolean));
    for (const q of this.seats) q.said = at.has(q.key);
  }
}
