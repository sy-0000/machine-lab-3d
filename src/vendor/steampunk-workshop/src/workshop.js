// Public entry point of the steampunk workshop scene.
//
//   import { createWorkshop } from './steampunk-workshop/src/workshop.js';
//   const workshop = await createWorkshop(document.getElementById('game'));
//   workshop.setMachine(gltf.scene);          // one machine tool at the room centre
//
// It builds renderer, scene, camera (orbit, damped, bounded), the whole room, lights, particles
// and post-processing, and runs its own render loop (or lets the game drive it).
import * as THREE from 'three';
import { resolveQuality } from './config/quality.js';
import { CAMERA, MACHINE_SLOT } from './config/layout.js';
import { createRenderer, AdaptiveResolution } from './core/renderer.js';
import { createScene } from './core/scene.js';
import { createSky } from './core/sky.js';
import { createCameraRig } from './core/camera.js';
import { createPostPipeline } from './core/postprocessing.js';
import { createLights } from './lighting/lights.js';
import { buildBlockout } from './structure/blockout.js';
import { createEffects } from './effects/effects.js';
import { createMachineSlot } from './game/machineSlot.js';
import { exportObjectAsGLB } from './tools/exportGLTF.js';

const nextFrame = () => new Promise((r) => setTimeout(r, 16));

/**
 * @param {HTMLElement} container  element the canvas fills (give it a size with CSS)
 * @param {object} [options]
 * @param {'low'|'medium'|'high'} [options.quality]  default: auto-detect + adaptive resolution
 * @param {boolean} [options.autoStart=true]   run an internal render loop; false = call update()/render() yourself
 * @param {boolean} [options.controls=true]    orbit camera with mouse / touch
 * @param {boolean} [options.idleAutoRotate=true]  slow orbit after 30 s without input
 * @param {boolean} [options.blockout=false]   grey-box massing instead of the full scene
 * @param {boolean} [options.debug=false]      expose helpers on window.workshop
 */
export async function createWorkshop(container, options = {}) {
  const { autoStart = true, controls = true, idleAutoRotate = true, debug = false } = options;
  const quality = resolveQuality(options.quality);
  const renderer = createRenderer(container, quality);
  renderer.domElement.style.touchAction = 'none';
  const scene = createScene(renderer);
  const sky = createSky(scene);
  const rig = createCameraRig(renderer.domElement);
  rig.setEnabled(controls);
  rig.setIdleAutoRotate(idleAutoRotate);
  rig.resize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
  await nextFrame();

  let world;
  if (options.blockout || new URLSearchParams(location.search).has('blockout')) {
    world = buildBlockout(scene);
  } else {
    const { buildWorld } = await import('./app/world.js');
    world = await buildWorld(scene, quality);
  }

  const lights = createLights(scene, quality, world.anchors);
  const effects = world.panels ? createEffects(scene, renderer, rig.camera, quality, world) : null;
  const post = createPostPipeline(renderer, scene, rig.camera, quality);
  const machine = createMachineSlot(scene);
  const hooks = new Set();

  // Sizes come from the container, which can be 0×0 while the page loads hidden (background tab,
  // collapsed panel); the ResizeObserver catches the moment it gets real dimensions.
  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h);
    rig.resize(w, h);
    post.setSize(w, h);
    effects?.resize();
  };
  const adaptive = new AdaptiveResolution(quality, (pr) => {
    renderer.setPixelRatio(pr);
    resize();
  });
  window.addEventListener('resize', resize);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  renderer.compile(scene, rig.camera);
  // The sun and almost everything are static: the shadow map refreshes every other frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const clock = new THREE.Clock();
  let elapsed = 0;
  let frame = 0;
  let revealed = false;

  function update(dt = Math.min(clock.getDelta(), 0.05)) {
    elapsed += dt;
    if (frame++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
    rig.update(dt);
    world.update(dt, elapsed, rig.camera);
    lights.update(elapsed);
    effects?.update(dt, elapsed);
    sky.update(dt, elapsed);
    for (const fn of hooks) fn(dt, elapsed);
    adaptive.tick(dt);
  }

  function render() {
    post.render(0, elapsed);
    if (!revealed) {
      revealed = true;
      renderer.domElement.classList.add('ready');
    }
  }

  const start = () => {
    clock.getDelta();
    renderer.setAnimationLoop(() => {
      update();
      render();
    });
  };
  const stop = () => renderer.setAnimationLoop(null);
  if (autoStart) start();

  const box = new THREE.Box3();
  const api = {
    scene,
    camera: rig.camera,
    renderer,
    controls: rig.controls,
    quality,
    slot: MACHINE_SLOT,

    // ---- machine tool (one at a time, at the room centre)
    setMachine: (object, opts) => machine.setMachine(object, opts),
    clearMachine: (opts) => machine.clearMachine(opts),
    getMachine: () => machine.getMachine(),
    getMachineBounds: () => machine.getBounds(),
    /** Fly the camera to frame the current machine. */
    focusMachine(duration = 1.6) {
      const b = machine.getBounds(box);
      if (!b) return;
      const c = b.getCenter(new THREE.Vector3());
      const s = b.getSize(new THREE.Vector3());
      const radius = Math.max(s.x, s.y, s.z) * 0.5;
      const dist = Math.max(2.2, radius / Math.tan(THREE.MathUtils.degToRad(CAMERA.fov * 0.5)) * 1.15);
      const dir = CAMERA.position.clone().sub(CAMERA.target).setY(0).normalize();
      const pos = c.clone().addScaledVector(dir, dist).setY(Math.max(1.3, c.y + radius * 0.6));
      rig.flyTo(pos, c, duration);
    },

    // ---- camera
    flyTo: (position, target, duration) => rig.flyTo(position, target, duration),
    setView: (position, target) => rig.setView(position, target),
    resetView: (duration = 1.6) => rig.flyTo(CAMERA.position, CAMERA.target, duration),
    setControlsEnabled: (value) => rig.setEnabled(value),

    // ---- loop
    /** Register fn(dt, elapsed) called every update; returns an unsubscribe function. */
    onUpdate(fn) {
      hooks.add(fn);
      return () => hooks.delete(fn);
    },
    update,
    render,
    start,
    stop,
    resize,

    dispose() {
      stop();
      observer.disconnect();
      window.removeEventListener('resize', resize);
      rig.dispose();
      post.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (window.workshop === api) delete window.workshop;
    },
  };

  if (debug) {
    window.workshop = Object.assign(api, {
      look: (px, py, pz, tx, ty, tz) => rig.setView(new THREE.Vector3(px, py, pz), new THREE.Vector3(tx, ty, tz)),
      info: () => ({ ...renderer.info.render, programs: renderer.info.programs?.length, pixelRatio: renderer.getPixelRatio() }),
      assets: () => [...(world.factories?.keys() ?? [])],
      exportGLTF: (name) => exportObjectAsGLB(world.factories?.has(name) ? world.factories.get(name)() : scene.getObjectByName(name), name),
    });
  }
  return api;
}
