using System;
using System.Collections.Generic;

namespace MachineYard.Core
{
    public enum HeadToolType { Milling, Drilling, Tapping }

    /// <summary>槌頭工件用的刀具（對應 ToolLoader 的 axialCuttingEdge，單位 mm）。</summary>
    public sealed class HeadTool
    {
        public string Id; public HeadToolType Type;
        public double DiameterMm, CuttingLengthMm, PilotDiameterMm; public string Designation;
    }

    public struct HeadPoint
    {
        public double XMm, YMm, ZMm;
        public HeadPoint(double x, double y, double z) { XMm = x; YMm = y; ZMm = z; }
    }

    public sealed class ThreadInfo { public string Designation, State = "tapped", SourceHole; public double TappedDepthMm; }

    public sealed class HoleFeature
    {
        public string Id; public double XMm, YMm, DiameterMm, EntryZMm, DepthMm; public bool Through; public ThreadInfo Thread;
    }

    /// <summary>
    /// 槌頭毛胚（對應 HeadWorkpieceState.js）：座標 X 沿長度、Y 沿寬度、Z 自底面向上，單位 mm。
    /// 以取樣的上表面高度場表示，只支援平面／側銑與 2.5D 輪廓、垂直孔，不支援底切。
    /// </summary>
    public sealed class HeadState
    {
        public double LengthMm, WidthMm, HeightMm, ResolutionMm;
        public int Nx, Ny;
        public double[] TopMm;
        public readonly List<HoleFeature> Features = new List<HoleFeature>();
        public readonly List<(double xMm, double yMm)> Scribes = new List<(double, double)>();
        public int OperationCount;
        /// <summary>每次實際改動工件就加 1（顯示端用來判斷要不要重建網格）。</summary>
        public int Version;

        public static HeadState Create(double lengthMm, double widthMm, double heightMm, double resolutionMm = 0.5)
        {
            if (!(lengthMm > 0 && widthMm > 0 && heightMm > 0 && resolutionMm > 0)) throw new ArgumentException("毛胚長、寬、高必須為正");
            var s = new HeadState { LengthMm = lengthMm, WidthMm = widthMm, HeightMm = heightMm, ResolutionMm = resolutionMm };
            s.Nx = (int)Math.Ceiling(lengthMm / resolutionMm); s.Ny = (int)Math.Ceiling(widthMm / resolutionMm);
            if ((long)s.Nx * s.Ny > 50000) throw new ArgumentException("毛胚超出教學網格容量");
            s.TopMm = new double[s.Nx * s.Ny]; Array.Fill(s.TopMm, heightMm);
            return s;
        }

        /// <summary>教學方料 20 × 20 × 90 mm（BLOCK_STOCK）。</summary>
        public static HeadState CreateBlock() => Create(90, 20, 20);

        /// <summary>鑽床挑戰的方料：X=25 與 X=65 各一條劃線（DRILL_HOLES）。</summary>
        public static HeadState CreateDrillStock()
        {
            var s = CreateBlock(); s.Scribes.Add((25, 10)); s.Scribes.Add((65, 10)); return s;
        }

        public double SurfaceAt(double x, double y)
        {
            if (x < 0 || y < 0 || x >= LengthMm || y >= WidthMm) return 0;
            return TopMm[(int)Math.Floor(y / ResolutionMm) * Nx + (int)Math.Floor(x / ResolutionMm)];
        }

        public bool SupportedHole(double xMm, double yMm, double diameterMm)
        {
            for (int i = 0; i < 32; i++)
            {
                double a = i * Math.PI / 16;
                if (SurfaceAt(xMm + diameterMm / 2 * Math.Cos(a), yMm + diameterMm / 2 * Math.Sin(a)) <= 0) return false;
            }
            return true;
        }

        /// <summary>顯示用高度：孔底之內的格子被孔挖低（headGeometry 的做法）。</summary>
        public double[] DisplayTops()
        {
            var tops = (double[])TopMm.Clone(); double r = ResolutionMm;
            for (int i = 0; i < tops.Length; i++)
            {
                double x = (i % Nx + 0.5) * r, y = (i / Nx + 0.5) * r;
                foreach (var h in Features)
                    if (Math.Sqrt((x - h.XMm) * (x - h.XMm) + (y - h.YMm) * (y - h.YMm)) <= h.DiameterMm / 2)
                        tops[i] = Math.Min(tops[i], Math.Max(0, h.EntryZMm - h.DepthMm));
            }
            return tops;
        }

        /// <summary>刀尖正下方／旁邊最高的工件表面（surfaceUnder）：刀不在工件上回 0。</summary>
        public double SurfaceUnder(HeadPoint tip, double toolDiameterMm)
        {
            double res = ResolutionMm, reach = toolDiameterMm / 2 + 0.05, top = 0;
            for (int iy = Math.Max(0, (int)Math.Floor((tip.YMm - reach) / res)); iy <= Math.Min(Ny - 1, (int)Math.Floor((tip.YMm + reach) / res)); iy++)
                for (int ix = Math.Max(0, (int)Math.Floor((tip.XMm - reach) / res)); ix <= Math.Min(Nx - 1, (int)Math.Floor((tip.XMm + reach) / res)); ix++)
                    if (Hypot((ix + .5) * res - tip.XMm, (iy + .5) * res - tip.YMm) <= reach + res * .71) top = Math.Max(top, TopMm[iy * Nx + ix]);
            return top;
        }

        public bool Contact(HeadPoint tip, double toolDiameterMm) { double top = SurfaceUnder(tip, toolDiameterMm); return top > 0 && tip.ZMm <= top + 0.05; }

        /// <summary>上表面最高／最低與是否被切過（measureTop）。</summary>
        public (double max, double min, bool cut) MeasureTop()
        {
            double max = double.NegativeInfinity, min = double.PositiveInfinity;
            foreach (var v in TopMm) if (v > 0) { max = Math.Max(max, v); min = Math.Min(min, v); }
            return (max, min, min < HeightMm - 1e-6);
        }

        public static double Hypot(double a, double b) => Math.Sqrt(a * a + b * b);
    }

    /// <summary>
    /// 銑削與鑽孔／攻牙（對應 HeadCuttingSimulation.js cutHead）：刀路線段與每格圓盤的精確交點，
    /// 快速進給不會跳過中間的格子。就地修改工件並回傳是否有改動。
    /// </summary>
    public static class HeadCutting
    {
        const double Eps = 1e-7;

        public static bool Cut(HeadState state, HeadPoint from, HeadPoint to, HeadTool tool, bool running, double rpm, int direction = 1)
        {
            if (!running || !(rpm > 0) || tool == null) return false;
            if (!Finite(from) || !Finite(to) || double.IsNaN(tool.DiameterMm) || double.IsInfinity(tool.DiameterMm)) return false;
            return tool.Type == HeadToolType.Milling ? Mill(state, from, to, tool) : DrillOrTap(state, from, to, tool, direction);
        }

        static bool Finite(HeadPoint p) => !(double.IsNaN(p.XMm) || double.IsInfinity(p.XMm) || double.IsNaN(p.YMm) || double.IsInfinity(p.YMm) || double.IsNaN(p.ZMm) || double.IsInfinity(p.ZMm));

        static bool Mill(HeadState s, HeadPoint from, HeadPoint to, HeadTool tool)
        {
            int nx = s.Nx, ny = s.Ny; double r = s.ResolutionMm, radius = tool.DiameterMm / 2;
            double dx = to.XMm - from.XMm, dy = to.YMm - from.YMm, dz = to.ZMm - from.ZMm;
            bool changed = false;
            int iy0 = Math.Max(0, (int)Math.Floor((Math.Min(from.YMm, to.YMm) - radius) / r));
            int iy1 = Math.Min(ny, (int)Math.Ceiling((Math.Max(from.YMm, to.YMm) + radius) / r));
            int ix0 = Math.Max(0, (int)Math.Floor((Math.Min(from.XMm, to.XMm) - radius) / r));
            int ix1 = Math.Min(nx, (int)Math.Ceiling((Math.Max(from.XMm, to.XMm) + radius) / r));
            for (int iy = iy0; iy < iy1; iy++)
                for (int ix = ix0; ix < ix1; ix++)
                {
                    double cx = (ix * r + Math.Min((ix + 1) * r, s.LengthMm)) / 2, cy = (iy * r + Math.Min((iy + 1) * r, s.WidthMm)) / 2;
                    int i = iy * nx + ix;
                    double vx = from.XMm - cx, vy = from.YMm - cy, a = dx * dx + dy * dy, b = 2 * (vx * dx + vy * dy), c = vx * vx + vy * vy - radius * radius;
                    double enter = 0, exit = 1;
                    if (a < 1e-20) { if (c > 0) continue; }
                    else
                    {
                        double disc = b * b - 4 * a * c; if (disc < 0) continue;
                        enter = Math.Max(0, (-b - Math.Sqrt(disc)) / (2 * a)); exit = Math.Min(1, (-b + Math.Sqrt(disc)) / (2 * a));
                        if (enter > exit) continue;
                    }
                    double z = Math.Max(0, from.ZMm + dz * (dz < 0 ? exit : enter));
                    double old = s.TopMm[i];
                    foreach (var hole in s.Features)
                        if (HeadState.Hypot(cx - hole.XMm, cy - hole.YMm) <= hole.DiameterMm / 2) old = Math.Min(old, hole.EntryZMm - hole.DepthMm);
                    if (z < old - Eps && old - z <= tool.CuttingLengthMm) { s.TopMm[i] = z; changed = true; }
                }
            if (!changed) return false;
            // 後續銑削不能留下過深的舊孔入口／牙
            foreach (var hole in s.Features)
            {
                double rim = 0;
                for (int j = 0; j < 32; j++)
                {
                    double ang = j * Math.PI / 16, rr = hole.DiameterMm / 2 + r / 2;
                    rim = Math.Max(rim, s.SurfaceAt(hole.XMm + rr * Math.Cos(ang), hole.YMm + rr * Math.Sin(ang)));
                }
                double bottom = hole.EntryZMm - hole.DepthMm, newEntry = Math.Min(hole.EntryZMm, rim), removed = hole.EntryZMm - newEntry;
                hole.EntryZMm = newEntry; hole.DepthMm = Math.Max(0, newEntry - bottom); hole.Through = bottom == 0;
                if (hole.Thread != null)
                {
                    hole.Thread.TappedDepthMm = Math.Max(0, hole.Thread.TappedDepthMm - removed);
                    if (hole.Thread.TappedDepthMm <= Eps) hole.Thread = null;
                    else if (!s.SupportedHole(hole.XMm, hole.YMm, hole.DiameterMm)) hole.Thread.State = "interrupted";
                }
            }
            s.Features.RemoveAll(h => !(h.DepthMm > Eps));
            s.OperationCount++; s.Version++;
            return true;
        }

        static bool DrillOrTap(HeadState s, HeadPoint from, HeadPoint to, HeadTool tool, int direction)
        {
            // 鑽孔／攻牙只接受軸向往下進給；橫向拖曳不會產生孔
            if (to.ZMm >= from.ZMm - Eps || HeadState.Hypot(to.XMm - from.XMm, to.YMm - from.YMm) > Eps) return false;
            HoleFeature existing = null;
            foreach (var h in s.Features) if (HeadState.Hypot(h.XMm - to.XMm, h.YMm - to.YMm) < 0.01) { existing = h; break; }
            double entry = existing != null ? existing.EntryZMm : s.SurfaceAt(to.XMm, to.YMm);
            double depth = Math.Min(Math.Min(entry, entry - to.ZMm), tool.CuttingLengthMm);
            if (entry <= 0 || depth <= Eps) return false;
            foreach (var h in s.Features)
                if (h != existing && HeadState.Hypot(h.XMm - to.XMm, h.YMm - to.YMm) < (h.DiameterMm + tool.DiameterMm) / 2) return false;
            if (!s.SupportedHole(to.XMm, to.YMm, tool.Type == HeadToolType.Tapping ? tool.PilotDiameterMm : tool.DiameterMm)) return false;
            if (tool.Type == HeadToolType.Tapping)
            {
                if (direction != 1 || existing == null || Math.Abs(existing.DiameterMm - tool.PilotDiameterMm) > Eps || from.ZMm < existing.EntryZMm - existing.DepthMm - Eps) return false;
                double tapped = Math.Min(existing.DepthMm, depth);
                if (tapped <= (existing.Thread?.TappedDepthMm ?? 0) + Eps) return false;
                existing.Thread = new ThreadInfo { Designation = tool.Designation, State = "tapped", TappedDepthMm = tapped, SourceHole = existing.Id };
                s.OperationCount++; s.Version++; return true;
            }
            if (tool.Type != HeadToolType.Drilling || direction != 1) return false;
            // 不能瞬間穿進實心料；主軸還在加速時就推進去的連續進給從刀尖現在的位置接著鑽
            if (existing == null && from.ZMm < entry - Eps && from.ZMm - to.ZMm > 1) return false;
            if (existing != null && existing.DiameterMm != tool.DiameterMm) return false;
            if (depth <= (existing?.DepthMm ?? 0) + Eps) return false;
            var hole = existing ?? new HoleFeature { Id = "hole-" + (s.OperationCount + 1), XMm = to.XMm, YMm = to.YMm, DiameterMm = tool.DiameterMm, EntryZMm = entry, DepthMm = 0 };
            hole.DepthMm = depth; hole.Through = depth >= entry - Eps;
            if (existing == null) s.Features.Add(hole);
            s.OperationCount++; s.Version++; return true;
        }
    }
}
