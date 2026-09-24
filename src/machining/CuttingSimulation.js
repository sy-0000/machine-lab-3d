// Extracted sweep/minimum-removal principle from hammerPrototype.cutProfile.
// Cells represent [i * resolution, min((i + 1) * resolution, actualLength)).
// A touched cell is removed to the smallest radial distance reached inside that cell.
// This is a point-tool, axisymmetric teaching approximation, not insert/chip physics.
export function cutRevolvedProfile(state, from, to, { rpm, toolId, cutting = true } = {}) {
  if (!cutting || !toolId || !Number.isFinite(rpm) || rpm <= 0) return state;
  for (const point of [from, to]) {
    if (!point || !['zMm', 'uMm', 'vMm'].every(key => Number.isFinite(point[key]))) throw new Error('Invalid tool tip in mm');
  }
  const dz = to.zMm - from.zMm, du = to.uMm - from.uMm, dv = to.vMm - from.vMm;
  const spacing = state.profile.resolutionMm, length = state.lengthMm;
  const low = Math.min(from.zMm, to.zMm), high = Math.max(from.zMm, to.zMm);
  if (high < 0 || low >= length || (dz !== 0 && high <= 0)) return state;
  const first = Math.max(0, Math.floor(low / spacing));
  const last = Math.min(state.profile.radiusMm.length - 1,
    dz === 0 ? first : Math.ceil(high / spacing) - 1);
  let radii = null;
  for (let i = first; i <= last; i++) {
    if (i * spacing < state.clamping.endZMm) continue;
    let t0 = 0, t1 = 1;
    if (dz !== 0) {
      const a = (i * spacing - from.zMm) / dz;
      const b = (Math.min(length, (i + 1) * spacing) - from.zMm) / dz;
      t0 = Math.max(0, Math.min(a, b)); t1 = Math.min(1, Math.max(a, b));
      if (t0 > t1) continue;
    }
    const denominator = du * du + dv * dv;
    const t = denominator === 0 ? t0 : Math.max(t0, Math.min(t1, -(from.uMm * du + from.vMm * dv) / denominator));
    // Ignore sub-nanometre matrix roundoff; deterministic and unrelated to target dimensions.
    const radius = Math.round(Math.hypot(from.uMm + du * t, from.vMm + dv * t) * 1e9) / 1e9;
    if (radius < state.profile.radiusMm[i]) {
      radii ??= [...state.profile.radiusMm]; radii[i] = radius;
    }
  }
  if (!radii) return state;
  return { ...state, profile: { ...state.profile, radiusMm: radii },
    operationHistory: [...state.operationHistory, { type: 'profile-cut', toolId,
      from: { ...from }, to: { ...to } }] };
}


// Analytic swept point vs configurable chuck cylinder, including stopped-tool intrusion.
export function entersChuck(from, to, danger) {
  const dz = to.zMm - from.zMm;
  let lo = 0, hi = 1;
  if (dz === 0) {
    if (from.zMm < danger.startZMm || from.zMm > danger.endZMm) return false;
  } else {
    const a = (danger.startZMm - from.zMm) / dz, b = (danger.endZMm - from.zMm) / dz;
    lo = Math.max(0, Math.min(a,b)); hi = Math.min(1, Math.max(a,b));
    if (lo > hi) return false;
  }
  const du = to.uMm - from.uMm, dv = to.vMm - from.vMm, square = du*du+dv*dv;
  const t = square === 0 ? lo : Math.max(lo,Math.min(hi,-(from.uMm*du+from.vMm*dv)/square));
  return Math.hypot(from.uMm+du*t,from.vMm+dv*t) <= danger.radiusMm;
}

export function cutFacing(state, from, to, {rpm, toolId, facing} = {}) {
  if (!(rpm > 0) || !toolId) return state;
  const eps = facing.centerToleranceMm;
  // A facing stroke is a real radial feed at a fixed axial plane, connected to the current front.
  if (Math.abs(from.zMm-to.zMm)>eps || Math.abs(from.uMm)>eps || Math.abs(to.uMm)>eps ||
      Math.abs(from.vMm-to.vMm)<=eps || from.zMm < state.lengthMm-facing.maxDepthMm ||
      from.zMm <= state.clamping.endZMm || from.zMm >= state.lengthMm) return state;
  const spacing=state.profile.resolutionMm;
  // Conservative grid quantization: never remove material behind the actual tip plane.
  const first=Math.ceil(from.zMm/spacing-1e-9), plane=first*spacing;
  if (first>=state.profile.radiusMm.length) return state;
  const tail=state.profile.radiusMm.slice(first), remaining=Math.max(...tail);
  // Enter from outside the remaining face. Stopped teleportation inside stock is not a face pass.
  if (Math.hypot(from.uMm,from.vMm)+eps < remaining) return state;
  const crossed=from.vMm*to.vMm<=0;
  const radius=crossed?0:Math.min(Math.abs(from.vMm),Math.abs(to.vMm));
  const cutRadius=Math.round(radius*1e9)/1e9;
  const radii=state.profile.radiusMm.map((r,i)=>i<first?r:Math.min(r,cutRadius));
  if (radii.every((r,i)=>r===state.profile.radiusMm[i])) return state;
  let lengthMm=state.lengthMm;
  // Only a physically completed center-reaching stroke can discard the front slice.
  if (cutRadius===0 && radii.slice(first).every(r=>r===0)) { lengthMm=plane; radii.length=first; }
  return {...state,lengthMm,profile:{...state.profile,radiusMm:radii},
    operationHistory:[...state.operationHistory,{type:'face-cut',toolId,from:{...from},to:{...to},lengthMm}]};
}
