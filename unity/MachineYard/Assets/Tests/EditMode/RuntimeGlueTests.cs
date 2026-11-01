using System.IO;
using MachineYard.Core;
using Newtonsoft.Json;
using NUnit.Framework;
using UnityEngine;

namespace MachineYard.Tests
{
    /// <summary>
    /// 只能在 Unity 裡跑的測試（Window ▸ General ▸ Test Runner ▸ EditMode ▸ Run All）：
    /// 純數學已由 MachineYard.CoreTests 對 JS 比對過；這裡測 Unity 端的換算與組裝（座標、局部座標鏈、網格、存檔、發亮）。
    /// </summary>
    public class RuntimeGlueTests
    {
        GameObject root;
        [TearDown] public void Cleanup() { if (root != null) Object.DestroyImmediate(root); }

        static void Near(Vector3 a, Vector3 b, float tol, string what) => Assert.Less((a - b).magnitude, tol, $"{what}: {a} vs {b}");

        [Test]
        public void ThreeCoords_RotationCommutesWithMirror()
        {
            // three 中繞 a 轉 θ 再換成 Unity ＝ 先換成 Unity 再用 ThreeCoords.AxisAngle 轉（鏡像的旋轉換算）
            var axis = new Vector3(0.3f, 0.8f, -0.5f).normalized; float theta = 0.7f; var v = new Vector3(0.2f, -0.4f, 0.9f);
            // three 的旋轉（右手系、標準旋轉矩陣）＝ Unity 數值上的 AngleAxis（矩陣相同，只是解讀不同）
            var rotatedThree = Quaternion.AngleAxis(theta * Mathf.Rad2Deg, axis) * v;
            var expected = ThreeCoords.Position(rotatedThree.x, rotatedThree.y, rotatedThree.z);
            var actual = ThreeCoords.AxisAngle(axis, theta) * ThreeCoords.Position(v.x, v.y, v.z);
            Near(actual, expected, 1e-5f, "AxisAngle");
            Near(ThreeCoords.ToThree(ThreeCoords.Position(1, 2, 3)), new Vector3(1, 2, 3), 1e-6f, "ToThree 是反函數");
        }

        [Test]
        public void LocalSpace_MatchesTransformPoint()
        {
            root = new GameObject("root");
            var a = new GameObject("a").transform; a.SetParent(root.transform); a.localPosition = new Vector3(0.3f, 1.1f, -0.2f); a.localRotation = Quaternion.Euler(10, 70, -20); a.localScale = new Vector3(1, 1.5f, 1);
            var b = new GameObject("b").transform; b.SetParent(a); b.localPosition = new Vector3(-0.05f, 0.2f, 0.4f); b.localRotation = Quaternion.Euler(-30, 5, 45);
            var p = new Vector3(0.01f, -0.07f, 0.03f);
            Near(LocalSpace.ToAncestor(b, root.transform, p), root.transform.InverseTransformPoint(b.TransformPoint(p)), 1e-5f, "ToAncestor");
            Near(LocalSpace.FromAncestor(b, root.transform, LocalSpace.ToAncestor(b, root.transform, p)), p, 1e-5f, "FromAncestor 反函數");
        }

        [Test]
        public void HeadWorkpieceView_BuildsAndShrinksAfterFacing()
        {
            root = new GameObject("root");
            var s = HeadState.CreateBlock();
            var view = HeadWorkpieceView.Create(root.transform, s); view.Rebuild();
            var mesh = view.GetComponent<MeshFilter>().sharedMesh;
            Assert.Greater(mesh.triangles.Length, 0);
            Near(mesh.bounds.size, new Vector3(0.09f, 0.02f, 0.02f), 1e-4f, "毛胚 90×20×20 mm");
            var tool = new HeadTool { Id = "fm", Type = HeadToolType.Milling, DiameterMm = 58, CuttingLengthMm = 32 };
            Assert.IsTrue(HeadCutting.Cut(s, new HeadPoint(-40, 10, 18.5), new HeadPoint(130, 10, 18.5), tool, true, 500));
            view.Rebuild();
            Assert.AreEqual(0.0185f, mesh.bounds.size.y, 1e-4f, "面銑後高度 18.5 mm");
        }

        [Test]
        public void WorkpieceDto_RoundTripsThroughNewtonsoft()
        {
            var s = HeadState.CreateDrillStock();
            var drill = new HeadTool { Id = "d", Type = HeadToolType.Drilling, DiameterMm = 10, CuttingLengthMm = 49 };
            for (int i = 0; i < 10; i++) HeadCutting.Cut(s, new HeadPoint(65, 10, 25 - i), new HeadPoint(65, 10, 24 - i), drill, true, 500);
            var json = JsonConvert.SerializeObject(WorkpieceDto.ToDto(s));
            var back = WorkpieceDto.FromDto(JsonConvert.DeserializeObject<HeadDto>(json));
            CollectionAssert.AreEqual(s.TopMm, back.TopMm);
            Assert.AreEqual(s.Features.Count, back.Features.Count);
            Assert.AreEqual(s.Features[0].DepthMm, back.Features[0].DepthMm, 1e-9);
        }

        [Test]
        public void Highlighter_SwapsAndRestoresMaterials()
        {
            root = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var r = root.GetComponent<Renderer>(); var original = r.sharedMaterial;
            Highlighter.Set(root, true); Assert.AreNotSame(original, r.sharedMaterial);
            Highlighter.Set(root, false); Assert.AreSame(original, r.sharedMaterial);
        }

        [Test]
        public void ExportedRuntimeJsonParses()
        {
            int found = 0;
            foreach (var id in new[] { "lathe", "milling", "drill" })
            {
                var path = $"Assets/Models/machine_{id}_runtime.json";
                if (!File.Exists(path)) continue;
                var cfg = MachineRuntimeConfig.Parse(File.ReadAllText(path));
                Assert.AreEqual(id, cfg.machineId); Assert.IsNotEmpty(cfg.axes); Assert.IsNotEmpty(cfg.wheels); Assert.IsNotNull(cfg.spindle.node);
                found++;
            }
            if (found == 0) Assert.Inconclusive("Assets/Models 還沒有 machine_*_runtime.json（先執行選單 2b）");
        }
    }
}
