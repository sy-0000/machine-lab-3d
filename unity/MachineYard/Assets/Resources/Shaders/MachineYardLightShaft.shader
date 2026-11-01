// 工作室穹頂的光束（對應網站 lightShafts.js 的 ShaderMaterial）：加法混合、不寫深度、雙面；
// 正對視線的中央最亮（facing³）、兩端淡出、沿高度緩慢明暗飄動、離相機太近淡出。
// 寫成不帶 LightMode 的 unlit pass，URP 會以 SRPDefaultUnlit 繪製；含單次繪製雙眼（single-pass instanced）所需的巨集。
Shader "MachineYard/LightShaft"
{
    Properties
    {
        _Color ("Color", Color) = (1, 0.9, 0.74, 1)
        _Intensity ("Intensity", Float) = 0.075
        _Seed ("Seed", Float) = 0.5
    }
    SubShader
    {
        Tags { "Queue" = "Transparent+5" "RenderType" = "Transparent" "IgnoreProjector" = "True" }
        Blend One One
        ZWrite Off
        Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_instancing
            #include "UnityCG.cginc"
            fixed4 _Color; float _Intensity; float _Seed;
            struct appdata { float4 vertex : POSITION; float3 normal : NORMAL; float2 uv : TEXCOORD0; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; float3 posW : TEXCOORD1; float3 nW : TEXCOORD2; UNITY_VERTEX_OUTPUT_STEREO };
            v2f vert (appdata v)
            {
                v2f o; UNITY_SETUP_INSTANCE_ID(v); UNITY_INITIALIZE_OUTPUT(v2f, o); UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.uv;
                o.posW = mul(unity_ObjectToWorld, v.vertex).xyz; o.nW = UnityObjectToWorldNormal(v.normal);
                return o;
            }
            fixed4 frag (v2f i) : SV_Target
            {
                UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX(i);
                float3 V = normalize(_WorldSpaceCameraPos - i.posW);
                float facing = abs(dot(normalize(i.nW), V));
                float core = facing * facing * facing;
                float along = i.uv.y;
                float fade = smoothstep(0.0, 0.1, along) * smoothstep(1.0, 0.6, along);
                float t = _Time.y;
                float drift = 0.72 + 0.28 * sin(i.posW.y * 1.3 + t * 0.25 + _Seed * 17.0) * sin(i.posW.x * 1.9 - i.posW.z * 1.1 - t * 0.18);
                float camFade = smoothstep(0.6, 3.0, distance(_WorldSpaceCameraPos, i.posW));
                float a = core * fade * drift * camFade * _Intensity * (0.55 + 0.45 * _Seed);
                return fixed4(_Color.rgb * a, 1);
            }
            ENDCG
        }
    }
}
