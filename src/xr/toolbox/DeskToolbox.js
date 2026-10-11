// 工作室的工作桌與工具箱（VR／桌機 #/world 共用）：沿用網站工具盒的模型與流程（toolboxCore.js），
// 射線點選工具 → 升起到桌子上方 → 單獨聚光、工作室其他燈光漸暗 → 旁邊 3D 說明面板（上一項／下一項／放回盒中）。
// 展示中可用 grip（滑鼠：按住拖曳）抓住工具轉動檢視。
// 工作桌中心 (0, 0, 5.8)、1.8 × 0.8 × 0.9 m；工具箱與工具整組縮成 0.36 倍（箱子約 0.72 × 0.4 m），放在桌子左半邊，
// 打開的箱蓋才不會擋住站在桌前看向中央機台的視線。
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, SpotLight, Vector3 } from 'three';
import { resolveQuality } from '../../vendor/steampunk-toolbox/src/config/quality.config.js';
import { createMaterialLibrary } from '../../vendor/steampunk-toolbox/src/materials/materialLibrary.js';
import { createWorkbench } from '../../vendor/steampunk-toolbox/src/assets/workbench.js';
import { createLiftPuff } from '../../vendor/steampunk-toolbox/src/fx/liftPuff.js';
import { TweenManager } from '../../vendor/steampunk-toolbox/src/utils/tween.js';
import { TOOLS, STATES, buildToolbox, createToolFlow } from '../../vendor/steampunk-toolbox/src/toolboxCore.js';
import { prewarmToolbox } from '../../prewarm/prewarm.js';
import { brassButton, buttonFace } from '../ui/buttons.js';
import { canvasTexture, wrapText } from '../ui/canvasText.js';
import { COLORS, drawEnamel, drawFrame, FONT_SERIF_TC, loadSignFonts } from '../ui/theme.js';

export const DESK = { x: 0, z: 5.8, width: 1.8, depth: 0.8, height: 0.9 };
const SCALE = 0.36, TRAY_X = -0.4;
// 展示點（世界座標）：站在桌前 (0, 6.7) 時，眼前約 0.7 m、胸口高度
const SHOW_AT = new Vector3(-0.15, 1.38, 6.08);
const PANEL_AT = new Vector3(0.38, 1.36, 6.14), PANEL_YAW = -0.5;
const PANEL = { w: 0.5, h: 0.36, px: 1000 };

const ROTATE_GAIN = 1 / 0.006 * 1.6; // 射線轉 1 弧度 ≈ 工具轉 1.6 弧度（ToolController.drag 每像素 0.006）

function createInfoPanel(onPrev, onNext, onReturn) {
  const W = PANEL.px, H = Math.round(PANEL.px * PANEL.h / PANEL.w);
  const surface = canvasTexture(W, H), { ctx, texture } = surface;
  const object = new Group();
  object.name = 'ToolInfoPanel';
  const face = new Mesh(new PlaneGeometry(PANEL.w, PANEL.h), new MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true }));
  face.userData.noHighlight = true;
  object.add(face);
  let tool = null, index = 0;
  function draw() {
    const inner = drawFrame(ctx, W, H, { border: 22, radius: 16 });
    if (!tool) { texture.needsUpdate = true; return; }
    drawEnamel(ctx, inner.x, inner.y, inner.w, 118, 3);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.brass; ctx.font = `700 54px ${FONT_SERIF_TC}`;
    ctx.fillText(tool.name, inner.x + 30, inner.y + 60);
    ctx.textAlign = 'right'; ctx.fillStyle = COLORS.sage; ctx.font = `500 30px ${FONT_SERIF_TC}`;
    ctx.fillText(`${index + 1} / ${TOOLS.length}`, inner.x + inner.w - 28, inner.y + 62);
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.cream; ctx.font = `500 34px ${FONT_SERIF_TC}`;
    const lines = wrapText(ctx, tool.description, inner.w - 60);
    lines.slice(0, 8).forEach((line, i) => ctx.fillText(line, inner.x + 30, inner.y + 168 + i * 50));
    if (tool.quantity) { ctx.fillStyle = COLORS.label; ctx.font = `500 30px ${FONT_SERIF_TC}`; ctx.fillText(`數量 ${tool.quantity}`, inner.x + 30, inner.y + inner.h - 34); }
    texture.needsUpdate = true;
  }
  // 按鈕在面板下方
  const buttons = [
    ['prev', buttonFace('上一項', 'prev'), -0.17, onPrev],
    ['next', buttonFace('下一項', 'next'), 0, onNext],
    ['back', buttonFace('放回盒中', 'back'), 0.17, onReturn],
  ].map(([key, faceTex, x, fn]) => {
    const b = brassButton(faceTex, { width: 0.155, height: 0.05 });
    b.object.position.set(x, -PANEL.h / 2 - 0.04, 0);
    b.object.scale.z = 0.5;
    b.object.name = `ToolPanel_${key}`;
    object.add(b.object);
    return { key, object: b.object, face: faceTex, fn };
  });
  draw();
  loadSignFonts(TOOLS.map(t => t.name + t.description + (t.quantity || '')).join('') + '數量上一項下一項放回盒中').then(draw);
  return {
    object, buttons,
    show(t, i) { tool = t; index = i; draw(); object.visible = true; },
    hide() { object.visible = false; },
    dispose() { texture.dispose(); buttons.forEach(b => b.face.texture.dispose()); },
  };
}

/**
 * @param {{ input: import('../InputManager.js').InputManager, renderer, envMap }} options
 * @returns {Promise<{ object, update(dt, elapsed), readonly dim: number, readonly busy: boolean, putAway(), dispose() }>}
 */
export async function createDeskToolbox({ input, envMap, alive = () => {} }) {
  const quality = resolveQuality();
  await prewarmToolbox();
  alive();
  const mat = createMaterialLibrary(quality);
  const root = new Group();
  root.name = 'DeskToolbox';

  // 工作桌：網站工具盒的舊木工作台（3.6 × 2.2、高 1.22）縮成 1.8 × 0.8 × 0.9 m
  const bench = createWorkbench(mat, quality);
  bench.scale.set(DESK.width / 3.6, DESK.height / 1.22, DESK.depth / 2.2);
  bench.position.set(DESK.x, DESK.height, DESK.z);
  bench.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(bench);

  // 工具箱與工具：整組縮小放在桌面上；展示點換算成這一組的座標
  const tray = new Group();
  tray.name = 'ToolTray';
  tray.scale.setScalar(SCALE);
  tray.position.set(DESK.x + TRAY_X, DESK.height, DESK.z - 0.05);
  root.add(tray);
  const { toolbox, entries } = await buildToolbox(tray, mat, { envMap });
  alive();
  toolbox.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  root.updateMatrixWorld(true);
  const showLocal = tray.worldToLocal(SHOW_AT.clone());

  const tweens = new TweenManager();
  const puff = createLiftPuff();
  puff.setPixelRatio(1.5, 900);
  tray.add(puff.points);

  // 展示聚光燈（不開陰影；VR 中省效能）
  const spot = new SpotLight(0xfff0d8, 0, 3, 0.42, 0.55, 2);
  spot.position.copy(SHOW_AT).add(new Vector3(0, 1.1, -0.05));
  spot.target.position.copy(SHOW_AT);
  root.add(spot, spot.target);

  let panel = null;
  const flow = createToolFlow({
    scene: tray, entries, showcasePoint: showLocal, tweens, puff,
    view: {
      onSelect(i) { setTimeout(() => panel.show(TOOLS[i], i), 650); },
      onSwitch(prev, next) { panel.hide(); setTimeout(() => panel.show(TOOLS[next], next), 600); },
      onPutAway() { panel.hide(); },
    },
  });
  const { sm, controller } = flow;
  const showing = () => sm.is(STATES.SHOWCASE);

  panel = createInfoPanel(() => flow.step(-1), () => flow.step(1), () => flow.putAway());
  panel.object.position.copy(PANEL_AT);
  panel.object.rotation.y = PANEL_YAW;
  panel.hide();
  root.add(panel.object);

  // ---- 互動 ----
  const offs = [];
  entries.forEach((e, i) => offs.push(input.add(e.object, {
    highlight: false, // 工具材質由 ToolController 管理（不另外複製）；指到時工具會浮起
    enabled: () => sm.is(STATES.BROWSE) && e.mode === 'rest',
    onHover: on => controller.setHovered(on ? i : -1),
    onSelect: info => { info?.pulse?.(0.25, 20); flow.select(i); },
  })));
  for (const b of panel.buttons) offs.push(input.add(b.object, { enabled: showing, onSelect: info => { info?.pulse?.(0.25, 20); b.fn(); } }));
  // 展示中抓住工具轉動：看不見的球（半徑 0.2 m）包住展示點
  const grabBall = new Mesh(new SphereGeometry(0.2, 16, 10), new MeshBasicMaterial({ visible: false }));
  grabBall.position.copy(SHOW_AT);
  grabBall.userData.noHighlight = true;
  root.add(grabBall);
  let last = null;
  const anglesOf = ray => ({ yaw: Math.atan2(ray.direction.x, -ray.direction.z), pitch: Math.asin(Math.max(-1, Math.min(1, ray.direction.y))) });
  offs.push(input.add(grabBall, {
    highlight: false,
    enabled: showing,
    onGrab: info => { last = anglesOf(info.ray); controller.beginDrag(); info.pulse?.(0.2, 15); },
    onDrag: info => {
      const a = anglesOf(info.ray);
      controller.drag((a.yaw - last.yaw) * ROTATE_GAIN, -(a.pitch - last.pitch) * ROTATE_GAIN);
      last = a;
    },
    onRelease: () => { last = null; controller.endDrag(); },
  }));

  let time = 0;
  return {
    object: root,
    /** 0 = 瀏覽、1 = 展示（工作室其他燈光依此漸暗） */
    get dim() { return flow.blend.value; },
    get busy() { return !sm.is(STATES.BROWSE); },
    putAway() { if (showing()) flow.putAway(); },
    update(dt) {
      time += dt;
      tweens.update(dt);
      const s = flow.blend.value;
      spot.intensity = 9 * s;
      puff.update(dt);
      controller.update(dt, time, showing());
    },
    dispose() {
      offs.forEach(off => off());
      panel.dispose();
      // 材質庫裡沒用到的材質與貼圖也要釋放（用到的會在場景 disposeTree 時一起處理，重複 dispose 無害）
      for (const m of Object.values(mat)) {
        if (!m?.isMaterial) continue;
        for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
        m.dispose();
      }
    },
  };
}
