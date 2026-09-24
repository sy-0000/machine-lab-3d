import { useEffect, useState } from 'react';

// Site colour theme: 'light' (sky dock, warm haze) or 'dark' (the original dark studio).
// index.html applies the saved choice before first paint; this keeps <html data-theme> and React in step.
const KEY = 'machine-lab:theme', EVENT = 'machine-lab:theme';
export const getTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#11181c' : '#3a2a1c');
  try { localStorage.setItem(KEY, theme); } catch { /* per-viewer convenience only */ }
  dispatchEvent(new Event(EVENT));
}
export function useTheme() {
  const [theme, set] = useState(getTheme);
  useEffect(() => { const sync = () => set(getTheme()); addEventListener(EVENT, sync); return () => removeEventListener(EVENT, sync); }, []);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')];
}
