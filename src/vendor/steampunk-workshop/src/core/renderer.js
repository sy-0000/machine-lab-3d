import * as THREE from 'three';

export function createRenderer(container, quality) {
  const renderer = new THREE.WebGLRenderer({
    antialias: !quality.post, // with post-processing we use an MSAA render target instead
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

// Watches the frame time and trades resolution for frame rate when a tier was auto-selected.
export class AdaptiveResolution {
  constructor(quality, onChange) {
    this.enabled = quality.adaptive;
    this.max = quality.pixelRatio;
    this.min = Math.max(0.6, quality.pixelRatio * 0.5);
    this.current = quality.pixelRatio;
    this.onChange = onChange;
    this.elapsed = 0;
    this.frames = 0;
    this.warmup = 4; // seconds ignored while shaders compile / textures upload
  }

  tick(dt) {
    if (!this.enabled) return;
    if (this.warmup > 0) {
      this.warmup -= dt;
      return;
    }
    this.elapsed += dt;
    this.frames += 1;
    if (this.elapsed < 2) return;
    const fps = this.frames / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    let next = this.current;
    if (fps < 42) next = Math.max(this.min, this.current - 0.2);
    else if (fps > 58 && this.current < this.max) next = Math.min(this.max, this.current + 0.1);
    if (Math.abs(next - this.current) > 1e-3) {
      this.current = next;
      this.onChange(next);
    }
  }
}
