import { Group, Vector3, Quaternion } from 'three';
import {
  prepareMachine,
  disposeMachine,
  resetMachine,
  setAxis,
  setAxisAndWheel,
  turnControl,
  stepMachine,
  stepReturn,
  safetyStatus,
  setHighlight,
  setDetent, stepDetent, selectorRpm, indexTool, emergencyStop, releaseEmergency,
  toggleDemoWorkpiece, removeDemoWorkpiece,
} from '../runtime.js';

/**
 * MachineBase - Unified Lifecycle & Contract Base Class for all Machine Modules
 */
export class MachineBase {
  /**
   * @param {Object} options
   * @param {string} options.id - Machine identifier ('lathe' | 'milling' | 'drill')
   * @param {string} options.name - Human-readable name
   * @param {Object} options.config - Normalized machine configuration
   * @param {THREE.Group} options.scene - Loaded 3D model root
   */
  constructor({ id, name, config, scene }) {
    this.id = id;
    this.name = name;
    this.config = config;
    this.rootScene = scene;

    this.runtime = null;
    this.toolMount = null;
    this.workpieceMount = null;
    this.currentTool = null;
    this.currentWorkpiece = null;

    this.isActive = false;
    this.running = false;
    this.targetRpm = config.defaultRpm || 500;
    this.direction = 1;
    this.teaching = false;

    this.eventListeners = new Set();
    this.updateClockOwner = null;
    this.defaultTools = [];
  }

  /**
   * Initialize and prepare machine runtime structures and mount points.
   */
  async load() {
    this.runtime = prepareMachine(this.rootScene, this.config);
    this._setupMountPoints();
    this.defaultTools = (this.config.additions || [])
      .filter(def => def.kind === 'cuttingTool')
      .map(def => ({ id: def.name, type: def.tool, object: this.runtime.lookup[def.name], visible: this.runtime.lookup[def.name]?.visible }));
    this.isActive = true;
    return this;
  }

  /**
   * Internal helper to instantiate or locate ToolMount and WorkpieceMount.
   * Defined strictly by Machine Config.
   */
  _setupMountPoints() {
    const mounts = this.config.mounts || {};

    // 1. Tool Mount Point
    if (mounts.tool) {
      const parentNode = this.runtime.lookup[mounts.tool.parent] || this.runtime.pivots[mounts.tool.parent];
      if (!parentNode) {
        throw new Error(`[${this.id}] 找不到 ToolMount 指定的父節點：${mounts.tool.parent}`);
      }

      let mount = parentNode.getObjectByName('ToolMount');
      if (!mount) {
        mount = new Group();
        mount.name = 'ToolMount';
        mount.userData.isMountPoint = true;
        parentNode.add(mount);
      }

      if (mounts.tool.position) {
        mount.position.fromArray(mounts.tool.position);
      }
      if (mounts.tool.rotation) {
        mount.rotation.fromArray(mounts.tool.rotation);
      }
      if (mounts.tool.scale) {
        mount.scale.fromArray(mounts.tool.scale);
      }

      this.toolMount = mount;
      this.runtime.lookup['ToolMount'] = mount;
    }

    // 2. Workpiece Mount Point
    if (mounts.workpiece) {
      const parentNode = this.runtime.lookup[mounts.workpiece.parent] || this.runtime.pivots[mounts.workpiece.parent];
      if (!parentNode) {
        throw new Error(`[${this.id}] 找不到 WorkpieceMount 指定的父節點：${mounts.workpiece.parent}`);
      }

      let mount = parentNode.getObjectByName('WorkpieceMount');
      if (!mount) {
        mount = new Group();
        mount.name = 'WorkpieceMount';
        mount.userData.isMountPoint = true;
        parentNode.add(mount);
      }

      if (mounts.workpiece.position) {
        mount.position.fromArray(mounts.workpiece.position);
      }
      if (mounts.workpiece.rotation) {
        mount.rotation.fromArray(mounts.workpiece.rotation);
      }
      if (mounts.workpiece.scale) {
        mount.scale.fromArray(mounts.workpiece.scale);
      }

      this.workpieceMount = mount;
      this.runtime.lookup['WorkpieceMount'] = mount;
    }
  }

  /**
   * Root 3D object for adding into Three.js Scene.
   */
  get object3D() {
    return this.runtime?.scene || this.rootScene;
  }

  /**
   * Activate machine (e.g. enable user controls / interaction).
   */
  activate() {
    this.isActive = true;
  }

  /**
   * Deactivate machine.
   */
  deactivate() {
    this.isActive = false;
    this.stopSpindle();
  }

  /**
   * Reset all machine states, feeds, wheels, levers, and mounted objects.
   */
  reset() {
    this.running = false;
    this.direction = 1;
    this.targetRpm = this.config.defaultRpm || 500;
    if (this.runtime) {
      resetMachine(this.runtime);
    }
    if (this.currentTool) {
      this.currentTool.reset();
    }
    if (this.currentWorkpiece) {
      this.currentWorkpiece.reset();
    }
  }

  /**
   * Mount a modular cutting tool to the machine's ToolMount.
   * @param {import('../../tools/ToolBase.js').ToolBase} tool
   */
  async mountTool(tool) {
    if (!this.toolMount) {
      throw new Error(`機台 ${this.id} 尚未定義或建立 ToolMount 掛載點。`);
    }
    if (this.currentTool) {
      await this.unmountTool();
    }
    this.currentTool = tool;
    tool.mountedTo = this.toolMount;
    tool.object3D.position.set(0, 0, 0);
    tool.object3D.rotation.set(0, 0, 0);
    this.toolMount.add(tool.object3D);
    for (const entry of this.defaultTools) if (entry.object) entry.object.visible = false;
    this.rootScene.updateWorldMatrix(true, true);
    return true;
  }

  /**
   * Unmount currently mounted tool.
   */
  async unmountTool() {
    if (!this.currentTool) return null;
    const tool = this.currentTool;
    if (tool.object3D.parent) {
      tool.object3D.removeFromParent();
    }
    tool.mountedTo = null;
    this.currentTool = null;
    for (const entry of this.defaultTools) if (entry.object) entry.object.visible = entry.visible;
    this.rootScene.updateWorldMatrix(true, true);
    return tool;
  }

  /**
   * Mount a modular workpiece to the machine's WorkpieceMount.
   * @param {import('../../workpieces/WorkpieceBase.js').WorkpieceBase} workpiece
   */
  async mountWorkpiece(workpiece) {
    if (!this.workpieceMount) {
      throw new Error(`機台 ${this.id} 尚未定義或建立 WorkpieceMount 掛載點。`);
    }
    if (this.currentWorkpiece) {
      await this.unmountWorkpiece();
    }
    removeDemoWorkpiece(this.runtime);
    this.currentWorkpiece = workpiece;
    workpiece.mountedTo = this.workpieceMount;
    workpiece.object3D.position.set(0, 0, 0);
    workpiece.object3D.rotation.set(0, 0, 0);
    this.workpieceMount.add(workpiece.object3D);

    // Provide to runtime for safety boundary checks
    if (this.runtime) {
      this.runtime.workpiece = workpiece.object3D;
      this.runtime.workpieceOwner = 'module';
    }
    this.rootScene.updateWorldMatrix(true, true);
    return true;
  }

  /**
   * Unmount currently mounted workpiece.
   */
  async unmountWorkpiece() {
    if (!this.currentWorkpiece) return null;
    const workpiece = this.currentWorkpiece;
    if (workpiece.object3D.parent) {
      workpiece.object3D.removeFromParent();
    }
    workpiece.mountedTo = null;
    this.currentWorkpiece = null;
    if (this.runtime) {
      this.runtime.workpiece = null;
      this.runtime.workpieceOwner = null;
    }
    this.rootScene.updateWorldMatrix(true, true);
    return workpiece;
  }

  /**
   * Dispose machine resources, cleanup scene objects, materials and listeners.
   */
  dispose() {
    this.deactivate();

    if (this.currentTool) {
      this.currentTool.dispose();
      this.currentTool = null;
    }
    if (this.currentWorkpiece) {
      this.currentWorkpiece.dispose();
      this.currentWorkpiece = null;
    }

    if (this.runtime) {
      disposeMachine(this.runtime);
      this.runtime = null;
    }

    if (this.rootScene && this.rootScene.parent) {
      this.rootScene.removeFromParent();
    }

    this.eventListeners.clear();
    this.updateClockOwner = null;
    this.defaultTools = [];
    this.toolMount = null;
    this.workpieceMount = null;
  }

  /**
   * Alias for dispose() as requested by lifecycle specification.
   */
  unload() {
    this.dispose();
  }

  /**
   * Start Spindle rotation.
   * @param {number} [direction=1] - 1 (forward) or -1 (reverse)
   */
  startSpindle(direction = 1) {
    if (this.runtime?.emergency) return false;
    this.direction = direction === -1 ? -1 : 1;
    this.running = true;
    return true;
  }

  /**
   * Stop Spindle rotation.
   */
  stopSpindle() {
    this.running = false;
  }

  /**
   * Set Spindle RPM target.
   * @param {number} rpm
   */
  setSpindleRPM(rpm) {
    const max = this.config.maxRpm || 2000;
    this.targetRpm = Math.max(0, Math.min(max, Number(rpm) || 0));
  }

  /**
   * Per-frame animation / simulation step.
   * @param {number} dt
   */
  step(dt, { owner = null, heldControl = null } = {}) {
    if (this.updateClockOwner && owner !== this.updateClockOwner) throw new Error('Machine update clock is owned by a session');
    if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid simulation dt');
    if (!this.runtime) return false;
    if (heldControl) this.turnHandwheel(heldControl.key, heldControl.direction, dt);
    const returning = stepReturn(this.runtime, heldControl?.key, dt);
    stepMachine(this.runtime, this.running, this.targetRpm, dt, this.direction);
    return returning || !!heldControl || this.runtime.rpm > 0 || this.runtime.leverAngle !== 0 || this.running || this.runtime.brakeTime > 0;
  }

  // Additive v1 capabilities. Existing moveX/moveZ retain their original meaning.
  claimUpdateClock(owner) {
    if (!owner || this.updateClockOwner) throw new Error('Machine update clock already claimed');
    this.updateClockOwner = owner;
  }

  releaseUpdateClock(owner) {
    if (this.updateClockOwner === owner) this.updateClockOwner = null;
  }

  setAxisPosition(axisId, worldValue) {
    if (!this.runtime?.config.axes.some(axis => axis.id === axisId && axis.enabled)) throw new Error('Unsupported machine axis: ' + axisId);
    setAxisAndWheel(this.runtime, axisId, worldValue, this.teaching);
  }

  turnHandwheel(key, direction, dt) {
    if (this.runtime) turnControl(this.runtime, key, direction, dt, this.teaching);
  }

  setTeachingEnabled(value) {
    this.teaching = !!value;
    if (this.teaching && this.runtime) for (const axis of this.config.axes) this.setAxisPosition(axis.id, this.runtime.offsets[axis.id]);
  }

  setControlDetent(key, index) { if (this.runtime) setDetent(this.runtime, key, index); }
  stepControlDetent(key, direction) { if (this.runtime) stepDetent(this.runtime, key, direction); }
  indexToolPost(direction) { if (this.runtime) indexTool(this.runtime, direction); }
  emergencyBrake() { this.running = false; if (this.runtime) emergencyStop(this.runtime); }
  releaseEmergencyBrake() { if (this.runtime) releaseEmergency(this.runtime); }
  toggleDemoWorkpiece() { return !!this.runtime && toggleDemoWorkpiece(this.runtime, this.running); }

  getActiveCuttingTool() {
    if (this.currentTool) return this.currentTool.type === 'measuring' ? null : { id: this.currentTool.id, name: this.currentTool.name, type: this.currentTool.type, source: 'module' };
    const entry = this.defaultTools.find(tool => tool.object?.visible);
    return entry ? { id: entry.id, name: entry.id, type: entry.type, source: 'default' } : null;
  }

  /**
   * Get machine telemetry & state.
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      running: this.running,
      direction: this.direction,
      rpm: Math.round(this.runtime?.rpm || 0),
      targetRpm: this.targetRpm,
      effectiveTargetRpm: this.runtime ? selectorRpm(this.runtime) ?? this.targetRpm : this.targetRpm,
      spindleAvailable: !!this.runtime?.pivots[this.config.spindle.node],
      emergency: !!this.runtime?.emergency,
      leverAngle: this.runtime?.leverAngle || 0,
      activeCuttingTool: this.getActiveCuttingTool(),
      spindleAngle: this.runtime?.spindleAngle || 0,
      offsets: { ...(this.runtime?.offsets || {}) },
      angles: { ...(this.runtime?.angles || {}) },
      detents: { ...(this.runtime?.detents || {}) },
      tool: this.currentTool?.getState() || null,
      workpiece: this.currentWorkpiece?.getState() || null,
      safety: this.runtime ? safetyStatus(this.runtime) : { level: '', text: '' },
    };
  }
}
