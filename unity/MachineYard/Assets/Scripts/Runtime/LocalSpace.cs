using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 用「局部座標鏈」換算座標，不經過世界座標。工作室放在世界座標 x = 200 m 的地方，float 在那裡的精度只有約 0.015 mm，
    /// 直接用 TransformPoint／InverseTransformPoint 量刀尖會有雜訊（面銑後上表面不會剛好平）。
    /// 局部位置都在 1 m 以內，精度約 1e-4 mm。
    /// </summary>
    public static class LocalSpace
    {
        /// <summary>t 局部座標的點 p → ancestor 局部座標（ancestor 必須是 t 的祖先或 t 自己）。</summary>
        public static Vector3 ToAncestor(Transform t, Transform ancestor, Vector3 p)
        {
            for (var n = t; n != null && n != ancestor; n = n.parent)
                p = n.localRotation * Vector3.Scale(p, n.localScale) + n.localPosition;
            return p;
        }

        /// <summary>ancestor 局部座標的點 p → t 局部座標。</summary>
        public static Vector3 FromAncestor(Transform t, Transform ancestor, Vector3 p)
        {
            var chain = new System.Collections.Generic.List<Transform>();
            for (var n = t; n != null && n != ancestor; n = n.parent) chain.Add(n);
            for (int i = chain.Count - 1; i >= 0; i--)
            {
                var n = chain[i];
                p = Quaternion.Inverse(n.localRotation) * (p - n.localPosition);
                var s = n.localScale; p = new Vector3(p.x / s.x, p.y / s.y, p.z / s.z);
            }
            return p;
        }
    }
}
