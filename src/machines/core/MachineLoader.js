import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { normalizeConfig } from '../config.js';
import { LATHE_CONFIG } from '../lathe/lathe.config.js';
import { MILLING_CONFIG } from '../milling/milling.config.js';
import { DRILL_CONFIG } from '../drill/drill.config.js';

const MODULE_CONFIGS = {
  lathe: LATHE_CONFIG,
  milling: MILLING_CONFIG,
  drill: DRILL_CONFIG,
};

export class MachineLoader {
  static customLoader = null;

  /**
   * Set a custom loader (e.g. for offline Node.js test environments).
   * @param {Function|null} fn
   */
  static setCustomLoader(fn) {
    MachineLoader.customLoader = fn;
  }

  /**
   * Load Machine GLB Scene and Normalized Config.
   * @param {string | Object} machineDef - Machine ID or catalog entry
   * @param {Object} [options]
   * @param {Function} [options.onProgress] - progress callback (0-100)
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ scene: THREE.Group, config: Object, moduleConfig: Object }>}
   */
  static async load(machineDef, { onProgress = () => {}, signal = null } = {}) {
    const id = typeof machineDef === 'string' ? machineDef : machineDef.id;
    const moduleConfig = MODULE_CONFIGS[id] || (typeof machineDef === 'object' ? machineDef : null);

    if (!moduleConfig) {
      throw new Error(`未知的機器類型：${id}`);
    }

    // Check if custom loader (such as Node.js test harness) is registered
    if (MachineLoader.customLoader) {
      const res = await MachineLoader.customLoader(id, moduleConfig, { onProgress, signal });
      const normalized = normalizeConfig(id, res.rawJson);
      normalized.mounts = moduleConfig.mounts || normalized.mounts || {};
      return {
        scene: res.scene,
        config: normalized,
        moduleConfig,
        modelUsed: res.modelUsed || moduleConfig.model,
      };
    }

    onProgress(10);

    // Browser environment
    const root = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? `${import.meta.env.BASE_URL}models/`
      : '/models/';

    // 1. Fetch Config JSON
    const configPath = moduleConfig.config;
    const configUrl = `${root}${configPath}`;
    const configRes = await fetch(configUrl, { signal });
    if (!configRes.ok) {
      throw new Error(`設定檔讀取失敗：${configPath}（HTTP ${configRes.status}）`);
    }
    const rawJson = await configRes.json();
    onProgress(30);

    // 2. Normalize Config & Merge Mount Points
    const normalized = normalizeConfig(id, rawJson);
    normalized.mounts = moduleConfig.mounts || normalized.mounts || {};

    // 3. Fetch & Parse GLB
    const modelPath = moduleConfig.model;
    const modelUrl = `${root}${modelPath}`;
    const res = await fetch(modelUrl, { signal });
    if (!res.ok) {
      throw new Error(`模型讀取失敗：${modelPath}（${res.status}）`);
    }

    let glbBuffer = null;
    const total = Number(res.headers.get('content-length')) || 0;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        const p = total ? Math.min(85, Math.floor(30 + (received / total) * 55)) : 50;
        onProgress(p);
      }
      const data = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
      glbBuffer = data.buffer;
    } else {
      glbBuffer = await res.arrayBuffer();
    }

    if (glbBuffer.byteLength < 20 || new DataView(glbBuffer).getUint32(0, true) !== 0x46546c67) {
      throw new Error('回應不是有效的 GLB 模型。');
    }

    onProgress(90);
    const gltfLoader = new GLTFLoader();
    const gltf = await gltfLoader.parseAsync(glbBuffer, new URL(root, location.href).href);
    onProgress(95);

    return {
      scene: gltf.scene,
      config: normalized,
      moduleConfig,
      modelUsed: modelPath,
    };
  }
}

export default MachineLoader;
