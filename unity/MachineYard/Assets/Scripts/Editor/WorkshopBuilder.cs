using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace MachineYard.Editor
{
    /// <summary>
    /// 階段 4：用匯入的 workshop_*／toolbox_*／machine_lathe_* 建出穹頂工作室與車床，並接上車床控制腳本。
    /// 由 LobbySceneBuilder 在檔案齊全時呼叫（否則退回佔位工作室）。座標與擺放照 src/xr/areas/Workshop.js：
    /// 房間固定、機台正面朝南、機台中心對齊房間中央（placement.offset）。
    /// </summary>
    internal static class WorkshopBuilder
    {
        const string Dir = "Assets/Models/";
        /// <summary>three.js 光強度 → Unity 的粗略換算係數（目測初值，實機調整）。</summary>
        const float PointScale = 0.25f, SunScale = 0.5f;
        /// <summary>小於這個尺寸（公尺，包圍盒對角線）的裝飾零件（鉚釘、螺絲、鏈環…）預設停用以省三角形；可在 Inspector 改。</summary>
        public static float TinyDetailMeters = 0.05f;

        public static bool HasAssets() =>
            Load("workshop_static.glb") && Load("workshop_interactive.glb") && Load("machine_lathe_static.glb") && Load("machine_lathe_interactive.glb")
            && AssetDatabase.LoadAssetAtPath<TextAsset>(Dir + "machine_lathe_runtime.json") != null;

        static bool Load(string f) => AssetDatabase.LoadAssetAtPath<GameObject>(Dir + f) != null;
        static GameObject Inst(string f, Transform parent, string name)
        {
            var a = AssetDatabase.LoadAssetAtPath<GameObject>(Dir + f);
            if (a == null) return null;
            var go = (GameObject)PrefabUtility.InstantiatePrefab(a, parent);
            go.name = name;
            return go;
        }

        static void MarkStatic(GameObject go)
        {
            foreach (var t in go.GetComponentsInChildren<Transform>(true))
                GameObjectUtility.SetStaticEditorFlags(t.gameObject, StaticEditorFlags.ContributeGI | StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccluderStatic | StaticEditorFlags.OccludeeStatic | StaticEditorFlags.ReflectionProbeStatic);
        }

        /// <summary>停用很小的零件。回傳省下的三角形數。</summary>
        static long DisableTiny(GameObject root, float diagonal)
        {
            long saved = 0; int count = 0;
            foreach (var r in root.GetComponentsInChildren<MeshRenderer>(false))
            {
                if (r.bounds.size.magnitude >= diagonal) continue;
                var mf = r.GetComponent<MeshFilter>();
                if (mf != null && mf.sharedMesh != null) saved += mf.sharedMesh.triangles.Length / 3;
                r.enabled = false; count++;
            }
            Debug.Log($"[Machine Yard] 停用 {count} 個小於 {diagonal * 100:0} cm 的裝飾零件，省下約 {saved:N0} 個三角形。");
            return saved;
        }

        public static MachineEffects LastFx; public static MachineSwitcher LastSwitcher;

        static bool HasMachine(string id) =>
            Load($"machine_{id}_static.glb") && Load($"machine_{id}_interactive.glb") && AssetDatabase.LoadAssetAtPath<TextAsset>($"{Dir}machine_{id}_runtime.json") != null;

        /// <summary>建一台機台（含必要的腳本）。鐵座（drill）照 Workshop.js 的 createPedestal：箱形底座＋黃銅頂板，高度 = placement 的抬高量。</summary>
        static MachineSwitcher.Entry BuildMachine(Transform root, Camera head, string id, MachineEffects fx, List<LatheCuttingController> lathes, List<HeadMachining> heads)
        {
            var json = AssetDatabase.LoadAssetAtPath<TextAsset>($"{Dir}machine_{id}_runtime.json");
            var cfg = MachineRuntimeConfig.Parse(json.text);
            var slot = new GameObject("MachineSlot_" + id).transform; slot.SetParent(root, false);
            slot.localRotation = ThreeCoords.AxisAngle(Vector3.up, cfg.placement.machineSlotRotationY);
            var off = new GameObject("MachineOffset").transform; off.SetParent(slot, false);
            var o = cfg.placement.offset; off.localPosition = ThreeCoords.Position(o[0], o[1], o[2]);
            var scene = new GameObject("MachineScene").transform; scene.SetParent(off, false);
            var ms = Inst($"machine_{id}_static.glb", scene, $"machine_{id}_static"); MarkStatic(ms);
            Inst($"machine_{id}_interactive.glb", scene, $"machine_{id}_interactive");

            var machine = scene.gameObject.AddComponent<LatheMachine>();
            machine.runtimeJson = json; machine.machineRoot = scene;
            var wiring = scene.gameObject.AddComponent<MachineControlWiring>(); wiring.machine = machine;
            var audio = scene.gameObject.AddComponent<MachineAudio>(); audio.machine = machine;
            if (id == "lathe")
            {
                var cutting = scene.gameObject.AddComponent<LatheCuttingController>(); cutting.machine = machine;
                wiring.cutting = cutting; audio.lathe = cutting; lathes.Add(cutting);
                var panel = scene.gameObject.AddComponent<MachinePanel>(); panel.head = head; panel.machine = machine; panel.cutting = cutting; panel.wiring = wiring;
            }
            else
            {
                var work = scene.gameObject.AddComponent<HeadMachining>(); work.machine = machine;
                wiring.head = work; audio.head = work; heads.Add(work);
                var panel = scene.gameObject.AddComponent<HeadMachinePanel>(); panel.head = head; panel.machine = machine; panel.work = work; panel.wiring = wiring;
            }
            if (cfg.placement.pedestal) BuildPedestal(slot, scene, id == "drill" ? 0.72f : o[1]);
            return new MachineSwitcher.Entry { id = id, root = slot.gameObject };
        }

        static void BuildPedestal(Transform slot, Transform machineScene, float height)
        {
            // 以機台渲染範圍在 slot 局部座標的外框決定底座大小（+0.12 × +0.1，Workshop.js createPedestal）
            Vector3 min = new Vector3(1e9f, 1e9f, 1e9f), max = -min;
            foreach (var r in machineScene.GetComponentsInChildren<Renderer>(false))
            {
                var b = r.bounds;
                for (int i = 0; i < 8; i++)
                {
                    var c = b.center + new Vector3((i & 1) == 0 ? -b.extents.x : b.extents.x, (i & 2) == 0 ? -b.extents.y : b.extents.y, (i & 4) == 0 ? -b.extents.z : b.extents.z);
                    var l = slot.InverseTransformPoint(c); min = Vector3.Min(min, l); max = Vector3.Max(max, l);
                }
            }
            float w = max.x - min.x + 0.12f, d = max.z - min.z + 0.1f;
            var iron = SimpleMat.Lit(new Color(0.18f, 0.16f, 0.15f), 0.65f, 0.45f); var brass = SimpleMat.Lit(new Color(0.7f, 0.55f, 0.3f), 0.9f, 0.65f);
            var g = new GameObject("MachinePedestal").transform; g.SetParent(slot, false);
            g.localPosition = new Vector3((min.x + max.x) / 2, 0, (min.z + max.z) / 2);
            PedestalBox(g, iron, w + 0.08f, 0.06f, d + 0.08f, 0.03f);
            PedestalBox(g, iron, w - 0.04f, height - 0.08f, d - 0.04f, height / 2);
            PedestalBox(g, brass, w, 0.05f, d, height - 0.025f);
        }

        static void PedestalBox(Transform parent, Material m, float sx, float sy, float sz, float y)
        {
            var c = GameObject.CreatePrimitive(PrimitiveType.Cube); Object.DestroyImmediate(c.GetComponent<Collider>());
            c.transform.SetParent(parent, false); c.transform.localPosition = new Vector3(0, y, 0); c.transform.localScale = new Vector3(sx, sy, sz);
            c.GetComponent<MeshRenderer>().sharedMaterial = m; GameObjectUtility.SetStaticEditorFlags(c, StaticEditorFlags.BatchingStatic);
        }

        public static Transform Build(Transform parent, Camera head)
        {
            GameObject toolboxInteractive = null;
            var root = new GameObject("Workshop").transform;
            root.SetParent(parent);
            root.position = ThreeCoords.Position(Stations.WorkshopOffsetThree.x, 0, Stations.WorkshopOffsetThree.z);

            // ---- 房間（靜態）與會動的擺設
            var room = Inst("workshop_static.glb", root, "workshop_static");
            MarkStatic(room);
            DisableTiny(room, TinyDetailMeters);
            var roomI = Inst("workshop_interactive.glb", root, "workshop_interactive");

            // ---- 工作桌與工具箱（階段 5 才做拿起展示流程；這裡只當擺設，13 件工具在箱內位置）
            var tb = Inst("toolbox_static.glb", root, "toolbox_static"); if (tb != null) MarkStatic(tb);
            toolboxInteractive = Inst("toolbox_interactive.glb", root, "toolbox_interactive");

            // ---- 瞬移圓盤：優先用匯出的 TeleportDisc_* 外觀，找不到就做簡單的圓盤
            foreach (var st in Stations.WorkshopDiscs())
            {
                Transform node = roomI != null ? XrUtil.FindDeep(roomI.transform, "TeleportDisc_" + st.Name) : null;
                GameObject target;
                if (node != null) target = node.gameObject;
                else
                {
                    target = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                    target.name = "TeleportDisc_" + st.Name; target.transform.SetParent(root);
                    target.transform.position = st.Position + Vector3.up * 0.01f;
                    target.transform.localScale = new Vector3(0.56f, 0.01f, 0.56f);
                    Object.DestroyImmediate(target.GetComponent<Collider>());
                }
                target.AddComponent<TeleportDisc>().station = st;
            }

            // ---- 特效與灰塵（粒子上限固定，見 Effects.cs）
            var fx = root.gameObject.AddComponent<MachineEffects>();
            DustMotes.Create(root, ThreeCoords.Position(0, 2.6f, 0), new Vector3(9f, 4.5f, 9f));
            LastFx = fx;

            // ---- 機台：每台各一組 MachineSlot(旋轉) → MachineOffset(位置) → MachineScene(static+interactive)；同一時間只啟用一台
            var switcher = root.gameObject.AddComponent<MachineSwitcher>();
            switcher.fx = fx; switcher.workshopRoot = root; switcher.head = head;
            var lathes = new List<LatheCuttingController>(); var heads = new List<HeadMachining>();
            foreach (var id in new[] { "lathe", "milling", "drill" })
            {
                if (!HasMachine(id)) { Debug.LogWarning($"[Machine Yard] 沒有 machine_{id} 的 glb／runtime.json，略過這台機台（請執行 2b 匯入）。"); continue; }
                var entry = BuildMachine(root, head, id, fx, lathes, heads);
                switcher.entries.Add(entry);
            }
            foreach (var e in switcher.entries) e.root.SetActive(e.id == "lathe");
            switcher.Current = "lathe";
            fx.lathes = lathes.ToArray(); fx.heads = heads.ToArray();

            // ---- 工作桌上的工具箱：點工具 → 升起展示（階段 5）
            var tray = toolboxInteractive != null ? XrUtil.FindDeep(toolboxInteractive.transform, "ToolTray") : null;
            if (tray != null)
            {
                var flow = root.gameObject.AddComponent<ToolboxFlow>();
                flow.workshopRoot = root; flow.tray = tray; flow.head = head; flow.fx = fx;
            }
            LastSwitcher = switcher;

            AddLights(root);
            Debug.Log("[Machine Yard] 工作室與車床已建立（階段 4）。");
            return root;
        }

        // 光源參數取自匯出的 manifest（groups[workshop].lights）
        static void AddLights(Transform root)
        {
            var ta = AssetDatabase.LoadAssetAtPath<TextAsset>(Dir + "manifest.json");
            if (ta == null) { Debug.LogWarning("[Machine Yard] 沒有 Assets/Models/manifest.json，工作室沒有光源。請重新執行匯入。"); return; }
            var groups = (JArray)JObject.Parse(ta.text)["groups"];
            int n = 0;
            foreach (var g in groups)
            {
                if ((string)g["base"] != "workshop") continue;
                foreach (var l in (JArray)g["lights"])
                {
                    string type = (string)l["type"], name = (string)l["name"];
                    var pos = l["position"].ToObject<float[]>();
                    ColorUtility.TryParseHtmlString((string)l["color"], out var color);
                    float intensity = l["intensity"] != null && l["intensity"].Type != JTokenType.Null ? (float)l["intensity"] : 1f;
                    if (type == "HemisphereLight")
                    {
                        RenderSettings.ambientMode = AmbientMode.Flat; RenderSettings.ambientLight = color * Mathf.Clamp01(intensity * 0.5f); continue;
                    }
                    var go = new GameObject(name); go.transform.SetParent(root, false);
                    var light = go.AddComponent<Light>(); light.color = color; light.shadows = LightShadows.None;
                    if (type == "DirectionalLight")
                    {
                        light.type = LightType.Directional; light.intensity = intensity * SunScale;
                        go.transform.rotation = Quaternion.LookRotation(ThreeCoords.Direction(-pos[0], -pos[1], -pos[2]));
                    }
                    else
                    {
                        light.type = LightType.Point; light.intensity = intensity * PointScale;
                        float dist = (l["distance"] != null && (l["distance"].Type == JTokenType.Float || l["distance"].Type == JTokenType.Integer)) ? (float)l["distance"] : 0;
                        light.range = dist > 0 ? dist : 10f;
                        go.transform.localPosition = ThreeCoords.Position(pos[0], pos[1], pos[2]);
                        if (name.StartsWith("EdisonLamp_") || name == "BoilerFire") { var f = go.AddComponent<GasLanternFlicker>(); f.baseIntensity = light.intensity; f.index = n; }
                    }
                    n++;
                }
            }
            Debug.Log($"[Machine Yard] 工作室光源 {n} 盞（依 manifest；強度是目測初值，需要實機調整）。");
        }
    }
}
