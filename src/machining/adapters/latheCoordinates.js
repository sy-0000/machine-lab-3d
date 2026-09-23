// Pure millimetre math. Runtime axis identifiers are explicit, never inferred from X/Z.
export const LATHE_AXES = Object.freeze({
  X: 'y', Z: 'x', height: 'z', tailstock: 'tail', tailQuill: 'quill',
});
export function finite(value, name = 'value') {
  if (!Number.isFinite(value)) throw new Error(name + ' must be finite');
  return value;
}
export const diameterToRadiusMm = diameterMm => finite(diameterMm, 'diameterMm') / 2;
export const radiusToDiameterMm = radiusMm => finite(radiusMm, 'radiusMm') * 2;

// Default signs follow current positive carriage/cross-slide motion, not a calibrated tool tip.
// Offsets are readout datums, NOT measured stock dimensions or cutting calibration.
export function createLatheCoordinates({ radialSign = 1, longitudinalSign = 1 } = {}) {
  if (![1, -1].includes(radialSign) || ![1, -1].includes(longitudinalSign)) throw new Error('Coordinate signs must be +1 or -1');
  return Object.freeze({
    toMachineMm(axis, valueMm, representation, offsetMm = 0) {
      finite(valueMm); finite(offsetMm);
      if (axis === 'X') {
        if (!['diameter', 'radial'].includes(representation)) throw new Error('X requires diameter or radial representation');
        const radialMm = representation === 'diameter' ? diameterToRadiusMm(valueMm) : valueMm;
        return (radialMm + offsetMm) / radialSign;
      }
      if (axis === 'Z') return (valueMm + offsetMm) / longitudinalSign;
      throw new Error('Unsupported teaching lathe axis: ' + axis);
    },
    fromMachineMm({ longitudinalMm, radialMm }, offsets = {}) {
      const xRadialMm = finite(radialMm) * radialSign - (offsets.X || 0);
      return { xDiameterMm: radiusToDiameterMm(xRadialMm), xRadialMm,
        zMm: finite(longitudinalMm) * longitudinalSign - (offsets.Z || 0) };
    },
    radialSign,
    longitudinalSign,
  });
}
