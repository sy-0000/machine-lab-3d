using System;
using MachineYard.Core;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 銑床／鑽床的槌頭加工（對應 HeadMachiningAdapter.js ＋ MachineSession 的相關指令）：
    ///   · 在工件掛點（mounts.workpiece）放槌頭毛胚，在刀具掛點（mounts.tool）裝程序化刀具，鑽床把刀柄坐在夾頭上。
    ///   · 軸或手柄每動一次，量刀尖在毛胚座標（X 圖面左→右、Y 前→後、Z 自底面向上，mm）的位置，交給 Core 的 HeadCutting。
    ///   · 接觸光圈：刀尖碰到工件亮黃色，轉動中切削亮橘色。
    ///   · 裝夾：Place（把毛胚移到指定刀尖位置）、Slide（鑽床滑動虎鉗對劃線）、DefaultSetup。
    /// 座標一律在機台局部的 three.js 座標中算（LocalSpace），與網站相同。
    /// </summary>
    public class HeadMachining : MonoBehaviour
    {
        public LatheMachine machine;
        public HeadState State { get; private set; }
        public HeadWorkpieceView View { get; private set; }
        public HeadToolDef ToolDef { get; private set; }
        public int CutCount { get; private set; }
        public bool Unsafe { get; private set; }
        public int ContactLevel { get; private set; }     // 0 無、1 接觸、2 切削中
        public double EmbedMm { get; private set; }
        public HeadPoint? LastTip { get; private set; }
        public bool IsDrill => machine.Config.machineId == "drill";
        public event Action<Vector3, Vector3, int> Chips;   // 世界座標位置、飛出方向、數量
        public event Action<string> Warn;
        public event Action Cut;                              // 每次實際改動工件
        public event Action Plunged;                          // 停止的刀尖壓入工件（火花與警告）

        Transform toolMount, workMount, toolRoot, vise; HeadPoint? before; double beforeRpm; bool beforeRunning; LineRenderer ring; float lastDepthSignal;
        public readonly System.Collections.Generic.Dictionary<string, double> Zero = new System.Collections.Generic.Dictionary<string, double>();

        void Start() { machine.BeforeMove += OnBefore; machine.AfterMove += OnAfter; if (machine.Ready) Setup(); else StartCoroutine(WaitSetup()); }
        System.Collections.IEnumerator WaitSetup() { while (!machine.Ready) yield return null; Setup(); }
        void OnDestroy() { if (machine != null) { machine.BeforeMove -= OnBefore; machine.AfterMove -= OnAfter; } }

        void Setup()
        {
            EnsureMounts();
            MountTool(HeadToolDef.For(machine.Config.machineId)[0].Id);
            NewStock();
        }

        Transform EnsureMount(string nodeName, MountCfg cfg)
        {
            if (!machine.Nodes.TryGetValue(nodeName, out var t))
            {
                if (!machine.Nodes.TryGetValue(cfg.parent, out var parent)) { Debug.LogError("[Machine Yard] 找不到掛點的父節點 " + cfg.parent); return null; }
                t = new GameObject(nodeName).transform; t.SetParent(parent, false); machine.Nodes[nodeName] = t;
            }
            t.localPosition = ThreeCoords.Position(cfg.position[0], cfg.position[1], cfg.position[2]);
            t.localRotation = ThreeCoords.EulerXYZ(cfg.rotation[0], cfg.rotation[1], cfg.rotation[2]);
            return t;
        }

        void EnsureMounts()
        {
            toolMount = EnsureMount("ToolMount", machine.Config.mounts.tool);
            workMount = EnsureMount("WorkpieceMount", machine.Config.mounts.workpiece);
        }

        // ---- 刀具
        public void MountTool(string id)
        {
            var def = HeadToolDef.ById(id); if (def == null || toolMount == null) return;
            if (machine.SpindleRunning || machine.Spindle.Rpm > 0) { Warn?.Invoke("停機後才能換刀"); return; }
            if (toolRoot != null) Destroy(toolRoot.gameObject);
            ToolDef = def;
            toolRoot = def.Build().transform; toolRoot.SetParent(toolMount, false);
            // 機台原有的教學刀具（銑床 FaceMill、鑽床 TwistDrill）隱藏，避免與新刀重疊；鑽床把新刀柄頂坐在原鑽頭的位置
            foreach (var a in machine.Config.additions ?? new AdditionCfg[0])
            {
                if (a.kind != "cuttingTool" || !machine.Nodes.TryGetValue(a.name, out var node)) continue;
                node.gameObject.SetActive(false);
                if (IsDrill) toolRoot.localPosition = ToolMountLocal(node);
            }
            Unsafe = false; before = null;
        }

        // 原鑽頭節點相對刀具掛點的位置（兩者同一個父節點）
        Vector3 ToolMountLocal(Transform node) => toolMount.parent == node.parent ? node.localPosition - toolMount.localPosition : Vector3.zero;

        public void NextTool(int step)
        {
            var list = HeadToolDef.For(machine.Config.machineId); int i = list.FindIndex(d => d == ToolDef);
            MountTool(list[((i + step) % list.Count + list.Count) % list.Count].Id);
        }

        // ---- 毛胚
        public void NewStock()
        {
            if (workMount == null) return;
            if (State != null && (machine.SpindleRunning || machine.Spindle.Rpm > 0)) { Warn?.Invoke("停機後才能換新工件"); return; }
            State = IsDrill ? HeadState.CreateDrillStock() : HeadState.CreateBlock();
            if (View == null) View = HeadWorkpieceView.Create(workMount, State); else View.SetState(State);
            View.transform.localPosition = Vector3.zero; View.transform.localRotation = Quaternion.identity;
            CutCount = 0; Unsafe = false; before = null; Zero.Clear();
            DefaultSetup();
        }

        /// <summary>載入存檔的毛胚（來自 WorkpieceSaves）；重新定位裝夾（需停機）。</summary>
        public void LoadState(HeadState s)
        {
            if (s == null || workMount == null) return;
            State = s; View.SetState(s); View.transform.localPosition = Vector3.zero; CutCount = 0; before = null; Zero.Clear();
            DefaultSetup();
        }

        public void DefaultSetup()
        {
            if (!Sample(out var p)) return;
            if (IsDrill) Place(State.LengthMm / 2, State.WidthMm / 2, 5, null);
            else Place(-(ToolDef.Radius * 1000 + 8), State.WidthMm / 2, 5, null);
        }

        // ---- 量刀尖（毛胚座標 mm）
        public bool Sample(out HeadPoint p)
        {
            p = default;
            if (View == null || toolRoot == null || State == null) return false;
            var root = machine.machineRoot;
            var inMachine = LocalSpace.ToAncestor(toolRoot, root, ThreeCoords.Position(0, ToolDef.TipY, 0));
            var local = ThreeCoords.ToThree(LocalSpace.FromAncestor(View.transform, root, inMachine));
            double R(double v) => Math.Round(v, 3) + 0.0;   // float 的局部座標鏈約有 1e-3 mm 雜訊，量化到 1 µm
            p = new HeadPoint(R(local.x * 1000.0 + State.LengthMm / 2), R(local.z * 1000.0 + State.WidthMm / 2), R(local.y * 1000.0));
            return true;
        }

        public bool TipOnStock() => ContactLevel > 0;
        public Vector3 TipWorld() => toolRoot.TransformPoint(ThreeCoords.Position(0, ToolDef.TipY, 0));

        void OnBefore() { before = null; if (Sample(out var p)) { before = p; beforeRpm = machine.Spindle.Rpm; beforeRunning = machine.SpindleRunning; } }

        void OnAfter()
        {
            if (!Sample(out var after)) return;
            LastTip = after;
            if (before == null || State == null) return;
            var from = beforeRunning && beforeRpm > 0 ? before.Value : after;
            // 鑽孔／攻牙只接受純軸向進給（Core 的容許是 1e-7 mm，JS 的 double 能做到）；float 量到的橫向漂移 < 0.01 mm 視為 0
            if (ToolDef.Type != HeadToolType.Milling && Math.Sqrt(Sq(after.XMm - from.XMm) + Sq(after.YMm - from.YMm)) < 0.01) { after.XMm = from.XMm; after.YMm = from.YMm; }
            bool changed = HeadCutting.Cut(State, from, after, ToolDef.ToCore(), machine.SpindleRunning, machine.Spindle.Rpm, machine.DirectionRequested);
            if (!changed) return;
            CutCount++; Cut?.Invoke();
            EmitChips(after, Math.Sqrt(Sq(after.XMm - from.XMm) + Sq(after.YMm - from.YMm) + Sq(after.ZMm - from.ZMm)));
        }
        static double Sq(double v) => v * v;

        // 切屑從刀的邊緣飛出，沿主軸旋轉方向與向外（HeadMachiningAdapter.cut 的 source()）
        void EmitChips(HeadPoint p, double travelMm)
        {
            if (Chips == null) return;
            int count = Mathf.Clamp(Mathf.CeilToInt((float)(travelMm * 1.5 + 1)), 1, 14);
            double radius = ToolDef.Radius * 1000; int dir = machine.DirectionRequested;
            for (int k = 0; k < count; k++)
            {
                float a = UnityEngine.Random.value * Mathf.PI * 2, c = Mathf.Cos(a), s = Mathf.Sin(a);
                double x = Math.Max(-1, Math.Min(State.LengthMm + 1, p.XMm + radius * c)), y = Math.Max(-1, Math.Min(State.WidthMm + 1, p.YMm + radius * s));
                double z = IsDrill ? State.SurfaceAt(p.XMm, p.YMm) + 1 : Math.Max(0, p.ZMm) + .5;
                var at = View.transform.TransformPoint(ThreeCoords.Position((float)((x - State.LengthMm / 2) * 0.001), (float)(z * 0.001), (float)((y - State.WidthMm / 2) * 0.001)));
                float k1 = IsDrill ? .7f : .6f, k2 = IsDrill ? .5f : .8f;
                var away = View.transform.TransformDirection(ThreeCoords.Direction(c * k1 - s * dir * k2, IsDrill ? .9f : .5f, s * k1 + c * dir * k2));
                Chips(at, away, 1);
            }
        }

        // ---- 接觸光圈與警告
        void Update()
        {
            if (State == null || !Sample(out var tip) || ToolDef == null) return;
            double top = State.SurfaceUnder(tip, ToolDef.Radius * 2000);
            bool contact = top > 0 && tip.ZMm <= top + 0.05;
            int level = contact ? (machine.SpindleRunning && machine.Spindle.Rpm > 0 ? 2 : 1) : 0;
            EmbedMm = contact ? Math.Max(0, top - tip.ZMm) : 0;
            bool nowUnsafe = contact && EmbedMm > 0.1 && !(machine.SpindleRunning && machine.Spindle.Rpm > 0);
            if (nowUnsafe && !Unsafe) { Warn?.Invoke("刀尖壓入工件：退回再重新對刀"); Plunged?.Invoke(); }
            Unsafe = nowUnsafe;
            ContactLevel = level;
            UpdateRing(level, tip);
        }

        void UpdateRing(int level, HeadPoint tip)
        {
            if (ring == null)
            {
                var go = new GameObject("ContactMarker"); go.transform.SetParent(View.transform, false);
                ring = go.AddComponent<LineRenderer>(); ring.useWorldSpace = false; ring.widthMultiplier = 0.0012f; ring.positionCount = 40;
                ring.material = SimpleMat.Unlit(Color.yellow);
                var pts = new Vector3[40];
                for (int i = 0; i < 40; i++) { float a = i / 39f * Mathf.PI * 2; pts[i] = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)); }
                ring.SetPositions(pts);
            }
            ring.gameObject.SetActive(level > 0);
            if (level == 0) return;
            var c = level > 1 ? new Color(1f, 0.42f, 0.17f) : new Color(1f, 0.71f, 0.28f);
            ring.startColor = c; ring.endColor = c;
            ring.transform.localPosition = ThreeCoords.Position((float)((tip.XMm - State.LengthMm / 2) * 0.001), (float)(Math.Max(0, tip.ZMm) * 0.001), (float)((tip.YMm - State.WidthMm / 2) * 0.001));
            ring.transform.localScale = Vector3.one * (float)((ToolDef.Radius * 1000 + 0.3) * 0.001);
        }

        // ---- 裝夾
        /// <summary>把毛胚平移到刀尖落在毛胚座標 (xMm, yMm, tipZMm) 的位置（HeadMachiningAdapter.place）；tipZMm 預設為毛胚高 + clearance。</summary>
        public bool Place(double xMm, double yMm, double clearanceMm = 5, double? tipZMm = null)
        {
            if (machine.SpindleRunning || machine.Spindle.Rpm > 0) { Warn?.Invoke("停機後才能重新定位裝夾"); return false; }
            if (!Sample(out var p)) return false;
            double tz = tipZMm ?? State.HeightMm + clearanceMm;
            // 毛胚往 +delta 移動，刀尖在毛胚座標的位置就減少 delta；毛胚 (X, 高, Z) 對應 mm 座標 (X, Z, Y)
            var delta = ThreeCoords.Position((float)((p.XMm - xMm) * 0.001), (float)((p.ZMm - tz) * 0.001), (float)((p.YMm - yMm) * 0.001));
            View.transform.localPosition += View.transform.parent.InverseTransformVector(View.transform.TransformVector(delta));
            FitVise();
            before = null;
            return true;
        }

        /// <summary>鑽床：沿毛胚 X 滑動虎鉗，把鑽頭對準劃線。</summary>
        public bool Slide(double deltaMm)
        {
            if (!IsDrill) { Warn?.Invoke("只有鑽床可以滑動虎鉗定位"); return false; }
            if (!Sample(out var p)) return false;
            if (p.ZMm <= State.HeightMm + 0.5) { Warn?.Invoke("鑽頭還在工件裡：放開進給、讓鑽頭回到上方再移動工件"); return false; }
            double x = Math.Round(Math.Max(-10, Math.Min(State.LengthMm + 10, p.XMm + deltaMm)) * 1000) / 1000;
            return Place(x, p.YMm, 5, p.ZMm);
        }

        // 虎鉗：毛胚下方到工作臺的簡化方塊（沿用 createVise 的配置：固定鉗口、活動鉗口、平行墊塊、底座）
        void FitVise()
        {
            if (vise != null) Destroy(vise.gameObject);
            var g = new GameObject("Fixture_Vise"); vise = g.transform; vise.SetParent(View.transform, false);
            double gapMm = Math.Max(14, View.transform.localPosition.y * 1000); // 毛胚底面離工作臺面（掛點）的距離
            float gap = (float)(gapMm * 0.001), halfL = (float)(Math.Max(50, State.LengthMm * .56) * 0.001), halfW = (float)(State.WidthMm / 2 * 0.001), jaw = 0.016f;
            var body = SimpleMat.Lit(new Color(0.24f, 0.35f, 0.45f), 0.35f, 0.45f);
            var steel = SimpleMat.Lit(new Color(0.68f, 0.72f, 0.76f), 0.85f, 0.7f);
            Box(vise, "Base", body, -halfL - 0.008f, halfL + 0.008f, -gap, -gap * 0.7f, -halfW - jaw - 0.012f, halfW + jaw + 0.09f);
            Box(vise, "Body", body, -halfL * .62f, halfL * .62f, -gap * 0.7f, -0.012f, -halfW - jaw - 0.006f, halfW + jaw + 0.09f);
            Box(vise, "FixedJaw", body, -halfL, halfL, -0.012f, 0.008f, -halfW - jaw - 0.006f, -halfW);
            Box(vise, "MovingJaw", steel, -halfL * .9f, halfL * .9f, -0.012f, 0.008f, halfW, halfW + jaw);
            Box(vise, "ParallelA", steel, -(float)State.LengthMm * 0.0005f + 0.002f, (float)State.LengthMm * 0.0005f - 0.002f, -0.012f, 0, -halfW, -halfW + 0.004f);
            Box(vise, "ParallelB", steel, -(float)State.LengthMm * 0.0005f + 0.002f, (float)State.LengthMm * 0.0005f - 0.002f, -0.012f, 0, halfW - 0.004f, halfW);
        }

        // three 座標的方塊範圍（x0..x1, y0..y1, z0..z1），轉成 Unity 局部座標
        static void Box(Transform parent, string name, Material mat, float x0, float x1, float y0, float y1, float z0, float z1)
        {
            var c = GameObject.CreatePrimitive(PrimitiveType.Cube);
            UnityEngine.Object.DestroyImmediate(c.GetComponent<Collider>());
            c.name = name; c.transform.SetParent(parent, false);
            c.transform.localPosition = ThreeCoords.Position((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
            c.transform.localScale = new Vector3(Mathf.Abs(x1 - x0), Mathf.Abs(y1 - y0), Mathf.Abs(z1 - z0));
            c.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }

        // ---- DRO（MillingController／DrillController 的 getState().dro）
        public double Offset(string axis) => machine.Axes.Offsets.TryGetValue(axis, out var v) ? v : 0;
        public void ZeroAxis(string axis) { Zero[axis] = Offset(axis); }
        public double Dro(string axis) => (Offset(axis) - (Zero.TryGetValue(axis, out var z) ? z : 0)) * 1000.0;
    }
}
