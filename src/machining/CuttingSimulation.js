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
  const spacing = state.profile.resolutionMm, length = state.actualLengthMm;
  const low = Math.min(from.zMm, to.zMm), high = Math.max(from.zMm, to.zMm);
  if (high < 0 || low >= length || (dz !== 0 && high <= 0)) return state;
  const first = Math.max(0, Math.floor(low / spacing));
  const last = Math.min(state.profile.radiusMm.length - 1,
    dz === 0 ? first : Math.ceil(high / spacing) - 1);
  let radii = null;
  for (let i = first; i <= last; i++) {
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
