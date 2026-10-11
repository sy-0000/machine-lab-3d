// 玄關右牆的老式放映幕：上方木製捲軸盒＋布幕＋底部配重桿，播放三段切削動畫（AnimationScreen，
// 繪圖沿用 public/previews/*.anim.js）。下方有上一段／暫停・播放／下一段／退後按鈕。原點在幕面中心，+Z 朝觀眾。
// 幕面 1.60 × 1.00 m；站在 1 m 外時標題字高約 7 cm、說明約 4.5 cm。
import { BoxGeometry, CylinderGeometry, Group, MeshBasicMaterial, PlaneGeometry } from 'three';
import { createAnimationScreen } from '../AnimationScreen.js';
import { brassButton, buttonFace } from '../ui/buttons.js';
import { add } from '../../vendor/steampunk-workshop/src/utils/geometry.js';

export const SCREEN_WIDTH = 1.6;

export async function createProjectionScreen(M) {
  const screen = await createAnimationScreen();
  const sw = SCREEN_WIDTH, sh = sw / screen.aspect;
  const root = new Group();
  root.name = 'ProjectionScreen';
  add(root, new BoxGeometry(sw + 0.24, 0.16, 0.16), M.woodPlanks, 'RollerBox', [0, sh / 2 + 0.1, 0.02]);
  for (const x of [-1, 1]) add(root, new CylinderGeometry(0.06, 0.06, 0.18, 12), M.brass, 'EndCap', [x * (sw / 2 + 0.13), sh / 2 + 0.1, 0.02], [Math.PI / 2, 0, 0]);
  add(root, new PlaneGeometry(sw + 0.06, sh + 0.06), new MeshBasicMaterial({ color: 0x2b2118 }), 'ClothBorder', [0, 0, -0.002]).userData.noHighlight = true;
  const picture = add(root, new PlaneGeometry(sw, sh), new MeshBasicMaterial({ map: screen.texture, toneMapped: false }), 'Picture', [0, 0, 0]);
  picture.userData.noHighlight = true;
  add(root, new CylinderGeometry(0.025, 0.025, sw + 0.12, 10), M.brassAged, 'WeightBar', [0, -sh / 2 - 0.03, 0.01], [0, 0, Math.PI / 2]);
  const hit = add(root, new BoxGeometry(sw, sh, 0.02), new MeshBasicMaterial({ visible: false }), 'PictureHit', [0, 0, 0.012]);
  hit.userData.noHighlight = true;

  const faces = {
    prev: buttonFace('上一段', 'prev'), next: buttonFace('下一段', 'next'), back: buttonFace('退後', 'back'),
    pause: buttonFace('暫停', 'pause'), play: buttonFace('播放', 'play'),
  };
  const buttons = {}, handles = {};
  for (const [key, x] of [['prev', -0.66], ['play', -0.22], ['next', 0.22], ['back', 0.66]]) {
    const b = brassButton(key === 'play' ? faces.pause : faces[key], { width: 0.4, height: 0.13 });
    b.object.position.set(x, -sh / 2 - 0.2, 0.02);
    b.object.name = `ScreenButton_${key}`;
    root.add(b.object);
    buttons[key] = b.object;
    handles[key] = b;
  }
  const off = screen.onChange(() => handles.play.setFace(screen.playing ? faces.pause : faces.play));
  root.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });

  return {
    object: root,
    picture: hit,
    buttons,
    screen,
    update: dt => screen.update(dt),
    dispose() { off(); screen.dispose(); Object.values(faces).forEach(f => f.texture.dispose()); },
  };
}
