using System;
using TMPro;
using UnityEngine;
using UnityEngine.Video;

namespace MachineYard
{
    /// <summary>
    /// 玄關右牆的放映幕（對應 src/xr/lobby/ProjectionScreen.js ＋ src/xr/AnimationScreen.js）：三段切削動畫輪播，
    /// 「某一段從頭完整播到最後」才算看完（按上一段／下一段會從頭開始，跳過的不算），看完寫入 ProgressStore。
    /// 內容：網站版是 public/previews/*.anim.js 的程式繪圖（CanvasTexture，無法匯出）。Unity 版有兩條路：
    ///   1) 給每一段指定 VideoClip（把動畫預錄成影片，建議）→ 用 VideoPlayer 貼到 Picture；
    ///   2) 沒有影片時用「佔位計時」：顯示該段標題與倒數，fallbackSeconds 秒後算播完（讓流程與解鎖可以先測）。
    /// 按鈕沿用 glb 的 ScreenButton_prev / play / next / back。
    /// </summary>
    public class ProjectionScreenController : MonoBehaviour
    {
        [Serializable] public class Clip { public string id; public string title; public VideoClip video; }
        public Clip[] clips =
        {
            new Clip { id = "lathe", title = "車床是怎麼切削的？" },
            new Clip { id = "milling", title = "銑床是怎麼切削的？" },
            new Clip { id = "drill", title = "鑽床是怎麼鑽孔的？" },
        };
        public float fallbackSeconds = 12f, holdSeconds = 1.6f;
        public Action BackClicked;
        int index; bool playing = true; float t, hold; bool startedFromBeginning = true;
        TextMeshPro label; Renderer picture, cover; VideoPlayer vp; bool videoEnded;

        public void Build(Vector3 viewerWorldPos)
        {
            var pic = XrUtil.FindDeep(transform, "Picture");
            if (pic == null) { Debug.LogError("[Machine Yard] ProjectionScreen 裡找不到 Picture"); return; }
            picture = pic.GetComponent<Renderer>();
            var mf = pic.GetComponent<MeshFilter>();
            var size = mf != null ? Vector3.Scale(mf.sharedMesh.bounds.size, pic.lossyScale) : new Vector3(1.6f, 1f, 0);
            var normal = viewerWorldPos - pic.position; normal.y = 0; normal.Normalize();

            var overlay = new GameObject("ScreenText").transform;
            overlay.SetParent(pic, true);
            overlay.position = pic.position + normal * 0.004f;
            overlay.rotation = Quaternion.LookRotation(-normal, Vector3.up);
            // 佔位模式的底色面片（蓋住匯出時烘進貼圖的那一格畫面）
            var q = XrUtil.CreateQuad("ScreenCover", overlay, new Color(0.97f, 0.94f, 0.88f));
            q.transform.localScale = new Vector3(Mathf.Abs(size.x), Mathf.Abs(size.y), 1);
            q.transform.localPosition = new Vector3(0, 0, 0.001f);
            cover = q.GetComponent<Renderer>();
            label = overlay.gameObject.AddComponent<TextMeshPro>();
            var font = Resources.Load<TMP_FontAsset>("MachineYardFont");
            if (font != null) label.font = font;
            label.rectTransform.sizeDelta = new Vector2(Mathf.Abs(size.x) - 0.1f, Mathf.Abs(size.y) - 0.1f);
            label.enableAutoSizing = true; label.fontSizeMin = 0.05f; label.fontSizeMax = 20f;
            label.alignment = TextAlignmentOptions.Center; label.color = new Color(0.3f, 0.23f, 0.19f); label.richText = true;

            vp = gameObject.AddComponent<VideoPlayer>();
            vp.playOnAwake = false; vp.isLooping = false;
            vp.renderMode = VideoRenderMode.MaterialOverride; vp.targetMaterialRenderer = picture; vp.targetMaterialProperty = "_BaseMap";
            vp.loopPointReached += _ => videoEnded = true;

            Wire("ScreenButton_prev", () => Go(index - 1));
            Wire("ScreenButton_next", () => Go(index + 1));
            Wire("ScreenButton_play", TogglePlay);
            Wire("ScreenButton_back", () => BackClicked?.Invoke());
            Go(0);
        }

        void Wire(string n, Action a) { var tr = XrUtil.FindDeep(transform, n); if (tr != null) XrUtil.MakeClickable(tr.gameObject, a); else Debug.LogWarning("[Machine Yard] 找不到 " + n); }

        public void TogglePlay() { playing = !playing; if (vp.clip != null) { if (playing) vp.Play(); else vp.Pause(); } }

        public void Go(int i)
        {
            index = ((i % clips.Length) + clips.Length) % clips.Length;
            t = 0; hold = 0; videoEnded = false; startedFromBeginning = true;
            var c = clips[index];
            bool hasVideo = c.video != null;
            picture.enabled = hasVideo; cover.enabled = !hasVideo;
            if (hasVideo) { vp.clip = c.video; vp.time = 0; if (playing) vp.Play(); label.text = ""; }
            else { vp.Stop(); vp.clip = null; }
        }

        void Update()
        {
            if (clips == null || label == null) return;
            var c = clips[index];
            if (hold > 0)
            {
                hold -= Time.deltaTime;
                if (hold <= 0) { Go(index + 1); }
                return;
            }
            if (!playing) return;
            bool done;
            if (c.video != null) done = videoEnded;
            else
            {
                t += Time.deltaTime;
                label.text = $"<b>{c.title}</b>\n\n<size=50%>（佔位動畫：尚未指定影片）\n{Mathf.CeilToInt(Mathf.Max(0, fallbackSeconds - t))} 秒</size>";
                done = t >= fallbackSeconds;
            }
            if (done)
            {
                if (startedFromBeginning) ProgressStore.Instance.ClipWatched(c.id);
                hold = holdSeconds;
            }
        }
    }
}
