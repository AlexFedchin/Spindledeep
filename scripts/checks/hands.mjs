// how hard are the hands? bots crossing the Hush: H1 -> H2, and the long gallery east -> west
const src = new URL('../../app/src/', import.meta.url).href;
const { buildTerrain } = await import(src + 'terrain.js'); const { World } = await import(src + 'world.js'); const { mulberry } = await import(src + 'util.js');
const T = buildTerrain(); const DT = 1 / 120;
const RUNS = [['H1-drop', 14, 65.5], ['Slabs', 35, 45], ['H3 E-W', 16, 34]];
const BOTS = {
  'walk, no effort': () => ({}),
  'pluck every 1.4 s': () => ({ every: 1.4 }),
  'pluck every 0.6 s (mash)': () => ({ every: 0.6 }),
  'react (pluck 0.35 s after a warning)': () => ({ react: 0.35 }),
  'react 0.35 s + tear free': () => ({ react: 0.35, tear: 0.35 }),
  'react late (0.8 s), tear free': () => ({ react: 0.8, tear: 0.3 }),
  'stop dead 0.3 s after a warning, no pluck': () => ({ stop: 0.3 }),
  'stop dead, and tear free if seized': () => ({ stop: 0.3, tear: 0.35 }),
  'never pluck until seized, then tear free': () => ({ tear: 0.35 }),
  'dim when one stirs, tear free': () => ({ dim: 1, tear: 0.35 }),

};
for (const [rn, peg, goal] of RUNS) for (const [bn, mk] of Object.entries(BOTS)) {
  let mb = 99, ok = 0, seized = 0, deaths = 0, time = 0; const N = 12;
  for (let k = 0; k < N; k++) {
    Math.random = mulberry(k * 7 + 3); const r = mulberry(k + 50);
    const W = new World(T); W.nests.forEach((n) => (n.spawned = 99));
    const pg = W.pegs[peg]; W.thread.reset(pg.x, pg.y + 0.35); W.checkpoint = pg; W.player.reset(pg.x + (r() - 0.5) * 2, pg.y + 0.6);
    const b = mk(); let t = 0, last = -9, seizeT = -1, warnT = -1, dead = false;
    for (let i = 0; i < 120 * 60; i++) {
      t += DT; const P = W.player, dir = Math.sign(goal - P.x);
      const inp = { axisX: dir, axisY: 0, held: {}, pressed: {} };
      const wall = T.d(P.x + dir * 0.7, P.y + 0.15) < 0.3, gap = T.ground(P.x + dir * 0.45, P.y, 1.6) === null;
      if (P.grounded && (wall || gap)) inp.pressed.jump = inp.held.jump = true;
      if (!P.grounded && P.vy > 0) inp.held.jump = true;
      const active = W.deep.hands.filter((h) => ['stir', 'lunge', 'grope'].includes(h.st));
      if (active.length && warnT < 0) warnT = t; if (!active.length) warnT = -1;
      const pl = () => { if (t - last > 0.56) { inp.pressed.pluck = true; last = t; warnT = -1; } };
      if (b.dim && active.length) inp.held.dim = true;
      if (b.every && t - last > b.every) pl();
      if (b.react && warnT > 0 && t - warnT > b.react + r() * 0.1) pl();
      if (W.seized) { if (seizeT < 0) { seizeT = t; seized++; } if (b.tear && t - seizeT > b.tear) pl(); } else seizeT = -1;
      if (b.dodge && active.some((h) => h.st === 'lunge' || (h.st === 'stir' && h.t > 0.4)) && Math.hypot(P.vx) > 1) inp.axisX = -dir;
      if (b.stop && W.deep.hands.some((h) => (h.reach > 3 || Math.abs(h.ax - P.x) > 0.9) && ((h.st === 'stir' && h.t > b.stop) || h.st === 'lunge' || (h.st === 'grope')))) { inp.axisX = 0; inp.pressed.jump = inp.held.jump = false; }
      W.update(DT, inp, true); W.events.length = 0; mb = Math.min(mb, W.budgetLeft());
      if (P.dead) { dead = true; if (process.env.DBG && b.stop && k < 4) console.log('  died', P.x.toFixed(1), P.y.toFixed(1), JSON.stringify(W.deep.hands.filter((h) => h.grab).map((h) => [h.i, h.reach, h.ax.toFixed(1), h.ay.toFixed(1), h.deaf]))); break; }
      if (Math.abs(P.x - goal) < 1) { ok++; time += t; break; }
    }
    if (dead) deaths++;
  }
  console.log(rn.padEnd(8), bn.padEnd(42), `through ${ok}/${N}  deaths ${deaths}  seized/run ${(seized / N).toFixed(1)}  lowest yarn ${mb.toFixed(0)} time ${(time / Math.max(1, ok)).toFixed(1)}`);
}
