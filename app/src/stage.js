// Where the 3D figures (figure.js) are and what they are doing: the one that kneels at the top of the Loom with her face on,
// the same one coming up the far wall in the rising dark, and going home along the thread (spoilers: docs/STORY.md). The rules
// stay in deep.js and ending.js; this only reads their state and poses.
import { Figure, loadModel, poseKneel, poseClimb, poseReach, V3 } from './figure.js';
import { lerp, smooth } from './util.js';

const { add, norm, mix3 } = V3;

export class Stage {
  constructor(R, log) { this.R = R; this.log = log; this.c1 = {}; this.c2 = {}; }
  async load(name = 'knitter') {
    // the model is not in the repository (it is not ours to hand out): without it the figures are simply not there
    try { const m = await loadModel(name); this.R.addModel(m); this.one = new Figure(m); this.wall = new Figure(m); } catch (e) { this.log('figure: ' + e.message); }
  }
  // → the figures to draw this frame
  frame(W, cam, viewW, viewH, dt, t) {
    const out = [];
    if (!this.one) return out;
    const vis = (x, y, r) => Math.abs(x - cam[0]) < viewW / 2 + r && Math.abs(y - cam[1]) < viewH / 2 + r;
    const th = W.thing, cl = W.climber, cr = W.deep.crawler;
    if (cl && cl.path) {
      this.one.hollow = 1; this.one.gain = 1; this.one.D = 22; this.one.lights = cl.lights || [];
      if (vis(cl.x, cl.y, 12)) out.push(poseClimb(this.one, this.c1, cl, dt, t));
      cl.jump = false;
    } else if (th && !th.gone && vis(th.x, th.y, 14)) {
      const F = this.one;
      F.gain = th.gain ?? 1; F.D = 16; F.lights = th.lights || [];
      if (th.reach) { F.hollow = 1; th.hands = null; out.push(poseReach(F, th.reach)); }
      else { F.hollow = th.hollow ?? 0.9; out.push(poseKneel(F, th, t)); th.hands = mix3(F.p('handL'), F.p('handR'), 0.5); th.hands = add(th.hands, [0.06 * th.k, -0.02 * th.k, 0]); }
    }
    if (cr && cr.on && cam[1] < -430 && vis(cr.x, cr.y, 12)) {
      // on the back wall, belly to it, climbing; the head turned right round to look whenever it stops
      const F = this.wall;
      F.hollow = 1; F.gain = 0.9; F.D = 22;
      const look = (this._l = lerp(this._l ?? 0, cr.look, Math.min(1, dt * 4)));
      out.push(poseClimb(F, this.c2, { s: cr.y + 1.5, k: 4.0, path: (s) => [cr.x + Math.sin(s * 0.35) * 0.4, s, -1.2], out: () => [0, 0, 1], rear: 0, lift: 0.28, step: 0.85, spread: 0.42,
        neck: 0.45 + look * 0.35, look, head: 1.2, mouth: 0.4 + 1.0 * look, twitch: cr.jerk, quick: 9, jump: this._cy === undefined || Math.abs(cr.y - this._cy) > 4 }, dt, t));
      F.lights = [{ x: cr.x + 2.5, y: cr.y + 5, z: 2.5, r: 10, i: 0.55, c: [0.75, 0.8, 1] }];
      this._cy = cr.y;
    } else this._cy = undefined;
    return out;
  }
}

// the end of the thing's kneel: how its head leaves her shoulders. u 0..1: from high in the dark over her, down to the doll
export function neckDown(x, y, k, doll, u, roll, size, push = 0) {
  const a = [x - 0.4, y + 9.5, -0.8], m = [x + 2.6, y + 6.4, 0], e = [doll[0] - 1.75, doll[1] + 1.35, 0.7];
  const s = 1 - u, at = [0, 1, 2].map((q) => s * s * a[q] + 2 * s * u * m[q] + u * u * e[q]);
  at[2] += push;
  const face = norm(mix3([0.5, -0.8, 0.5], [0.55, -0.12, 1], smooth(0.5, 1, u)));
  // it comes down the wrong way up, and turns over when it is there
  const ang = Math.PI * (1 - roll), up = [Math.sin(ang) * 0.8, Math.cos(ang), 0];
  const over = add(at, [-0.5, lerp(3.4, 2.6, u), -1.2]);
  return { at, face, up, size, thick: 0.8, bend: [mix3([x - 1.6, y + 6.5, -0.6], [x - 2.6, y + 5.4, -0.8], roll), mix3(over, add(at, [-1.5, 2.5, -2.2]), roll)] };
}
