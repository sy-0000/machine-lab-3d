using System.Collections;
using UnityEngine;

namespace MachineYard
{
    /// <summary>換站位／換區域的淡出淡入（VR 中程式不會自行移動視角，一律「淡出 → 換位置 → 淡入」，對應 SceneManager.moveTo）。
    /// 掛在 XR 相機上；用貼在相機前的黑色大面片，不需要後製。</summary>
    public class ScreenFade : MonoBehaviour
    {
        public float seconds = 0.25f;
        Material mat; Renderer quad;
        public float Alpha { get; private set; }

        void Awake()
        {
            var go = XrUtil.CreateQuad("Fade", transform, new Color(0, 0, 0, 0));
            go.transform.localPosition = new Vector3(0, 0, 0.12f); // 近裁切面 0.05 之外、其他東西之前
            go.transform.localScale = new Vector3(3f, 3f, 1f);
            quad = go.GetComponent<Renderer>();
            mat = quad.material; mat.renderQueue = 5000;
            quad.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            quad.enabled = false;
        }

        void Set(float a) { Alpha = a; mat.color = new Color(0, 0, 0, a); quad.enabled = a > 0.001f; }

        public IEnumerator Fade(float to)
        {
            float from = Alpha;
            for (float t = 0; t < seconds; t += Time.unscaledDeltaTime) { Set(Mathf.Lerp(from, to, t / seconds)); yield return null; }
            Set(to);
        }
        public IEnumerator FadeOut() => Fade(1f);
        public IEnumerator FadeIn() => Fade(0f);
    }
}
