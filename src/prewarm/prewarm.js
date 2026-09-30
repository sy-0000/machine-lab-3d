// 背景預熱：使用者還在看首頁時，先把之後會用到的重東西準備好。
// - 工具盒與機台背景工作室的程序化貼圖：在 Web Worker 裡畫（不佔主執行緒，畫面不會卡）
// - 工具盒頁面的程式碼、車床模型：趁空檔先下載
// 每件工作只做一次；進入場景時如果還沒做完，場景會直接等同一個結果，不會重做。
import { Texture } from 'three';
import { setPrebaked } from '../vendor/steampunk-toolbox/src/materials/textures.js';
import { primeTextures } from '../vendor/steampunk-workshop/src/materials/textures.js';
import { resolveQuality } from '../vendor/steampunk-toolbox/src/config/quality.config.js';
import { MachineLoader } from '../machines/core/MachineLoader.js';

const done = new Map();

// 每件工作開自己的背景執行緒（可以同時進行，機台場景不必排在工具盒後面），做完就關掉釋放記憶體
function bake(task, options) {
  if (done.has(task)) return done.get(task);
  const start = performance.now();
  const promise = new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      return reject(new Error('此瀏覽器不支援背景繪製貼圖'));
    }
    const worker = new Worker(new URL('./textureBaker.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error)); else resolve(data.entries);
    };
    worker.onerror = (e) => { worker.terminate(); reject(e); };
    worker.postMessage({ task, options });
  }).then((entries) => {
    performance.measure(`prewarm:${task}`, { start }); // 開發者工具 Performance 面板可看花了多久
    return entries;
  }).catch((error) => {
    // 失敗不影響使用：場景會照原本的方式在主執行緒上畫貼圖
    console.warn(`背景預熱（${task}）失敗，改為進入場景時再產生`, error);
    return [];
  });
  done.set(task, promise);
  return promise;
}

function unpack(value) {
  if (value?.$texture) {
    const { image, repeat, offset, ...props } = value.$texture;
    const t = new Texture(image);
    Object.assign(t, props, { flipY: false }); // 已在背景翻轉
    t.repeat.fromArray(repeat);
    t.offset.fromArray(offset);
    t.needsUpdate = true;
    return t;
  }
  if (value && typeof value === 'object' && !(value instanceof ImageBitmap)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unpack(v)]));
  }
  return value;
}

/** 工具盒貼圖；mountToolbox 之前 await（已完成時立即回傳） */
export const prewarmToolbox = () => bake('toolbox', { quality: resolveQuality() }).then((entries) => {
  setPrebaked(entries);
});

/** 機台背景工作室的貼圖；buildWorld 之前 await */
export const prewarmWorkshop = () => bake('workshop').then((entries) => {
  primeTextures(entries.map(([key, value]) => [key, unpack(value)]));
});

// 讓出主執行緒一下（不用 setTimeout：分頁在背景時會被限速到每秒一次）
const breathe = () => globalThis.scheduler?.yield?.() ?? new Promise((resolve) => {
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = () => resolve();
  port2.postMessage(0);
});

/**
 * 物件第一次畫出來之前：分批把貼圖上傳到顯示卡、編好著色器（支援平行編譯的瀏覽器在背景編），
 * 免得第一格畫面一次做完而卡住。
 * @param {import('three').WebGLRenderer} gl
 * @param {import('three').Object3D} object 還沒加進場景的物件
 * @param {import('three').Camera} camera
 * @param {import('three').Scene} scene 物件之後要加入的場景（用它的燈光編譯）
 */
export async function warmUpGpu(gl, object, camera, scene) {
  const textures = new Set();
  object.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  let n = 0;
  for (const t of textures) {
    gl.initTexture(t);
    if (++n % 4 === 0) await breathe();
  }
  await breathe();
  await gl.compileAsync(object, camera, scene).catch(() => {});
}

const idle = (fn, timeout) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 300));

// 慢速或省流量的網路不預先下載模型（貼圖在本機產生，不耗流量）
function canPrefetch() {
  const c = navigator.connection;
  return !(c?.saveData || /(^|-)2g|3g/.test(c?.effectiveType || ''));
}

/** 開站後閒置時呼叫一次：同時預熱工具盒與工作室貼圖，並下載工具盒頁面與車床模型 */
export function prewarmInBackground() {
  idle(() => {
    import('../pages/ToolsPage.jsx');
    prewarmToolbox();
    prewarmWorkshop();
    if (canPrefetch()) MachineLoader.prefetch('lathe');
  }, 2500);
}

/** 滑鼠移到機台卡片上：先開始下載那台的模型 */
export function prefetchMachine(id) {
  if (canPrefetch()) MachineLoader.prefetch(id);
}
