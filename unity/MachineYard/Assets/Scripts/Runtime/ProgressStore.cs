using System;
using System.IO;
using UnityEngine;

namespace MachineYard
{
    [Serializable] public class SafetyState { public int pagesRead; public int pages; public bool done; }
    [Serializable] public class ClipsState { public bool lathe, milling, drill; }
    [Serializable]
    public class ProgressData
    {
        public int version = 1;
        public SafetyState safety = new SafetyState();
        public ClipsState clips = new ClipsState();
        public bool factory;
    }

    /// <summary>
    /// 玄關進度（對應 src/xr/progress.js，欄位相同）：工安告示板讀到第幾頁、三段切削動畫各自是否播完、是否進過工廠（瞬移解鎖）。
    /// 存成 Application.persistentDataPath/progress.json；讀寫失敗時只在這次執行有效。
    /// </summary>
    public class ProgressStore
    {
        static ProgressStore instance;
        public static ProgressStore Instance => instance ??= new ProgressStore();

        readonly string path = Path.Combine(Application.persistentDataPath, "progress.json");
        public ProgressData State { get; private set; }
        public event Action Changed;

        ProgressStore() { State = Load(); }

        ProgressData Load()
        {
            try { if (File.Exists(path)) { var d = JsonUtility.FromJson<ProgressData>(File.ReadAllText(path)); if (d != null && d.version == 1) return d; } }
            catch (Exception e) { Debug.LogWarning("[Machine Yard] 進度讀取失敗，使用空白進度：" + e.Message); }
            return new ProgressData();
        }

        void Save()
        {
            try { File.WriteAllText(path, JsonUtility.ToJson(State, true)); }
            catch (Exception e) { Debug.LogWarning("[Machine Yard] 進度寫入失敗（只在這次執行有效）：" + e.Message); }
            Changed?.Invoke();
        }

        public float SafetyRatio => State.safety.done ? 1f : State.safety.pages > 0 ? (float)State.safety.pagesRead / State.safety.pages : 0f;
        public int ClipsDoneCount => (State.clips.lathe ? 1 : 0) + (State.clips.milling ? 1 : 0) + (State.clips.drill ? 1 : 0);
        public float ClipsRatio => ClipsDoneCount / 3f;
        public bool SafetyDone => State.safety.done;
        public bool ClipsDone => ClipsDoneCount == 3;
        public bool Unlocked => SafetyDone && ClipsDone;
        public bool FactoryEntered => State.factory;

        /// <summary>告示板翻到第 page 頁（從 1 起算）；翻到最後一頁算讀完。</summary>
        public void ReadPage(int page, int pages)
        {
            var s = State.safety;
            if (s.done && s.pages == pages) return;
            int read = Mathf.Max(s.pagesRead, page);
            if (read == s.pagesRead && pages == s.pages) return;
            s.pagesRead = read; s.pages = pages; s.done = s.done || read >= pages;
            Save();
        }

        public void ClipWatched(string id)
        {
            switch (id)
            {
                case "lathe": if (State.clips.lathe) return; State.clips.lathe = true; break;
                case "milling": if (State.clips.milling) return; State.clips.milling = true; break;
                case "drill": if (State.clips.drill) return; State.clips.drill = true; break;
                default: return;
            }
            Save();
        }

        public void EnterFactory() { if (State.factory) return; State.factory = true; Save(); }

        /// <summary>開發用：直接解鎖／重置（對應網站玄關的兩個開發按鈕；只在 Editor 與 Development Build 使用）。</summary>
        public void UnlockAll()
        {
            State.safety.pages = Mathf.Max(State.safety.pages, 1); State.safety.pagesRead = State.safety.pages; State.safety.done = true;
            State.clips.lathe = State.clips.milling = State.clips.drill = true;
            Save();
        }
        public void ResetAll() { State = new ProgressData(); Save(); }
    }
}
