using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace MachineYard.Editor
{
    /// <summary>
    /// 選單 Machine Yard ▸ 3. Build Exterior Scene：用匯入的 exterior_static / exterior_interactive 建出「門外」場景
    /// （階段 2）。光源、霧、站位都是 src/xr/areas/Lobby.js、src/xr/lobby/exterior.js 的數值（用 ThreeCoords 換座標）。
    /// XR Origin 優先使用 XR Interaction Toolkit Starter Assets 的 "XR Origin (XR Rig)" prefab（請先在
    /// Package Manager 匯入 Starter Assets 範例）；找不到就退回只有相機的簡易 rig（不能射線互動）。
    /// </summary>
    public static class ExteriorSceneBuilder
    {
        const string ModelDir = "Assets/Models/";
        // Lobby.js STATIONS.outside：地面 (0,0,19.2)，面向北（yaw 0）
        static readonly Vector3 OutsideStation = new Vector3(0f, 0f, 19.2f);

        [MenuItem("Machine Yard/3. Build Exterior Scene")]
        public static void Build()
        {
            var staticAsset = AssetDatabase.LoadAssetAtPath<GameObject>(ModelDir + "exterior_static.glb");
            var interactiveAsset = AssetDatabase.LoadAssetAtPath<GameObject>(ModelDir + "exterior_interactive.glb");
            if (staticAsset == null || interactiveAsset == null)
            {
                EditorUtility.DisplayDialog("Machine Yard", "找不到 Assets/Models/exterior_static.glb 或 exterior_interactive.glb。\n請先執行「2. Import glb exports」並等匯入完成。", "好");
                return;
            }

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var root = new GameObject("Exterior");
            BuildContent(root, staticAsset, interactiveAsset);

            // ---- XR rig
            var rig = CreateRig();
            rig.transform.position = ThreeCoords.Position(OutsideStation.x, OutsideStation.y, OutsideStation.z);
            rig.transform.rotation = Quaternion.Euler(0, ThreeCoords.YawDegrees(0f), 0);
            var cam = rig.GetComponentInChildren<Camera>();
            if (cam != null) AddFpsHud(cam.transform);

            var path = "Assets/Scenes/Exterior.unity";
            EditorSceneManager.SaveScene(scene, path);
            var scenes = EditorBuildSettings.scenes;
            if (System.Array.FindIndex(scenes, s => s.path == path) < 0)
                EditorBuildSettings.scenes = new System.Collections.Generic.List<EditorBuildSettingsScene>(scenes) { new EditorBuildSettingsScene(path, true) }.ToArray();
            Debug.Log("[Machine Yard] 已建立 " + path + "。站位與光源是依 three.js 座標換算，請在 Scene 視窗確認門在正前方、大門朝向正確（見 README 驗收）。");
        }

        /// <summary>門外模型、大門互動、日光、煤氣燈、霧與天空（階段 2 與階段 3 的場景建置共用）。</summary>
        internal static ExteriorDoors BuildContent(GameObject root, GameObject staticAsset, GameObject interactiveAsset)
        {
            ExteriorDoors doors = null;

            // ---- 模型
            var stat = (GameObject)PrefabUtility.InstantiatePrefab(staticAsset, root.transform);
            stat.name = "exterior_static";
            foreach (var t in stat.GetComponentsInChildren<Transform>(true))
                GameObjectUtility.SetStaticEditorFlags(t.gameObject, StaticEditorFlags.ContributeGI | StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic | StaticEditorFlags.OccludeeStatic | StaticEditorFlags.ReflectionProbeStatic);
            var inter = (GameObject)PrefabUtility.InstantiatePrefab(interactiveAsset, root.transform);
            inter.name = "exterior_interactive";

            // ---- 大門：碰撞盒 + XRSimpleInteractable + ExteriorDoors
            var doorsT = FindDeep(inter.transform, "OuterDoors");
            if (doorsT != null)
            {
                var bounds = RendererBounds(doorsT.gameObject);
                var box = doorsT.gameObject.AddComponent<BoxCollider>();
                box.center = doorsT.InverseTransformPoint(bounds.center);
                box.size = doorsT.InverseTransformVector(bounds.size).Abs() + new Vector3(0, 0, 0.3f);
                doorsT.gameObject.AddComponent<XRSimpleInteractable>();
                doors = doorsT.gameObject.AddComponent<ExteriorDoors>();
                doors.AutoWire();
            }
            else Debug.LogWarning("[Machine Yard] exterior_interactive 裡找不到 OuterDoors（請看 manifest.json）。");

            // ---- 光（Lobby.js：HemisphereLight 0xdfe9f5/0x6b5a46 0.75；Directional 0xffe2b8 2.4 在 (-7,12,24) 照向 (0,0,14)）
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = HexColor(0xdfe9f5);
            RenderSettings.ambientEquatorColor = Color.Lerp(HexColor(0xdfe9f5), HexColor(0x6b5a46), 0.5f);
            RenderSettings.ambientGroundColor = HexColor(0x6b5a46);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = HexColor(0xd8cbb4);
            RenderSettings.fogDensity = 0.006f;
            var skyMat = new Material(Shader.Find("Skybox/Procedural"));
            RenderSettings.skybox = skyMat;

            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = HexColor(0xffe2b8);
            sun.intensity = 1.2f; // three 的 2.4 與 Unity 單位不同，先用 1.2 再目測調整
            sun.shadows = LightShadows.Soft;
            sun.transform.rotation = Quaternion.LookRotation(ThreeCoords.Direction(7f, -12f, -10f));
            sun.transform.SetParent(root.transform);
            RenderSettings.sun = sun;

            for (int i = 0; i < 2; i++)
            {
                float x = i == 0 ? -1.85f : 1.85f;
                var lamp = new GameObject("GasLantern_" + i).AddComponent<Light>();
                lamp.type = LightType.Point;
                lamp.color = HexColor(0xffb468);
                lamp.range = 8f; lamp.intensity = 2f; lamp.shadows = LightShadows.None;
                lamp.transform.position = ThreeCoords.Position(x, 2.45f + 0.1f, 16f + 0.17f + 0.05f);
                lamp.transform.SetParent(root.transform);
                var flicker = lamp.gameObject.AddComponent<GasLanternFlicker>();
                flicker.baseIntensity = 2f; flicker.index = i;
            }
            return doors;
        }

        internal static GameObject CreateRig()
        {
            foreach (var guid in AssetDatabase.FindAssets("XR Origin (XR Rig) t:Prefab"))
            {
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(AssetDatabase.GUIDToAssetPath(guid));
                if (prefab != null) return (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            }
            Debug.LogWarning("[Machine Yard] 找不到 Starter Assets 的 'XR Origin (XR Rig)'，改用簡易相機 rig（沒有手把與射線）。請從 Package Manager ▸ XR Interaction Toolkit ▸ Samples 匯入 Starter Assets 後重建。");
            var rig = new GameObject("XR Origin (fallback)");
            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            camGo.transform.SetParent(rig.transform);
            camGo.transform.localPosition = new Vector3(0, 1.65f, 0);
            camGo.AddComponent<Camera>().nearClipPlane = 0.05f;
            camGo.AddComponent<AudioListener>();
            return rig;
        }

        internal static void AddFpsHud(Transform cam)
        {
            var canvasGo = new GameObject("FpsCanvas", typeof(Canvas), typeof(CanvasScaler));
            canvasGo.transform.SetParent(cam, false);
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            var rt = canvasGo.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(400, 80);
            rt.localScale = Vector3.one * 0.0007f;
            rt.localPosition = new Vector3(-0.17f, -0.14f, 0.7f); // 視野左下角
            var textGo = new GameObject("Label", typeof(Text));
            textGo.transform.SetParent(canvasGo.transform, false);
            var text = textGo.GetComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = 48; text.color = Color.yellow; text.alignment = TextAnchor.MiddleLeft;
            text.rectTransform.sizeDelta = new Vector2(400, 80);
            canvasGo.AddComponent<FpsHud>().label = text;
        }

        internal static Transform FindDeep(Transform root, string name)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true)) if (t.name == name) return t;
            return null;
        }

        internal static Bounds RendererBounds(GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>();
            var b = rs.Length > 0 ? rs[0].bounds : new Bounds(go.transform.position, Vector3.one);
            foreach (var r in rs) b.Encapsulate(r.bounds);
            return b;
        }

        internal static Color HexColor(int hex) => new Color(((hex >> 16) & 255) / 255f, ((hex >> 8) & 255) / 255f, (hex & 255) / 255f);
        internal static Vector3 Abs(this Vector3 v) => new Vector3(Mathf.Abs(v.x), Mathf.Abs(v.y), Mathf.Abs(v.z));
    }
}
