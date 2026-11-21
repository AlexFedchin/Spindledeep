// Sprite layer. Everything here is drawn in grey *tone* on a transparent canvas; the engraving shader
// lights it and turns it into line work. Glows go on a second, additive, half-resolution canvas.
import { clamp, mulberry, lerp, TAU } from './util.js';
import * as L from './level.js';

const g = (v, a = 1) => `rgba(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0},${a})`;

export class Drawer {
  constructor(world) {
    this.w = world;
    this.fx = [];
    this.rng = mulberry(7);
    this.trees = makeTrees();
    this.fg = makeForeground(world);
    this.hookChains = world.hooks.map((h) => {
      let top = h.y;
      for (let k = 0; k < 160; k++) { top += 0.1; if (world.T.d(h.x, top) < 0) break; }
      return top;
    });
    this.tuft = { a: 0, v: 0 };
  }

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
    this.time = time;
    this.ambientFx(dt);
    this.drawTrees(ctx);
    this.drawCottage(ctx, ectx);
    this.drawThorns(ctx);
    this.drawGates(ctx, ectx);
    this.drawHooks(ctx, ectx);
    this.drawPegs(ctx, ectx);
    this.drawBells(ctx, ectx);
    this.drawSkeins(ctx, ectx);
    this.drawMemories(ctx, ectx);
    this.drawFinale(ctx, ectx);
    this.drawDrips(ctx);
    this.drawFx(ctx, ectx, dt, false);
    for (const m of w.moths) if (this.vis(m.x, m.y)) this.drawMoth(ctx, ectx, m);
    this.drawDoll(ctx, ectx, dt);
    this.drawFx(ctx, ectx, dt, true);
    this.drawForeground(ctx);
  }

  // ── the doll ──────────────────────────────────────────────────────────
  drawDoll(ctx, ectx, dt) {
    const p = this.w.player, th = this.w.thread;
    if (p.dead && p.deadT > 0.9) return;
    const k = this.k;
    const s = p.scale * (p.dead ? Math.max(0, 1 - p.deadT / 0.9) : 1);
    const X = this.sx(p.x), Y = this.sy(p.y);
    const f = p.facing;
    const swing = th.locked && !p.grounded;
    const moving = p.grounded && Math.abs(p.vx) > 0.4;
    const bob = moving ? Math.abs(Math.sin(p.walk)) * 0.05 : Math.sin(this.time * 2.2) * 0.012;
    const sq = p.squash;
    const sxk = (1 + sq * 0.6) * s, syk = (1 - sq) * s;
    // tuft spring
    this.tuft.v += (-p.vx * 0.08 - this.tuft.a * 30) * dt - this.tuft.v * 6 * dt;
    this.tuft.a += this.tuft.v * dt * 10;

    ctx.save();
    ctx.translate(X, Y + (0.3 - bob) * k * 0);
    let tilt = 0;
    if (swing) { const P = th.pivots[th.pivots.length - 1]; tilt = Math.atan2(p.bx - P.x, -(p.by - P.y)) * 0.6; }
    else if (!p.grounded) tilt = clamp(p.vx * 0.03, -0.25, 0.25);
    else tilt = clamp(p.vx * 0.02, -0.1, 0.1);
    ctx.rotate(tilt);
    ctx.scale(sxk * f, syk);
    const u = k; // 1 m in px
    const lw = Math.max(1.4, u * 0.022);
    ctx.lineWidth = lw;
    ctx.strokeStyle = g(0.04);
    // legs
    const legPh = p.walk;
    const legA = moving ? Math.sin(legPh) * 0.12 : !p.grounded ? 0.07 : 0;
    for (const side of [-1, 1]) {
      const lx = side * 0.08 * u, ly = 0.04 * u;
      const fx = lx + (side * legA + (p.grounded ? 0 : 0.03)) * u, fy = (0.27 - (moving ? Math.max(0, Math.sin(legPh * side)) * 0.06 : 0)) * u;
      ctx.lineWidth = 0.075 * u; ctx.strokeStyle = g(0.04);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.lineWidth = 0.05 * u; ctx.strokeStyle = g(0.72);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(fx, fy); ctx.stroke();
    }
    // body: a knitted sack
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-0.2 * u, 0.06 * u);
    ctx.bezierCurveTo(-0.24 * u, -0.12 * u, -0.17 * u, -0.27 * u, 0, -0.28 * u);
    ctx.bezierCurveTo(0.17 * u, -0.27 * u, 0.24 * u, -0.12 * u, 0.2 * u, 0.06 * u);
    ctx.bezierCurveTo(0.17 * u, 0.15 * u, -0.17 * u, 0.15 * u, -0.2 * u, 0.06 * u);
    ctx.closePath();
    ctx.fillStyle = g(0.8); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.stroke();
    // knit stitches: rows of little V's
    ctx.save(); ctx.clip();
    ctx.lineWidth = Math.max(0.8, u * 0.01); ctx.strokeStyle = g(0.38);
    for (let r = -0.26; r < 0.14; r += 0.055) {
      for (let c = -0.22; c < 0.22; c += 0.05) {
        const ox = (c + (Math.round(r / 0.055) % 2) * 0.025) * u, oy = r * u;
        ctx.beginPath(); ctx.moveTo(ox - 0.018 * u, oy); ctx.lineTo(ox, oy + 0.03 * u); ctx.lineTo(ox + 0.018 * u, oy); ctx.stroke();
      }
    }
    ctx.restore();
    // arms
    const armUp = swing || (th.locked && p.grounded);
    for (const side of [-1, 1]) {
      const ax0 = side * 0.17 * u, ay0 = -0.14 * u;
      let ex, ey;
      if (armUp) { ex = side * 0.1 * u + 0.05 * u; ey = -0.42 * u; }
      else if (p.tieT > 0) { ex = 0.22 * u; ey = (-0.08 + Math.sin(this.time * 30 + side) * 0.03) * u; }
      else if (moving) { ex = ax0 + side * 0.06 * u + Math.sin(legPh + (side > 0 ? Math.PI : 0)) * 0.08 * u; ey = -0.02 * u; }
      else if (!p.grounded) { ex = side * 0.3 * u; ey = (p.vy > 0 ? -0.26 : -0.1) * u; }
      else { ex = side * 0.24 * u; ey = (-0.03 + Math.sin(this.time * 2.2 + side) * 0.008) * u; }
      ctx.lineWidth = 0.075 * u; ctx.strokeStyle = g(0.04);
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.quadraticCurveTo((ax0 + ex) / 2 + side * 0.03 * u, (ay0 + ey) / 2, ex, ey); ctx.stroke();
      ctx.lineWidth = 0.048 * u; ctx.strokeStyle = g(0.75);
      ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.quadraticCurveTo((ax0 + ex) / 2 + side * 0.03 * u, (ay0 + ey) / 2, ex, ey); ctx.stroke();
    }
    // head
    const hy = -0.47 * u, hr = 0.22 * u;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.ellipse(0.01 * u, hy, hr * 1.04, hr, 0, 0, TAU);
    ctx.fillStyle = g(0.86); ctx.fill(); ctx.strokeStyle = g(0.03); ctx.stroke();
    // seam with cross stitches
    ctx.lineWidth = Math.max(0.8, u * 0.011); ctx.strokeStyle = g(0.25);
    ctx.beginPath(); ctx.arc(-0.06 * u, hy - 0.02 * u, hr * 0.95, -1.2, 0.2); ctx.stroke();
    for (let a = -1.1; a < 0.2; a += 0.22) {
      const cx = -0.06 * u + Math.cos(a) * hr * 0.95, cy = hy - 0.02 * u + Math.sin(a) * hr * 0.95;
      ctx.beginPath(); ctx.moveTo(cx - 0.015 * u, cy - 0.015 * u); ctx.lineTo(cx + 0.015 * u, cy + 0.015 * u); ctx.stroke();
    }
    // button eye
    const blink = (Math.sin(this.time * 0.9) > 0.985) ? 0.25 : 1;
    ctx.fillStyle = g(0.02);
    ctx.beginPath(); ctx.ellipse(0.1 * u, hy + 0.01 * u, 0.055 * u, 0.055 * u * blink, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = g(0.7);
    if (blink > 0.5) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc((0.1 + a * 0.016) * u, hy + (0.01 + b * 0.016) * u, 0.008 * u, 0, TAU); ctx.fill(); }
    // stitched X eye
    ctx.strokeStyle = g(0.02); ctx.lineWidth = Math.max(1.2, 0.022 * u);
    const ex2 = -0.04 * u, ey2 = hy + 0.01 * u, e = 0.035 * u;
    ctx.beginPath(); ctx.moveTo(ex2 - e, ey2 - e); ctx.lineTo(ex2 + e, ey2 + e); ctx.moveTo(ex2 + e, ey2 - e); ctx.lineTo(ex2 - e, ey2 + e); ctx.stroke();
    // a loose curl of yarn on top
    ctx.strokeStyle = g(0.04); ctx.lineWidth = 0.05 * u;
    const ta = this.tuft.a + Math.sin(this.time * 1.7) * 0.05;
    ctx.beginPath(); ctx.moveTo(0, hy - hr * 0.95);
    ctx.bezierCurveTo((0.04 + ta * 0.4) * u, hy - hr - 0.12 * u, (-0.1 + ta) * u, hy - hr - 0.16 * u, (-0.06 + ta * 1.3) * u, hy - hr - 0.06 * u);
    ctx.stroke();
    ctx.strokeStyle = g(0.8); ctx.lineWidth = 0.028 * u; ctx.stroke();
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
    if (!this.vis(14, 3, 10)) return;
    const k = this.k;
    const gx = 11, gy = L.surfaceY(14) - 0.2;
    const X = (x) => this.sx(x), Y = (y) => this.sy(y);
    ctx.lineWidth = Math.max(1.2, k * 0.03);
    // walls
    ctx.fillStyle = g(0.32); ctx.strokeStyle = g(0.03);
    ctx.beginPath(); ctx.moveTo(X(gx), Y(gy)); ctx.lineTo(X(gx), Y(gy + 3.6)); ctx.lineTo(X(gx + 7.6), Y(gy + 3.6)); ctx.lineTo(X(gx + 7.6), Y(gy)); ctx.closePath(); ctx.fill(); ctx.stroke();
    // planks
    ctx.strokeStyle = g(0.14); ctx.lineWidth = Math.max(1, k * 0.018);
    for (let y = 0.35; y < 3.6; y += 0.36) { ctx.beginPath(); ctx.moveTo(X(gx), Y(gy + y)); ctx.lineTo(X(gx + 7.6), Y(gy + y + 0.03 * Math.sin(y * 9))); ctx.stroke(); }
    // roof with snow
    ctx.fillStyle = g(0.2); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1.2, k * 0.03);
    ctx.beginPath(); ctx.moveTo(X(gx - 0.9), Y(gy + 3.4)); ctx.lineTo(X(gx + 3.8), Y(gy + 6.6)); ctx.lineTo(X(gx + 8.5), Y(gy + 3.4)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = g(0.96);
    ctx.beginPath(); ctx.moveTo(X(gx - 1.0), Y(gy + 3.45)); ctx.lineTo(X(gx + 3.8), Y(gy + 6.75));
    ctx.lineTo(X(gx + 8.6), Y(gy + 3.45)); ctx.lineTo(X(gx + 7.9), Y(gy + 3.75));
    for (let x = 7.4; x > 0; x -= 0.6) ctx.lineTo(X(gx + x), Y(gy + 3.75 + (3.8 - Math.abs(x - 3.8)) * 0.62 - 0.35 - 0.12 * Math.sin(x * 5)));
    ctx.lineTo(X(gx - 0.3), Y(gy + 3.75)); ctx.closePath(); ctx.fill();
    // chimney
    ctx.fillStyle = g(0.25);
    ctx.fillRect(X(gx + 5.4), Y(gy + 6.4), 0.7 * k, 1.6 * k);
    ctx.fillStyle = g(0.95); ctx.fillRect(X(gx + 5.3), Y(gy + 6.5), 0.9 * k, 0.18 * k);
    if (Math.random() < 0.06) this.spawn('smoke', gx + 5.75, gy + 6.6, 1, { speed: 0.2, vy: 0.6, vx: 0.25, life: 4.5, r: 0.5 });
    // window: warm light
    const wx = gx + 1.4, wy = gy + 1.3;
    ctx.fillStyle = g(0.97); ctx.fillRect(X(wx), Y(wy + 1.3), 1.4 * k, 1.3 * k);
    ctx.strokeStyle = g(0.05); ctx.lineWidth = Math.max(1.4, k * 0.06);
    ctx.strokeRect(X(wx), Y(wy + 1.3), 1.4 * k, 1.3 * k);
    ctx.beginPath(); ctx.moveTo(X(wx + 0.7), Y(wy + 1.3)); ctx.lineTo(X(wx + 0.7), Y(wy)); ctx.moveTo(X(wx), Y(wy + 0.65)); ctx.lineTo(X(wx + 1.4), Y(wy + 0.65)); ctx.stroke();
    const fl = 0.85 + Math.sin(this.time * 11) * 0.05 + Math.sin(this.time * 6.3) * 0.06;
    const grd = ectx.createRadialGradient(X(wx + 0.7), Y(wy + 0.65), 0, X(wx + 0.7), Y(wy + 0.65), 2.2 * k);
    grd.addColorStop(0, `rgba(255,170,80,${0.55 * fl})`); grd.addColorStop(0.3, `rgba(255,130,50,${0.18 * fl})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    ectx.fillStyle = grd; ectx.fillRect(X(wx + 0.7) - 2.2 * k, Y(wy + 0.65) - 2.2 * k, 4.4 * k, 4.4 * k);
    ectx.fillStyle = `rgba(255,190,110,${0.6 * fl})`; ectx.fillRect(X(wx) + 2, Y(wy + 1.3) + 2, 1.4 * k - 4, 1.3 * k - 4);
    // door, with the thread tied to its knob
    ctx.fillStyle = g(0.18); ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1.2, k * 0.03);
    ctx.fillRect(X(gx + 5.6), Y(gy + 2.5), 1.3 * k, 2.5 * k); ctx.strokeRect(X(gx + 5.6), Y(gy + 2.5), 1.3 * k, 2.5 * k);
    ctx.fillStyle = g(0.8); ctx.beginPath(); ctx.arc(X(gx + 6.65), Y(gy + 1.2), 0.07 * k, 0, TAU); ctx.fill();
    // snow drift along the base
    ctx.fillStyle = g(0.95);
    ctx.beginPath(); ctx.moveTo(X(gx - 1.2), Y(gy - 0.1));
    for (let x = -1.2; x <= 9; x += 0.5) ctx.lineTo(X(gx + x), Y(gy + 0.3 + 0.18 * Math.sin(x * 2.1)));
    ctx.lineTo(X(gx + 9), Y(gy - 0.3)); ctx.closePath(); ctx.fill();
  }

  drawTrees(ctx) {
    for (const t of this.trees) {
      if (!this.vis(t.x, t.y + 4, 8)) continue;
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
      const sway = Math.sin(this.time * 0.8 + i) * 0.04 + h.ring * Math.sin(this.time * 18) * 0.08;
      const X = this.sx(h.x + sway), Y = this.sy(h.y);
      ctx.strokeStyle = g(0.08); ctx.lineWidth = Math.max(1, k * 0.03);
      // chain links
      for (let y = h.y + 0.3; y < top; y += 0.22) {
        const xx = this.sx(h.x + sway * (top - y) / (top - h.y));
        ctx.beginPath(); ctx.ellipse(xx, this.sy(y), 0.04 * k, 0.09 * k, 0, 0, TAU); ctx.stroke();
      }
      ctx.lineWidth = Math.max(1.6, k * 0.06); ctx.strokeStyle = g(0.04);
      ctx.beginPath(); ctx.arc(X, Y, 0.22 * k, 0, TAU); ctx.stroke();
      ctx.lineWidth = Math.max(0.8, k * 0.02); ctx.strokeStyle = g(0.75);
      ctx.beginPath(); ctx.arc(X, Y, 0.22 * k, -2.4, -1.2); ctx.stroke();
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
        ectx.fillStyle = `rgba(210,220,230,${0.08 + 0.06 * Math.sin(this.time * 1.5 + b.x)})`;
        ectx.beginPath(); ectx.arc(tipx, tipy + 0.3 * k, 0.25 * k, 0, TAU); ectx.fill();
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
          ctx.beginPath(); ctx.moveTo(this.sx(gt.x0 - 0.3), this.sy(y));
          ctx.quadraticCurveTo(this.sx((gt.x0 + gt.x1) / 2), this.sy(y - 0.5 - Math.sin(this.time + i) * 0.1 - o * 2), this.sx(gt.x1 + 0.3), this.sy(y + Math.cos(i) * 0.2));
          ctx.stroke();
        }
        for (let x = gt.x0; x < gt.x1; x += 0.6) { ctx.beginPath(); ctx.moveTo(this.sx(x), this.sy(gt.y1)); ctx.lineTo(this.sx(x + 0.3), this.sy(gt.y0 - o * 2)); ctx.stroke(); }
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
  drawThorns(ctx) {
    const k = this.k;
    for (const chain of this.w.thorns) {
      if (!chain.length || !this.vis(chain[0][0], chain[0][1], 40) && !this.vis(chain[chain.length - 1][0], chain[0][1], 40)) continue;
      for (let v = 0; v < 3; v++) {
        ctx.strokeStyle = g(0.03); ctx.lineWidth = Math.max(1.2, 0.06 * k);
        ctx.beginPath();
        chain.forEach(([x, y], i) => {
          const yy = y + Math.sin(x * (1.3 + v * 0.7) + v * 2) * 0.28 + 0.1;
          if (i === 0) ctx.moveTo(this.sx(x), this.sy(yy)); else ctx.lineTo(this.sx(x), this.sy(yy));
        });
        ctx.stroke();
      }
      ctx.fillStyle = g(0.03);
      chain.forEach(([x, y], i) => {
        if (!this.vis(x, y)) return;
        for (let j = 0; j < 3; j++) {
          const yy = y + Math.sin(x * (1.3 + j * 0.7) + j * 2) * 0.28 + 0.1;
          const a = (i * 2.3 + j) % TAU, X = this.sx(x), Y = this.sy(yy);
          ctx.beginPath(); ctx.moveTo(X - Math.sin(a) * 0.04 * k, Y - Math.cos(a) * 0.04 * k);
          ctx.lineTo(X + Math.cos(a) * 0.2 * k, Y - Math.sin(a) * 0.2 * k); ctx.lineTo(X + Math.sin(a) * 0.04 * k, Y + Math.cos(a) * 0.04 * k); ctx.fill();
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
  drawFinale(ctx, ectx) {
    const f = this.w.finale, k = this.k;
    if (!this.vis(f.x, f.y, 8)) return;
    // her rocking chair, her shawl, the needles, the end of her grey thread
    const X = this.sx(f.x + 1.6), Y = this.sy(f.y - 0.1);
    const rock = Math.sin(this.time * 0.7) * 0.03;
    ctx.save(); ctx.translate(X, Y); ctx.rotate(rock);
    ctx.strokeStyle = g(0.05); ctx.lineWidth = Math.max(1.5, 0.07 * k);
    ctx.beginPath(); ctx.arc(0, -2.2 * k, 2.25 * k, Math.PI * 0.38, Math.PI * 0.62); ctx.stroke(); // rocker
    ctx.beginPath();
    ctx.moveTo(-0.65 * k, -0.08 * k); ctx.lineTo(-0.55 * k, -0.85 * k); ctx.lineTo(0.6 * k, -0.85 * k); ctx.lineTo(0.65 * k, -0.08 * k);
    ctx.moveTo(0.55 * k, -0.85 * k); ctx.lineTo(0.8 * k, -2.3 * k);
    ctx.moveTo(-0.55 * k, -0.85 * k); ctx.lineTo(-0.35 * k, -1.0 * k);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, 0.04 * k);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0.58 * k + i * 0.04 * k, -0.9 * k - i * 0.28 * k); ctx.lineTo(0.2 * k + i * 0.06 * k, -1.05 * k - i * 0.25 * k); ctx.stroke(); }
    // shawl draped over the seat
    ctx.fillStyle = g(0.62);
    ctx.beginPath(); ctx.moveTo(-0.5 * k, -0.85 * k); ctx.quadraticCurveTo(0.1 * k, -1.0 * k, 0.62 * k, -1.4 * k);
    ctx.lineTo(0.7 * k, -0.7 * k); ctx.quadraticCurveTo(0.2 * k, -0.4 * k, -0.45 * k, -0.35 * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = g(0.3); ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-0.45 * k + i * 0.2 * k, -0.4 * k + i * 0.02 * k); ctx.lineTo(-0.4 * k + i * 0.2 * k, -0.25 * k + Math.sin(i) * 0.04 * k); ctx.stroke(); }
    ctx.restore();
    // the spool on the floor where her thread ends
    const SX = this.sx(f.x), SY = this.sy(f.y);
    ctx.fillStyle = g(0.45); ctx.strokeStyle = g(0.04); ctx.lineWidth = Math.max(1, 0.025 * k);
    ctx.fillRect(SX - 0.16 * k, SY - 0.32 * k, 0.32 * k, 0.32 * k); ctx.strokeRect(SX - 0.16 * k, SY - 0.32 * k, 0.32 * k, 0.32 * k);
    ctx.fillStyle = g(0.7); ctx.fillRect(SX - 0.11 * k, SY - 0.28 * k, 0.22 * k, 0.24 * k);
    // her candle on the floor beside the chair
    const CX = this.sx(33), CY = this.sy(f.y + 0.05);
    ctx.fillStyle = g(0.9); ctx.fillRect(CX - 0.06 * k, CY - 0.45 * k, 0.12 * k, 0.45 * k);
    const fl = 1 + Math.sin(this.time * 15) * 0.1;
    const gr = ectx.createRadialGradient(CX, CY - 0.55 * k, 0, CX, CY - 0.55 * k, 1.5 * k);
    gr.addColorStop(0, `rgba(255,200,120,${0.85 * fl})`); gr.addColorStop(0.15, `rgba(255,140,60,${0.3 * fl})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ectx.fillStyle = gr; ectx.fillRect(CX - 1.5 * k, CY - 2.05 * k, 3 * k, 3 * k);
    ectx.fillStyle = `rgba(255,220,150,${fl})`; ectx.beginPath(); ectx.ellipse(CX, CY - 0.55 * k, 0.04 * k, 0.1 * k * fl, 0, 0, TAU); ectx.fill();
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
    const c = this.cam, area = this.w.area();
    const R = (a, b) => a + Math.random() * (b - a);
    const vw = this.viewW, vh = this.viewH;
    if (area.id === 'brink' || (area.id === 'throat' && c[1] > -30)) {
      for (let i = 0; i < 3; i++) if (Math.random() < dt * 40) this.fx.push({ kind: 'snow', x: c[0] + R(-vw / 2 - 4, vw / 2 + 4), y: c[1] + vh / 2 + 1, vx: R(-0.3, 0.6), vy: R(-1.4, -0.7), life: 14, t: 0, r: R(0.5, 1.4), rot: R(0, 6), par: R(0.85, 1.25) });
    } else {
      if (Math.random() < dt * 9) this.fx.push({ kind: 'dust', x: c[0] + R(-vw / 2, vw / 2), y: c[1] + R(-vh / 2, vh / 2), vx: R(-0.1, 0.1), vy: R(-0.05, 0.08), life: R(5, 9), t: 0, r: R(0.6, 1.4), rot: R(0, 6), par: R(0.9, 1.15) });
      if (area.id === 'gardens' && Math.random() < dt * 5) this.fx.push({ kind: 'spore', x: c[0] + R(-vw / 2, vw / 2), y: c[1] - vh / 2, vx: R(-0.2, 0.2), vy: R(0.2, 0.5), life: 14, t: 0, r: R(0.6, 1.2), rot: 0, par: 1 });
    }
  }
  drawFx(ctx, ectx, dt, front) {
    const k = this.k;
    const keep = [];
    for (const p of this.fx) {
      p.t += dt;
      if (p.t > p.life) continue;
      keep.push(p);
      const isFront = p.kind === 'fiber' || p.kind === 'spark' || p.kind === 'snow';
      if (isFront !== front) continue;
      const a = Math.min(1, p.t * 3, (p.life - p.t) * 1.5);
      switch (p.kind) {
        case 'snow': {
          p.x += (p.vx + Math.sin(this.time * 0.8 + p.rot) * 0.4) * dt; p.y += p.vy * dt;
          if (this.w.T.d(p.x, p.y) < 0) { p.t = p.life; break; }
          ctx.fillStyle = g(0.97, a * 0.9);
          ctx.beginPath(); ctx.arc(this.sx(p.x, p.par) + (this.cam[0] * (p.par - 1)) * 0, this.sy(p.y), Math.max(1, p.r * 0.035 * k), 0, TAU); ctx.fill();
          break;
        }
        case 'dust': case 'spore': {
          p.x += (p.vx + Math.sin(this.time * 0.5 + p.rot) * 0.08) * dt; p.y += p.vy * dt;
          ctx.fillStyle = g(0.92, a * 0.7);
          ctx.beginPath(); ctx.arc(this.sx(p.x), this.sy(p.y), Math.max(0.8, p.r * (p.kind === 'spore' ? 0.035 : 0.02) * k), 0, TAU); ctx.fill();
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
    this.fx = keep.length > 1500 ? keep.slice(-1500) : keep;
  }

  // ── foreground silhouettes (in front of the play plane, drifting faster) ─
  drawForeground(ctx) {
    const PAR = 1.35;
    ctx.fillStyle = g(0.0); ctx.strokeStyle = g(0.0);
    for (const f of this.fg) {
      const X = this.sx(f.x, PAR) + this.cam[0] * 0, Y = this.sy(f.y, PAR);
      if (X < -400 || X > this.W + 400 || Y < -600 || Y > this.H + 600) continue;
      const k = this.k * PAR;
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
      } else if (f.type === 'mound') {
        ctx.beginPath(); ctx.ellipse(X, Y, f.w * k, f.len * k, 0, Math.PI, TAU); ctx.fill();
      } else if (f.type === 'grass') {
        ctx.lineWidth = Math.max(1.2, 0.03 * k);
        for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.12 + Math.sin(this.time * 1.2 + f.seed + i) * 0.05; ctx.beginPath(); ctx.moveTo(X + i * 0.05 * k, Y); ctx.quadraticCurveTo(X + i * 0.05 * k + a * 0.3 * k, Y - f.len * 0.5 * k, X + i * 0.05 * k + a * f.len * k, Y - f.len * k); ctx.stroke(); }
      }
    }
  }
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
  // dark mounds and grass tufts along the floors
  for (let i = 0; i < 90; i++) {
    const x = rng() * 120, y = 4 - rng() * 262;
    const gy = T.ground(x, y, 6);
    if (gy === null || T.d(x, gy + 1.0) < 0.8) continue;
    out.push({ type: rng() < 0.6 ? 'grass' : 'mound', x, y: gy - 0.6, len: 0.4 + rng() * 0.8, w: 0.6 + rng() * 1.4, seed: rng() * 10 });
  }
  return out;
}
