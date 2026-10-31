using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 可站的範圍（頭的位置投影到地面）。邏輯照 src/xr/areas/Lobby.js 的 canStand 與 Workshop.js 的 canStandInWorkshop，
    /// 以 three.js 座標計算（呼叫端用 ThreeCoords.ToThree 換回來）。
    /// 玄關：x ±(3.0−0.35)、z 10.95～15.3；大門打開時門口 |x|&lt;0.85、z 15.3～16.4；門外前庭 z&gt;16.4～34、|x|&lt;14。
    /// 佔位工作室：八角（apothem 10，內縮 0.6）扣掉機台鋼板與工作桌的矩形。
    /// </summary>
    public static class WalkArea
    {
        const float VestX = 3.0f, VestZ0 = 10.6f, VestZ1 = 15.6f, Wall = 0.4f;
        const float FacadeZ = VestZ1 + Wall;

        public static bool CanStandLobby(float x, float z, bool doorsOpen)
        {
            if (Mathf.Abs(x) < VestX - 0.35f && z > VestZ0 + 0.35f && z < VestZ1 - 0.3f) return true;
            if (doorsOpen && Mathf.Abs(x) < 0.85f && z >= VestZ1 - 0.3f && z <= FacadeZ + 0.4f) return true;
            return z > FacadeZ + 0.4f && z < 34f && Mathf.Abs(x) < 14f;
        }

        /// <summary>x、z 是相對於佔位工作室原點（已扣掉 WorkshopOffsetThree）。</summary>
        public static bool CanStandWorkshop(float x, float z)
        {
            const float limit = 10f - 0.6f; // ROOM.apothem − 0.6
            for (int k = 0; k < 8; k++)
            {
                float t = k * Mathf.PI * 2f / 8f;
                if (x * Mathf.Sin(t) - z * Mathf.Cos(t) > limit) return false;
            }
            if (x > -1.2f && x < 1.2f && z > -0.9f && z < 0.9f) return false;   // 機台鋼板
            if (x > -1.2f && x < 1.2f && z > 5.1f && z < 6.45f) return false;   // 工作桌
            return true;
        }
    }
}
