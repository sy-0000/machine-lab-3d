# 自行決定紀錄

格式：問題／選擇／理由／如何回復。

## D1 找不到 docs/quest-evaluation.md 與 docs/perf/
- 問題：任務說要先讀 docs/quest-evaluation.md，並參考 docs/perf/ 量測腳本，但 origin/feature/webxr 與 origin/main 都沒有這兩個路徑（`git log --all -- docs` 只有 xr-plan.md 與 製作說明.md）。
- 選擇：改以 docs/xr-plan.md、docs/製作說明.md 與實際原始碼盤點場景；遷移計畫中的難度與場景清單以程式碼為準。
- 理由：檔案不存在，無法讀取；不憑空編造內容。
- 回復：若檔案在別處（例如未推送的本機分支），推上來後可補進遷移計畫的對照表。

## D2 分支名稱
- 問題：任務指定分支 unity-export；雲端 session 另外指定了開發分支 claude/charming-turing-mck0zz。
- 選擇：在 unity-export（由 origin/feature/webxr 建立）上開發並推送；內容同步也推到指定的 claude 分支作為備份（見最終回報）。
- 理由：使用者明確要求 unity-export。
- 回復：刪除遠端多餘分支即可，不影響 main / feature/webxr。

## D3 匯出檔案寫入方式：Vite dev 外掛 POST，而非瀏覽器下載
- 問題：要求輸出到 exports/，但瀏覽器下載會進「下載」資料夾、且一次下載 30 個檔案會被攔。
- 選擇：vite.config.js 加 `export-sink` 外掛（`apply: 'serve'`，只在 dev server）接收 POST 寫進 exports/；連不到時退回瀏覽器下載。
- 理由：使用者不用搬檔案；正式建置不含此外掛（`npm run build` 驗證過）。
- 回復：移除 vite.config.js 的 exportSink 與 plugins 裡的呼叫即可。

## D4 InstancedMesh 一律展開成一般 Mesh（上限 5000 實例）
- 問題：GLTFExporter 可用 EXT_mesh_gpu_instancing，但 Unity glTFast 對它支援依版本而異。
- 選擇：展開成共用幾何與材質的獨立 Mesh（名稱 `原名_i`），並在 manifest／報告列出實例數。逐實例顏色（instanceColor）不帶，會警告。
- 理由：保守、相容；代價是節點數暴增（workshop_static 約 7300 節點）。Unity 端可再合批。
- 回復：exportTool.js 的 `expandInstanced` 改成不處理即可（讓 GLTFExporter 輸出實例化擴充）。

## D5 工作室需要 ?nobatch 才能保留名稱
- 問題：工作室預設用 `batchStatic` 把靜態網格依材質合併成 `Batched_*`，名稱與階層消失。
- 選擇：不改既有行為；匯出時網址加 `&nobatch`（既有參數），匯出工具偵測到 `Batched_*` 會在 manifest 警告。
- 回復：無需回復。

## D6 單件工具與 toolbox 分開
- 選擇：`toolbox_static/interactive.glb`（工作桌、箱子、13 件工具在箱內位置）＋ `tools/tool_<id>.glb` 13 個以工具中心為原點的單檔。
- 理由：Unity 端展示工具要獨立 prefab；箱內版本保留 0.36 倍縮放階層以對回 DeskToolbox。

## D7 「互動」的判定
- 選擇：InputManager 登記的物件（新增唯讀 `targetObjects()`，不影響行為）＋ `userData.dynamic/noBatch` ＋ 名稱規則（門、金庫門、牆面齒輪、閥門手輪、瞬移圓盤）；機台用 config 正規化後的 axes／wheels／spindle／lever／toggle／actions／extraGroups／additions 節點名稱。
- 風險：工作室裡有些「會動但未標記」的小零件（例如由 updaters 驅動、沒有 userData.dynamic）可能留在 static。這類請看 manifest 的 `interactiveReasons` 對照，階段 2 以後再補規則。

## D8 glb 不做 meshopt／不壓縮
- 選擇：GLTFExporter 原樣輸出（貼圖為 PNG，最大 2048）。總量約 220 MB，僅作 Unity 匯入來源，不上網站、不 commit。
- 回復：需要小檔時用 gltf-transform 的 `optimize`／`meshopt`（repo 已有 devDependency）。

## D9 匯出的 glb 不 commit；manifest 範例只 commit 精簡版
- `docs/export-manifest-example.json` 由 `scripts/export-report.mjs` 從真實 manifest 產生，長清單只留前 5 筆。

## D10 機台 glb 為 Git LFS
- 問題：`*.glb` 走 LFS，雲端 checkout 只有 132 byte 指標檔，工作室載入失敗。
- 選擇：在本 session 執行 `git lfs pull`（不改 repo）；測試說明加入 `git lfs pull` 步驟；記錄於 known-bugs #3。

## D11 階段 2 在雲端只能備檔，不能驗證
- 問題：階段 2 需要 Unity 編輯器與 Quest 3，雲端沒有。
- 選擇：在 `unity/MachineYard/` 放專案骨架（套件清單、Editor 設定腳本、門外場景建置腳本、大門互動、FPS 顯示）與 `unity/README.md`；明確標示未編譯、未實機驗證。使用者選擇階段 1 與 2 完成後一起測。
- 理由：先把能預先備好的做完，減少來回；不宣稱已通過驗收。
- 回復：刪除 `unity/` 資料夾即可，不影響網站。

## D12 座標轉換集中在 ThreeCoords，預設 NegateX 且可切換
- 問題：不確定 glTFast 的手性轉換是取負 X 或取負 Z，無法在雲端驗證。
- 選擇：所有手寫座標（站位、燈光）都經 `ThreeCoords`，一行切換；README 的驗收項有檢查方式。
- 回復：改 `ThreeCoords.Mode`。

## D13 光照暫不烘焙
- 選擇：階段 2 先用即時日光＋環境光量 fps；烘焙需先替網格產生 lightmap UV，留到實機數字出來再做（README 已列）。
