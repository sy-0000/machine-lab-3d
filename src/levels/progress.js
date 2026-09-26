// Best stars per challenge, kept in this browser only (a per-viewer convenience, like the theme).
const KEY = 'machine-lab:stars';

export function loadBestStars() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

/** Records a result; returns true when it beats the previous best for that challenge. */
export function saveBestStars(challengeId, stars) {
  const best = loadBestStars();
  if (challengeId in best && stars <= best[challengeId]) return false; // 0★ is still stored: "played"
  best[challengeId] = stars;
  try { localStorage.setItem(KEY, JSON.stringify(best)); } catch { /* storage blocked: still report the record */ }
  return true;
}
