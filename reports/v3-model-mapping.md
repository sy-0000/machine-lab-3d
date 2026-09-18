# 第三版：模型與互動修正

## 車床

- 從展示模型移除 `DetailItem_Lamp`、`DetailItem_Infomatin_Board`（含支柱）、`Object_193/195` 主軸黃色護蓋。原始 GLB 留作來源，移除清單在 JSON，網站場景不再包含這些物件。
- 左側原雙頭拉桿 `Object_34/36` 移除，保留 `Object_32` 底座，複製右側 `Object_28/30` 單桿外型放到左側。新 `LeftSelectorPivot` 的可選角度為 60、90、120、150 度，初始為 90 度；面板可直接選角度，點模型循環切換。未將這四段擅自綁定實機變速比。
- 啟動桿校正至軸套中心 [0.31396687, 0.506273, 0.274422]。向外（操作者方向、模型 +Z）撥動時正轉，向內撥動時反轉，中位停止。左鍵外撥、右鍵內撥，再點同方向會停止；手機面板提供外撥／內撥按鈕。反向切換會減速經過零速再反轉，腳踏急停仍立即煞停。
- X 最小 -0.14；「尾座 y」依沿床身的尾座位置解讀，最小 -0.278，沒有改動橫向刀具 Y 軸。尾座沿 GLB X 軸移動。套筒伸出由 -0.08 增至 -0.11。
- 新增背面 `TailTravelWheel`，位置 [0.81, 0.65, -0.30]，獨立 Z 旋轉軸，帶動尾座本體。原尾座手輪繼續控制套筒；兩者互不帶動輪角。

## 銑床

- 使用 `milling_machine_textured.glb`，保留新模型 422 個獨立零件。
- 從第一版原始 GLB 轉回材質、內嵌貼圖、UV 和法線。1,445,428 個三角形全部找到來源；其中 6 個重三角化面以同材質網格的三個精確頂點恢復屬性，沒有以空間距離猜機械分組。
- 最大對應頂點誤差 3.332e-8 模型單位；無未匹配面。數據見 `v3-material-transfer.json`。新檔約 190 MB，大小增加是因恢復貼圖及分面屬性，首次下載會比無材質版本慢。
- 後柱舊 GLB 本來缺底色：依 UV 島形狀與法線特徵，將附帶的 BaseColor.101／102 分別補回 Back_1018／Back_1022；其餘 Back_1019／1020／1021／1024 底色檔缺失，採相近灰綠漆色並保留原法線。這四個材質無法宣稱完全還原原始鏽斑，需要補原檔才能精確恢復。
- 新增 `ZLiftWheel` 教學手輪，位置 [0.43, 0.40, -0.22]，獨立 X 軸 Pivot，帶動 Knee_Z_Slide 與工作臺升降。
- 將 `Head_Part_023` 可見單桿作啟動握桿，Pivot [0.315, 1.748, 0.110]，繞 X 軸撥動 0.5 rad。既有 `Head_Part_071` 機身開關也可啟停。
- 新增手輪位置／尺寸、握桿作啟停的用途及行程導程均是使用者要求的教學配置，仍需實機教師校正；原合併膝座鑄件仍固定。

## 鑽床

- 遺留的工作臺鎖緊握把藏在 `HeadInternalSupport` 的連通元件 3、4，共 390 個三角形，現拆為 `TableClampHandle`。
- `SurfaceDetailsAndLabels` 中工作臺表面細節（元件 25，84 個三角形）另拆為 `TableSurfaceDetail`。
- 兩者均掛到 `TableAssembly`，原始 UV 與材質保留。抬高工作臺 0.12 時，握把和細節同步移動 0.12；機头與線材不移動。拆分使用檢查後的三角形清單，沒有將整個機頭或電線搬到工作臺。

## 設定位置

- `public/models/lathe_parts.json`：removeNodes、extraWheels、actions、additions、axes。
- `public/models/milling_split_controls.json`：新材質 GLB、Z 手輪、啟動握桿。
- `public/models/drill_press_parts.json`：geometrySplits、reparents。
- `src/machines/modelEdits.js`：共用明確拆分、移除與新增教學幾何。
- `src/machines/runtime.js`：四段定位與正反轉動畫。

原始 GLB 與 v1/v2 Git 紀錄可追溯；一鍵設定產生器為一次性遷移，不應再次覆寫已校正的 JSON。
