using System.Collections.Generic;
using MachineYard.Core;
using UnityEngine;

namespace MachineYard
{
    /// <summary>簡單材質工廠（URP Lit，找不到就退回 Standard）。</summary>
    public static class SimpleMat
    {
        public static Material Lit(Color c, float metallic = 0.8f, float smoothness = 0.6f)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var m = new Material(shader);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c); else m.color = c;
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metallic);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smoothness);
            return m;
        }
        public static Material Unlit(Color c)
        {
            var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Sprites/Default");
            var m = new Material(shader);
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c); else m.color = c;
            return m;
        }
    }

    /// <summary>槌頭加工用的刀具定義（對應 tool.config.js 的 head_* 五支；半徑、柄長、刃長單位公尺）。</summary>
    public sealed class HeadToolDef
    {
        public string Id, Name; public HeadToolType Type; public double Radius, ShankLength, CuttingLength; public string Designation; public double PilotDiameterMm;

        public HeadTool ToCore() => new HeadTool
        {
            Id = Id, Type = Type, DiameterMm = Radius * 2000, CuttingLengthMm = CuttingLength * 1000, Designation = Designation, PilotDiameterMm = PilotDiameterMm,
        };
        /// <summary>刀尖在刀具局部（three.js 座標，單位公尺）：[0, −(柄長 + 刃長), 0]。</summary>
        public float TipY => (float)-(ShankLength + CuttingLength);

        public static readonly HeadToolDef[] All =
        {
            new HeadToolDef { Id = "head_face_mill", Name = "面銑刀 Ø58（教學刀具）", Type = HeadToolType.Milling, Radius = 0.029, ShankLength = 0.035, CuttingLength = 0.032 },
            new HeadToolDef { Id = "head_end_mill", Name = "槌頭立銑刀 Ø8（教學刀具）", Type = HeadToolType.Milling, Radius = 0.004, ShankLength = 0.035, CuttingLength = 0.035 },
            new HeadToolDef { Id = "head_drill_85", Name = "Ø8.5 底孔鑽頭", Type = HeadToolType.Drilling, Radius = 0.00425, ShankLength = 0.025, CuttingLength = 0.049 },
            new HeadToolDef { Id = "head_drill_10", Name = "Ø10 鑽頭", Type = HeadToolType.Drilling, Radius = 0.005, ShankLength = 0.025, CuttingLength = 0.049 },
            new HeadToolDef { Id = "head_tap_m10", Name = "M10 絲攻（牙深待確認）", Type = HeadToolType.Tapping, Radius = 0.005, ShankLength = 0.025, CuttingLength = 0.049, Designation = "M10", PilotDiameterMm = 8.5 },
        };

        public static HeadToolDef ById(string id) { foreach (var d in All) if (d.Id == id) return d; return null; }

        /// <summary>某台機台可用的刀具（compatibleMachines）。</summary>
        public static List<HeadToolDef> For(string machineId)
        {
            var list = new List<HeadToolDef>();
            foreach (var d in All)
                if ((machineId == "milling" && d.Type == HeadToolType.Milling) || (machineId == "drill" && d.Type != HeadToolType.Milling)) list.Add(d);
            return list;
        }

        /// <summary>
        /// 程序化建刀具（沿用網站的 buildEndMill／buildFaceMill／buildTwistDrill／buildTap 的簡化版：圓柱組成）。
        /// 原點在主軸端面（刀柄頂），往 −Y 延伸；刀尖在 (0, TipY, 0)。
        /// </summary>
        public GameObject Build()
        {
            var root = new GameObject("Tool_" + Id);
            float r = (float)Radius, shank = (float)ShankLength, cut = (float)CuttingLength;
            var steel = SimpleMat.Lit(new Color(0.76f, 0.80f, 0.84f), 0.88f, 0.7f);
            var dark = SimpleMat.Lit(new Color(0.2f, 0.23f, 0.26f), 0.8f, 0.5f);
            if (Id == "head_face_mill")
            {
                Cyl(root.transform, "Arbor", 0.016f, 0, -0.024f, dark);
                Cyl(root.transform, "Flange", 0.025f, -0.024f, -0.034f, steel);
                Cyl(root.transform, "Body", r, -0.034f, TipY, steel);
                var gold = SimpleMat.Lit(new Color(0.87f, 0.72f, 0.22f), 0.85f, 0.6f);
                for (int i = 0; i < 4; i++)
                {
                    float a = i * Mathf.PI / 2f;
                    var ins = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    Object.DestroyImmediate(ins.GetComponent<Collider>());
                    ins.name = "Insert" + i; ins.transform.SetParent(root.transform, false);
                    ins.transform.localPosition = ThreeCoords.Position(0.0255f * Mathf.Cos(a), TipY + 0.002f, 0.0255f * Mathf.Sin(a));
                    ins.transform.localScale = new Vector3(0.0078f, 0.0078f, 0.0035f);
                    ins.GetComponent<MeshRenderer>().sharedMaterial = gold;
                }
            }
            else
            {
                Cyl(root.transform, "Shank", Type == HeadToolType.Milling ? r : r * 0.9f, 0, -shank, dark);
                Cyl(root.transform, "Flutes", r, -shank, TipY, Type == HeadToolType.Tapping ? SimpleMat.Lit(new Color(0.6f, 0.52f, 0.34f), 0.85f, 0.5f) : steel);
            }
            return root;
        }

        static void Cyl(Transform parent, string name, float radius, float topY, float bottomY, Material mat)
        {
            var c = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Object.DestroyImmediate(c.GetComponent<Collider>());
            c.name = name; c.transform.SetParent(parent, false);
            float len = Mathf.Abs(topY - bottomY);
            c.transform.localPosition = new Vector3(0, (topY + bottomY) / 2, 0);
            c.transform.localScale = new Vector3(radius * 2, len / 2, radius * 2); // Unity 圓柱高 2、直徑 1
            c.GetComponent<MeshRenderer>().sharedMaterial = mat;
        }
    }
}
