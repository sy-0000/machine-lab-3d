// 背景執行緒：畫蒸汽龐克場景的程序化貼圖（每張都要逐像素計算，放在主執行緒會卡住畫面好幾秒）。
// 畫完轉成 ImageBitmap 交回主執行緒（transfer，不複製），由 prewarm.js 放進兩個場景的貼圖快取。
import { Textures } from '../vendor/steampunk-workshop/src/materials/textures.js';
import { recordGenerated } from '../vendor/steampunk-toolbox/src/materials/textures.js';
import { createMaterialLibrary } from '../vendor/steampunk-toolbox/src/materials/materialLibrary.js';
import { createWorkbench } from '../vendor/steampunk-toolbox/src/assets/workbench.js';
import { createBackdrop } from '../vendor/steampunk-toolbox/src/assets/backdrop.js';

// WebGL 上傳 ImageBitmap 時不會套用 flipY，所以在這裡先翻好；alpha 不預乘，與畫布上傳的結果一致
const bitmap = (source, flip) => createImageBitmap(source, { imageOrientation: flip ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });

// 把畫布 / three.js 貼圖（可巢狀在物件裡）換成可傳送的 ImageBitmap
async function pack(value, transfer) {
  if (value?.isTexture) {
    const image = await bitmap(value.image, value.flipY);
    transfer.push(image);
    const { colorSpace, wrapS, wrapT, anisotropy, generateMipmaps, minFilter, magFilter } = value;
    return { $texture: { image, colorSpace, wrapS, wrapT, anisotropy, generateMipmaps, minFilter, magFilter, repeat: value.repeat.toArray(), offset: value.offset.toArray() } };
  }
  if (value instanceof OffscreenCanvas) {
    const image = await bitmap(value, true);
    transfer.push(image);
    return image;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await pack(v, transfer);
    return out;
  }
  return value;
}

const TASKS = {
  // 工具盒：照 mountToolbox 的順序建一次材質、工作台、背景，記下用到的每張貼圖
  toolbox: ({ quality }) => recordGenerated(() => {
    const mat = createMaterialLibrary(quality);
    createWorkbench(mat, quality);
    createBackdrop(mat, quality);
  }),
  // 機台背景的穹頂工作室：整個貼圖清單
  workshop: () => new Map(Object.entries(Textures).map(([key, make]) => [key, make()])),
};

self.onmessage = async ({ data: { task, options } }) => {
  try {
    const transfer = [], entries = [];
    for (const [key, value] of TASKS[task](options)) entries.push([key, await pack(value, transfer)]);
    self.postMessage({ entries }, transfer);
  } catch (error) {
    self.postMessage({ error: String(error?.stack || error) });
  }
};
