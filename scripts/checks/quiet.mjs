// The two quiet places (the Orchard, the Long Room): in off the way down, to the far end, back out and on to the next pole, with
// the real thread and no skeins but what lies there. Also: dimming and sitting do what they say.
//   node --experimental-default-type=module scripts/checks/quiet.mjs
const A = new URL('../../app/src/', import.meta.url).href;
const { buildTerrain } = await import(A + 'terrain.js'); const { World } = await import(A + 'world.js'); const { mulberry } = await import(A + 'util.js');
const T = buildTerrain(), DT = 1 / 120;
Math.random = mulberry(5);
let bad = 0;
function run(name, peg, legs, mode = '') {
  const W = new World(T, mode), p = W.player, th = W.thread; W.nests.forEach((n) => (n.spawned = 99));
  W.bells[0].lit = 1; W.gates[0].open = 1;
  const pg = W.pegs[peg]; th.reset(pg.x, pg.y + 0.35); th.tie(pg.x, pg.y + 0.35); W.checkpoint = pg; pg.tied = true; p.reset(pg.x + 0.4, pg.y + 0.6);
  let low = 999, t = 0, at = '';
  const step = (o) => { const i = { axisX: 0, axisY: 0, held: {}, pressed: {}, ...o }; W.update(DT, i, true); t += DT; low = Math.min(low, W.budgetLeft()); for (const e of W.events) if (['place', 'skein', 'tie', 'death', 'sit'].includes(e.k)) at += ' ' + e.k + (e.name ? ':' + e.name : ''); W.events.length = 0; };
  for (const [goal, done] of legs) {
    let n = 0, still = 0, lx = 0, ly = 0;
    for (; n < 40 * 120 && !done(p, W); n++) {
      const g = typeof goal === 'function' ? goal(p) : goal, d = Math.abs(p.x - g) > 0.15 ? Math.sign(g - p.x) : 0;
      const wall = d && T.d(p.x + d * 0.5, p.y + 0.15) < 0.1;
      still = Math.hypot(p.x - lx, p.y - ly) < 0.004 ? still + 1 : 0; lx = p.x; ly = p.y;
      step({ axisX: d, pressed: { jump: p.coyote > 0.05 && (wall || still > 40) }, held: { jump: !p.grounded && p.vy > 0 } });
      if (p.dead) break;
    }
    if (p.dead || n >= 40 * 120) { bad++; console.log(`FAIL ${name}${mode}: stands at ${p.x.toFixed(1)},${p.y.toFixed(1)} ${p.dead ? 'dead' : ''} · yarn ${W.budgetLeft().toFixed(0)} ·${at}`); return W; }
  }
  console.log(`OK   ${name} ${mode} ${t.toFixed(0)} s  lowest yarn ${low.toFixed(0)} of ${W.maxYarn.toFixed(0)} ·${at}`);
  return W;
}
for (const mode of ['', 'frayed']) {
  run('the Orchard, in and out', 3, [[34, (p) => p.x > 33], [40.6, (p) => p.y < -82.6], [(p) => (p.y < -83.4 ? 45 : 40.4), (p) => p.grounded && p.x > 43.5], [62, (p, W) => W.checkpoint.i === 49 || p.x > 61.8], [91, (p) => p.x > 90.6], [62, (p) => p.x < 63], [43.2, (p) => p.x < 43.4], [39, (p) => p.y < -92], [27, (p) => p.y < -115], [19.5, (p, W) => W.checkpoint.i === 4]], mode);
  run('the Long Room, in and out', 18, [[27.4, (p) => p.x < 27.6], [(p) => (p.y < -327.5 ? 34 : 26), (p) => p.grounded && p.x > 29 && p.y < -337], [57, (p, W) => W.checkpoint.i === 50], [97, (p) => p.x > 96.6], [57, (p) => p.x < 57.6], [27, (p) => p.x < 27.4], [22, (p) => p.y < -348], [19.6, (p) => p.y < -364], [18, (p, W) => W.checkpoint.i === 19]], mode);
}
// the light: sitting; dimming runs out
{
  const W = new World(T), p = W.player, th = W.thread, I = (o) => ({ axisX: 0, axisY: 0, held: {}, pressed: {}, ...o }), say = (ok, s) => { if (!ok) bad++; console.log((ok ? 'OK   ' : 'FAIL ') + s); };
  const go = (o, s) => { for (let i = 0; i < s * 120; i++) W.update(DT, I(o), true); W.events.length = 0; };
  W.nests.forEach((n) => (n.spawned = 99));
  const pg = W.pegs[49]; th.reset(pg.x, pg.y + 0.35); th.tie(pg.x, pg.y + 0.35); W.checkpoint = pg; p.reset(pg.x + 0.5, pg.y + 0.6);
  go({ axisX: 1 }, 1.4);
  const b0 = W.budgetLeft(); W.update(DT, I({ pressed: { act: true } }), true);
  say(Math.abs(b0 - W.budgetLeft()) < 0.5, `E away from a seat or peg costs no yarn (${(b0 - W.budgetLeft()).toFixed(2)} m)`);
  go({ held: { dim: true } }, 1); say(W.dim > 0.95, 'held, the light goes down'); go({ held: { dim: true } }, 5); say(W.dim < 0.05 && W.kindle.spent, 'and not for ever');
  const s = W.kindle.seats[2]; p.reset(s.x, s.y + 0.4); go({}, 0.5); W.update(DT, I({ pressed: { act: true } }), true); go({}, 1.5); say(W.rest.at === s && W.rest.k > 0.5, 'she sits'); go({ axisX: 1 }, 0.3); say(!W.rest.at, 'and gets up');
}
process.exit(bad ? 1 : 0);
