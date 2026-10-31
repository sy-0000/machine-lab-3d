using System.Collections;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 玄關大門：點擊（XR 射線選取）→ 約 1 秒推開兩扇（smoothstep，最大角度 1.45 rad ≈ 83°）。
    /// 對應 src/xr/lobby/exterior.js 的 openDoors()；節點是 exterior_interactive.glb 的
    /// OuterDoors/LeafLeftPivot、OuterDoors/LeafRightPivot。
    /// 開門方向：執行時實測哪個旋轉符號會讓門板往建築內部（three.js 的 -Z）移動，不依賴手性轉換的猜測；
    /// openDegrees 只取絕對值（預設 83°）。
    /// </summary>
    public class ExteriorDoors : MonoBehaviour
    {
        public Transform leftPivot, rightPivot;
        public float leftOpenDegrees = -83f, rightOpenDegrees = 83f;
        public float duration = 1f;
        public bool IsOpen { get; private set; }
        bool opening;
        public event System.Action Opened;

        /// <summary>在 OuterDoors 底下自動找左右扇。</summary>
        public void AutoWire()
        {
            leftPivot = FindDeep(transform, "LeafLeftPivot");
            rightPivot = FindDeep(transform, "LeafRightPivot");
        }

        static Transform FindDeep(Transform root, string name)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true)) if (t.name == name) return t;
            return null;
        }

        /// <summary>只有門外的場景（階段 2）由門自己接點擊；完整場景由 LobbyFlow 接（只在門外才開門）。</summary>
        public bool clickToOpen;
        void Start() { if (clickToOpen) XrUtil.MakeClickable(gameObject, Open); }

        public void Open()
        {
            if (opening || IsOpen || leftPivot == null || rightPivot == null) return;
            StartCoroutine(OpenRoutine());
        }

        IEnumerator OpenRoutine()
        {
            opening = true;
            Quaternion l0 = leftPivot.localRotation, r0 = rightPivot.localRotation;
            // 方向用實測決定：哪個符號會讓門板中心往建築內部（three.js 的 -Z）移動
            var inward = ThreeCoords.Direction(0, 0, -1);
            float ls = XrUtil.SwingSign(leftPivot, leftPivot, inward), rs = XrUtil.SwingSign(rightPivot, rightPivot, inward);
            Quaternion l1 = l0 * Quaternion.Euler(0, ls * Mathf.Abs(leftOpenDegrees), 0), r1 = r0 * Quaternion.Euler(0, rs * Mathf.Abs(rightOpenDegrees), 0);
            for (float t = 0; t < duration; t += Time.deltaTime)
            {
                float k = Mathf.Clamp01(t / duration); k = k * k * (3f - 2f * k);
                leftPivot.localRotation = Quaternion.Slerp(l0, l1, k);
                rightPivot.localRotation = Quaternion.Slerp(r0, r1, k);
                yield return null;
            }
            leftPivot.localRotation = l1; rightPivot.localRotation = r1;
            IsOpen = true; opening = false;
            Opened?.Invoke();
        }
    }
}
