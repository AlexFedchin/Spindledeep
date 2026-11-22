// Game rules: the doll, its thread and everything in the deep. No drawing, no sound — it emits events.
import * as L from './level.js';
import { Thread, SP } from './thread.js';
import { Player } from './player.js';
import { clamp, rand, mulberry, lerp } from './util.js';
import { buildLore, loreLights } from './props.js';

const BASE_YARN = 92, SKEIN_YARN = 14;
const RED = [1.0, 0.16, 0.12];

export class World {
  constructor(T) {
    this.T = T;
    this.thread = new Thread(T);
    this.player = new Player(T);
    const snap = (e, up = 2.2) => {
      // stand on the nearest floor; if the authored spot is inside rock, climb out to the surface above it
      let y0 = e.y + up;
      for (let k = 0; k < 200 && T.d(e.x, y0) < 0; k++) y0 += 0.05;
      const g = T.ground(e.x, y0, 7); return g === null ? e : { ...e, y: g };
    };
    this.pegs = L.PEGS.map((p, i) => ({ ...snap(p), i, tied: !!p.home, glow: p.home ? 1 : 0 }));
    this.hooks = L.HOOKS.map((h) => ({ ...h, ring: 0 }));
    this.bells = L.BELLS.map((b, i) => ({ ...snap(b), i, lit: 0, ring: 0, sway: rand(0, 6) }));
    this.gates = L.GATES.map((g) => ({ ...g, open: 0 }));
    this.skeins = L.SKEINS.map((s) => ({ ...snap(s, 1.5), taken: false, bob: rand(0, 6) }));
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
    this.memories = L.MEMORIES.map((m) => ({ ...m, ...nearestOn(this.grey, m.x, m.y), heard: false }));
    this.finale = { ...L.FINALE, ...nearestOn(this.grey, L.FINALE.x, L.FINALE.y) };
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
    this.reset();
  }

  reset() {
    const home = this.pegs[0];
    this.checkpoint = home;
    this.thread.reset(home.x, home.y + 0.35);
    this.player.reset(L.START.x, L.START.y);
  }

  get maxYarn() { return BASE_YARN + this.skeinCount * SKEIN_YARN; }
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
    const p = this.player, th = this.thread;
    const ctx = { budgetLeft: () => this.budgetLeft(), gates: this.gates, hooks: this.hooks };
    const blank = { axisX: 0, axisY: 0, held: {}, pressed: {} };
    p.update(dt, controls && !p.dead && !this.ending ? inp : blank, th, ctx);
    for (const e of p.events) this.emit(e, { x: p.x, y: p.y, v: p.landV });
    th.update(dt, p.bx, p.by, this.budgetLeft(), false);
    th.buildPoly(p.bx, p.by);

    if (!p.dead && !this.ending && controls) this._interact(inp, dt);
    this._bells(dt);
    this._gates(dt);
    this._moths(dt);
    this._hazards(dt);
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
    const nearFinale = Math.hypot(this.finale.x - p.x, this.finale.y - p.y) < 2.0;
    if (nearFinale) this.prompt = { a: 'act', t: 'Tie the two threads together' };
    else if (peg) this.prompt = { a: 'act', t: 'Tie the thread to the peg' };
    else if (nearMend) this.prompt = { a: 'act', t: 'Mend the thread' };
    // reaching a peg ties the thread to it by itself, so a fall always sends you back to the last peg you passed
    const autoTie = peg && !nearFinale && p.grounded && !th.locked;
    if (autoTie) this.prompt = null;
    if (inp.pressed.act || autoTie) {
      if (nearFinale) { if (inp.pressed.act) { this.ending = { t: 0 }; this.emit('finale'); } }
      else if (peg) {
        th.tie(peg.x, peg.y + 0.35);
        peg.tied = true; this.checkpoint = peg; this.hurt = 0;
        p.tieT = 0.6;
        this.emit('tie', { x: peg.x, y: peg.y });
      } else if (nearMend) { th.mend(); this.emit('mend', { x: p.x, y: p.y }); }
    }
    if (inp.pressed.pluck && (this.pluckCD || 0) <= 0) {
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
        this.moths.push({ nest, x: nest.x + Math.cos(a) * 2, y: nest.y + Math.sin(a) * 1.5, vx: 0, vy: 0, st: 'wander', t: rand(0, 5), idx: -1, flap: rand(0, 6), flee: 0, size: rand(0.85, 1.2), seed: Math.random() * 1000 });
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
        if (m.idx < th.liveStart || m.idx >= th.n || th.dead[m.idx] || m.flee > 0) { m.st = 'wander'; m.idx = -1; }
        else {
          m.x = th.x[m.idx] + Math.sin(m.t * 3) * 0.02; m.y = th.y[m.idx] + 0.08;
          th.wear[m.idx] += dt / 4.2;
          if (Math.random() < dt * 0.8) this.emit('chew', { x: m.x, y: m.y });
          if (th.wear[m.idx] >= 1) {
            th.cut(m.idx); this.emit('cut', { x: m.x, y: m.y });
            m.st = 'wander'; m.idx = -1; m.flee = 2;
          }
          continue;
        }
      }
      if (m.st === 'doll') {
        if (m.flee > 0 || p.dead) m.st = 'wander';
        else {
          m.x = p.x + Math.cos(m.seed) * 0.25; m.y = p.y + 0.15 + Math.sin(m.seed) * 0.2;
          this.hurt += dt * 0.9;
          if (this.budgetLeft() < -1.5 && !p.dead) this._die('moths');
          continue;
        }
      }
      // pick a target: the warm thread or the doll, if near and not guarded by a bell
      if (m.flee <= 0 && m.st !== 'flee') {
        let best = -1, bd = 9;
        const step = 3;
        for (let i = th.liveStart; i < th.n; i += step) {
          const d = Math.hypot(th.x[i] - m.x, th.y[i] - m.y);
          if (d < bd && !repelled(th.x[i], th.y[i])) { bd = d; best = i; }
        }
        const dd = Math.hypot(p.x - m.x, p.y - m.y);
        if (dd < 4 && (best < 0 || bd > 3.5) && !repelled(p.x, p.y) && !p.dead) {
          tx = p.x; ty = p.y + 0.1; m.st = 'seek';
          if (dd < 0.5) { m.st = 'doll'; this.emit('mothOn', { x: m.x, y: m.y }); continue; }
        } else if (best >= 0) {
          tx = th.x[best]; ty = th.y[best] + 0.1; m.st = 'seek';
          if (bd < 0.35) { m.st = 'land'; m.idx = best; continue; }
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
    m.st = 'flee'; m.flee = 2.6; m.idx = -1;
    const a = Math.atan2(m.y - this.player.y, m.x - this.player.x);
    m.vx = Math.cos(a) * 7; m.vy = Math.sin(a) * 7 + 2;
    setTimeout(() => { if (m.st === 'flee') m.st = 'wander'; }, 2600);
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
        for (let i = th.liveStart; i < th.n; i++) if (Math.abs(th.x[i] - d.x) < 0.2 && Math.abs(th.y[i] - d.y) < 0.3) { th.cut(i); this.emit('dissolve', { x: d.x, y: d.y }); dr.drop = null; break; }
        if (dr.drop && (this.T.d(d.x, d.y) < 0 || this.ink.some((k) => d.y < k.y && d.x > k.x0 && d.x < k.x1))) { this.emit('splash', { x: d.x, y: d.y }); dr.drop = null; }
      }
    }
  }
  _die(cause) {
    const p = this.player;
    p.dead = true; p.deadT = 0;
    this.emit('death', { x: p.x, y: p.y, cause });
  }
  _respawn() {
    const c = this.checkpoint, p = this.player;
    this.thread.rewind();
    p.reset(c.x + 0.6, c.y + 0.6);
    this.hurt = 0;
    for (const m of this.moths) { m.st = 'wander'; m.idx = -1; m.flee = 1.5; m.x = m.nest.x; m.y = m.nest.y; }
    this.emit('respawn', { x: p.x, y: p.y });
  }

  _pickups() {
    const p = this.player;
    for (const s of this.skeins) if (!s.taken && Math.hypot(s.x - p.x, s.y + 0.25 - p.y) < 0.95) {
      s.taken = true; this.skeinCount++; this.emit('skein', { x: s.x, y: s.y, n: this.skeinCount });
    }
  }
  _memories() {
    const p = this.player;
    for (const m of this.memories) if (!m.heard && Math.hypot(m.x - p.x, m.y - p.y) < 2.0) { m.heard = true; this.emit('memory', { id: m.id, text: m.text, x: m.x, y: m.y }); }
  }
  _hintsUpdate() {
    const p = this.player;
    this.hint = null;
    for (const h of this.hints) {
      if (h.done) continue;
      if (h.when && !h.when(this)) continue;
      if (p.x > h.x0 && p.x < h.x1 && p.y > h.y0 && p.y < h.y1) { this.hint = h; if (h.until && h.until(this)) h.done = true; break; }
    }
  }

  // ── lights for the renderer ────────────────────────────────────────────
  lights(cam, viewW, viewH) {
    const out = [];
    const mx = viewW / 2 + 6, my = viewH / 2 + 6;
    const vis = (x, y) => Math.abs(x - cam[0]) < mx && Math.abs(y - cam[1]) < my;
    const t = this.time, p = this.player, th = this.thread;
    for (const l of this.lamps) if (vis(l.x, l.y)) {
      const fl = 1 + (Math.sin(t * 13 + l.x) * 0.05 + Math.sin(t * 7.3) * 0.06) * l.flicker;
      out.push({ x: l.x, y: l.y, r: l.r, i: l.i * fl, c: l.c, soft: 10 });
    }
    // the doll's own warmth
    if (!p.dead) out.push({ x: p.x, y: p.y + 0.3, r: 4.6, i: 0.9 * p.scale, c: [1.0, 0.5, 0.4], soft: 12 });
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
      if (!vis(x, y)) continue;
      const lit = st === 0 ? 0.34 : 0.6;
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
    for (const m of this.memories) if (!m.heard && vis(m.x, m.y)) out.push({ x: m.x, y: m.y + 0.1, r: 3.0, i: 0.3 + Math.sin(t * 2 + m.x) * 0.08, c: [0.95, 0.9, 0.8], soft: 10 });
    if (vis(this.finale.x, this.finale.y)) out.push({ x: this.finale.x, y: this.finale.y + 0.3, r: 3.5, i: 0.5, c: [0.95, 0.9, 0.8], soft: 10 });
    for (const s of this.skeins) if (!s.taken && vis(s.x, s.y)) out.push({ x: s.x, y: s.y + 0.3, r: 2.2, i: 0.45, c: RED, soft: 10 });
    if (!this.noLore) out.push(...loreLights(this.lore, t, vis));
    if (this.extraLights) out.push(...this.extraLights);
    return out;
  }
}

// The knitter's grey thread: pinned at waypoints, draped by gravity, resting on the rock.
function buildGrey(T) {
  const W = L.GREY.map(([x, y]) => {
    let px = x, py = y;
    for (let k = 0; k < 6; k++) { const d = T.d(px, py); if (d > 0.08) break; const [gx, gy] = T.grad(px, py); px += gx * (0.1 - d); py += gy * (0.1 - d); }
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
    for (let i = 0; i < n; i++) { if (pins[i]) continue; const d = T.d(x[i], y[i]); if (d < 0.05) { const [gx, gy] = T.grad(x[i], y[i]); x[i] += gx * (0.05 - d); y[i] += gy * (0.05 - d); } }
  }
  return { x, y, n };
}
function nearestOn(g, px, py) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < g.n; i++) { const d = Math.hypot(g.x[i] - px, g.y[i] - py); if (d < bd) { bd = d; best = i; } }
  return { x: g.x[best], y: g.y[best], gi: best };
}

function makeHints() {
  return [
    { x0: 0, x1: 34, y0: -3, y1: 8, t: 'walk', keys: ['left', 'right', 'jump'], text: 'walk · jump', until: (w) => w.player.x > 30 },
    { x0: 34, x1: 46, y0: -3, y1: 8, t: 'wind', text: 'the thread follows you · walk back to wind it in', until: (w) => w.player.y < -3 },
    { x0: 38, x1: 58, y0: -60, y1: -36, when: (w) => w.checkpoint === w.pegs[1], keys: ['grip', 'up', 'down'], text: 'hold to grip the thread · climb · lower yourself over the lip', until: (w) => w.player.x < 44 && w.player.y < -46 },
    { x0: 14, x1: 40, y0: -84, y1: -68, keys: ['pluck'], text: 'pluck the thread · the moths fear its song', until: (w) => w.bells[0].lit > 0 },
    { x0: 4, x1: 30, y0: -122, y1: -104, keys: ['grip', 'jump'], text: 'grip in the air near an iron ring to swing · jump to let go', until: (w) => w.player.x > 40 },
    { x0: 98, x1: 118, y0: -124, y1: -110, when: (w) => w.gates[1].open < 1, text: 'the veil listens for every bell your thread has touched', keys: ['pluck'] },
  ];
}
