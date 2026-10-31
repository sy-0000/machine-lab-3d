using System.IO;
using UnityEditor;
using UnityEngine;

namespace MachineYard.Editor
{
    /// <summary>
    /// 選單 Machine Yard ▸ 2. Import glb exports：選網站專案的 exports/ 資料夾，把 glb 複製到 Assets/Models/
    /// （保留 tools/ 子資料夾），glTFast 的 ScriptedImporter 會自動把它們轉成可拖進場景的資產。
    /// 一律在編輯器匯入，不在 Quest 上執行期載入。
    /// </summary>
    public static class ExportImporter
    {
        [MenuItem("Machine Yard/2. Import glb exports")]
        public static void Import()
        {
            string src = EditorUtility.OpenFolderPanel("選擇網站專案的 exports 資料夾", "", "exports");
            if (string.IsNullOrEmpty(src)) return;
            string dst = Path.Combine(Application.dataPath, "Models");
            int n = 0;
            foreach (var file in Directory.GetFiles(src, "*.glb", SearchOption.AllDirectories))
            {
                string rel = Path.GetRelativePath(src, file);
                // 階段 2–3 只需要門外與玄關；其他先不匯入，避免專案一開始就 200 MB+
                if (!rel.StartsWith("exterior_") && !rel.StartsWith("vestibule_")) continue;
                string target = Path.Combine(dst, rel);
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                File.Copy(file, target, true);
                n++;
            }
            string manifest = Path.Combine(src, "manifest.json");
            if (File.Exists(manifest)) File.Copy(manifest, Path.Combine(dst, "manifest.json"), true);
            // 工安規則（與桌機工安頁同一份）：專案已附一份在 Resources/；若 exports 的上層是網站專案，順便更新
            string rules = Path.GetFullPath(Path.Combine(src, "..", "src", "data", "safety-rules.json"));
            if (File.Exists(rules)) { Directory.CreateDirectory(Path.Combine(Application.dataPath, "Resources")); File.Copy(rules, Path.Combine(Application.dataPath, "Resources", "safety-rules.json"), true); }
            AssetDatabase.Refresh();
            Debug.Log($"[Machine Yard] 已匯入 {n} 個 glb（exterior_* 與 vestibule_*）。");
        }
    }
}
