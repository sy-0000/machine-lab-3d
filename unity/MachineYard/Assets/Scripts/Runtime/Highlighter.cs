using System.Collections.Generic;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 射線指到可操作的零件時發亮（對應 runtime.js setHighlight：材質複製一份、emissive #30a888 × 0.5）。
    /// 第一次指到時為每個渲染器建一組「發亮版」材質並快取，之後只切換 sharedMaterials，不再配置記憶體。
    /// 材質屬性依 shader 而異：glTFast 用 emissiveFactor，URP Lit 用 _EmissionColor（需開 _EMISSION），
    /// 都沒有的（例如面板的 Sprites/Default）改成把顏色調亮。
    /// </summary>
    public static class Highlighter
    {
        static readonly Color Glow = new Color(0.188f, 0.659f, 0.533f) * 0.5f;   // #30a888 × 0.5
        static readonly Dictionary<Renderer, (Material[] normal, Material[] lit)> cache = new Dictionary<Renderer, (Material[], Material[])>();

        public static void Set(GameObject root, bool on)
        {
            if (root == null) return;
            foreach (var r in root.GetComponentsInChildren<Renderer>(false))
            {
                if (r is LineRenderer || r is ParticleSystemRenderer) continue;
                if (!cache.TryGetValue(r, out var m))
                {
                    var normal = r.sharedMaterials; var lit = new Material[normal.Length];
                    for (int i = 0; i < normal.Length; i++) lit[i] = normal[i] == null ? null : MakeLit(normal[i]);
                    m = (normal, lit); cache[r] = m;
                }
                r.sharedMaterials = on ? m.lit : m.normal;
            }
        }

        static Material MakeLit(Material src)
        {
            var c = new Material(src) { name = src.name + " (highlight)" };
            if (c.HasProperty("emissiveFactor")) c.SetColor("emissiveFactor", Glow);
            else if (c.HasProperty("_EmissionColor")) { c.EnableKeyword("_EMISSION"); c.SetColor("_EmissionColor", Glow); }
            else if (c.HasProperty("_BaseColor")) c.SetColor("_BaseColor", Color.Lerp(c.GetColor("_BaseColor"), Color.white, 0.25f));
            else if (c.HasProperty("_Color")) c.color = Color.Lerp(c.color, Color.white, 0.25f);
            return c;
        }
    }
}
