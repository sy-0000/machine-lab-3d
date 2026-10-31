using UnityEngine;
using UnityEngine.InputSystem;

namespace MachineYard
{
    /// <summary>
    /// 搖桿走動（對應 src/xr/Locomotion.js；使用者自己控制，程式不會自行移動視角）：
    ///   左手搖桿：往頭盔面向的方向平滑移動，1.6 m/s，死區 0.18；
    ///   右手搖桿左右扳：快速轉向 30°（繞著頭轉，不晃動）；
    ///   右手搖桿往前推保留給瞬移（StickTeleport）。
    /// 先試 X、再試 Z，碰到障礙沿著邊滑過去。範圍由 <see cref="LobbyFlow"/> 提供。
    /// 注意：Starter Assets 的 Move／Turn／Teleport provider 必須停用，否則會重複移動（場景建置腳本會停用）。
    /// </summary>
    public class StickLocomotion : MonoBehaviour
    {
        public Transform rig; public Camera head; public StationMover mover; public StickTeleport teleport;
        public System.Func<float, float, bool> canStand = (x, z) => true;
        public System.Action<float, float> onWalk;
        public float speed = 1.6f, deadzone = 0.18f, snapDegrees = 30f;
        InputAction left, right; bool snapReady = true;

        void OnEnable()
        {
            left = new InputAction("move", InputActionType.Value, "<XRController>{LeftHand}/thumbstick");
            right = new InputAction("turn", InputActionType.Value, "<XRController>{RightHand}/thumbstick");
            left.Enable(); right.Enable();
        }
        void OnDisable() { left?.Disable(); right?.Disable(); }

        void Update()
        {
            if (mover != null && mover.Busy) return;
            if (teleport != null && teleport.Aiming) return;
            var r = right.ReadValue<Vector2>();
            if (snapReady && Mathf.Abs(r.x) > 0.7f) { rig.RotateAround(head.transform.position, Vector3.up, Mathf.Sign(r.x) * snapDegrees); snapReady = false; }
            else if (Mathf.Abs(r.x) < 0.35f) snapReady = true;

            var m = left.ReadValue<Vector2>();
            float mag = m.magnitude;
            if (mag < deadzone) return;
            m *= (mag - deadzone) / (1f - deadzone) / mag;
            var fwd = head.transform.forward; fwd.y = 0;
            if (fwd.sqrMagnitude < 1e-6f) return;
            fwd.Normalize();
            var rightDir = new Vector3(fwd.z, 0, -fwd.x);
            var step = (fwd * m.y + rightDir * m.x) * speed * Time.deltaTime;
            var p = head.transform.position;
            if (Ok(p.x + step.x, p.z)) { rig.position += new Vector3(step.x, 0, 0); p.x += step.x; }
            if (Ok(p.x, p.z + step.z)) { rig.position += new Vector3(0, 0, step.z); p.z += step.z; }
            var t = ThreeCoords.ToThree(p);
            onWalk?.Invoke(t.x, t.z);
        }

        bool Ok(float ux, float uz)
        {
            var t = ThreeCoords.ToThree(new Vector3(ux, 0, uz));
            return canStand(t.x, t.z);
        }
    }
}
