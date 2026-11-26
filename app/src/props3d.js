// The things she picks up (shapes from scripts/props3d, drawn flat and inked like everything else: the user wants 2-2.5D, not models): the keepsakes of the hidden rooms and the balls of red yarn. Drawn by
// the renderer's prop pass where they lie, and held up close, turning, when one is found (main.js startShow). Each model is
// fetched when she comes near the first one of its kind; until it is there the old flat drawing stands in.
import { clamp, lerp } from './util.js';
import { euler } from './figure.js';

export const READY = new Set();          // kinds whose model is loaded: props.js and draw.js leave those to this file
export const WORLD_K = 0.2, SHOW_K = 0.6;      // half the size of one, lying about and held up (m)

const mm = (A, B) => B.map((v) => [0, 1, 2].map((r) => A[0][r] * v[0] + A[1][r] * v[1] + A[2][r] * v[2]));
// how each is held up: like a thing cut out and turned a little in the fingers, never all the way round. tip and yaw are how it
// faces, sway and nod how far it rocks, z its size, blur how much of its surface is left out (what is printed on it stays sharp)
const HOLD = {
  spool: { tip: 0.62, sway: 0.2, nod: 0.05, blur: 0.4 }, button: { tip: 0.06, z: 0.92, sway: 0.26, nod: 0.08, blur: 0.6 }, seeds: { tip: 0.03, z: 1.08, sway: 0.2, nod: 0.05, blur: 0, flat: 0.7 },
  thimble: { tip: 0.24, z: 0.84, sway: 0.24, nod: 0.06, blur: 0.8 }, eye: { tip: 0.08, sway: 0.24, nod: 0.08, blur: 2.2 }, mitten: { tip: 0.06, sway: 0.2, nod: 0.05, blur: 1.5 },
  weight: { tip: 0.3, z: 0.86, sway: 0.24, nod: 0.06, blur: 0.8 }, tag: { tip: 0.03, z: 1.02, sway: 0.2, nod: 0.05, blur: 0, flat: 0.7 }, scissors: { tip: 0.02, z: 1.04, sway: 0.2, nod: 0.05, blur: 1 },
  pattern: { tip: 0.02, z: 1.12, sway: 0.16, nod: 0.04, blur: 0, flat: 0.7 }, shoe: { tip: 0.34, z: 1.14, yaw: 0.1, sway: 0.2, nod: 0.05, blur: 1.8 }, skein: { tip: 0.2, z: 0.92, sway: 0.22, nod: 0.06, blur: 2 },
};
const KINDS = Object.keys(HOLD);
const SHELVED = KINDS.filter((k) => k !== 'skein');
// where each keepsake stands on her shelf by the door
export function shelfSpot(kind) { const i = SHELVED.indexOf(kind); return [14.76 + (i % 6) * 0.258, 1.84 + (i < 6 ? 0.42 : 0) + 0.11]; }

async function mips(src) {
  const out = [src];
  for (let s = src.width >> 1; s >= 1; s >>= 1) out.push(await createImageBitmap(out[out.length - 1], { resizeWidth: s, resizeHeight: s, resizeQuality: 'medium', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }));
  return out;
}
async function load(name) {
  const base = 'assets/props/' + name, r = await fetch(base + '.bin');
  if (!r.ok) throw new Error('no prop ' + name);
  // (packed by scripts/props3d/slim.py)
  let buf = await r.arrayBuffer();
  const b2 = new Uint8Array(buf, 0, 2);
  if (b2[0] === 0x1f && b2[1] === 0x8b) buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const hl = new DataView(buf).getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
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
  drag(dx, dy) { const u = this.turn; u.yaw = clamp(u.yaw + dx, -0.75, 0.75); u.pitch = clamp(u.pitch + dy, -0.5, 0.5); }
  // → what to draw this frame
  frame(W, cam, viewW, viewH, dt, t) {
    const out = [], p = W.player, vis = (x, y) => Math.abs(x - cam[0]) < viewW / 2 + 1 && Math.abs(y - cam[1]) < viewH / 2 + 1;
    const lying = (key, kind, x, y, bob, fade = 1) => {
      if (Math.hypot(x - p.x, y - p.y) < 45 || vis(x, y)) this.need(kind);
      if (!READY.has(kind) || !vis(x, y)) return;
      const P = this.one(key, kind), H = HOLD[kind];
      P.at = [x, y + 0.2 + Math.sin(t * 1.4 + bob) * 0.03, 0.2]; P.k = WORLD_K * fade; P.gain = 1; P.env = 0.06; P.blur = H.blur + 1; P.flat = H.flat; P.over = false; P.own = false;
      P.lights = [{ x: x - 0.5, y: y + 0.9, z: 1.1, r: 3, i: 0.3, c: [1, 0.86, 0.66] }];
      P.R = euler(H.tip * 0.8, (H.yaw || 0) + Math.sin(t * 0.7 + bob) * 0.22, 0);
      out.push(P);
    };
    // her shelf, beside the door: what has been brought home, small
    const SC = W.showcase, board = SC && SC.shelf;
    if ((W.found || []).length && vis(15.4, 2.2)) SHELVED.forEach((kind, i) => {
      if (!W.found.includes(kind)) return;
      this.need(kind);
      if (!READY.has(kind)) return;
      if (board && SC.mode === 'item' && SC.kind === kind) return;          // taken down: it is in her hands, not on the shelf
      const P = this.one('shelf' + i, kind), H = HOLD[kind], [x, y] = shelfSpot(kind);
      // pointed at on the shelf, close: it lifts a little and catches the light
      const on = board && SC.mode === 'board' && SC.hover >= 0 && SC.shelf[SC.hover].kind === kind;
      const u = (P.hov = lerp(P.hov || 0, on ? 1 : 0, clamp(dt * 10, 0, 1)));
      P.at = [x, y + 0.025 * u, 0.2]; P.k = 0.108 * (1 + 0.12 * u); P.gain = 1 + 0.35 * u; P.env = 0.1 + 0.2 * u; P.over = !!board; P.own = false;      // (on the shelf, close: lit while the wall behind goes quiet) P.blur = H.blur + 1 - 0.6 * u; P.flat = H.flat;
      P.lights = u > 0.02 ? [{ x: x - 0.2, y: y + 0.35, z: 0.6, r: 0.9, i: 0.5 * u, c: [1, 0.86, 0.66] }] : [];
      P.R = euler(H.tip * 0.6, (H.yaw || 0) + Math.sin(i * 2.1) * 0.2 + Math.sin(t * 1.6) * 0.18 * u, 0);
      out.push(P);
    });
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
    if (!u.held) { u.yaw *= Math.exp(-dt * 1.6); u.pitch *= Math.exp(-dt * 1.6); }        // let go, it turns back
    if (it && READY.has(S.kind)) {
      const P = this.one('show', S.kind), H = HOLD[S.kind], x = it.x, y = it.y, k = it.k;
      const away = clamp(Math.abs(u.yaw) + Math.abs(u.pitch), 0, 1), q = u.t;        // once it is turned by hand it stops swaying on its own
      const yaw = (H.yaw || 0) + Math.sin(q * 0.7) * H.sway * (1 - away);
      const pitch = H.tip + Math.sin(q * 0.5 + 1) * H.nod * (1 - away);
      P.at = [x, y, 1.2]; P.k = k * lerp(1, H.z || 1, clamp((k - WORLD_K) / (SHOW_K - WORLD_K), 0, 1)); P.over = true; P.own = true; P.env = 1; P.gain = it.a * 0.95; P.blur = H.blur; P.flat = H.flat; P.flat = H.flat;
      P.R = mm(euler(clamp(pitch + u.pitch, -1.6, 1.6), 0, 0), euler(0, yaw + u.yaw, 0));
      P.lights = [];
      out.push(P);
    }
    return out;
  }
}
