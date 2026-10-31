using UnityEngine;

namespace MachineYard
{
    /// <summary>程序化的柔邊圓點貼圖（蒸汽、灰塵用），只建一次。</summary>
    public static class FxTextures
    {
        static Texture2D soft;
        public static Texture2D Soft()
        {
            if (soft != null) return soft;
            const int n = 32;
            soft = new Texture2D(n, n, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, name = "FxSoft" };
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float dx = (x + .5f) / n * 2 - 1, dy = (y + .5f) / n * 2 - 1, d = Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy));
                    soft.SetPixel(x, y, new Color(1, 1, 1, d * d * (3 - 2 * d)));
                }
            soft.Apply();
            return soft;
        }
    }

    /// <summary>
    /// 用 Unity 粒子系統重做網站的點精靈特效（切屑、火花、蒸汽、爐火火星）。一個物件一個 ParticleSystem，
    /// 由程式用 Emit 發射（不開自動發射），粒子上限固定，避免 Quest 上的填充率與 CPU 負擔：
    ///   Chips  = 切屑：小片金屬色，受重力落下（上限 240）
    ///   Sparks = 火花：橘黃短命、速度快（上限 120）
    ///   Steam  = 蒸汽：大而柔的白灰粒子，慢速上飄、漸大漸淡（上限 80）
    /// </summary>
    public class ParticleBurst : MonoBehaviour
    {
        public enum Kind { Chips, Sparks, Steam }
        public Kind kind;
        ParticleSystem ps;

        public static ParticleBurst Create(Transform parent, Kind kind, string name = null)
        {
            var go = new GameObject(name ?? "Fx_" + kind);
            go.transform.SetParent(parent, false);
            var b = go.AddComponent<ParticleBurst>(); b.kind = kind;
            b.ps = go.AddComponent<ParticleSystem>();
            var main = b.ps.main;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.playOnAwake = false; main.loop = false;
            main.maxParticles = kind == Kind.Chips ? 240 : kind == Kind.Sparks ? 120 : 160;
            main.gravityModifier = kind == Kind.Chips ? 1f : kind == Kind.Sparks ? 0.7f : -0.03f;
            var em = b.ps.emission; em.enabled = false;
            var shape = b.ps.shape; shape.enabled = false;
            var r = go.GetComponent<ParticleSystemRenderer>();
            var mat = new Material(Shader.Find("Sprites/Default"));
            mat.mainTexture = kind == Kind.Steam ? FxTextures.Soft() : null;
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false;
            if (kind == Kind.Steam)
            {
                var sol = b.ps.sizeOverLifetime; sol.enabled = true;
                sol.size = new ParticleSystem.MinMaxCurve(1f, new AnimationCurve(new Keyframe(0, 0.35f), new Keyframe(1, 1.6f)));
                var col = b.ps.colorOverLifetime; col.enabled = true;
                var g = new Gradient();
                g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(new Color(0.8f, 0.8f, 0.78f), 1) },
                          new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(0.55f, 0.15f), new GradientAlphaKey(0, 1) });
                col.color = new ParticleSystem.MinMaxGradient(g);
            }
            return b;
        }

        /// <summary>在世界座標 pos 噴出 count 顆粒子，主要方向 dir（單位向量），speed 為倍率。</summary>
        public void Emit(Vector3 pos, Vector3 dir, int count, float speed = 1f)
        {
            for (int i = 0; i < count; i++)
            {
                var rnd = new Vector3(Random.value - .5f, Random.value - .5f, Random.value - .5f);
                var p = new ParticleSystem.EmitParams { position = pos };
                switch (kind)
                {
                    case Kind.Chips:
                        p.velocity = (dir * (0.5f + Random.value * 0.9f) + rnd * 0.5f) * speed;
                        p.startLifetime = 0.9f + Random.value * 0.5f; p.startSize = 0.0025f + Random.value * 0.003f;
                        p.startColor = Color.Lerp(new Color(0.62f, 0.65f, 0.7f), new Color(0.85f, 0.7f, 0.35f), Random.value);
                        break;
                    case Kind.Sparks:
                        p.velocity = (dir * (1.2f + Random.value * 1.8f) + rnd * 1.2f) * speed;
                        p.startLifetime = 0.2f + Random.value * 0.25f; p.startSize = 0.0018f + Random.value * 0.002f;
                        p.startColor = Color.Lerp(new Color(1f, 0.55f, 0.15f), new Color(1f, 0.9f, 0.5f), Random.value);
                        break;
                    default:
                        p.velocity = (dir * (0.35f + Random.value * 0.45f) + rnd * 0.25f) * speed;
                        p.startLifetime = 1.4f + Random.value * 1f; p.startSize = 0.07f + Random.value * 0.08f;
                        p.startColor = new Color(0.92f, 0.92f, 0.9f, 1f);
                        break;
                }
                ps.Emit(p, 1);
            }
        }
    }

    /// <summary>
    /// 空氣中的灰塵（網站的 DustMotes）：長方體範圍內緩慢漂浮的小亮點，持續發射。範圍與數量固定、上限 150 顆。
    /// </summary>
    public class DustMotes : MonoBehaviour
    {
        public static DustMotes Create(Transform parent, Vector3 center, Vector3 size)
        {
            var go = new GameObject("DustMotes"); go.transform.SetParent(parent, false); go.transform.localPosition = center;
            var d = go.AddComponent<DustMotes>();
            var ps = go.AddComponent<ParticleSystem>();
            var main = ps.main; main.simulationSpace = ParticleSystemSimulationSpace.Local; main.loop = true; main.playOnAwake = true;
            main.maxParticles = 150; main.startLifetime = 14f; main.startSize = 0.012f; main.startSpeed = 0.02f; main.gravityModifier = 0f;
            main.startColor = new Color(1f, 0.93f, 0.78f, 0.5f);
            var em = ps.emission; em.rateOverTime = 10f;
            var sh = ps.shape; sh.enabled = true; sh.shapeType = ParticleSystemShapeType.Box; sh.scale = size;
            var r = go.GetComponent<ParticleSystemRenderer>();
            var mat = new Material(Shader.Find("Sprites/Default")) { mainTexture = FxTextures.Soft() };
            r.sharedMaterial = mat; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false;
            var col = ps.colorOverLifetime; col.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Color.white, 1) },
                      new[] { new GradientAlphaKey(0, 0), new GradientAlphaKey(0.5f, 0.2f), new GradientAlphaKey(0.5f, 0.8f), new GradientAlphaKey(0, 1) });
            col.color = new ParticleSystem.MinMaxGradient(g);
            return d;
        }
    }

    /// <summary>
    /// 把機台事件接到特效：車床切削 → 切屑（撞夾頭 → 火花）、銑床／鑽床切削 → 切屑；
    /// 同時提供 Steam 供機台切換與門栓／壓力錶使用。掛在工作室根節點。
    /// </summary>
    public class MachineEffects : MonoBehaviour
    {
        public ParticleBurst chips, sparks, steam;
        public LatheCuttingController[] lathes = new LatheCuttingController[0];
        public HeadMachining[] heads = new HeadMachining[0];
        float sparkGap;

        void Awake() { EnsureFx(); }
        void Start() { foreach (var l in lathes) Attach(l); foreach (var h in heads) Attach(h); }
        void EnsureFx()
        {
            if (chips == null) chips = ParticleBurst.Create(transform, ParticleBurst.Kind.Chips);
            if (sparks == null) sparks = ParticleBurst.Create(transform, ParticleBurst.Kind.Sparks);
            if (steam == null) steam = ParticleBurst.Create(transform, ParticleBurst.Kind.Steam);
        }

        public void Attach(LatheCuttingController lathe)
        {
            EnsureFx();
            lathe.CutHappened += running =>
            {
                if (!running || !lathe.Sample(out _, out var tip)) return;
                chips.Emit(tip, (Vector3.up * 0.8f + Vector3.back * 0.2f).normalized, 2);
            };
            lathe.machine.Notice += msg => { if (msg != null && msg.StartsWith("危險") && lathe.Sample(out _, out var tip)) Sparks(tip); };
        }

        public void Attach(HeadMachining head)
        {
            EnsureFx();
            head.Chips += (pos, dir, n) => chips.Emit(pos, dir, n);
            head.Plunged += () => sparks.Emit(head.TipWorld(), Vector3.up, 6, 0.6f);
        }

        /// <summary>撞夾頭的火花（車床）；限制頻率。</summary>
        public void Sparks(Vector3 pos) { if (Time.time - sparkGap < 0.08f) return; sparkGap = Time.time; sparks.Emit(pos, Vector3.up, 8); }
        public void Steam(Vector3 pos, Vector3 dir, int n = 12) { EnsureFx(); steam.Emit(pos, dir, n); }
    }
}
