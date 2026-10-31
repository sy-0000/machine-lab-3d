using System;
using System.Collections.Generic;

namespace MachineYard.Core
{
    public sealed class AxisDef
    {
        public string Id; public double RangeLo, RangeHi; public bool Enabled = true;
    }

    public sealed class WheelDef
    {
        public string Id, Drives;
        public double? Ratio;                       // 每弧度的行程（公尺）；null 表示用教學比例
        public double? AngleLo, AngleHi;            // 有值＝進給手柄（鑽床）
        public bool NeedsCalibration;
        public double? SpringReturnSpeed;           // 有值＝放手後以此速度（弧度／秒）回彈到 0（鑽床進給手柄）
    }

    public struct TurnResult
    {
        public bool Ok, AtLimit; public string AxisId; public double Offset, Angle;
    }

    /// <summary>
    /// 軸行程與手輪（對應 runtime.js 的 setAxis、wheelRatio、turnControlBy）：角度 → 行程 → 行程上下限。
    /// 單位：公尺與弧度（與網站相同）。
    /// </summary>
    public sealed class AxisModel
    {
        public readonly Dictionary<string, AxisDef> Axes = new Dictionary<string, AxisDef>();
        public readonly Dictionary<string, WheelDef> Wheels = new Dictionary<string, WheelDef>();
        public readonly Dictionary<string, double> Offsets = new Dictionary<string, double>();
        public readonly Dictionary<string, double> Angles = new Dictionary<string, double>();
        /// <summary>教學比例：行程全程需要轉幾圈（lessonDefaults.json teachingTurnsForFullTravel = 10）。</summary>
        public double TeachingTurnsForFullTravel = 10;
        public bool Teaching;

        public void AddAxis(AxisDef a) { Axes[a.Id] = a; Offsets[a.Id] = 0; }
        public void AddWheel(WheelDef w) { Wheels[w.Id] = w; Angles[w.Id] = 0; }

        static double Clamp(double x, double lo, double hi) { if (double.IsNaN(x) || double.IsInfinity(x)) x = 0; return Math.Max(lo, Math.Min(hi, x)); }

        public double? WheelRatio(string key)
        {
            if (!Wheels.TryGetValue(key, out var w) || !Axes.TryGetValue(w.Drives, out var a)) return null;
            return RatioOf(w, a);
        }

        double RatioOf(WheelDef w, AxisDef a)
        {
            if (w.Ratio.HasValue) return w.Ratio.Value;
            if (w.AngleLo.HasValue) return Math.Abs(a.RangeLo / w.AngleLo.Value);
            return (a.RangeHi - a.RangeLo) / (TeachingTurnsForFullTravel * 2 * Math.PI);
        }

        /// <summary>設定軸位置（夾在行程內），回傳實際值。</summary>
        public double SetAxis(string key, double value)
        {
            if (!Axes.TryGetValue(key, out var a) || !a.Enabled) return Offsets.TryGetValue(key, out var cur) ? cur : 0;
            double next = Clamp(value, a.RangeLo, a.RangeHi);
            Offsets[key] = next;
            return next;
        }

        /// <summary>手輪轉 deltaAngle 弧度。回傳 Ok=false 表示手輪不能轉；AtLimit 表示被行程上下限擋住。</summary>
        public TurnResult TurnBy(string key, double deltaAngle)
        {
            var none = new TurnResult { Ok = false };
            if (!Wheels.TryGetValue(key, out var w) || (w.NeedsCalibration && !Teaching)) return none;
            if (!Axes.TryGetValue(w.Drives, out var a) || !a.Enabled) return none;
            double ratio = RatioOf(w, a);
            double requested = Angles[key] + deltaAngle, next = requested;
            if (w.AngleLo.HasValue)
            {
                next = Clamp(next, w.AngleLo.Value, w.AngleHi.Value);
                SetAxis(a.Id, next * ratio);
            }
            else
            {
                double desired = Offsets[a.Id] + (next - Angles[key]) * ratio;
                double actual = Clamp(desired, a.RangeLo, a.RangeHi);
                next = Angles[key] + (actual - Offsets[a.Id]) / ratio;
                SetAxis(a.Id, actual);
            }
            Angles[key] = next;
            return new TurnResult { Ok = true, AtLimit = Math.Abs(next - requested) > 1e-9, AxisId = a.Id, Offset = Offsets[a.Id], Angle = next };
        }

        /// <summary>
        /// 彈簧回位（對應 runtime.js stepReturn）：沒被握住、角度不為 0 的彈簧手柄每格向 0 回彈。heldKey 是目前被握住的手輪。
        /// 回傳是否仍在回彈中。
        /// </summary>
        public bool StepReturn(string heldKey, double dt)
        {
            bool returning = false;
            foreach (var w in Wheels.Values)
            {
                if (!w.SpringReturnSpeed.HasValue || w.Id == heldKey || Angles[w.Id] == 0 || !Axes.TryGetValue(w.Drives, out var a)) continue;
                double current = Angles[w.Id], next = current - Math.Sign(current) * Math.Min(Math.Abs(current), w.SpringReturnSpeed.Value * dt);
                Angles[w.Id] = next; SetAxis(a.Id, next * RatioOf(w, a));
                returning |= next != 0;
            }
            return returning;
        }

        /// <summary>直接設定軸位置，同步帶動驅動它的手輪角度（setAxisAndWheel）。</summary>
        public void SetAxisAndWheel(string key, double value)
        {
            SetAxis(key, value);
            foreach (var w in Wheels.Values)
            {
                if (w.Drives != key || (w.NeedsCalibration && !Teaching)) continue;
                Angles[w.Id] = Offsets[key] / RatioOf(w, Axes[key]);
            }
        }
    }
}
