using System;

namespace MachineYard.Core
{
    /// <summary>刀尖在「不旋轉的工件座標」中的位置（毫米）。Z 沿主軸（從夾頭面起算）、U 為高度方向偏差、V 為徑向（操作者側為正）。</summary>
    public struct TipMm
    {
        public double Z, U, V;
        public TipMm(double z, double u, double v) { Z = z; U = u; V = v; }
    }

    public struct ChuckDanger
    {
        public double StartZMm, EndZMm, RadiusMm;
        public ChuckDanger(double start, double end, double radius) { StartZMm = start; EndZMm = end; RadiusMm = radius; }
    }

    /// <summary>
    /// 旋轉體工件的加工狀態（對應 src/machining/WorkpieceState.js 的 revolved state）：沿 Z 每 ResolutionMm 一格的半徑。
    /// 預設值＝網站的「槌柄」（HANDLE_STOCK：半徑 10 mm、長 300 mm、解析度 0.5 mm、夾持 0–40 mm）。
    /// 純 C#（不引用 UnityEngine），由 MachineYard.CoreTests 用網站 JS 產生的標準答案比對。
    /// </summary>
    public sealed class RevolvedState
    {
        public double ResolutionMm = 0.5, StockRadiusMm = 10, LengthMm = 300, ClampStartMm = 0, ClampEndMm = 40;
        /// <summary>實際使用的格數（車端面把前端整段切掉時會變少）。</summary>
        public int Count;
        public double[] Radii;
        /// <summary>每次工件被修改就加一，讓顯示端知道要重建網格。</summary>
        public int Version;

        public static RevolvedState CreateHandle()
        {
            var s = new RevolvedState();
            s.Count = (int)Math.Round(s.LengthMm / s.ResolutionMm);
            s.Radii = new double[s.Count];
            for (int i = 0; i < s.Count; i++) s.Radii[i] = s.StockRadiusMm;
            return s;
        }

        public RevolvedState Clone()
        {
            var c = (RevolvedState)MemberwiseClone();
            c.Radii = (double[])Radii.Clone();
            return c;
        }

        public double MaxRadius() { double m = 0; for (int i = 0; i < Count; i++) if (Radii[i] > m) m = Radii[i]; return m; }
    }

    public static class Cutting
    {
        public const double FacingMaxDepthMm = 2, FacingCenterToleranceMm = 0.000001;
        public static readonly ChuckDanger DefaultChuckDanger = new ChuckDanger(-30, 40, 40);

        // JS 的 Math.round 是「四捨五入往 +∞」，C# 預設是銀行家捨入，所以自己做
        static double Round9(double v) => Math.Floor(v * 1e9 + 0.5) / 1e9;
        static double Hypot(double a, double b) => Math.Sqrt(a * a + b * b);

        /// <summary>
        /// 車外徑：刀尖從 from 掃到 to，每個被碰到的格子削到刀尖掃過時離軸最近的半徑（點刀具、軸對稱的教學近似）。
        /// 對應 CuttingSimulation.js 的 cutRevolvedProfile。回傳是否有改動（就地修改 state）。
        /// </summary>
        public static bool CutRevolvedProfile(RevolvedState s, TipMm from, TipMm to, double rpm, bool hasTool = true)
        {
            if (!hasTool || double.IsNaN(rpm) || rpm <= 0) return false;
            double dz = to.Z - from.Z, du = to.U - from.U, dv = to.V - from.V;
            double spacing = s.ResolutionMm, length = s.LengthMm;
            double low = Math.Min(from.Z, to.Z), high = Math.Max(from.Z, to.Z);
            if (high < 0 || low >= length || (dz != 0 && high <= 0)) return false;
            int first = Math.Max(0, (int)Math.Floor(low / spacing));
            int last = Math.Min(s.Count - 1, dz == 0 ? first : (int)Math.Ceiling(high / spacing) - 1);
            bool changed = false;
            for (int i = first; i <= last; i++)
            {
                if (i * spacing < s.ClampEndMm) continue;
                double t0 = 0, t1 = 1;
                if (dz != 0)
                {
                    double a = (i * spacing - from.Z) / dz;
                    double b = (Math.Min(length, (i + 1) * spacing) - from.Z) / dz;
                    t0 = Math.Max(0, Math.Min(a, b)); t1 = Math.Min(1, Math.Max(a, b));
                    if (t0 > t1) continue;
                }
                double den = du * du + dv * dv;
                double t = den == 0 ? t0 : Math.Max(t0, Math.Min(t1, -(from.U * du + from.V * dv) / den));
                double radius = Round9(Hypot(from.U + du * t, from.V + dv * t));
                if (radius < s.Radii[i]) { s.Radii[i] = radius; changed = true; }
            }
            if (changed) s.Version++;
            return changed;
        }

        /// <summary>車端面：在固定 Z 平面上徑向進給，削掉前端。對應 cutFacing。</summary>
        public static bool CutFacing(RevolvedState s, TipMm from, TipMm to, double rpm, bool hasTool = true)
        {
            if (!(rpm > 0) || !hasTool) return false;
            double eps = FacingCenterToleranceMm;
            if (Math.Abs(from.Z - to.Z) > eps || Math.Abs(from.U) > eps || Math.Abs(to.U) > eps ||
                Math.Abs(from.V - to.V) <= eps || from.Z < s.LengthMm - FacingMaxDepthMm ||
                from.Z <= s.ClampEndMm || from.Z >= s.LengthMm) return false;
            double spacing = s.ResolutionMm;
            int first = (int)Math.Ceiling(from.Z / spacing - 1e-9);
            double plane = first * spacing;
            if (first >= s.Count) return false;
            double remaining = double.NegativeInfinity;
            for (int i = first; i < s.Count; i++) remaining = Math.Max(remaining, s.Radii[i]);
            if (Hypot(from.U, from.V) + eps < remaining) return false;
            bool crossed = from.V * to.V <= 0;
            double radius = crossed ? 0 : Math.Min(Math.Abs(from.V), Math.Abs(to.V));
            double cutRadius = Round9(radius);
            bool changed = false;
            for (int i = first; i < s.Count; i++) if (cutRadius < s.Radii[i]) { s.Radii[i] = cutRadius; changed = true; }
            if (!changed) return false;
            if (cutRadius == 0)
            {
                bool allZero = true;
                for (int i = first; i < s.Count; i++) if (s.Radii[i] != 0) { allZero = false; break; }
                if (allZero) { s.LengthMm = plane; s.Count = first; }
            }
            s.Version++;
            return true;
        }

        /// <summary>刀尖掃過路徑是否進入夾頭危險圓柱（含刀具靜止時侵入）。對應 entersChuck。</summary>
        public static bool EntersChuck(TipMm from, TipMm to, ChuckDanger d)
        {
            double dz = to.Z - from.Z, lo = 0, hi = 1;
            if (dz == 0) { if (from.Z < d.StartZMm || from.Z > d.EndZMm) return false; }
            else
            {
                double a = (d.StartZMm - from.Z) / dz, b = (d.EndZMm - from.Z) / dz;
                lo = Math.Max(0, Math.Min(a, b)); hi = Math.Min(1, Math.Max(a, b));
                if (lo > hi) return false;
            }
            double du = to.U - from.U, dv = to.V - from.V, square = du * du + dv * dv;
            double t = square == 0 ? lo : Math.Max(lo, Math.Min(hi, -(from.U * du + from.V * dv) / square));
            return Hypot(from.U + du * t, from.V + dv * t) <= d.RadiusMm;
        }
    }
}
