// VR 走動（使用者自己控制，不是程式自動移動視角）：
//   左手搖桿：往頭盔面向的方向平滑移動（前後左右），速度 1.6 m/s
//   右手搖桿左右扳：快速轉向 30°（繞著頭的位置轉，不晃動，比平滑轉向不暈）
//   右手搖桿往前推保留給第 5 階段的瞬移拋物線
// 每個區域提供 canStand(x, z)：頭的位置投影到地面能不能站（牆、機台、工作桌擋住）；
// 先試 X、再試 Z，碰到障礙時沿著邊滑過去。換區域或淡出淡入中不移動。
import { Vector3 } from 'three';

const SPEED = 1.6, DEADZONE = 0.18, SNAP = Math.PI / 6, SNAP_ON = 0.7, SNAP_OFF = 0.35;

export function createLocomotion({ renderer, player, camera, input, canMove = () => true, area = () => null }) {
  const head = new Vector3(), forward = new Vector3(), right = new Vector3(), step = new Vector3();
  let snapReady = true;

  function snapTurn(angle) {
    // 以頭的位置為中心轉 player：轉完頭還在原地
    camera.getWorldPosition(head);
    player.rotation.y += angle;
    const dx = player.position.x - head.x, dz = player.position.z - head.z;
    const c = Math.cos(angle), s = Math.sin(angle);
    player.position.x = head.x + dx * c + dz * s;
    player.position.z = head.z - dx * s + dz * c;
  }

  return {
    update(dt) {
      if (!renderer.xr.isPresenting || !canMove()) return;
      const current = area();
      // 右手：快速轉向（扳過 0.7 觸發一次，回到 0.35 以內才能再觸發）
      const [rx] = input.stick('right');
      if (snapReady && Math.abs(rx) > SNAP_ON) { snapTurn(-Math.sign(rx) * SNAP); snapReady = false; }
      else if (Math.abs(rx) < SNAP_OFF) snapReady = true;
      // 左手：平滑移動
      let [x, y] = input.stick('left');
      const mag = Math.hypot(x, y);
      if (mag < DEADZONE) return;
      const k = (mag - DEADZONE) / (1 - DEADZONE) / mag; // 去掉死區後重新縮放
      x *= k; y *= k;
      camera.getWorldDirection(forward).setY(0);
      if (forward.lengthSq() < 1e-6) return;
      forward.normalize();
      right.set(-forward.z, 0, forward.x);
      step.set(0, 0, 0).addScaledVector(forward, -y * SPEED * dt).addScaledVector(right, x * SPEED * dt);
      camera.getWorldPosition(head);
      const ok = (px, pz) => !current?.canStand || current.canStand(px, pz);
      if (ok(head.x + step.x, head.z)) { player.position.x += step.x; head.x += step.x; }
      if (ok(head.x, head.z + step.z)) { player.position.z += step.z; head.z += step.z; }
      current?.onWalk?.(head.x, head.z);
    },
  };
}
