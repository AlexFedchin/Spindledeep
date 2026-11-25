// The things she picks up, as real models (scripts/props3d): the keepsakes of the hidden rooms and the balls of red yarn. Drawn by
// the renderer's prop pass where they lie, and held up close, turning, when one is found (main.js startShow). Each model is
// fetched when she comes near the first one of its kind; until it is there the old flat drawing stands in.
import { clamp, lerp } from './util.js';
import { euler } from './figure.js';

export const READY = new Set();          // kinds whose model is loaded: props.js and draw.js leave those to this file
export const WORLD_K = 0.2, SHOW_K = 0.6;      // half the size of one, lying about and held up (m)

const mm = (A, B) => B.map((v) => [0, 1, 2].map((r) => A[0][r] * v[0] + A[1][r] * v[1] + A[2][r] * v[2]));
// how each is held up: tip toward the viewer, where it starts, and whether it goes round or only sways (how far, how fast)
const HOLD = {
  spool: { tip: 0.78, sway: 0.75, nod: 0.12 }, button: { tip: 0.12, z: 0.95, sway: 0.62, nod: 0.22 }, seeds: { tip: 0.05, z: 1.1, sway: 0.5, nod: 0.1 },
  thimble: { tip: 0.1, z: 0.84, yaw: 0.4, spin: 0.3, look: 0.75 }, eye: { tip: 0.14, sway: 0.6, nod: 0.24 }, mitten: { tip: 0.12, sway: 0.75, nod: 0.12 },
  pattern: { tip: 0.04, z: 1.12, sway: 0.4, nod: 0.1 }, shoe: { tip: 0.48, z: 1.12, yaw: -1.2, spin: 0.26 }, skein: { tip: 0.35, z: 0.95, yaw: 0, spin: 0.3 },
};
const KINDS = Object.keys(HOLD);

async function mips(src) {
  const out = [src];
  for (let s = src.width >> 1; s >= 1; s >>= 1) out.push(await createImageBitmap(out[out.length - 1], { resizeWidth: s, resizeHeight: s, resizeQuality: 'medium', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }));
  return out;
}
async function load(name) {
  const base = 'assets/props/' + name, r = await fetch(base + '.bin');
  if (!r.ok) throw new Error('no prop ' + name);
  const buf = await r.arrayBuffer(), hl = new DataView(buf).getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  const img = async (u) => mips(await createImageBitmap(await (await fetch(u)).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }));
  return { ...h, prop: true, vb: new Uint8Array(buf, 4 + hl, h.nv * h.stride), ib: new Uint8Array(buf, 4 + hl + h.nv * h.stride, h.ni * 4), tex: await img(base + '.webp'), nrm: await img(base + '_n.jpg') };
}

export class Items {
  constructor(R, log) { this.R = R; this.log = log; this.models = {}; this.asked = new Set(); this.pool = new Map(); this.turn = { yaw: 0, pitch: 0, vy: 0, vp: 0, held: false }; this.t0 = 0; }
  need(kind) {
    if (this.asked.has(kind) || !HOLD[kind]) return;
    this.asked.add(kind);
    load(kind).then((m) => { this.R.addProp(m); m.vb = m.ib = m.tex = m.nrm = null; this.models[kind] = m; READY.add(kind); }, (e) => this.log('prop: ' + e.message));
  }
  all() { KINDS.forEach((k) => this.need(k)); }
  // one thing to draw (kept by key, since each has its own buffer on the GPU)
  one(key, kind) {
    let P = this.pool.get(key);
    if (!P || P.m !== this.models[kind]) { P = { m: this.models[kind], at: [0, 0, 0], k: 1, R: null, env: 0, gain: 1, over: false, lights: [], own: false }; this.pool.set(key, P); }
    return P;
  }
  // the mouse turns what is held up
  drag(dx, dy) { const u = this.turn; u.yaw += dx; u.pitch = clamp(u.pitch + dy, -1.5, 1.5); u.vy = lerp(u.vy, dx * 60, 0.4); u.vp = 0; }
  // → what to draw this frame
  frame(W, cam, viewW, viewH, dt, t) {
    const out = [], p = W.player, vis = (x, y) => Math.abs(x - cam[0]) < viewW / 2 + 1 && Math.abs(y - cam[1]) < viewH / 2 + 1;
    const lying = (key, kind, x, y, bob, fade = 1) => {
      if (Math.hypot(x - p.x, y - p.y) < 45 || vis(x, y)) this.need(kind);
      if (!READY.has(kind) || !vis(x, y)) return;
      const P = this.one(key, kind), H = HOLD[kind];
      P.at = [x, y + 0.2 + Math.sin(t * 1.4 + bob) * 0.03, 0.2]; P.k = WORLD_K * fade; P.gain = kind === 'skein' ? 1.6 : 1; P.env = 0.12; P.over = false; P.own = false;
      P.lights = [{ x: x - 0.5, y: y + 0.9, z: 1.1, r: 3, i: 0.55, c: kind === 'skein' ? [1, 0.5, 0.42] : [1, 0.86, 0.66] }];
      P.R = euler(H.tip * 0.8, H.spin ? t * 0.5 + bob : Math.sin(t * 0.7 + bob) * 0.5, 0);
      out.push(P);
    };
    W.skeins.forEach((s, i) => { if (!s.taken) lying('s' + i, 'skein', s.x, s.y, s.bob); });
    W.secrets.forEach((s, i) => {
      if (s.taken || !s.open || W.hiddenAt(s.x, s.y + 0.2)) { if (!s.taken && Math.hypot(s.x - p.x, s.y - p.y) < 45) this.need(s.kind); return; }
      lying('k' + i, s.kind, s.x, s.y, s.bob, s.fade ?? 1);
    });
    const S = W.showcase, it = S && S.item, u = this.turn;
    if (!S) { u.on = false; return out; }
    this.need(S.kind);
    if (!u.on) { u.on = true; u.yaw = u.pitch = u.vy = u.vp = 0; u.t = 0; }
    u.t += dt;
    if (!u.held) { u.yaw += u.vy * dt; u.vy *= Math.exp(-dt * 1.8); }
    if (it && READY.has(S.kind)) {
      const P = this.one('show', S.kind), H = HOLD[S.kind], x = it.x, y = it.y, k = it.k;
      const away = clamp(Math.abs(u.yaw) + Math.abs(u.pitch), 0, 1), q = u.t;        // once it is turned by hand it stops swaying on its own
      const yaw = H.spin ? H.yaw + q * H.spin * (1 - away * 0.7) : Math.sin(q * 0.55) * H.sway * (1 - away);
      const pitch = H.tip + (H.nod ? Math.sin(q * 0.41 + 1) * H.nod * (1 - away) : 0) - (H.look ? (0.5 - 0.5 * Math.cos(q * 0.5)) * H.look * 1.6 * (1 - away) : 0);
      P.at = [x, y, 1.2]; P.k = k * lerp(1, H.z || 1, clamp((k - WORLD_K) / (SHOW_K - WORLD_K), 0, 1)); P.over = true; P.own = true; P.env = 1; P.gain = it.a * 1.4;
      P.R = mm(euler(clamp(pitch + u.pitch, -1.6, 1.6), 0, 0), euler(0, yaw + u.yaw, 0));
      const s = Math.max(0.4, k / SHOW_K);
      P.lights = [
        { x: x - 1.5 * s, y: y + 1.7 * s, z: 1.2 + 1.9 * s, r: 7, i: 2.3, c: [1.0, 0.87, 0.68] },            // the key: warm, high on the left
        { x: x + 1.9 * s, y: y + 0.8 * s, z: 1.2 - 1.1 * s, r: 7, i: 2.2, c: [0.62, 0.72, 1.0] },            // a cold rim from behind on the right
        { x: x + 0.7 * s, y: y - 1.9 * s, z: 1.2 + 1.2 * s, r: 6, i: 0.28, c: [1.0, 0.5, 0.38] },            // a little of the thread's red from below
      ];
      out.push(P);
    }
    return out;
  }
}
