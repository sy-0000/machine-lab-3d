using System.Collections.Generic;
using MachineYard.Core;
using UnityEngine;
using UnityEngine.Rendering;

namespace MachineYard
{
    /// <summary>
    /// 槌頭毛胚的顯示（對應 PrismaticWorkpiece.js 的 headGeometry）：由高度場產生網格——上表面、底面、以及相鄰格較低處的側壁。
    /// 為了省三角形，同一列中高度相同的連續格子合併成一個長方形（面銑後的平面只剩幾十個四邊形）。
    /// 局部座標（three.js）：原點在毛胚底面中心，X 沿長度、Y 向上、Z 沿寬度，公釐轉公尺。
    /// 工件被切削（State.Version 改變）時，在 LateUpdate 重建一次。
    /// </summary>
    public class HeadWorkpieceView : MonoBehaviour
    {
        public HeadState State { get; private set; }
        Mesh mesh; int shown = -1; MeshFilter filter; MeshRenderer rend;
        readonly List<Vector3> verts = new List<Vector3>(); readonly List<int> tris = new List<int>();
        public Transform scribeRoot;

        public static HeadWorkpieceView Create(Transform parent, HeadState state)
        {
            var go = new GameObject("HeadWorkpiece");
            go.transform.SetParent(parent, false);
            var v = go.AddComponent<HeadWorkpieceView>();
            v.filter = go.AddComponent<MeshFilter>(); v.rend = go.AddComponent<MeshRenderer>();
            v.rend.sharedMaterial = SimpleMat.Lit(new Color(0.64f, 0.71f, 0.76f), 0.8f, 0.55f);
            v.mesh = new Mesh { name = "HeadWorkpiece", indexFormat = IndexFormat.UInt32 };
            v.mesh.MarkDynamic(); v.filter.sharedMesh = v.mesh;
            v.scribeRoot = new GameObject("ScribeMarks").transform; v.scribeRoot.SetParent(go.transform, false);
            v.SetState(state);
            return v;
        }

        public void SetState(HeadState s) { State = s; shown = -1; RebuildScribes(); }
        void LateUpdate() { if (State != null && State.Version != shown) Rebuild(); }

        // 毛胚座標（mm）→ Unity 局部座標（公尺）
        Vector3 P(double x, double y, double z) =>
            ThreeCoords.Position((float)((x - State.LengthMm / 2) * 0.001), (float)(z * 0.001), (float)((y - State.WidthMm / 2) * 0.001));

        // three 的 (a,b,c,d) 逆時針四邊形；鏡像後繞向相反，所以輸出時交換成 a,c,b / a,d,c
        void Quad(Vector3 a, Vector3 b, Vector3 c, Vector3 d)
        {
            int i = verts.Count; verts.Add(a); verts.Add(b); verts.Add(c); verts.Add(d);
            tris.Add(i); tris.Add(i + 2); tris.Add(i + 1); tris.Add(i); tris.Add(i + 3); tris.Add(i + 2);
        }

        public void Rebuild()
        {
            shown = State.Version;
            verts.Clear(); tris.Clear();
            int nx = State.Nx, ny = State.Ny; double r = State.ResolutionMm, L = State.LengthMm, W = State.WidthMm;
            var tops = State.DisplayTops();
            double X(int ix) => System.Math.Min(ix * r, L);
            double Y(int iy) => System.Math.Min(iy * r, W);
            for (int iy = 0; iy < ny; iy++)
            {
                double y = iy * r, y1 = Y(iy + 1);
                // 上表面與底面：同高度的連續格子合併
                for (int ix = 0; ix < nx;)
                {
                    double h = tops[iy * nx + ix];
                    if (h <= 0) { ix++; continue; }
                    int run = ix;
                    while (run + 1 < nx && tops[iy * nx + run + 1] == h) run++;
                    double x0 = X(ix), x1 = X(run + 1);
                    Quad(P(x0, y, h), P(x0, y1, h), P(x1, y1, h), P(x1, y, h));
                    ix = run + 1;
                }
                for (int ix = 0; ix < nx;)
                {
                    if (tops[iy * nx + ix] <= 0) { ix++; continue; }
                    int run = ix;
                    while (run + 1 < nx && tops[iy * nx + run + 1] > 0) run++;
                    double x0 = X(ix), x1 = X(run + 1);
                    Quad(P(x0, y, 0), P(x1, y, 0), P(x1, y1, 0), P(x0, y1, 0));
                    ix = run + 1;
                }
                for (int ix = 0; ix < nx; ix++)
                {
                    int i = iy * nx + ix; double h = tops[i]; if (h <= 0) continue;
                    double x = X(ix), x1 = X(ix + 1);
                    double left = ix > 0 ? tops[i - 1] : 0, right = ix + 1 < nx ? tops[i + 1] : 0, front = iy > 0 ? tops[i - nx] : 0, back = iy + 1 < ny ? tops[i + nx] : 0;
                    if (left < h) Quad(P(x, y, left), P(x, y1, left), P(x, y1, h), P(x, y, h));
                    if (right < h) Quad(P(x1, y1, right), P(x1, y, right), P(x1, y, h), P(x1, y1, h));
                    if (front < h) Quad(P(x1, y, front), P(x, y, front), P(x, y, h), P(x1, y, h));
                    if (back < h) Quad(P(x, y1, back), P(x1, y1, back), P(x1, y1, h), P(x, y1, h));
                }
            }
            mesh.Clear(); mesh.indexFormat = IndexFormat.UInt32;
            mesh.SetVertices(verts); mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals(); mesh.RecalculateBounds();
        }

        // 劃線：深色細條貼在上表面（鑽床挑戰的 X=25、X=65）。不隨切削更新，只在重設工件時重建
        void RebuildScribes()
        {
            if (scribeRoot == null) return;
            for (int i = scribeRoot.childCount - 1; i >= 0; i--) Object.Destroy(scribeRoot.GetChild(i).gameObject);
            foreach (var (x, y) in State.Scribes)
            {
                float z = (float)State.HeightMm + 0.03f;
                AddStrip(P(x, State.WidthMm / 2, z), new Vector3(0.00036f, 0.00008f, (float)State.WidthMm * 0.001f)); // 沿寬度的線
                AddStrip(P(x, y, z), new Vector3(0.008f, 0.00008f, 0.00036f));                                         // 短橫線
            }
        }

        void AddStrip(Vector3 center, Vector3 size)
        {
            var c = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.DestroyImmediate(c.GetComponent<Collider>());
            c.name = "Scribe"; c.transform.SetParent(scribeRoot, false);
            c.transform.localPosition = center; c.transform.localScale = size;
            c.GetComponent<MeshRenderer>().sharedMaterial = SimpleMat.Unlit(new Color(0.11f, 0.16f, 0.19f));
        }
    }
}
