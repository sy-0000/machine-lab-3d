# Level 1 — 槌柄－基礎車削

目前已整合至 [槌柄 Campaign](HANDLE_CAMPAIGN.md)，以下為既有十步 Session 的技術說明。Campaign 的 L1 僅檢查基礎減料／端面操作與名義總長 240，不再要求 Ø16.3 等徑範圍；Ø16.3／Ø9.3 由 L2 錐段量測。操作紀錄可進入下一關，但缺少公差時不宣稱圖面合格。Retry 與本機存檔以 Campaign 文件為準。

從 Levels 頁面的「開始 Level 1」進入 `#/level/handle-basic`。`#/lathe` 維持自由加工。

`LevelDefinition.js` 驗證並凍結 JSON 設定；`level1.js` 設定毛胚、要求、步驟與提示；`LevelSession.js` 持有每次嘗試的獨立 working copy，觀察同一個 MachineSession 的成功命令與實際更新。它不持有 Three.js node、不寫 profile、不建立另一個時鐘或切削器。MachineSession 的可選 `observe` 不改變原有 UI 訂閱／更新語意，離開關卡時解除。

開始時建立 Ø20 × 300 mm 的獨立未裝夾副本；按「裝夾本關毛胚」透過既有 `workpiece.mountState` 裝夾，沿用自動刀尖中心高校正。其他步驟不自動移動刀具。主軸須 running 且實際 RPM > 0；外圓接觸由刀尖位置、局部半徑與中心高判定；端面接觸由刀尖位於目前自由端平面及端面半徑內判定。X/Z 對刀須在對應接觸時送出成功歸零命令，並核對實際 offset 與工件讀值。清除／重新設定基準會撤銷受影響的後續步驟。

加工操作步驟要求 Z 設零後的真實 `profile-cut` 與 `face-cut` 歷史及 lengthMm 實際縮短，之後可停機檢查尺寸。停機須 running=false、RPM=0、主軸桿回到停止位置。操作完成不等於尺寸驗收通過：最後檢查須所有必要 target 已確認、整段直徑與長度皆在公差內，且流程完成才可通關。draft 永不 pass。已完成後若繼續啟動或加工超差，完成狀態會撤銷。

Ø16.3 對應 radiusMm=8.15、初始單側切深 1.85 mm；幾何只由既有 CuttingSimulation 修改。`setup.contactEpsilonMm` 僅供接觸判定，絕不代替尺寸公差。驗收使用 `abs(actual-target) <= tolerance`，僅消除 JavaScript 浮點運算誤差，不添加隱含工程公差。

**尺寸來源：** 使用者提供正式工程圖，詳見 [圖面規格](hammer-drawing-spec.md)。毛胚 Ø20×300；圖面確認總長 240、錐段大端 Ø16.3。等徑基礎車削範圍與正式公差尚待確認。

`level1.js` 的 targets 保存 diameterMm=16.3、finalLengthMm=240，其餘範圍／公差為 null；confirmation 逐欄標記確認狀態。直徑與長度可獨立驗收，不因另一項 draft 而停止量測；全部必要項目合格才 pass。測試中的範圍／公差／299 mm 等為合成 fixture，並非圖面尺寸。實體 Z 與圖面 datum 的轉換及待確認裝夾方案見圖面規格。

`measureWorkpiece(WorkpieceState, targets)` 是唯讀尺寸 API，不讀玩家輸入、offset、畫面讀值或操作歷史。直徑=radiusMm×2，長度來自 lengthMm。Z 使用工件實體後端零點，不隨 X/Z 對刀改變。對 `[start,end)` 內所有相交 profile 分段（包括非整格邊界）量測最小／最大直徑、兩端有號誤差及覆蓋長度；不得用平均值或單一點代表整段。未切分段保留在量測中。若工件被削短而未覆蓋完整要求區間，標示 incomplete-range，不能因剩餘分段達標而 pass。

有確認公差時：低於下限為 overcut；公差內為 within-tolerance；高於上限為 not-yet-to-size（直徑偏大／長度偏長，尚未切足）。relation 另外標示 under-target／on-target／over-target／mixed：低於名義值但仍在公差內不等於過切。範圍外不套用這段外徑要求。未知公差或範圍时 status=draft、overcut=null，不能宣稱無過切；沒有範圍時不產生外徑驗收值／誤差，只另列「已切削區直徑參考」，不偷偷使用整支毛胚。API 不修復、覆寫或裁切任何工件資料。

最後檢查表顯示目標／實際／誤差／狀態與過切狀態，實際與誤差以區間極值呈現。Retry 清除量測結果與加工資料，下次檢查重新讀取毛胚。沒有分數、星級或排名。

Retry 使用既有機台 reset 停機、復位、清除基準，再卸下失敗工件，恢復獨立初始毛胚副本、清除所有步驟及結果，回 Step 1 等待重新裝夾。失敗 profile 不會帶到下一次嘗試。正式關卡隱藏自由存取／替換工件與開發者控制，並拒絕讀寫自由加工存檔；暫不持久化正式關卡進度。

人工練習例（非圖面尺寸）：裝夾 → 啟動 → X20 接觸／X 歸零 → X4 退刀 → Z301 → X0 → Z300 接觸／Z 歸零 → X4 → 端面模式 → Z−1 → X−20 掃到中心 → X4 → 外徑模式 → Z−100 → X−3.7 → Z−90 → 停機 → 檢查。以上數字移動真實刀尖，並非指定加工結果；亦可用既有手輪連續進給。
