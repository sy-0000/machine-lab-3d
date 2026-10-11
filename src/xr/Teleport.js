// 瞬移（只能落在固定的黃銅圓盤上）：按住右手搖桿往前推 → 從右手控制器射出拋物線；
// 拋物線落點靠近某個圓盤時圓盤高亮、線變金色，放開搖桿就淡出 → 移到圓盤（面向機台）→ 淡入。
// 沒指到圓盤時線是灰色，放開不會移動。射線指著圓盤按 trigger、或桌機點圓盤也可以瞬移（各區域自己登記）。
// 區域提供 teleportDiscs()：[{ station, hit }]；沒有提供（例如大門口）就不能瞬移。
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';

const AIM_ON = -0.6, AIM_OFF = -0.3;   // 搖桿往前推（y < 0）
const SPEED = 7, GRAVITY = 9.8, STEPS = 48, DT = 0.03, SNAP_RADIUS = 0.5;

export function createTeleport({ renderer, player, input, area, moveTo, onAim }) {
  const positions = new Float32Array(STEPS * 3);
  const line = new Line(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3)),
    new LineBasicMaterial({ color: 0x9a8f80, transparent: true, opacity: 0.9, depthWrite: false, fog: false, toneMapped: false }));
  line.name = 'TeleportArc';
  line.frustumCulled = false;
  line.visible = false;
  line.renderOrder = 997;
  const marker = new Mesh(new RingGeometry(0.12, 0.16, 32), new MeshBasicMaterial({ color: 0x9a8f80, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  marker.geometry.rotateX(-Math.PI / 2);
  marker.visible = false;
  player.add(line, marker);

  const origin = new Vector3(), dir = new Vector3(), p = new Vector3(), prev = new Vector3(), land = new Vector3(), local = new Vector3();
  let aiming = false, target = null;

  // 拋物線：從控制器沿射線方向出發，打到地面（y = 0）為止
  function cast(controller) {
    controller.updateMatrixWorld(true);
    origin.setFromMatrixPosition(controller.matrixWorld);
    dir.set(0, 0, -1).transformDirection(controller.matrixWorld);
    let count = 0, landed = false;
    prev.copy(origin);
    for (let i = 0; i < STEPS; i++) {
      const t = i * DT;
      p.copy(origin).addScaledVector(dir, SPEED * t);
      p.y -= 0.5 * GRAVITY * t * t;
      if (p.y <= 0 && i > 0) {
        // 落在這一段裡：線性內插到 y = 0
        const k = prev.y / (prev.y - p.y);
        land.lerpVectors(prev, p, k);
        p.copy(land);
        landed = true;
      }
      local.copy(p); player.worldToLocal(local);
      positions.set([local.x, local.y, local.z], count * 3);
      count++;
      if (landed) break;
      prev.copy(p);
    }
    line.geometry.setDrawRange(0, count);
    line.geometry.attributes.position.needsUpdate = true;
    return landed ? land : null;
  }

  function nearestDisc(point) {
    let best = null, bestD = SNAP_RADIUS;
    for (const disc of area()?.teleportDiscs?.() || []) {
      const d = Math.hypot(disc.station.position.x - point.x, disc.station.position.z - point.z);
      if (d < bestD) { best = disc; bestD = d; }
    }
    return best;
  }
  function setTarget(disc) {
    if (disc === target) return;
    target = disc;
    onAim?.(disc);
    const color = disc ? 0xffcf7a : 0x9a8f80;
    line.material.color.setHex(color); marker.material.color.setHex(color);
    if (disc) input.pulse('right', 0.15, 10);
  }
  function stop() { aiming = false; line.visible = marker.visible = false; setTarget(null); }

  return {
    get aiming() { return aiming; },
    /** 瞬移到某個圓盤（拋物線、trigger 點圓盤、桌機點圓盤都走這裡） */
    go(disc) { return moveTo(disc.station); },
    update(enabled) {
      const controller = input.controllers?.find(c => c.inputSource?.handedness === 'right' && c.active)?.controller;
      if (!renderer.xr.isPresenting || !enabled || !controller || !area()?.teleportDiscs) { if (aiming) stop(); return; }
      const [, y] = input.stick('right');
      if (!aiming && y < AIM_ON) aiming = true;
      if (!aiming) return;
      if (y > AIM_OFF) {
        // 放開搖桿：有指到圓盤就移過去
        const disc = target;
        stop();
        if (disc) this.go(disc);
        return;
      }
      line.visible = true;
      const hit = cast(controller);
      const disc = hit ? nearestDisc(hit) : null;
      setTarget(disc);
      marker.visible = !!hit;
      if (hit) {
        local.copy(disc ? disc.station.position : hit).setY(0.03);
        marker.position.copy(player.worldToLocal(local));
      }
    },
    dispose() { line.removeFromParent(); marker.removeFromParent(); line.geometry.dispose(); line.material.dispose(); marker.geometry.dispose(); marker.material.dispose(); },
  };
}
