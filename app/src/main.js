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
// ── passages: no screen change is ever a hard cut ────────────────────────
// Every change of screen (title, films, the game, credits, leaving) goes out to black through the #veil, sound
// down with it, does its work in the dark, holds a caption with a running thread while anything loads, and comes
// back in. In-game moments that used to pop (respawn, a hidden room opening, overlay text changing) ease too.
let busy = false;                    // a passage is running: menus, pause and skip ignore input
const wait = (secs) => new Promise((r) => setTimeout(r, secs * 1000));
function veil(on, secs = 0.9, caption = '') {
  const el = $('veil');
  el.style.transitionDuration = secs + 's';
  // the caption and thread come up only once the screen is black, never over the screen that is leaving
  for (const c of el.children) c.style.transitionDelay = on ? (secs * 0.9).toFixed(2) + 's' : '0s';
  if (on) { el.querySelector('.vmsg').textContent = caption; el.classList.toggle('cap', !!caption); } else el.classList.remove('cap');
  show(el, on);
  return wait(secs);
}
const veiled = () => !$('veil').classList.contains('hidden');
async function passage(work, { caption = '', out = 0.9, hold = 0, back = 1.2, sound = true } = {}) {
  if (busy) return;
  busy = true;
  log(`passage${caption ? ' · ' + caption : ''}`);
  try {
    if (sound && A) A.fadeMaster(0, out / 3);
    await veil(true, out, caption);
    const t0 = performance.now();
    const r = await work();
    const left = hold - (performance.now() - t0) / 1000;
    if (left > 0) await wait(left);
    if (r !== 'keep') veil(false, back);          // 'keep': the work lifts the veil itself (a film, once it plays)
  } catch (e) { log('passage error ' + (e.stack || e)); veil(false, 0.6); } finally { busy = false; }
}
// overlay text that changes while it is on screen fades out, swaps, and fades back in instead of jumping
function setText(el, val, html = false) {
  const cur = html ? el.innerHTML : el.textContent;
  if (cur === val && !el._sw) return;
  const put = () => { if (html) el.innerHTML = val; else el.textContent = val; };
  clearTimeout(el._sw); el._sw = 0;
  if (!cur || +getComputedStyle(el).opacity < 0.05) { el.classList.remove('swapping'); put(); return; }
  el.classList.add('swapping');
  el._sw = setTimeout(() => { put(); el.classList.remove('swapping'); el._sw = 0; }, 300);
}
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
  Object.assign(SD, { W, R, A, cam, SWING, drawer: () => D, begin: () => startGame(false), walkOut: () => startGame(false, true), cont: () => startGame(true), I: () => I, end: () => END, go: (x, y) => { W.player.dead = false; W.player.x = x; W.player.y = y; W.player.vx = W.player.vy = 0; cam.x = x; cam.y = y; snapOpen(); }, state: () => state, open: () => ({ open: Math.exp(camOpen), look: lookCam }) });
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
function menuLive(nav) { return !busy && (nav.id === 'menu' ? state === 'title' : paused); }
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
  END = null; CUT = null; clearShow();
  W = new World(T); D = new Drawer(W); SD.W = W;
  R.setSDF(T.visualHalf(W.secrets.map((k) => k.hide)));
  const has = !!loadSave(true);
  log(`title screen · save ${has ? 'present' : 'none'}`);
  const items = [];
  if (has) items.push({ label: 'Continue', fn: () => passage(() => startGame(true), { caption: `back down to ${saveArea()}…`, hold: 1.6, back: 1.6 }) });
  items.push({ label: has ? 'Begin anew' : 'Begin', fn: () => passage(async () => { await wait(1.1); playCine('intro', () => startGame(false, true)); return 'keep'; }, { caption: 'the snow is coming…', out: 1.3 }) });
  items.push({ label: 'Fullscreen', fn: toggleFullscreen });
  items.push({ label: 'Leave', fn: leave });
  menu($('menu'), items);
  show($('title'), true);
  A.stormStop(); A.fadeMaster(A.volume, 0.6);
  ambient = L.AREAS[0].amb.slice(); moon = L.AREAS[0].moon;
  A.setArea('brink');
  A.setMusic('mus_title', 3);
  cam.x = 27; cam.y = 5.5; cam.viewH = 15.5;
}
// where a saved run stands, for the Continue caption ("back down to the Bell Gallery…")
function saveArea() {
  const s = loadSave(true), pg = s && L.PEGS[s.cp];
  const inA = (a) => pg.y <= a.y1 && pg.y > a.y0;
  const a = pg && (L.AREAS.find((a) => inA(a) && (a.x0 === undefined || pg.x >= a.x0) && (a.x1 === undefined || pg.x <= a.x1)) || L.AREAS.find(inA));
  return a ? a.name.replace(/^The /, 'the ') : 'the thread';
}
// leaving fades the picture and the sound out before the window closes
function leave() {
  passage(async () => { save(); await wait(0.25); if (window.host?.quit) window.host.quit(); else window.close(); return 'keep'; }, { out: 1.3 });
}
function toggleFullscreen() {
  // the window changes size: blink through black so the layout jump is never seen
  passage(() => { toggleFullscreenNow(); return wait(0.35); }, { out: 0.3, back: 0.6, sound: false });
}
function toggleFullscreenNow() {
  settings.fullscreen = !document.fullscreenElement && !(window.innerHeight === screen.height);
  window.host?.setFullscreen?.(settings.fullscreen);
  window.host?.setSettings?.(settings);
}
function clearShow() { if (SHOW) { SHOW = null; show($('show'), false); } }
function startGame(cont, walkOut = false) {
  clearShow();
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
  if (walkOut) beginWalkOut(); else { A.fadeMaster(A.volume, 0.6); camSnap = true; }
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
      { label: 'Return to the cottage', fn: () => passage(() => { save(); unpauseQuiet(); enterTitle(); }, { caption: 'back up to the cottage…', hold: 1.2, back: 1.6 }) },
      { label: 'Leave', fn: leave },
    ]);
    // the sound breathes out over a fifth of a second before the audio clock stops (suspending at once clicked)
    A.fadeMaster(0, 0.06);
    clearTimeout(setPaused._t); setPaused._t = setTimeout(() => { if (paused) A.ctx.suspend(); }, 320);
  } else { clearTimeout(setPaused._t); A.resume(); A.fadeMaster(A.volume, 0.12); }
}
// leave the pause menu without bringing the sound back (a passage is taking the screen away)
function unpauseQuiet() { paused = false; show($('pause'), false); clearTimeout(setPaused._t); A.resume(); }

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
  setText(el, text);
  show(el, true);
  subTimer = secs;
}
function card(name) {
  const el = $('card');
  setText(el.querySelector('.name'), name);
  show(el, true);
  cardTimer = 4.2;
}
function toast(text, secs = 2.6) { if (state !== 'play') return; const el = $('toast'); setText(el, text); show(el, true); toastTimer = secs; }
function keysHTML(keys) { return (keys || []).map((k) => `<kbd>${I.label(k)}</kbd>`).join(' '); }
let lastHint = '', lastPrompt = '';
function updateUI(dt) {
  if (subTimer > 0) { subTimer -= dt; if (subTimer <= 0) show($('sub'), false); }
  if (cardTimer > 0) { cardTimer -= dt; if (cardTimer <= 0) show($('card'), false); }
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) show($('toast'), false); }
  const playing = state === 'play' && !paused && !SHOW;
  const h = playing && W.hint && subTimer <= 0 ? W.hint : null;
  const hs = h ? keysHTML(h.keys) + ' <span>' + h.text + '</span>' : '';
  if (hs !== lastHint) { lastHint = hs; if (hs) setText($('hint'), hs, true); show($('hint'), !!hs); }
  const p = playing && W.prompt ? W.prompt : null;
  const p2 = playing && p && W.prompt2 ? W.prompt2 : null;
  const ps = (p ? keysHTML([p.a]) + ' <span>' + p.t + '</span>' : '') + (p2 ? ' &nbsp;&nbsp;·&nbsp;&nbsp; ' + keysHTML([p2.a]) + ' <span>' + p2.t + '</span>' : '');
  if (ps !== lastPrompt) { lastPrompt = ps; if (ps) setText($('prompt'), ps, true); show($('prompt'), !!ps); }
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
      case 'respawn': snapOpen(); camSnap = true; respawnT = time; log(`respawn at pole ${W.checkpoint.i}`); A.play('mend', { vol: 0.4, x: e.x, y: e.y }); D.spawn('spark', e.x, e.y, 12, { speed: 1.5, life: 1 }); break;
      case 'skein':
        A.play('skein', { vol: 0.7, x: e.x, y: e.y }); D.spawn('spark', e.x, e.y + 0.3, 20, { speed: 2, life: 1.2 });
        startShow({ kind: 'skein', x: e.x, y: e.y + 0.22, name: 'A skein of her red yarn', desc: 'Wound tight, the colour of the thread. It will reach further now.',
          count: e.n >= W.skeins.length ? `the last skein · all ${W.skeins.length} found` : `skein ${e.n} of ${W.skeins.length}` });
        break;
      case 'secret': startReveal(e); card(e.name); A.play('chime', { vol: 0.35, rate: 1.3, x: e.x, y: e.y }); break;
      case 'keepsake':
        A.play('skein', { vol: 0.6, rate: 1.25, x: e.x, y: e.y }); A.play('chime', { vol: 0.4, rate: 1.6, x: e.x, y: e.y });
        D.spawn('pale', e.x, e.y + 0.2, 1, { speed: 0, life: 1.6 }); D.spawn('spark', e.x, e.y + 0.2, 10, { speed: 1.2, life: 1 });
        startShow({ kind: e.kind, x: e.x, y: e.y + 0.15, name: e.what.charAt(0).toUpperCase() + e.what.slice(1), desc: e.text,
          count: e.n >= e.of ? `keepsake ${e.n} of ${e.of} · the last of them` : `keepsake ${e.n} of ${e.of}` });
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
    passage(() => { playCine('outro', () => rollCredits(false, true)); return 'keep'; }, { out: 2.4 });
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

function rollCredits(cut, instant) {
  log('credits');
  // after the epilogue film the credits must already be there as the film fades, or the game shows through
  if (instant) { const c = $('credits'); c.style.transition = 'none'; show(c, true); void c.offsetWidth; c.style.transition = ''; }
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
    else setTimeout(() => { if (state === 'coda') passage(() => enterTitle(), { out: 2.2, back: 1.6 }); }, 3000);
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
  v.play().then(() => { show(v, true); if (veiled()) veil(false, 1.4); }).catch(endCine);
}
function endCine() {
  if (!cine || cine.done) return;
  cine.done = true;
  log(`film ${cine.name} end (${cine.hold > 0.9 ? 'skipped' : 'finished'})`);
  const v = $('cine'), f = cine.onEnd;
  show(v, false); show($('skip'), false);
  if (veiled() && !busy && !cine.skipping) veil(false, 1.0);    // a film that failed to start under the veil
  setTimeout(() => { v.pause(); v.removeAttribute('src'); v.load(); }, 900);
  if (cine.name === 'intro') A.storm(0.6); else A.setVolume(A.volume);
  cine = null;
  f();
}
function cineUpdate(dt) {
  if (!cine) return;
  const vid = $('cine');
  if (cine.name === 'intro' && vid.duration && vid.currentTime > vid.duration - 4.2) A.storm(2.4);
  const anyHeld = I.held.act || I.held.jump || I.held.pause || I.held.grip;
  const anyPressed = Object.values(I.pressed).some(Boolean);
  if (cine.skipping) return;
  if (anyPressed) cine.hint = 2.5;
  cine.hint = Math.max(0, cine.hint - dt);
  cine.hold = anyHeld ? cine.hold + dt : Math.max(0, cine.hold - dt * 2);
  show($('skip'), cine.hint > 0 || cine.hold > 0);
  $('skip').querySelector('i').style.width = Math.min(100, cine.hold / 0.9 * 100) + '%';
  if (cine.hold > 0.9 && !cine.skipping) {
    // skipped: the film's sound runs down and the picture goes through black rather than being cut off
    cine.skipping = true; log(`film ${cine.name} skipping`);
    const v0 = vid.volume, t0 = performance.now();
    const fade = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / 700); vid.volume = v0 * (1 - k); if (k >= 1) clearInterval(fade); }, 30);
    show($('skip'), false);
    veil(true, 0.7).then(() => { endCine(); veil(false, 1.0); });
  }
}

// ── out of the cottage ──────────────────────────────────────────────────
// After the prologue the game doesn't cut in on her standing in the yard. It fades up from black on the shut
// cottage door with the storm still muffled (the bridge started under the film's title card), the door swings
// open on the warm room, she stands a moment on the sill looking up into the snow, steps down and walks out
// into the yard. The door bangs shut behind her in the wind and the view eases back out. Control is hers once
// she is out (about 6 s). W.intro is read by the drawer (door, doorway light, her size on the sill).
const WALK = { fade: 2.8, open: 1.7, sill: 2.4, step: 3.2, stepEnd: 3.7, shut: 5.0, stopX: 20.3, closeVh: 9.5, out: 7.2 };
const DOOR = { x: L.COTTAGE.x + 5.3 + 0.675, y: L.COTTAGE.y + 0.55 + 0.27 };   // doorway centre; her body centre standing on the sill
function beginWalkOut() {
  log('walk out of the cottage');
  A.fadeMaster(0, 0.02);
  A.storm(0.8);
  W.intro = { t: 0, door: 0, hide: true, scale: 0.84, look: 0, walking: false, done: false, sfx: {} };
  const p = W.player; p.x = DOOR.x; p.y = DOOR.y; p.vx = p.vy = 0; p.facing = 1;
  cam.x = DOOR.x + 0.6; cam.y = DOOR.y + 1.3; cam.viewH = WALK.closeVh;
}
const walkInput = { axisX: 0, axisY: 0, held: {}, pressed: {} };
// one fixed step of the walk-out: called after W.update (which ran on walkInput)
function walkStep(dt) {
  const w = W.intro, p = W.player;
  if (!w || w.done) return;
  w.t += dt;
  const t = w.t, once = (k, f) => { if (!w.sfx[k]) { w.sfx[k] = true; f(); } };
  // the door: swings open, later bangs shut in a gust
  if (t >= WALK.open) once('open', () => {
    A.play('creak', { vol: 0.75, rate: 0.85, x: DOOR.x, y: DOOR.y, verb: 0.2 });
    A.stormOpen(); A.fadeMaster(A.volume, 0.6);
  });
  w.door = t < WALK.shut ? smooth(WALK.open, WALK.open + 0.8, t) : 1 - smooth(WALK.shut, WALK.shut + 0.22, t);
  if (t >= WALK.shut + 0.18) once('bang', () => {
    A.play('gate', { vol: 0.55, rate: 0.55, x: DOOR.x, y: DOOR.y, verb: 0.5 });
    A.play('land', { vol: 0.8, rate: 0.45, x: DOOR.x, y: DOOR.y });
    cam.shake = 0.18;
    for (let i = 0; i < 26; i++) D.fx.push({ kind: 'snow', x: DOOR.x - 0.6 + Math.random() * 1.4, y: DOOR.y + Math.random() * 2.4, vx: 0.5 + Math.random() * 0.7, vy: -0.4 + Math.random() * 0.9, life: 0.7 + Math.random() * 0.9, t: 0, r: 0.5 + Math.random() * 0.8, rot: Math.random() * 6, par: 1 });
  });
  w.hide = w.door < 0.35 && t < WALK.sill;
  if (t < WALK.stepEnd) {
    // on the sill, then the step down (held in place: the sill is above the yard)
    const k = smooth(WALK.step, WALK.stepEnd, t);
    p.x = DOOR.x + k * 0.55; p.y = DOOR.y + (L.COTTAGE.y + 0.3 - DOOR.y) * k + Math.sin(k * Math.PI) * 0.12;
    p.vx = 0; p.vy = 0; p.facing = 1;
    w.scale = 0.84 + 0.16 * k;
    w.look = t > WALK.sill + 0.2 && t < WALK.step ? 0.7 : 0;   // she looks up into the snow before she steps down
    walkInput.axisX = 0;
  } else {
    w.scale = 1; w.look = 0;
    walkInput.axisX = p.x < WALK.stopX ? 0.4 : 0;
    if (t >= WALK.stepEnd) once('land', () => A.pick(['snow1', 'snow2', 'snow3'], { vol: 0.5, x: p.x, y: p.y }));
  }
  if (t >= WALK.out && p.x >= WALK.stopX - 0.3) { w.done = true; walkInput.axisX = 0; log('walk out done'); }
}

// ── a hidden room opens ─────────────────────────────────────────────────
// The rock over a found room used to vanish in one frame. Now the drawn field morphs from "still hidden" to
// "found" over ~1.5 s, starting where she stands and crumbling outward with a little noise, with a low rumble.
let reveal = null;
function startReveal(e) {
  const P = T.revealPair(e.hide, W.secrets.filter((k) => !k.seen).map((k) => k.hide));
  const ppm = L.WORLD.ppm, top = L.WORLD.y0 + L.WORLD.h, n = P.w * P.h, order = new Float32Array(n);
  let far = 0;
  for (let j = 0; j < P.h; j++) for (let i = 0; i < P.w; i++) {
    const x = L.WORLD.x0 + (P.x + i + 0.5) / ppm, y = top - (P.y + j + 0.5) / ppm;
    const d = Math.hypot(x - e.x, y - e.y); far = Math.max(far, d);
    const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
    order[j * P.w + i] = d + (h - Math.floor(h)) * 1.6 + Math.sin(i * 0.7) * Math.cos(j * 0.9) * 0.6;
  }
  for (let k = 0; k < n; k++) order[k] /= far + 2.2;
  reveal = { P, order, t: 0, out: new Float32Array(n) };
  A.play('gate', { vol: 0.35, rate: 0.5, x: e.x, y: e.y, verb: 1 });
  A.play('creak', { vol: 0.25, rate: 0.45, x: e.x, y: e.y, verb: 1 });
  D.spawn('puff', e.x, e.y, 14, { speed: 1.6, life: 1.2, r: 1.2 });
}
function revealStep(dt) {
  if (!reveal) return;
  const r = reveal, P = r.P;
  r.t += dt;
  const k = smooth(0, 1.5, r.t) * 1.35;
  for (let i = 0; i < r.out.length; i++) { const u = clamp((k - r.order[i]) / 0.35, 0, 1); r.out[i] = P.a[i] + (P.b[i] - P.a[i]) * u * u * (3 - 2 * u); }
  R.patchSDF({ x: P.x, y: P.y, w: P.w, h: P.h, data: T.half(r.t >= 1.5 ? P.b : r.out) });
  if (r.t >= 1.5) reveal = null;
}

// ── a found thing, held up ───────────────────────────────────────────────
// Picking up a keepsake or a skein stops the world: time runs down over half a second, the screen darkens around
// her, and the thing rises from where it lay, growing, into a warm light above her head while she looks up at it.
// Its name, its words and the count come in one by one in large type. Any fresh key, button or click (after a
// moment, so a held run key can't skip it) and the words fade, the thing shrinks into her chest, time picks up.
const SHOWV = 2.7;                     // view height while showing (m); the item is ~0.75 m tall on screen at scale 2.4
let SHOW = null;
function startShow(o) {
  const p = W.player, el = $('show');
  SHOW = { ...o, t: 0, o: 0, phase: 'in', from: { x: o.x, y: o.y }, at: { x: p.x, y: p.y + 1.35 }, item: null, click: false };
  W.showcase = SHOW;
  log(`showcase · ${o.name}`);
  el.querySelector('.sname').textContent = o.name;
  el.querySelector('.sdesc').textContent = o.desc;
  el.querySelector('.scount').textContent = o.count;
  el.querySelector('.sany').textContent = I.usingPad ? 'press any button' : 'press any key';
  el.classList.remove('s1', 's2', 's3', 's4', 'sout');
  show(el, true);
  show($('card'), false); cardTimer = 0; show($('toast'), false); toastTimer = 0;
  A.play('bowl', { vol: 0.35, rate: 0.5, verb: 1.4 });
  A.play('harp', { rate: 0.5, vol: 0.4, verb: 1.3, delay: 0.5 });
}
function showUpdate(dt) {
  const S = SHOW; if (!S) return;
  const el = $('show'), p = W.player;
  const bob = Math.sin(time * 1.3) * 0.035;
  if (S.phase === 'in') {
    S.t += dt;
    const k = smooth(0, 1.15, S.t);
    // rise along a soft arc from where it lay to above her head, growing as it comes
    const ax = S.from.x + (S.at.x - S.from.x) * k, ay = S.from.y + (S.at.y - S.from.y) * k + Math.sin(k * Math.PI) * 0.25;
    S.item = { kind: S.kind, x: ax, y: ay + bob * k, s: 1 + 1.4 * k, a: 0.4 + 0.6 * k };
    if (S.t > 0.7) el.classList.add('s1');
    if (S.t > 1.15) el.classList.add('s2');
    if (S.t > 1.7) el.classList.add('s3');
    if (S.t > 2.6) el.classList.add('s4');
    const any = Object.values(I.pressed).some(Boolean) || S.click;
    S.click = false;
    if (S.t > 1.6 && any) { S.phase = 'out'; el.classList.add('sout'); A.play('release', { vol: 0.3, rate: 0.7 }); log('showcase dismissed'); }
  } else {
    S.o += dt;
    // the words go first; then it shrinks and drops into her chest (the red heart), and the dark lifts
    const k = smooth(0.25, 1.0, S.o);
    const hx = p.x + p.facing * 0.06, hy = p.y + 0.12;
    S.item = { kind: S.kind, x: S.at.x + (hx - S.at.x) * k, y: S.at.y + bob * (1 - k) + (hy - S.at.y) * k, s: 2.4 * (1 - k) + 0.15 * k, a: 1 - 0.6 * k };
    if (S.o > 0.35 && !S.hid) { S.hid = true; show(el, false); }
    if (S.o > 1.0 && !S.done) {
      S.done = true; S.item = null;
      D.spawn('spark', hx, hy, 22, { speed: 2.2, life: 1.1 });
      A.play('tie', { vol: 0.45, rate: 1.3, x: hx, y: hy }); A.play('chime', { vol: 0.25, rate: 1.5, x: hx, y: hy });
    }
    if (S.o > 1.25) { SHOW = null; W.showcase = null; }
  }
}
addEventListener('mousedown', () => { if (SHOW) SHOW.click = true; });

let camSnap = false;                   // the next camera update jumps straight to its target (behind black)
let respawnT = -99;                    // time of the last respawn: the picture comes back from black

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
  const canLook = state === 'play' && !(W.intro && !W.intro.done) && !p.dead && p.grounded && !p.climb && !W.thread.locked && !SD.viewLock;
  const ay = canLook ? I.axisY : 0;
  lookT = ay ? lookT + dt : 0;
  p.look = damp(p.look || 0, SHOW ? (SHOW.phase === 'in' ? 0.85 : 0) : W.intro && !W.intro.done ? W.intro.look : ay, W.intro && !W.intro.done ? 3 : 9, dt);                                   // her head turns at once
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
    if (SHOW) {
      const k = SHOW.phase === 'in' ? smooth(0, 1.2, SHOW.t) : 1 - smooth(0.2, 1.25, SHOW.o);
      tx = lerp(tx, SHOW.at.x, k); ty = lerp(ty, SHOW.at.y - 0.14 * SHOWV, k); vh = lerp(vh, SHOWV, k);
    }
    if (W.intro && !W.intro.done) { const k = smooth(WALK.step, WALK.out + 0.5, W.intro.t); vh = WALK.closeVh + (vh - WALK.closeVh) * k; tx = lerp(DOOR.x + 0.6, tx, k); ty = lerp(DOOR.y + 1.3, ty, k); }
    ty += lookCam * (lookCam > 0 ? 0.26 : 0.32) * vh;        // a little more room looking down: that's where the falls are
  }
  if (camSnap) { camSnap = false; cam.x = tx; cam.y = ty; cam.viewH = vh; ambient = a.amb.slice(); moon = a.moon; }
  const rate = state === 'ending' ? 2.2 : 3.2;
  cam.x = damp(cam.x, tx, rate, dt); cam.y = damp(cam.y, ty, rate * 1.15, dt);
  cam.viewH = SD.viewLock ? SD.viewLock : damp(cam.viewH, vh, SHOW ? 5 : W.intro && !W.intro.done ? 4 : state === 'play' ? 0.9 : 1.2, dt);
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
let timeScale = 1;
const walkInput0 = { axisX: 0, axisY: 0, held: {}, pressed: {} };     // no input (paused, or behind a passage)
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  time += dt;
  I.poll();
  if (busy) { /* a passage is taking the screen: no menus, no pause */ }
  else if (state === 'title') navInput($('menu'));
  else if (paused) { navInput($('pmenu')); if (I.pressed.pause) setPaused(false); }
  else if (state === 'play' && I.pressed.pause && !SHOW) setPaused(true);
  showUpdate(dt);
  // pausing doesn't freeze the world mid-frame: time runs down to a stop in ~0.2 s and picks up again the same way
  timeScale = damp(timeScale, paused || (SHOW && SHOW.phase === 'in') ? 0 : 1, SHOW ? 5 : 16, dt);
  if (paused && timeScale < 0.01) timeScale = 0;
  const gdt = dt * timeScale;
  if (state === 'cine') { cineUpdate(dt); for (const k in I.pressed) I.pressed[k] = false; }
  if (state === 'credits' && !busy && (I.pressed.pause || I.pressed.act)) { $('credits').classList.remove('rolling'); show($('credits'), false); if ($('credits').classList.contains('cut')) coda(); else enterTitle(); }
  if (state === 'coda' && !busy && (I.pressed.pause || I.pressed.act)) passage(() => enterTitle(), { out: 1.4, back: 1.6 });

  if (state === 'coda') { W.time += dt; }
  if ((timeScale > 0 || SHOW) && state !== 'credits' && state !== 'cine' && state !== 'coda') {
    acc += gdt;
    let steps = 0;
    while (acc >= FIXED && steps < 10) {
      const walking = W.intro && !W.intro.done;
      W.update(FIXED, walking ? walkInput : paused || busy || SHOW ? walkInput0 : I, state === 'play');
      if (walking) walkStep(FIXED);
      if (steps === 0) for (const k in I.pressed) I.pressed[k] = false;
      handleEvents();
      acc -= FIXED; steps++;
    }
    if (steps >= 10) acc = 0;
    if (state === 'play' && !finAPlayed && Math.hypot(W.player.x - W.finale.x, W.player.y - W.finale.y) < 7) { finAPlayed = true; playLine('fin_a', L.FINALE.text); }
    if (state === 'ending') { if (CUT && !CUT.coda) cutUpdate(gdt); else endingUpdate(gdt); }
    updateCamera(SHOW ? dt : gdt);
    revealStep(gdt);
  }
  updateUI(dt);
  document.body.classList.toggle('nocursor', !(state === 'title' || state === 'loading' || paused));

  // audio continuous layers
  if (A) {
    const p = W.player, th = W.thread;
    const swing = th.locked && !p.grounded ? clamp(Math.hypot(p.vx, p.vy) / 9, 0, 1) * 0.5 : 0;
    let md = 99; for (const m of W.moths) md = Math.min(md, Math.hypot(m.x - cam.x, m.y - cam.y));
    A.update(dt, { cam: [cam.x, cam.y], swing: paused ? 0 : swing, moth: paused ? 0 : clamp(1 - md / 12, 0, 1) * 0.35, voice: voicePlaying > 0 || !!SHOW, out: state === 'title' ? 1 : D.out, gust: D.gust, under: W.area().id === 'throat' ? 1 : 0 });
  }

  // render
  const shake = cam.shake > 0 ? cam.shake * 0.35 : 0;
  const cx = cam.x + (Math.random() - 0.5) * shake, cy = cam.y + (Math.random() - 0.5) * shake;
  const viewW = cam.viewH * R.w / R.h;
  D.setView([cx, cy], cam.viewH, R.w, R.h);
  D.draw(R.sctx, R.ectx, gdt, time);
  const k = R.h / cam.viewH;
  const nPts = buildPts(viewW, cam.viewH, k);
  const bg = [];
  L.BACKDROPS.forEach((b, i) => {
    const qx = b.cx + (cx - b.cx) * b.par, qy = b.cy + (cy - b.cy) * b.par;
    if (Math.abs(qx - b.cx) < b.w / 2 + viewW / 2 && Math.abs(qy - b.cy) < b.h / 2 + cam.viewH / 2) bg.push({ ...b, layer: i, alpha: 1 });
  });
  const ink = L.INK[0];
  const inkVis = Math.abs(cy - ink.y) < cam.viewH && cx + viewW / 2 > ink.x0 && cx - viewW / 2 < ink.x1;
  const deathFade = Math.max(W.player.dead && state === 'play' ? smooth(0.5, 1.6, W.player.deadT) : 0, CUT ? (CUT.dark || 0) : 0);
  const respawnFade = Math.max(W.intro ? 1 - smooth(0.15, WALK.fade, W.intro.t) : 0,      // the walk-out fades up from black
    1 - smooth(0.1, 1.3, time - respawnT));                                                // and so does every respawn
  R.frame({
    cam: [cx, cy], viewH: cam.viewH, time, ambient, moon,
    lights: W.lights([cx, cy], viewW, cam.viewH), pts, nPts, bg: bg.slice(0, 4),
    inkPool: inkVis ? ink : null, fade: Math.max(deathFade, respawnFade), flash: 0, red: 1,
  });
  requestAnimationFrame(tick);
}

boot();
