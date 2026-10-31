using System;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactables;
using UnityEngine.XR.Interaction.Toolkit.Interactors;

namespace MachineYard
{
    /// <summary>
    /// VR 直接操作車床（對應 src/xr/machine/vrMachineControls.js）：
    ///   手輪：射線指著按住 grip 抓住，手繞手輪畫圈（WheelGrab）。方案 C：手每轉過一格（10°），軸走「每格進給量」(FeedMm)，
    ///         手輪模型另外跟著手轉；碰到行程限制：較強震動，手輪不再往那邊轉。
    ///   其他零件：射線指著按 trigger（Activate）＝桌機左鍵、按 grip（Select）＝右鍵（反向）：
    ///         啟動拉桿 → 正轉／反轉；段位旋鈕 → 步進；刀座 → 分度 10°；腳踏煞車 → 緊急煞車。
    /// </summary>
    public class MachineControlWiring : MonoBehaviour
    {
        public LatheMachine machine;
        /// <summary>每格（10°）進給量，公釐。面板切換 0.01 / 0.1 / 1。</summary>
        public float FeedMm = 0.1f;
        public static readonly float[] FeedChoices = { 0.01f, 0.1f, 1f };
        public LatheCuttingController cutting;
        readonly System.Collections.Generic.List<WheelGrab> grabs = new System.Collections.Generic.List<WheelGrab>();
        float buzz, cutRate, lastCutTime;
        int lastCutCount;

        void Start() { if (machine.Ready) Wire(); else StartCoroutine(WaitAndWire()); }
        System.Collections.IEnumerator WaitAndWire() { while (!machine.Ready) yield return null; Wire(); }

        static void Pulse(XRBaseInteractor hand, float amp, float sec) { if (hand is XRBaseInputInteractor i) i.SendHapticImpulse(amp, sec); }

        void Wire()
        {
            foreach (var w in machine.Config.wheels)
            {
                if (!machine.Nodes.TryGetValue(w.node, out var node)) continue;
                XrUtil.EnsureInteractable(node.gameObject, 0.06f);
                var grab = node.gameObject.AddComponent<WheelGrab>();
                grabs.Add(grab);
                grab.axisLocalUnity = ThreeCoords.Direction(w.axis[0], w.axis[1], w.axis[2]).normalized;
                double visual = machine.Axes.Angles[w.id]; int limitDir = 0; string id = w.id;
                grab.onGrabbed = () => { limitDir = 0; visual = machine.Axes.Angles[id]; };
                grab.onReleased = () => limitDir = 0;
                grab.onTurn = delta =>
                {
                    if (limitDir != 0 && Math.Sign(delta) == limitDir) return;
                    if (limitDir != 0 && Math.Sign(delta) == -limitDir) limitDir = 0;
                    visual += delta; machine.ShowWheel(id, visual);
                };
                grab.onTick = (dir, hand) =>
                {
                    if (limitDir == dir) return;
                    var ratio = machine.Axes.WheelRatio(id);
                    if (!ratio.HasValue) return;
                    var r = machine.TurnWheel(id, dir * FeedMm / 1000.0 / ratio.Value);
                    machine.ShowWheel(id, visual); // TurnWheel 會把手輪轉到機台角度；外觀維持跟手
                    if (r.AtLimit) { limitDir = dir; Pulse(hand, 0.9f, 0.07f); } else Pulse(hand, 0.25f, 0.012f);
                };
            }

            Both(machine.Config.lever?.node, forward: () => machine.ToggleSpindle(1), reverse: () => { if (machine.Config.lever.bidirectional) machine.ToggleSpindle(-1); });
            // JS：detent.step 的 direction = −(左鍵 +1)，所以 trigger → −1、grip → +1
            if (machine.GearAction != null) Both(machine.GearAction.node, () => machine.StepDetent(machine.GearAction, -1), () => machine.StepDetent(machine.GearAction, 1));
            if (machine.ModeAction != null) Both(machine.ModeAction.node, () => machine.StepDetent(machine.ModeAction, -1), () => machine.StepDetent(machine.ModeAction, 1));
            if (machine.IndexAction != null) Both(machine.IndexAction.node, () => machine.IndexToolPost(-1), () => machine.IndexToolPost(1));
            if (machine.BrakeAction != null) Both(machine.BrakeAction.node, () => machine.EmergencyBrake(), () => machine.EmergencyBrake());
        }

        // 切削回饋（cuttingFeedback）：切削中握著手輪的控制器持續輕震（強度隨切削量增加）；撞夾頭較強震動
        void Update()
        {
            if (cutting == null || !machine.Ready) return;
            int delta = cutting.CutCount - lastCutCount; lastCutCount = cutting.CutCount;
            cutRate = cutRate * Mathf.Exp(-Time.deltaTime * 6f) + delta;
            if ((buzz -= Time.deltaTime) > 0) return;
            if (machine.Spindle.Rpm > 0 && cutRate > 0.05f)
            {
                buzz = 0.09f;
                float strength = Mathf.Min(0.6f, 0.12f + cutRate * 0.08f);
                foreach (var g in grabs) if (g.IsGrabbed) Pulse(g.Hand, strength, 0.08f);
            }
            if (cutting.Unsafe) { buzz = 0.2f; foreach (var g in grabs) if (g.IsGrabbed) Pulse(g.Hand, 0.9f, 0.14f); }
        }

        void Both(string nodeName, Action forward, Action reverse)
        {
            if (string.IsNullOrEmpty(nodeName) || !machine.Nodes.TryGetValue(nodeName, out var node)) return;
            var it = XrUtil.EnsureInteractable(node.gameObject, 0.03f);
            it.activated.AddListener(a => { Pulse(a.interactorObject as XRBaseInteractor, 0.3f, 0.02f); forward(); });   // trigger
            it.selectEntered.AddListener(a => { Pulse(a.interactorObject as XRBaseInteractor, 0.3f, 0.02f); reverse(); }); // grip
        }
    }
}
