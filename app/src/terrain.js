// World builder: rasterise level primitives → erode with noise → exact signed distance field (metres).
// sdf > 0 in air, < 0 in rock. Shared by physics (collision, rope, raycasts) and the GPU (engraving, shadows).
import { fbm, clamp } from './util.js';
import { WORLD, OPS, QUIET, LEVEL, surfaceY } from './level.js';

function shapeDist(s, x, y) {
  switch (s.s) {
    case 'ellipse': {
      // cheap ellipse distance (scaled circle), good enough for carving
      const nx = (x - s.cx) / s.rx, ny = (y - s.cy) / s.ry;
      const k = Math.hypot(nx, ny);
      return (k - 1) * Math.min(s.rx, s.ry);
    }
    case 'box': {
      const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
      const hx = (s.x1 - s.x0) / 2 - s.r, hy = (s.y1 - s.y0) / 2 - s.r;
      const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.r;
    }
    case 'tunnel': {
      let best = 1e9;
      const p = s.pts;
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, ay, ar] = p[i], [bx, by, br] = p[i + 1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
        const d = Math.hypot(x - ax - dx * t, y - ay - dy * t) - (ar + (br - ar) * t);
        if (d < best) best = d;
      }
      return best;
    }
    case 'poly': {
      // signed distance to a polygon (even-odd inside test)
      const p = s.pts;
      let d = 1e9, inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [ax, ay] = p[j], [bx, by] = p[i];
        const ex = bx - ax, ey = by - ay, wx = x - ax, wy = y - ay;
        const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1);
        d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
        if ((ay > y) !== (by > y) && x < ax + ((y - ay) * ex) / ey) inside = !inside;
      }
      return inside ? -d : d;
    }
  }
  return 1e9;
}

function bounds(s) {
  switch (s.s) {
    case 'ellipse': return [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry];
    case 'box': return [s.x0, s.y0, s.x1, s.y1];
    case 'tunnel': {
      let a = [1e9, 1e9, -1e9, -1e9];
      for (const [x, y, r] of s.pts) a = [Math.min(a[0], x - r), Math.min(a[1], y - r), Math.max(a[2], x + r), Math.max(a[3], y + r)];
      return a;
    }
    case 'poly': {
      let a = [1e9, 1e9, -1e9, -1e9];
      for (const [x, y] of s.pts) a = [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)];
      return a;
    }
  }
}

// 1D squared distance transform (Felzenszwalb & Huttenlocher)
function dt1(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}
// squared distance (px²) from each pixel to the nearest pixel where target(i) is true
function edt(W, H, isTarget) {
  const INF = 1e20, n = Math.max(W, H);
  const g = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = isTarget(i) ? 0 : INF;
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = g[y * W + x];
    dt1(f, H, d, v, z);
    for (let y = 0; y < H; y++) g[y * W + x] = d[y];
  }
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) f[x] = g[o + x];
    dt1(f, W, d, v, z);
    for (let x = 0; x < W; x++) g[o + x] = d[x];
  }
  return g;
}

function sdfFromMask(W, H, solid) {
  const toSolid = edt(W, H, (i) => solid[i] === 1);
  const toAir = edt(W, H, (i) => solid[i] === 0);
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = (Math.sqrt(toSolid[i]) - Math.sqrt(toAir[i])) / WORLD.ppm;
  return out;
}

export function buildTerrain() {
  const { x0, y0, w, h, ppm } = WORLD;
  const W = Math.round(w * ppm), H = Math.round(h * ppm);
  const top = y0 + h;
  const solid = new Uint8Array(W * H);
  const wx = (i) => x0 + (i + 0.5) / ppm, wy = (j) => top - (j + 0.5) / ppm;
  // base: rock under the surface line
  for (let j = 0; j < H; j++) {
    const y = wy(j);
    for (let i = 0; i < W; i++) solid[j * W + i] = y < surfaceY(wx(i)) ? 1 : 0;
  }
  for (const [op, s] of OPS) {
    const [bx0, by0, bx1, by1] = bounds(s);
    const i0 = clamp(Math.floor((bx0 - 1 - x0) * ppm), 0, W - 1), i1 = clamp(Math.ceil((bx1 + 1 - x0) * ppm), 0, W - 1);
    const j0 = clamp(Math.floor((top - by1 - 1) * ppm), 0, H - 1), j1 = clamp(Math.ceil((top - by0 + 1) * ppm), 0, H - 1);
    const val = op === 'carve' ? 0 : 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (shapeDist(s, wx(i), wy(j)) < 0) solid[j * W + i] = val;
  }
  // side and bottom walls stay rock, sky stays open
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if ((i < 2 || i >= W - 2) && wy(j) < 0) solid[j * W + i] = 1;
    if (j >= H - 2) solid[j * W + i] = 1;
  }
  // erosion: perturb the field with noise and re-threshold, then build the final SDF
  const d0 = sdfFromMask(W, H, solid);
  for (let j = 0; j < H; j++) {
    const y = wy(j);
    for (let i = 0; i < W; i++) {
      const x = wx(i), k = j * W + i;
      const d = d0[k];
      if (Math.abs(d) > 2.5) continue;
      // flatter tops (walkable) get less noise than walls and ceilings
      const n = (fbm(x * 0.32, y * 0.32, 4) - 0.5) * 1.25 + (fbm(x * 1.4 + 17, y * 1.4, 3) - 0.5) * 0.4;
      let amp = y > -2.5 && x > 8.5 && x < 20.5 ? 0.12 : y > 0.5 ? 0.5 : 1;   // the yard stays level
      for (const q of QUIET) if (x > q[0] && x < q[2] && y > q[1] && y < q[3]) { amp = Math.min(amp, 0.22); break; }
      solid[k] = d + n * amp < 0 ? 1 : 0;
    }
  }
  // take-off ledges: planed flat after the erosion, so no bump sits where a jump has to be made
  for (const [lx0, lx1, ly] of LEVEL) {
    for (let j = clamp(Math.floor((top - ly - 1.0) * ppm), 0, H - 1); j <= clamp(Math.ceil((top - ly + 0.6) * ppm), 0, H - 1); j++)
      for (let i = Math.floor((lx0 - x0) * ppm); i <= Math.ceil((lx1 - x0) * ppm); i++) if (wx(i) >= lx0 && wx(i) <= lx1) solid[j * W + i] = wy(j) < ly ? 1 : 0;
  }
  const sdf = sdfFromMask(W, H, solid);
  const T = new Terrain(W, H, sdf);
  T.solid = solid;
  return T;
}

export class Terrain {
  constructor(W, H, sdf) {
    this.W = W; this.H = H; this.sdf = sdf;
    this.ppm = WORLD.ppm; this.x0 = WORLD.x0; this.top = WORLD.y0 + WORLD.h;
  }
  // bilinear sample (metres)
  d(x, y) {
    const fx = (x - this.x0) * this.ppm - 0.5, fy = (this.top - y) * this.ppm - 0.5;
    const W = this.W, H = this.H;
    let i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    if (i < 0) return j < 1 ? 5 : -1; if (j < 0) return 5; if (i >= W - 1 || j >= H - 1) return -1;
    const s = this.sdf, k = j * W + i;
    const a = s[k], b = s[k + 1], c = s[k + W], e = s[k + W + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + e) * tx * ty;
  }
  grad(x, y) {
    const h = 0.12;
    const gx = this.d(x + h, y) - this.d(x - h, y), gy = this.d(x, y + h) - this.d(x, y - h);
    const l = Math.hypot(gx, gy) || 1;
    return [gx / l, gy / l];
  }
  // march from a toward b; returns t (0..1) of first contact with clearance r, or -1 if clear
  ray(ax, ay, bx, by, r = 0) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    if (L < 1e-6) return -1;
    let t = 0;
    for (let i = 0; i < 96 && t < L; i++) {
      const h = this.d(ax + dx * t / L, ay + dy * t / L) - r;
      if (h < 0.01) return t / L;
      t += Math.max(h, 0.02);
    }
    return -1;
  }
  // first ground surface below (x, y) within depth m, or null
  ground(x, y, depth = 8) {
    for (let k = 0; k < depth * 20; k++) {
      const yy = y - k * 0.05;
      if (this.d(x, yy) < 0) return yy + 0.05;
    }
    return null;
  }
  // Float16 copy for the GPU (r16float)
  halfData() { return toHalf(this.sdf); }
  // pixel window [i0, j0, i1, j1) of a world rect [x0, y0, x1, y1] grown by m metres, clamped to the grid
  _win(r, m) {
    const ppm = this.ppm;
    return [Math.max(0, Math.floor((r[0] - m - this.x0) * ppm)), Math.max(0, Math.floor((this.top - r[3] - m) * ppm)),
      Math.min(this.W, Math.ceil((r[2] + m - this.x0) * ppm)), Math.min(this.H, Math.ceil((this.top - r[1] + m) * ppm))];
  }
  // the field the renderer draws: like the real one, but with the hidden rooms still filled with rock
  _mask(i0, j0, i1, j1, hidden) {
    const w = i1 - i0, h = j1 - j0, m = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) m.set(this.solid.subarray((j + j0) * this.W + i0, (j + j0) * this.W + i1), j * w);
    for (const r of hidden) {
      const [a0, b0, a1, b1] = this._win(r, 0);
      for (let j = Math.max(b0, j0); j < Math.min(b1, j1); j++) for (let i = Math.max(a0, i0); i < Math.min(a1, i1); i++) m[(j - j0) * w + i - i0] = 1;
    }
    return m;
  }
  visualHalf(hidden) {
    if (!hidden.length) return this.halfData();
    return toHalf(sdfFromMask(this.W, this.H, this._mask(0, 0, this.W, this.H, hidden)));
  }
  // a hidden room was found: the drawn field around it before (still rock) and after (open), as float patches of the
  // same window, so the renderer can morph from one to the other instead of popping
  revealPair(rect, stillHidden) {
    const [i0, j0, i1, j1] = this._win(rect, 8), w = i1 - i0, h = j1 - j0;
    const fa = sdfFromMask(w, h, this._mask(i0, j0, i1, j1, [...stillHidden, rect]));
    const fb = sdfFromMask(w, h, this._mask(i0, j0, i1, j1, stillHidden));
    const [p0, q0, p1, q1] = this._win(rect, 2.5), pw = p1 - p0, ph = q1 - q0, a = new Float32Array(pw * ph), b = new Float32Array(pw * ph);
    for (let j = 0; j < ph; j++) {
      const o = (j + q0 - j0) * w + p0 - i0;
      a.set(fa.subarray(o, o + pw), j * pw); b.set(fb.subarray(o, o + pw), j * pw);
    }
    return { x: p0, y: q0, w: pw, h: ph, a, b };
  }
  half(arr) { return toHalf(arr); }
  // a hidden room was found: recompute the drawn field in a window around it (cheap) and hand back the patch
  revealPatch(rect, stillHidden) {
    const [i0, j0, i1, j1] = this._win(rect, 8);
    const w = i1 - i0, h = j1 - j0, f = sdfFromMask(w, h, this._mask(i0, j0, i1, j1, stillHidden));
    const [p0, q0, p1, q1] = this._win(rect, 2.5), pw = p1 - p0, ph = q1 - q0, out = new Float32Array(pw * ph);
    for (let j = 0; j < ph; j++) out.set(f.subarray((j + q0 - j0) * w + p0 - i0, (j + q0 - j0) * w + p1 - i0), j * pw);
    return { x: p0, y: q0, w: pw, h: ph, data: toHalf(out) };
  }
}

function toHalf(src) {
  {
    const n = src.length;
    if (typeof Float16Array !== 'undefined') { const a = new Float16Array(n); a.set(src); return a; }
    const out = new Uint16Array(n), f = new Float32Array(1), u = new Uint32Array(f.buffer);
    for (let i = 0; i < n; i++) {
      f[0] = src[i]; const x = u[0];
      const s = (x >>> 16) & 0x8000; let e = ((x >>> 23) & 0xff) - 127 + 15; const m = x & 0x7fffff;
      out[i] = e <= 0 ? s : e >= 31 ? s | 0x7c00 : s | (e << 10) | (m >>> 13);
    }
    return out;
  }
}
