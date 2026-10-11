// 門外看到的建築：八角工作室的外牆（朝外的磚牆、鑄鐵壁柱、簷口、石材牆基）＋工作室原本的玻璃穹頂，
// 以及貼在南面外牆上的玄關（附屬建築）：磚牆、平屋頂與簷口、拱門與雙開木門、兩盞煤氣燈、
// 用鏈子掛在拱門上方的舊木招牌「Machine Yard」。工作室內部完全不動（這些都在大門口場景裡）。
//
// 座標（公尺，與工作室相同）：八角外牆面 z = 10.6；玄關室內 x −3～3、z 10.6～15.6、高 4.2；
// 玄關外牆面 x = ±3.4、z = 16.0。南牆（八角 k = 4）在金庫門處挖一個圓洞，洞內有厚度（牆厚 0.6）。
import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, MeshBasicMaterial, Path, PlaneGeometry, PointLight, Shape, SphereGeometry, TorusGeometry } from 'three';
import { ROOM } from '../../vendor/steampunk-workshop/src/config/layout.js';
import { createDome } from '../../vendor/steampunk-workshop/src/structure/dome.js';
import { GeoBatch, add, group, compose } from '../../vendor/steampunk-workshop/src/utils/geometry.js';
import { canvasTexture, FONT_SERIF } from '../ui/canvasText.js';
import { DOOR_CENTER_Y } from './vaultDoor.js';

export const AE = ROOM.apothem + ROOM.wallThickness; // 八角外牆面到中心：10.6
export const VEST = { x: 3.0, z0: AE, z1: 15.6, height: 4.2, wall: 0.4 };
export const FACADE_Z = VEST.z1 + VEST.wall; // 16.0
const H = ROOM.wallHeight, ANNEX_H = 4.7;
const DOOR = { W: 2.2, R: 1.1, rect: 2.5 };
export const VAULT_HOLE_R = 1.18;

// 擠出幾何的 UV 依公尺計（磚的貼圖 1.8 m 一個循環）
function metricUV(geo, scale = 1.8) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / scale, uv.getY(i) / scale);
  return geo;
}
function archPath(target, cx = 0) {
  const { R, rect } = DOOR;
  target.moveTo(cx - R, 0); target.lineTo(cx - R, rect); target.absarc(cx, rect, R, Math.PI, 0, true); target.lineTo(cx + R, 0); target.lineTo(cx - R, 0);
  return target;
}

export function outerBrick(M) {
  const brick = M.brick.clone();
  brick.vertexColors = false; // 室內磚牆靠頂點色做髒污；外牆沒有頂點色
  brick.color.set(0xd9c6b4);
  return brick;
}

function createOctagon(M, root, brick) {
  const L = 2 * AE * Math.tan(Math.PI / ROOM.sides) + 0.04;
  for (let k = 0; k < ROOM.sides; k++) {
    const t = k * Math.PI * 2 / ROOM.sides, s = Math.sin(t), c = Math.cos(t), yaw = Math.PI - t;
    if (k === 4) {
      // 南牆：整面做成有厚度的牆，中間挖金庫門的圓洞
      const shape = new Shape();
      shape.moveTo(-L / 2, 0); shape.lineTo(L / 2, 0); shape.lineTo(L / 2, H); shape.lineTo(-L / 2, H); shape.lineTo(-L / 2, 0);
      shape.holes.push(new Path().absarc(0, DOOR_CENTER_Y, VAULT_HOLE_R, 0, Math.PI * 2, true));
      const geo = metricUV(new ExtrudeGeometry(shape, { depth: ROOM.wallThickness, bevelEnabled: false, curveSegments: 40 }));
      add(root, geo, brick, 'OuterWall_4', [0, 0, ROOM.apothem]).receiveShadow = true;
    } else {
      const geo = new PlaneGeometry(L, H, 1, 1), pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.8 + k * 0.37, (pos.getY(i) + H / 2) / 1.8);
      add(root, geo, brick, `OuterWall_${k}`, [s * AE, H / 2, -c * AE], [0, yaw, 0]).receiveShadow = true;
    }
    // 南面的石材牆基在玄關裡面，會擋到金庫門下緣，所以不放
    if (k !== 4) add(root, new BoxGeometry(L, 0.7, 0.26), M.stone, `Plinth_${k}`, [s * (AE + 0.1), 0.35, -c * (AE + 0.1)], [0, yaw, 0]).receiveShadow = true;
    add(root, new BoxGeometry(L + 0.3, 0.45, 1.05), M.castIron, `Cornice_${k}`, [s * (AE - 0.35), H + 0.1, -c * (AE - 0.35)], [0, yaw, 0]);
    const a = (k + 0.5) * Math.PI * 2 / ROOM.sides, r = (AE + 0.12) / Math.cos(Math.PI / ROOM.sides);
    add(root, new BoxGeometry(0.75, H + 0.5, 0.75), M.ironDark, `Pilaster_${k}`, [Math.sin(a) * r, (H + 0.5) / 2, -Math.cos(a) * r], [0, -a, 0]).castShadow = true;
  }
  root.add(createDome(M).object);
}

// 玄關的外殼：側牆、南牆（拱門洞）、屋頂與簷口；室內面另外上較淺的磚色
function createAnnex(M, root, brick) {
  const { x, z1, height, wall } = VEST, len = z1 - AE + wall;
  const inner = brick.clone();
  inner.color.set(0xe8d6c2);
  // 兩側牆（實心盒子：內外兩面都看得到）
  for (const side of [-1, 1]) {
    const geo = metricUV(new BoxGeometry(wall, ANNEX_H, len));
    add(root, geo, brick, `AnnexSide_${side}`, [side * (x + wall / 2), ANNEX_H / 2, AE + len / 2]).receiveShadow = true;
    // 室內面貼一層較淺的磚
    const face = new PlaneGeometry(len - wall, height), uv = face.attributes.uv, pos = face.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.8, (pos.getY(i) + height / 2) / 1.8);
    add(root, face, inner, `AnnexInnerSide_${side}`, [side * (x - 0.002), height / 2, (AE + z1) / 2], [0, -side * Math.PI / 2, 0]).receiveShadow = true;
  }
  // 南牆：有厚度、中間是拱門洞
  const W = 2 * (x + wall), shape = new Shape();
  shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(W / 2, ANNEX_H); shape.lineTo(-W / 2, ANNEX_H); shape.lineTo(-W / 2, 0);
  shape.holes.push(archPath(new Path()));
  const south = metricUV(new ExtrudeGeometry(shape, { depth: wall, bevelEnabled: false, curveSegments: 24 }));
  add(root, south, brick, 'AnnexSouth', [0, 0, z1]).receiveShadow = true;
  // 屋頂、簷口、天花板
  add(root, new BoxGeometry(W + 0.2, 0.3, len + 0.2), M.castIron, 'AnnexRoof', [0, ANNEX_H + 0.15, AE + len / 2]).castShadow = true;
  add(root, new BoxGeometry(W + 0.4, 0.18, 0.4), M.castIron, 'AnnexCornice', [0, ANNEX_H + 0.05, FACADE_Z + 0.1]);
  const ceiling = new PlaneGeometry(2 * x, z1 - AE);
  ceiling.rotateX(Math.PI / 2);
  add(root, ceiling, M.woodPlanks, 'Ceiling', [0, height, (AE + z1) / 2]);
  for (let i = 0; i < 4; i++) add(root, new BoxGeometry(2 * x, 0.16, 0.14), M.woodPlanks, 'CeilingBeam', [0, height - 0.08, AE + 0.7 + i * 1.2]);
  // 石材牆基
  add(root, new BoxGeometry(W + 0.12, 0.6, 0.12), M.stone, 'AnnexPlinth', [0, 0.3, FACADE_Z + 0.06]).receiveShadow = true;
}

// 雙開木門（向內推開）＋外側磚砌拱圈與石門檻
function createDoors(M) {
  const g = group('OuterDoors');
  const { W, R, rect } = DOOR, leaves = [];
  for (const side of [-1, 1]) {
    const s = new Shape(), x0 = side < 0 ? 0 : -R, x1 = side < 0 ? R : 0; // 以鉸鏈為原點
    s.moveTo(x0, 0); s.lineTo(x1, 0);
    if (side < 0) { s.lineTo(R, rect + R); s.absarc(R, rect, R, Math.PI / 2, Math.PI, false); }
    else { s.lineTo(0, rect); s.absarc(-R, rect, R, 0, Math.PI / 2, false); }
    s.lineTo(x0, 0);
    const pivot = group(side < 0 ? 'LeafLeftPivot' : 'LeafRightPivot', g, [side * R, 0, 0]);
    const geo = new ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 20 });
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.1, uv.getY(i) / 2.2);
    add(pivot, geo, M.woodPlanks, 'Leaf', [0, 0, -0.04]);
    const dir = -side; // 從鉸鏈往門縫的方向
    for (const y of [0.5, 1.6, 2.6]) {
      const len = y > 2.5 ? Math.sqrt(R * R - (y - rect) ** 2) - 0.05 : R - 0.06;
      add(pivot, new BoxGeometry(len, 0.075, 0.012), M.ironDark, 'StrapHinge', [dir * (len / 2 + 0.03), y, 0.052]);
      add(pivot, new CylinderGeometry(0.04, 0.04, 0.09, 12), M.ironDark, 'HingeKnuckle', [dir * 0.02, y, 0.04]);
    }
    add(pivot, new TorusGeometry(0.075, 0.012, 8, 24), M.brassAged, 'RingPull', [dir * (R - 0.16), 1.12, 0.075]);
    leaves.push({ pivot, side });
  }
  const arch = new GeoBatch(), n = 17;
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) * (Math.PI / n), r = R + 0.2;
    arch.add(new BoxGeometry(0.18, 0.42, 0.22), compose([Math.cos(a) * r, rect + Math.sin(a) * r, 0.29], [0, 0, a - Math.PI / 2]));
  }
  for (const s of [-1, 1]) for (let j = 0; j < 7; j++) {
    const w = j % 2 ? 0.34 : 0.26;
    arch.add(new BoxGeometry(w, 0.33, 0.22), compose([s * (R + 0.03 + w / 2), 0.2 + j * 0.35, 0.29]));
  }
  g.add(arch.build(M.brickArch, 'ArchSurround'));
  add(g, new BoxGeometry(W + 0.8, 0.08, 0.9), M.stone, 'Threshold', [0, 0.04, 0.3]);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { object: g, leaves };
}

// 煤氣燈（沿用第 2 階段）
function createLantern(M) {
  const g = group('Lantern');
  add(g, new BoxGeometry(0.05, 0.05, 0.32), M.ironDark, 'Bracket', [0, 0.32, -0.12]);
  add(g, new CylinderGeometry(0.13, 0.1, 0.06, 6), M.brass, 'Cap', [0, 0.3, 0]);
  add(g, new CylinderGeometry(0.09, 0.09, 0.32, 6, 1, true), M.glassAmber, 'Glass', [0, 0.11, 0]);
  add(g, new CylinderGeometry(0.1, 0.12, 0.05, 6), M.brass, 'Base', [0, -0.07, 0]);
  add(g, new SphereGeometry(0.045, 16, 10), new MeshBasicMaterial({ color: 0xffc879, toneMapped: false }), 'Bulb', [0, 0.1, 0]);
  const light = new PointLight(0xffb468, 4, 8, 2);
  light.position.set(0, 0.1, 0.05);
  g.add(light);
  return { object: g, light };
}

// 舊木招牌（鏈條吊掛）：木紋底、淺金色字「Machine Yard」
function createSign(M) {
  const surface = canvasTexture(1600, 360), { ctx } = surface, w = 1600, h = 360;
  const g0 = ctx.createLinearGradient(0, 0, 0, h);
  g0.addColorStop(0, '#6b4a2c'); g0.addColorStop(0.5, '#5a3c22'); g0.addColorStop(1, '#4a3019');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { // 木紋
    const y = (i * 53.7) % h, a = 0.05 + (i % 5) * 0.02;
    ctx.strokeStyle = `rgba(30,18,8,${a})`; ctx.lineWidth = 2 + (i % 3);
    ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= w; x += 80) ctx.lineTo(x, y + Math.sin(x / 140 + i) * 6); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(25,14,6,.7)'; ctx.lineWidth = 14; ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.font = `900 170px ${FONT_SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(20,10,4,.7)'; ctx.fillText('Machine Yard', w / 2 + 5, h / 2 + 9);
  const gold = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.75);
  gold.addColorStop(0, '#f6dc9a'); gold.addColorStop(0.5, '#d9b46a'); gold.addColorStop(1, '#b8893f');
  ctx.fillStyle = gold; ctx.fillText('Machine Yard', w / 2, h / 2 + 4);
  surface.texture.needsUpdate = true;
  const g = group('MachineYardSign');
  const bw = 2.4, bh = bw * h / w;
  add(g, new BoxGeometry(bw + 0.06, bh + 0.06, 0.06), M.woodPlanks, 'Board', [0, 0, -0.035]);
  add(g, new PlaneGeometry(bw, bh), new MeshBasicMaterial({ map: surface.texture, toneMapped: false }), 'Face', [0, 0, 0]);
  // 鏈條：一串小環，從招牌上緣兩端吊到牆上的鐵鉤
  const links = new GeoBatch();
  for (const sx of [-0.9, 0.9]) for (let i = 0; i < 6; i++) links.add(new TorusGeometry(0.022, 0.006, 4, 10), compose([sx, bh / 2 + 0.03 + i * 0.04, 0], [0, i % 2 ? Math.PI / 2 : 0, 0]));
  g.add(links.build(M.ironDark, 'Chains'));
  for (const sx of [-0.9, 0.9]) add(g, new BoxGeometry(0.04, 0.04, 0.22), M.ironDark, 'Hook', [sx, bh / 2 + 0.28, -0.11]);
  g.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });
  return { object: g, texture: surface.texture };
}

export function createExterior(M, root) {
  const brick = outerBrick(M);
  createOctagon(M, root, brick);
  createAnnex(M, root, brick);
  const occluders = ['AnnexSide_-1', 'AnnexSide_1', 'AnnexSouth', 'AnnexRoof', 'OuterWall_4'].map(n => root.getObjectByName(n));
  const doors = createDoors(M);
  doors.object.position.set(0, 0, VEST.z1 + VEST.wall / 2 - 0.04);
  root.add(doors.object);
  const lanterns = [];
  for (const x of [-1.85, 1.85]) {
    const lantern = createLantern(M);
    lantern.object.position.set(x, 2.45, FACADE_Z + 0.17);
    root.add(lantern.object);
    lanterns.push(lantern);
  }
  const sign = createSign(M);
  sign.object.position.set(0, 4.05, FACADE_Z + 0.28);
  root.add(sign.object);

  let openT = -1;
  return {
    doors: doors.object,
    lanterns,
    textures: [sign.texture],
    occluders,
    get doorOpen() { return openT >= 1; },
    /** 推開大門（約 1 秒）；回傳在門開好時完成的 Promise */
    openDoors() {
      if (openT >= 0) return Promise.resolve();
      openT = 0;
      return new Promise(resolve => { this._opened = resolve; });
    },
    update(dt, elapsed) {
      for (const [i, l] of lanterns.entries()) l.light.intensity = 4 * (1 + Math.sin(elapsed * 2.1 + i * 1.7) * 0.03 + Math.sin(elapsed * 9.3 + i) * 0.015);
      if (openT < 0 || openT >= 1) return;
      openT = Math.min(1, openT + dt / 1.0);
      const k = openT * openT * (3 - 2 * openT), angle = k * 1.45;
      // 左扇鉸鏈在 −X、門板往 +X 延伸：轉 +angle 往 −Z（向內）；右扇相反
      for (const { pivot, side } of doors.leaves) pivot.rotation.y = side < 0 ? angle : -angle;
      if (openT >= 1) this._opened?.();
    },
  };
}

