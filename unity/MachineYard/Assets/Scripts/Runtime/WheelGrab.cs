using System;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 抓住手輪畫圈轉動（對應 src/xr/interaction/wheelGrab.js）：射線指著手輪按住 grip 抓住，把手的位置投影到手輪轉動平面上，
    /// 算相對轉動中心的角度變化，跨越 ±180° 時取最短邊，多圈累計。每轉過一格（預設 10°）呼叫 onTick（進給與震動）。
    /// 手離手輪中心 reach（0.22 m）內用手的位置；更遠（用射線抓）改用射線與轉動平面的交點。
    /// 抓取由 XrPointer／PointerTarget 處理（不經過 XRI）。
    ///
    /// 角度符號：hand 角度用 Unity 數值的右手基底（w = n × u）量，節點旋轉用 ThreeCoords.AxisAngle（= AngleAxis(−θ, n)），
    /// 所以送出的 three.js 角度變化 = −(量到的角度變化)。
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class WheelGrab : MonoBehaviour
    {
        public Transform center;               // 手輪轉動中心（預設用本節點）
        public Vector3 axisLocalUnity = Vector3.forward; // 轉軸（本節點局部，Unity 座標）
        public float tick = Mathf.PI / 18f, reach = 0.22f;
        public Action<float> onTurn;           // 參數：three.js 符號的角度變化（弧度）
        public Action<int, PointerHand> onTick;
        public Action onGrabbed, onReleased;
        public bool IsGrabbed => hand != null;
        public PointerHand Hand => hand;

        PointerTarget target; PointerHand hand;
        Plane plane; Vector3 c, n, u, w; float? last; float sinceTick;

        void Awake()
        {
            target = GetComponent<PointerTarget>() ?? gameObject.AddComponent<PointerTarget>();
            target.onGrab = OnGrab;
            target.onRelease = _ => { hand = null; last = null; onReleased?.Invoke(); };
            if (center == null) center = transform;
        }

        bool OnGrab(PointerHand h)
        {
            hand = h;
            c = center.position; n = transform.TransformDirection(axisLocalUnity).normalized;
            plane = new Plane(n, c);
            u = Vector3.right; if (Mathf.Abs(Vector3.Dot(u, n)) > 0.9f) u = Vector3.up;
            u = (u - n * Vector3.Dot(u, n)).normalized;
            w = Vector3.Cross(n, u);
            var p = PointOf();
            last = p.HasValue ? AngleOf(p.Value) : null;
            sinceTick = 0;
            h.Pulse(0.2f, 0.06f);
            onGrabbed?.Invoke();
            return true;
        }

        Vector3? PointOf()
        {
            if (hand == null) return null;
            if (Vector3.Distance(hand.position, c) < reach) return hand.position;
            var ray = hand.Ray;
            return plane.Raycast(ray, out float enter) ? ray.GetPoint(enter) : (Vector3?)null;
        }

        float? AngleOf(Vector3 point)
        {
            var d = point - c; d -= n * Vector3.Dot(d, n);
            if (d.sqrMagnitude < 1e-6f) return null;
            return Mathf.Atan2(Vector3.Dot(d, w), Vector3.Dot(d, u));
        }

        void Update()
        {
            if (!IsGrabbed) return;
            var p = PointOf();
            float? a = p.HasValue ? AngleOf(p.Value) : null;
            if (!a.HasValue) return;
            if (!last.HasValue) { last = a; return; }
            float delta = a.Value - last.Value;
            if (delta > Mathf.PI) delta -= Mathf.PI * 2; else if (delta < -Mathf.PI) delta += Mathf.PI * 2;
            last = a;
            if (delta == 0) return;
            float three = -delta;                       // 鏡像：Unity 量到的角度 → three.js 的角度
            onTurn?.Invoke(three);
            sinceTick += three;
            while (Mathf.Abs(sinceTick) >= tick - 1e-6f)
            {
                int dir = (int)Mathf.Sign(sinceTick);
                sinceTick -= dir * tick;
                if (onTick != null) onTick(dir, hand); else hand.Pulse(0.25f, 0.012f);
            }
        }
    }
}
