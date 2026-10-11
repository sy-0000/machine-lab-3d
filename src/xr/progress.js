// 玄關的進度（工安告示板讀到第幾頁、三段切削動畫各自是否完整播完）與是否進過工廠（瞬移點解鎖），存在瀏覽器 localStorage。
// 重新進入時壓力錶與指示燈維持完成狀態，只需點手輪開門。讀寫失敗（私密視窗等）時只在這次瀏覽有效。
const KEY = 'machine-lab:xr-progress';
const CLIPS = ['lathe', 'milling', 'drill'];
const empty = () => ({ version: 1, safety: { pagesRead: 0, pages: 0, done: false }, clips: { lathe: false, milling: false, drill: false }, factory: false });

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data?.version === 1) return { ...empty(), ...data, safety: { ...empty().safety, ...data.safety }, clips: { ...empty().clips, ...data.clips } };
  } catch { /* 用空白進度 */ }
  return empty();
}

export function createProgress() {
  let state = load();
  const listeners = new Set();
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 只在這次瀏覽有效 */ }
    listeners.forEach(fn => fn(state));
  };
  return {
    get state() { return state; },
    /** 0–1：工安告示板讀過的頁數比例 */
    get safetyRatio() { return state.safety.done ? 1 : state.safety.pages ? state.safety.pagesRead / state.safety.pages : 0; },
    /** 0–1：完整播完的動畫段數比例 */
    get clipsRatio() { return CLIPS.filter(id => state.clips[id]).length / CLIPS.length; },
    get safetyDone() { return state.safety.done; },
    get clipsDone() { return CLIPS.every(id => state.clips[id]); },
    get unlocked() { return this.safetyDone && this.clipsDone; },
    /** 打開金庫門、進入工廠後解鎖瞬移點 */
    get factoryEntered() { return !!state.factory; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** 告示板翻到第 page 頁（從 1 起算）；翻到最後一頁算讀完 */
    readPage(page, pages) {
      if (state.safety.done && state.safety.pages === pages) return;
      const pagesRead = Math.max(state.safety.pagesRead, page);
      if (pagesRead === state.safety.pagesRead && pages === state.safety.pages) return;
      state = { ...state, safety: { pagesRead, pages, done: state.safety.done || pagesRead >= pages } };
      save();
    },
    clipWatched(id) {
      if (state.clips[id]) return;
      state = { ...state, clips: { ...state.clips, [id]: true } };
      save();
    },
    enterFactory() {
      if (state.factory) return;
      state = { ...state, factory: true };
      save();
    },
    /** 開發用：直接解鎖／重置 */
    unlockAll() { state = { ...state, safety: { pagesRead: state.safety.pages || 1, pages: state.safety.pages || 1, done: true }, clips: { lathe: true, milling: true, drill: true } }; save(); },
    reset() { state = empty(); save(); },
  };
}
