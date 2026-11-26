// The deep's machinery, below the Hall of Chairs: rings swinging on chains, ropes and warp threads to climb, the
// hands that break out of the Hush's earth, the heddles and needles that slam, and the dark that rises in the Loom.
// Rules only (world.js calls it; draw.js draws it); it emits events through the world like everything else.
import * as L from './level.js';
import { clamp } from './util.js';

const TAU = Math.PI * 2;
const T_ground = (T, x, y) => T.ground(x, y + 1.5, 4);
// a stamper's cycle, as a fraction of its period: at rest, shaking (the warning), the slam, held, drawn back
// the hands. Each waits buried; when she comes near the earth over it crumbles (the warning), then it bursts out at where
// she WILL be, gropes after her a moment, and draws back. A pluck drives off only a hand that has already stirred, so
// playing the thread ahead of time does nothing. One that gets hold of her drags her to the rock: pluck to tear free.
// what follows her up the Loom comes hand over hand along the thread she has laid behind her. A pluck shakes it back down it, and
// the more often it is done the less far
export const CRAWL = { from: 24, v: 4.3, move: 0.95, per: 2.0, near: 7.5, grab: 1.1, shake: 10, less: 0.82, stun: 1.0, cost: 2.5, peg: 11 };
export const HAND = { stir: 0.5, stirLow: 0.8, gap: 0.9, lunge: 15, steer: 2.6, grope: 0.8, gropeV: 4.6, back: 6, cool: 1.0, hold: 0.9, drag: 3.2, stun: 1.7, stunAgain: 1.1, at: 9, grab: 0.5, cost: 9, lull: 1.0, most: 2,
  // every pluck down here rouses the earth (it forgets slowly): roused, it is quicker, reaches further, comes three at a time, and one that missed moves along the rock after her
  rouse: 0.26, calm: 0.055, quick: 0.3, far: 0.16, hunt: 3.4 };
const REST = 0.42, SHAKE = 0.64, SLAM = 0.69, HOLD = 0.8;
// how far along its arm a hand is clear of the rock it comes out of; the arm's half-thickness
const ARM0 = 0.25, ARM_R = 0.06;

export class Deep {
  constructor(W) {
    this.W = W;
    const T = W.T;
    this.ropes = L.ROPES.map(([x, y0, y1], i) => ({ x, y0, y1, i, warp: y0 < -430 }));
    // each hand grows out of the nearest rock, along its face
    this.hands = L.HANDS.map(([x, y, reach], i) => {
      let px = x, py = y;
      for (let k = 0; k < 120; k++) {
        const d = T.d(px, py);
        if (d < 0.04) break;
        const [gx, gy] = T.grad(px, py);
        px -= gx * Math.min(d, 0.2); py -= gy * Math.min(d, 0.2);
      }
      const [nx, ny] = T.grad(px, py);
      return { ax: px, ay: py, nx, ny, reach, ext: 0, tx: px, ty: py, dx: nx, dy: ny, i, grab: false, st: 'wait', t: 0, cool: 0 };
    });
    this.stampers = L.STAMPERS.map((s, i) => ({ ...s, i, f: 0, shake: 0, phase: 'rest' }));
    // the people who came when they were called: they stand on the floor of the Loom with their backs to her
    this.called = L.CALLED.map(([x, kind, h], i) => ({ x, x0: x, y: T.ground(x, L.RISE.y0 + 4, 8) ?? L.RISE.y0, kind, h, i, turned: false, seen: false, flip: i % 3 ? 1 : -1, tone: 0.5 + 0.35 * ((i * 7) % 5) / 5, lean: ((i * 13) % 7 - 3) * 0.008 }));
    this.crawler = { on: false, x: 84, y: L.RISE.y0 - 6, step: 0, jerk: 0, look: 0, t: 0, s: 0, gap: 99, stun: 0, used: 0, n: 0 };
    this.rise = { ...L.RISE, level: L.RISE.y0, on: false, t: 0, done: false, woke: false };
    this.lastPluck = -99;
  }

  // before the doll moves: rings swing and drag any thread caught in them along
  pre() {
    const W = this.W, t = W.time;
    for (const h of W.hooks) {
      if (!h.sway) continue;
      const [len, amp, per, ph] = h.sway;
      const a = amp * Math.sin(TAU * t / per + ph);
      h.x = h.ax + len * Math.sin(a); h.y = h.ay - len * Math.cos(a);
      h.a = a;
    }
    for (const q of W.thread.pivots) if (q.hook && q.hook.sway) { q.x = q.hook.x; q.y = q.hook.y; }
  }

  onPluck() {
    // they get used to it: a second pluck soon after holds them off for less, and hammering it only tears her free
    const since = this.W.time - this.lastPluck, again = since < 3, hammer = since < 0.7;
    this.lastPluck = this.W.time;
    const p = this.W.player;
    if (p.y < -262 && p.y > -342) this.roused = Math.min(1, (this.roused || 0) + HAND.rouse);
    let hit = false;
    for (const h of this.hands) {
      if (h.st === 'wait' || (Math.hypot(h.ax - p.x, h.ay - p.y) > HAND.at && Math.hypot(h.tx - p.x, h.ty - p.y) > 4)) continue;
      if (hammer && !h.grab) continue;
      if (h.grab) {
        this.W.hurt += HAND.cost;
        // roused, it has a better hold: the first pluck only loosens it
        if (--h.grip > 0) { h.t = Math.max(0, h.t - 0.55); this.W.emit('recoil', { x: h.tx, y: h.ty }); hit = true; continue; }
      }
      if (h.ext > 0.3) this.W.emit('recoil', { x: h.tx, y: h.ty });
      h.st = 'back'; h.grab = false; h.cool = again ? HAND.stunAgain : HAND.stun; hit = true;
    }
    const c = this.crawler;
    if (c.on && c.gap < 16) {
      c.used = this.W.time - c.last < 6 ? c.used + 1 : 0; c.last = this.W.time;
      c.s -= CRAWL.shake * CRAWL.less ** c.used; c.stun = CRAWL.stun; this.W.hurt += CRAWL.cost;
      this.W.emit('crawlShake', { x: c.x, y: c.y });
    }
    if (hit) this.lull = this.W.time + HAND.lull;       // a pluck that drove one off quiets the rest of the earth for a moment
  }

  onRespawn() {
    for (const h of this.hands) { h.ext = 0; h.grab = false; h.st = 'wait'; h.cool = 1; if (h.ox !== undefined) { h.ax = h.ox; h.ay = h.oy; h.nx = h.onx; h.ny = h.ony; h.moved = 0; } }
    this.roused = 0;
    const r = this.rise;
    this.crawler.on = false;
    this.crawler.s = -1;
    if (r.on || r.level > r.y0) { r.on = false; r.t = 0; r.level = Math.max(r.y0, Math.min(r.level, this.W.checkpoint.y - r.back)); }
  }

  update(dt) {
    const W = this.W, p = W.player, t = W.time;
    // ── hands ──
    const lit = W.bells.filter((b) => b.lit > 0.5);
    let out = 0;
    for (const h of this.hands) if (h.st !== 'wait' && h.st !== 'back') out++;
    const free = !p.dead && !W.ending;
    // they feel her through the ground: where she is going, while she moves. Dead still, they only have the last they felt
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 1.4) { this.felt = [p.vx, p.vy]; this.quiet = 0; } else this.quiet = (this.quiet || 0) + dt;
    const ro = this.roused = Math.max(0, (this.roused || 0) - HAND.calm * dt), dim = W.dim || 0;
    // it follows her under the ground while it is awake: crumbs fall behind her
    if (ro > 0.2 && free && sp > 1.4 && p.y < -262 && p.y > -342) {
      this.stalk = (this.stalk || 0) - dt * (0.6 + ro);
      if (this.stalk <= 0) { this.stalk = 1.3; const bx = p.x - Math.sign(p.vx || 1) * 2.2, gy = W.T.ground(bx, p.y + 1, 4); if (gy !== null) W.emit('stalk', { x: bx, y: gy, k: ro }); }
    }
    for (const h of this.hands) {
      if (h.ox === undefined) { h.ox = h.ax; h.oy = h.ay; h.onx = h.nx; h.ony = h.ny; h.moved = 0; }
      const dx = p.x - h.ax, dy = p.y + 0.1 - h.ay, d = Math.hypot(dx, dy);
      if (d > 26) { h.st = 'wait'; h.ext = 0; h.grab = false; if (h.moved) { h.ax = h.ox; h.ay = h.oy; h.nx = h.onx; h.ny = h.ony; h.moved = 0; } continue; }
      h.t += dt; h.cool = Math.max(0, h.cool - dt);
      const nearBell = lit.some((b) => Math.hypot(b.x - h.ax, b.y + 1 - h.ay) < 6 || Math.hypot(b.x - p.x, b.y + 1 - p.y) < 4.5);
      if ((nearBell || !free) && h.st !== 'wait' && !(h.grab && p.dead)) { h.st = 'back'; h.grab = false; }
      const go = (st) => { h.st = st; h.t = 0; };
      if (h.st === 'wait') {
        const reach = h.reach * (1 + HAND.far * ro) * (1 - 0.45 * dim) + 0.8, gap = HAND.gap * (1 - 0.4 * ro) * (1 + 0.8 * dim);
        if (free && !nearBell && h.cool <= 0 && this.quiet < 0.35 && W.time > (this.lull || 0) && W.time > (this.lastStir || 0) + gap && out < HAND.most + (ro > 0.55 ? 1 : 0) && d < reach && dx * h.nx + dy * h.ny > 0 && this._sees(h, p.x, p.y + 0.45)) { go('stir'); out++; this.lastStir = W.time; W.emit('stir', { x: h.ax, y: h.ay, nx: h.nx, ny: h.ny }); }
      } else if (h.st === 'stir') {
        if (h.t > (h.reach < 3 ? HAND.stirLow : HAND.stir) * (1 - HAND.quick * ro)) {
          // aim where she will be when it gets there
          let ax = p.x, ay = p.y + 0.1;
          for (let k = 0; k < 3; k++) { const tt = Math.hypot(ax - h.ax, ay - h.ay) / HAND.lunge; ax = p.x + p.vx * tt; ay = p.y + 0.1 + (p.grounded ? 0 : clamp(p.vy * tt, -2, 2)); }
          // she stopped: it strikes where she was heading
          h.deaf = this.quiet > 0.03 && !!this.felt;
          if (h.deaf) { const fx = clamp(this.felt[0] * 0.5, -2.6, 2.6); ax = p.x + (Math.abs(fx) < 1.7 ? Math.sign(fx || p.facing) * 1.7 : fx); ay = p.y; }
          // in the dark it goes for where she was
          h.blind = !h.deaf && dim > 0.55;
          if (h.blind) { ax = p.x - p.vx * 0.34; ay = p.y; }
          h.aimD = Math.min(h.reach + 0.4, Math.hypot(ax - h.ax, ay - h.ay) + 0.3);
          const l = Math.hypot(ax - h.ax, ay - h.ay) || 1;
          h.dx = (ax - h.ax) / l; h.dy = (ay - h.ay) / l; h.ext = 0.1;
          go('lunge');
          W.emit('reach', { x: h.ax, y: h.ay, nx: h.nx, ny: h.ny });
        }
      } else if (h.st === 'lunge' || h.st === 'grope') {
        const lunge = h.st === 'lunge';
        if (h.deaf && this.quiet <= 0) h.deaf = false;
        if (lunge) h.ext = Math.min(h.aimD, h.ext + dt * HAND.lunge);
        // it bends toward her: a little while it flies, more as it gropes
        const ux = dx / (d || 1), uy = dy / (d || 1), turn = h.deaf || h.blind ? 0 : (lunge ? HAND.steer : HAND.gropeV) * dt / Math.max(1, h.ext);
        const cr = h.dx * uy - h.dy * ux, an = clamp(Math.atan2(cr, h.dx * ux + h.dy * uy), -turn, turn), cs = Math.cos(an), sn = Math.sin(an);
        [h.dx, h.dy] = [h.dx * cs - h.dy * sn, h.dx * sn + h.dy * cs];
        if (!lunge && !h.deaf && !h.blind) h.ext += clamp(Math.min(h.reach + 0.5, d) - h.ext, -HAND.gropeV * dt, HAND.gropeV * dt);
        if (lunge && h.ext >= h.aimD) go('grope');
        else if (!lunge && h.t > HAND.grope) { go('back'); h.cool = h.deaf ? 4.5 - 2 * ro : HAND.cool; h.hunt = ro > 0.3 && !h.deaf && h.moved < 2; }       // one that closed on nothing gives up for a while
      } else if (h.st === 'hold') {
        // dragged to the rock it came out of
        h.ext = Math.max(0.7, h.ext - HAND.drag * dt);
        if (h.t > HAND.hold && free) W._die('hands');
      } else {
        h.ext = Math.max(0, h.ext - dt * (h.cool > 0.3 ? HAND.back * 1.6 : HAND.back));
        h.dx += (h.nx - h.dx) * Math.min(1, dt * 2); h.dy += (h.ny - h.dy) * Math.min(1, dt * 2);
        if (h.ext <= 0) { go('wait'); if (h.hunt) { h.hunt = false; this._shift(h); } }
      }
      const l = Math.hypot(h.dx, h.dy) || 1;
      // never through rock: the arm stops at the first rock it meets
      if (h.ext > ARM0) {
        const want = h.ext; h.ext = this._free(h, h.dx / l, h.dy / l, want);
        if (h.st === 'lunge' && h.ext < want - 0.02) go('grope');          // it struck rock: it gropes there a moment, then gives up
      }
      h.tx = h.ax + h.dx / l * h.ext; h.ty = h.ay + h.dy / l * h.ext;
      if (h.st === 'hold' && free) { p.x += (h.tx - p.x) * Math.min(1, dt * 14); p.y += (h.ty - p.y) * Math.min(1, dt * 14); p.vx = p.vy = 0; p.climb = null; p._collide(W.gates); }
      if (free && (h.st === 'lunge' || h.st === 'grope') && Math.hypot(h.tx - p.x, h.ty - p.y - 0.1) < (h.deaf ? 0.26 : h.blind ? 0.34 : HAND.grab) && this._sees(h, p.x, p.y + 0.45)) {
        h.grab = true; h.grip = ro > 0.55 ? 2 : 1; go('hold');
        W.emit('seize', { x: p.x, y: p.y });
      }
    }
    W.seized = free && this.hands.some((h) => h.st === 'hold');
    // ── heddles and needles ──
    for (const s of this.stampers) {
      const u = ((t + s.ph) / s.per) % 1;
      const prev = s.phase;
      if (u < REST) { s.f = 0; s.shake = 0; s.phase = 'rest'; }
      else if (u < SHAKE) { s.f = 0; s.shake = (u - REST) / (SHAKE - REST); s.phase = 'shake'; }
      else if (u < SLAM) { s.f = (u - SHAKE) / (SLAM - SHAKE); s.shake = 0; s.phase = 'slam'; }
      else if (u < HOLD) { s.f = 1; s.phase = 'hold'; }
      else { s.f = 1 - (u - HOLD) / (1 - HOLD); s.phase = 'back'; }
      const near = Math.hypot((s.r[0] + s.r[2]) / 2 + s.dir[0] * s.dist / 2 - p.x, (s.r[1] + s.r[3]) / 2 + s.dir[1] * s.dist / 2 - p.y) < 22;
      if (near && prev !== s.phase) {
        if (s.phase === 'shake') W.emit('stampWarn', { x: s.r[0], y: s.r[1], kind: s.kind });
        if (s.phase === 'hold') W.emit('stamp', { x: (s.r[0] + s.r[2]) / 2 + s.dir[0] * s.dist, y: s.r[1] + s.dir[1] * s.dist, kind: s.kind });
      }
      if (!p.dead && !W.ending && s.f > 0.12) {
        const [x0, y0, x1, y1] = this.swept(s);
        const cx = clamp(p.x, x0, x1), cy = clamp(p.y, y0, y1);
        if (Math.hypot(p.x - cx, p.y - cy) < p.r * 0.9) W._die(s.kind === 'needle' ? 'needle' : 'crushed');
      }
    }
    // ── the called: whoever she is not looking at turns round, and comes a little nearer ──
    const r = this.rise, ci = W.checkpoint.i;
    W.slow = 1;
    if (p.y < -528 && p.y > -545) {
      if (!r.woke && !p.dead) W.slow = 0.5;                // nobody runs through them
      for (const f of this.called) {
        const dx = f.x - p.x, ahead = dx * p.facing > -0.3, dist = Math.abs(dx);
        if (ahead) { if (f.turned && !f.seen && dist < 8) { f.seen = true; W.emit('calledSeen', { x: f.x, y: f.y }); } continue; }
        if (r.woke) { f.turned = true; continue; }
        if (!f.turned && dist > 1.4) f.turned = true;
        if (f.turned && dist > 2.6 && dist < 18) { f.x += Math.sign(-dx) * Math.min(dist - 2.6, 1.25 * dt); const gy = T_ground(W.T, f.x, f.y); if (gy !== null) f.y = gy; }
      }
    }
    // ── the dark that rises in the Loom ──
    if (W.ending && !r.done) { r.done = true; r.on = false; }
    if (ci === r.stop && !r.done) { r.done = true; r.on = false; this.crawler.on = false; W.emit('riseStop', { x: p.x, y: p.y }); }
    const last = W.memories.find((m) => m.id === 'm10'), heard = !last.heard ? 0 : last.at !== undefined ? W.time - last.at : 99;
    if (!r.on && !r.done && r.legs[ci] && !p.dead && Math.hypot(p.x - W.checkpoint.x, p.y - W.checkpoint.y) > 2.5 && (heard > r.after || p.y > r.y0 + 34)) {
      r.on = true; r.t = 0;
      W.emit('rise', { first: !r.woke, x: p.x, y: p.y });
      r.woke = true;
      for (const f of this.called) f.turned = true;
    }
    if (r.on) {
      r.t += dt;
      const [speed, lag] = r.legs[ci] || [1, 14], S = r.surge, u = r.t > r.delay + 4 ? (r.t - r.delay) % S.every : 0;
      const warn = u > S.every - S.warn - S.len, heave = u > S.every - S.len;
      if (warn && !r.warned) W.emit('surgeWarn', { x: p.x, y: r.level });
      if (heave && !r.heaved) W.emit('surge', { x: p.x, y: r.level });
      r.warned = warn; r.heaved = heave; r.heave = heave ? 1 : warn ? 0.35 : 0;
      if (r.t > r.delay) r.level = Math.min(r.y1, Math.max(r.level, Math.min(r.level + 7 * dt, p.y - lag)) + speed * (heave ? S.k : 1) * dt);
      // it takes her once it has really risen and closed over her (the floor it starts from is not flat to the centimetre)
      if (!p.dead && r.level > r.y0 + 0.4 && p.y < r.level - 0.25 && p.x > r.x0 && p.x < r.x1) W._die('dark');
      this._crawl(dt);
    } else if (r.done) r.level = Math.max(r.y0, r.level - dt * 3);
  }

  // a hand feels her only through open air: rock between its root and her hides her
  _sees(h, x, y) { return this.W.T.ray(h.ax + h.nx * 0.3, h.ay + h.ny * 0.3, x, y, 0) < 0; }
  // how far the arm can go along (ux, uy), up to ext, before it meets rock
  _free(h, ux, uy, ext) {
    const T = this.W.T, sx = h.ax + ux * ARM0, sy = h.ay + uy * ARM0;
    if (T.d(sx, sy) < ARM_R) return ARM0;
    const f = T.ray(sx, sy, h.ax + ux * ext, h.ay + uy * ext, ARM_R);
    return f < 0 ? ext : ARM0 + f * (ext - ARM0);
  }

  // under the rock, along its face, to come out nearer to her
  _shift(h) {
    const W = this.W, T = W.T, p = W.player, tx = -h.ny, ty = h.nx, s = Math.sign((p.x - h.ax) * tx + (p.y - h.ay) * ty) || 1;
    let x = h.ax, y = h.ay, nx = h.nx, ny = h.ny;
    for (let q = 0; q < HAND.hunt; q += 0.2) {
      x += -ny * s * 0.2; y += nx * s * 0.2;
      const d = T.d(x, y); [nx, ny] = T.grad(x, y); x -= nx * (d - 0.02); y -= ny * (d - 0.02);
    }
    if (Math.abs(T.d(x, y)) > 0.1 || Math.hypot(p.x - x, p.y - y) < 1.8) return;
    h.ax = x; h.ay = y; h.nx = nx; h.ny = ny; h.moved++; h.cool = Math.max(h.cool, 0.8);
    W.emit('stalk', { x, y, k: 0.6 });
  }

  // along the thread, from far behind her up to her: still, then quick, then still
  _crawl(dt) {
    const W = this.W, p = W.player, c = this.crawler, th = W.thread, P = th.poly, n = th.polyN, r = this.rise;
    if (n < 3) return;
    const total = P[(n - 1) * 5 + 3];
    if (r.t < r.delay + 4) return;
    if (!c.on || c.s < 0) { c.on = true; c.s = total - CRAWL.from; c.stun = 0; c.last = -99; c.used = 0; c.peg = W.checkpoint.i; c.snap = true; }
    // (reaching a pole, she gains a little on it)
    if (c.peg !== W.checkpoint.i) { c.peg = W.checkpoint.i; c.s = Math.min(c.s, total - CRAWL.peg); }
    c.t += dt; c.stun = Math.max(0, c.stun - dt);
    const u = c.t % CRAWL.per, moving = u < CRAWL.move && c.stun <= 0 && !p.dead;
    c.jerk = moving ? 1 : c.stun > 0 ? 1.6 : 0;
    if (moving) c.s += CRAWL.v * (1 - 0.35 * (W.dim || 0)) * dt;
    c.s = Math.max(total - 34, Math.min(c.s, total));
    c.gap = total - c.s;
    const st = Math.floor(u / 0.3);
    if (moving && st !== c.step) { c.step = st; W.emit('crawl', { x: c.x, y: c.y, gap: c.gap }); } else if (!moving) c.step = -1;
    c.look += ((c.gap < CRAWL.near ? 1 : moving ? 0 : 0.6) - c.look) * Math.min(1, dt * 3);
    const near = c.gap < CRAWL.near;
    if (near && !c.near) W.emit('crawlNear', { x: c.x, y: c.y });
    c.near = near;
    const [x, y] = this.alongThread(c.s); c.x = x; c.y = y;
    if (!p.dead && !W.ending && c.gap < CRAWL.grab && c.stun <= 0) W._die('thing');
  }
  // the point of the thread `s` metres from its far end (the drawn line is kept from her hand backward)
  alongThread(s) {
    const P = this.W.thread.poly, n = this.W.thread.polyN;
    s = Math.max(0, P[(n - 1) * 5 + 3] - s);
    let lo = 0, hi = n - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (P[m * 5 + 3] < s) lo = m + 1; else hi = m; }
    const b = Math.max(1, lo) * 5, a = b - 5, sa = P[a + 3], sb = P[b + 3], t = clamp((s - sa) / Math.max(1e-4, sb - sa), 0, 1);
    return [P[a] + (P[b] - P[a]) * t, P[a + 1] + (P[b + 1] - P[a + 1]) * t];
  }

  // the stamper's whole body at this moment (rest rect stretched along its direction)
  swept(s) {
    const [x0, y0, x1, y1] = s.r, e = s.dist * s.f;
    const ex = s.dir[0] * e, ey = s.dir[1] * e;
    return [Math.min(x0, x0 + ex), Math.min(y0, y0 + ey), Math.max(x1, x1 + ex), Math.max(y1, y1 + ey)];
  }

  ropeNear(x, y, m = 0.6) {
    for (const r of this.ropes) if (Math.abs(x - r.x) < m && y > r.y0 - 0.2 && y < r.y1 + 0.4) return r;
    return null;
  }
}
