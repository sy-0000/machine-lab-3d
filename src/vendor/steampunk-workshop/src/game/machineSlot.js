// Holds exactly one machine tool (lathe, drill press, milling machine...) at the empty centre of
// the workshop. setMachine() swaps it: the model is scaled down if it is too big for the slot,
// stood on the floor, centred, turned toward the default camera and set to cast shadows.
import * as THREE from 'three';
import { MACHINE_SLOT } from '../config/layout.js';

function disposeObject(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

export function createMachineSlot(scene, slotConfig = MACHINE_SLOT) {
  const slot = new THREE.Group();
  slot.name = 'MachineSlot';
  slot.position.copy(slotConfig.position);
  scene.add(slot);
  let current = null;
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  function clearMachine({ dispose = false } = {}) {
    if (!current) return;
    slot.remove(current.holder);
    if (dispose) disposeObject(current.object);
    current = null;
  }

  /**
   * @param {THREE.Object3D} object  model in metres, Y up (e.g. gltf.scene)
   * @param {object} [opts]
   * @param {number} [opts.scale=1]          extra uniform scale applied first (e.g. 0.001 for mm models)
   * @param {number} [opts.rotationY]        radians; default faces the default camera
   * @param {boolean|'always'} [opts.fit=true]  shrink to fit the slot; 'always' also enlarges; false = keep size
   * @param {boolean} [opts.shadows=true]    cast / receive shadows
   * @param {boolean} [opts.disposePrevious=false]  free GPU memory of the machine being replaced
   * @returns {{ object, holder, size: THREE.Vector3 }}
   */
  function setMachine(object, opts = {}) {
    clearMachine({ dispose: opts.disposePrevious });
    if (!object) return null;
    const holder = new THREE.Group();
    holder.name = 'MachineHolder';
    holder.add(object);
    if (opts.scale) object.scale.multiplyScalar(opts.scale);

    holder.updateMatrixWorld(true);
    box.setFromObject(object);
    box.getSize(size);
    const fit = opts.fit ?? true;
    if (fit && size.x > 0 && size.y > 0 && size.z > 0) {
      const s = Math.min(slotConfig.maxFootprint / Math.max(size.x, size.z), slotConfig.maxHeight / size.y);
      if (s < 1 || fit === 'always') {
        object.scale.multiplyScalar(s);
        holder.updateMatrixWorld(true);
        box.setFromObject(object);
        box.getSize(size);
      }
    }
    box.getCenter(center);
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= box.min.y;
    holder.rotation.y = opts.rotationY ?? slotConfig.rotationY;

    const shadows = opts.shadows ?? true;
    object.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = shadows;
      o.receiveShadow = shadows;
    });
    slot.add(holder);
    holder.updateMatrixWorld(true);
    current = { object, holder };
    return { object, holder, size: size.clone() };
  }

  function getMachine() {
    return current?.object ?? null;
  }

  // World-space bounds of the current machine (or null).
  function getBounds(target = new THREE.Box3()) {
    if (!current) return null;
    current.holder.updateMatrixWorld(true);
    return target.setFromObject(current.object);
  }

  return { group: slot, setMachine, clearMachine, getMachine, getBounds };
}
