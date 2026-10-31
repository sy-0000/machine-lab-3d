using System;
using System.Collections.Generic;

namespace MachineYard.Core
{
    /// <summary>存檔格式（3 個存檔欄位的 payload）。純資料；JSON 由 Runtime 的 WorkpieceSaves 序列化。載入時嚴格驗證，壞檔拋 FormatException。</summary>
    public sealed class ThreadDto { public string designation, state, sourceHole; public double tappedDepthMm; }
    public sealed class HoleDto { public string id; public double xMm, yMm, diameterMm, entryZMm, depthMm; public bool through; public ThreadDto thread; }
    public sealed class HeadDto
    {
        public int version = 1;
        public double lengthMm, widthMm, heightMm, resolutionMm;
        public double[] topMm;
        public List<HoleDto> features = new List<HoleDto>();
        public List<double[]> scribes = new List<double[]>();
        public int operationCount;
    }
    public sealed class LatheDto
    {
        public int version = 1;
        public double resolutionMm, stockRadiusMm, lengthMm, clampStartMm, clampEndMm;
        public double[] radii;
    }

    public static class WorkpieceDto
    {
        static bool Ok(double v) => !(double.IsNaN(v) || double.IsInfinity(v));

        public static HeadDto ToDto(HeadState s)
        {
            var d = new HeadDto { lengthMm = s.LengthMm, widthMm = s.WidthMm, heightMm = s.HeightMm, resolutionMm = s.ResolutionMm, topMm = (double[])s.TopMm.Clone(), operationCount = s.OperationCount };
            foreach (var h in s.Features)
                d.features.Add(new HoleDto
                {
                    id = h.Id, xMm = h.XMm, yMm = h.YMm, diameterMm = h.DiameterMm, entryZMm = h.EntryZMm, depthMm = h.DepthMm, through = h.Through,
                    thread = h.Thread == null ? null : new ThreadDto { designation = h.Thread.Designation, state = h.Thread.State, sourceHole = h.Thread.SourceHole, tappedDepthMm = h.Thread.TappedDepthMm },
                });
            foreach (var (x, y) in s.Scribes) d.scribes.Add(new[] { x, y });
            return d;
        }

        public static HeadState FromDto(HeadDto d)
        {
            if (d == null || d.version != 1) throw new FormatException("不支援的存檔版本");
            HeadState s;
            try { s = HeadState.Create(d.lengthMm, d.widthMm, d.heightMm, d.resolutionMm); } catch (ArgumentException e) { throw new FormatException(e.Message); }
            if (d.topMm == null || d.topMm.Length != s.TopMm.Length) throw new FormatException("高度場格數不符");
            for (int i = 0; i < d.topMm.Length; i++)
            {
                double h = d.topMm[i];
                if (!Ok(h) || h < 0 || h > s.HeightMm) throw new FormatException("高度場數值不合法");
                s.TopMm[i] = h;
            }
            foreach (var h in d.features ?? new List<HoleDto>())
            {
                if (h == null || string.IsNullOrEmpty(h.id) || !Ok(h.xMm) || !Ok(h.yMm) || !Ok(h.diameterMm) || !Ok(h.entryZMm) || !Ok(h.depthMm) || h.diameterMm <= 0 || h.depthMm <= 0 || h.depthMm > h.entryZMm)
                    throw new FormatException("孔資料不合法");
                ThreadInfo th = null;
                if (h.thread != null)
                {
                    if (!Ok(h.thread.tappedDepthMm) || h.thread.tappedDepthMm <= 0 || h.thread.tappedDepthMm > h.depthMm || h.thread.sourceHole != h.id) throw new FormatException("牙資料不合法");
                    th = new ThreadInfo { Designation = h.thread.designation, State = h.thread.state ?? "tapped", SourceHole = h.thread.sourceHole, TappedDepthMm = h.thread.tappedDepthMm };
                }
                s.Features.Add(new HoleFeature { Id = h.id, XMm = h.xMm, YMm = h.yMm, DiameterMm = h.diameterMm, EntryZMm = h.entryZMm, DepthMm = h.depthMm, Through = h.through, Thread = th });
            }
            foreach (var p in d.scribes ?? new List<double[]>()) { if (p == null || p.Length != 2 || !Ok(p[0]) || !Ok(p[1])) throw new FormatException("劃線資料不合法"); s.Scribes.Add((p[0], p[1])); }
            s.OperationCount = Math.Max(0, d.operationCount); s.Version = 1;
            return s;
        }

        public static LatheDto ToDto(RevolvedState s)
        {
            var radii = new double[s.Count]; Array.Copy(s.Radii, radii, s.Count);
            return new LatheDto { resolutionMm = s.ResolutionMm, stockRadiusMm = s.StockRadiusMm, lengthMm = s.LengthMm, clampStartMm = s.ClampStartMm, clampEndMm = s.ClampEndMm, radii = radii };
        }

        public static RevolvedState FromDto(LatheDto d)
        {
            if (d == null || d.version != 1) throw new FormatException("不支援的存檔版本");
            if (!(d.resolutionMm > 0 && d.stockRadiusMm > 0 && d.lengthMm > 0) || d.radii == null || d.radii.Length == 0 || d.radii.Length > (int)Math.Round(d.lengthMm / d.resolutionMm))
                throw new FormatException("車床工件資料不合法");
            foreach (var r in d.radii) if (!Ok(r) || r < 0 || r > d.stockRadiusMm + 1e-9) throw new FormatException("半徑數值不合法");
            var s = new RevolvedState { ResolutionMm = d.resolutionMm, StockRadiusMm = d.stockRadiusMm, LengthMm = d.lengthMm, ClampStartMm = d.clampStartMm, ClampEndMm = d.clampEndMm, Count = d.radii.Length, Radii = (double[])d.radii.Clone(), Version = 1 };
            return s;
        }
    }
}
