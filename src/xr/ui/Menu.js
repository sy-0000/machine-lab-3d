// 左手腕選單（VR）：按左手 Y 叫出／關閉，面板浮在左手腕上方、永遠面向頭盔，用右手射線點選。
// 項目與動作由 world.js 提供（menuItems / runMenu），桌機 #/world 用 WorldPage 的 HTML 選單顯示同一份項目。
// 不能用的項目變暗；點下去在面板底部顯示原因並輕震。選單物件登記為 persistent，換區域時不會被清掉。
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { brassButton, buttonFace } from './buttons.js';
import { canvasTexture, FONT_SANS, FONT_SERIF, loadGlyphs } from './canvasText.js';

const W = 0.3, BTN_W = 0.26, BTN_H = 0.042, GAP = 0.008;

export function createMenu({ input, player, camera, items, run }) {
  const root = new Group();
  root.name = 'WristMenu';
  root.visible = false;
  player.add(root);

  const list = items();
  const height = 0.07 + list.length * (BTN_H + GAP) + 0.06;
  const frame = new Mesh(new BoxGeometry(W + 0.02, height + 0.02, 0.012), new MeshBasicMaterial({ color: 0x8a6a36 }));
  frame.position.z = -0.008;
  const back = new Mesh(new PlaneGeometry(W, height), new MeshBasicMaterial({ color: 0x241a10 }));
  frame.userData.noHighlight = back.userData.noHighlight = true;
  root.add(frame, back);

  const title = canvasTexture(600, 100), status = canvasTexture(600, 100);
  const titleMesh = new Mesh(new PlaneGeometry(W - 0.02, 0.05), new MeshBasicMaterial({ map: title.texture, transparent: true, toneMapped: false }));
  titleMesh.position.set(0, height / 2 - 0.035, 0.002);
  const statusMesh = new Mesh(new PlaneGeometry(W - 0.02, 0.05), new MeshBasicMaterial({ map: status.texture, transparent: true, toneMapped: false }));
  statusMesh.position.set(0, -height / 2 + 0.03, 0.002);
  titleMesh.userData.noHighlight = statusMesh.userData.noHighlight = true;
  root.add(titleMesh, statusMesh);
  const drawTitle = () => {
    const { ctx, canvas, texture } = title;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f3dca2'; ctx.font = `900 54px ${FONT_SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('選單 · Machine Yard', 300, 54);
    texture.needsUpdate = true;
  };
  const say = text => {
    const { ctx, canvas, texture } = status;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffcf8a'; ctx.font = `500 34px ${FONT_SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text || '左手 Y 關閉', 300, 52);
    texture.needsUpdate = true;
  };

  const buttons = list.map((item, i) => {
    const face = buttonFace(item.label, null, { width: 620, height: 100 });
    const b = brassButton(face, { width: BTN_W, height: BTN_H });
    b.object.position.set(0, height / 2 - 0.08 - i * (BTN_H + GAP) - BTN_H / 2, 0.004);
    b.object.scale.z = 0.4;
    b.object.name = `Menu_${item.key}`;
    root.add(b.object);
    const plate = b.object.children[1];
    input.add(b.object, {
      persistent: true,
      enabled: () => root.visible,
      onSelect: info => {
        const now = items().find(x => x.key === item.key);
        if (!now?.enabled) { say(now?.reason || '目前不能使用'); info?.pulse?.(0.5, 40); return; }
        info?.pulse?.(0.3, 20);
        hide();
        run(item.key);
      },
    });
    return { key: item.key, plate, face };
  });

  function refresh() {
    const now = items();
    for (const b of buttons) {
      const item = now.find(x => x.key === b.key);
      b.plate.material.color.setHex(item?.enabled ? 0xffffff : 0x6a6a6a);
    }
  }
  function show() { refresh(); say(''); root.visible = true; }
  function hide() { root.visible = false; }

  // 字先下載好再畫（見 loadGlyphs）
  loadGlyphs(list.map(i => i.label + (i.reason || '')).join('') + '選單左手關閉目前不能使用需先在玄關讀完工安規則並看完切削動畫存檔讀取在第階段加入就在這台').then(() => {
    drawTitle(); say('');
    for (const [i, b] of buttons.entries()) { const f = buttonFace(list[i].label, null, { width: 620, height: 100 }); b.plate.material.map = f.texture; b.plate.material.needsUpdate = true; b.face.texture.dispose(); b.face = f; }
  });
  drawTitle(); say('');

  const at = new Vector3(), eye = new Vector3();
  return {
    get visible() { return root.visible; },
    toggle() { if (root.visible) hide(); else show(); },
    show, hide,
    /** 每格：跟著左手腕，面向頭盔；左手控制器不在時收起 */
    update() {
      if (!root.visible) return;
      const grip = input.grip('left');
      if (!grip) { hide(); return; }
      grip.updateMatrixWorld(true);
      at.set(0, 0.03, 0.05);
      grip.localToWorld(at);
      at.y += 0.17;
      player.worldToLocal(root.position.copy(at));
      camera.getWorldPosition(eye);
      root.lookAt(eye);
    },
    dispose() {
      for (const b of buttons) { input.remove(root.getObjectByName(`Menu_${b.key}`)); b.face.texture.dispose(); }
      root.removeFromParent();
      root.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose(); } });
      title.texture.dispose(); status.texture.dispose();
    },
  };
}
