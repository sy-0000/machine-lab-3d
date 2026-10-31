using System;
using System.Collections.Generic;
using MachineYard.Core;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 車床的機台控制（對應 src/machines/runtime.js ＋ MachineBase）：用 Core 的純數學（AxisModel／SpindleModel，已與網站 JS 標準答案比對）
    /// 驅動匯入模型的節點——軸沿其局部軸向平移、手輪／主軸／拉桿／段位旋鈕繞軸旋轉、刀座每 10° 分度。
    /// 所有節點用名稱找（名稱來自 lathe_parts.json，匯出時保留）。軸向量是 three.js 局部座標，經 ThreeCoords 換成 Unity。
    /// </summary>
    public class LatheMachine : MonoBehaviour
    {
        public TextAsset runtimeJson;
        public Transform machineRoot;                 // 匯入的機台根（static 與 interactive 的共同父節點）
        public MachineRuntimeConfig Config { get; private set; }
        public AxisModel Axes { get; private set; }
        public SpindleModel Spindle { get; private set; }
        public Dictionary<string, Transform> Nodes { get; } = new Dictionary<string, Transform>();
        public int DirectionRequested = 1;
        public bool SpindleRunning { get; private set; }
        public int ToolIndexSteps { get; private set; }

        /// <summary>軸或手輪動作前後呼叫（切削取樣用）。</summary>
        public event Action BeforeMove, AfterMove;
        public event Action<string> Notice;

        readonly Dictionary<string, (Vector3 pos, Quaternion rot)> rest = new Dictionary<string, (Vector3, Quaternion)>();
        ActionCfg gearAction, modeAction, indexAction, brakeAction;
        Transform columnNode; AdditionCfg columnCfg; Vector3 columnRest;

        public bool Ready { get; private set; }

        void Awake() { if (machineRoot == null) machineRoot = transform; }

        void Start() { if (!Ready && runtimeJson != null) Init(runtimeJson.text); }

        public void Init(string json)
        {
            Config = MachineRuntimeConfig.Parse(json);
            Nodes.Clear();
            foreach (var t in machineRoot.GetComponentsInChildren<Transform>(true))
                if (!string.IsNullOrEmpty(t.name) && (!Nodes.TryGetValue(t.name, out var old) || t.childCount > old.childCount)) Nodes[t.name] = t;

            Axes = new AxisModel { TeachingTurnsForFullTravel = Config.lesson?.teachingTurnsForFullTravel ?? 10 };
            foreach (var a in Config.axes) Axes.AddAxis(new AxisDef { Id = a.id, RangeLo = a.range[0], RangeHi = a.range[1], Enabled = a.enabled });
            foreach (var w in Config.wheels)
                Axes.AddWheel(new WheelDef { Id = w.id, Drives = w.drives, Ratio = w.ratio, AngleLo = w.angleRange?[0], AngleHi = w.angleRange?[1], NeedsCalibration = w.needsCalibration });

            var sel = Config.speedSelectors;
            Spindle = new SpindleModel
            {
                AccelerationRpmPerSecond = Config.lesson?.accelerationRpmPerSecond ?? 900, MaxRpm = Config.maxRpm,
                HasLever = Config.lever != null, LeverRunAngle = Config.lever?.runAngle ?? 0.6, LeverDuration = Config.lever?.duration ?? 0.3,
                LeverBidirectional = Config.lever?.bidirectional ?? true,
                BaseRpm = sel?.baseRpm, Multipliers = sel?.multipliers,
            };
            foreach (var a in Config.actions)
            {
                if (a.id == sel?.gear) gearAction = a; else if (a.id == sel?.mode) modeAction = a;
                else if (a.type == "index") indexAction = a; else if (a.type == "emergency") brakeAction = a;
            }
            // 每個會動的節點記住 0 點（匯出時 restOffset 已經套在位置上）
            foreach (var a in Config.axes) Remember(a.node);
            foreach (var w in Config.wheels) Remember(w.node);
            Remember(Config.spindle.node); if (Config.lever != null) Remember(Config.lever.node);
            foreach (var a in Config.actions) Remember(a.node);
            columnCfg = Array.Find(Config.additions ?? new AdditionCfg[0], a => a.kind == "supportColumn");
            if (columnCfg != null && Nodes.TryGetValue(columnCfg.name, out columnNode)) columnRest = columnNode.localPosition;
            // 段位旋鈕轉到 home 位置（要在記住 0 點之後，因為轉角是相對於 0 點）
            if (gearAction != null) SetDetent(gearAction, gearAction.homeIndex);
            if (modeAction != null) SetDetent(modeAction, modeAction.homeIndex);
            Ready = true;
        }

        void Remember(string node)
        {
            if (string.IsNullOrEmpty(node) || rest.ContainsKey(node)) return;
            if (Nodes.TryGetValue(node, out var t)) rest[node] = (t.localPosition, t.localRotation);
            else Debug.LogWarning("[Machine Yard] 機台節點不存在於匯入模型：" + node);
        }

        static Vector3 V(float[] a) => new Vector3(a[0], a[1], a[2]);

        void ApplyAxis(AxisCfg a)
        {
            if (!Nodes.TryGetValue(a.node, out var t) || !rest.TryGetValue(a.node, out var r)) return;
            var dir = ThreeCoords.Direction(a.axis[0], a.axis[1], a.axis[2]).normalized;
            t.localPosition = r.pos + dir * (float)Axes.Offsets[a.id];
            if (columnNode != null && columnCfg.drives == a.id)
            {
                // 刀座立柱（supportColumn）隨高度軸伸縮：位置上移一半、第一個子節點拉長
                float length = columnCfg.topY - columnCfg.position[1], next = (float)Axes.Offsets[a.id];
                columnNode.localPosition = columnRest + ThreeCoords.Direction(0, 1, 0) * (next / 2);
                if (columnNode.childCount > 0) { var c = columnNode.GetChild(0); var s = c.localScale; c.localScale = new Vector3(s.x, (length + next) / length, s.z); }
            }
        }

        void Rotate(string node, float[] axis, double angle)
        {
            if (!Nodes.TryGetValue(node, out var t) || !rest.TryGetValue(node, out var r)) return;
            t.localRotation = r.rot * ThreeCoords.AxisAngle(V(axis), (float)angle);
        }

        public void SetAxisMm(string axisId, double mm)
        {
            BeforeMove?.Invoke();
            Axes.SetAxisAndWheel(axisId, mm / 1000.0);
            var a = Array.Find(Config.axes, x => x.id == axisId);
            if (a != null) ApplyAxis(a);
            foreach (var w in Config.wheels) if (w.drives == axisId) Rotate(w.node, w.axis, Axes.Angles[w.id]);
            AfterMove?.Invoke();
        }

        /// <summary>手輪轉 deltaAngle 弧度；回傳是否碰到行程限制。</summary>
        public TurnResult TurnWheel(string wheelId, double deltaAngle)
        {
            BeforeMove?.Invoke();
            var res = Axes.TurnBy(wheelId, deltaAngle);
            if (res.Ok)
            {
                var a = Array.Find(Config.axes, x => x.id == res.AxisId);
                if (a != null) ApplyAxis(a);
                var w = Array.Find(Config.wheels, x => x.id == wheelId);
                Rotate(w.node, w.axis, res.Angle);
            }
            AfterMove?.Invoke();
            return res;
        }

        /// <summary>只改手輪外觀（手跟著轉，與機台實際角度分開；VR 方案 C）。</summary>
        public void ShowWheel(string wheelId, double angle) { var w = Wheel(wheelId); if (w != null) Rotate(w.node, w.axis, angle); }

        public WheelCfg Wheel(string id) => Array.Find(Config.wheels, w => w.id == id);

        // ---- 主軸
        public void StartSpindle(int direction)
        {
            if (Spindle.BrakeTime > 0) return;
            DirectionRequested = direction == -1 ? -1 : 1; SpindleRunning = true;
        }
        public void StopSpindle() { SpindleRunning = false; }
        public void ToggleSpindle(int direction)
        {
            if (SpindleRunning && DirectionRequested == direction) StopSpindle(); else StartSpindle(direction);
        }
        public void EmergencyBrake() { SpindleRunning = false; Spindle.EmergencyBrake(); }

        // ---- 段位（轉速）與刀座
        public void SetDetent(ActionCfg a, int index)
        {
            index = Mathf.Clamp(index, 0, a.degrees.Length - 1);
            if (a == gearAction) Spindle.GearIndex = index; else if (a == modeAction) Spindle.ModeIndex = index;
            detentIndex[a.id] = index;
            Rotate(a.node, a.axis, (a.degrees[index] - a.referenceDegrees) * Math.PI / 180);
        }
        readonly Dictionary<string, int> detentIndex = new Dictionary<string, int>();
        public void StepDetent(ActionCfg a, int direction) => SetDetent(a, (detentIndex.TryGetValue(a.id, out var i) ? i : a.homeIndex) + (direction == 1 ? 1 : -1));
        public ActionCfg GearAction => gearAction; public ActionCfg ModeAction => modeAction; public ActionCfg IndexAction => indexAction; public ActionCfg BrakeAction => brakeAction;

        public void IndexToolPost(int direction)
        {
            if (indexAction == null) return;
            BeforeMove?.Invoke();
            int stops = (int)Math.Round(2 * Math.PI / Math.Abs(indexAction.step));
            ToolIndexSteps = (ToolIndexSteps + (direction == -1 ? -1 : 1)) % stops;
            Rotate(indexAction.node, indexAction.axis, ToolIndexSteps * indexAction.step);
            AfterMove?.Invoke();
        }

        float pedal;
        void Update()
        {
            if (!Ready) return;
            double dt = Time.deltaTime;
            Spindle.Step(SpindleRunning, Config.defaultRpm, dt, DirectionRequested);
            Rotate(Config.spindle.node, Config.spindle.axis, Spindle.SpindleAngle);
            if (Config.lever != null) Rotate(Config.lever.node, Config.lever.axis, Spindle.LeverAngle);
            // 腳踏煞車：踏下 0.025 m，隨煞車計時回彈
            if (brakeAction != null && Nodes.TryGetValue(brakeAction.node, out var pedalNode) && rest.TryGetValue(brakeAction.node, out var pr))
            {
                float target = Spindle.BrakeTime > 0 ? 0.025f * Mathf.Min(1f, (float)Spindle.BrakeTime / 0.18f) : 0f;
                if (!Mathf.Approximately(target, pedal)) { pedal = target; pedalNode.localPosition = pr.pos + ThreeCoords.Direction(0, -1, 0) * pedal; }
            }
        }

        public void ResetMachine()
        {
            SpindleRunning = false; Spindle.SignedRpm = 0; Spindle.Rpm = 0; Spindle.LeverAngle = 0; Spindle.BrakeTime = 0;
            BeforeMove?.Invoke();
            foreach (var a in Config.axes) { Axes.SetAxisAndWheel(a.id, 0); ApplyAxis(a); }
            foreach (var w in Config.wheels) Rotate(w.node, w.axis, Axes.Angles[w.id]);
            ToolIndexSteps = 0; if (indexAction != null) Rotate(indexAction.node, indexAction.axis, 0);
            if (gearAction != null) SetDetent(gearAction, gearAction.homeIndex);
            if (modeAction != null) SetDetent(modeAction, modeAction.homeIndex);
            AfterMove?.Invoke();
        }

        public void Say(string msg) => Notice?.Invoke(msg);
    }
}
