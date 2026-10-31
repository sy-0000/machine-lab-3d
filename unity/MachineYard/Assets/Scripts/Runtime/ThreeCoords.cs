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

        /// <summary>Unity 座標換回 three.js 座標（兩種翻轉都是自己的反函數）。走動範圍判斷用 three.js 的數字。</summary>
        public static Vector3 ToThree(Vector3 u) => Position(u.x, u.y, u.z);

        /// <summary>
        /// three.js 局部座標的「繞軸旋轉」換成 Unity 的四元數。鏡像（det = -1）會讓同一個旋轉的角度變號：
        /// M·R(a, θ)·M⁻¹ = R(M·a, −θ)。Unity 的 AngleAxis 數值上就是標準旋轉矩陣，所以 = AngleAxis(−θ, Direction(a))。
        /// （例：three 繞 +Y 轉 θ，Unity 要繞 +Y 轉 −θ。）
        /// </summary>
        public static Quaternion AxisAngle(Vector3 axisThree, float thetaRadians) =>
            Quaternion.AngleAxis(-thetaRadians * Mathf.Rad2Deg, Direction(axisThree.x, axisThree.y, axisThree.z).normalized);

        /// <summary>three.js 的四元數（局部旋轉）→ Unity。NegateX：(x,−y,−z,w)；NegateZ：(−x,−y,z,w)。</summary>
        public static Quaternion Rotation(float x, float y, float z, float w) =>
            Mode == FlipMode.NegateX ? new Quaternion(x, -y, -z, w) : new Quaternion(-x, -y, z, w);

        /// <summary>three.js Euler(x, y, z)（順序 XYZ）→ Unity 四元數。</summary>
        public static Quaternion EulerXYZ(float rx, float ry, float rz)
        {
            // three 的 XYZ：矩陣 = Rx · Ry · Rz，四元數乘法順序相同
            var qx = AxisAngle(Vector3.right, rx); var qy = AxisAngle(Vector3.up, ry); var qz = AxisAngle(Vector3.forward, rz);
            return qx * qy * qz;
        }

        /// <summary>three.js 的 yaw（0 = 面向北 = -Z，逆時針為正）轉成 Unity 的 Y 旋轉角（度）。</summary>
        public static float YawDegrees(float threeYawRadians)
        {
            var forward = Direction(-Mathf.Sin(threeYawRadians), 0f, -Mathf.Cos(threeYawRadians));
            return Mathf.Atan2(forward.x, forward.z) * Mathf.Rad2Deg;
        }
    }
}
