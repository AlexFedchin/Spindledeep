// What the place sounds like from where she stands. Ten times a second it feels out the cave around her (rays through the
// collision field: how big, how far the walls are left and right, how low the roof, how deep the drop), and from that it
// blends the reverbs, sets the echoes, dulls or opens the beds, and picks what her feet sound like. On top of that it keeps
// the place alive: looping sounds that sit somewhere (flames, the ink's edge, closed veils, lit bells, moths), and small
// things that happen on their own, different in every area, seldom twice the same, quieter when she makes a noise and
// nearer when she stands still. It plays through audio.js and never touches the rules.
import * as L from './level.js';
import { clamp, lerp, smooth } from './util.js';

const R = (a, b) => a + Math.random() * (b - a);
const RAYS = 20, FAR = 40;
// sizes (m, geometric mean of the rays) at which each of the four reverbs is at its fullest
const SIZE = [1.3, 2.8, 5.2, 8.5];
// how live an area's walls are, and whether its ground swallows sound
const WET = { brink: 0.12, throat: 1.0, gardens: 0.72, gallery: 1.25, mere: 1.2, hall: 0.85, hush: 0.42, treadles: 0.95, loom: 1.3 };

// what happens on its own, by area: [group, seconds between (min, max), level, rate (min, max), metres away (min, max), where]
// where: 'air' in the open, 'wall' on a face of rock, 'rock' inside it (heard through it), 'floor', 'roof', 'far' a direction only
const LIFE = {
  // the rooms the thread opens
  weighing: [['pan', 5, 13, 0.16, 0.8, 1.1, 5, 14, 'roof'], ['chain', 16, 34, 0.1, 0.7, 0.9, 6, 14, 'air'], ['floor', 14, 30, 0.2, 0.7, 1.0, 5, 12, 'floor', 'shy']],
  pews: [['chair', 8, 20, 0.2, 0.6, 0.85, 5, 14, 'floor', 'shy'], ['cloth', 14, 30, 0.12, 0.7, 0.9, 5, 12, 'floor', 'shy'], ['wood', 18, 40, 0.16, 0.5, 0.7, 8, 16, 'wall']],
  slabs: [['cloth', 7, 17, 0.14, 0.6, 0.85, 4, 11, 'roof'], ['scratch', 11, 26, 0.18, 0.6, 0.8, 3, 8, 'rock'], ['trickle', 14, 30, 0.2, 0.5, 0.7, 3, 9, 'roof']],
  pins: [['pin', 3, 9, 0.2, 0.8, 1.3, 3, 12, 'roof'], ['pin', 5, 13, 0.16, 0.5, 0.7, 3, 10, 'floor', 'shy'], ['scratch', 16, 34, 0.16, 0.5, 0.7, 4, 9, 'rock']],
  lane: [['clack', 6, 15, 0.22, 0.75, 1.1, 6, 16, 'wall'], ['loomwork', 14, 30, 0.26, 0.7, 0.95, 10, 22, 'rock'], ['timber', 14, 30, 0.26, 0.7, 1.0, 6, 16, 'wall']],
  lower: [['clack', 9, 22, 0.18, 0.5, 0.75, 8, 18, 'wall'], ['ratch', 12, 28, 0.12, 0.6, 0.8, 8, 18, 'rock'], ['loomwork', 16, 34, 0.22, 0.6, 0.85, 10, 22, 'rock'], ['chain', 18, 40, 0.14, 0.6, 0.8, 8, 16, 'air']],
  brink: [['twig', 14, 30, 0.18, 0.7, 1.0, 8, 18, 'far'], ['st_snow', 12, 26, 0.3, 0.6, 0.8, 5, 14, 'far']],
  throat: [['trickle', 9, 20, 0.4, 0.75, 1.1, 5, 15, 'wall'], ['stones', 16, 34, 0.35, 0.8, 1.1, 8, 20, 'wall'], ['groan', 35, 70, 0.22, 0.8, 1.1, 14, 24, 'rock'],
    ['tick', 6, 15, 0.22, 0.8, 1.3, 4, 12, 'wall'], ['rumble', 70, 140, 0.28, 0.8, 1.0, 20, 30, 'far']],
  gardens: [['cricket', 5, 13, 0.16, 0.86, 1.04, 5, 14, 'wall', 'shy'], ['leaf', 6, 14, 0.24, 0.8, 1.1, 4, 12, 'floor'], ['timber', 13, 28, 0.34, 0.75, 1.1, 5, 14, 'rock'],
    ['beetle', 8, 19, 0.2, 0.8, 1.2, 2.5, 8, 'wall', 'shy'], ['twig', 14, 30, 0.2, 0.8, 1.1, 5, 12, 'floor'], ['trickle', 18, 36, 0.28, 0.6, 0.9, 5, 12, 'roof']],
  gallery: [['tick', 5, 13, 0.24, 0.7, 1.2, 5, 18, 'wall'], ['stones', 18, 38, 0.36, 0.7, 1.0, 10, 24, 'wall'], ['chime', 24, 52, 0.035, 0.45, 0.62, 12, 24, 'air'],
    ['groan', 40, 80, 0.22, 0.8, 1.1, 14, 26, 'rock'], ['chain', 18, 40, 0.16, 0.7, 0.9, 8, 18, 'air'], ['rumble', 80, 160, 0.25, 0.8, 1.0, 20, 30, 'far']],
  mere: [['bubble', 6, 15, 0.45, 0.6, 1.1, 4, 14, 'ink'], ['plop', 5, 14, 0.28, 0.6, 1.1, 5, 18, 'ink'], ['groan', 22, 46, 0.34, 0.6, 0.9, 12, 26, 'ink'],
    ['tick', 10, 24, 0.22, 0.7, 1.1, 6, 18, 'wall'], ['rumble', 60, 120, 0.3, 0.7, 0.9, 20, 30, 'far']],
  hall: [['chair', 12, 30, 0.17, 0.75, 0.95, 6, 16, 'floor', 'shy'], ['floor', 9, 22, 0.24, 0.7, 1.0, 5, 14, 'floor', 'shy'], ['wood', 16, 36, 0.2, 0.5, 0.8, 8, 18, 'wall'], ['cloth', 20, 44, 0.12, 0.55, 0.75, 4, 9, 'floor', 'shy']],
  hush: [['trickle', 10, 24, 0.22, 0.5, 0.8, 3, 9, 'roof'], ['scratch', 9, 22, 0.2, 0.6, 0.85, 3, 8, 'rock'], ['rumble', 50, 100, 0.22, 0.6, 0.8, 16, 26, 'far']],
  treadles: [['loomwork', 14, 30, 0.3, 0.7, 0.95, 10, 22, 'rock'], ['timber', 10, 24, 0.34, 0.7, 1.0, 6, 16, 'wall'], ['chain', 12, 28, 0.2, 0.6, 0.85, 6, 16, 'air'], ['wood', 12, 28, 0.2, 0.45, 0.7, 8, 18, 'rock'], ['groan', 40, 80, 0.22, 0.5, 0.8, 14, 24, 'rock']],
  loom: [['groan', 26, 56, 0.2, 0.4, 0.6, 18, 30, 'far'], ['rumble', 40, 90, 0.26, 0.6, 0.8, 22, 30, 'far'], ['timber', 24, 50, 0.18, 0.5, 0.7, 12, 24, 'air']],
};
// landings and steps by what is underfoot: [step group, level, second group, its level, landing sound]
const GROUND = {
  snow: ['snow', 0.34, null, 0, 'land'],
  stone: ['step', 0.42, null, 0, 'land'],
  grit: ['step', 0.4, 'st_grit', 0.22, 'land'],
  earth: ['st_earth', 0.5, null, 0, 'ld_earth'],
  leaf: ['st_earth', 0.42, 'st_leaf', 0.26, 'ld_earth'],
  wet: ['step', 0.3, 'st_wet', 0.36, 'ld_wet'],
  wood: ['st_wood', 0.5, 'st_board', 0.2, 'ld_wood'],
  soft: ['st_soft', 0.5, null, 0, 'ld_soft'],
};

// which of the thread's rooms this is, if any
function roomAt(x, y) {
  if (x < 46 && y < -249 && y > -264) return 'weighing';
  if (x < 32 && y <= -264 && y > -287) return 'pews';
  if (x > 8 && x < 71 && y < -287 && y > -304.4) return 'slabs';
  if (x > 8 && x < 90 && y <= -304.4 && y > -313.5) return 'pins';
  if (x > 33 && x < 102 && y < -396 && y > -407.5) return 'lane';
  if (x > 20 && x < 100 && y <= -407.5 && y > -423) return 'lower';
  return null;
}

export class Sound {
  constructor(A) {
    this.A = A;
    this.W = null;
    this.size = 4; this.left = 6; this.right = 6; this.roof = 4; this.drop = 0;
    this.t = 0; this.probeT = 0; this.hush = 0; this.still = 0; this.lifeT = {}; this.later = [];
    this.lastStep = -9; this.night = Math.random() * 100;
    A.occlude = (x, y) => this.occlusion(x, y);
  }

  // the world changed (new run, title): forget what was queued and whom we listened for
  reset(W) { this.W = W; this.later = []; this.lifeT = {}; this.hush = 0; this.still = 0; this.probe(); }

  // metres of rock between her ears and (x, y), as 0..1 (2.5 m or more is a wall)
  occlusion(x, y) {
    const W = this.W; if (!W) return 0;
    const p = W.player, ex = p.x, ey = p.y + 0.3, dx = x - ex, dy = y - ey, d = Math.hypot(dx, dy);
    if (d < 1.2 || d > 45) return d > 45 ? 0.6 : 0;
    const n = Math.ceil(d / 0.4);
    let rock = 0;
    for (let i = 1; i < n; i++) { const u = i / n; if (u * d > d - 0.6) break; if (W.T.d(ex + dx * u, ey + dy * u) < -0.05) rock += d / n; }
    return clamp(rock / 2.5, 0, 0.92);
  }

  _ray(x, y, dx, dy) {
    const W = this.W, T = W.T;
    let t = 0;
    for (let k = 0; k < 60 && t < FAR; k++) {
      const qx = x + dx * t, qy = y + dy * t, d = T.d(qx, qy);
      if (d < 0.02 || W.hiddenAt(qx, qy)) break;
      t += Math.max(d, 0.1);
    }
    return Math.min(t, FAR);
  }
  probe() {
    const W = this.W, p = W.player, x = p.x, y = p.y + 0.4;
    let s = 0, l = 0, r = 0, nl = 0, nr = 0, roof = FAR;
    for (let i = 0; i < RAYS; i++) {
      const a = (i + 0.5) / RAYS * Math.PI * 2, c = Math.cos(a), v = Math.sin(a), t = this._ray(x, y, c, v);
      s += Math.log(clamp(t, 0.5, FAR));
      if (Math.abs(v) < 0.55) { if (c < 0) { l += t; nl++; } else { r += t; nr++; } }
      if (v > 0.85) roof = Math.min(roof, t);
    }
    this.size = Math.exp(s / RAYS); this.left = l / nl; this.right = r / nr; this.roof = roof;
    // how deep the air is just ahead and behind: the pit's breath comes up over an edge
    const g = (dx) => { const gy = W.T.ground(p.x + dx, p.y + 0.2, 30); return gy === null ? 30 : Math.max(0, p.y - 0.3 - gy); };
    this.drop = Math.max(g(1.6), g(-1.6), g(0));
  }

  // ── every frame ─────────────────────────────────────────────────────────
  update(dt, s) {
    const A = this.A, W = s.W;
    if (W !== this.W) this.reset(W);
    this.t += dt; this.night += dt;
    const p = W.player, live = s.state === 'play' && !s.paused;
    const tick = (this.probeT -= dt) <= 0;
    if (tick) { this.probeT = 0.1; this.probe(); }
    const area = s.state === 'title' ? 'brink' : W.areaId || 'brink', out = s.out ?? 0;

    // the space: four reverbs crossfaded by size, echoes by how far the walls are
    const ls = Math.log(clamp(this.size, SIZE[0], SIZE[3])), w = [0, 0, 0, 0];
    for (let i = 0; i < 3; i++) { const a = Math.log(SIZE[i]), b = Math.log(SIZE[i + 1]); if (ls >= a && ls <= b) { const k = (ls - a) / (b - a); w[i] = Math.cos(k * Math.PI / 2); w[i + 1] = Math.sin(k * Math.PI / 2); break; } }
    const wet = lerp(WET[area] ?? 1, 0.12, out), hard = wet * (1 - out);
    const ec = (d) => clamp((d - 5) / 7, 0, 1) * Math.exp(-d / 34) * 0.5 * hard;
    if (tick) A.setSpace(w, wet, clamp(this.left * 0.0095, 0.03, 0.4), ec(this.left), clamp(this.right * 0.0095, 0.03, 0.4), ec(this.right));
    // in a crawl the beds and the music come from the cave behind her; dead, or with a thing held up, everything goes under
    const tight = live ? smooth(2.6, 1.3, this.size) * (1 - out) : 0;
    this.tight = tight;
    const under = W.player.dead && live ? lerp(20000, 420, smooth(0, 0.7, p.deadT)) : s.show ? 1100 : 20000;
    if (tick) A.setFilters(lerp(20000, 750, tight), lerp(20000, 600, tight), under);
    s.music = 1 - 0.45 * tight;

    // beds: each drifts on its own slow tide; the pit moans harder over a drop; the deep presses in below the Mere
    const tide = (k, per, amt) => 1 - amt + amt * (0.5 + 0.5 * Math.sin(this.night * 6.283 / per + k * 2.1 + 0.8 * Math.sin(this.night * 6.283 / (per * 2.7) + k)));
    const m = A.bedMod, big = smooth(2.5, 10, this.size);
    m.amb_cave = tide(1, 37, 0.4) * (0.7 + 0.5 * big); m.amb_drips = tide(2, 53, 0.55) * (0.8 + 0.3 * big); m.amb_ink = tide(3, 41, 0.35);
    m.amb_hum = tide(4, 61, 0.45); m.amb_hall = tide(5, 47, 0.25); m.amb_beat = 0.85 + 0.15 * tide(6, 33, 1); m.amb_breath = 1;
    if (live || s.state === 'title') {
      const pit = live && area === 'throat' ? 0.1 + 0.5 * smooth(3, 22, this.drop) : live && area !== 'brink' && area !== 'loom' ? 0.22 * smooth(6, 26, this.drop) : 0;
      A.bedBase.amb_pit = pit * tide(7, 29, 0.5) * (1 - tight * 0.6) * (1 - out);
      A.bedBase.amb_deep = live ? 0.3 * smooth(-120, -380, p.y) * tide(8, 71, 0.5) + 0.1 * tight : 0;
    } else { A.bedBase.amb_pit = A.bedBase.amb_deep = 0; }

    // moving air: falls and swings
    const sp = Math.hypot(p.vx, p.vy), rush = live && !p.dead && !p.grounded && !p.climb ? Math.pow(clamp((sp - 6.5) / 14, 0, 1), 1.4) : 0;
    this._air(rush, sp);

    if (live) { this._sources(W, p); this._life(dt, W, p, area); this._rings(W, p); }
    A.sweepSources();
    this.hush = Math.max(0, this.hush - dt);
    this.still = live && p.grounded && Math.abs(p.vx) < 0.2 ? this.still + dt : 0;
    // the Hush: when she has been walking and stops, one more step, behind her
    if (live && area === 'hush' && this.still > 0.32 && !this.echoed && this.t - this.lastStep < 0.8 && this.walked > 6) { this.echoed = true; this.walked = 0; if (Math.random() < 0.5) A.any('st_earth', { vol: 0.3, rate: 0.82, x: p.x - p.facing * 4.5, y: p.y, lp: 1400, verb: 1.1 }); }
    if (this.still < 0.1) this.echoed = false;
    for (let i = this.later.length - 1; i >= 0; i--) if ((this.later[i].t -= dt) <= 0) { const q = this.later.splice(i, 1)[0]; if (live) q.f(); }
  }
  after(t, f) { if (this.later.length < 40) this.later.push({ t, f }); }

  _air(v, sp) {
    const A = this.A, c = A.ctx;
    if (!this.air) {
      if (v <= 0 || !A.buf.air) return;
      const src = c.createBufferSource(); src.buffer = A.buf.air; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.7;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(A.bus.sfx); src.start();
      this.air = { f, g };
    }
    this.air.g.gain.setTargetAtTime(v * 0.5, c.currentTime, 0.08);
    this.air.f.frequency.setTargetAtTime(180 + sp * 42, c.currentTime, 0.1);
  }

  // ── things that sound where they are ────────────────────────────────────
  _sources(W, p) {
    const A = this.A, near = (x, y, r) => { const d = Math.hypot(x - p.x, y - p.y - 0.3); return d < r ? Math.pow(1 - d / r, 1.6) : 0; };
    W.lamps.forEach((l, i) => { if (l.flicker > 0.5 && l.y < -3) { const v = near(l.x, l.y, 8) * 0.42; if (v > 0) A.source('fl' + i, 'flame', v, l.x, l.y, 0.92 + (i % 5) * 0.04); } });
    for (const q of W.lore) if (q.kind === 'candles' && !W.hiddenAt(q.x, q.y + 0.2)) { const v = near(q.x, q.y + 0.4, 6) * 0.3; if (v > 0) A.source('ca' + q.seed, 'flame', v, q.x, q.y + 0.4, 1.12); }
    W.ink.forEach((k, i) => {
      // the nearest of the ink's edge, where it laps at the rock
      const x = clamp(p.x, k.x0, k.x1), d = Math.hypot(x - p.x, k.y - p.y), v = d < 16 ? Math.pow(1 - d / 16, 1.3) * 0.75 : 0;
      if (v > 0) A.source('ink' + i, 'lap', v, x, k.y, 0.9);
    });
    for (const g of W.gates) if (g.open < 1) { const x = clamp(p.x, g.x0, g.x1), y = clamp(p.y, g.y0, g.y1), v = near(x, y, 10) * 0.5 * (1 - g.open); if (v > 0) A.source('gate' + g.id, 'veil', v, x, y); }
    for (const b of W.bells) if (b.lit > 0.5) { const v = near(b.x, b.y + 1, 7) * (0.07 + 0.12 * b.ring); if (v > 0) A.source('bell' + b.i, 'bellhum', v, b.x, b.y + 1, A.bellRate(b.i) / 2); }
  }
  // rings on chains complain now and then at the end of a swing
  _rings(W, p) {
    for (const h of W.hooks) {
      if (!h.sway) continue;
      const turn = (h.a - (h._a ?? h.a)) * (h._v ?? 0) < 0;
      h._v = h.a - (h._a ?? h.a); h._a = h.a;
      if (turn && Math.random() < 0.22 && Math.hypot(h.x - p.x, h.y - p.y) < 10) this.A.any('hinge', { vol: 0.1, rate: 0.85, x: h.ax, y: h.ay, verb: 0.9 });
    }
  }

  // ── things that happen on their own ─────────────────────────────────────
  _life(dt, W, p, area) {
    const A = this.A, list = LIFE[roomAt(W.player.x, W.player.y) || area];
    if (!list || p.dead || W.ending || (W.intro && !W.intro.done) || W.showcase) return;
    if (area === 'loom' && (W.deep.rise.on || p.y < -528 || p.y > -452)) return;     // its floor, its climb and its top keep their own silence
    for (const e of list) {
      const key = area + e[0];
      let t = this.lifeT[key] ?? R(e[1] * 0.3, e[2]);
      // standing still, the place comes a little closer; a noise sends the shy things quiet
      t -= dt * (this.still > 4 ? 1.7 : 1) * (A.duck < 0.6 ? 0.2 : 1) * (e[9] === 'shy' && this.hush > 0 ? 0 : 1);
      if (t > 0) { this.lifeT[key] = t; continue; }
      this.lifeT[key] = R(e[1], e[2]);
      const q = this._place(W, p, e[6] * (this.still > 4 ? 0.7 : 1), e[7], e[8]);
      if (!q) { this.lifeT[key] = 1.5; continue; }
      const o = { vol: e[3], rate: R(e[4], e[5]), x: q[0], y: q[1], verb: 1.1 };
      if (e[0] === 'st_snow') A.any('snow', { ...o, vol: 0.2, lp: 900 });
      else if (e[0] === 'chime' || e[0] === 'wood') A.play(e[0], o);
      else A.any(e[0], o);
      if (e[0] === 'cricket' && Math.random() < 0.7) this.after(R(0.9, 1.5), () => { if (this.hush <= 0) A.any('cricket', { ...o, vary: 0.02 }); });
      if (e[0] === 'beetle') for (let k = 1, n = 1 + (Math.random() * 3 | 0); k <= n; k++) this.after(k * R(0.18, 0.5), () => A.any('beetle', { ...o, vol: o.vol * 0.8 }));
      if (e[0] === 'rumble' && this.roof < 9) this.after(R(1, 2.2), () => this.dust(p, 0.3));
      if (e[0] === 'stones') this.after(R(1.2, 2.4), () => A.any('tick', { vol: 0.16, x: o.x, y: o.y - 3, verb: 1.2 }));
    }
  }
  _place(W, p, d0, d1, where) {
    const T = W.T;
    for (let k = 0; k < 14; k++) {
      const d = R(d0, d1);
      if (where === 'far') { const a = R(0, 6.283); return [p.x + Math.cos(a) * d, p.y + Math.abs(Math.sin(a)) * d * 0.3]; }
      if (where === 'ink') { const q = W.ink[0], x = p.x + R(-d, d); if (x > q.x0 + 1 && x < q.x1 - 1) { if (T.d(x, q.y) > 0.3) return [x, q.y]; } continue; }
      const a = R(0, 6.283), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.7, f = T.d(x, y);
      if (where === 'rock') { if (f < -0.4 && f > -4) return [x, y]; continue; }
      if (f < 0.3 || W.hiddenAt(x, y)) continue;
      if (where === 'air') return [x, y];
      if (where === 'floor') { const g = T.ground(x, y, 9); if (g !== null) return [x, g]; continue; }
      const [gx, gy] = T.grad(x, y);
      if (where === 'roof' && gy > -0.4) continue;
      if (f < 5) return [x - gx * f, y - gy * f];
    }
    return null;
  }
  // a noise: the shy things stop for a while
  startle(sec) { this.hush = Math.max(this.hush, sec); }
  dust(p, vol) { this.A.any('trickle', { vol, rate: R(0.7, 1), x: p.x + R(-1.5, 1.5), y: p.y + Math.min(this.roof, 6), verb: 0.7 }); }

  // ── her ─────────────────────────────────────────────────────────────────
  ground(W, x, y) {
    const a = W.areaId;
    if (a === 'brink' || (a === 'throat' && y > -5)) return 'snow';
    if (a === 'throat') return 'grit';
    if (a === 'gardens') return Math.sin(x * 1.3) + Math.sin(x * 0.47 + y) > 0.2 ? 'leaf' : 'earth';
    if (a === 'mere') return y < -184 ? 'wet' : 'stone';
    if (a === 'hush') return 'earth';
    if (a === 'treadles') return y > -359 && y < -346 && x > 62 ? 'wood' : 'stone';
    if (a === 'loom') return y < -535 || y > -446 ? 'soft' : y > -507 && x < 60 ? 'wood' : 'stone';
    if (a === 'hall') return y < -243 ? 'wood' : 'stone';
    return 'stone';
  }
  step(W) {
    const A = this.A, p = W.player, G = GROUND[this.ground(W, p.x, p.y)], k = 0.55 + 0.45 * Math.min(1, Math.abs(p.vx) / 5);
    // she wears thinner as she frays: lighter, higher steps
    const o = { vol: G[1] * k * (0.65 + 0.35 * p.scale), rate: 1 + (1 - p.scale) * 0.35, x: p.x, y: p.y, verb: 0.5 };
    A.any(G[0], o);
    if (G[2]) A.any(G[2], { ...o, vol: G[3] * k });
    if (this.tight > 0.6 && Math.random() < 0.6) A.any('cloth', { vol: 0.16, rate: R(0.7, 0.9), x: p.x, y: p.y, verb: 0.3 });   // brushing the rock
    this.lastStep = this.t; this.walked = (this.walked || 0) + 1;
    if (Math.abs(p.vx) > 3.5) this.startle(2.2);
    this._edge(W, p, 0.16);
  }
  // near a drop: a pebble goes over, and some time later it arrives
  _edge(W, p, chance) {
    if (Math.random() > chance || W.areaId === 'brink') return;
    for (const s of [p.facing, -p.facing]) for (const dx of [0.9, 1.5]) {
      const x = p.x + s * dx;
      if (W.T.d(x, p.y - 0.1) < 0.1) break;
      const g = W.T.ground(x + s * 0.4, p.y, 60), ink = W.ink.find((q) => x > q.x0 && x < q.x1 && q.y < p.y);
      const y = ink && (g === null || g < ink.y) ? ink.y : g, h = y === null ? 60 : p.y - 0.3 - y;
      if (h < 2.2) continue;
      const A = this.A, bx = x + s * 0.5;
      A.any('tick', { vol: 0.2, rate: R(0.9, 1.3), x: x - s * 0.5, y: p.y - 0.3, verb: 0.6 });
      const t = Math.sqrt(2 * h / 14);
      if (h > 5 && !(ink && y === ink.y)) this.after(t * R(0.35, 0.6), () => A.any('tick', { vol: 0.14, rate: R(1, 1.4), x: bx, y: p.y - h * 0.3, verb: 1.1 }));
      if (y !== null && h < 45) this.after(t, () => (ink && y === ink.y ? A.any('plop', { vol: 0.3, rate: R(0.9, 1.2), x: bx, y, verb: 1.2 }) : A.any('tick', { vol: 0.26, rate: R(0.75, 1), x: bx, y, verb: 1.3 })));
      return;
    }
  }
  land(W, v) {
    const A = this.A, p = W.player, G = GROUND[this.ground(W, p.x, p.y)], k = clamp(v / 14, 0.15, 0.8);
    A.play(G[4], { vol: k, vary: 0.12, x: p.x, y: p.y });
    A.any(G[2] || G[0], { vol: 0.3 * k + 0.08, rate: 0.8, x: p.x, y: p.y, delay: 0.03 });
    A.any('cloth', { vol: 0.22 * k, x: p.x, y: p.y, verb: 0.2 });
    if (v > 9) { this.startle(5); this._edge(W, p, 0.6); }
    if (v > 12 && W.areaId !== 'brink') { A.any('stones', { vol: 0.22 * k, rate: R(0.9, 1.2), x: p.x + R(-1, 1), y: p.y }); if (this.roof < 7) this.after(R(0.25, 0.6), () => this.dust(p, 0.32)); }
  }
  jump(W) { const p = W.player; this.A.play('jump', { vol: 0.26, vary: 0.14, x: p.x, y: p.y, verb: 0.3 }); this.A.any('cloth', { vol: 0.24, rate: R(1.0, 1.2), x: p.x, y: p.y, verb: 0.2 }); }
  climb(W) { const p = W.player; this.A.any('cloth', { vol: 0.3, rate: R(0.8, 1.05), x: p.x, y: p.y, verb: 0.3 }); }
  snag(W) { const p = W.player; this.A.any('ring', { vol: 0.3, rate: R(0.9, 1.1), x: p.x, y: p.y + 2, verb: 1.1 }); this.A.any('chain', { vol: 0.2, x: p.x, y: p.y + 2, delay: 0.05 }); this.startle(3); }

  // a pluck goes out and the cave answers: the far walls give it back, and bells that are still asleep stir at it
  pluck(W, rate) {
    const A = this.A, p = W.player, wet = WET[W.areaId] ?? 1;
    for (const [d, s] of [[this.left, -1], [this.right, 1]]) {
      if (d < 6 || W.areaId === 'brink') continue;
      const v = 0.34 * Math.exp(-d / 26) * Math.min(1, wet);
      A.play('harp', { rate, vol: v, x: p.x + s * Math.min(d, 12), y: p.y, delay: d * 0.021, lp: 1900 - 22 * d, verb: 1.4 });
      if (d > 14) A.play('harp', { rate, vol: v * 0.4, x: p.x - s * 10, y: p.y, delay: d * 0.044, lp: 1000, verb: 1.6 });
    }
    for (const b of W.bells) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (!b.lit && d < 18) this.after(0.15 + d * 0.02, () => A.play('bowl', { rate: A.bellRate(b.i) / 2, vol: 0.1 * (1 - d / 18), x: b.x, y: b.y + 1, verb: 1.3 }));
    }
    this.startle(9);
  }
  bell(W, e) { this.startle(7); for (const b of W.bells) { const d = Math.hypot(b.x - e.x, b.y - e.y); if (!b.lit && b.i !== e.i && d < 26) this.after(0.4 + d * 0.015, () => this.A.play('bowl', { rate: this.A.bellRate(b.i) / 2, vol: 0.08, x: b.x, y: b.y + 1, verb: 1.4 })); } }
  splash(W, e) {
    const ink = W.ink.some((k) => e.x > k.x0 && e.x < k.x1 && Math.abs(e.y - k.y) < 1.2);
    if (ink) this.A.any('plop', { vol: 0.5, rate: R(0.75, 1), x: e.x, y: e.y, verb: 1.2 });
    this.A.play('splash', { vol: ink ? 0.2 : 0.35, vary: 0.2, x: e.x, y: e.y });
  }
  // the rock over a hidden room gives way
  reveal(x, y) {
    const A = this.A;
    A.play('grind', { vol: 0.5, rate: R(0.85, 1), x, y, verb: 0.9 });
    A.any('stones', { vol: 0.45, x, y, delay: 0.15 }); A.any('trickle', { vol: 0.5, x, y, delay: 0.5 });
    A.any('tick', { vol: 0.3, x, y, delay: 1.2 }); A.any('tick', { vol: 0.2, x, y, delay: 1.7 });
    this.startle(8);
  }
  impact(W, e, big) { if (this.roof < 9 && Math.hypot(e.x - W.player.x, e.y - W.player.y) < 12 && Math.random() < (big ? 0.6 : 0.25)) this.after(R(0.2, 0.7), () => this.dust(W.player, 0.26)); }
}
