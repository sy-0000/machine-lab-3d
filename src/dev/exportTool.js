// 開發用 glb 匯出工具（給 Unity 遷移用）。只在開發模式載入（src/xr/world.js 以 import.meta.env.DEV 包住），正式建置不含。
//
// 快捷鍵（不依賴現有選單）：
//   Shift+E  匯出「目前所在區域」：門外/玄關區域 → exterior_*、vestibule_*；工作室 → workshop_*、toolbox_*、tools/tool_*、目前機台 machine_<id>_*
//   Shift+A  依序走過 門外/玄關 → 工作室（車床、銑床、鑽床）全部匯出
// 主控台也可以呼叫 window.__xrExport.exportCurrent() / exportAll()。
//
// 輸出：開發伺服器（vite.config.js 的 export-sink 外掛）把檔案寫進專案根目錄的 exports/（已在 .gitignore）；
// 伺服器不可用時退回瀏覽器下載。每次匯出會更新 exports/manifest.json（記錄每個檔案的物件、被略過的物件與原因）。
//
// 做法：不改動實際場景。走訪場景樹，建一份「轉換後的副本」（共用幾何與材質）：
//   靜態（xxx_static.glb）與可互動／會動（xxx_interactive.glb）分開，保留原本的節點名稱與階層，
//   名稱能對回程式裡的 userData／節點名稱；InstancedMesh 展開成一般 Mesh；自訂 shader、粒子、燈光、隱形碰撞盒略過並記錄；
//   CanvasTexture 由 GLTFExporter 在匯出當下烘成 PNG（動態面板只留下當下那一格）。
import { Group, Mesh, Scene } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const MAX_INSTANCES = 5000;
const MAX_TEXTURE = 2048;
// 工作室、玄關沒有登記成互動、但會自己動的東西（名稱規則）。名稱 → 理由
const ANIMATED_NAME_RULES = [
  [/^(OuterDoors|VaultDoor|SafetyBoard|ProjectionScreen|TeleportDiscs?|TeleportDisc_)/, '玄關／工作室可互動或會開關的物件'],
  [/^WallGears_/, '牆面齒輪（程式持續轉動）'],
  [/^ValveWheel/, '閥門手輪（可抓取轉動）'],
];
// 各區域「不匯出」的頂層物件：reason 寫進 manifest
const SKIP_NAMES = [
  [/^(ProceduralSky|CloudLayer)$/, '自訂 ShaderMaterial 天空／雲（Unity 改用 Skybox）'],
  [/^(DevUnlock|DevReset)$/, '開發用按鈕（正式版不存在）'],
  [/^(ToolInfoPanel)$/, '3D UI 面板（CanvasTexture 動態文字，Unity 重做）'],
  [/^(Player|Menu|FpsMeter|Fade)$/, '玩家、選單、FPS 與淡入淡出（執行期 UI）'],
];

const isShader = m => !!(m && (m.isShaderMaterial || m.isRawShaderMaterial));
const mats = o => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []);
const nameOf = o => o.name || `<${o.type}>`;

function safeUserData(ud) {
  const out = {};
  for (const [k, v] of Object.entries(ud || {})) {
    if (v == null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = v;
    else if (Array.isArray(v) && v.every(x => ['string', 'number', 'boolean'].includes(typeof x))) out[k] = v;
  }
  return out;
}

function triOf(geometry, count = 1) {
  const n = geometry.index ? geometry.index.count : geometry.attributes.position?.count || 0;
  return Math.round(n / 3) * count;
}

/** 一次匯出工作：收集「略過」「警告」「互動理由」等紀錄 */
class Job {
  constructor(file) {
    this.file = file;
    this.skipped = [];     // { path, name, type, reason }
    this.warnings = [];    // { path, name, message }
    this.expanded = [];    // InstancedMesh 展開紀錄
    this.lights = [];      // 被略過的燈光參數
    this.colliders = [];   // 被略過的隱形碰撞盒（保留名稱與 bbox）
    this.interactive = []; // { path, reason }
  }
}

function pathOf(o, stopAt) {
  const names = [];
  for (let p = o; p && p !== stopAt; p = p.parent) names.unshift(nameOf(p));
  return names.join('/');
}

/** 把一個節點轉成不含子節點的外殼（Group 或共用幾何的 Mesh） */
function shell(node, job, asGroup = false) {
  let out;
  if (node.isMesh && !asGroup && !node.isInstancedMesh && !node.isSkinnedMesh) {
    out = new Mesh(node.geometry, node.material);
    out.castShadow = node.castShadow; out.receiveShadow = node.receiveShadow;
  } else out = new Group();
  out.name = node.name;
  out.position.copy(node.position); out.quaternion.copy(node.quaternion); out.scale.copy(node.scale);
  out.visible = node.visible;
  out.userData = safeUserData(node.userData);
  return out;
}

/** 判斷這個節點本身要不要略過（不含子節點）；回傳理由或 null */
function skipReason(node, root) {
  for (const [re, why] of SKIP_NAMES) if (re.test(node.name)) return why;
  if (node.isLight) return `燈光（${node.type}）：glb 不帶光源，Unity 端改用烘焙／重設光源；參數記錄於 manifest.lights`;
  if (node.isPoints) return '粒子／點精靈（THREE.Points + 自訂 shader），Unity 改用 VFX/Particle System 重做';
  if (node.isSprite) return 'Sprite（billboard），Unity 端重做';
  if (node.isLine || node.isLineSegments) return '線段（Line），glb 不支援該用途';
  if (node.isSkinnedMesh) return 'SkinnedMesh（專案中不應出現）';
  if (node.isMesh) {
    const ms = mats(node);
    if (ms.some(isShader)) return '自訂 ShaderMaterial（Unity 需用 Shader Graph 重寫）';
    if (ms.length && ms.every(m => m.visible === false)) return '隱形碰撞盒／點擊範圍（Unity 端用 Collider 取代，bbox 記錄於 manifest.colliders）';
  }
  return null;
}

function bboxOf(node) {
  node.updateWorldMatrix(true, true);
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const g = node.geometry;
  if (!g) return null;
  g.computeBoundingBox();
  const b = g.boundingBox;
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    const v = { x, y, z };
    const e = node.matrixWorld.elements;
    const wx = e[0] * v.x + e[4] * v.y + e[8] * v.z + e[12], wy = e[1] * v.x + e[5] * v.y + e[9] * v.z + e[13], wz = e[2] * v.x + e[6] * v.y + e[10] * v.z + e[14];
    box.min = [Math.min(box.min[0], wx), Math.min(box.min[1], wy), Math.min(box.min[2], wz)];
    box.max = [Math.max(box.max[0], wx), Math.max(box.max[1], wy), Math.max(box.max[2], wz)];
  }
  return box;
}

/**
 * 把來源樹分成 static／interactive 兩份副本。
 * @param roots 來源頂層物件（它們的父節點視為匯出的原點，只看 roots 自己的局部座標）
 * @param isInteractive (node) => 理由字串 | null
 */
function partition(roots, isInteractive, job, rootsParent = null) {
  const trees = { static: new Group(), interactive: new Group() };
  trees.static.name = 'static'; trees.interactive.name = 'interactive';
  const made = { static: new Map(), interactive: new Map() };

  // 取得（必要時建立）某棵樹裡對應 node 的「空殼」（祖先用）
  const ensure = (tree, node) => {
    if (made[tree].has(node)) return made[tree].get(node);
    const parentTarget = roots.includes(node) || !node.parent ? trees[tree] : ensure(tree, node.parent);
    const g = shell(node, job, true);
    parentTarget.add(g);
    made[tree].set(node, g);
    return g;
  };
  const attach = (tree, node, converted) => {
    const parentTarget = roots.includes(node) || !node.parent ? trees[tree] : ensure(tree, node.parent);
    parentTarget.add(converted);
    made[tree].set(node, converted);
  };

  // 完整轉換一棵子樹（不再分流）：略過不能匯出的、展開 InstancedMesh
  const convertSubtree = (node, p) => {
    const why = skipReason(node, null);
    if (why) { recordSkip(node, why, job); return null; }
    if (node.isInstancedMesh) return expandInstanced(node, job);
    const out = shell(node, job);
    if (node.isMesh) noteMaterials(node, job);
    for (const c of node.children) {
      const cc = convertSubtree(c, p);
      if (cc) out.add(cc);
    }
    return out;
  };

  const walk = node => {
    const why = skipReason(node, null);
    if (why) { recordSkip(node, why, job); return; }
    const reason = isInteractive(node);
    if (reason) {
      const converted = convertSubtree(node, null);
      if (converted) { attach('interactive', node, converted); job.interactive.push({ path: pathOf(node, rootsParent), reason }); }
      return;
    }
    if (node.isInstancedMesh) { const e = expandInstanced(node, job); if (e) attach('static', node, e); return; }
    if (node.isMesh) {
      noteMaterials(node, job);
      attach('static', node, shell(node, job));
    }
    for (const c of node.children) walk(c);
  };
  for (const r of roots) walk(r);
  return trees;
}

function recordSkip(node, reason, job) {
  const rec = { path: pathOf(node, null), name: nameOf(node), type: node.type, reason };
  if (node.isLight) {
    job.lights.push({ name: nameOf(node), type: node.type, color: '#' + node.color.getHexString(), intensity: node.intensity, distance: node.distance, castShadow: node.castShadow, position: node.getWorldPosition(node.position.clone()).toArray().map(n => +n.toFixed(3)) });
  }
  if (node.isMesh && mats(node).every(m => m.visible === false)) job.colliders.push({ name: nameOf(node), bbox: bboxOf(node) });
  if (node.isMesh) rec.triangles = triOf(node.geometry);
  job.skipped.push(rec);
}

function noteMaterials(node, job) {
  for (const m of mats(node)) {
    if (m.transparent) job.warnings.push({ path: pathOf(node, null), name: nameOf(node), message: `透明材質「${m.name || m.type}」：glTF 以 alphaMode=BLEND 匯出，渲染排序在 Unity 需手動設定（opacity ${m.opacity}）` });
    if (m.onBeforeCompile && m.onBeforeCompile.toString().replace(/\s/g, '').length > 12) job.warnings.push({ path: pathOf(node, null), name: nameOf(node), message: `材質「${m.name || m.type}」用 onBeforeCompile 改過 shader，只匯出基底 PBR 參數` });
    if (m.isMeshBasicMaterial && m.map?.isCanvasTexture) job.warnings.push({ path: pathOf(node, null), name: nameOf(node), message: 'CanvasTexture 動態貼圖（面板／螢幕）：只烘下匯出當下那一格；Unity 端需用 RenderTexture 或 UI 重做' });
  }
}

/** InstancedMesh → 一組共用幾何與材質的一般 Mesh（單位矩陣的 Group 包著，名稱 xxx_0…） */
function expandInstanced(node, job) {
  if (node.count > MAX_INSTANCES) {
    recordSkip(node, `InstancedMesh 實例過多（${node.count} > ${MAX_INSTANCES}），不展開；Unity 端用 GPU Instancing／程式重建`, job);
    return null;
  }
  const group = shell(node, job, true);
  group.userData.expandedFrom = 'InstancedMesh';
  const m = new Mesh(node.geometry, node.material);
  for (let i = 0; i < node.count; i++) {
    const mesh = new Mesh(node.geometry, node.material);
    node.getMatrixAt(i, mesh.matrix);
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.name = `${node.name || 'Instance'}_${i}`;
    mesh.castShadow = node.castShadow; mesh.receiveShadow = node.receiveShadow;
    group.add(mesh);
  }
  void m;
  job.expanded.push({ name: nameOf(node), path: pathOf(node, null), instances: node.count, triangles: triOf(node.geometry, node.count), hasInstanceColor: !!node.instanceColor });
  if (node.instanceColor) job.warnings.push({ path: pathOf(node, null), name: nameOf(node), message: 'InstancedMesh 有逐實例顏色（instanceColor），展開後沒有帶到各實例，需在 Unity 手動上色' });
  noteMaterials(node, job);
  return group;
}

// ---------------------------------------------------------------------------------------------

function describe(tree) {
  let meshes = 0, tris = 0, nodes = 0;
  const textures = new Map();
  tree.traverse(o => {
    nodes++;
    if (!o.isMesh) return;
    meshes++;
    tris += triOf(o.geometry);
    for (const m of mats(o)) for (const [slot, t] of Object.entries(m)) {
      if (!t?.isTexture) continue;
      const key = t.uuid;
      if (!textures.has(key)) {
        const img = t.image;
        textures.set(key, { slot, name: t.name || '', source: t.isCanvasTexture ? 'CanvasTexture（已烘成 PNG）' : t.isDataTexture ? 'DataTexture' : 'Texture', width: img?.width || 0, height: img?.height || 0, clamped: Math.max(img?.width || 0, img?.height || 0) > MAX_TEXTURE, usedBy: [] });
      }
      const rec = textures.get(key);
      if (rec.usedBy.length < 3) rec.usedBy.push(nameOf(o));
    }
  });
  return { meshes, tris, nodes, textures: [...textures.values()] };
}

/** 物件清單：階層深度 ≤ 3 的節點，附該節點底下的 mesh 數與三角形數 */
function objectList(tree, maxDepth = 3) {
  const out = [];
  const walk = (o, depth, path) => {
    if (o !== tree) {
      let meshes = 0, tris = 0;
      o.traverse(c => { if (c.isMesh) { meshes++; tris += triOf(c.geometry); } });
      out.push({ path: path.join('/') + (path.length ? '/' : '') + nameOf(o), type: o.type, depth, meshes, triangles: tris, userData: Object.keys(o.userData).length ? o.userData : undefined });
    }
    if (depth < maxDepth) for (const c of o.children) walk(c, depth + 1, o === tree ? path : [...path, nameOf(o)]);
  };
  walk(tree, 0, []);
  return out;
}

async function parse(tree) {
  const scene = new Scene();
  scene.name = tree.name;
  scene.add(tree);
  const exporter = new GLTFExporter();
  return exporter.parseAsync(scene, { binary: true, onlyVisible: false, maxTextureSize: MAX_TEXTURE });
}

async function writeFile(name, buffer) {
  try {
    const res = await fetch(`/__export/${name}`, { method: 'POST', body: buffer, headers: { 'content-type': 'application/octet-stream' } });
    if (res.ok) return 'exports';
    throw new Error(String(res.status));
  } catch {
    const url = URL.createObjectURL(new Blob([buffer]));
    const a = document.createElement('a');
    a.href = url; a.download = name.replace(/\//g, '__'); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'download';
  }
}

export function installExportTool({ manager, input }) {
  const manifest = { generatedAt: null, tool: 'src/dev/exportTool.js', three: null, files: [], notes: [] };
  let busy = false;
  const log = (...a) => console.info('[export]', ...a);
  const banner = text => { try { manager.status(text); } catch { /* 沒有狀態列也無妨 */ } };

  const interactiveSet = () => new Set(input.targetObjects());
  const ruleReason = node => {
    if (node.userData?.dynamic) return 'userData.dynamic（程式每格更新）';
    if (node.userData?.noBatch) return 'userData.noBatch';
    for (const [re, why] of ANIMATED_NAME_RULES) if (re.test(node.name)) return why;
    return null;
  };

  async function emit(base, trees, job, extra = {}) {
    for (const kind of ['static', 'interactive']) {
      const tree = trees[kind];
      const info = describe(tree);
      const file = `${base}_${kind}.glb`;
      const rec = { file, kind, source: extra.source || base, status: 'ok', bytes: 0, triangles: info.tris, meshes: info.meshes, nodes: info.nodes, objects: objectList(tree), textures: info.textures, ...(kind === 'interactive' ? { interactiveReasons: job.interactive } : {}) };
      if (!info.meshes) { rec.status = 'empty'; rec.note = '沒有任何 mesh，未產生檔案'; manifest.files.push(rec); log(file, '空，略過'); continue; }
      try {
        log(file, `開始編碼：${info.meshes} meshes、${info.textures.length} 張貼圖（${info.textures.map(t => t.width + 'x' + t.height).join(' ')}）`);
        const t0 = performance.now();
        const buffer = await parse(tree);
        rec.encodeSeconds = +((performance.now() - t0) / 1000).toFixed(1);
        rec.bytes = buffer.byteLength;
        rec.written = await writeFile(file, buffer);
        log(file, `${(rec.bytes / 1024).toFixed(0)} KB`, `${info.tris} tris`);
      } catch (err) {
        rec.status = 'failed'; rec.error = String(err?.message || err);
        console.error('[export] 失敗', file, err);
      }
      manifest.files.push(rec);
    }
    manifest.groups ??= [];
    manifest.groups.push({ base, ...extra, skipped: job.skipped, warnings: job.warnings, expandedInstancedMeshes: job.expanded, lights: job.lights, colliders: job.colliders });
  }

  async function flush() {
    manifest.generatedAt = new Date().toISOString();
    const body = JSON.stringify(manifest, null, 1);
    await writeFile('manifest.json', new TextEncoder().encode(body).buffer);
  }

  // ---- 門外／玄關（Lobby 區域）
  const LOBBY_VESTIBULE = /^(Vestibule|VaultDoor|SafetyBoard|ProjectionScreen|Ceiling|CeilingBeam|AnnexInnerSide_.*)$/;
  async function exportLobby(scene) {
    const root = scene.getObjectByName('Lobby');
    if (!root) throw new Error('目前不是大門口區域（找不到 Lobby）');
    const set = interactiveSet();
    const isInteractive = n => (set.has(n) ? 'InputManager 登記的可互動物件' : ruleReason(n));
    const parts = { exterior: [], vestibule: [] };
    for (const c of root.children) (LOBBY_VESTIBULE.test(c.name) ? parts.vestibule : parts.exterior).push(c);
    for (const [zone, roots] of Object.entries(parts)) {
      const job = new Job(zone);
      const trees = partition(roots, isInteractive, job, root);
      await emit(zone, trees, job, { area: 'lobby', zone, note: zone === 'exterior' ? '八角外牆、穹頂、玄關外殼、拱門與大門、煤氣燈、招牌；座標系＝場景（玄關在 +Z 方向）' : '玄關內部、金庫圓門、工安告示板、放映幕、玄關天花板與內牆' });
    }
  }

  // ---- 工作室
  async function exportWorkshop(scene) {
    const room = scene.getObjectByName('SteampunkWorkshop');
    if (!room) throw new Error('目前不是工作室區域（找不到 SteampunkWorkshop）');
    const set = interactiveSet();
    const isInteractive = n => (set.has(n) ? 'InputManager 登記的可互動物件' : ruleReason(n));
    // 防呆：工作室預設會把靜態物件合併成 Batched_*（保留名稱需要 ?nobatch）
    const batched = [];
    room.traverse(o => { if (o.name?.startsWith('Batched_')) batched.push(o); });
    const job = new Job('workshop');
    if (batched.length) job.warnings.push({ path: 'SteampunkWorkshop', name: 'Batched_*', message: `場景已把靜態網格合併成 ${batched.length} 個 Batched_* 網格，節點名稱與階層已遺失；請用網址參數 ?nobatch 重新載入再匯出` });
    const roots = [room, ...['TeleportDiscs'].map(n => scene.getObjectByName(n)).filter(Boolean)];
    const trees = partition(roots, isInteractive, job, scene);
    await emit('workshop', trees, job, { area: 'workshop', zone: 'room', note: '穹頂工作室（不含機台、不含工作桌與工具箱）；瞬移圓盤放在 interactive', batchedMeshes: batched.length });
  }

  // ---- 工作桌與工具箱：toolbox_static／toolbox_interactive（13 件工具在 rest 位置），另外每件工具單獨一個檔
  async function exportToolbox(scene) {
    const desk = scene.getObjectByName('DeskToolbox');
    if (!desk) throw new Error('找不到 DeskToolbox');
    const set = interactiveSet();
    const tools = [];
    desk.traverse(o => { if (/^Tool_/.test(o.name)) tools.push(o); });
    const isInteractive = n => (/^Tool_/.test(n.name) ? `工具 ${n.name}（userData.toolIndex=${n.userData.toolIndex}）` : set.has(n) ? 'InputManager 登記的可互動物件' : ruleReason(n));
    const job = new Job('toolbox');
    const trees = partition([desk], isInteractive, job, scene);
    await emit('toolbox', trees, job, { area: 'workshop', zone: 'toolbox', note: '工作桌（DeskToolbox/Workbench）、工具箱、13 件工具（interactive，位置為收在箱內的 rest 位置）。工具箱整組在 ToolTray（縮放 0.36）之下', toolCount: tools.length });
    // 單件工具：置中、不帶箱內座標（以工具自己的原點為中心）
    for (const tool of tools) {
      const j = new Job(tool.name);
      const copy = (function convert(node) {
        const why = skipReason(node, null);
        if (why) { recordSkip(node, why, j); return null; }
        if (node.isInstancedMesh) return expandInstanced(node, j);
        const out = shell(node, j);
        if (node.isMesh) noteMaterials(node, j);
        for (const c of node.children) { const cc = convert(c); if (cc) out.add(cc); }
        return out;
      })(tool);
      copy.position.set(0, 0, 0); copy.quaternion.identity(); copy.scale.set(1, 1, 1);
      const root = new Group(); root.name = 'interactive'; root.add(copy);
      const info = describe(root);
      const file = `tools/${tool.name.toLowerCase()}.glb`;
      const rec = { file, kind: 'tool', source: tool.name, status: 'ok', bytes: 0, triangles: info.tris, meshes: info.meshes, nodes: info.nodes, objects: objectList(root, 2), textures: info.textures, toolIndex: tool.userData.toolIndex };
      try {
        const buffer = await parse(root);
        rec.bytes = buffer.byteLength; rec.written = await writeFile(file, buffer);
        log(file, `${(rec.bytes / 1024).toFixed(0)} KB`, `${info.tris} tris`);
      } catch (err) { rec.status = 'failed'; rec.error = String(err?.message || err); console.error('[export] 失敗', file, err); }
      manifest.files.push(rec);
      manifest.groups.push({ base: tool.name, area: 'workshop', zone: 'tool', skipped: j.skipped, warnings: j.warnings, expandedInstancedMeshes: j.expanded });
    }
  }

  // ---- 機台：用機台設定檔（public/models/*.json 正規化後）裡的節點名稱判斷哪些會動
  function machineInteractiveNames(rt) {
    const cfg = rt.config || {};
    const map = new Map();
    const add = (name, role) => { if (name && !map.has(name)) map.set(name, role); };
    for (const a of cfg.axes || []) add(a.node, `axis:${a.id}（${a.label || ''}）`);
    for (const w of cfg.wheels || []) add(w.node, `wheel:${w.id}（${w.label || ''}）`);
    if (cfg.spindle?.node) add(cfg.spindle.node, 'spindle');
    if (cfg.lever?.node) add(cfg.lever.node, `lever（${cfg.lever.label || ''}）`);
    if (cfg.toggle?.node) add(cfg.toggle.node, `toggle（${cfg.toggle.label || ''}）`);
    for (const a of cfg.actions || []) add(a.node, `action:${a.id}`);
    for (const g of cfg.extraGroups || []) add(g.name, 'extraGroup');
    for (const a of cfg.additions || []) add(a.name, `addition:${a.kind || ''}`);
    return map;
  }
  async function exportMachine(area, scene) {
    const m = area.machine?.();
    if (!m) throw new Error('工作室還沒有機台');
    const rt = m.runtime;
    const names = machineInteractiveNames(rt);
    const found = new Set();
    const isInteractive = n => { const r = names.get(n.name); if (r) found.add(n.name); return r ? `機台設定：${r}` : (n.userData?.isMountPoint ? '掛點（isMountPoint）' : null); };
    const job = new Job(`machine_${m.id}`);
    const trees = partition([rt.scene], isInteractive, job, rt.scene.parent);
    // 設定檔裡的名稱是否真的存在於模型（巢狀在別的互動節點底下的不會被個別走訪到，所以直接在場景樹裡找）
    const present = new Set();
    rt.scene.traverse(o => { if (o.name) present.add(o.name); });
    const missing = [...names.keys()].filter(n => !present.has(n));
    void found;
    // 放置資訊：房間座標下機台怎麼擺（工作室 Workshop.js 的 offset／machineRoot）
    const slot = scene.getObjectByName('MachineSlot');
    const offset = slot?.children.find(c => c !== undefined && c.children.includes(rt.scene));
    const placement = { machineSlotRotationY: slot?.rotation.y ?? 0, offset: offset ? offset.position.toArray() : null, pedestal: !!slot?.getObjectByName('MachinePedestal'), centerOfModel: rt.center?.toArray?.(), floorY: rt.floor };
    await emit(`machine_${m.id}`, trees, job, { area: 'workshop', zone: 'machine', machineId: m.id, source: `public/models/machines/${m.id}/${m.id}.glb（經 MachineBase 預處理後的 runtime.scene）`, placement, configNodesMissingInScene: missing, interactiveNodeRoles: Object.fromEntries(names) });
  }

  async function exportCurrent() {
    if (busy) return;
    busy = true;
    try {
      const area = manager.current, name = manager.currentName;
      if (!area?.scene) throw new Error('場景還沒載入完成');
      banner('匯出中…');
      manifest.three = (await import('three')).REVISION;
      if (name === 'lobby') await exportLobby(area.scene);
      else if (name === 'workshop') {
        await exportWorkshop(area.scene);
        await exportToolbox(area.scene);
        await exportMachine(area, area.scene);
      }
      await flush();
      banner(`匯出完成：${manifest.files.filter(f => f.status === 'ok').length} 個檔案`);
      log('完成', manifest.files.map(f => `${f.file}:${f.status}`).join(', '));
    } catch (err) {
      console.error('[export] 失敗', err);
      banner('匯出失敗：' + (err?.message || err));
      manifest.notes.push(`匯出失敗：${err?.message || err}`);
      throw err;
    } finally { busy = false; }
  }

  /** 逐區域走過去匯出（用 manager.go 切換，與選單相同的流程） */
  async function exportAll() {
    manifest.files = []; manifest.groups = []; manifest.notes = [];
    await manager.go('lobby', { station: 'outside' });
    await exportCurrent();
    for (const id of ['lathe', 'milling', 'drill']) {
      await manager.go('workshop', { machineId: id });
      if (id !== 'lathe') {
        // 後兩台只匯出機台（工作室與工具箱已經匯出過）
        await exportMachineOnly();
      } else await exportCurrent();
    }
    return manifest;
  }

  const onKey = e => {
    if (e.target?.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey || !e.shiftKey) return;
    if (e.code === 'KeyE') { e.preventDefault(); exportCurrent().catch(() => {}); }
    else if (e.code === 'KeyA') { e.preventDefault(); exportAll().catch(err => console.error('[export]', err)); }
  };
  addEventListener('keydown', onKey);
  /** 只匯出目前機台（除錯與 exportAll 後兩台用） */
  async function exportMachineOnly() {
    busy = true;
    try { await exportMachine(manager.current, manager.current.scene); await flush(); } finally { busy = false; }
  }
  window.__xrExport = { exportCurrent, exportAll, exportMachineOnly, manifest };
  log('匯出工具就緒：Shift+E 匯出目前區域、Shift+A 匯出全部');
  return () => { removeEventListener('keydown', onKey); delete window.__xrExport; };
}
