# Machine Lab 細節修正

## 功能與節點

| 項目 | 修改 |
| --- | --- |
| 車床雙轉速桿 | `LeftSelectorPivot`、`RightSelectorPivot`；各四段，左鍵逆時針、右鍵順時針，每次 45°，端點不循環。 |
| 轉速組合 | 左桿 125／250／375／500，右桿 ×1／×2／×3／×4；125～2000 RPM。重設為第二段 ×2，即 500 RPM。所有數字是教學設定。 |
| 扇形刻度 | 每桿四格，標示該卡位對應的 RPM，選中格為綠色；倍率或段位改變時更新。Canvas Texture 由模型資源清理程序釋放。 |
| 殘留附件 | `DetailItem_Air_Blower`（包含支架及延伸管線 `Object_207`）和右側 `Object_162` 立柱隱藏。先前圖紙架、燈及護蓋也改成保留節點、設定 `visible=false`。 |
| 腳踏煞車 | 漸進减速到零，踏板約 0.35 秒回位；不鎖定，可直接用啟動桿或按鈕重新啟動。 |
| 刀座底層 | `Object_103` 原有 3596 個三角形，其中下層 1758 面拆為 `ToolPostFixedBase`，掛到 `CrossSlideAssembly`，不參與高度或分度。來源 GLB 不修改。 |
| 刀座中心柱 | 新增半徑 0.044 的 `ToolPostColumn`，底端維持在滑座，頂端跟隨高度；兩個封面補合拆分開口。升高 0.06 時仍有完整支撐。 |
| 尾座手輪 | `TailTravelWheel` 的軸長由 0.18 縮到 0.125，背面位置從 Z=-0.30 收到 -0.245，改為黑色。 |
| 銑床啟動桿 | 隱藏 `Head_Part_023`，將右側下方黑色球頭桿 `Head_Part_021` 掛到 `MillingRightLever`。原機身電源開關保留。 |
| 鑽床進給 | 旋轉軸改為 -X，下降與彈簧回位行程維持原值；`FeedShaft` 改掛到 `FeedHandlePivot`，軸心與三支握柄一起旋轉及高亮。 |
| 鑽床開關 | 改選 `SwitchBody` 實體開關；`SwitchLever` 實際為周圍面板，保持固定且不註冊互動。 |

`MachineModel` 的 `useFrame` 仍把 delta 交給 `runtime.js`；減速、踏板回位及進給皆依 delta 更新。隱藏物件從射線結果排除，避免看不到的附件遮住可操作零件。

## 驗證

- 修改前及修改後執行 `npm run audit:models`，三台均無缺少節點或掛接錯誤。
- `npm test`：27 項通過。含 16 種轉速組合、兩桿獨立與端點、30/144 FPS 煞車一致性、停止後重啟、固定刀座底層、中心柱行程、隱藏物件射線、鑽床軸心及開關範圍、銑床替代握桿。
- `npm run build`：成功。Three.js 共用頁面仍有原本的大型 bundle 提示。
- 瀏覽器測試：17 項已全部通過驗證（首次 14 項通過，3 項於停止並行截圖及程式更新後重跑通過）。兩個長流程車床案例設為 240 秒上限，保留所有斷言；其中雙桿案例實際以滑鼠逐次驗證左／右鍵、端點限制、運转中轉速及煞停後重新啟動。

## 近距離檢查

- [雙桿與扇形刻度](refinements-cams.png)
- [刀座升至最高與中心柱](refinements-tool.png)
- [銑床右側桿位置](refinements-right-lever.png)
- [鑽床開關本體](refinements-switch.png)

重現截圖：先以 `npm run dev -- --port 5173 --strictPort` 啟動，再設定專案內 `PLAYWRIGHT_BROWSERS_PATH` 並執行 `node scripts/capture-refinements.mjs`。檢視頁僅為開發工具，不納入 dist。

## 截圖路徑異常紀錄

檢查過程曾將四張初步截圖寫到工作區根目錄的 `reports/`，已移回本專案。另一支截圖程式曾因未解碼 URL 中文路徑，誤寫四張圖片至下列工作區外的編碼路徑：

```text
C:\Users\amy20\OneDrive\%E6%A1%8C%E9%9D%A2\%E6%95%99%E6%9D%90\Assets\lathe-learning\reports\
refinements-cams.png
refinements-tool.png
refinements-right-lever.png
refinements-switch.png
```

程式已改用 `fileURLToPath`，專案內圖片已重新產生。依使用者禁止操作工作區外路徑的限制，沒有進一步讀取或清理外部複本。
