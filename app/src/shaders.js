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
  let dRaw = sdfAt(p);
  let sc = textureSampleLevel(spriteTex, linSamp, uv, 0.0);
  // things buried in the rock (buried.js) come on the sprite layer too, told apart by being blue
  let bury = smoothstep(0.1, 0.25, sc.b - sc.r);
  let detail = (fbm(p * 2.6) - 0.5) * 0.16 + (vnoise(p * 11.0) - 0.5) * 0.035;
  let d = dRaw + detail;

  var paperMask = 0.0;    // 1 = paper shows, 0 = ink
  var bgDim = 0.0;
  var tint = vec3f(1.0);
  var value = 0.0;

  if (d < 0.0) {
    // contour engraving: lines run parallel to the rock face, packing tighter toward its heart
    let depthIn = -d;
    let strata = fbm(vec2f(p.x * 0.25, p.y * 1.6)) ;
    let tone = mix(0.8, 0.55, strata) * exp(-depthIn * 0.5);
    value = tone * lum(light) * 1.6;
    let ph1 = (d * ppm) / (sp * 1.05) + wob + strata * 1.5;
    let ph2 = dirPhase(px, 1.05, sp * 1.1) + wob * 0.6;
    paperMask = engrave(expose(value), ph1, ph2, aa, 1.0);
    // where two faces are equally far (the middle of a ledge) the contours have nothing to follow and used to clot into blots
    // that looked like things in the ground: the lines run level there instead
    if (depthIn > 0.12) {
      let gh = 0.16;
      let gv = vec2f(sdfAt(p + vec2f(gh, 0.0)) - sdfAt(p - vec2f(gh, 0.0)), sdfAt(p + vec2f(0.0, gh)) - sdfAt(p - vec2f(0.0, gh))) / (2.0 * gh);
      let level = smoothstep(0.92, 0.6, length(gv)) * smoothstep(0.12, 0.3, depthIn);
      if (level > 0.0) {
        let phF = (p.y * ppm) / (sp * 1.05) + wob + strata * 1.5 + detail * ppm / (sp * 2.0);
        paperMask = mix(paperMask, engrave(expose(value), phF, ph2, aa, 1.0), level);
      }
    }
    // buried things: cut into the rock in finer lines of their own, lit and fading with depth exactly as the rock is
    if (bury * sc.a > 0.004) {
      let vb = sc.r * 1.95 * exp(-depthIn * 0.5) * lum(light) * 1.6;
      let phB = dirPhase(px, 0.6, sp * 0.62) + wob * 0.3;
      let phB2 = dirPhase(px, -0.6, sp * 0.62) + wob * 0.3;
      paperMask = mix(paperMask, engrave(expose(vb), phB, phB2, 1.1 / (sp * 0.62), 1.0), bury * sc.a * smoothstep(0.1, 0.25, depthIn) * 0.9);
    }
    // the very face of the rock: a crisp inked edge
    paperMask *= smoothstep(0.6, 1.8, abs(d) * ppm);
    tint = light / max(lum(light), 1e-3);
  } else {
    // ── backdrops (engraved paintings behind the play plane) ──────────
    var bgTone = 0.0; var bgLight = 0.0;
    let spB = sp * 1.3;
    var ph1 = dirPhase(px, 0.0, spB) + wobBg;
    var ph2 = dirPhase(px, 0.85, spB * 1.05) + wobBg;
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
      ph1 += s.r * 1.1 * a;
      ph2 += sn.g * 0.7 * a;
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
    // soft, wide anti-aliasing and no cross-hatching on the paintings; they sit back as a quiet grey
    let bgAA = select(aa, 2.4 / spB, cover > 0.0);
    paperMask = engrave(expose(value), ph1, ph2, bgAA, cover * 0.35);
    paperMask = mix(paperMask, 0.5 * expose(value), cover * 0.45);
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
      paperMask *= 1.0 - max(smoothstep(0.25, 0.75, sil), smoothstep(0.42, 0.72, bend) * 0.9) * over;
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
