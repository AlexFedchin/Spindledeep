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
    this.dark = 0; this.black = 0; this.view = null; this.open = false; this.pulse = null; this.lights = []; this.part = null; this.s = 0; this.parted = 0; this.spin = 0; this.reached = 0;
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
    else {
      A.beds({ amb_breath: 0.5 }); A.play('cut', { vol: 1 }); A.play('tear', { vol: 0.35, rate: 0.8 });
      // bitten through at her hand: the end comes away from her and drops to the floor
      this.n0 = w.thread.n; w.thread.letGo();
    }
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
      // in the dark she does not move, and stays the size she is (a figure growing in the dark was plain to see on a bright
      // screen); then a light from nowhere shows her still kneeling there, holding the thread, and how far up the neck goes
      const up = smooth(6.6, 9.6, t), close = smooth(11.2, 13.6, t), still = smooth(0, 6, t);
      th.lean = lerp(this.h0, 0.2, still); th.hollow = lerp(0.9, 1, still);
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
      if (t > 2.2) th.head = neckDown(th.x, th.y, th.k, [p.x, th.y], k, roll, lerp(2.1, 2.75, k) * (1 + go * 0.25), go * 9);
      // the head leaves her shoulders slowly, up out of the picture, long before there is light to see it by
      const rise = smooth(2.2, 6.6, t), h0 = th.h0;
      if (t > 2.2 && rise < 1 && h0) {
        const h = th.head, m = V3.mix3;
        th.head = { at: m(h0.at, h.at, rise), face: V3.norm(m(h0.face, h.face, rise)), up: V3.norm(V3.add(m(h0.up, h.up, rise), [0.8, 0, 0], Math.sin(Math.PI * rise))), size: lerp(h0.size, h.size, rise), thick: lerp(1, h.thick, rise),
          bend: [m(m(h0.at, h0.neck, 0.67), h.bend[0], rise), m(m(h0.at, h0.neck, 0.33), h.bend[1], rise)] };
      }
      const [hx, hy] = th.head ? th.head.at : [15, th.y + 3];
      th.lights = [{ x: th.x - 2.2, y: th.y + 4, z: -2.4, r: 9, i: 0.9 * Math.max(1 - smooth(1.6, 4, t), up), c: [0.7, 0.76, 1] }, { x: hx + 0.9, y: hy + 1.1, z: 1.7 + go * 10, r: 4, i: 0.85 * close, c: [0.92, 0.9, 0.98] }];
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
  // comes hand over hand along the thread and everything it passes goes out. Faster each time. The last is the way out,
  // and it is cut short there: the film takes it up from the other side, hands first.
  startClimb() {
    const { W, A } = this.c, w = W(), { arc, gi, near } = this.measure();
    // [camera x, y, view height, enters at, leaves at, seconds before it comes, seconds crossing]
    const P = [[31, -243.2, 13, [46.4, -262], [15, -224], 2.6, 6.5], [62.5, -188.6, 15, [84, -191.5], [42, -190], 1.8, 5.0],
      [62, -119.2, 17, [88, -120.5], [38, -122], 1.4, 4.2], [56, -20, 19, [66, -38], [53.4, -11], 1.0, 4.0], [45.6, -3.6, 12.5, [53.1, -10.3], [41.8, -0.5], 1.8, 4.2]];
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
    P.s = lerp(q.s0, q.s1, end ? u * (0.75 + 0.25 * u) : u);
    this.dark = Math.max(1 - smooth(0.0, 0.7, P.t), smooth(q.wait + q.dur - (end ? 0.3 : 0.1), q.wait + q.dur + (end ? 0.05 : 0.4), P.t));
    // it goes in pulls: each reach hauls the whole of it a length further
    const G = c.step * c.k;
    this.moving = u > 0 && u < 1;
    c.s = Math.max(1, P.s - 2.5 - (u < 1 ? Math.sin(P.s / G * Math.PI * 2) * G * 0.11 : 0));
    const [bx, by] = this.pt(c.s);
    c.x = bx; c.y = by;
    // half way across each place it looks out at you, once; the last time it does not stop for that
    c.look = damp(c.look, !end && u > 0.42 && u < 0.62 ? 1 : 0, 9, dt);
    c.mouth = 0.35 + c.look * 1.3; c.neck = 0.5 + 0.25 * c.look + 0.06 * Math.sin(P.t * 3.1); c.rear = 0.35 + 0.2 * c.look;
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
      w.lamps = w.lamps.filter((o) => o.x < 14 || dist(o) > 6);
      if (w.lamps.length < before) { A.play('release', { vol: 0.5, rate: 0.45 }); w.hallOut = w.hallOut ?? (P.k === 0 ? w.time : undefined); }
      for (const pg of w.pegs) if (dist(pg) < 4) { pg.tied = false; pg.glow = 0; }
      P.drag -= dt;
      if (P.drag <= 0 && u < 1) { P.drag = 3.6; A.play('drag', { vol: 0.45, rate: 0.75, x: c.x, y: c.y }); }
    }
    if (end && u >= 1) {
      // its hands are under the lip. Black, and everything stops: the film is the other side of it
      this.once('arrive', () => { this.arriveT = P.t; A.beds({ amb_wind: 0.18 }); this.c.log('it is at the lip'); });
      if (P.t - this.arriveT > 1.0) this.once('film', () => this.c.film(CARDS.tie));
    }
  }

  // ── bitten ─────────────────────────────────────────────────────────────
  // Five parts (the user, 2026-11-27): the bite, and it screams and runs; the red going out of the thread, in two places on the
  // way up; the thing trying to climb what is left of it, in the well, and falling; the doll walking back to the candle, and being
  // asked; then the film.
  cut(dt) {
    if (!this.part) { this.part = 'bite'; this.s = 0; }
    this.s += dt;
    this.lights = [];
    this['cut_' + this.part](dt, this.s);
  }
  next(part) { this.part = part; this.s = 0; }

  cut_bite(dt, t) {
    const { W, A, D, cam } = this.c, w = W(), th = w.thing, f = w.finale, p = w.player, T = w.thread;
    // the red goes out of it from the bitten end back, once it has fallen
    const n = Math.min(this.n0, Math.floor(Math.max(0, t - 0.9) * 260));
    for (let i = this.n0 - 1; i >= this.n0 - n && i >= 0; i--) T.dead[i] = 1;
    this.at(0.1, 'teeth', () => { D().spawn('fiber', p.bx, p.by + 0.1, 16, { speed: 1.2, life: 1.6, vy: 0.4 }); cam.shake = 0.15; });
    this.at(0.55, 'lands', () => A.pick(['cloth1', 'cloth2', 'cloth3'], { vol: 0.25, rate: 1.2, x: p.x, y: p.y }));
    // it sees the thread fall, starts back, and screams; then it runs
    const SCREAM = 1.05, BOLT = 3.2, RUN = 2.4, EDGE = 40.3;
    this.at(0.85, 'start', () => { A.play('bone2', { vol: 0.9, rate: 0.75, verb: 1 }); A.play('inhale', { vol: 1.0, rate: 1.8, verb: 0.8 }); });
    this.at(SCREAM, 'scream', () => { A.voice('scream', null, 1, 1.6); this.c.sub(L.FINALE.scream, BOLT - SCREAM + 0.4); cam.shake = 0.7; this.c.log('it screams'); });
    if (t < BOLT) {
      th.lean = lerp(this.h0, 0, smooth(0.8, 1.1, t)); th.hollow = lerp(0.9, 1, smooth(0.8, 1.2, t));
      th.mouth = 0.25 * smooth(0.8, 1.0, t) + 2.1 * smooth(SCREAM - 0.05, SCREAM + 0.15, t) * (1 - 0.25 * smooth(2.6, 3.1, t)) + 0.15 * Math.sin(t * 37) * smooth(SCREAM, SCREAM + 0.2, t);
    }
    // on all fours, the way it came, along the floor behind her, past the candle, and over the edge of the beam into the Loom
    if (t >= BOLT) this.once('bolt', () => {
      const x0 = th.x, gy = (x) => w.T.ground(x, f.y + 2, 6) ?? f.y;
      th.gone = true; cam.shake = 0.5; this.c.log('it runs');
      A.play('drag', { vol: 1.0, rate: 1.1, verb: 0.8 }); A.play('bone1', { vol: 0.8, rate: 0.8, verb: 0.8 });
      this.lamp = w.lamps.find((l) => l.finale); this.lamp0 = this.lamp ? this.lamp.i : 0;
      w.climber = { x: x0, y: th.y, s: 0, k: th.k, lift: 0.42, step: 0.95, spread: 0.14, neck: 0.45, head: 1.15, mouth: 1.6, twitch: 1, look: 0, quick: 16, rear: 0.2, view: [0, 0, 0.75], lights: [], jump: true,
        path: (s) => { const x = x0 + s; return x < EDGE ? [x, gy(x) + 0.02, -0.9] : [EDGE + (x - EDGE) * 0.35, gy(EDGE) - (x - EDGE) * 1.6, -0.9]; },
        out: (s) => (x0 + s < EDGE ? [0, 1, 0.12] : V3.norm([-0.8, 0.4, 0.2])),
        grip: (at, key) => { if (this.moving) A.pick(['palm1', 'palm2', 'palm3'], { vol: 0.75 + Math.random() * 0.25, rate: 0.85, vary: 0.25, x: at[0], y: at[1], verb: 0.7 }); } };
    });
    const c = w.climber;
    if (c && t >= BOLT) {
      const u = clamp((t - BOLT) / RUN, 0, 1);
      this.moving = u < 1;
      c.s = (EDGE + 6 - th.x) * (0.5 * u * u + 0.5 * u);       // from a standing start, faster and faster
      [c.x, c.y] = c.path(c.s);
      c.mouth = 1.4 + 0.4 * Math.sin(t * 9); c.look = 0;
      // lit as it was kneeling: mostly from behind, a little from the candle side
      c.lights = [{ x: c.x - 1.8, y: c.y + 2.6, z: -1.6, r: 5, i: 1.1, c: [0.7, 0.76, 1] }, { x: c.x + 1.6, y: c.y + 1.0, z: 1.2, r: 4, i: 0.3, c: [1, 0.82, 0.72] }];
      // the candle gutters as it goes by
      if (this.lamp) this.lamp.i = this.lamp0 * (1 - 0.65 * Math.exp(-(((c.x - this.lamp.x) / 2.2) ** 2)));
      if (u >= 1) { this.once('over', () => { A.play('thud', { vol: 0.6, rate: 0.7, verb: 2 }); }); if (t > BOLT + RUN + 0.2) w.climber = null; }
    }
    this.lights.push({ x: 17.2, y: f.y + 2.2, z: 1.2, r: 6.5, i: 0.42, c: [0.86, 0.84, 0.95], soft: 0 });
    // the two of them, in to its face as it screams; then wider, after it, as it runs; then she is alone with the candle
    const inn = smooth(0.9, 1.5, t) * (1 - smooth(BOLT - 0.2, BOLT + 0.3, t)), run = smooth(BOLT, BOLT + RUN * 0.8, t);
    const v0 = { x: lerp(p.x - 1.2, (th.x + p.x) / 2, inn), y: lerp(f.y + 1.7, f.y + 2.0, inn), vh: lerp(6.6, 4.8, inn) };
    this.view = { x: lerp(v0.x, 27.5, run), y: lerp(v0.y, f.y + 2.4, run), vh: lerp(v0.vh, 11, run) };
    const END = BOLT + RUN + 1.6;
    this.dark = smooth(END - 0.5, END, t);
    if (t > END + 0.3) { if (this.lamp) this.lamp.i = this.lamp0; this.lamp = null; this.startDies(); }
  }

  // the thread, from the dark to her door, as arc lengths (shared with the climb of the other ending)
  measure() {
    const w = this.c.W(), g = w.grey, gi = w.finale.gi, arc = new Float32Array(gi + 1);
    for (let i = gi - 1; i >= 0; i--) arc[i] = arc[i + 1] + Math.hypot(g.x[i] - g.x[i + 1], g.y[i] - g.y[i + 1]);
    const near = (x, y) => { let b = 0, bd = 1e9; for (let i = 0; i <= gi; i++) { const d = Math.hypot(g.x[i] - x, g.y[i] - y); if (d < bd) { bd = d; b = i; } } return arc[b]; };
    return { arc, total: arc[0], gi, near };
  }
  startDies() {
    const { W } = this.c, w = W(), m = this.measure();
    // [camera x, y, view height, the front enters at, leaves at, seconds before, seconds crossing, seconds after]
    // two places (the user, 2026-11-27: one or two screens of it): the Hall of Chairs, and her door, where the wind drops
    const P = [[31, -243.2, 13, [46.4, -262], [15, -224], 0.5, 3.6, 0.3], [23.5, 3.0, 12.5, [42, 0.5], [18.8, 1.4], 0.4, 3.4, 4.2]];
    this.pulse = { ...m, bite: true, s: 0, k: -1, t: 0, places: P.map(([x, y, vh, a, b, wait, dur, hold]) => ({ x, y, vh, s0: m.near(...a), s1: m.near(...b), wait, dur, hold })) };
    w.thing.gone = true; w.thing.slack = true; w.hideDoll = true;
    for (let i = 0; i < w.thread.n; i++) w.thread.dead[i] = 1;
    this.next('dies');
  }
  cut_dies(dt) {
    const { W, A, D, log } = this.c, w = W(), P = this.pulse;
    let q = P.places[P.k];
    if (!q || P.t > q.wait + q.dur + q.hold) {
      if (P.k === P.places.length - 1) { this.startWell(); return; }
      P.k++; P.t = 0; q = P.places[P.k]; P.s = q.s0;
      this.view = { x: q.x, y: q.y, vh: q.vh }; this.snap = true;
      A.beds(P.k === 0 ? { amb_hall: 0.4 } : { amb_wind: 0.6 });
      log('the red goes out · ' + P.k);
    }
    P.t += dt;
    const last = P.k === P.places.length - 1, u = clamp((P.t - q.wait) / q.dur, 0, 1);
    P.s = lerp(q.s0, q.s1, u);
    this.dark = Math.max(1 - smooth(0, 0.35, P.t), smooth(q.wait + q.dur + q.hold - (last ? 1.2 : 0.3), q.wait + q.dur + q.hold, P.t));
    // all of it ahead still glows; the front is a spark running along it, and behind it there is only grey
    const [fx, fy] = this.pt(P.s);
    if (u < 1) this.lights.push({ x: fx, y: fy + 0.3, r: 5.5, i: 1.5, c: [1, 0.5, 0.38], soft: 8 });
    for (let k = 1; k <= 16; k++) {
      const s = P.s + k * 2.4;
      if (s > q.s1 + 14 || s >= P.total) break;
      const [x, y] = this.pt(s);
      this.lights.push({ x, y: y + 0.3, r: 4.6, i: 0.55, c: [1, 0.2, 0.15], soft: 6 });
    }
    if (u > 0 && u < 1 && Math.random() < dt * 40) D().spawn('spark', fx, fy + 0.1, 1, { speed: 0.9, life: 0.8 });
    for (const b of w.bells) if (!b._last && Math.hypot(b.x - fx, b.y + 1 - fy) < 4) { b._last = true; b.lit = 1; b.ring = 1; A.bellNote(b.i, b.x, b.y); }
    for (const pg of w.pegs) if (pg.glow > 0.02 && Math.hypot(pg.x - fx, pg.y - fy) < 2.5) { pg.tied = false; pg.glow = 0; A.play('release', { vol: 0.4, rate: 0.8, x: pg.x, y: pg.y }); }
    if (last && u >= 1) {
      // it has reached her door. The wind drops, for the first time
      this.once('still', () => { w.pegs[0].glow = 0; A.play('release', { vol: 0.5, rate: 0.6 }); });
      if (P.t > q.wait + q.dur + 0.7) this.once('air', () => { w.stillAir = true; A.beds({}); log('the wind drops'); });
    }
  }

  // the only way up there is: the well over the Loom, and the thread hanging in it
  startWell() {
    const { W, A, log } = this.c, w = W(), P = this.pulse, T = w.T;
    P.s = P.total + 1;
    P.a = P.near(105.2, -452); P.b = P.near(103.2, -434.4); P.cut = P.near(102.2, -428.6); P.drop = 0;
    this.view = { x: 103.0, y: -436, vh: 14 }; this.snap = true;
    w.climber = { x: 104, y: -470, s: P.a, k: 2.6, lift: 0.5, step: 0.95, spread: 0.1, neck: 0.5, head: 1.25, mouth: 1.2, twitch: 1, look: 0, quick: 10, rear: 0.5, view: [0, 0, 0.75], lights: [], jump: true,
      path: (s) => { const [x, y] = this.pt(clamp(s, 0, P.total)); return [x, y - P.drop, 0]; },
      clear: (q, r) => { let [x, y] = q; for (let i = 0; i < 4; i++) { const d = T.d(x, y); if (d >= r) break; const [gx, gy] = T.grad(x, y); x += gx * (r - d) * 0.8; y += gy * (r - d) * 0.8; } return [x, y, q[2]]; },
      out: () => { const a = this.spin || 0; return V3.norm([Math.sin(a) + 0.25, 0.1, Math.cos(a) + 0.35]); },
      grip: (at, key) => { if (key[0] === 'h' && this.moving) A.pick(['palm1', 'palm2', 'palm3'], { vol: 0.95, rate: 0.85, vary: 0.25, x: at[0], y: at[1], verb: 1 }); } };
    this.next('well');
    log('it tries the thread');
  }
  cut_well(dt, t) {
    const { W, A, D, cam, log } = this.c, w = W(), P = this.pulse, c = w.climber;
    const START = 1.5, UP = 4.2, HANG = 1.5, top = START + UP, off = top + HANG;
    this.atS(0.2, 'far1', () => A.play('drag', { vol: 0.6, rate: 0.6, x: 104, y: -480, verb: 1.4 }));
    for (const s of [0.3, 0.6, 0.85, 1.05, 1.22, 1.36]) this.atS(s, 'q' + s, () => A.pick(['palm1', 'palm2', 'palm3'], { vol: 0.3 + s * 0.4, rate: 0.75, vary: 0.2, x: 104, y: -455, verb: 1.4 }));
    this.dark = Math.max(1 - smooth(0.1, 1.2, t), smooth(off + 1.3, off + 2.2, t));
    const u = clamp((t - START) / UP, 0, 1), G = c.step * c.k;
    this.moving = u > 0 && u < 1;
    // faster and faster, in pulls; it slows for nothing
    const s = lerp(P.a, P.b, u * u * 0.35 + u * 0.65);
    c.s = s - (u < 1 ? Math.sin(s / G * Math.PI * 2) * G * 0.12 : 0);
    if (u >= 1) {
      // the thread parts over it. It hangs there a moment with the end of it in its hands
      this.once('snap', () => {
        A.play('tear', { vol: 1.1, rate: 1.1, x: 102, y: -424 }); A.play('cut', { vol: 0.8, rate: 0.7 }); cam.shake = 0.35;
        const [x, y] = this.pt(P.cut);
        D().spawn('puff', x, y, 10, { speed: 1.2, life: 1.4, vy: -0.4, r: 0.7 }); D().spawn('splash', x, y, 10, { speed: 1.6, life: 1.6, vy: -0.6 });
        log('the thread parts');
      });
      this.parted = Math.min(1, (this.parted || 0) + dt * 1.4);
      const h = t - top;
      P.drop = 0.9 * smooth(0, HANG * 0.25, h);
      c.look = damp(c.look, h > 0.45 ? 1 : 0, 9, dt); c.mouth = damp(c.mouth, h < HANG ? 0.15 : 2.2, 10, dt); c.twitch = 0.2;
      this.atS(top + 0.4, 'gasp', () => A.play('inhale', { vol: 0.9, rate: 1.3, verb: 1 }));
      if (t > off) {
        this.once('off', () => { A.voice('cut4', null, 0.88); this.c.sub(L.FINALE.cut4, 1.6); cam.shake = 0.5; });
        const q = t - off;
        P.drop = 0.9 + 0.5 * 17 * q * q + 2 * q; this.spin = q * 1.6; c.jump = q > 0.05;
        this.atS(off + 2.2, 'thud', () => { A.play('thud', { vol: 1.0, rate: 0.6, verb: 1.8 }); cam.shake = 0.2; A.play('land', { vol: 0.8, rate: 0.35, verb: 1.6 }); });
      }
    } else { c.look = 0; c.mouth = 0.7 + 0.5 * Math.abs(Math.sin(t * 5)); }
    const [bx, by] = this.pt(clamp(c.s, 0, P.total));
    c.x = bx; c.y = by - P.drop;
    const fall = t > off ? smooth(0, 1.2, t - off) : 0;
    this.view = { x: 103.0, y: lerp(-437, -432.6, smooth(START, top, t)) - fall * 9, vh: 14 - smooth(top - 1, top + 0.4, t) * 2 };
    this.lights.push({ x: 101.5, y: -422, z: 1.5, r: 22, i: 1.5, c: [0.8, 0.84, 1], soft: 8 }, { x: c.x - 0.6, y: c.y + 3.2, z: 2, r: 8, i: 0.55 * u, c: [0.8, 0.84, 1], soft: 6 }, { x: 104.5, y: -441, z: 2, r: 9, i: 0.4, c: [0.75, 0.8, 1], soft: 6 });
    c.lights = [{ x: c.x + 1.4, y: c.y + 4.0, z: 3, r: 9, i: 2.4, c: [0.82, 0.85, 1.0] }, { x: c.x - 2, y: c.y + 2, z: -2.5, r: 8, i: 2.2, c: [0.75, 0.8, 1.0] }];
    if (t > off + 3.0) { w.climber = null; this.startAsk(); }
  }
  // like `at`, in the part's own time
  atS(t, k, f) { if (this.s >= t) this.once(k, f); }

  // at the bottom: the doll, the candle, what is left of her, and what comes to ask
  startAsk() {
    const { W, A } = this.c, w = W(), p = w.player;
    w.hideDoll = false; p.facing = 1; this.pulse.hang = true;
    this.view = { x: p.x + 1, y: p.y + 1.1, vh: 6.2 }; this.snap = true;
    A.beds({ amb_breath: 0.3 });
    w.lamps = w.lamps.map((l) => (l.finale ? (this.lamp = { ...l }) : l));
    this.next('ask'); this.reached = 0;
  }
  cut_ask(dt, t) {
    const { W, A, playLine, log } = this.c, w = W(), th = w.thing, p = w.player, GOAL = 24.9;
    const palm = (dx, v) => A.pick(['palm1', 'palm2', 'palm3'], { vol: v, vary: 0.2, x: p.x + dx, y: p.y, verb: 1 });
    // back along her own dead thread to the light, and to her
    if (!this.reached) {
      // she walks (her own steps, at a walk), slowing for the last metre, and stops by the candle
      p.facing = 1;
      const left = GOAL - p.x;
      w.ending.walk = t > 1.6 ? { axisX: clamp(0.08 + left * 0.3, 0.1, 0.24), axisY: 0, held: {}, pressed: {} } : null;
      if (left < 0.05 || t > 16) { this.reached = t; w.ending.walk = null; log('at the candle'); }
      for (const [s, dx] of [[5.5, -9], [6.4, -8.4], [7.3, -8]]) this.atS(s, 'l' + s, () => palm(dx, 0.4));
    }
    const on = this.reached > 0, r = on ? t - this.reached : 0, R = (s, k, f) => { if (on && r > s) this.once(k, f); };
    const look = on ? smooth(0.3, 2.0, r) : 0;
    this.view = { x: lerp(p.x + 1.0, p.x + 0.25, look), y: lerp(p.y + 1.1, p.y + 0.8, look), vh: lerp(5.4, 3.7, look) };
    if (this.lamp) this.lamp.i = 0.9 * (1 - (on ? 0.8 * smooth(3, 10, r) : 0));
    this.dark = Math.max(1 - smooth(0.1, 1.4, t), on ? smooth(19.5, 20.3, r) : 0);
    // and sits down beside it, facing it
    R(0.5, 'sit', () => { w.rest.at = { x: p.x, y: p.y, flip: 1, held: true }; A.pick(['cloth1', 'cloth2'], { vol: 0.3, rate: 1.1, x: p.x, y: p.y }); });
    R(0.4, 'r1', () => palm(-7, 0.6)); R(1.2, 'r2', () => palm(-5.8, 0.7)); R(1.7, 'r3', () => palm(-4.8, 0.85));
    R(2.0, 'drg', () => A.play('drag', { vol: 0.5, rate: 0.7, x: p.x - 5, y: p.y }));
    th.lean = on ? smooth(2.4, 5, r) * 0.5 : 0;                 // (the candle leans away from it)
    if (on && r > 2.6) {
      th.gone = false; th.hollow = 1;
      // in from the left, in two pulls; then, while it asks, up over her head and down the other side, to see if that helps
      const come = 0.55 * smooth(2.6, 4.0, r) + 0.45 * smooth(4.5, 5.1, r), over = smooth(9.6, 13.2, r), ph = Math.PI * (1 - over), sn = Math.sin(ph), cs = Math.cos(ph);
      const ring = [p.x + cs * 1.2, p.y + 0.56 + sn * 1.25, 0.25 + 0.15 * sn], far = [p.x - 5.6, p.y + 2.4, -2.4];
      let at = V3.mix3(far, ring, come);
      at[0] += Math.sin(t * 31) * 0.004;
      let face = V3.norm([-cs * 0.75, -0.1 - sn * 0.75, 0.8]), up = V3.norm([0.25 * -cs + 1.5 * sn, 1 - 1.7 * sn, 0]);
      // to put the candle out it turns its head to the flame, comes down beside it, and blows on it
      const L0 = this.lamp || { x: 26.4, y: -443.3 }, flame = [L0.x, L0.y + 0.06, 0.2], bk = smooth(16.6, 17.8, r) * (1 - smooth(20.2, 21.0, r));
      if (bk > 0) {
        at = V3.mix3(at, [flame[0] - 0.62, flame[1] + 0.34, 0.5], bk);
        face = V3.norm(V3.mix3(face, V3.norm(V3.sub(flame, at)), bk));
        up = V3.norm(V3.mix3(up, [0.45, 1, 0], bk));
      }
      this.once('come', () => { A.play('bone1', { vol: 0.6, rate: 0.6, verb: 0.8 }); log('it asks'); });
      R(4.5, 'come2', () => A.play('bone2', { vol: 0.6, rate: 0.6, verb: 0.6 }));
      R(5.2, 'sniff', () => A.play('inhale', { vol: 0.5, rate: 1.1, verb: 0.4 }));
      R(6.3, 'c3', () => playLine('cut3', L.FINALE.cut3));
      R(9.6, 'over', () => A.play('bone1', { vol: 0.5, rate: 0.45, verb: 0.6 }));
      R(17.6, 'sn2', () => A.play('inhale', { vol: 0.7, rate: 0.9, verb: 0.4 }));
      const say = smooth(6.4, 6.6, r) * (1 - smooth(14.4, 14.8, r)), blow = smooth(17.9, 18.9, r) * (1 - smooth(19.9, 20.3, r));
      const mouth = say * (0.12 + 0.22 * Math.abs(Math.sin(t * 4.7)) * (0.5 + 0.5 * Math.sin(t * 1.9)) + 0.06 * Math.sin(t * 11)) + 0.55 * blow;
      th.reach = { k: 1.5, from: [p.x - 8.6, p.y + 0.5, -4.4], yaw: 0.9, at, face, up, size: 2.0, mouth, thick: 0.85,
        bend: [[p.x - 6.2, p.y + 4.6, -3.4], V3.add(at, [-1.5 - sn * 0.4 + cs * 0.2, lerp(1.5, 2.2, sn) + over * 0.7, -1.7])] };
      th.lights = [{ x: at[0] + 0.5, y: at[1] + 1.0, z: 1.4, r: 3, i: (0.6 - 0.25 * over) * smooth(3.4, 5, r), c: [0.9, 0.9, 1.0] }];
      th.gain = smooth(2.6, 3.6, r) * (1 - smooth(19.5, 20.1, r));
      R(19.1, 'out', () => { this.c.sub('', 0.01); w.candleOut = w.time; w.lamps = w.lamps.filter((l) => !l.finale); A.play('release', { vol: 0.7, rate: 0.4 }); A.beds({}); });
    }
    R(21.2, 'film', () => this.c.film(CARDS.cut, 'cut', true));
  }
}
