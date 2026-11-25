// WebAudio mix: ambience beds per area, sparse music, spatial one-shots, a harp you play with the thread.
// How the place shapes what is heard (the size of the cave, rock in the way, what she walks on) is decided in sound.js;
// this file only plays it: four reverbs to blend, echoes off the walls, a muffle per sound, variants that don't repeat.

// Which recording of the knitter's voice the game plays: 'voice' = the old woman (re-recorded 2026-11-22),
// 'voice_young' = the first recording, which came out sounding younger. Swap this one word to switch back.
export const VOICE_SET = 'voice';
const BASE = 'assets/audio/';
// sounds that come in variants: A.any('stones') picks one, never the same twice running
export const GROUPS = {
  step: 4, snow: 3, crumbs: 2, dirt: 3, palm: 3, bone: 2,
  st_wood: 6, st_board: 3, st_earth: 5, st_leaf: 4, st_wet: 5, st_soft: 5, st_grit: 4, cloth: 5,
  stones: 4, tick: 4, trickle: 3, rumble: 3, groan: 4,
  cricket: 3, beetle: 4, twig: 5, leaf: 4, timber: 4, chair: 4, floor: 4, scratch: 4, loomwork: 3,
  ratch: 3, clack: 3, pan: 3, pin: 3, roll: 3, whirr: 1, heave: 2,
  ring: 2, chain: 4, hinge: 3, plop: 3, bubble: 4,
};
const FILES = [
  'amb_wind', 'amb_cave', 'amb_drips', 'amb_ink', 'amb_hum', 'amb_pit', 'amb_deep',
  'jump', 'land', 'grip', 'release', 'creak', 'tie', 'harp', 'bell', 'bowl', 'chime', 'moth', 'chew',
  'tear', 'splash', 'drip', 'gate', 'skein', 'cut', 'snag', 'mend',
  'mus_title', 'mus_gardens', 'mus_gallery', 'mus_mere', 'amb_beat', 'amb_breath', 'amb_hall',
  'wood', 'drag', 'inhale', 'thud', 'grind', 'ld_earth', 'ld_wood', 'ld_wet', 'ld_soft',
  'flame', 'veil', 'air', 'lap', 'bellhum',
  ...Object.entries(GROUPS).flatMap(([g, n]) => Array.from({ length: n }, (_, i) => g + (i + 1))),
];
const AREA_BEDS = {
  brink: { amb_cave: 0.0 },
  throat: { amb_cave: 0.4, amb_drips: 0.25 },
  gardens: { amb_cave: 0.45, amb_drips: 0.4, amb_hum: 0.18 },
  gallery: { amb_cave: 0.55, amb_hum: 0.25, amb_drips: 0.15 },
  mere: { amb_cave: 0.45, amb_ink: 0.45, amb_drips: 0.3 },
  hall: { amb_hall: 0.8, amb_drips: 0.05 },
  hush: { amb_hum: 0.5, amb_drips: 0.08 },
  treadles: { amb_cave: 0.35, amb_beat: 0.7 },
  loom: { amb_breath: 0.4 },
};
const AREA_MUSIC = { brink: null, throat: null, gardens: 'mus_gardens', gallery: 'mus_gallery', mere: 'mus_mere', hall: null, hush: null, treadles: null, loom: null };
const BEDS = ['amb_cave', 'amb_drips', 'amb_ink', 'amb_hum', 'amb_beat', 'amb_breath', 'amb_hall', 'amb_pit', 'amb_deep'];
// a minor pentatonic over two octaves: the thread only ever sings in tune
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
// the four spaces sounds ring in, blended by the size of the cave: [seconds, early reflections (s), how dark the tail gets]
const SPACES = [
  { sec: 0.35, early: 0.012, n: 7, dark: 0.25, level: 0.42 },     // a crawl: boxy, close, gone at once
  { sec: 1.2, early: 0.035, n: 6, dark: 0.35, level: 0.46 },      // a room
  { sec: 3.0, early: 0.09, n: 5, dark: 0.5, level: 0.52 },        // a cavern
  { sec: 6.0, early: 0.17, n: 5, dark: 0.7, level: 0.6 },       // the Mere, the Loom
];
const OPENF = 20000;

export class Audio {
  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.004; comp.release.value = 0.25;
    this.master.connect(comp).connect(c.destination);
    this.out = comp;                 // the storm bridge plays here, past the master (which is silent during films)
    const lp = (f) => { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = f; b.Q.value = 0.3; return b; };
    this.worldLP = lp(OPENF);        // the whole place, muffled when she dies and while a found thing is held up
    this.ambLP = lp(OPENF);          // the beds and the music come in duller when she crawls into the rock
    this.musLP = lp(OPENF);
    this.worldLP.connect(this.master); this.ambLP.connect(this.worldLP); this.musLP.connect(this.worldLP);
    this.bus = {};
    const to = { music: this.musLP, amb: this.ambLP, sfx: this.worldLP, voice: this.master, ui: this.master };
    for (const [k, v] of Object.entries({ music: 0.42, amb: 0.8, sfx: 0.9, voice: 1.0, ui: 0.9 })) { const gn = c.createGain(); gn.gain.value = v; gn.connect(to[k]); this.bus[k] = gn; }
    // reverb: one send, four rooms, crossfaded by setSpace()
    this.verbIn = c.createGain(); this.verbIn.gain.value = 0.35;
    const back = c.createGain(); back.gain.value = 0.9; back.connect(this.worldLP);
    this.verbs = SPACES.map((s) => {
      const v = c.createConvolver(); v.normalize = false; v.buffer = this._impulse(s);
      const g = c.createGain(); g.gain.value = 0;
      this.verbIn.connect(v).connect(g).connect(back);
      return g;
    });
    this.verbs[2].gain.value = 0.9;
    // echoes off the far walls, left and right
    this.echo = [-0.8, 0.8].map((p) => {
      const d = c.createDelay(1.0), f = lp(2600), g = c.createGain(), q = c.createStereoPanner();
      g.gain.value = 0; q.pan.value = p; d.delayTime.value = 0.1;
      this.verbIn.connect(d).connect(f).connect(g).connect(q).connect(back);
      return { d, g };
    });
    this.buf = {};
    this.loops = {};
    this.emit = {};                  // looping sounds with a place in the world (sound.js)
    this.lastOf = {};
    this.bedBase = {}; this.bedMod = {};
    this.music = null; this.musicName = null;
    this.listener = [0, 0];
    this.occlude = null;             // sound.js: how much rock is between her and (x, y), 0..1
    this.duck = 1;
    this.volume = 1;
    this.count = {};                 // how often each sound played (tests)
  }
  // a room's impulse: a handful of early reflections, then a tail that darkens as it dies
  _impulse(s) {
    const c = this.ctx, n = Math.floor(c.sampleRate * s.sec), b = c.createBuffer(2, n, c.sampleRate), sr = c.sampleRate;
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let y = 0, e = 0;
      for (let i = 0; i < n; i++) {
        const u = i / n, a = 1 - Math.min(0.93, 0.25 + s.dark * Math.sqrt(u));     // one-pole: duller and duller
        y += a * ((Math.random() * 2 - 1) - y);
        d[i] = y / Math.sqrt(a) * Math.pow(1 - u, 2.6) * Math.min(1, i / (s.early * sr));
      }
      for (let k = 0; k < s.n; k++) { const i = Math.floor(s.early * (0.35 + 0.65 * (k + Math.random() * 0.8) / s.n) * sr); d[i] += (Math.random() < 0.5 ? -1 : 1) * 0.7 * (1 - 0.5 * k / s.n); }
      for (let i = 0; i < n; i++) e += d[i] * d[i];
      const g = s.level / Math.sqrt(e); for (let i = 0; i < n; i++) d[i] *= g;
    }
    return b;
  }
  // w: four weights (crawl, room, cavern, abyss); echo: seconds and level to the left and right wall
  setSpace(w, wet, dl, gl, dr, gr) {
    const t = this.ctx.currentTime;
    this.verbs.forEach((g, i) => g.gain.setTargetAtTime(w[i] * wet, t, 0.35));
    this.echo[0].d.delayTime.setTargetAtTime(dl, t, 1.2); this.echo[0].g.gain.setTargetAtTime(gl, t, 0.5);
    this.echo[1].d.delayTime.setTargetAtTime(dr, t, 1.2); this.echo[1].g.gain.setTargetAtTime(gr, t, 0.5);
  }
  setFilters(amb, mus, world, tau = 0.5) {
    const t = this.ctx.currentTime;
    this.ambLP.frequency.setTargetAtTime(amb, t, tau); this.musLP.frequency.setTargetAtTime(mus, t, tau);
    this.worldLP.frequency.setTargetAtTime(world, t, 0.18);
  }
  async load(progress) {
    let done = 0;
    await Promise.all(FILES.map(async (f) => {
      try {
        const r = await fetch(BASE + f + '.ogg');
        if (r.ok) this.buf[f] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { /* missing sounds are tolerated */ }
      progress?.(++done / FILES.length);
    }));
    this.missing = FILES.filter((f) => !this.buf[f]);
  }
  // master fades (the walk out of the cottage brings the game's sound up slowly, not with a snap)
  fadeMaster(v, tau) {
    const g = this.master.gain, t = this.ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(0.9 * v, t, tau);
  }
  // The storm bridge between the prologue film and the game: the gale as heard from inside the cottage (heavily
  // muffled) rises under the fading title card, past the silenced master, and keeps blowing over the cut. When
  // the cottage door opens, stormOpen() throws the filter open (the full storm for a moment) and hands over to
  // the game's own wind as the master comes up.
  storm(rise = 2.2) {
    if (this.br || !this.buf.amb_wind) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.buf.amb_wind; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.4;
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 700;
    const gn = c.createGain(); gn.gain.value = 0; gn.gain.setTargetAtTime(0.95 * this.volume, t, rise / 3);
    src.connect(lp).connect(lp2).connect(gn).connect(this.out);
    src.playbackRate.value = 0.92;
    src.start(0, Math.random() * this.buf.amb_wind.duration);
    // a low moan that breathes, so the bed under the title isn't a flat hiss
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 0.05;
    lfo.connect(lg).connect(src.playbackRate); lfo.start();
    this.br = { src, lp, lp2, gn, lfo };
  }
  stormOpen() {
    const B = this.br; if (!B || B.open) return;
    B.open = true;
    const t = this.ctx.currentTime;
    B.lp.frequency.setTargetAtTime(5000, t, 0.12); B.lp2.frequency.setTargetAtTime(6000, t, 0.12);
    B.gn.gain.setTargetAtTime(1.05 * this.volume, t, 0.1);
    B.gn.gain.setTargetAtTime(0, t + 0.9, 1.4);
    setTimeout(() => this.stormStop(), 9000);
  }
  stormStop() {
    const B = this.br; if (!B) return;
    this.br = null;
    B.gn.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    setTimeout(() => { try { B.src.stop(); B.lfo.stop(); } catch { /* already stopped */ } }, 1200);
  }
  resume() { if (this.ctx.state !== 'running') this.ctx.resume(); }
  // the player's own balance of voices, music and everything else
  applyMix() { const m = this.mix || {}; this.bus.voice.gain.value = m.voice ?? 1; this.bus.sfx.gain.value = 0.9 * (m.effects ?? 1); this.bus.ui.gain.value = 0.9 * (m.effects ?? 1); }
  setVolume(v) { this.volume = v; this.master.gain.setTargetAtTime(0.9 * v, this.ctx.currentTime, 0.05); }

  // where a sound comes from: left/right, how far, how much rock is in the way. Far sounds lose their top; sounds behind
  // rock lose most of it and some level, and what is left is mostly the cave answering.
  _spatial(x, y) {
    if (x === undefined) return { pan: 0, gain: 1, d: 0, lp: OPENF, occ: 0 };
    const dx = x - this.listener[0], dy = y - this.listener[1];
    const d = Math.hypot(dx, dy);
    const occ = d > 1.2 && this.occlude ? this.occlude(x, y) : 0;
    const lp = Math.max(260, 18000 / (1 + Math.max(0, d - 5) * 0.16) * (1 - occ) + 520 * occ);
    return { pan: Math.max(-0.85, Math.min(0.85, dx / 14)), gain: (1 - 0.45 * occ) / (1 + Math.max(0, d - 4) * 0.12), d, lp, occ };
  }
  play(name, o = {}) {
    const b = this.buf[name];
    if (!b) return null;
    this.count[name] = (this.count[name] || 0) + 1;
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = (o.rate ?? 1) * (o.vary ? 1 + (Math.random() - 0.5) * o.vary : 1);
    const sp = this._spatial(o.x, o.y);
    const vol = (o.vol ?? 1) * sp.gain;
    if (vol < 0.002) return null;
    const gn = c.createGain(); gn.gain.value = vol;
    const pan = c.createStereoPanner(); pan.pan.value = sp.pan;
    const cut = Math.min(sp.lp, o.lp ?? OPENF);
    if (cut < 15000) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 0.4; src.connect(f).connect(gn); } else src.connect(gn);
    gn.connect(pan).connect(this.bus[o.bus || 'sfx']);
    if (o.verb !== 0) { const s = c.createGain(); s.gain.value = (o.verb ?? 0.6) * (1 + Math.min(1.1, sp.d * 0.05) + 0.4 * sp.occ); pan.connect(s).connect(this.verbIn); }
    const t0 = c.currentTime + (o.delay || 0);
    src.start(t0, o.offset || 0);
    // `dur`: a piece of a long recording, faded out (played whole, the 28 s rope creak used to run on for a minute)
    if (o.dur) { gn.gain.setValueAtTime(gn.gain.value, t0 + o.dur * 0.6); gn.gain.linearRampToValueAtTime(0, t0 + o.dur); src.stop(t0 + o.dur + 0.05); }
    return { src, gn };
  }
  pick(names, o) { return this.play(names[(Math.random() * names.length) | 0], o); }
  // one of a group's variants, never the one that played last; a little pitch and level drift on top
  any(g, o = {}) {
    const n = GROUPS[g];
    let k = 1 + ((Math.random() * n) | 0);
    if (n > 1 && k === this.lastOf[g]) k = 1 + (k % n);
    this.lastOf[g] = k;
    return this.play(g + k, { vary: 0.14, ...o, vol: (o.vol ?? 1) * (0.86 + Math.random() * 0.26) });
  }

  // the harp: a pluck pitched by how taut the thread is
  pluck(tension, x, y) {
    const i = Math.max(0, Math.min(SCALE.length - 1, Math.round(tension * (SCALE.length - 1))));
    const semis = SCALE[i] - 7;
    this.play('harp', { rate: Math.pow(2, semis / 12), vol: 0.62, x, y, verb: 1.1 });
    // a soft fifth above for body
    this.play('harp', { rate: Math.pow(2, (semis + 7) / 12), vol: 0.18, x, y, verb: 1.2, delay: 0.04 });
    return Math.pow(2, semis / 12);
  }
  bellRate(i) { return Math.pow(2, (SCALE[(i * 2 + 3) % SCALE.length] - 5) / 12); }
  bellNote(i, x, y) {
    const r = this.bellRate(i);
    this.play('bell', { rate: r, vol: 0.6, x, y, verb: 1.2 });
    this.play('bowl', { rate: r / 2, vol: 0.35, x, y, verb: 1 });
  }

  loop(name, vol, bus = 'amb') {
    let L = this.loops[name];
    if (!L) {
      const b = this.buf[name];
      if (!b || vol <= 0) return;
      const c = this.ctx, src = c.createBufferSource();
      src.buffer = b; src.loop = true;
      const gn = c.createGain(); gn.gain.value = 0;
      src.connect(gn).connect(this.bus[bus]);
      src.start(0, Math.random() * b.duration);
      L = this.loops[name] = { src, gn, vol: 0 };
    }
    if (Math.abs(L.vol - vol) > 0.002) { L.vol = vol; L.gn.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.6); }
  }
  // a looping sound with a place: made when first heard, faded and dropped when it is out of earshot
  source(id, name, vol, x, y, rate = 1) {
    let E = this.emit[id];
    const c = this.ctx, t = c.currentTime;
    if (!E) {
      if (vol < 0.004 || !this.buf[name]) return;
      const src = c.createBufferSource(); src.buffer = this.buf[name]; src.loop = true; src.playbackRate.value = rate;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.4;
      const gn = c.createGain(); gn.gain.value = 0; const pan = c.createStereoPanner();
      src.connect(f).connect(gn).connect(pan).connect(this.bus.sfx);
      const s = c.createGain(); s.gain.value = 0.4; pan.connect(s).connect(this.verbIn);
      src.start(0, Math.random() * src.buffer.duration);
      E = this.emit[id] = { src, f, gn, pan, vol: 0 };
    }
    E.used = true;
    const sp = this._spatial(x, y);
    E.gn.gain.setTargetAtTime(vol * (1 - 0.45 * sp.occ), t, 0.25);
    E.pan.pan.setTargetAtTime(sp.pan, t, 0.15);
    E.f.frequency.setTargetAtTime(Math.min(sp.lp, 14000), t, 0.2);
    E.src.playbackRate.setTargetAtTime(rate, t, 0.2);
  }
  // once a frame after the sources are set: anything not asked for this time fades out and goes
  sweepSources() {
    for (const [id, E] of Object.entries(this.emit)) {
      if (E.used) { E.used = false; continue; }
      delete this.emit[id];
      E.gn.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      setTimeout(() => { try { E.src.stop(); E.pan.disconnect(); } catch { /* gone */ } }, 1800);
    }
  }
  // exactly these ambience beds, and nothing else (bedMod, set by sound.js, makes them drift and answer the space)
  beds(b) { this.bedBase = b; this._beds(); }
  _beds() { for (const n of BEDS) this.loop(n, (this.bedBase[n] || 0) * (this.bedMod[n] ?? 1)); }
  setArea(id) {
    const beds = AREA_BEDS[id] || {};
    if (this.endMusic) return;             // the ending sets its own
    this.beds(beds);
    if (!this.endMusic) this.setMusic(AREA_MUSIC[id] ?? null);
  }
  // music: the title loops; in the caves a piece plays through once, then the place is left alone for a while before it
  // comes back, so it never wears a groove
  setMusic(name, fade = 4) {
    if (name === this.musicName) return;
    const t = this.ctx.currentTime;
    if (this.music) { const m = this.music; m.gn.gain.setTargetAtTime(0, t, fade / 3); setTimeout(() => { try { m.src.stop(); } catch { /* ended */ } }, fade * 1500); }
    this.musicName = name; this.music = null;
    this.musRest = name && name !== 'mus_title' ? 3 + Math.random() * 6 : 0;
    this.musFade = fade;
    if (name && !this.musRest) this._startMusic();
  }
  _startMusic() {
    const name = this.musicName, c = this.ctx, t = c.currentTime;
    this.musRest = 0;
    if (!name || !this.buf[name]) return;
    const src = c.createBufferSource(); src.buffer = this.buf[name]; src.loop = name === 'mus_title';
    const gn = c.createGain(); gn.gain.value = 0; gn.gain.setTargetAtTime(1, t + 0.5, this.musFade / 3);
    src.connect(gn).connect(this.bus.music); src.start();
    const m = this.music = { src, gn };
    src.onended = () => { if (this.music === m) { this.music = null; this.musRest = 45 + Math.random() * 50; } };
  }
  // continuous layers driven by the game each frame
  update(dt, s) {
    this.listener = s.cam;
    // the storm is continuous: loud and gusting on the Brink, a faint moan down the pit, silent below
    if (s.out !== undefined) {
      this.loop('amb_wind', 0.0001);
      const L = this.loops.amb_wind;
      if (L) {
        const t = this.ctx.currentTime, v = s.out * (0.38 + 0.75 * s.gust) + (1 - s.out) * s.under * 0.06;
        L.vol = v; L.gn.gain.setTargetAtTime(v, t, 0.25);
        L.src.playbackRate.setTargetAtTime(0.88 + 0.26 * s.gust * s.out, t, 0.4);
      }
    }
    this.loop('moth', s.moth, 'sfx');
    this._beds();
    if (this.musRest > 0 && !s.paused) { this.musRest -= dt; if (this.musRest <= 0) this._startMusic(); }
    const target = s.voice ? 0.35 : 1;
    this.duck += (target - this.duck) * Math.min(1, dt * 3);
    this.bus.music.gain.value = 0.42 * this.duck * (s.music ?? 1) * (this.mix?.music ?? 1);
    this.bus.amb.gain.value = 0.8 * (0.55 + 0.45 * this.duck) * (this.mix?.effects ?? 1);
  }
  stopVoices() { for (const v of this.voices || []) { try { v.gn.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08); v.src.stop(this.ctx.currentTime + 0.5); } catch { /* already over */ } } }
  // voice lines play through their own element-free buffer path
  voice(id, onEnd, rate = 1) {
    const url = 'assets/' + VOICE_SET + '/' + id + '.ogg';
    const go = (b) => {
      const c = this.ctx, src = c.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
      const gn = c.createGain(); gn.gain.value = 1.0;
      src.connect(gn).connect(this.bus.voice);
      const s = c.createGain(); s.gain.value = 0.18; gn.connect(s).connect(this.verbIn);
      const v = { src, gn };
      (this.voices = this.voices || []).push(v);
      src.onended = () => { this.voices = this.voices.filter((q) => q !== v); onEnd?.(b.duration / rate); };
      src.start(c.currentTime + 0.3);
      return b.duration / rate;
    };
    if (this.buf['v_' + id]) return Promise.resolve(go(this.buf['v_' + id]));
    return fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => this.ctx.decodeAudioData(a))
      .then((b) => { this.buf['v_' + id] = b; return go(b); }).catch(() => { onEnd?.(0); return 0; });
  }
}
