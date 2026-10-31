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
            Cutting_(golden); Facing(golden); Chuck(golden); Spindle(golden); Axes(golden); Head(golden); SpringReturn(golden); Synth(); Dto();
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

        static HeadPoint Pt(JsonElement e) => new HeadPoint(e.GetProperty("xMm").GetDouble(), e.GetProperty("yMm").GetDouble(), e.GetProperty("zMm").GetDouble());

        static void CompareHead(HeadState s, JsonElement snap, string tag)
        {
            var tops = Arr(snap.GetProperty("tops"));
            Check(tops.Length == s.TopMm.Length, tag + " 格數");
            for (int i = 0; i < Math.Min(tops.Length, s.TopMm.Length); i++) Near(s.TopMm[i], tops[i], 1e-9, $"{tag} top[{i}]");
            var fs = snap.GetProperty("features").EnumerateArray().ToArray();
            Check(fs.Length == s.Features.Count, $"{tag} 孔數 C#={s.Features.Count} JS={fs.Length}");
            for (int k = 0; k < Math.Min(fs.Length, s.Features.Count); k++)
            {
                var j = fs[k]; var h = s.Features[k];
                Check(h.Id == j.GetProperty("id").GetString(), $"{tag} hole[{k}] id {h.Id}");
                Near(h.XMm, j.GetProperty("xMm").GetDouble(), 1e-9, $"{tag} hole[{k}] x"); Near(h.YMm, j.GetProperty("yMm").GetDouble(), 1e-9, $"{tag} hole[{k}] y");
                Near(h.DiameterMm, j.GetProperty("diameterMm").GetDouble(), 1e-9, $"{tag} hole[{k}] d");
                Near(h.EntryZMm, j.GetProperty("entryZMm").GetDouble(), 1e-9, $"{tag} hole[{k}] entry"); Near(h.DepthMm, j.GetProperty("depthMm").GetDouble(), 1e-9, $"{tag} hole[{k}] depth");
                Check(h.Through == j.GetProperty("through").GetBoolean(), $"{tag} hole[{k}] through");
                var th = j.GetProperty("thread");
                if (th.ValueKind == JsonValueKind.Null) Check(h.Thread == null, $"{tag} hole[{k}] 不應有牙");
                else
                {
                    Check(h.Thread != null, $"{tag} hole[{k}] 應有牙");
                    if (h.Thread != null) { Near(h.Thread.TappedDepthMm, th.GetProperty("tappedDepthMm").GetDouble(), 1e-9, $"{tag} hole[{k}] 牙深"); Check(h.Thread.State == th.GetProperty("state").GetString(), $"{tag} hole[{k}] 牙狀態"); }
                }
            }
            Check(s.OperationCount == snap.GetProperty("ops").GetInt32(), $"{tag} 操作數 C#={s.OperationCount} JS={snap.GetProperty("ops").GetInt32()}");
        }

        static void Head(JsonElement g)
        {
            var head = g.GetProperty("head");
            var tools = head.GetProperty("tools").EnumerateArray().ToDictionary(t => t.GetProperty("id").GetString(), t => new HeadTool
            {
                Id = t.GetProperty("id").GetString(), DiameterMm = t.GetProperty("diameterMm").GetDouble(), CuttingLengthMm = t.GetProperty("cuttingLengthMm").GetDouble(),
                Type = t.GetProperty("type").GetString() == "milling" ? HeadToolType.Milling : t.GetProperty("type").GetString() == "drilling" ? HeadToolType.Drilling : HeadToolType.Tapping,
                Designation = t.TryGetProperty("designation", out var des) && des.ValueKind == JsonValueKind.String ? des.GetString() : null,
                PilotDiameterMm = t.TryGetProperty("pilotDiameterMm", out var pil) && pil.ValueKind == JsonValueKind.Number ? pil.GetDouble() : 0,
            });
            int total = 0, changedTotal = 0;
            foreach (var sc in head.GetProperty("scenarios").EnumerateArray())
            {
                string name = sc.GetProperty("name").GetString();
                var s = name == "drill" || name == "mix" ? HeadState.CreateDrillStock() : HeadState.CreateBlock();
                int n = 0;
                foreach (var st in sc.GetProperty("steps").EnumerateArray())
                {
                    bool running = !st.TryGetProperty("running", out var rn) || rn.GetBoolean();
                    double rpm = st.TryGetProperty("rpm", out var rp) ? rp.GetDouble() : 500;
                    int dir = st.TryGetProperty("direction", out var dr) ? dr.GetInt32() : 1;
                    bool changed = HeadCutting.Cut(s, Pt(st.GetProperty("from")), Pt(st.GetProperty("to")), tools[st.GetProperty("tool").GetString()], running, rpm, dir);
                    Check(changed == st.GetProperty("changed").GetBoolean(), $"head/{name}[{n}] changed C#={changed}");
                    if (changed) { changedTotal++; CompareHead(s, st.GetProperty("state"), $"head/{name}[{n}]"); }
                    n++; total++;
                }
                CompareHead(s, sc.GetProperty("final"), $"head/{name} 最終");
                var mt = s.MeasureTop(); var jm = sc.GetProperty("measureTop");
                Near(mt.max, jm.GetProperty("max").GetDouble(), 1e-9, $"head/{name} top max"); Near(mt.min, jm.GetProperty("min").GetDouble(), 1e-9, $"head/{name} top min");
                Check(mt.cut == jm.GetProperty("cut").GetBoolean(), $"head/{name} cut");
            }
            Check(changedTotal > 100, "槌頭情境有足夠的實際切削");
            var block = HeadState.CreateBlock();
            foreach (var p in head.GetProperty("probes").EnumerateArray())
            {
                var tip = new HeadPoint(p.GetProperty("x").GetDouble(), p.GetProperty("y").GetDouble(), p.GetProperty("z").GetDouble());
                Near(block.SurfaceUnder(tip, p.GetProperty("d").GetDouble()), p.GetProperty("top").GetDouble(), 1e-9, $"surfaceUnder {tip.XMm},{tip.YMm}");
            }
            foreach (var p in head.GetProperty("surfaceAt").EnumerateArray()) Near(block.SurfaceAt(p.GetProperty("x").GetDouble(), p.GetProperty("y").GetDouble()), p.GetProperty("v").GetDouble(), 1e-12, "surfaceAt");
            Console.WriteLine($"head: {total} 步（{changedTotal} 步有改動），含面銑／立銑／鑽孔／攻牙／孔邊再銑");
        }

        static void SpringReturn(JsonElement g)
        {
            var sd = g.GetProperty("springDrill");
            var am = new AxisModel { TeachingTurnsForFullTravel = sd.GetProperty("lesson").GetProperty("teachingTurnsForFullTravel").GetDouble() };
            foreach (var a in sd.GetProperty("axes").EnumerateArray()) { var r = Arr(a.GetProperty("range")); am.AddAxis(new AxisDef { Id = a.GetProperty("id").GetString(), RangeLo = r[0], RangeHi = r[1], Enabled = a.GetProperty("enabled").GetBoolean() }); }
            var w = sd.GetProperty("wheel"); var ar = Arr(w.GetProperty("angleRange"));
            am.AddWheel(new WheelDef { Id = w.GetProperty("id").GetString(), Drives = w.GetProperty("drives").GetString(), Ratio = w.GetProperty("ratio").GetDouble(), AngleLo = ar[0], AngleHi = ar[1], SpringReturnSpeed = w.GetProperty("springReturn").GetProperty("speed").GetDouble() });
            int i = 0, returns = 0;
            foreach (var st in sd.GetProperty("steps").EnumerateArray())
            {
                if (st.GetProperty("op").GetString() == "turn")
                {
                    var res = am.TurnBy(w.GetProperty("id").GetString(), st.GetProperty("delta").GetDouble());
                    var jr = st.GetProperty("result");
                    if (jr.ValueKind != JsonValueKind.Null) Check(res.Ok && res.AtLimit == jr.GetProperty("atLimit").GetBoolean(), $"spring[{i}] atLimit");
                }
                else
                {
                    var held = st.GetProperty("held"); double dt = st.GetProperty("dt").GetDouble();
                    bool ret = am.StepReturn(held.ValueKind == JsonValueKind.String ? held.GetString() : null, dt);
                    Check(ret == st.GetProperty("returning").GetBoolean(), $"spring[{i}] returning"); if (ret) returns++;
                }
                foreach (var p in st.GetProperty("offsets").EnumerateObject()) Near(am.Offsets[p.Name], p.Value.GetDouble(), 1e-12, $"spring[{i}] offset {p.Name}");
                foreach (var p in st.GetProperty("angles").EnumerateObject()) Near(am.Angles[p.Name], p.Value.GetDouble(), 1e-12, $"spring[{i}] angle {p.Name}");
                i++;
            }
            Check(returns > 30, "彈簧回位情境有實際回彈");
            Console.WriteLine($"springReturn: {i} 步（{returns} 步回彈中）");
        }

        static void Synth()
        {
            const double sr = 48000;
            var buf = new float[4800];
            // 停機：靜音
            var s = new MachineSynth("lathe", sr); s.SetState(0);
            float quiet = 0; for (int i = 0; i < 10; i++) quiet = Math.Max(quiet, s.Render(buf, 1));
            Check(quiet < 1e-6f, $"synth 停機應靜音 ({quiet})");
            // 轉動：有聲音、有上限、不是 NaN
            s.SetState(1500); float peak = 0; bool nan = false;
            for (int i = 0; i < 40; i++) { peak = Math.Max(peak, s.Render(buf, 1)); foreach (var v in buf) nan |= float.IsNaN(v) || float.IsInfinity(v); }
            Check(peak > 0.01f && peak < 1f, $"synth 轉動音量 {peak}"); Check(!nan, "synth 無 NaN");
            // 嗡聲主頻 100 Hz：過零率約 200/s ±（含高頻泛音，所以只檢查有明顯週期成分：自相關在 480 取樣點有峰）
            s = new MachineSynth("lathe", sr); s.SetState(1000); for (int i = 0; i < 30; i++) s.Render(buf, 1);
            var big = new float[48000]; s.Render(big, 1);
            double Auto(int lag) { double a = 0; for (int i = 0; i + lag < big.Length; i++) a += big[i] * big[i + lag]; return a; }
            Check(Auto(480) > Auto(240), "synth 100 Hz 週期性（自相關）");
            // 切削：事件讓聲音變大，之後衰減
            s = new MachineSynth("milling", sr); s.SetState(800); for (int i = 0; i < 30; i++) s.Render(buf, 1);
            float idle = s.Render(buf, 1); s.OnCut(); float during = s.Render(buf, 1);
            for (int i = 0; i < 60; i++) s.Render(buf, 1);
            float after = s.Render(buf, 1);
            Check(during > idle * 1.5f, $"synth 切削音量上升 idle={idle} during={during}"); Check(after < during * 0.6f, $"synth 切削音量衰減 after={after}");
            // 喀聲節流：0.001 mm 的微動 0.01 s 內只喀一次
            s = new MachineSynth("lathe", sr); s.SetState(0); s.Render(buf, 1);
            s.OnAxisMoved(0.001, 1.000); s.OnAxisMoved(0.001, 1.010); s.OnAxisMoved(0.3, 1.020); float c1 = s.Render(buf, 1);
            Check(c1 > 0.001f, "synth 喀聲有聲音");
            // 警告
            s = new MachineSynth("lathe", sr); s.SetState(0); s.Render(buf, 1); s.Warn(); float w = s.Render(buf, 1);
            Check(w > 0.05f, $"synth 警告音量 {w}");
            // 靜音
            s.SetMuted(true); s.Warn(); Check(s.Render(buf, 1) < 1e-9f, "synth 靜音");
            Console.WriteLine("synth: 停機靜音、轉速音、切削包絡、喀聲節流、警告音、靜音");
        }

        static void Dto()
        {
            // 槌頭：用黃金情境的最終狀態（有孔、有牙、有劃線）來回序列化
            var g = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "golden.json"))).RootElement;
            var tools = new System.Collections.Generic.Dictionary<string, HeadTool>
            {
                ["a"] = new HeadTool { Id = "a", Type = HeadToolType.Drilling, DiameterMm = 8.5, CuttingLengthMm = 49 },
                ["t"] = new HeadTool { Id = "t", Type = HeadToolType.Tapping, DiameterMm = 10, CuttingLengthMm = 49, Designation = "M10", PilotDiameterMm = 8.5 },
                ["m"] = new HeadTool { Id = "m", Type = HeadToolType.Milling, DiameterMm = 8, CuttingLengthMm = 35 },
            };
            var s = HeadState.CreateDrillStock();
            for (int i = 0; i <= 10; i++) HeadCutting.Cut(s, new HeadPoint(25, 10, i == 0 ? 25 : 25 - (i - 1) * 1.5), new HeadPoint(25, 10, 25 - i * 1.5), tools["a"], true, 500);
            for (int i = 0; i <= 8; i++) HeadCutting.Cut(s, new HeadPoint(25, 10, i == 0 ? 25 : 25 - (i - 1) * 1.5), new HeadPoint(25, 10, 25 - i * 1.5), tools["t"], true, 300);
            for (int x = 40; x < 80; x += 2) HeadCutting.Cut(s, new HeadPoint(x, 10, 17), new HeadPoint(x + 2, 10, 17), tools["m"], true, 800);
            Check(s.Features.Count == 1 && s.Features[0].Thread != null, "DTO 測試前置：應有一個帶牙的孔");
            var opt = new JsonSerializerOptions { IncludeFields = true };
            var json = JsonSerializer.Serialize(WorkpieceDto.ToDto(s), opt);
            var back = WorkpieceDto.FromDto(JsonSerializer.Deserialize<HeadDto>(json, opt));
            Check(back.TopMm.SequenceEqual(s.TopMm), "DTO 高度場來回一致");
            Check(back.Features.Count == 1 && back.Features[0].DepthMm == s.Features[0].DepthMm && back.Features[0].Thread.TappedDepthMm == s.Features[0].Thread.TappedDepthMm, "DTO 孔與牙來回一致");
            Check(back.Scribes.Count == 2 && back.OperationCount == s.OperationCount, "DTO 劃線與操作數");
            // 載入後繼續切削與原本完全一致
            HeadCutting.Cut(s, new HeadPoint(80, 10, 16), new HeadPoint(80, 10, 15), tools["m"], true, 800); HeadCutting.Cut(back, new HeadPoint(80, 10, 16), new HeadPoint(80, 10, 15), tools["m"], true, 800);
            Check(back.TopMm.SequenceEqual(s.TopMm), "DTO 載入後繼續切削與原狀態一致");
            // 壞檔必須被拒絕
            void Bad(Action<HeadDto> mutate, string what)
            {
                var d = JsonSerializer.Deserialize<HeadDto>(json, opt); mutate(d);
                bool threw = false; try { WorkpieceDto.FromDto(d); } catch (FormatException) { threw = true; }
                Check(threw, "DTO 應拒絕壞檔：" + what);
            }
            Bad(d => d.version = 2, "版本"); Bad(d => d.topMm = d.topMm.Take(10).ToArray(), "格數"); Bad(d => d.topMm[5] = -1, "負高度"); Bad(d => d.topMm[5] = 999, "超高");
            Bad(d => d.topMm[5] = double.NaN, "NaN"); Bad(d => d.features[0].depthMm = 99, "孔深超過入口"); Bad(d => d.features[0].thread.tappedDepthMm = 99, "牙深超過孔深");
            Bad(d => d.features[0].thread.sourceHole = "x", "牙來源"); Bad(d => d.lengthMm = -1, "尺寸");
            // 車床
            var l = RevolvedState.CreateHandle();
            Cutting.CutRevolvedProfile(l, new TipMm(100, 0, 15), new TipMm(100, 0, 8), 500); for (double z = 100; z <= 250; z += 3.7) Cutting.CutRevolvedProfile(l, new TipMm(z - 3.7, 0, 8), new TipMm(z, 0, 8), 500);
            var lj = JsonSerializer.Serialize(WorkpieceDto.ToDto(l), opt);
            var lb = WorkpieceDto.FromDto(JsonSerializer.Deserialize<LatheDto>(lj, opt));
            Check(lb.Count == l.Count && lb.Radii.Take(l.Count).SequenceEqual(l.Radii.Take(l.Count)), "DTO 車床來回一致");
            var ld = JsonSerializer.Deserialize<LatheDto>(lj, opt); ld.radii[3] = 99; bool lthrew = false; try { WorkpieceDto.FromDto(ld); } catch (FormatException) { lthrew = true; }
            Check(lthrew, "DTO 車床應拒絕過大半徑");
            Console.WriteLine("dto: 槌頭與車床存檔來回一致、載入後續切削一致、9 種壞檔被拒絕");
        }
    }
}
