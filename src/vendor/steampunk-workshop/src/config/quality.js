// Quality tiers. Selected with ?quality=low|medium|high, otherwise guessed from the device.
// The adaptive governor in core/renderer.js can lower the pixel ratio at runtime.

const PRESETS = {
  low: {
    name: 'low',
    maxPixelRatio: 1,
    shadowMapSize: 1024,
    post: false,
    msaa: 0,
    bloom: false,
    dustCount: 700,
    steamParticles: 180,
    sparkParticles: 40,
    shafts: true,
    anisotropy: 2,
  },
  medium: {
    name: 'medium',
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    post: true,
    msaa: 4,
    bloom: true,
    dustCount: 1600,
    steamParticles: 320,
    sparkParticles: 70,
    shafts: true,
    anisotropy: 8,
  },
  high: {
    name: 'high',
    maxPixelRatio: 2,
    shadowMapSize: 4096,
    post: true,
    msaa: 4,
    bloom: true,
    dustCount: 2600,
    steamParticles: 420,
    sparkParticles: 90,
    shafts: true,
    anisotropy: 16,
  },
};

function guessTier() {
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (mobile) return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  return cores >= 8 ? 'high' : 'medium';
}

// `override` ('low' | 'medium' | 'high') wins over ?quality= in the URL; otherwise auto.
export function resolveQuality(override = null) {
  const params = new URLSearchParams(location.search);
  const requested = PRESETS[override] ? override : params.get('quality');
  const tier = PRESETS[requested] ? requested : guessTier();
  const preset = { ...PRESETS[tier] };
  preset.pixelRatio = Math.min(window.devicePixelRatio || 1, preset.maxPixelRatio);
  preset.adaptive = !PRESETS[requested];
  return preset;
}

export { PRESETS };
