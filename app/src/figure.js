// Real figures: a skinned 3D model posed by hand here (no baked clips) and drawn by the renderer's figure pass, then engraved
// like everything else. The model comes from scripts/figures/export.py; nothing in this file knows which model it is, only
// the joint names. Axes: x right, y up, z toward the viewer; the model faces +z.
import { clamp, lerp, smooth } from './util.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
// 3x3 matrices as three columns
const mul = (A, v) => [A[0][0] * v[0] + A[1][0] * v[1] + A[2][0] * v[2], A[0][1] * v[0] + A[1][1] * v[1] + A[2][1] * v[2], A[0][2] * v[0] + A[1][2] * v[1] + A[2][2] * v[2]];
const mm = (A, B) => [mul(A, B[0]), mul(A, B[1]), mul(A, B[2])];
const tr = (A) => [[A[0][0], A[1][0], A[2][0]], [A[0][1], A[1][1], A[2][1]], [A[0][2], A[1][2], A[2][2]]];
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export function euler(x, y, z) {                // Y · X · Z
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  return mm([[c, 0, -d], [0, 1, 0], [d, 0, c]], mm([[1, 0, 0], [0, a, b], [0, -b, a]], [[e, f, 0], [-f, e, 0], [0, 0, 1]]));
}
// orthonormal frame with first axis along `a` and second as near `b` as it can be
function frame(a, b) {
  const x = norm(a);
  let y = add(b, x, -dot(b, x));
  if (len(y) < 1e-4) { y = Math.abs(x[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]; y = add(y, x, -dot(y, x)); }
  y = norm(y);
  return [x, y, cross(x, y)];
}
const turn = (a0, b0, a1, b1) => mm(frame(a1, b1), tr(frame(a0, b0)));
// R after a stretch by s along the rest direction d
const stretched = (R, d, s) => mm(R, [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + (s - 1) * d[i] * d[j])));
export const V3 = { add, sub, norm, mix3, dot, len };

export async function loadModel(name) {
  const base = 'assets/figures/' + name;
  const r = await fetch(base + '.bin');
  if (!r.ok) throw new Error('no figure ' + name);
  const buf = await r.arrayBuffer(), hl = new DataView(buf).getUint32(0, true);
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  const vb = new Uint8Array(buf, 4 + hl, h.nv * h.stride), ib = new Uint8Array(buf, 4 + hl + h.nv * h.stride, h.ni * 4);
  const img = async (u) => createImageBitmap(await (await fetch(u)).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  return { ...h, vb, ib, tex: await img(base + '.jpg'), nrm: await img(base + '_n.jpg') };
}

export class Figure {
  constructor(model) {
    this.m = model; this.n = model.names.length;
    this.i = Object.fromEntries(model.names.map((n, k) => [n, k]));
    this.mats = new Float32Array(this.n * 16);
    this.k = 1; this.at = [0, 0, 0]; this.R = I3; this.hollow = 0; this.gain = 1; this.D = 16; this.lights = []; this.focus = null;
    this.reset();
  }
  reset() { this.rot = {}; this.lock = {}; this.scl = {}; this.off = {}; this.P = []; this.Q = []; this.S = []; this.K = []; return this; }
  rest(j) { return this.m.pos[this.i[j]]; }
  p(j) { return this.P[this.i[j]]; }
  // forward kinematics: joints keep whatever `lock` says, the rest follow their parents
  fk() {
    const m = this.m;
    for (let j = 0; j < this.n; j++) {
      const nm = m.names[j], par = m.parents[j], L = this.lock[nm], pk = par < 0 ? this.k : this.K[par];
      this.K[j] = pk * (this.scl[nm] ?? 1);
      if (L) { this.P[j] = L.p; this.Q[j] = L.R; this.S[j] = L.S || L.R; if (L.k) this.K[j] = L.k; continue; }
      const Rp = par < 0 ? this.R : this.Q[par], r = this.rot[nm], of = this.off[nm] || [0, 0, 0];
      if (par < 0) this.P[j] = this.at;
      else { const o = sub(m.pos[j], m.pos[par]); this.P[j] = add(this.P[par], mul(Rp, add(o, of)), pk); }
      this.Q[j] = r ? mm(Rp, euler(r[0], r[1], r[2])) : Rp; this.S[j] = this.Q[j];
    }
    return this;
  }
  skin() {
    const M = this.mats;
    for (let j = 0; j < this.n; j++) {
      const S = this.S[j], k = this.K[j], o = j * 16, v = mul(S, this.m.pos[j]);
      for (let c = 0; c < 3; c++) { for (let r = 0; r < 3; r++) M[o + c * 4 + r] = S[c][r] * k; M[o + c * 4 + 3] = 0; }
      for (let r = 0; r < 3; r++) M[o + 12 + r] = this.P[j][r] - v[r] * k;
      M[o + 15] = 1;
    }
    return this;
  }
  // two-bone limb a-b-c to a point; farther than it reaches, it stretches. `pole`: where the elbow/knee points; `pr`: that at rest
  limb(a, b, c, to, pole, pr, max = 9) {
    const A = this.p(a), ra = this.rest(a), rb = this.rest(b), rc = this.rest(c), k = this.K[this.i[a]];
    let l1 = len(sub(rb, ra)) * k, l2 = len(sub(rc, rb)) * k, v = sub(to, A), d = len(v) || 1e-3;
    let s = Math.max(1, d / ((l1 + l2) * 0.985));
    if (s > max) { to = add(A, v, (l1 + l2) * 0.985 * max / d); s = max; v = sub(to, A); d = len(v); }
    l1 *= s; l2 *= s;
    const u = norm(v), ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
    const w = frame(u, pole)[1], B = add(add(A, u, l1 * ca), w, l1 * sa);
    const d1 = norm(sub(rb, ra)), d2 = norm(sub(rc, rb)), R1 = turn(d1, pr, sub(B, A), w), R2 = turn(d2, pr, sub(to, B), w);
    this.lock[a] = { p: A, R: R1, S: stretched(R1, d1, s) };
    this.lock[b] = { p: B, R: R2, S: stretched(R2, d2, s) };
    return to;
  }
  arm(side, to, pole, fingers, palm, curl = 0.3, size = 1, spread = 0) {
    const sg = side === 'L' ? 1 : -1, at = this.limb('arm' + side, 'fore' + side, 'hand' + side, to, pole, [0, 0, -1]);
    this.lock['hand' + side] = { p: at, R: turn([sg, 0, 0], [0, -1, 0], fingers, palm) };
    this.scl['hand' + side] = size;
    ['index', 'middle', 'ring', 'pinky'].forEach((f, q) => {
      for (let j = 1; j <= 3; j++) this.rot[f + j + side] = [0, j === 1 ? sg * spread * (1.5 - q) * 0.22 : 0, -sg * curl * (j === 1 ? 0.8 : 1.0) * (1 + q * 0.06)];
    });
    this.rot['thumb1' + side] = [0, sg * curl * 0.5, 0]; this.rot['thumb2' + side] = [0, sg * curl * 0.4, 0];
  }
  leg(side, to, pole, toe = null) {
    const at = this.limb('thigh' + side, 'leg' + side, 'foot' + side, to, pole, [0, 0, 1]);
    if (toe) this.lock['foot' + side] = { p: at, R: turn([0, 0, 1], [0, 1, 0], toe[0], toe[1]) };
  }
  // the head at a place, facing a way; the neck joints along a curve from the chest to it (`bend`: two control points)
  headTo(at, face, up, size = 1, bend = null, thick = 1) {
    const N = this.m.neck, b = this.p('neck'), k0 = this.K[this.i.sp3], R = turn([0, 0, 1], [0, 1, 0], face, up);
    this.lock.head = { p: at, R, k: k0 * size };
    const out = mul(this.Q[this.i.sp3], [0, 1, 0]), Lg = len(sub(at, b));
    const c1 = bend ? bend[0] : add(b, out, Lg * 0.4), c2 = bend ? bend[1] : add(at, mul(R, [0, -1, 0]), Lg * 0.4);
    const pts = [];
    for (let q = 0; q < N; q++) {
      const t = q / (N - 1), s = 1 - t;
      pts.push([0, 1, 2].map((a) => s * s * s * b[a] + 3 * s * s * t * c1[a] + 3 * s * t * t * c2[a] + t * t * t * at[a]));
    }
    const f0 = mul(this.Q[this.i.sp3], [0, 0, 1]), f1 = mul(R, [0, 0, 1]), seg = len(sub(this.rest('head'), this.rest('neck'))) / (N - 1);
    let prev = f0;
    for (let q = 0; q < N; q++) {
      const i0 = Math.max(0, q - 1), i1 = Math.min(N - 1, q + 1), d = sub(pts[i1], pts[i0]), t = q / (N - 1);
      // carried along the curve (no twisting), and eased round to the head's own front
      const f = norm(mix3(prev, f1, t * 0.25 + 0.02)), Rn = turn([0, 1, 0], [0, 0, 1], d, f);
      prev = Rn[2];
      const th = lerp(1, size, smooth(0.15, 1, t)) * lerp(1, thick, Math.sin(Math.PI * t));
      this.lock['n' + q] = { p: pts[q], R: Rn, S: stretched(Rn, [0, 1, 0], len(d) / (seg * (i1 - i0) * k0 * th)), k: k0 * th };
    }
  }
  jaw(o) { this.rot.jaw = [o * 0.5, 0, 0]; this.off.jaw = [0, -0.05 * Math.max(0, o - 0.5), 0]; }
}

// ── the poses ────────────────────────────────────────────────────────────
// kneeling at (x, floor y), turned `yaw` (0 = to the viewer, a quarter turn = to the right), holding the end of the thread out in
// both hands. o: { x, y, k, yaw, lean, mouth, head: {at, face, up, size, bend, thick} | null }
export function poseKneel(F, o, t) {
  F.reset(); F.k = o.k;
  const k = o.k, fwd = [Math.sin(o.yaw), 0, Math.cos(o.yaw)], side = [Math.cos(o.yaw), 0, -Math.sin(o.yaw)];
  F.at = [o.x, o.y + 0.3 * k, 0]; F.R = euler(0, o.yaw, 0);
  const b = Math.sin(t * 0.9) * 0.012;
  F.rot.root = [0.05, 0, 0]; F.rot.sp1 = [0.24 + o.lean * 0.14 + b, 0, 0]; F.rot.sp2 = [0.2 + b, 0, 0]; F.rot.sp3 = [0.12, 0, 0]; F.rot.neck = [0.35, 0, 0];
  F.fk();
  const g = (f, s, u) => add(add([o.x, o.y + u * k, 0], fwd, f * k), side, s * k);
  for (const [S, sg] of [['L', 1], ['R', -1]]) {
    F.leg(S, g(-0.2, sg * 0.1, 0.1), add(fwd, [0, -0.25, 0]), [add([0, -1, 0], fwd, 0.15), fwd]);
    const q = Math.sin(t * 7.3 + sg) * 0.004;
    F.arm(S, g(0.5 + o.lean * 0.12, sg * 0.05, 0.52 + q), add(side.map((v) => v * sg * 0.8), [0, -1, 0]), add(fwd, [0, 0.12, 0]), side.map((v) => -v * sg), 0.75);
  }
  F.fk();
  if (o.head) F.headTo(o.head.at, o.head.face, o.head.up, o.head.size, o.head.bend, o.head.thick);
  else {
    // the head where a head would be, only a little farther along its neck than it should go
    const h0 = F.p('head'), up = norm(sub(h0, F.p('neck'))), at = add(add(h0, fwd, o.lean * 0.42 * k), up, o.lean * 0.1 * k);
    F.headTo(at, norm(add(add(fwd, [0, -0.55 + o.lean * 0.5, 0]), [0, 0, 1], 0.22 + o.lean * 0.5)), [0.2 * o.lean, 1, 0], 1 + o.lean * 0.06);
  }
  F.jaw(o.mouth || 0);
  F.fk();
  F.focus = F.p('sp3');
  return F.skin();
}

// going along a path hand over hand. path(s) is a point, out(s) the way off the surface it lies on. Each hand and foot holds one
// place while the body passes it, then goes on to its next. c keeps what it needs between frames.
// o: { s, k, path, out, lift, step, spread, neck, look, head, mouth, twitch, view, quick, jump, grip }
export function poseClimb(F, c, o, dt, t) {
  const { k, s, path, out } = o, G = (o.step ?? 1.0) * k, spread = o.spread ?? 0.05, hump = Math.sin(s * Math.PI * 2 / G) * 0.06;
  // (the body goes by a smoothed way: it does not follow every step of the rock)
  const way = (a) => { let m = [0, 0, 0]; for (let q = -3; q <= 3; q++) m = add(m, path(a + q * 0.12 * k), 1 / 7); return m; };
  const chest = add(way(s), out(s), (o.lift - hump) * k), pel = add(way(s - 0.56 * k), out(s - 0.56 * k), (o.lift * (o.rump ?? 1.15) + hump) * k);
  if (!c.chest || o.jump) { c.chest = chest; c.pel = pel; c.limbs = {}; c.out = out(s); c.u = norm(sub(chest, pel)); }
  const q = 1 - Math.exp(-dt * 12);
  c.chest = mix3(c.chest, chest, q); c.pel = mix3(c.pel, pel, q); c.out = norm(mix3(c.out, out(s), 1 - Math.exp(-dt * 7)));
  c.u = norm(mix3(c.u, norm(sub(c.chest, c.pel)), q));
  const u = c.u, n = norm(add(c.out, u, -dot(c.out, u))), down = n.map((v) => -v), wob = Math.sin(s * Math.PI / G) * 0.22;
  F.reset(); F.k = k;
  const fr = frame(u, add(down, o.view || [0, 0, 0])), side = cross(fr[0], fr[1]);
  F.R = mm([side, fr[0], fr[1]], euler(0, wob * 0.6, wob * 0.5)); F.at = c.pel;
  F.rot.sp1 = [0.25, 0, wob * 0.5]; F.rot.sp2 = [0.1, -wob * 0.4, wob * 0.3]; F.rot.sp3 = [-0.3, -wob * 0.4, 0];
  F.fk();
  const hold = (key, i, ahead, sp) => {
    const cell = Math.floor((s + ahead * k - i * G) / (2 * G)), at = cell * 2 * G + i * G;
    const tgt = add(add(path(at), side, sp * k), out(at), 0.03 * k);
    let h = c.limbs[key];
    if (!h) h = c.limbs[key] = { cell, p: tgt, from: tgt, t: 1 };
    if (h.cell !== cell) { h.cell = cell; h.from = h.p; h.t = 0; if (o.grip) o.grip(tgt, key); }
    h.t = Math.min(1, h.t + dt * (o.quick ?? 6.5));
    const e = smooth(0, 1, h.t);
    h.p = add(mix3(h.from, tgt, e), n, Math.sin(e * Math.PI) * 0.35 * k);
    return [h.p, e];
  };
  for (const [S, sg, i] of [['L', 1, 0], ['R', -1, 1]]) {
    const [h, e] = hold('h' + S, i, 1.35, sg * spread);
    F.arm(S, h, add(side.map((v) => v * sg * 1.1), n, 1.5), norm(add(u, side, sg * -0.15)), down, e < 1 ? 0.25 : 0.95, 1.15, e < 1 ? 0.6 : 0);
    const [f, e2] = hold('f' + S, 1 - i, -0.05, sg * spread * 1.4);
    F.leg(S, f, add(add(side.map((v) => v * sg * 1.1), n, 1.2), u, 0.5), [norm(add(u, down, 0.4 + (1 - e2))), n]);
  }
  F.fk();
  // the head goes ahead of it on its neck, looking along the way, and sometimes at you
  const look = o.look ?? 0, reach = (o.neck ?? 0.5) * k;
  let hd = add(add(add(F.p('neck'), norm(add(u, [0, 1, 0], o.rear ?? 0.35)), reach), n, 0.1 * k + reach * 0.16), side, Math.sin(t * 2.3) * 0.12 * k);
  if (o.clear) hd = o.clear(hd, 0.42 * k * (o.head ?? 1) * 0.5);
  if (c.hd && !o.jump) hd = mix3(c.hd, hd, 1 - Math.exp(-dt * 14)); c.hd = hd;
  const face = norm(mix3(norm(add(u, down, 0.1)), [0.12 * Math.sin(t), -0.15, 1], look));
  const hup = norm(mix3(n, add(u, n, 0.2), look));
  F.headTo(hd, face, add(hup, side, (o.twitch || 0) * Math.sin(t * 43) * 0.25), o.head ?? 1.1, null, 0.85);
  F.jaw(o.mouth || 0);
  F.fk();
  F.focus = F.p('sp3');
  return F.skin();
}

// a head by itself on a neck out of the dark
export function poseReach(F, o) {
  F.reset(); F.k = o.k; F.at = o.from; F.R = euler(o.pitch || 0, o.yaw || 0, 0);
  F.rot.armL = [0, 0, -1.3]; F.rot.armR = [0, 0, 1.3];
  F.fk();
  F.headTo(o.at, o.face, o.up, o.size ?? 1, o.bend || null, o.thick ?? 0.9);
  F.jaw(o.mouth || 0);
  F.fk();
  F.focus = o.at;
  return F.skin();
}
