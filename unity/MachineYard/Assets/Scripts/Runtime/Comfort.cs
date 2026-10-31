using UnityEngine;

namespace MachineYard
{
    /// <summary>舒適度設定（存在 PlayerPrefs，重啟後保留）：移動方式、轉向方式、移動時的視野暗角。</summary>
    public static class ComfortSettings
    {
        public enum Move { Smooth, TeleportOnly }
        public enum Turn { Snap30, Snap45, Smooth }
        public static Move MoveMode { get => (Move)PlayerPrefs.GetInt("comfort.move", 0); set { PlayerPrefs.SetInt("comfort.move", (int)value); PlayerPrefs.Save(); } }
        public static Turn TurnMode { get => (Turn)PlayerPrefs.GetInt("comfort.turn", 0); set { PlayerPrefs.SetInt("comfort.turn", (int)value); PlayerPrefs.Save(); } }
        public static bool Vignette { get => PlayerPrefs.GetInt("comfort.vignette", 1) == 1; set { PlayerPrefs.SetInt("comfort.vignette", value ? 1 : 0); PlayerPrefs.Save(); } }
        public static string Describe() =>
            $"移動：{(MoveMode == Move.Smooth ? "搖桿＋瞬移" : "只用瞬移")}　轉向：{(TurnMode == Turn.Snap30 ? "快轉 30°" : TurnMode == Turn.Snap45 ? "快轉 45°" : "平滑")}　暗角：{(Vignette ? "開" : "關")}";
    }

    /// <summary>
    /// 移動時的視野暗角（防暈）：相機前 0.3 m 的面片，中央透明、四周漸黑；搖桿平滑走動或平滑轉向時 0.15 秒內淡入，停下淡出。
    /// 快轉（snap）與瞬移不需要（瞬移本身有淡出淡入）。
    /// </summary>
    public class ComfortVignette : MonoBehaviour
    {
        public static ComfortVignette Instance { get; private set; }
        public float maxAlpha = 0.85f;
        Material mat; float alpha, target; GameObject quad;

        void Awake()
        {
            Instance = this;
            const int n = 64; var tex = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "Vignette" };
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float dx = (x + .5f) / n * 2 - 1, dy = (y + .5f) / n * 2 - 1, r = Mathf.Sqrt(dx * dx + dy * dy);
                    float a = Mathf.Clamp01((r - 0.38f) / 0.32f); a = a * a * (3 - 2 * a);
                    tex.SetPixel(x, y, new Color(0, 0, 0, a));
                }
            tex.Apply();
            quad = XrUtil.CreateQuad("ComfortVignette", transform, new Color(1, 1, 1, 0));
            quad.transform.localPosition = new Vector3(0, 0, 0.3f); quad.transform.localScale = new Vector3(1.5f, 1.5f, 1);
            mat = quad.GetComponent<MeshRenderer>().sharedMaterial; mat.mainTexture = tex; mat.renderQueue = 4000;
            quad.SetActive(false);
        }

        /// <summary>這一格正在平滑移動或轉向（由 StickLocomotion 每格呼叫）。</summary>
        public void Moving() { target = 1f; }

        void LateUpdate()
        {
            float goal = ComfortSettings.Vignette ? target : 0f;
            alpha = Mathf.MoveTowards(alpha, goal, Time.deltaTime / 0.15f);
            target = 0f;
            quad.SetActive(alpha > 0.001f);
            if (alpha > 0.001f) mat.color = new Color(1, 1, 1, alpha * maxAlpha);
        }
    }
}
