using System;
using System.Collections;
using System.Collections.Generic;
using Newtonsoft.Json;
using TMPro;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using UnityEngine.XR.Interaction.Toolkit.Interactables;
using UnityEngine.XR.Interaction.Toolkit.Interactors;

namespace MachineYard
{
    [Serializable] public class ToolDisplayInfo { public float[] rotation; public float scale = 1; }
    [Serializable] public class ToolInfo { public int index; public string id, name, quantity, description; public ToolDisplayInfo display; }

    /// <summary>
    /// 工作桌上的工具箱流程（對應 src/xr/toolbox/DeskToolbox.js ＋ toolboxCore.createToolFlow）：
    ///   射線點工具 → 升起到工具箱正上方的展示點（再放大 1.8 倍）→ 單獨聚光、工作室其他燈光漸暗到 15% →
    ///   說明面板出現在玩家看向工具的方向（0.8 m 遠、比眼睛高 0.12 m、面向玩家）→ 上一項／下一項／放回盒中。
    ///   展示中用 grip 抓住工具，手怎麼轉工具就怎麼轉。
    /// 工具的名稱、說明、展示角度來自 Resources/tools.json（scripts/export-tools-json.mjs 從網站資料產生）。
    /// 工具節點是匯入的 toolbox_interactive 裡的 Tool_&lt;id&gt;（ToolTray 之下，整組縮放 0.36）。
    /// </summary>
    public class ToolboxFlow : MonoBehaviour
    {
        public Transform workshopRoot, tray; public Camera head; public MachineEffects fx;
        public Transform leftHand;   // 抓住工具轉動的手（不指定就用右手射線的來源）
        static readonly Vector3 ShowAtThree = new Vector3(-0.4f, 1.24f, 5.85f);   // 工作室座標（SHOW_AT）
        const float ShowScale = 1.8f, DimTo = 0.15f, PanelDistance = 0.8f, PanelRise = 0.12f;

        enum State { Browse, Lifting, Showing, Returning }
        State state = State.Browse;
        class Entry { public ToolInfo info; public Transform node; public Vector3 pos, scale; public Quaternion rot; }
        readonly List<Entry> entries = new List<Entry>();
        int current = -1; float dim; Light spot; readonly List<(Light light, float baseIntensity, GasLanternFlicker flicker)> lights = new List<(Light, float, GasLanternFlicker)>();
        GameObject panel; TextMeshPro title, counter, body, qty;
        XRBaseInteractor grabber; Quaternion handRot0, toolRot0;
        public bool Busy => state != State.Browse;

        void Start()
        {
            var ta = Resources.Load<TextAsset>("tools");
            if (ta == null || tray == null) { Debug.LogWarning("[Machine Yard] 工具箱：缺少 Resources/tools.json 或 ToolTray"); return; }
            var infos = JsonConvert.DeserializeObject<List<ToolInfo>>(ta.text);
            foreach (var info in infos)
            {
                var node = XrUtil.FindDeep(tray, "Tool_" + info.id);
                if (node == null) { Debug.LogWarning("[Machine Yard] 找不到工具節點 Tool_" + info.id); continue; }
                var e = new Entry { info = info, node = node, pos = node.localPosition, rot = node.localRotation, scale = node.localScale };
                entries.Add(e);
                int idx = entries.Count - 1;
                var it = XrUtil.EnsureInteractable(node.gameObject, 0.03f);
                it.selectEntered.AddListener(a =>
                {
                    if (state == State.Browse) Select(idx);
                    else if (state == State.Showing && idx == current) BeginGrab(a.interactorObject as XRBaseInteractor);
                });
                it.selectExited.AddListener(_ => grabber = null);
            }
            foreach (var l in workshopRoot.GetComponentsInChildren<Light>(true)) { var f = l.GetComponent<GasLanternFlicker>(); lights.Add((l, f != null ? f.baseIntensity : l.intensity, f)); }
        }

        // ---- 流程
        public void Select(int i)
        {
            if (state != State.Browse || i < 0 || i >= entries.Count) return;
            current = i; StopAllCoroutines(); StartCoroutine(Lift(i));
        }

        public void Step(int dir)
        {
            if (state != State.Showing) return;
            int next = ((current + dir) % entries.Count + entries.Count) % entries.Count;
            StopAllCoroutines(); StartCoroutine(Switch(next));
        }

        public void PutAway() { if (state == State.Showing) { StopAllCoroutines(); StartCoroutine(Return(current, true)); } }

        Vector3 ShowLocal() => tray.InverseTransformPoint(workshopRoot.TransformPoint(ThreeCoords.Position(ShowAtThree.x, ShowAtThree.y, ShowAtThree.z)));

        IEnumerator Lift(int i)
        {
            state = State.Lifting;
            var e = entries[i];
            if (fx != null) fx.Steam(e.node.position, Vector3.up, 8);
            EnsureSpot();
            yield return Tween(e, e.pos, e.rot, e.scale, ShowLocal(), ShowRotation(e), Vector3.one * (e.info.display.scale * ShowScale), 0.65f, 0f, 1f);
            PlacePanel(); ShowPanel(i);
            state = State.Showing;
        }

        IEnumerator Switch(int next)
        {
            state = State.Lifting; panel.SetActive(false);
            yield return Return(current, false);
            current = next; var e = entries[next];
            yield return Tween(e, e.pos, e.rot, e.scale, ShowLocal(), ShowRotation(e), Vector3.one * (e.info.display.scale * ShowScale), 0.6f, 1f, 1f);
            PlacePanel(); ShowPanel(next);
            state = State.Showing;
        }

        IEnumerator Return(int i, bool fadeLights)
        {
            state = State.Returning; if (panel != null) panel.SetActive(false);
            var e = entries[i];
            var curPos = e.node.localPosition; var curRot = e.node.localRotation; var curScale = e.node.localScale;
            yield return Tween(e, curPos, curRot, curScale, e.pos, e.rot, e.scale, 0.5f, fadeLights ? 1f : dim, fadeLights ? 0f : dim);
            current = fadeLights ? -1 : current;
            if (fadeLights) state = State.Browse;
        }

        Quaternion ShowRotation(Entry e)
        {
            var r = e.info.display.rotation ?? new float[3];
            return ThreeCoords.EulerXYZ(r[0], r[1], r[2]);
        }

        // 位置、旋轉、縮放補間（easeInOut）；同時把燈光亮暗從 d0 補到 d1（dim：0＝全亮、1＝剩 15%）
        IEnumerator Tween(Entry e, Vector3 p0, Quaternion r0, Vector3 s0, Vector3 p1, Quaternion r1, Vector3 s1, float seconds, float d0, float d1)
        {
            for (float t = 0; t < seconds; t += Time.deltaTime)
            {
                float k = t / seconds; k = k * k * (3 - 2 * k);
                e.node.localPosition = Vector3.Lerp(p0, p1, k); e.node.localRotation = Quaternion.Slerp(r0, r1, k); e.node.localScale = Vector3.Lerp(s0, s1, k);
                SetDim(Mathf.Lerp(d0, d1, k));
                yield return null;
            }
            e.node.localPosition = p1; e.node.localRotation = r1; e.node.localScale = s1; SetDim(d1);
        }

        void SetDim(float d)
        {
            dim = d;
            foreach (var (l, b, f) in lights)
            {
                if (l == null || l == spot) continue;
                float v = b * Mathf.Lerp(1f, DimTo, d);
                if (f != null) f.baseIntensity = v; else l.intensity = v;   // 煤氣燈由 GasLanternFlicker 每格寫強度，所以改它的基準值
            }
            if (spot != null) spot.intensity = 2.5f * d;
        }

        void EnsureSpot()
        {
            if (spot != null) return;
            var go = new GameObject("ToolSpot"); go.transform.SetParent(workshopRoot, false);
            go.transform.localPosition = ThreeCoords.Position(ShowAtThree.x, ShowAtThree.y + 1.1f, ShowAtThree.z - 0.05f);
            go.transform.rotation = Quaternion.LookRotation(Vector3.down);
            spot = go.AddComponent<Light>(); spot.type = LightType.Spot; spot.color = new Color(1f, 0.94f, 0.85f); spot.range = 3f; spot.spotAngle = 48f; spot.intensity = 0f; spot.shadows = LightShadows.None;
        }

        // ---- 抓住工具轉動
        void BeginGrab(XRBaseInteractor hand)
        {
            if (hand == null || current < 0) return;
            grabber = hand; handRot0 = hand.transform.rotation; toolRot0 = entries[current].node.rotation;
        }

        void Update()
        {
            if (state != State.Showing || grabber == null || current < 0) return;
            entries[current].node.rotation = grabber.transform.rotation * Quaternion.Inverse(handRot0) * toolRot0;
        }

        // ---- 說明面板
        void PlacePanel()
        {
            if (panel == null) BuildPanel();
            var eye = head.transform.position;
            var showWorld = workshopRoot.TransformPoint(ThreeCoords.Position(ShowAtThree.x, ShowAtThree.y, ShowAtThree.z));
            var toward = showWorld - eye; toward.y = 0; if (toward.sqrMagnitude < 1e-4f) toward = Vector3.forward; toward.Normalize();
            var at = eye + toward * PanelDistance; at.y = eye.y + PanelRise;
            panel.transform.position = at;
            panel.transform.rotation = Quaternion.LookRotation(toward, Vector3.up);   // 正面朝 −Z，所以 +Z 指向遠離使用者
        }

        void BuildPanel()
        {
            panel = new GameObject("ToolInfoPanel");
            DebugMenu.AddBox(panel.transform, "bg", new Vector3(0, 0, 0.01f), new Vector2(0.44f, 0.3f), new Color(0.11f, 0.08f, 0.05f, 0.96f));
            title = DebugMenu.AddLabel(panel.transform, "", new Vector3(-0.03f, 0.115f, 0), 0.034f, new Color(0.91f, 0.76f, 0.48f), false, new Vector2(0.34f, 0.05f));
            title.alignment = TextAlignmentOptions.TopLeft;
            counter = DebugMenu.AddLabel(panel.transform, "", new Vector3(0.18f, 0.115f, 0), 0.026f, new Color(0.6f, 0.75f, 0.6f), false, new Vector2(0.08f, 0.05f));
            body = DebugMenu.AddLabel(panel.transform, "", new Vector3(0, 0.005f, 0), 0.024f, new Color(0.93f, 0.9f, 0.8f), false, new Vector2(0.4f, 0.17f));
            body.alignment = TextAlignmentOptions.TopLeft;
            qty = DebugMenu.AddLabel(panel.transform, "", new Vector3(-0.15f, -0.12f, 0), 0.022f, new Color(0.7f, 0.65f, 0.5f), false, new Vector2(0.12f, 0.04f));
            PanelButton("上一項", -0.15f, () => Step(-1)); PanelButton("下一項", 0f, () => Step(1)); PanelButton("放回盒中", 0.15f, PutAway);
            panel.SetActive(false);
        }

        void PanelButton(string label, float x, Action a)
        {
            var go = DebugMenu.AddBox(panel.transform, label, new Vector3(x, -0.19f, 0), new Vector2(0.135f, 0.044f), new Color(0.35f, 0.24f, 0.13f));
            DebugMenu.AddLabel(go.transform, label, new Vector3(0, 0, -0.002f), 0.03f, Color.white, true, new Vector2(0.13f, 0.04f));
            XrUtil.MakeClickable(go, a, 0.01f);
        }

        void ShowPanel(int i)
        {
            var info = entries[i].info;
            title.text = info.name; counter.text = $"{i + 1} / {entries.Count}"; body.text = info.description; qty.text = string.IsNullOrEmpty(info.quantity) ? "" : "數量 " + info.quantity;
            panel.SetActive(true);
        }
    }
}
