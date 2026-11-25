// WebGPU renderer: light (compute) → figures (skinned models, when there are any) → engrave (fullscreen) → threads (instanced). No libraries.
import { LIGHT_WGSL, ENGRAVE_WGSL, THREAD_WGSL, FIGURE_WGSL, PROP_WGSL } from './shaders.js';

const MAX_LIGHTS = 160;
const MAX_PTS = 16384;
const LIGHT_DIV = 3;
const FIG_LIGHTS = 14, FIG_UBO = 48 + FIG_LIGHTS * 32, PROP_LIGHTS = 8, PROP_UBO = 112 + PROP_LIGHTS * 32;

export class Renderer {
  async init(canvas) {
    if (!navigator.gpu) throw new Error('WebGPU is not available on this system.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found.');
    this.device = await adapter.requestDevice();
    this.device.lost.then((i) => { console.error('GPU device lost', i.message); try { window.host?.log?.('ERROR GPU device lost: ' + i.message); } catch { /* ignore */ } });
    this.device.addEventListener('uncapturederror', (e) => { console.error('WebGPU:', e.error.message); window.__SD?.errors.push(e.error.message); });
    this.canvas = canvas;
    this.ctx = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({ device: this.device, format: this.format, alphaMode: 'opaque' });
    const d = this.device;
    this.ubo = d.createBuffer({ size: 272, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.u = new Float32Array(68);
    this.lightBuf = d.createBuffer({ size: MAX_LIGHTS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.lightData = new Float32Array(MAX_LIGHTS * 8);
    this.ptBuf = d.createBuffer({ size: MAX_PTS * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.ptData = new Float32Array(MAX_PTS * 8);
    this.samp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });

    const mod = (code, label) => {
      const m = d.createShaderModule({ code, label });
      m.getCompilationInfo().then((info) => info.messages.forEach((msg) => {
        if (msg.type === 'error') { const s = `${label}:${msg.lineNum}:${msg.linePos} ${msg.message}`; console.error(s); window.__SD?.errors.push(s); }
      }));
      return m;
    };
    this.lightPipe = d.createComputePipeline({ layout: 'auto', compute: { module: mod(LIGHT_WGSL, 'light'), entryPoint: 'main' } });
    const eng = mod(ENGRAVE_WGSL, 'engrave');
    this.engravePipe = d.createRenderPipeline({
      layout: 'auto',
      vertex: { module: eng, entryPoint: 'vs' },
      fragment: { module: eng, entryPoint: 'fs', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
    const th = mod(THREAD_WGSL, 'thread');
    this.threadPipe = d.createRenderPipeline({
      layout: 'auto',
      vertex: { module: th, entryPoint: 'vs' },
      fragment: {
        module: th, entryPoint: 'fs',
        targets: [{ format: this.format, blend: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } } }],
      },
      primitive: { topology: 'triangle-strip' },
    });
    const fg = mod(FIGURE_WGSL, 'figure');
    this.figPipe = d.createRenderPipeline({
      layout: 'auto',
      vertex: { module: fg, entryPoint: 'vs', buffers: [{ arrayStride: 44, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x2' },
        { shaderLocation: 3, offset: 32, format: 'uint8x4' }, { shaderLocation: 4, offset: 36, format: 'unorm8x4' }, { shaderLocation: 5, offset: 40, format: 'float32' }] }] },
      fragment: { module: fg, entryPoint: 'fs', targets: [{ format: 'rgba16float' }, { format: 'rgba8unorm' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthCompare: 'less', depthWriteEnabled: true },
      multisample: { count: 4 },
    });
    const pg = mod(PROP_WGSL, 'prop');
    this.propPipe = d.createRenderPipeline({
      layout: 'auto',
      vertex: { module: pg, entryPoint: 'vs', buffers: [{ arrayStride: 32, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'snorm8x4' }, { shaderLocation: 2, offset: 16, format: 'float32x2' },
        { shaderLocation: 3, offset: 24, format: 'unorm8x4' }, { shaderLocation: 4, offset: 28, format: 'unorm8x4' }] }] },
      fragment: { module: pg, entryPoint: 'fs', targets: [{ format: 'rgba16float' }, { format: 'rgba8unorm' }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthCompare: 'less', depthWriteEnabled: true },
      multisample: { count: 4 },
    });
    this.propSamp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 8 });
    this.figSamp = d.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'repeat' });
    this.figs = new Map();           // figure → its GPU side
    const none = () => d.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
    this.figNone = [none(), none()]; this.figOn = false;
    // placeholders until the world and art arrive
    this.sdfTex = d.createTexture({ size: [4, 4], format: 'r16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.bgTex = d.createTexture({ size: [4, 4, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.spriteCanvas = new OffscreenCanvas(16, 16);
    this.emitCanvas = new OffscreenCanvas(16, 16);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
    const cap = Math.min(1440 / h, 1) * (this.detail || 1); if (cap < 1) { w = Math.round(w * cap); h = Math.round(h * cap); }
    // very wide windows: no texture past what the machine can make
    const big = this.device.limits.maxTextureDimension2D; if (w > big) { h = Math.round(h * big / w); w = big; }
    w = Math.max(w, 320); h = Math.max(h, 180);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    const d = this.device;
    this.lw = Math.ceil(w / LIGHT_DIV); this.lh = Math.ceil(h / LIGHT_DIV);
    this.lightTex?.destroy();
    this.lightTex = d.createTexture({ size: [this.lw, this.lh], format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    this.spriteCanvas.width = w; this.spriteCanvas.height = h;
    this.emitCanvas.width = Math.ceil(w / 2); this.emitCanvas.height = Math.ceil(h / 2);
    this.spriteTex?.destroy(); this.emitTex?.destroy();
    const tu = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;
    this.spriteTex = d.createTexture({ size: [w, h], format: 'rgba8unorm', usage: tu });
    this.emitTex = d.createTexture({ size: [this.emitCanvas.width, this.emitCanvas.height], format: 'rgba8unorm', usage: tu });
    this.sctx = this.spriteCanvas.getContext('2d');
    this.ectx = this.emitCanvas.getContext('2d');
    this.figT?.forEach((t) => t.destroy()); this.figT = null; this.figOn = false;
    this._bind();
  }

  setDetail(k) { if (k === this.detail) return; this.detail = k; this.resize(); }

  setWorld(terrain, world) {
    this.world = world;
    this.sdfTex.destroy();
    this.sdfTex = this.device.createTexture({ size: [terrain.W, terrain.H], format: 'r16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.sdfW = terrain.W; this.sdfH = terrain.H;
    this.setSDF(terrain.halfData());
    this._bind();
  }
  // the drawn field can differ from the physics one (hidden rooms stay rock until found)
  setSDF(data) { this.device.queue.writeTexture({ texture: this.sdfTex }, data.buffer, { bytesPerRow: this.sdfW * 2 }, [this.sdfW, this.sdfH]); }
  patchSDF(p) { this.device.queue.writeTexture({ texture: this.sdfTex, origin: [p.x, p.y] }, p.data.buffer, { bytesPerRow: p.w * 2 }, [p.w, p.h]); }

  // layers: array of ImageBitmap/canvas, each packed RGBA = (far tone, near tone, near matte, depth)
  setBackdrops(layers, size = 1024) {
    this.bgTex.destroy();
    this.bgTex = this.device.createTexture({
      size: [size, size, Math.max(1, layers.length)], format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    layers.forEach((src, i) => this.device.queue.copyExternalImageToTexture({ source: src }, { texture: this.bgTex, origin: [0, 0, i] }, [size, size]));
    this._bind();
  }

  _bind() {
    if (!this.lightTex) return;
    const d = this.device;
    this.lightBG = d.createBindGroup({
      layout: this.lightPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: this.sdfTex.createView() },
        { binding: 2, resource: this.samp }, { binding: 3, resource: { buffer: this.lightBuf } },
        { binding: 4, resource: this.lightTex.createView() },
      ],
    });
    this.engraveBG = d.createBindGroup({
      layout: this.engravePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: this.sdfTex.createView() },
        { binding: 2, resource: this.samp }, { binding: 3, resource: this.lightTex.createView() },
        { binding: 4, resource: this.bgTex.createView({ dimension: '2d-array' }) },
        { binding: 5, resource: this.spriteTex.createView() }, { binding: 6, resource: this.emitTex.createView() },
        { binding: 7, resource: (this.figOn ? this.figT[0] : this.figNone[0]).createView() }, { binding: 8, resource: (this.figOn ? this.figT[1] : this.figNone[1]).createView() },
      ],
    });
    this.threadBG = d.createBindGroup({
      layout: this.threadPipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: { buffer: this.ptBuf } }],
    });
  }

  // a model's buffers and textures, made once
  addModel(m) {
    const d = this.device;
    const buf = (data, usage) => { const b = d.createBuffer({ size: (data.byteLength + 3) & ~3, usage: usage | GPUBufferUsage.COPY_DST }); d.queue.writeBuffer(b, 0, data.buffer, data.byteOffset, data.byteLength); return b; };
    const tex = (im) => { const t = d.createTexture({ size: [im.width, im.height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT }); d.queue.copyExternalImageToTexture({ source: im }, { texture: t }, [im.width, im.height]); return t; };
    m.gpu = { vb: buf(m.vb, GPUBufferUsage.VERTEX), ib: buf(m.ib, GPUBufferUsage.INDEX), tex: tex(m.tex), nrm: tex(m.nrm) };
  }
  // a thing to pick up (props3d.js): the same, with the textures' smaller sizes ready made
  addProp(m) {
    const d = this.device;
    const buf = (data, usage) => { const b = d.createBuffer({ size: (data.byteLength + 3) & ~3, usage: usage | GPUBufferUsage.COPY_DST }); d.queue.writeBuffer(b, 0, data.buffer, data.byteOffset, data.byteLength); return b; };
    const tex = (ims) => {
      const t = d.createTexture({ size: [ims[0].width, ims[0].height], mipLevelCount: ims.length, format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
      ims.forEach((im, i) => { d.queue.copyExternalImageToTexture({ source: im }, { texture: t, mipLevel: i }, [im.width, im.height]); im.close(); });
      return t;
    };
    m.gpu = { vb: buf(m.vb, GPUBufferUsage.VERTEX), ib: buf(m.ib, GPUBufferUsage.INDEX), tex: tex(m.tex), nrm: tex(m.nrm) };
  }
  _prop(rp, P, f) {
    const d = this.device, g = P.m.gpu;
    let G = this.figs.get(P);
    if (!G) {
      G = { ubo: d.createBuffer({ size: PROP_UBO, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), u: new Float32Array(PROP_UBO / 4) };
      G.bg = d.createBindGroup({ layout: this.propPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: G.ubo } }, { binding: 1, resource: g.tex.createView() }, { binding: 2, resource: g.nrm.createView() }, { binding: 3, resource: this.propSamp }] });
      this.figs.set(P, G);
    }
    const u = G.u, [hx, hy] = P.at;
    const ls = (P.own ? [] : f.lights).map((l) => { const x = Math.hypot(l.x - hx, l.y - hy); return [l.i * Math.max(0, 1.6 - x / l.r) / (1 + x * x * 0.12), l]; }).filter((a) => a[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, PROP_LIGHTS - P.lights.length).map((a) => a[1]).concat(P.lights);
    u[0] = f.cam[0]; u[1] = f.cam[1]; u[2] = f.viewH; u[3] = this.w / this.h; u[4] = ls.length; u[5] = P.env; u[6] = P.gain; u[7] = Math.max(8, P.k * 26);
    u[8] = f.ambient[0]; u[9] = f.ambient[1]; u[10] = f.ambient[2]; u[11] = P.blur;
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) u[12 + c * 4 + r] = P.R[c][r];
    u[15] = P.k; u[19] = P.flat || 0; u[24] = P.at[0]; u[25] = P.at[1]; u[26] = P.at[2]; u[27] = P.over ? 0 : 0.5;
    ls.forEach((l, k) => { const o = 28 + k * 8; u[o] = l.x; u[o + 1] = l.y; u[o + 2] = l.z ?? 1.5; u[o + 3] = l.r; u[o + 4] = l.c[0] * l.i; u[o + 5] = l.c[1] * l.i; u[o + 6] = l.c[2] * l.i; });
    d.queue.writeBuffer(G.ubo, 0, u);
    rp.setPipeline(this.propPipe); rp.setBindGroup(0, G.bg); rp.setVertexBuffer(0, g.vb); rp.setIndexBuffer(g.ib, 'uint32'); rp.drawIndexed(P.m.ni);
  }
  _figures(enc, f) {
    const d = this.device, list = f.figs || [];
    if (!list.length) { if (this.figOn) { this.figOn = false; this._bind(); } return; }
    if (!this.figT) {
      const U = GPUTextureUsage, size = [this.w, this.h];
      this.figT = [d.createTexture({ size, format: 'rgba16float', usage: U.TEXTURE_BINDING | U.RENDER_ATTACHMENT }), d.createTexture({ size, format: 'rgba8unorm', usage: U.TEXTURE_BINDING | U.RENDER_ATTACHMENT }),
        d.createTexture({ size, format: 'rgba16float', sampleCount: 4, usage: U.RENDER_ATTACHMENT }), d.createTexture({ size, format: 'rgba8unorm', sampleCount: 4, usage: U.RENDER_ATTACHMENT }),
        d.createTexture({ size, format: 'depth24plus', sampleCount: 4, usage: U.RENDER_ATTACHMENT })];
    }
    if (!this.figOn) { this.figOn = true; this._bind(); }
    const [c0, c1, m0, m1, dz] = this.figT.map((t) => t.createView()), clearValue = [0, 0, 0, 0];
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: m0, resolveTarget: c0, loadOp: 'clear', storeOp: 'discard', clearValue }, { view: m1, resolveTarget: c1, loadOp: 'clear', storeOp: 'discard', clearValue }],
      depthStencilAttachment: { view: dz, depthLoadOp: 'clear', depthStoreOp: 'discard', depthClearValue: 1 } });
    for (const F of list) {
      if (F.m.prop) { this._prop(rp, F, f); continue; }
      rp.setPipeline(this.figPipe);
      let G = this.figs.get(F);
      const g = F.m.gpu;
      if (!G) {
        G = { ubo: d.createBuffer({ size: FIG_UBO, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), u: new Float32Array(FIG_UBO / 4), mats: d.createBuffer({ size: F.mats.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }) };
        G.bg = d.createBindGroup({ layout: this.figPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: G.ubo } }, { binding: 1, resource: { buffer: G.mats } }, { binding: 2, resource: g.tex.createView() }, { binding: 3, resource: g.nrm.createView() }, { binding: 4, resource: this.figSamp }] });
        this.figs.set(F, G);
      }
      // the lights that matter most where it is (a light can say how near the viewer it hangs: z)
      const u = G.u, [hx, hy] = F.focus || F.at;
      const ls = f.lights.concat(F.lights).map((l) => { const x = Math.hypot(l.x - hx, l.y - hy); return [l.i * Math.max(0, 1.6 - x / l.r) / (1 + x * x * 0.12), l]; }).filter((a) => a[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, FIG_LIGHTS);
      u[0] = f.cam[0]; u[1] = f.cam[1]; u[2] = f.viewH; u[3] = this.w / this.h; u[4] = ls.length; u[5] = F.hollow; u[6] = F.gain; u[7] = F.D;
      u[8] = f.ambient[0]; u[9] = f.ambient[1]; u[10] = f.ambient[2];
      ls.forEach(([, l], k) => { const o = 12 + k * 8; u[o] = l.x; u[o + 1] = l.y; u[o + 2] = l.z ?? 1.5; u[o + 3] = l.r; u[o + 4] = l.c[0] * l.i; u[o + 5] = l.c[1] * l.i; u[o + 6] = l.c[2] * l.i; });
      d.queue.writeBuffer(G.ubo, 0, u); d.queue.writeBuffer(G.mats, 0, F.mats);
      rp.setBindGroup(0, G.bg); rp.setVertexBuffer(0, g.vb); rp.setIndexBuffer(g.ib, 'uint32'); rp.drawIndexed(F.m.ni);
    }
    rp.end();
  }

  // f: { cam:[x,y], viewH, time, ambient:[r,g,b], moon, lights:[{x,y,r,i,c,soft}], pts:[...flat 8-float], nPts,
  //      bg:[{cx,cy,w,h,par,layer,alpha}], inkPool, fade, flash, red }
  frame(f) {
    const d = this.device, u = this.u, W = this.world;
    u[0] = this.w; u[1] = this.h; u[2] = f.cam[0]; u[3] = f.cam[1];
    u[4] = f.viewH; u[5] = f.time; u[6] = Math.floor(f.time * 5) % 64; u[7] = f.fade || 0;
    u[8] = W.x0; u[9] = W.y0; u[10] = W.w; u[11] = W.h;
    u[12] = f.ambient[0]; u[13] = f.ambient[1]; u[14] = f.ambient[2]; u[15] = f.moon || 0;
    u[16] = 0.045; u[17] = 0.04; u[18] = 0.06; u[19] = 1;          // ink
    u[20] = 0.91; u[21] = 0.86; u[22] = 0.75; u[23] = this.gamma || 1;           // paper
    u[24] = Math.max(3.2, this.h / 235); u[25] = Math.min(f.lights.length, MAX_LIGHTS); u[26] = f.flash || 0; u[27] = Math.min(f.bg.length, 4);
    const ip = f.inkPool; u[28] = ip ? ip.x0 : 0; u[29] = ip ? ip.x1 : 0; u[30] = ip ? ip.y : 0; u[31] = ip ? 1 : 0;
    u[32] = this.lw; u[33] = this.lh; u[34] = f.hush || 0; u[35] = f.red ?? 1;
    for (let k = 0; k < 4; k++) {
      const b = f.bg[k];
      if (!b) continue;
      u[36 + k * 4] = b.cx; u[37 + k * 4] = b.cy; u[38 + k * 4] = b.w; u[39 + k * 4] = b.h;
      u[52 + k * 4] = b.par; u[53 + k * 4] = b.layer; u[54 + k * 4] = b.alpha; u[55 + k * 4] = 0;
    }
    d.queue.writeBuffer(this.ubo, 0, u);
    const L = this.lightData, nl = Math.min(f.lights.length, MAX_LIGHTS);
    for (let i = 0; i < nl; i++) {
      const l = f.lights[i], o = i * 8;
      L[o] = l.x; L[o + 1] = l.y; L[o + 2] = l.r; L[o + 3] = l.i; L[o + 4] = l.c[0]; L[o + 5] = l.c[1]; L[o + 6] = l.c[2]; L[o + 7] = l.soft ?? 8;
    }
    if (nl) d.queue.writeBuffer(this.lightBuf, 0, L, 0, nl * 8);
    const np = Math.min(f.nPts, MAX_PTS);
    if (np > 1) d.queue.writeBuffer(this.ptBuf, 0, f.pts, 0, np * 8);
    d.queue.copyExternalImageToTexture({ source: this.spriteCanvas }, { texture: this.spriteTex }, [this.w, this.h]);
    d.queue.copyExternalImageToTexture({ source: this.emitCanvas }, { texture: this.emitTex }, [this.emitCanvas.width, this.emitCanvas.height]);

    const enc = d.createCommandEncoder();
    this._figures(enc, f);
    const cp = enc.beginComputePass();
    cp.setPipeline(this.lightPipe); cp.setBindGroup(0, this.lightBG);
    cp.dispatchWorkgroups(Math.ceil(this.lw / 8), Math.ceil(this.lh / 8));
    cp.end();
    const rp = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    rp.setPipeline(this.engravePipe); rp.setBindGroup(0, this.engraveBG); rp.draw(3);
    if (np > 1) { rp.setPipeline(this.threadPipe); rp.setBindGroup(0, this.threadBG); rp.draw(4, np - 1); }
    rp.end();
    d.queue.submit([enc.finish()]);
  }
}
