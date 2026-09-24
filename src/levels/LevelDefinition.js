import { cloneWorkpieceState } from '../machining/WorkpieceState.js';

export const targetFields=['diameterMm','diameterToleranceMm','machiningZRange','finalLengthMm','lengthToleranceMm'];
export const isConfirmedTarget=(t,key)=>t[key]!==null&&(t.confirmation?.[key]??t.status)==='confirmed';

export function validateTargets(t, stock) {
  const positive=n=>Number.isFinite(n)&&n>0;
  const tolerance=n=>Number.isFinite(n)&&n>=0;
  const range=t?.machiningZRange;
  if(t?.confirmation && (Object.keys(t.confirmation).some(k=>!targetFields.includes(k)) ||
    targetFields.some(k=>!['confirmed','draft','unknown'].includes(t.confirmation[k]) ||
      (t.confirmation[k]==='confirmed'&&t[k]===null)))) throw new Error('Invalid target confirmation');
  if(!t || !['draft','confirmed'].includes(t.status) ||
    !(t.diameterMm===null||positive(t.diameterMm)) ||
    !(t.finalLengthMm===null||positive(t.finalLengthMm)) ||
    !(t.diameterToleranceMm===null||tolerance(t.diameterToleranceMm)) ||
    !(t.lengthToleranceMm===null||tolerance(t.lengthToleranceMm)) ||
    !(range===null||(Array.isArray(range)&&range.length===2&&range.every(Number.isFinite)&&range[0]>=stock.clamping.endZMm&&range[1]>range[0]&&range[1]<=stock.stock.lengthMm)) ||
    (t.diameterMm!==null&&t.diameterMm>stock.stock.radiusMm*2) ||
    (t.finalLengthMm!==null&&(t.finalLengthMm<=stock.clamping.endZMm||t.finalLengthMm>stock.stock.lengthMm)) ||
    (isConfirmedTarget(t,'machiningZRange')&&isConfirmedTarget(t,'finalLengthMm')&&range[1]>t.finalLengthMm) ||
    (t.status==='confirmed'&&['diameterMm','diameterToleranceMm','machiningZRange','finalLengthMm','lengthToleranceMm'].some(k=>t[k]===null))) {
    throw new Error('Invalid or incomplete level targets');
  }
  return t;
}

/** JSON configuration only; no target geometry or machine/node references. */
export function defineLevel(config) {
  const value=JSON.parse(JSON.stringify(config));
  const stock=cloneWorkpieceState(value.initialWorkpiece);
  validateTargets(value.targets,stock);
  if (!value.id || value.machineId!=='lathe' || !Array.isArray(value.steps) || value.steps.length!==10 ||
      value.units!=='mm' || !Number.isFinite(value.setup?.contactEpsilonMm) || !(value.setup.contactEpsilonMm>0)) {
    throw new Error('Invalid lathe LevelDefinition');
  }
  const freeze=obj=>{Object.values(obj).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(obj);};
  return freeze(value);
}
