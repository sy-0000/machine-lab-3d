using System;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.XR;

namespace MachineYard
{
    public enum HandSide { Left, Right }

    /// <summary>一隻手的指標狀態（給 PointerTarget 的回呼用）：射線、手的位置、震動。</summary>
    public class PointerHand
    {
        public HandSide side;
        public Vector3 origin, direction;     // 世界座標的射線（Quest 的 aim pose）
        public Vector3 position => origin;     // 手的位置（aim pose 的原點，與握把相距幾公分）
        public Quaternion rotation;
        public RaycastHit hit; public bool hasHit;
        public PointerTarget hovered, pressed, grabbed;
        public Ray Ray => new Ray(origin, direction);

        /// <summary>控制器震動（Input System 的 XRControllerWithRumble，不經過 XRI）。</summary>
        public void Pulse(float amplitude, float seconds)
        {
            var dev = side == HandSide.Left ? XRController.leftHand : XRController.rightHand;
            if (dev is XRControllerWithRumble r) r.SendImpulse(Mathf.Clamp01(amplitude), seconds);
        }
    }

    /// <summary>
    /// 可以被射線指到的物件（取代 XRI 的 XRSimpleInteractable；與網站 InputManager 的 input.add 對應）：
    ///   onClick  = trigger（網站：左鍵／select）
    ///   onGrab   = grip；回傳 true 表示「抓住」，之後每格可讀手的位置，放開 grip 時 onRelease
    ///   onAlt    = grip，但物件不能抓（例如拉桿：網站的右鍵＝反向）
    ///   onHover  = 指到／離開
    /// 碰撞盒由 XrUtil.EnsureTarget 建立（貼合渲染範圍）。
    /// </summary>
    public class PointerTarget : MonoBehaviour
    {
        public Action<PointerHand> onClick, onAlt, onRelease;
        public Func<PointerHand, bool> onGrab;
        public Action<bool> onHover;
        public Func<bool> enabledWhen;
        /// <summary>指到時發亮（Highlighter）。工具箱的工具、大片的牆面門可關掉。</summary>
        public bool highlight = true;
        public bool Usable => isActiveAndEnabled && (enabledWhen == null || enabledWhen());
    }

    /// <summary>
    /// 兩隻手的射線指標（對應 src/xr/InputManager.js），完全不用 XRI 的 Interactor：
    ///   · 射線從控制器的 aim pose（OpenXR pointerPosition／pointerRotation）射出，用 Physics.Raycast 找 PointerTarget。
    ///   · trigger「按下」就算點擊（網站是放開時仍指著同一物件才算；VR 手會晃，按下即觸發比較不會漏，見 D31）。
    ///   · grip 按下：物件有 onGrab 且回傳 true → 抓住（手輪、工具），否則呼叫 onAlt（反向操作）；放開 grip → onRelease。
    ///   · 抓住時射線長度固定，搖桿走動與轉向暫停（AnyGrabbing）。
    /// 射線外觀：金色細線＋命中點小圓點（與網站相同）。
    /// </summary>
    public class XrPointer : MonoBehaviour
    {
        public static XrPointer Instance { get; private set; }
        public Camera head;
        public float maxDistance = 12f;
        public readonly PointerHand[] hands = { new PointerHand { side = HandSide.Left }, new PointerHand { side = HandSide.Right } };
        public bool AnyGrabbing => hands[0].grabbed != null || hands[1].grabbed != null;
        /// <summary>為 false 時（例如瞬移瞄準中）不顯示、不點擊。</summary>
        public bool[] handEnabled = { true, true };

        InputAction[] pos = new InputAction[2], rot = new InputAction[2], devPos = new InputAction[2], devRot = new InputAction[2], trigger = new InputAction[2], grip = new InputAction[2];
        LineRenderer[] lines = new LineRenderer[2]; Transform[] dots = new Transform[2];
        float[] grabDistance = new float[2];

        void Awake() { Instance = this; }

        void OnEnable()
        {
            for (int i = 0; i < 2; i++)
            {
                string h = i == 0 ? "{LeftHand}" : "{RightHand}";
                pos[i] = Make($"<XRController>{h}/pointerPosition"); rot[i] = Make($"<XRController>{h}/pointerRotation");
                devPos[i] = Make($"<XRController>{h}/devicePosition"); devRot[i] = Make($"<XRController>{h}/deviceRotation");
                trigger[i] = new InputAction("trigger" + i, InputActionType.Button, $"<XRController>{h}/triggerPressed"); trigger[i].Enable();
                grip[i] = new InputAction("grip" + i, InputActionType.Button, $"<XRController>{h}/gripPressed"); grip[i].Enable();
                if (lines[i] == null) BuildVisual(i);
            }
        }

        static InputAction Make(string path) { var a = new InputAction(null, InputActionType.Value, path); a.Enable(); return a; }

        void OnDisable()
        {
            for (int i = 0; i < 2; i++) { pos[i]?.Disable(); rot[i]?.Disable(); devPos[i]?.Disable(); devRot[i]?.Disable(); trigger[i]?.Disable(); grip[i]?.Disable(); Release(i); }
        }

        void BuildVisual(int i)
        {
            var go = new GameObject(i == 0 ? "PointerRay_L" : "PointerRay_R"); go.transform.SetParent(transform, false);
            var l = go.AddComponent<LineRenderer>(); l.positionCount = 2; l.widthMultiplier = 0.0025f; l.useWorldSpace = true;
            l.material = SimpleMat.Unlit(new Color(1f, 0.84f, 0.54f)); l.startColor = l.endColor = new Color(1f, 0.84f, 0.54f, 0.85f);
            l.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; l.receiveShadows = false;
            lines[i] = l;
            var dot = GameObject.CreatePrimitive(PrimitiveType.Sphere); Destroy(dot.GetComponent<Collider>());
            dot.transform.SetParent(go.transform, false); dot.transform.localScale = Vector3.one * 0.016f;
            dot.GetComponent<MeshRenderer>().sharedMaterial = SimpleMat.Unlit(new Color(1f, 0.95f, 0.79f));
            dots[i] = dot.transform;
        }

        void Update()
        {
            var offset = head != null ? head.transform.parent : null;   // Camera Offset：控制器姿勢的座標系
            for (int i = 0; i < 2; i++)
            {
                var h = hands[i];
                bool havePointer = pos[i].controls.Count > 0;
                var p = havePointer ? pos[i].ReadValue<Vector3>() : devPos[i].ReadValue<Vector3>();
                var q = havePointer ? rot[i].ReadValue<Quaternion>() : devRot[i].ReadValue<Quaternion>();
                bool tracked = q.w != 0 || q.x != 0 || q.y != 0 || q.z != 0;
                h.origin = offset != null ? offset.TransformPoint(p) : p;
                h.rotation = offset != null ? offset.rotation * q : q;
                h.direction = h.rotation * Vector3.forward;
                bool active = tracked && handEnabled[i];
                lines[i].enabled = active; dots[i].gameObject.SetActive(false);
                if (!active) { SetHover(h, null); Release(i); continue; }

                if (h.grabbed != null)
                {
                    lines[i].SetPositions(new[] { h.origin, h.origin + h.direction * grabDistance[i] });
                    if (grip[i].WasReleasedThisFrame() || !h.grabbed.Usable) Release(i);
                    continue;
                }

                PointerTarget target = null;
                h.hasHit = Physics.Raycast(h.origin, h.direction, out h.hit, maxDistance, ~0, QueryTriggerInteraction.Collide);
                if (h.hasHit) { target = h.hit.collider.GetComponentInParent<PointerTarget>(); if (target != null && !target.Usable) target = null; }
                SetHover(h, target);
                float len = h.hasHit ? h.hit.distance : 3f;
                lines[i].SetPositions(new[] { h.origin, h.origin + h.direction * len });
                if (h.hasHit && target != null) { dots[i].gameObject.SetActive(true); dots[i].position = h.hit.point; }

                if (trigger[i].WasPressedThisFrame() && target != null) { h.Pulse(0.25f, 0.018f); target.onClick?.Invoke(h); }
                if (grip[i].WasPressedThisFrame() && target != null)
                {
                    if (target.onGrab != null && target.onGrab(h)) { h.grabbed = target; grabDistance[i] = len; }
                    else target.onAlt?.Invoke(h);
                }
            }
        }

        void SetHover(PointerHand h, PointerTarget t)
        {
            if (h.hovered == t) return;
            var old = h.hovered; h.hovered = t;
            bool stillHovered(PointerTarget x) => hands[0].hovered == x || hands[1].hovered == x;
            if (old != null && !stillHovered(old)) { old.onHover?.Invoke(false); if (old.highlight) Highlighter.Set(old.gameObject, false); }
            if (t != null) { t.onHover?.Invoke(true); if (t.highlight) Highlighter.Set(t.gameObject, true); }
        }

        void Release(int i)
        {
            var h = hands[i]; var g = h.grabbed; h.grabbed = null;
            if (g != null) g.onRelease?.Invoke(h);
        }
    }
}
