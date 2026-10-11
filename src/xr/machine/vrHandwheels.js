// VR 機台手輪：射線指著手輪按住 grip 抓住，手繞手輪中心畫圈轉動（createWheelGrab），
// 每次角度變化送出 MachineSession 的 wheel.turnBy（和桌機按住手輪同一條路徑：行程上下限、切削、切屑都一樣）。
// 每轉過 10° 輕震一下；碰到行程上下限時較強震動一次，手輪轉不過去（手輪角度由機台控制）。
// 第 6 階段先開放一個手輪（車床縱向進給）測手感，確認後再套用到所有手輪。
import { Box3, CylinderGeometry, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { setHighlight } from '../../machines/runtime.js';
import { createWheelGrab } from '../interaction/wheelGrab.js';

export const VR_WHEELS = { lathe: ['carriageHandwheel'], milling: [], drill: [] };
const TICK = Math.PI / 18;
// 手（控制器）離手輪中心 0.22 m 內＝手就在手輪上：用手的位置畫圈；更遠時改用射線打在手輪平面上的點
// （站在圓盤上用射線抓、或模擬器裡轉動控制器瞄準，都能轉）
const REACH = 0.22;

/** 回傳移除函式 */
export function attachHandwheels({ session, runtime, input, machineId }) {
  const offs = [], hits = [];
  for (const key of VR_WHEELS[machineId] || []) {
    const w = runtime.controls[key], node = w && runtime.pivots[w.node];
    if (!node || w.type !== 'wheel') continue;
    const localAxis = new Vector3().fromArray(Array.isArray(w.axis) ? w.axis : [w.axis === 'x' ? 1 : 0, w.axis === 'y' ? 1 : 0, w.axis === 'z' ? 1 : 0]).normalize();
    // 看不見的感應圓盤（比手輪大一點）：比較好用射線指到、抓住
    node.updateWorldMatrix(true, true);
    const size = new Box3().setFromObject(node).getSize(new Vector3());
    const scale = node.getWorldScale(new Vector3()).x || 1;
    const radius = Math.max(size.x, size.y, size.z) / 2 * 1.15 / scale;
    const hit = new Mesh(new CylinderGeometry(radius, radius, 0.06 / scale, 20), new MeshBasicMaterial({ visible: false }));
    hit.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), localAxis));
    hit.name = `VRWheelHit_${key}`;
    node.add(hit);
    hits.push(hit);
    let atLimit = false;
    const grab = createWheelGrab({
      center: () => node.getWorldPosition(new Vector3()),
      axis: () => localAxis.clone().transformDirection(node.matrixWorld),
      tick: TICK,
      reach: REACH,
      onTurn: (delta, info) => {
        const result = session.command({ type: 'wheel.turnBy', key, deltaAngle: delta });
        if (result.atLimit && !atLimit) info.pulse?.(0.9, 70); // 碰到行程極限：較強震動一次
        atLimit = !!result.atLimit;
      },
      onTick: (info) => { if (!atLimit) info.pulse?.(0.25, 12); },
      onRelease: () => { atLimit = false; },
    });
    offs.push(input.add(node, {
      highlight: false, // 用機台自己的高亮（runtime.setHighlight），不另外複製材質
      onHover: on => setHighlight(runtime, on ? key : null),
      ...grab,
    }));
  }
  return () => {
    offs.forEach(off => off());
    for (const hit of hits) { hit.removeFromParent(); hit.geometry.dispose(); hit.material.dispose(); }
  };
}
