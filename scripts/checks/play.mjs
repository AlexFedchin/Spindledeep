// The whole game in one go: from the cottage door to the choice at the top of the Loom, in one world, with its real thread, yarn,
// hands, machines and the dark. A leg that fails (a death, a fall, a stall) is tried again from wherever that leaves her, with the
// next timing, as a person would. It says where she died and how long each leg took, and ends with exit code 1 if any leg can't be done.
//   node --experimental-default-type=module scripts/checks/play.mjs [plain|frayed] [seed]      (FROM=24: start at that pole; MOTHS=1; V=1: chatty)
const A = new URL('../../app/src/', import.meta.url).href;
const { buildTerrain } = await import(A + 'terrain.js'); const { World } = await import(A + 'world.js'); const { mulberry } = await import(A + 'util.js'); const L = await import(A + 'level.js');
const T = buildTerrain(), DT = 1 / 120, MODE = process.argv[2] === 'frayed' ? 'frayed' : '', SEED = +(process.argv[3] || 1), V = !!process.env.V;
Math.random = mulberry(SEED);
const W = new World(T, MODE), p = W.player, th = W.thread;
if (!process.env.MOTHS) W.nests.forEach((n) => (n.spawned = 99));
let t = 0, deaths = {}, died = false, low = 99, legNow = '', lastPluck = -9, tRise = 0;
const inp0 = () => ({ axisX: 0, axisY: 0, held: {}, pressed: {} });
function step(inp) {
  t += DT;
  // what a player does about the hands and about what is on the thread: pluck a moment after the warning
  const h = W.deep.hands.some((q) => (q.st === 'stir' && q.t > 0.28) || q.st === 'lunge' || q.grab), c = W.deep.crawler;
  if ((h || (W.deep.rise.on && c.on && c.gap < 6)) && t - lastPluck > 0.8) { inp.pressed.pluck = true; lastPluck = t; }
  W.update(DT, inp, true);
  for (const e of W.events) {
    if (e.k === 'death') { died = true; const k = `${e.cause} @${e.x.toFixed(0)},${e.y.toFixed(0)}`; deaths[k] = (deaths[k] || 0) + 1; if (V) console.log('   died', k, legNow); }
    if (e.k === 'rise' && !tRise) tRise = t;
  }
  W.events.length = 0; low = Math.min(low, W.budgetLeft());
}
const settle = (s = 0.4) => { for (let i = 0; i < s * 120; i++) step(inp0()); };
const hooked = () => { const q = th.pivots[th.pivots.length - 1]; return th.locked && q && q.hook ? q.hook : null; };
const at = (n) => W.checkpoint.i === n;
// ── moves: each returns true when done, false when it failed ──
const M = {
  walk(x, secs = 14, o = {}) {
    const d = Math.sign(x - p.x) || 1; let n = 0, still = 0, lx = p.x;
    while (n++ < secs * 120) {
      if (died) return false;
      if (d * (p.x - x) > -0.1 && (p.grounded || o.air)) return true;
      if (o.slow && !p.grounded && T.ground(p.x, p.y, 1.5) === null) return true;
      const i = inp0(); i.axisX = (d * (p.x - x) > 0.2 ? -d : d) * (o.slow && Math.abs(p.x - x) < 2 ? 0.3 : 1);
      const wall = T.d(p.x + d * 0.55, p.y + 0.2) < 0.12, gap = !o.drop && T.ground(p.x + d * 0.75, p.y, o.deep || 1.5) === null && !L.GATES.some((g) => g.give && p.x + d * 0.5 > g.x0 && p.x + d * 0.5 < g.x1);
      if (p.coyote > 0.02 && (wall || gap)) i.pressed.jump = i.held.jump = true;
      if (!p.grounded && p.vy > 0) i.held.jump = true;
      if (o.hold && p.grounded === false) i.held.grip = true;
      still = Math.abs(p.x - lx) < 0.004 ? still + 1 : 0; lx = p.x;
      if (still > 260) return false;
      step(i);
    }
    return false;
  },
  // off an edge toward x and down until she stands below y
  drop(x, y, secs = 12) {
    let n = 0;
    while (n++ < secs * 120) {
      if (died) return false;
      if (p.grounded && p.y < y) return true;
      const i = inp0(); i.axisX = Math.abs(p.x - x) > 0.25 ? Math.sign(x - p.x) : 0;
      if (p.grounded && T.d(p.x + i.axisX * 0.62, p.y + 0.12) < 0.3) { i.pressed.jump = i.held.jump = true; }
      step(i);
    }
    return false;
  },
  // a running jump off the edge at x, on in direction d to `to` (then straight down), until she stands below y
  leap(d, edge, to, y) {
    let n = 0, j = false, tj = 0;
    while (n++ < 12 * 120) {
      if (died) return false;
      const i = inp0();
      if (j && p.grounded && t - tj > 0.2) return p.y < y;
      i.axisX = !j || d * (p.x - to) < -0.2 ? d : Math.abs(p.x - to) > 0.3 ? -d : 0;
      if (!j && p.coyote > 0.02 && d * (p.x - edge) > -0.35) { i.pressed.jump = i.held.jump = true; j = true; tj = t; }
      if (j && t - tj < 0.35) i.held.jump = true;
      step(i);
    }
    return false;
  },
  // over the lip in direction d holding the thread, down to y, a swing back under, and let go toward `to`
  rappel(d, y, to, below, v = 2.4, out = 2.4) {
    let ph = 0, n = 0, tj = 0;
    while (n++ < 26 * 120) {
      if (died) return false;
      const i = inp0(); i.held.grip = ph < 2;
      if (ph === 0) { i.axisX = p.grounded ? d * 0.5 : 0; if (!p.grounded && th.locked) { i.axisY = -1; i.axisX = 0; if (p.y < y) { ph = 1; tj = t; } } }
      else if (ph === 1) { i.axisX = Math.abs(p.vx) < 0.3 ? -d : Math.sign(p.vx); if (-d * p.vx > v && -d * (p.x - th.pivots[th.pivots.length - 1].x) > out) { ph = 2; i.pressed.jump = i.held.jump = i.held.grip = true; tj = t; } if (p.grounded) ph = 2; }
      else { i.held.jump = t - tj < 0.4; i.axisX = Math.abs(p.x - to) > 0.3 ? Math.sign(to - p.x) : 0; if (p.grounded) return p.y < below + 3 && p.y > below - 3; }
      step(i);
    }
    return false;
  },
  pluck() { const i = inp0(); i.pressed.pluck = true; lastPluck = t; step(i); settle(0.8); return !died; },
  wait(s) { settle(s); return !died; },
  // let go when the arc from here comes down on the far side (a small error of judgement, different each try: `rel`)
  ring(d, edge, rel, land) {
    const gy = T.ground(land + d * 0.5, p.y + 4, 14) ?? p.y, err = (rel - 2.4) * 0.12;
    const reaches = (d, x) => { const v0 = Math.max(p.vy, 0) + 5, vx = Math.max(2.5, Math.min(5, Math.abs(p.vx + p.facing) * 0.5 + 2.5)), tt = (d * (x + d * 0.25 - p.x)) / vx; return tt <= 0 || p.y + v0 * tt - 15 * tt * tt > gy + 0.3 + err; };
    let ph = 0, tj = 0, n = 0;
    while (n++ < 14 * 120) {
      if (died) return false;
      const i = inp0(); i.axisX = d;
      if (ph === 0 && d * (p.x - edge) > -0.35 && p.coyote > 0.02) { i.pressed.jump = i.held.jump = true; ph = 1; tj = t; }
      else if (ph === 1) { i.held.jump = t - tj < 0.3; if (t - tj > 0.1) i.held.grip = true; if (hooked()) { ph = 2; tj = t; } else if (p.grounded && t - tj > 0.4) return d * (p.x - land) > 0; }
      else if (ph === 2) { i.held.grip = true; const P = th.pivots[th.pivots.length - 1]; if (!P || !P.hook) { if (p.grounded) return d * (p.x - land) > 0; } else if (t - tj > Math.min(rel, 1.2) && d * p.vx > -0.4 && d * (p.x - P.x) > 0.2 && (reaches(d, land) || t - tj > rel + 5)) { i.pressed.jump = i.held.jump = true; ph = 3; tj = t; } }
      else if (ph === 3) { i.held.jump = t - tj < 0.3; if (p.grounded && t - tj > 0.1) return d * (p.x - land) > -0.3; }
      step(i);
    }
    return false;
  },
  // up a rope at x to y, then off it toward d
  rope(x, y, d, needles = []) {
    let n = 0, off = false, tj = 0;
    while (n++ < 34 * 120) {
      if (died) return false;
      const i = inp0(), on = !!p.climb;
      if (off) { i.axisX = d; i.held.jump = t - tj < 0.4; if (p.grounded && t - tj > 0.2) return true; step(i); continue; }
      if (!on) { i.axisX = Math.abs(p.x - x) > 0.2 ? Math.sign(x - p.x) : 0; if (Math.abs(p.x - x) < 0.75) { i.held.grip = true; i.axisY = 1; } }
      else {
        i.held.grip = true; i.axisY = 1;
        // wait under a needle that is about to strike
        for (const s of W.deep.stampers) if (s.kind === 'needle' && needles.includes(s.r[1])) {
          const u = ((W.time + s.ph) / s.per) % 1, ny = (s.r[1] + s.r[3]) / 2, under = ny - p.y;
          if (under > 0.5 && under < 1.6 && (u > 0.3)) i.axisY = under < 0.95 ? -0.6 : 0;
        }
        if (p.y >= y) { i.pressed.jump = i.held.jump = true; i.axisX = d; off = true; tj = t; }
      }
      step(i);
    }
    return false;
  },
  handle(k, x) {
    const h = W.rig.pulls[k]; let ph = h.f >= 1 ? 3 : 0, tj = t, n = 0;
    while (n++ < 22 * 120) {
      if (died) return false;
      if (ph === 3) return true;
      const i = inp0();
      if (ph === 0) { i.axisX = Math.abs(p.x - x) > 0.15 ? Math.sign(x - p.x) : 0; if (Math.abs(p.x - x) < 0.2 && p.grounded) { ph = 1; tj = t; i.pressed.jump = i.held.jump = true; } }
      else if (ph === 1) { i.held.jump = t - tj < 0.3; if (t - tj > 0.12) i.held.grip = true; if (hooked() === h) { ph = 2; tj = t; } else if (p.grounded && t - tj > 0.4) ph = 0; }
      else { i.held.grip = true; if (p.grounded) { i.axisX = (p.x - h.x) * Math.sign(h.pull.dx) < 0.8 ? Math.sign(h.pull.dx) : 0; i.axisY = 1; } else if (t - tj > 0.6) i.axisY = -1; if (h.f >= 1) ph = 3; if (!hooked()) { ph = 0; } }
      step(i);
    }
    return false;
  },
  // hops along x edges [edge, ...] in direction d, landing past `to`
  hops(d, edges, to, v = 0) {
    let n = 0, k = 0, tj = -9;
    while (n++ < 14 * 120) {
      if (died) return false;
      if (d * (p.x - to) > 0 && p.grounded) return true;
      const i = inp0(); i.axisX = d;
      while (k < edges.length && d * (p.x - edges[k]) > 0.6) k++;
      if (k < edges.length && p.coyote > 0.02 && d * (p.x - edges[k]) > -0.3 - 0.14 * (v % 5) && t - tj > 0.3) { i.pressed.jump = i.held.jump = true; tj = t; }
      if (!p.grounded && t - tj < 0.35) i.held.jump = true;
      step(i);
    }
    return false;
  },
  // a lane with a bobbin, going west from gutter to gutter
  lane(b, G, goal, floor) {
    let g = 0, n = 0;
    const all = [...G, goal], B = W.rig.bobbins[b];
    while (n++ < 60 * 120) {
      if (died) return false;
      const to = all[g], far = Math.abs(p.x - to), lie = p.y < floor - 0.4 && far < 0.7, i = inp0();
      if (g < G.length && lie) { if (B.x > p.x + 1.8 && (B.st === 'foul' || (B.dir > 0 && B.x - p.x > 2.5))) g++; else { step(i); continue; } }
      if (g === 0 && p.x > B.x1 + 0.8 && !(B.dir > 0 ? B.x < G[0] - 2 : B.x < G[0] - 6)) { step(i); continue; }
      i.axisX = far > 0.15 ? Math.sign(to - p.x) : 0;
      if (p.y < floor - 0.4 && p.grounded && far > 1) i.pressed.jump = i.held.jump = true;
      for (const q of G) if (q !== to && Math.abs(p.x - q - 1.2) < 0.25 && p.grounded && p.y > floor) i.pressed.jump = i.held.jump = true;
      if (!p.grounded && p.vy > 0) i.held.jump = true;
      if (g === G.length && far < 0.6) return true;
      step(i);
    }
    return false;
  },
  // run for x past heddles between, going under each just after it has drawn back
  heddles(x) {
    const d = Math.sign(x - p.x); let n = 0;
    while (n++ < 40 * 120) {
      if (died) return false;
      if (d * (p.x - x) > 0) return true;
      const i = inp0(); i.axisX = d;
      for (const s of W.deep.stampers) {
        if (s.kind !== 'heddle' || Math.abs(s.r[1] - s.dist - p.y) > 4) continue;
        const near = d > 0 ? s.r[0] - p.x : p.x - s.r[2], u = ((W.time + s.ph) / s.per) % 1, left = u < 0.64 ? (0.64 - u) * s.per : 0;
        if (near > 0 && near < 1.4 && left < 1.15) i.axisX = 0;
      }
      if (p.grounded && T.d(p.x + d * 0.62, p.y + 0.12) < 0.3) i.pressed.jump = i.held.jump = true;
      if (!p.grounded && p.vy > 0) i.held.jump = true;
      step(i);
    }
    return false;
  },
  // (a try that left a spindle still: back to the start, winding the thread in, and over the first slab again)
  slabs(k) {
    let n = 0; const edge = [61.9, 61.6, 62.1, 61.4][k % 4];
    if (p.x < 60) M.walk(63.4, 20);
    while (n++ < 30 * 120) {
      if (died) return false;
      if (p.x < 27.6) return true;
      const i = inp0(); i.axisX = -1;
      if (p.x > 58 && p.x < edge && p.y < -300.4) { if (p.coyote > 0) i.pressed.jump = true; i.held.jump = true; }
      if (!p.grounded && p.vy > 0) i.held.jump = true;
      if (p.x < 44.6 && p.x > 42 && p.grounded && p.y < -302.3 && T.d(p.x - 0.6, p.y + 0.1) < 0.3) { i.pressed.jump = i.held.jump = true; }
      if (p.x < 42.9 && p.x > 42 && p.y > -302) i.axisX = p.y > -301.2 ? 1 : -0.4;
      if (p.x < 30.2) i.axisX = W.gates.find((g) => g.id === 'h1').open > 0.9 ? -1 : 0;
      step(i);
    }
    return false;
  },
};
// ── the way down, pole to pole: [goal pole, moves(k)], k = which try this is ──
const rel = (k) => [1.0, 1.6, 2.4, 0.6, 3.2, 2.0, 4.0, 0.3, 2.8, 1.3, 3.6, 4.4, 0.8, 1.8, 5.0, 2.2][k % 16] + (k >> 4) * 0.07;
const ring = (k, d, edge, land) => M.ring(d, edge, rel(k), land);
const LEGS = [
  [11, () => M.walk(38.6)],
  [12, () => (p.y < -6 || M.drop(45, -7)) && M.leap(1, 52.4, 59.5, -15) && M.leap(-1, 57.6, 52.5, -24) && M.walk(51.5)],
  [1, () => M.walk(54.7, 9, { drop: 1, air: 1, slow: 1 }) && M.drop(51, -38) && M.walk(50.6)],
  [2, (k) => (p.y < -42 || (M.rappel(1, -48.5 + 0.4 * (k % 4), 45, -51, 1.2 + 0.5 * (k % 3), 2.4 + 0.35 * (k % 5)))) && M.walk(36.5, 14, { drop: 1 }) && M.drop(33, -58) && M.walk(33.5)],
  [3, () => M.walk(13.4, 16, { deep: 3 }) && M.drop(13, -70) && M.drop(15, -78) && M.walk(12.5)],
  [4, () => (W.bells[0].lit > 0 || (M.walk(33.4) && M.pluck() && M.wait(2.5))) && M.walk(40.4) && M.drop(39, -90) && M.drop(25, -116) && M.walk(19.5)],
  [5, (k) => (p.x > 34 ? true : ring(k, 1, 29.5, 35.4)) && M.walk(42.6) && M.pluck() && ring(k, 1, 44.8, 51) && M.walk(55)],
  [6, (k) => ring(k, 1, 59.2, 65.4) && M.walk(69) && M.pluck() && ring(k + 1, 1, 71.8, 78) && ring(k, 1, 85.8, 91.2) && ring(k, 1, 94.8, 98.5) && M.walk(101.5) && M.pluck() && M.walk(103.8)],
  [7, () => (W.gates[1].open >= 1 || (M.walk(101.5) && M.pluck() && M.wait(2.6))) && M.drop(109.5, -130, 8) | 1 && M.drop(109, -190, 16) && M.walk(104)],
  [8, (k) => ring(k, -1, 96.5, 91.4) && ring(k, -1, 86, 80) && ring(k, -1, 74, 68.7) && M.walk(63.5)],
  [9, (k) => ring(k, -1, 60.5, 54.5) && ring(k, -1, 47.5, 41.5) && ring(k, -1, 35, 28.6) && M.hops(-1, [24.6], 21.6) && M.walk(15.6)],
  [10, () => M.drop(11, -200) && M.drop(17, -240) && M.walk(18)],
  [13, () => M.walk(41.6)],
  [31, () => M.drop(46.8, -257) && M.walk(39)],
  [32, (k) => ring(k, -1, 29.4, 24.5) && M.walk(11.8)],
  [33, () => M.drop(7, -279) && M.walk(6.6)],
  [34, () => M.handle(0, 8.8) && M.wait(0.3) && M.walk(28)],
  [14, () => M.walk(40)],
  [35, () => M.walk(65.6) && M.drop(66.8, -301) && M.walk(64)],
  [36, (k) => M.slabs(k) && M.walk(26.9)],
  [37, (k) => (p.y < -310 || M.drop(23, -310)) && (p.x > 40 || ring(k, 1, 36.2, 40.9)) && M.walk(47)],
  [38, (k) => ring(k, 1, 56.2, 61.4) && M.walk(79)],
  [15, () => M.rope(84, -284.4, 1) && M.walk(96)],
  [16, () => M.drop(99, -323) && M.walk(94)],
  [17, () => M.walk(64)],
  [18, () => M.walk(34)],
  [19, () => M.drop(26.3, -335) && M.drop(20, -364) && M.walk(18)],
  [20, (k) => (p.x > 31 || ring(k, 1, 26, 32)) && (p.x > 43 || ring(k, 1, 38, 44)) && ring(k, 1, 50, 56) && M.walk(61)],
  [21, () => M.rope(68.6, -357.6, 1) && M.walk(74)],
  [22, () => M.heddles(106)],
  [29, () => M.drop(110.5, -403) && M.walk(108.5)],
  [39, () => M.walk(98)],
  [40, () => M.lane(0, [86, 76, 66], 61, -405) && M.walk(60)],
  [41, () => M.heddles(41) && M.drop(36, -419) && M.walk(39.5)],
  [42, (k) => (p.x > 51 || ring(k, 1, 46.2, 51.4)) && M.handle(1, 59.6) && M.wait(0.3) && M.walk(66)],
  [43, () => M.heddles(83)],
  [23, (k) => ring(k, 1, 86.2, 90.8) && M.walk(97) && M.drop(104, -460) && M.walk(104)],
  [24, () => M.walk(96.4) && M.drop(94, -537, 14) && M.walk(72, 30)],
  [25, () => M.walk(60) && M.wait(tRise ? 0 : 3) && M.rope(57.4, -502.9, -1) && M.walk(50)],
  [26, (k) => ring(k, -1, 46, 39.6) && M.walk(34)],
  [44, () => M.rope(31.6, -487.3, 1, [-489.5, -497.0]) && M.walk(38.2)],
  [45, (k) => M.hops(1, [39.1, 43.0, 48.1], 50.6, k) && M.walk(52)],
  [46, (k) => (p.x > 59.4 || ring(k, 1, 53.9, 59.6)) && M.hops(1, [64.3, 68.7, 73.3, 77.8], 80.2, k) && M.walk(82.6)],
  [47, () => M.rope(86.6, -469.9, -1) && M.walk(83.6)],
  [48, () => M.handle(2, 80.8) && M.wait(0.2) && M.lane(1, [73, 65], 57, -471.4) && M.walk(56.4)],
  [27, (k) => ring(k, -1, 55, 49.3) && M.walk(37)],
  [28, () => M.rope(42.4, -443.7, -1, [-459.6]) && M.walk(32)],
];
// ── run ──
let i0 = 0;
if (process.env.FROM) {
  i0 = LEGS.findIndex((l) => l[0] === +process.env.FROM) + 1;
  const pg = W.pegs[+process.env.FROM], g = W.grey; let b = 0, bd = 1e9;
  for (let i = 0; i < g.n; i++) { const d = Math.hypot(g.x[i] - pg.x, g.y[i] - pg.y); if (d < bd) { bd = d; b = i; } }
  let lx = th.x[0], ly = th.y[0];
  for (let i = 0; i <= b; i++) if (Math.hypot(g.x[i] - lx, g.y[i] - ly) > 0.3) { lx = g.x[i]; ly = g.y[i]; th._push(lx, ly); }
  th.tie(pg.x, pg.y + 0.35); W.checkpoint = pg; pg.tied = true; p.reset(pg.x + 0.4, pg.y + 0.6);
  W.memories.forEach((m) => { if (m.y > pg.y - 2) { m.heard = true; m.at = -99; } });
}
settle(0.6);
const slow = []; let bad = null; const TRIES = +(process.env.TRIES || 48);
for (const [goal, f] of LEGS.slice(i0)) {
  const t0 = t; let k = 0, ok = false;
  legNow = '→' + goal; low = 99;
  for (; k < TRIES && !ok; k++) {
    died = false;
    f(k);
    settle(0.3);
    if (died || p.dead) { for (let i = 0; i < 4 * 120 && p.dead; i++) step(inp0()); died = false; settle(0.4); }
    ok = at(goal);
    // stuck somewhere she cannot come back from: what a person does is let herself be taken back to the last pole
    if (!ok && k % 3 === 2 && !p.dead) { p.dead = true; p.deadT = 0; for (let i = 0; i < 3 * 120; i++) step(inp0()); died = false; settle(0.3); }
  }
  const tag = `${legNow.padEnd(4)} ${(t - t0).toFixed(0).padStart(4)} s  tries ${k}  lowest yarn ${low.toFixed(0)}`;
  if (V || k > 8) console.log(tag);
  slow.push([t - t0, goal, k]);
  if (!ok) { bad = `${tag} · stands at ${p.x.toFixed(1)},${p.y.toFixed(1)}, pole ${W.checkpoint.i}`; break; }
}
console.log(`${MODE || 'plain'} seed ${SEED}: ${bad ? 'STOPPED ' + bad : 'reached the choice'} · ${(t / 60).toFixed(1)} min · deaths ${Object.values(deaths).reduce((a, b) => a + b, 0)} · the climb ${tRise ? (t - tRise).toFixed(0) + ' s' : '-'}`);
console.log('most tries:', slow.filter((s) => s[2] > 3).sort((a, b) => b[2] - a[2]).slice(0, 8).map((s) => `→${s[1]} ${s[2]}`).join('  '), '| deaths:', Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 8).map((d) => d[0] + ' x' + d[1]).join('  '));
if (bad) process.exit(1);
