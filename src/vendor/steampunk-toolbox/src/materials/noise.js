// 輕量值雜訊 / fBm，用於程序化貼圖
function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 982451653;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed = 1) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

// 可無縫平鋪的 fBm（週期 period）
export function fbm(x, y, octaves = 4, seed = 1, period = 0) {
  let sum = 0, amp = 0.5, f = 1;
  for (let o = 0; o < octaves; o++) {
    let nx = x * f, ny = y * f;
    if (period) {
      const P = period * f;
      nx = ((nx % P) + P) % P; ny = ((ny % P) + P) % P;
      sum += amp * tileNoise(nx, ny, P, seed + o);
    } else sum += amp * valueNoise(nx, ny, seed + o);
    amp *= 0.5; f *= 2;
  }
  return sum;
}

function tileNoise(x, y, P, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const w = (v) => ((v % P) + P) % P;
  const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

// 可重現亂數
export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
