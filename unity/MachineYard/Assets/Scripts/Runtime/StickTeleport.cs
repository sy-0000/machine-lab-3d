using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;

namespace MachineYard
{
    /// <summary>瞬移圓盤：一個站位。</summary>
    public class TeleportDisc : MonoBehaviour
    {
        public static readonly List<TeleportDisc> All = new List<TeleportDisc>();
        public Station station;
        Renderer r; Color baseColor = new Color(0.72f, 0.54f, 0.25f);
        void OnEnable() { All.Add(this); r = GetComponentInChildren<Renderer>(); }
        void OnDisable() { All.Remove(this); }
        public void SetTarget(bool on) { if (r != null) XrUtil.SetColor(r, on ? new Color(1f, 0.81f, 0.48f) : baseColor); }
    }

    /// <summary>
    /// 瞬移（對應 src/xr/Teleport.js）：右手搖桿往前推 → 從右手控制器射出拋物線；落點靠近圓盤（0.5 m 內）時圓盤高亮、線變金色；
    /// 放開搖桿 → 淡出 → 移到圓盤（面向機台）→ 淡入。沒指到圓盤放開不會移動。
    /// 只有「進過工廠」之後才能用（ProgressStore.FactoryEntered），而且只在有圓盤的區域。
    /// Unity 搖桿往前是 +Y（WebXR 是 -Y），所以門檻是反的。
    /// </summary>
    public class StickTeleport : MonoBehaviour
    {
        public StationMover mover; public Transform handFallback; public Transform rightHand; public StickLocomotion locomotion;
        public bool Aiming { get; private set; }
        const float AimOn = 0.6f, AimOff = 0.3f, Speed = 7f, Gravity = 9.8f, Dt = 0.03f, SnapRadius = 0.5f;
        const int Steps = 48;
        InputAction stick; LineRenderer line; TeleportDisc target; Vector3? freeSpot;

        void OnEnable()
        {
            stick = new InputAction("teleport", InputActionType.Value, "<XRController>{RightHand}/thumbstick");
            stick.Enable();
            var go = new GameObject("TeleportArc");
            go.transform.SetParent(transform, false);
            line = go.AddComponent<LineRenderer>();
            line.positionCount = 0; line.widthMultiplier = 0.015f; line.useWorldSpace = true;
            line.material = new Material(Shader.Find("Sprites/Default"));
            SetLineColor(new Color(0.6f, 0.56f, 0.5f));
        }
        void OnDisable() { stick?.Disable(); if (line != null) Destroy(line.gameObject); }

        void SetLineColor(Color c) { line.startColor = line.endColor = c; }

        void Update()
        {
            // 自由瞬移（任何可站立的地板）一律可用；圓盤只在進過工廠後才出現（網站規則）
            bool grabbing = XrPointer.Instance != null && XrPointer.Instance.AnyGrabbing;
            bool enabledNow = mover != null && !mover.Busy && !grabbing;
            float y = stick.ReadValue<Vector2>().y;
            if (!enabledNow) { if (Aiming) Stop(); return; }
            if (!Aiming && y > AimOn) Aiming = true;
            if (!Aiming) return;
            if (y < AimOff)
            {
                var chosen = target; var spot = freeSpot; Stop();
                if (chosen != null) mover.MoveTo(chosen.station);
                else if (spot.HasValue) MoveFree(spot.Value);
                return;
            }
            Vector3 o, dir;
            var ptr = XrPointer.Instance;
            if (ptr != null) { o = ptr.hands[1].origin; dir = ptr.hands[1].direction; }
            else { var hand = rightHand != null ? rightHand : handFallback; if (hand == null) { Stop(); return; } o = hand.position; dir = hand.forward; }
            Vector3 hit; bool landed = Cast(o, dir, out hit);
            TeleportDisc best = null; float bestD = SnapRadius;
            if (landed && ProgressStore.Instance.FactoryEntered) foreach (var d in TeleportDisc.All)
            {
                float dist = Vector2.Distance(new Vector2(d.transform.position.x, d.transform.position.z), new Vector2(hit.x, hit.z));
                if (dist < bestD) { best = d; bestD = dist; }
            }
            SetTarget(best);
            freeSpot = null;
            if (best == null && landed && CanStandAt(hit)) { freeSpot = hit; SetLineColor(new Color(0.85f, 0.95f, 1f)); }
        }

        bool CanStandAt(Vector3 world)
        {
            if (locomotion == null) return false;
            var t = ThreeCoords.ToThree(world);
            return locomotion.canStand(t.x, t.z);
        }

        /// <summary>自由瞬移：落點可站立就移過去，保持目前面向。</summary>
        void MoveFree(Vector3 world)
        {
            var head = mover.head.transform; var f = ThreeCoords.ToThree(head.forward);
            float yaw = Mathf.Atan2(-f.x, -f.z);   // three：yaw 0 面向 −Z，逆時針為正
            var t = ThreeCoords.ToThree(world);
            mover.MoveTo(new Station { Name = "free", Three = new Vector3(t.x, 0, t.z), YawRadians = yaw, Area = mover.CurrentArea });
            locomotion.onWalk?.Invoke(t.x, t.z);
        }

        bool Cast(Vector3 origin, Vector3 dir, out Vector3 landing)
        {
            var pts = new List<Vector3>(Steps);
            Vector3 prev = origin; landing = origin;
            for (int i = 0; i < Steps; i++)
            {
                float t = i * Dt;
                Vector3 p = origin + dir * (Speed * t); p.y -= 0.5f * Gravity * t * t;
                if (p.y <= 0.0f && i > 0)
                {
                    float k = prev.y / (prev.y - p.y);
                    p = Vector3.Lerp(prev, p, k); landing = p; pts.Add(p);
                    line.positionCount = pts.Count; line.SetPositions(pts.ToArray());
                    return true;
                }
                pts.Add(p); prev = p;
            }
            line.positionCount = pts.Count; line.SetPositions(pts.ToArray());
            return false;
        }

        void SetTarget(TeleportDisc d)
        {
            if (d == target) return;
            target?.SetTarget(false);
            target = d; target?.SetTarget(true);
            SetLineColor(d != null ? new Color(1f, 0.81f, 0.48f) : new Color(0.6f, 0.56f, 0.5f));
        }
        void Stop() { Aiming = false; line.positionCount = 0; SetTarget(null); freeSpot = null; }
    }
}
