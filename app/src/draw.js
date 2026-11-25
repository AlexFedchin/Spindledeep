// Sprite layer. Everything here is drawn in grey *tone* on a transparent canvas; the engraving shader
// lights it and turns it into line work. Glows go on a second, additive, half-resolution canvas.
import { clamp, mulberry, lerp, TAU } from './util.js';
import * as L from './level.js';
import { SNAG_R } from './player.js';
import { drawLore, drawKeepsakes, drawHusks, drawShowItem } from './props.js';
import { drawDeep } from './drawdeep.js';
import { drawShelves } from './drawshelf.js';
import { drawBuried, placeBuried } from './buried.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;

export class Drawer {
  constructor(world) {
    this.w = world;
    this.fx = [];
    this.rng = mulberry(7);
    this.trees = makeTrees();
    this.fg = makeForeground(world);
    this.buried = world.T.buried ||= placeBuried(world.T);
    this.hookChains = world.hooks.map((h) => {
      let top = h.sway ? h.ay : h.y;
      for (let k = 0; k < 160; k++) { top += 0.1; if (world.T.d(h.x, top) < 0) break; }
      return top;
    });
    this.tuft = { a: 0, v: 0 };
    this.lore = world.lore;
    this.wind = 4; this.gust = 0; this.out = 1;
    this.fog = makeFog();
  }

  // pictures of her rendered from the model (main.js loads them once)
  get img() { return Drawer.IMG; }

  // world → screen
  setView(cam, viewH, W, H) {
    this.cam = cam; this.viewH = viewH; this.W = W; this.H = H;
    this.k = H / viewH; this.viewW = viewH * W / H;
  }
  sx(x, par = 1) { return (x - this.cam[0]) * par * this.k + this.W / 2; }
  sy(y, par = 1) { return this.H / 2 - (y - this.cam[1]) * par * this.k; }
  vis(x, y, m = 4) { return Math.abs(x - this.cam[0]) < this.viewW / 2 + m && Math.abs(y - this.cam[1]) < this.viewH / 2 + m; }

  spawn(kind, x, y, n = 1, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = (o.speed ?? 2) * (0.3 + Math.random());
      this.fx.push({ kind, x, y, vx: Math.cos(a) * s + (o.vx || 0), vy: Math.sin(a) * s + (o.vy || 0), life: (o.life ?? 1) * (0.6 + Math.random() * 0.6), t: 0, r: o.r ?? 1, rot: Math.random() * TAU });
    }
  }

  draw(ctx, ectx, dt, time) {
    const w = this.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.W, this.H);
    ectx.setTransform(1, 0, 0, 1, 0, 0); ectx.clearRect(0, 0, ectx.canvas.width, ectx.canvas.height);
    ectx.setTransform(0.5, 0, 0, 0.5, 0, 0);
    ectx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    this.time = time; this.dtLast = dt;
    this.ambientFx(dt);
    drawBuried(this, ctx);
    this.drawFog(ctx, false);
    this.drawTrees(ctx);
    this.drawCottage(ctx, ectx);
    drawLore(this, ctx, ectx);
    drawHusks(this, ctx, ectx);
    drawShelves(this, ctx, ectx);
    this.drawThorns(ctx, ectx);
    this.drawGates(ctx, ectx);
    this.drawHooks(ctx, ectx);
    this.drawPegs(ctx, ectx);
    this.drawBells(ctx, ectx);
    this.drawSkeins(ctx, ectx);
    drawKeepsakes(this, ctx, ectx);
    this.drawMemories(ctx, ectx);
    drawDeep(this, ctx, ectx);
    this.drawDrips(ctx);
    this.drawFx(ctx, ectx, dt, false);
    for (const m of w.moths) if (this.vis(m.x, m.y)) this.drawMoth(ctx, ectx, m);
    this.drawDoll(ctx, ectx, dt);
    if (w.showcase && w.showcase.item) drawShowItem(this, ctx, ectx, w.showcase.item);
    this.drawFx(ctx, ectx, dt, true);
    this.drawFog(ctx, true);
    this.drawForeground(ctx);
  }

  // ── the doll ──────────────────────────────────────────────────────────
  drawDoll(ctx, ectx, dt) {
    const p = this.w.player, th = this.w.thread;
    if ((p.dead && p.deadT > 0.9) || this.w.hideDoll) return;
    const wi = this.w.intro && !this.w.intro.done ? this.w.intro : null;     // walking out of the cottage
    if (wi && wi.hide) return;
    const k = this.k;
    const s = p.scale * (p.dead ? Math.max(0, 1 - p.deadT / 0.9) : 1) * (wi ? wi.scale : 1);
    const X = this.sx(p.x), Y = this.sy(p.y);
    const f = p.facing;
    const swing = th.locked && !p.grounded;
    const moving = p.grounded && Math.abs(p.vx) > 0.4;
    const sq = p.squash;
    const sxk = (1 + sq * 0.6) * s, syk = (1 - sq) * s;
    // springs: the yarn tuft and the ribbon tails lag behind the motion
    this.tuft.v += (-p.vx * 0.08 - this.wind * this.out * 0.035 * (1 + Math.sin(this.time * 9) * 0.3) - this.tuft.a * 30) * dt - this.tuft.v * 6 * dt;
    this.tuft.a += this.tuft.v * dt * 10;
    const rib = clamp(-p.vx * 0.06 * f + p.vy * 0.03, -0.6, 0.6) + Math.sin(this.time * 2.6) * 0.06;

    ctx.save();
    ctx.translate(X, Y);
    let tilt = 0;
    if (swing) { const P = th.pivots[th.pivots.length - 1]; tilt = Math.atan2(p.bx - P.x, -(p.by - P.y)) * 0.6; }
    else if (!p.grounded) tilt = clamp(p.vx * 0.03, -0.25, 0.25);
    else tilt = clamp(p.vx * 0.02, -0.1, 0.1);
    ctx.rotate(tilt);
    ctx.scale(sxk * f, syk);
    const u = k; // 1 m in px
    const lw = Math.max(1.4, u * 0.022);
    const fine = Math.max(0.7, u * 0.009);
    const stroke = (v, w) => { ctx.strokeStyle = g(v); ctx.lineWidth = w; ctx.stroke(); };
    const yarn = (x0, y0, cx, cy, x1, y1, w, v) => {
      // a two-tone yarn limb: dark outline, light core, and a few ribbing bands
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1);
      stroke(0.04, w * 1.55); stroke(v, w);
      ctx.strokeStyle = g(0.3); ctx.lineWidth = fine;
      for (let t = 0.2; t < 0.95; t += 0.22) {
        const it = 1 - t, px = it * it * x0 + 2 * it * t * cx + t * t * x1, py = it * it * y0 + 2 * it * t * cy + t * t * y1;
        const tx = 2 * it * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * it * (cy - y0) + 2 * t * (y1 - cy), tl = Math.hypot(tx, ty) || 1;
        const nx = -ty / tl * w * 0.55, ny = tx / tl * w * 0.55;
        ctx.beginPath(); ctx.moveTo(px - nx, py - ny); ctx.lineTo(px + nx, py + ny); ctx.stroke();
      }
    };

    // ── legs with felt feet ──
    const legPh = p.walk;
    const legA = moving ? Math.sin(legPh) * 0.12 : !p.grounded ? 0.07 : 0;
    for (const side of [-1, 1]) {
      const lx = side * 0.08 * u, ly = 0.04 * u;
      const fx = lx + (side * legA + (p.grounded ? 0 : 0.03)) * u, fy = (0.25 - (moving ? Math.max(0, Math.sin(legPh * side)) * 0.06 : 0)) * u;
      yarn(lx, ly, (lx + fx) / 2, (ly + fy) / 2, fx, fy, 0.05 * u, side > 0 ? 0.7 : 0.6);
      ctx.beginPath(); ctx.ellipse(fx + 0.025 * u, fy + 0.02 * u, 0.06 * u, 0.035 * u, 0, 0, TAU);
      ctx.fillStyle = g(0.2); ctx.fill(); stroke(0.03, fine * 1.4);
    }

    // ── body: a knitted sack ──
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-0.2 * u, 0.06 * u);
      ctx.bezierCurveTo(-0.24 * u, -0.12 * u, -0.17 * u, -0.27 * u, 0, -0.28 * u);
      ctx.bezierCurveTo(0.17 * u, -0.27 * u, 0.24 * u, -0.12 * u, 0.2 * u, 0.06 * u);
      ctx.bezierCurveTo(0.17 * u, 0.15 * u, -0.17 * u, 0.15 * u, -0.2 * u, 0.06 * u);
      ctx.closePath();
    };
    body(); ctx.fillStyle = g(0.56); ctx.fill();
    ctx.save(); body(); ctx.clip();
    // knit stitches: rows of little V's, shaded darker toward the back edge
    ctx.lineWidth = fine;
    for (let r = -0.26; r < 0.14; r += 0.05) {
      for (let c = -0.22; c < 0.22; c += 0.045) {
        const ox = (c + (Math.round(r / 0.05) % 2) * 0.0225) * u, oy = r * u;
        ctx.strokeStyle = g(0.3 - Math.max(0, -c) * 0.6);
        ctx.beginPath(); ctx.moveTo(ox - 0.017 * u, oy); ctx.lineTo(ox, oy + 0.028 * u); ctx.lineTo(ox + 0.017 * u, oy); ctx.stroke();
      }
    }
    // a soft shadow on the back half
    ctx.fillStyle = g(0.15, 0.35); ctx.beginPath(); ctx.ellipse(-0.2 * u, -0.05 * u, 0.12 * u, 0.3 * u, 0, 0, TAU); ctx.fill();
    // a patch from his coat sleeve: darker cloth, tacked on with running stitches
    ctx.save(); ctx.translate(-0.07 * u, 0.0); ctx.rotate(-0.12);
    ctx.fillStyle = g(0.18); ctx.fillRect(-0.075 * u, -0.06 * u, 0.15 * u, 0.12 * u);
    ctx.strokeStyle = g(0.2); ctx.lineWidth = fine;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-0.07 * u, (-0.04 + i * 0.03) * u); ctx.lineTo(0.07 * u, (-0.045 + i * 0.03) * u); ctx.stroke(); }  // herringbone weave
    ctx.setLineDash([0.018 * u, 0.014 * u]); ctx.strokeStyle = g(0.97); ctx.lineWidth = fine * 1.6;
    ctx.strokeRect(-0.064 * u, -0.05 * u, 0.128 * u, 0.1 * u); ctx.setLineDash([]);
    ctx.restore();
    ctx.restore();
    body(); stroke(0.03, lw);
    // the wedding ribbon worn as a sash, knotted in a bow at the hip
    ctx.beginPath(); ctx.moveTo(-0.19 * u, -0.17 * u); ctx.quadraticCurveTo(0, -0.07 * u, 0.2 * u, 0.0);
    ctx.lineTo(0.2 * u, 0.045 * u); ctx.quadraticCurveTo(0, -0.02 * u, -0.2 * u, -0.12 * u); ctx.closePath();
    ctx.fillStyle = g(0.98); ctx.fill(); stroke(0.03, fine * 1.4);
    const bxo = 0.17 * u, byo = 0.02 * u;
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(bxo, byo); ctx.bezierCurveTo(bxo + sd * 0.07 * u, byo - 0.07 * u, bxo + sd * 0.1 * u, byo + 0.01 * u, bxo, byo);
      ctx.fillStyle = g(0.93); ctx.fill(); stroke(0.05, fine * 1.2);
    }
    for (const sd of [0, 1]) {
      const a = rib + sd * 0.35;
      ctx.beginPath(); ctx.moveTo(bxo, byo);
      ctx.quadraticCurveTo(bxo + (0.04 + Math.sin(a) * 0.08) * u, byo + 0.08 * u, bxo + (0.02 + Math.sin(a) * 0.16 + sd * 0.03) * u, byo + (0.15 - sd * 0.02) * u);
      stroke(0.05, 0.03 * u); stroke(0.93, 0.018 * u);
    }
    ctx.beginPath(); ctx.arc(bxo, byo, 0.016 * u, 0, TAU); ctx.fillStyle = g(0.8); ctx.fill(); stroke(0.05, fine);
    // a single shirt button, sewn on with a cross
    ctx.beginPath(); ctx.arc(0.08 * u, -0.17 * u, 0.028 * u, 0, TAU); ctx.fillStyle = g(0.25); ctx.fill(); stroke(0.03, fine);
    ctx.strokeStyle = g(0.85); ctx.lineWidth = fine;
    ctx.beginPath(); ctx.moveTo(0.07 * u, -0.18 * u); ctx.lineTo(0.09 * u, -0.16 * u); ctx.moveTo(0.09 * u, -0.18 * u); ctx.lineTo(0.07 * u, -0.16 * u); ctx.stroke();

    // ── arms with mitten hands ──
    const armUp = swing || (th.locked && p.grounded);
    for (const side of [-1, 1]) {
      const ax0 = side * 0.17 * u, ay0 = -0.14 * u;
      let ex, ey;
      if (armUp) { ex = side * 0.1 * u + 0.05 * u; ey = -0.42 * u; }
      else if (p.tieT > 0) { ex = 0.22 * u; ey = (-0.08 + Math.sin(this.time * 30 + side) * 0.03) * u; }
      else if (moving) { ex = ax0 + side * 0.06 * u + Math.sin(legPh + (side > 0 ? Math.PI : 0)) * 0.08 * u; ey = -0.02 * u; }
      else if (!p.grounded) { ex = side * 0.3 * u; ey = (p.vy > 0 ? -0.26 : -0.1) * u; }
      else { ex = side * 0.24 * u; ey = (-0.03 + Math.sin(this.time * 2.2 + side) * 0.008) * u; }
      yarn(ax0, ay0, (ax0 + ex) / 2 + side * 0.03 * u, (ay0 + ey) / 2, ex, ey, 0.046 * u, side > 0 ? 0.76 : 0.62);
      ctx.beginPath(); ctx.arc(ex, ey, 0.04 * u, 0, TAU); ctx.fillStyle = g(0.55); ctx.fill(); stroke(0.03, fine * 1.4);
      ctx.beginPath(); ctx.arc(ex + side * 0.02 * u, ey - 0.03 * u, 0.017 * u, 0, TAU); ctx.fillStyle = g(0.55); ctx.fill(); stroke(0.03, fine);   // thumb
    }

    // ── head ── (turns on the neck to look up or down: W/S while standing)
    const look = p.look || 0;
    ctx.save();
    if (Math.abs(look) > 0.01) { ctx.translate(0.02 * u, -0.27 * u); ctx.rotate(-look * (look > 0 ? 0.42 : 0.36)); ctx.translate(-0.02 * u, 0.27 * u); }
    const hy = -0.47 * u, hr = 0.22 * u;
    const head = () => { ctx.beginPath(); ctx.ellipse(0.01 * u, hy, hr * 1.04, hr, 0, 0, TAU); };
    head(); ctx.fillStyle = g(0.86); ctx.fill();
    ctx.save(); head(); ctx.clip();
    // knitted rows that curve around the skull
    ctx.strokeStyle = g(0.62); ctx.lineWidth = fine;
    for (let r = -0.2; r < 0.22; r += 0.04) { ctx.beginPath(); ctx.ellipse(0.01 * u, hy + r * u * 0.3, hr * 1.05, Math.abs(r) * u * 0.9 + 0.01 * u, 0, 0.15, Math.PI - 0.15); ctx.stroke(); }
    ctx.fillStyle = g(0.2, 0.3); ctx.beginPath(); ctx.ellipse(-0.17 * u, hy + 0.03 * u, 0.1 * u, 0.24 * u, 0, 0, TAU); ctx.fill();
    // a darned patch behind the eye
    ctx.fillStyle = g(0.66); ctx.beginPath(); ctx.ellipse(-0.12 * u, hy - 0.1 * u, 0.055 * u, 0.045 * u, 0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = g(0.4);
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo((-0.12 + i * 0.018) * u, hy - 0.14 * u); ctx.lineTo((-0.12 + i * 0.018) * u, hy - 0.06 * u); ctx.stroke(); }
    ctx.restore();
    head(); stroke(0.03, lw);
    // seam with cross stitches
    ctx.lineWidth = Math.max(0.8, u * 0.011); ctx.strokeStyle = g(0.25);
    ctx.beginPath(); ctx.arc(-0.06 * u, hy - 0.02 * u, hr * 0.95, -1.2, 0.2); ctx.stroke();
    for (let a = -1.1; a < 0.2; a += 0.22) {
      const cx = -0.06 * u + Math.cos(a) * hr * 0.95, cy = hy - 0.02 * u + Math.sin(a) * hr * 0.95;
      ctx.beginPath(); ctx.moveTo(cx - 0.015 * u, cy - 0.015 * u); ctx.lineTo(cx + 0.015 * u, cy + 0.015 * u); ctx.stroke();
    }
    // button eye with four holes and the thread through them
    const blink = (Math.sin(this.time * 0.9) > 0.985) ? 0.25 : 1;
    ctx.fillStyle = g(0.02);
    ctx.beginPath(); ctx.ellipse(0.1 * u, hy + 0.01 * u, 0.058 * u, 0.058 * u * blink, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = g(0.5); ctx.lineWidth = fine;
    ctx.beginPath(); ctx.ellipse(0.1 * u, hy + 0.01 * u, 0.044 * u, 0.044 * u * blink, 0, 0, TAU); ctx.stroke();
    if (blink > 0.5) {
      ctx.fillStyle = g(0.75);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc((0.1 + a * 0.016) * u, hy + (0.01 + b * 0.016) * u, 0.008 * u, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = g(0.75); ctx.lineWidth = fine * 1.2;
      ctx.beginPath(); ctx.moveTo(0.084 * u, hy - 0.006 * u); ctx.lineTo(0.116 * u, hy + 0.026 * u); ctx.stroke();
      // a glint of the thread's light in the button
      ctx.fillStyle = g(0.97); ctx.beginPath(); ctx.arc(0.083 * u, hy - 0.02 * u, 0.011 * u, 0, TAU); ctx.fill();
    }
    // stitched X eye
    ctx.strokeStyle = g(0.02); ctx.lineWidth = Math.max(1.2, 0.022 * u);
    const ex2 = -0.04 * u, ey2 = hy + 0.01 * u, e = 0.035 * u;
    ctx.beginPath(); ctx.moveTo(ex2 - e, ey2 - e); ctx.lineTo(ex2 + e, ey2 + e); ctx.moveTo(ex2 + e, ey2 - e); ctx.lineTo(ex2 - e, ey2 + e); ctx.stroke();
    // a small stitched mouth
    ctx.strokeStyle = g(0.1); ctx.lineWidth = Math.max(0.9, 0.012 * u);
    ctx.setLineDash([0.02 * u, 0.012 * u]);
    ctx.beginPath(); ctx.moveTo(0.0, hy + 0.1 * u); ctx.quadraticCurveTo(0.05 * u, hy + (p.dead ? 0.08 : 0.125) * u, 0.11 * u, hy + 0.095 * u); ctx.stroke();
    ctx.setLineDash([]);
    // a tuft of yarn loops on top
    const ta = this.tuft.a + Math.sin(this.time * 1.7) * 0.05;
    for (const [ox, len, sp, v] of [[-0.05, 0.16, -1, 0.7], [0.0, 0.2, 1, 0.82], [0.05, 0.14, 1.4, 0.75]]) {
      ctx.beginPath(); ctx.moveTo(ox * u, hy - hr * 0.95);
      ctx.bezierCurveTo((ox + 0.04 * sp + ta * 0.4) * u, hy - hr - len * 0.7 * u, (ox - 0.1 * sp + ta) * u, hy - hr - len * u, (ox - 0.06 * sp + ta * 1.3) * u, hy - hr - len * 0.35 * u);
      stroke(0.04, 0.045 * u); stroke(v, 0.024 * u);
    }
    ctx.restore();
    ctx.restore();
    // a red cross-stitch heart that glows a little (the only colour the doll owns)
    const hx = X + f * 0.06 * u * sxk, hyy = Y - 0.12 * u * syk;
    ectx.fillStyle = `rgba(255,40,30,${0.55 * s})`;
    heart(ectx, hx, hyy, 0.045 * u * s);
  }

  // ── moths ─────────────────────────────────────────────────────────────
  drawMoth(ctx, ectx, m) {
    const k = this.k, X = this.sx(m.x), Y = this.sy(m.y), sz = 0.22 * m.size * k;
    ctx.save(); ctx.translate(X, Y);
    const landed = m.st === 'land' || m.st === 'doll';
    const flap = landed ? 0.25 + Math.abs(Math.sin(m.flap)) * 0.15 : Math.abs(Math.sin(m.flap));
    ctx.rotate(clamp(m.vx * 0.06, -0.5, 0.5));
    for (const side of [-1, 1]) {
      ctx.save(); ctx.scale(side, 1);
      // forewing
      ctx.beginPath();
      ctx.moveTo(0, -0.1 * sz);
      ctx.bezierCurveTo(0.6 * sz, -1.1 * sz * flap - 0.2 * sz, 1.5 * sz, -0.9 * sz * flap - 0.1 * sz, 1.35 * sz, 0.05 * sz);
      ctx.bezierCurveTo(1.0 * sz, 0.25 * sz, 0.4 * sz, 0.2 * sz, 0, 0.1 * sz);
      ctx.fillStyle = g(0.22); ctx.fill();
      ctx.lineWidth = Math.max(1, sz * 0.06); ctx.strokeStyle = g(0.02); ctx.stroke();
      // hindwing
      ctx.beginPath();
      ctx.moveTo(0, 0.05 * sz);
      ctx.bezierCurveTo(0.7 * sz, 0.2 * sz, 1.0 * sz, 0.6 * sz + 0.3 * sz * flap, 0.5 * sz, 0.85 * sz);
      ctx.bezierCurveTo(0.25 * sz, 0.9 * sz, 0.1 * sz, 0.5 * sz, 0, 0.3 * sz);
      ctx.fillStyle = g(0.3); ctx.fill(); ctx.stroke();
      // eye-spot
      ctx.fillStyle = g(0.85);
      ctx.beginPath(); ctx.ellipse(0.8 * sz, -0.35 * sz * flap - 0.05 * sz, 0.18 * sz, 0.13 * sz * (0.4 + flap * 0.6), 0, 0, TAU); ctx.fill();
      ctx.fillStyle = g(0.05);
      ctx.beginPath(); ctx.ellipse(0.8 * sz, -0.35 * sz * flap - 0.05 * sz, 0.07 * sz, 0.06 * sz * (0.4 + flap * 0.6), 0, 0, TAU); ctx.fill();
      // antenna
      ctx.strokeStyle = g(0.05); ctx.lineWidth = Math.max(0.8, sz * 0.04);
      ctx.beginPath(); ctx.moveTo(0.04 * sz, -0.3 * sz); ctx.quadraticCurveTo(0.25 * sz, -0.7 * sz, 0.45 * sz, -0.75 * sz); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = g(0.08);
    ctx.beginPath(); ctx.ellipse(0, 0.1 * sz, 0.12 * sz, 0.42 * sz, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ectx.fillStyle = 'rgba(255,200,190,0.5)';
    ectx.beginPath(); ectx.arc(X - 0.05 * sz, Y - 0.3 * sz, Math.max(1, 0.05 * sz), 0, TAU); ectx.arc(X + 0.05 * sz, Y - 0.3 * sz, Math.max(1, 0.05 * sz), 0, TAU); ectx.fill();
  }

  // ── the Brink ─────────────────────────────────────────────────────────
  drawCottage(ctx, ectx) {
    if (!this.vis(14, 3, 12)) return;
    const k = this.k, T = this.w.T;
    const C = L.COTTAGE, gx = C.x, gy = C.y, W = C.w, WH = 3.4;
    const X = (x) => this.sx(x), Y = (y) => this.sy(y);
    const rng = mulberry(4242);
    const lw = (m) => Math.max(1, k * m);
    const poly = (pts, fill, stroke, w = 0.03) => {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.closePath();
      if (fill !== null) { ctx.fillStyle = g(fill); ctx.fill(); }
      if (stroke !== null) { ctx.strokeStyle = g(stroke); ctx.lineWidth = lw(w); ctx.stroke(); }
    };
    const line = (x0, y0, x1, y1, v, w) => { ctx.strokeStyle = g(v); ctx.lineWidth = lw(w); ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke(); };
    const base = gy + 0.55;                         // top of the stone footing
    const eL = gx - 1.1, eR = gx + W + 1.1, apex = gx + W / 2, ridge = base + WH + 3.0, eave = base + WH - 0.15;

    // ── lean-to woodshed on the left, its logs stacked under the eave ──
    const foot = [];                                  // its back stands on the ground, which rises to the left here
    for (let x = gx; x >= gx - 2.5; x -= 0.25) foot.push([x, L.surfaceY(x) - 0.1]);
    poly([[gx - 2.5, gy + 1.7], [gx, base + 2.4], ...foot], 0.16, 0.03);
    this._woodpile ||= makeWoodpile(gx, gy, base);
    for (const lg of this._woodpile) drawLogEnd(ctx, X(lg.x), Y(lg.y), lg, k);
    // a dusting of snow blown in over the top of the pile
    ctx.fillStyle = g(0.93);
    for (const lg of this._woodpile) if (lg.top) { ctx.beginPath(); ctx.ellipse(X(lg.x - 0.02), Y(lg.y + lg.r * 0.86), lg.r * 0.8 * k, lg.r * 0.28 * k, -0.1, Math.PI, TAU); ctx.fill(); }
    poly([[gx - 2.9, gy + 1.55], [gx + 0.1, base + 2.65], [gx + 0.1, base + 2.4], [gx - 2.9, gy + 1.3]], 0.22, 0.03);
    poly([[gx - 3.0, gy + 1.58], [gx + 0.1, base + 2.7], [gx + 0.1, base + 2.86], [gx - 2.6, gy + 1.82]], 0.95, null);
    // chopping block in the snow by the shed, the axe left in it, split wood and chips around it
    {
      const bx = gx - 3.25, by = L.surfaceY(bx) - 0.05;
      ctx.fillStyle = g(0.9);
      for (const [cx, cy, a] of [[-0.62, 0.02, 0.4], [0.5, 0.0, -0.7], [0.75, 0.03, 0.2], [-0.35, -0.01, 1.2], [0.25, 0.02, 2.1]]) {
        ctx.save(); ctx.translate(X(bx + cx), Y(by + cy)); ctx.rotate(a);
        ctx.fillStyle = g(0.6); ctx.fillRect(-0.05 * k, -0.018 * k, 0.1 * k, 0.036 * k); ctx.restore();
      }
      const sw = 0.36, sh = 0.46;
      ctx.beginPath(); ctx.moveTo(X(bx - sw - 0.05), Y(by - 0.04)); ctx.lineTo(X(bx - sw), Y(by + sh)); ctx.lineTo(X(bx + sw), Y(by + sh + 0.03)); ctx.lineTo(X(bx + sw + 0.06), Y(by - 0.04)); ctx.closePath();
      ctx.fillStyle = g(0.3); ctx.fill(); ctx.strokeStyle = g(0.04); ctx.lineWidth = lw(0.025); ctx.stroke();
      for (let i = 0; i < 5; i++) line(bx - sw + 0.1 + i * 0.13, by + 0.02, bx - sw + 0.08 + i * 0.13 + (i % 2) * 0.03, by + sh - 0.04, 0.12, 0.012);
      ctx.beginPath(); ctx.ellipse(X(bx), Y(by + sh + 0.015), sw * k, 0.07 * k, -0.04, 0, TAU); ctx.fillStyle = g(0.66); ctx.fill(); ctx.stroke();
      for (const rr of [0.1, 0.19, 0.27]) { ctx.beginPath(); ctx.ellipse(X(bx + 0.03), Y(by + sh + 0.015), rr * k, rr * 0.19 * k, -0.04, 0, TAU); ctx.strokeStyle = g(0.42); ctx.lineWidth = lw(0.01); ctx.stroke(); }
      // the axe: blade bitten into the block, haft angled up
      const ax0 = bx + 0.05, ay0 = by + sh + 0.02, ax1 = bx + 0.62, ay1 = by + sh + 0.62;
      ctx.strokeStyle = g(0.04); ctx.lineWidth = lw(0.075); ctx.beginPath(); ctx.moveTo(X(ax0), Y(ay0)); ctx.lineTo(X(ax1), Y(ay1)); ctx.stroke();
      ctx.strokeStyle = g(0.58); ctx.lineWidth = lw(0.04); ctx.beginPath(); ctx.moveTo(X(ax0), Y(ay0)); ctx.lineTo(X(ax1), Y(ay1)); ctx.stroke();
      poly([[ax0 - 0.17, ay0 - 0.05], [ax0 + 0.07, ay0 + 0.09], [ax0 + 0.11, ay0 + 0.02], [ax0 - 0.1, ay0 - 0.12]], 0.7, 0.03, 0.02);
      ctx.fillStyle = g(0.93); ctx.beginPath(); ctx.ellipse(X(bx - 0.1), Y(by + sh + 0.05), 0.2 * k, 0.05 * k, 0, Math.PI, TAU); ctx.fill();
    }

    // ── stone footing: three courses running down into the ground ──
    for (let row = 0; row < 2; row++) {
      let x = gx - 0.25 + (row % 2) * 0.3;
      const y0 = base - row * 0.36;
      while (x < gx + W + 0.25) {
        const w = 0.5 + rng() * 0.5, h = 0.34;
        const x1 = Math.min(x + w, gx + W + 0.25);
        ctx.beginPath();
        ctx.moveTo(X(x + 0.04), Y(y0 - 0.02)); ctx.lineTo(X(x1 - 0.05), Y(y0 - 0.01 - rng() * 0.04));
        ctx.lineTo(X(x1 - 0.02), Y(y0 - h + 0.04)); ctx.lineTo(X(x + 0.02), Y(y0 - h + 0.02 + rng() * 0.04)); ctx.closePath();
        ctx.fillStyle = g(0.38 + rng() * 0.18 - row * 0.08); ctx.fill(); ctx.strokeStyle = g(0.04); ctx.lineWidth = lw(0.022); ctx.stroke();
        x = x1;
      }
    }

    // ── walls: horizontal logs with round ends at the corners ──
    poly([[gx, base], [gx, base + WH], [gx + W, base + WH], [gx + W, base]], 0.3, 0.03);
    for (let y = 0.0; y < WH - 0.05; y += 0.34) {
      const yy = base + y;
      ctx.fillStyle = g(0.36 + 0.06 * Math.sin(y * 13));
      ctx.beginPath(); ctx.moveTo(X(gx), Y(yy + 0.3)); ctx.lineTo(X(gx + W), Y(yy + 0.3 + 0.02 * Math.sin(y * 7))); ctx.lineTo(X(gx + W), Y(yy + 0.04)); ctx.lineTo(X(gx), Y(yy + 0.04)); ctx.closePath(); ctx.fill();
      line(gx, yy + 0.02, gx + W, yy + 0.02 + 0.015 * Math.sin(y * 5), 0.07, 0.02);
      line(gx + 0.1, yy + 0.24, gx + W - 0.1, yy + 0.24, 0.55, 0.008);
      for (const cx of [gx - 0.08, gx + W + 0.08]) {
        ctx.beginPath(); ctx.ellipse(X(cx), Y(yy + 0.17), 0.13 * k, 0.15 * k, 0, 0, TAU); ctx.fillStyle = g(0.55); ctx.fill(); ctx.strokeStyle = g(0.05); ctx.lineWidth = lw(0.018); ctx.stroke();
        ctx.beginPath(); ctx.arc(X(cx), Y(yy + 0.17), 0.05 * k, 0, TAU); ctx.stroke();
      }
      if (rng() < 0.5) { const kx = gx + 0.4 + rng() * (W - 0.8); ctx.beginPath(); ctx.ellipse(X(kx), Y(yy + 0.17), 0.06 * k, 0.035 * k, 0, 0, TAU); ctx.strokeStyle = g(0.12); ctx.lineWidth = lw(0.012); ctx.stroke(); }
    }

    // ── window: shutters, mullions, a frosted flower box, her spinning wheel against the warm glass ──
    const wx = gx + 1.3, wy = base + 1.2, ww = 1.5, wh = 1.35;
    const dark = this.w.windowOut;            // the end: somebody has put the light out
    ctx.fillStyle = g(dark ? 0.02 : 0.97); ctx.fillRect(X(wx), Y(wy + wh), ww * k, wh * k);
    ctx.strokeStyle = g(0.2); ctx.lineWidth = lw(0.03);
    ctx.beginPath(); ctx.arc(X(wx + 0.95), Y(wy + 0.55), 0.42 * k, 0, TAU); ctx.stroke();
    for (let a = 0; a < 6; a++) line(wx + 0.95, wy + 0.55, wx + 0.95 + Math.cos(a + this.time * 0.05) * 0.42, wy + 0.55 + Math.sin(a + this.time * 0.05) * 0.42, 0.25, 0.012);
    line(wx + 0.95, wy + 0.55, wx + 0.55, wy, 0.2, 0.03); line(wx + 0.25, wy + 0.1, wx + 0.25, wy + 0.5, 0.2, 0.04);
    ctx.strokeStyle = g(0.05); ctx.lineWidth = lw(0.07); ctx.strokeRect(X(wx), Y(wy + wh), ww * k, wh * k);
    line(wx + ww / 2, wy, wx + ww / 2, wy + wh, 0.05, 0.05); line(wx, wy + wh / 2, wx + ww, wy + wh / 2, 0.05, 0.05);
    poly([[wx - 0.62, wy + wh + 0.02], [wx - 0.02, wy + wh + 0.02], [wx - 0.02, wy - 0.02], [wx - 0.62, wy - 0.02]], 0.24, 0.03);
    for (let i = 1; i < 4; i++) line(wx - 0.6, wy + i * wh / 4, wx - 0.04, wy + i * wh / 4, 0.12, 0.015);
    ctx.save(); ctx.translate(X(wx + ww + 0.02), Y(wy + wh)); ctx.rotate(0.13);    // the right shutter hangs from one hinge
    ctx.fillStyle = g(0.24); ctx.fillRect(0, 0, 0.6 * k, (wh + 0.04) * k); ctx.strokeStyle = g(0.03); ctx.lineWidth = lw(0.03); ctx.strokeRect(0, 0, 0.6 * k, (wh + 0.04) * k);
    ctx.strokeStyle = g(0.12);
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, i * wh / 4 * k); ctx.lineTo(0.6 * k, i * wh / 4 * k); ctx.stroke(); }
    ctx.restore();
    poly([[wx - 0.15, wy - 0.02], [wx + ww + 0.15, wy - 0.02], [wx + ww + 0.05, wy - 0.3], [wx - 0.05, wy - 0.3]], 0.3, 0.03);
    for (let i = 0; i < 7; i++) line(wx + 0.05 + i * 0.22, wy - 0.02, wx + 0.1 + i * 0.22 + Math.sin(i * 3) * 0.06, wy + 0.25 + (i % 3) * 0.06, 0.08, 0.016);
    poly([[wx - 0.18, wy + 0.02], [wx + ww + 0.18, wy + 0.02], [wx + ww + 0.1, wy + 0.1], [wx - 0.1, wy + 0.1]], 0.96, null);
    const fl = dark ? 0 : 0.85 + Math.sin(this.time * 11) * 0.05 + Math.sin(this.time * 6.3) * 0.06;
    const grd = ectx.createRadialGradient(X(wx + 0.7), Y(wy + 0.65), 0, X(wx + 0.7), Y(wy + 0.65), 2.4 * k);
    grd.addColorStop(0, `rgba(255,170,80,${0.5 * fl})`); grd.addColorStop(0.3, `rgba(255,130,50,${0.16 * fl})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    ectx.fillStyle = grd; ectx.fillRect(X(wx + 0.7) - 2.4 * k, Y(wy + 0.65) - 2.4 * k, 4.8 * k, 4.8 * k);
    ectx.fillStyle = `rgba(255,190,110,${0.55 * fl})`; ectx.fillRect(X(wx) + 3, Y(wy + wh) + 3, ww * k - 6, wh * k - 6);
    const slant = ectx.createLinearGradient(0, Y(wy), 0, Y(gy - 0.1));
    slant.addColorStop(0, `rgba(255,170,90,${0.05 * fl})`); slant.addColorStop(1, 'rgba(255,170,90,0)');
    ectx.fillStyle = slant;     // a long slant of window light across the snow
    ectx.beginPath(); ectx.moveTo(X(wx), Y(wy)); ectx.lineTo(X(wx + ww), Y(wy)); ectx.lineTo(X(wx + ww + 2.2), Y(gy - 0.1)); ectx.lineTo(X(wx - 0.6), Y(gy - 0.1)); ectx.closePath(); ectx.fill();

    // ── door: planks, strap hinges, the knob, a worn step and an unlit lantern ──
    const dx = gx + 5.3, dw = 1.35, dh = 2.45;
    poly([[dx - 0.12, base], [dx - 0.12, base + dh + 0.14], [dx + dw + 0.12, base + dh + 0.14], [dx + dw + 0.12, base]], 0.5, 0.03);
    // the door swings out toward us on its left-hand hinges when she walks out (after the prologue)
    const op = this.w.intro ? this.w.intro.door : 0;
    if (op > 0.01) {
      // the room behind: firelit, the floorboards and the foot of her chair in the light
      poly([[dx, base], [dx, base + dh], [dx + dw, base + dh], [dx + dw, base]], 0.07, 0.03);
      for (let i = 1; i < 5; i++) line(dx + 0.02, base + i * 0.09, dx + dw - 0.02, base + i * 0.09 + 0.01, 0.34, 0.01);
      line(dx + dw * 0.72, base, dx + dw * 0.78, base + 0.9, 0.08, 0.05); line(dx + dw * 0.98, base, dx + dw * 0.92, base + 0.9, 0.08, 0.05);
      line(dx + dw * 0.7, base + 0.9, dx + dw, base + 0.9, 0.08, 0.05);
      const fl = 0.85 + Math.sin(this.time * 11) * 0.06 + Math.sin(this.time * 6.3) * 0.05;
      // firelight from deeper in the room: only a low warm wash along the floor, so she reads pale against the dark doorway
      { const fg = ectx.createLinearGradient(0, Y(base), 0, Y(base + 0.9)); fg.addColorStop(0, `rgba(255,140,60,${0.2 * op * fl})`); fg.addColorStop(1, 'rgba(255,140,60,0)'); ectx.fillStyle = fg; ectx.fillRect(X(dx) + 2, Y(base + 0.9), dw * k - 4, 0.9 * k); }
      // light thrown out over the step and the snow
      const spill = ectx.createLinearGradient(0, Y(base), 0, Y(gy - 0.3));
      spill.addColorStop(0, `rgba(255,160,80,${0.1 * op * fl})`); spill.addColorStop(1, 'rgba(255,160,80,0)');
      ectx.fillStyle = spill;
      ectx.beginPath(); ectx.moveTo(X(dx), Y(base)); ectx.lineTo(X(dx + dw), Y(base)); ectx.lineTo(X(dx + dw + 1.6), Y(gy - 0.3)); ectx.lineTo(X(dx - 1.0), Y(gy - 0.3)); ectx.closePath(); ectx.fill();
    }
    // the leaf: foreshortened as it turns on the hinges, its free edge swinging out and a little up/down in perspective
    const lw2 = dw * (1 - 0.82 * op), pe = 0.16 * op;
    poly([[dx, base], [dx, base + dh], [dx + lw2, base + dh + pe], [dx + lw2, base - pe]], 0.17 - 0.05 * op, 0.03);
    for (let i = 1; i < 4; i++) { const f = i / 4; line(dx + f * lw2, base + 0.04 - pe * f, dx + f * lw2, base + dh - 0.04 + pe * f, 0.08, 0.015); }
    for (const hy of [base + 0.45, base + dh - 0.45]) {
      const sk = (hy - base - dh / 2) / (dh / 2) * pe;
      line(dx + 0.02, hy, dx + 0.02 + 0.83 * lw2 / dw, hy + sk * 0.6, 0.03, 0.06);
      ctx.fillStyle = g(0.6); for (const nx of [0.15, 0.45, 0.75]) { ctx.beginPath(); ctx.arc(X(dx + nx * lw2 / dw), Y(hy + sk * nx), 0.022 * k, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = g(0.85); ctx.beginPath(); ctx.arc(X(dx + lw2 - 0.22 * lw2 / dw), Y(base + 1.1), 0.07 * k, 0, TAU); ctx.fill(); ctx.strokeStyle = g(0.04); ctx.lineWidth = lw(0.015); ctx.stroke();
    poly([[dx - 0.35, base], [dx + dw + 0.35, base], [dx + dw + 0.45, base - 0.22], [dx - 0.45, base - 0.22]], 0.5, 0.03);
    line(dx + dw + 0.2, base + 2.5, dx + dw + 0.6, base + 2.5, 0.04, 0.04); line(dx + dw + 0.55, base + 2.5, dx + dw + 0.55, base + 2.35, 0.04, 0.02);
    poly([[dx + dw + 0.44, base + 2.35], [dx + dw + 0.66, base + 2.35], [dx + dw + 0.62, base + 1.98], [dx + dw + 0.48, base + 1.98]], 0.5, 0.03, 0.02);

    // ── roof: rows of scalloped shingles, rafter ends, crossed gable beams, a heavy snow cap, icicles ──
    poly([[eL, eave], [apex, ridge], [eR, eave]], 0.16, 0.03);
    for (let r = 1; r < 9; r++) {
      const t = r / 9, yl = eave + (ridge - eave) * t, xl = eL + (apex - eL) * t, xr = eR - (eR - apex) * t;
      ctx.strokeStyle = g(0.07); ctx.lineWidth = lw(0.016);
      ctx.beginPath(); ctx.moveTo(X(xl), Y(yl));
      for (let x = xl; x < xr; x += 0.36) { const x2 = Math.min(xr, x + 0.36); ctx.quadraticCurveTo(X((x + x2) / 2), Y(yl - 0.1), X(x2), Y(yl)); }
      ctx.stroke();
      for (let x = xl + (r % 2) * 0.18; x < xr; x += 0.36) line(x, yl, x, yl - (ridge - eave) / 9 + 0.05, 0.1, 0.008);
    }
    for (let x = eL + 0.25; x < eR; x += 0.62) { ctx.fillStyle = g(0.45); ctx.fillRect(X(x), Y(eave), 0.12 * k, 0.12 * k); }
    line(apex - 0.5, ridge - 0.25, apex + 0.6, ridge + 0.55, 0.05, 0.08); line(apex + 0.5, ridge - 0.25, apex - 0.6, ridge + 0.55, 0.05, 0.08);
    ctx.fillStyle = g(0.97); ctx.beginPath();
    ctx.moveTo(X(eL - 0.12), Y(eave + 0.02)); ctx.lineTo(X(apex), Y(ridge + 0.2)); ctx.lineTo(X(eR + 0.12), Y(eave + 0.02));
    for (let x = eR; x > eL; x -= 0.3) {
      const t = 1 - Math.abs(x - apex) / (eR - apex);
      ctx.lineTo(X(x), Y(eave + (ridge - eave) * t - 0.42 - 0.1 * Math.sin(x * 4.3) - 0.06 * Math.sin(x * 11)));
    }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = g(0.55); ctx.lineWidth = lw(0.012); ctx.stroke();
    for (let x = eL + 0.2; x < eR - 0.1; x += 0.23) {
      const L2 = 0.08 + Math.abs(Math.sin(x * 7.1)) * 0.38 * (Math.sin(x * 2.3) > -0.3 ? 1 : 0.2);
      ctx.beginPath(); ctx.moveTo(X(x - 0.05), Y(eave - 0.02)); ctx.lineTo(X(x), Y(eave - 0.04 - L2)); ctx.lineTo(X(x + 0.05), Y(eave - 0.02)); ctx.closePath();
      ctx.fillStyle = g(0.92); ctx.fill(); ctx.strokeStyle = g(0.3); ctx.lineWidth = lw(0.006); ctx.stroke();
    }
    // ── chimney: coursed stone, a snow cap, smoke ──
    const cx0 = gx + 5.5, cw = 0.85, cb = eave + (ridge - eave) * (1 - (cx0 + cw - apex) / (eR - apex)) - 0.3, ct = ridge + 0.9;
    poly([[cx0, cb], [cx0 + 0.06, ct], [cx0 + cw + 0.06, ct], [cx0 + cw, cb]], 0.4, 0.03);
    for (let y = cb + 0.2; y < ct - 0.05; y += 0.24) {
      const o = (Math.round((y - cb) / 0.24) % 2) * 0.2;
      line(cx0 + 0.02, y, cx0 + cw + 0.04, y, 0.1, 0.012);
      for (let x = cx0 + 0.15 + o; x < cx0 + cw; x += 0.38) line(x, y, x, Math.min(ct, y + 0.24), 0.1, 0.012);
    }
    poly([[cx0 - 0.1, ct], [cx0 + cw + 0.16, ct], [cx0 + cw + 0.12, ct + 0.18], [cx0 - 0.06, ct + 0.18]], 0.55, 0.03);
    poly([[cx0 - 0.12, ct + 0.17], [cx0 + cw + 0.18, ct + 0.17], [cx0 + cw + 0.05, ct + 0.32], [cx0 + 0.02, ct + 0.34]], 0.97, null);
    if (Math.random() < 0.07) this.spawn('smoke', cx0 + cw / 2, ct + 0.35, 1, { speed: 0.2, vy: 0.5, vx: this.wind * 0.3, life: 3.5, r: 0.5 });

    // ── yard: a rain barrel, a broken fence, snow banked against the walls ──
    const bx = gx + W + 0.45;
    poly([[bx, gy - 0.1], [bx - 0.05, gy + 1.0], [bx + 0.85, gy + 1.0], [bx + 0.8, gy - 0.1]], 0.33, 0.03);
    for (const by of [gy + 0.2, gy + 0.78]) line(bx - 0.03, by, bx + 0.83, by, 0.06, 0.04);
    poly([[bx - 0.08, gy + 1.0], [bx + 0.93, gy + 1.0], [bx + 0.85, gy + 1.12], [bx, gy + 1.12]], 0.96, null);
    for (let i = 0; i < 5; i++) {
      const fx = gx - 7.4 + i * 0.95, lean = Math.sin(i * 1.7) * 0.12;
      const fy = (T.ground(fx, gy + 3, 6) ?? gy) - 0.15;
      const top = fy + 1.0 + Math.sin(i * 2.3) * 0.18;
      line(fx, fy, fx + lean, top, 0.05, 0.075);
      line(fx, fy, fx + lean, top, 0.6, 0.02);
      if (i < 4 && i !== 2) line(fx + lean * 0.6, fy + 0.6, fx + 0.95, fy + 0.55 + Math.sin(i) * 0.1, 0.06, 0.04);
    }
    // snow drifts that hug the real ground, so the house sits in its yard
    const top = [], bot = [];
    for (let x = gx - 3.2; x <= gx + W + 2.01; x += 0.3) {
      const gr = T.ground(x, gy + 2.5, 6) ?? gy;
      const edge = Math.min(1, (x - (gx - 3.2)) / 1.2, (gx + W + 2.0 - x) / 1.2);
      const bank = ((x > gx - 0.3 && x < gx + W + 0.3 ? 0.42 : 0.16) + 0.1 * Math.sin(x * 2.1) + 0.05 * Math.sin(x * 5.3)) * edge;
      top.push([x, gr + bank]); bot.push([x, gr - 0.12]);
    }
    ctx.fillStyle = g(0.95); ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(X(bot[i][0]), Y(bot[i][1]));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = g(0.5); ctx.lineWidth = lw(0.01); ctx.stroke();
  }

  drawTrees(ctx) {
    for (const t of this.trees) {
      if (!this.vis(t.x, t.y + 4, 8)) continue;
      // bend: tips move downwind with the square of their height, and shiver in the gusts
      const bend = (this.wind * 0.0016 + Math.sin(this.time * 2.1 + t.x) * 0.0012 * (0.4 + this.gust)) * this.out;
      const bx = (x, y) => x + bend * (y - t.y) * (y - t.y);
      if (!t.b0) t.b0 = t.branches.map((b) => ({ ...b }));
      t.branches.forEach((b, i) => { const o = t.b0[i]; b.x0 = bx(o.x0, o.y0); b.cx = bx(o.cx, o.cy); b.x1 = bx(o.x1, o.y1); });
      ctx.strokeStyle = g(0.06);
      for (const b of t.branches) {
        ctx.lineWidth = Math.max(1, b.w * this.k);
        ctx.beginPath(); ctx.moveTo(this.sx(b.x0), this.sy(b.y0)); ctx.quadraticCurveTo(this.sx(b.cx), this.sy(b.cy), this.sx(b.x1), this.sy(b.y1)); ctx.stroke();
      }
      ctx.strokeStyle = g(0.9);
      for (const b of t.branches) {
        if (b.w < 0.05) continue;
        ctx.lineWidth = Math.max(0.8, b.w * this.k * 0.35);
        ctx.beginPath(); ctx.moveTo(this.sx(b.x0), this.sy(b.y0) - b.w * this.k * 0.35); ctx.quadraticCurveTo(this.sx(b.cx), this.sy(b.cy) - b.w * this.k * 0.4, this.sx(b.x1), this.sy(b.y1) - b.w * this.k * 0.3); ctx.stroke();
      }
    }
  }

  // ── props ─────────────────────────────────────────────────────────────
  drawPegs(ctx, ectx) {
    const k = this.k;
    for (const pg of this.w.pegs) {
      if (pg.home || !this.vis(pg.x, pg.y)) continue;
      const X = this.sx(pg.x), Y = this.sy(pg.y);
      // a hammered iron stake with a little bobbin on it
      ctx.fillStyle = g(0.3); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.025);
      ctx.beginPath(); ctx.moveTo(X - 0.06 * k, Y + 0.1 * k); ctx.lineTo(X - 0.05 * k, Y - 0.75 * k); ctx.lineTo(X + 0.05 * k, Y - 0.75 * k); ctx.lineTo(X + 0.06 * k, Y + 0.1 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = g(0.55);
      ctx.beginPath(); ctx.ellipse(X, Y - 0.8 * k, 0.13 * k, 0.05 * k, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = g(0.5); ctx.fillRect(X - 0.09 * k, Y - 0.62 * k, 0.18 * k, 0.2 * k); ctx.strokeRect(X - 0.09 * k, Y - 0.62 * k, 0.18 * k, 0.2 * k);
      if (pg.tied) {
        ectx.fillStyle = `rgba(255,50,35,${0.35 + 0.4 * pg.glow})`;
        ectx.fillRect(X - 0.09 * k, Y - 0.6 * k, 0.18 * k, 0.16 * k);
      } else {
        // an untied peg still has a little of her red yarn waiting on it
        ectx.fillStyle = `rgba(255,60,40,${0.25 + 0.1 * Math.sin(this.time * 2 + pg.x)})`;
        ectx.fillRect(X - 0.09 * k, Y - 0.58 * k, 0.18 * k, 0.08 * k);
      }
    }
  }
  drawHooks(ctx, ectx) {
    const k = this.k;
    this.w.hooks.forEach((h, i) => {
      if (!this.vis(h.x, h.y, 6)) return;
      const top = this.hookChains[i];
      const sway = h.sway ? 0 : Math.sin(this.time * 0.8 + i) * 0.04 + h.ring * Math.sin(this.time * 18) * 0.08;
      const X = this.sx(h.x + sway), Y = this.sy(h.y);
      ctx.strokeStyle = g(0.08); ctx.lineWidth = Math.max(1, k * 0.03);
      // chain links (a swinging ring: a fixed chain from the roof to its pivot, then the swinging length to the ring)
      const ax = h.sway ? h.ax : h.x, ay = h.sway ? h.ay : h.y;
      for (let y = ay + (h.sway ? 0 : 0.3); y < top; y += 0.22) {
        const xx = this.sx(ax + sway * (top - y) / (top - h.y));
        ctx.beginPath(); ctx.ellipse(xx, this.sy(y), 0.04 * k, 0.09 * k, 0, 0, TAU); ctx.stroke();
      }
      if (h.sway) {
        const L = Math.hypot(h.x - h.ax, h.y - h.ay), n = Math.floor(L / 0.22);
        for (let j = 1; j < n; j++) { const t = j / n; ctx.beginPath(); ctx.ellipse(this.sx(h.ax + (h.x - h.ax) * t), this.sy(h.ay + (h.y - h.ay) * t), 0.04 * k, 0.09 * k, h.a || 0, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = g(0.3); ctx.fillRect(this.sx(h.ax) - 0.25 * k, this.sy(h.ay) - 0.08 * k, 0.5 * k, 0.16 * k);
      }
      ctx.lineWidth = Math.max(1.6, k * 0.06); ctx.strokeStyle = g(0.04);
      ctx.beginPath(); ctx.arc(X, Y, 0.22 * k, 0, TAU); ctx.stroke();
      ctx.lineWidth = Math.max(0.8, k * 0.02); ctx.strokeStyle = g(0.75);
      ctx.beginPath(); ctx.arc(X, Y, 0.22 * k, -2.4, -1.2); ctx.stroke();
      const pl = this.w.player;
      const near = !pl.grounded && !pl.dead && Math.hypot(h.x - pl.bx, h.y - pl.by) < SNAG_R + 0.4 && h.y > pl.by - 0.2;
      if (near) { ectx.strokeStyle = `rgba(255,70,50,${0.35 + 0.25 * Math.sin(this.time * 12)})`; ectx.lineWidth = 2; ectx.beginPath(); ectx.arc(X, Y, 0.3 * k, 0, TAU); ectx.stroke(); }
      if (h.ring > 0) { ectx.strokeStyle = `rgba(255,80,60,${h.ring * 0.7})`; ectx.lineWidth = 2; ectx.beginPath(); ectx.arc(X, Y, 0.22 * k, 0, TAU); ectx.stroke(); }
    });
  }
  drawBells(ctx, ectx) {
    const k = this.k;
    for (const b of this.w.bells) {
      if (!this.vis(b.x, b.y)) continue;
      const sw = Math.sin(b.sway * 1.3) * 0.06 + b.ring * Math.sin(b.sway * 14) * 0.25;
      const X = this.sx(b.x), Y = this.sy(b.y);
      const tipx = X + (0.25 + sw) * k, tipy = Y - 1.25 * k;
      // stem
      ctx.strokeStyle = g(0.05); ctx.lineWidth = Math.max(1.4, 0.06 * k);
      ctx.beginPath(); ctx.moveTo(X, Y + 0.05 * k); ctx.bezierCurveTo(X - 0.1 * k, Y - 0.6 * k, X + 0.05 * k, Y - 1.5 * k, tipx, tipy); ctx.stroke();
      // leaves
      ctx.fillStyle = g(0.25);
      for (const [lx, ly, s] of [[-0.25, -0.35, -1], [0.22, -0.55, 1]]) {
        ctx.beginPath(); ctx.ellipse(X + lx * k, Y + ly * k, 0.22 * k, 0.07 * k, s * 0.5, 0, TAU); ctx.fill();
      }
      // the drooping bell
      ctx.save(); ctx.translate(tipx, tipy); ctx.rotate(0.35 + sw * 2);
      ctx.beginPath();
      ctx.moveTo(-0.04 * k, 0); ctx.bezierCurveTo(-0.22 * k, 0.05 * k, -0.24 * k, 0.32 * k, -0.27 * k, 0.42 * k);
      ctx.quadraticCurveTo(-0.15 * k, 0.36 * k, 0, 0.44 * k); ctx.quadraticCurveTo(0.15 * k, 0.36 * k, 0.27 * k, 0.42 * k);
      ctx.bezierCurveTo(0.24 * k, 0.32 * k, 0.22 * k, 0.05 * k, 0.04 * k, 0); ctx.closePath();
      ctx.fillStyle = g(b.lit ? 0.95 : 0.7); ctx.fill();
      ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1, 0.025 * k); ctx.stroke();
      ctx.restore();
      if (b.lit > 0) {
        const a = b.lit * (0.45 + b.ring * 0.5);
        const gr = ectx.createRadialGradient(tipx, tipy + 0.3 * k, 0, tipx, tipy + 0.3 * k, 1.4 * k);
        gr.addColorStop(0, `rgba(230,240,255,${a})`); gr.addColorStop(0.25, `rgba(200,220,235,${a * 0.3})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ectx.fillStyle = gr; ectx.fillRect(tipx - 1.4 * k, tipy - 1.1 * k, 2.8 * k, 2.8 * k);
      } else if (b.gate) {
        // unrung bells that a veil listens for breathe faintly
        const gr = ectx.createRadialGradient(tipx, tipy + 0.3 * k, 0, tipx, tipy + 0.3 * k, 0.45 * k);
        gr.addColorStop(0, `rgba(210,220,230,${0.07 + 0.04 * Math.sin(this.time * 1.5 + b.x)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ectx.fillStyle = gr; ectx.fillRect(tipx - 0.5 * k, tipy - 0.2 * k, k, k);
      }
    }
  }
  drawGates(ctx, ectx) {
    const k = this.k;
    for (const gt of this.w.gates) {
      if (gt.open >= 1 || !this.vis(gt.x0, gt.y0, 6)) continue;
      const o = gt.open;
      ctx.strokeStyle = g(0.02); ctx.lineWidth = Math.max(1, 0.035 * k);
      if (gt.floor) {
        // a web stretched over the shaft
        for (let i = 0; i < 9; i++) {
          const y = gt.y0 + 0.5 + Math.sin(i * 1.7) * 0.25;
          ctx.globalAlpha = 1 - o;
          const y2 = y + Math.cos(i) * 0.2, mid = (gt.x0 + gt.x1) / 2, [wl, wr] = (gt.ends ||= [])[i] ||= [wallFrom(this.w.T, mid, y, -1), wallFrom(this.w.T, mid, y2, 1)];
          ctx.beginPath(); ctx.moveTo(this.sx(wl), this.sy(y));
          ctx.quadraticCurveTo(this.sx(mid), this.sy(y - 0.5 - Math.sin(this.time + i) * 0.1 - o * 2), this.sx(wr), this.sy(y2));
          ctx.stroke();
        }
        for (let x = gt.x0; x < gt.x1; x += 0.6) { if (this.w.T.d(x, gt.y1) < -0.15 || this.w.T.d(x + 0.3, gt.y0) < -0.15) continue; ctx.beginPath(); ctx.moveTo(this.sx(x), this.sy(gt.y1)); ctx.lineTo(this.sx(x + 0.3), this.sy(gt.y0 - o * 2)); ctx.stroke(); }
        ctx.globalAlpha = 1;
      } else {
        const n = 16;
        for (let i = 0; i < n; i++) {
          const x = gt.x0 + (gt.x1 - gt.x0) * (i + 0.5) / n;
          const bot = gt.y0 + (gt.y1 - gt.y0) * o * (1 + (i % 3) * 0.2);
          ctx.globalAlpha = 1 - o * 0.7;
          ctx.beginPath(); ctx.moveTo(this.sx(x), this.sy(gt.y1 + 0.3));
          const wv = Math.sin(this.time * 1.3 + i * 1.1) * 0.12;
          ctx.bezierCurveTo(this.sx(x + wv), this.sy((gt.y1 + bot) / 2), this.sx(x - wv), this.sy(bot + 0.5), this.sx(x + wv * 0.5), this.sy(bot));
          ctx.stroke();
          ctx.fillStyle = g(0.02); ctx.beginPath(); ctx.arc(this.sx(x + wv * 0.5), this.sy(bot), 0.05 * k, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  drawThorns(ctx, ectx) {
    // pale bone-white brambles: dark woody stems, long hooked spines, and a cold glint on every tip so
    // they read even where the thread has not reached
    const k = this.k, t = this.time;
    for (const chain of this.w.thorns) {
      if (!chain.length) continue;
      const x0 = chain[0][0], x1 = chain[chain.length - 1][0], yc = chain[0][1];
      if (!(Math.max(x0, x1) > this.cam[0] - this.viewW / 2 - 2 && Math.min(x0, x1) < this.cam[0] + this.viewW / 2 + 2 && Math.abs(yc - this.cam[1]) < this.viewH / 2 + 3)) continue;
      const stem = (v, x, y) => y + Math.sin(x * (1.3 + v * 0.7) + v * 2) * 0.22 + 0.12 + v * 0.06;
      // stems
      for (let v = 0; v < 3; v++) {
        ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(2, (0.11 - v * 0.02) * k);
        ctx.beginPath();
        chain.forEach(([x, y], i) => { const yy = stem(v, x, y); if (i === 0) ctx.moveTo(this.sx(x), this.sy(yy)); else ctx.lineTo(this.sx(x), this.sy(yy)); });
        ctx.stroke();
        ctx.strokeStyle = g(0.55); ctx.lineWidth = Math.max(0.8, 0.025 * k);
        ctx.stroke();
      }
      // spines
      chain.forEach(([x, y], i) => {
        if (!this.vis(x, y, 1)) return;
        for (let j = 0; j < 3; j++) {
          const yy = stem(j, x, y);
          const h = (i * 7 + j * 3) % 5;
          const a = -Math.PI / 2 + ((h - 2) * 0.38) + Math.sin(i * 1.7 + j) * 0.15;   // mostly upward
          const len = (0.28 + (h % 3) * 0.1) * k;
          const X = this.sx(x + j * 0.13), Y = this.sy(yy);
          const tx = X + Math.cos(a) * len, ty = Y + Math.sin(a) * len;
          const nx = -Math.sin(a) * 0.055 * k, ny = Math.cos(a) * 0.055 * k;
          ctx.beginPath(); ctx.moveTo(X - nx, Y - ny); ctx.quadraticCurveTo(X + Math.cos(a) * len * 0.6 + nx * 0.4, Y + Math.sin(a) * len * 0.6 + ny * 0.4, tx, ty); ctx.lineTo(X + nx, Y + ny); ctx.closePath();
          ctx.fillStyle = g(0.93); ctx.fill();
          ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, 0.018 * k); ctx.stroke();
          // a faint cold rim so the spine reads in the dark (sprites are otherwise lit only by the scene)
          ectx.strokeStyle = `rgba(190,200,230,${0.16 + 0.06 * Math.sin(t * 1.3 + i)})`; ectx.lineWidth = Math.max(1.2, 0.03 * k);
          ectx.beginPath(); ectx.moveTo(X, Y); ectx.quadraticCurveTo(X + Math.cos(a) * len * 0.6, Y + Math.sin(a) * len * 0.6, tx, ty); ectx.stroke();
          if (j === 1 && ectx) {
            const tw = 0.22 + 0.16 * Math.sin(t * 1.6 + i * 2.1);
            ectx.fillStyle = `rgba(205,215,240,${tw})`;
            ectx.beginPath(); ectx.arc(tx, ty, Math.max(1.4, 0.035 * k), 0, TAU); ectx.fill();
          }
        }
      });
    }
  }
  drawSkeins(ctx, ectx) {
    const k = this.k;
    for (const s of this.w.skeins) {
      if (s.taken || !this.vis(s.x, s.y)) continue;
      const X = this.sx(s.x), Y = this.sy(s.y + 0.22 + Math.sin(this.time * 1.4 + s.bob) * 0.03), r = 0.2 * k;
      ctx.fillStyle = g(0.55); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, 0.02 * k);
      ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = g(0.2);
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(X, Y, r * 0.95, r * (0.2 + i * 0.17), i * 0.6, 0, TAU); ctx.stroke(); }
      ectx.strokeStyle = 'rgba(255,50,40,0.55)'; ectx.lineWidth = 1.5;
      ectx.beginPath(); ectx.arc(X, Y, r, 0, TAU); ectx.stroke();
      ectx.beginPath(); ectx.moveTo(X + r * 0.7, Y + r * 0.7); ectx.quadraticCurveTo(X + r * 1.6, Y + r * 1.2, X + r * 2.2, Y + r * 1.0); ectx.stroke();
    }
  }
  drawMemories(ctx, ectx) {
    const k = this.k;
    for (const m of this.w.memories) {
      if (!this.vis(m.x, m.y)) continue;
      const X = this.sx(m.x), Y = this.sy(m.y);
      ctx.fillStyle = g(0.75); ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1, 0.02 * k);
      ctx.beginPath(); ctx.ellipse(X, Y, 0.11 * k, 0.09 * k, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(X + 0.05 * k, Y - 0.02 * k, 0.07 * k, 0.05 * k, -0.6, 0, TAU); ctx.stroke();
      if (!m.heard) {
        const a = 0.16 + 0.08 * Math.sin(this.time * 2 + m.x);
        const gr = ectx.createRadialGradient(X, Y, 0, X, Y, 0.5 * k);
        gr.addColorStop(0, `rgba(255,240,215,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ectx.fillStyle = gr; ectx.fillRect(X - 0.8 * k, Y - 0.8 * k, 1.6 * k, 1.6 * k);
      }
    }
  }
  drawDrips(ctx) {
    const k = this.k;
    for (const d of this.w.drips) {
      if (!this.vis(d.x, d.y, 30)) continue;
      ctx.fillStyle = g(0.0);
      const r = 0.05 + d.swell * 0.07;
      ctx.beginPath(); ctx.ellipse(this.sx(d.x), this.sy(d.y - r), r * k, r * 1.4 * k, 0, 0, TAU); ctx.fill();
      if (d.drop) {
        ctx.beginPath(); ctx.ellipse(this.sx(d.drop.x), this.sy(d.drop.y), 0.08 * k, 0.16 * k, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = g(0, 0.5); ctx.lineWidth = 0.05 * k;
        ctx.beginPath(); ctx.moveTo(this.sx(d.drop.x), this.sy(d.drop.y + 0.15)); ctx.lineTo(this.sx(d.drop.x), this.sy(d.drop.y + 0.15 - d.drop.vy * 0.04)); ctx.stroke();
      }
    }
  }

  // ── particles ─────────────────────────────────────────────────────────
  ambientFx(dt) {
    const c = this.cam, area = this.w.area(), t = this.time;
    const R = (a, b) => a + Math.random() * (b - a);
    const vw = this.viewW, vh = this.viewH;
    // the storm: how "outside" the camera is (full on the Brink, gone a few metres into the Throat),
    // and a wind that never stops but comes in gusts
    const out = this.w.stillAir ? 0 : area.id === 'brink' || area.id === 'throat' ? clamp((c[1] + 7) / 9, 0, 1) : 0;
    this.out = out;
    const gn = Math.sin(t * 0.21) * 0.5 + Math.sin(t * 0.57 + 1.3) * 0.32 + Math.sin(t * 1.43 + 0.4) * 0.18;
    this.gust = clamp(gn * 0.75 + 0.45, 0, 1);
    this.wind = 3.2 + this.gust * 9.5;
    const W = this.wind, sp = (n) => { let k = Math.floor(n * dt); if (Math.random() < n * dt - k) k++; return k; };
    if (out > 0.01) {
      // driven snow in the play plane: spawned upwind and above, flying as streaks
      for (let i = sp(520 * out); i-- > 0;) this.fx.push({ kind: 'snow', x: c[0] + R(-vw / 2 - W * 1.6, vw / 2), y: c[1] + R(-vh / 2, vh / 2 + 3), vx: R(0.75, 1.15), vy: R(-1.1, -2.6), life: R(1.8, 3), t: 0, r: R(0.5, 1.3), rot: R(0, 6), par: 1 });
      // a far curtain of small flakes (slower parallax): this is what reads as "thick"
      for (let i = sp(260 * out); i-- > 0;) this.fx.push({ kind: 'snowfar', x: c[0] + R(-vw * 0.8 - W * 2, vw * 0.8), y: c[1] + R(-vh * 0.8, vh * 0.8), vx: R(0.6, 0.9), vy: R(-0.8, -1.8), life: R(2.5, 4), t: 0, r: R(0.5, 1.1), rot: R(0, 6), par: 0.62 });
      // a few big flakes rushing past right in front of the lens
      for (let i = sp(16 * out); i-- > 0;) this.fx.push({ kind: 'snownear', x: c[0] + R(-vw * 0.5 - W, vw * 0.3), y: c[1] + R(-vh * 0.45, vh * 0.45), vx: R(1.3, 1.8), vy: R(-1.5, -3.5), life: R(0.9, 1.6), t: 0, r: R(0.8, 1.5), rot: R(0, 6), par: 1.55 });
      // spindrift: snow torn off the ground in the gusts, skimming low
      for (let i = sp(90 * out * this.gust * this.gust); i-- > 0;) {
        const x = c[0] + R(-vw / 2 - 6, vw / 2), gy = L.surfaceY(x);
        if (Math.abs(gy - c[1]) < vh) this.fx.push({ kind: 'drift', x, y: gy + R(0.0, 0.35), vx: R(0.9, 1.3), vy: R(0.1, 0.9), life: R(0.8, 1.8), t: 0, r: R(0.6, 1.2), rot: R(0, 6), par: 1 });
      }
    }
    if (area.id === 'throat' && c[1] < -1 && c[1] > -40) {
      // down in the pit the air is still: a few flakes that blew over the lip drift straight down
      const k = clamp((c[1] + 40) / 34, 0, 1) * (1 - out);
      for (let i = sp(22 * k); i-- > 0;) this.fx.push({ kind: 'fall', x: c[0] + R(-vw / 2, vw / 2), y: c[1] + vh / 2 + 1, vx: R(-0.15, 0.15), vy: R(-0.5, -0.9), life: 20, t: 0, r: R(0.5, 1.2), rot: R(0, 6), par: 1 });
    }
    if (out < 0.99 && area.id !== 'brink') {
      if (Math.random() < dt * 9 * (1 - out)) this.fx.push({ kind: 'dust', x: c[0] + R(-vw / 2, vw / 2), y: c[1] + R(-vh / 2, vh / 2), vx: R(-0.1, 0.1), vy: R(-0.05, 0.08), life: R(5, 9), t: 0, r: R(0.6, 1.4), rot: R(0, 6), par: R(0.9, 1.15) });
      if (area.id === 'gardens' && Math.random() < dt * 5) this.fx.push({ kind: 'spore', x: c[0] + R(-vw / 2, vw / 2), y: c[1] - vh / 2, vx: R(-0.2, 0.2), vy: R(0.2, 0.5), life: 14, t: 0, r: R(0.6, 1.2), rot: 0, par: 1 });
    }
  }
  // whiteout: big soft sheets of blown snow drifting across the Brink, some behind the play plane, one in front
  drawFog(ctx, front) {
    if (this.out < 0.01) return;
    const k = this.k, vw = this.viewW;
    if (front) { ctx.fillStyle = g(0.92, this.out * (0.04 + this.gust * 0.1)); ctx.fillRect(0, 0, this.W, this.H); }   // the whole view greys out in a gust
    for (const f of this.fog) {
      if (f.front !== front) continue;
      f.x += this.wind * f.speed * (this.dtLast || 0);
      const span = vw / f.par + f.rx * 2 + 10;
      const rel = ((f.x - this.cam[0] * f.par) % span + span * 1.5) % span - span / 2;
      const X = this.W / 2 + rel * f.par * k, Y = this.sy(f.y, f.par);
      const a = f.a * this.out * (0.45 + this.gust * 0.9);
      ctx.save(); ctx.translate(X, Y); ctx.scale(1, f.ry / f.rx);
      const R = f.rx * f.par * k;
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, g(0.97, a)); gr.addColorStop(0.55, g(0.95, a * 0.55)); gr.addColorStop(1, g(0.95, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  drawFx(ctx, ectx, dt, front) {
    const k = this.k;
    const keep = [];
    const snowB = [];
    for (const p of this.fx) {
      p.t += dt;
      if (p.t > p.life) continue;
      keep.push(p);
      const isFront = p.kind === 'fiber' || p.kind === 'spark' || p.kind === 'snow' || p.kind === 'snownear' || p.kind === 'drift' || p.kind === 'fall';
      if (isFront !== front) continue;
      const a = Math.min(1, p.t * 3, (p.life - p.t) * 1.5);
      switch (p.kind) {
        case 'snow': case 'snowfar': case 'snownear': case 'drift': {
          // flakes ride the wind (vx is a share of it), wobble, and draw as streaks along their motion;
          // segments are batched by kind and brightness and stroked together after the loop
          const wob = Math.sin(this.time * 2.3 + p.rot) * 0.6;
          const ux = this.wind * p.vx + wob, uy = p.vy + Math.cos(this.time * 1.9 + p.rot) * 0.4 + (p.kind === 'drift' ? -p.t * 1.2 : 0);
          p.x += ux * dt; p.y += uy * dt;
          if (p.kind !== 'snownear' && p.kind !== 'snowfar' && this.w.T.d(p.x, p.y) < 0) { p.t = p.life; break; }
          const par = p.par, X = this.W / 2 + (p.x - this.cam[0]) * par * k, Y = this.H / 2 - (p.y - this.cam[1]) * par * k;
          if (X < -60 || X > this.W + 60 || Y < -60 || Y > this.H + 60) break;
          // lens flakes only over open sky, never smeared across the rock face
          if (p.kind === 'snownear' && this.w.T.d(this.cam[0] + (X - this.W / 2) / k, this.cam[1] - (Y - this.H / 2) / k) < 0.3) break;
          const fade = a * (p.kind === 'drift' ? 0.6 : p.kind === 'snowfar' ? 0.5 : p.kind === 'snownear' ? 0.3 : 0.85) * this.out;
          if (fade <= 0.02) break;
          const st = (p.kind === 'snownear' ? 0.045 : 0.03) * par * (0.55 + p.r * 0.45);
          const kind = p.kind === 'snownear' ? 0 : p.kind === 'snowfar' ? 1 : 2;
          (snowB[kind * 4 + Math.min(3, (fade * 4) | 0)] ||= []).push(X, Y, X - ux * st * k, Y + uy * st * k);
          break;
        }
        case 'fall': {
          p.x += (p.vx + Math.sin(this.time * 0.8 + p.rot) * 0.25) * dt; p.y += p.vy * dt;
          if (this.w.T.d(p.x, p.y) < 0) { p.t = p.life; break; }
          ctx.fillStyle = g(0.97, a * 0.8);
          ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), Math.max(1, p.r * 0.03 * k), 0, TAU); ctx.fill();
          break;
        }
        case 'dust': case 'spore': {
          p.x += (p.vx + Math.sin(this.time * 0.5 + p.rot) * 0.08) * dt; p.y += p.vy * dt;
          ctx.fillStyle = g(0.92, a * 0.7);
          ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), Math.max(0.8, p.r * (p.kind === 'spore' ? 0.035 : 0.02) * k), 0, TAU); ctx.fill();
          break;
        }
        case 'puff': {
          p.vx *= 0.9; p.vy = p.vy * 0.9 - 0.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.fillStyle = g(0.85, a * 0.5);
          ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), (0.05 + p.t * 0.25) * k * p.r, 0, TAU); ctx.fill();
          break;
        }
        case 'smoke': {
          p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 0.25;
          ctx.fillStyle = g(0.6, a * 0.25);
          ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), p.r * k, 0, TAU); ctx.fill();
          break;
        }
        case 'fiber': {
          p.vy -= 3 * dt; p.vx *= 0.98; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 3;
          const X = this.sx(p.x), Y = this.sy(p.y), l = 0.18 * k * p.r;
          ectx.strokeStyle = `rgba(255,45,35,${a * 0.9})`; ectx.lineWidth = 2;
          ectx.beginPath(); ectx.moveTo(X, Y); ectx.quadraticCurveTo(X + Math.cos(p.rot) * l, Y + Math.sin(p.rot * 1.3) * l, X + Math.cos(p.rot + 1) * l * 1.4, Y + Math.sin(p.rot + 1) * l); ectx.stroke();
          break;
        }
        case 'spark': {
          p.vx *= 0.94; p.vy *= 0.94; p.x += p.vx * dt; p.y += p.vy * dt;
          ectx.fillStyle = `rgba(255,${(90 + 100 * (1 - p.t / p.life)) | 0},70,${a})`;
          ectx.beginPath(); ectx.arc(this.sx(p.x), this.sy(p.y), Math.max(1.2, 0.03 * k * p.r), 0, TAU); ectx.fill();
          break;
        }
        case 'splash': {
          p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.fillStyle = g(0.0, a);
          ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), Math.max(1, 0.04 * k * p.r), 0, TAU); ctx.fill();
          break;
        }
        case 'ring': {
          const X = this.sx(p.x), Y = this.sy(p.y), rr = (0.2 + p.t * 5) * k;
          ectx.strokeStyle = `rgba(255,70,50,${(1 - p.t / p.life) * 0.5})`; ectx.lineWidth = 2.5;
          ectx.beginPath(); ectx.arc(X, Y, rr, 0, TAU); ectx.stroke();
          break;
        }
        case 'pale': {
          const X = this.sx(p.x), Y = this.sy(p.y), rr = (0.3 + p.t * 3) * k;
          ectx.strokeStyle = `rgba(230,235,245,${(1 - p.t / p.life) * 0.45})`; ectx.lineWidth = 2;
          ectx.beginPath(); ectx.arc(X, Y, rr, 0, TAU); ectx.stroke();
          break;
        }
      }
    }
    // stroke the batched snow: one path per kind and brightness band, plus a cold glint on the emissive layer
    const LW = [0.07, 0.022, 0.034];
    snowB.forEach((seg, idx) => {
      if (!seg) return;
      const kind = (idx / 4) | 0, f = ((idx % 4) + 0.5) / 4;
      ctx.beginPath(); ectx.beginPath();
      for (let i = 0; i < seg.length; i += 4) { ctx.moveTo(seg[i], seg[i + 1]); ctx.lineTo(seg[i + 2], seg[i + 3]); if (kind !== 1) { ectx.moveTo(seg[i], seg[i + 1]); ectx.lineTo(seg[i + 2], seg[i + 3]); } }
      const w = Math.max(1, LW[kind] * k * (kind === 0 ? 1.4 : kind === 1 ? 0.62 : 1));
      ctx.strokeStyle = g(0.97, f); ctx.lineWidth = w; ctx.stroke();
      if (kind !== 1) { ectx.strokeStyle = `rgba(205,215,235,${f * (kind === 0 ? 0.2 : 0.4)})`; ectx.lineWidth = w; ectx.stroke(); }
    });
    this.fx = keep.length > 2400 ? keep.slice(-2400) : keep;
  }

  // ── foreground silhouettes (in front of the play plane, drifting faster) ─
  drawForeground(ctx) {
    ctx.fillStyle = g(0.0); ctx.strokeStyle = g(0.0);
    for (const f of this.fg) {
      const PAR = f.type === 'grass' ? 1 : 1.35;      // grass stands on the floor and stays there
      const X = this.sx(f.x, PAR) + this.cam[0] * 0, Y = this.sy(f.y, PAR);
      if (X < -400 || X > this.W + 400 || Y < -600 || Y > this.H + 600) continue;
      const k = this.k * PAR;
      // the others drift in front of the rock; one that has drifted so far that its top hangs in the air, or that lies over solid
      // rock, is not shown
      if (PAR > 1) {
        const wx = this.cam[0] + (f.x - this.cam[0]) * PAR, wy = this.cam[1] + (f.y - this.cam[1]) * PAR, T = this.w.T, dt = T.d(wx, wy);
        const a = clamp((0.7 - dt) / 0.5, 0, 1) * clamp((T.d(wx, wy - f.len * PAR * 0.45) + 0.1) / 0.5, 0, 1) * clamp((dt + 2.2) / 0.8, 0, 1);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
      } else ctx.globalAlpha = 1;
      if (f.type === 'root') {
        ctx.lineWidth = f.w * k;
        ctx.beginPath(); ctx.moveTo(X, Y);
        let x = X, y = Y;
        for (let i = 1; i <= 8; i++) {
          const nx = X + Math.sin(i * 0.9 + f.seed + this.time * 0.15) * f.len * 0.08 * k, ny = Y + i * f.len / 8 * k;
          ctx.quadraticCurveTo(x, (y + ny) / 2, nx, ny); x = nx; y = ny;
          ctx.lineWidth = f.w * k * (1 - i / 10);
        }
        ctx.stroke();
      } else if (f.type === 'stal') {
        ctx.beginPath(); ctx.moveTo(X - f.w * k, Y); ctx.quadraticCurveTo(X - f.w * 0.2 * k, Y + f.len * 0.6 * k, X, Y + f.len * k); ctx.quadraticCurveTo(X + f.w * 0.2 * k, Y + f.len * 0.6 * k, X + f.w * k, Y); ctx.fill();
      } else if (f.type === 'chain') {
        ctx.lineWidth = Math.max(2, 0.06 * k);
        for (let y = 0; y < f.len; y += 0.32) { ctx.beginPath(); ctx.ellipse(X + Math.sin(this.time * 0.4 + f.seed) * y * 0.02 * k, Y + y * k, 0.07 * k, 0.15 * k, 0, 0, TAU); ctx.stroke(); }
      } else if (f.type === 'strand') {
        ctx.lineWidth = Math.max(1.5, f.w * k);
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + f.dx * 0.5 * k, Y + f.len * 0.5 * k + f.sag * k, X + f.dx * k, Y + f.len * k); ctx.stroke();
      } else if (f.type === 'grass') {
        ctx.lineWidth = Math.max(1.2, 0.03 * k);
        for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.12 + Math.sin(this.time * 1.2 + f.seed + i) * 0.05; ctx.beginPath(); ctx.moveTo(X + i * 0.05 * k, Y); ctx.quadraticCurveTo(X + i * 0.05 * k + a * 0.3 * k, Y - f.len * 0.5 * k, X + i * 0.05 * k + a * f.len * k, Y - f.len * k); ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
  }
}

// how far a web strung across a shaft reaches: just into the rock on that side
function wallFrom(T, x, y, dir) {
  for (let k = 0; k < 100 && T.d(x, y) > -0.1; k++) x += dir * 0.08;
  return x;
}

function heart(c, x, y, s) {
  c.beginPath();
  c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.7, y - s * 1.3, x, y - s * 0.4);
  c.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9);
  c.fill();
}

function makeTrees() {
  const rng = mulberry(31);
  const trees = [];
  for (const [x, h] of [[4, 7.5], [29, 6], [33.5, 4.2], [88, 8], [101, 6.2], [112, 7]]) {
    const y = L.surfaceY(x) - 0.3;
    const branches = [];
    const grow = (x0, y0, ang, len, w, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      const bend = (rng() - 0.5) * len * 0.4;
      branches.push({ x0, y0, x1, y1, cx: (x0 + x1) / 2 + Math.cos(ang + 1.57) * bend, cy: (y0 + y1) / 2 + Math.sin(ang + 1.57) * bend, w });
      if (depth <= 0 || w < 0.025) return;
      const n = depth > 3 ? 2 : 2 + (rng() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) grow(x1, y1, ang + (rng() - 0.5) * 1.3 + (i - (n - 1) / 2) * 0.5, len * (0.62 + rng() * 0.2), w * 0.62, depth - 1);
    };
    grow(x, y, Math.PI / 2 + (rng() - 0.5) * 0.25, h * 0.38, h * 0.045, 6);
    trees.push({ x, y, branches });
  }
  return trees;
}

function makeForeground(world) {
  const rng = mulberry(99);
  const out = [];
  const T = world.T;
  // roots and strands hang from ceilings; stalactites in the Mere; chains in the Gallery
  for (let i = 0; i < 260; i++) {
    const x = rng() * 120, y = -4 - rng() * 255;
    if (T.d(x, y) < 1.5) continue;
    let top = y;
    for (let k = 0; k < 120; k++) { top += 0.25; if (T.d(x, top) < 0) break; }
    if (top - y > 28) continue;
    const zone = y > -46 ? 'throat' : y > -103 ? 'gardens' : y > -150 ? 'gallery' : y > -208 ? 'mere' : 'loom';
    const type = zone === 'mere' ? 'stal' : zone === 'gallery' ? (rng() < 0.5 ? 'chain' : 'root') : zone === 'loom' ? 'strand' : 'root';
    // foreground is offset in parallax space, so place relative to its own drift: approximate by world pos
    out.push({ type, x, y: top, len: 2 + rng() * (type === 'stal' ? 4 : 9), w: type === 'stal' ? 0.3 + rng() * 0.5 : 0.05 + rng() * 0.12, seed: rng() * 10, dx: (rng() - 0.5) * 12, sag: rng() * 2 });
  }
  // grass tufts along the floors
  for (let i = 0; i < 90; i++) {
    const x = rng() * 120, y = 4 - rng() * 262;
    const gy = T.ground(x, y, 6);
    if (gy === null || T.d(x, gy + 1.0) < 0.8) continue;
    if (rng() < 0.6) out.push({ type: 'grass', x, y: gy - 0.08, len: 0.25 + rng() * 0.45, seed: rng() * 10 });
  }
  return out;
}

// ── the woodpile: logs dropped one by one until each rests on the ground or on two others, so the
// pile is a heap of touching rounds and splits instead of a grid
function makeWoodpile(gx, gy, base) {
  const rng = mulberry(913);
  const x0 = gx - 2.38, x1 = gx - 0.06, floor = (x) => Math.max(gy, L.surfaceY(x)) - 0.03;
  const roof = (x) => gy + 1.62 + (x - (gx - 2.5)) / 2.5 * (base + 2.4 - gy - 1.7) - 0.12;
  const logs = [];
  const restY = (x, r) => {
    let y = floor(x) + r, by = null;
    for (const o of logs) {
      const dx = x - o.x, rr = r + o.r;
      if (Math.abs(dx) < rr) { const yy = o.y + Math.sqrt(rr * rr - dx * dx); if (yy > y) { y = yy; by = o; } }
    }
    return [y, by];
  };
  for (let i = 0; i < 70 && logs.length < 34; i++) {
    const r = 0.1 + rng() * 0.1;
    let x = x0 + r + rng() * (x1 - x0 - 2 * r);
    let [y, on] = restY(x, r);
    // roll off a single support until it is cradled by two, or reaches the ground or a wall
    for (let it = 0; it < 60 && on; it++) {
      const side = x === on.x ? (rng() < 0.5 ? -1 : 1) : Math.sign(x - on.x);
      const nx = x + side * 0.02;
      if (nx - r < x0 || nx + r > x1) break;
      const [ny, non] = restY(nx, r);
      if (ny > y - 0.001 && non !== on) break;   // now resting in a saddle
      x = nx; y = ny; on = non;
    }
    if (y + r > roof(x)) continue;
    const kind = rng() < 0.3 ? 'split' : 'round';
    logs.push({ x, y, r, kind, rot: rng() * TAU, tone: 0.5 + rng() * 0.2, cx: (rng() - 0.5) * 0.3, cy: (rng() - 0.5) * 0.3, crack: rng() * TAU, sq: 0.9 + rng() * 0.18, span: Math.PI * (rng() < 0.5 ? 0.5 + rng() * 0.2 : 0.95 + rng() * 0.1) });
  }
  // which logs have nothing above them (they catch the snow)
  for (const a of logs) a.top = !logs.some((b) => b !== a && b.y > a.y && Math.abs(b.x - a.x) < (a.r + b.r) * 0.8);
  logs.sort((a, b) => b.y - a.y);
  return logs;
}
function drawLogEnd(ctx, X, Y, lg, k) {
  const r = lg.r * k;
  ctx.save(); ctx.translate(X, Y); ctx.rotate(lg.rot);
  ctx.beginPath();
  if (lg.kind === 'split') { ctx.moveTo(0, 0); ctx.ellipse(0, 0, r * 1.05, r * lg.sq * 1.05, 0, 0, lg.span); ctx.closePath(); }
  else ctx.ellipse(0, 0, r * 1.03, r * lg.sq * 1.03, 0, 0, TAU);
  ctx.fillStyle = g(0.14); ctx.fill();                                  // bark
  ctx.beginPath();
  if (lg.kind === 'split') { ctx.moveTo(0, 0); ctx.ellipse(0, 0, r * 0.84, r * lg.sq * 0.84, 0, 0.08, lg.span - 0.08); ctx.closePath(); }
  else ctx.ellipse(0, 0, r * 0.84, r * lg.sq * 0.84, 0, 0, TAU);
  ctx.fillStyle = g(lg.tone); ctx.fill();                               // end grain
  ctx.strokeStyle = g(lg.tone - 0.2); ctx.lineWidth = Math.max(0.6, k * 0.008);
  const ox = lg.cx * r, oy = lg.cy * r;
  for (const f of [0.22, 0.42, 0.62]) {
    ctx.beginPath();
    if (lg.kind === 'split') ctx.ellipse(lg.kind === 'split' ? 0 : ox, lg.kind === 'split' ? 0 : oy, r * f, r * f * lg.sq, 0, 0.2, lg.span - 0.2);
    else ctx.ellipse(ox, oy, r * f, r * f * lg.sq, 0, 0, TAU);
    ctx.stroke();
  }
  if (lg.kind === 'round') { ctx.strokeStyle = g(0.06); ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(Math.cos(lg.crack) * r * 0.84, Math.sin(lg.crack) * r * 0.84 * lg.sq); ctx.stroke(); }
  ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1, k * 0.018);
  ctx.beginPath();
  if (lg.kind === 'split') { ctx.moveTo(0, 0); ctx.ellipse(0, 0, r * 1.05, r * lg.sq * 1.05, 0, 0, lg.span); ctx.closePath(); }
  else ctx.ellipse(0, 0, r * 1.03, r * lg.sq * 1.03, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function makeFog() {
  const rng = mulberry(57), out = [];
  for (let i = 0; i < 9; i++) {
    const front = i === 8;
    out.push({ x: rng() * 80, y: (front ? 0.5 : -1 + rng() * 9), rx: front ? 9 : 7 + rng() * 9, ry: front ? 1.6 : 1.4 + rng() * 2.6,
      a: front ? 0.2 : 0.16 + rng() * 0.18, par: front ? 1.4 : 0.55 + rng() * 0.4, speed: 0.55 + rng() * 0.35, front });
  }
  return out;
}
