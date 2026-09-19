import {
  Group,
  Mesh,
  CylinderGeometry,
  BoxGeometry,
  MeshStandardMaterial,
} from 'three';
import { WorkpieceBase } from './WorkpieceBase.js';

const MATERIAL_PRESETS = {
  aluminum: { color: '#cbd5e1', metalness: 0.75, roughness: 0.28 },
  steel: { color: '#94a3b8', metalness: 0.85, roughness: 0.35 },
  brass: { color: '#d4af37', metalness: 0.8, roughness: 0.3 },
  cast_iron: { color: '#64748b', metalness: 0.7, roughness: 0.5 },
};

export class WorkpieceLoader {
  /**
   * Create a 3D Workpiece instance from specifications.
   * @param {Object} spec
   * @param {string} [spec.id]
   * @param {string} [spec.name]
   * @param {'cylinder' | 'block'} spec.type
   * @param {number} [spec.diameter] - mm (if > 1) or meters
   * @param {number} [spec.length] - mm (if > 1) or meters
   * @param {number} [spec.width] - mm (if > 1) or meters
   * @param {number} [spec.height] - mm (if > 1) or meters
   * @param {string} [spec.material] - 'aluminum' | 'steel' | 'brass' | 'cast_iron'
   * @param {'x' | 'y' | 'z'} [spec.axis] - primary axial orientation (default 'x' for cylinder, 'y' for block)
   * @returns {WorkpieceBase}
   */
  static create(spec) {
    const group = new Group();
    const type = spec.type || 'cylinder';
    const matConfig = MATERIAL_PRESETS[spec.material] || MATERIAL_PRESETS.aluminum;
    const material = new MeshStandardMaterial({
      color: matConfig.color,
      metalness: matConfig.metalness,
      roughness: matConfig.roughness,
    });

    const toMeters = val => {
      if (val === undefined || val === null) return 0.1;
      return val > 1 ? val / 1000 : val;
    };

    let mesh;
    let dimensions = {};

    if (type === 'cylinder') {
      const diaM = toMeters(spec.diameter || 30);
      const lenM = toMeters(spec.length || 100);
      const radM = diaM / 2;

      dimensions = {
        diameter: spec.diameter || 30,
        length: spec.length || 100,
        radius: radM,
        lengthMeters: lenM,
      };

      const geom = new CylinderGeometry(radM, radM, lenM, 48);
      mesh = new Mesh(geom, material);
      mesh.name = 'WorkpieceCylinder';

      // Default cylinder axis: along X axis (pointing out of spindle chuck)
      const axis = spec.axis || 'x';
      if (axis === 'x') {
        mesh.rotation.z = -Math.PI / 2;
        mesh.position.x = lenM / 2;
      } else if (axis === 'z') {
        mesh.rotation.x = Math.PI / 2;
        mesh.position.z = lenM / 2;
      } else {
        mesh.position.y = lenM / 2;
      }
    } else {
      // Block
      const wM = toMeters(spec.width || 100);
      const hM = toMeters(spec.height || 40);
      const lM = toMeters(spec.length || 60);

      dimensions = {
        width: spec.width || 100,
        height: spec.height || 40,
        length: spec.length || 60,
        widthMeters: wM,
        heightMeters: hM,
        lengthMeters: lM,
      };

      const geom = new BoxGeometry(wM, hM, lM);
      mesh = new Mesh(geom, material);
      mesh.name = 'WorkpieceBlock';
      mesh.position.y = hM / 2;
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const id = spec.id || `${type}_${spec.diameter || spec.width}x${spec.length}`;
    const name = spec.name || (type === 'cylinder'
      ? `圓柱工件 Ø${dimensions.diameter}×${dimensions.length}mm`
      : `塊狀工件 ${dimensions.width}×${dimensions.height}×${dimensions.length}mm`);

    return new WorkpieceBase({
      id,
      name,
      type,
      dimensions,
      materialType: spec.material || 'aluminum',
      object3D: group,
    });
  }
}
