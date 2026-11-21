// WGSL for Spindledeep. Three passes:
//  LIGHT   (compute, 1/3 res): thread + lamps + moon, soft shadows marched through the world SDF.
//  ENGRAVE (fullscreen): rock, backdrops, ink, sprites → one tone per pixel → intaglio line work.
//  THREAD  (instanced segments): the red thread and the knitter's grey one, drawn crisp on top.

const COMMON = /* wgsl */ `
struct U {
  res: vec2f, cam: vec2f,
  viewH: f32, time: f32, boil: f32, fade: f32,
  worldMin: vec2f, worldSize: vec2f,
  ambient: vec4f,          // rgb, moon
  ink: vec4f, paper: vec4f,
  hatch: f32, nLights: f32, flash: f32, nBg: f32,
  inkPool: vec4f,          // x0, x1, surface y, enabled
  lightRes: vec2f, wake: f32, red: f32,
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
    let e = 0.1;
    let g = normalize(vec2f(sdfAt(p + vec2f(e, 0.0)) - sdfAt(p - vec2f(e, 0.0)), sdfAt(p + vec2f(0.0, e)) - sdfAt(p - vec2f(0.0, e))) + 1e-5);
    p = p + g * (-d + 0.06);
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
  let k = smoothstep(0.62, 0.3, f) * cross;
  return mix(single, crossed, k);
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
  // hand-drawn wobble: slow warp + an 8 fps boil
  let wob = (vnoise(px * 0.012 + vec2f(boil * 3.1, boil * 1.7)) - 0.5) * 0.55 + (vnoise(px * 0.05 + boil * 7.0) - 0.5) * 0.12;

  let light = textureSampleLevel(lightTex, linSamp, uv, 0.0).rgb;
  // softened light for the backdrops (they are far behind the play plane)
  let o = 3.0 / u.lightRes;
  let lightSoft = (textureSampleLevel(lightTex, linSamp, uv + vec2f(o.x, 0.0), 0.0).rgb + textureSampleLevel(lightTex, linSamp, uv - vec2f(o.x, 0.0), 0.0).rgb
    + textureSampleLevel(lightTex, linSamp, uv + vec2f(0.0, o.y), 0.0).rgb + textureSampleLevel(lightTex, linSamp, uv - vec2f(0.0, o.y), 0.0).rgb) * 0.25;

  // ── rock ──────────────────────────────────────────────────────────────
  let dRaw = sdfAt(p);
  let detail = (fbm(p * 2.6) - 0.5) * 0.16 + (vnoise(p * 11.0) - 0.5) * 0.035;
  let d = dRaw + detail;

  var paperMask = 0.0;    // 1 = paper shows, 0 = ink
  var tint = vec3f(1.0);
  var value = 0.0;

  if (d < 0.0) {
    // contour engraving: lines run parallel to the rock face, packing tighter toward its heart
    let depthIn = -d;
    let strata = fbm(vec2f(p.x * 0.25, p.y * 1.6)) ;
    let tone = mix(0.62, 0.42, strata) * exp(-depthIn * 0.55);
    value = tone * lum(light) * 1.6;
    let ph1 = (d * ppm) / (sp * 1.05) + wob + strata * 1.5;
    let ph2 = dirPhase(px, 1.05, sp * 1.1) + wob * 0.6;
    paperMask = engrave(expose(value), ph1, ph2, aa, 1.0);
    // the very face of the rock: a crisp inked edge
    paperMask *= smoothstep(0.6, 1.8, abs(d) * ppm);
    tint = light / max(lum(light), 1e-3);
  } else {
    // ── backdrops (engraved paintings behind the play plane) ──────────
    var bgTone = 0.0; var bgLight = 0.0;
    var ph1 = dirPhase(px, 0.0, sp * 0.95) + wob;
    var ph2 = dirPhase(px, 0.85, sp) + wob;
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
      let edge = smoothstep(0.0, 0.14, tuv.x) * smoothstep(1.0, 0.86, tuv.x) * smoothstep(0.0, 0.14, tuv.y) * smoothstep(1.0, 0.86, tuv.y);
      if (edge <= 0.0) { continue; }
      let s = textureSampleLevel(bgTex, linSamp, vec2f(tuv.x, 1.0 - tuv.y), i32(pr.y), 0.0);
      let sn = textureSampleLevel(bgTex, linSamp, vec2f(clamp(nuv.x, 0.0, 1.0), 1.0 - clamp(nuv.y, 0.0, 1.0)), i32(pr.y), 0.0);
      // far tone and the near layer (alpha matte) blend; depth tells how far behind
      let farT = s.r * 0.55;
      let nearT = sn.g * 0.8;
      let t = mix(farT, nearT, sn.b * smoothstep(0.0, 0.1, nuv.x) * smoothstep(1.0, 0.9, nuv.x));
      let a = edge * pr.z;
      bgTone = mix(bgTone, t, a);
      cover = max(cover, a);
      // lines follow the painting's brightness: relief
      ph1 += s.r * 2.2 * a;
      ph2 += sn.g * 1.4 * a;
    }
    bgLight = lum(lightSoft) * 0.75 + lum(light) * 0.25;
    value = bgTone * bgLight * 1.25 + 0.012;
    tint = lightSoft / max(lum(lightSoft), 1e-3);

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
    paperMask = engrave(expose(value), ph1, ph2, aa, cover);
  }

  // ── sprites (Canvas2D layer: grey = engraved tone, alpha = coverage) ─────
  let sc = textureSampleLevel(spriteTex, linSamp, uv, 0.0);
  if (sc.a > 0.004) {
    let tone = sc.r;
    let sv = tone * (lum(light) * 1.5 + 0.05);
    let ph = dirPhase(px, 0.6, sp * 0.62) + wob * 0.3;
    let ph2s = dirPhase(px, -0.6, sp * 0.62) + wob * 0.3;
    let sm = engrave(expose(sv), ph, ph2s, 1.1 / (sp * 0.62), 1.0);
    paperMask = mix(paperMask, sm, sc.a);
    tint = mix(tint, light / max(lum(light), 1e-3), sc.a);
  }

  // vignette as burnt plate edges
  let vg = length((uv - 0.5) * vec2f(1.0, 0.85));
  paperMask *= 1.0 - smoothstep(0.5, 0.82, vg) * 0.85;

  // paper with fibres and mottling; ink is a deep blue-black
  let grain = vnoise(px * 0.9) * 0.06 + vnoise(px * 0.08) * 0.07 + vnoise(vec2f(px.x * 0.02, px.y * 0.6)) * 0.03;
  let tintC = mix(vec3f(1.0), clamp(tint, vec3f(0.0), vec3f(1.6)), 0.55);
  var paperC = u.paper.rgb * (0.9 + grain) * tintC;
  let inkC = u.ink.rgb * (0.85 + vnoise(px * 0.3) * 0.3);
  var col = mix(inkC, paperC, paperMask);
  // a breath of coloured light in the ink (the glow of the thread on wet rock)
  col += light * vec3f(0.11, 0.035, 0.03) * u.red + light * 0.02;

  // emissive layer (half res): window light, knots, sparks
  let e = textureSampleLevel(emitTex, linSamp, uv, 0.0);
  col += e.rgb * 1.2;

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
struct Pt { pos: vec2f, width: f32, alpha: f32, color: vec3f, glow: f32 };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> pts: array<Pt>;

struct VO {
  @builtin(position) pos: vec4f,
  @location(0) sp: vec2f,
  @location(1) @interpolate(flat) a: vec2f,
  @location(2) @interpolate(flat) b: vec2f,
  @location(3) @interpolate(flat) w: f32,
  @location(4) col: vec4f,
};
fn toScreen(p: vec2f) -> vec2f {
  let aspect = u.res.x / u.res.y;
  let n = (p - u.cam) / vec2f(u.viewH * aspect, u.viewH);
  return vec2f((n.x + 0.5) * u.res.x, (0.5 - n.y) * u.res.y);
}
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  let p0 = pts[ii]; let p1 = pts[ii + 1u];
  var o: VO;
  let a = toScreen(p0.pos); let b = toScreen(p1.pos);
  let w = max(p0.width, p1.width);
  if (p1.width <= 0.0 || p0.width <= 0.0) {
    o.pos = vec4f(2.0, 2.0, 2.0, 1.0); o.sp = vec2f(0.0); o.a = a; o.b = b; o.w = 0.0; o.col = vec4f(0.0);
    return o;
  }
  var dir = b - a; let L = length(dir);
  dir = select(vec2f(1.0, 0.0), dir / L, L > 1e-4);
  let nrm = vec2f(-dir.y, dir.x);
  let ext = w + 1.5;
  let corner = array<vec2f, 4>(vec2f(-1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0))[vi];
  let base = select(a, b, corner.x > 0.0);
  let s = base + dir * corner.x * ext + nrm * corner.y * ext;
  o.pos = vec4f(s.x / u.res.x * 2.0 - 1.0, 1.0 - s.y / u.res.y * 2.0, 0.0, 1.0);
  o.sp = s; o.a = a; o.b = b; o.w = w;
  let right = corner.x > 0.0;
  o.col = vec4f(select(p0.color, p1.color, right), select(p0.alpha, p1.alpha, right));
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let pa = i.sp - i.a; let ba = i.b - i.a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  let dist = length(pa - ba * h);
  let core = smoothstep(i.w + 0.7, i.w - 0.7, dist);
  // fibre texture: a faint twist along the strand
  let twist = 0.85 + 0.15 * sin((dot(i.sp, normalize(ba + 1e-4)) ) * 0.9);
  let a = core * i.col.a;
  return vec4f(i.col.rgb * twist * a, a);
}
`;
