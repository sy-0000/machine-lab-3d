import { LATHE_MACHINING } from './latheMachining.config.js';
import { validateHeadState } from './HeadWorkpieceState.js';
// Versioned machining data only: no Three.js nodes, metre values, dates or random IDs.
export const HANDLE_STOCK = Object.freeze({ radiusMm: 10, lengthMm: 300, resolutionMm: 0.5 });
export function createHandleState() {
  return { version: 2, id: 'hammer-handle', kind: 'revolved', units: 'mm', axis: 'Z',
    stock: { radiusMm: HANDLE_STOCK.radiusMm, lengthMm: HANDLE_STOCK.lengthMm },
    lengthMm: HANDLE_STOCK.lengthMm,
    clamping: { ...LATHE_MACHINING.clamping },
    profile: { resolutionMm: HANDLE_STOCK.resolutionMm,
      radiusMm: Array(HANDLE_STOCK.lengthMm / HANDLE_STOCK.resolutionMm).fill(HANDLE_STOCK.radiusMm) },
    surfaceMarks: [], features: [], operationHistory: [] };
}
function jsonData(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  seen.add(value);
  const values = Array.isArray(value) ? Array.from(value) : Object.values(value);
  const valid = values.every(item => jsonData(item, seen));
  seen.delete(value); return valid;
}
export function validateWorkpieceState(s) {
  if(s?.kind==='prismatic')return validateHeadState(s);
  // Read old local saves without discarding their geometry or history.
  if (s?.version === 1) {
    const { actualLengthMm, ...legacy } = s;
    s = { ...legacy, version: 2, lengthMm: actualLengthMm, clamping: { ...LATHE_MACHINING.clamping } };
  }
  const positive = n => Number.isFinite(n) && n > 0;
  if (!s || s.version !== 2 || s.kind !== 'revolved' || s.units !== 'mm' || s.axis !== 'Z' ||
      typeof s.id !== 'string' || !s.id || !positive(s.stock?.radiusMm) || !positive(s.stock?.lengthMm) ||
      !positive(s.lengthMm) || s.lengthMm > s.stock.lengthMm ||
      !s.clamping || s.clamping.startZMm !== 0 || !positive(s.clamping.endZMm) ||
      s.clamping.endZMm >= s.lengthMm ||
      !positive(s.profile?.resolutionMm) || !Array.isArray(s.profile.radiusMm) ||
      s.profile.radiusMm.length > 10000 ||
      s.profile.radiusMm.length !== Math.ceil(s.lengthMm / s.profile.resolutionMm) ||
      !s.profile.radiusMm.every(r => Number.isFinite(r) && r >= 0 && r <= s.stock.radiusMm) ||
      !['surfaceMarks', 'features', 'operationHistory'].every(key => Array.isArray(s[key])) || !jsonData(s)) {
    throw new Error('Invalid or unsupported WorkpieceState');
  }
  return s;
}
export function cloneWorkpieceState(state) {
  return JSON.parse(JSON.stringify(validateWorkpieceState(state)));
}
