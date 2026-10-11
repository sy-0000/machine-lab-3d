// VR 直接操作機台：所有手輪、撥桿、旋鈕都沿用桌機場景裡的可點擊零件（模型節點的 userData.machineControl）。
//
// 手輪（type 'wheel'）：射線指著按住 grip 抓住，手繞手輪中心畫圈（createWheelGrab）。
//   - 一般手輪（方案 C）：手每轉過一格（10°）軸走「每格進給量」（feed.mm：0.01／0.1／1 mm），送出 wheel.turnBy；
//     手輪模型另外跟著手轉（只改外觀），所以手感直覺、精細度可調。碰到行程上下限：較強震動，手輪模型不再往那邊轉。
//   - 鑽床進給手柄（有 angleRange／springReturn）：照真實比例跟手轉（−115°～0°），握住時不回彈（wheel.grip），放開才回彈。
// 其他零件：射線指著按 trigger ＝ 桌機的左鍵，按 grip ＝ 右鍵（反向）：
//   撥桿／開關 → spindle.toggle（左鍵正轉、右鍵反轉）；段位旋鈕 → detent.step；刀座 → tool.index；腳踏煞車 → spindle.brake。
import { Box3, CylinderGeometry, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { setHighlight, wheelRatio } from '../../machines/runtime.js';
import { createWheelGrab } from '../interaction/wheelGrab.js';

const TICK = Math.PI / 18;   // 每格 10°
const REACH = 0.22;          // 手離手輪中心 0.22 m 內用手的位置畫圈，更遠用射線打在手輪平面上的點
const axisVector = axis => new Vector3().fromArray(Array.isArray(axis) ? axis : [axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0]).normalize();

// 每個零件的最上層節點（同一個 key 的子節點不重複登記）
function controlNodes(root) {
  const nodes = new Map();
  root.traverse(n => {
    const key = n.userData.machineControl;
    if (key && n.parent?.userData.machineControl !== key && !nodes.has(key)) nodes.set(key, n);
  });
  return nodes;
}

function addHitDisc(node, localAxis, key) {
  node.updateWorldMatrix(true, true);
  const size = new Box3().setFromObject(node).getSize(new Vector3());
  const scale = node.getWorldScale(new Vector3()).x || 1;
  const radius = Math.max(size.x, size.y, size.z) / 2 * 1.15 / scale;
  const hit = new Mesh(new CylinderGeometry(radius, radius, 0.06 / scale, 20), new MeshBasicMaterial({ visible: false }));
  hit.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), localAxis);
  hit.name = `VRWheelHit_${key}`;
  node.add(hit);
  return hit;
}

/**
 * @param {{ session, runtime, input, feed: { mm: number } }} options feed.mm：每格進給量（儀表板切換）
 * @returns {() => void} 移除函式
 */
export function attachMachineControls({ session, runtime, input, feed }) {
  const offs = [], hits = [];
  const send = command => session.command(command);
  for (const [key, node] of controlNodes(runtime.scene)) {
    const c = runtime.controls[key];
    if (!c) continue;
    const hover = on => setHighlight(runtime, on ? key : null);
    if (c.type !== 'wheel') {
      const act = direction => {
        if (c.type === 'detent') return send({ type: 'detent.step', key, direction: -direction });
        if (c.type === 'index') return send({ type: 'tool.index', direction: -direction });
        if (c.type === 'emergency') { send({ type: 'wheel.release' }); return send({ type: 'spindle.brake' }); }
        return send({ type: 'spindle.toggle', direction });
      };
      offs.push(input.add(node, {
        highlight: false, onHover: hover,
        onSelect: info => { info?.pulse?.(0.3, 20); act(1); },                        // trigger ＝ 左鍵
        // grip ＝ 右鍵（不抓住）；滑鼠按下也會先走 onGrab，桌機只用點一下（左鍵），這裡略過
        onGrab: info => { if (info?.kind !== 'mouse' && (c.bidirectional || c.type !== 'lever')) { info?.pulse?.(0.3, 20); act(-1); } return false; },
      }));
      continue;
    }
    const wheelNode = runtime.pivots[c.node] || node;
    const localAxis = axisVector(c.axis);
    hits.push(addHitDisc(wheelNode, localAxis, key));
    const lever = !!(c.angleRange || c.springReturn);
    const center = () => wheelNode.getWorldPosition(new Vector3());
    const axis = () => localAxis.clone().transformDirection(wheelNode.matrixWorld);
    let grab;
    if (lever) {
      // 鑽床進給手柄：真實比例跟手轉，握住時不回彈
      grab = createWheelGrab({
        center, axis, tick: TICK, reach: REACH,
        onTurn: (delta, info) => { const r = send({ type: 'wheel.turnBy', key, deltaAngle: delta }); if (r.atLimit) info.pulse?.(0.5, 25); },
      });
      const { onGrab, onRelease } = grab;
      grab = { ...grab, onGrab: info => { send({ type: 'wheel.grip', key }); onGrab(info); }, onRelease: info => { send({ type: 'wheel.release' }); onRelease(info); } };
    } else {
      // 方案 C：軸依每格進給量走，手輪模型跟著手轉
      const initial = runtime.initial[c.node]?.quaternion?.clone() || wheelNode.quaternion.clone();
      const turn = new Quaternion();
      let visual = runtime.angles[key] || 0, limitDir = 0;
      const show = () => wheelNode.quaternion.copy(initial).multiply(turn.setFromAxisAngle(localAxis, visual));
      grab = createWheelGrab({
        center, axis, tick: TICK, reach: REACH,
        onTurn: delta => {
          if (limitDir && Math.sign(delta) === limitDir) return; // 頂到極限：手輪不再往那邊轉
          if (limitDir && Math.sign(delta) === -limitDir) limitDir = 0;
          visual += delta;
          show();
        },
        onTick: (info, direction) => {
          if (limitDir === direction) return;
          const ratio = wheelRatio(runtime, key);
          if (!ratio) return;
          const r = send({ type: 'wheel.turnBy', key, deltaAngle: direction * feed.mm / 1000 / ratio });
          show(); // turnBy 會把手輪轉到機台的角度；外觀維持跟手
          if (r.atLimit) { limitDir = direction; info.pulse?.(0.9, 70); } else info.pulse?.(0.25, 12);
        },
        onRelease: () => { limitDir = 0; },
      });
      const { onGrab } = grab;
      grab = { ...grab, onGrab: info => { limitDir = 0; onGrab(info); } };
    }
    offs.push(input.add(wheelNode, { highlight: false, onHover: hover, ...grab }));
  }
  return () => {
    offs.forEach(off => off());
    for (const hit of hits) { hit.removeFromParent(); hit.geometry.dispose(); hit.material.dispose(); }
  };
}
