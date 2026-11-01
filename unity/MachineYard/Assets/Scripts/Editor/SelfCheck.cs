using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using TMPro;
using UnityEditor;
using UnityEngine;

namespace MachineYard.Editor
{
    /// <summary>
    /// 選單「5. Self-check」：建完場景後一鍵檢查常見問題，結果寫到 Console 與專案根目錄的 SelfCheck.md（回報時把這個檔案貼給我）。
    /// 檢查：字型資產與缺字、放映幕影片、射線指標、XRI Interactor 是否已停用、每台機台設定檔的節點是否都在模型裡、
    /// 粉紅材質、可點物件缺碰撞盒、流程元件的參照、各區三角形數／渲染器數／即時光源數（對照預算）。
    /// </summary>
    public static class SelfCheck
    {
        [MenuItem("Machine Yard/5. Self-check (scene + assets)")]
        public static void Run() => RunAndCount();

        /// <summary>執行檢查並回傳錯誤數（一鍵打包會先跑這個）。</summary>
        public static int RunAndCount()
        {
            var sb = new StringBuilder(); int errors = 0, warnings = 0;
            void Err(string m) { errors++; sb.AppendLine("- ❌ " + m); }
            void Warn(string m) { warnings++; sb.AppendLine("- ⚠ " + m); }
            void Ok(string m) => sb.AppendLine("- ✅ " + m);
            sb.AppendLine($"# Machine Yard 自我檢查（{DateTime.Now:yyyy-MM-dd HH:mm}，Unity {Application.unityVersion}）").AppendLine();

            // ---- 資產
            sb.AppendLine("## 資產");
            var font = Resources.Load<TMP_FontAsset>("MachineYardFont");
            if (font == null) Err("沒有 Resources/MachineYardFont（請執行選單 0b）：中文會是方塊");
            else
            {
                string chars = File.Exists("Assets/Fonts/chars.txt") ? File.ReadAllText("Assets/Fonts/chars.txt") : "";
                var missing = chars.Where(c => c > 0x7f && !font.HasCharacter(c)).Distinct().Take(20).ToArray();
                if (missing.Length > 0) Warn($"字型資產缺字（前 20 個）：{new string(missing)}"); else Ok($"中文字型 {font.characterTable.Count} 字");
            }
            {
                var so = new SerializedObject(UnityEngine.Rendering.GraphicsSettings.GetGraphicsSettings()); var arr = so.FindProperty("m_AlwaysIncludedShaders");
                var included = new HashSet<UnityEngine.Object>(); for (int i = 0; i < arr.arraySize; i++) included.Add(arr.GetArrayElementAtIndex(i).objectReferenceValue);
                foreach (var name in QuestProjectSetup.RuntimeShaders) { var sh = Shader.Find(name); if (sh == null) Err("找不到著色器 " + name); else if (!included.Contains(sh)) Err($"著色器 {name} 不在 Always Included Shaders（打包後執行期建的材質會變粉紅；執行選單 1）"); }
            }
            if (Resources.Load<TextAsset>("workshop-effects") == null) Warn("缺 Resources/workshop-effects.json（工作室光束／火星／蒸汽噴口）");
            foreach (var id in new[] { "lathe", "milling", "drill" })
                if (AssetDatabase.LoadAssetAtPath<UnityEngine.Video.VideoClip>($"Assets/Videos/preview_{id}.mp4") == null) Err($"缺放映幕影片 Assets/Videos/preview_{id}.mp4");
            foreach (var f in new[] { "workshop_static.glb", "workshop_interactive.glb", "toolbox_static.glb", "toolbox_interactive.glb", "machine_lathe_static.glb", "machine_milling_static.glb", "machine_drill_static.glb", "manifest.json" })
                if (!File.Exists("Assets/Models/" + f)) Warn("Assets/Models 沒有 " + f + "（選單 2b 匯入）");
            sb.AppendLine();

            // ---- 場景元件
            sb.AppendLine("## 場景");
            var pointer = UnityEngine.Object.FindObjectOfType<XrPointer>();
            if (pointer == null) Err("場景沒有 XrPointer（請重新執行選單 4 建場景）"); else if (pointer.head == null) Err("XrPointer 沒有指定 head 相機"); else Ok("射線指標 XrPointer");
            string[] xri = { "NearFarInteractor", "XRRayInteractor", "XRDirectInteractor", "XRPokeInteractor" };
            foreach (var mb in UnityEngine.Object.FindObjectsOfType<MonoBehaviour>())
                for (var t = mb.GetType(); t != null; t = t.BaseType)
                    if (Array.IndexOf(xri, t.Name) >= 0 && mb.enabled) { Warn($"XRI {t.Name} 仍啟用（{Path(mb.transform)}），會和 XrPointer 搶按鍵"); break; }
            var flow = UnityEngine.Object.FindObjectOfType<LobbyFlow>();
            if (flow == null) Err("沒有 LobbyFlow");
            else
            {
                if (flow.vault == null) Err("LobbyFlow.vault 未設定（玄關找不到 VaultDoor）");
                if (flow.screen == null) Warn("LobbyFlow.screen 未設定（找不到 ProjectionScreen）");
                else if (flow.screen.clips.Any(c => c.video == null)) Warn("放映幕有段落沒有影片（會用佔位計時）");
                if (flow.board == null) Warn("LobbyFlow.board 未設定（找不到 SafetyBoard）");
                if (flow.doors == null) Warn("LobbyFlow.doors 未設定（找不到 OuterDoors）");
            }
            var exit = UnityEngine.Object.FindObjectOfType<WorkshopExitDoor>();
            if (exit == null) Warn("工作室沒有出口門（WorkshopExitDoor）"); else if (exit.flow == null || exit.mover == null) Err("WorkshopExitDoor 的 flow／mover 未設定");
            int noCollider = 0;
            foreach (var t in UnityEngine.Object.FindObjectsOfType<PointerTarget>()) if (t.GetComponent<Collider>() == null) noCollider++;
            if (noCollider > 0) Warn($"{noCollider} 個 PointerTarget 沒有碰撞盒（射線指不到）");
            sb.AppendLine();

            // ---- 機台節點
            sb.AppendLine("## 機台節點（machine_*_runtime.json 的節點是否都在匯入的模型裡）");
            foreach (var m in Resources.FindObjectsOfTypeAll<LatheMachine>())
            {
                if (m.runtimeJson == null || m.machineRoot == null || EditorUtility.IsPersistent(m)) continue;
                var cfg = MachineRuntimeConfig.Parse(m.runtimeJson.text);
                var names = new HashSet<string>(m.machineRoot.GetComponentsInChildren<Transform>(true).Select(t => t.name));
                var need = new List<string>();
                need.AddRange(cfg.axes.Select(a => a.node)); need.AddRange(cfg.wheels.Select(w => w.node)); need.Add(cfg.spindle.node);
                if (cfg.lever != null) need.Add(cfg.lever.node); if (cfg.toggle != null) need.Add(cfg.toggle.node);
                need.AddRange((cfg.actions ?? new ActionCfg[0]).Select(a => a.node));
                need.Add(cfg.mounts.tool?.parent); need.Add(cfg.mounts.workpiece?.parent);
                need.AddRange((cfg.additions ?? new AdditionCfg[0]).Where(a => a.kind == "cuttingTool" || a.kind == "sleeve" || a.kind == "supportColumn" || a.kind == "handwheel").Select(a => a.name));
                need.AddRange((cfg.cuttingInserts ?? new InsertCfg[0]).Select(i => i.node));
                var miss = need.Where(n => !string.IsNullOrEmpty(n)).Distinct().Where(n => !names.Contains(n)).ToList();
                if (miss.Count == 0) Ok($"{cfg.machineId}：{need.Count} 個節點都在"); else Err($"{cfg.machineId} 找不到節點：{string.Join(", ", miss)}");
            }
            sb.AppendLine();

            // ---- 材質與預算
            sb.AppendLine("## 材質與效能預算（只算啟用中的物件；機台只有一台啟用）");
            int pink = 0; var pinkNames = new List<string>();
            foreach (var r in UnityEngine.Object.FindObjectsOfType<Renderer>())
                foreach (var mat in r.sharedMaterials)
                    if (mat == null || mat.shader == null || mat.shader.name == "Hidden/InternalErrorShader") { pink++; if (pinkNames.Count < 8) pinkNames.Add(Path(r.transform)); break; }
            if (pink > 0) Err($"{pink} 個渲染器材質遺失／粉紅（例：{string.Join("；", pinkNames)}）"); else Ok("沒有粉紅材質");
            sb.AppendLine().AppendLine("| 區域 | 三角形 | 渲染器 | 即時光源 | 預算 |").AppendLine("|---|---:|---:|---:|---|");
            foreach (var root in UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects())
            {
                foreach (Transform area in root.transform)
                {
                    long tris = 0; int rend = 0;
                    foreach (var mf in area.GetComponentsInChildren<MeshFilter>(false))
                    {
                        var r = mf.GetComponent<MeshRenderer>(); if (r == null || !r.enabled || mf.sharedMesh == null) continue;
                        rend++; for (int s = 0; s < mf.sharedMesh.subMeshCount; s++) tris += mf.sharedMesh.GetIndexCount(s) / 3;
                    }
                    int lights = area.GetComponentsInChildren<Light>(false).Count(l => l.enabled && l.lightmapBakeType != LightmapBakeType.Baked);
                    if (rend == 0) continue;
                    string budget = tris > 300000 ? "⚠ > 30 萬" : "OK";
                    sb.AppendLine($"| {root.name}/{area.name} | {tris:N0} | {rend} | {lights} | {budget} |");
                }
            }
            // 貼圖記憶體（場景中啟用的渲染器用到的貼圖，執行期大小；Quest 3 建議全部 < 1 GB）
            var texs = new HashSet<Texture>();
            foreach (var r in UnityEngine.Object.FindObjectsOfType<Renderer>())
                foreach (var mat in r.sharedMaterials)
                    if (mat != null) foreach (var id in mat.GetTexturePropertyNameIDs()) { var t = mat.GetTexture(id); if (t != null) texs.Add(t); }
            long texBytes = 0; int big = 0;
            foreach (var t in texs) { texBytes += UnityEngine.Profiling.Profiler.GetRuntimeMemorySizeLong(t); if (t.width > 1024 || t.height > 1024) big++; }
            sb.AppendLine().AppendLine($"貼圖：{texs.Count} 張，約 {texBytes / 1048576.0:0} MB（含三台機台）；大於 1024 的 {big} 張" + (big > 0 ? "（匯入時選 exports/quest 會縮到 1024，見 scripts/slim-textures.mjs）" : ""));
            if (texBytes > 1024L * 1048576) Warn($"貼圖記憶體約 {texBytes / 1048576} MB，偏高");
            sb.AppendLine().AppendLine($"**結果：{errors} 個錯誤、{warnings} 個警告。**");
            File.WriteAllText("SelfCheck.md", sb.ToString());
            var msg = $"[Machine Yard] 自我檢查：{errors} 個錯誤、{warnings} 個警告。完整結果在專案根目錄 SelfCheck.md。";
            if (errors > 0) Debug.LogError(msg + "\n" + sb); else if (warnings > 0) Debug.LogWarning(msg + "\n" + sb); else Debug.Log(msg + "\n" + sb);
            return errors;
        }

        static string Path(Transform t) { var s = t.name; for (var p = t.parent; p != null; p = p.parent) s = p.name + "/" + s; return s; }
    }
}
