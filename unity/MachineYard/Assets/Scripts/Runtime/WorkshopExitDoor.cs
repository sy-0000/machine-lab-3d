using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 工作室的出口（房間 +Z 端的拱門 ArchedDoor，工作桌後方）：trigger 點門 → 兩扇門往外（離開房間中心的方向）推開 →
    /// 淡出 → 回到玄關金庫門外，金庫門在面前關上（LobbyFlow.ReturnFromWorkshop）。
    /// 匯出的拱門是一組平的節點（左右門板、鉸鏈帶、拉環、鉚釘都是兄弟節點），這裡在執行期依 three 局部 x 的正負，
    /// 把屬於左右門扇的零件分別掛到兩個鉸鏈樞軸下（HingeKnuckle 鉸鏈筒、拱框、門檻不動）。
    /// WorkshopBuilder 會把這組節點排除在靜態合批之外（合批後就不能動）。
    /// </summary>
    public class WorkshopExitDoor : MonoBehaviour
    {
        public LobbyFlow flow; public StationMover mover; public Transform workshopRoot;
        public float openDegrees = 80f, openSeconds = 1.0f;
        /// <summary>拱形防爆鋼門（D41；場景建置時建好）。有值時木門零件隱藏，改播鋼門的開門動畫（手輪轉 → 門栓收回 → 往外轉開）。</summary>
        public ArchedBlastDoor blast; public MachineEffects fx;
        float blastSign = 1f; Vector3[] boltStart; Quaternion wheel0;
        Transform pivotL, pivotR; float signL = 1, signR = 1; bool busy, built;
        static readonly HashSet<string> Fixed = new HashSet<string> { "HingeKnuckle", "ArchSurround", "Threshold" };

        void Start() { Build(); }

        void Build()
        {
            if (built) return; built = true;
            if (blast != null)
            {
                var outwardB = transform.position - workshopRoot.position; outwardB.y = 0; outwardB.Normalize();
                blastSign = SideSign(blast.hinge, outwardB);
                boltStart = blast.bolts.ConvertAll(b => b.localPosition).ToArray(); wheel0 = blast.wheel.localRotation;
                var tb = XrUtil.EnsureTarget(gameObject, 0.05f); tb.highlight = false;
                tb.onClick += _ => { if (!busy) StartCoroutine(ExitBlast()); };
                return;
            }
            pivotL = MakePivot("HingePivot_L", -1.08f); pivotR = MakePivot("HingePivot_R", 1.08f);
            var parts = new List<Transform>();
            foreach (Transform c in transform) parts.Add(c);
            foreach (var c in parts)
            {
                if (c == pivotL || c == pivotR || Fixed.Contains(c.name)) continue;
                if (c.name == "DoorRivets") { var rivets = new List<Transform>(); foreach (Transform r in c) rivets.Add(r); foreach (var r in rivets) Attach(r); continue; }
                Attach(c);
            }
            var outward = transform.position - workshopRoot.position; outward.y = 0; outward.Normalize();
            signL = SideSign(pivotL, outward);
            signR = SideSign(pivotR, outward);
            var target = XrUtil.EnsureTarget(gameObject, 0.05f);
            target.highlight = false;   // 整扇門（含拱框）太大，不發亮
            target.onClick += _ => { if (!busy) StartCoroutine(Exit()); };
        }

        Transform MakePivot(string name, float threeX)
        {
            var p = new GameObject(name).transform; p.SetParent(transform, false);
            p.localPosition = ThreeCoords.Position(threeX, 0, 0.1f);
            return p;
        }

        void Attach(Transform part)
        {
            float x = ThreeCoords.ToThree(part.localPosition).x;
            if (part.name == "LeafLeft" || part.name == "LeafRight") x = part.name == "LeafLeft" ? -1 : 1;
            part.SetParent(x < 0 ? pivotL : pivotR, true);
        }

        // 樞軸轉 +20° 後，門扇的重心是否往外移
        float SideSign(Transform pivot, Vector3 outward)
        {
            if (pivot.childCount == 0) return 1f;
            var c0 = XrUtil.RendererBounds(pivot.gameObject).center;
            var q0 = pivot.localRotation; pivot.localRotation = q0 * Quaternion.Euler(0, 20f, 0);
            var c1 = XrUtil.RendererBounds(pivot.gameObject).center; pivot.localRotation = q0;
            return Vector3.Dot(c1 - c0, outward) >= 0 ? 1f : -1f;
        }

        IEnumerator Exit()
        {
            if (flow == null || mover == null || mover.Busy) yield break;
            busy = true;
            yield return Swing(0, 1);
            yield return flow.ReturnFromWorkshop();
            pivotL.localRotation = Quaternion.identity; pivotR.localRotation = Quaternion.identity;   // 玩家已離開，門回到關閉
            busy = false;
        }

        // 鋼門：手輪轉 0.8 s（後半段門栓收回、噴蒸汽）→ 門往外轉開 → 淡出回玄關 → 門復位
        IEnumerator ExitBlast()
        {
            if (flow == null || mover == null || mover.Busy) yield break;
            busy = true;
            bool steamed = false;
            for (float t = 0; t < 0.8f; t += Time.deltaTime)
            {
                blast.wheel.Rotate(0, 0, -Time.deltaTime * 5f * Mathf.Rad2Deg, Space.Self);
                float k = Mathf.Clamp01((t - 0.4f) / 0.4f); k = k * k * (3 - 2 * k);
                for (int i = 0; i < blast.bolts.Count; i++) blast.bolts[i].localPosition = boltStart[i] + blast.boltDirs[i] * (ArchedBlastDoor.BoltTravel * k);
                if (t > 0.4f && !steamed) { steamed = true; if (fx != null) foreach (var b in blast.bolts) fx.Steam(b.position, -blast.leaf.forward, 4); }
                yield return null;
            }
            for (float t = 0; t < openSeconds; t += Time.deltaTime)
            {
                float k = t / openSeconds; k = k * k * (3 - 2 * k);
                blast.hinge.localRotation = Quaternion.Euler(0, blastSign * openDegrees * k, 0);
                yield return null;
            }
            yield return flow.ReturnFromWorkshop();
            blast.hinge.localRotation = Quaternion.identity; blast.wheel.localRotation = wheel0;
            for (int i = 0; i < blast.bolts.Count; i++) blast.bolts[i].localPosition = boltStart[i];
            busy = false;
        }

        IEnumerator Swing(float a, float b)
        {
            for (float t = 0; t < openSeconds; t += Time.deltaTime)
            {
                float k = Mathf.Lerp(a, b, t / openSeconds); k = k * k * (3 - 2 * k);
                pivotL.localRotation = Quaternion.Euler(0, signL * openDegrees * k, 0);
                pivotR.localRotation = Quaternion.Euler(0, signR * openDegrees * k, 0);
                yield return null;
            }
        }
    }
}
