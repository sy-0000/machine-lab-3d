using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 金庫圓門（對應 src/xr/lobby/vaultDoor.js；幾何來自 vestibule_interactive.glb 的 VaultDoor）。
    /// 手輪（WheelPivot）：未解鎖 → 抖動＋提示 3 秒；已解鎖 → 手輪轉 → 門栓（Bolt）收回 → 門（DoorHinge）轉開 4 秒。
    /// 兩支壓力錶（PressureGauge/Needle，x 較小者＝工安，另一支＝動畫）指針平滑走到進度；指示燈（Lamp）未解鎖紅、解鎖綠。
    /// 時間軸：0–1.5 s 手輪轉；1.5–2.1 s 門栓收回（回呼 onBolts）；2.1–4.0 s 門轉開 100°。
    /// 旋轉方向（門、指針）在 Start 時用實測決定符號，不依賴手性轉換的猜測。
    /// </summary>
    public class VaultDoorController : MonoBehaviour
    {
        public Transform hinge, leaf, wheelPivot, gearRing, lamp, lockedHint;
        public Transform[] needles = new Transform[2]; // 0 = 工安、1 = 動畫
        public List<Transform> bolts = new List<Transform>();
        public bool IsOpening { get; private set; }
        /// <summary>門已完全打開（開門動畫結束後）。</summary>
        public bool IsOpen { get; private set; }
        /// <summary>蒸汽特效（門栓收回、壓力錶滿格時噴）；沒指定就不噴。</summary>
        public MachineEffects fx;
        float[] value = new float[2], target = new float[2];
        float hingeSign = 1f, needleSign = -1f, hintTime, shake; Quaternion wheel0, hinge0 = Quaternion.identity;
        Vector3[] boltStart;

        public void AutoWire()
        {
            hinge = XrUtil.FindDeep(transform, "DoorHinge");
            leaf = XrUtil.FindDeep(transform, "DoorLeaf");
            wheelPivot = XrUtil.FindDeep(transform, "WheelPivot");
            gearRing = XrUtil.FindDeep(transform, "GearRing");
            lamp = XrUtil.FindDeep(transform, "Lamp");
            lockedHint = XrUtil.FindDeep(transform, "LockedHint");
            bolts.Clear();
            if (leaf != null) foreach (Transform c in leaf) if (c.name == "Bolt") bolts.Add(c);
            var found = new List<Transform>();
            foreach (var t in GetComponentsInChildren<Transform>(true)) if (t.name == "Needle") found.Add(t);
            found.Sort((a, b) => ThreeCoords.ToThree(a.position).x.CompareTo(ThreeCoords.ToThree(b.position).x)); // three 的 x 小＝左＝工安
            for (int i = 0; i < 2 && i < found.Count; i++) needles[i] = found[i];
        }

        void Start()
        {
            if (hinge == null) AutoWire();
            if (wheelPivot != null) wheel0 = wheelPivot.localRotation;
            if (hinge != null) hinge0 = hinge.localRotation;
            boltStart = bolts.ConvertAll(b => b.localPosition).ToArray();
            // 門往外開（+Z(three)＝朝玄關、朝玩家；網站版是往內朝工作室開，使用者要求改成往外，D36）。開門前 LobbyFlow 會先把玩家退到門板掃不到的位置
            if (hinge != null && leaf != null) hingeSign = XrUtil.SwingSign(hinge, leaf, ThreeCoords.Direction(0, 0, 1));
            // 指針：初始(v=0)的 z 角是 +135° 或 -135°(=225°)，據此決定符號
            if (needles[0] != null)
            {
                float z = needles[0].localEulerAngles.z;
                needleSign = Mathf.Abs(Mathf.DeltaAngle(z, 135f)) < Mathf.Abs(Mathf.DeltaAngle(z, -135f)) ? 1f : -1f;
            }
            if (lockedHint != null) lockedHint.gameObject.SetActive(false);
            ProgressStore.Instance.Changed += Sync;
            Sync(true);
        }

        void OnDestroy() { ProgressStore.Instance.Changed -= Sync; }
        void Sync() => Sync(false);

        void Sync(bool initial)
        {
            var p = ProgressStore.Instance;
            for (int k = 0; k < 2; k++) { float nt = k == 0 ? p.SafetyRatio : p.ClipsRatio; if (!initial && nt >= 1f && target[k] < 1f && needles[k] != null && fx != null) fx.Steam(needles[k].position, Vector3.up, 10); }
            target[0] = p.SafetyRatio; target[1] = p.ClipsRatio;
            if (initial) { value[0] = target[0]; value[1] = target[1]; }
            if (lamp != null) XrUtil.SetColor(lamp.GetComponent<Renderer>(), p.Unlocked ? new Color(0.22f, 1f, 0.42f) : new Color(1f, 0.23f, 0.14f));
        }

        public void Rattle() { shake = 0.6f; hintTime = 3f; if (lockedHint != null) lockedHint.gameObject.SetActive(true); }

        public IEnumerator Open(Action onBolts)
        {
            if (IsOpening) yield break;
            IsOpening = true;
            bool bolted = false;
            for (float t = 0; t < 4f; t += Time.deltaTime)
            {
                if (wheelPivot != null) wheelPivot.Rotate(0, 0, -Time.deltaTime * Mathf.Min(1f, t / 0.6f) * 5f * Mathf.Rad2Deg, Space.Self);
                if (t > 1.5f) PlaceBolts(Ease(Mathf.Min(1f, (t - 1.5f) / 0.6f)));
                if (t > 1.5f && !bolted) { bolted = true; onBolts?.Invoke(); if (fx != null) foreach (var b in bolts) fx.Steam(b.position, leaf.forward, 6); }
                if (t > 2.1f && hinge != null) hinge.localRotation = hinge0 * Quaternion.Euler(0, hingeSign * 100f * Ease(Mathf.Min(1f, (t - 2.1f) / 1.9f)), 0);
                yield return null;
            }
            IsOpening = false; IsOpen = true;
        }

        /// <summary>關門（開門的倒放、較快）：門轉回 1.2 s → 門栓伸出（噴蒸汽）0.5 s → 手輪反轉 0.8 s。從工作室走出來時在玩家面前關上。</summary>
        public IEnumerator Close()
        {
            if (!IsOpen || IsOpening) yield break;
            IsOpening = true;
            for (float t = 0; t < 1.2f; t += Time.deltaTime) { if (hinge != null) hinge.localRotation = hinge0 * Quaternion.Euler(0, hingeSign * 100f * Ease(1f - t / 1.2f), 0); yield return null; }
            if (hinge != null) hinge.localRotation = hinge0;
            if (fx != null) foreach (var b in bolts) fx.Steam(b.position, leaf.forward, 4);
            for (float t = 0; t < 0.5f; t += Time.deltaTime) { PlaceBolts(Ease(1f - t / 0.5f)); yield return null; }
            PlaceBolts(0);
            for (float t = 0; t < 0.8f; t += Time.deltaTime) { if (wheelPivot != null) wheelPivot.Rotate(0, 0, Time.deltaTime * 5f * Mathf.Rad2Deg, Space.Self); yield return null; }
            if (wheelPivot != null) wheelPivot.localRotation = wheel0;
            IsOpening = false; IsOpen = false;
        }

        /// <summary>立刻回到關門狀態（從選單回玄關時）。</summary>
        public void ResetClosed()
        {
            StopAllCoroutines(); IsOpening = false; IsOpen = false;
            if (hinge != null) hinge.localRotation = hinge0;
            if (boltStart != null) PlaceBolts(0);
            if (wheelPivot != null) wheelPivot.localRotation = wheel0;
        }

        /// <summary>立刻變成開門狀態（從工作室走回玄關、門要在玩家面前關上之前）。</summary>
        public void SetOpen()
        {
            StopAllCoroutines(); IsOpening = false; IsOpen = true;
            if (hinge != null) hinge.localRotation = hinge0 * Quaternion.Euler(0, hingeSign * 100f, 0);
            if (boltStart != null) PlaceBolts(1);
        }

        void PlaceBolts(float k)
        {
            for (int i = 0; i < bolts.Count; i++)
            {
                var s = boltStart[i]; var xy = new Vector2(s.x, s.y);
                var n = xy.normalized * Mathf.Max(0, xy.magnitude - 0.2f * k);
                bolts[i].localPosition = new Vector3(n.x, n.y, s.z);
            }
        }

        static float Ease(float t) => t * t * (3f - 2f * t);

        /// <summary>牆上其他齒輪的轉速倍率（開門時加速）。</summary>
        public float GearBoost => IsOpening ? 6f : 1f;

        void Update()
        {
            if (gearRing != null) gearRing.Rotate(0, 0, Time.deltaTime * 0.06f * GearBoost * Mathf.Rad2Deg, Space.Self);
            for (int i = 0; i < 2; i++)
            {
                value[i] += (target[i] - value[i]) * Mathf.Min(1f, Time.deltaTime * 2.5f);
                if (needles[i] != null) needles[i].localRotation = Quaternion.Euler(0, 0, needleSign * (135f - 270f * value[i]));
            }
            if (shake > 0 && wheelPivot != null && !IsOpening)
            {
                shake = Mathf.Max(0, shake - Time.deltaTime);
                wheelPivot.localRotation = wheel0 * Quaternion.Euler(0, 0, Mathf.Sin(shake * 60f) * 0.05f * shake * Mathf.Rad2Deg);
            }
            if (hintTime > 0) { hintTime -= Time.deltaTime; if (hintTime <= 0 && lockedHint != null) lockedHint.gameObject.SetActive(false); }
        }
    }
}
