using System;
using System.IO;
using UnityEngine;

namespace MachineYard
{
    [Serializable]
    public class SaveSlot
    {
        public bool used;
        public string savedAt;        // ISO 8601
        public string sourceMachine;  // lathe | milling | drill
        public string format;         // lathe-profile | heightfield
        public string payload;        // 工件狀態（JSON 字串；階段 4 起由機台寫入）
    }

    [Serializable]
    public class SaveFileData
    {
        public int version = 1;
        public SaveSlot[] slots = { new SaveSlot(), new SaveSlot(), new SaveSlot() };
    }

    /// <summary>
    /// 三格存檔（沿用網站規劃：docs/xr-plan.md「工件存檔」——存檔對象是工件，三格，格式 { version, slots[3] }）。
    /// 階段 3 只做儲存層：讀寫、覆蓋、清除與版本欄位；工件內容要到階段 4（車床）才有。
    /// 存成 persistentDataPath/saves.json，和進度分開。
    /// </summary>
    public class SaveSlots
    {
        public const int Count = 3;
        static SaveSlots instance;
        public static SaveSlots Instance => instance ??= new SaveSlots();
        readonly string path = Path.Combine(Application.persistentDataPath, "saves.json");
        public SaveFileData Data { get; private set; }
        public event Action Changed;

        SaveSlots() { Data = Load(); }

        SaveFileData Load()
        {
            try
            {
                if (File.Exists(path))
                {
                    var d = JsonUtility.FromJson<SaveFileData>(File.ReadAllText(path));
                    if (d != null && d.version == 1 && d.slots != null && d.slots.Length == Count) return d; // 之後版本升級在這裡依 version 逐版遷移
                }
            }
            catch (Exception e) { Debug.LogWarning("[Machine Yard] 存檔讀取失敗，使用空白存檔：" + e.Message); }
            return new SaveFileData();
        }

        void Write()
        {
            try { File.WriteAllText(path, JsonUtility.ToJson(Data, true)); }
            catch (Exception e) { Debug.LogWarning("[Machine Yard] 存檔寫入失敗：" + e.Message); }
            Changed?.Invoke();
        }

        public SaveSlot Get(int index) => Data.slots[index];

        /// <summary>寫入（覆蓋）某一格。呼叫端負責在格子已有工件時先確認。</summary>
        public void Save(int index, string sourceMachine, string format, string payload)
        {
            Data.slots[index] = new SaveSlot { used = true, savedAt = DateTime.UtcNow.ToString("o"), sourceMachine = sourceMachine, format = format, payload = payload };
            Write();
        }

        public void Clear(int index) { Data.slots[index] = new SaveSlot(); Write(); }

        /// <summary>
        /// 讀取限制（xr-plan）：車床工件只能讀回車床；銑床與鑽床共用高度場格式，可互相讀取。
        /// </summary>
        public static bool CanLoadOn(SaveSlot slot, string machine) =>
            slot.used && (slot.format == "lathe-profile" ? machine == "lathe" : (machine == "milling" || machine == "drill"));
    }
}
