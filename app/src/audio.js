// WebAudio mix: ambience beds per area, sparse music, spatial one-shots, a harp you play with the thread.

// Which recording of the knitter's voice the game plays: 'voice' = the old woman (re-recorded 2026-11-22),
// 'voice_young' = the first recording, which came out sounding younger. Swap this one word to switch back.
export const VOICE_SET = 'voice';
const BASE = 'assets/audio/';
const FILES = [
  'amb_wind', 'amb_cave', 'amb_drips', 'amb_ink', 'amb_hum',
  'step1', 'step2', 'step3', 'step4', 'snow1', 'snow2', 'snow3',
  'jump', 'land', 'grip', 'release', 'creak', 'tie', 'harp', 'bell', 'bowl', 'chime', 'moth', 'chew',
  'tear', 'splash', 'drip', 'gate', 'skein', 'cut', 'snag', 'mend',
  'mus_title', 'mus_gardens', 'mus_gallery', 'mus_mere', 'mus_loom', 'mus_end', 'mus_weaver', 'amb_beat',
];
const AREA_BEDS = {
  brink: { amb_cave: 0.0 },
  throat: { amb_cave: 0.4, amb_drips: 0.25 },
  gardens: { amb_cave: 0.45, amb_drips: 0.4, amb_hum: 0.18 },
  gallery: { amb_cave: 0.55, amb_hum: 0.25, amb_drips: 0.15 },
  mere: { amb_cave: 0.45, amb_ink: 0.45, amb_drips: 0.3 },
  hall: { amb_cave: 0.35, amb_hum: 0.3 },
  hush: { amb_hum: 0.5, amb_drips: 0.08 },
  treadles: { amb_cave: 0.35, amb_beat: 0.7 },
  loom: { amb_hum: 0.3, amb_beat: 0.25 },
};
const AREA_MUSIC = { brink: null, throat: null, gardens: 'mus_gardens', gallery: 'mus_gallery', mere: 'mus_mere', hall: 'mus_loom', hush: null, treadles: null, loom: 'mus_weaver' };
// a minor pentatonic over two octaves: the thread only ever sings in tune
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

export class Audio {
  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.004; comp.release.value = 0.25;
    this.master.connect(comp).connect(c.destination);
    this.bus = {};
    for (const [k, v] of Object.entries({ music: 0.42, amb: 0.8, sfx: 0.9, voice: 1.0 })) { const gn = c.createGain(); gn.gain.value = v; gn.connect(this.master); this.bus[k] = gn; }
    // a long dark "cave" reverb for sfx and voice
    this.verb = c.createConvolver(); this.verb.buffer = this._impulse(3.4, 2.6);
    this.verbIn = c.createGain(); this.verbIn.gain.value = 0.35;
    this.verbIn.connect(this.verb).connect(this.bus.sfx);
    this.buf = {};
    this.loops = {};
    this.music = null; this.musicName = null;
    this.listener = [0, 0];
    this.duck = 1;
    this.volume = 1;
  }
  _impulse(sec, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 200 ? i / 200 : 1);
    }
    return b;
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
  }
  resume() { if (this.ctx.state !== 'running') this.ctx.resume(); }
  setVolume(v) { this.volume = v; this.master.gain.setTargetAtTime(0.9 * v, this.ctx.currentTime, 0.05); }

  _spatial(x, y) {
    if (x === undefined) return { pan: 0, gain: 1 };
    const dx = x - this.listener[0], dy = y - this.listener[1];
    const d = Math.hypot(dx, dy);
    return { pan: Math.max(-0.85, Math.min(0.85, dx / 14)), gain: 1 / (1 + Math.max(0, d - 4) * 0.12) };
  }
  play(name, o = {}) {
    const b = this.buf[name];
    if (!b) return null;
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = (o.rate ?? 1) * (o.vary ? 1 + (Math.random() - 0.5) * o.vary : 1);
    const sp = this._spatial(o.x, o.y);
    const gn = c.createGain(); gn.gain.value = (o.vol ?? 1) * sp.gain;
    const pan = c.createStereoPanner(); pan.pan.value = sp.pan;
    src.connect(gn).connect(pan).connect(this.bus[o.bus || 'sfx']);
    if (o.verb !== 0) { const s = c.createGain(); s.gain.value = o.verb ?? 0.6; pan.connect(s).connect(this.verbIn); }
    src.start(c.currentTime + (o.delay || 0), o.offset || 0);
    return { src, gn };
  }
  pick(names, o) { return this.play(names[(Math.random() * names.length) | 0], o); }

  // the harp: a pluck pitched by how taut the thread is
  pluck(tension, x, y) {
    const i = Math.max(0, Math.min(SCALE.length - 1, Math.round(tension * (SCALE.length - 1))));
    const semis = SCALE[i] - 7;
    this.play('harp', { rate: Math.pow(2, semis / 12), vol: 0.75, x, y, verb: 1.1 });
    // a soft fifth above for body
    this.play('harp', { rate: Math.pow(2, (semis + 7) / 12), vol: 0.22, x, y, verb: 1.2, delay: 0.04 });
  }
  bellNote(i, x, y) {
    const semis = SCALE[(i * 2 + 3) % SCALE.length] - 5;
    this.play('bell', { rate: Math.pow(2, semis / 12), vol: 0.6, x, y, verb: 1.2 });
    this.play('bowl', { rate: Math.pow(2, (semis - 12) / 12), vol: 0.35, x, y, verb: 1 });
  }

  loop(name, vol, bus = 'amb') {
    let L = this.loops[name];
    if (!L) {
      const b = this.buf[name];
      if (!b) return;
      const c = this.ctx, src = c.createBufferSource();
      src.buffer = b; src.loop = true;
      const gn = c.createGain(); gn.gain.value = 0;
      src.connect(gn).connect(this.bus[bus]);
      src.start(0, Math.random() * b.duration);
      L = this.loops[name] = { src, gn, vol: 0 };
    }
    if (Math.abs(L.vol - vol) > 0.002) { L.vol = vol; L.gn.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.6); }
  }
  setArea(id) {
    const beds = AREA_BEDS[id] || {};
    for (const n of ['amb_cave', 'amb_drips', 'amb_ink', 'amb_hum', 'amb_beat']) this.loop(n, beds[n] || 0);
    if (!this.endMusic) this.setMusic(AREA_MUSIC[id] ?? null);
  }
  setMusic(name, fade = 4) {
    if (name === this.musicName) return;
    const c = this.ctx, t = c.currentTime;
    if (this.music) { const m = this.music; m.gn.gain.setTargetAtTime(0, t, fade / 3); setTimeout(() => m.src.stop(), fade * 1500); }
    this.musicName = name; this.music = null;
    if (!name || !this.buf[name]) return;
    const src = c.createBufferSource(); src.buffer = this.buf[name]; src.loop = true;
    const gn = c.createGain(); gn.gain.value = 0; gn.gain.setTargetAtTime(1, t + 0.5, fade / 3);
    src.connect(gn).connect(this.bus.music); src.start();
    this.music = { src, gn };
  }
  // continuous layers driven by the game each frame
  update(dt, s) {
    this.listener = s.cam;
    this.loop('creak', s.swing, 'sfx');
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
    const target = s.voice ? 0.35 : 1;
    this.duck += (target - this.duck) * Math.min(1, dt * 3);
    this.bus.music.gain.value = 0.42 * this.duck;
    this.bus.amb.gain.value = 0.8 * (0.55 + 0.45 * this.duck);
  }
  // voice lines play through their own element-free buffer path
  voice(id, onEnd) {
    const url = 'assets/' + VOICE_SET + '/' + id + '.ogg';
    const go = (b) => {
      const c = this.ctx, src = c.createBufferSource(); src.buffer = b;
      const gn = c.createGain(); gn.gain.value = 1.0;
      src.connect(gn).connect(this.bus.voice);
      const s = c.createGain(); s.gain.value = 0.18; gn.connect(s).connect(this.verbIn);
      src.onended = () => onEnd?.(b.duration);
      src.start(c.currentTime + 0.3);
      return b.duration;
    };
    if (this.buf['v_' + id]) return Promise.resolve(go(this.buf['v_' + id]));
    return fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => this.ctx.decodeAudioData(a))
      .then((b) => { this.buf['v_' + id] = b; return go(b); }).catch(() => { onEnd?.(0); return 0; });
  }
}
