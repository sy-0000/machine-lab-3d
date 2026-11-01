using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;

namespace MachineYard.Editor
{
    /// <summary>
    /// 選單 Machine Yard ▸ 1. Apply Quest Settings：套用文件第 1 節能用程式設定的部分
    /// （Android、IL2CPP、ARM64、Vulkan、Linear、ASTC、API 32）。
    /// OpenXR 載入器與 Meta Quest Support 無法安全地用程式勾選，請照 unity/MachineYard/README.md 手動勾。
    /// </summary>
    public static class QuestProjectSetup
    {
        /// <summary>執行期用 Shader.Find 建材質的著色器：沒被任何材質資產參照時，打包會被剔除（Quest 上變粉紅）。加進 Always Included Shaders。</summary>
        public static readonly string[] RuntimeShaders = { "Universal Render Pipeline/Lit", "Universal Render Pipeline/Unlit", "Sprites/Default", "MachineYard/LightShaft" };

        public static void IncludeShaders()
        {
            var so = new SerializedObject(UnityEngine.Rendering.GraphicsSettings.GetGraphicsSettings());
            var arr = so.FindProperty("m_AlwaysIncludedShaders");
            foreach (var name in RuntimeShaders)
            {
                var sh = Shader.Find(name); if (sh == null) { Debug.LogWarning("[Machine Yard] 找不到著色器 " + name); continue; }
                bool has = false; for (int i = 0; i < arr.arraySize; i++) if (arr.GetArrayElementAtIndex(i).objectReferenceValue == sh) has = true;
                if (has) continue;
                arr.InsertArrayElementAtIndex(arr.arraySize); arr.GetArrayElementAtIndex(arr.arraySize - 1).objectReferenceValue = sh;
            }
            so.ApplyModifiedProperties();
        }

        [MenuItem("Machine Yard/1. Apply Quest Settings")]
        public static void Apply()
        {
            var android = NamedBuildTarget.Android;
            EditorUserBuildSettings.SwitchActiveBuildTarget(BuildTargetGroup.Android, BuildTarget.Android);
            PlayerSettings.SetScriptingBackend(android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan });
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel32;
            PlayerSettings.SetApplicationIdentifier(android, "com.machineyard.quest");
            PlayerSettings.productName = "Machine Yard";
            EditorUserBuildSettings.androidBuildSubtarget = MobileTextureSubtarget.ASTC;
            PlayerSettings.gpuSkinning = true;
            IncludeShaders();
            Debug.Log("[Machine Yard] Quest 設定已套用（只支援 Quest 3）。請再到 Project Settings ▸ XR Plug-in Management ▸ Android 勾選 OpenXR，啟用 Meta Quest Support，並在 Meta Quest Support 的齒輪 ▸ Target Devices 只勾 Quest 3。接著執行選單 0b 建立中文字型。");
        }
    }
}
