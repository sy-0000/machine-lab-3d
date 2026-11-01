using System;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

namespace MachineYard.Editor
{
    /// <summary>
    /// 選單 Machine Yard ▸ 4. Build Lobby Scene (stage 3)：建出「門外＋玄關＋金庫門＋佔位工作室」整個大門口場景並接好所有腳本：
    /// 模型、光源、XR rig、淡入淡出、站位移動、搖桿走動／瞬移、告示板、放映幕、金庫門、簡易選單（左手 Y）、FPS 顯示。
    /// 需要先匯入 exterior_*.glb 與 vestibule_*.glb（選單 2）。
    /// </summary>
    public static class LobbySceneBuilder
    {
        const string ModelDir = "Assets/Models/";
        // 玄關的兩盞吊燈（vestibule.js createLamps：PointLight 0xffc27a、強度 7、距離 9，z = 12.1 / 14.55，高度約 天花板 − 1.05）
        static readonly float[] LampZ = { 12.1f, 14.55f };

        [MenuItem("Machine Yard/4. Build Lobby + Workshop Scene (stage 3-5)")]
        public static void Build()
        {
            var ext = Load("exterior_static.glb"); var extI = Load("exterior_interactive.glb");
            var ves = Load("vestibule_static.glb"); var vesI = Load("vestibule_interactive.glb");
            if (ext == null || extI == null || ves == null || vesI == null)
            {
                EditorUtility.DisplayDialog("Machine Yard", "缺少 exterior_* 或 vestibule_* 的 glb。請先執行「2. Import glb exports」並等匯入完成。", "好");
                return;
            }

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var root = new GameObject("Lobby");
            var doors = ExteriorSceneBuilder.BuildContent(root, ext, extI);

            // ---- 玄關
            var vStatic = (GameObject)PrefabUtility.InstantiatePrefab(ves, root.transform); vStatic.name = "vestibule_static";
            foreach (var t in vStatic.GetComponentsInChildren<Transform>(true))
                GameObjectUtility.SetStaticEditorFlags(t.gameObject, StaticEditorFlags.ContributeGI | StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic | StaticEditorFlags.OccludeeStatic | StaticEditorFlags.ReflectionProbeStatic);
            var vInter = (GameObject)PrefabUtility.InstantiatePrefab(vesI, root.transform); vInter.name = "vestibule_interactive";
            foreach (var z in LampZ)
            {
                var l = new GameObject("CageLamp").AddComponent<Light>();
                l.type = LightType.Point; l.color = ExteriorSceneBuilder.HexColor(0xffc27a); l.range = 9f; l.intensity = 3.5f; l.shadows = LightShadows.None;
                l.transform.position = ThreeCoords.Position(0f, 3.1f, z);
                l.transform.SetParent(root.transform);
            }

            // ---- XR rig（先建，工作室的面板需要相機）
            var rigGo = ExteriorSceneBuilder.CreateRig();
            var cam = rigGo.GetComponentInChildren<Camera>();

            // ---- 工作室：檔案齊全就建真的（階段 4：房間＋車床），否則用佔位工作室。放在遠處避免與玄關座標重疊
            WorkshopBuilder.LastFx = null; WorkshopBuilder.LastSwitcher = null; WorkshopBuilder.LastExitDoor = null;
            if (WorkshopBuilder.HasAssets()) WorkshopBuilder.Build(root.transform, cam);
            else { Debug.LogWarning("[Machine Yard] 沒有 workshop／車床的 glb，使用佔位工作室。要真的工作室請先執行「2b. Import glb exports (workshop + lathe)」。"); BuildWorkshopPlaceholder(root.transform); }

            DisableStarterLocomotion(rigGo);
            ExteriorSceneBuilder.SetupPointer(rigGo, cam);
            ExteriorSceneBuilder.AddFpsHud(cam.transform);
            var fade = cam.gameObject.AddComponent<ScreenFade>();

            var sys = new GameObject("MachineYardSystems");
            var mover = sys.AddComponent<StationMover>();
            mover.rig = rigGo.transform; mover.head = cam; mover.fade = fade;
            mover.Place(Stations.Outside);

            var flow = sys.AddComponent<LobbyFlow>();
            flow.mover = mover; flow.doors = doors;

            var viewer = ThreeCoords.Position(Stations.Center.Three.x, 1.6f, Stations.Center.Three.z);
            var boardT = ExteriorSceneBuilder.FindDeep(vInter.transform, "SafetyBoard");
            if (boardT != null) { flow.board = boardT.gameObject.AddComponent<SafetyBoardController>(); }
            var screenT = ExteriorSceneBuilder.FindDeep(vInter.transform, "ProjectionScreen");
            if (screenT != null)
            {
                flow.screen = screenT.gameObject.AddComponent<ProjectionScreenController>();
                // 網站動畫錄成的影片（scripts/record-previews.mjs）：有就用，沒有就退回佔位計時
                foreach (var c in flow.screen.clips) c.video = AssetDatabase.LoadAssetAtPath<UnityEngine.Video.VideoClip>($"Assets/Videos/preview_{c.id}.mp4");
            }
            var vaultT = ExteriorSceneBuilder.FindDeep(vInter.transform, "VaultDoor");
            if (vaultT != null) { flow.vault = vaultT.gameObject.AddComponent<VaultDoorController>(); flow.vault.AutoWire(); }
            var bootstrap = sys.AddComponent<LobbyBootstrap>();
            bootstrap.viewerWorldPos = viewer;

            var tele = sys.AddComponent<StickTeleport>();
            tele.mover = mover;
            cam.gameObject.AddComponent<ComfortVignette>();
            var right = FindHand(rigGo.transform, "Right");
            tele.rightHand = right;
            var loco = sys.AddComponent<StickLocomotion>();
            loco.rig = rigGo.transform; loco.head = cam; loco.mover = mover; loco.teleport = tele; tele.locomotion = loco;
            bootstrap.loco = loco; bootstrap.flow = flow;

            var menu = sys.AddComponent<DebugMenu>();
            menu.head = cam; menu.mover = mover; menu.flow = flow; menu.doors = doors;
            menu.switcher = WorkshopBuilder.LastSwitcher; if (WorkshopBuilder.LastSwitcher != null) WorkshopBuilder.LastSwitcher.mover = mover;
            if (flow.vault != null) flow.vault.fx = WorkshopBuilder.LastFx;
            if (WorkshopBuilder.LastExitDoor != null) { WorkshopBuilder.LastExitDoor.flow = flow; WorkshopBuilder.LastExitDoor.mover = mover; }

            var path = "Assets/Scenes/Lobby.unity";
            EditorSceneManager.SaveScene(scene, path);
            var list = new System.Collections.Generic.List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
            list.RemoveAll(s => s.path == "Assets/Scenes/Exterior.unity");
            if (list.FindIndex(s => s.path == path) < 0) list.Insert(0, new EditorBuildSettingsScene(path, true));
            EditorBuildSettings.scenes = list.ToArray();
            Debug.Log("[Machine Yard] 已建立 " + path + "（階段 3）。驗收清單見 unity/README.md。");
        }

        static GameObject Load(string file) => AssetDatabase.LoadAssetAtPath<GameObject>(ModelDir + file);

        static Transform FindHand(Transform rig, string side)
        {
            foreach (var t in rig.GetComponentsInChildren<Transform>(true))
                if (t.name.IndexOf(side + " Controller", StringComparison.OrdinalIgnoreCase) >= 0 || t.name.IndexOf(side + "Hand Controller", StringComparison.OrdinalIgnoreCase) >= 0) return t;
            return null;
        }

        /// <summary>停用 Starter Assets rig 內建的移動／轉向／瞬移 provider（我們用自己的 StickLocomotion／StickTeleport，避免重複移動）。依型別名稱停用，不綁特定 XRI 版本的命名空間。</summary>
        static void DisableStarterLocomotion(GameObject rig)
        {
            string[] names = { "ContinuousMoveProvider", "SnapTurnProvider", "ContinuousTurnProvider", "TeleportationProvider", "DynamicMoveProvider", "ActionBasedContinuousMoveProvider", "ActionBasedSnapTurnProvider", "ActionBasedContinuousTurnProvider" };
            foreach (var mb in rig.GetComponentsInChildren<MonoBehaviour>(true))
            {
                if (mb == null) continue;
                for (var t = mb.GetType(); t != null; t = t.BaseType)
                    if (Array.IndexOf(names, t.Name) >= 0) { mb.enabled = false; break; }
            }
        }

        static void BuildWorkshopPlaceholder(Transform parent)
        {
            var root = new GameObject("WorkshopPlaceholder");
            root.transform.SetParent(parent);
            root.transform.position = ThreeCoords.Position(Stations.WorkshopOffsetThree.x, 0, Stations.WorkshopOffsetThree.z);
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            floor.name = "Floor"; floor.transform.SetParent(root.transform, false);
            floor.transform.localScale = new Vector3(19f, 0.05f, 19f); floor.transform.localPosition = new Vector3(0, -0.05f, 0);
            floor.GetComponent<Renderer>().sharedMaterial = LitMat(new Color(0.28f, 0.2f, 0.14f));
            var machine = GameObject.CreatePrimitive(PrimitiveType.Cube); // 機台鋼板佔位（2.2 x 1.6，高 1 m）
            machine.name = "MachinePlaceholder"; machine.transform.SetParent(root.transform, false);
            machine.transform.localScale = new Vector3(2.2f, 1f, 1.6f); machine.transform.localPosition = new Vector3(0, 0.5f, 0);
            machine.GetComponent<Renderer>().sharedMaterial = LitMat(new Color(0.18f, 0.28f, 0.22f));
            var desk = GameObject.CreatePrimitive(PrimitiveType.Cube); // 工作桌佔位（1.8 x 0.8 x 0.9，中心 (0,5.8)）
            desk.name = "DeskPlaceholder"; desk.transform.SetParent(root.transform, false);
            desk.transform.localScale = new Vector3(1.8f, 0.9f, 0.8f); desk.transform.localPosition = ThreeCoords.Position(0, 0.45f, 5.8f);
            desk.GetComponent<Renderer>().sharedMaterial = LitMat(new Color(0.4f, 0.28f, 0.16f));
            var sun = new GameObject("PlaceholderLight").AddComponent<Light>();
            sun.type = LightType.Point; sun.range = 25f; sun.intensity = 2f; sun.color = ExteriorSceneBuilder.HexColor(0xffd9a0);
            sun.transform.SetParent(root.transform, false); sun.transform.localPosition = new Vector3(0, 6f, 0);
            foreach (var st in Stations.WorkshopDiscs())
            {
                var disc = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                disc.name = "TeleportDisc_" + st.Name; disc.transform.SetParent(root.transform);
                disc.transform.position = st.Position + Vector3.up * 0.01f;
                disc.transform.localScale = new Vector3(0.56f, 0.01f, 0.56f);
                disc.GetComponent<Renderer>().sharedMaterial = LitMat(new Color(0.72f, 0.54f, 0.25f));
                UnityEngine.Object.DestroyImmediate(disc.GetComponent<Collider>());
                var td = disc.AddComponent<TeleportDisc>(); td.station = st;
            }
        }

        static Material LitMat(Color c)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var m = new Material(shader) { color = c };
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            return m;
        }
    }
}
