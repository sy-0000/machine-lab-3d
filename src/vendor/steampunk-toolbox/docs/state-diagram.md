# 互動狀態圖

```mermaid
stateDiagram-v2
    [*] --> BROWSE
    BROWSE --> BROWSE: 懸停工具（浮起＋描邊）/ 拖曳旋轉、縮放
    BROWSE --> LIFTING: 點擊工具
    LIFTING --> SHOWCASE: 升起動畫完成（約 1.2s）
    SHOWCASE --> SWITCHING: 下一項 / 上一項（→ / ←）
    SWITCHING --> SHOWCASE: 舊工具回盒＋新工具升起完成
    SHOWCASE --> RETURNING: 放回盒中 / Esc
    RETURNING --> BROWSE: 工具歸位、燈光與相機恢復
```

| 狀態 | 相機 | 燈光混合值 s | UI |
|---|---|---|---|
| BROWSE | OrbitControls（阻尼、限距、限俯角） | 0 | 無 |
| LIFTING | 緩動推近至展示視角 | 0 → 1 | 淡入 |
| SHOWCASE | 固定；拖曳改為旋轉工具 | 1 | 顯示 |
| SWITCHING | 固定 | 1 | 內容更新 |
| RETURNING | 緩動回到瀏覽視角 | 1 → 0 | 淡出 |

場景布局（單位 m）：工作台 3.6×2.2，頂面 y=0；工具盒 2.0×1.1×0.4 置中，盒蓋向後開約 105°；
磚牆 z=-1.6；愛迪生燈泡吊於 (0.55, 2.3, -0.35)；展示點 D=(-0.05, 1.1, 1.3)（工作台前緣上方，光錐不照到工具盒），聚光燈在 D 正上方。
