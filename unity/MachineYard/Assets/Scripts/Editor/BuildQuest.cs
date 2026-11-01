using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace MachineYard.Editor
{
    /// <summary>
    /// 一鍵打包 Quest 3 APK（選單 7／7b；也可命令列：Unity -batchmode -quit -projectPath … -executeMethod MachineYard.Editor.BuildQuest.CommandLine）。
    /// 步驟：套用 Quest 設定 → 檢查 OpenXR 與 Meta Quest Support（用反射讀，不綁套件版本；讀不到只警告）→ 開啟 Lobby 場景跑自我檢查
    /// （有錯誤就停，命令列模式直接失敗）→ 建置到 Builds/MachineYard-Quest3.apk（7b 會直接安裝並啟動到接上的 Quest）。
    /// </summary>
    public static class BuildQuest
    {
        const string Scene = "Assets/Scenes/Lobby.unity", Apk = "Builds/MachineYard-Quest3.apk";

        [MenuItem("Machine Yard/7. Build Quest 3 APK")] public static void Build() => Run(false, false);
        [MenuItem("Machine Yard/7b. Build And Run on Quest 3")] public static void BuildAndRun() => Run(true, false);
        public static void CommandLine() { if (!Run(false, true)) EditorApplication.Exit(1); }

        static bool Run(bool autoRun, bool batch)
        {
            bool Fail(string m) { Debug.LogError("[Machine Yard] 打包中止：" + m); if (!batch) EditorUtility.DisplayDialog("Machine Yard 打包", m, "好"); return false; }
            if (!File.Exists(Scene)) return Fail("找不到 " + Scene + "，請先執行選單 4 建場景。");
            QuestProjectSetup.Apply();
            var xr = CheckXr();
            if (xr != null) { if (xr.StartsWith("!")) return Fail(xr.Substring(1)); Debug.LogWarning("[Machine Yard] " + xr); }
            if (!batch && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return false;
            EditorSceneManager.OpenScene(Scene);
            int errors = SelfCheck.RunAndCount();
            if (errors > 0 && (batch || !EditorUtility.DisplayDialog("Machine Yard 打包", $"自我檢查有 {errors} 個錯誤（見 SelfCheck.md）。仍要打包嗎？", "仍要打包", "取消")))
                return Fail($"自我檢查有 {errors} 個錯誤（見專案根目錄 SelfCheck.md）。");
            var scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            if (!scenes.Contains(Scene)) scenes = new[] { Scene }.Concat(scenes).ToArray();
            Directory.CreateDirectory("Builds");
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes, locationPathName = Apk, target = BuildTarget.Android,
                options = autoRun ? BuildOptions.AutoRunPlayer : BuildOptions.None,
            });
            var sum = report.summary;
            if (sum.result != BuildResult.Succeeded) return Fail($"建置失敗（{sum.result}，{sum.totalErrors} 個錯誤），詳見 Console。");
            var msg = $"已建置 {Apk}：{sum.totalSize / 1048576.0:0} MB，耗時 {sum.totalTime.TotalMinutes:0.0} 分鐘" + (autoRun ? "，已安裝到 Quest 並啟動。" : "。用 Meta Quest Developer Hub 或 adb install 安裝。");
            Debug.Log("[Machine Yard] " + msg);
            if (!batch) { EditorUtility.RevealInFinder(Apk); EditorUtility.DisplayDialog("Machine Yard 打包", msg, "好"); }
            return true;
        }

        /// <summary>回傳 null＝OK；以「!」開頭＝必須修正；其他＝警告。用反射讀 XR Management／OpenXR 設定，套件 API 不同時只警告不擋。</summary>
        static string CheckXr()
        {
            try
            {
                var perTarget = Type.GetType("UnityEditor.XR.Management.XRGeneralSettingsPerBuildTarget, Unity.XR.Management.Editor");
                var general = perTarget?.GetMethod("XRGeneralSettingsForBuildTarget")?.Invoke(null, new object[] { BuildTargetGroup.Android });
                var manager = general?.GetType().GetProperty("Manager")?.GetValue(general);
                var loaders = manager?.GetType().GetProperty("activeLoaders")?.GetValue(manager) as System.Collections.IEnumerable;
                if (loaders == null) return "無法自動確認 XR 載入器設定；請確認 Project Settings ▸ XR Plug-in Management ▸ Android 已勾 OpenXR。";
                bool openxr = false; foreach (var l in loaders) if (l != null && l.GetType().Name.Contains("OpenXR")) openxr = true;
                if (!openxr) return "!Android 沒有勾選 OpenXR：Project Settings ▸ XR Plug-in Management ▸ Android 分頁勾 OpenXR，並在 OpenXR ▸ Feature Groups 勾 Meta Quest Support（Target Devices 只勾 Quest 3）。";
                var settingsType = Type.GetType("UnityEngine.XR.OpenXR.OpenXRSettings, Unity.XR.OpenXR");
                var settings = settingsType?.GetMethod("GetSettingsForBuildTargetGroup")?.Invoke(null, new object[] { BuildTargetGroup.Android });
                var features = settings?.GetType().GetMethod("GetFeatures", Type.EmptyTypes)?.Invoke(settings, null) as Array;
                if (features == null) return "無法自動確認 OpenXR 功能；請確認已勾 Meta Quest Support。";
                foreach (var f in features)
                    if (f != null && f.GetType().Name.Contains("MetaQuest") && (bool)(f.GetType().GetProperty("enabled")?.GetValue(f) ?? false)) return null;
                return "!OpenXR 沒有啟用 Meta Quest Support：Project Settings ▸ XR Plug-in Management ▸ OpenXR（Android 分頁）勾選 Meta Quest Support，齒輪內 Target Devices 只勾 Quest 3。";
            }
            catch (Exception e) { return "無法自動確認 XR 設定（" + e.GetType().Name + "）；請手動確認 OpenXR 與 Meta Quest Support。"; }
        }
    }
}
