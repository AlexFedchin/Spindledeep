// WebGPU renderer: light (compute) → engrave (fullscreen) → threads (instanced). No libraries.
import { LIGHT_WGSL, ENGRAVE_WGSL, THREAD_WGSL } from './shaders.js';

const MAX_LIGHTS = 160;
const MAX_PTS = 16384;
const LIGHT_DIV = 3;

export class Renderer {
  async init(canvas) {
    if (!navigator.gpu) throw new Error('WebGPU is not available on this system.');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found.');
    this.device = await adapter.requestDevice();
    this.device.lost.then((i) => console.error('GPU device lost', i.message));
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
    const cap = 1440 / h; if (cap < 1) { w = Math.round(w * cap); h = 1440; }
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
    this._bind();
  }

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
      ],
    });
    this.threadBG = d.createBindGroup({
      layout: this.threadPipe.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.ubo } }, { binding: 1, resource: { buffer: this.ptBuf } }],
    });
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
    u[20] = 0.91; u[21] = 0.86; u[22] = 0.75; u[23] = 1;           // paper
    u[24] = Math.max(3.2, this.h / 235); u[25] = Math.min(f.lights.length, MAX_LIGHTS); u[26] = f.flash || 0; u[27] = Math.min(f.bg.length, 4);
    const ip = f.inkPool; u[28] = ip ? ip.x0 : 0; u[29] = ip ? ip.x1 : 0; u[30] = ip ? ip.y : 0; u[31] = ip ? 1 : 0;
    u[32] = this.lw; u[33] = this.lh; u[34] = 0; u[35] = f.red ?? 1;
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
