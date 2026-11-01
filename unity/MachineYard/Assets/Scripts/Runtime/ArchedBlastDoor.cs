using System.Collections.Generic;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 拱形防爆鋼門（決策 D41，使用者選的方案 1）：取代玄關的圓形金庫門，也當工作室出口拱門的內側面，兩邊同一種門。
    /// 程序化網格（建在 three.js 局部座標再換成 Unity）：拱形門扇（下方長方形＋上方半圓，厚 12 cm）、中央黃銅手輪、
    /// 沿自由邊與拱頂的門栓（收回方向朝門扇內）、加強橫條與鉚釘、可選的拱形門框，以及門洞後的黑色面（開門後看到的是「黑暗的通道」，
    /// 和網站金庫門後的黑色隧道同樣作用）。鉸鏈在 three 局部 −X 邊；門的正面朝 three 局部 +Z。
    /// 動畫由 VaultDoorController（玄關）與 WorkshopExitDoor（工作室）負責：手輪轉 → 門栓收回 → 門往外轉開。
    /// </summary>
    public class ArchedBlastDoor : MonoBehaviour
    {
        public Transform hinge, leaf, wheel;
        public List<Transform> bolts = new List<Transform>();
        public Vector3[] boltDirs;     // 每支門栓「收回」方向（門扇局部 Unity 座標，單位向量）
        public const float BoltTravel = 0.18f;   // 門栓收回距離（插進門框 6–17 cm，收回後完全回到門扇內）

        public struct Spec
        {
            public float halfWidth, spring, depthFront;   // 門洞半寬、拱腳高度（半圓圓心高度）、門扇正面的 z
            public float frameWidth; public bool frame;    // 門框寬度（0 或 frame=false 不建門框）
            public float wheelY, wheelRadius;
            public float bottom;                           // 門扇底緣離地高度（工作室有門檻，要抬高）
        }

        static Material steel, dark, brass, black;
        static void Mats()
        {
            if (steel != null) return;
            steel = SimpleMat.Lit(new Color(0.30f, 0.29f, 0.27f), 0.8f, 0.45f);
            dark = SimpleMat.Lit(new Color(0.16f, 0.15f, 0.14f), 0.75f, 0.4f);
            brass = SimpleMat.Lit(new Color(0.72f, 0.55f, 0.30f), 0.9f, 0.65f);
            black = SimpleMat.Unlit(Color.black);
        }

        // 拱形輪廓（three 局部 x,y）：左下 → 左邊往上 → 半圓 → 右邊往下 → 右下，共 n 段圓弧
        static List<Vector2> Outline(float hw, float spring, float bottom, int n = 24)
        {
            var p = new List<Vector2> { new Vector2(-hw, bottom), new Vector2(-hw, spring) };
            for (int i = 1; i < n; i++) { float a = Mathf.PI - Mathf.PI * i / n; p.Add(new Vector2(hw * Mathf.Cos(a), spring + hw * Mathf.Sin(a))); }
            p.Add(new Vector2(hw, spring)); p.Add(new Vector2(hw, bottom));
            return p;
        }

        class MeshBuilder
        {
            readonly List<Vector3> v = new List<Vector3>(); readonly List<int> t = new List<int>();
            // three 座標的三角形，依 wantNormal（three 座標）調整繞向；Unity 正面＝cross(b−a, c−a) 指向觀看者
            public void Tri(Vector3 a, Vector3 b, Vector3 c, Vector3 wantNormal)
            {
                Vector3 A = U(a), B = U(b), C = U(c), N = U(wantNormal);
                if (Vector3.Dot(Vector3.Cross(B - A, C - A), N) < 0) { var x = B; B = C; C = x; }
                int i = v.Count; v.Add(A); v.Add(B); v.Add(C); t.Add(i); t.Add(i + 1); t.Add(i + 2);
            }
            public void Quad(Vector3 a, Vector3 b, Vector3 c, Vector3 d, Vector3 n) { Tri(a, b, c, n); Tri(a, c, d, n); }
            static Vector3 U(Vector3 p) => ThreeCoords.Position(p.x, p.y, p.z);
            public Mesh Build(string name)
            {
                var m = new Mesh { name = name }; m.SetVertices(v); m.SetTriangles(t, 0); m.RecalculateNormals(); m.RecalculateBounds(); return m;
            }
        }

        // 把凸的拱形輪廓擠出成厚板（正面 z1、背面 z0）
        static Mesh Slab(List<Vector2> o, float z0, float z1, string name)
        {
            var mb = new MeshBuilder(); var c = Vector2.zero; foreach (var p in o) c += p; c /= o.Count;
            for (int i = 0; i < o.Count; i++)
            {
                var a = o[i]; var b = o[(i + 1) % o.Count];
                mb.Tri(new Vector3(c.x, c.y, z1), new Vector3(a.x, a.y, z1), new Vector3(b.x, b.y, z1), Vector3.forward);
                mb.Tri(new Vector3(c.x, c.y, z0), new Vector3(a.x, a.y, z0), new Vector3(b.x, b.y, z0), Vector3.back);
                var e = new Vector2(b.y - a.y, a.x - b.x).normalized; var out3 = new Vector3(e.x, e.y, 0);
                if (Vector2.Dot(e, (a + b) / 2 - c) < 0) out3 = -out3;
                mb.Quad(new Vector3(a.x, a.y, z0), new Vector3(b.x, b.y, z0), new Vector3(b.x, b.y, z1), new Vector3(a.x, a.y, z1), out3);
            }
            return mb.Build(name);
        }

        // 門框：外輪廓與內輪廓之間的 U 形環（兩條輪廓點數相同）
        static Mesh Ring(List<Vector2> outer, List<Vector2> inner, float z0, float z1, string name)
        {
            var mb = new MeshBuilder();
            for (int i = 0; i < outer.Count - 1; i++)
            {
                Vector2 a = outer[i], b = outer[i + 1], c = inner[i + 1], d = inner[i];
                mb.Quad(new Vector3(a.x, a.y, z1), new Vector3(b.x, b.y, z1), new Vector3(c.x, c.y, z1), new Vector3(d.x, d.y, z1), Vector3.forward);
                var eo = new Vector3(b.y - a.y, a.x - b.x, 0).normalized; if (Vector3.Dot(eo, new Vector3(a.x, a.y - 1, 0)) < 0) eo = -eo;
                mb.Quad(new Vector3(a.x, a.y, z0), new Vector3(b.x, b.y, z0), new Vector3(b.x, b.y, z1), new Vector3(a.x, a.y, z1), eo);
                mb.Quad(new Vector3(d.x, d.y, z0), new Vector3(c.x, c.y, z0), new Vector3(c.x, c.y, z1), new Vector3(d.x, d.y, z1), -eo);
            }
            return mb.Build(name);
        }

        // 圓環（在 three 局部 XY 平面、繞 Z 軸），用來做手輪輪圈
        static Mesh Torus(float R, float r, int seg, int side)
        {
            var mb = new MeshBuilder();
            Vector3 P(int i, int j) { float a = i * Mathf.PI * 2 / seg, b = j * Mathf.PI * 2 / side; float c = R + r * Mathf.Cos(b); return new Vector3(c * Mathf.Cos(a), c * Mathf.Sin(a), r * Mathf.Sin(b)); }
            Vector3 N(int i, int j) { float a = i * Mathf.PI * 2 / seg, b = j * Mathf.PI * 2 / side; return new Vector3(Mathf.Cos(b) * Mathf.Cos(a), Mathf.Cos(b) * Mathf.Sin(a), Mathf.Sin(b)); }
            for (int i = 0; i < seg; i++) for (int j = 0; j < side; j++)
                mb.Quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), N(i, j) + N(i + 1, j + 1));
            return mb.Build("WheelRim");
        }

        static GameObject Part(Transform parent, string name, Mesh mesh, Material mat)
        {
            var go = new GameObject(name); go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh; go.AddComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }

        static Transform Prim(Transform parent, PrimitiveType type, string name, Vector3 threePos, Vector3 scale, Quaternion rot, Material mat)
        {
            var go = GameObject.CreatePrimitive(type); Object.DestroyImmediate(go.GetComponent<Collider>());
            go.name = name; go.transform.SetParent(parent, false);
            go.transform.localPosition = ThreeCoords.Position(threePos.x, threePos.y, threePos.z); go.transform.localRotation = rot; go.transform.localScale = scale;
            go.GetComponent<MeshRenderer>().sharedMaterial = mat;
            return go.transform;
        }

        /// <summary>在 parent（three 局部座標系：門洞底部中央、正面朝 +Z）建一扇門。</summary>
        public static ArchedBlastDoor Build(Transform parent, Spec s)
        {
            Mats();
            var root = new GameObject("ArchedBlastDoor"); root.transform.SetParent(parent, false);
            var d = root.AddComponent<ArchedBlastDoor>();
            float hw = s.halfWidth, sp = s.spring, zf = s.depthFront, thick = 0.12f;
            // 門洞後的黑面（門關著時被門扇擋住）
            Part(root.transform, "DoorwayVoid", Slab(Outline(hw, sp, 0.0f), zf - thick - 0.03f, zf - thick - 0.02f, "DoorwayVoid"), black);
            if (s.frame && s.frameWidth > 0)
                Part(root.transform, "ArchFrame", Ring(Outline(hw + s.frameWidth, sp, 0f), Outline(hw, sp, 0f), zf - thick - 0.05f, zf + 0.04f, "ArchFrame"), dark);
            // 鉸鏈樞軸在門扇左緣（three −X），門扇在樞軸之下
            d.hinge = new GameObject("BlastHinge").transform; d.hinge.SetParent(root.transform, false);
            d.hinge.localPosition = ThreeCoords.Position(-hw, 0, zf - thick / 2);
            d.leaf = new GameObject("BlastLeaf").transform; d.leaf.SetParent(d.hinge, false);
            d.leaf.localPosition = ThreeCoords.Position(hw, 0, -(zf - thick / 2));   // 讓門扇局部座標＝門的 three 局部座標
            float g = 0.012f;
            Part(d.leaf, "LeafPlate", Slab(Outline(hw - g, sp, Mathf.Max(g, s.bottom)), zf - thick, zf, "LeafPlate"), steel);
            // 加強橫條（正面凸出 2 cm）與鉚釘
            foreach (float y in new[] { 0.35f, sp * 0.62f, sp + hw * 0.55f })
            {
                float half = y <= sp ? hw - 0.08f : Mathf.Sqrt(Mathf.Max(0.01f, (hw - 0.08f) * (hw - 0.08f) - (y - sp) * (y - sp)));
                Prim(d.leaf, PrimitiveType.Cube, "Band", new Vector3(0, y, zf + 0.01f), new Vector3(half * 2, 0.09f, 0.02f), Quaternion.identity, dark);
                for (int k = -3; k <= 3; k++) Prim(d.leaf, PrimitiveType.Cylinder, "Rivet", new Vector3(k * half / 3.4f, y, zf + 0.025f), new Vector3(0.03f, 0.008f, 0.03f), Quaternion.Euler(90, 0, 0), brass);
            }
            // 中央手輪（輪圈＝扁圓柱環的近似：12 段短圓柱；三支輻條；輪轂）
            d.wheel = new GameObject("BlastWheel").transform; d.wheel.SetParent(d.leaf, false);
            d.wheel.localPosition = ThreeCoords.Position(0, s.wheelY, zf + 0.09f);
            float r = s.wheelRadius;
            Part(d.wheel, "Rim", Torus(r, 0.0225f, 48, 10), brass);
            for (int i = 0; i < 3; i++)
            {
                float a = i * Mathf.PI / 3;
                var sp3 = Prim(d.wheel, PrimitiveType.Cylinder, "Spoke", Vector3.zero, new Vector3(0.03f, r, 0.03f), Quaternion.identity, brass);
                sp3.localRotation = Quaternion.FromToRotation(Vector3.up, ThreeCoords.Direction(Mathf.Cos(a), Mathf.Sin(a), 0));
            }
            Prim(d.wheel, PrimitiveType.Cylinder, "Hub", Vector3.zero, new Vector3(0.12f, 0.04f, 0.12f), Quaternion.Euler(90, 0, 0), dark);
            Prim(d.leaf, PrimitiveType.Cylinder, "WheelShaft", new Vector3(0, s.wheelY, zf + 0.045f), new Vector3(0.06f, 0.045f, 0.06f), Quaternion.Euler(90, 0, 0), dark);
            // 門栓：右緣三支（收回方向 −X）、拱頂四支（收回方向朝圓心）；從門扇邊緣插進門框 10 cm
            var dirs = new List<Vector3>();
            void Bolt(Vector2 edge, Vector2 inward)
            {
                var pos = edge - inward * 0.06f;
                var b = Prim(d.leaf, PrimitiveType.Cylinder, "Bolt", new Vector3(pos.x, pos.y, zf - thick / 2), new Vector3(0.07f, 0.11f, 0.07f), Quaternion.identity, brass);
                b.localRotation = Quaternion.FromToRotation(Vector3.up, ThreeCoords.Direction(inward.x, inward.y, 0));
                d.bolts.Add(b); dirs.Add(ThreeCoords.Direction(inward.x, inward.y, 0).normalized);
            }
            foreach (float y in new[] { 0.45f, sp * 0.5f + 0.2f, sp - 0.15f }) Bolt(new Vector2(hw - g, y), new Vector2(-1, 0));
            foreach (float deg in new[] { 20f, 55f, 90f, 125f })
            {
                float a = deg * Mathf.Deg2Rad; var n = new Vector2(Mathf.Cos(a), Mathf.Sin(a));
                Bolt(new Vector2(0, sp) + n * (hw - g), -n);
            }
            d.boltDirs = dirs.ToArray();
            // 鉸鏈筒（三個）
            foreach (float y in new[] { 0.5f, sp * 0.55f + 0.3f, sp + 0.2f })
                Prim(root.transform, PrimitiveType.Cylinder, "HingeBarrel", new Vector3(-hw - 0.02f, y, zf - thick / 2), new Vector3(0.09f, 0.12f, 0.09f), Quaternion.identity, dark);
            return d;
        }
    }
}
