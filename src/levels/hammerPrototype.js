// Prototype dimensions in millimetres; adjust after the course drawing is confirmed.
export const STOCK = { length: 140, radius: 12, spacing: 0.5 };
export const HAMMER_LEVELS = [
  { id: 'handle-grip', title: '第一關：槌柄握柄', start: 110, end: 30, radius: 10, feed: 300,
    description: '從 110 mm 向 30 mm 進給，將握柄區加工至 Ø20 mm。' },
  { id: 'handle-front', title: '第二關：槌柄前端', start: 135, end: 112, radius: 8, feed: 180,
    description: '沿用第一關工件，將前端 112–135 mm 區域加工至 Ø16 mm。' },
];
export const SAVE_KEY = 'machine-lab.hammer-prototype.v1';
export function blankProfile() {
  return Array.from({length: STOCK.length / STOCK.spacing + 1}, () => STOCK.radius);
}
export function createAttempt(levelIndex = 0, profile = blankProfile(), marks = []) {
  return { levelIndex, position: HAMMER_LEVELS[levelIndex].start, zero: null,
    profile: [...profile], marks: marks.map(m => ({...m})), phase: 'ready', rpm: 0,
    feedEnabled: true, dwell: 0, demo: false };
}
// Sweep the entire travelled interval so slow frames cannot leave gaps in the stock.
export function cutProfile(profile, from, to, radius, level) {
  return profile.map((old, index) => {
    const x = index * STOCK.spacing;
    return x >= level.end && x <= level.start &&
      x >= Math.min(from, to) - STOCK.spacing / 2 &&
      x <= Math.max(from, to) + STOCK.spacing / 2 ? Math.min(old, radius) : old;
  });
}
export function advanceAttempt(state, seconds) {
  if (!['running', 'stopping'].includes(state.phase)) return state;
  const dt = Math.min(0.1, Math.max(0, seconds));
  const level = HAMMER_LEVELS[state.levelIndex];
  if (state.phase === 'stopping') {
    const rpm = Math.max(0, state.rpm - 1200 * dt);
    return {...state, rpm, phase: rpm === 0 ? 'complete' : 'stopping'};
  }
  const rpm = Math.min(600, state.rpm + 1200 * dt);
  if (rpm < 500) return {...state, rpm};
  const speed = (state.demo ? 600 : level.feed) / 60;
  const position = state.feedEnabled ? Math.max(level.end, state.position - speed * dt) : state.position;
  const profile = cutProfile(state.profile, state.position, position, level.radius, level);
  let dwell = state.feedEnabled ? 0 : state.dwell + dt;
  let marks = state.marks;
  // Cosmetic surface damage is bounded and separate from dimensional cutting.
  if (dwell >= 1.5) {
    const x = Math.round(position / STOCK.spacing) * STOCK.spacing;
    const existing = marks.find(m => m.position === x);
    marks = existing ? marks.map(m => m === existing ? {...m, severity: Math.min(1, m.severity + dt / 3)} : m)
      : [...marks, {position: x, severity: 0.1}];
  }
  return {...state, rpm, position, profile, marks, dwell,
    phase: position <= level.end ? 'stopping' : 'running'};
}
export function validateSave(value) {
  return !!value && value.version === 1 && Number.isInteger(value.completedLevel) &&
    value.completedLevel >= 0 && value.completedLevel < HAMMER_LEVELS.length &&
    Array.isArray(value.profile) && value.profile.length === blankProfile().length &&
    value.profile.every(r => Number.isFinite(r) && r > 0 && r <= STOCK.radius) &&
    Array.isArray(value.marks) && value.marks.length <= blankProfile().length &&
    value.marks.every(m => Number.isFinite(m.position) && m.position >= 0 && m.position <= STOCK.length &&
      Number.isFinite(m.severity) && m.severity >= 0 && m.severity <= 1);
}
