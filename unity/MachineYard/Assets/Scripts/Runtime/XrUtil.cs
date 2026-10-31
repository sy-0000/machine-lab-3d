using System;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit.Interactables;

namespace MachineYard
{
    public static class XrUtil
    {
        static Mesh quad;
        /// <summary>1×1 的四邊形（正面朝 -Z，與 Unity 內建 Quad 相同）。自己建是因為 CreatePrimitive 的 Collider 要到影格結束才會被 Destroy，會干擾 MakeClickable。</summary>
        public static GameObject CreateQuad(string name, Transform parent, Color color)
        {
            if (quad == null)
            {
                quad = new Mesh { name = "MachineYardQuad" };
                quad.vertices = new[] { new Vector3(-.5f, -.5f, 0), new Vector3(.5f, -.5f, 0), new Vector3(-.5f, .5f, 0), new Vector3(.5f, .5f, 0) };
                quad.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(0, 1), new Vector2(1, 1) };
                quad.normals = new[] { -Vector3.forward, -Vector3.forward, -Vector3.forward, -Vector3.forward };
                quad.triangles = new[] { 0, 2, 1, 2, 3, 1 };
            }
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = quad;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = new Material(Shader.Find("Sprites/Default")) { color = color };
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            return go;
        }

        public static Transform FindDeep(Transform root, string name)
        {
            foreach (var t in root.GetComponentsInChildren<Transform>(true)) if (t.name == name) return t;
            return null;
        }

        public static Bounds RendererBounds(GameObject go)
        {
            var rs = go.GetComponentsInChildren<Renderer>(true);
            var b = rs.Length > 0 ? rs[0].bounds : new Bounds(go.transform.position, Vector3.one * 0.1f);
            foreach (var r in rs) b.Encapsulate(r.bounds);
            return b;
        }

        /// <summary>讓 go 可被 XR 射線選取：BoxCollider（貼合渲染範圍）＋ XRSimpleInteractable，選取時呼叫 action。</summary>
        public static XRSimpleInteractable MakeClickable(GameObject go, Action action, float pad = 0.02f)
        {
            if (go.GetComponent<Collider>() == null)
            {
                var b = RendererBounds(go);
                var box = go.AddComponent<BoxCollider>();
                box.center = go.transform.InverseTransformPoint(b.center);
                var size = go.transform.InverseTransformVector(b.size);
                box.size = new Vector3(Mathf.Abs(size.x), Mathf.Abs(size.y), Mathf.Abs(size.z)) + Vector3.one * pad;
            }
            var it = go.GetComponent<XRSimpleInteractable>() ?? go.AddComponent<XRSimpleInteractable>();
            it.selectEntered.AddListener(_ => action());
            return it;
        }

        /// <summary>確保 go 有碰撞盒（貼合渲染範圍外加 pad）與 XRSimpleInteractable，回傳 interactable（事件由呼叫端自己接）。</summary>
        public static XRSimpleInteractable EnsureInteractable(GameObject go, float pad = 0.02f)
        {
            if (go.GetComponent<Collider>() == null)
            {
                var b = RendererBounds(go);
                var box = go.AddComponent<BoxCollider>();
                box.center = go.transform.InverseTransformPoint(b.center);
                var size = go.transform.InverseTransformVector(b.size);
                box.size = new Vector3(Mathf.Abs(size.x), Mathf.Abs(size.y), Mathf.Abs(size.z)) + Vector3.one * pad;
            }
            return go.GetComponent<XRSimpleInteractable>() ?? go.AddComponent<XRSimpleInteractable>();
        }

        /// <summary>設定材質顏色（glTFast 的 URP 材質屬性名稱依版本不同：_BaseColor / baseColorFactor / _Color）。</summary>
        public static void SetColor(Renderer r, Color c)
        {
            foreach (var m in r.materials)
                foreach (var prop in new[] { "_BaseColor", "baseColorFactor", "_Color" })
                    if (m.HasProperty(prop)) { m.SetColor(prop, c); break; }
        }

        /// <summary>測試把 pivot 轉 +testDegrees 後，bodyCenter 是否往 inward 方向移動；回傳該用的符號（+1／-1）。
        /// 用來避開「three.js → Unity 手性轉換後旋轉方向相反」的猜測。</summary>
        public static float SwingSign(Transform pivot, Transform body, Vector3 inward)
        {
            var q0 = pivot.localRotation;
            Vector3 c0 = Center(body);
            pivot.localRotation = q0 * Quaternion.Euler(0, 20f, 0);
            Vector3 c1 = Center(body);
            pivot.localRotation = q0;
            return Vector3.Dot(c1 - c0, inward) >= 0 ? 1f : -1f;
        }

        static Vector3 Center(Transform t) => RendererBounds(t.gameObject).center;
    }
}
