using System;

namespace MachineYard.Core
{
    /// <summary>主軸與啟動拉桿的運動模型（對應 src/machines/runtime.js 的 stepMachine 與 selectorRpm）。純數學，不含節點。</summary>
    public sealed class SpindleModel
    {
        public double AccelerationRpmPerSecond = 900, MaxRpm = 2000;
        // 啟動拉桿（lathe_parts.json：runAngle 0.6 rad、duration 0.3 s、可正反轉）
        public bool HasLever = true, LeverBidirectional = true;
        public double LeverRunAngle = 0.6, LeverDuration = 0.3;
        // 轉速段位（speedSelectors）：gear × mode
        public double[] BaseRpm = { 250, 500, 750, 1000 };
        public double[] Multipliers = { 1, 2 };
        public int GearIndex = 1, ModeIndex = 0;

        public double SignedRpm, Rpm, SpindleAngle, LeverAngle, BrakeTime;
        public int Direction = 1;
        public bool Running;

        /// <summary>段位決定的轉速（沒有段位表就回傳 null）。網站預設 gear 預設 home=1、mode home=0。</summary>
        public double? SelectorRpm() => BaseRpm == null ? (double?)null : BaseRpm[GearIndex] * Multipliers[ModeIndex];

        static double Sign(double v) => v > 0 ? 1 : v < 0 ? -1 : 0;

        public void Step(bool running, double requestedRpm, double dt, int direction = 1)
        {
            direction = direction == -1 ? -1 : 1;
            Direction = direction;
            if (BrakeTime > 0) BrakeTime = Math.Max(0, BrakeTime - dt);
            double delay = 0;
            if (HasLever)
            {
                double target0 = running ? LeverRunAngle * (LeverBidirectional ? direction : 1) : 0;
                double rate = Math.Abs(LeverRunAngle) / LeverDuration;
                double remaining = Math.Abs(target0 - LeverAngle);
                if (running) delay = Math.Min(dt, remaining / rate);
                LeverAngle += Sign(target0 - LeverAngle) * Math.Min(remaining, dt * rate);
            }
            double wanted = SelectorRpm() ?? requestedRpm;
            double target = running ? Math.Max(0, Math.Min(MaxRpm, wanted)) * direction : 0;
            double time = Math.Max(0, dt - delay), old = SignedRpm;
            SignedRpm = old + Sign(target - old) * Math.Min(Math.Abs(target - old), AccelerationRpmPerSecond * time);
            Rpm = Math.Abs(SignedRpm);
            double arrival = Math.Min(time, Math.Abs(target - old) / AccelerationRpmPerSecond);
            SpindleAngle += old * delay * Math.PI / 30;
            SpindleAngle += ((old + SignedRpm) * arrival / 2 + SignedRpm * (time - arrival)) * Math.PI / 30;
            Running = running;
        }

        /// <summary>腳踏緊急煞車：主軸立刻不再被驅動，煞車計時 0.35 s（emergencyStop）。</summary>
        public void EmergencyBrake() { Running = false; BrakeTime = 0.35; }
    }
}
