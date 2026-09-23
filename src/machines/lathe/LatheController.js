import { MachineBase } from '../core/MachineBase.js';
import { LATHE_CONFIG } from './lathe.config.js';
import {
  setAxisAndWheel,
  indexTool,
  setDetent,
  emergencyStop,
  releaseEmergency,
  clamp,
} from '../runtime.js';

export class LatheController extends MachineBase {
  constructor({ scene, config = LATHE_CONFIG }) {
    super({
      id: 'lathe',
      name: config.name || '車床',
      config,
      scene,
    });
    this.xZeroOffset = 0;
    this.zZeroOffset = 0;
  }

  /**
   * Move Longitudinal Carriage (X axis on lathe schema).
   * @param {number} delta - distance in meters
   */
  moveX(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.x || 0;
    setAxisAndWheel(this.runtime, 'x', current + delta, this.teaching);
  }

  /**
   * Set absolute X position.
   * @param {number} value - coordinate in meters
   */
  setX(value) {
    if (!this.runtime) return;
    setAxisAndWheel(this.runtime, 'x', value, this.teaching);
  }

  /**
   * Zero the X coordinate readout.
   */
  zeroX() {
    if (!this.runtime) return;
    this.xZeroOffset = this.runtime.offsets.x || 0;
  }

  /**
   * Legacy Z: tool height (runtime z), NOT the teaching radial X axis.
   * @param {number} delta - distance in meters
   */
  moveZ(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.z || 0;
    setAxisAndWheel(this.runtime, 'z', current + delta, this.teaching);
  }

  /**
   * Set absolute Z position.
   * @param {number} value - coordinate in meters
   */
  setZ(value) {
    if (!this.runtime) return;
    setAxisAndWheel(this.runtime, 'z', value, this.teaching);
  }

  /**
   * Zero the Z coordinate readout.
   */
  zeroZ() {
    if (!this.runtime) return;
    this.zZeroOffset = this.runtime.offsets.z || 0;
  }

  /**
   * Move Tailstock assembly along the bed.
   * @param {number} delta
   */
  moveTailstock(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.tail || 0;
    setAxisAndWheel(this.runtime, 'tail', current + delta, this.teaching);
  }

  /**
   * Feed Tailstock quill.
   * @param {number} delta
   */
  feedTailQuill(delta) {
    if (!this.runtime) return;
    const current = this.runtime.offsets.quill || 0;
    setAxisAndWheel(this.runtime, 'quill', current + delta, this.teaching);
  }

  /**
   * Rotate or index the tool post.
   * @param {number} [direction=1] - 1 for clockwise (+10°), -1 for counterclockwise (-10°)
   */
  indexToolPost(direction = 1) {
    if (!this.runtime) return;
    indexTool(this.runtime, direction);
  }

  /**
   * Set tool post rotation in degrees (multiples of 10°).
   * @param {number} degrees
   */
  rotateToolPost(degrees) {
    if (!this.runtime) return;
    const targetSteps = Math.round(degrees / 10);
    const deltaSteps = targetSteps - (this.runtime.indexSteps || 0);
    const dir = deltaSteps >= 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(deltaSteps); i++) {
      indexTool(this.runtime, dir);
    }
  }

  /**
   * Set gearbox speed range / detent mode.
   * @param {number} range - detent index (0-3 for gearSelector)
   */
  setSpeedRange(range) {
    if (!this.runtime) return;
    setDetent(this.runtime, 'gearSelector', range);
  }

  /**
   * Trigger emergency foot brake.
   */
  emergencyBrake() {
    if (!this.runtime) return;
    this.running = false;
    emergencyStop(this.runtime);
  }

  /**
   * Release emergency brake.
   */
  releaseEmergencyBrake() {
    if (!this.runtime) return;
    releaseEmergency(this.runtime);
  }

  /**
   * Extended state with DRO relative coordinates.
   */
  getState() {
    const base = super.getState();
    return {
      ...base,
      dro: {
        x: (base.offsets.x || 0) - this.xZeroOffset,
        z: (base.offsets.z || 0) - this.zZeroOffset,
        toolPostAngle: (this.runtime?.indexSteps || 0) * 10,
      },
    };
  }
}

export default LatheController;
