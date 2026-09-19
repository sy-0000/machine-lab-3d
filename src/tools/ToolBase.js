import { Group } from 'three';

/**
 * Base class for all modular machining cutting tools.
 */
export class ToolBase {
  /**
   * @param {Object} options
   * @param {string} options.id - Unique tool ID (e.g. 'turning_tool')
   * @param {string} options.name - Human-readable tool name
   * @param {string} options.type - Tool category ('turning' | 'threading' | 'knurling' | 'milling' | 'drilling' | 'measuring')
   * @param {THREE.Object3D} [options.object3D] - Root 3D node
   * @param {Object} [options.dimensions] - Dimensional specs
   * @param {Object} [options.metadata] - Extra properties (feed rate guidelines, operations)
   */
  constructor({ id, name, type, object3D = null, dimensions = {}, metadata = {} }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.object3D = object3D || new Group();
    this.object3D.name = `Tool_${id}`;
    this.object3D.userData.toolId = id;
    this.object3D.userData.toolType = type;
    this.dimensions = dimensions;
    this.metadata = metadata;
    this.mountedTo = null;
  }

  /**
   * Get telemetry / state of the tool.
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      mounted: !!this.mountedTo,
      mountedTo: this.mountedTo?.name || null,
      dimensions: { ...this.dimensions },
    };
  }

  /**
   * Reset tool local position / rotation.
   */
  reset() {
    this.object3D.position.set(0, 0, 0);
    this.object3D.rotation.set(0, 0, 0);
    this.object3D.scale.set(1, 1, 1);
  }

  /**
   * Dispose 3D resources and detach from parent.
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
