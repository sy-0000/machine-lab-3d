import { createHandleState } from './WorkpieceState.js';
import { WorkpieceStore } from './WorkpieceStore.js';
import { MachineV1Adapter } from './adapters/MachineV1Adapter.js';

/** High-level commands use mm. No animation loop, React, or Three.js objects here. */
export class MachineSession {
  #adapter;
  #workpieceStore;
  #inputs = new Set();
  #listeners = new Set();
  #lock = null;
  #generation = 0;
  #held = null;
  #busy = false;
  #disposed = false;
  #clock = null;
  #lastFrame = -1;
  #updateCount = 0;
  #elapsedSeconds = 0;
  constructor(machine, options) {
    this.#adapter = new MachineV1Adapter(machine, options);
    this.#workpieceStore = options?.workpieceStore || new WorkpieceStore();
    this.player = this.createInput('player');
  }
  createInput(label) {
    if (this.#disposed) throw new Error('Session disposed');
    const input = Object.freeze({ label: String(label) });
    this.#inputs.add(input); return input;
  }
  canCommand(input = this.player) {
    return !this.#disposed && this.#adapter.available && this.#inputs.has(input) && (!this.#lock || this.#lock.owner === input);
  }
  subscribe(listener) { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
  #notify() { for (const listener of this.#listeners) listener(); }
  lockInput(owner = null) {
    if (this.#disposed || this.#lock) throw new Error('Input lock unavailable');
    if (owner !== null && !this.#inputs.has(owner)) throw new Error('Unknown input owner');
    const lease = Object.freeze({});
    this.#lock = { owner, lease }; this.#generation++; this.#held = null;
    this.#adapter.stop(); this.#notify(); return lease;
  }
  unlockInput(lease) {
    if (!this.#lock || lease !== this.#lock.lease) return false;
    this.#lock = null; this.#generation++; this.#held = null;
    this.#adapter.stop(); this.#notify(); return true;
  }
  getState() {
    if (this.#disposed || !this.#adapter.available) return { disposed: true, units: 'mm' };
    return { ...this.#adapter.getState(), disposed: false, busy: this.#busy,
      inputLock: this.#lock ? { owner: this.#lock.owner?.label || null } : null,
      heldControl: this.#held ? { key: this.#held.key, direction: this.#held.direction, source: this.#held.input.label } : null,
      updateCount: this.#updateCount, elapsedSeconds: this.#elapsedSeconds };
  }
  exportWorkpieceState() { return this.#adapter.exportWorkpieceState(); }
  /** Rejections are results, not silent mutations. Async asset commands resolve to the same shape. */
  command(command, input = this.player) {
    if (!this.canCommand(input)) return { ok: false, reason: 'input-locked-or-unavailable' };
    if (this.#busy) return { ok: false, reason: 'asset-command-pending' };
    try {
      switch (command.type) {
        case 'spindle.start': this.#adapter.start(command.direction ?? 1); break;
        case 'spindle.stop': this.#adapter.stop(); break;
        case 'spindle.speed': this.#adapter.setSpeed(command.rpm); break;
        case 'spindle.toggle': {
          const state = this.#adapter.getState(), direction = command.direction ?? 1;
          if (state.running && state.direction === direction) this.#adapter.stop(); else this.#adapter.start(direction);
          break;
        }
        case 'axis.move': this.#adapter.moveAxis(command); break;
        case 'workOffset.set': this.#adapter.setReadout(command); break;
        case 'workOffset.zero': this.#adapter.setReadout({ ...command, valueMm: 0 }); break;
        // Physical machine-axis identifiers are only for the unchanged v1 classroom controls.
        case 'machineAxis.set': this.#adapter.setMachineAxisMm(command.axisId, command.valueMm); break;
        case 'machineAxis.jog': {
          const actual = this.#adapter.getState().machineAxesMm[command.axisId];
          if (!Number.isFinite(command.deltaMm)) throw new Error('Invalid jog delta');
          this.#adapter.setMachineAxisMm(command.axisId, actual + command.deltaMm); break;
        }
        case 'wheel.hold':
          this.#adapter.validateWheel(command.key, command.direction);
          this.#held = { key: command.key, direction: command.direction, input }; break;
        case 'wheel.release': if (this.#held?.input === input) this.#held = null; break;
        case 'machine.reset': this.#held = null; this.#adapter.reset(); break;
        case 'tool.select': return this.#assetCommand(input, current => this.#adapter.selectTool(command.toolId, current));
        case 'workpiece.createHandle': return this.#assetCommand(input, current => this.#adapter.mountWorkpieceState(createHandleState(), current));
        case 'workpiece.mountState': return this.#assetCommand(input, current => this.#adapter.mountWorkpieceState(command.state, current));
        case 'workpiece.save': this.#workpieceStore.save(this.exportWorkpieceState()); break;
        case 'workpiece.load': return this.#assetCommand(input, current => this.#adapter.mountWorkpieceState(this.#workpieceStore.load(), current));
        case 'workpiece.mount': return this.#assetCommand(input, current => this.#adapter.mountWorkpiece(command.spec, current));
        case 'workpiece.unmount': return this.#assetCommand(input, current => this.#adapter.unmountWorkpiece(current));
        default:
          if (command.type === 'spindle.brake' || command.type === 'teaching.set') this.#held = null;
          this.#adapter.control(command.type, command);
      }
      this.#notify(); return { ok: true };
    } catch (error) { return { ok: false, reason: error.message }; }
  }
  async #assetCommand(input, operation) {
    this.#busy = true; this.#held = null;
    const generation = this.#generation;
    this.#notify();
    try {
      const done = await operation(() => generation === this.#generation && this.canCommand(input));
      return done ? { ok: true } : { ok: false, reason: 'cancelled' };
    } catch (error) { return { ok: false, reason: error.message }; }
    finally { this.#busy = false; this.#notify(); }
  }
  /** The host supplies time; exactly one host may drive a session. Frame IDs are monotonic. */
  claimClock() {
    if (this.#disposed || this.#clock) throw new Error('Session clock already claimed or disposed');
    this.#clock = Object.freeze({}); this.#lastFrame = -1; return this.#clock;
  }
  releaseClock(clock) { if (clock === this.#clock) this.#clock = null; }
  update(dt, { clock, frameId } = {}) {
    if (this.#disposed || !this.#adapter.available) return { advanced: false, active: false };
    if (!clock || clock !== this.#clock) throw new Error('Only the session clock owner may update');
    if (!Number.isFinite(dt) || dt < 0 || !Number.isSafeInteger(frameId) || frameId < 0) throw new Error('Invalid dt or frame ID');
    if (frameId <= this.#lastFrame) return { advanced: false, active: false };
    this.#lastFrame = frameId;
    if (this.#held && !this.canCommand(this.#held.input)) this.#held = null;
    const active = this.#adapter.step(dt, this.#held);
    this.#updateCount++; this.#elapsedSeconds += dt;
    return { advanced: true, active };
  }
  dispose() {
    if (this.#disposed) return;
    this.#generation++; this.#held = null; this.#clock = null;
    this.#adapter.dispose(); this.#disposed = true; this.#notify(); this.#listeners.clear();
  }
}
