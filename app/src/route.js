// Ways round rock for a thread: how deep a straight line runs into it, the shortest way through open air between
// two points (A* over the distance field, pulled taut), and a drawn line laid along the rock's face where it would cut in.
import { clamp } from './util.js';

// deepest the straight segment runs (min of the distance field along it; > 0 = clear air all the way)
export function depthAlong(T, ax, ay, bx, by, stop = -9) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  let md = T.d(bx, by), t = 0;
  for (let k = 0; k < 600 && t < L; k++) {
    const d = T.d(ax + dx * t / L, ay + dy * t / L);
    if (d < md) { md = d; if (md < stop) return md; }
    t += clamp(Math.abs(d) * 0.9, 0.05, 2);
  }
  return md;
}
export const clearLine = (T, ax, ay, bx, by, r = 0.01) => depthAlong(T, ax, ay, bx, by, r) >= r;

// drop every point of a path that a straight line can skip
export function pullTaut(T, pts, r = 0.01) {
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let k = pts.length - 1;
    while (k > i + 1 && !clearLine(T, pts[i][0], pts[i][1], pts[k][0], pts[k][1], r)) k--;
    out.push(pts[k]); i = k;
  }
  return out;
}

const C = 0.2, AIR = 0.1;
// the shortest way through air from a to b as a taut polyline [[x, y], ...] including both ends, or null
export function route(T, ax, ay, bx, by, margin = 4, maxCells = 60000) {
  const x0 = Math.min(ax, bx) - margin, y0 = Math.min(ay, by) - margin;
  const w = Math.ceil((Math.abs(bx - ax) + margin * 2) / C), h = Math.ceil((Math.abs(by - ay) + margin * 2) / C);
  if (w * h > maxCells) return null;
  const px = (i) => x0 + (i % w + 0.5) * C, py = (i) => y0 + (((i / w) | 0) + 0.5) * C;
  const air = new Int8Array(w * h).fill(-1);
  const free = (i) => { if (air[i] < 0) air[i] = T.d(px(i), py(i)) > AIR ? 1 : 0; return air[i]; };
  const snap = (x, y) => {
    const ci = Math.floor((x - x0) / C), cj = Math.floor((y - y0) / C);
    let best = -1, bd = 1e9;
    for (let r = 0; r <= 5 && best < 0; r++) for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= w || j >= h || Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
      const k = j * w + i; if (!free(k)) continue;
      const d = Math.hypot(px(k) - x, py(k) - y) + (depthAlong(T, x, y, px(k), py(k)) < -0.12 ? 50 : 0);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };
  const s = snap(ax, ay), e = snap(bx, by);
  if (s < 0 || e < 0) return null;
  const g = new Float32Array(w * h).fill(1e9), from = new Int32Array(w * h).fill(-1), done = new Uint8Array(w * h);
  const heap = [], key = new Float32Array(w * h);
  const push = (i, f) => {
    key[i] = f; heap.push(i);
    let c = heap.length - 1;
    while (c) { const p = (c - 1) >> 1; if (key[heap[p]] <= key[heap[c]]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; }
  };
  const pop = () => {
    const r = heap[0], l = heap.pop();
    if (heap.length) {
      heap[0] = l;
      for (let c = 0; ;) {
        let m = c; const a = 2 * c + 1, b = a + 1;
        if (a < heap.length && key[heap[a]] < key[heap[m]]) m = a;
        if (b < heap.length && key[heap[b]] < key[heap[m]]) m = b;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
      }
    }
    return r;
  };
  const H = (i) => Math.hypot(px(i) - px(e), py(i) - py(e));
  g[s] = 0; push(s, H(s));
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === e) break;
    const ix = i % w, iy = (i / w) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const nx = ix + di, ny = iy + dj;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = ny * w + nx;
      if (done[k] || !free(k)) continue;
      const ng = g[i] + C * (di && dj ? 1.4142 : 1);
      if (ng < g[k] - 1e-6) { g[k] = ng; from[k] = i; push(k, ng + H(k)); }
    }
  }
  if (!done[e]) return null;
  const pts = [[bx, by]];
  for (let i = e; i >= 0; i = from[i]) pts.push([px(i), py(i)]);
  pts.push([ax, ay]);
  pts.reverse();
  return pullTaut(T, pts, 0.03);
}

// points to draw between a and b so the line lies on the rock's face instead of cutting through it. Calls put(x, y).
// Shallow cuts are pushed straight out; a line that really passes through rock takes the way round it.
export function hug(T, ax, ay, bx, by, put, face = 0.05, allowRoute = true, margin = 3) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  if (L < 0.07) return;
  if (L < 0.6 && T.d((ax + bx) / 2, (ay + by) / 2) > face + L * 0.28) return;
  const md = depthAlong(T, ax, ay, bx, by);
  if (md > face - 0.01) return;
  if (md < -0.22 && allowRoute) {
    const R = route(T, ax, ay, bx, by, margin + L * 0.4, 200000);
    if (R && R.length > 2) {
      for (let i = 1; i < R.length; i++) {
        hug(T, R[i - 1][0], R[i - 1][1], R[i][0], R[i][1], put, face, false);
        if (i < R.length - 1) put(R[i][0], R[i][1]);
      }
      return;
    }
  }
  const n = Math.min(400, Math.ceil(L / 0.07));
  for (let k = 1; k < n; k++) {
    let x = ax + dx * k / n, y = ay + dy * k / n, d = T.d(x, y);
    if (d >= face) continue;
    for (let it = 0; it < 4 && d < face - 0.005; it++) { const [gx, gy] = T.grad(x, y); x += gx * (face - d); y += gy * (face - d); d = T.d(x, y); }
    put(x, y);
  }
}
