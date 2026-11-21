// Spindledeep — boot, loop, camera, events → sound/fx/ui, menus, saves, the ending.
import { Renderer } from './renderer.js';
import { buildTerrain } from './terrain.js';
import { World } from './world.js';
import { Drawer } from './draw.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import * as L from './level.js';
import { clamp, damp, lerp, smooth } from './util.js';

const SD = (window.__SD = { ready: false, errors: [] });
addEventListener('error', (e) => SD.errors.push(String(e.message)));
addEventListener('unhandledrejection', (e) => SD.errors.push(String(e.reason?.message || e.reason)));
const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);
const SAVE_KEY = 'spindledeep.save.v1';
const FIXED = 1 / 120;

let R, T, W, D, A, I;
let state = 'loading';     // loading | title | play | ending | credits
let paused = false;
const cam = { x: 26, y: 4, viewH: 15, shake: 0 };
let ambient = [0.16, 0.17, 0.2], moon = 1;
let time = 0;
const pts = new Float32Array(16384 * 8);
let voicePlaying = 0;
let subTimer = 0, cardTimer = 0, toastTimer = 0;
let settings = { volume: 1, fullscreen: true };
let finAPlayed = false;

async function boot() {
  const bar = document.querySelector('.ld-bar i');
  const msg = document.querySelector('.ld-msg');
  const step = async (t, p) => { msg.textContent = t; bar.style.width = (p * 100).toFixed(0) + '%'; await new Promise((r) => setTimeout(r, 30)); };
  try {
    settings = { ...settings, ...((await window.host?.getSettings?.()) || {}) };
    await step('kindling the lamp…', 0.05);
    R = new Renderer();
    await R.init($('view'));
    await step('carving the deep…', 0.2);
    T = buildTerrain();
    R.setWorld(T, L.WORLD);
    await step('engraving the dark…', 0.45);
    const layers = await Promise.all(L.BACKDROPS.map(async (b) => {
      const blob = await (await fetch('assets/art/' + b.img + '.png')).blob();
      return createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    }));
    R.setBackdrops(layers);
    await step('listening for her voice…', 0.6);
    W = new World(T);
    D = new Drawer(W);
    I = new Input();
    A = new Audio();
    A.setVolume(settings.volume ?? 1);
    await A.load((p) => { bar.style.width = (60 + p * 38).toFixed(0) + '%'; });
    await step('', 1);
  } catch (e) {
    console.error(e);
    SD.errors.push(String(e.message || e));
    $('fatal').textContent = 'Spindledeep could not start.\n\n' + (e.message || e) + '\n\nIt needs a GPU with WebGPU support (Windows 10/11, recent drivers).';
    show($('fatal'), true);
    return;
  }
  addEventListener('resize', () => R.resize());
  show($('loading'), false);
  enterTitle();
  SD.ready = true;
  Object.assign(SD, { W, R, A, cam, begin: () => startGame(false), go: (x, y) => { W.player.dead = false; W.player.x = x; W.player.y = y; W.player.vx = W.player.vy = 0; cam.x = x; cam.y = y; }, state: () => state });
  requestAnimationFrame(tick);
}

// ── title & menus ────────────────────────────────────────────────────────
function menu(nav, items) {
  nav.innerHTML = '';
  nav._items = items;
  nav._sel = 0;
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.textContent = it.label;
    b.onmouseenter = () => selectItem(nav, i);
    b.onclick = () => { A?.resume(); it.fn(); };
    nav.appendChild(b);
  });
  selectItem(nav, 0);
}
function selectItem(nav, i) {
  nav._sel = (i + nav._items.length) % nav._items.length;
  [...nav.children].forEach((b, k) => b.classList.toggle('sel', k === nav._sel));
}
function navInput(nav) {
  if (I.pressed.up) { selectItem(nav, nav._sel - 1); A.play('step1', { vol: 0.2, verb: 0.2 }); }
  if (I.pressed.down) { selectItem(nav, nav._sel + 1); A.play('step2', { vol: 0.2, verb: 0.2 }); }
  if (I.pressed.act || I.pressed.jump) { A.resume(); nav._items[nav._sel].fn(); }
}

function enterTitle() {
  state = 'title';
  W.reset();
  const has = !!loadSave(true);
  const items = [];
  if (has) items.push({ label: 'Continue', fn: () => startGame(true) });
  items.push({ label: has ? 'Begin anew' : 'Begin', fn: () => startGame(false) });
  items.push({ label: 'Fullscreen', fn: toggleFullscreen });
  items.push({ label: 'Leave', fn: () => window.host?.quit?.() ?? window.close() });
  menu($('menu'), items);
  show($('title'), true);
  A.setArea('brink');
  A.setMusic('mus_title', 3);
  cam.x = 27; cam.y = 5.5; cam.viewH = 15.5;
}
function toggleFullscreen() {
  settings.fullscreen = !document.fullscreenElement && !(window.innerHeight === screen.height);
  window.host?.setFullscreen?.(settings.fullscreen);
  window.host?.setSettings?.(settings);
}
function startGame(cont) {
  show($('title'), false);
  W = new World(T);
  D = new Drawer(W);
  if (cont) applySave(loadSave()); else localStorage.removeItem(SAVE_KEY);
  finAPlayed = false;
  state = 'play';
  A.setMusic(null, 4);
  A.endMusic = false;
  cam.x = W.player.x; cam.y = W.player.y + 1;
  SD.W = W;
}
function setPaused(on) {
  paused = on;
  show($('pause'), on);
  if (on) {
    menu($('pmenu'), [
      { label: 'Resume', fn: () => setPaused(false) },
      { label: 'Fullscreen', fn: toggleFullscreen },
      { label: `Volume · ${Math.round((settings.volume ?? 1) * 100)}%`, fn: () => { const v = [1, 0.7, 0.45, 0.2, 0][([1, 0.7, 0.45, 0.2, 0].indexOf(settings.volume ?? 1) + 1) % 5]; settings.volume = v; A.setVolume(v); window.host?.setSettings?.(settings); setPaused(true); } },
      { label: 'Return to the cottage', fn: () => { setPaused(false); enterTitle(); } },
      { label: 'Leave', fn: () => window.host?.quit?.() },
    ]);
    A.ctx.suspend();
  } else A.resume();
}

// ── saves ────────────────────────────────────────────────────────────────
function save() {
  const th = W.thread;
  const n = th.fixedN;
  const data = {
    cp: W.checkpoint.i, skeins: W.skeins.map((s) => s.taken), mem: W.memories.map((m) => m.heard), bells: W.bells.map((b) => b.lit > 0),
    areas: [...W.areaSeen], pegs: W.pegs.map((p) => p.tied),
    tx: Array.from(th.x.subarray(0, n), (v) => +v.toFixed(2)), ty: Array.from(th.y.subarray(0, n), (v) => +v.toFixed(2)),
    dead: Array.from(th.dead.subarray(0, n)),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
function loadSave(peek) { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.cp !== undefined ? s : null; } catch { return null; } }
function applySave(s) {
  if (!s) return;
  const th = W.thread;
  W.skeins.forEach((k, i) => (k.taken = !!s.skeins[i]));
  W.skeinCount = W.skeins.filter((k) => k.taken).length;
  W.memories.forEach((m, i) => (m.heard = !!s.mem[i]));
  W.bells.forEach((b, i) => { if (s.bells[i]) b.lit = 1; });
  W.pegs.forEach((p, i) => (p.tied = !!s.pegs[i]));
  W.gates.forEach((g) => { const bs = W.bells.filter((b) => b.gate === g.id); if (bs.length && bs.every((b) => b.lit > 0)) g.open = 1; });
  s.areas.forEach((a) => W.areaSeen.add(a));
  const n = s.tx.length;
  for (let i = 0; i < n; i++) { th.x[i] = th.ox[i] = s.tx[i]; th.y[i] = th.oy[i] = s.ty[i]; th.dead[i] = s.dead[i]; }
  th.n = th.fixedN = th.liveStart = n; th.anchored = true;
  W.checkpoint = W.pegs[s.cp];
  W.player.reset(W.checkpoint.x + 0.6, W.checkpoint.y + 0.6);
}

// ── UI bits ──────────────────────────────────────────────────────────────
function subtitle(text, secs) {
  const el = $('sub');
  el.textContent = text;
  show(el, true);
  subTimer = secs;
}
function card(name) {
  const el = $('card');
  el.querySelector('.name').textContent = name;
  show(el, true);
  cardTimer = 4.2;
}
function toast(text, secs = 2.6) { if (state !== 'play') return; const el = $('toast'); el.textContent = text; show(el, true); toastTimer = secs; }
function keysHTML(keys) { return (keys || []).map((k) => `<kbd>${I.label(k)}</kbd>`).join(' '); }
let lastHint = '', lastPrompt = '';
function updateUI(dt) {
  if (subTimer > 0) { subTimer -= dt; if (subTimer <= 0) show($('sub'), false); }
  if (cardTimer > 0) { cardTimer -= dt; if (cardTimer <= 0) show($('card'), false); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) show($('toast'), false); }
  const playing = state === 'play' && !paused;
  const h = playing && W.hint && subTimer <= 0 ? W.hint : null;
  const hs = h ? keysHTML(h.keys) + ' <span>' + h.text + '</span>' : '';
  if (hs !== lastHint) { lastHint = hs; if (hs) $('hint').innerHTML = hs; show($('hint'), !!hs); }
  const p = playing && W.prompt ? W.prompt : null;
  const ps = p ? keysHTML([p.a]) + ' <span>' + p.t + '</span>' : '';
  if (ps !== lastPrompt) { lastPrompt = ps; if (ps) $('prompt').innerHTML = ps; show($('prompt'), !!ps); }
}

// ── events from the world ────────────────────────────────────────────────
function handleEvents() {
  const p = W.player;
  for (const e of W.events) {
    switch (e.k) {
      case 'step': {
        const snow = W.area().id === 'brink';
        A.pick(snow ? ['snow1', 'snow2', 'snow3'] : ['step1', 'step2', 'step3', 'step4'], { vol: snow ? 0.32 : 0.42, vary: 0.15, x: p.x, y: p.y, verb: 0.35 });
        break;
      }
      case 'jump': A.play('jump', { vol: 0.32, vary: 0.1, x: p.x, y: p.y, verb: 0.3 }); break;
      case 'land': A.play('land', { vol: clamp(e.v / 14, 0.15, 0.7), vary: 0.1, x: p.x, y: p.y }); D.spawn('puff', p.x, p.y - 0.28, 7, { speed: 1.4, vy: 0.4, life: 0.55, r: W.area().id === 'brink' ? 1.3 : 0.9 }); break;
      case 'grip': A.play('grip', { vol: 0.35, vary: 0.1, x: p.x, y: p.y }); break;
      case 'release': case 'letgo': A.play('release', { vol: 0.3, vary: 0.1, x: p.x, y: p.y }); break;
      case 'taut': A.play('tie', { vol: 0.25, rate: 0.8, x: p.x, y: p.y }); if (!W._tautSeen) { W._tautSeen = true; toast('the yarn runs short · walk back, or tie it at a peg', 3.5); } break;
      case 'snag': A.play('snag', { vol: 0.55, x: p.x, y: p.y + 2 }); D.spawn('spark', p.x, p.y + 2, 6, { speed: 2, life: 0.6 }); break;
      case 'tie':
        A.play('tie', { vol: 0.7, x: e.x, y: e.y }); A.play('chime', { vol: 0.25, rate: 0.75, x: e.x, y: e.y });
        D.spawn('spark', e.x, e.y + 0.5, 18, { speed: 2.5, life: 1.0 }); D.spawn('ring', e.x, e.y + 0.5, 1, { speed: 0, life: 0.9 });
        save();
        break;
      case 'mend': A.play('tie', { vol: 0.55, rate: 1.2, x: e.x, y: e.y }); D.spawn('spark', e.x, e.y, 10, { life: 0.7 }); break;
      case 'pluck':
        A.pluck(e.tension, e.x, e.y);
        D.spawn('ring', p.x, p.y + 0.1, 1, { speed: 0, life: 0.8 });
        break;
      case 'bell': A.bellNote(e.i, e.x, e.y); D.spawn('pale', e.x + 0.3, e.y + 1.1, 1, { speed: 0, life: 1.6 }); save(); break;
      case 'gate': A.play('gate', { vol: 0.9, x: e.x, y: e.y }); if (state === 'play') cam.shake = 0.35; toast('the veil remembers its song and parts', 3); break;
      case 'chew': A.play('chew', { vol: 0.28, vary: 0.25, x: e.x, y: e.y, verb: 0.2 }); break;
      case 'mothOn': A.play('chew', { vol: 0.4, vary: 0.2, x: e.x, y: e.y }); break;
      case 'scatter': A.play('moth', { vol: 0.35, rate: 1.4, x: e.x, y: e.y, verb: 0.2 }); break;
      case 'cut':
        A.play('cut', { vol: 0.8, x: e.x, y: e.y });
        D.spawn('fiber', e.x, e.y, 14, { speed: 2, life: 1.6 });
        toast('the thread is severed · mend it, or tie the loose end to a peg', 4);
        cam.shake = 0.2;
        break;
      case 'dissolve': A.play('splash', { vol: 0.6, x: e.x, y: e.y }); A.play('cut', { vol: 0.5, rate: 0.8, x: e.x, y: e.y }); D.spawn('fiber', e.x, e.y, 8, { speed: 1.5, life: 1.2 }); toast('the ink ate the thread', 2.5); break;
      case 'death':
        A.play('tear', { vol: 0.9, x: e.x, y: e.y });
        if (e.cause === 'ink') A.play('splash', { vol: 0.9, rate: 0.7, x: e.x, y: e.y });
        D.spawn('fiber', e.x, e.y, 40, { speed: 3, life: 2 });
        cam.shake = 0.4;
        break;
      case 'respawn': A.play('mend', { vol: 0.4, x: e.x, y: e.y }); D.spawn('spark', e.x, e.y, 12, { speed: 1.5, life: 1 }); break;
      case 'skein':
        A.play('skein', { vol: 0.7, x: e.x, y: e.y }); D.spawn('spark', e.x, e.y + 0.3, 20, { speed: 2, life: 1.2 });
        toast(`a skein of her red yarn · ${e.n} of ${W.skeins.length}`, 3);
        break;
      case 'memory': playLine(e.id, e.text); A.play('chime', { vol: 0.5, x: e.x, y: e.y }); D.spawn('pale', e.x, e.y, 1, { speed: 0, life: 2 }); save(); break;
      case 'area': if (state === 'play') card(e.name); else W.areaSeen.delete(e.id); A.setArea(e.id); break;
      case 'areaQuiet': A.setArea(e.id); break;
      case 'drip': A.play('drip', { vol: 0.5, vary: 0.2, x: e.x, y: e.y, verb: 1 }); break;
      case 'splash': A.play('splash', { vol: 0.35, vary: 0.2, x: e.x, y: e.y }); D.spawn('splash', e.x, e.y, 6, { speed: 2.5, vy: 2, life: 0.8 }); break;
      case 'finale': startEnding(); break;
    }
  }
  W.events.length = 0;
}
function playLine(id, text) {
  voicePlaying++;
  subtitle(text, 30);
  A.voice(id, (dur) => { voicePlaying--; subTimer = 1.4; });
}

// ── the ending: a pulse of light climbs her grey thread all the way home ─────
let END = null;
function startEnding() {
  state = 'ending';
  const g = W.grey, gi = W.finale.gi;
  const arc = new Float32Array(gi + 1);
  for (let i = gi - 1; i >= 0; i--) arc[i] = arc[i + 1] + Math.hypot(g.x[i] - g.x[i + 1], g.y[i] - g.y[i + 1]);
  END = { t: 0, arc, total: arc[0], gi, dur: 26, said: false, bellsRung: new Set(), done: false };
  A.endMusic = true;
  A.setMusic('mus_end', 3);
  A.play('tie', { vol: 0.8 }); A.play('chime', { vol: 0.6, rate: 0.6 });
  D.spawn('spark', W.player.x, W.player.y, 30, { speed: 3, life: 1.5 });
  show($('prompt'), false);
}
function endingUpdate(dt) {
  const e = END; e.t += dt;
  const u = clamp((e.t - 2.5) / e.dur, 0, 1);
  const k = u * u * (3 - 2 * u);
  e.s = k * e.total;
  // pulse point
  let i = e.gi;
  while (i > 0 && e.arc[i - 1] <= e.s) i--;
  const g = W.grey;
  e.px = g.x[i]; e.py = g.y[i];
  W.extraLights = u > 0 && u < 1 ? [{ x: e.px, y: e.py, r: 9, i: 2.2, c: [1, 0.25, 0.18], soft: 8 }] : [];
  for (const b of W.bells) if (!e.bellsRung.has(b) && Math.hypot(b.x - e.px, b.y - e.py) < 7) { e.bellsRung.add(b); W._ring(b); }
  if (u >= 1 && !e.said) {
    e.said = true;
    W.lamps = W.lamps.map((l) => (l.x < 20 && l.y > 0 ? { ...l, i: 2.6, r: 11 } : l));
    playLine('fin_b', L.FINALE.after);
    A.play('chime', { vol: 0.7, rate: 0.5, verb: 1.4 });
    D.spawn('spark', 13.5, 2.5, 40, { speed: 2.5, life: 2.5 });
  }
  if (e.said && e.t > 2.5 + e.dur + 9 && !e.done) {
    e.done = true;
    localStorage.removeItem(SAVE_KEY);
    state = 'credits';
    show($('credits'), true);
    setTimeout(() => $('credits').classList.add('rolling'), 2500);
    setTimeout(() => { $('credits').classList.remove('rolling'); show($('credits'), false); enterTitle(); }, 76000);
  }
}

// ── camera ───────────────────────────────────────────────────────────────
function updateCamera(dt) {
  const p = W.player, a = W.area();
  let tx, ty, vh;
  if (state === 'title') {
    tx = 27 + Math.sin(time * 0.05) * 1.5; ty = 5.5; vh = 15.5;
  } else if (state === 'ending' && END && END.t > 2.5) {
    tx = END.px; ty = END.py + 1; vh = END.s / END.total > 0.97 ? 15 : 22;
  } else {
    tx = p.x + clamp(p.vx * 0.35, -3, 3);
    ty = p.y + 1.2 + clamp(p.vy * 0.12, -2.5, 1);
    vh = a.viewH + (W.thread.locked && !p.grounded ? 2.5 : 0);
  }
  const rate = state === 'ending' ? 2.2 : 3.2;
  cam.x = damp(cam.x, tx, rate, dt); cam.y = damp(cam.y, ty, rate * 1.15, dt);
  cam.viewH = damp(cam.viewH, vh, 1.2, dt);
  const halfW = cam.viewH * R.w / R.h / 2;
  cam.x = clamp(cam.x, L.WORLD.x0 + halfW, L.WORLD.x0 + L.WORLD.w - halfW);
  cam.y = clamp(cam.y, L.WORLD.y0 + cam.viewH / 2, 30);
  cam.shake = Math.max(0, cam.shake - dt);
  ambient = ambient.map((v, i) => damp(v, a.amb[i], 1.5, dt));
  moon = damp(moon, a.moon, 1.5, dt);
}

// ── thread geometry for the GPU ──────────────────────────────────────────
function buildPts(viewW, viewH, k) {
  let n = 0;
  const mx = viewW / 2 + 3, my = viewH / 2 + 3;
  const inV = (x, y) => Math.abs(x - cam.x) < mx && Math.abs(y - cam.y) < my;
  let open = false;
  const put = (x, y, w, a, r, g, b) => { const o = n * 8; pts[o] = x; pts[o + 1] = y; pts[o + 2] = w; pts[o + 3] = a; pts[o + 4] = r; pts[o + 5] = g; pts[o + 6] = b; pts[o + 7] = 0; n++; };
  const brk = () => { if (open) { put(0, 0, 0, 0, 0, 0, 0); open = false; } };
  const wLive = Math.max(1.5, k * 0.024);
  // the knitter's grey thread
  const g = W.grey;
  const redTo = END ? END.s : -1;
  for (let i = 0; i < g.n; i++) {
    const x = g.x[i], y = g.y[i];
    if (!inV(x, y)) { brk(); continue; }
    let r = 0.6, gg = 0.58, b = 0.55, a = 0.75, w = Math.max(1, k * 0.014);
    if (END && i <= END.gi && END.arc[i] <= redTo) { r = 0.85; gg = 0.1; b = 0.1; a = 1; w = wLive * 0.85; }
    put(x, y, w, a, r, gg, b); open = true;
  }
  brk();
  // the red thread, doll → home
  // cull by segment, not by point: a long taut stretch (doll to a pivot far off screen) must still draw
  const th = W.thread, P = th.poly, N = th.polyN;
  const segV = (a, b) => {
    if (a < 0 || b >= N || P[b * 5 + 2] === 4) return false;
    const x0 = P[a * 5], y0 = P[a * 5 + 1], x1 = P[b * 5], y1 = P[b * 5 + 1];
    return Math.max(x0, x1) > cam.x - mx && Math.min(x0, x1) < cam.x + mx && Math.max(y0, y1) > cam.y - my && Math.min(y0, y1) < cam.y + my;
  };
  for (let j = 0; j < N; j++) {
    const o = j * 5;
    let x = P[o], y = P[o + 1];
    const st = P[o + 2], arc = P[o + 3], wear = P[o + 4];
    if (st === 4) brk();
    if (!inV(x, y) && !segV(j - 1, j) && !segV(j, j + 1)) { brk(); continue; }
    const wv = th.waveAt(arc);
    if (wv && j > 0 && j < th.polyN - 1) {
      const dx = P[o + 5] - P[o - 5], dy = P[o + 6] - P[o - 4], dl = Math.hypot(dx, dy) || 1;
      x += -dy / dl * wv; y += dx / dl * wv;
    }
    let r, gg, b, a = 1, w = wLive;
    if (st === 2) { r = 0.3; gg = 0.28; b = 0.27; a = 0.8; w = wLive * 0.7; }
    else if (st === 0) { r = 0.72; gg = 0.07; b = 0.07; w = wLive * 0.85; }
    else { r = 0.9; gg = 0.1; b = 0.09; }
    if (wear > 0) { const q = clamp(wear, 0, 1); r = lerp(r, 0.18, q); gg = lerp(gg, 0.05, q); w *= 1 - q * 0.55; }
    put(x, y, w, a, r, gg, b); open = true;
  }
  brk();
  return n;
}

// ── loop ─────────────────────────────────────────────────────────────────
let last = performance.now(), acc = 0;
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  time += dt;
  I.poll();
  if (state === 'title') navInput($('menu'));
  else if (paused) { navInput($('pmenu')); if (I.pressed.pause) setPaused(false); }
  else if (state === 'play' && I.pressed.pause) setPaused(true);
  if (state === 'credits' && (I.pressed.pause || I.pressed.act)) { $('credits').classList.remove('rolling'); show($('credits'), false); enterTitle(); }

  if (!paused && state !== 'credits') {
    acc += dt;
    let steps = 0;
    while (acc >= FIXED && steps < 10) {
      W.update(FIXED, I, state === 'play');
      if (steps === 0) for (const k in I.pressed) I.pressed[k] = false;
      handleEvents();
      acc -= FIXED; steps++;
    }
    if (steps >= 10) acc = 0;
    if (state === 'play' && !finAPlayed && Math.hypot(W.player.x - W.finale.x, W.player.y - W.finale.y) < 7) { finAPlayed = true; playLine('fin_a', L.FINALE.text); }
    if (state === 'ending') endingUpdate(dt);
    updateCamera(dt);
  }
  updateUI(dt);

  // audio continuous layers
  if (A) {
    const p = W.player, th = W.thread;
    const swing = th.locked && !p.grounded ? clamp(Math.hypot(p.vx, p.vy) / 9, 0, 1) * 0.5 : 0;
    let md = 99; for (const m of W.moths) md = Math.min(md, Math.hypot(m.x - cam.x, m.y - cam.y));
    A.update(dt, { cam: [cam.x, cam.y], swing: paused ? 0 : swing, moth: paused ? 0 : clamp(1 - md / 12, 0, 1) * 0.35, voice: voicePlaying > 0 });
  }

  // render
  const shake = cam.shake > 0 ? cam.shake * 0.35 : 0;
  const cx = cam.x + (Math.random() - 0.5) * shake, cy = cam.y + (Math.random() - 0.5) * shake;
  const viewW = cam.viewH * R.w / R.h;
  D.setView([cx, cy], cam.viewH, R.w, R.h);
  D.draw(R.sctx, R.ectx, paused ? 0 : dt, time);
  const k = R.h / cam.viewH;
  const nPts = buildPts(viewW, cam.viewH, k);
  const bg = [];
  L.BACKDROPS.forEach((b, i) => {
    const qx = b.cx + (cx - b.cx) * b.par, qy = b.cy + (cy - b.cy) * b.par;
    if (Math.abs(qx - b.cx) < b.w / 2 + viewW / 2 && Math.abs(qy - b.cy) < b.h / 2 + cam.viewH / 2) bg.push({ ...b, layer: i, alpha: 1 });
  });
  const ink = L.INK[0];
  const inkVis = Math.abs(cy - ink.y) < cam.viewH && cx + viewW / 2 > ink.x0 && cx - viewW / 2 < ink.x1;
  const deathFade = W.player.dead ? smooth(0.6, 1.5, W.player.deadT) * 0.85 : 0;
  const respawnFade = W.player.deadT === 0 && W._fadeIn ? 0 : 0;
  R.frame({
    cam: [cx, cy], viewH: cam.viewH, time, ambient, moon,
    lights: W.lights([cx, cy], viewW, cam.viewH), pts, nPts, bg: bg.slice(0, 4),
    inkPool: inkVis ? ink : null, fade: Math.max(deathFade, respawnFade), flash: 0, red: 1,
  });
  requestAnimationFrame(tick);
}

boot();
