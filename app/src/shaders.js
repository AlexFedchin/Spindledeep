// WGSL for Spindledeep. Three passes:
//  LIGHT   (compute, 1/3 res): thread + lamps + moon, soft shadows marched through the world SDF.
//  ENGRAVE (fullscreen): rock, backdrops, ink, sprites → one tone per pixel → intaglio line work.
//  THREAD  (instanced segments): the red thread and the knitter's grey one, drawn crisp on top: two plies, fibres, stray hairs.

const COMMON = /* wgsl */ `
struct U {
  res: vec2f, cam: vec2f,
  viewH: f32, time: f32, boil: f32, fade: f32,
  worldMin: vec2f, worldSize: vec2f,
  ambient: vec4f,          // rgb, moon
  ink: vec4f, paper: vec4f,
  hatch: f32, nLights: f32, flash: f32, nBg: f32,
  inkPool: vec4f,          // x0, x1, surface y, enabled
  lightRes: vec2f, hush: f32, red: f32,
  bgRect: array<vec4f, 4>, // cx, cy, w, h
  bgPar: array<vec4f, 4>,  // parallax, layer, alpha, style
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var sdfTex: texture_2d<f32>;
@group(0) @binding(2) var linSamp: sampler;

fn worldAt(uv: vec2f) -> vec2f {
  let aspect = u.res.x / u.res.y;
  return u.cam + vec2f((uv.x - 0.5) * u.viewH * aspect, (0.5 - uv.y) * u.viewH);
}
fn sdfAt(p: vec2f) -> f32 {
  let uv = vec2f((p.x - u.worldMin.x) / u.worldSize.x, (u.worldMin.y + u.worldSize.y - p.y) / u.worldSize.y);
  return textureSampleLevel(sdfTex, linSamp, uv, 0.0).r;
}
// both fields with a cubic filter (four bilinear taps): no facets along the edge, however close the view
fn fieldAt(p: vec2f) -> vec2f {
  let dim = vec2f(textureDimensions(sdfTex));
  let t = vec2f((p.x - u.worldMin.x) / u.worldSize.x, (u.worldMin.y + u.worldSize.y - p.y) / u.worldSize.y) * dim - 0.5;
  let i = floor(t); let f = t - i;
  let w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0;
  let w1 = (4.0 - 6.0 * f * f + 3.0 * f * f * f) / 6.0;
  let w3 = f * f * f / 6.0;
  let w2 = 1.0 - w0 - w1 - w3;
  let g0 = w0 + w1; let g1 = w2 + w3;
  // (sample k sits at (k + 0.5) / dim)
  let a = (i - 0.5 + w1 / g0) / dim; let b = (i + 1.5 + w3 / g1) / dim;
  let s00 = textureSampleLevel(sdfTex, linSamp, a, 0.0).rg; let s10 = textureSampleLevel(sdfTex, linSamp, vec2f(b.x, a.y), 0.0).rg;
  let s01 = textureSampleLevel(sdfTex, linSamp, vec2f(a.x, b.y), 0.0).rg; let s11 = textureSampleLevel(sdfTex, linSamp, b, 0.0).rg;
  return mix(mix(s11, s01, g0.x), mix(s10, s00, g0.x), g0.y);
}
fn grainAt(p: vec2f) -> f32 {
  let uv = vec2f((p.x - u.worldMin.x) / u.worldSize.x, (u.worldMin.y + u.worldSize.y - p.y) / u.worldSize.y);
  return textureSampleLevel(sdfTex, linSamp, uv, 0.0).g;
}
fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = hash21(i); let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0)); let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
fn fbm(p: vec2f) -> f32 {
  var s = 0.0; var a = 0.5; var q = p;
  for (var i = 0; i < 4; i++) { s += a * vnoise(q); q = q * 2.03 + vec2f(1.7, 9.2); a *= 0.5; }
  return s;
}
`;

export const LIGHT_WGSL = COMMON + /* wgsl */ `
struct Light { pos: vec2f, radius: f32, intensity: f32, color: vec3f, soft: f32 };
@group(0) @binding(3) var<storage, read> lights: array<Light>;
@group(0) @binding(4) var outTex: texture_storage_2d<rgba16float, write>;

fn shadow(a: vec2f, b: vec2f, k: f32) -> f32 {
  let dv = b - a; let L = length(dv);
  if (L < 0.25) { return 1.0; }
  let dir = dv / L;
  var t = 0.12; var res = 1.0;
  for (var i = 0; i < 18; i++) {
    if (t >= L - 0.12) { break; }
    let h = sdfAt(a + dir * t);
    res = min(res, k * h / t);
    if (res < 0.02) { return 0.0; }
    t += clamp(h, 0.08, 1.6);
  }
  return clamp(res, 0.0, 1.0);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dims = vec2u(u.lightRes);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv = (vec2f(gid.xy) + 0.5) / u.lightRes;
  var p = worldAt(uv);
  let d = sdfAt(p);
  var atten = 1.0;
  if (d < 0.0) {
    // inside rock: light the surface point above it and fade with depth (lit rims, black hearts)
    // (the way out comes from the smoothed field, so two pixels side by side never look at faces far apart)
    let e = 0.1 + min(-d, 1.0) * 0.25;
    let g = normalize(vec2f(grainAt(p + vec2f(e, 0.0)) - grainAt(p - vec2f(e, 0.0)), grainAt(p + vec2f(0.0, e)) - grainAt(p - vec2f(0.0, e))) + 1e-5);
    p = p + g * (-d + 0.1);
    // if that stopped short of the face, go the rest of the way
    let d2 = sdfAt(p);
    if (d2 < 0.06) { p = p + g * min(0.06 - d2, 0.8); }
    atten = exp(d * 2.6);
  }
  var col = vec3f(0.0);
  let n = u32(u.nLights);
  for (var i = 0u; i < n; i++) {
    let L = lights[i];
    let dl = distance(p, L.pos);
    if (dl > L.radius) { continue; }
    let x = dl / L.radius;
    let fall = (1.0 - x * x) * (1.0 - x * x) / (1.0 + dl * dl * 0.35);
    var sh = 1.0;
    if (L.soft > 0.0) { sh = shadow(p, L.pos, L.soft); }
    col += L.color * (L.intensity * fall * sh);
  }
  // moonlight from above, marched up through the rock: a beam down the Throat
  let moon = u.ambient.w;
  if (moon > 0.0 && p.y > -70.0) {
    let md = normalize(vec2f(0.18, 1.0));
    var t = 0.15; var res = 1.0;
    for (var i = 0; i < 22; i++) {
      let q = p + md * t;
      if (q.y > 8.0) { break; }
      let h = sdfAt(q);
      res = min(res, 4.0 * h / t);
      if (res < 0.02) { res = 0.0; break; }
      t += clamp(h, 0.2, 3.0);
    }
    let depthFade = smoothstep(-64.0, 2.0, p.y);
    col += vec3f(0.62, 0.68, 0.8) * moon * clamp(res, 0.0, 1.0) * mix(0.25, 0.85, depthFade) * (0.6 + 0.4 * depthFade);
  }
  // ambient with a little SDF occlusion so crevices stay deep
  let ao = clamp(0.35 + sdfAt(p) * 0.4, 0.2, 1.0);
  col += u.ambient.rgb * ao;
  textureStore(outTex, gid.xy, vec4f(col * atten, 1.0));
}
`;

export const ENGRAVE_WGSL = COMMON + /* wgsl */ `
@group(0) @binding(3) var lightTex: texture_2d<f32>;
@group(0) @binding(4) var bgTex: texture_2d_array<f32>;
@group(0) @binding(5) var spriteTex: texture_2d<f32>;
@group(0) @binding(6) var emitTex: texture_2d<f32>;
@group(0) @binding(7) var figTex: texture_2d<f32>;
@group(0) @binding(8) var figNrm: texture_2d<f32>;

struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: VO;
  o.pos = vec4f(p[i], 0.0, 1.0);
  o.uv = vec2f((p[i].x + 1.0) * 0.5, (1.0 - p[i].y) * 0.5);
  return o;
}

// one family of engraved lines. paper fraction f in [0,1]; returns paper coverage (1 = paper).
fn lineField(phase: f32, f: f32, aa: f32) -> f32 {
  let t = abs(fract(phase) - 0.5) * 2.0;     // 0 on a line's spine, 1 between lines
  let inkW = 1.0 - clamp(f, 0.0, 1.0);
  return smoothstep(inkW - aa, inkW + aa, t);
}
fn dirPhase(px: vec2f, ang: f32, spacing: f32) -> f32 {
  return dot(px, vec2f(-sin(ang), cos(ang))) / spacing;
}

// engrave value v (0 dark .. 1 light) with a main family (phase1) that cross-hatches in the darks
fn engrave(v: f32, phase1: f32, phase2: f32, aa: f32, cross: f32) -> f32 {
  let f = clamp(v, 0.0, 1.0);
  let single = lineField(phase1, f, aa);
  let fc = sqrt(f);
  let crossed = lineField(phase1, fc, aa) * lineField(phase2, fc, aa);
  let k = smoothstep(0.66, 0.42, f) * smoothstep(0.1, 0.26, f) * cross;
  return mix(single, crossed, k);
}

// ── what each place is cut from ──────────────────────────────────────────
// 0 frozen earth (the Brink) · 1 split stone (the Throat) · 2 earth and roots (the Gardens) · 3 columns (the Gallery) ·
// 4 wet stone (the Mere) · 5 shale (the Hall) · 6 packed soil (the Hush) · 7 hewn rock (the Treadles) · 8 felt (the Loom)
fn kindAt(p: vec2f) -> vec3f {                 // this kind, the next one down, how far over
  let y = p.y + (fbm(p * 0.13) - 0.5) * 9.0;
  if (y > -103.0 && y < -30.0 && p.x > 44.5 && y > -66.0) { return vec3f(1.0, 1.0, 0.0); }
  if (y > -286.0 && y < -258.0 && p.x < 33.0) { return vec3f(5.0, 5.0, 0.0); }
  let b = array<f32, 8>(-5.0, -46.0, -103.0, -150.0, -208.0, -262.0, -340.0, -430.0);
  for (var k = 0; k < 8; k++) {
    if (y > b[k] - 2.5) { return vec3f(f32(k), f32(k + 1), smoothstep(b[k] + 2.5, b[k] - 2.5, y)); }
  }
  return vec3f(8.0, 8.0, 0.0);
}
// nearest and second nearest cell point: (F1, F2 - F1, the cell's own number)
fn cells(p: vec2f) -> vec3f {
  let i = floor(p); let f = fract(p);
  var a = 9.0; var b = 9.0; var id = 0.0;
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let o = vec2f(f32(x), f32(y)); let h = hash21(i + o);
    let q = o + vec2f(h, fract(h * 57.3)) * 0.8 + 0.1 - f; let d = dot(q, q);
    if (d < a) { b = a; a = d; id = h; } else if (d < b) { b = d; }
  } }
  return vec3f(sqrt(a), sqrt(b) - sqrt(a), id);
}
// how rough a line this stone takes
fn roughOf(kind: f32) -> f32 {
  let r = array<f32, 9>(0.75, 1.15, 1.15, 1.0, 0.7, 1.0, 1.0, 1.2, 0.8);
  return r[u32(clamp(kind + 0.5, 0.0, 8.0))];
}
// how the face is broken (metres, small: the thread and her feet go by the smooth one)
fn chip(kind: f32, p: vec2f) -> f32 {
  if (kind < 0.5) { return (fbm(p * 2.2) - 0.5) * 0.12; }
  if (kind < 1.5) { let c = cells(p * vec2f(1.1, 1.5)); return (c.z - 0.5) * 0.07 * smoothstep(0.0, 0.2, c.y) + (vnoise(p * 7.0) - 0.5) * 0.05; }
  if (kind < 2.5) { return (fbm(p * 2.4) - 0.5) * 0.17; }
  if (kind < 3.5) { return (vnoise(vec2f(p.x * 2.6, p.y * 0.7)) - 0.5) * 0.10 + (vnoise(p * 9.0) - 0.5) * 0.03; }
  if (kind < 4.5) { return (vnoise(p * 1.3) - 0.5) * 0.09; }
  if (kind < 5.5) { return (vnoise(vec2f(p.x * 0.9, (p.y - p.x * 0.12) * 5.5)) - 0.5) * 0.15; }
  if (kind < 6.5) { return (vnoise(p * 4.5) - 0.5) * 0.09 + (vnoise(p * 13.0) - 0.5) * 0.04; }
  if (kind < 7.5) { return (abs(fract(p.x * 0.9 + p.y * 0.5 + vnoise(p * 0.7)) - 0.5) - 0.25) * 0.10 + (vnoise(p * 8.0) - 0.5) * 0.04; }
  return (vnoise(p * 10.0 + vec2f(vnoise(p * 3.0) * 4.0, 0.0)) - 0.5) * 0.09 + (vnoise(p * 24.0) - 0.5) * 0.04;
}
// what is in it: x = ink (cracks, joints, holes), y = light (roots, fibres, pebbles), z = how the tone is shifted, w = how the lines are bent
fn body(kind: f32, p: vec2f, depth: f32, lw: f32) -> vec4f {
  if (kind < 0.5) {
    let c = cells(p * 2.3 + (vec2f(vnoise(p * 4.0), vnoise(p * 4.0 + 9.0)) - 0.5) * 0.6); let peb = smoothstep(0.30, 0.24, c.x) * step(0.86, c.z);
    return vec4f(smoothstep(0.05, 0.0, abs(c.x - 0.27)) * step(0.86, c.z) * 0.6, peb * 0.4, (fbm(p * vec2f(0.5, 2.0)) - 0.5) * 0.3, fbm(vec2f(p.x * 0.4, p.y * 2.2)) * 1.6);
  }
  if (kind < 1.5) {
    let w = p + (vnoise(p * 0.9) - 0.5) * 0.7;
    let c = cells(w * vec2f(0.75, 1.05));
    let fine = cells(w * vec2f(2.1, 2.6) + 7.0);
    let cr = smoothstep(lw * 1.1, lw * 0.25, c.y * 0.85) + smoothstep(lw * 0.9, 0.0, fine.y * 0.4) * 0.55 * step(0.6, c.z);
    return vec4f(clamp(cr, 0.0, 1.0), 0.0, (c.z - 0.5) * 0.55, c.z * 4.0 + dot(w, vec2f(cos(c.z * 6.0), sin(c.z * 6.0))) * 0.9);
  }
  if (kind < 2.5) {
    // roots run down and outward, one thick family and one thin; pebbles between
    let q = vec2f(p.x * 0.42 + (fbm(p * 0.3) - 0.5) * 2.6, p.y * 0.12 + (vnoise(p * 0.3) - 0.5) * 0.6);
    let a1 = (vnoise(q * 2.0) - 0.5) / 2.0; let a2 = (vnoise(q * vec2f(4.4, 3.0) + 13.0) - 0.5) / 4.4;
    let r = abs(a1) * 2.2; let r2 = abs(a2) * 2.2;
    let k = smoothstep(0.024, 0.016, r); let k2 = smoothstep(0.013, 0.008, r2) * 0.85;
    let edge = smoothstep(0.036, 0.027, r) * (1.0 - k) + smoothstep(0.020, 0.014, r2) * (1.0 - k2) * 0.5;
    let c = cells(p * 2.9 + (vec2f(vnoise(p * 5.0), vnoise(p * 5.0 + 9.0)) - 0.5) * 0.5); let peb = smoothstep(0.26, 0.2, c.x) * step(0.94, c.z) * (1.0 - k);
    let grow = smoothstep(3.2, 0.4, depth);
    return vec4f(clamp(edge * grow + smoothstep(0.05, 0.0, abs(c.x - 0.25)) * step(0.94, c.z) * 0.8, 0.0, 1.0), clamp((k + k2) * grow * 0.9 + peb * 0.4, 0.0, 1.0), -0.05, (fbm(p * 0.45) - 0.5) * 2.2);
  }
  if (kind < 3.5) {
    // columns of all widths, leaning a little, some broken across
    let x = p.x + (vnoise(vec2f(p.x * 0.35, p.y * 0.12)) - 0.5) * 1.6 + (vnoise(p * 1.7) - 0.5) * 0.10;
    let i = floor(x / 0.85); let f = fract(x / 0.85);
    let j0 = hash21(vec2f(i, 3.0)) * 0.66 - 0.33; let j1 = hash21(vec2f(i + 1.0, 3.0)) * 0.66 - 0.33;
    let left = select(i - 1.0, i, f > j0 + 0.0); 
    let e = min(abs(f - j0), abs(1.0 + j1 - f)) * 0.85;
    let id = hash21(vec2f(left, 7.0));
    let round = clamp(e * 2.6, 0.0, 1.0);
    let yj = p.y / (1.1 + id * 1.6) + id * 7.0; let j = min(fract(yj), 1.0 - fract(yj)) * (1.1 + id * 1.6) + (vnoise(p * 5.0) - 0.4) * 0.08;
    let faint = smoothstep(0.25, 0.6, vnoise(vec2f(left * 3.1, p.y * 0.35)));
    return vec4f(clamp(smoothstep(lw, lw * 0.25, e) * (0.35 + 0.65 * faint) + smoothstep(lw * 0.8, 0.0, j) * 0.7 * step(0.45, id), 0.0, 1.0), 0.0, (round - 0.5) * 0.4 + (id - 0.5) * 0.3, round * 0.9 + (fbm(p * 0.4) - 0.5) * 1.2);
  }
  if (kind < 4.5) {
    let wetRun = smoothstep(0.62, 0.8, vnoise(vec2f(p.x * 2.4 + (vnoise(p * 0.8) - 0.5), p.y * 0.22)));
    let band = fbm(vec2f(p.x * 0.18, p.y * 0.9));
    let sheen = smoothstep(0.05, 0.09, depth) * smoothstep(0.2, 0.12, depth) * smoothstep(0.35, 0.6, vnoise(p * 1.1));
    let flow = smoothstep(0.1, 0.03, abs(fract(band * 9.0) - 0.5)) * 0.75;
    return vec4f(flow * smoothstep(0.1, 0.4, depth), clamp(wetRun * smoothstep(1.2, 0.1, depth) + sheen, 0.0, 1.0) * 0.85, (band - 0.5) * 0.5, (band - 0.5) * 2.2);
  }
  if (kind < 5.5) {
    let y = p.y - p.x * 0.12 + (fbm(p * vec2f(0.25, 0.6)) - 0.5) * 1.1;
    let l = y * 2.1; let id = hash21(vec2f(floor(l), 9.0)); let e = min(fract(l), 1.0 - fract(l)) / 2.1;
    let gap = step(0.3, vnoise(vec2f(p.x * 0.7 + id * 20.0, floor(l))));
    return vec4f(smoothstep(lw, lw * 0.2, e) * gap, 0.0, (id - 0.5) * 0.5, l * 0.6 + id * 2.0);
  }
  if (kind < 6.5) {
    let c = cells(p * 1.7 + (vec2f(vnoise(p * 3.6), vnoise(p * 3.6 + 9.0)) - 0.5) * 0.55); let hole = step(0.9, c.z); let stone = step(0.3, c.z) * (1.0 - hole);
    let rim = smoothstep(0.05, 0.0, abs(c.x - 0.22)) * stone;
    let dots = smoothstep(0.5, 0.72, vnoise(p * 14.0)) * smoothstep(0.3, 0.6, vnoise(p * 1.3 + 5.0));
    return vec4f(clamp(rim * 0.8 + smoothstep(0.2, 0.12, c.x) * hole + dots * 0.5, 0.0, 1.0), smoothstep(0.22, 0.17, c.x) * stone * 0.45, (vnoise(p * 1.1) - 0.5) * 0.35, (fbm(p * 0.5) - 0.5) * 2.0);
  }
  if (kind < 7.5) {
    let c = cells(p * vec2f(0.9, 1.1)); let an = 0.5 + (c.z - 0.5) * 1.5;
    let t = dot(p, vec2f(-sin(an), cos(an))) * 5.2; let along = dot(p, vec2f(cos(an), sin(an)));
    let cut = smoothstep(0.22, 0.05, abs(fract(t) - 0.5)) * smoothstep(0.34, 0.5, vnoise(vec2f(along * 1.3, floor(t) * 3.7)));
    return vec4f(cut * smoothstep(0.0, 0.2, c.y), 0.0, (c.z - 0.5) * 0.6, c.z * 4.0);
  }
  let w = p + (vec2f(vnoise(p * 1.4), vnoise(p * 1.4 + 31.0)) - 0.5) * 1.3;
  let f1 = smoothstep(0.1, 0.02, abs(vnoise(w * vec2f(1.3, 6.5)) - 0.5)); let f2 = smoothstep(0.1, 0.02, abs(vnoise(w * vec2f(6.5, 1.3) + 17.0) - 0.5));
  let wisp = smoothstep(0.35, 0.7, vnoise(p * 0.8));
  return vec4f(f2 * 0.85 * (1.0 - wisp * 0.5), f1 * 0.7 * wisp, (wisp - 0.5) * 0.3, (fbm(w * 0.5) - 0.5) * 3.0);
}

fn lum(c: vec3f) -> f32 { return dot(c, vec3f(0.3, 0.52, 0.18)); }
fn expose(v: f32) -> f32 { return 1.0 - exp(-max(v, 0.0) * 3.0); }

@fragment fn fs(i: VO) -> @location(0) vec4f {
  let uv = i.uv;
  let px = i.pos.xy;
  let p = worldAt(uv);
  let ppm = u.res.y / u.viewH;
  let sp = u.hatch;                      // line spacing in px
  let aa = 1.1 / sp;
  let boil = u.boil;
  // hand-drawn wobble: slow warp + a gentle 5 fps boil
  let wob = (vnoise(px * 0.012 + vec2f(boil * 3.1, boil * 1.7)) - 0.5) * 0.3 + (vnoise(px * 0.05 + boil * 7.0) - 0.5) * 0.05;
  // the backdrops drift slowly and continuously instead of boiling: far things should rest the eye
  let wobBg = (vnoise(px * 0.006 + vec2f(u.time * 0.05, u.time * 0.03)) - 0.5) * 0.35;

  let light = textureSampleLevel(lightTex, linSamp, uv, 0.0).rgb;
  // softened light for the backdrops (they are far behind the play plane)
  let o = 3.0 / u.lightRes;
  let lightSoft = (textureSampleLevel(lightTex, linSamp, uv + vec2f(o.x, 0.0), 0.0).rgb + textureSampleLevel(lightTex, linSamp, uv - vec2f(o.x, 0.0), 0.0).rgb
    + textureSampleLevel(lightTex, linSamp, uv + vec2f(0.0, o.y), 0.0).rgb + textureSampleLevel(lightTex, linSamp, uv - vec2f(0.0, o.y), 0.0).rgb) * 0.25;

  // ── rock ──────────────────────────────────────────────────────────────
  let fld = fieldAt(p);
  let dRaw = fld.x;
  let sc = textureSampleLevel(spriteTex, linSamp, uv, 0.0);
  // things buried in the rock (buried.js) come on the sprite layer too, told apart by being blue
  let bury = smoothstep(0.1, 0.25, sc.b - sc.r);
  // the face of the rock, broken the way this place's rock breaks
  var kd = vec3f(0.0); var detail = 0.0;
  if (dRaw < 0.3) {
    kd = kindAt(p);
    if (dRaw > -0.5) {
      detail = chip(kd.x, p);
      if (kd.z > 0.0) { detail = mix(detail, chip(kd.y, p), kd.z); }
      detail *= smoothstep(-0.5, -0.2, dRaw);
    }
  }
  let d = dRaw + detail;

  var paperMask = 0.0;    // 1 = paper shows, 0 = ink
  var bgDim = 0.0;
  var tint = vec3f(1.0);
  var value = 0.0;

  if (d < 0.0) {
    let depthIn = -d;
    // light in the rock spreads: the further in, the wider it is taken, so no shadow of a bump is cut sharp across the ground
    var lr = light;
    if (depthIn > 0.08) {
      let r = min(depthIn * 0.75, 0.8) * ppm / u.res;
      for (var k = 0; k < 8; k++) { let an = f32(k) * 0.7854 + 0.39; let q = vec2f(cos(an), sin(an)) * r * select(0.5, 1.0, (k & 1) == 0); lr += textureSampleLevel(lightTex, linSamp, uv + q, 0.0).rgb; }
      lr /= 9.0;
    }
    let lw = max(0.045, 1.6 / ppm);
    var bd = body(kd.x, p, depthIn, lw);
    if (kd.z > 0.0) { bd = mix(bd, body(kd.y, p, depthIn, lw), kd.z); }
    // contour engraving: lines run along the rock face (the smoothed one, further in), bent by what the rock is made of
    let tone = clamp(0.66 + bd.z, 0.25, 1.05) * exp(-depthIn * 0.5);
    // the rim: a breath of the place's own light on every edge, so a cave has a shape beyond the thread's glow
    let rim = lum(u.ambient.rgb) * (1.5 * exp(-depthIn * 5.5) + 0.75 * exp(-depthIn * 1.1));
    value = tone * lum(lr) * 1.6 + rim;
    let inner = fld.y + detail * smoothstep(0.7, 0.0, depthIn);
    // a hand with a burin on stone: the lines waver and catch, crowd and spread, swell and thin, and now and then break off
    let rg = mix(roughOf(kd.x), roughOf(kd.y), kd.z);
    let grit = (fbm(p * vec2f(1.7, 2.2)) - 0.5) * 2.6 + (vnoise(p * 6.5) - 0.5) * 0.62 + (vnoise(p * 18.0) - 0.5) * 0.16;
    value *= 1.0 + rg * ((vnoise(p * vec2f(4.2, 5.6) + 3.0) - 0.5) * 0.5 + (vnoise(p * 13.0) - 0.5) * 0.2);
    let ph1 = (inner * ppm) / (sp * 1.05) + wob + bd.w + grit * rg;
    let ph2 = dirPhase(px, 1.05, sp * 1.1) + wob * 0.6;
    paperMask = engrave(expose(value), ph1, ph2, aa, 1.0);
    // the middle of a ledge, where the contours have nothing to follow: the lines run level there instead
    if (depthIn > 0.12) {
      let gh = 0.2;
      let gv = vec2f(grainAt(p + vec2f(gh, 0.0)) - grainAt(p - vec2f(gh, 0.0)), grainAt(p + vec2f(0.0, gh)) - grainAt(p - vec2f(0.0, gh))) / (2.0 * gh);
      let level = smoothstep(0.62, 0.25, length(gv)) * smoothstep(0.12, 0.3, depthIn);
      if (level > 0.0) {
        let phF = (p.y * ppm) / (sp * 1.05) + wob + bd.w + grit * rg;
        paperMask = mix(paperMask, engrave(expose(value), phF, ph2, aa, 1.0), level);
      }
    }
    paperMask *= 1.0 - 0.6 * rg * smoothstep(0.76, 0.88, vnoise(vec2f(p.x * 5.0 + floor(ph1) * 7.7, p.y * 5.0))) * smoothstep(0.03, 0.2, depthIn);
    // cracks and holes are cut as ink; roots, pebbles and fibres stand light
    let seen = smoothstep(0.01, 0.12, expose(value));
    paperMask *= smoothstep(0.002, 0.04, expose(value));          // the heart of the rock is black
    paperMask = mix(paperMask, max(paperMask, min(1.0, expose(value) * 1.35 + 0.05)), bd.y * seen);
    paperMask *= 1.0 - bd.x * 0.9 * smoothstep(0.02, 0.14, depthIn);
    // buried things: cut into the rock in finer lines of their own, lit and fading with depth exactly as the rock is
    if (bury * sc.a > 0.004) {
      let vb = sc.r * 1.95 * exp(-depthIn * 0.5) * lum(lr) * 1.6;
      let phB = dirPhase(px, 0.6, sp * 0.62) + wob * 0.3;
      let phB2 = dirPhase(px, -0.6, sp * 0.62) + wob * 0.3;
      paperMask = mix(paperMask, engrave(expose(vb), phB, phB2, 1.1 / (sp * 0.62), 1.0), bury * sc.a * smoothstep(0.1, 0.25, depthIn) * 0.9);
    }
    // the very face of the rock: a crisp inked edge
    paperMask *= smoothstep(0.6, 1.8, abs(d) * ppm);
    tint = mix(vec3f(0.92, 0.96, 1.08), lr / max(lum(lr), 1e-3), clamp(lum(lr) * 30.0, 0.0, 1.0));
  } else {
    // ── backdrops (engraved paintings behind the play plane) ──────────
    var bgTone = 0.0; var bgLight = 0.0;
    let spB = sp * 1.3;
    // the lines hang in the cave behind her (they drift with it as she goes), and sag and swell like drawn ones
    let back = u.cam * 0.42 + (p - u.cam);
    let bend = (fbm(back * 0.06 + vec2f(u.time * 0.005, 0.0)) - 0.5) * 17.0 + (vnoise(back * 0.45) - 0.5) * 0.9;
    let drift = u.cam.y * 0.42 * (u.res.y / 17.0) / spB;
    var ph1 = dirPhase(px, 0.0, spB) - drift + wobBg + bend;
    var ph2 = dirPhase(px, 0.85, spB * 1.05) + wobBg + bend * 0.6;
    let nb = i32(u.nBg);
    var cover = 0.0;
    for (var k = 0; k < 4; k++) {
      if (k >= nb) { break; }
      let r = u.bgRect[k]; let pr = u.bgPar[k];
      let c = r.xy;
      // parallax: pr.x = how firmly the painting is fixed to the world (0 = to the screen)
      let qf = c + (u.cam - c) * pr.x + (p - u.cam);
      let qn = c + (u.cam - c) * min(1.0, pr.x * 1.45) + (p - u.cam) * 1.0;
      let tuv = (qf - c) / r.zw + 0.5;
      let nuv = (qn - c) / r.zw + 0.5;
      // (a very wide window sees past a painting's sides: it goes on a little, mirrored, and fades out)
      let edge = smoothstep(-0.12, 0.10, tuv.x) * smoothstep(1.12, 0.90, tuv.x) * smoothstep(0.0, 0.14, tuv.y) * smoothstep(1.0, 0.86, tuv.y);
      if (edge <= 0.0) { continue; }
      let mx = select(select(tuv.x, 2.0 - tuv.x, tuv.x > 1.0), -tuv.x, tuv.x < 0.0);
      let s = textureSampleLevel(bgTex, linSamp, vec2f(mx, 1.0 - tuv.y), i32(pr.y), 0.0);
      let sn = textureSampleLevel(bgTex, linSamp, vec2f(clamp(nuv.x, 0.0, 1.0), 1.0 - clamp(nuv.y, 0.0, 1.0)), i32(pr.y), 0.0);
      // far tone and the near layer (alpha matte) blend; depth tells how far behind
      let farT = s.r * 0.55;
      let nearT = sn.g * 0.8;
      let t = mix(farT, nearT, sn.b * smoothstep(0.0, 0.1, nuv.x) * smoothstep(1.0, 0.9, nuv.x));
      let a = edge * pr.z;
      bgTone = mix(bgTone, t, a);
      cover = max(cover, a);
      // lines follow the painting's brightness: relief
      ph1 += s.r * 1.1 * a;
      ph2 += sn.g * 0.7 * a;
    }
    // further caves: two flats of rock behind each other, slower the further off, with a thin haze drifting between them
    let under = smoothstep(-3.0, -12.0, p.y);
    if (under > 0.0) {
      let qa = u.cam * 0.30 + (p - u.cam) * 0.8; let qb = u.cam * 0.55 + (p - u.cam) * 0.92;
      let na = fbm(vec2f(qa.x * 0.085, qa.y * 0.05) + 40.0) + (vnoise(qa * 0.6) - 0.5) * 0.06;
      let nb = fbm(vec2f(qb.x * 0.11, qb.y * 0.06) + 11.0) + (vnoise(qb * 0.9) - 0.5) * 0.06;
      let fa = smoothstep(0.50, 0.53, na); let fb = smoothstep(0.53, 0.56, nb);
      let haze = smoothstep(0.34, 0.72, fbm(vec2f(p.x * 0.06 - u.time * 0.013, p.y * 0.14 + u.time * 0.004)));
      let far = mix(mix(0.30, 0.15, fa), 0.07, fb) + (smoothstep(0.46, 0.50, na) - fa) * 0.10 + (smoothstep(0.50, 0.53, nb) - fb) * 0.16;
      let own = lum(u.ambient.rgb);
      bgTone = mix(bgTone, max(bgTone, far * 0.55), 0.6 * under);
      bgTone += haze * 0.05 * under;
      bgLight = own * 2.1 * under;                       // (kept for below)
      ph1 += (fa * 0.8 + fb * 1.5) * under;
    }
    bgLight += lum(lightSoft) * 0.75 + lum(light) * 0.25;
    value = bgTone * bgLight * 1.25 + 0.004;
    // a line in the dark is a broken one
    value *= mix(0.35 + 1.3 * vnoise(vec2f(back.x * 0.8, floor(ph1) * 7.3)), 1.0, smoothstep(0.02, 0.2, value));
    tint = mix(vec3f(0.92, 0.96, 1.08), lightSoft / max(lum(lightSoft), 1e-3), clamp(lum(lightSoft) * 25.0, 0.0, 1.0));

    // ── the ink mere: black liquid that mirrors the light above it ─────
    let ip = u.inkPool;
    if (ip.w > 0.5 && p.x > ip.x && p.x < ip.y) {
      let wave = sin(p.x * 1.7 + u.time * 1.3) * 0.05 + sin(p.x * 4.1 - u.time * 2.1) * 0.02;
      let surf = ip.z + wave;
      if (p.y < surf) {
        let depthBelow = surf - p.y;
        let mirrorY = surf + depthBelow;
        let muv = vec2f(uv.x, 0.5 - (mirrorY - u.cam.y) / u.viewH + (vnoise(vec2f(p.x * 3.0, p.y * 9.0 + u.time)) - 0.5) * 0.004);
        let refl = textureSampleLevel(lightTex, linSamp, muv, 0.0).rgb;
        value = lum(refl) * 0.28 * exp(-depthBelow * 0.9);
        tint = refl / max(lum(refl), 1e-3);
        ph1 = dirPhase(px, 0.0, sp * 0.75) + sin(px.x * 0.013 + u.time * 1.1) * 0.12 + wob * 0.3;
        ph2 = ph1;
        cover = 0.0;
        // a fine bright skin on the surface
        value += smoothstep(0.05, 0.0, depthBelow) * lum(light) * 0.35;
      }
    }
    // soft, wide anti-aliasing and no cross-hatching on the paintings; they sit back as a quiet grey
    let bgAA = select(aa, 2.4 / spB, cover > 0.0);
    paperMask = engrave(expose(value), ph1, ph2, bgAA, cover * 0.35);
    let dim = expose(value);
    paperMask *= mix(smoothstep(0.004, 0.075, dim), 1.0, step(0.5, f32(cover <= 0.0 && u.inkPool.w > 0.5 && p.y < u.inkPool.z)));      // and in the black there are none
    paperMask = mix(paperMask, 0.5 * dim, max(cover * 0.55, 0.5));
    bgDim = cover;
  }

  // ── sprites (Canvas2D layer: grey = engraved tone, alpha = coverage) ─────
  let sa = sc.a * (1.0 - bury);
  if (sa > 0.004) {
    let tone = sc.r;
    let sv = tone * (lum(light) * 1.5 + 0.05);
    let ph = dirPhase(px, 0.6, sp * 0.62) + wob * 0.3;
    let ph2s = dirPhase(px, -0.6, sp * 0.62) + wob * 0.3;
    let sm = engrave(expose(sv), ph, ph2s, 1.1 / (sp * 0.62), 1.0);
    paperMask = mix(paperMask, sm, sa);
    tint = mix(tint, light / max(lum(light), 1e-3), sa);
  }

  // ── figures (3D, already lit): lines that bend round the form, heavier where it turns away, hidden by rock ─────
  let fc = textureSampleLevel(figTex, linSamp, uv, 0.0);
  if (fc.a > 0.004) {
    let fnA = textureSampleLevel(figNrm, linSamp, uv, 0.0) / fc.a;
    let fn3 = fnA.xyz;
    let nx = fn3.xy * 2.0 - 1.0;
    let fl = fc.rgb / fc.a;
    // (a figure writes 1 in its normal's alpha, a thing lying about 0.5, a thing held up 0: that one is in front of the rock)
    let prop = step(fnA.a, 0.75);
    let fa = fc.a * mix(smoothstep(-0.30, -0.05, d), 1.0, step(fnA.a, 0.25));
    let spF = sp * 0.62;
    let ph = dirPhase(px, 0.5, spF) + nx.y * 1.3 + nx.x * 0.7 + wob * 0.3;
    let ph2f = dirPhase(px, -0.75, spF) + nx.x * 1.1 + wob * 0.3;
    var sm = engrave(expose(lum(fl) * 1.5), ph, ph2f, 1.1 / spF, 1.0);
    sm *= smoothstep(0.0, 0.22, fn3.z);
    if (prop > 0.5) {
      let sv = lum(fl);
      sm = engrave(expose(sv * 0.92), dirPhase(px, 0.6, spF) + wob * 0.3, dirPhase(px, -0.6, spF) + wob * 0.3, 1.1 / spF, 1.0);
    }
    paperMask = mix(paperMask, sm, fa);
    tint = mix(tint, fl / max(lum(fl), 1e-3), fa);
    bgDim = mix(bgDim, 0.0, fa);
  }

  // the ink line round a thing to pick up, and where its form turns sharply: as thick as the doll's
  if (textureDimensions(figTex).x > 1u) {
    let r = max(1.0, u.res.y / 620.0) / u.res;
    var am = 0.0; var ap = 0.0; var bend = 0.0; var kind = 1.0;
    let c0 = textureSampleLevel(figNrm, linSamp, uv, 0.0); let a0 = fc.a;
    for (var k = 0; k < 8; k++) {
      let an = f32(k) * 0.7854; let q = uv + vec2f(cos(an), sin(an)) * r;
      let a1 = textureSampleLevel(figTex, linSamp, q, 0.0).a; let n1 = textureSampleLevel(figNrm, linSamp, q, 0.0);
      am = max(am, a1); ap = max(ap, 1.0 - a1);
      if (a1 > 0.5) { kind = min(kind, n1.a / a1); if (a0 > 0.5) { bend = max(bend, length(n1.xyz / a1 - c0.xyz / a0)); } }
    }
    if (a0 > 0.5) { kind = min(kind, c0.a / a0); }
    if (kind < 0.75 && am > 0.02) {
      let over = mix(smoothstep(-0.30, -0.05, d), 1.0, step(kind, 0.25));
      let sil = min(am, max(ap, 1.0 - a0));
      // small, lying about or on her shelf (kind 0.5): a hairline, and its inner folds barely marked; held up: the doll's line
      let small = step(0.25, kind);
      let edge = mix(smoothstep(0.25, 0.75, sil), smoothstep(0.62, 0.98, sil) * 0.8, small);
      paperMask *= 1.0 - max(edge, smoothstep(0.42, 0.72, bend) * mix(0.9, 0.35, small)) * over;
    }
  }

  // something is being held up: everything else goes quiet
  if (u.hush > 0.0) { let pr = textureSampleLevel(figNrm, linSamp, uv, 0.0); let held = fc.a * step(pr.a, 0.25 * fc.a); paperMask *= 1.0 - 0.72 * u.hush * (1.0 - held); }

  // vignette as burnt plate edges
  let vg = length((uv - 0.5) * vec2f(1.0, 0.85));
  paperMask *= 1.0 - smoothstep(0.5, 0.82, vg) * 0.85;

  // paper with fibres and mottling; ink is a deep blue-black
  let grain = vnoise(px * 0.9) * 0.06 + vnoise(px * 0.08) * 0.07 + vnoise(vec2f(px.x * 0.02, px.y * 0.6)) * 0.03;
  let tintC = mix(vec3f(1.0), clamp(tint, vec3f(0.0), vec3f(1.6)), 0.55);
  var paperC = u.paper.rgb * (0.9 + grain * (1.0 - bgDim * 0.7)) * tintC * (1.0 - bgDim * 0.42);
  let inkC = u.ink.rgb * (0.85 + vnoise(px * 0.3) * 0.3);
  var col = mix(inkC, paperC, paperMask);
  // a breath of coloured light in the ink (the glow of the thread on wet rock)
  col += (light * vec3f(0.11, 0.035, 0.03) * u.red + light * 0.02) * (1.0 - 0.85 * u.hush);

  // emissive layer (half res): window light, knots, sparks
  let e = textureSampleLevel(emitTex, linSamp, uv, 0.0);
  // the canvas arrives un-premultiplied: weight by coverage so faint halo tails fade out instead of ending hard
  col += e.rgb * sqrt(e.a) * 1.3;

  // the player's own brightness
  col = pow(max(col, vec3f(0.0)), vec3f(1.0 / u.paper.w)) * mix(1.0, u.paper.w, 0.35);
  col += vec3f(u.flash);
  col = mix(col, u.ink.rgb * 0.6, u.fade);
  return vec4f(col, 1.0);
}
`;

export const THREAD_WGSL = /* wgsl */ `
struct U {
  res: vec2f, cam: vec2f,
  viewH: f32, time: f32, boil: f32, fade: f32,
};
// s: metres along the thread from its home end, so the yarn's twist and hairs belong to the thread and travel with it
struct Pt { pos: vec2f, width: f32, alpha: f32, color: vec3f, s: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> pts: array<Pt>;

struct VO {
  @builtin(position) pos: vec4f,
  @location(0) sp: vec2f,
  @location(1) @interpolate(flat) a: vec2f,
  @location(2) @interpolate(flat) b: vec2f,
  @location(3) @interpolate(flat) w: f32,
  @location(4) col: vec4f,
  @location(5) @interpolate(flat) s: vec2f,
};
fn toScreen(p: vec2f) -> vec2f {
  let aspect = u.res.x / u.res.y;
  let n = (p - u.cam) / vec2f(u.viewH * aspect, u.viewH);
  return vec2f((n.x + 0.5) * u.res.x, (0.5 - n.y) * u.res.y);
}
// how far out its hairs reach, in pixels, for a strand w pixels across (half-width)
fn hairLen(w: f32) -> f32 { return max(2.6, w * 1.9); }
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p0 = pts[ii]; let p1 = pts[ii + 1u];
  var o: VO;
  let a = toScreen(p0.pos); let b = toScreen(p1.pos);
  let w = max(p0.width, p1.width);
  o.s = vec2f(p0.s, p1.s);
  if (p1.width <= 0.0 || p0.width <= 0.0) {
    o.pos = vec4f(2.0, 2.0, 2.0, 1.0); o.sp = vec2f(0.0); o.a = a; o.b = b; o.w = 0.0; o.col = vec4f(0.0);
    return o;
  }
  var dir = b - a; let L = length(dir);
  dir = select(vec2f(1.0, 0.0), dir / L, L > 1e-4);
  let nrm = vec2f(-dir.y, dir.x);
  let ext = w + hairLen(w) + 1.5;
  let corner = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0))[vi];
  let base = select(a, b, corner.x > 0.0);
  let sp = base + dir * corner.x * ext + nrm * corner.y * ext;
  o.pos = vec4f(sp.x / u.res.x * 2.0 - 1.0, 1.0 - sp.y / u.res.y * 2.0, 0.0, 1.0);
  o.sp = sp; o.a = a; o.b = b; o.w = w;
  let right = corner.x > 0.0;
  o.col = vec4f(select(p0.color, p1.color, right), select(p0.alpha, p1.alpha, right));
  return o;
}
fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn h24(p: vec2f) -> vec4f { return fract(sin(vec4f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)), dot(p, vec2f(419.2, 371.9)), dot(p, vec2f(21.7, 97.3)))) * 43758.5453); }
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let q = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2f(1.0, 0.0)), q.x), mix(h21(i + vec2f(0.0, 1.0)), h21(i + vec2f(1.0, 1.0)), q.x), q.y);
}
fn segd(p: vec2f, a: vec2f, b: vec2f) -> vec2f {     // distance to segment ab, and how far along it (0..1)
  let pa = p - a; let ba = b - a; let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return vec2f(length(pa - ba * h), h);
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let ba = i.b - i.a; let pa = i.sp - i.a;
  let L2 = max(dot(ba, ba), 1e-6);
  let hr = dot(pa, ba) / L2; let h = clamp(hr, 0.0, 1.0);
  let dist = length(pa - ba * h);
  let cr = (ba.x * pa.y - ba.y * pa.x) / sqrt(L2);   // across, measured square to the segment even past its ends
  let side = select(-1.0, 1.0, cr >= 0.0);
  let w = i.w;
  // where this pixel is on the yarn: x along (pixels, carried by the thread), y across (pixels, signed). Measured on the
  // segment's straight line, not round its end, so where the next segment's rounded end lies over this one the pattern agrees
  let k = u.res.y / u.viewH;
  let x = mix(i.s.x, i.s.y, hr) * k;
  let y = cr;
  let D = 2.0 * w;
  let detail = smoothstep(1.8, 5.0, D);              // too thin to show its make: just a line, as before
  // ── the strand: two plies twisted round each other, each rounded, with fibres running along the twist ──
  let core = smoothstep(w + 0.7, w - 0.7, dist);
  let v = clamp(y / max(w, 1e-3), -1.0, 1.0);
  let round = sqrt(max(0.0, 1.0 - v * v));
  let t = x / (D * 1.35) + asin(v) * 0.32;           // the twist: diagonal across the strand
  let f = fract(t);
  let aa = clamp(fwidth(t) * 1.2, 0.02, 0.5);
  let groove = smoothstep(0.5 - 0.09 - aa, 0.5 - 0.02, abs(f - 0.5));   // the dark seam between the two plies
  let ply = sin(f * 3.14159);                        // each ply rounded: lit along its middle
  let fib = vnoise(vec2f(t * 9.0, v * 2.2 + floor(t) * 7.0)) - 0.5;    // fibres laid along the ply
  var tone = mix(0.8, 0.55 + 0.5 * round, detail);
  let seam = mix(0.3, 0.55, smoothstep(4.0, 10.0, D));                 // thin, a seam must not dim the whole strand
  tone *= mix(1.0, (0.78 + 0.3 * ply) * (1.0 - seam * groove) * (1.0 + fib * 0.35), detail);
  tone *= 1.0 + 0.18 * detail * smoothstep(0.2, 0.9, -v) * round;      // light from above catches the top of it
  tone *= mix(1.0, 1.24, detail);                    // as bright on average as the plain line was: it is the light she carries
  // ── hairs: short stray fibres standing off both sides, curling a little; fixed to the thread ──
  let H = hairLen(w);
  var hair = 0.0;
  let cell = max(3.0, w * 1.3);
  let ci = floor(x / cell);
  if (abs(y) > w - 1.0 && abs(y) < w + H + 1.0) {
    for (var c = -2; c <= 2; c++) {
      let id = ci + f32(c);
      let r = h24(vec2f(id, side * 1.7 + 3.0));
      if (r.x > 0.62) { continue; }                   // most cells have one on this side
      let len = H * (0.45 + 0.55 * r.w);
      let lean = (r.z - 0.5) * 2.2;                   // radians off straight out
      let root = vec2f((id + r.y) * cell, side * (w - 0.6));
      let d1 = vec2f(sin(lean), cos(lean) * side);
      let bend = lean + (r.y - 0.5) * 2.4;            // and it curls
      let d2 = vec2f(sin(bend), cos(bend) * side);
      let p1 = root + d1 * len * 0.55; let p2 = p1 + d2 * len * 0.45;
      let q = vec2f(x, y);
      let e1 = segd(q, root, p1); let e2 = segd(q, p1, p2);
      let along = select(0.55 + e2.y * 0.45, e1.y * 0.55, e1.x < e2.x);
      let dd = min(e1.x, e2.x);
      let thick = mix(0.75, 0.3, along);              // thinning to the tip
      hair = max(hair, smoothstep(thick + 0.6, thick - 0.3, dd) * (1.0 - along * 0.55));
    }
  }
  hair *= smoothstep(1.4, 2.6, D) * (1.0 - core);
  let ac = core * i.col.a;
  let ah = hair * i.col.a * 0.85;
  // a loose fibre catches the light: paler than the strand it comes out of
  let hc = mix(i.col.rgb, vec3f(1.0, 0.62, 0.52) * max(max(i.col.r, i.col.g), 0.35), 0.42);
  let col = i.col.rgb * tone * ac + hc * ah * (1.0 - ac);
  // it goes out with the picture: a fade to black (any screen change, a death, the end) takes the thread with it
  let keep = 1.0 - clamp(u.fade, 0.0, 1.0);
  return vec4f(col * keep, (ac + ah * (1.0 - ac)) * keep);
}
`;

// PROPS: the things she picks up (props3d.js): baked solids, and yarn whose plies are spun here from u (along) and v (round).
export const PROP_WGSL = /* wgsl */ `
struct L { p: vec4f, c: vec4f };
struct F { cam: vec2f, viewH: f32, aspect: f32, nl: f32, env: f32, gain: f32, dist: f32, amb: vec4f, r0: vec4f, r1: vec4f, r2: vec4f, at: vec4f, lights: array<L, 8> };
@group(0) @binding(0) var<uniform> f: F;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var nrm: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
struct VO { @builtin(position) pos: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) c: vec4f, @location(4) @interpolate(flat) kind: f32, @location(5) metal: f32 };
fn turn(v: vec3f) -> vec3f { return f.r0.xyz * v.x + f.r1.xyz * v.y + f.r2.xyz * v.z; }
@vertex fn vs(@location(0) p: vec3f, @location(1) n: vec4f, @location(2) uv: vec2f, @location(3) c: vec4f, @location(4) m: vec4f) -> VO {
  let w = turn(p) * f.r0.w + f.at.xyz;
  var o: VO;
  let s = f.dist / (f.dist - min(w.z - f.at.z, f.dist * 0.8));
  let q = (f.at.xy + (w.xy - f.at.xy) * s - f.cam) / vec2f(f.viewH * f.aspect, f.viewH) * 2.0;
  o.pos = vec4f(q, 0.5 - w.z / 60.0, 1.0);
  o.w = w; o.n = turn(n.xyz); o.uv = uv; o.c = c; o.kind = round(m.x * 255.0); o.metal = m.y;
  return o;
}
struct FO { @location(0) c: vec4f, @location(1) n: vec4f };
// drawn, not photographed: a flat tone for what it is made of, three steps of light, ink where two strands meet
@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> FO {
  let t = textureSampleBias(tex, samp, i.uv, f.amb.w); let tn = textureSampleBias(nrm, samp, i.uv, max(f.amb.w, 0.6)).xyz * 2.0 - 1.0;
  let tb = textureSampleBias(tex, samp, i.uv, f.amb.w + 5.5); let tc = textureSampleBias(tex, samp, i.uv, f.amb.w + 7.4); let nb = textureSampleBias(nrm, samp, i.uv, 4.5).xyz * 2.0 - 1.0;
  let fw = max(fwidth(i.uv.x), 1e-4);
  let V = vec3f(0.0, 0.0, 1.0);
  var g = normalize(i.n); if (g.z < 0.0) { g = normalize(g - V * g.z * 1.25); }
  var n = g; var red = 0.0; var tone = 0.0; var ink = 0.0; var ao = i.c.a;
  if (i.kind < 0.5) {
    n = normalize(turn(nb)); if (n.z < 0.0) { n = normalize(n - V * n.z * 1.25); }
    n = normalize(mix(g, n, 0.6));
    // what it is made of: one flat grey; what is written, scratched or stamped on it: ink, or bare light on a raised edge
    let l = dot(pow(t.rgb, vec3f(2.2)), vec3f(0.3, 0.52, 0.18)); let lb0 = dot(pow(tb.rgb, vec3f(2.2)), vec3f(0.3, 0.52, 0.18));
    let lb = max(lb0, dot(pow(tc.rgb, vec3f(2.2)), vec3f(0.3, 0.52, 0.18)) * 0.9 * step(0.12, lb0));
    tone = clamp(0.16 + pow(clamp(lb * 1.3, 0.0, 1.0), 0.55) * 0.86, 0.16, 0.98);
    ink = smoothstep(mix(0.80, 0.92, f.r1.w), mix(0.52, 0.66, f.r1.w), l / max(lb, 1e-3)) * smoothstep(0.004, 0.02, lb);
    ink = max(ink, smoothstep(0.115, 0.07, l) * smoothstep(0.2, 0.3, max(lb, dot(pow(tc.rgb, vec3f(2.2)), vec3f(0.3, 0.52, 0.18)))));
    let L0 = normalize(vec3f(-0.55, 0.62, 0.62));
    let rel = dot(normalize(turn(tn)), L0) - dot(normalize(turn(nb)), L0);
    ink = max(ink, smoothstep(0.2, 0.42, -rel) * 0.9 * step(f.r1.w, 0.1)); tone = mix(tone, 1.0, smoothstep(0.2, 0.42, rel) * 0.5 * step(f.r1.w, 0.1));
  } else {
    let c = pow(i.c.rgb, vec3f(2.2)); red = step(0.12, c.r - c.g);
    tone = mix(pow(dot(c, vec3f(0.3, 0.52, 0.18)), 0.42) * 0.95, 0.72, red);
    let fine = smoothstep(1.7, 0.5, fw);
    let ridge = cos((i.uv.y * 2.0 + i.uv.x * 0.16) * 6.2832);
    if (i.kind < 1.5) { ink = smoothstep(-0.55, -0.85, ridge) * fine; }
  }
  // one light, high on the left, in three steps; hollows take a step down
  let nl = dot(n, normalize(vec3f(-0.55, 0.62, 0.62)));
  let e = fwidth(nl) * 0.8 + 0.02;
  var lit = mix(0.5, 0.76, smoothstep(0.12 - e, 0.12 + e, nl));
  lit = mix(lit, 1.0, smoothstep(0.52 - e, 0.52 + e, nl));
  lit = mix(lit, 0.97, f.r1.w); lit *= mix(0.62, 1.0, smoothstep(0.25, 0.5, ao));
  // a polished thing gets one hard shine
  let sh = smoothstep(0.955, 0.965, dot(normalize(vec3f(-0.4, 0.5, 0.8)), n)) * step(0.5, i.metal + step(0.8, t.a) * step(i.kind, 0.5));
  var v = mix(tone * lit, 0.98, sh * 0.8) * (1.0 - ink * 0.85);
  // in the caves it takes the light of the place, as everything drawn does
  var here = f.env;
  for (var k = 0; k < i32(f.nl); k++) {
    let l = f.lights[k]; let d = l.p.xy - i.w.xy; let x = length(d) / l.p.w;
    if (x < 1.0) { here += (1.0 - x * x) * (1.0 - x * x) * dot(l.c.rgb, vec3f(0.3, 0.52, 0.18)) * 0.62; }
  }
  var o: FO;
  o.c = vec4f(mix(vec3f(1.0, 0.95, 0.87), vec3f(1.0, 0.16, 0.12) * 1.25, red) * v * min(here, 1.0) * f.gain, 1.0);
  o.n = vec4f(g.xy * 0.5 + 0.5, clamp(g.z, 0.0, 1.0), f.at.w);
  return o;
}
`;

// FIGURES: skinned models, lit; colour and normal resolved into two textures that ENGRAVE draws with lines.
export const FIGURE_WGSL = /* wgsl */ `
struct L { p: vec4f, c: vec4f };           // xyz, radius · rgb*intensity
struct F { cam: vec2f, viewH: f32, aspect: f32, nl: f32, hollow: f32, gain: f32, dist: f32, amb: vec4f, lights: array<L, 14> };
@group(0) @binding(0) var<uniform> f: F;
@group(0) @binding(1) var<storage, read> M: array<mat4x4f>;
@group(0) @binding(2) var tex: texture_2d<f32>;
@group(0) @binding(3) var nrm: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;
struct VO { @builtin(position) pos: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) @interpolate(flat) kind: f32 };
@vertex fn vs(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) uv: vec2f, @location(3) j: vec4u, @location(4) wt: vec4f, @location(5) kind: f32) -> VO {
  var w = vec3f(0.0); var nn = vec3f(0.0);
  for (var k = 0; k < 4; k++) {
    if (wt[k] <= 0.0) { continue; }
    let m = M[j[k]];
    w += (m * vec4f(p, 1.0)).xyz * wt[k];
    nn += normalize((m * vec4f(n, 0.0)).xyz) * wt[k];
  }
  var o: VO;
  let s = f.dist / (f.dist - min(w.z, f.dist * 0.8));
  let q = (w.xy - f.cam) * s / vec2f(f.viewH * f.aspect, f.viewH) * 2.0;
  o.pos = vec4f(q, 0.5 - w.z / 60.0, 1.0);
  o.w = w; o.n = nn; o.uv = uv; o.kind = kind;
  return o;
}
struct FO { @location(0) c: vec4f, @location(1) n: vec4f };
@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> FO {
  var n = normalize(i.n);
  let g = normalize(n - vec3f(0.0, 0.0, min(n.z, 0.0) * 1.2));
  let t = textureSample(nrm, samp, i.uv).xyz * 2.0 - 1.0;
  var alb = pow(textureSample(tex, samp, i.uv).r, 2.2) * 1.5;
  // tangent frame from derivatives
  let dp1 = dpdx(i.w); let dp2 = dpdy(i.w); let du1 = dpdx(i.uv); let du2 = dpdy(i.uv);
  let a = cross(dp2, n); let b = cross(n, dp1);
  let T = a * du1.x + b * du2.x; let B = a * du1.y + b * du2.y;
  let im = inverseSqrt(max(max(dot(T, T), dot(B, B)), 1e-12));
  if (i.kind != 4.0 && i.kind != 1.0) { let bump = select(2.0, 0.55, i.kind == 3.0); n = normalize(T * im * t.x * bump - B * im * t.y * bump + n * max(t.z, 0.2)); }
  if (n.z < 0.0) { n = normalize(n - vec3f(0.0, 0.0, n.z * 1.2)); }
  var sp = 0.22; var pw = 18.0;
  if (i.kind == 1.0) { alb = mix(alb, 0.0, f.hollow); sp = 1.6; pw = 90.0; }
  if (i.kind == 2.0) { alb *= 0.06; sp = 0.02; }
  if (i.kind == 0.0 && !ff) { alb = 0.0; sp = 0.0; }      // the inside of a mouth
  if (i.kind == 3.0) { sp = 0.02; alb = mix(alb, 0.32, 0.6); }
  if (i.kind == 4.0) { alb = max(alb, 0.34); }
  var col = f.amb.rgb * alb * (0.4 + 0.6 * n.y);
  for (var k = 0; k < i32(f.nl); k++) {
    let l = f.lights[k];
    let v = l.p.xyz - i.w; let d2 = length(v.xy); let x = d2 / l.p.w;
    if (x >= 1.0) { continue; }
    let fall = (1.0 - x * x) * (1.0 - x * x) / (1.0 + d2 * d2 * 0.35);
    let dir = normalize(v); let dif = max(0.0, (dot(n, dir) + 0.12) / 1.12);
    let h = normalize(dir + vec3f(0.0, 0.0, 1.0));
    col += l.c.rgb * fall * (alb * dif * 1.5 + sp * 0.5 * pow(max(dot(n, h), 0.0), pw) * step(0.0, dot(n, dir)));
  }
  var o: FO;
  o.c = vec4f(max(col, vec3f(0.0)) * f.gain, 1.0);
  o.n = vec4f(g.xy * 0.5 + 0.5, clamp(g.z, 0.0, 1.0), 1.0);
  return o;
}
`;
