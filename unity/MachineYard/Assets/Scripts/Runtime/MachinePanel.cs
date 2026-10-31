using System;
using System.Text;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;

namespace MachineYard
{
    /// <summary>
    /// 車床操作面板（階段 4 的簡化版「機台」頁；翻牌板風格的左手選單在階段 5）：左手 X 鍵在面前叫出，並「釘」在原地
    /// （方便雙手轉手輪時看 DRO）；再按 X 收起。內容：轉速、DRO（X 直徑／Z）、刀尖與工件直徑、接觸狀態、
    /// 按鈕：啟動／反轉／停止、每格進給量(0.01/0.1/1 mm)、裝上工件(槌柄)/重設、車外徑⇄車端面、歸零 X／Z、重設機台。
    /// </summary>
    public class MachinePanel : MonoBehaviour
    {
        public Camera head; public LatheMachine machine; public LatheCuttingController cutting; public MachineControlWiring wiring;
        readonly SlotConfirm confirm = new SlotConfirm(); string notice; float noticeTime;
        GameObject panel; TextMeshPro status; InputAction toggle; float refresh; TextMeshPro feedLabel, modeLabel, workLabel;

        void OnEnable()
        {
            toggle = new InputAction("machinePanel", InputActionType.Button, "<XRController>{LeftHand}/primaryButton");
            toggle.performed += _ => Toggle();
            toggle.Enable();
        }
        void OnDisable() { toggle?.Disable(); }

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
            panel = new GameObject("MachinePanel");
            DebugMenu.AddBox(panel.transform, "bg", new Vector3(0, -0.06f, 0.01f), new Vector2(0.62f, 0.83f), new Color(0.11f, 0.08f, 0.05f, 0.96f));
            DebugMenu.AddLabel(panel.transform, "車床", new Vector3(0, 0.31f, 0), 0.05f, new Color(0.91f, 0.76f, 0.48f));
            status = DebugMenu.AddLabel(panel.transform, "", new Vector3(0, 0.12f, 0), 0.03f, new Color(0.9f, 0.86f, 0.75f), false, new Vector2(0.56f, 0.3f));
            status.alignment = TextAlignmentOptions.TopLeft;
            float y = -0.1f, dx = 0.15f;
            Button("啟動", -dx, y, () => machine.StartSpindle(1)); Button("反轉", 0, y, () => machine.StartSpindle(-1)); Button("停止", dx, y, () => machine.StopSpindle()); y -= 0.065f;
            feedLabel = Button("進給量", -dx * 0.5f, y, CycleFeed, 0.27f); modeLabel = Button("車外徑", dx * 0.6f, y, ToggleMode, 0.27f); y -= 0.065f;
            workLabel = Button("裝上工件", -dx * 0.5f, y, MountOrReset, 0.27f); Button("重設機台", dx * 0.6f, y, () => { machine.ResetMachine(); cutting.MountHandle(); }, 0.27f); y -= 0.065f;
            Button("X 歸零", -dx * 0.5f, y, () => { cutting.DatumX = machine.Axes.Offsets["y"] * 1000; }, 0.27f); Button("Z 歸零", dx * 0.6f, y, () => { cutting.DatumZ = machine.Axes.Offsets["x"] * 1000; }, 0.27f); y -= 0.065f;
            for (int i = 0; i < SaveSlots.Count; i++)
            {
                int slot = i; float x = (i - 1) * 0.19f;
                Button("存檔 " + (i + 1), x, y, () =>
                {
                    if (!cutting.HasWorkpiece) { Say("尚未裝上工件"); return; }
                    if (confirm.ShouldSave(slot)) { WorkpieceSaves.SaveLathe(slot, cutting.workpiece.State); Say("已存到第 " + (slot + 1) + " 格"); } else Say("第 " + (slot + 1) + " 格已有工件，再按一次覆蓋");
                }, 0.16f);
            }
            y -= 0.065f;
            for (int i = 0; i < SaveSlots.Count; i++)
            {
                int slot = i; float x = (i - 1) * 0.19f;
                Button("讀檔 " + (i + 1), x, y, () =>
                {
                    var st = WorkpieceSaves.LoadLathe(slot);
                    if (st == null) { Say("第 " + (slot + 1) + " 格沒有可讀的車床工件"); return; }
                    if (!cutting.HasWorkpiece) cutting.MountHandle();
                    cutting.workpiece.Mount(st); Say("已讀取第 " + (slot + 1) + " 格");
                }, 0.16f);
            }
            panel.SetActive(false);
        }

        TextMeshPro Button(string label, float x, float y, Action a, float width = 0.18f)
        {
            var go = DebugMenu.AddBox(panel.transform, label, new Vector3(x, y, 0), new Vector2(width, 0.055f), new Color(0.35f, 0.24f, 0.13f));
            var t = DebugMenu.AddLabel(go.transform, label, new Vector3(0, 0, -0.002f), 0.034f, Color.white, true, new Vector2(width * 0.95f, 0.05f));
            XrUtil.MakeClickable(go, () => { a(); Refresh(); }, 0.01f);
            return t;
        }

        void CycleFeed()
        {
            int i = Array.IndexOf(MachineControlWiring.FeedChoices, wiring.FeedMm);
            wiring.FeedMm = MachineControlWiring.FeedChoices[(i + 1) % MachineControlWiring.FeedChoices.Length];
        }
        void ToggleMode() { cutting.mode = cutting.mode == LatheCuttingController.Mode.Turning ? LatheCuttingController.Mode.Facing : LatheCuttingController.Mode.Turning; }
        void MountOrReset() { cutting.MountHandle(); }

        void Say(string m) { notice = m; noticeTime = 4f; }

        void Update()
        {
            if (noticeTime > 0) noticeTime -= Time.deltaTime;
            if (panel == null || !panel.activeSelf) return;
            if ((refresh -= Time.deltaTime) <= 0) { refresh = 0.2f; Refresh(); }
        }

        void Refresh()
        {
            if (!machine.Ready) return;
            var r = cutting.Read(); var sp = machine.Spindle;
            var sb = new StringBuilder();
            sb.Append($"轉速  {sp.Rpm:0} rpm  ({(machine.SpindleRunning ? (machine.DirectionRequested > 0 ? "正轉" : "反轉") : "停止")}，檔位 {sp.SelectorRpm():0})\n");
            sb.Append($"X 直徑 {r.XDiameterMm,8:0.00} mm   Z {r.ZMm,8:0.00} mm\n");
            if (cutting.HasWorkpiece)
            {
                if (r.HasTip) sb.Append($"刀尖 Z {r.TipZMm,7:0.00}   刀尖直徑 {r.TipDiameterMm,7:0.00}\n工件此處直徑 {r.WorkpieceDiameterAtTipMm,6:0.00} mm   {(r.Contact ? "<color=#ffcf7a>接觸中</color>" : "未接觸")}\n");
                if (cutting.Unsafe) sb.Append("<color=#ff5a3c>危險：刀具撞到夾頭</color>\n");
            }
            else sb.Append("尚未裝上工件\n");
            if (noticeTime > 0 && !string.IsNullOrEmpty(notice)) sb.Append($"<color=#ffcf7a>{notice}</color>\n");
            status.text = sb.ToString();
            feedLabel.text = $"進給 {wiring.FeedMm:0.##} mm/格";
            modeLabel.text = cutting.mode == LatheCuttingController.Mode.Turning ? "車外徑" : "車端面";
            workLabel.text = cutting.HasWorkpiece ? "換新工件" : "裝上工件";
        }
    }
}
