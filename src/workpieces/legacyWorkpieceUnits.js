// Only callers omitting units retain the original v1 heuristic. Never use in machining.
export function legacyWorkpieceToMeters(value) {
  return value > 1 ? value / 1000 : value;
}
