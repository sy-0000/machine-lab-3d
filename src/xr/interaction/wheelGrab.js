// 抓住手輪畫圈轉動：把手的位置投影到手輪的轉動平面上，算相對轉動中心的角度變化。
// 跨越 ±180° 時取最短的那一邊（unwrap），多圈會一直累計。每轉過一個刻度呼叫 onTick（用來震動、喀一聲）。
// 手離手輪很近（reach 內）時用控制器位置；離得遠（用射線抓）時改用射線與轉動平面的交點；滑鼠也走射線。
// 回傳的物件直接交給 InputManager.add(target, handlers) 當 onGrab／onDrag／onRelease。第 6 階段的機台手輪也用它。
import { Plane, Vector3 } from 'three';

/**
 * @param {{ center: () => Vector3, axis: () => Vector3, onTurn: (deltaRadians: number, info) => void,
 *           tick?: number, onTick?: (info, direction: number) => void, reach?: number, onRelease?: Function }} options
 *   center、axis：手輪中心與轉軸（世界座標、單位向量），每次抓取時重新讀取（手輪可能跟著機台移動）
 */
export function createWheelGrab({ center, axis, onTurn, tick = Math.PI / 18, onTick, reach = 0.6, onRelease }) {
  const plane = new Plane(), c = new Vector3(), n = new Vector3(), u = new Vector3(), w = new Vector3(), p = new Vector3(), d = new Vector3();
  let last = null, sinceTick = 0, total = 0;

  function pointOf(info) {
    if (info.position && info.position.distanceTo(c) < reach) return p.copy(info.position);
    return info.ray.intersectPlane(plane, p);
  }
  function angleOf(point) {
    d.copy(point).sub(c);
    d.addScaledVector(n, -d.dot(n)); // 投影到轉動平面
    if (d.lengthSq() < 1e-6) return null; // 正好在中心：角度無意義
    return Math.atan2(d.dot(w), d.dot(u));
  }

  return {
    /** 抓取以來累計轉過的角度（弧度） */
    total: () => total,
    onGrab(info) {
      c.copy(center()); n.copy(axis()).normalize();
      plane.setFromNormalAndCoplanarPoint(n, c);
      // 平面上的兩個正交方向 u、w（w = n × u），角度 = atan2(·w, ·u)，正方向符合右手定則
      u.set(1, 0, 0); if (Math.abs(u.dot(n)) > 0.9) u.set(0, 1, 0);
      u.addScaledVector(n, -u.dot(n)).normalize();
      w.crossVectors(n, u);
      const point = pointOf(info);
      last = point ? angleOf(point) : null;
      sinceTick = 0;
      info.pulse?.(0.2, 15);
    },
    onDrag(info) {
      const point = pointOf(info);
      const a = point ? angleOf(point) : null;
      if (a === null) return;
      if (last === null) { last = a; return; }
      let delta = a - last;
      if (delta > Math.PI) delta -= Math.PI * 2; else if (delta < -Math.PI) delta += Math.PI * 2;
      last = a;
      if (!delta) return;
      total += delta;
      onTurn(delta, info);
      sinceTick += delta;
      while (Math.abs(sinceTick) >= tick - 1e-9) { // 容許浮點誤差：剛好轉滿一格也要算
        const direction = Math.sign(sinceTick);
        sinceTick -= direction * tick;
        onTick ? onTick(info, direction) : info.pulse?.(0.25, 12);
      }
    },
    onRelease(info) { last = null; onRelease?.(info); },
  };
}
