// 工作室的固定瞬移點：地上發光的黃銅圓盤（工作桌前、機台正面、機台左右兩側）。
// 圓盤都在機台鋼板（2.2 × 1.6 m）之外；左右兩側的前後位置依各機台手輪調整，換機台時整組重建。
// 每個圓盤也是一個站位：{ name, label, position, yaw（面向）, view（桌機鏡頭） }。
import { AdditiveBlending, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, Vector3 } from 'three';
import { yawFacing } from '../SceneManager.js';

const RADIUS = 0.28;
// 機台兩側瞬移點的 z（鋼板座標＝房間座標，機台正面朝 +Z）：靠近該側手輪
const SIDE_Z = { lathe: 0.15, milling: 0.4, drill: 0.05 };
const MACHINE_CENTER = new Vector3(0, 1.0, 0);

export function discStations(machineId) {
  const z = SIDE_Z[machineId] ?? 0;
  const at = (x, zz) => new Vector3(x, 0, zz);
  const facing = (p, target) => yawFacing(p, target);
  const list = [
    { name: 'desk', label: '工作桌前', position: at(0, 6.7), yaw: 0, view: { eye: [0, 1.65, 7.6], target: [0, 1.0, 0] } },
    { name: 'front', label: '機台正面', position: at(0, 1.05), yaw: 0, view: { eye: [0, 1.6, 2.1], target: [0, 1.0, 0] } },
    { name: 'left', label: '機台左側', position: at(-1.35, z), view: { eye: [-2.4, 1.6, z + 0.3], target: [0, 1.0, z] } },
    { name: 'right', label: '機台右側', position: at(1.35, z), view: { eye: [2.4, 1.6, z + 0.3], target: [0, 1.0, z] } },
  ];
  for (const s of list) s.yaw ??= facing(s.position, new Vector3(MACHINE_CENTER.x, 0, s.position.z));
  return list;
}

/** 建圓盤（加進 parent）。回傳 { object, discs: [{ station, mesh, hit }], setTarget(disc | null), update(elapsed), dispose() } */
export function createTeleportDiscs(machineId) {
  const object = new Group();
  object.name = 'TeleportDiscs';
  const brass = new MeshStandardMaterial({ color: 0xb8893f, metalness: 0.85, roughness: 0.35, emissive: 0x3a2508 });
  const plateGeo = new CylinderGeometry(RADIUS, RADIUS + 0.02, 0.025, 40);
  const ringGeo = new RingGeometry(RADIUS * 0.62, RADIUS * 0.8, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const hitGeo = new CylinderGeometry(RADIUS + 0.08, RADIUS + 0.08, 0.3, 16);
  const centerGeo = new CircleGeometry(RADIUS * 0.18, 24);
  centerGeo.rotateX(-Math.PI / 2);
  const discs = discStations(machineId).map(station => {
    const g = new Group();
    g.name = `TeleportDisc_${station.name}`;
    g.position.copy(station.position);
    const plate = new Mesh(plateGeo, brass);
    plate.position.y = 0.0125;
    plate.receiveShadow = true;
    // 發光的環與中心點（加法混合、不受燈光影響）
    const glow = new MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    const ring = new Mesh(ringGeo, glow);
    ring.position.y = 0.027;
    const dot = new Mesh(centerGeo, glow);
    dot.position.y = 0.027;
    // 看不見的感應柱：射線（或拋物線）比較好指到
    const hit = new Mesh(hitGeo, new MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.15;
    ring.userData.noHighlight = dot.userData.noHighlight = hit.userData.noHighlight = true;
    g.add(plate, ring, dot, hit);
    object.add(g);
    return { station, group: g, glow, hit, target: false };
  });
  let target = null;
  return {
    object,
    discs,
    /** 拋物線指到的圓盤（高亮） */
    setTarget(disc) { target = disc; },
    update(elapsed) {
      for (const [i, d] of discs.entries()) {
        const on = d === target;
        d.glow.opacity = on ? 1 : 0.4 + Math.sin(elapsed * 2.2 + i) * 0.12;
        d.glow.color.setHex(on ? 0xfff0c0 : 0xffb347);
        d.group.scale.setScalar(on ? 1.12 : 1);
      }
    },
    dispose() {
      plateGeo.dispose(); ringGeo.dispose(); hitGeo.dispose(); centerGeo.dispose(); brass.dispose();
      for (const d of discs) { d.glow.dispose(); d.hit.material.dispose(); }
    },
  };
}
