using System;
using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;

namespace MachineYard
{
    /// <summary>
    /// 銑床／鑽床操作面板（左手 X 叫出並釘在原地，再按 X 收起；與 MachinePanel 同一套做法）：
    /// 轉速、DRO、刀具與刀尖位置（毛胚座標）、接觸狀態、工件上表面／孔的資料；
    /// 按鈕：啟動／反轉／停止、每格進給量、換刀、新工件、重設機台、歸零、鑽床的工件定位（滑動虎鉗 ±1／±5 mm）。
    /// </summary>
    public class HeadMachinePanel : MonoBehaviour
    {
        public Camera head; public LatheMachine machine; public HeadMachining work; public MachineControlWiring wiring;
        readonly SlotConfirm confirm = new SlotConfirm();
        GameObject panel; TextMeshPro status, feedLabel, toolLabel; InputAction toggle; float refresh; string notice; float noticeTime;

        void OnEnable()
        {
            toggle = new InputAction("headPanel", InputActionType.Button, "<XRController>{LeftHand}/primaryButton");
            toggle.performed += _ => Toggle();
            toggle.Enable();
            if (work != null) work.Warn += OnWarn;
        }
        void OnDisable() { toggle?.Disable(); if (work != null) work.Warn -= OnWarn; }
        void OnWarn(string m) { notice = m; noticeTime = 4f; }

        public void Toggle()
        {
            if (panel == null) Build();
            bool show = !panel.activeSelf;
            if (show)
            {
                var fwd = head.transform.forward; fwd.y = 0; if (fwd.sqrMagnitude < 1e-4f) fwd = Vector3.forward; fwd.Normalize();
                panel.transform.position = head.transform.position + fwd * 0.75f + Vector3.down * 0.2f;
                panel.transform.rotation = Quaternion.LookRotation(fwd, Vector3.up);
                Refresh();
            }
            panel.SetActive(show);
        }

        void Build()
        {
            bool drill = work.IsDrill;
            panel = new GameObject("HeadMachinePanel");
            DebugMenu.AddBox(panel.transform, "bg", new Vector3(0, -0.075f, 0.01f), new Vector2(0.66f, 0.93f), new Color(0.11f, 0.08f, 0.05f, 0.96f));
            DebugMenu.AddLabel(panel.transform, drill ? "鑽床" : "銑床", new Vector3(0, 0.37f, 0), 0.05f, new Color(0.91f, 0.76f, 0.48f));
            status = DebugMenu.AddLabel(panel.transform, "", new Vector3(0, 0.17f, 0), 0.028f, new Color(0.9f, 0.86f, 0.75f), false, new Vector2(0.6f, 0.36f));
            status.alignment = TextAlignmentOptions.TopLeft;
            float y = -0.06f, dx = 0.15f;
            Button("啟動", -dx, y, () => machine.StartSpindle(1)); Button("反轉", 0, y, () => machine.StartSpindle(-1)); Button("停止", dx, y, () => machine.StopSpindle()); y -= 0.065f;
            feedLabel = Button("進給量", -dx * 0.5f, y, CycleFeed, 0.29f); toolLabel = Button("換刀", dx * 0.6f, y, () => work.NextTool(1), 0.29f); y -= 0.065f;
            Button("新工件", -dx * 0.5f, y, work.NewStock, 0.29f); Button("重設機台", dx * 0.6f, y, () => { machine.ResetMachine(); work.NewStock(); }, 0.29f); y -= 0.065f;
            if (drill)
            {
                Button("套筒歸零", -dx * 0.5f, y, () => work.ZeroAxis("quill"), 0.29f); Button("定位 X=劃線", dx * 0.6f, y, () => work.DefaultSetup(), 0.29f); y -= 0.065f;
                Button("工件 −5", -dx * 1.1f, y, () => work.Slide(-5), 0.13f); Button("−1", -dx * 0.1f, y, () => work.Slide(-1), 0.13f); Button("+1", dx * 0.6f, y, () => work.Slide(1), 0.13f); Button("+5", dx * 1.3f, y, () => work.Slide(5), 0.13f);
            }
            else
            {
                Button("X 歸零", -dx, y, () => work.ZeroAxis("X_Axis_Table"), 0.18f); Button("Y 歸零", 0, y, () => work.ZeroAxis("Y_Axis_Saddle"), 0.18f); Button("Z 歸零", dx, y, () => work.ZeroAxis("Knee_Z_Slide"), 0.18f); y -= 0.065f;
                Button("對刀位置", -dx * 0.5f, y, () => work.DefaultSetup(), 0.29f);
            }
            y -= 0.065f;
            for (int i = 0; i < SaveSlots.Count; i++)
            {
                int slot = i; float x = (i - 1) * 0.2f;
                Button("存檔 " + (i + 1), x, y, () => { if (confirm.ShouldSave(slot)) { WorkpieceSaves.SaveHead(slot, machine.Config.machineId, work.State); OnWarn("已存到第 " + (slot + 1) + " 格"); } else OnWarn("第 " + (slot + 1) + " 格已有工件，再按一次覆蓋"); }, 0.17f);
            }
            y -= 0.065f;
            for (int i = 0; i < SaveSlots.Count; i++)
            {
                int slot = i; float x = (i - 1) * 0.2f;
                Button("讀檔 " + (i + 1), x, y, () =>
                {
                    if (machine.SpindleRunning || machine.Spindle.Rpm > 0) { OnWarn("停機後才能讀檔"); return; }
                    var st = WorkpieceSaves.LoadHead(slot, machine.Config.machineId);
                    if (st == null) OnWarn("第 " + (slot + 1) + " 格沒有可讀的工件（車床工件不能讀到銑床／鑽床）"); else { work.LoadState(st); OnWarn("已讀取第 " + (slot + 1) + " 格"); }
                }, 0.17f);
            }
            panel.SetActive(false);
        }

        TextMeshPro Button(string label, float x, float y, Action a, float width = 0.18f)
        {
            var go = DebugMenu.AddBox(panel.transform, label, new Vector3(x, y, 0), new Vector2(width, 0.055f), new Color(0.35f, 0.24f, 0.13f));
            var t = DebugMenu.AddLabel(go.transform, label, new Vector3(0, 0, -0.002f), 0.032f, Color.white, true, new Vector2(width * 0.95f, 0.05f));
            XrUtil.MakeClickable(go, () => { a(); Refresh(); }, 0.01f);
            return t;
        }

        void CycleFeed()
        {
            int i = Array.IndexOf(MachineControlWiring.FeedChoices, wiring.FeedMm);
            wiring.FeedMm = MachineControlWiring.FeedChoices[(i + 1) % MachineControlWiring.FeedChoices.Length];
        }

        void Update()
        {
            if (noticeTime > 0) noticeTime -= Time.deltaTime;
            if (panel == null || !panel.activeSelf) return;
            if ((refresh -= Time.deltaTime) <= 0) { refresh = 0.2f; Refresh(); }
        }

        void Refresh()
        {
            if (!machine.Ready || work.State == null) return;
            var sp = machine.Spindle; var st = work.State; var sb = new StringBuilder();
            sb.Append($"轉速  {sp.Rpm:0} rpm  ({(machine.SpindleRunning ? (machine.DirectionRequested > 0 ? "正轉" : "反轉") : "停止")})\n");
            if (work.IsDrill) sb.Append($"套筒深度 {Math.Abs(work.Dro("quill")):0.000} mm   工作臺高度 {work.Dro("table"):0.000} mm\n");
            else sb.Append($"X {work.Dro("X_Axis_Table"),8:0.000}   Y {work.Dro("Y_Axis_Saddle"),8:0.000}   Z {work.Dro("Knee_Z_Slide"),8:0.000} mm\n");
            sb.Append($"刀具  {work.ToolDef?.Name}\n");
            if (work.LastTip.HasValue)
            {
                var t = work.LastTip.Value;
                sb.Append($"刀尖（毛胚座標） X {t.XMm,7:0.000}  Y {t.YMm,6:0.000}  Z {t.ZMm,7:0.000}\n");
                sb.Append(work.ContactLevel == 0 ? "未接觸\n" : work.ContactLevel == 1 ? "<color=#ffcf7a>接觸</color>\n" : "<color=#ff8a4a>切削中</color>\n");
            }
            var top = st.MeasureTop();
            sb.Append(top.cut ? $"上表面 最高 {top.max:0.000}  最低 {top.min:0.000} mm\n" : "毛胚 20 × 20 × 90 mm（尚未切削）\n");
            foreach (var h in st.Features)
                sb.Append($"孔 X={h.XMm:0.###}  Ø{h.DiameterMm:0.###}  深 {h.DepthMm:0.###}{(h.Through ? "（鑽穿）" : "")}{(h.Thread != null ? $"  {h.Thread.Designation} 攻牙 {h.Thread.TappedDepthMm:0.###}" : "")}\n");
            if (noticeTime > 0 && !string.IsNullOrEmpty(notice)) sb.Append($"<color=#ff5a3c>{notice}</color>\n");
            status.text = sb.ToString();
            feedLabel.text = $"進給 {wiring.FeedMm:0.##} mm/格";
            toolLabel.text = "換刀：" + work.ToolDef?.Id.Replace("head_", "");
        }
    }
}
