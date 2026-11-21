// Lore props: things left in the deep by the people who came before. None of them do anything; they are
// there so each ledge has a past. Drawn in grey tone like every sprite (the engraving shader lights them,
// so in the caves they only show up inside the thread's light). Positions snap to the real rock floor.
import { mulberry, TAU } from './util.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;
const INK = 0.035;

// [kind, x, yHint, flip]
export const LORE = [
  // the Throat: once the village well, then a mine
  ['windlass', 35.7, 2, 1],
  ['bucket', 49.6, -8, 1],
  ['boots', 47.0, -25, 1],
  ['mineframe', 65.6, -16, 1],
  ['cairn', 71.5, -16, 1],
  ['lantern', 72.2, -33, -1],
  // the Root Gardens: somebody tended this
  ['pots', 16.6, -58, 1],
  ['markers', 29.4, -59, 1],
  ['scarecrow', 18.6, -80, 1],
  ['trellis', 25.4, -80, -1],
  // the Bell Gallery: a chapel to things that ring
  ['greatbell', 15.2, -118, 1],
  ['ribbons', 52.4, -120, 1],
  ['candles', 80.2, -121, 1],
  ['stool', 66.9, -122, -1],
  // the Ink Mere: there was a ferry
  ['mooring', 97.7, -193, 1],
  ['boat', 101.0, -193, 1],
  ['ferrylamp', 49.6, -191, 1],
  ['letters', 61.4, -189, 1],
  ['signpost', 17.6, -193, -1],
  // the Loom
  ['baskets', 50.5, -245, 1],
];

// each prop keeps a faint cold after-glow so its outline reads from a distance; a few carry their own light
const LIGHT = {
  candles: { dy: 0.4, r: 2.8, i: 0.5, c: [1.0, 0.62, 0.3], flicker: 1 },
  pots: { dy: 0.5, r: 2.6, i: 0.26, c: [0.62, 0.85, 0.75], flicker: 0.1 },
};
export function loreLights(lore, t, vis) {
  const out = [];
  for (const p of lore) {
    if (!vis(p.x, p.y)) continue;
    const L = LIGHT[p.kind];
    if (L) {
      const fl = 1 + (Math.sin(t * 11 + p.x) * 0.06 + Math.sin(t * 6.7 + p.y) * 0.07) * L.flicker;
      out.push({ x: p.x, y: p.y + L.dy, r: L.r, i: L.i * fl, c: L.c, soft: 10 });
    } else out.push({ x: p.x, y: p.y + 0.9, r: 2.8, i: 0.2, c: [0.72, 0.76, 0.88], soft: 10 });
  }
  return out;
}

export function buildLore(T) {
  return LORE.map(([kind, x, yh, flip], i) => {
    let y0 = yh + 2.5;
    for (let k = 0; k < 200 && T.d(x, y0) < 0; k++) y0 += 0.05;
    const gy = T.ground(x, y0, 9);
    return { kind, x, y: gy === null ? yh : gy - 0.04, flip, seed: i * 97 + 13 };
  });
}

// a pen that draws in metres relative to a prop's foot (y up), mirrored by `flip`
class Pen {
  constructor(D, ctx, ectx, p) {
    this.D = D; this.c = ctx; this.e = ectx; this.ox = p.x; this.oy = p.y; this.f = p.flip; this.k = D.k;
  }
  X(x) { return this.D.sx(this.ox + x * this.f); }
  Y(y) { return this.D.sy(this.oy + y); }
  w(m) { return Math.max(0.8, this.k * m); }
  path(pts, close) {
    const c = this.c; c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(this.X(x), this.Y(y)) : c.moveTo(this.X(x), this.Y(y))));
    if (close) c.closePath();
  }
  poly(pts, fill, stroke = INK, w = 0.022) {
    this.path(pts, true);
    if (fill !== null) { this.c.fillStyle = g(fill); this.c.fill(); }
    if (stroke !== null) { this.c.strokeStyle = g(stroke); this.c.lineWidth = this.w(w); this.c.stroke(); }
  }
  line(pts, tone, w = 0.02) { this.path(pts, false); this.c.strokeStyle = g(tone); this.c.lineWidth = this.w(w); this.c.stroke(); }
  ell(x, y, rx, ry, rot, fill, stroke = INK, w = 0.02, a0 = 0, a1 = TAU) {
    const c = this.c; c.beginPath(); c.ellipse(this.X(x), this.Y(y), Math.abs(rx * this.k), Math.abs(ry * this.k), -rot * this.f, a0, a1);
    if (fill !== null) { c.fillStyle = g(fill); c.fill(); }
    if (stroke !== null) { c.strokeStyle = g(stroke); c.lineWidth = this.w(w); c.stroke(); }
  }
  // a timber: a thick dark stroke with a lit edge and grain
  beam(x0, y0, x1, y1, th, tone = 0.34) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * th / 2, ny = dx / L * th / 2;
    this.poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], tone, INK, 0.02);
    this.line([[x0 + nx * 0.5, y0 + ny * 0.5], [x1 + nx * 0.5, y1 + ny * 0.5]], tone + 0.25, 0.01);
    for (let t = 0.15; t < 0.9; t += 0.27) this.line([[x0 + dx * t - nx * 0.3, y0 + dy * t - ny * 0.3], [x0 + dx * (t + 0.1) - nx * 0.3, y0 + dy * (t + 0.1) - ny * 0.3]], tone - 0.15, 0.008);
  }
  glow(x, y, r, rgba) {
    const e = this.e, X = this.X(x), Y = this.Y(y), R = r * this.k;
    const gr = e.createRadialGradient(X, Y, 0, X, Y, R); gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)');
    e.fillStyle = gr; e.beginPath(); e.arc(X, Y, R, 0, TAU); e.fill();
  }
}

export function drawLore(D, ctx, ectx) {
  if (!D.lore || D.w.noLore) return;
  for (const p of D.lore) {
    if (!D.vis(p.x, p.y + 1, 5)) continue;
    const P = new Pen(D, ctx, ectx, p), r = mulberry(p.seed);
    (KINDS[p.kind] || (() => {}))(P, r, D.time, p);
  }
}

const KINDS = {
  // a well windlass at the lip of the pit: two posts, a drum wound with rope, a crank, rope hanging slack
  windlass(P, r, t) {
    P.beam(-0.75, -0.05, -0.68, 1.35, 0.13, 0.3); P.beam(0.75, -0.05, 0.68, 1.35, 0.13, 0.3);
    P.beam(-0.95, 1.4, 0.95, 1.46, 0.1, 0.36);
    P.poly([[-0.62, 0.98], [0.62, 0.98], [0.62, 0.72], [-0.62, 0.72]], 0.26);
    for (let x = -0.56; x < 0.6; x += 0.075) P.line([[x, 0.98], [x + 0.03, 0.72]], 0.55, 0.012);
    P.line([[0.68, 0.85], [0.92, 0.85], [0.92, 0.62], [1.02, 0.62]], 0.08, 0.035);
    const sw = Math.sin(t * 0.7) * 0.03;
    P.line([[0.1, 0.72], [0.12 + sw, 0.4], [0.06 + sw, 0.15]], 0.5, 0.02);
    P.line([[0.06 + sw, 0.15], [0.0 + sw, 0.05], [0.1 + sw, 0.02], [0.03 + sw, -0.02]], 0.5, 0.012);   // frayed end
    P.ell(0, 1.56, 0.75, 0.07, 0, 0.93, null);                                                  // snow on the bar
  },
  // a wooden well bucket on its side, iron hoops, a snapped handle and a coil of frayed rope
  bucket(P) {
    P.poly([[-0.32, 0.02], [0.24, 0.0], [0.3, 0.42], [-0.38, 0.44]], 0.38);
    P.ell(0.27, 0.21, 0.07, 0.215, 0.1, 0.12);
    for (const x of [-0.24, 0.08]) P.line([[x, 0.02], [x - 0.01, 0.435]], 0.1, 0.035);
    for (let x = -0.3; x < 0.24; x += 0.09) P.line([[x, 0.05], [x - 0.02, 0.4]], 0.24, 0.008);
    P.line([[0.27, 0.42], [0.45, 0.55], [0.6, 0.48]], 0.12, 0.022);
    for (let i = 0; i < 3; i++) P.ell(-0.75, 0.06 + i * 0.035, 0.24 - i * 0.03, 0.06, 0.05, null, 0.5, 0.025);
    P.line([[-0.52, 0.06], [-0.4, 0.02], [-0.2, 0.0]], 0.5, 0.022);
  },
  // a small pair of worn boots, one fallen over, laces trailing
  boots(P) {
    P.poly([[-0.3, 0.0], [-0.04, 0.0], [-0.02, 0.07], [-0.14, 0.11], [-0.16, 0.34], [-0.3, 0.34]], 0.28);
    P.line([[-0.3, 0.3], [-0.16, 0.3]], 0.12, 0.02);
    P.line([[-0.24, 0.22], [-0.16, 0.24], [-0.24, 0.17], [-0.16, 0.19]], 0.75, 0.01);
    P.line([[-0.17, 0.24], [-0.05, 0.22], [0.02, 0.05]], 0.75, 0.009);
    P.poly([[0.08, 0.0], [0.4, 0.0], [0.42, 0.14], [0.14, 0.15], [0.06, 0.08]], 0.24);
    P.ell(0.41, 0.07, 0.025, 0.075, 0, 0.08);
    P.line([[0.42, 0.12], [0.55, 0.05], [0.64, 0.01]], 0.75, 0.009);
  },
  // an old mine frame against the back wall: two props and a cap beam, a pick leaning on it
  mineframe(P) {
    P.beam(-0.85, -0.05, -0.8, 2.1, 0.17, 0.28); P.beam(0.85, -0.05, 0.8, 2.1, 0.17, 0.28);
    P.beam(-1.05, 2.15, 1.05, 2.12, 0.19, 0.32);
    P.beam(-0.8, 1.55, -0.45, 2.05, 0.08, 0.3);
    P.poly([[-0.65, 0.05], [0.65, 0.05], [0.65, 2.0], [-0.65, 2.0]], 0.05, null);              // the dark of the old drift behind
    P.line([[-0.55, 1.2], [-0.3, 0.6]], 0.1, 0.01); P.line([[0.4, 1.7], [0.55, 1.1]], 0.1, 0.01);
    // pick
    P.beam(1.05, 0.0, 1.32, 1.1, 0.05, 0.4);
    P.poly([[1.06, 1.12], [1.32, 1.12], [1.62, 0.9], [1.34, 1.04], [1.12, 1.02], [0.98, 1.2]], 0.18);
    // a rusted lamp hook with nothing on it
    P.line([[0, 2.05], [0, 1.8], [0.06, 1.74]], 0.1, 0.02);
  },
  // a cairn of flat stones with a tiny knitted cap on top: someone remembered someone here
  cairn(P, r) {
    let y = 0;
    const st = [[0.62, 0.16], [0.52, 0.15], [0.44, 0.14], [0.34, 0.12], [0.26, 0.11], [0.18, 0.09]];
    st.forEach(([w, h], i) => {
      const x = (r() - 0.5) * 0.06;
      P.ell(x, y + h / 2, w / 2, h / 2, (r() - 0.5) * 0.12, 0.3 + r() * 0.2);
      if (i < 3) P.line([[x - w * 0.3, y + h * 0.65], [x + w * 0.1, y + h * 0.7]], 0.6, 0.008);
      y += h * 0.92;
    });
    P.poly([[-0.1, y], [0.1, y], [0.07, y + 0.12], [0, y + 0.15], [-0.07, y + 0.12]], 0.55);
    for (let i = 0; i < 3; i++) P.line([[-0.09 + i * 0.01, y + 0.025 + i * 0.035], [0.09 - i * 0.01, y + 0.025 + i * 0.035]], 0.35, 0.008);
    P.ell(0, y + 0.18, 0.035, 0.035, 0, 0.75);
  },
  // a miner's lantern on its side, glass cracked; tally marks scratched into the wall behind
  lantern(P) {
    for (let grp = 0; grp < 4; grp++) {
      const x0 = -0.9 + grp * 0.42;
      for (let i = 0; i < 4; i++) P.line([[x0 + i * 0.07, 1.05], [x0 + i * 0.07 + 0.01, 1.42]], 0.62, 0.012);
      if (grp < 3) P.line([[x0 - 0.04, 1.12], [x0 + 0.26, 1.36]], 0.62, 0.012);
    }
    P.poly([[-0.2, 0.02], [0.2, 0.02], [0.24, 0.3], [-0.24, 0.3]], 0.18);
    P.poly([[-0.18, 0.06], [0.16, 0.06], [0.2, 0.26], [-0.2, 0.26]], 0.5, 0.06, 0.012);
    P.line([[-0.05, 0.26], [0.02, 0.17], [-0.03, 0.11], [0.06, 0.06]], 0.08, 0.008);
    P.line([[0.02, 0.17], [0.13, 0.2]], 0.08, 0.008);
    P.poly([[0.24, 0.1], [0.36, 0.12], [0.36, 0.22], [0.24, 0.24]], 0.22);
    P.line([[-0.24, 0.16], [-0.38, 0.28], [-0.32, 0.38]], 0.1, 0.018);
  },
  // clay pots with pale mushrooms in them (the mushrooms keep a faint cold glow) and a hand rake
  pots(P, r, t) {
    const pot = (x, w, h, tone) => {
      P.poly([[x - w * 0.42, 0], [x + w * 0.42, 0], [x + w * 0.52, h * 0.82], [x - w * 0.52, h * 0.82]], tone);
      P.poly([[x - w * 0.58, h * 0.8], [x + w * 0.58, h * 0.8], [x + w * 0.56, h], [x - w * 0.56, h]], tone + 0.08);
      P.line([[x - w * 0.25, h * 0.15], [x - w * 0.3, h * 0.7]], tone + 0.2, 0.01);
    };
    const shroom = (x, y, s, i) => {
      P.line([[x, y], [x + s * 0.1, y + s * 0.8]], 0.85, s * 0.18);
      P.ell(x + s * 0.1, y + s * 0.82, s * 0.38, s * 0.2, 0.1, 0.9, INK, 0.012, Math.PI, TAU);
      P.glow(x + s * 0.1, y + s * 0.85, s * 1.6, `rgba(170,210,190,${0.1 + 0.03 * Math.sin(t * 0.9 + i)})`);
    };
    pot(-0.55, 0.42, 0.42, 0.42); shroom(-0.62, 0.42, 0.3, 0); shroom(-0.46, 0.42, 0.22, 1);
    pot(0.05, 0.3, 0.3, 0.36); shroom(0.06, 0.3, 0.26, 2);
    P.poly([[0.35, 0.0], [0.62, 0.0], [0.66, 0.16], [0.4, 0.2]], 0.36);                         // a broken pot on its side
    P.line([[0.4, 0.2], [0.5, 0.12], [0.45, 0.06]], 0.06, 0.01);
    shroom(0.62, 0.02, 0.2, 3);
    P.beam(0.75, 0.02, 1.25, 0.06, 0.035, 0.42);
    for (let i = 0; i < 4; i++) P.line([[0.72, -0.02 + i * 0.035], [0.65, 0.0 + i * 0.03]], 0.2, 0.012);
  },
  // a row of garden marker sticks, each with a knot of grey yarn tied around it
  markers(P, r) {
    for (let i = 0; i < 5; i++) {
      const x = i * 0.32 + (r() - 0.5) * 0.06, h = 0.4 + r() * 0.15, lean = (r() - 0.5) * 0.12;
      P.beam(x, -0.05, x + lean, h, 0.045, 0.45);
      P.ell(x + lean * 0.7, h * 0.72, 0.04, 0.025, 0, 0.62, INK, 0.01);
      P.line([[x + lean * 0.7, h * 0.7], [x + lean * 0.7 + 0.05, h * 0.55], [x + lean * 0.7 + 0.02, h * 0.45]], 0.62, 0.01);
    }
    P.ell(0.65, 0.02, 0.85, 0.05, 0, 0.22, null);                                              // turned earth
  },
  // a yarn scarecrow: crossed sticks, a knitted face with button eyes, ragged strips that stir
  scarecrow(P, r, t) {
    P.beam(0, -0.05, 0.03, 1.75, 0.07, 0.36);
    P.beam(-0.7, 1.32, 0.72, 1.38, 0.06, 0.38);
    P.poly([[-0.24, 0.75], [0.24, 0.75], [0.3, 1.4], [-0.28, 1.4]], 0.4);                     // knitted body
    for (let y = 0.82; y < 1.38; y += 0.08) P.line([[-0.26, y], [0.27, y + 0.01]], 0.28, 0.008);
    P.ell(0.02, 1.62, 0.2, 0.22, 0, 0.55);
    for (let y = 1.48; y < 1.8; y += 0.07) P.line([[-0.17, y], [0.19, y]], 0.42, 0.007);
    P.ell(-0.06, 1.66, 0.045, 0.045, 0, 0.12); P.ell(0.1, 1.66, 0.04, 0.04, 0, 0.12);
    P.line([[-0.06, 1.53], [0.0, 1.51], [0.06, 1.53], [0.1, 1.51]], 0.1, 0.01);
    for (let i = 0; i < 5; i++) {
      const x = -0.6 + i * 0.3, s = Math.sin(t * 1.1 + i * 1.7) * 0.05;
      P.line([[x, 1.32], [x + s, 1.05], [x + s * 1.6 + 0.02, 0.85 + r() * 0.1]], i % 2 ? 0.7 : 0.3, 0.025);
    }
    P.line([[0.02, 1.84], [-0.08, 1.92], [0.0, 1.98], [0.1, 1.9]], 0.35, 0.015);
  },
  // a trellis of sticks lashed with yarn; pale roots have grown through it
  trellis(P) {
    for (let i = 0; i < 4; i++) P.beam(-0.6 + i * 0.4, -0.05, -0.58 + i * 0.4, 1.5, 0.04, 0.4);
    for (let j = 0; j < 4; j++) P.beam(-0.7, 0.3 + j * 0.36, 0.7, 0.32 + j * 0.36, 0.035, 0.42);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) P.ell(-0.6 + i * 0.4, 0.31 + j * 0.36, 0.03, 0.03, 0, 0.66, null);
    P.line([[-0.75, 1.9], [-0.4, 1.3], [-0.2, 0.9], [0.05, 0.6], [0.3, 0.1]], 0.75, 0.03);
    P.line([[-0.2, 0.9], [-0.45, 0.6], [-0.42, 0.3]], 0.75, 0.018);
    P.line([[0.05, 0.6], [0.35, 0.75], [0.5, 1.1]], 0.75, 0.014);
  },
  // a great bronze bell, cracked, lying on its side half sunk in the floor; its clapper beside it
  greatbell(P) {
    P.poly([[-1.15, -0.1], [-1.05, 0.65], [-0.7, 1.35], [0.05, 1.6], [0.75, 1.38], [1.1, 0.65], [1.2, -0.1]], 0.36, INK, 0.03);
    P.line([[-1.08, 0.5], [1.14, 0.5]], 0.2, 0.02); P.line([[-1.0, 0.62], [1.08, 0.62]], 0.55, 0.012);
    P.line([[-0.62, 1.28], [0.7, 1.3]], 0.2, 0.016);
    P.line([[-0.5, 1.1], [-0.25, 1.05], [-0.1, 1.12], [0.2, 1.06], [0.45, 1.1]], 0.6, 0.008);     // a band of worn lettering
    P.line([[0.25, 1.5], [0.32, 1.1], [0.2, 0.8], [0.34, 0.45], [0.26, 0.1]], 0.04, 0.025);       // the crack
    P.line([[0.32, 1.1], [0.5, 0.98]], 0.04, 0.012);
    P.line([[-0.8, 1.05], [-0.95, 0.4]], 0.62, 0.015);
    P.ell(0.0, -0.06, 1.2, 0.12, 0, 0.12, null);
    // clapper
    P.beam(1.45, 0.08, 2.15, 0.12, 0.07, 0.3);
    P.ell(2.25, 0.14, 0.15, 0.13, 0, 0.3);
    P.ell(1.4, 0.08, 0.05, 0.05, 0, 0.2);
  },
  // a votive post hung with faded ribbons: people tied one for each song they wanted answered
  ribbons(P, r, t) {
    P.beam(0, -0.05, 0.02, 1.9, 0.09, 0.3);
    P.beam(-0.08, 1.8, 0.1, 1.82, 0.05, 0.34);
    for (let i = 0; i < 9; i++) {
      const y = 1.75 - i * 0.12 - r() * 0.05, len = 0.35 + r() * 0.55, side = i % 2 ? 1 : -1;
      const s = Math.sin(t * 0.9 + i * 1.3) * 0.05;
      const tone = 0.5 + r() * 0.4;
      P.line([[side * 0.04, y], [side * 0.12 + s, y - len * 0.45], [side * 0.08 + s * 1.8, y - len]], tone, 0.032);
      P.ell(side * 0.04, y, 0.03, 0.022, 0, tone, INK, 0.008);
    }
  },
  // melted candle stubs on a flat stone, long cold
  candles(P, r, t) {
    P.ell(0.1, 0.04, 0.55, 0.07, 0, 0.32);
    for (let i = 0; i < 7; i++) {
      const x = -0.35 + i * 0.12 + (r() - 0.5) * 0.04, h = 0.06 + r() * 0.24, w = 0.03 + r() * 0.025;
      P.poly([[x - w, 0.07], [x + w, 0.07], [x + w * 0.9, 0.07 + h], [x - w * 0.9, 0.07 + h]], 0.86, INK, 0.012);
      P.line([[x, 0.07 + h], [x + 0.01, 0.07 + h + 0.04]], 0.05, 0.01);
      if (i % 3 !== 1) {                                                                        // most are still burning
        const fl = 0.04 + 0.012 * Math.sin(t * 13 + i * 2.1);
        P.glow(x + 0.01, 0.07 + h + 0.07, 0.09, 'rgba(255,190,110,0.9)');
        P.glow(x + 0.01, 0.07 + h + 0.06, fl * 6, 'rgba(255,140,60,0.18)');
      }
      P.line([[x + w * 0.8, 0.07 + h * 0.9], [x + w * 1.1, 0.07 + h * 0.4], [x + w * 1.3, 0.08]], 0.9, 0.018);
    }
  },
  // the bell-ringer's stool, toppled, and a coil of bell rope with a woollen sally
  stool(P) {
    P.beam(-0.35, 0.05, 0.25, 0.32, 0.06, 0.38);
    P.beam(-0.25, 0.0, -0.4, 0.45, 0.04, 0.34); P.beam(0.12, 0.0, 0.0, 0.45, 0.04, 0.34);
    for (let i = 0; i < 4; i++) P.ell(0.75, 0.05 + i * 0.04, 0.28 - i * 0.035, 0.06, 0, null, 0.55, 0.03);
    P.ell(0.42, 0.14, 0.12, 0.07, 0.3, 0.7);
    for (let x = 0.34; x < 0.52; x += 0.04) P.line([[x, 0.09], [x + 0.02, 0.19]], 0.4, 0.008);
  },
  // a mooring post at the water's edge, its rope trailing down into the ink
  mooring(P) {
    P.beam(0, -0.1, -0.05, 1.05, 0.16, 0.3);
    P.ell(-0.05, 1.06, 0.08, 0.03, 0, 0.42);
    for (let y = 0.55; y < 0.75; y += 0.05) P.ell(-0.03, y, 0.1, 0.025, 0, null, 0.5, 0.02);
    P.line([[0.05, 0.6], [-0.4, 0.2], [-0.9, -0.2], [-1.25, -0.6]], 0.5, 0.022);
    P.line([[0.0, 0.2], [0.05, 0.45]], 0.12, 0.01);
  },
  // an overturned rowboat, keel up, and an oar leaning on it
  boat(P) {
    P.poly([[-1.5, 0.0], [-1.25, 0.42], [-0.6, 0.62], [0.6, 0.64], [1.3, 0.48], [1.62, 0.1], [1.55, 0.0]], 0.3, INK, 0.028);
    for (let i = 1; i < 4; i++) P.line([[-1.45 + i * 0.05, i * 0.13], [-0.6, 0.06 + i * 0.15], [0.6, 0.07 + i * 0.15], [1.55 - i * 0.07, i * 0.12]], 0.16, 0.012);
    P.line([[-1.25, 0.42], [-0.6, 0.62], [0.6, 0.64], [1.3, 0.48]], 0.58, 0.014);
    P.poly([[-0.6, 0.62], [0.6, 0.64], [0.6, 0.7], [-0.6, 0.68]], 0.2);                         // keel
    P.line([[-0.2, 0.3], [0.1, 0.38], [0.05, 0.22]], 0.05, 0.012);                             // a stove-in plank
    P.beam(1.8, 0.0, 1.05, 1.2, 0.05, 0.42);
    P.poly([[1.03, 1.18], [0.92, 1.45], [0.98, 1.52], [1.14, 1.26]], 0.4);
  },
  // the ferry lamp: a tall pole with an unlit lantern hanging from an arm, leaning
  ferrylamp(P, r, t) {
    const sw = Math.sin(t * 0.6) * 0.03;
    P.beam(0, -0.08, 0.18, 2.6, 0.09, 0.3);
    P.beam(0.16, 2.5, 0.75, 2.56, 0.05, 0.32);
    P.line([[0.7, 2.55], [0.7 + sw, 2.28]], 0.1, 0.012);
    P.poly([[0.6 + sw, 2.28], [0.8 + sw, 2.28], [0.84 + sw, 1.98], [0.56 + sw, 1.98]], 0.22);
    P.poly([[0.63 + sw, 2.24], [0.77 + sw, 2.24], [0.8 + sw, 2.02], [0.6 + sw, 2.02]], 0.12, 0.06, 0.01);
    P.poly([[0.62 + sw, 2.28], [0.78 + sw, 2.28], [0.7 + sw, 2.36]], 0.2);
    P.line([[0.03, 0.4], [0.6, 0.15], [0.9, -0.05]], 0.5, 0.016);                              // a rope from the old ferry line
  },
  // a stack of ink-blackened books and loose letters, a quill stuck in the top one
  letters(P, r) {
    const bk = [[0.62, 0.11, 0.12], [0.56, 0.09, 0.32], [0.5, 0.1, 0.08], [0.46, 0.08, 0.26]];
    let y = 0;
    bk.forEach(([w, h, tone], i) => {
      const x = (r() - 0.5) * 0.1;
      P.poly([[x - w / 2, y], [x + w / 2, y], [x + w / 2, y + h], [x - w / 2, y + h]], tone);
      P.line([[x - w / 2 + 0.03, y + h * 0.5], [x + w / 2 - 0.03, y + h * 0.5]], tone + 0.4, 0.006);
      y += h;
    });
    P.line([[0.05, y], [0.3, y + 0.45], [0.36, y + 0.52]], 0.85, 0.012);
    P.poly([[0.12, y + 0.1], [0.36, y + 0.52], [0.24, y + 0.2]], 0.8, INK, 0.008);
    for (const [x, a] of [[0.55, 0.15], [0.75, -0.1], [-0.6, 0.08]]) {
      P.poly([[x - 0.12, 0.0], [x + 0.12, 0.0 + a * 0.2], [x + 0.12, 0.02 + a * 0.2], [x - 0.12, 0.02]], 0.82, INK, 0.008);
      P.line([[x - 0.08, 0.012], [x + 0.02, 0.012 + a * 0.1]], 0.1, 0.006);
    }
    P.ell(0.62, 0.0, 0.18, 0.025, 0, 0.0, null);                                               // an ink stain spreading
  },
  // a signpost with a carved wooden hand pointing down the tunnel
  signpost(P) {
    P.beam(0, -0.08, -0.04, 1.45, 0.09, 0.32);
    P.poly([[-0.05, 1.32], [0.55, 1.3], [0.62, 1.2], [0.75, 1.18], [0.82, 1.08], [0.62, 1.1], [0.55, 1.02], [-0.05, 1.04]], 0.5);
    P.line([[0.55, 1.3], [0.55, 1.02]], 0.25, 0.012);
    P.line([[0.58, 1.18], [0.7, 1.14]], 0.25, 0.008);
    P.line([[0.05, 1.2], [0.42, 1.18]], 0.22, 0.008); P.line([[0.05, 1.12], [0.35, 1.1]], 0.22, 0.008);
  },
  // baskets of grey yarn and a few dropped spindles
  baskets(P, r) {
    const basket = (x, w, h) => {
      P.poly([[x - w * 0.42, 0], [x + w * 0.42, 0], [x + w / 2, h], [x - w / 2, h]], 0.34);
      for (let i = 1; i < 5; i++) P.line([[x - w / 2 + i * w / 5, 0.01], [x - w / 2 + i * w / 5, h - 0.01]], 0.18, 0.01);
      for (let y = 0.06; y < h; y += 0.07) P.line([[x - w * 0.45, y], [x + w * 0.45, y]], 0.5, 0.006);
      for (let i = 0; i < 3; i++) { const bx = x - w * 0.25 + i * w * 0.25; P.ell(bx, h + 0.06, 0.09, 0.08, 0, 0.62); P.line([[bx - 0.06, h + 0.04], [bx + 0.05, h + 0.1]], 0.42, 0.008); }
    };
    basket(-0.5, 0.6, 0.38); basket(0.35, 0.5, 0.3);
    for (const [x, a] of [[1.0, 0.1], [1.3, -0.15]]) {
      P.beam(x - 0.3, 0.04, x + 0.3, 0.04 + a * 0.2, 0.025, 0.55);
      P.ell(x - 0.12, 0.04 + a * 0.06, 0.05, 0.05, 0, 0.36);
    }
    P.line([[0.6, 0.14], [0.85, 0.05], [1.1, 0.08], [1.4, 0.0]], 0.6, 0.012);
  },
};
