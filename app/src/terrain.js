// World builder: level primitives as a continuous field → erode with noise → wear the corners → signed distance field (metres).
// sdf > 0 in air, < 0 in rock. Shared by physics (collision, rope, raycasts) and the GPU (engraving, shadows).
// The edge is never a yes/no grid: every stage keeps where inside a cell the rock ends, and distance is measured to that line
// (`redistance`), so a gentle slope has no staircase in it. The GPU gets a second field beside it (`grain`): the same distance,
// smoothed the deeper it goes, which the engraved lines follow so they bend where two faces meet instead of breaking.
import { fbm, clamp } from './util.js';
import { WORLD, OPS, QUIET, LEVEL, surfaceY } from './level.js';

function shapeDist(s, x, y) {
  switch (s.s) {
    case 'ellipse': {
      // ellipse distance to first order (exact on the line itself), never steeper than 1
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

// Signed distance (metres) to the zero line of a field (positive = air), exact to a fraction of a cell. The line is the one
// marching squares draws through the field; a distance transform finds each sample's nearest crossed cell and remembers which
// it was, and the distance is then measured to the pieces of line in and around that cell. Beyond `limit` cells: roughly.
function redistance(W, H, f, limit = 1e9) {
  const INF = 1e20, n = Math.max(W, H), g = new Float32Array(W * H).fill(INF);
  const head = new Int32Array(W * H).fill(-1), S = [];
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    const k = j * W + i, a = f[k], b = f[k + 1], c = f[k + W], e = f[k + W + 1];
    const m = (a < 0 ? 1 : 0) | (b < 0 ? 2 : 0) | (c < 0 ? 4 : 0) | (e < 0 ? 8 : 0);
    if (m === 0 || m === 15) continue;
    const P = [];
    if ((a < 0) !== (b < 0)) P.push(i + a / (a - b), j);
    if ((b < 0) !== (e < 0)) P.push(i + 1, j + b / (b - e));
    if ((c < 0) !== (e < 0)) P.push(i + c / (c - e), j + 1);
    if ((a < 0) !== (c < 0)) P.push(i, j + a / (a - c));
    // two pieces in one cell: joined so that the middle of the cell is on its own side
    if (P.length === 8 && (a + b + c + e < 0) === (a < 0)) { const q0 = P[0], q1 = P[1]; P.copyWithin(0, 2); P[6] = q0; P[7] = q1; }
    for (let q = 0; q + 3 < P.length; q += 4) { S.push(P[q], P[q + 1], P[q + 2], P[q + 3], head[k]); head[k] = S.length / 5 - 1; }
    g[k] = 0;
  }
  const src = new Int32Array(W * H), sg = Float32Array.from(S);
  const fv = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), at = new Int32Array(n), sv = new Int32Array(n);
  // 1D squared distance transform (Felzenszwalb & Huttenlocher) with where it came from
  const pass = (len) => {
    let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (let q = 1; q < len; q++) {
      let s = ((fv[q] + q * q) - (fv[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((fv[q] + q * q) - (fv[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + fv[v[k]]; at[q] = v[k]; }
  };
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) fv[y] = g[y * W + x];
    pass(H);
    for (let y = 0; y < H; y++) { g[y * W + x] = d[y]; src[y * W + x] = at[y] * W + x; }
  }
  const out = new Float32Array(W * H), far = limit * limit, inv = 1 / WORLD.ppm;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) { fv[x] = g[o + x]; sv[x] = src[o + x]; }
    pass(W);
    for (let x = 0; x < W; x++) {
      const k = o + x, sgn = f[k] < 0 ? -inv : inv;
      if (d[x] > 1e18) { out[k] = sgn * 400; continue; }
      if (d[x] > far) { out[k] = sgn * Math.sqrt(d[x]); continue; }
      const s = sv[at[x]], si = s % W, sj = (s / W) | 0;
      let best = 1e18;
      for (let cj = Math.max(0, sj - 1); cj <= sj + 1 && cj < H; cj++) for (let ci = Math.max(0, si - 1); ci <= si + 1 && ci < W; ci++) {
        for (let q = head[cj * W + ci]; q >= 0; q = S[q * 5 + 4]) {
          const b = q * 5, ax = sg[b], ay = sg[b + 1], ex = sg[b + 2] - ax, ey = sg[b + 3] - ay, px = x - ax, py = y - ay;
          let t = (px * ex + py * ey) / (ex * ex + ey * ey || 1e-12); t = t < 0 ? 0 : t > 1 ? 1 : t;
          const rx = px - ex * t, ry = py - ey * t, q2 = rx * rx + ry * ry;
          if (q2 < best) best = q2;
        }
      }
      out[k] = sgn * Math.sqrt(best);
    }
  }
  return out;
}

// a few passes of a small blur over the cells near the edge (the only ones it can move): corners and crumbs wear down
function wear(W, H, f, band, passes) {
  let a = f, b = Float32Array.from(f);
  for (let p = 0; p < passes; p++) {
    for (let j = 1; j < H - 1; j++) for (let i = 1, k = j * W + 1; i < W - 1; i++, k++) {
      if (a[k] > band || a[k] < -band) { b[k] = a[k]; continue; }
      b[k] = a[k] * 0.25 + (a[k - 1] + a[k + 1] + a[k - W] + a[k + W]) * 0.125 + (a[k - W - 1] + a[k - W + 1] + a[k + W - 1] + a[k + W + 1]) * 0.0625;
    }
    const t = a; a = b; b = t;
  }
  return a;
}

// three box blurs (nearly a gaussian), radius in cells
function blur(W, H, src, r) {
  let a = src, b = new Float32Array(W * H);
  const n = 2 * r + 1, inv = 1 / n;
  for (let p = 0; p < 3; p++) {
    for (let j = 0; j < H; j++) {
      const o = j * W;
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[o + clamp(i, 0, W - 1)];
      for (let i = 0; i < W; i++) { b[o + i] = s * inv; s += a[o + Math.min(W - 1, i + r + 1)] - a[o + Math.max(0, i - r)]; }
    }
    const c = a === src ? new Float32Array(W * H) : a, s = new Float32Array(W);
    for (let j = -r; j <= r; j++) { const o = clamp(j, 0, H - 1) * W; for (let i = 0; i < W; i++) s[i] += b[o + i]; }
    for (let j = 0; j < H; j++) {
      const o = j * W, q = Math.min(H - 1, j + r + 1) * W, u = Math.max(0, j - r) * W;
      for (let i = 0; i < W; i++) { c[o + i] = s[i] * inv; s[i] += b[q + i] - b[u + i]; }
    }
    a = c;
  }
  return a;
}
// what the engraved lines follow: the distance itself at the face, a smoothed one further in
function grainOf(W, H, sdf) {
  const near = blur(W, H, sdf, 3), deep = blur(W, H, sdf, 8), out = new Float32Array(W * H);
  for (let k = 0; k < out.length; k++) {
    const d = -sdf[k];
    if (d < 0.1) { out[k] = sdf[k]; continue; }
    let u = clamp((d - 0.1) / 0.9, 0, 1), v = clamp((d - 0.9) / 2.2, 0, 1);
    u *= u * (3 - 2 * u); v *= v * (3 - 2 * v);
    const a = sdf[k] + (near[k] - sdf[k]) * u;
    out[k] = a + (deep[k] - a) * v;
  }
  return out;
}

export function buildTerrain() {
  const { x0, y0, w, h, ppm } = WORLD;
  const W = Math.round(w * ppm), H = Math.round(h * ppm);
  const top = y0 + h;
  const f = new Float32Array(W * H);
  const wx = (i) => x0 + (i + 0.5) / ppm, wy = (j) => top - (j + 0.5) / ppm;
  // base: rock under the surface line
  const sy = Array.from({ length: W }, (_, i) => surfaceY(wx(i)));
  for (let j = 0; j < H; j++) {
    const y = wy(j);
    for (let i = 0; i < W; i++) f[j * W + i] = clamp(y - sy[i], -4, 4);
  }
  // carve and fill, in order, each shape with its own distance (so its edge keeps its place inside the cells)
  for (const [op, s] of OPS) {
    const [bx0, by0, bx1, by1] = bounds(s);
    const i0 = clamp(Math.floor((bx0 - 1 - x0) * ppm), 0, W - 1), i1 = clamp(Math.ceil((bx1 + 1 - x0) * ppm), 0, W - 1);
    const j0 = clamp(Math.floor((top - by1 - 1) * ppm), 0, H - 1), j1 = clamp(Math.ceil((top - by0 + 1) * ppm), 0, H - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * W + i, d = shapeDist(s, wx(i), wy(j));
      if (op === 'carve') { if (-d > f[k]) f[k] = Math.min(-d, 4); } else if (d < f[k]) f[k] = Math.max(d, -4);
    }
  }
  // side and bottom walls stay rock, sky stays open
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if ((i < 2 || i >= W - 2) && wy(j) < 0) f[j * W + i] = -1;
    if (j >= H - 2) f[j * W + i] = -1;
  }
  // erosion: the distance to the edge, moved by noise
  const d0 = redistance(W, H, f, 3 * ppm);
  for (let j = 0; j < H; j++) {
    const y = wy(j);
    for (let i = 0; i < W; i++) {
      const x = wx(i), k = j * W + i, d = d0[k];
      f[k] = d;
      if (Math.abs(d) > 2.5) continue;
      // flatter tops (walkable) get less noise than walls and ceilings
      const n = (fbm(x * 0.32, y * 0.32, 4) - 0.5) * 1.25 + (fbm(x * 1.4 + 17, y * 1.4, 3) - 0.5) * 0.4;
      let amp = y > -2.5 && x > 8.5 && x < 20.5 ? 0.12 : y > 0.5 ? 0.5 : 1;   // the yard stays level
      for (const q of QUIET) if (x > q[0] && x < q[2] && y > q[1] && y < q[3]) { amp = Math.min(amp, 0.22); break; }
      f[k] = d + n * amp;
    }
  }
  // take-off ledges: planed after the erosion, so no bump sits where a jump has to be made. Not ruled flat: a slow rise and dip
  // of a few centimetres, as a floor worn by feet has. `wear` rounds the lips with everything else.
  for (const [lx0, lx1, ly] of LEVEL) {
    for (let j = clamp(Math.floor((top - ly - 1.0) * ppm), 0, H - 1); j <= clamp(Math.ceil((top - ly + 0.6) * ppm), 0, H - 1); j++)
      for (let i = Math.floor((lx0 - x0) * ppm); i <= Math.ceil((lx1 - x0) * ppm); i++) {
        const x = wx(i);
        if (x >= lx0 && x <= lx1) f[j * W + i] = wy(j) - ly - (fbm(x * 0.5 + ly, 3.7, 3) - 0.5) * 0.08;
      }
  }
  const T = new Terrain(W, H, redistance(W, H, wear(W, H, f, 0.8, 3)));
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
  // what the GPU gets: two half floats a cell, distance and grain
  pair(sdf, grain) { const a = new Float32Array(sdf.length * 2); for (let i = 0; i < sdf.length; i++) { a[2 * i] = sdf[i]; a[2 * i + 1] = grain[i]; } return a; }
  halfData() { return toHalf(this.pair(this.sdf, grainOf(this.W, this.H, this.sdf))); }
  // pixel window [i0, j0, i1, j1) of a world rect [x0, y0, x1, y1] grown by m metres, clamped to the grid
  _win(r, m) {
    const ppm = this.ppm;
    return [Math.max(0, Math.floor((r[0] - m - this.x0) * ppm)), Math.max(0, Math.floor((this.top - r[3] - m) * ppm)),
      Math.min(this.W, Math.ceil((r[2] + m - this.x0) * ppm)), Math.min(this.H, Math.ceil((this.top - r[1] + m) * ppm))];
  }
  // the field the renderer draws: like the real one, but with the hidden rooms still filled with rock (a plug with a broken face)
  _drawn(i0, j0, i1, j1, hidden) {
    const w = i1 - i0, h = j1 - j0, m = new Float32Array(w * h), ppm = this.ppm;
    for (let j = 0; j < h; j++) m.set(this.sdf.subarray((j + j0) * this.W + i0, (j + j0) * this.W + i1), j * w);
    let any = false;
    for (const r of hidden) {
      const [a0, b0, a1, b1] = this._win(r, 1);
      for (let j = Math.max(b0, j0); j < Math.min(b1, j1); j++) for (let i = Math.max(a0, i0); i < Math.min(a1, i1); i++) {
        const x = this.x0 + (i + 0.5) / ppm, y = this.top - (j + 0.5) / ppm, k = (j - j0) * w + i - i0;
        const d = Math.max(r[0] - x, x - r[2], r[1] - y, y - r[3]) + (fbm(x * 1.1, y * 1.1, 3) - 0.5) * 0.3 + 0.06;
        if (d < m[k]) { m[k] = d; any = true; }
      }
    }
    return any ? redistance(w, h, m) : m;
  }
  visualHalf(hidden) {
    const f = this._drawn(0, 0, this.W, this.H, hidden);
    return toHalf(this.pair(f, grainOf(this.W, this.H, f)));
  }
  // a hidden room was found: the drawn field around it before (still rock) and after (open), as float patches of the
  // same window, so the renderer can morph from one to the other instead of popping
  revealPair(rect, stillHidden) {
    const [i0, j0, i1, j1] = this._win(rect, 8), w = i1 - i0, h = j1 - j0;
    const fa = this._drawn(i0, j0, i1, j1, [...stillHidden, rect]), fb = this._drawn(i0, j0, i1, j1, stillHidden);
    const ga = grainOf(w, h, fa), gb = grainOf(w, h, fb);
    const [p0, q0, p1, q1] = this._win(rect, 2.5), pw = p1 - p0, ph = q1 - q0;
    const cut = (f) => { const a = new Float32Array(pw * ph); for (let j = 0; j < ph; j++) { const o = (j + q0 - j0) * w + p0 - i0; a.set(f.subarray(o, o + pw), j * pw); } return a; };
    return { x: p0, y: q0, w: pw, h: ph, a: cut(fa), b: cut(fb), ga: cut(ga), gb: cut(gb) };
  }
  half(arr) { return toHalf(arr); }
}

function toHalf(src) {
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
