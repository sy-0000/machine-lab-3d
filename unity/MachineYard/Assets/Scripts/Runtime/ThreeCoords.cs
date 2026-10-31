using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 把網站（three.js）的座標換成 Unity 座標。three.js 是右手系（+X 東、-Z 北、+Y 上），Unity 是左手系。
    /// glTFast 匯入 glb 時會做一次手性轉換；這裡的轉換必須與它一致，否則程式放的燈、站位會和模型對不上。
    /// 預設 NegateX（glTFast 的做法：x 取負）。如果匯入後發現手寫座標（站位、燈）和模型左右相反，
    /// 把 <see cref="Mode"/> 改成 NegateZ 再試（本檔是全專案唯一要改的地方）。
    /// </summary>
    public static class ThreeCoords
    {
        public enum FlipMode { NegateX, NegateZ }
        public static FlipMode Mode = FlipMode.NegateX;

        public static Vector3 Position(float x, float y, float z) =>
            Mode == FlipMode.NegateX ? new Vector3(-x, y, z) : new Vector3(x, y, -z);

        public static Vector3 Direction(float x, float y, float z) => Position(x, y, z);

        /// <summary>three.js 的 yaw（0 = 面向北 = -Z，逆時針為正）轉成 Unity 的 Y 旋轉角（度）。</summary>
        public static float YawDegrees(float threeYawRadians)
        {
            var forward = Direction(-Mathf.Sin(threeYawRadians), 0f, -Mathf.Cos(threeYawRadians));
            return Mathf.Atan2(forward.x, forward.z) * Mathf.Rad2Deg;
        }
    }
}
