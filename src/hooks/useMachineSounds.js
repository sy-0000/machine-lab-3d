import { useEffect, useRef, useState } from 'react';
import { MachineSounds } from '../audio/MachineSounds.js';

const KEY = 'machine-lab:muted';
const readMuted = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Machining sounds for one workspace: follows the session on every command and frame. */
export default function useMachineSounds(session, machineId) {
  const sounds = useRef(null), [muted, setMutedState] = useState(readMuted);
  useEffect(() => {
    const s = sounds.current = new MachineSounds(), unlock = () => s.unlock();
    // Audio may only start after a user gesture.
    window.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true);
    return () => { window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true); s.dispose(); sounds.current = null; };
  }, []);
  useEffect(() => { sounds.current?.setMuted(muted); }, [muted]);
  useEffect(() => {
    const s = sounds.current; if (!s || !session) return;
    s.setMachine(machineId);
    const feed = () => s.update(session.getState());
    feed();
    const unobserve = session.observe(feed);
    return () => { unobserve(); s.update({ rpm: 0, cutCount: 0, machineAxesMm: {} }); };
  }, [session, machineId]);
  const setMuted = value => { setMutedState(value); try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* per-viewer convenience only */ } };
  return [muted, setMuted];
}
