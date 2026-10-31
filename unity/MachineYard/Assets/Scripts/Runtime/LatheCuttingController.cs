using MachineYard.Core;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 切削（對應 MachineV1Adapter.js 的 #cuttingSample／#cut／alignCuttingTip）：
    /// 軸或手輪每動一次，量刀尖（車刀刀片的 cuttingTipLocal）在「不旋轉的工件座標」中的位置（Z 沿主軸、U 高度、V 徑向），
    /// 用 Core 的 CutRevolvedProfile／CutFacing 削掉工件，並判斷是否撞到夾頭。座標計算全部在 three.js 空間做
    /// （把 Unity 世界座標換回機台局部的 three.js 座標），這樣右手系的叉積、V 的正負與網站完全一致。
    /// </summary>
    public class LatheCuttingController : MonoBehaviour
    {
        public LatheMachine machine;
        public enum Mode { Turning, Facing }
        public Mode mode = Mode.Turning;
        public LatheWorkpiece workpiece { get; private set; }
        public bool Unsafe { get; private set; }
        public int CutCount { get; private set; }
        public TipMm? LastTip { get; private set; }
        public event System.Action<bool> CutHappened; // 參數：這一刀是否正在持續切削（給震動用）

        Transform mount, insert, toolRoot; Vector3 tip; TipMm? before; double beforeRpm;
        public double DatumX, DatumZ; // 工件座標零點（Zero 按鈕）

        void Start() { machine.BeforeMove += OnBefore; machine.AfterMove += OnAfter; }
        void OnDestroy() { if (machine != null) { machine.BeforeMove -= OnBefore; machine.AfterMove -= OnAfter; } }

        public bool HasWorkpiece => workpiece != null;

        /// <summary>建立（或重置）WorkpieceMount 與槌柄工件，並把刀尖高度對準主軸中心（alignCuttingTip）。</summary>
        public void MountHandle()
        {
            EnsureMount();
            if (workpiece == null) workpiece = LatheWorkpiece.Create(mount); else workpiece.ResetToStock();
            AlignCuttingTip();
            Unsafe = false; CutCount = 0;
        }

        void EnsureMount()
        {
            if (mount != null) return;
            var cfg = machine.Config.mounts.workpiece;
            if (!machine.Nodes.TryGetValue(cfg.parent, out var parent)) { Debug.LogError("[Machine Yard] 找不到工件掛點的父節點 " + cfg.parent); return; }
            if (!machine.Nodes.TryGetValue("WorkpieceMount", out mount))
            {
                mount = new GameObject("WorkpieceMount").transform; mount.SetParent(parent, false);
                machine.Nodes["WorkpieceMount"] = mount;
            }
            mount.localPosition = ThreeCoords.Position(cfg.position[0], cfg.position[1], cfg.position[2]);
            mount.localRotation = ThreeCoords.EulerXYZ(cfg.rotation[0], cfg.rotation[1], cfg.rotation[2]);
        }

        bool FindInsert()
        {
            if (insert != null) return true;
            var ins = machine.Config.cuttingInserts;
            if (ins == null || ins.Length == 0 || ins[0].tip == null) return false;
            if (!machine.Nodes.TryGetValue(ins[0].node, out insert)) return false;
            tip = new Vector3(ins[0].tip[0], ins[0].tip[1], ins[0].tip[2]);
            toolRoot = FindToolRoot(insert);
            return true;
        }

        // 車刀整組（TurningTool）：從刀片往上找名稱含 "TurningTool" 的節點
        static Transform FindToolRoot(Transform insert)
        {
            for (var t = insert; t != null; t = t.parent) if (t.name == "TurningTool") return t;
            return insert.parent;
        }

        // 機台局部（three.js 座標）
        Vector3 ToMachineThree(Vector3 world) => ThreeCoords.ToThree(machine.machineRoot.InverseTransformPoint(world));

        public bool Sample(out TipMm pos, out Vector3 tipWorld)
        {
            pos = default; tipWorld = default;
            if (workpiece == null || mount == null || !FindInsert()) return false;
            // 局部座標鏈換算（LocalSpace，不經世界座標：工作室在 x = 200 m，float 的世界座標只有約 0.015 mm 精度，見 D27）
            var root = machine.machineRoot;
            var origin = ThreeCoords.ToThree(LocalSpace.ToAncestor(mount, root, Vector3.zero));
            var axis = (ThreeCoords.ToThree(LocalSpace.ToAncestor(mount, root, ThreeCoords.Direction(1, 0, 0))) - origin).normalized;
            var u = (new Vector3(0, 1, 0) - axis * axis.y).normalized;
            var v = Vector3.Cross(axis, u).normalized;
            var tipLocal = ThreeCoords.Direction(tip.x, tip.y, tip.z);
            tipWorld = insert.TransformPoint(tipLocal);
            var p = ThreeCoords.ToThree(LocalSpace.ToAncestor(insert, root, tipLocal)) - origin;
            double mm(float meters) => System.Math.Round(meters * 1000.0, 3) + 0.0;   // 量化到 1 µm（float 雜訊約 1e-3 mm）
            pos = new TipMm(mm(Vector3.Dot(p, axis)), mm(Vector3.Dot(p, u)), mm(Vector3.Dot(p, v)));
            return true;
        }

        void OnBefore() { before = null; if (Sample(out var p, out _)) { before = p; beforeRpm = machine.Spindle.Rpm; } }

        void OnAfter()
        {
            if (!Sample(out var after, out _)) return;
            LastTip = after;
            if (before == null) return;
            var st = workpiece.State;
            // 主軸剛開始轉的第一格：只在最後位置接觸，不沿路徑掃過
            var from = beforeRpm > 0 ? before.Value : after;
            double rpm = beforeRpm > 0 ? beforeRpm : machine.Spindle.Rpm;
            var danger = new ChuckDanger(Cutting.DefaultChuckDanger.StartZMm, st.ClampEndMm, Cutting.DefaultChuckDanger.RadiusMm);
            bool entering = Cutting.EntersChuck(before.Value, after, danger);
            if (entering && !Unsafe) machine.Say("危險：刀具撞到夾頭！");
            Unsafe = entering;
            if (entering) return;
            bool removed = mode == Mode.Facing ? Cutting.CutFacing(st, from, after, rpm) : Cutting.CutRevolvedProfile(st, from, after, rpm);
            if (removed) { CutCount++; CutHappened?.Invoke(rpm > 0); }
        }

        // ---- 接觸光圈（網站 MachineV1Adapter 的 ContactMarker）：刀尖碰到工件外圓時，在該處畫一圈；轉動中切削為橘色
        LineRenderer ring;
        void Update()
        {
            if (workpiece == null || mount == null || !machine.Ready) { if (ring != null) ring.gameObject.SetActive(false); return; }
            if (!Sample(out var p, out _)) return;
            var st = workpiece.State;
            int idx = (int)System.Math.Min(st.Count - 1, System.Math.Floor(p.Z / st.ResolutionMm));
            bool atStock = p.Z >= 0 && p.Z <= st.LengthMm && idx >= 0;
            double radius = atStock ? st.Radii[idx] : 0;
            bool contact = atStock && p.Z > st.ClampEndMm && System.Math.Sqrt(p.U * p.U + p.V * p.V) <= radius + 0.05;
            if (ring == null)
            {
                var go = new GameObject("ContactMarker"); go.transform.SetParent(mount, false);
                ring = go.AddComponent<LineRenderer>(); ring.useWorldSpace = false; ring.widthMultiplier = 0.0012f; ring.positionCount = 48; ring.material = SimpleMat.Unlit(Color.yellow);
                var pts = new Vector3[48];
                // 單位圓在「垂直於主軸」的平面：three 局部 (0, sinθ, cosθ)（主軸＝局部 +X）
                for (int i = 0; i < 48; i++) { float a = i / 47f * Mathf.PI * 2; pts[i] = ThreeCoords.Position(0, Mathf.Sin(a), Mathf.Cos(a)); }
                ring.SetPositions(pts);
            }
            ring.gameObject.SetActive(contact);
            if (!contact) return;
            var c = machine.Spindle.Rpm > 0 ? new Color(1f, 0.42f, 0.17f) : new Color(1f, 0.71f, 0.28f);
            ring.startColor = c; ring.endColor = c;
            ring.transform.localPosition = ThreeCoords.Position((float)(p.Z * 0.001), 0, 0);
            float r = (float)((radius + 0.3) * 0.001); ring.transform.localScale = new Vector3(1, r, r);
        }

        /// <summary>刀尖高度對準主軸中心：把車刀整組沿機台局部 Y 移動 −U（alignCuttingTip；掛上工件時做一次）。</summary>
        public void AlignCuttingTip()
        {
            if (!Sample(out var p, out _) || toolRoot == null) return;
            var rootThree = ToMachineThree(toolRoot.position);
            rootThree.y -= (float)(p.U / 1000.0);
            var world = machine.machineRoot.TransformPoint(ThreeCoords.Position(rootThree.x, rootThree.y, rootThree.z));
            toolRoot.position = world;
        }

        // ---- 給面板用的狀態
        public struct Readout
        {
            public double XDiameterMm, ZMm, TipZMm, TipDiameterMm, WorkpieceDiameterAtTipMm, HeightErrorMm; public bool Contact, HasTip;
        }
        public Readout Read()
        {
            var r = new Readout();
            if (machine.Axes == null) return r;
            // lathe 座標（latheCoordinates.js，預設正負號 +1）：Z＝縱向 x 軸、X＝橫向 y 軸的半徑 ×2
            r.ZMm = machine.Axes.Offsets["x"] * 1000 - DatumZ;
            r.XDiameterMm = 2 * (machine.Axes.Offsets["y"] * 1000 - DatumX);
            if (workpiece != null && LastTip.HasValue)
            {
                var p = LastTip.Value; var st = workpiece.State;
                r.HasTip = true; r.TipZMm = p.Z - DatumZ; r.HeightErrorMm = p.U;
                r.TipDiameterMm = 2 * (p.V);
                int idx = (int)System.Math.Min(st.Count - 1, System.Math.Floor(p.Z / st.ResolutionMm));
                bool atStock = p.Z >= 0 && p.Z <= st.LengthMm;
                double radius = atStock && idx >= 0 ? st.Radii[idx] : 0;
                r.WorkpieceDiameterAtTipMm = radius * 2;
                r.Contact = atStock && p.Z > st.ClampEndMm && System.Math.Sqrt(p.U * p.U + p.V * p.V) <= radius + 1e-7;
            }
            return r;
        }
    }
}
