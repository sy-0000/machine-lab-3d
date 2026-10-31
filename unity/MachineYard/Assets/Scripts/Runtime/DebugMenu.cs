using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;

namespace MachineYard
{
    /// <summary>
    /// 階段 3 的簡易選單（左手 Y 鍵開關）：回門外、回玄關、顯示三個存檔欄位，以及開發用「直接解鎖」「重置進度」。
    /// 這不是最終的 3D UI（翻牌板風格的選單在階段 5 重做）；目的是讓階段 3 可以重複測試：進了佔位工作室之後有路回來、可以重置進度。
    /// 「直接解鎖／重置進度」只在 Editor 與 Development Build 出現（對應網站玄關的兩個開發按鈕）。
    /// </summary>
    public class DebugMenu : MonoBehaviour
    {
        public Camera head; public StationMover mover; public LobbyFlow flow; public ExteriorDoors doors; public MachineSwitcher switcher;
        GameObject panel; InputAction toggle; TextMeshPro slotsText; readonly List<GameObject> built = new List<GameObject>();

        void OnEnable()
        {
            toggle = new InputAction("menu", InputActionType.Button, "<XRController>{LeftHand}/secondaryButton");
            toggle.performed += _ => Toggle();
            toggle.Enable();
        }
        void OnDisable() { toggle?.Disable(); }

        void Toggle()
        {
            if (panel == null) Build();
            bool show = !panel.activeSelf;
            if (show) { Place(); RefreshSlots(); }
            panel.SetActive(show);
        }

        void Place()
        {
            var fwd = head.transform.forward; fwd.y = 0; fwd.Normalize();
            panel.transform.position = head.transform.position + fwd * 0.8f + Vector3.down * 0.15f;
            panel.transform.rotation = Quaternion.LookRotation(fwd, Vector3.up); // +Z 朝遠離使用者；Quad 與 TMP 的正面都朝 -Z，所以使用者看得到正面
        }

        void Build()
        {
            panel = new GameObject("DebugMenu");
            AddBox(panel.transform, "bg", new Vector3(0, -0.02f, 0.01f), new Vector2(0.5f, 0.6f), new Color(0.11f, 0.08f, 0.05f, 0.96f));
            AddLabel(panel.transform, "Machine Yard（簡易選單）", new Vector3(0, 0.22f, 0), 0.05f, new Color(0.91f, 0.76f, 0.48f));
            float y = 0.14f;
            AddButton("回門外", y, () => Go(Stations.Outside, true)); y -= 0.07f;
            AddButton("回玄關", y, () => Go(Stations.Center, false)); y -= 0.07f;
            if (switcher != null)
            {
                // 換機台（進工廠後才有意義；蒸汽過場）
                string[] ids = { "lathe", "milling", "drill" }, names = { "車床", "銑床", "鑽床" };
                for (int i = 0; i < 3; i++)
                {
                    string id = ids[i]; var go = AddBox(panel.transform, names[i], new Vector3((i - 1) * 0.135f, y, 0), new Vector2(0.125f, 0.055f), new Color(0.3f, 0.34f, 0.22f));
                    AddLabel(go.transform, names[i], new Vector3(0, 0, -0.002f), 0.034f, Color.white, true, new Vector2(0.12f, 0.05f));
                    XrUtil.MakeClickable(go, () => { if (ProgressStore.Instance.FactoryEntered) switcher.Switch(id); }, 0.01f);
                }
                y -= 0.07f;
            }
            if (Debug.isDebugBuild || Application.isEditor)
            {
                AddButton("[DEV] 直接解鎖", y, () => ProgressStore.Instance.UnlockAll()); y -= 0.07f;
                AddButton("[DEV] 重置進度", y, () => { ProgressStore.Instance.ResetAll(); RefreshSlots(); }); y -= 0.07f;
            }
            slotsText = AddLabel(panel.transform, "", new Vector3(0, y - 0.1f, 0), 0.032f, new Color(0.9f, 0.86f, 0.75f), false, new Vector2(0.46f, 0.2f));
            panel.SetActive(false);
        }

        void Go(Station s, bool openDoorsState)
        {
            if (mover.Busy) return;
            if (s.Area == Area.Lobby && s.Name != "outside" && flow.doors != null && !flow.doors.IsOpen) flow.doors.Open(); // 回玄關時大門視為開著
            mover.MoveTo(s);
            panel.SetActive(false);
        }

        void RefreshSlots()
        {
            var sb = new System.Text.StringBuilder("存檔欄位（工件存檔於階段 4 起可用）\n");
            for (int i = 0; i < SaveSlots.Count; i++)
            {
                var s = SaveSlots.Instance.Get(i);
                sb.Append($"{i + 1}. ").Append(s.used ? $"{s.sourceMachine}  {s.savedAt}" : "（空）").Append('\n');
            }
            var p = ProgressStore.Instance;
            sb.Append($"\n工安 {p.State.safety.pagesRead}/{p.State.safety.pages}   動畫 {p.ClipsDoneCount}/3   {(p.Unlocked ? "已解鎖" : "未解鎖")}");
            slotsText.text = sb.ToString();
        }

        void AddButton(string label, float y, Action a)
        {
            var go = AddBox(panel.transform, label, new Vector3(0, y, 0.0f), new Vector2(0.4f, 0.055f), new Color(0.35f, 0.24f, 0.13f));
            AddLabel(go.transform, label, new Vector3(0, 0, -0.002f), 0.034f, Color.white, true);
            XrUtil.MakeClickable(go, a, 0.01f);
        }

        internal static GameObject AddBox(Transform parent, string name, Vector3 localPos, Vector2 size, Color c)
        {
            var q = XrUtil.CreateQuad(name, parent, c);
            q.transform.localPosition = localPos; q.transform.localScale = new Vector3(size.x, size.y, 1);
            return q;
        }

        internal static TextMeshPro AddLabel(Transform parent, string text, Vector3 localPos, float size, Color c, bool counterScale = false, Vector2? rectSize = null)
        {
            var go = new GameObject("Label");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            var rect = rectSize ?? new Vector2(0.46f, size * 1.6f);
            var t = go.AddComponent<TextMeshPro>();
            var font = Resources.Load<TMP_FontAsset>("MachineYardFont");
            if (font != null) t.font = font;
            t.text = text; t.color = c; t.alignment = TextAlignmentOptions.Center;
            t.enableAutoSizing = true; t.fontSizeMin = 0.05f; t.fontSizeMax = 20f; // TMP 3D 的字級單位不明確，用自動縮放塞進矩形
            t.rectTransform.sizeDelta = rect;
            return t;
        }
    }
}
