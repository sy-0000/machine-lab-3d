using System;
using Newtonsoft.Json;

namespace MachineYard
{
    /// <summary>machine_&lt;id&gt;_runtime.json（匯出工具從網站的機台設定正規化後輸出）。座標與軸向量都是 three.js 節點局部座標。</summary>
    [Serializable] public class AxisCfg { public string id, node, label; public float[] axis, range; public float restOffset; public bool enabled = true; }
    [Serializable] public class WheelCfg { public string id, node, drives, label; public float[] axis, angleRange; public double? ratio; public double speed; public bool needsCalibration; }
    [Serializable] public class SpindleCfg { public string node; public float[] axis; }
    [Serializable] public class LeverCfg { public string node, label; public float[] axis; public double runAngle, duration; public bool bidirectional; }
    [Serializable] public class ActionCfg { public string id, node, type, label; public float[] axis; public double step; public double[] degrees; public int homeIndex; public double referenceDegrees; public bool bidirectional; }
    [Serializable] public class SpeedSelectorsCfg { public string gear, mode; public double[] baseRpm, multipliers; }
    [Serializable] public class LessonCfg { public double accelerationRpmPerSecond = 900, teachingTurnsForFullTravel = 10, defaultRpm = 500; }
    [Serializable] public class MountCfg { public string parent; public float[] position, rotation, scale; }
    [Serializable] public class MountsCfg { public MountCfg tool, workpiece; }
    [Serializable] public class AdditionCfg { public string name, kind, parent, drives, tool; public float[] position; public float topY; public float radius; }
    [Serializable] public class InsertCfg { public string node, parent; public float[] tip; }
    [Serializable] public class PlacementCfg { public float machineSlotRotationY; public float[] offset; public bool pedestal; }

    [Serializable]
    public class MachineRuntimeConfig
    {
        public string machineId;
        public LessonCfg lesson;
        public double maxRpm, defaultRpm;
        public AxisCfg[] axes;
        public WheelCfg[] wheels;
        public SpindleCfg spindle;
        public LeverCfg lever;
        public ActionCfg[] actions;
        public SpeedSelectorsCfg speedSelectors;
        public MountsCfg mounts;
        public AdditionCfg[] additions;
        public InsertCfg[] cuttingInserts;
        public PlacementCfg placement;

        public static MachineRuntimeConfig Parse(string json) => JsonConvert.DeserializeObject<MachineRuntimeConfig>(json);
    }
}
