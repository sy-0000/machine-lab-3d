using System.Collections;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace MachineYard
{
    /// <summary>
    /// 玄關大門：點擊（XR 射線選取）→ 約 1 秒推開兩扇（smoothstep，最大角度 1.45 rad ≈ 83°）。
    /// 對應 src/xr/lobby/exterior.js 的 openDoors()；節點是 exterior_interactive.glb 的
    /// OuterDoors/LeafLeftPivot、OuterDoors/LeafRightPivot。
    /// 開門方向：three.js 左扇轉 +angle、右扇轉 -angle（向內，往 -Z）。匯入手性轉換後符號可能相反；
    /// 如果門往外開，把兩個 openDegrees 的正負號對調即可。
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

        void OnEnable()
        {
            var interactable = GetComponent<XRSimpleInteractable>();
            if (interactable != null) interactable.selectEntered.AddListener(_ => Open());
        }

        public void Open()
        {
            if (opening || IsOpen || leftPivot == null || rightPivot == null) return;
            StartCoroutine(OpenRoutine());
        }

        IEnumerator OpenRoutine()
        {
            opening = true;
            Quaternion l0 = leftPivot.localRotation, r0 = rightPivot.localRotation;
            Quaternion l1 = l0 * Quaternion.Euler(0, leftOpenDegrees, 0), r1 = r0 * Quaternion.Euler(0, rightOpenDegrees, 0);
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
