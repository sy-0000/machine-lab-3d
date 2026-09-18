# LATHE LAB｜16K20 互動車床教室

本專案在既有 Vite + React 19 + Three.js + React Three Fiber 9 + Drei 上修改，保留響應式深色介面、滑桿、RPM、警告、重設與測試架構；不需要後端或資料庫。

## 安裝與執行

Node.js 22.12+ 或 20.19+，在 `Assets/lathe-learning` 執行：

```bash
npm install
npm run dev
```

開啟終端機顯示的網址（通常 http://localhost:5173/）。正式模型唯一來源：

```text
public/models/lathe_16k20_dark_green_no_backboard.glb
/models/lathe_16k20_dark_green_no_backboard.glb
```

舊模型已不在 public/models，載入器沒有舊檔案或合成車床 fallback。GLB 只載入一次，不隨 React 重繪複製。缺檔顯示錯誤；部分零件缺失時只停用其操作及連動滑桿，列出節點名稱，其餘功能仍可使用。

## 零件盤點與集中設定

- [完整場景盤點 JSON](reports/model-inventory.json)：名稱、父節點、子節點、Mesh、材質、世界包圍盒、中心、尺寸與未掛入場景的節點。
- [零件對照與人工確認紀錄](reports/part-mapping.md)：每個輪身、握把、軸、Pivot、主軸／夾具、拉桿、行程與隔離截圖。
- [機器可讀對照表](reports/part-mapping.json)。
- `src/latheParts.js` 是正式執行使用的 `LATHE_PARTS`、`MECHANISMS`、`AXES`、`SPLITS` 唯一設定來源，不用附近座標自動把物件納入主軸。

GLB 檔案有 182 筆節點與 172 筆網格；實際場景可達 180 個節點、170 個 Mesh。`Object_159`、`Object_160` 為原檔標示移除的背板節點，仍留在 GLB 記錄中但未掛入場景。不要為了湊數重新顯示它們。GLTFLoader 將空白群組名稱轉成底線，例如 `DetailItem Cutting Platform` → `DetailItem_Cutting_Platform`；`Object_XXX` 名稱不變。

重新產生盤點和對照：

```bash
node scripts/inventory.mjs
node scripts/report-mapping.mjs
```

腳本讀取真實 GLB 頂點、索引和變換；Node 端只略過貼圖解碼，材質與貼圖的真實載入由瀏覽器驗證。

## 手輪與握把

| 功能 | 輪身來源 | 握把來源 | 旋轉軸 | 原 GLB 世界 Pivot |
| --- | --- | --- | --- | --- |
| 縱向 | Object_117::wheelBody | Object_117::gripRim | Z | (0.0791843, 0.4864774, 0.349) |
| 橫向 | Object_107 | Object_109 | Z | (0.0791951, 0.6833978, 0.397) |
| 高度 | Object_145::wheelBody | Object_145::grip | X | (0.407, 0.7619079, 0.0566564) |
| 尾座 | Object_68、Object_70、Object_72 | Object_189 | X | (1.038285, 0.8525885, -0.0216612) |

`::` 表示從真實來源 Mesh 的索引分區建立的子 Mesh，不是原檔名稱。縱向輪沒有獨立凸出握把，使用其原有外緣握持面；高度旋鈕的握把連在 Object_145 中。每個來源三角形只分配一次，沒有新增頂點或虛構握把。橫向手輪的實際輪面在 XY 平面，所以軸是 Z，沒有套用未經檢查的 X 軸假設。

四個 Pivot 均有自己的 Wheel 和 Handle 群組，以 `Group.attach()` 掛接前後比較世界矩陣，誤差大於 1e-6 會中止，不允許外觀跳動。模型世界座標 X 沿床身、Y 向上、Z 朝前；畫面將整台模型置中，所以檢查器當前世界座標與上表原 GLB 座標相差置中位移。

## 操作

- Hover 可操作輪顯示繁體中文 Tooltip（fixed、pointer-events:none）並高亮整個輪與其握把。
- 左鍵按住負方向旋轉，右鍵按住正方向旋轉；不再依滑鼠拖曳距離決定方向。短按有 ±0.06 rad 的最小步進，持續按住以 `direction × rotationSpeed × delta` 轉動。
- 縱向、橫向與尾座輪速度 2.4 rad/s，高度輪 2 rad/s。角度可累積多圈，到行程端點時輪與滑座一起停止。
- 移動只由「模型初始 position + 正式 state 偏移」套用；角度積分後推導位移，不直接累加 Three.js position。滑桿與手輪雙向同步。
- 手機第一次點擊顯示說明，第二次按住操作；面板可選擇「觸控向左／向右」。換輪需先點選新輪。
- Hover 不停用 OrbitControls。按住手輪或按下拉桿才停用；放開、取消、失去 Capture、視窗失焦、重設及卸載皆恢復。
- 使用 canvas 原生 Pointer Events capture phase，先於 OrbitControls 處理。右鍵選單只在手輪操作時阻止；其餘 canvas 與頁面保留瀏覽器右鍵選單。空白處拖曳旋轉、滾輪縮放；右鍵拖曳平移（放開後可出現原生選單）。
- 場景使用 demand rendering；靜止時不持續重繪，按住手輪、主軸／拉桿動畫與相機操作時才持續更新。恢復動畫時不把閒置時間算成進給量。

## 主軸、夾具、工件與拉桿

```text
SpindlePivot                    X 軸，唯一主軸動畫節點
├─ Object_78::shaft
└─ ChuckAssembly
   ├─ Object_78::chuckBody
   ├─ Object_80                 三個夾爪
   └─ WorkpieceMount
      └─ DemoWorkpiece          使用者選擇裝上時才建立
```

主軸 Pivot：(-0.267, 0.8525885, -0.0216612)。Object_78 是軸與夾頭盤的一體網格，依已核對的前盤邊界分區；所有夾具、工件繼承同一主軸變換。機身、主軸箱、齒輪箱、防護罩、資訊板和引擎保持固定。

啟動拉桿：Object_12 桿、Object_38 球形握把，StartLeverPivot = (-0.4023504, 0.3522738, 0.3674505)，Z 軸；Object_10 固定支座不動。點擊拉桿或面板啟停按鈕共用同一請求狀態。拉桿用 0.3 秒由停止 0 rad 到啟動 -0.65 rad，到位後才加速至設定 RPM；停止以 900 RPM/s 平滑減速，停止後保留角度。面板顯示設定 RPM、實際 RPM、拉桿角度與過渡狀態。

「裝上示範工件」建立小型圓柱工件，只掛於 WorkpieceMount，不取代車床模型。啟動、減速或拉桿未歸停止位時，UI 與底層函式都禁止拆裝工件。執行中不重新建立夾具階層。

## 行程與警告

位置為模型單位，尚未校準為實際毫米。

| 操作 | 變換群組／實際軸 | 相對行程 | 每 rad 進給 |
| --- | --- | --- | --- |
| X 縱向 | CarriageAssembly / X | -0.24 ～ 0.38 | 0.018 |
| Y 橫向 | CrossSlideAssembly / Z | -0.065 ～ 0.065 | 0.0075 |
| Z 高度 | ToolHeightAssembly / Y | -0.015 ～ 0.035 | 0.003 |
| 尾座本體 | TailstockAssembly / X | -0.12 ～ 0.04 | 滑桿 |
| 尾座套筒 | TailstockQuill / X | -0.08 ～ 0 | 0.008 |

縱向帶動所有滑座與刀具，橫向帶動刀座，升降只作用於 Object_149、Object_150、Object_152、Object_154、Object_156、Object_157，不抬起大溜板。尾座輪不旋轉尾座本體，負方向使套筒向主軸伸出。

安全距離採刀座組合與工件（未裝工件則為夾具）的世界包圍盒間隙，包含所有祖先變換；小於 0.07 顯示黃警告，小於 0.02 顯示紅警告，只在實際主軸仍有轉速時顯示。也保留主軸運轉中操作刀具的黃色提示；紅色優先。這是教學限制，不是實機防撞。

重設立即停止主軸、RPM 回到 500、拉桿回停止位、所有輪角與平移回初始值、套筒回 0、清除 Hover/按住/選取、恢復相機控制並回到預設視角。主軸保留最後角度。

## 開發零件檢查器

右上方「零件檢查器」可隱藏。開啟後 Hover 顯示命中節點，點擊保留選取與高亮，顯示原 GLB 來源、操作分配、完整目前父鏈／所在群組子樹、世界中心和尺寸。缺少節點會列出。關閉恢復選取高亮；互動 Hover 高亮仍正常。材質只在需要時複製一次，離開或卸載恢復並清理資源，不污染共用材質。

開發模式加 `?inspect=1` 提供測試用唯讀 `window.__LATHE_DEBUG__`，含實際場景快照及可見命中座標。它只供測試讀取，沒有修改物件的 API，點選測試仍走真實 Pointer Events。射線取樣使用快取，按住期間不重新計算。正式建置不含檢查器或此快照。

## 測試、建置及部署

```bash
npm test
npm run build
npm run preview
```

PowerShell 瀏覽器測試（瀏覽器檔案留在專案內）：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright-browsers'
npx playwright install chromium
npx playwright test
```

單元測試直接使用真實 GLB 幾何驗證對照、Attach、Pivot、握把、方向、幀率獨立性、主軸／工件繼承、固定外殼、升降、限幅、重設、材質恢復及缺件降級。瀏覽器測試驗證真實貼圖載入、Tooltip、檢查器、左右按住、鬆手、contextmenu、OrbitControls、取消／失去捕捉、拉桿與面板、觸控、缺件和 Console。缺件測試只在測試回應中重新命名真實節點，不替換成假車床。

部署完整 `dist/`（含新 GLB）至靜態主機；Build command：`npm run build`，Output directory：`dist`。使用 `base: './'` 支援子目錄，網址以 `/` 結尾。無後端、無前端路由；透過 HTTP(S) 開啟，不直接雙擊 HTML。

最近驗證：13 項真實模型單元測試、8 項 Chromium 瀏覽器測試全部通過；另補測手機反向選擇器通過。`npm run build` 成功，仍有 Three.js 主包超過 500 kB 的建置大小提示。瀏覽器正常載入／提示／檢查器流程未記錄到 console error 或未捕捉例外。瀏覽器測試採桌面 Chromium 與觸控模擬，尚未替代實體手機驗證。

## 仍需人工確認

- 高度手輪的側向旋鈕外觀與支點可確認，但原 GLB 沒有實機機構語意；本版將其對應刀座高度作教學，需教師確認是否符合實機用途。
- Object_12 / Object_38 拉桿以外觀與位置選為啟停控制；實機用途與方向需確認。
- 縱向輪外緣是整合式握持環，沒有可獨立辨識的凸出手柄，未另外虛構零件。
- 安全距離採整個上方刀座的保守包圍盒，原檔未明確指定哪個網格是切削刃。
- 需核對各移動方向、行程與實機尺寸。新模型未附來源／授權，頁尾不再沿用上一個模型的 Oleg 署名，待使用者補齊。

Three.js `Group.attach()` 規格參考：https://threejs.org/docs/pages/Object3D.html
