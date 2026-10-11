// VR 世界的聲音：一個共用的 AudioContext（瀏覽器要求使用者手勢後才能出聲：進入 VR、點擊、按鍵時 unlock）。
//   machineOutput(position)：3D 聲源（HRTF），機台的馬達與切削聲從機台位置發出（給 MachineSounds 的 output 用）
//   click()：選單翻牌數字變化時很輕的喀聲（限制頻率，避免手輪連續轉動時變成噪音）
//   warn()：刀尖壓入、撞夾頭時的警告聲（兩短聲，限制頻率）
// 聽者位置每格跟著頭盔（update）。
import { Vector3 } from 'three';

const CLICK_GAP = 1 / 12, WARN_GAP = 1.2;

export function createXrAudio({ camera }) {
  const Context = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  const ctx = Context ? new Context() : null;
  let noise = null, lastClick = 0, lastWarn = 0;
  const master = ctx?.createGain();
  if (ctx) { master.gain.value = 0.9; master.connect(ctx.destination); }
  const unlock = () => { if (ctx?.state === 'suspended') ctx.resume().catch(() => {}); };
  if (typeof window !== 'undefined') { addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true); }
  const ready = () => ctx && ctx.state === 'running';
  function noiseBuffer() {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }
  const pos = new Vector3(), fwd = new Vector3(), up = new Vector3();
  const setParam = (param, value, legacy) => { if (param) param.value = value; else legacy?.(); };
  return {
    context: ctx,
    unlock,
    /** 回傳 (ctx) => PannerNode 的函式，放在世界座標 position */
    machineOutput(position) {
      return audioCtx => {
        const panner = audioCtx.createPanner();
        panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 1.2; panner.rolloffFactor = 1;
        setParam(panner.positionX, position.x, () => panner.setPosition(position.x, position.y, position.z));
        setParam(panner.positionY, position.y); setParam(panner.positionZ, position.z);
        panner.connect(master);
        return panner;
      };
    },
    click() {
      if (!ready()) return;
      const now = ctx.currentTime;
      if (now - lastClick < CLICK_GAP) return;
      lastClick = now;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer();
      const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 3200; filter.Q.value = 5;
      const gain = ctx.createGain(); gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
      src.connect(filter).connect(gain).connect(master);
      src.start(now, Math.random() * 0.05, 0.03);
    },
    warn() {
      if (!ready()) return;
      const now = ctx.currentTime;
      if (now - lastWarn < WARN_GAP) return;
      lastWarn = now;
      for (const t of [0, 0.18]) {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'square'; osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + t); gain.gain.exponentialRampToValueAtTime(0.12, now + t + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.12);
        osc.connect(gain).connect(master); osc.start(now + t); osc.stop(now + t + 0.14);
      }
    },
    /** 每格：聽者跟著頭盔 */
    update() {
      if (!ready()) return;
      const l = ctx.listener;
      camera.getWorldPosition(pos);
      camera.getWorldDirection(fwd);
      up.set(0, 1, 0).transformDirection(camera.matrixWorld);
      if (l.positionX) {
        l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
        l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
        l.upX.value = up.x; l.upY.value = up.y; l.upZ.value = up.z;
      } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    },
    dispose() {
      if (typeof window !== 'undefined') { removeEventListener('pointerdown', unlock, true); removeEventListener('keydown', unlock, true); }
      ctx?.close();
    },
  };
}
