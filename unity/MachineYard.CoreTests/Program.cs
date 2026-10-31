using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using MachineYard.Core;

namespace MachineYard.CoreTests
{
    static class Program
    {
        static int failures, checks;
        static void Check(bool ok, string what) { checks++; if (!ok) { failures++; if (failures <= 25) Console.WriteLine("FAIL: " + what); } }
        static void Near(double a, double b, double tol, string what) => Check(Math.Abs(a - b) <= tol, $"{what}: C#={a:R} JS={b:R}");
        static TipMm Tip(JsonElement e) => new TipMm(e.GetProperty("zMm").GetDouble(), e.GetProperty("uMm").GetDouble(), e.GetProperty("vMm").GetDouble());
        static double[] Arr(JsonElement e) => e.EnumerateArray().Select(x => x.GetDouble()).ToArray();

        static int Main()
        {
            var golden = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "golden.json"))).RootElement;
            Cutting_(golden); Facing(golden); Chuck(golden); Spindle(golden); Axes(golden);
            Console.WriteLine($"{checks} checks, {failures} failures");
            return failures == 0 ? 0 : 1;
        }

        static void Cutting_(JsonElement g)
        {
            var s = RevolvedState.CreateHandle();
            var h = g.GetProperty("handle");
            Check(s.Count == h.GetProperty("profile").GetProperty("radiusMm").GetArrayLength(), "handle 格數");
            int n = 0, changedCount = 0;
            foreach (var c in g.GetProperty("cutting").EnumerateArray())
            {
                bool changed = CutOne(s, c);
                Check(changed == c.GetProperty("changed").GetBoolean(), $"cutting[{n}] changed");
                if (changed) changedCount++;
                var radii = c.GetProperty("radii");
                if (radii.ValueKind == JsonValueKind.Array)
                {
                    var exp = Arr(radii);
                    Check(exp.Length == s.Count, $"cutting[{n}] 格數");
                    for (int i = 0; i < Math.Min(exp.Length, s.Count); i++) Near(s.Radii[i], exp[i], 2e-9, $"cutting[{n}] radii[{i}]");
                }
                n++;
            }
            Check(changedCount > 20, "切削情境有實際改動工件");
            Console.WriteLine($"cutting: {n} 步（{changedCount} 步有改動）");
        }

        static bool CutOne(RevolvedState s, JsonElement c) =>
            Cutting.CutRevolvedProfile(s, Tip(c.GetProperty("from")), Tip(c.GetProperty("to")), c.GetProperty("rpm").GetDouble());

        static void Facing(JsonElement g)
        {
            var s = RevolvedState.CreateHandle();
            int n = 0;
            foreach (var c in g.GetProperty("facing").EnumerateArray())
            {
                bool changed = Cutting.CutFacing(s, Tip(c.GetProperty("from")), Tip(c.GetProperty("to")), 500);
                Check(changed == c.GetProperty("changed").GetBoolean(), $"facing[{n}] changed");
                Near(s.LengthMm, c.GetProperty("lengthMm").GetDouble(), 1e-9, $"facing[{n}] length");
                var radii = c.GetProperty("radii");
                if (radii.ValueKind == JsonValueKind.Array)
                {
                    var exp = Arr(radii);
                    Check(exp.Length == s.Count, $"facing[{n}] 格數 C#={s.Count} JS={exp.Length}");
                    for (int i = 0; i < Math.Min(exp.Length, s.Count); i++) Near(s.Radii[i], exp[i], 2e-9, $"facing[{n}] radii[{i}]");
                }
                n++;
            }
            Console.WriteLine($"facing: {n} 步");
        }

        static void Chuck(JsonElement g)
        {
            int n = 0;
            foreach (var c in g.GetProperty("chuck").EnumerateArray())
            {
                var d = c.GetProperty("danger");
                var danger = new ChuckDanger(d.GetProperty("startZMm").GetDouble(), d.GetProperty("endZMm").GetDouble(), d.GetProperty("radiusMm").GetDouble());
                Check(Cutting.EntersChuck(Tip(c.GetProperty("from")), Tip(c.GetProperty("to")), danger) == c.GetProperty("enters").GetBoolean(), $"chuck[{n}]");
                n++;
            }
            Console.WriteLine($"chuck: {n} 案");
        }

        static void Spindle(JsonElement g)
        {
            var cfg = g.GetProperty("config");
            var lever = cfg.GetProperty("lever");
            var sel = cfg.GetProperty("speedSelectors");
            var m = new SpindleModel
            {
                AccelerationRpmPerSecond = cfg.GetProperty("lesson").GetProperty("accelerationRpmPerSecond").GetDouble(),
                MaxRpm = cfg.GetProperty("maxRpm").GetDouble(),
                LeverRunAngle = lever.GetProperty("runAngle").GetDouble(),
                LeverDuration = lever.GetProperty("duration").GetDouble(),
                LeverBidirectional = lever.GetProperty("bidirectional").GetBoolean(),
                BaseRpm = Arr(sel.GetProperty("baseRpm")), Multipliers = Arr(sel.GetProperty("multipliers")),
                GearIndex = 1, ModeIndex = 0,
            };
            var sp = g.GetProperty("spindle");
            double dt = sp.GetProperty("dt").GetDouble();
            int i = 0;
            foreach (var st in sp.GetProperty("steps").EnumerateArray())
            {
                if (i == 220) { m.GearIndex = 3; m.ModeIndex = 1; } // generator：最後 80 步換成 gear 3 / mode 1
                m.Step(st.GetProperty("running").GetBoolean(), st.GetProperty("rpm").GetDouble(), dt, st.GetProperty("direction").GetInt32());
                Near(m.SignedRpm, st.GetProperty("signedRpm").GetDouble(), 1e-9, $"spindle[{i}] signedRpm");
                Near(m.Rpm, st.GetProperty("outRpm").GetDouble(), 1e-9, $"spindle[{i}] rpm");
                Near(m.SpindleAngle, st.GetProperty("spindleAngle").GetDouble(), 1e-9, $"spindle[{i}] angle");
                Near(m.LeverAngle, st.GetProperty("leverAngle").GetDouble(), 1e-12, $"spindle[{i}] lever");
                i++;
            }
            Near(m.SelectorRpm().Value, sp.GetProperty("selectorRpm").GetDouble(), 1e-9, "selectorRpm");
            Console.WriteLine($"spindle: {i} 步，最終 {m.Rpm:0} rpm");
        }

        static void Axes(JsonElement g)
        {
            var cfg = g.GetProperty("config");
            var am = new AxisModel { TeachingTurnsForFullTravel = cfg.GetProperty("lesson").GetProperty("teachingTurnsForFullTravel").GetDouble() };
            foreach (var a in cfg.GetProperty("axes").EnumerateArray())
            {
                var r = Arr(a.GetProperty("range"));
                am.AddAxis(new AxisDef { Id = a.GetProperty("id").GetString(), RangeLo = r[0], RangeHi = r[1], Enabled = a.GetProperty("enabled").GetBoolean() });
            }
            foreach (var w in cfg.GetProperty("wheels").EnumerateArray())
            {
                var ratio = w.GetProperty("ratio");
                am.AddWheel(new WheelDef { Id = w.GetProperty("id").GetString(), Drives = w.GetProperty("drives").GetString(), Ratio = ratio.ValueKind == JsonValueKind.Null ? (double?)null : ratio.GetDouble(), NeedsCalibration = w.GetProperty("needsCalibration").GetBoolean() });
            }
            var ax = g.GetProperty("axes");
            foreach (var p in ax.GetProperty("ratios").EnumerateObject()) Near(am.WheelRatio(p.Name).Value, p.Value.GetDouble(), 1e-12, "ratio " + p.Name);
            int i = 0, limits = 0;
            foreach (var st in ax.GetProperty("steps").EnumerateArray())
            {
                var res = am.TurnBy(st.GetProperty("key").GetString(), st.GetProperty("delta").GetDouble());
                var jr = st.GetProperty("result");
                if (jr.ValueKind == JsonValueKind.Null) Check(!res.Ok, $"axes[{i}] 應不能轉");
                else { Check(res.Ok, $"axes[{i}] 應能轉"); Check(res.AtLimit == jr.GetProperty("atLimit").GetBoolean(), $"axes[{i}] atLimit"); if (res.AtLimit) limits++; }
                foreach (var p in st.GetProperty("offsets").EnumerateObject()) Near(am.Offsets[p.Name], p.Value.GetDouble(), 1e-12, $"axes[{i}] offset {p.Name}");
                foreach (var p in st.GetProperty("angles").EnumerateObject()) Near(am.Angles[p.Name], p.Value.GetDouble(), 1e-9, $"axes[{i}] angle {p.Name}");
                i++;
            }
            Check(limits > 10, "情境有碰到行程上下限");
            Console.WriteLine($"axes: {i} 步（{limits} 次碰到行程限制）");
        }
    }
}
