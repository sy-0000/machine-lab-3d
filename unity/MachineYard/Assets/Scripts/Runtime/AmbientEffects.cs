using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 蒸汽噴口（對應 steam.js 的 SteamSystem 噴口）：每個噴口隨機間隔噴發——等 3–10 秒（第一次 1–6 秒）→ 噴 0.6–2.4 秒，
    /// 每秒 22 × 強度 顆；粒子 2.4–4.6 秒、由 5–9 cm 長到 0.7–1.2 m（× 強度）。座標都是世界座標（由建立者換算）。
    /// </summary>
    public class SteamVents : MonoBehaviour
    {
        class Vent { public Vector3 pos, dir; public float strength, timer, acc; public bool bursting; }
        readonly List<Vent> vents = new List<Vent>();
        ParticleBurst ps;

        public void Add(Vector3 worldPos, Vector3 worldDir, float strength)
        {
            if (ps == null) ps = ParticleBurst.Create(transform, ParticleBurst.Kind.Steam, "Fx_SteamVents");
            vents.Add(new Vent { pos = worldPos, dir = worldDir.normalized, strength = strength, timer = 1 + Random.value * 5 });
        }

        void Update()
        {
            float dt = Time.deltaTime;
            foreach (var e in vents)
            {
                e.timer -= dt;
                if (e.bursting)
                {
                    e.acc += dt * 22 * e.strength;
                    while (e.acc >= 1) { e.acc -= 1; Spawn(e); }
                    if (e.timer <= 0) { e.bursting = false; e.timer = 3 + Random.value * 7; }
                }
                else if (e.timer <= 0) { e.bursting = true; e.timer = 0.6f + Random.value * 1.8f; }
            }
        }

        void Spawn(Vent e)
        {
            var rnd = new Vector3(Random.value - .5f, Random.value - .5f, Random.value - .5f);
            float speed = (0.7f + Random.value * 0.6f) * (0.6f + 0.5f * e.strength);
            float size = (0.7f + Random.value * 0.5f) * (0.6f + 0.5f * e.strength) * 0.6f;   // ParticleBurst 的蒸汽會再長大 1.6 倍
            ps.EmitRaw(e.pos + rnd * 0.03f, (e.dir + rnd * 0.25f) * speed, 2.4f + Random.value * 2.2f, size, new Color(0.92f, 0.92f, 0.9f, 1));
        }
    }

    /// <summary>
    /// 鍋爐爐口的火星（對應 sparks.js）：每 0.3–1.5 秒一顆，每 2–7 秒一陣 3–12 顆；往爐口外上方飛、受重力、0.8–2.6 秒。
    /// </summary>
    public class SparkFountain : MonoBehaviour
    {
        public Vector3 origin, direction = Vector3.forward;   // 世界座標
        ParticleBurst ps; float nextBurst = 2, nextSingle = 0.5f;

        void Start() { ps = ParticleBurst.Create(transform, ParticleBurst.Kind.Sparks, "Fx_FireboxSparks"); }

        void Update()
        {
            nextBurst -= Time.deltaTime; nextSingle -= Time.deltaTime;
            if (nextBurst <= 0) { int n = 3 + Random.Range(0, 10); for (int k = 0; k < n; k++) Spawn(); nextBurst = 2 + Random.value * 5; }
            if (nextSingle <= 0) { Spawn(); nextSingle = 0.3f + Random.value * 1.2f; }
        }

        void Spawn()
        {
            var d = direction.normalized; float speed = 0.5f + Random.value;
            var p = origin + new Vector3((Random.value - .5f) * 0.4f, Random.value * 0.15f, (Random.value - .5f) * 0.1f);
            var v = new Vector3(d.x * speed + (Random.value - .5f) * .5f, d.y * speed + .4f + Random.value * .6f, d.z * speed + (Random.value - .5f) * .3f);
            ps.EmitRaw(p, v, 0.8f + Random.value * 1.8f, 0.006f + Random.value * 0.006f, Color.Lerp(new Color(1f, 0.55f, 0.15f), new Color(1f, 0.85f, 0.45f), Random.value));
        }
    }

    /// <summary>
    /// 工作室的環境特效（匯出時被略過的部分）：讀 Resources/workshop-effects.json（scripts/extract-effects.mjs 跑網站原程式算出）——
    /// 7 道穹頂光束（MachineYard/LightShaft 加法著色器，開口圓柱）、鍋爐火星、5 個蒸汽噴口。座標是工作室的 three.js 座標，
    /// 以 workshopRoot 為原點換算。
    /// </summary>
    public class WorkshopAmbience : MonoBehaviour
    {
        public Transform workshopRoot;
        public float beamIntensity = 0.075f;

        void Start()
        {
            var ta = Resources.Load<TextAsset>("workshop-effects");
            if (ta == null || workshopRoot == null) { Debug.LogWarning("[Machine Yard] 沒有 Resources/workshop-effects.json，工作室沒有光束／火星／蒸汽噴口"); return; }
            var j = JObject.Parse(ta.text);
            Vector3 W(JToken a) { var v = a.ToObject<float[]>(); return workshopRoot.TransformPoint(ThreeCoords.Position(v[0], v[1], v[2])); }
            Vector3 D(JToken a) { var v = a.ToObject<float[]>(); return workshopRoot.TransformDirection(ThreeCoords.Direction(v[0], v[1], v[2])); }

            var shader = Shader.Find("MachineYard/LightShaft");
            if (shader != null)
            {
                int i = 0;
                foreach (var b in (JArray)j["beams"])
                {
                    var q = b["quaternion"].ToObject<float[]>(); var p = b["position"].ToObject<float[]>();
                    var go = new GameObject((string)b["name"]); go.transform.SetParent(workshopRoot, false);
                    go.transform.localPosition = ThreeCoords.Position(p[0], p[1], p[2]);
                    go.transform.localRotation = ThreeCoords.Rotation(q[0], q[1], q[2], q[3]);
                    go.AddComponent<MeshFilter>().sharedMesh = Tube((float)b["radiusTop"], (float)b["radiusBottom"], (float)b["height"]);
                    var mat = new Material(shader); mat.SetFloat("_Intensity", beamIntensity); mat.SetFloat("_Seed", Mathf.Repeat(i * 0.618f, 1f));
                    var r = go.AddComponent<MeshRenderer>(); r.sharedMaterial = mat; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false;
                    i++;
                }
            }
            else Debug.LogWarning("[Machine Yard] 找不到 MachineYard/LightShaft 著色器（Always Included Shaders，選單 1 會加入）");

            if (j["sparks"] is JObject sp)
            {
                var f = new GameObject("FireboxSparks").AddComponent<SparkFountain>(); f.transform.SetParent(workshopRoot, false);
                f.origin = W(sp["position"]); f.direction = D(sp["direction"]);
            }
            var vents = new GameObject("SteamVents").AddComponent<SteamVents>(); vents.transform.SetParent(workshopRoot, false);
            foreach (var e in (JArray)j["steam"]) vents.Add(W(e["position"]), D(e["direction"]), (float)e["strength"]);
        }

        // three 的 CylinderGeometry(rTop, rBottom, h, 28, 1, openEnded)：沿局部 Y、中心在原點；uv.y 由下(0)到上(1)
        static Mesh Tube(float rTop, float rBottom, float h)
        {
            const int n = 28; var v = new List<Vector3>(); var nm = new List<Vector3>(); var uv = new List<Vector2>(); var t = new List<int>();
            for (int i = 0; i <= n; i++)
            {
                float a = i * Mathf.PI * 2 / n, c = Mathf.Cos(a), s = Mathf.Sin(a);
                v.Add(ThreeCoords.Position(rBottom * s, -h / 2, rBottom * c)); v.Add(ThreeCoords.Position(rTop * s, h / 2, rTop * c));
                var n3 = ThreeCoords.Direction(s, 0, c); nm.Add(n3); nm.Add(n3);
                uv.Add(new Vector2(i / (float)n, 0)); uv.Add(new Vector2(i / (float)n, 1));
            }
            for (int i = 0; i < n; i++) { int a = i * 2; t.Add(a); t.Add(a + 1); t.Add(a + 2); t.Add(a + 1); t.Add(a + 3); t.Add(a + 2); }   // 雙面繪製（Cull Off），繞向不影響
            var m = new Mesh { name = "LightShaft" }; m.SetVertices(v); m.SetNormals(nm); m.SetUVs(0, uv); m.SetTriangles(t, 0); m.RecalculateBounds();
            return m;
        }
    }

    /// <summary>
    /// 玄關的動態裝飾（對應 vestibule.js）：16 個牆面齒輪轉動（開金庫門時加速 6 倍）、3 個閥門手輪可以抓住轉（grip 畫圈）、
    /// 閥門旁的 3 個蒸汽噴口隨機噴發。齒輪轉速與方向照網站：方向 × 0.35 / 齒輪半徑（大 0.45、中 0.30、小 0.25 m）。
    /// </summary>
    public class VestibuleAmbience : MonoBehaviour
    {
        public Transform vestibuleRoot;          // vestibule_interactive 的實例（three.js 世界座標＝玄關座標）
        public VaultDoorController vault;
        // 依 vestibule.js 的 GEARS 順序（各尺寸內的實例順序）：轉向 ±1
        static readonly int[] DirL = { 1, -1, 1, 1, 1, 1, 1, -1 }, DirM = { -1, -1, -1 }, DirS = { -1, 1, -1, -1, 1 };
        readonly List<(Transform t, Quaternion rest, float speed)> gears = new List<(Transform, Quaternion, float)>();
        readonly List<float> angles = new List<float>();

        void Start()
        {
            if (vestibuleRoot == null) return;
            void Gears(string prefix, int[] dirs, float radius)
            {
                for (int i = 0; i < dirs.Length; i++)
                {
                    var t = XrUtil.FindDeep(vestibuleRoot, $"{prefix}_{i}"); if (t == null) continue;
                    gears.Add((t, t.localRotation, dirs[i] * 0.35f / radius)); angles.Add(0);
                }
            }
            Gears("WallGears_L", DirL, 0.45f); Gears("WallGears_M", DirM, 0.30f); Gears("WallGears_S", DirS, 0.25f);

            foreach (var w in vestibuleRoot.GetComponentsInChildren<Transform>(true))
            {
                if (w.name != "Handwheel") continue;
                XrUtil.EnsureTarget(w.gameObject, 0.04f);
                var grab = w.gameObject.AddComponent<WheelGrab>();
                grab.axisLocalUnity = ThreeCoords.Direction(0, 1, 0);       // 閥門手輪繞自己的 +Y 轉（vestibule.js：wheel.rotateY）
                var wheel = w; grab.onTurn = d => wheel.localRotation = wheel.localRotation * ThreeCoords.AxisAngle(Vector3.up, d);
            }

            // 閥門旁的蒸汽（vestibule.js 的 valves[].steam／dir；玄關 X = 3.0、門面 Z0 = 10.6）
            var vents = new GameObject("VestibuleSteamVents").AddComponent<SteamVents>(); vents.transform.SetParent(transform, false);
            var root = vestibuleRoot;   // glb 根節點＝玄關的 three.js 座標原點
            void Vent(float x, float y, float z, float dx, float dy, float dz) => vents.Add(root.TransformPoint(ThreeCoords.Position(x, y, z)), root.TransformDirection(ThreeCoords.Direction(dx, dy, dz)), 0.35f);
            Vent(-3.0f + 0.3f, 2.45f, 11.25f, 1, 0.3f, 0.4f); Vent(3.0f - 0.3f, 3.8f, 14.6f, -1, -0.1f, 0.3f); Vent(1.1f, 3.8f, 10.6f + 0.35f, 0.3f, -0.2f, 1);
        }

        void Update()
        {
            float boost = vault != null && vault.IsOpening ? 6f : 1f;
            for (int i = 0; i < gears.Count; i++)
            {
                angles[i] += Time.deltaTime * gears[i].speed * boost;
                gears[i].t.localRotation = gears[i].rest * ThreeCoords.AxisAngle(Vector3.forward, angles[i]);
            }
        }
    }
}
