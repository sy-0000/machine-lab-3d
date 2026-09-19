import { MachineBase } from '../core/MachineBase.js';
import { DRILL_CONFIG } from './drill.config.js';
import { setAxisAndWheel, setAxis } from '../runtime.js';

export class DrillController extends MachineBase {
  constructor({ scene, config = DRILL_CONFIG }) {
    super({
      id: 'drill',
      name: config.name || '鑽床',
      config,
      scene,
    });
    this.quillZeroOffset = 0;
  }

  /**
   * Feed Quill / Spindle vertically.
   * @param {number} delta - distance in meters (negative moves down into workpiece)
   */
  feedSpindle(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.quill || 0;
    setAxisAndWheel(this.runtime, 'quill', current + delta, this.teaching);
  }

  /**
   * Set absolute Quill vertical position.
   * @param {number} value - coordinate in meters
   */
  setQuill(value) {
    if (!this.runtime) return;
    setAxisAndWheel(this.runtime, 'quill', value, this.teaching);
  }

  /**
   * Zero Quill DRO readout.
   */
  zeroQuill() {
    if (!this.runtime) return;
    this.quillZeroOffset = this.runtime.offsets.quill || 0;
  }

  /**
   * Adjust Worktable height position.
   * @param {number} delta - distance in meters
   */
  moveTable(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.table || 0;
    setAxis(this.runtime, 'table', current + delta);
  }

  /**
   * Set absolute Worktable height position.
   * @param {number} value - coordinate in meters
   */
  setTable(value) {
    if (!this.runtime) return;
    setAxis(this.runtime, 'table', value);
  }

  /**
   * Extended state with Quill depth DRO.
   */
  getState() {
    const base = super.getState();
    return {
      ...base,
      dro: {
        quillDepth: Math.abs((base.offsets.quill || 0) - this.quillZeroOffset),
        tableHeight: base.offsets.table || 0,
      },
    };
  }
}

export default DrillController;
