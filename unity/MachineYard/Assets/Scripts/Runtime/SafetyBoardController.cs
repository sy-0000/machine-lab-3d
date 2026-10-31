using System;
using System.Collections.Generic;
using System.Text;
using Newtonsoft.Json.Linq;
using TMPro;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 玄關左牆的工安告示板（對應 src/xr/lobby/SafetyBoard.js）：讀 Resources/safety-rules.json（與桌機工安頁同一份），
    /// 一節一頁（網站版會把過長的節自動續頁；目前 4 節都很短，一節一頁即可，文字用自動縮放避免溢出）；翻到最後一頁算讀完，進度存入 ProgressStore。
    /// 匯出的 Paper 貼圖只是匯出當下那一頁的快照，所以這裡在紙面前貼一張底色面片＋ TextMeshPro 文字覆蓋它。
    /// 按鈕沿用 glb 的 SafetyButton_prev / next / back。字型：Resources/MachineYardFont（TMP Font Asset，需含繁中字，見 README）。
    /// </summary>
    public class SafetyBoardController : MonoBehaviour
    {
        public Action BackClicked;
        class Page { public string title; public string body; }
        readonly List<Page> pages = new List<Page>();
        string docTitle; int index; TextMeshPro text; Transform paper;
        public int PageCount => pages.Count;
        public int PageIndex => index;
        public Transform Paper => paper;
        public event Action<int, int> PageChanged;

        public void Build(Vector3 viewerWorldPos)
        {
            var json = Resources.Load<TextAsset>("safety-rules");
            if (json == null) { Debug.LogError("[Machine Yard] 找不到 Resources/safety-rules.json"); return; }
            var root = JObject.Parse(json.text);
            docTitle = (string)root["title"];
            foreach (var section in (JArray)root["sections"])
            {
                var sb = new StringBuilder();
                foreach (var item in (JArray)section["items"])
                {
                    sb.Append("• ");
                    foreach (var run in (JArray)item)
                    {
                        bool strong = run["strong"] != null && (bool)run["strong"];
                        string t = (string)run["text"];
                        sb.Append(strong ? $"<b><color=#7a1f12>{t}</color></b>" : t);
                    }
                    sb.Append("\n\n");
                }
                pages.Add(new Page { title = (string)section["title"], body = sb.ToString() });
            }

            paper = XrUtil.FindDeep(transform, "Paper");
            if (paper == null) { Debug.LogError("[Machine Yard] SafetyBoard 裡找不到 Paper"); return; }
            var mf = paper.GetComponent<MeshFilter>();
            var size = mf != null ? Vector3.Scale(mf.sharedMesh.bounds.size, paper.lossyScale) : new Vector3(1.4f, 0.98f, 0);
            float w = Mathf.Abs(size.x), h = Mathf.Abs(size.y);

            // 朝向觀看者的一側
            var normal = viewerWorldPos - paper.position; normal.y = 0; normal.Normalize();
            var overlay = new GameObject("PaperOverlay").transform;
            overlay.SetParent(paper, true);
            overlay.position = paper.position + normal * 0.004f;
            overlay.rotation = Quaternion.LookRotation(-normal, Vector3.up); // TMP/Quad 的正面朝 -Z：讓 -forward 對著觀看者
            var quad = XrUtil.CreateQuad("PaperBackground", overlay, new Color(0.93f, 0.87f, 0.74f));
            quad.transform.localScale = new Vector3(w, h, 1);
            paper.GetComponent<Renderer>().enabled = false;

            var tgo = new GameObject("PaperText");
            tgo.transform.SetParent(overlay, false);
            tgo.transform.localPosition = new Vector3(0, 0, -0.003f);
            text = tgo.AddComponent<TextMeshPro>();
            var font = Resources.Load<TMP_FontAsset>("MachineYardFont");
            if (font != null) text.font = font; else Debug.LogWarning("[Machine Yard] 沒有 Resources/MachineYardFont（TMP 字型資產），繁體中文會顯示成方塊。見 unity/README.md。");
            text.rectTransform.sizeDelta = new Vector2(w - 0.16f, h - 0.14f);
            text.enableAutoSizing = true; text.fontSizeMin = 0.05f; text.fontSizeMax = 20f; // TMP 3D 的字級單位不是公尺；給很寬的範圍讓自動縮放去找剛好塞進紙面的大小
            text.color = new Color(0.18f, 0.13f, 0.09f); text.alignment = TextAlignmentOptions.TopLeft; text.richText = true;
            text.overflowMode = TextOverflowModes.Truncate;

            Wire("SafetyButton_prev", () => Go(index - 1));
            Wire("SafetyButton_next", () => Go(index + 1));
            Wire("SafetyButton_back", () => BackClicked?.Invoke());
            Go(0);
        }

        void Wire(string name, Action a) { var t = XrUtil.FindDeep(transform, name); if (t != null) XrUtil.MakeClickable(t.gameObject, a); else Debug.LogWarning("[Machine Yard] 找不到 " + name); }

        public void Go(int i)
        {
            if (pages.Count == 0) return;
            index = Mathf.Clamp(i, 0, pages.Count - 1);
            var p = pages[index];
            bool last = index == pages.Count - 1;
            text.text = $"<size=60%><color=#8a6a42>{docTitle}    第 {index + 1} 頁 / {pages.Count}</size></color>\n<b><size=130%>{p.title}</size></b>\n\n{p.body}" +
                        $"<align=center><size=55%><color={(last ? "#2f6b3a" : "#8a6a42")}>{(last ? "已讀到最後一頁" : "請按「下一頁」繼續閱讀")}</color></size></align>";
            PageChanged?.Invoke(index + 1, pages.Count);
            ProgressStore.Instance.ReadPage(index + 1, pages.Count);
        }
    }
}
