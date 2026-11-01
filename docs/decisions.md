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

## D14 階段 3 的移動／瞬移不用 XRI 內建 provider
- 問題：Starter Assets 的 Move/Turn/Teleportation 與網站規格（左手 1.6 m/s 平滑、右手快速轉 30°、拋物線只能落在圓盤、可站範圍）差異大，且 XRI 版本間 API 常變。
- 選擇：自己寫 `StickLocomotion`／`StickTeleport`（直接讀 InputSystem 的搖桿），場景建置時依型別名稱停用內建 provider。
- 理由：行為精準對齊 `Locomotion.js`／`Teleport.js`，不依賴 XRI provider API。
- 回復：刪掉兩個腳本，改回 Starter Assets 預設 provider。

## D15 放映幕用「佔位計時／影片」
- 問題：三段動畫是 `public/previews/*.anim.js` 的 canvas 程式繪圖，無法匯出，也不能直接在 Unity 跑。
- 選擇：支援每段指定 VideoClip；未指定時 12 秒佔位計時讓解鎖流程可測。請你決定是否預錄影片（遷移計畫的待確認項目）。
- 回復：無。

## D16 告示板一節一頁
- 選擇：不複製網站的逐行排版與續頁；4 節都很短，用 TMP 自動縮放。進度的 pages 數＝節數（4），與網站（依排版算頁）可能不同；兩邊進度存檔互不相通，沒有影響。

## D17 簡易選單只是測試用
- 選擇：左手 Y 的簡易選單（回門外／回玄關／存檔狀態／DEV 解鎖重置）；翻牌板風格選單留到階段 5。

## D18 匯出工具原本把「隱藏節點」也匯出了（我自己的錯，已修）
- 問題：移植車床時發現，網站用 `visible=false` 隱藏舊零件（lathe_parts.json 的 hideNodes），glTF 沒有顯示旗標，匯出後它們在 Unity 會看得見。
- 選擇：匯出時略過 `visible === false` 的節點並記入 manifest。車床靜態 196,254 → 85,272 三角形。所有匯出重跑，`docs/export-report.md` 以新數字為準。
- 回復：移除 `skipReason` 開頭的 visible 判斷。

## D19 把純數學拆成 Core，並在這裡真的編譯、比對
- 問題：階段 4 的風險集中在車床數學（切削、行程、主軸），但 Unity 無法在雲端執行。
- 選擇：數學放 `Assets/Scripts/Core`（無 UnityEngine 依賴，asmdef `noEngineReferences`），用 dotnet 編譯，並用網站 JS 產生的 `golden.json` 比對（79k 項，且做過突變測試確認測試有鑑別力）。其餘腳本用手寫 Unity API 替身做型別檢查（替身不納入 repo）。
- 回復：Core 以外的程式與它無耦合；刪 `unity/MachineYard.CoreTests` 與 `scripts/unity-golden.mjs` 即可。

## D20 車刀與工件
- 車刀（TurningTool 與刀片尖端 `cuttingTipLocal`）本來就在匯出的機台 glb 裡；工件是執行期程式產生的，所以 Unity 也在執行期用 Core 的狀態建網格（掛在 runtime.json 的 WorkpieceMount 設定上）。`alignCuttingTip`（掛工件時把刀尖高度對準中心）照網站移植。
- 工件預設是網站的「槌柄」（半徑 10、長 300 mm）；其他工件形狀（銑床、鑽床的高度場）在階段 5。

## D21 機台面板簡化
- 選擇：左手 X 叫出、釘在原地的簡易面板，而非翻牌板風格的「機台」分頁（那是階段 5 的 3D UI 重做）。功能涵蓋網站「機台」頁的車床項目。

## D22 三角形預算與小零件
- 問題：工作室＋車床＋工具箱約 105 萬三角形，Quest 3 72 fps 很可能撐不住。
- 選擇：不在匯出端先簡化（保留完整資料），Unity 端預設停用 5 cm 以下裝飾零件（可調），其餘由實機 fps 決定要簡化什麼。
- 回復：`WorkshopBuilder.TinyDetailMeters = 0` 即不停用。

## D23 光源換算
- 選擇：three.js 的光強度乘以 0.25（點光）／0.5（日光）作為 Unity 初值，無烘焙；實機調整。

## D24 銑床／鑽床沿用 LatheMachine
- 問題：階段 4 的 `LatheMachine` 其實是設定檔驅動的通用機台（軸、手輪、主軸、拉桿），三台共用同一份資料格式。
- 選擇：不改名、不拆類別，只擴充（toggle 開關、彈簧手柄、套筒延伸、教學比例）；車床專屬的切削在 `LatheCuttingController`，銑床／鑽床在 `HeadMachining`。
- 回復：若之後想改名，全專案搜尋 `LatheMachine` 即可（含 WorkshopBuilder）。

## D25 三台機台各建一份、同時只啟用一台
- 問題：網站的工作室只載入一台機台（選單換機台才重載）。
- 選擇：Unity 三台都先建在場景裡、只啟用一台（停用的不繪製也不更新）。優點是換機台立刻完成；代價是記憶體（三台 glb 都載入，約多 200 MB 貼圖／網格）。
- 回復：記憶體吃緊時，改成換機台時才實例化（`MachineSwitcher.Run`），Builder 改存成 prefab。

## D26 翻牌板風格 3D UI 不重做
- 問題：階段 5 原計畫含「最終 3D UI」。
- 選擇：保留簡易面板（Y 選單、X 機台面板、工具說明面板）。功能對齊，外觀不是網站的翻牌板（黃銅按鈕、琺瑯面板）。翻牌板需要字型資產與大量貼圖美術，先看實機操作手感再決定投入。

## D27 Unity 端的 float 精度處理
- 問題：工作室放在世界座標 x = 200 m（避免與玄關重疊），float 在那裡只有約 0.015 mm 的精度；直接用 `TransformPoint` 量刀尖會有雜訊。
- 選擇：刀尖座標用局部座標鏈換算（`LocalSpace`，不經世界座標），並量化到 1 µm。鑽孔／攻牙要求「純軸向進給」，Core 的容許是 1e-7 mm（JS 的 double 能做到），Unity 端把橫向漂移 < 0.01 mm 的位移視為 0。
- 回復：想更精確可把工作室移到世界原點（`Stations.WorkshopOffsetThree` = 0，並把玄關移開）。

## D28 光束與其他匯出時略過的特效
- 問題：SunBeam（自訂 shader）、FireboxSparks、玄關蒸汽噴口匯出時被略過，manifest 沒有位置。
- 選擇：階段 5 先做不需要位置資料的特效（切屑、火花、機台過場蒸汽、工具升起蒸汽、灰塵、門栓與壓力錶蒸汽）。其餘列為後續：擴充匯出工具記錄位置後再重做。

## D29 存檔格式
- 選擇：`format` 欄位沿用 SaveSlots（lathe-profile／heightfield）；payload 是 JSON，載入時嚴格驗證（版本、尺寸、數值範圍、孔與牙的一致性），壞檔回 null 不崩潰。覆蓋已有工件需 3 秒內連按兩次。
- 回復：格式有 `version` 欄位，之後改格式在 `WorkpieceDto.FromDto` 依版本遷移。

## D30 刀具與機台原有教學刀具
- 選擇：5 支槌頭刀具用程序化圓柱組成（形狀比網站簡化：沒有螺旋刃與刀片細節），尺寸、刃長與網站完全一致（碰撞與切削只看這些數字）。機台 glb 內原有的 FaceMill／TwistDrill 隱藏。

## D31 互動改用自己的射線指標（不用 XRI Interactor）
- 問題：XRI 的 Activate（trigger）只送給「已被 grip 選取」的物件，單按 trigger 不會觸發；Starter Assets 的 Select 是 grip。結果是拉桿 trigger 無效、所有按鈕要按 grip，與網站相反。
- 選擇：`XrPointer` 自己從控制器 aim pose（OpenXR pointerPosition／pointerRotation）做 Physics.Raycast，找 `PointerTarget`：trigger＝點擊、grip＝抓住（手輪、工具）或反向（拉桿）。場景建置時停用 rig 的 XRI Interactor 與射線外觀；震動改用 Input System 的 `XRControllerWithRumble.SendImpulse`。
- trigger 在「按下」時就觸發（網站是放開時仍指著同一物件才算）：VR 手會晃，按下即觸發比較不會漏按。
- 回復：想改回放開才觸發，在 `XrPointer.Update` 把 `WasPressedThisFrame` 改成記住按下的目標、`WasReleasedThisFrame` 時比對。

## D32 移動方式與舒適度
- 選擇：①平滑走動與平滑轉向時顯示視野暗角（預設開）；②「只用瞬移」模式；③自由瞬移到任何可站立的地板（圓盤仍優先，進工廠後才有）；④握著手輪／工具時暫停走動、轉向與瞬移；⑤轉向可選快轉 30°／45°／平滑 90°/s。設定在左手 Y 選單，存在 PlayerPrefs。
- 自由瞬移保持目前面向；圓盤會轉向機台（網站規則）。

## D33 中文字型
- 選擇：Noto Sans TC（SIL Open Font License 1.1，免費可商用可再散布），子集化成靜態 wght 500 的 TrueType（`scripts/unity-font.mjs`，收網站 VR 用字＋Unity 程式與資料檔的所有字，約 1,070 字、362 KB），附 OFL.txt。Unity 選單 0b 轉成 TMP 字型資產（SDF、可動態補字）。
- 字型內部名稱仍是「Noto Sans TC Thin」（子集工具沿用預設實例名稱），實際筆畫是 500；不影響顯示。
- 回復：改字或改字重後重跑 `node scripts/unity-font.mjs` 與選單 0b。

## D34 只支援 Quest 3
- 選擇：Target Devices 只勾 Quest 3；畫質預算以 Quest 3（XR2 Gen 2）為準，不為 Quest 2／3S 降級。

## D35 放映幕影片
- 選擇：用無頭 Chromium 執行網站的 `AnimationScreen.js`（與 VR 版同一份繪圖與排版），固定 1/30 秒步進逐格擷取，ffmpeg 編成 H.264 MP4（1280×800、30 fps、CRF 24，三段共約 4 MB），commit 在 `unity/MachineYard/Assets/Videos/`。影片結尾已含網站的 1.6 秒停頓，所以 Unity 端播完不再另外停。
- 「暫停中」字樣等互動狀態不在影片裡（暫停時畫面停住即可）。
- 回復：網站動畫改了就重跑 `node scripts/record-previews.mjs`（需先 `npm run dev`）。

## D36 金庫門往外開
- 問題：使用者要求進工廠的門往外開（網站是往內、朝工作室開）。往外開時門扇（半徑 1.12 m、鉸鏈在左緣）會掃過站在門前（z 12.1，距門面 1.5 m）的玩家。
- 選擇：開門前先淡出、把玩家退到 z 13.3（門扇掃不到），再播完整開門動畫（手輪轉 → 門栓收回噴蒸汽 → 門往玄關方向轉開 100°）→ 進工廠。從工作室走回來時門是開著的，在玩家面前關上（倒放、約 2.5 秒）；從選單回玄關則直接回到關閉，下次進去還能看完整開門。
- 網站版沒有改（仍往內開）；要一致需你同意。
- 回復：`VaultDoorController.Start` 的 `Direction(0, 0, 1)` 改回 `(0, 0, -1)`，並拿掉 `LobbyFlow.OpenVaultAndEnter` 的退後。

## D37 工作室出口門
- 選擇：工作室 +Z 端（工作桌後方）的拱門 ArchedDoor 可以 trigger 點擊：兩扇門往外推開 → 淡出 → 回到玄關金庫門外，金庫門在面前關上。門的零件在執行期依左右分到兩個鉸鏈樞軸下；整組排除在靜態合批之外。拱門太大，指到時不發亮。
- 網站版沒有這個出口（用選單回玄關）。

## D38 車床工件插進夾頭 40 mm
- 問題：見 known-bugs #5。
- 選擇：Unity 的工件掛點往夾頭內移 40 mm（`ClampInsertMm`），畫面上夾持區正好在夾爪內，和撞夾頭判斷一致。工件座標（Z、直徑）不變，DRO 與網站相同；刀具碰到工件自由端的位置比網站近 40 mm（縱向行程仍足夠）。
- 回復：`ClampInsertMm = 0`。

## D39 減面版本與遮擋剔除
- 選擇：`scripts/simplify-exports.mjs` 用 meshoptimizer 產生 50%（誤差 0.5%）與 25%（誤差 2%）兩個版本到 `exports/lod/`，節點結構與名稱不變。Unity 選單 Detail 切換、重建場景即生效；選單 6 烘焙遮擋剔除。機台可以降到約一半／四分之一；工作室只降 15–30%（三角形分散在上千個小零件，例如 1,296 個殼板鉚釘、251 根欄杆），那部分靠 `TinyDetailMeters`。
- 預設仍是 100%，等實機 fps 再決定。

## D40 Unity 組件參照（asmdef）
- 問題：自己檢查時發現 `MachineYard.Runtime.asmdef` 沒有參照 `MachineYard.Core`、Editor 沒有參照 Core 與 TextMeshPro；在 Unity 裡會編譯失敗（我原本的型別檢查把所有檔案放在同一個組件，所以沒抓到）。
- 選擇：補上參照；型別檢查改成照 asmdef 分成 Core、Runtime、Editor、Tests 四個專案分開編譯。

## D41 門的造型統一：拱形防爆鋼門（使用者選方案 1；只改 Unity，網站不改）
- 選擇：玄關的圓形金庫門換成拱形防爆鋼門（`Runtime/ArchedBlastDoor.cs`，程序化網格）：門洞寬 2.4、拱頂 2.65 m，外框 2.84 × 2.87 m（避開兩側壓力錶與上方指示燈，見 docs/images/blast-door-preview.png）。開門特效全部保留：中央黃銅手輪轉 → 7 支門栓（右緣 3 支、拱頂 4 支）收回噴蒸汽 → 門往玄關方向轉開 100°。門洞後是黑色面（開門後看到黑暗的通道）。
- 工作室出口拱門換成同一種鋼門（尺寸配合原本的石拱框：寬 2.22、拱頂 3.61 m），點門：手輪轉 → 門栓收回 → 門往外（通道）轉開 → 回玄關，玄關的鋼門在面前關上。兩邊都是拱形鋼門，和門外的拱形大門外形一致。
- 站位：鋼門較寬（2.4 m），開門時退後的位置由 z 13.3 改成 13.6（D36）。
- 原本的圓門零件（Frame、GearRing、DoorHinge）只是隱藏，壓力錶、指示燈、鎖住提示照用。
- 回復：拿掉 LobbySceneBuilder 的 `UseBlastDoor` 與 WorkshopBuilder 建鋼門的兩行，重建場景即回到圓門與木門。
