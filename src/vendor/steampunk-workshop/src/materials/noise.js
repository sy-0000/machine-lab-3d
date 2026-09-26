// Deterministic random + tileable value noise used by the texture generators.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Noise2D {
  constructor(seed = 1) {
    const rand = mulberry32(seed);
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    this.values = new Float32Array(256);
    for (let i = 0; i < 256; i++) this.values[i] = rand();
  }

  // Value noise in [0,1]; the lattice wraps with `period` (power of two) so textures tile.
  value(x, y, period = 256) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const x0 = ((xi % period) + period) % period;
    const y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const P = this.perm;
    const V = this.values;
    const v00 = V[P[(x0 & 255) + P[y0 & 255]]];
    const v10 = V[P[(x1 & 255) + P[y0 & 255]]];
    const v01 = V[P[(x0 & 255) + P[y1 & 255]]];
    const v11 = V[P[(x1 & 255) + P[y1 & 255]]];
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  }

  fbm(x, y, octaves = 4, period = 256) {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    let f = 1;
    let p = period;
    for (let o = 0; o < octaves; o++) {
      sum += this.value(x * f, y * f, p) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
      p *= 2;
    }
    return sum / norm;
  }
}

// 1D smooth noise for flicker / motion (non-tiling, cheap).
export function noise1(t, seed = 0) {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash2(i, seed);
  const b = hash2(i + 1, seed);
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}
