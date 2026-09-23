import { cloneWorkpieceState } from './WorkpieceState.js';
export const WORKPIECE_SAVE_KEY = 'machine-lab.machining.handle.v1';
// One explicit local save, separate from prototype/lesson progress. Storage is injectable for tests.
export class WorkpieceStore {
  constructor(storage) { this.storage = storage; }
  #storage() {
    const storage = this.storage ?? globalThis.localStorage;
    if (!storage) throw new Error('Local workpiece storage is unavailable');
    return storage;
  }
  save(state) {
    const snapshot = cloneWorkpieceState(state);
    this.#storage().setItem(WORKPIECE_SAVE_KEY, JSON.stringify(snapshot));
  }
  load() {
    const text = this.#storage().getItem(WORKPIECE_SAVE_KEY);
    if (text === null) throw new Error('No saved handle workpiece');
    return cloneWorkpieceState(JSON.parse(text));
  }
}
