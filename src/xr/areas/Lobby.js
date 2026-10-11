// 大門口（大廳）：站在穹頂工作室的南面大門外。
// 工作室原本沒有外牆（室內的磚牆是朝內的單面平面），這裡另建外牆、拱門與玻璃穹頂的外觀（穹頂沿用工作室的 createDome），
// 不改動室內場景。座標與工作室相同：大門在南牆，室內牆面 z = 10，外牆面 z = 10.6。
// 三個黃銅操作台＝三個入口（都進工作室，只是一進去顯示的畫面不同）；門旁立式螢幕輪播首頁的三段機台動畫。
import {
  CylinderGeometry, DirectionalLight, Scene, ExtrudeGeometry, FogExp2, Group, HemisphereLight, Mesh, MeshBasicMaterial,
  PlaneGeometry, PointLight, Shape, SphereGeometry, BoxGeometry, Vector3,
} from 'three';
import { ROOM } from '../../vendor/steampunk-workshop/src/config/layout.js';
import { createSky } from '../../vendor/steampunk-workshop/src/core/sky.js';
import { createMaterials } from '../../vendor/steampunk-workshop/src/materials/library.js';
import { createDome } from '../../vendor/steampunk-workshop/src/structure/dome.js';
import { GeoBatch, add, group, compose } from '../../vendor/steampunk-workshop/src/utils/geometry.js';
import { prewarmWorkshop, warmUpGpu } from '../../prewarm/prewarm.js';
import { createAnimationScreen } from '../AnimationScreen.js';
import { canvasTexture, fontsReady, FONT_SANS, FONT_SERIF } from '../ui/canvasText.js';
import { disposeTree } from '../dispose.js';
import { yawFacing } from '../SceneManager.js';

const AE = ROOM.apothem + ROOM.wallThickness; // 外牆面到中心的距離
const H = ROOM.wallHeight;
export const LOBBY_SPOT = new Vector3(0, 0, 12.6);
const SCREEN_AT = new Vector3(2.35, 0, 11.45);
const ENTRANCES = [
  { start: 'safety', x: -1.0, title: '工安規則', sub: '先讀完工安守則' },
  { start: 'factory', x: 0, title: '進入工廠', sub: '從工安規則開始' },
  { start: 'toolbox', x: 1.0, title: '工具箱', sub: '13 項機工實習工具' },
];

// ---- 黃銅銘牌（CanvasTexture）
function brassPlate(width, height, draw) {
  const surface = canvasTexture(width, height), { ctx } = surface;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#e6c27a'); g.addColorStop(0.5, '#c79a4e'); g.addColorStop(1, '#9c7333');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, 0, width, height, height * 0.12); ctx.fill();
  ctx.strokeStyle = '#5b3f17'; ctx.lineWidth = height * 0.035; ctx.beginPath(); ctx.roundRect(height * 0.05, height * 0.05, width - height * 0.1, height - height * 0.1, height * 0.09); ctx.stroke();
  for (const [x, y] of [[0.09, 0.15], [0.91, 0.15], [0.09, 0.85], [0.91, 0.85]]) { ctx.fillStyle = '#6e4c1d'; ctx.beginPath(); ctx.arc(width * x, height * y, height * 0.035, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#3a2610'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  draw(ctx, width, height);
  surface.texture.needsUpdate = true;
  return surface;
}

// ---- 外牆：八面磚牆（朝外）、鑄鐵壁柱、簷口、石材牆基，上面是工作室的玻璃穹頂
function createExterior(M, root) {
  const brick = M.brick.clone();
  brick.vertexColors = false; // 室內磚牆靠頂點色做髒污；外牆沒有頂點色
  brick.color.set(0xd9c6b4);
  const L = 2 * AE * Math.tan(Math.PI / ROOM.sides) + 0.04;
  for (let k = 0; k < ROOM.sides; k++) {
    const t = k * Math.PI * 2 / ROOM.sides, s = Math.sin(t), c = Math.cos(t), yaw = Math.PI - t;
    const geo = new PlaneGeometry(L, H, 1, 1), pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.8 + k * 0.37, (pos.getY(i) + H / 2) / 1.8);
    const wall = add(root, geo, brick, `OuterWall_${k}`, [s * AE, H / 2, -c * AE], [0, yaw, 0]);
    wall.receiveShadow = true;
    add(root, new BoxGeometry(L, 0.7, 0.26), M.stone, `Plinth_${k}`, [s * (AE + 0.1), 0.35, -c * (AE + 0.1)], [0, yaw, 0]).receiveShadow = true;
    add(root, new BoxGeometry(L + 0.3, 0.45, 1.05), M.castIron, `Cornice_${k}`, [s * (AE - 0.35), H + 0.1, -c * (AE - 0.35)], [0, yaw, 0]);
    const a = (k + 0.5) * Math.PI * 2 / ROOM.sides, r = (AE + 0.12) / Math.cos(Math.PI / ROOM.sides);
    add(root, new BoxGeometry(0.75, H + 0.5, 0.75), M.ironDark, `Pilaster_${k}`, [Math.sin(a) * r, (H + 0.5) / 2, -Math.cos(a) * r], [0, -a, 0]).castShadow = true;
  }
  const dome = createDome(M);
  root.add(dome.object);
}

// ---- 南面拱門（外側）：兩扇木門、鐵鉸鏈帶、銅拉環、磚砌拱圈與石門檻。原點在外牆面中央的地面，+Z 朝外
function createDoor(M) {
  const g = group('OuterDoor');
  const W = 2.2, R = W / 2, hRect = 2.5;
  for (const side of [-1, 1]) {
    const s = new Shape(), x0 = side < 0 ? -R : 0, x1 = side < 0 ? 0 : R;
    s.moveTo(x0, 0); s.lineTo(x1, 0);
    if (side < 0) { s.lineTo(0, hRect + R); s.absarc(0, hRect, R, Math.PI / 2, Math.PI, false); }
    else { s.lineTo(R, hRect); s.absarc(0, hRect, R, 0, Math.PI / 2, false); }
    s.lineTo(x0, 0);
    const geo = new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 20 });
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.1, uv.getY(i) / 2.2);
    add(g, geo, M.woodPlanks, side < 0 ? 'LeafLeft' : 'LeafRight', [side * 0.006, 0, 0.02]);
    for (const y of [0.5, 1.6, 2.6]) {
      const len = y > 2.5 ? Math.sqrt(R * R - (y - hRect) ** 2) - 0.05 : R - 0.06;
      add(g, new BoxGeometry(len, 0.075, 0.012), M.ironDark, 'StrapHinge', [side * (len / 2 + 0.03), y, 0.112]);
      add(g, new CylinderGeometry(0.04, 0.04, 0.09, 12), M.ironDark, 'HingeKnuckle', [side * (R - 0.02), y, 0.1]);
    }
    add(g, new CylinderGeometry(0.075, 0.075, 0.024, 24, 1, true), M.brassAged, 'RingPull', [side * 0.16, 1.12, 0.135], [Math.PI / 2, 0, 0]);
    add(g, new CylinderGeometry(0.035, 0.035, 0.03, 12), M.brassAged, 'RingBoss', [side * 0.16, 1.24, 0.12], [Math.PI / 2, 0, 0]);
  }
  const arch = new GeoBatch(), n = 17;
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) * (Math.PI / n), r = R + 0.2;
    arch.add(new BoxGeometry(0.18, 0.42, 0.22), compose([Math.cos(a) * r, hRect + Math.sin(a) * r, 0.05], [0, 0, a - Math.PI / 2]));
  }
  for (const s of [-1, 1]) for (let j = 0; j < 7; j++) {
    const w = j % 2 ? 0.34 : 0.26;
    arch.add(new BoxGeometry(w, 0.33, 0.22), compose([s * (R + 0.03 + w / 2), 0.2 + j * 0.35, 0.05]));
  }
  g.add(arch.build(M.brickArch, 'ArchSurround'));
  add(g, new BoxGeometry(W + 0.8, 0.08, 0.6), M.stone, 'Threshold', [0, 0.04, 0.22]);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---- 門兩側的壁燈
function createLantern(M) {
  const g = group('Lantern');
  add(g, new BoxGeometry(0.05, 0.05, 0.32), M.ironDark, 'Bracket', [0, 0.32, -0.12]);
  add(g, new CylinderGeometry(0.13, 0.1, 0.06, 6), M.brass, 'Cap', [0, 0.3, 0]);
  add(g, new CylinderGeometry(0.09, 0.09, 0.32, 6, 1, true), M.glassAmber, 'Glass', [0, 0.11, 0]);
  add(g, new CylinderGeometry(0.1, 0.12, 0.05, 6), M.brass, 'Base', [0, -0.07, 0]);
  const bulb = add(g, new SphereGeometry(0.045, 16, 10), new MeshBasicMaterial({ color: 0xffc879, toneMapped: false }), 'Bulb', [0, 0.1, 0]);
  const light = new PointLight(0xffb468, 4, 8, 2);
  light.position.set(0, 0.1, 0.05);
  g.add(light);
  return { object: g, light, bulb };
}

// ---- 入口操作台：鑄鐵底座＋黃銅立柱＋斜面台頭（銘牌、蘑菇按鈕）。+Z 朝玩家
function createConsole(M, entry) {
  const g = group(`Entrance_${entry.start}`);
  add(g, new CylinderGeometry(0.2, 0.24, 0.05, 24), M.ironDark, 'Foot', [0, 0.025, 0]);
  add(g, new CylinderGeometry(0.055, 0.07, 0.8, 16), M.brass, 'Column', [0, 0.44, 0]);
  const head = group('Head', g, [0, 0.9, 0], [0.55, 0, 0]);
  add(head, new BoxGeometry(0.6, 0.07, 0.42), M.castIron, 'Desk', [0, 0, 0]);
  const plate = brassPlate(640, 300, (ctx, w, h) => {
    ctx.font = `900 108px ${FONT_SERIF}`; ctx.fillText(entry.title, w / 2, h * 0.42);
    ctx.font = `500 42px ${FONT_SANS}`; ctx.fillStyle = '#4a3216'; ctx.fillText(entry.sub, w / 2, h * 0.78);
  });
  add(head, new PlaneGeometry(0.52, 0.244), new MeshBasicMaterial({ map: plate.texture, toneMapped: false }), 'Plate', [0, 0.037, 0.04], [-Math.PI / 2, 0, 0]).userData.noHighlight = true;
  add(head, new CylinderGeometry(0.035, 0.04, 0.04, 20), M.brassPolished, 'Button', [0, 0.05, -0.16]);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---- 立式螢幕：兩根黃銅柱、銅框、畫面，下方一排按鈕（上一段／暫停・播放／下一段）
function iconButton(label, icon) {
  const surface = brassPlate(384, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a2610';
    const cx = 74, cy = h / 2;
    ctx.beginPath();
    if (icon === 'prev') { ctx.moveTo(cx + 18, cy - 24); ctx.lineTo(cx - 18, cy); ctx.lineTo(cx + 18, cy + 24); }
    else if (icon === 'next') { ctx.moveTo(cx - 18, cy - 24); ctx.lineTo(cx + 18, cy); ctx.lineTo(cx - 18, cy + 24); }
    else if (icon === 'play') { ctx.moveTo(cx - 14, cy - 24); ctx.lineTo(cx + 22, cy); ctx.lineTo(cx - 14, cy + 24); }
    else { ctx.rect(cx - 18, cy - 22, 12, 44); ctx.rect(cx + 6, cy - 22, 12, 44); }
    ctx.fill();
    ctx.font = `700 50px ${FONT_SANS}`; ctx.textAlign = 'left'; ctx.fillText(label, 116, cy + 2);
  });
  return surface;
}

function createScreenStand(M, screen) {
  const g = group('AnimationScreen');
  const sw = 1.56, sh = sw / screen.aspect, cy = 1.55;
  for (const x of [-0.82, 0.82]) {
    add(g, new CylinderGeometry(0.035, 0.045, cy + sh / 2 + 0.1, 12), M.brass, 'Post', [x, (cy + sh / 2 + 0.1) / 2, -0.04]);
    add(g, new CylinderGeometry(0.12, 0.14, 0.04, 16), M.ironDark, 'Foot', [x, 0.02, -0.04]);
  }
  add(g, new BoxGeometry(sw + 0.14, sh + 0.14, 0.06), M.brassAged, 'Frame', [0, cy, -0.03]);
  add(g, new PlaneGeometry(sw, sh), new MeshBasicMaterial({ map: screen.texture, toneMapped: false }), 'Picture', [0, cy, 0.002]);
  add(g, new BoxGeometry(1.34, 0.17, 0.08), M.castIron, 'ButtonBar', [0, cy - sh / 2 - 0.16, -0.01]);
  const buttons = {}, y = cy - sh / 2 - 0.16;
  for (const [key, x] of [['prev', -0.43], ['play', 0], ['next', 0.43]]) {
    const b = group(`Button_${key}`, g, [x, y, 0.035]);
    add(b, new BoxGeometry(0.4, 0.13, 0.03), M.brass, 'Cap', [0, 0, 0]);
    const face = add(b, new PlaneGeometry(0.38, 0.127), new MeshBasicMaterial({ toneMapped: false }), 'Face', [0, 0, 0.0155]);
    face.userData.noHighlight = true;
    buttons[key] = { object: b, face };
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { object: g, buttons };
}

export function createLobby({ renderer, camera, quality, environment, input, go, status }) {
  let scene = null, sky = null, screen = null, lanterns = [], disposed = false, offChange = null;
  const textures = [];

  return {
    get scene() { return scene; },
    view: { eye: [0, 1.65, 14.6], target: [0.5, 1.4, 11.2] },

    async enter() {
      const alive = () => { if (disposed) throw new Error('cancelled'); };
      status('正在前往工作室大門…');
      scene = new Scene();
      scene.environment = environment.texture; // 沿用工作室的暖色反射環境，讓黃銅看起來像黃銅
      scene.fog = new FogExp2(0xd8cbb4, 0.006);
      scene.environmentIntensity = 0.45;
      await Promise.all([prewarmWorkshop(), fontsReady()]);
      alive();
      const M = createMaterials(quality);
      const root = new Group();
      root.name = 'Lobby';
      sky = createSky(root);

      // 天光＋從西南方來的斜陽（照亮南面門牆；天空的太陽在北邊，門牆本來是背光面）
      root.add(new HemisphereLight(0xdfe9f5, 0x6b5a46, 1.1));
      const sun = new DirectionalLight(0xffe2b8, 2.4);
      sun.position.set(-7, 11, 20);
      sun.target.position.set(0, 0, 10.5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -3, near: 1, far: 40 });
      sun.shadow.bias = -0.0004;
      root.add(sun, sun.target);

      const ground = new PlaneGeometry(140, 140);
      ground.rotateX(-Math.PI / 2);
      const guv = ground.attributes.uv;
      for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 35, guv.getY(i) * 35);
      add(root, ground, M.stone, 'Ground').receiveShadow = true;
      const apron = M.concrete.clone();
      apron.vertexColors = false;
      apron.color.set(0xcfc6b8);
      add(root, new BoxGeometry(7, 0.04, 3.6), apron, 'Apron', [0, 0.02, AE + 1.8]).receiveShadow = true;

      createExterior(M, root);
      const door = createDoor(M);
      door.position.set(0, 0, AE + 0.005);
      root.add(door);
      for (const x of [-1.85, 1.85]) {
        const lantern = createLantern(M);
        lantern.object.position.set(x, 2.45, AE + 0.17);
        root.add(lantern.object);
        lanterns.push(lantern);
      }
      const sign = brassPlate(1400, 260, (ctx, w, h) => {
        ctx.font = `900 120px ${FONT_SERIF}`; ctx.fillText('MACHINE LAB · 蒸汽工作室', w / 2, h * 0.54);
      });
      textures.push(sign.texture);
      add(root, new PlaneGeometry(2.8, 0.52), new MeshBasicMaterial({ map: sign.texture, toneMapped: false }), 'Sign', [0, 4.35, AE + 0.02]);

      // 三個入口
      for (const entry of ENTRANCES) {
        const c = createConsole(M, entry);
        c.position.set(entry.x, 0, 11.85);
        c.rotation.y = yawFacing(LOBBY_SPOT, c.position); // 台頭正面（+Z）朝玩家
        root.add(c);
        input.add(c, { onSelect: () => go('workshop', { start: entry.start }) });
      }

      // 動畫螢幕
      status('準備動畫螢幕…');
      screen = await createAnimationScreen();
      alive();
      textures.push(screen.texture);
      const stand = createScreenStand(M, screen);
      stand.object.position.copy(SCREEN_AT);
      stand.object.rotation.y = yawFacing(LOBBY_SPOT, SCREEN_AT);
      root.add(stand.object);
      const faces = {
        prev: iconButton('上一段', 'prev'), next: iconButton('下一段', 'next'),
        pause: iconButton('暫停', 'pause'), play: iconButton('播放', 'play'),
      };
      Object.values(faces).forEach(f => textures.push(f.texture));
      const { buttons } = stand;
      const refresh = () => {
        buttons.prev.face.material.map = faces.prev.texture;
        buttons.next.face.material.map = faces.next.texture;
        buttons.play.face.material.map = screen.playing ? faces.pause.texture : faces.play.texture;
        for (const b of Object.values(buttons)) b.face.material.needsUpdate = true;
      };
      refresh();
      offChange = screen.onChange(refresh);
      input.add(buttons.prev.object, { onSelect: () => screen.prev() });
      input.add(buttons.play.object, { onSelect: () => screen.togglePlay() });
      input.add(buttons.next.object, { onSelect: () => screen.next() });

      await warmUpGpu(renderer, root, camera, scene);
      alive();
      scene.add(root);
      return { spawn: LOBBY_SPOT.clone(), yaw: 0 };
    },

    update(dt, elapsed) {
      sky?.update(dt, elapsed);
      screen?.update(dt);
      for (const [i, l] of lanterns.entries()) l.light.intensity = 4 * (1 + Math.sin(elapsed * 2.1 + i * 1.7) * 0.03 + Math.sin(elapsed * 9.3 + i) * 0.015);
    },

    exit() {
      if (disposed) return;
      disposed = true;
      offChange?.();
      if (scene) disposeTree(scene); // 共用的反射環境不在這裡釋放
      screen?.dispose();
      textures.forEach(t => t.dispose());
      scene = null; screen = null; lanterns = [];
    },
  };
}
