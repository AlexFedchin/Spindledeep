// the rooms the thread opens (rig.js), each crossed by a bot with the real thread and yarn: how many of N timings work
//   node --experimental-default-type=module scripts/checks/rooms.mjs [frayed]      (HANDS=1: with the hands)
const A = new URL('../../app/src/', import.meta.url).href;
const { buildTerrain } = await import(A + 'terrain.js'); const { World } = await import(A + 'world.js'); const { mulberry } = await import(A + 'util.js');
const T = buildTerrain(), DT = 1 / 120, idle = { axisX: 0, axisY: 0, held: {}, pressed: {} };
const MODE = process.argv[2] || '', ONLY = process.env.ONLY;
function make(peg, seed = 1) {
  Math.random = mulberry(seed);
  const W = new World(T, MODE); W.nests.forEach((q) => (q.spawned = 99)); W.drips.length = 0; if (!process.env.HANDS) W.deep.hands.length = 0;
  const pg = W.pegs[peg]; W.thread.reset(pg.x, pg.y + 0.35); W.checkpoint = pg; W.player.reset(pg.x, pg.y + 0.5); W.memories.forEach((m) => (m.heard = true));
  for (let i = 0; i < 60; i++) W.update(DT, idle, true);
  return W;
}
function run(W, f, secs = 40) {
  let t = 0, low = 99;
  for (let i = 0; i < secs * 120; i++) {
    t += DT; const inp = { axisX: 0, axisY: 0, held: {}, pressed: {} }, p = W.player;
    const r = f(W, p, t, inp); if (r) return { r, t, low };
    W.update(DT, inp, true); W.events.length = 0; low = Math.min(low, W.budgetLeft());
    if (process.env.TRACE && i % 30 === 0) console.log(t.toFixed(2), p.x.toFixed(2), p.y.toFixed(2), p.grounded ? 'g' : '-', W.thread.locked ? 'L' : '', W.rig.bobbins.map((b) => b.st + b.x.toFixed(1)).join());
    if (p.dead) return { r: 'dead at ' + p.x.toFixed(1) + ',' + p.y.toFixed(1), t, low };
  }
  return { r: 'stuck at ' + W.player.x.toFixed(1) + ',' + W.player.y.toFixed(1), t, low };
}
const hooked = (W) => { const q = W.thread.pivots[W.thread.pivots.length - 1]; return W.thread.locked && q && q.hook; };
// run dir, jump at the edge, catch the ring, let go after rel s on a forward swing, land past `land`, then `then`
const ring = (dir, edge, rel, land, then) => { let ph = 0, tj = 0; return (W, p, t, inp) => {
  if (ph < 4) inp.axisX = dir;
  if (ph === 0 && dir * (p.x - edge) > -0.35 && p.coyote > 0.02) { inp.pressed.jump = inp.held.jump = true; ph = 1; tj = t; }
  if (ph === 1) { inp.held.jump = t - tj < 0.3; if (t - tj > 0.1) inp.held.grip = true; if (hooked(W)) { ph = 2; tj = t; } else if (p.grounded && t - tj > 0.4) return 'missed'; }
  if (ph === 2) { inp.held.grip = true; const P = W.thread.pivots[W.thread.pivots.length - 1]; if (t - tj > rel && dir * p.vx > 0 && dir * (p.x - P.x) > 0.2) { inp.pressed.jump = inp.held.jump = true; inp.held.grip = false; ph = 3; tj = t; } }
  if (ph === 3) { inp.held.jump = t - tj < 0.3; if (p.grounded && t - tj > 0.1) { if (dir * (p.x - land) < -0.3) return 'short'; ph = 4; } }
  if (ph === 4) return then ? then(W, p, t, inp) : 'ok';
}; };
const walk = (dir, goal) => (W, p, t, inp) => { inp.axisX = dir; const wall = T.d(p.x + dir * 0.6, p.y + 0.1) < 0.3; if (p.grounded && wall) inp.pressed.jump = inp.held.jump = true; if (!p.grounded && p.vy > 0) inp.held.jump = true; if (dir * (p.x - goal) > 0) return 'ok'; };
function sweep(name, peg, mk, lo, hi, step, secs) {
  if (ONLY && !name.includes(ONLY)) return;
  const res = {}; let ok = 0, n = 0, low = 99, tt = 0;
  for (let rel = lo; rel < hi; rel += step) { const W = make(peg, 1 + n), q = run(W, mk(rel, W), secs); n++; if (q.r === 'ok') { ok++; low = Math.min(low, q.low); tt += q.t; } else res[q.r] = (res[q.r] || 0) + 1; }
  console.log(name.padEnd(44), `${ok}/${n}`.padEnd(7), 'lowest yarn', low.toFixed(0), 'time', (tt / Math.max(1, ok)).toFixed(1), JSON.stringify(res).slice(0, 190));
}
const handle = (i, at, dir, goal) => { let ph = 0, tj = 0; return (W, p, t, inp) => {
  const h = W.rig.pulls[i];
  if (ph === 0) { inp.axisX = Math.abs(p.x - at) > 0.15 ? Math.sign(at - p.x) : 0; if (Math.abs(p.x - at) < 0.2 && p.grounded) { ph = 1; tj = t; inp.pressed.jump = inp.held.jump = true; } }
  else if (ph === 1) { inp.held.jump = t - tj < 0.3; if (t - tj > 0.12) inp.held.grip = true; if (hooked(W) === h) { ph = 2; tj = t; } else if (p.grounded && t - tj > 0.4) ph = 0; }
  else if (ph === 2) { inp.held.grip = true; if (p.grounded) { inp.axisX = (p.x - h.x) * Math.sign(h.pull.dx) < 0.8 ? Math.sign(h.pull.dx) : 0; inp.axisY = 1; } else if (t - tj > 0.6) inp.axisY = -1; if (h.f >= 1) { ph = 3; tj = t; } }
  else if (t - tj > 0.3) return walk(dir, goal)(W, p, t, inp);
}; };
sweep('Weighing Room: ring, door, run', 31, (rel) => ring(-1, 29.4, rel, 24.5, walk(-1, 13.2)), 0.2, 5, 0.1);
sweep('Pews: handle, wind in, bridge', 33, (d) => handle(0, 8.8 + d, 1, 28), -0.4, 0.5, 0.1);
sweep('Slabs: over the first, under the second', 35, (d) => (W, p, t, inp) => {
  inp.axisX = -1;
  const jump = () => { if (p.coyote > 0) inp.pressed.jump = true; inp.held.jump = true; };
  if (p.x > 58.0 && p.x < 61.8 + d && p.y < -300.4) jump();
  if (!p.grounded && p.vy > 0) inp.held.jump = true;
  if (p.x < 44.6 && p.x > 42 && p.grounded && p.y < -302.3 && T.d(p.x - 0.6, p.y + 0.1) < 0.3) jump();
  if (p.x < 42.9 && p.x > 42 && p.y > -302) inp.axisX = p.y > -301.2 ? 1 : -0.4;
  if (p.x < 30.2) inp.axisX = W.gates.find((g) => g.id === 'h1').open > 0.9 ? -1 : 0;
  if (p.x < 27.6) return 'ok';
}, -0.4, 0.5, 0.1, 25);
sweep('Slabs: over both (must stay shut)', 35, () => (W, p, t, inp) => { inp.axisX = -1; if (p.grounded && T.d(p.x - 0.6, p.y + 0.1) < 0.3) inp.pressed.jump = inp.held.jump = true; if (((p.x > 58 && p.x < 61) || (p.x > 41.6 && p.x < 44.2)) && p.coyote > 0 && p.y < -300.4) { inp.pressed.jump = inp.held.jump = true; } if (!p.grounded && p.vy > 0) inp.held.jump = true; if (p.x < 30.2) inp.axisX = 0; if (p.x < 27.6) return 'ok'; }, 0, 0.3, 0.1, 15);
sweep('Pin Walk: down, and the first ring', 36, (rel) => { const first = ring(1, 36.2, rel, 40.9); let down = false; return (W, p, t, inp) => { if (!down) { inp.axisX = p.x > 23.4 ? -1 : 0; if (p.y < -305) inp.axisX = 1; if (p.grounded && p.y < -311) down = true; return; } return first(W, p, t, inp); }; }, 0.2, 5, 0.2);
sweep('Pin Walk: second ring (swinging)', 37, (rel) => ring(1, 56.2, rel, 61.4), 0.2, 6, 0.1);
sweep('Pin Walk: the rope up', 38, () => { let off = false; return (W, p, t, inp) => { inp.axisX = p.x < 83.9 && !p.climb ? 1 : 0; if (p.x > 83.2 && p.y < -285 && !off) { inp.held.grip = true; inp.axisY = 1; if (p.grounded && !p.climb) inp.pressed.jump = inp.held.jump = true; } if (p.climb) { inp.held.grip = true; inp.axisY = 1; } if (p.climb && p.y > -284.4) { inp.pressed.jump = true; inp.held.jump = true; inp.axisX = 1; off = true; } if (off) inp.axisX = 1; if (off && p.grounded && p.x > 85.5) return 'ok'; }; }, 0, 0.3, 0.1, 30);
sweep('Bobbin: gutter to gutter', 39, (d) => { let g = 0, wait = d; const G = [86, 76, 66, 61]; return (W, p, t, inp) => {
  const b = W.rig.bobbins[0], goal = G[g], far = Math.abs(p.x - goal), low = p.y < -405.4 && far < 0.7;
  if (low && g < 3) { // lying low: go when it has gone past, or stands fouled behind her
    const behind = b.x > p.x + 1.8, off = behind ? (b.dir > 0 && b.st === 'roll' ? b.x - p.x > 2.5 : b.st === 'foul') : b.x < p.x - 1.5 && b.dir < 0 && false;
    if (off) { g++; return; }
    return;
  }
  if (t < wait) return;
  if (g === 0 && p.x > 95 && !(b.dir > 0 ? b.x < 70 : b.x < 78)) return;
  inp.axisX = far > 0.15 ? Math.sign(goal - p.x) : 0;
  if (p.y < -405.4 && p.grounded && far > 1) { inp.pressed.jump = inp.held.jump = true; }
  // over any gutter in between
  for (const q of G.slice(0, 3)) if (Math.abs(p.x - q - 1.2) < 0.25 && q !== goal && p.grounded && p.y > -405) inp.pressed.jump = inp.held.jump = true;
  if (!p.grounded && p.vy > 0) inp.held.jump = true;
  if (g === 3 && far < 0.5) return 'ok';
}; }, 0, 4, 0.25, 60);
sweep('Bobbin: just run (should not do)', 39, (d) => (W, p, t, inp) => { if (t < d) return; inp.axisX = -1; for (const q of [86, 76, 66]) if (Math.abs(p.x - q - 1.2) < 0.25 && p.grounded) inp.pressed.jump = inp.held.jump = true; if (p.y < -405.4 && p.grounded) inp.pressed.jump = inp.held.jump = true; if (!p.grounded && p.vy > 0) inp.held.jump = true; if (p.x < 61) return 'ok'; }, 0, 12, 0.5, 30);
sweep('Treadles: two heddles in the lane', 40, (d) => { let w = d; return (W, p, t, inp) => { if (t < w) return; return walk(-1, 42)(W, p, t, inp); }; }, 0, 3, 0.1);
sweep('Lower room: ring (swinging)', 41, (rel) => ring(1, 46.2, rel, 51.4), 0.2, 6, 0.1);
sweep('Lower room: handle and door', 41, (d) => { let first = true; const f = handle(1, 59.6 + d, 1, 71.5); return (W, p, t, inp) => { if (first) { first = false; W.thread.reset(54, -420.6); p.reset(55, -420.6); return; } return f(W, p, t, inp); }; }, -0.4, 0.5, 0.1);
sweep('Lower room: last ring, door, out', 43, (rel) => ring(1, 86.2, rel, 90.8, walk(1, 97)), 0.2, 5, 0.1);
// the longest leg between two poles, along the old woman's thread
const W = make(0), g = W.grey, at = (pg) => { let b = 0, bd = 1e9; for (let i = 0; i < g.n; i++) { const d = Math.hypot(g.x[i] - pg.x, g.y[i] - pg.y); if (d < bd) { bd = d; b = i; } } return bd < 6 ? b : -1; };
const idx = W.pegs.map((p) => [at(p), p.i]).filter((a) => a[0] >= 0).sort((a, b) => a[0] - b[0]), legs = [];
for (let k = 1; k < idx.length; k++) { let s = 0; for (let i = idx[k - 1][0] + 1; i <= idx[k][0]; i++) s += Math.hypot(g.x[i] - g.x[i - 1], g.y[i] - g.y[i - 1]); legs.push([s, idx[k - 1][1], idx[k][1]]); }
console.log('longest legs (m of thread):', legs.sort((a, b) => b[0] - a[0]).slice(0, 8).map((l) => `${l[1]}-${l[2]} ${l[0].toFixed(0)}`).join('  '));
