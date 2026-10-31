using System;

namespace MachineYard.Core
{
    /// <summary>
    /// 機台的程序化聲音（對應 src/audio/MachineSounds.js 與 xrAudio.js 的 warn）：馬達嗡嗡聲跟著主軸轉速、
    /// 切削時的帶通雜訊（銑床／鑽床依刀刃通過率調幅）、手輪移動時的喀聲、警告兩短聲。
    /// 純 C#、不依賴 Unity：由 Unity 的串流 AudioClip 回呼呼叫 <see cref="Render"/>（音訊執行緒），
    /// 主執行緒用 <see cref="SetState"/>／<see cref="OnCut"/>／<see cref="OnAxisMoved"/>／<see cref="Warn"/> 餵狀態。
    /// 參數都是網站版的值（馬達 .05+.1·share、嗡聲 100 Hz 鋸齒 + 160–680 Hz 三角波過 900 Hz 低通、
    /// 切削帶通 3600/2200/1300 Hz，喀聲帶通 Q=6 衰減 30 ms）。
    /// </summary>
    public sealed class MachineSynth
    {
        public struct CutProfile { public double Freq, Q; public int Teeth; public double Level; }
        public static CutProfile ProfileOf(string kind) =>
            kind == "milling" ? new CutProfile { Freq = 2200, Q = 1.1, Teeth = 4, Level = .3 } :
            kind == "drill" ? new CutProfile { Freq = 1300, Q = 1.6, Teeth = 2, Level = .26 } :
            new CutProfile { Freq = 3600, Q = 1.4, Teeth = 0, Level = .22 };
        public static double MaxRpmOf(string kind) => kind == "drill" ? 3000 : 2000;

        readonly double sr; readonly string kind; readonly CutProfile cut; readonly double maxRpm;
        // 主執行緒寫、音訊執行緒讀（double 的讀寫在 64 位元平台上不會撕裂；偶爾晚一個緩衝沒關係）
        volatile float targetRpm, mutedGain = 1f; volatile int cutEvents, clickEvents, warnEvents;
        // 音訊執行緒狀態
        double humPhase, whinePhase, whineFreq = 180, motorGain, motorLp, lfoPhase, lfoFreq = 30;
        double bpX1, bpX2, bpY1, bpY2, b0, b1, b2, a1, a2, cutFreq;
        double cutGain, cutTarget, cutHold; int lastCut, lastClick, lastWarn;
        uint rng = 2463534242u;
        readonly double[] clickT = new double[4]; readonly double[] clickF = new double[4]; readonly double[] clickX1 = new double[4], clickX2 = new double[4], clickY1 = new double[4], clickY2 = new double[4];
        double warnT = -1;
        // 喀聲節流（主執行緒）
        double travel, lastClickTime = -10;
        public const double ClickMm = .25, ClickGap = .035, SlowClick = .12;

        public MachineSynth(string kind, double sampleRate)
        {
            this.kind = kind; sr = sampleRate; cut = ProfileOf(kind); maxRpm = MaxRpmOf(kind);
            cutFreq = cut.Freq; SetBandpass(cutFreq, cut.Q);
            for (int i = 0; i < clickT.Length; i++) clickT[i] = -1;
        }

        public void SetMuted(bool muted) { mutedGain = muted ? 0f : 1f; }
        public void SetState(double rpm) { targetRpm = (float)rpm; }
        public void OnCut() { Interlocked_Inc(ref cutEvents); }
        public void Warn() { Interlocked_Inc(ref warnEvents); }
        static void Interlocked_Inc(ref int v) { System.Threading.Interlocked.Increment(ref v); }

        /// <summary>
        /// 軸移動 movedMm 公釐（所有軸加總）。滿 0.25 mm 或距上次喀聲 ≥ 0.12 s 就喀一聲，最快每 0.035 s 一聲（MachineSounds.update）。
        /// </summary>
        public void OnAxisMoved(double movedMm, double nowSeconds)
        {
            if (!(movedMm > 1e-6)) return;
            travel += movedMm;
            double gap = nowSeconds - lastClickTime;
            if (gap >= ClickGap && (travel >= ClickMm || gap >= SlowClick)) { Interlocked_Inc(ref clickEvents); lastClickTime = nowSeconds; travel = 0; }
        }

        void SetBandpass(double f, double q)
        {
            // RBJ 帶通（constant 0 dB peak gain）
            double w = 2 * Math.PI * f / sr, alpha = Math.Sin(w) / (2 * q), a0 = 1 + alpha;
            b0 = alpha / a0; b1 = 0; b2 = -alpha / a0; a1 = -2 * Math.Cos(w) / a0; a2 = (1 - alpha) / a0;
        }

        double Noise() { rng ^= rng << 13; rng ^= rng >> 17; rng ^= rng << 5; return (rng / (double)uint.MaxValue) * 2 - 1; }

        static double Smooth(double current, double target, double tau, double dt) => current + (target - current) * (1 - Math.Exp(-dt / tau));

        /// <summary>填滿單聲道（或多聲道，各聲道相同）的緩衝，回傳最大絕對值（測試用）。</summary>
        public float Render(float[] data, int channels)
        {
            double dt = 1.0 / sr, rpm = targetRpm, share = Math.Min(1, rpm / maxRpm);
            // 事件
            int ce = cutEvents, ck = clickEvents, we = warnEvents;
            if (ce != lastCut && rpm > 0)
            {
                cutTarget = cut.Level * (.6 + .4 * share); cutHold = .15;
                cutFreq = cut.Freq * (.85 + (Noise() * .5 + .5) * .3); SetBandpass(cutFreq, cut.Q);
            }
            lastCut = ce;
            for (; lastClick != ck; lastClick++) StartClick();
            if (we != lastWarn) { warnT = 0; lastWarn = we; }
            double motorTarget = rpm > 0 ? .05 + .1 * share : 0, whineTarget = 160 + 520 * share, lfoTarget = cut.Teeth > 0 ? Math.Max(4, rpm / 60 * cut.Teeth) : 30;
            double lp = 1 - Math.Exp(-2 * Math.PI * 900 * dt), peak = 0, master = .8 * mutedGain;
            int frames = data.Length / channels;
            for (int n = 0; n < frames; n++)
            {
                motorGain = Smooth(motorGain, motorTarget, .08, dt); whineFreq = Smooth(whineFreq, whineTarget, .08, dt); lfoFreq = Smooth(lfoFreq, lfoTarget, .05, dt);
                humPhase += 100 * dt; humPhase -= Math.Floor(humPhase);
                whinePhase += whineFreq * dt; whinePhase -= Math.Floor(whinePhase);
                double saw = humPhase * 2 - 1, tri = 4 * Math.Abs(whinePhase - .5) - 1;
                motorLp += lp * ((saw * .35 + tri * .5) - motorLp);
                double s = motorLp * motorGain;
                // 切削：帶通雜訊 × 刀刃通過調幅 × 包絡
                double x = Noise(), y = b0 * x + b1 * bpX1 + b2 * bpX2 - a1 * bpY1 - a2 * bpY2;
                bpX2 = bpX1; bpX1 = x; bpY2 = bpY1; bpY1 = y;
                lfoPhase += lfoFreq * dt; lfoPhase -= Math.Floor(lfoPhase);
                double teeth = cut.Teeth > 0 ? 1 + .7 * (lfoPhase < .5 ? 1 : -1) : 1;
                if (cutHold > 0) cutHold -= dt; else cutTarget = 0;
                cutGain = Smooth(cutGain, cutTarget, cutTarget > cutGain ? .02 : .08, dt);
                s += y * teeth * cutGain;
                // 喀聲
                for (int c = 0; c < clickT.Length; c++)
                {
                    if (clickT[c] < 0) continue;
                    double env = .35 * Math.Pow(.001 / .35, clickT[c] / .03);
                    double cx = Noise(), cy = ClickBp(c, cx);
                    s += cy * env;
                    clickT[c] += dt; if (clickT[c] > .04) clickT[c] = -1;
                }
                // 警告：880 Hz 方波兩短聲（0、0.18 s 起，各 0.12 s）
                if (warnT >= 0)
                {
                    double w = 0;
                    foreach (double t0 in new[] { 0.0, .18 })
                    {
                        double t = warnT - t0; if (t < 0 || t > .12) continue;
                        double env = t < .01 ? .12 * (t / .01) : .12 * Math.Pow(.0001 / .12, (t - .01) / .11);
                        w += (Math.Sin(2 * Math.PI * 880 * warnT) >= 0 ? 1 : -1) * env;
                    }
                    s += w; warnT += dt; if (warnT > .32) warnT = -1;
                }
                float o = (float)(s * master);
                for (int ch = 0; ch < channels; ch++) data[n * channels + ch] = o;
                peak = Math.Max(peak, Math.Abs(o));
            }
            return (float)peak;
        }

        void StartClick()
        {
            int slot = 0; for (int i = 0; i < clickT.Length; i++) { if (clickT[i] < 0) { slot = i; break; } if (clickT[i] > clickT[slot]) slot = i; }
            clickT[slot] = 0; clickF[slot] = kind == "drill" ? 1800 : 2600; clickX1[slot] = clickX2[slot] = clickY1[slot] = clickY2[slot] = 0;
        }
        double ClickBp(int c, double x)
        {
            double w = 2 * Math.PI * clickF[c] / sr, alpha = Math.Sin(w) / (2 * 6), a0 = 1 + alpha;
            double cb0 = alpha / a0, cb2 = -alpha / a0, ca1 = -2 * Math.Cos(w) / a0, ca2 = (1 - alpha) / a0;
            double y = cb0 * x + cb2 * clickX2[c] - ca1 * clickY1[c] - ca2 * clickY2[c];
            clickX2[c] = clickX1[c]; clickX1[c] = x; clickY2[c] = clickY1[c]; clickY1[c] = y;
            return y;
        }
    }
}
