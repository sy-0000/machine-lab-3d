import { WorkpieceLoader } from './WorkpieceLoader.js';

const WORKPIECE_PRESETS = {
  cylinder_30x100: {
    id: 'cylinder_30x100',
    name: '標準鋁合金圓棒 Ø30×100mm',
    type: 'cylinder',
    diameter: 30,
    length: 100,
    material: 'aluminum',
    axis: 'x',
  },
  cylinder_50x150: {
    id: 'cylinder_50x150',
    name: '中碳鋼圓棒 Ø50×150mm',
    type: 'cylinder',
    diameter: 50,
    length: 150,
    material: 'steel',
    axis: 'x',
  },
  cylinder_26x180: {
    id: 'cylinder_26x180',
    name: '車床示範圓棒 Ø52×180mm',
    type: 'cylinder',
    diameter: 52,
    length: 180,
    material: 'aluminum',
    axis: 'x',
  },
  block_100x60x40: {
    id: 'block_100x60x40',
    name: '鋁合金銑削方塊 100×40×60mm',
    type: 'block',
    width: 100,
    height: 40,
    length: 60,
    material: 'aluminum',
  },
  block_120x80x50: {
    id: 'block_120x80x50',
    name: '中碳鋼工件方塊 120×50×80mm',
    type: 'block',
    width: 120,
    height: 50,
    length: 80,
    material: 'steel',
  },
};

class WorkpieceRegistryImpl {
  constructor() {
    this.presets = new Map();
    for (const [id, def] of Object.entries(WORKPIECE_PRESETS)) {
      this.presets.set(id, def);
    }
  }

  /**
   * Register a custom workpiece preset.
   * @param {string} id
   * @param {Object} spec
   */
  register(id, spec) {
    this.presets.set(id, { id, ...spec });
  }

  /**
   * Load or create a workpiece.
   * Can pass either a preset ID (string) or an ad-hoc spec (object).
   * @param {string | Object} idOrSpec
   * @returns {Promise<import('./WorkpieceBase.js').WorkpieceBase>}
   */
  async load(idOrSpec) {
    if (typeof idOrSpec === 'string') {
      const preset = this.presets.get(idOrSpec);
      if (!preset) {
        throw new Error(`找不到工件預設：${idOrSpec}。可用預設：${[...this.presets.keys()].join(', ')}`);
      }
      return WorkpieceLoader.create(preset);
    }
    if (typeof idOrSpec === 'object' && idOrSpec !== null) {
      return WorkpieceLoader.create(idOrSpec);
    }
    throw new Error(`無效的工件參數：${idOrSpec}`);
  }

  /**
   * Directly create a workpiece from a spec.
   * @param {Object} spec
   */
  create(spec) {
    return WorkpieceLoader.create(spec);
  }

  /**
   * Get all registered presets.
   */
  getAvailablePresets() {
    return [...this.presets.values()];
  }
}

export const WorkpieceRegistry = new WorkpieceRegistryImpl();
export default WorkpieceRegistry;
