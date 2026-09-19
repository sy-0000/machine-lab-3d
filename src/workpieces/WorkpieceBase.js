import { Group } from 'three';

/**
 * Base class for all modular workpieces in the machining system.
 */
export class WorkpieceBase {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique ID or preset name
   * @param {string} options.name - Human-readable workpiece name
   * @param {'cylinder' | 'block'} options.type - Shape type
   * @param {Object} options.dimensions - Dimensions in mm / m
   * @param {string} [options.materialType] - 'aluminum' | 'steel' | 'brass'
   * @param {THREE.Object3D} [options.object3D] - 3D representation
   */
  constructor({ id, name, type, dimensions, materialType = 'aluminum', object3D = null }) {
    this.id = id;
    this.name = name || `${type}_${JSON.stringify(dimensions)}`;
    this.type = type;
    this.dimensions = dimensions;
    this.materialType = materialType;
    this.object3D = object3D || new Group();
    this.object3D.name = `Workpiece_${id}`;
    this.object3D.userData.workpieceId = id;
    this.object3D.userData.workpieceType = type;
    this.mountedTo = null;
  }

  /**
   * Telemetry / state of the workpiece.
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      materialType: this.materialType,
      dimensions: { ...this.dimensions },
      mounted: !!this.mountedTo,
      mountedTo: this.mountedTo?.name || null,
    };
  }

  /**
   * Reset local position / rotation.
   */
  reset() {
    this.object3D.position.set(0, 0, 0);
    this.object3D.rotation.set(0, 0, 0);
    this.object3D.scale.set(1, 1, 1);
  }

  /**
   * Dispose 3D geometries and materials.
   */
  dispose() {
    if (this.object3D.parent) {
      this.object3D.removeFromParent();
    }
    this.object3D.traverse(child => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => m.dispose());
        }
      }
    });
    this.mountedTo = null;
  }
}
