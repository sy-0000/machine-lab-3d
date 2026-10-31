using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 換機台（對應 Workshop.js 的 enter({ machineId })：工作室同一時間只有一台機台）。
    /// 三台機台都先建好，只啟用一台（停用的不繪製、不更新，音源也停止）。換機台時在機台位置噴一團蒸汽遮住畫面，
    /// 蒸汽最濃時才切換，再補一陣蒸汽散去；兩側的瞬移圓盤依各機台手輪位置移動（teleportDiscs.js 的 SIDE_Z），
    /// 玩家若站在圓盤上就跟著移到新位置。
    /// </summary>
    public class MachineSwitcher : MonoBehaviour
    {
        [Serializable] public class Entry { public string id; public GameObject root; }
        public List<Entry> entries = new List<Entry>();
        public MachineEffects fx; public StationMover mover; public Transform workshopRoot; public Camera head;
        public string Current;
        public bool Busy { get; private set; }
        public event Action<string> Switched;

        /// <summary>機台兩側瞬移點的 z（鋼板座標）：靠近該側手輪。</summary>
        public static float SideZ(string id) => id == "milling" ? 0.4f : id == "drill" ? 0.05f : 0.15f;

        public void Switch(string id)
        {
            if (Busy || id == Current || !entries.Exists(e => e.id == id)) return;
            StartCoroutine(Run(id));
        }

        IEnumerator Run(string id)
        {
            Busy = true;
            var center = workshopRoot.TransformPoint(ThreeCoords.Position(0, 1.0f, 0));
            // 玩家站在哪個圓盤上（水平距離 < 0.5 m），換完機台後跟著新位置
            Station standing = null;
            if (head != null)
                foreach (var d in TeleportDisc.All)
                {
                    var p = d.station.Position; var h = head.transform.position;
                    if (Mathf.Abs(p.x - h.x) < 0.5f && Mathf.Abs(p.z - h.z) < 0.5f) { standing = d.station; break; }
                }
            for (float t = 0; t < 0.9f; t += Time.deltaTime)
            {
                fx.Steam(center + new Vector3(UnityEngine.Random.value - .5f, UnityEngine.Random.value * 0.6f - .3f, UnityEngine.Random.value - .5f) * 1.2f, Vector3.up, 2);
                yield return null;
            }
            foreach (var e in entries) e.root.SetActive(e.id == id);
            Current = id;
            MoveDiscs(id);
            if (standing != null && mover != null) mover.Place(standing);
            for (float t = 0; t < 0.6f; t += Time.deltaTime)
            {
                fx.Steam(center + new Vector3(UnityEngine.Random.value - .5f, UnityEngine.Random.value * 0.6f - .3f, UnityEngine.Random.value - .5f) * 1.2f, Vector3.up, 1);
                yield return null;
            }
            Busy = false;
            Switched?.Invoke(id);
        }

        void MoveDiscs(string id)
        {
            float z = SideZ(id);
            foreach (var d in TeleportDisc.All)
            {
                if (d.station.Name != "left" && d.station.Name != "right") continue;
                d.station.Three = new Vector3(d.station.Three.x, d.station.Three.y, Stations.WorkshopOffsetThree.z + z);
                var pos = d.station.Position;
                d.transform.position = new Vector3(pos.x, d.transform.position.y, pos.z);
            }
        }
    }
}
