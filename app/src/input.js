// Keyboard + gamepad → a small set of actions. `held` for continuous, `pressed` for edges this frame.
const MAP = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ'], grip: ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyX'], pluck: ['KeyF', 'KeyJ', 'KeyC'],
  act: ['KeyE', 'Enter', 'KeyL'], pause: ['Escape', 'KeyP'],
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.held = {}; this.pressed = {}; this.prev = {};
    this.usingPad = false;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code); this.usingPad = false;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  poll() {
    const now = {};
    for (const a in MAP) now[a] = MAP[a].some((k) => this.keys.has(k));
    this.axisX = (now.right ? 1 : 0) - (now.left ? 1 : 0);
    this.axisY = (now.up ? 1 : 0) - (now.down ? 1 : 0);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4));
      const ax = Math.abs(p.axes[0]) > 0.25 ? p.axes[0] : 0, ay = Math.abs(p.axes[1]) > 0.35 ? -p.axes[1] : 0;
      const pad = {
        left: ax < -0.25 || b(14), right: ax > 0.25 || b(15), up: ay > 0.35 || b(12), down: ay < -0.35 || b(13),
        jump: b(0), grip: b(7) || b(6) || b(5) || b(4), pluck: b(2), act: b(3) || b(1), pause: b(9),
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
    if (this.usingPad) return { jump: 'A', grip: 'RT', pluck: 'X', act: 'Y', pause: 'Start' }[a] || a;
    return { jump: 'Space', grip: 'Shift', pluck: 'F', act: 'E', pause: 'Esc', up: 'W', down: 'S' }[a] || a;
  }
}
