// The end (spoilers: docs/STORY.md). At the top of the Loom, past what is left of her, something in the dark begs in her
// voice. Two choices, both spelled out on screen and held for a moment to confirm:
//   tie   her thread to the one in the dark: it has a line to the top now, and it climbs out
//   bite  her own thread in two: nothing can ever climb out, and she stays down here with it
// Timelines are in seconds from the choice. Nothing is loud except one moment; most of it happens in silence.
import * as L from './level.js';
import { clamp, damp, lerp, smooth } from './util.js';
import { neckDown } from './stage.js';
import { V3 } from './figure.js';

const HOLD = 1.3;                      // s a choice key is held
export const CARDS = {
  tie: ['It was never her. It learned her voice the night she died.', 'It could not climb out. It needed one thread, from the bottom to the top.',
    'By morning there was no one left in the valley to call.', 'The doll sits in her window. It is still holding the thread.'],
  cut: ['It has no thread now. It can never climb out, and no one will be called again.', 'The old woman had been dead since the first night. Her voice was only something it kept.',
    'That spring, for the first time in seventy years, the snow on the Brink melted.', 'The doll is still down there, in the dark, beside it. She was never given a name, so it cannot call her.',
    'It is trying every name there is.'],
};

export class Ending {
  // c: { W, D, A, cam (getters/objects), $, show, I, log, playLine, voiceBusy, setState, film, cards, credits, title }
  constructor(c) { this.c = c; this.reset(); }
  reset() {
    this.mode = null; this.t = 0; this.done = new Set(); this.hold = { act: 0, pluck: 0 }; this.wait = 0; this.said = {};
    this.dark = 0; this.black = 0; this.view = null; this.open = false; this.pulse = null; this.lights = [];
    const el = this.c.$('choice'); this.c.show(el, false); document.body.classList.remove('choosing');
  }
  // a camera cut (behind black) asked for by a timeline
  takeSnap() { const s = this.snap; this.snap = false; return s; }
  once(k, f) { if (!this.done.has(k)) { this.done.add(k); f(); } }
  at(t, k, f) { if (this.t >= t) this.once(k, f); }

  // ── in play: her voice in the dark, and the choice ─────────────────────
  approach(dt, live) {
    const { W, A, I, $, show } = this.c, w = W(), p = w.player, f = w.finale;
    const top = w.checkpoint.i === 28 && p.y > f.y - 3 && p.x < 46 && !p.dead;
    if (!top) { if (this.open) { this.open = false; show($('choice'), false); document.body.classList.remove('choosing'); } if (w.extraLights) w.extraLights = null; w.thing = p.y > f.y - 12 && p.y < f.y + 30 ? (w.thing || this.thing()) : null; return; }
    const th = (w.thing = w.thing || this.thing());
    this.once('top', () => A.beds({ amb_breath: 0.55 }));
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    if (d < 11) this.once('a', () => this.c.playLine('fin_a', L.FINALE.text));
    const near = w.nearFinale && live;
    if (near) this.wait += dt;
    const free = !this.c.voiceBusy();
    if (near && free && this.wait > 15) this.once('love', () => this.c.playLine('fin_love', L.FINALE.love));
    if (near && free && this.wait > 29) this.once('mama', () => this.c.playLine('fin_mama', L.FINALE.mama));
    if (near && free && this.wait > 40) this.once('tieit', () => this.c.playLine('fin_tieit', L.FINALE.tieit));
    // she leans a little nearer, as long as the doll stays: her neck is never quite the length it was
    th.lean = damp(th.lean, near ? Math.min(0.75, 0.08 + this.wait / 60) : 0, 0.5, dt);
    th.mouth = damp(th.mouth, free ? 0 : 0.1 + 0.1 * Math.abs(Math.sin(this.c.time?.() ?? w.time * 9)), 14, dt);
    // what there is to see her by comes from behind her
    w.extraLights = [{ x: 17.2, y: f.y + 2.2, z: 1.2, r: 6.5, i: 0.42, c: [0.86, 0.84, 0.95], soft: 0 }];
    // the choice
    const want = near && this.done.has('a') && (free || this.open || this.wait > 14);
    if (want !== this.open) {
      this.open = want;
      if (want) {
        $('choice').querySelector('.ca kbd').textContent = I().label('act');
        $('choice').querySelector('.cb kbd').textContent = I().label('pluck');
        this.c.log('choice shown');
      }
      show($('choice'), want);
      document.body.classList.toggle('choosing', want);
    }
    for (const [k, sel] of [['act', '.ca'], ['pluck', '.cb']]) {
      const on = this.open && I().held[k] && !I().held[k === 'act' ? 'pluck' : 'act'];
      this.hold[k] = on ? this.hold[k] + dt : Math.max(0, this.hold[k] - dt * 3);
      $('choice').querySelector(sel + ' i').style.width = clamp(this.hold[k] / HOLD, 0, 1) * 100 + '%';
      if (this.hold[k] >= HOLD) { this.choose(k === 'act' ? 'tie' : 'cut'); return; }
    }
  }
  thing() {
    const y = this.c.W().remainsY, x = 14.6;
    return { x, y, k: 1.65, yaw: 1.05, lean: 0, mouth: 0, head: null, reach: null, gone: false, gain: 1, hollow: 0.9,
      lights: [{ x: x - 1.8, y: y + 2.6, z: -1.6, r: 5, i: 1.3, c: [0.7, 0.76, 1] }, { x: x + 2.2, y: y + 1.1, z: 1.4, r: 4, i: 0.55, c: [1, 0.82, 0.72] }] };
  }

  choose(mode) {
    const { W, A, $, show, log } = this.c, w = W();
    log('ending · ' + mode);
    this.mode = mode; this.t = 0; this.done.clear(); this.open = false;
    document.body.classList.remove('choosing');
    show($('choice'), false); show($('prompt'), false); show($('hint'), false); show($('sub'), false);
    w.ending = { t: 0, cut: mode === 'cut' };
    w.thing = w.thing || this.thing();
    this.h0 = w.thing.lean; w.extraLights = null;
    this.c.setState('ending');
    A.endMusic = true; A.setMusic(null, 1);
    A.stopVoices();
    w.player.facing = -1;
    if (mode === 'tie') { A.beds({}); A.play('tie', { vol: 0.8 }); }
    else { A.beds({ amb_breath: 0.5 }); A.play('cut', { vol: 1 }); A.play('tear', { vol: 0.35, rate: 0.8 }); this.n0 = w.thread.n; w.thread.locked = false; w.thread.pivots = []; }
  }

  update(dt) {
    this.t += dt;
    if (this.mode === 'tie') this.tie(dt); else if (this.mode === 'cut') this.cut(dt);
    this.c.W().extraLights = this.lights;
  }

  // ── tied ───────────────────────────────────────────────────────────────
  tie(dt) {
    const { W, A, D, cam, playLine } = this.c, w = W(), t = this.t, th = w.thing, f = w.finale, p = w.player;
    if (t < 23.9) {
      this.lights = [];
      this.at(1.6, 'candle', () => { w.candleOut = w.time; w.lamps = w.lamps.filter((l) => !l.finale); A.play('release', { vol: 0.5, rate: 0.45 }); });
      this.at(4.0, 'mama', () => playLine('fin_mama', L.FINALE.mama));
      // in the dark she grows; then a light from nowhere shows her still kneeling there, holding the thread, and how far up the
      // neck goes
      const up = smooth(6.6, 9.6, t), close = smooth(11.2, 13.6, t), grown = smooth(2.2, 5.5, t);
      th.k = lerp(1.65, 2.7, grown); th.x = lerp(14.6, 13.6, grown); th.yaw = lerp(1.05, 0.95, grown); th.lean = lerp(this.h0, 0.2, grown); th.hollow = 1;
      th.gain = Math.max(0.0, 1 - smooth(1.6, 2.2, t)) + smooth(6.4, 8, t);
      for (const [s, j] of [[7.0, 1], [7.9, 2], [8.5, 1], [9.4, 2], [10.1, 1], [10.5, 2]]) this.at(s, 'b' + s, () => A.play('bone' + j, { vol: 0.75, rate: 0.6 + Math.random() * 0.2, verb: 1.3 }));
      this.at(8.0, 'inh', () => A.play('inhale', { vol: 0.8, verb: 1 }));
      // the head comes down in jerks, a joint at a time
      let k = 0; for (const s of [7.0, 7.9, 8.5, 9.4, 10.1, 10.5]) k += smooth(s, s + 0.28, t) / 6;
      this.at(12.0, 'b12', () => A.play('bone1', { vol: 0.8, rate: 0.45, verb: 1.2 }));
      this.at(13.9, 'chorus', () => playLine('fin_b', L.FINALE.after));
      const talk = smooth(14.2, 14.6, t) * (1 - smooth(18.8, 19.3, t));
      th.mouth = talk * (0.16 + 0.2 * Math.abs(Math.sin(t * 5.3)) + 0.08 * Math.sin(t * 11));
      // one second in which nothing happens; then it calls
      const go = smooth(21.0, 21.75, t), roll = smooth(11.8, 12.9, t);
      th.mouth = Math.max(th.mouth, go * 2.3 + 0.1 * smooth(19.6, 20.8, t));
      if (t > 2.2) th.head = neckDown(th.x, th.y, th.k, [p.x, th.y], k, roll, lerp(0.95, 1.75, smooth(0.2, 1, k)) * (1 + go * 0.25), go * 9);
      const [hx, hy] = th.head ? th.head.at : [15, th.y + 3];
      th.lights = [{ x: th.x - 2.2, y: th.y + 4, z: -2.4, r: 9, i: 0.9 * (1 - grown + up), c: [0.7, 0.76, 1] }, { x: hx + 0.9, y: hy + 1.1, z: 1.7 + go * 10, r: 4, i: 0.85 * close, c: [0.92, 0.9, 0.98] }];
      th.slack = go > 0;
      if (up > 0) this.lights.push({ x: lerp(18, hx + 2.2, close), y: lerp(th.y + 8, hy + 1.4, close), z: 3, r: lerp(17, 8, close), i: lerp(1.5, 0.35, close) * up, c: [0.82, 0.86, 1.0], soft: 0 });
      this.at(21.05, 'call', () => { A.play('thud', { vol: 1.2, verb: 1 }); A.play('tear', { vol: 1.0, rate: 0.3, verb: 1.4 }); A.play('inhale', { vol: 1.2, rate: 2.2 }); A.play('drag', { vol: 0.9, rate: 0.6 }); cam.shake = 1.1; });
      this.at(20.6, 'nosub', () => this.c.sub('', 0.01));
      if (t > 21.8) { this.dark = 1; th.gone = true; this.lights = []; }
      const out = smooth(6.2, 9.8, t) * (1 - close);
      this.view = { x: lerp(lerp(p.x, 17.4, out), hx + 0.55, close), y: lerp(lerp(f.y + 1.6, f.y + 5.2, out), hy - 0.15, close), vh: lerp(lerp(8.5, 13.5, out), 3.3, close) };
      return;
    }
    if (!this.pulse) this.startClimb();
    this.climb(dt);
  }
  // Five places she came through, each seen from a camera that does not move: the thread lying there, nothing, then it
  // comes hand over hand along the thread and everything it passes goes out. Faster each time. The last is home.
  startClimb() {
    const { W, A } = this.c, w = W(), g = w.grey, gi = w.finale.gi, arc = new Float32Array(gi + 1);
    for (let i = gi - 1; i >= 0; i--) arc[i] = arc[i + 1] + Math.hypot(g.x[i] - g.x[i + 1], g.y[i] - g.y[i + 1]);
    const near = (x, y) => { let b = 0, bd = 1e9; for (let i = 0; i <= gi; i++) { const d = Math.hypot(g.x[i] - x, g.y[i] - y); if (d < bd) { bd = d; b = i; } } return arc[b]; };
    // [camera x, y, view height, enters at, leaves at, seconds before it comes, seconds crossing]
    const P = [[31, -243.2, 13, [46.4, -262], [15, -224], 2.6, 6.5], [62.5, -188.6, 15, [84, -191.5], [42, -190], 1.8, 5.0],
      [62, -119.2, 17, [88, -120.5], [38, -122], 1.4, 4.2], [56, -20, 19, [66, -38], [42.6, -3], 1.0, 3.2], [20.5, 3.0, 12.5, [38, 1], [18.8, 1.4], 3.0, 6.0]];
    this.pulse = { arc, total: arc[0], gi, s: 0, slap: 0, drag: 0, k: -1, t: 0, places: P.map(([x, y, vh, a, b, wait, dur]) => ({ x, y, vh, s0: near(...a), s1: near(...b), wait, dur })) };
    const T = w.T;
    w.climber = { x: -90, y: 0, s: 0, k: 2.6, lift: 0.46, step: 0.95, spread: 0.12, neck: 0.5, head: 1.25, mouth: 0.5, twitch: 1, look: 0, quick: 7, view: [0, 0, 0.75], lights: [],
      path: (s) => { const [x, y] = this.pt(clamp(s, 0, this.pulse.total)); return [x, y, 0]; },
      // away from the rock the thread lies on; hanging free, it has its back to the far wall
      // its head stays out of the rock
      clear: (q, r) => { let [x, y] = q; for (let i = 0; i < 4; i++) { const d = T.d(x, y); if (d >= r) break; const [gx, gy] = T.grad(x, y); x += gx * (r - d) * 0.8; y += gy * (r - d) * 0.8; } return [x, y, q[2]]; },
      out: (s) => { const [x, y] = this.pt(clamp(s, 0, this.pulse.total)), d = T.d(x, y), [gx, gy] = T.grad(x, y), m = smooth(3, 0.4, d); return V3.norm([gx * m + 0.001, gy * m + 0.25 * (1 - m), 0.35]); },
      grip: (at, key) => { if (key[0] === 'h' && this.moving) A.pick(['palm1', 'palm2', 'palm3'], { vol: 0.6 + Math.random() * 0.3, rate: 0.75, vary: 0.25, x: at[0], y: at[1], verb: 0.8 }); } };
    w.hideDoll = true; w.stillAir = true;
    this.c.log('it climbs');
  }
  pt(s) {
    const P = this.pulse, g = this.c.W().grey;
    let lo = 0, hi = P.gi;
    while (lo < hi) { const m = (lo + hi) >> 1; if (P.arc[m] <= s) hi = m; else lo = m + 1; }
    return [g.x[lo], g.y[lo]];
  }
  climb(dt) {
    const { W, A, cam } = this.c, w = W(), P = this.pulse, c = w.climber;
    const last = P.k === P.places.length - 1;
    if (P.k < 0 || (!last && P.t > P.places[P.k].wait + P.places[P.k].dur + 0.5)) {
      // the next place (cut in the dark)
      P.k++; P.t = 0; c.jump = true; c.look = 0;
      const q = P.places[P.k];
      P.s = q.s0;
      this.view = { x: q.x, y: q.y, vh: q.vh }; cam.x = q.x; cam.y = q.y; cam.viewH = q.vh; this.snap = true;
      A.beds(P.k === 0 ? { amb_hall: 0.6 } : P.k === 1 ? { amb_ink: 0.3, amb_drips: 0.2 } : P.k === 4 ? {} : { amb_cave: 0.25 });
      if (P.k === 4) { P.drag = 99; }
    }
    const q = P.places[P.k];
    P.t += dt;
    const u = clamp((P.t - q.wait) / q.dur, 0, 1), end = P.k === P.places.length - 1;
    P.s = lerp(q.s0, q.s1, end ? 1 - Math.pow(1 - u, 1.6) : u);
    this.dark = Math.max(1 - smooth(0.0, 0.7, P.t), end ? 0 : smooth(q.wait + q.dur - 0.1, q.wait + q.dur + 0.4, P.t));
    // it goes in pulls: each reach hauls the whole of it a length further
    const G = c.step * c.k;
    this.moving = u > 0 && u < 1;
    c.s = Math.max(1, P.s - 2.5 - (u < 1 ? Math.sin(P.s / G * Math.PI * 2) * G * 0.11 : 0));
    const [bx, by] = this.pt(c.s);
    c.x = bx; c.y = by;
    // half way across each place it looks out at you, once; at the end it has all the time there is
    c.look = damp(c.look, end ? (u > 0.97 ? 1 : 0) : u > 0.42 && u < 0.62 ? 1 : 0, 9, dt);
    c.mouth = 0.35 + c.look * 1.3; c.neck = 0.5 + 0.25 * c.look + 0.06 * Math.sin(P.t * 3.1); c.rear = 0.35 + (end ? 1.6 * c.look : 0.2 * c.look);
    const out = u <= 0 ? 1 : 0;
    const [fx, fy] = this.pt(Math.min(P.total, P.s + 4));
    const [mx, my] = this.pt((q.s0 + q.s1) / 2);
    // the thread ahead is lit; behind it there is no light at all
    this.lights = [{ x: fx, y: fy + 0.4, r: 7, i: 1.0, c: [1, 0.25, 0.18], soft: 8 }, { x: lerp(mx, fx, u), y: lerp(my, fy, u) + 0.8, r: 11, i: 0.5 * (1 - u * 0.7), c: [1, 0.3, 0.22], soft: 8 }];
    if (out) this.lights.shift();
    c.lights = [{ x: c.x + 1.2, y: c.y + 3.2, z: 2.6, r: 8, i: 0.8, c: [0.8, 0.84, 1.0] }, { x: c.x - 2, y: c.y + 1.5, z: -2.5, r: 7, i: 0.7, c: [0.75, 0.8, 1.0] }];
    const dist = (o, oy = 0) => Math.hypot(o.x - c.x, o.y + oy - c.y);
    if (u > 0) {
      for (const b of w.bells) {
        if (dist(b, 1) < 9 && !b._rang) { b._rang = true; b.lit = 0.6; b.ring = 1; A.bellNote(b.i, b.x, b.y); }
        if (b._rang && dist(b, 1) < 4 && b.lit > 0) { b.lit = 0; b.ring = 0; A.play('release', { vol: 0.4, rate: 0.5, x: b.x, y: b.y }); }
      }
      const before = w.lamps.length;
      w.lamps = w.lamps.filter((o) => (end && o.x < 14) || dist(o) > 6);
      if (w.lamps.length < before) { A.play('release', { vol: 0.5, rate: 0.45 }); w.hallOut = w.hallOut ?? (P.k === 0 ? w.time : undefined); }
      for (const pg of w.pegs) if (dist(pg) < 4) { pg.tied = false; pg.glow = 0; }
      P.drag -= dt;
      if (P.drag <= 0 && u < 1) { P.drag = 3.6; A.play('drag', { vol: 0.45, rate: 0.75, x: c.x, y: c.y }); }
    }
    if (end && u >= 1) {
      this.once('arrive', () => { this.arriveT = P.t; this.c.log('it is out'); });
      const s = P.t - this.arriveT;
      this.lights = this.lights.slice(0, 1); c.lights = c.lights.map((l) => ({ ...l, i: l.i * (1 - 0.6 * smooth(1.6, 3, s)) }));
      if (s > 1.6) this.once('win', () => { w.lamps = []; w.windowOut = true; A.play('release', { vol: 0.6, rate: 0.4 }); });
      if (s > 3.2) this.once('door', () => A.play('gate', { vol: 0.3, rate: 0.4, verb: 0.6 }));
      this.dark = smooth(4.0, 6.0, s);
      if (s > 6.4) this.once('film', () => this.c.film(CARDS.tie));
    }
  }

  // ── bitten ─────────────────────────────────────────────────────────────
  cut(dt) {
    const { W, A, cam, playLine, log } = this.c, w = W(), t = this.t, th = w.thing, f = w.finale, p = w.player, T = w.thread;
    this.lights = [];
    // the red goes out of the thread, from her teeth upward
    const n = Math.min(this.n0, Math.floor(t * 260));
    for (let i = this.n0 - 1; i >= this.n0 - n && i >= 0; i--) T.dead[i] = 1;
    if (n >= this.n0) { T.liveStart = T.n; T.anchored = false; }
    this.at(3.2, 'c1', () => playLine('cut1', L.FINALE.cut));
    this.at(8.6, 'c1b', () => { A.voice('cut1', null, 0.62); this.c.sub(L.FINALE.cut, 5); });
    this.at(12.6, 'inh', () => A.play('inhale', { vol: 1, verb: 1 }));
    this.at(14.4, 'candle', () => { w.candleOut = w.time; w.lamps = w.lamps.filter((l) => !l.finale); A.play('release', { vol: 0.6, rate: 0.4 }); A.beds({}); });
    this.black = smooth(14.2, 16, t);
    w.snuff = this.black;
    if (t > 15.6) { th.gone = true; w.hideDoll = true; }
    th.lean = lerp(this.h0, 0.95, smooth(4, 13.5, t)); th.hollow = 1; th.mouth = 0.5 * smooth(12.6, 14, t);
    this.lights.push({ x: 17.2, y: f.y + 2.2, z: 1.2, r: 6.5, i: 0.42 * (1 - this.black), c: [0.86, 0.84, 0.95], soft: 0 });
    // hands on the floor, looking for her
    for (const [s, dx] of [[17.6, -9], [18.5, 8], [19.4, -6.5], [19.75, -5.6], [21.0, 6], [21.35, 5], [21.65, 4], [23.2, -2.6], [23.5, -1.9], [23.9, 1.4], [24.2, 0.8], [24.9, 0.3]])
      this.at(s, 'p' + s, () => A.pick(['palm1', 'palm2', 'palm3'], { vol: 0.95, vary: 0.2, x: cam.x + dx, y: cam.y, verb: 0.8 }));
    this.at(20.1, 'dr', () => A.play('drag', { vol: 0.7, rate: 0.7, x: cam.x - 6, y: cam.y }));
    this.at(26.0, 'bn', () => A.play('bone2', { vol: 0.7, rate: 0.55, verb: 0.6 }));
    this.at(27.6, 'c3', () => playLine('cut3', L.FINALE.cut3));
    // half a second of light, and no sound at all: it is right there. It is only listening.
    const fl = t > 39.6 && t < 40.15 ? 1 - Math.abs((t - 39.85) / 0.3) * 0.6 : 0;
    if (fl > 0) {
      th.gone = false; w.hideDoll = false; w.snuff = 0; th.x = p.x; th.y = p.y; th.gain = 1;
      th.reach = { k: 1.5, from: [p.x - 4.2, p.y + 0.4, -3], yaw: 1.0, at: [p.x - 0.8, p.y + 0.62, 0.05], face: [0.9, -0.1, 0.42], up: [0.18, 1, 0], size: 1.25, mouth: 0.0, bend: [[p.x - 4.2, p.y + 3.4, -3], [p.x - 1.9, p.y + 0.3, -1.2]] };
      th.lights = [{ x: p.x + 0.3, y: p.y + 1.3, z: 1.0, r: 2.6, i: 0.5 * fl, c: [0.95, 0.93, 1.0] }];
      this.lights.push({ x: p.x + 0.2, y: p.y + 1.0, r: 2.5, i: 0.5 * fl, c: [0.95, 0.93, 1.0], soft: 0 });
      this.once('flash', () => log('flash'));
    } else if (t > 40.15) { th.gone = true; w.hideDoll = true; w.snuff = 1; }
    this.at(42.4, 'breath', () => A.play('inhale', { vol: 0.9, rate: 0.9, verb: 0.5 }));
    this.dark = fl > 0 ? 0 : t > 44 ? Math.max(0.8, smooth(44, 46, t)) : 0.8 * smooth(15.5, 18, t);
    this.at(39, 'nosub', () => this.c.sub('', 0.01));
    this.at(47, 'cards', () => this.c.cards(CARDS.cut));
    const k = smooth(15, 18, t);
    this.view = { x: lerp(p.x + 0.8, p.x - 0.4, k), y: lerp(f.y + 2.0, p.y + 0.7, k), vh: lerp(8.5 + Math.min(1.5, t * 0.15), 3.2, k) };
  }
}
