// Procedural canvas textures. Every surface gets colour + ORM (G = roughness, B = metalness,
// the glTF packing) and, where relief matters, a tangent-space normal map derived from height.
import * as THREE from 'three';
import { Noise2D, mulberry32, hash2 } from './noise.js';

let ANISOTROPY = 8;
export function setTextureAnisotropy(a) {
  ANISOTROPY = a;
}

// ---------------------------------------------------------------- helpers

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = ANISOTROPY;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

// A working surface: float buffers for colour / height / roughness / metalness.
class Surface {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.color = new Float32Array(w * h * 3);
    this.height = new Float32Array(w * h).fill(0.5);
    this.rough = new Float32Array(w * h).fill(0.8);
    this.metal = new Float32Array(w * h);
  }

  // Draw with the 2D canvas API on top of the float buffers (for strokes, stains, text).
  paint(fnColor, fnHeight, fnRough) {
    const { w, h } = this;
    if (fnColor) {
      const c = makeCanvas(w, h);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        img.data[i * 4] = clamp255(this.color[i * 3]);
        img.data[i * 4 + 1] = clamp255(this.color[i * 3 + 1]);
        img.data[i * 4 + 2] = clamp255(this.color[i * 3 + 2]);
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      fnColor(ctx);
      const d = ctx.getImageData(0, 0, w, h).data;
      for (let i = 0; i < w * h; i++) {
        this.color[i * 3] = d[i * 4];
        this.color[i * 3 + 1] = d[i * 4 + 1];
        this.color[i * 3 + 2] = d[i * 4 + 2];
      }
    }
    const grayPass = (buf, fn) => {
      const c = makeCanvas(w, h);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const v = clamp255(buf[i] * 255);
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      fn(ctx);
      const d = ctx.getImageData(0, 0, w, h).data;
      for (let i = 0; i < w * h; i++) buf[i] = d[i * 4] / 255;
    };
    if (fnHeight) grayPass(this.height, fnHeight);
    if (fnRough) grayPass(this.rough, fnRough);
  }

  colorTexture() {
    const { w, h } = this;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      img.data[i * 4] = clamp255(this.color[i * 3]);
      img.data[i * 4 + 1] = clamp255(this.color[i * 3 + 1]);
      img.data[i * 4 + 2] = clamp255(this.color[i * 3 + 2]);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, true);
  }

  ormTexture() {
    const { w, h } = this;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      img.data[i * 4] = 255;
      img.data[i * 4 + 1] = clamp255(this.rough[i] * 255);
      img.data[i * 4 + 2] = clamp255(this.metal[i] * 255);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, false);
  }

  normalTexture(strength = 4) {
    const { w, h } = this;
    const H = this.height;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const yu = (y - 1 + h) % h;
      const yd = (y + 1) % h;
      for (let x = 0; x < w; x++) {
        const xl = (x - 1 + w) % w;
        const xr = (x + 1) % w;
        const dx = (H[y * w + xr] - H[y * w + xl]) * strength;
        const dy = (H[yd * w + x] - H[yu * w + x]) * strength;
        const nx = -dx;
        const ny = dy;
        const len = Math.hypot(nx, ny, 1);
        const i = (y * w + x) * 4;
        img.data[i] = (nx / len) * 127.5 + 127.5;
        img.data[i + 1] = (ny / len) * 127.5 + 127.5;
        img.data[i + 2] = (1 / len) * 127.5 + 127.5;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, false);
  }

  build(normalStrength = 4) {
    return { map: this.colorTexture(), orm: this.ormTexture(), normalMap: normalStrength ? this.normalTexture(normalStrength) : null };
  }
}

function randomWalkPath(ctx, rand, x, y, steps, stepLen, angle, jitter) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  const pts = [[x, y]];
  for (let i = 0; i < steps; i++) {
    angle += (rand() - 0.5) * jitter;
    x += Math.cos(angle) * stepLen * (0.6 + rand() * 0.8);
    y += Math.sin(angle) * stepLen * (0.6 + rand() * 0.8);
    ctx.lineTo(x, y);
    pts.push([x, y]);
  }
  return pts;
}

// ---------------------------------------------------------------- brick

function makeBrick() {
  const S = 1024;
  const rows = 24;
  const cols = 8;
  const ch = S / rows;
  const cw = S / cols;
  const mortar = 3.2;
  const n = new Noise2D(11);
  const s = new Surface(S, S);
  const palette = [
    [150, 62, 44], [128, 52, 38], [165, 80, 54], [112, 46, 34],
    [140, 70, 50], [96, 42, 32], [172, 98, 72], [122, 58, 40], [146, 58, 40],
  ];
  for (let y = 0; y < S; y++) {
    const row = Math.floor(y / ch);
    const ly = y - row * ch;
    const offset = (row % 2) * (cw / 2);
    for (let x = 0; x < S; x++) {
      const xx = (x - offset + S) % S;
      const col = Math.floor(xx / cw);
      const lx = xx - col * cw;
      const i = y * S + x;
      const e = Math.min(lx, cw - lx, ly, ch - ly);
      const fine = n.value(x * 0.5, y * 0.5, 512);
      if (e < mortar) {
        const m = 0.78 + 0.3 * n.fbm(x / 8, y / 8, 3, 128) + (fine - 0.5) * 0.25;
        s.color[i * 3] = 132 * m;
        s.color[i * 3 + 1] = 122 * m;
        s.color[i * 3 + 2] = 108 * m;
        s.height[i] = 0.12 + 0.12 * fine;
        s.rough[i] = 0.96;
        continue;
      }
      const r1 = hash2(col, row, 3);
      const r2 = hash2(col, row, 7);
      const r3 = hash2(col, row, 13);
      const base = palette[Math.floor(r1 * palette.length)];
      const grain = n.fbm(x / 32 + col * 5.3, y / 32 + row * 3.1, 4, 32);
      let k = (0.84 + 0.3 * r2) * (0.8 + 0.4 * grain);
      if (fine > 0.84) k *= 0.82;
      if (fine < 0.1) k *= 1.1;
      let r = base[0] * k;
      let g = base[1] * k;
      let b = base[2] * k;
      if (r3 < 0.07) {
        // over-fired clinker brick
        r *= 0.62;
        g *= 0.6;
        b *= 0.62;
      }
      const bevel = smooth(0, 5, e - mortar);
      let hgt = 0.5 + 0.42 * bevel + (grain - 0.5) * 0.12;
      let rough = 0.8 + 0.14 * grain;
      if (r3 > 0.7) {
        // spalled face: the fired skin has flaked off and exposes paler, rougher clay
        const sp = n.fbm((x + col * 61) / 16, (y + row * 17) / 16, 3, 64);
        if (sp > 0.55) {
          const a = smooth(0.55, 0.6, sp);
          r = r + (186 - r) * a * 0.75;
          g = g + (112 - g) * a * 0.75;
          b = b + (84 - b) * a * 0.75;
          hgt -= 0.28 * a;
          rough = 0.97;
        }
      }
      const eff = n.fbm(x / 64, y / 64, 3, 16);
      if (eff > 0.64) {
        const a = Math.min(1, (eff - 0.64) * 3.2);
        r += (196 - r) * a * 0.5;
        g += (186 - g) * a * 0.5;
        b += (170 - b) * a * 0.5;
      }
      s.color[i * 3] = r;
      s.color[i * 3 + 1] = g;
      s.color[i * 3 + 2] = b;
      s.height[i] = hgt;
      s.rough[i] = rough;
    }
  }
  return s.build(3.2);
}

// ---------------------------------------------------------------- concrete floor

function makeConcrete() {
  const S = 1024;
  const n = new Noise2D(23);
  const rand = mulberry32(99);
  const s = new Surface(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const big = n.fbm(x / 128, y / 128, 5, 8);
      const mid = n.fbm(x / 16, y / 16, 3, 64);
      const fine = n.value(x * 0.7, y * 0.7, 1024);
      let k = 0.78 + 0.32 * big + (mid - 0.5) * 0.12;
      if (fine > 0.87) k *= 1.12;
      if (fine < 0.08) k *= 0.84;
      s.color[i * 3] = 106 * k;
      s.color[i * 3 + 1] = 100 * k;
      s.color[i * 3 + 2] = 92 * k;
      s.height[i] = 0.5 + (mid - 0.5) * 0.25 + (fine - 0.5) * 0.15;
      s.rough[i] = 0.72 + 0.2 * (1 - big);
    }
  }

  const stains = [];
  for (let c = 0; c < 7; c++) {
    stains.push({ x: 120 + rand() * (S - 240), y: 120 + rand() * (S - 240), blobs: 3 + Math.floor(rand() * 6), size: 20 + rand() * 60 });
  }
  const cracks = [];
  for (let c = 0; c < 7; c++) {
    cracks.push({ x: 90 + rand() * (S - 180), y: 90 + rand() * (S - 180), a: rand() * Math.PI * 2, steps: 30 + Math.floor(rand() * 60), seed: Math.floor(rand() * 1e6) });
  }
  const wear = [];
  for (let c = 0; c < 5; c++) wear.push({ x: 150 + rand() * (S - 300), y: 150 + rand() * (S - 300), r: 60 + rand() * 120 });

  const drawStains = (ctx, rgba) => {
    for (const st of stains) {
      const r2 = mulberry32(Math.floor(st.x * 13 + st.y));
      for (let b = 0; b < st.blobs; b++) {
        const bx = st.x + (r2() - 0.5) * st.size * 1.8;
        const by = st.y + (r2() - 0.5) * st.size * 1.8;
        const br = st.size * (0.3 + r2() * 0.8);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, rgba(0.55));
        g.addColorStop(0.6, rgba(0.3));
        g.addColorStop(1, rgba(0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(bx, by, br, br * (0.6 + r2() * 0.5), r2() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  const drawCracks = (ctx, style, width) => {
    ctx.strokeStyle = style;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const c of cracks) {
      const r2 = mulberry32(c.seed);
      ctx.lineWidth = width;
      const pts = randomWalkPath(ctx, r2, c.x, c.y, c.steps, 6, c.a, 0.9);
      ctx.stroke();
      for (let b = 0; b < 3; b++) {
        const p = pts[Math.floor(r2() * pts.length)];
        ctx.lineWidth = width * 0.6;
        randomWalkPath(ctx, r2, p[0], p[1], 8 + Math.floor(r2() * 14), 5, c.a + (r2() - 0.5) * 2.4, 1.0);
        ctx.stroke();
      }
    }
  };
  const drawJoints = (ctx, style, w) => {
    ctx.fillStyle = style;
    ctx.fillRect(0, 0, S, w / 2);
    ctx.fillRect(0, S - w / 2, S, w / 2);
    ctx.fillRect(0, 0, w / 2, S);
    ctx.fillRect(S - w / 2, 0, w / 2, S);
  };

  s.paint(
    (ctx) => {
      for (const w of wear) {
        const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
        g.addColorStop(0, 'rgba(170,164,150,0.22)');
        g.addColorStop(1, 'rgba(170,164,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(w.x - w.r, w.y - w.r, w.r * 2, w.r * 2);
      }
      drawStains(ctx, (a) => `rgba(28,20,12,${a * 0.75})`);
      drawCracks(ctx, 'rgba(38,33,28,0.85)', 1.6);
      drawJoints(ctx, 'rgba(50,45,40,0.9)', 5);
      // rust drips and metal scuffs
      const r2 = mulberry32(5);
      for (let i = 0; i < 160; i++) {
        ctx.strokeStyle = `rgba(210,205,195,${0.08 + r2() * 0.12})`;
        ctx.lineWidth = 0.6;
        const x = r2() * S;
        const y = r2() * S;
        const a = r2() * Math.PI;
        const l = 4 + r2() * 26;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(${110 + r2() * 30},${55 + r2() * 20},25,${0.15 + r2() * 0.2})`;
        ctx.beginPath();
        ctx.arc(60 + r2() * (S - 120), 60 + r2() * (S - 120), 1 + r2() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    (ctx) => {
      drawCracks(ctx, 'rgba(0,0,0,0.9)', 2.4);
      drawJoints(ctx, 'rgba(0,0,0,1)', 6);
    },
    (ctx) => {
      for (const w of wear) {
        const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
        g.addColorStop(0, 'rgba(90,90,90,0.35)');
        g.addColorStop(1, 'rgba(90,90,90,0)');
        ctx.fillStyle = g;
        ctx.fillRect(w.x - w.r, w.y - w.r, w.r * 2, w.r * 2);
      }
      drawStains(ctx, (a) => `rgba(40,40,40,${a})`);
    },
  );
  return s.build(2.5);
}

// ---------------------------------------------------------------- wood

function makeWood({ w = 512, h = 1024, seed = 1, dark, light, rings = 9, roughBase = 0.7, alongX = false, planks = 0 }) {
  const n = new Noise2D(seed);
  const s = new Surface(w, h);
  const plankShade = [];
  for (let p = 0; p < Math.max(1, planks); p++) plankShade.push(0.86 + hash2(p, seed, 5) * 0.26);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // a = across-grain coordinate, b = along-grain coordinate
      const a = alongX ? y / h : x / w;
      const b = alongX ? x / w : y / h;
      const A = alongX ? h : w;
      const B = alongX ? w : h;
      const warp = n.fbm(a * 4, b * 2, 4, 4) * 1.6 + n.fbm(a * 16, b * 4, 2, 4) * 0.25;
      const ring = 0.5 + 0.5 * Math.sin((a * rings + warp) * Math.PI * 2);
      const stripe = Math.pow(ring, 2.2);
      const pores = n.value(a * A * 0.6, b * B * 0.035, 1024);
      const fleck = pores > 0.8 ? (pores - 0.8) * 3 : 0;
      const tone = n.fbm(a * 2, b * 2, 3, 2);
      let t = stripe * 0.55 + tone * 0.45;
      let k = 1 - fleck * 0.35;
      if (planks > 0) {
        const pi = Math.floor(a * planks);
        k *= plankShade[pi];
        const edge = Math.abs(a * planks - Math.round(a * planks)) * (A / planks);
        if (edge < 1.6) k *= 0.45;
      }
      s.color[i * 3] = (dark[0] + (light[0] - dark[0]) * t) * k;
      s.color[i * 3 + 1] = (dark[1] + (light[1] - dark[1]) * t) * k;
      s.color[i * 3 + 2] = (dark[2] + (light[2] - dark[2]) * t) * k;
      s.height[i] = 0.5 + stripe * 0.12 - fleck * 0.2;
      s.rough[i] = roughBase + (1 - stripe) * 0.08 + fleck * 0.1;
      if (planks > 0) {
        const edge = Math.abs(a * planks - Math.round(a * planks)) * (A / planks);
        if (edge < 2) s.height[i] = 0.1;
      }
    }
  }
  return s;
}

function makeBenchTop() {
  const W = 1024;
  const H = 512;
  const s = makeWood({ w: W, h: H, seed: 41, dark: [70, 44, 24], light: [138, 96, 56], rings: 7, roughBase: 0.68, alongX: true, planks: 4 });
  const rand = mulberry32(777);
  const knives = [];
  for (let i = 0; i < 140; i++) knives.push([rand() * W, rand() * H, rand() * Math.PI, 8 + rand() * 40, rand()]);
  const gouges = [];
  for (let i = 0; i < 12; i++) gouges.push([80 + rand() * (W - 160), 60 + rand() * (H - 120), rand() * Math.PI, 20 + rand() * 50]);
  const burns = [];
  for (let i = 0; i < 6; i++) burns.push([100 + rand() * (W - 200), 80 + rand() * (H - 160), 12 + rand() * 28]);
  const rings = [];
  for (let i = 0; i < 5; i++) rings.push([100 + rand() * (W - 200), 80 + rand() * (H - 160), 14 + rand() * 18]);
  const drawKnives = (ctx, style) => {
    ctx.lineCap = 'round';
    for (const [x, y, a, l, t] of knives) {
      ctx.strokeStyle = style(t);
      ctx.lineWidth = 0.6 + t * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  };
  const drawGouges = (ctx, style, w) => {
    for (const [x, y, a, l] of gouges) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4, y + Math.sin(a) * l * 0.5 - 3, x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  };
  s.paint(
    (ctx) => {
      // worn, lighter working zone in the middle-front
      const g = ctx.createRadialGradient(W * 0.5, H * 0.62, 20, W * 0.5, H * 0.62, W * 0.45);
      g.addColorStop(0, 'rgba(190,150,105,0.18)');
      g.addColorStop(1, 'rgba(190,150,105,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (const [x, y, r] of rings) {
        ctx.strokeStyle = 'rgba(45,25,10,0.35)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0.2, Math.PI * 1.85);
        ctx.stroke();
      }
      drawKnives(ctx, (t) => `rgba(${35 + t * 30},${22 + t * 16},10,${0.35 + t * 0.4})`);
      drawGouges(ctx, 'rgba(30,18,8,0.7)', 3);
      for (const [x, y, r] of burns) {
        const b = ctx.createRadialGradient(x, y, 0, x, y, r);
        b.addColorStop(0, 'rgba(8,5,3,0.95)');
        b.addColorStop(0.45, 'rgba(22,12,6,0.8)');
        b.addColorStop(0.8, 'rgba(60,30,12,0.35)');
        b.addColorStop(1, 'rgba(60,30,12,0)');
        ctx.fillStyle = b;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.3, r, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // oil and ink
      for (let i = 0; i < 6; i++) {
        const x = 60 + rand() * (W - 120);
        const y = 40 + rand() * (H - 80);
        const r = 6 + rand() * 22;
        const o = ctx.createRadialGradient(x, y, 0, x, y, r);
        const ink = i === 0;
        o.addColorStop(0, ink ? 'rgba(15,20,45,0.8)' : 'rgba(20,12,4,0.55)');
        o.addColorStop(1, 'rgba(20,12,4,0)');
        ctx.fillStyle = o;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    (ctx) => {
      drawKnives(ctx, () => 'rgba(0,0,0,0.55)');
      drawGouges(ctx, 'rgba(0,0,0,0.9)', 3.5);
    },
    (ctx) => {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.62, 20, W * 0.5, H * 0.62, W * 0.45);
      g.addColorStop(0, 'rgba(90,90,90,0.4)');
      g.addColorStop(1, 'rgba(90,90,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (const [x, y, r] of burns) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  );
  return s.build(3);
}

// ---------------------------------------------------------------- metals

function makeMetal(kind) {
  const S = 512;
  const cfg = {
    brass: { seed: 3, base: [206, 160, 82], grime: [92, 70, 38], rough: 0.3, roughVar: 0.18, metal: 1, patina: null },
    copper: { seed: 5, base: [196, 116, 76], grime: [104, 54, 34], rough: 0.36, roughVar: 0.2, metal: 1, patina: [66, 118, 100] },
    iron: { seed: 7, base: [66, 63, 60], grime: [38, 34, 30], rough: 0.62, roughVar: 0.2, metal: 0.8, rust: [88, 50, 32] },
    steel: { seed: 9, base: [168, 168, 170], grime: [70, 66, 60], rough: 0.3, roughVar: 0.16, metal: 1, brushed: true },
  }[kind];
  const n = new Noise2D(cfg.seed);
  const s = new Surface(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const big = n.fbm(x / 64, y / 64, 4, 8);
      const mid = n.fbm(x / 16, y / 16, 3, 32);
      const fine = cfg.brushed ? n.value(x * 0.05, y * 0.9, 512) : n.value(x * 0.6, y * 0.6, 512);
      let r = cfg.base[0] * (0.9 + 0.2 * mid);
      let g = cfg.base[1] * (0.9 + 0.2 * mid);
      let b = cfg.base[2] * (0.9 + 0.2 * mid);
      let rough = cfg.rough + (mid - 0.5) * cfg.roughVar + (fine - 0.5) * 0.08;
      let metal = cfg.metal;
      let hgt = 0.5 + (fine - 0.5) * 0.1;
      const grime = smooth(cfg.patina ? 0.6 : 0.52, cfg.patina ? 0.85 : 0.75, big) * (cfg.patina ? 0.7 : 1);
      r += (cfg.grime[0] - r) * grime * 0.8;
      g += (cfg.grime[1] - g) * grime * 0.8;
      b += (cfg.grime[2] - b) * grime * 0.8;
      rough += grime * 0.35;
      if (cfg.patina) {
        const p = n.fbm(x / 32 + 7, y / 32 + 3, 4, 16) + (n.value(x / 6, y / 6, 128) - 0.5) * 0.12;
        const a = smooth(0.66, 0.78, p) * 0.75;
        r += (cfg.patina[0] * (0.85 + 0.3 * fine) - r) * a;
        g += (cfg.patina[1] * (0.85 + 0.3 * fine) - g) * a;
        b += (cfg.patina[2] * (0.85 + 0.3 * fine) - b) * a;
        rough += (0.9 - rough) * a;
        metal *= 1 - a;
        hgt += a * 0.15;
      }
      if (cfg.rust) {
        const p = n.fbm(x / 24 + 11, y / 24 + 5, 4, 16);
        const a = smooth(0.6, 0.76, p) * (0.5 + 0.4 * fine);
        r += (cfg.rust[0] - r) * a;
        g += (cfg.rust[1] - g) * a;
        b += (cfg.rust[2] - b) * a;
        rough += (0.92 - rough) * a;
        metal *= 1 - a * 0.9;
        hgt += (fine - 0.5) * 0.4 + a * 0.1; // pitted casting skin
      }
      s.color[i * 3] = r;
      s.color[i * 3 + 1] = g;
      s.color[i * 3 + 2] = b;
      s.rough[i] = Math.min(1, Math.max(0.05, rough));
      s.metal[i] = metal;
      s.height[i] = hgt;
    }
  }
  const rand = mulberry32(cfg.seed * 31);
  const scratches = [];
  for (let i = 0; i < 90; i++) scratches.push([rand() * S, rand() * S, rand() * Math.PI, 6 + rand() * 60, rand()]);
  const draw = (ctx, style) => {
    ctx.lineCap = 'round';
    for (const [x, y, a, l, t] of scratches) {
      ctx.strokeStyle = style(t);
      ctx.lineWidth = 0.5 + t * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  };
  s.paint(
    (ctx) => draw(ctx, (t) => `rgba(255,240,215,${0.05 + t * 0.12})`),
    (ctx) => draw(ctx, (t) => `rgba(0,0,0,${0.1 + t * 0.2})`),
    (ctx) => draw(ctx, (t) => `rgba(255,255,255,${0.05 + t * 0.1})`),
  );
  return s.build(kind === 'iron' ? 3 : 1.2);
}

// ---------------------------------------------------------------- leather

function makeLeather() {
  const S = 512;
  const n = new Noise2D(17);
  const s = new Surface(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const cell = n.value(x * 0.35, y * 0.35, 256);
      const pores = Math.pow(Math.abs(cell - 0.5) * 2, 0.6);
      const tone = n.fbm(x / 64, y / 64, 4, 8);
      const worn = smooth(0.55, 0.75, tone);
      const k = 0.82 + 0.2 * pores;
      s.color[i * 3] = (92 + worn * 50) * k;
      s.color[i * 3 + 1] = (54 + worn * 32) * k;
      s.color[i * 3 + 2] = (30 + worn * 18) * k;
      s.height[i] = 0.4 + pores * 0.3;
      s.rough[i] = 0.62 - worn * 0.2 + (1 - pores) * 0.1;
    }
  }
  const rand = mulberry32(3);
  s.paint(
    (ctx) => {
      ctx.strokeStyle = 'rgba(30,15,6,0.35)';
      for (let i = 0; i < 40; i++) {
        ctx.lineWidth = 0.8 + rand();
        randomWalkPath(ctx, rand, rand() * S, rand() * S, 6, 8, rand() * 6, 0.6);
        ctx.stroke();
      }
    },
    null,
    null,
  );
  return s.build(2.2);
}

// ---------------------------------------------------------------- dome glass (RGBA)

// Highly transparent glazing: a faint blue-green tint, a brighter sheen band along the pane edges
// (where the glass meets the glazing bar) and only a whisper of dust on the lower edge.
function makeGlassDirt(variant) {
  const S = 256;
  const n = new Noise2D(31 + variant);
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const dusty = variant >= 1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const v = 1 - y / S; // 0 at bottom of the pane
      const dust = n.fbm(x / 32, y / 32, 4, 8);
      let a = 0.035 + dust * 0.02;
      const low = Math.pow(1 - v, 9) * (dusty ? 0.22 : 0.1); // grime along the lower glazing bar
      a += low;
      if (dusty) a += smooth(0.62, 0.8, dust) * 0.05;
      const edge = Math.min(x, S - x, y, S - y) / S;
      const sheen = (1 - smooth(0, 0.035, edge)) * 0.2;
      a += sheen;
      const dirt = Math.min(1, low * 4);
      img.data[i] = 214 - dirt * 50 + sheen * 150;
      img.data[i + 1] = 230 - dirt * 70 + sheen * 110;
      img.data[i + 2] = 236 - dirt * 95 + sheen * 90;
      img.data[i + 3] = clamp255(Math.min(0.6, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  if (variant === 2) {
    const rand = mulberry32(12);
    ctx.strokeStyle = 'rgba(240,245,245,0.45)';
    for (let k = 0; k < 5; k++) {
      ctx.lineWidth = 0.7;
      randomWalkPath(ctx, rand, S * 0.62, S * 0.35, 8 + Math.floor(rand() * 8), 9, rand() * Math.PI * 2, 0.5);
      ctx.stroke();
    }
  }
  return toTexture(c, true);
}

// Airship envelope: doped sail-cloth gores with seams, faint water stains and soot at the tail.
function makeCanvasGores() {
  const W = 512;
  const H = 256;
  const n = new Noise2D(151);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const t = n.fbm(x / 64, y / 32, 4, 8);
      const weave = n.value(x * 0.9, y * 0.9, 512);
      const seam = (x % 32) < 2 ? 0.72 : 1;
      const tail = 1 - 0.25 * smooth(0.75, 1, y / H);
      const k = (0.85 + 0.2 * t + (weave - 0.5) * 0.06) * seam * tail;
      img.data[i] = 206 * k;
      img.data[i + 1] = 186 * k;
      img.data[i + 2] = 146 * k;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(90,60,30,0.35)';
  ctx.lineWidth = 1;
  for (let y = 16; y < H; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  return toTexture(c, true);
}

// Printed book page: margins, justified "text" lines, a drop cap and a small engraved diagram.
function makeBookPage() {
  const W = 512;
  const H = 512;
  const n = new Noise2D(163);
  const rand = mulberry32(17);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const t = n.fbm(x / 64, y / 64, 4, 8);
      const edge = 1 - smooth(0, 30, Math.min(x, W - x, y, H - y));
      img.data[i] = 226 - t * 26 - edge * 40;
      img.data[i + 1] = 212 - t * 30 - edge * 50;
      img.data[i + 2] = 178 - t * 36 - edge * 60;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = 'rgba(40,30,22,0.8)';
  const drawColumn = (x0, x1, y0, y1, skipBox) => {
    for (let y = y0; y < y1; y += 11) {
      let x = x0;
      while (x < x1 - 8) {
        const w = 6 + rand() * 26;
        if (!(skipBox && y > skipBox[1] && y < skipBox[3] && x + w > skipBox[0] && x < skipBox[2])) {
          ctx.fillRect(x, y, Math.min(w, x1 - x), 3.2);
        }
        x += w + 4;
      }
    }
  };
  drawColumn(40, 236, 60, 470);
  const box = [290, 150, 470, 300];
  drawColumn(276, 472, 60, 470, box);
  ctx.strokeStyle = 'rgba(40,30,22,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(380, 225, 60, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(380 + Math.cos(a) * 20, 225 + Math.sin(a) * 20);
    ctx.lineTo(380 + Math.cos(a) * 60, 225 + Math.sin(a) * 60);
    ctx.stroke();
  }
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('T', 40, 100);
  ctx.font = '14px Georgia, serif';
  ctx.fillText('— 47 —', 120, 494);
  ctx.fillText('— 48 —', 350, 494);
  ctx.fillStyle = 'rgba(120,80,40,0.25)';
  ctx.fillRect(254, 0, 4, H);
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------- paper & prints

function makePaper() {
  const S = 512;
  const n = new Noise2D(43);
  const s = new Surface(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const t = n.fbm(x / 64, y / 64, 4, 8);
      const f = n.value(x * 0.08, y * 0.08, 64);
      const fox = f > 0.9 ? (f - 0.9) * 4 : 0;
      s.color[i * 3] = 222 - t * 30 - fox * 60;
      s.color[i * 3 + 1] = 206 - t * 36 - fox * 80;
      s.color[i * 3 + 2] = 170 - t * 44 - fox * 100;
      s.rough[i] = 0.9;
    }
  }
  return s.build(0);
}

function makeBlueprint() {
  const W = 1024;
  const H = 768;
  const n = new Noise2D(51);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const t = n.fbm(x / 64, y / 64, 4, 16);
      const ex = Math.min(x, W - x, y, H - y);
      const wear = 1 - smooth(0, 40, ex);
      img.data[i] = 26 + t * 18 + wear * 60;
      img.data[i + 1] = 64 + t * 22 + wear * 60;
      img.data[i + 2] = 126 + t * 24 + wear * 40;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(210,225,255,0.09)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  const ink = 'rgba(232,240,255,0.86)';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 2;
  // large gear elevation
  const gear = (cx, cy, r, z) => {
    ctx.beginPath();
    for (let k = 0; k < z; k++) {
      const a0 = (k / z) * Math.PI * 2;
      const s = (Math.PI * 2) / z;
      const pts = [[a0 - s * 0.5, r - 10], [a0 - s * 0.28, r - 10], [a0 - s * 0.16, r + 8], [a0 + s * 0.16, r + 8], [a0 + s * 0.28, r - 10]];
      for (const [a, rr] of pts) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([10, 4, 2, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.moveTo(cx - r - 30, cy);
    ctx.lineTo(cx + r + 30, cy);
    ctx.moveTo(cx, cy - r - 30);
    ctx.lineTo(cx, cy + r + 30);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32);
      ctx.lineTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
      ctx.stroke();
    }
  };
  gear(270, 330, 170, 36);
  gear(505, 222, 70, 14);
  // section view with hatching
  ctx.strokeRect(640, 120, 300, 180);
  ctx.save();
  ctx.beginPath();
  ctx.rect(640, 120, 300, 180);
  ctx.clip();
  ctx.lineWidth = 1;
  for (let k = -200; k < 500; k += 12) {
    ctx.beginPath();
    ctx.moveTo(640 + k, 300);
    ctx.lineTo(640 + k + 180, 120);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(28,66,128,1)';
  ctx.fillRect(700, 160, 180, 100);
  ctx.strokeRect(700, 160, 180, 100);
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(790, 210, 34, 0, Math.PI * 2);
  ctx.stroke();
  // dimension lines
  const dim = (x1, y1, x2, y2, label) => {
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    for (const [px, py, s] of [[x1, y1, 1], [x2, y2, -1]]) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + s * Math.cos(a - 0.3) * 12, py + s * Math.sin(a - 0.3) * 12);
      ctx.lineTo(px + s * Math.cos(a + 0.3) * 12, py + s * Math.sin(a + 0.3) * 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillText(label, (x1 + x2) / 2 - 20, (y1 + y2) / 2 - 8);
  };
  dim(100, 560, 440, 560, '⌀ 340');
  dim(640, 330, 940, 330, '300');
  dim(970, 120, 970, 300, '180');
  ctx.font = 'bold 22px Georgia, serif';
  ctx.fillText('SECTION  A–A', 700, 100);
  ctx.fillText('FIG. 3', 470, 130);
  // title block
  ctx.lineWidth = 2;
  ctx.strokeRect(620, 560, 360, 170);
  ctx.beginPath();
  ctx.moveTo(620, 610);
  ctx.lineTo(980, 610);
  ctx.moveTo(620, 660);
  ctx.lineTo(980, 660);
  ctx.moveTo(800, 610);
  ctx.lineTo(800, 730);
  ctx.stroke();
  ctx.font = 'bold 26px Georgia, serif';
  ctx.fillText('ESCAPEMENT ASSY. MK IV', 636, 596);
  ctx.font = '18px Georgia, serif';
  ctx.fillText('SCALE 1 : 2', 636, 642);
  ctx.fillText('SHEET 4 OF 9', 816, 642);
  ctx.fillText('BRASS · CAST IRON', 636, 694);
  ctx.fillText('REV. C', 816, 694);
  // pencil notes, coffee ring, fold creases
  ctx.strokeStyle = 'rgba(180,200,240,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(560, 470, 60, 26, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,80,40,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(880, 460, 44, 0.3, Math.PI * 1.9);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,220,255,0.16)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function makeRollEnd() {
  const S = 128;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8c9a4';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(110,90,60,0.8)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2 * 9; a += 0.1) {
    const r = 6 + a * 1.0;
    ctx.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.fillStyle = '#1a140c';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  return toTexture(c, true);
}

// ---------------------------------------------------------------- dials, plates, maps

function makeClockDial() {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const cx = S / 2;
  const R = S / 2;
  const g = ctx.createRadialGradient(cx, cx, 10, cx, cx, R);
  g.addColorStop(0, '#efe3c2');
  g.addColorStop(0.75, '#e2d1a6');
  g.addColorStop(1, '#bfa577');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const n = new Noise2D(61);
  const img = ctx.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const x = i % S;
    const y = (i / S) | 0;
    const t = n.fbm(x / 32, y / 32, 4, 16);
    const k = 1 - Math.max(0, t - 0.55) * 0.5;
    img.data[i * 4] *= k;
    img.data[i * 4 + 1] *= k * 0.98;
    img.data[i * 4 + 2] *= k * 0.94;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = '#1c1812';
  ctx.fillStyle = '#1c1812';
  ctx.lineWidth = 3;
  for (const r of [0.93, 0.86, 0.62, 0.58]) {
    ctx.beginPath();
    ctx.arc(cx, cx, R * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2;
    const r0 = R * 0.86;
    const r1 = m % 5 === 0 ? R * 0.93 : R * 0.9;
    ctx.lineWidth = m % 5 === 0 ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * r0, cx - Math.cos(a) * r0);
    ctx.lineTo(cx + Math.sin(a) * r1, cx - Math.cos(a) * r1);
    ctx.stroke();
  }
  const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  ctx.font = 'bold 44px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  numerals.forEach((txt, h) => {
    const a = (h / 12) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.sin(a) * R * 0.74, cx - Math.cos(a) * R * 0.74);
    ctx.rotate(a);
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  });
  // engraved centre rosette
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(60,45,25,0.55)';
  for (let k = 0; k < 12; k++) {
    ctx.beginPath();
    ctx.ellipse(cx, cx, R * 0.36, R * 0.1, (k / 12) * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillStyle = '#2a2014';
  ctx.fillText('Atlas & Sons', cx, cx + R * 0.46);
  return toTexture(c, true);
}

function makeGaugeDial() {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const cx = S / 2;
  const R = S / 2;
  const g = ctx.createRadialGradient(cx, cx, 4, cx, cx, R);
  g.addColorStop(0, '#f3ecd8');
  g.addColorStop(0.85, '#e4d6b4');
  g.addColorStop(1, '#a88e62');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const start = (225 * Math.PI) / 180;
  const sweep = (270 * Math.PI) / 180;
  const at = (v, r) => {
    const a = start - sweep * v;
    return [cx + Math.cos(a) * r, cx - Math.sin(a) * r];
  };
  ctx.strokeStyle = '#b3261e';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cx, R * 0.74, -(start - sweep * 0.84), -(start - sweep), false);
  ctx.stroke();
  ctx.strokeStyle = '#1a1712';
  for (let k = 0; k <= 30; k++) {
    const v = k / 30;
    const major = k % 5 === 0;
    ctx.lineWidth = major ? 3 : 1.5;
    const [x0, y0] = at(v, R * (major ? 0.66 : 0.7));
    const [x1, y1] = at(v, R * 0.8);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.fillStyle = '#1a1712';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 0; k <= 6; k++) {
    const [x, y] = at(k / 6, R * 0.52);
    ctx.fillText(String(k * 50), x, y);
  }
  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillText('LBS', cx, cx + R * 0.36);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cx, R * 0.93, 0, Math.PI * 2);
  ctx.stroke();
  return toTexture(c, true);
}

function makeNameplate() {
  const W = 512;
  const H = 160;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#d8b46a');
  g.addColorStop(0.5, '#b98f45');
  g.addColorStop(1, '#8e6a30');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#4a3416';
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.fillStyle = '#3a2810';
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('ATLAS & SONS', W / 2, 70);
  ctx.font = '22px Georgia, serif';
  ctx.fillText('STEAM WORKS  ·  No. 7  ·  1887', W / 2, 112);
  for (const [x, y] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, true);
}

function makeGlobeMap() {
  const W = 1024;
  const H = 512;
  const n = new Noise2D(88);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI;
    const polar = Math.abs(Math.sin(lat));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const e = n.fbm((x / W) * 8, (y / H) * 4, 6, 8) + (polar > 0.9 ? (polar - 0.9) * 2 : 0);
      const land = e > 0.53;
      const coast = Math.abs(e - 0.53) < 0.006;
      const t = n.fbm((x / W) * 32, (y / H) * 16, 3, 32);
      let r;
      let g;
      let b;
      if (coast) [r, g, b] = [70, 48, 24];
      else if (land) [r, g, b] = [150 - t * 30 + (e - 0.53) * 60, 122 - t * 30, 76 - t * 20];
      else {
        const d = Math.min(1, (0.53 - e) * 6);
        [r, g, b] = [198 - d * 40, 184 - d * 36, 140 - d * 30];
      }
      const age = n.fbm((x / W) * 4 + 3, (y / H) * 2, 3, 4);
      const k = 1 - Math.max(0, age - 0.5) * 0.45;
      img.data[i] = r * k;
      img.data[i + 1] = g * k;
      img.data[i + 2] = b * k;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(80,50,25,0.45)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 12; k++) {
    ctx.beginPath();
    ctx.moveTo(0, (k * H) / 12);
    ctx.lineTo(W, (k * H) / 12);
    ctx.stroke();
  }
  for (let k = 0; k < 24; k++) {
    ctx.beginPath();
    ctx.moveTo((k * W) / 24, 0);
    ctx.lineTo((k * W) / 24, H);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(150,40,30,0.6)';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 1.6;
  for (const y of [H / 2, H / 2 - H * (23.4 / 180), H / 2 + H * (23.4 / 180)]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // compass rose
  ctx.save();
  ctx.translate(W * 0.3, H * 0.62);
  ctx.fillStyle = 'rgba(90,50,25,0.75)';
  for (let k = 0; k < 8; k++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4, -6);
    ctx.lineTo(0, k % 2 ? -18 : -30);
    ctx.lineTo(-4, -6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  return toTexture(c, true);
}

function makeFire() {
  const S = 256;
  const n = new Noise2D(95);
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const f = n.fbm(x / 32, y / 16, 5, 8);
      const g = n.fbm(x / 8, y / 64, 3, 32);
      const heat = Math.min(1, Math.max(0, f * 1.4 - 0.25 + g * 0.3));
      img.data[i] = 255 * Math.min(1, heat * 1.6);
      img.data[i + 1] = 255 * Math.pow(heat, 1.6) * 0.85;
      img.data[i + 2] = 255 * Math.pow(heat, 4) * 0.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true);
}

function makeEmbers() {
  const S = 128;
  const n = new Noise2D(97);
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const f = n.fbm(x / 16, y / 16, 4, 8);
      const ridge = 1 - Math.min(1, Math.abs(f - 0.5) * 14);
      const v = Math.max(ridge, smooth(0.62, 0.8, f) * 0.6);
      img.data[i] = 255 * v;
      img.data[i + 1] = 120 * v * v;
      img.data[i + 2] = 30 * v * v * v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true);
}

function makeGrating() {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const n = new Noise2D(101);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const bar = x % 16 < 4 || y % 32 < 3;
      const t = n.fbm(x / 32, y / 32, 3, 8);
      img.data[i] = 60 + t * 40 + (t > 0.62 ? 35 : 0);
      img.data[i + 1] = 56 + t * 30;
      img.data[i + 2] = 52 + t * 22;
      img.data[i + 3] = bar ? 255 : 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true);
}

function makePegboard() {
  const S = 512;
  const n = new Noise2D(107);
  const s = new Surface(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const t = n.fbm(x / 64, y / 64, 4, 8);
      const f = n.value(x * 0.5, y * 0.5, 256);
      const hx = (x % 32) - 16;
      const hy = (y % 32) - 16;
      const hole = hx * hx + hy * hy < 30;
      const k = hole ? 0.18 : 0.85 + 0.3 * t + (f - 0.5) * 0.08;
      s.color[i * 3] = 118 * k;
      s.color[i * 3 + 1] = 84 * k;
      s.color[i * 3 + 2] = 52 * k;
      s.height[i] = hole ? 0 : 0.6;
      s.rough[i] = 0.8;
    }
  }
  return s.build(2.5);
}

// Soft irregular oil / soot stain with alpha, for floor decals.
function makeStainDecal(seed) {
  const S = 256;
  const n = new Noise2D(seed);
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const dx = (x - S / 2) / (S / 2);
      const dy = (y - S / 2) / (S / 2);
      const r = Math.hypot(dx, dy) + (n.fbm(x / 32, y / 32, 4, 8) - 0.5) * 0.7;
      const core = 1 - smooth(0.15, 0.8, r);
      const ring = Math.exp(-(((r - 0.62) / 0.07) ** 2)) * 0.35;
      const a = Math.min(1, core * 0.8 + ring) * (0.75 + 0.25 * n.value(x * 0.2, y * 0.2, 64));
      img.data[i] = 22;
      img.data[i + 1] = 16;
      img.data[i + 2] = 10;
      img.data[i + 3] = clamp255(a * 235);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c, true);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------------------------------------------------------------- registry (lazy + cached)

const cache = new Map();
const lazy = (key, fn) => () => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

export const Textures = {
  brick: lazy('brick', makeBrick),
  concrete: lazy('concrete', makeConcrete),
  woodDark: lazy('woodDark', () => makeWood({ seed: 61, dark: [48, 22, 12], light: [104, 52, 28], rings: 11, roughBase: 0.42 }).build(1.5)),
  woodWorn: lazy('woodWorn', () => makeWood({ seed: 62, dark: [70, 44, 24], light: [136, 94, 54], rings: 8, roughBase: 0.66 }).build(2)),
  woodPlanks: lazy('woodPlanks', () => makeWood({ seed: 64, dark: [58, 36, 20], light: [120, 80, 46], rings: 12, roughBase: 0.74, planks: 6 }).build(2.5)),
  woodPine: lazy('woodPine',() => makeWood({ seed: 63, dark: [132, 94, 56], light: [192, 152, 104], rings: 6, roughBase: 0.82 }).build(2.2)),
  benchTop: lazy('benchTop', makeBenchTop),
  brass: lazy('brass', () => makeMetal('brass')),
  copper: lazy('copper', () => makeMetal('copper')),
  iron: lazy('iron', () => makeMetal('iron')),
  steel: lazy('steel', () => makeMetal('steel')),
  leather: lazy('leather', makeLeather),
  glassClean: lazy('glassClean', () => makeGlassDirt(0)),
  glassDusty: lazy('glassDusty', () => makeGlassDirt(1)),
  glassCracked: lazy('glassCracked', () => makeGlassDirt(2)),
  paper: lazy('paper', makePaper),
  blueprint: lazy('blueprint', makeBlueprint),
  rollEnd: lazy('rollEnd', makeRollEnd),
  clockDial: lazy('clockDial', makeClockDial),
  gaugeDial: lazy('gaugeDial', makeGaugeDial),
  nameplate: lazy('nameplate', makeNameplate),
  globe: lazy('globe', makeGlobeMap),
  fire: lazy('fire', makeFire),
  embers: lazy('embers', makeEmbers),
  grating: lazy('grating', makeGrating),
  pegboard: lazy('pegboard', makePegboard),
  stain: lazy('stain', () => makeStainDecal(131)),
  canvasGores: lazy('canvasGores', makeCanvasGores),
  bookPage: lazy('bookPage', makeBookPage),
};
