using UnityEngine;

namespace MachineYard
{
    /// <summary>煤氣燈微閃（對應 exterior.js：4 × (1 + 0.03 sin(2.1t + 1.7i) + 0.015 sin(9.3t + i))）。</summary>
    [RequireComponent(typeof(Light))]
    public class GasLanternFlicker : MonoBehaviour
    {
        public float baseIntensity = 4f; public int index;
        Light lamp;
        void Awake() => lamp = GetComponent<Light>();
        void Update()
        {
            float t = Time.time;
            lamp.intensity = baseIntensity * (1f + Mathf.Sin(t * 2.1f + index * 1.7f) * 0.03f + Mathf.Sin(t * 9.3f + index) * 0.015f);
        }
    }
}
