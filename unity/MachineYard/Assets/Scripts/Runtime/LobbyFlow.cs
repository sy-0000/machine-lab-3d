using System.Collections;
using UnityEngine;

namespace MachineYard
{
    /// <summary>
    /// 大門口的流程（對應 src/xr/areas/Lobby.js）：門外 → 點大門推開、進玄關 → 讀工安告示板、看完三段動畫 → 金庫圓門解鎖 → 進工廠。
    /// 站位 where：outside / center / board / screen / vault。
    ///   點大門 → 開門 → 移到玄關中央；點告示板紙面／放映幕 → 走到面板前；面板「退後」→ 回玄關中央；
    ///   點金庫手輪：不在門前先走到門前；在門前且未解鎖 → 抖動＋提示；已解鎖 → 開門 → 淡出 → 進佔位工作室（階段 4 才有真的工作室）。
    /// 「進工廠」寫入 ProgressStore.factory（瞬移解鎖）。
    /// </summary>
    public class LobbyFlow : MonoBehaviour
    {
        public StationMover mover; public ExteriorDoors doors; public SafetyBoardController board; public ProjectionScreenController screen;
        public VaultDoorController vault; public Transform wheelHit, paperHit, pictureHit;
        public string Where { get; private set; } = "outside";
        bool leaving;
        public bool DoorsOpen => doors != null && doors.IsOpen;

        public void Wire()
        {
            if (doors != null) doors.Opened += () => Go(Stations.Center);
            if (doors != null) XrUtil.MakeClickable(doors.gameObject, () => { if (Where == "outside") doors.Open(); });
            if (board != null) board.BackClicked = () => Go(Stations.Center);
            if (screen != null) screen.BackClicked = () => Go(Stations.Center);
            if (board != null && board.Paper != null) XrUtil.MakeClickable(board.Paper.gameObject, () => { if (Where == "outside") return; if (Where != "board") Go(Stations.Board); });
            if (screen != null) { var pic = XrUtil.FindDeep(screen.transform, "Picture"); if (pic != null) XrUtil.MakeClickable(pic.gameObject, () => { if (Where == "outside") return; if (Where != "screen") Go(Stations.Screen); }); }
            if (vault != null && vault.wheelPivot != null) XrUtil.MakeClickable(vault.wheelPivot.gameObject, OnWheel, 0.1f);
            mover.Moved += s => { if (s.Area == Area.Lobby) Where = s.Name; };
        }

        void Go(Station s)
        {
            if (leaving) return;
            if (mover.MoveTo(s) != null) Where = s.Name;
        }

        void OnWheel()
        {
            if (leaving || vault.IsOpening || Where == "outside") return;
            if (Where != "vault") { Go(Stations.Vault); return; }
            if (!ProgressStore.Instance.Unlocked) { vault.Rattle(); return; }
            StartCoroutine(OpenVaultAndEnter());
        }

        IEnumerator OpenVaultAndEnter()
        {
            leaving = true;
            yield return vault.Open(null);
            ProgressStore.Instance.EnterFactory();
            mover.MoveTo(Stations.WorkshopDesk);
            yield return new WaitUntil(() => !mover.Busy);
            leaving = false;
        }

        /// <summary>走動時更新站位：從門外走進玄關 → center；走出玄關 → outside。</summary>
        public void OnWalk(float x, float z)
        {
            if (leaving || mover.CurrentArea != Area.Lobby) return;
            if (z < 15.4f && Where == "outside") Where = "center";
            else if (z > 16.0f && Where != "outside") Where = "outside";
        }

        public bool CanStand(float tx, float tz)
        {
            if (mover.CurrentArea == Area.Workshop) return WalkArea.CanStandWorkshop(tx - Stations.WorkshopOffsetThree.x, tz - Stations.WorkshopOffsetThree.z);
            return WalkArea.CanStandLobby(tx, tz, DoorsOpen);
        }
    }
}
