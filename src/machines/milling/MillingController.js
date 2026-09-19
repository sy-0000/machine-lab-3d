import { MachineBase } from '../core/MachineBase.js';
import { MILLING_CONFIG } from './milling.config.js';
import { setAxisAndWheel } from '../runtime.js';

export class MillingController extends MachineBase {
  constructor({ scene, config = MILLING_CONFIG }) {
    super({
      id: 'milling',
      name: config.name || '銑床',
      config,
      scene,
    });
    this.xZeroOffset = 0;
    this.yZeroOffset = 0;
    this.zZeroOffset = 0;
  }

  /**
   * Move Worktable along X axis.
   * @param {number} delta - distance in meters
   */
  moveX(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.X_Axis_Table || 0;
    setAxisAndWheel(this.runtime, 'X_Axis_Table', current + delta, this.teaching);
  }

  /**
   * Set absolute X position.
   * @param {number} value
   */
  setX(value) {
    if (!this.runtime) return;
    setAxisAndWheel(this.runtime, 'X_Axis_Table', value, this.teaching);
  }

  /**
   * Zero X axis DRO readout.
   */
  zeroX() {
    if (!this.runtime) return;
    this.xZeroOffset = this.runtime.offsets.X_Axis_Table || 0;
  }

  /**
   * Move Saddle along Y axis.
   * @param {number} delta - distance in meters
   */
  moveY(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.Y_Axis_Saddle || 0;
    setAxisAndWheel(this.runtime, 'Y_Axis_Saddle', current + delta, this.teaching);
  }

  /**
   * Set absolute Y position.
   * @param {number} value
   */
  setY(value) {
    if (!this.runtime) return;
    setAxisAndWheel(this.runtime, 'Y_Axis_Saddle', value, this.teaching);
  }

  /**
   * Zero Y axis DRO readout.
   */
  zeroY() {
    if (!this.runtime) return;
    this.yZeroOffset = this.runtime.offsets.Y_Axis_Saddle || 0;
  }

  /**
   * Move Knee / Table along Z axis (vertical elevation).
   * @param {number} delta - distance in meters
   */
  moveZ(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.Knee_Z_Slide || 0;
    setAxisAndWheel(this.runtime, 'Knee_Z_Slide', current + delta, this.teaching);
  }

  /**
   * Set absolute Z position.
   * @param {number} value
   */
  setZ(value) {
    if (!this.runtime) return;
    setAxisAndWheel(this.runtime, 'Knee_Z_Slide', value, this.teaching);
  }

  /**
   * Zero Z axis DRO readout.
   */
  zeroZ() {
    if (!this.runtime) return;
    this.zZeroOffset = this.runtime.offsets.Knee_Z_Slide || 0;
  }

  /**
   * Extended state with 3-axis DRO readout.
   */
  getState() {
    const base = super.getState();
    return {
      ...base,
      dro: {
        x: (base.offsets.X_Axis_Table || 0) - this.xZeroOffset,
        y: (base.offsets.Y_Axis_Saddle || 0) - this.yZeroOffset,
        z: (base.offsets.Knee_Z_Slide || 0) - this.zZeroOffset,
      },
    };
  }
}

export default MillingController;
