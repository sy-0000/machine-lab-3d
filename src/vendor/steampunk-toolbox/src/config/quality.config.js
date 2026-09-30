// 品質等級設定（不出現在畫面 UI）。可用網址參數 ?q=low|medium|high 覆寫。
export const QUALITY_LEVELS = {
  low: {
    pixelRatioCap: 1, shadows: false, shadowMapSize: 512, msaaSamples: 0,
    outline: true, bloom: false, fxaa: true, dustCount: 160, textureSize: 256,
  },
  medium: {
    pixelRatioCap: 1.5, shadows: true, shadowMapSize: 1024, msaaSamples: 4,
    outline: true, bloom: false, fxaa: false, dustCount: 320, textureSize: 512,
  },
  high: {
    pixelRatioCap: 2, shadows: true, shadowMapSize: 2048, msaaSamples: 4,
    outline: true, bloom: false, fxaa: false, dustCount: 520, textureSize: 1024,
  },
};

export const DEFAULT_QUALITY = 'high';

export function resolveQuality() {
  let key = DEFAULT_QUALITY;
  try {
    const q = new URLSearchParams(location.search).get('q');
    if (q && QUALITY_LEVELS[q]) key = q;
  } catch (e) { /* ignore */ }
  return { key, ...QUALITY_LEVELS[key] };
}
