// Deterministic intensity curves shared by lights and emissive materials so both stay in sync.
import { noise1 } from '../materials/noise.js';

// Boiler fire: restless, ~0.75..1.1
export function fireFlicker(t) {
  return 0.8 + 0.13 * noise1(t * 6.3, 1) + 0.09 * noise1(t * 15.7, 2) + 0.04 * Math.sin(t * 1.9);
}

// Edison bulbs: slow breathing with a rare, tiny brown-out dip.
export function lampBreath(t, seed = 0) {
  const slow = 0.97 + 0.025 * Math.sin(t * 0.8 + seed * 1.7) + 0.012 * Math.sin(t * 2.3 + seed);
  const f = noise1(t * 9 + seed * 13, seed + 5);
  const dip = f > 0.9 ? (f - 0.9) * 2.2 : 0;
  return slow - dip * 0.35;
}
