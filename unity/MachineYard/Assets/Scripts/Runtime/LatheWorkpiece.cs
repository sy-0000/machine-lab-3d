using System.Collections.Generic;
using MachineYard.Core;
using UnityEngine;
using UnityEngine.Rendering;

namespace MachineYard
{
    /// <summary>
    /// 可切削的旋轉體工件的顯示（對應 RevolvedWorkpiece.js 的 profileGeometry）：依 Core 的 RevolvedState 半徑剖面
    /// 產生旋轉網格（96 段；每個剖面線段各自獨立一條帶，邊緣才銳利），工件被切削時重建網格。
    /// 幾何先用 three.js 的局部座標算（Z 沿主軸＝局部 +X），再用 ThreeCoords 換成 Unity（含翻轉三角形順序）。
    /// 掛在 WorkpieceMount（夾頭的子節點，隨主軸旋轉）。
    /// </summary>
    public class LatheWorkpiece : MonoBehaviour
    {
        public RevolvedState State { get; private set; }
        MeshFilter filter; MeshRenderer rend; Mesh mesh; int shownVersion = -1;
        const int Segments = 96;

        public static LatheWorkpiece Create(Transform mount)
        {
            var go = new GameObject("RevolvedProfile");
            go.transform.SetParent(mount, false);
            var w = go.AddComponent<LatheWorkpiece>();
            w.State = RevolvedState.CreateHandle();
            w.filter = go.AddComponent<MeshFilter>();
            w.rend = go.AddComponent<MeshRenderer>();
            var shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
            var mat = new Material(shader);
            var c = new Color(0.58f, 0.64f, 0.72f);
            if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", c); else mat.color = c;
            if (mat.HasProperty("_Metallic")) mat.SetFloat("_Metallic", 0.85f);
            if (mat.HasProperty("_Smoothness")) mat.SetFloat("_Smoothness", 0.65f);
            w.rend.sharedMaterial = mat;
            w.mesh = new Mesh { name = "RevolvedProfile", indexFormat = IndexFormat.UInt32 };
            w.mesh.MarkDynamic();
            w.filter.sharedMesh = w.mesh;
            w.Rebuild();
            return w;
        }

        public void Mount(RevolvedState state) { State = state; shownVersion = -1; }
        public void ResetToStock() { State = RevolvedState.CreateHandle(); shownVersion = -1; }

        void LateUpdate() { if (State != null && State.Version != shownVersion) Rebuild(); }

        // 剖面點（半徑, Z），相同半徑的連續格子合併成一段（profilePoints）
        List<Vector2> Points()
        {
            var pts = new List<Vector2> { new Vector2(0, 0) };
            var r = State.Radii; int n = State.Count; double res = State.ResolutionMm;
            for (int i = 0; i < n; i++)
            {
                if (i == 0 || r[i] != r[i - 1]) pts.Add(new Vector2((float)r[i], (float)(i * res)));
                if (i == n - 1 || r[i] != r[i + 1]) pts.Add(new Vector2((float)r[i], (float)Mathf.Min((float)((i + 1) * res), (float)State.LengthMm)));
            }
            pts.Add(new Vector2(0, (float)State.LengthMm));
            return pts;
        }

        // three 局部：(r·sinθ, z, r·cosθ) 再繞 Z 轉 −90° → (z, −r·sinθ, r·cosθ)（Z 沿局部 +X），最後公釐轉公尺
        static Vector3 ToThreeLocal(float r, float z, float theta) => new Vector3(z, -r * Mathf.Sin(theta), r * Mathf.Cos(theta)) * 0.001f;

        public void Rebuild()
        {
            shownVersion = State.Version;
            var pts = Points();
            var verts = new List<Vector3>(); var norms = new List<Vector3>(); var uvs = new List<Vector2>(); var tris = new List<int>();
            for (int s = 0; s < pts.Count - 1; s++)
            {
                Vector2 a = pts[s], b = pts[s + 1];
                float dr = b.x - a.x, dz = b.y - a.y, len = Mathf.Sqrt(dr * dr + dz * dz);
                if (len == 0) continue;
                float nr = dz / len, nz = -dr / len;
                int baseIndex = verts.Count;
                for (int j = 0; j <= Segments; j++)
                {
                    float theta = j / (float)Segments * Mathf.PI * 2f, sin = Mathf.Sin(theta), cos = Mathf.Cos(theta);
                    foreach (var (p, t) in new[] { (a, 0f), (b, 1f) })
                    {
                        var v3 = ToThreeLocal(p.x, p.y, theta);
                        // 法線：(nr·sinθ, nz, nr·cosθ) 經同一個旋轉 → (nz, −nr·sinθ, nr·cosθ)
                        var n3 = new Vector3(nz, -nr * sin, nr * cos);
                        verts.Add(ThreeCoords.Position(v3.x, v3.y, v3.z)); norms.Add(ThreeCoords.Direction(n3.x, n3.y, n3.z)); uvs.Add(new Vector2(j / (float)Segments, t));
                    }
                }
                for (int j = 0; j < Segments; j++)
                {
                    int i0 = baseIndex + j * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
                    // three：(i0,i2,i1)(i1,i2,i3)；鏡像後繞向相反，所以交換成 (i0,i1,i2)(i1,i3,i2)
                    tris.Add(i0); tris.Add(i1); tris.Add(i2); tris.Add(i1); tris.Add(i3); tris.Add(i2);
                }
            }
            mesh.Clear();
            mesh.indexFormat = IndexFormat.UInt32;
            mesh.SetVertices(verts); mesh.SetNormals(norms); mesh.SetUVs(0, uvs); mesh.SetTriangles(tris, 0);
            mesh.RecalculateBounds();
        }
    }
}
