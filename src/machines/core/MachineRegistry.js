import { MachineLoader } from './MachineLoader.js';
import { LatheController } from '../lathe/LatheController.js';
import { LATHE_CONFIG } from '../lathe/lathe.config.js';
import { MillingController } from '../milling/MillingController.js';
import { MILLING_CONFIG } from '../milling/milling.config.js';
import { DrillController } from '../drill/DrillController.js';
import { DRILL_CONFIG } from '../drill/drill.config.js';

class MachineRegistryImpl {
  constructor() {
    this.registry = new Map();
    this.currentMachine = null;

    // Register built-in machines
    this.register('lathe', {
      Controller: LatheController,
      config: LATHE_CONFIG,
    });
    this.register('milling', {
      Controller: MillingController,
      config: MILLING_CONFIG,
    });
    this.register('drill', {
      Controller: DrillController,
      config: DRILL_CONFIG,
    });
  }

  /**
   * Register a machine module.
   * @param {string} id
   * @param {Object} definition
   * @param {typeof import('./MachineBase.js').MachineBase} definition.Controller
   * @param {Object} definition.config
   */
  register(id, { Controller, config }) {
    this.registry.set(id, { Controller, config });
  }

  /**
   * Check if a machine ID is registered.
   * @param {string} id
   */
  has(id) {
    return this.registry.has(id);
  }

  /**
   * Get metadata configuration for a machine.
   * @param {string} id
   */
  getConfig(id) {
    return this.registry.get(id)?.config || null;
  }

  /**
   * List all registered machines.
   */
  getAvailableMachines() {
    return [...this.registry.entries()].map(([id, entry]) => ({
      id,
      ...entry.config,
    }));
  }

  /**
   * Get currently active machine instance.
   */
  getCurrentMachine() {
    return this.currentMachine;
  }

  /**
   * Unload and dispose the current machine.
   * Cleans up scene nodes, materials, geometries, and event listeners.
   */
  async unload() {
    if (this.currentMachine) {
      this.currentMachine.dispose();
      this.currentMachine = null;
    }
  }

  /**
   * Load a machine by its registered ID.
   * Automatically unloads any currently active machine first to prevent memory leaks.
   *
   * @param {string} id - 'lathe' | 'milling' | 'drill'
   * @param {Object} [options]
   * @param {Function} [options.onProgress]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<import('./MachineBase.js').MachineBase>}
   */
  async load(id, options = {}) {
    const entry = this.registry.get(id);
    if (!entry) {
      throw new Error(`未註冊的機器類型：${id}。可用機器：${[...this.registry.keys()].join(', ')}`);
    }

    // Safely unload existing machine to guarantee zero node or listener residue
    if (this.currentMachine) {
      await this.unload();
    }

    const { Controller, config } = entry;
    const { scene, config: normalizedConfig } = await MachineLoader.load(config, options);

    const machineInstance = new Controller({
      scene,
      config: normalizedConfig,
    });

    await machineInstance.load();
    this.currentMachine = machineInstance;
    return machineInstance;
  }
}

export const MachineRegistry = new MachineRegistryImpl();
export default MachineRegistry;
