import { TOOL_DEFINITIONS } from './tool.config.js';
import { ToolLoader } from './ToolLoader.js';

class ToolRegistryImpl {
  constructor() {
    this.definitions = new Map();
    // Pre-populate with standard tools
    for (const [id, def] of Object.entries(TOOL_DEFINITIONS)) {
      this.definitions.set(id, def);
    }
  }

  /**
   * Register a new tool definition.
   * @param {string} id
   * @param {Object} definition
   */
  register(id, definition) {
    this.definitions.set(id, { id, ...definition });
  }

  /**
   * Get tool definition without loading.
   * @param {string} id
   */
  get(id) {
    return this.definitions.get(id) || null;
  }

  /**
   * Load a tool by its ID.
   * @param {string} id
   * @returns {Promise<import('./ToolBase.js').ToolBase>}
   */
  async load(id) {
    const def = this.definitions.get(id);
    if (!def) {
      throw new Error(`找不到刀具註冊資料：${id}。可用刀具：${[...this.definitions.keys()].join(', ')}`);
    }
    return ToolLoader.load(def);
  }

  /**
   * List all registered tools.
   */
  getAvailableTools() {
    return [...this.definitions.values()];
  }

  /**
   * Get tools compatible with a specific machine.
   * @param {'lathe' | 'milling' | 'drill'} machineId
   */
  getToolsForMachine(machineId) {
    return [...this.definitions.values()].filter(
      t => !t.compatibleMachines || t.compatibleMachines.includes(machineId)
    );
  }
}

export const ToolRegistry = new ToolRegistryImpl();
export default ToolRegistry;
