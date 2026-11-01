using System.Collections;
using UnityEngine;

namespace MachineYard
{
    public enum Area { Lobby, Workshop }

    /// <summary>固定站位（地面位置＋面向）。數值取自 src/xr/areas/Lobby.js 的 STATIONS 與 workshop/teleportDiscs.js，以 three.js 座標存、用時才換算。</summary>
    public class Station
    {
        public string Name; public Vector3 Three; public float YawRadians; public Area Area;
        public Vector3 Position => ThreeCoords.Position(Three.x, Three.y, Three.z);
        public float YawDegrees => ThreeCoords.YawDegrees(YawRadians);
    }

    public static class Stations
    {
        /// <summary>雲端階段 3 的「佔位工作室」放在遠處（真正的工作室在階段 4 以後做，座標與玄關重疊，所以必須分開放）。</summary>
        public static readonly Vector3 WorkshopOffsetThree = new Vector3(200f, 0f, 0f);

        public static readonly Station Outside = new Station { Name = "outside", Three = new Vector3(0, 0, 19.2f), YawRadians = 0, Area = Area.Lobby };
        public static readonly Station Center = new Station { Name = "center", Three = new Vector3(0, 0, 13.9f), YawRadians = 0, Area = Area.Lobby };
        public static readonly Station Board = new Station { Name = "board", Three = new Vector3(-2.0f, 0, 13.1f), YawRadians = Mathf.PI / 2, Area = Area.Lobby };
        public static readonly Station Screen = new Station { Name = "screen", Three = new Vector3(2.0f, 0, 13.1f), YawRadians = -Mathf.PI / 2, Area = Area.Lobby };
        public static readonly Station Vault = new Station { Name = "vault", Three = new Vector3(0, 0, 12.1f), YawRadians = 0, Area = Area.Lobby };
        /// <summary>金庫門往外開時的觀看位置：門板半徑 1.12 m、鉸鏈在左緣，門扇掃過的範圍到門面 +1.94 m；門面在 z = 10.6，所以退到 13.3。</summary>
        public static readonly Station VaultBack = new Station { Name = "vaultBack", Three = new Vector3(0, 0, 13.3f), YawRadians = 0, Area = Area.Lobby };

        /// <summary>佔位工作室的出生點（工作桌前，teleportDiscs.js 的 desk）。</summary>
        public static Station WorkshopDesk => Disc("desk", 0, 6.7f, 0);

        public static Station Disc(string name, float x, float z, float yaw) =>
            new Station { Name = name, Three = new Vector3(x + WorkshopOffsetThree.x, 0, z + WorkshopOffsetThree.z), YawRadians = yaw, Area = Area.Workshop };

        /// <summary>車床版的瞬移圓盤（teleportDiscs.js SIDE_Z.lathe = 0.15）。</summary>
        public static Station[] WorkshopDiscs() => new[]
        {
            Disc("desk", 0, 6.7f, 0),
            Disc("front", 0, 1.05f, 0),
            Disc("left", -1.35f, 0.15f, -Mathf.PI / 2),
            Disc("right", 1.35f, 0.15f, Mathf.PI / 2),
        };
    }

    /// <summary>XR rig 的站位移動：淡出 → 把「頭」放到站位並轉向 → 淡入。不處理身體朝向以外的東西。</summary>
    public class StationMover : MonoBehaviour
    {
        public Transform rig;       // XR Origin
        public Camera head;
        public ScreenFade fade;
        public Area CurrentArea { get; private set; } = Area.Lobby;
        public bool Busy { get; private set; }
        public event System.Action<Station> Moved;

        public void Place(Station s) { Apply(s); }

        public Coroutine MoveTo(Station s, System.Action midFade = null)
        {
            if (Busy) return null;
            return StartCoroutine(Run(s, midFade));
        }

        IEnumerator Run(Station s, System.Action midFade)
        {
            Busy = true;
            if (fade != null) yield return fade.FadeOut();
            Apply(s);
            midFade?.Invoke();
            yield return null; // 讓 XR 追蹤更新一格
            if (fade != null) yield return fade.FadeIn();
            Busy = false;
        }

        void Apply(Station s)
        {
            // 先轉：讓頭盔朝向 = 站位面向；繞頭轉，所以轉完再平移
            float camYawInRig = head.transform.localEulerAngles.y;
            rig.rotation = Quaternion.Euler(0, s.YawDegrees - camYawInRig, 0);
            var delta = s.Position - head.transform.position;
            rig.position = new Vector3(rig.position.x + delta.x, s.Position.y, rig.position.z + delta.z);
            CurrentArea = s.Area;
            Moved?.Invoke(s);
        }
    }
}
