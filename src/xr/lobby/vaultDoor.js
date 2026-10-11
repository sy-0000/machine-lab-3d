// 玄關北牆的金庫圓門：圓形厚鋼門（邊緣齒輪環、中央手輪、周圍門栓插入門框）、兩側壓力錶（工安／動畫進度）、
// 門上方指示燈（未解鎖紅、解鎖綠）。原點在牆面中央的地面，+Z 朝玄關。
// 門向內（−Z，朝工作室）轉開，不會掃到站在門前的玩家。
import { BoxGeometry, CylinderGeometry, InstancedMesh, MathUtils, MeshBasicMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { createGauge, setGaugeValue, createHandwheel } from '../../vendor/steampunk-workshop/src/utils/fixtures.js';
import { add, group } from '../../vendor/steampunk-workshop/src/utils/geometry.js';
import { brassPlate } from '../ui/buttons.js';
import { canvasTexture, FONT_SANS } from '../ui/canvasText.js';

export const DOOR_CENTER_Y = 1.35;
const R_DOOR = 1.12, R_FRAME = 1.32, BOLTS = 10, RING_TEETH = 48;
const ease = t => t * t * (3 - 2 * t);

export function createVaultDoor(M) {
  const root = group('VaultDoor');
  const steel = new MeshStandardMaterial({ color: 0x7d7f80, metalness: 0.85, roughness: 0.42 });
  const steelDark = new MeshStandardMaterial({ color: 0x4a4c4e, metalness: 0.8, roughness: 0.5 });

  // 門框：厚圓環＋外圈齒輪環（齒用 InstancedMesh）
  add(root, new TorusGeometry(R_FRAME - 0.06, 0.12, 12, 64), steelDark, 'Frame', [0, DOOR_CENTER_Y, 0.04]);
  const ring = group('GearRing', root, [0, DOOR_CENTER_Y, 0.02]);
  add(ring, new TorusGeometry(R_FRAME + 0.1, 0.05, 8, 64), M.brassAged, 'RingBand');
  const teeth = new InstancedMesh(new BoxGeometry(0.07, 0.09, 0.08), M.brassAged, RING_TEETH);
  const dummy = new Object3D();
  for (let i = 0; i < RING_TEETH; i++) {
    const a = i / RING_TEETH * Math.PI * 2;
    dummy.position.set(Math.cos(a) * (R_FRAME + 0.17), Math.sin(a) * (R_FRAME + 0.17), 0);
    dummy.rotation.set(0, 0, a - Math.PI / 2);
    dummy.updateMatrix();
    teeth.setMatrixAt(i, dummy.matrix);
  }
  teeth.name = 'RingTeeth';
  ring.add(teeth);

  // 門扇：鉸鏈在左緣（x = −R），向 −Z 轉開
  const hinge = group('DoorHinge', root, [-R_DOOR, DOOR_CENTER_Y, 0.06]);
  const leaf = group('DoorLeaf', hinge, [R_DOOR, 0, 0]);
  add(leaf, new CylinderGeometry(R_DOOR, R_DOOR, 0.32, 48), steel, 'Slab', [0, 0, -0.1], [Math.PI / 2, 0, 0]);
  add(leaf, new TorusGeometry(R_DOOR * 0.82, 0.03, 8, 48), steelDark, 'FaceRing', [0, 0, 0.065]);
  add(leaf, new TorusGeometry(R_DOOR * 0.45, 0.025, 8, 40), steelDark, 'InnerRing', [0, 0, 0.065]);
  for (const y of [-0.55, 0, 0.55]) add(hinge, new CylinderGeometry(0.07, 0.07, 0.22, 12), steelDark, 'HingeKnuckle', [-0.06, y, 0.02]);
  // 門栓：插在門框裡，解鎖時往中心收回
  const bolts = [];
  for (let i = 0; i < BOLTS; i++) {
    const a = (i + 0.5) / BOLTS * Math.PI * 2;
    const b = add(leaf, new CylinderGeometry(0.045, 0.045, 0.3, 10), M.brassPolished, 'Bolt', [0, 0, -0.02], [0, 0, a - Math.PI / 2]);
    b.userData.dir = new Vector3(Math.cos(a), Math.sin(a), 0);
    bolts.push(b);
  }
  const placeBolts = k => { for (const b of bolts) b.position.copy(b.userData.dir).multiplyScalar(R_DOOR + 0.06 - k * 0.2).setZ(-0.02); };
  placeBolts(0);
  // 中央手輪（點這裡開門）
  const wheel = createHandwheel(M, 0.42, M.brassPolished, 6);
  wheel.rotation.x = Math.PI / 2; // 手輪的軸 +Y → +Z
  const wheelPivot = group('WheelPivot', leaf, [0, 0, 0.16]);
  wheelPivot.add(wheel);
  const wheelHit = add(wheelPivot, new CylinderGeometry(0.5, 0.5, 0.12, 24), new MeshBasicMaterial({ visible: false }), 'WheelHit', [0, 0, 0], [Math.PI / 2, 0, 0]);
  wheelHit.userData.noHighlight = true;

  // 兩側壓力錶（沿用工作室的錶）與名牌
  const gauges = {};
  for (const [key, x, label] of [['safety', -1.95, '工安規則'], ['clips', 1.95, '切削動畫']]) {
    const g = createGauge(M, { radius: 0.2, depth: 0.08 });
    g.object.position.set(x, 1.5, 0.08);
    root.add(g.object);
    add(root, new CylinderGeometry(0.03, 0.03, 0.5, 8), M.copper, 'GaugePipe', [x, 1.5 + 0.45, 0.04]);
    const plate = brassPlate(512, 128, (ctx, w, h) => { ctx.font = `700 64px ${FONT_SANS}`; ctx.fillText(label, w / 2, h / 2 + 2); });
    add(root, new PlaneGeometry(0.36, 0.09), new MeshBasicMaterial({ map: plate.texture, toneMapped: false }), 'GaugeLabel', [x, 1.2, 0.05]);
    gauges[key] = { needle: g.needle, value: 0, target: 0, steamAt: new Vector3(x, 2.15, 0.12) };
    setGaugeValue(g.needle, 0);
  }

  // 門上方指示燈
  const lampMat = new MeshBasicMaterial({ color: 0xff3a24, toneMapped: false });
  add(root, new CylinderGeometry(0.16, 0.18, 0.08, 16), M.brass, 'LampBase', [0, DOOR_CENTER_Y + R_FRAME + 0.42, 0.06], [Math.PI / 2, 0, 0]);
  const lamp = add(root, new SphereGeometry(0.11, 16, 12), lampMat, 'Lamp', [0, DOOR_CENTER_Y + R_FRAME + 0.42, 0.14]);
  lamp.userData.noHighlight = true;
  for (let i = 0; i < 4; i++) add(root, new TorusGeometry(0.13, 0.008, 4, 16), M.ironDark, 'LampCage', [0, DOOR_CENTER_Y + R_FRAME + 0.42, 0.14], [0, i * Math.PI / 4, 0]);

  // 門後的暖光（門轉開時看得到）：洞口內側的發光圓盤
  const glow = add(root, new CylinderGeometry(R_DOOR + 0.02, R_DOOR + 0.02, 0.02, 40), new MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false, transparent: true, opacity: 0 }), 'WorkshopGlow', [0, DOOR_CENTER_Y, -0.55], [Math.PI / 2, 0, 0]);
  glow.userData.noHighlight = true;

  // 未解鎖提示（浮在手輪上方）
  const hint = canvasTexture(1400, 180);
  {
    const { ctx } = hint;
    ctx.fillStyle = 'rgba(30,21,12,.9)'; ctx.beginPath(); ctx.roundRect(4, 4, 1392, 172, 30); ctx.fill();
    ctx.strokeStyle = '#c9a25a'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#ffd9a0'; ctx.font = `700 64px ${FONT_SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('需先閱讀工安規則並觀看切削動畫', 700, 94);
    hint.texture.needsUpdate = true;
  }
  const hintMesh = add(root, new PlaneGeometry(1.4, 0.18), new MeshBasicMaterial({ map: hint.texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), 'LockedHint', [0, DOOR_CENTER_Y + 0.62, 0.55]);
  hintMesh.renderOrder = 20;
  hintMesh.userData.noHighlight = true;

  root.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) { o.castShadow = true; o.receiveShadow = true; } });

  let shake = 0, hintTime = 0, opening = null;
  const gearSpeed = 0.06;
  return {
    object: root,
    wheelTarget: wheelPivot,
    gauges,
    get opening() { return !!opening; },
    /** 0–1 的進度；指針平滑走到目標 */
    setProgress(key, value) { gauges[key].target = MathUtils.clamp(value, 0, 1); },
    setUnlocked(on) { lampMat.color.setHex(on ? 0x38ff6a : 0xff3a24); },
    /** 未解鎖時點手輪：抖動＋提示 */
    rattle() { shake = 0.6; hintTime = 3; },
    /** 開門動畫；onBolts() 在門栓收回時呼叫（噴蒸汽），回傳的 Promise 在門開好時完成 */
    open({ onBolts } = {}) {
      if (opening) return opening.promise;
      let resolve;
      const promise = new Promise(r => { resolve = r; });
      opening = { t: 0, bolted: false, resolve, promise, onBolts };
      return promise;
    },
    /** 牆上其他齒輪的轉速倍率（開門時加速） */
    get gearBoost() { return opening ? 1 + 5 * Math.min(1, opening.t / 1.2) : 1; },
    update(dt) {
      ring.rotation.z += dt * gearSpeed * this.gearBoost;
      for (const g of Object.values(gauges)) {
        g.value += (g.target - g.value) * Math.min(1, dt * 2.5);
        setGaugeValue(g.needle, g.value);
      }
      if (shake > 0) { shake = Math.max(0, shake - dt); wheelPivot.rotation.z = Math.sin(shake * 60) * 0.05 * shake; }
      hintTime = Math.max(0, hintTime - dt);
      hintMesh.material.opacity = Math.min(1, hintTime * 2);
      hintMesh.visible = hintTime > 0;
      if (!opening) return;
      // 0–1.5 s 手輪轉；1.5–2.1 s 門栓收回（噴蒸汽）；2.1–4.0 s 門轉開、門後亮起
      const o = opening;
      o.t += dt;
      wheelPivot.rotation.z -= dt * Math.min(1, o.t / 0.6) * 5;
      if (o.t > 1.5) placeBolts(ease(Math.min(1, (o.t - 1.5) / 0.6)));
      if (o.t > 1.5 && !o.bolted) { o.bolted = true; o.onBolts?.(); }
      if (o.t > 2.1) {
        const k = ease(Math.min(1, (o.t - 2.1) / 1.9));
        hinge.rotation.y = k * 1.75;
        glow.material.opacity = k;
      }
      if (o.t > 4.0 && o.resolve) { const r = o.resolve; o.resolve = null; r(); }
    },
    dispose() { hint.texture.dispose(); steel.dispose(); steelDark.dispose(); },
  };
}

