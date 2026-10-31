using MachineYard.Core;
using Newtonsoft.Json;

namespace MachineYard
{
    /// <summary>
    /// 工件存檔：把目前機台上的工件寫進 / 讀回三格存檔欄位（SaveSlots）。
    /// 車床工件 format = "lathe-profile"，只能讀回車床；銑床與鑽床共用 "heightfield"，可互相讀取（xr-plan 的限制，SaveSlots.CanLoadOn）。
    /// </summary>
    public static class WorkpieceSaves
    {
        public static void SaveLathe(int slot, RevolvedState s) =>
            SaveSlots.Instance.Save(slot, "lathe", "lathe-profile", JsonConvert.SerializeObject(WorkpieceDto.ToDto(s)));

        public static void SaveHead(int slot, string machineId, HeadState s) =>
            SaveSlots.Instance.Save(slot, machineId, "heightfield", JsonConvert.SerializeObject(WorkpieceDto.ToDto(s)));

        /// <summary>讀回；格式壞掉或機台不符回 null（呼叫端顯示提示）。</summary>
        public static RevolvedState LoadLathe(int slot)
        {
            var sl = SaveSlots.Instance.Get(slot);
            if (!SaveSlots.CanLoadOn(sl, "lathe")) return null;
            try { return WorkpieceDto.FromDto(JsonConvert.DeserializeObject<LatheDto>(sl.payload)); } catch (System.Exception) { return null; }
        }

        public static HeadState LoadHead(int slot, string machineId)
        {
            var sl = SaveSlots.Instance.Get(slot);
            if (!SaveSlots.CanLoadOn(sl, machineId)) return null;
            try { return WorkpieceDto.FromDto(JsonConvert.DeserializeObject<HeadDto>(sl.payload)); } catch (System.Exception) { return null; }
        }
    }
}
