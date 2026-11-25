// The options: what can be set, how each line of the menu reads and changes, and the controls screen. main.js applies them
// (`apply`) and keeps them in settings.json through the host.
export const DEFAULTS = { volume: 1, voice: 1, music: 1, effects: 1, brightness: 1, shake: 1, subs: 1, detail: 'auto', timer: false, fullscreen: true, keys: {}, ended: {}, found: [], best: {} };

const STEP = (list) => (v, dir) => { let i = list.findIndex((q) => q === v); if (i < 0) i = list.reduce((b, q, k) => (Math.abs(q - v) < Math.abs(list[b] - v) ? k : b), 0); return list[(i + dir + list.length) % list.length]; };
const PCT = [0, 0.2, 0.4, 0.6, 0.8, 1];
const pct = (v) => Math.round(v * 100) + '%';
const LINES = [
  ['brightness', 'Brightness', STEP([0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75]), pct],
  ['detail', 'Detail', STEP(['auto', 1, 0.8, 0.65, 0.5]), (v) => (v === 'auto' ? 'automatic' : pct(v))],
  ['shake', 'Screen shake', STEP([0, 0.5, 1]), (v) => (v === 0 ? 'off' : v === 1 ? 'full' : 'half')],
  ['volume', 'Volume', STEP(PCT), pct],
  ['voice', 'Voices', STEP(PCT), pct],
  ['music', 'Music', STEP(PCT), pct],
  ['effects', 'Sounds', STEP(PCT), pct],
  ['subs', 'Words on screen', STEP([0.85, 1, 1.25, 1.5]), (v) => ({ 0.85: 'small', 1: 'as printed', 1.25: 'large', 1.5: 'very large' }[v] || pct(v))],
  ['timer', 'Clock', STEP([false, true]), (v) => (v ? 'shown' : 'hidden')],
];
export const ACTIONS = [['left', 'Left'], ['right', 'Right'], ['up', 'Up, reel in'], ['down', 'Down, let out'], ['jump', 'Jump'], ['grip', 'Hold the thread'], ['pluck', 'Pluck'], ['act', 'Tie, mend, use'], ['pause', 'Pause']];

// ctx: { settings, set(key, value), menu(nav, items), fullscreen(), I, back() }
export function optionsMenu(nav, ctx, sel = 0) {
  const again = (i) => optionsMenu(nav, ctx, i);
  const items = LINES.map(([key, name, next, show], i) => {
    const adj = (dir) => { ctx.set(key, next(ctx.settings[key], dir)); again(i); };
    return { label: `${name} · ${show(ctx.settings[key])}`, fn: () => adj(1), adj };
  });
  items.push({ label: 'Fullscreen', fn: ctx.fullscreen });
  items.push({ label: 'Controls', fn: () => controlsMenu(nav, ctx) });
  items.push({ label: 'Back', fn: ctx.back });
  ctx.menu(nav, items, sel, ctx.back);
}
function controlsMenu(nav, ctx, sel = 0, waiting = -1) {
  const I = ctx.I, back = () => optionsMenu(nav, ctx, LINES.length + 1);
  const items = ACTIONS.map(([a, name], i) => ({
    label: waiting === i ? `${name} · press a key` : `${name} · ${I.keyName(I.map[a][0])}`,
    fn: () => {
      controlsMenu(nav, ctx, i, i);
      I.capture = (code) => { if (code !== 'Escape' || a === 'pause') { I.bind(a, code); ctx.set('keys', I.saved()); } controlsMenu(nav, ctx, i); };
    },
  }));
  items.push({ label: 'As they were', fn: () => { I.unbind(); ctx.set('keys', {}); controlsMenu(nav, ctx, items.length - 2); } });
  items.push({ label: 'Back', fn: back });
  ctx.menu(nav, items, sel, back);
}

// a run's time, as a clock shows it
export function clock(s) { const m = Math.floor(s / 60), h = Math.floor(m / 60); return (h ? h + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
