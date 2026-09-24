// Configurable teaching fixture / simulation limits, NOT measured real-machine specifications.
export const LATHE_MACHINING = Object.freeze({
  clamping: Object.freeze({ startZMm: 0, endZMm: 40 }),
  chuckDanger: Object.freeze({ startZMm: -30, endZMm: 40, radiusMm: 40 }),
  facing: Object.freeze({ maxDepthMm: 2, centerToleranceMm: 0.000001 }),
});
