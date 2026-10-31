using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 覆蓋存檔前的確認：空格子直接存；已有工件的格子要在 3 秒內連按兩次才覆蓋（SaveSlots 規定由呼叫端確認）。
    /// </summary>
    public class SlotConfirm
    {
        int armed = -1; float armedAt;
        public bool ShouldSave(int slot)
        {
            if (!SaveSlots.Instance.Get(slot).used) return true;
            if (armed == slot && Time.time - armedAt < 3f) { armed = -1; return true; }
            armed = slot; armedAt = Time.time; return false;
        }
        public static string Describe(int slot)
        {
            var s = SaveSlots.Instance.Get(slot);
            return s.used ? $"{slot + 1}: {s.sourceMachine} {s.savedAt}" : $"{slot + 1}: （空）";
        }
    }
}
