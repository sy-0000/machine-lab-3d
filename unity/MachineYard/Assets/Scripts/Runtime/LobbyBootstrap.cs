using UnityEngine;

namespace MachineYard
{
    /// <summary>場景啟動時把各元件接起來（需要執行期才有的東西：觀看者位置、走動範圍）。由 LobbySceneBuilder 加到 MachineYardSystems。</summary>
    public class LobbyBootstrap : MonoBehaviour
    {
        public Vector3 viewerWorldPos; public LobbyFlow flow; public StickLocomotion loco;

        void Start()
        {
            if (flow.board != null) flow.board.Build(viewerWorldPos);
            if (flow.screen != null) flow.screen.Build(viewerWorldPos);
            flow.Wire();
            loco.canStand = flow.CanStand;
            loco.onWalk = flow.OnWalk;
        }
    }
}
