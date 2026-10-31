using UnityEngine;
using UnityEngine.UI;

namespace MachineYard
{
    /// <summary>頭盔視野左下角的 FPS 顯示（每秒更新一次平均）。由場景建置腳本掛在 XR 相機底下的 World Space Canvas。</summary>
    public class FpsHud : MonoBehaviour
    {
        public Text label;
        float acc; int frames; float timer;

        void Update()
        {
            acc += Time.unscaledDeltaTime; frames++; timer += Time.unscaledDeltaTime;
            if (timer < 1f || label == null) return;
            float ms = acc / frames * 1000f;
            label.text = $"{1000f / ms:0} fps  {ms:0.0} ms";
            acc = 0; frames = 0; timer = 0;
        }
    }
}
