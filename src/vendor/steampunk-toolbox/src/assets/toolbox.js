// 工具盒：深色木箱體、黃銅包角與鉸鏈、側邊皮革提把、正面搭扣、鉚釘；
// 內部為絨布襯墊，凹槽依每件工具的實際輪廓挖出；盒蓋內襯酒紅絨布與黃銅銘牌。
import * as THREE from 'three';
import { mesh, extrudeFlat, roundedRectShape } from '../utils/geometry.js';
import { silhouetteOutline } from './slotCarver.js';

export const BOX = { W: 2.0, D: 1.1, H: 0.4, wall: 0.05, floor: 0.03, velvetTop: 0.33, cavityDepth: 0.04 };

export function createToolbox(mat) {
  const g = new THREE.Group();
  g.name = 'Toolbox';
  const { W, D, H, wall, floor } = BOX;

  // ---- 箱體 ----
  const body = new THREE.Group();
  body.name = 'Toolbox_Body';
  const add = (geo, m, x, y, z) => { const o = mesh(geo, m); o.position.set(x, y, z); body.add(o); return o; };
  add(new THREE.BoxGeometry(W, floor, D), mat.woodDark, 0, floor / 2, 0);
  add(new THREE.BoxGeometry(W, H, wall), mat.woodDark, 0, H / 2, D / 2 - wall / 2);
  add(new THREE.BoxGeometry(W, H, wall), mat.woodDark, 0, H / 2, -D / 2 + wall / 2);
  add(new THREE.BoxGeometry(wall, H, D - wall * 2), mat.woodDark, W / 2 - wall / 2, H / 2, 0);
  add(new THREE.BoxGeometry(wall, H, D - wall * 2), mat.woodDark, -W / 2 + wall / 2, H / 2, 0);
  // 底座踢腳（較深）
  add(new THREE.BoxGeometry(W + 0.02, 0.05, D + 0.02), mat.woodDark, 0, 0.025, 0);
  // 上緣黃銅壓條
  const trim = 0.012;
  add(new THREE.BoxGeometry(W + 0.004, trim, wall + 0.006), mat.brass, 0, H + trim / 2, D / 2 - wall / 2);
  add(new THREE.BoxGeometry(W + 0.004, trim, wall + 0.006), mat.brass, 0, H + trim / 2, -D / 2 + wall / 2);
  add(new THREE.BoxGeometry(wall + 0.006, trim, D), mat.brass, W / 2 - wall / 2, H + trim / 2, 0);
  add(new THREE.BoxGeometry(wall + 0.006, trim, D), mat.brass, -W / 2 + wall / 2, H + trim / 2, 0);
  g.add(body);

  // ---- 黃銅包角 + 鉚釘 ----
  const rivetPositions = [];
  const cornerW = 0.09, t = 0.006;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2), z = sz * (D / 2);
    const faceX = add(new THREE.BoxGeometry(t, H + 0.01, cornerW), mat.brass, x + sx * t / 2, H / 2, z - sz * cornerW / 2);
    const faceZ = add(new THREE.BoxGeometry(cornerW, H + 0.01, t), mat.brass, x - sx * cornerW / 2, H / 2, z + sz * t / 2);
    faceX.name = faceZ.name = 'BrassCorner';
    for (const y of [0.06, H / 2, H - 0.05]) {
      rivetPositions.push([x + sx * (t + 0.001), y, z - sz * cornerW * 0.55, sx, 0]);
      rivetPositions.push([x - sx * cornerW * 0.55, y, z + sz * (t + 0.001), 0, sz]);
    }
  }
  // 正面與背面的橫向黃銅帶
  for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(W - cornerW * 2, 0.04, t), mat.brassDark, 0, 0.07, sz * (D / 2 + t / 2));
    for (let i = 0; i < 9; i++) rivetPositions.push([-W / 2 + cornerW + 0.1 + i * ((W - cornerW * 2 - 0.2) / 8), 0.07, sz * (D / 2 + t + 0.001), 0, sz]);
  }
  const rivetGeo = new THREE.SphereGeometry(0.009, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const rivets = new THREE.InstancedMesh(rivetGeo, mat.brassPolished, rivetPositions.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  rivetPositions.forEach(([x, y, z, nx, nz], i) => {
    q.setFromUnitVectors(up, new THREE.Vector3(nx, 0, nz).normalize());
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 0.6, 1));
    rivets.setMatrixAt(i, m4);
  });
  rivets.castShadow = true;
  rivets.name = 'Toolbox_Rivets';
  g.add(rivets);

  // ---- 側邊皮革提把（兩端黃銅座）----
  for (const sx of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx * (W / 2 + 0.02), 0.3, -0.16),
      new THREE.Vector3(sx * (W / 2 + 0.07), 0.24, -0.08),
      new THREE.Vector3(sx * (W / 2 + 0.08), 0.22, 0),
      new THREE.Vector3(sx * (W / 2 + 0.07), 0.24, 0.08),
      new THREE.Vector3(sx * (W / 2 + 0.02), 0.3, 0.16),
    ]);
    const strapGeo = new THREE.TubeGeometry(curve, 48, 0.02, 12);
    strapGeo.scale(1, 1, 1);
    const strap = mesh(strapGeo, mat.leather);
    strap.scale.set(1, 0.55, 1);
    strap.position.y = 0.12;
    strap.name = 'Toolbox_LeatherHandle';
    g.add(strap);
    for (const z of [-0.16, 0.16]) {
      const mount = mesh(new THREE.BoxGeometry(0.02, 0.07, 0.06), mat.brass);
      mount.position.set(sx * (W / 2 + 0.012), 0.285, z);
      g.add(mount);
      const pin = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 16), mat.brassPolished);
      pin.rotation.z = Math.PI / 2;
      pin.position.set(sx * (W / 2 + 0.024), 0.285, z);
      g.add(pin);
    }
  }

  // ---- 正面搭扣 ----
  const hasp = new THREE.Group();
  hasp.position.set(0, H - 0.07, D / 2 + 0.004);
  const plate = mesh(new THREE.BoxGeometry(0.12, 0.09, 0.008), mat.brass);
  hasp.add(plate);
  const loop = mesh(new THREE.TorusGeometry(0.022, 0.006, 10, 24, Math.PI), mat.brassPolished);
  loop.position.set(0, -0.005, 0.01);
  loop.rotation.z = Math.PI;
  hasp.add(loop);
  const keyhole = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.01, 12), mat.blackPaint);
  keyhole.rotation.x = Math.PI / 2;
  keyhole.position.set(0, 0.022, 0.003);
  hasp.add(keyhole);
  g.add(hasp);

  // ---- 盒蓋（向後開啟）----
  const lidPivot = new THREE.Group();
  lidPivot.name = 'Toolbox_Lid';
  lidPivot.position.set(0, H + trim, -D / 2);
  const lidT = 0.05, lidH = 0.1;
  const lid = new THREE.Group();
  const L = (geo, m, x, y, z) => { const o = mesh(geo, m); o.position.set(x, y, z); lid.add(o); return o; };
  L(new THREE.BoxGeometry(W, lidT, D), mat.woodDark, 0, lidH - lidT / 2, D / 2);
  L(new THREE.BoxGeometry(W, lidH, wall), mat.woodDark, 0, lidH / 2, D - wall / 2);
  L(new THREE.BoxGeometry(W, lidH, wall), mat.woodDark, 0, lidH / 2, wall / 2);
  L(new THREE.BoxGeometry(wall, lidH, D), mat.woodDark, W / 2 - wall / 2, lidH / 2, D / 2);
  L(new THREE.BoxGeometry(wall, lidH, D), mat.woodDark, -W / 2 + wall / 2, lidH / 2, D / 2);
  // 內襯酒紅絨布
  const liner = L(new THREE.BoxGeometry(W - wall * 2, 0.012, D - wall * 2), mat.velvetRed, 0, lidH - lidT - 0.006, D / 2);
  liner.name = 'Toolbox_LidVelvet';
  // 黃銅銘牌
  const badge = extrudeFlat(roundedRectShape(0.46, 0.13, 0.02), 0.006, mat.brass, 0.002);
  badge.rotation.x = Math.PI;
  badge.position.set(0, lidH - lidT - 0.013, D / 2);
  lid.add(badge);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const r = mesh(new THREE.SphereGeometry(0.008, 12, 8), mat.brassPolished);
    r.position.set(sx * 0.2, lidH - lidT - 0.02, D / 2 + sz * 0.045);
    lid.add(r);
  }
  // 盒蓋內側皮革束帶
  for (const x of [-0.6, 0.6]) {
    const strap = L(new THREE.BoxGeometry(0.06, 0.008, D - 0.2), mat.leatherDark, x, lidH - lidT - 0.014, D / 2);
    strap.name = 'Toolbox_LidStrap';
    const buckle = mesh(new THREE.TorusGeometry(0.035, 0.005, 8, 4), mat.brass);
    buckle.rotation.x = Math.PI / 2; buckle.rotation.z = Math.PI / 4;
    buckle.position.set(x, lidH - lidT - 0.02, D / 2 + 0.15);
    lid.add(buckle);
  }
  // 盒蓋黃銅包角
  for (const sx of [-1, 1]) for (const z of [0, D]) {
    const c = mesh(new THREE.BoxGeometry(cornerW, lidH + 0.004, cornerW), mat.brass);
    c.scale.set(1, 1, 0.08);
    c.position.set(sx * (W / 2 - cornerW / 2 + 0.003), lidH / 2, z + (z ? 0.003 : -0.003));
    lid.add(c);
  }
  lidPivot.add(lid);
  lidPivot.rotation.x = -1.83; // 約 105°
  g.add(lidPivot);

  // ---- 鉸鏈 ----
  for (const x of [-0.6, 0.6]) {
    const barrel = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 20), mat.brass);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(x, H + trim, -D / 2 - 0.012);
    g.add(barrel);
    const leaf = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.006), mat.brass);
    leaf.position.set(x, H - 0.04, -D / 2 - 0.004);
    g.add(leaf);
  }

  g.userData.lid = lidPivot;
  return g;
}

// 放置工具並依輪廓挖出絨布凹槽。回傳每件工具在盒中的「靜止姿態」（世界座標）。
export function buildInsertAndSlots(toolbox, tools, mat) {
  const { W, D, wall, floor, velvetTop, cavityDepth } = BOX;
  const iw = W - wall * 2 - 0.004, id = D - wall * 2 - 0.004;
  const cavityFloor = velvetTop - cavityDepth;

  // 實心底墊（凹槽底面）
  const base = mesh(new THREE.BoxGeometry(iw, cavityFloor - floor, id), mat.velvetGreen);
  base.position.y = floor + (cavityFloor - floor) / 2;
  base.name = 'Toolbox_VelvetBase';
  toolbox.add(base);

  const rests = [];
  const outer = new THREE.Shape();
  outer.moveTo(-iw / 2, -id / 2); outer.lineTo(iw / 2, -id / 2); outer.lineTo(iw / 2, id / 2); outer.lineTo(-iw / 2, id / 2); outer.lineTo(-iw / 2, -id / 2);

  for (const { object, slot } of tools) {
    object.position.set(0, 0, 0);
    object.rotation.set(0, slot.rotY, 0);
    object.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(object);
    object.position.set(slot.x, cavityFloor - bb.min.y + 0.001, slot.z);
    object.updateMatrixWorld(true);
    rests.push({ position: object.position.clone(), quaternion: object.quaternion.clone() });
    for (const outline of silhouetteOutline(object)) {
      if (outline.length > 2) outer.holes.push(new THREE.Path(outline.map((p) => new THREE.Vector2(p.x, -p.y))));
    }
  }

  const insertGeo = new THREE.ExtrudeGeometry(outer, { depth: cavityDepth, bevelEnabled: false, curveSegments: 4 });
  insertGeo.rotateX(-Math.PI / 2);
  const insert = mesh(insertGeo, mat.velvetGreen);
  insert.position.y = cavityFloor;
  insert.name = 'Toolbox_VelvetInsert';
  toolbox.add(insert);
  return rests;
}
