using System.IO;
using TMPro;
using UnityEditor;
using UnityEngine;
using UnityEngine.TextCore.LowLevel;

namespace MachineYard.Editor
{
    /// <summary>
    /// 把 Assets/Fonts/MachineYardSansTC.ttf（Noto Sans TC 子集，OFL 授權，scripts/unity-font.mjs 產生）
    /// 轉成 TMP 字型資產 Assets/Resources/MachineYardFont.asset（全專案的面板、告示板、放映幕都用它）。
    /// 預先把 chars.txt 的字烘進圖集（2048² SDF，取樣 48 pt，可多張圖集），執行期遇到新字也能動態補上（Dynamic）。
    /// </summary>
    public static class FontSetup
    {
        const string Ttf = "Assets/Fonts/MachineYardSansTC.ttf", Chars = "Assets/Fonts/chars.txt", Out = "Assets/Resources/MachineYardFont.asset";

        [MenuItem("Machine Yard/0b. Create CJK font asset (Noto Sans TC)")]
        public static void Create()
        {
            var font = AssetDatabase.LoadAssetAtPath<Font>(Ttf);
            if (font == null) { Debug.LogError("[Machine Yard] 找不到 " + Ttf + "（請在網站專案執行 node scripts/unity-font.mjs）"); return; }
            Directory.CreateDirectory("Assets/Resources");
            if (AssetDatabase.LoadAssetAtPath<TMP_FontAsset>(Out) != null) AssetDatabase.DeleteAsset(Out);
            var fa = TMP_FontAsset.CreateFontAsset(font, 48, 5, GlyphRenderMode.SDFAA, 2048, 2048, AtlasPopulationMode.Dynamic, true);
            fa.name = "MachineYardFont";
            AssetDatabase.CreateAsset(fa, Out);
            var chars = File.Exists(Chars) ? File.ReadAllText(Chars) : "";
            fa.TryAddCharacters(chars, out string missing);
            foreach (var tex in fa.atlasTextures) if (tex != null && !AssetDatabase.Contains(tex)) { tex.name = "MachineYardFont Atlas"; AssetDatabase.AddObjectToAsset(tex, fa); }
            if (fa.material != null && !AssetDatabase.Contains(fa.material)) { fa.material.name = "MachineYardFont Material"; AssetDatabase.AddObjectToAsset(fa.material, fa); }
            EditorUtility.SetDirty(fa);
            AssetDatabase.SaveAssets();
            Debug.Log($"[Machine Yard] 已建立 {Out}：{fa.characterTable.Count} 字、{fa.atlasTextures.Length} 張圖集" + (string.IsNullOrEmpty(missing) ? "" : $"；字型裡沒有的字：{missing}"));
        }
    }
}
