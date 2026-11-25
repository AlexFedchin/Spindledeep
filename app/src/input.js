// Keyboard + gamepad → a small set of actions. `held` for continuous, `pressed` for edges this frame.
const MAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ'], grip: ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyX'], pluck: ['KeyF', 'KeyJ', 'KeyC'],
  act: ['KeyE', 'Enter', 'KeyL'], dim: ['KeyQ', 'KeyV', 'KeyH'], pause: ['Escape', 'KeyP'],
};
// these work whatever else is chosen, so no choice of keys can lock anyone out of the menus
const ALWAYS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', act: 'Enter', pause: 'Escape' };
const clone = () => Object.fromEntries(Object.entries(MAP).map(([a, k]) => [a, [...k]]));
const NAMES = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Right Shift', ControlLeft: 'Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Alt', AltRight: 'Right Alt', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: 'Backspace',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', CapsLock: 'Caps', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`' };

export class Input {
  constructor() {
    this.keys = new Set();
    this.held = {}; this.pressed = {}; this.prev = {};
    this.usingPad = false;
    this.map = clone(); this.custom = {};
    this.capture = null;               // the controls screen is waiting for a key
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.capture) { const f = this.capture; this.capture = null; e.preventDefault(); this.swallow = e.code; f(e.code); return; }
      this.keys.add(e.code); this.usingPad = false;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  // a key for an action: it comes first, and no other action keeps it
  bind(a, code) {
    for (const b in this.map) if (b !== a) this.map[b] = this.map[b].filter((k) => k !== code || ALWAYS[b] === code);
    const old = this.map[a].filter((k) => k !== code);
    this.map[a] = [code, ...old.slice(MAP[a].includes(old[0]) ? 0 : 1)];
    this.custom[a] = code;
    for (const b in this.map) if (!this.map[b].length) this.map[b] = [MAP[b].find((k) => !Object.values(this.map).some((l) => l.includes(k))) || ALWAYS[b] || code];
  }
  unbind() { this.map = clone(); this.custom = {}; }
  saved() { return { ...this.custom }; }
  load(keys) { this.unbind(); for (const a in keys || {}) if (this.map[a]) this.bind(a, keys[a]); }
  keyName(code) { return NAMES[code] || (code || '').replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num ') || '—'; }
  poll() {
    const now = {};
    for (const a in this.map) now[a] = this.map[a].some((k) => this.keys.has(k)) || (ALWAYS[a] && this.keys.has(ALWAYS[a]));
    this.axisX = (now.right ? 1 : 0) - (now.left ? 1 : 0);
    this.axisY = (now.up ? 1 : 0) - (now.down ? 1 : 0);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4));
      const ax = Math.abs(p.axes[0]) > 0.25 ? p.axes[0] : 0, ay = Math.abs(p.axes[1]) > 0.35 ? -p.axes[1] : 0;
      const pad = {
        left: ax < -0.25 || b(14), right: ax > 0.25 || b(15), up: ay > 0.35 || b(12), down: ay < -0.35 || b(13),
        jump: b(0), grip: b(7) || b(6) || b(5), dim: b(4), pluck: b(2), act: b(3) || b(1), pause: b(9),
      };
      if (Object.values(pad).some(Boolean)) this.usingPad = true;
      for (const a in pad) now[a] = now[a] || pad[a];
      if (ax) this.axisX = ax; else if (pad.left || pad.right) this.axisX = (pad.right ? 1 : 0) - (pad.left ? 1 : 0);
      if (ay) this.axisY = ay; else if (pad.up || pad.down) this.axisY = (pad.up ? 1 : 0) - (pad.down ? 1 : 0);
    }
    for (const a in now) { this.pressed[a] = now[a] && !this.prev[a]; this.held[a] = now[a]; }
    this.prev = now;
  }
  // label for an action prompt, matching the device in use
  label(a) {
    if (this.usingPad) return { jump: 'A', grip: 'RT', pluck: 'X', dim: 'LB', act: 'Y', pause: 'Start', up: '↑', down: '↓', left: '←', right: '→' }[a] || a;
    if (this.custom[a]) return this.keyName(this.custom[a]);
    return { jump: 'Space', grip: 'Shift', pluck: 'F', dim: 'Q', act: 'E', pause: 'Esc', up: 'W', down: 'S', left: 'A', right: 'D' }[a] || a;
  }
}
