// Game rules: the doll, its thread and everything in the deep. No drawing, no sound — it emits events.
import * as L from './level.js';
import { Thread, SP } from './thread.js';
import { Player } from './player.js';
import { clamp, rand, mulberry, lerp, fbm } from './util.js';
import { buildLore, loreLights } from './props.js';
import { Deep } from './deep.js';
import { Rig } from './rig.js';
import { hug } from './route.js';
import { Kindle } from './kindle.js';
import { growGlows } from './life.js';

const BASE_YARN = 92, SKEIN_YARN = 14, FRAYED = 0.8;
export const SHELF = { x: 15.4, y: 0.55 };      // by her door: what has been brought home
const RED = [1.0, 0.16, 0.12];

export class World {
  constructor(T, mode = '') {
    this.T = T;
    this.mode = mode;                 // '' or 'frayed' (after an ending: less yarn, rings that never hang still)
    this.thread = new Thread(T);
    this.player = new Player(T);
    const snap = (e, up = 2.2) => {
      // stand on the nearest floor; if the authored spot is inside rock, climb out to the surface above it
      let y0 = e.y + up;
      for (let k = 0; k < 200 && T.d(e.x, y0) < 0; k++) y0 += 0.05;
      const g = T.ground(e.x, y0, 7); return g === null ? e : { ...e, y: g };
    };
    this.pegs = L.PEGS.map((p, i) => ({ ...snap(p), i, tied: !!p.home, glow: p.home ? 1 : 0 }));
    // a swinging ring hangs from an anchor `len` above where it rests
    this.hooks = L.HOOKS.map((h) => ({ ...h, ring: 0, ...(h.sway ? { ax: h.x, ay: h.y + h.sway[0], rx: h.x, ry: h.y } : {}) }));
    this.bells = L.BELLS.map((b, i) => ({ ...snap(b), i, lit: 0, ring: 0, sway: rand(0, 6) }));
    this.gates = L.GATES.map((g) => ({ open: 0, ...g }));
    // frayed: the rings of the Gallery and the Mere never hang still either (but one: the gap after it is too wide for that)
    if (mode === 'frayed') this.hooks.forEach((h, i) => { if (i < 12 && i !== 3) { const len = 4; Object.assign(h, { sway: [len, 0.085, 3.1 + (i % 4) * 0.25, i * 1.9], ax: h.x, ay: h.y + len, rx: h.x, ry: h.y }); } });
    this.skeins = L.SKEINS.map((s) => ({ ...snap(s, 1.5), taken: false, bob: rand(0, 6) }));
    // hidden rooms and their keepsakes
    // `open`: the rock over it has begun to crumble (she is at the mouth of its crack); `seen`: she is inside it
    this.secrets = L.SECRETS.map((s, i) => ({ ...snap(s, 1.2), i, open: false, seen: false, taken: false, bob: rand(0, 6), zone: mouthZone(T, s) }));
    // brambles grow only on real floor: points on walls or slopes (where a ground search lands on the side of a
    // shaft or pit) are dropped, and a run is split wherever it crosses a gap, so no invisible thorn is left behind
    this.thorns = [];
    for (const [x0, x1, yr] of L.THORNS) {
      let run = [];
      for (let x = x0; x <= x1; x += 0.45) {
        const g = T.ground(x, yr, 14), last = run[run.length - 1];
        const floor = g !== null && T.grad(x, g - 0.05)[1] > 0.75;
        if (!floor || (last && (Math.abs(last[1] - g - 0.12) > 0.6 || x - last[0] > 0.7))) { if (run.length > 1) this.thorns.push(run); run = []; }
        if (floor) run.push([x, g + 0.12]);
      }
      if (run.length > 1) this.thorns.push(run);
    }
    this.ink = L.INK;
    this.drips = L.DRIPS.map((d, i) => ({ ...d, t: 1.5 + i * 1.3, drop: null, swell: 0 }));
    this.grey = buildGrey(T);
    this.memories = L.MEMORIES.map((m) => ({ ...m, ...(m.thread === 'old' ? {} : nearestOn(this.grey, m.x, m.y)), heard: false }));
    this.finale = { ...L.FINALE, ...nearestOn(this.grey, L.FINALE.x, L.FINALE.y) };
    // her empty chair in the Hall stands on the floor (it used to be drawn at the thread's height and floated)
    const fl = (x, y) => T.ground(x, y + 2, 8) ?? y;
    this.chair = { x: L.CHAIR.x, y: Math.min(fl(L.CHAIR.x - 0.6, L.CHAIR.y), fl(L.CHAIR.x + 0.6, L.CHAIR.y)), candleY: fl(34.2, L.CHAIR.y) };
    this.finale.candleY = fl(L.REMAINS.candle, this.finale.y);
    this.remainsY = fl(L.REMAINS.x, this.finale.y);
    this.finale.y = fl(this.finale.x, this.finale.y) + 0.2;
    this.lamps = L.LIGHTS;
    this.lore = buildLore(T);
    this.nests = L.NESTS.map((n) => ({ ...n, spawned: 0 }));
    this.moths = [];
    this.events = [];
    this.skeinCount = 0;
    this.hurt = 0;
    this.areaSeen = new Set();
    this.hints = makeHints();
    this.time = 0;
    this.ending = null;
    this.husks = [];        // the dolls you lost on the way down stay where they fell
    this.deep = new Deep(this);
    this.rig = new Rig(this);
    this.glows = T.glows ||= growGlows(T);        // (the same in every world made of this rock)
    this.kindle = new Kindle(this);
    this.reset();
  }

  reset() {
    const home = this.pegs[0];
    this.checkpoint = home;
    this.thread.reset(home.x, home.y + 0.35);
    this.player.reset(L.START.x, L.START.y);
  }

  get maxYarn() { const y = BASE_YARN + this.skeinCount * SKEIN_YARN; return this.mode === 'frayed' ? Math.max(BASE_YARN - 1, y * FRAYED) : y; }     // (the fall into the Loom needs nearly all of a bare ball)
  // all eight keepsakes in this run: she has sewn on the second eye, and sees further
  get whole() { return this.secrets.every((s) => s.taken); }
  budgetLeft() { return this.maxYarn - this.thread.used(this.player.bx, this.player.by) - this.hurt; }
  yarnFrac() { return clamp(this.budgetLeft() / this.maxYarn, 0, 1); }

  area() {
    const p = this.player;
    for (const a of L.AREAS) if (p.y <= a.y1 && p.y > a.y0 && (a.x0 === undefined || p.x >= a.x0) && (a.x1 === undefined || p.x <= a.x1)) return a;
    for (const a of L.AREAS) if (p.y <= a.y1 && p.y > a.y0) return a;
    return L.AREAS[0];
  }

  emit(k, o = {}) { this.events.push({ k, ...o }); }

  update(dt, inp, controls = true) {
    this.time += dt;
    if (this.ending) this.ending.t += dt;
    const p = this.player, th = this.thread;
    const ctx = { slow: this.slow ?? 1, budgetLeft: () => this.budgetLeft(), gates: this.gates, hooks: this.hooks, ropeNear: (x, y, m) => this.deep.ropeNear(x, y, m) };
    const blank = { axisX: 0, axisY: 0, held: {}, pressed: {} };
    this.deep.pre(dt); this.rig.pre();
    // (in the ending she is walked by ending.js: `ending.walk` is the stick it holds)
    p.update(dt, this.ending ? (this.ending.walk || blank) : controls && !p.dead && !(this.rest.at && !inp.axisX && !inp.pressed.jump && !inp.held.grip) ? inp : blank, th, ctx);
    for (const e of p.events) this.emit(e, { x: p.x, y: p.y, v: p.landV });
    th.update(dt, p.bx, p.by, this.budgetLeft(), false);
    th.buildPoly(p.bx, p.by);

    if (!p.dead && !this.ending && controls) this._interact(inp, dt);
    this.kindle.update(dt, controls ? inp : blank, controls && !p.dead && !this.ending);
    this._bells(dt);
    this._gates(dt);
    this.still = Math.hypot(p.vx, p.vy) < 0.6 && !th.locked ? (this.still || 0) + dt : 0;
    this._moths(dt);
    this._hazards(dt);
    this.deep.update(dt);
    this.rig.update(dt, controls && !p.dead && !this.ending ? inp : blank);
    this._pickups();
    this._memories();
    this._hintsUpdate();
    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt * 1.2);
    for (const h of this.hooks) h.ring = Math.max(0, h.ring - dt * 1.5);
    for (const pg of this.pegs) pg.glow = lerp(pg.glow, pg === this.checkpoint ? 1 : pg.tied ? 0.35 : 0, 1 - Math.exp(-3 * dt));
    p.scale = 0.6 + 0.4 * this.yarnFrac();
    // area cards
    const a = this.area();
    if (a.id !== this.areaId) { this.areaId = a.id; if (!this.areaSeen.has(a.id)) { this.areaSeen.add(a.id); this.emit('area', { name: a.name, id: a.id }); } else this.emit('areaQuiet', { id: a.id }); }
    // death → respawn at the checkpoint
    if (p.dead && p.deadT > 1.7) this._respawn();
  }

  // ── interaction: tie, mend, pluck, finale ──────────────────────────────
  _interact(inp, dt) {
    const p = this.player, th = this.thread;
    this.prompt = null;
    const peg = this.pegs.find((g) => g !== this.checkpoint && Math.hypot(g.x - p.x, g.y + 0.3 - p.y) < 1.5);
    const mi = th.anchored ? -1 : th.mendIndex();
    const nearMend = mi >= 0 && Math.hypot(th.x[mi] - p.bx, th.y[mi] - p.by) < 1.4;
    const nearFinale = Math.hypot(this.finale.x - p.x, this.finale.y - p.y) < 2.6;
    this.nearFinale = nearFinale && this.deep.rise.done;       // the choice itself is ending.js
    if (nearFinale) { this.prompt = null; return; }
    const atShelf = (this.found || []).length > 0 && Math.abs(p.x - SHELF.x) < 0.9 && p.y < SHELF.y + 1.6 && p.y > SHELF.y - 0.5;
    if (atShelf) { this.prompt = { a: 'act', t: 'Look at her shelf' }; if (inp.pressed.act) { this.emit('shelf', {}); return; } }
    else if (peg) this.prompt = { a: 'act', t: 'Tie the thread to the peg' };
    else if (nearMend) this.prompt = { a: 'act', t: 'Mend the thread' };
    else if (this.kindle.seat()) this.prompt = { a: 'act', t: 'Sit a while' };
    // reaching a peg ties the thread to it by itself, so a fall always sends you back to the last peg you passed
    const autoTie = peg && !nearFinale && p.grounded && !th.locked;
    if (autoTie || this.rest.at) this.prompt = null;
    if (inp.pressed.act || autoTie) {
      if (peg) {
        th.tie(peg.x, peg.y + 0.35);
        peg.tied = true; this.checkpoint = peg; this.hurt = 0;
        p.tieT = 0.6;
        this.emit('tie', { x: peg.x, y: peg.y });
      } else if (nearMend) { th.mend(); this.emit('mend', { x: p.x, y: p.y }); }
      else if (inp.pressed.act) this.kindle.act();
    }
    if (inp.pressed.pluck && (this.pluckCD || 0) <= 0) {
      this.deep.onPluck();
      this.pluckCD = 0.55;
      th.pluck(1);
      const tension = th.locked ? clamp(1 - th.Lfree / 20, 0, 1) : 0.35;
      this.emit('pluck', { x: p.x, y: p.y, tension, locked: th.locked });
      // anything right at the doll scatters / rings at once
      for (const m of this.moths) if (Math.hypot(m.x - p.x, m.y - p.y) < 5.5) this._scare(m);
      for (const b of this.bells) if (!b.lit && Math.hypot(b.x - p.x, b.y + 1 - p.y) < 3.4) this._ring(b);
    }
    this.pluckCD = (this.pluckCD || 0) - dt;
  }

  _ring(b) {
    if (b.lit) { b.ring = 1; return; }
    b.lit = 0.001; b.ring = 1;
    this.emit('bell', { x: b.x, y: b.y, i: b.i });
  }

  // a travelling pluck rings bells near the thread and scares moths sitting on it
  _bells(dt) {
    const th = this.thread, P = th.poly, n = th.polyN;
    for (const w of th.waves) {
      // find the front point by arc length
      let lo = 0, hi = n - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (P[mid * 5 + 3] < w.s) lo = mid + 1; else hi = mid; }
      const fx = P[lo * 5], fy = P[lo * 5 + 1];
      w.fx = fx; w.fy = fy;
      for (const b of this.bells) if (Math.hypot(b.x - fx, b.y + 0.8 - fy) < 3.4 && (!b.lit || b.ring < 0.2)) this._ring(b);
      for (const m of this.moths) if (Math.hypot(m.x - fx, m.y - fy) < 2.6) this._scare(m);
    }
    for (const b of this.bells) {
      if (b.lit > 0) b.lit = Math.min(1, b.lit + dt * 1.2);
      b.ring = Math.max(0, b.ring - dt * 0.7);
      b.sway += dt;
    }
  }

  _gates(dt) {
    for (const g of this.gates) {
      const bells = this.bells.filter((b) => b.gate === g.id);
      const all = bells.length && bells.every((b) => b.lit > 0);
      if (all && g.open === 0) this.emit('gate', { x: (g.x0 + g.x1) / 2, y: (g.y0 + g.y1) / 2 });
      if (all) g.open = Math.min(1, g.open + dt * 0.5);
    }
  }

  // ── moths ──────────────────────────────────────────────────────────────
  _moths(dt) {
    const p = this.player, th = this.thread;
    for (const nest of this.nests) {
      const d = Math.hypot(nest.x - p.x, nest.y - p.y);
      if (d < 24 && nest.spawned < nest.n) {
        nest.spawned++;
        const a = rand(0, 6.28);
        this.moths.push({ nest, x: nest.x + Math.cos(a) * 2, y: nest.y + Math.sin(a) * 1.5, vx: 0, vy: 0, st: 'wander', t: rand(0, 5), idx: -1, near: 0, used: 0, flap: rand(0, 6), flee: 0, size: rand(0.85, 1.2), seed: Math.random() * 1000 });
      }
    }
    const litBells = this.bells.filter((b) => b.lit > 0.5);
    const repelled = (x, y) => litBells.some((b) => Math.hypot(b.x - x, b.y + 1 - y) < 5.2);
    for (const m of this.moths) {
      m.t += dt; m.flap += dt * (m.st === 'land' ? 9 : 26);
      m.flee = Math.max(0, m.flee - dt);
      let tx = m.nest.x + Math.cos(m.t * 0.7 + m.seed) * m.nest.r * 0.6, ty = m.nest.y + Math.sin(m.t * 1.1 + m.seed) * 2.5;
      if (m.st === 'land') {
        // chewing the thread
        m.dark = this.dim > 0.6 ? (m.dark || 0) + dt : 0;                  // (in the dark it loses the thread it sits on)
        if (m.idx < th.liveStart || m.idx >= th.n || th.dead[m.idx] || m.flee > 0 || m.dark > 1.1) { m.st = 'wander'; m.idx = -1; m.near = 0; }
        else {
          m.x = th.x[m.idx] + Math.sin(m.t * 3) * 0.02; m.y = th.y[m.idx] + 0.08;
          th.wear[m.idx] += dt / (this.mode === 'frayed' ? 2.8 : 4.2);
          if (Math.random() < dt * 0.8) this.emit('chew', { x: m.x, y: m.y });
          if (th.wear[m.idx] >= 1) {
            th.cut(m.idx); this.emit('cut', { x: m.x, y: m.y });
            m.st = 'wander'; m.idx = -1; m.flee = 2;
          }
          continue;
        }
      }
      if (m.st === 'doll') {
        if (m.flee > 0 || p.dead || (this.dim > 0.6 && Math.random() < dt * 1.5)) m.st = 'wander';
        else {
          m.x = p.x + Math.cos(m.seed) * 0.25; m.y = p.y + 0.15 + Math.sin(m.seed) * 0.2;
          this.hurt += dt * 0.9;
          if (this.budgetLeft() < -1.5 && !p.dead) this._die('moths');
          continue;
        }
      }
      // pick a target: the warm thread or the doll, if near and not guarded by a bell
      if (m.flee <= 0 && m.st !== 'flee' && this.dim > 0.6) m.st = 'wander';
      else if (m.flee <= 0 && m.st !== 'flee') {
        let best = -1, bd = 9;
        const step = 3;
        for (let i = th.liveStart; i < th.n; i += step) {
          const d = Math.hypot(th.x[i] - m.x, th.y[i] - m.y);
          if (d < bd && !repelled(th.x[i], th.y[i])) { bd = d; best = i; }
        }
        const dd = Math.hypot(p.x - m.x, p.y - m.y);
        // they come to what moves: stand still a moment and they forget her (the thread still draws them)
        if (dd < (this.still > 1.2 ? 0.45 : Math.abs(p.vx) > 3.5 ? 5.5 : 4) && (best < 0 || bd > 3.5) && !repelled(p.x, p.y) && !p.dead) {
          tx = p.x; ty = p.y + 0.1; m.st = 'seek';
          if (dd < 0.5) { m.st = 'doll'; this.emit('mothOn', { x: m.x, y: m.y }); continue; }
        } else if (best >= 0) {
          tx = th.x[best]; ty = th.y[best] + 0.1; m.st = 'seek';
          // it tries the thread first, circling it; a thread that is being shaken or swung on it cannot settle on
          if (bd < 1.1) {
            const shaken = Math.hypot(th.x[best] - th.ox[best], th.y[best] - th.oy[best]) > 0.012;
            m.near = shaken ? 0 : m.near + dt;
            if (m.near < 0.9) { tx += Math.cos(m.t * 6 + m.seed) * 0.8; ty += 0.35 + Math.sin(m.t * 6 + m.seed) * 0.45; }
          } else m.near = 0;
          if (bd < 0.35 && m.near > 0.9) { m.st = 'land'; m.idx = best; m.near = 0; continue; }
        } else m.st = 'wander';
      }
      if (m.flee > 0) { const a = Math.atan2(m.y - p.y, m.x - p.x); tx = m.x + Math.cos(a) * 6; ty = m.y + Math.abs(Math.sin(a)) * 4 + 2; }
      if (repelled(m.x, m.y)) { const b = litBells.find((b) => Math.hypot(b.x - m.x, b.y + 1 - m.y) < 5.2); tx = m.x + (m.x - b.x) * 2; ty = m.y + (m.y - b.y) * 2; }
      // flutter steering
      const sp = m.st === 'seek' ? 3.6 : m.flee > 0 ? 6 : 2.2;
      const dx = tx - m.x, dy = ty - m.y, dl = Math.hypot(dx, dy) || 1;
      m.vx += (dx / dl * sp - m.vx) * Math.min(1, dt * 2.5) + Math.sin(m.t * 7 + m.seed) * dt * 9;
      m.vy += (dy / dl * sp - m.vy) * Math.min(1, dt * 2.5) + Math.cos(m.t * 5.3 + m.seed) * dt * 11;
      m.x += m.vx * dt; m.y += m.vy * dt;
      const d = this.T.d(m.x, m.y);
      if (d < 0.25) { const [gx, gy] = this.T.grad(m.x, m.y); m.x += gx * (0.25 - d); m.y += gy * (0.25 - d); m.vx += gx * 2; m.vy += gy * 2; }
      // drift home if the doll is far away
      if (Math.hypot(m.x - m.nest.x, m.y - m.nest.y) > 30) { m.x = m.nest.x; m.y = m.nest.y; }
    }
  }
  _scare(m) {
    if (m.st === 'land' || m.st === 'doll') this.emit('scatter', { x: m.x, y: m.y });
    // they get used to it: each fright soon after another keeps it away for less
    m.used = this.time - (m.lastFright ?? -99) < 8 ? Math.min(3, m.used + 1) : 0; m.lastFright = this.time;
    const away = 2.6 * 0.78 ** m.used;
    m.st = 'flee'; m.flee = away; m.idx = -1; m.near = 0;
    const a = Math.atan2(m.y - this.player.y, m.x - this.player.x);
    m.vx = Math.cos(a) * 7; m.vy = Math.sin(a) * 7 + 2;
    setTimeout(() => { if (m.st === 'flee') m.st = 'wander'; }, away * 1000);
  }

  // ── hazards ────────────────────────────────────────────────────────────
  _hazards(dt) {
    const p = this.player, th = this.thread;
    if (p.dead) return;
    for (const chain of this.thorns) for (const [x, y] of chain) if (Math.abs(x - p.x) < 0.6 && Math.abs(y - p.y) < 0.62) { this._die('thorns'); return; }
    for (const k of this.ink) {
      const surf = k.y + Math.sin(p.x * 1.7 + this.time * 1.3) * 0.05;
      if (p.x > k.x0 && p.x < k.x1 && p.y - 0.15 < surf && p.y > k.y - 6) { this._die('ink'); return; }
      // ink eats the warm thread
      for (let i = th.liveStart; i < th.n; i++) {
        if (th.x[i] > k.x0 && th.x[i] < k.x1 && th.y[i] < k.y + 0.02 && th.y[i] > k.y - 6) {
          th.wear[i] += dt * 1.6;
          if (th.wear[i] >= 1) { th.cut(i); this.emit('dissolve', { x: th.x[i], y: th.y[i] }); break; }
        }
      }
    }
    for (const dr of this.drips) {
      if (Math.hypot(dr.x - p.x, dr.y - p.y) > 40) continue;
      if (!dr.drop) {
        dr.t -= dt; dr.swell = clamp(1 - dr.t / 1.1, 0, 1);
        if (dr.t <= 0) { dr.drop = { x: dr.x, y: dr.y - 0.15, vy: 0 }; dr.t = 2.6 + Math.random() * 1.6; dr.swell = 0; this.emit('drip', { x: dr.x, y: dr.y }); }
      } else {
        const d = dr.drop;
        d.vy -= 24 * dt; d.y += d.vy * dt;
        if (Math.hypot(d.x - p.x, d.y - p.y) < 0.42) { dr.drop = null; this._die('ink'); return; }
        // a drop only threatens the doll. It used to cut the thread too, and the thread lies on the islands right under
        // the drips, so a drop fell on it every few seconds and the next swing broke: the player could not avoid it.
        // Now it splashes off the yarn harmlessly.
        if (!d.hitThread) for (let i = th.liveStart; i < th.n; i++) if (Math.abs(th.x[i] - d.x) < 0.2 && Math.abs(th.y[i] - d.y) < 0.3) { d.hitThread = true; this.emit('splash', { x: d.x, y: d.y }); break; }
        if (dr.drop && (this.T.d(d.x, d.y) < 0 || this.ink.some((k) => d.y < k.y && d.x > k.x0 && d.x < k.x1))) { this.emit('splash', { x: d.x, y: d.y }); dr.drop = null; }
      }
    }
  }
  _die(cause) {
    const p = this.player;
    p.dead = true; p.deadT = 0; this.lost = (this.lost || 0) + 1;
    this.emit('death', { x: p.x, y: p.y, cause });
    // leave the body: floating on the ink, eaten hollow if the moths had it, otherwise lying on the floor below
    let y = p.y, kind = cause === 'moths' ? 'husknest' : 'husk';
    const pool = this.ink.find((k) => p.x > k.x0 && p.x < k.x1 && p.y < k.y + 1.5);
    if (cause === 'ink' && pool) { y = pool.y - 0.06; kind = 'huskink'; }
    else { const gy = this.T.ground(p.x, p.y + 0.3, 40); if (gy !== null) y = gy - 0.03; }
    this.husks.push({ x: p.x, y, kind, flip: p.facing, seed: (Math.random() * 1e6) | 0 });
    if (this.husks.length > 40) this.husks.shift();
  }
  _respawn() {
    const c = this.checkpoint, p = this.player;
    this.thread.rewind();
    p.reset(c.x + 0.6, c.y + 0.6);
    this.hurt = 0;
    for (const m of this.moths) { m.st = 'wander'; m.idx = -1; m.flee = 1.5; m.x = m.nest.x; m.y = m.nest.y; }
    this.deep.onRespawn(); this.rig.onRespawn(); this.kindle.onRespawn();
    this.emit('respawn', { x: p.x, y: p.y });
  }

  _pickups() {
    const p = this.player;
    for (const s of this.skeins) if (!s.taken && Math.hypot(s.x - p.x, s.y + 0.25 - p.y) < 0.95) {
      s.taken = true; this.skeinCount++; this.emit('skein', { x: s.x, y: s.y, n: this.skeinCount });
    }
    for (const s of this.secrets) {
      const [cx, cy, rx, ry] = s.r;
      // the rock opens only when she walks into what is drawn as rock: her body has to reach its face (the zone only says
      // she got there through the air, so standing on the far side of a wall from it does nothing)
      if (!s.open && s.zone.has(p.x, p.y) && (faceD(s.hide, p.x, p.y) < MOUTH || faceD(s.hide, p.x, p.y + 0.4) < MOUTH - 0.1)) { s.open = true; this.emit('secretOpen', { i: s.i, hide: s.hide, x: p.x, y: p.y }); }
      if (!s.seen && ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 < 1.0) { s.seen = true; this.emit('secret', { name: s.name, i: s.i, x: p.x, y: p.y }); }
      if (!s.taken && Math.hypot(s.x - p.x, s.y + 0.2 - p.y) < 0.9 && !this.hiddenAt(s.x, s.y + 0.2)) {
        s.taken = true;
        this.emit('keepsake', { x: s.x, y: s.y, kind: s.kind, what: s.what, text: s.text, n: this.secrets.filter((q) => q.taken).length, of: this.secrets.length });
        if (this.whole) this.emit('allfound', { x: s.x, y: s.y });
      }
    }
  }
  _memories() {
    const p = this.player;
    for (const m of this.memories) if (!m.heard && Math.hypot(m.x - p.x, m.y - p.y) < 2.0) { m.heard = true; m.at = this.time; this.emit('memory', { id: m.id, text: m.text, x: m.x, y: m.y }); }
  }
  _hintsUpdate() {
    const p = this.player;
    this.hint = null;
    if (this.intro && !this.intro.done) return;      // no prompts while she walks out of the cottage
    for (const h of this.hints) {
      if (h.done) continue;
      if (h.when && !h.when(this)) continue;
      if (p.x > h.x0 && p.x < h.x1 && p.y > h.y0 && p.y < h.y1) { this.hint = h; if (h.until && h.until(this)) h.done = true; break; }
    }
  }

  // still drawn as rock: inside a hidden room nobody has found yet, or one whose rock has not crumbled this far (main.js
  // moves `rev` outward from where she stood). Nothing there is drawn, lit or picked up.
  hiddenAt(x, y) {
    return this.secrets.some((s) => (!s.open || s.rev) && x > s.hide[0] && x < s.hide[2] && y > s.hide[1] - 0.5 && y < s.hide[3]
      && !(s.rev && Math.hypot(x - s.rev.x, y - s.rev.y) < s.rev.r));
  }

  // ── lights for the renderer ────────────────────────────────────────────
  lights(cam, viewW, viewH) {
    const out = [];
    const mx = viewW / 2 + 6, my = viewH / 2 + 6;
    const vis = (x, y) => Math.abs(x - cam[0]) < mx && Math.abs(y - cam[1]) < my;
    const t = this.time, p = this.player, th = this.thread, low = 1 - 0.9 * (this.dim || 0), eyes = 1 + 0.9 * (this.dim || 0);
    for (const l of this.lamps) if (vis(l.x, l.y)) {
      const fl = 1 + (Math.sin(t * 13 + l.x) * 0.05 + Math.sin(t * 7.3) * 0.06) * l.flicker;
      out.push({ x: l.x, y: l.y, r: l.r, i: l.i * fl * eyes, c: l.c, soft: 10 });
    }
    // the doll's own warmth
    if (!p.dead && !this.hideDoll && !(this.snuff > 0.98)) out.push({ x: p.x, y: p.y + 0.3, r: this.whole ? 6.8 : 4.6, i: (this.whole ? 1.05 : 0.9) * p.scale * (1 - (this.snuff || 0)) * low, c: [1.0, 0.5, 0.4], soft: 12 });
    // the thread: a light every ~0.9 m along the visible polyline
    const P = th.poly, n = th.polyN;
    let acc = 0, budget = 96, lx = P[0], ly = P[1];
    for (let k = 1; k < n && budget > 0; k++) {
      const x = P[k * 5], y = P[k * 5 + 1], st = P[k * 5 + 2];
      const seg = Math.hypot(x - lx, y - ly); lx = x; ly = y;
      if (st === 2 || st === 4) { acc = 0; continue; }
      acc += seg;
      if (acc < 0.95) continue;
      acc = 0;
      if (!vis(x, y) || (y < this.deep.rise.level && y > -545 && this.deep.rise.level > this.deep.rise.y0 + 0.5)) continue;
      const lit = (st === 0 ? 0.34 : 0.6) * (1 - (this.snuff || 0)) * low;
      if (lit < 0.01) continue;
      const d = this.T.d(x, y);
      let ox = x, oy = y;
      if (d < 0.18) { const [gx, gy] = this.T.grad(x, y); ox += gx * (0.18 - d); oy += gy * (0.18 - d); }
      out.push({ x: ox, y: oy, r: 4.2, i: lit, c: RED, soft: 7 });
      budget--;
    }
    // pluck fronts
    for (const w of th.waves) if (w.fx !== undefined && vis(w.fx, w.fy)) out.push({ x: w.fx, y: w.fy, r: 6, i: 1.4 * clamp(w.life / 3, 0, 1), c: [1.0, 0.3, 0.22], soft: 8 });
    for (const b of this.bells) if (b.lit > 0 && vis(b.x, b.y)) out.push({ x: b.x, y: b.y + 1.1, r: 7.5, i: (0.75 + b.ring * 0.8) * b.lit, c: [0.85, 0.9, 0.95], soft: 9 });
    // a cold breath of light along the brambles so the danger is always visible
    for (const chain of this.thorns) for (let i = 0; i < chain.length; i += 6) {
      const [x, y] = chain[i];
      if (vis(x, y)) out.push({ x, y: y + 0.6, r: 3.2, i: 0.32, c: [0.75, 0.8, 0.95], soft: 0 });
    }
    for (const pg of this.pegs) if (pg.glow > 0.05 && vis(pg.x, pg.y)) out.push({ x: pg.x, y: pg.y + 0.6, r: 2.6, i: 0.5 * pg.glow, c: RED, soft: 10 });
    for (const [sx0, sx1, sy] of L.SHELVES) if (vis((sx0 + sx1) / 2, sy)) out.push({ x: (sx0 + sx1) / 2, y: sy + 0.7, r: 2.8, i: 0.2, c: [0.72, 0.76, 0.88], soft: 0 });
    for (const s of this.rig.spindles) if (vis(s.x, s.y)) out.push({ x: s.x, y: s.y + 0.4, r: 3.2, i: 0.36 + 0.35 * s.v, c: s.v > 0.5 ? RED : [0.72, 0.76, 0.88], soft: 10 });
    for (const h of this.rig.pulls) if (h.f < 1 && vis(h.x, h.y)) out.push({ x: h.x, y: h.y - 0.1, r: 2.4, i: 0.22, c: [0.85, 0.8, 0.7], soft: 10 });
    for (const gt of this.gates) if (gt.rig && !gt.bridge && gt.open < 0.9 && vis((gt.x0 + gt.x1) / 2, gt.base)) for (const s of [-0.9, 0.9]) out.push({ x: (gt.x0 + gt.x1) / 2 + s, y: gt.base + 1.4, r: 3.6, i: 0.24, c: [0.78, 0.76, 0.8], soft: 6 });
    for (const gt of this.gates) if (gt.give && gt.open < 1 && vis((gt.x0 + gt.x1) / 2, gt.y1)) out.push({ x: (gt.x0 + gt.x1) / 2, y: gt.y1 + 0.5, r: 2.6, i: 0.3, c: [0.78, 0.76, 0.84], soft: 6 });
    const br = this.rig.gates.bridge;
    if (br && br.x0 < br.end - 0.1 && vis(br.x0, br.y1)) out.push({ x: br.x0 + 0.4, y: br.y1 + 0.6, r: 4, i: 0.4, c: [0.85, 0.8, 0.72], soft: 8 }, { x: br.x0 + 5, y: br.y1 + 0.8, r: 4, i: 0.22, c: [0.75, 0.76, 0.82], soft: 8 });
    for (const b of this.rig.bobbins) if (vis(b.x, b.y)) out.push({ x: b.x, y: b.y + 0.4, r: 4.2, i: 0.34, c: [0.8, 0.72, 0.62], soft: 8 });
    for (const m of this.memories) if (!m.heard && vis(m.x, m.y)) out.push({ x: m.x, y: m.y + 0.1, r: 3.0, i: 0.3 + Math.sin(t * 2 + m.x) * 0.08, c: [0.95, 0.9, 0.8], soft: 10 });
    for (const h of this.husks) if (vis(h.x, h.y)) out.push({ x: h.x, y: h.y + 0.3, r: 1.8, i: 0.1, c: [0.72, 0.74, 0.86], soft: 10 });
    for (const s of this.skeins) if (!s.taken && vis(s.x, s.y)) out.push({ x: s.x, y: s.y + 0.3, r: 2.2, i: 0.45, c: RED, soft: 10 });
    // a keepsake gives off only a faint warm glint: enough to catch the eye through a crack, not to find it from afar
    for (const s of this.secrets) if (!s.taken && s.open && vis(s.x, s.y) && !this.hiddenAt(s.x, s.y + 0.2)) out.push({ x: s.x, y: s.y + 0.35, r: 2.2, i: 0.42 + 0.08 * Math.sin(t * 1.7 + s.bob), c: [1.0, 0.86, 0.62], soft: 10 });
    if (!this.noLore) out.push(...loreLights(this.lore, t, (x, y) => vis(x, y) && !this.hiddenAt(x, y)));
    for (const q of this.glows) if (vis(q.x, q.y) && out.length < 150 && !this.hiddenAt(q.x, q.y)) out.push({ x: q.x + q.nx * 0.3, y: q.y + q.ny * 0.3, r: q.r * (0.8 + 0.2 * Math.min(2, q.b)), i: q.i * Math.min(2.6, q.b) * (1 - (this.snuff || 0)), c: q.c, soft: 8 });
    if (this.extraLights) out.push(...this.extraLights);
    // a found item held up in the showcase: a warm light on it (and on her face below it)
    if (this.showcase && this.showcase.item) { const it = this.showcase.item; out.push({ x: it.x, y: it.y, r: 3.2, i: 0.3 * it.a, c: [1.0, 0.82, 0.6], soft: 10 }); }
    // her shelf, close: the window, her own warmth and the thread are right beside it and would wash it out; one soft light on the boards
    const SC = this.showcase;
    if (SC && SC.shelf && SC.mode === 'board') { for (const l of out) l.i *= 0.3; out.push({ x: 15.1, y: 2.75, z: 1.2, r: 2.6, i: 0.6, c: [0.96, 0.9, 0.8], soft: 12 }); }
    // the cottage doorway while she walks out: warm room light spilling onto the snow
    if (this.intro && this.intro.door > 0.01) out.push({ x: L.COTTAGE.x + 5.975, y: L.COTTAGE.y + 0.15, r: 3.2, i: 0.28 * this.intro.door, c: [1.0, 0.62, 0.3], soft: 10 });   // low, on the step: a lamp at her height washes her out
    return out;
  }
}

// The knitter's grey thread: pinned at waypoints, draped by gravity, resting on the rock.
function buildGrey(T) {
  const W = L.GREY.map(([x, y]) => {
    let px = x, py = y;
    for (let k = 0; k < 6; k++) { const d = T.d(px, py); if (d > 0.08) break; const [gx, gy] = T.grad(px, py); px += gx * (0.1 - d); py += gy * (0.1 - d); }
    // (a point laid on the ground lies on the ground)
    const g = T.ground(px, py, 0.75);
    if (g !== null && T.d(px, py) > 0.08 && T.grad(px, g)[1] > 0.8) py = g + 0.02;
    return [px, py];
  });
  const pts = [], pins = [];
  for (let i = 0; i < W.length - 1; i++) {
    const [ax, ay] = W[i], [bx, by] = W[i + 1];
    const Lw = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.ceil(Lw / 0.3));
    for (let j = 0; j < m; j++) { pts.push([ax + (bx - ax) * j / m, ay + (by - ay) * j / m]); pins.push(j === 0); }
  }
  pts.push(W[W.length - 1]); pins.push(true);
  const n = pts.length, x = new Float32Array(n), y = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { x[i] = pts[i][0]; y[i] = pts[i][1]; }
  for (let i = 1; i < n; i++) r[i] = Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]) * 1.06; // a little slack to sag
  for (let it = 0; it < 160; it++) {
    for (let i = 0; i < n; i++) if (!pins[i]) y[i] -= 0.012;
    for (let k = 0; k < 2; k++) for (let i = 1; i < n; i++) {
      const dx = x[i] - x[i - 1], dy = y[i] - y[i - 1], d = Math.hypot(dx, dy);
      if (d <= r[i]) continue;
      const diff = (d - r[i]) / d;
      const wa = pins[i - 1] ? 0 : 0.5, wb = pins[i] ? 0 : 0.5, s = wa + wb || 1;
      x[i - 1] += dx * diff * wa / s; y[i - 1] += dy * diff * wa / s; x[i] -= dx * diff * wb / s; y[i] -= dy * diff * wb / s;
    }
    for (let i = 0; i < n; i++) { if (pins[i]) continue; const d = T.d(x[i], y[i]); if (d < 0.06) { const [gx, gy] = T.grad(x[i], y[i]); x[i] += gx * (0.06 - d); y[i] += gy * (0.06 - d); } }
  }
  // laid along the rock's face wherever a span between two points would still cut through it
  const X = [x[0]], Y = [y[0]];
  for (let i = 1; i < n; i++) { hug(T, x[i - 1], y[i - 1], x[i], y[i], (hx, hy) => { X.push(hx); Y.push(hy); }, 0.055, true, 16); X.push(x[i]); Y.push(y[i]); }
  return { x: Float32Array.from(X), y: Float32Array.from(Y), n: X.length };
}
function nearestOn(g, px, py) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < g.n; i++) { const d = Math.hypot(g.x[i] - px, g.y[i] - py); if (d < bd) { bd = d; best = i; } }
  return { x: g.x[best], y: g.y[best], gi: best };
}

// How far (x, y) is from the face of a hidden room's plug of rock, as it is drawn (terrain.js `_drawn`: the same box and grain).
export function faceD(r, x, y) { return Math.max(r[0] - x, x - r[2], r[1] - y, y - r[3]) + (fbm(x * 1.1, y * 1.1, 3) - 0.5) * 0.3 + 0.06; }
// her body (radius 0.3) a little into the drawn face
const MOUTH = 0.24;
// The air a hidden room can be opened from: its own, and the crack outside it within `at` metres of walking (measured through
// the air, so being on the far side of a wall from it does not count). Opening also needs her to touch the drawn rock (faceD).
function mouthZone(T, s) {
  const G = 0.25, at = s.at ?? 3.0, [hx0, hy0, hx1, hy1] = s.hide, x0 = hx0 - at - 1, y0 = hy0 - at - 1;
  const w = Math.ceil((hx1 - hx0 + 2 * at + 2) / G), h = Math.ceil((hy1 - hy0 + 2 * at + 2) / G);
  const dist = new Float32Array(w * h).fill(1e9);
  const at2 = (i, j) => [x0 + (i + 0.5) * G, y0 + (j + 0.5) * G];
  const inside = (x, y) => x > hx0 && x < hx1 && y > hy0 && y < hy1;
  const ci = Math.floor((s.r[0] - x0) / G), cj = Math.floor((s.r[1] - y0) / G);
  const q = [cj * w + ci]; dist[q[0]] = 0;
  while (q.length) {                                  // Dijkstra with a lazy queue: the window is small
    let b = 0; for (let k = 1; k < q.length; k++) if (dist[q[k]] < dist[q[b]]) b = k;
    const c = q.splice(b, 1)[0], i = c % w, j = (c / w) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const [x, y] = at2(ni, nj);
      if (T.d(x, y) < 0.1) continue;
      const nd = dist[c] + (inside(x, y) ? 0 : G * Math.hypot(di, dj)), n = nj * w + ni;
      if (nd > at || nd >= dist[n] - 1e-4) continue;
      dist[n] = nd; q.push(n);
    }
  }
  return { has(x, y) { const i = Math.floor((x - x0) / G), j = Math.floor((y - y0) / G); return i >= 0 && j >= 0 && i < w && j < h && dist[j * w + i] < 1e8; } };
}

function makeHints() {
  return [
    { x0: 0, x1: 34, y0: -3, y1: 8, t: 'walk', keys: ['left', 'right', 'jump'], text: 'walk · jump', until: (w) => w.player.x > 30 },
    { x0: 34, x1: 46, y0: -3, y1: 8, t: 'wind', text: 'the thread follows you · walk back to wind it in', until: (w) => w.player.y < -3 },
    { x0: 38, x1: 58, y0: -60, y1: -36, when: (w) => w.checkpoint === w.pegs[1], keys: ['grip', 'up', 'down'], text: 'hold to grip the thread · climb · lower yourself over the lip', until: (w) => w.player.x < 44 && w.player.y < -46 },
    { x0: 14, x1: 40, y0: -84, y1: -68, keys: ['pluck'], text: 'pluck the thread · the moths fear its song', until: (w) => w.bells[0].lit > 0 },
    { x0: 4, x1: 30, y0: -122, y1: -104, keys: ['grip', 'jump'], text: 'grip in the air near an iron ring to swing · jump to let go', until: (w) => w.player.x > 40 },
    { x0: 98, x1: 118, y0: -124, y1: -110, when: (w) => w.gates[1].open < 1, text: 'the veil listens for every bell your thread has touched', keys: ['pluck'] },
    { x0: 29, x1: 44, y0: -262, y1: -248, keys: ['grip'], text: 'hang from the ring and it goes down · the door goes up · swing on before it drops', until: (w) => w.player.x < 15 },
    { x0: 4, x1: 13, y0: -284, y1: -268, when: (w) => w.rig.pulls[0].f < 1, keys: ['jump', 'grip', 'up'], text: 'catch the handle in the air · land, still holding · wind in', until: (w) => w.player.x > 24 },
    { x0: 26, x1: 68, y0: -305, y1: -294, text: 'the spindles turn where your thread runs past them · the door wants both', until: (w) => w.player.x < 27 },
    { x0: 88, x1: 104, y0: -407, y1: -396, text: 'lie low in the gutter and let it roll over you', until: (w) => w.player.x < 62 },
    { x0: 34, x1: 62, y0: -286, y1: -266, keys: ['pluck'], text: 'when the earth crumbles, stop dead · it strikes where you were going · or pluck, but not too often', until: (w) => w.player.x > 62 },
    { x0: 55, x1: 98, y0: -92, y1: -76, keys: ['dim'], text: 'hold to dim the thread · your eyes get used to the dark', until: (w) => w.dim > 0.9 },
    { x0: 66, x1: 98, y0: -327, y1: -314, keys: ['dim'], text: 'hold to dim · in the dark they feel less of you', until: (w) => w.player.x < 66 },
    { x0: 56, x1: 72, y0: -368, y1: -360, keys: ['grip', 'up'], text: 'hold to grip the rope · climb · jump to leap off', until: (w) => w.player.y > -359 },
    { x0: 70, x1: 80, y0: -359, y1: -351, text: 'the heddles fall to the beat · wait for the creak, then run', until: (w) => w.player.x > 81 },
    { x0: 60, x1: 90, y0: -541, y1: -530, when: (w) => w.deep.rise.on, keys: ['grip', 'up'], text: 'climb', until: (w) => w.player.y > -515 },
    { x0: 78, x1: 90, y0: -474, y1: -464, when: (w) => w.rig.pulls[2] && w.rig.pulls[2].f < 1, keys: ['jump', 'grip', 'up'], text: 'catch the handle · land, still holding · wind in' },
  ];
}
