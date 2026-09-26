// Example: the workshop as a game backdrop with one swappable machine tool at the centre.
//   1 / 2 / 3   placeholder lathe / drill press / mill
//   drag & drop a .glb/.gltf file onto the page to load your own machine
//   ?model=models/lathe.glb   load a model by URL on start
//   F focus the machine · R reset the view · C toggle orbit controls
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createWorkshop } from '../src/workshop.js';
import { placeholderLathe, placeholderDrillPress, placeholderMill } from './placeholderMachines.js';

const workshop = await createWorkshop(document.getElementById('app'), { idleAutoRotate: false, debug: true });

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);

async function loadMachine(url) {
  const gltf = await loader.loadAsync(url);
  const info = workshop.setMachine(gltf.scene, { disposePrevious: true });
  console.log('[example] machine size (m):', info.size.toArray().map((v) => v.toFixed(2)).join(' × '));
  workshop.focusMachine();
  // play the model's own animations, if any (spindle, chuck...)
  if (gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(gltf.scene);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    const off = workshop.onUpdate((dt) => mixer.update(dt));
    gltf.scene.userData.detach = off;
  }
}

function usePlaceholder(make) {
  workshop.getMachine()?.userData.detach?.();
  workshop.setMachine(make(), { disposePrevious: true });
  workshop.focusMachine();
}

const initial = new URLSearchParams(location.search).get('model');
if (initial) loadMachine(initial).catch((e) => console.error('[example] could not load', initial, e));
else usePlaceholder(placeholderLathe);

window.addEventListener('keydown', (e) => {
  if (e.key === '1') usePlaceholder(placeholderLathe);
  if (e.key === '2') usePlaceholder(placeholderDrillPress);
  if (e.key === '3') usePlaceholder(placeholderMill);
  if (e.key === 'f' || e.key === 'F') workshop.focusMachine();
  if (e.key === 'r' || e.key === 'R') workshop.resetView();
  if (e.key === 'c' || e.key === 'C') workshop.setControlsEnabled(!workshop.controls.enabled);
});

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  workshop.getMachine()?.userData.detach?.();
  const url = URL.createObjectURL(file);
  loadMachine(url).finally(() => URL.revokeObjectURL(url));
});

console.log('[example] 1/2/3 placeholders · drop a .glb to load your machine · F focus · R reset · C controls');
