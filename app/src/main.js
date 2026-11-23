// Spindledeep — boot, loop, camera, events → sound/fx/ui, menus, saves, the ending.
import { Renderer } from './renderer.js';
import { buildTerrain } from './terrain.js';
import { World } from './world.js';
import { Drawer } from './draw.js';
import { loadSprites } from './drawdeep.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { SWING } from './player.js';
import * as L from './level.js';
import { clamp, damp, lerp, smooth } from './util.js';

const SD = (window.__SD = { ready: false, errors: [] });
// session log (electron/main.js writes it to userData/logs): screens, menu choices, saves, deaths, errors
const log = (m) => { try { window.host?.log?.(m); } catch { /* ignore */ } };
addEventListener('error', (e) => { SD.errors.push(String(e.message)); log(`ERROR ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`); });
addEventListener('unhandledrejection', (e) => { SD.errors.push(String(e.reason?.message || e.reason)); log(`ERROR (promise) ${e.reason?.stack || e.reason}`); });
const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
// Hidden overlays only fade (opacity), so they are also made inert: a menu button that kept keyboard focus after
// a mouse click used to be "clicked" again by Enter/Space during play (Enter is the act key), which restarted the
// game from the prologue and wiped the save.
const show = (el, on) => {
  el.classList.toggle('hidden', !on);
  el.inert = !on;
  if (!on && el.contains(document.activeElement)) document.activeElement.blur();
};
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
    R.setSDF(T.visualHalf(L.SECRETS.map((s) => s.hide)));
    await step('engraving the dark…', 0.45);
    const layers = await Promise.all(L.BACKDROPS.map(async (b) => {
      try {
        const r = await fetch('assets/art/' + b.img + '.png');
        if (!r.ok) throw new Error('missing');
        return await createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      } catch {
        // a painting that isn't there yet: an empty layer (no tone, far depth) instead of failing to start
        log(`backdrop ${b.img} missing`);
        const c = new OffscreenCanvas(1024, 1024), x = c.getContext('2d');
        x.fillStyle = 'rgba(10,10,10,1)'; x.fillRect(0, 0, 1024, 1024);
        return createImageBitmap(c);
      }
    }));
    R.setBackdrops(layers);
    Drawer.IMG = await loadSprites();
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
    log('FATAL could not start: ' + (e.stack || e));
    $('fatal').textContent = 'Spindledeep could not start.\n\n' + (e.message || e) + '\n\nIt needs a GPU with WebGPU support (Windows 10/11, recent drivers).';
    show($('fatal'), true);
    return;
  }
  addEventListener('resize', () => R.resize());
  document.querySelectorAll('.hidden').forEach((el) => (el.inert = true));
  show($('loading'), false);
  log(`ready · ${R.w}x${R.h}`);
  enterTitle();
  SD.ready = true;
  Object.assign(SD, { W, R, A, cam, SWING, drawer: () => D, begin: () => startGame(false), cont: () => startGame(true), I: () => I, end: () => END, go: (x, y) => { W.player.dead = false; W.player.x = x; W.player.y = y; W.player.vx = W.player.vy = 0; cam.x = x; cam.y = y; snapOpen(); }, state: () => state, open: () => ({ open: Math.exp(camOpen), look: lookCam }) });
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
    b.tabIndex = -1;                                   // menus are driven by the game's own input, never by DOM focus
    b.onmousedown = (e) => e.preventDefault();         // a click must not leave the button focused
    b.onmouseenter = () => selectItem(nav, i);
    b.onclick = () => { if (!menuLive(nav)) { log(`ignored click on "${it.label}" (state ${state})`); return; } log(`menu "${it.label}" (mouse)`); A?.resume(); it.fn(); };
    nav.appendChild(b);
  });
  selectItem(nav, 0);
}
// a menu only acts while its own screen is up: the title menu on the title, the pause menu while paused
function menuLive(nav) { return nav.id === 'menu' ? state === 'title' : paused; }
function selectItem(nav, i) {
  nav._sel = (i + nav._items.length) % nav._items.length;
  [...nav.children].forEach((b, k) => b.classList.toggle('sel', k === nav._sel));
}
function navInput(nav) {
  if (I.pressed.up) { selectItem(nav, nav._sel - 1); A.play('step1', { vol: 0.2, verb: 0.2 }); }
  if (I.pressed.down) { selectItem(nav, nav._sel + 1); A.play('step2', { vol: 0.2, verb: 0.2 }); }
  if (I.pressed.act || I.pressed.jump) { log(`menu "${nav._items[nav._sel].label}" (keys)`); A.resume(); nav._items[nav._sel].fn(); }
}

function enterTitle() {
  state = 'title';
  // back from the credits (or the pause menu) the title shows a fresh world, not the last run's red thread and lamps
  END = null; CUT = null;
  W = new World(T); D = new Drawer(W); SD.W = W;
  R.setSDF(T.visualHalf(W.secrets.map((k) => k.hide)));
  const has = !!loadSave(true);
  log(`title screen · save ${has ? 'present' : 'none'}`);
  const items = [];
  if (has) items.push({ label: 'Continue', fn: () => startGame(true) });
  items.push({ label: has ? 'Begin anew' : 'Begin', fn: () => playCine('intro', () => startGame(false)) });
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
  if (cont) applySave(loadSave()); else clearSave();
  log(cont ? `continue run from pole ${W.checkpoint.i}` : 'NEW RUN (save replaced)');
  R.setSDF(T.visualHalf(W.secrets.filter((k) => !k.seen).map((k) => k.hide)));
  finAPlayed = false;
  END = null; CUT = null;        // the last ending's red pulse lived here: left set, it kept her grey thread red in the next run
  state = 'play';
  A.setMusic(null, 4);
  A.endMusic = false;
  cam.x = W.player.x; cam.y = W.player.y + 1; snapOpen();
  SD.W = W;
  save();            // a new run replaces the old save at once; a continued one is re-written as is
}
function setPaused(on) {
  paused = on;
  log(on ? 'paused' : 'resumed');
  show($('pause'), on);
  if (on) {
    menu($('pmenu'), [
      { label: 'Resume', fn: () => setPaused(false) },
      { label: 'Fullscreen', fn: toggleFullscreen },
      { label: `Volume · ${Math.round((settings.volume ?? 1) * 100)}%`, fn: () => { const v = [1, 0.7, 0.45, 0.2, 0][([1, 0.7, 0.45, 0.2, 0].indexOf(settings.volume ?? 1) + 1) % 5]; settings.volume = v; A.setVolume(v); window.host?.setSettings?.(settings); setPaused(true); } },
      { label: 'Return to the cottage', fn: () => { save(); setPaused(false); enterTitle(); } },
      { label: 'Leave', fn: () => { save(); window.host?.quit?.(); } },
    ]);
    A.ctx.suspend();
  } else A.resume();
}

// ── saves ────────────────────────────────────────────────────────────────
// The run is saved at every peg (the checkpoint you respawn and continue from), at bells, memories and keepsakes,
// and when the game is left or closed. It goes to userData/save.json through the main process (survives a crash);
// localStorage keeps a copy, and is read only if there is no file (saves from before the file existed).
let saveTxt;
function readSaveTxt() {
  if (saveTxt === undefined) {
    try { saveTxt = window.host?.readSave?.() ?? null; } catch { saveTxt = null; }
    if (!saveTxt) try { saveTxt = localStorage.getItem(SAVE_KEY); } catch { saveTxt = null; }
  }
  return saveTxt;
}
function clearSave() {
  log('save cleared');
  saveTxt = null;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  try { window.host?.clearSave?.(); } catch { /* ignore */ }
}
addEventListener('beforeunload', () => save());
function save() {
  if (state !== 'play' || !W) return;
  const th = W.thread;
  const n = th.fixedN;
  const data = {
    v: 2, cp: W.checkpoint.i, skeins: W.skeins.map((s) => s.taken), keeps: W.secrets.map((s) => (s.taken ? 2 : 0) + (s.seen ? 1 : 0)), mem: W.memories.map((m) => m.heard), bells: W.bells.map((b) => b.lit > 0),
    areas: [...W.areaSeen], pegs: W.pegs.map((p) => p.tied),
    husks: W.husks.map((h) => [+h.x.toFixed(2), +h.y.toFixed(2), h.kind, h.flip, h.seed]),
    tx: Array.from(th.x.subarray(0, n), (v) => +v.toFixed(2)), ty: Array.from(th.y.subarray(0, n), (v) => +v.toFixed(2)),
    dead: Array.from(th.dead.subarray(0, n)),
  };
  saveTxt = JSON.stringify(data);
  try { localStorage.setItem(SAVE_KEY, saveTxt); } catch { /* ignore */ }
  let ok = false;
  try { ok = window.host?.writeSave?.(saveTxt); } catch { /* ignore */ }
  log(`saved · pole ${data.cp}${ok === false ? ' · FILE WRITE FAILED' : ''}`);
}
function loadSave(peek) { try { const s = JSON.parse(readSaveTxt()); return s && s.cp !== undefined ? s : null; } catch { return null; } }
function applySave(s) {
  if (!s) return;
  const th = W.thread;
  W.skeins.forEach((k, i) => (k.taken = !!s.skeins[i]));
  W.skeinCount = W.skeins.filter((k) => k.taken).length;
  W.secrets.forEach((k, i) => { const v = (s.keeps || [])[i] || 0; k.taken = !!(v & 2); k.seen = !!(v & 1); });
  W.memories.forEach((m, i) => (m.heard = !!s.mem[i]));
  W.bells.forEach((b, i) => { if (s.bells[i]) b.lit = 1; });
  W.pegs.forEach((p, i) => (p.tied = !!s.pegs[i]));
  W.gates.forEach((g) => { const bs = W.bells.filter((b) => b.gate === g.id); if (bs.length && bs.every((b) => b.lit > 0)) g.open = 1; });
  // saves from before the deep (no v): their 'loom' was the chamber that is now the Hall of Chairs
  s.areas.forEach((a) => W.areaSeen.add(!s.v && a === 'loom' ? 'hall' : a));
  W.husks = (s.husks || []).map(([x, y, kind, flip, seed]) => ({ x, y, kind, flip, seed }));
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
  const p2 = playing && p && W.prompt2 ? W.prompt2 : null;
  const ps = (p ? keysHTML([p.a]) + ' <span>' + p.t + '</span>' : '') + (p2 ? ' &nbsp;&nbsp;·&nbsp;&nbsp; ' + keysHTML([p2.a]) + ' <span>' + p2.t + '</span>' : '');
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
        log(`tied to pole ${W.checkpoint.i} at ${e.x.toFixed(1)},${e.y.toFixed(1)}`);
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
        log(`death · ${e.cause} at ${e.x.toFixed(1)},${e.y.toFixed(1)}`);
        A.play('tear', { vol: 0.9, x: e.x, y: e.y });
        if (e.cause === 'ink') A.play('splash', { vol: 0.9, rate: 0.7, x: e.x, y: e.y });
        D.spawn('fiber', e.x, e.y, 40, { speed: 3, life: 2 });
        cam.shake = 0.4;
        break;
      case 'respawn': snapOpen(); log(`respawn at pole ${W.checkpoint.i}`); A.play('mend', { vol: 0.4, x: e.x, y: e.y }); D.spawn('spark', e.x, e.y, 12, { speed: 1.5, life: 1 }); break;
      case 'skein':
        A.play('skein', { vol: 0.7, x: e.x, y: e.y }); D.spawn('spark', e.x, e.y + 0.3, 20, { speed: 2, life: 1.2 });
        toast(`a skein of her red yarn · ${e.n} of ${W.skeins.length}`, 3);
        break;
      case 'secret': R.patchSDF(T.revealPatch(e.hide, W.secrets.filter((k) => !k.seen).map((k) => k.hide))); card(e.name); A.play('chime', { vol: 0.35, rate: 1.3, x: e.x, y: e.y }); break;
      case 'keepsake':
        A.play('skein', { vol: 0.6, rate: 1.25, x: e.x, y: e.y }); A.play('chime', { vol: 0.4, rate: 1.6, x: e.x, y: e.y });
        D.spawn('pale', e.x, e.y + 0.2, 1, { speed: 0, life: 1.6 }); D.spawn('spark', e.x, e.y + 0.2, 10, { speed: 1.2, life: 1 });
        toast(`${e.what} · ${e.text} · keepsake ${e.n} of ${e.of}`, 6);
        save();
        break;
      case 'memory': playLine(e.id, e.text); A.play('chime', { vol: 0.5, x: e.x, y: e.y }); D.spawn('pale', e.x, e.y, 1, { speed: 0, life: 2 }); save(); break;
      case 'area': log(`entered ${e.name}`); if (state === 'play') card(e.name); else W.areaSeen.delete(e.id); A.setArea(e.id); break;
      case 'areaQuiet': A.setArea(e.id); break;
      case 'drip': A.play('drip', { vol: 0.5, vary: 0.2, x: e.x, y: e.y, verb: 1 }); break;
      case 'splash': A.play('splash', { vol: 0.35, vary: 0.2, x: e.x, y: e.y }); D.spawn('splash', e.x, e.y, 6, { speed: 2.5, vy: 2, life: 0.8 }); break;
      case 'finale': log('finale · tied'); startEnding(); break;
      case 'finaleCut': log('finale · bitten through'); startCut(); break;
      case 'climb': A.pick(['step1', 'step3'], { vol: 0.22, rate: 1.3, vary: 0.2, x: p.x, y: p.y, verb: 0.3 }); break;
      case 'reach': A.play('chew', { vol: 0.3, rate: 0.55, vary: 0.2, x: e.x, y: e.y, verb: 0.8 }); A.play('creak', { vol: 0.15, rate: 0.5, x: e.x, y: e.y }); break;
      case 'recoil': A.play('release', { vol: 0.35, rate: 0.6, vary: 0.2, x: e.x, y: e.y, verb: 0.6 }); break;
      case 'stampWarn': A.play('creak', { vol: 0.45, rate: e.kind === 'needle' ? 1.4 : 0.55, x: e.x, y: e.y, verb: 0.5 }); break;
      case 'stamp':
        A.play('land', { vol: 0.9, rate: e.kind === 'needle' ? 1.6 : 0.4, x: e.x, y: e.y, verb: 1.2 });
        if (e.kind !== 'needle') { A.play('gate', { vol: 0.25, rate: 1.8, x: e.x, y: e.y }); if (state === 'play' && Math.hypot(e.x - p.x, e.y - p.y) < 14) cam.shake = Math.max(cam.shake, 0.18); }
        break;
      case 'rise':
        log('the Weaver wakes');
        A.play('tear', { vol: 1.0, rate: 0.35, verb: 1.6 }); A.play('gate', { vol: 0.8, rate: 0.45, verb: 1.4 }); A.play('chew', { vol: 0.6, rate: 0.3, verb: 1.5 });
        cam.shake = 0.9;
        if (e.first) toast('the cloth is rising · climb', 4);
        break;
      case 'riseStop': A.play('gate', { vol: 0.6, rate: 0.6, verb: 1.4 }); break;
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
  END = { t: 0, arc, total: arc[0], gi, dur: 40, said: false, bellsRung: new Set(), done: false };
  A.endMusic = true;
  A.setMusic('mus_end', 3);
  A.play('tie', { vol: 0.8 }); A.play('chime', { vol: 0.6, rate: 0.6 });
  // her candle goes out the moment the threads are tied
  W.candleOut = W.time;
  W.lamps = W.lamps.filter((l) => !l.finale);
  A.play('release', { vol: 0.5, rate: 0.45, x: 19, y: W.finale.y });
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
    clearSave();
    playCine('outro', rollCredits);
  }
}

// ── the other ending: she bites through the old woman's thread ───────────────
let CUT = null;
function startCut() {
  state = 'ending';
  CUT = { t: 0, stage: 0 };
  A.endMusic = true;
  A.setMusic(null, 2);
  A.play('cut', { vol: 0.9 }); A.play('tear', { vol: 0.5, rate: 0.8 });
  show($('prompt'), false);
  playLine('fin_cut', L.FINALE.cut);
  // her grey thread goes slack from her hands: everything above her goes dark grey
  W.greyCut = W.time;
}
function cutUpdate(dt) {
  const c = CUT; c.t += dt;
  const th = W.thread, p = W.player;
  if (c.stage === 0 && c.t > 6) {
    c.stage = 1;
    W.candleOut = W.time; W.lamps = W.lamps.filter((l) => !l.finale);
    A.play('release', { vol: 0.5, rate: 0.45, x: 19, y: W.finale.y });
  }
  if (c.stage === 1 && c.t > 10) {
    // something below takes hold of the red thread: it pulls taut, and the doll bites through her own
    c.stage = 2;
    A.play('snag', { vol: 0.9, rate: 0.5 }); A.play('creak', { vol: 0.6, rate: 0.4 }); cam.shake = 0.5;
    th.pluck(2.5);
  }
  if (c.stage === 2 && c.t > 13.5) {
    c.stage = 3;
    for (let i = 0; i < th.n; i++) th.dead[i] = 1;
    th.liveStart = th.n; th.anchored = false; th.locked = false; th.pivots = [];
    A.play('cut', { vol: 1.0, rate: 0.8 }); D.spawn('fiber', p.x, p.y + 0.2, 20, { speed: 1.5, life: 1.6 });
  }
  if (c.stage >= 3) c.dark = clamp((c.t - 14) / 5, 0, 1);
  if (c.stage === 3 && c.t > 21) { c.stage = 4; endCards(['That winter, no name was called up the well.', 'In the spring, the snow on the Brink began to melt.'], () => { c.stage = 5; }); }
  if (c.stage === 5 && !c.done) { c.done = true; clearSave(); rollCredits(true); }
}
function endCards(lines, done) {
  const el = $('endcard');
  let i = 0;
  const next = () => {
    if (i >= lines.length) { show(el, false); setTimeout(done, 2200); return; }
    el.textContent = lines[i++]; show(el, true);
    setTimeout(() => { show(el, false); setTimeout(next, 2200); }, 5200);
  };
  next();
}

function rollCredits(cut) {
  log('credits');
  $('credits').classList.toggle('cut', !!cut);
  state = 'credits';
  const ks = W.secrets.filter((k) => k.taken);
  $('ckeeps').textContent = ks.length ? `${ks.length} of ${W.secrets.length} · ${ks.map((k) => k.what).join(' · ')}` : `none of ${W.secrets.length} · they are still down there`;
  show($('credits'), true);
  setTimeout(() => $('credits').classList.add('rolling'), 2500);
  setTimeout(() => { if (state !== 'credits') return; $('credits').classList.remove('rolling'); show($('credits'), false); if (cut) coda(); else enterTitle(); }, 76000);
}
// after the credits of the second ending: the doll in her chair at the top of the Loom, in the dark, and needles
function coda() {
  log('coda');
  state = 'coda';
  CUT = { t: 0, coda: true, dark: 0.82 };
  const f = W.finale;
  W.player.dead = false; W.player.x = f.x + 1.2; W.player.y = f.y + 0.32; W.player.vx = W.player.vy = 0; W.player.facing = -1;
  W.coda = true;
  cam.x = f.x + 1; cam.y = f.y + 1.2; cam.viewH = 7;
  A.setMusic(null, 1);
  let n = 0;
  const tick = () => {
    if (state !== 'coda') return;
    A.play('snag', { vol: 0.12, rate: 2.6 + Math.random() * 0.3, x: cam.x, y: cam.y });
    if (++n < 40) setTimeout(tick, 380 + Math.random() * 160);
    else setTimeout(() => { if (state === 'coda') enterTitle(); }, 3000);
  };
  setTimeout(tick, 2500);
}

// ── cinematics ──────────────────────────────────────────────────────────
// Offline-rendered films (scripts/cine) shown full screen; hold any action to skip. If a film is missing
// or can't play, the game simply carries on.
let cine = null;
function playCine(name, onEnd) {
  const v = $('cine');
  log(`film ${name} start`);
  cine = { onEnd, hold: 0, hint: 0, done: false, prev: state, name };
  state = 'cine';
  show($('title'), false);
  A.master.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3);
  v.src = 'assets/cine/' + name + '.mp4';
  v.volume = Math.min(1, settings.volume ?? 1);
  v.onended = endCine; v.onerror = () => { log(`film ${name} failed to play: ${v.error?.message || v.error?.code}`); endCine(); };
  v.play().then(() => show(v, true)).catch(endCine);
}
function endCine() {
  if (!cine || cine.done) return;
  cine.done = true;
  log(`film ${cine.name} end (${cine.hold > 0.9 ? 'skipped' : 'finished'})`);
  const v = $('cine'), f = cine.onEnd;
  show(v, false); show($('skip'), false);
  setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); }, 900);
  A.setVolume(A.volume);
  cine = null;
  f();
}
function cineUpdate(dt) {
  if (!cine) return;
  const anyHeld = I.held.act || I.held.jump || I.held.pause || I.held.grip;
  const anyPressed = Object.values(I.pressed).some(Boolean);
  if (anyPressed) cine.hint = 2.5;
  cine.hint = Math.max(0, cine.hint - dt);
  cine.hold = anyHeld ? cine.hold + dt : Math.max(0, cine.hold - dt * 2);
  show($('skip'), cine.hint > 0 || cine.hold > 0);
  $('skip').querySelector('i').style.width = Math.min(100, cine.hold / 0.9 * 100) + '%';
  if (cine.hold > 0.9) endCine();
}

// ── camera ───────────────────────────────────────────────────────────────
// How open the cave is around the doll: 24 rays marched through the collision SDF (rooms nobody has found
// yet count as rock, so the zoom never gives them away), averaged geometrically so a low ceiling or a tight
// wall pulls harder than one long sightline. Measured over every standing spot in the world this runs from
// ~1 m (crawls) to ~12 m (the Mere, the Loom), median 5.7 m; the camera scales each area's base view by it.
const OPEN = { rays: 24, max: 40, mid: 5.7, pow: 0.45, lo: 0.66, hi: 1.42, vhMax: 31 };
function openness(x, y) {
  const T = W.T;
  let s = 0;
  for (let i = 0; i < OPEN.rays; i++) {
    const ang = (i + 0.5) / OPEN.rays * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang);
    let t = 0;
    for (let k = 0; k < 80 && t < OPEN.max; k++) {
      const qx = x + dx * t, qy = y + dy * t;
      const d = T.d(qx, qy);
      if (d < 0.02 || W.hiddenAt(qx, qy)) break;
      t += Math.max(d, 0.08);
    }
    s += Math.log(clamp(t, 0.5, OPEN.max));
  }
  return s / OPEN.rays;                 // log of the geometric-mean distance
}
let camOpen = Math.log(OPEN.mid);      // smoothed log openness
function snapOpen() { camOpen = openness(W.player.x, W.player.y + 1.2); }   // after a teleport/respawn: no slow drift from the old room
let lookT = 0, lookCam = 0;            // look up/down: how long it's been held, and the eased camera pan (-1..1)
function updateCamera(dt) {
  const p = W.player, a = W.area();
  let tx, ty, vh;
  // look up / down (W/S, arrows, stick): only standing free, since the same keys reel the thread and climb ropes
  const canLook = state === 'play' && !p.dead && p.grounded && !p.climb && !W.thread.locked && !SD.viewLock;
  const ay = canLook ? I.axisY : 0;
  lookT = ay ? lookT + dt : 0;
  p.look = damp(p.look || 0, ay, 9, dt);                                   // her head turns at once
  lookCam = damp(lookCam, lookT > 0.2 ? Math.sign(ay) : 0, 2.6, dt);       // the view follows a beat later
  if (state === 'title') {
    tx = 27 + Math.sin(time * 0.05) * 1.5; ty = 5.5; vh = 15.5;
  } else if (state === 'ending' && CUT && !CUT.coda) {
    tx = W.finale.x + 1.5; ty = W.finale.y + 1.2 - (CUT.t > 10 ? Math.min(6, (CUT.t - 10) * 0.6) : 0); vh = 11 + Math.min(10, CUT.t * 0.5);
  } else if (state === 'ending' && END && END.t > 2.5) {
    tx = END.px; ty = END.py + 1; vh = END.s / END.total > 0.97 ? 15 : 22;
  } else {
    tx = p.x + clamp(p.vx * 0.35, -3, 3);
    ty = p.y + 1.2 + clamp(p.vy * 0.12, -2.5, 1);
    camOpen = damp(camOpen, openness(p.x, p.y + 1.2), 0.8, dt);
    const room = clamp(Math.pow(Math.exp(camOpen) / OPEN.mid, OPEN.pow), OPEN.lo, OPEN.hi);
    vh = Math.min(OPEN.vhMax, a.viewH * room) + (W.thread.locked && !p.grounded ? 2.5 : 0);
    if (a.id === 'loom' && p.y > -452) vh = 12.5;          // at the top of the Loom: close on her
    ty += lookCam * (lookCam > 0 ? 0.26 : 0.32) * vh;        // a little more room looking down: that's where the falls are
  }
  const rate = state === 'ending' ? 2.2 : 3.2;
  cam.x = damp(cam.x, tx, rate, dt); cam.y = damp(cam.y, ty, rate * 1.15, dt);
  cam.viewH = SD.viewLock ? SD.viewLock : damp(cam.viewH, vh, state === 'play' ? 0.9 : 1.2, dt);
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
    if (W.greyCut !== undefined && i <= W.finale.gi) { r = 0.3; gg = 0.29; b = 0.28; a = 0.55; }      // bitten through: dead yarn
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
  if (state === 'cine') { cineUpdate(dt); for (const k in I.pressed) I.pressed[k] = false; }
  if (state === 'credits' && (I.pressed.pause || I.pressed.act)) { $('credits').classList.remove('rolling'); show($('credits'), false); if ($('credits').classList.contains('cut')) coda(); else enterTitle(); }
  if (state === 'coda' && (I.pressed.pause || I.pressed.act)) enterTitle();

  if (state === 'coda') { W.time += dt; }
  if (!paused && state !== 'credits' && state !== 'cine' && state !== 'coda') {
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
    if (state === 'ending') { if (CUT && !CUT.coda) cutUpdate(dt); else endingUpdate(dt); }
    updateCamera(dt);
  }
  updateUI(dt);

  // audio continuous layers
  if (A) {
    const p = W.player, th = W.thread;
    const swing = th.locked && !p.grounded ? clamp(Math.hypot(p.vx, p.vy) / 9, 0, 1) * 0.5 : 0;
    let md = 99; for (const m of W.moths) md = Math.min(md, Math.hypot(m.x - cam.x, m.y - cam.y));
    A.update(dt, { cam: [cam.x, cam.y], swing: paused ? 0 : swing, moth: paused ? 0 : clamp(1 - md / 12, 0, 1) * 0.35, voice: voicePlaying > 0, out: state === 'title' ? 1 : D.out, gust: D.gust, under: W.area().id === 'throat' ? 1 : 0 });
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
  const deathFade = Math.max(W.player.dead && state === 'play' ? smooth(0.6, 1.5, W.player.deadT) * 0.85 : 0, CUT ? (CUT.dark || 0) : 0);
  const respawnFade = W.player.deadT === 0 && W._fadeIn ? 0 : 0;
  R.frame({
    cam: [cx, cy], viewH: cam.viewH, time, ambient, moon,
    lights: W.lights([cx, cy], viewW, cam.viewH), pts, nPts, bg: bg.slice(0, 4),
    inkPool: inkVis ? ink : null, fade: Math.max(deathFade, respawnFade), flash: 0, red: 1,
  });
  requestAnimationFrame(tick);
}

boot();
