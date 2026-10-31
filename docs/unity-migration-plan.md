# Machine Yard → Unity（Quest 3 原生）遷移計畫

> 背景：WebXR 路線已放棄（Quest 3 實機：外牆 80 fps、玄關 62 fps、工作室 20–30 fps）。改以 Unity 原生 Quest 應用重建，目標 **72 fps**。
> 桌機版維持現有網頁；本計畫只涵蓋 Quest 版。
> 資料來源：`docs/xr-plan.md`、原始碼盤點、`docs/export-report.md`（實際匯出結果）。`docs/quest-evaluation.md` 與 `docs/perf/` 在 repo 中不存在（見 `docs/decisions.md` D1），難度估計以程式碼為準。

## 0. 場景與程式盤點（遷移的對象）

| 區域 | 內容 | 來源 | 匯出檔 |
|---|---|---|---|
| 門外 | 八角外牆、穹頂、玄關外殼、拱門與大門、煤氣燈、招牌、地面 | 程式產生（`src/xr/lobby/exterior.js`、`areas/Lobby.js`） | `exterior_static/interactive.glb` |
| 玄關 | 玄關內部、金庫圓門、工安告示板、放映幕、牆面齒輪、銅管與閥門 | 程式產生（`lobby/vestibule.js`、`vaultDoor.js`、`SafetyBoard.js`、`ProjectionScreen.js`） | `vestibule_static/interactive.glb` |
| 穹頂工作室 | 房間、穹頂、鍋爐、齒輪牆、書櫃…（約 30 件擺設） | 程式產生（`src/vendor/steampunk-workshop`） | `workshop_static/interactive.glb` |
| 工作桌與工具箱 | 工作桌、工具箱、13 件工具 | 程式產生（`vendor/steampunk-toolbox`、`xr/toolbox/DeskToolbox.js`） | `toolbox_*.glb`、`tools/tool_*.glb` |
| 三台機台 | 車床、銑床、鑽床 | 外部 glb（meshopt 壓縮），節點名稱由 `public/models/*.json` 引用 | `machine_<id>_static/interactive.glb`（或直接用原 glb） |

動畫全是程式逐格更新（沒有 keyframe）；8 個自訂 ShaderMaterial（天空、灰塵、火花、蒸汽、光束…）。

## 1. Unity 專案設定步驟

1. **Unity 6 LTS**（6000.0.x），用 Unity Hub 安裝並勾選 *Android Build Support*（含 OpenJDK、Android SDK & NDK）。
2. 新專案：**Universal 3D（URP）** 範本。
3. **Build Profile / Player Settings**：切到 Android；Minimum API Level 32（Quest 3 需求以 Meta 文件為準），Scripting Backend **IL2CPP**、ARM64 only；Graphics API 只留 **Vulkan**（拿掉 OpenGLES3）；Color Space Linear。
4. **XR**：Package Manager 安裝 `XR Plug-in Management`，Android 分頁勾 **OpenXR**，Features 啟用 *Meta Quest Support*、*Oculus Touch Controller Profile*；`XR Interaction Toolkit`（3.x）與其 Starter Assets（Samples）；`Unity OpenXR: Meta`（Foveated Rendering、Quest 專屬功能）。
5. **Render Pipeline**（URP Asset，Quest 專用品質層）：
   - Render Scale 1.0（先量，必要再降到 0.9）；MSAA 4x；HDR 關；Post-processing 關（Quest 不要用）；Depth/Opaque Texture 關。
   - 陰影：只留一盞主方向光（或完全烘焙）、Shadow Cascades 1、距離 ≤ 25 m；附加燈光陰影關。
   - **Stereo Rendering Mode = Single Pass Instanced**（OpenXR Settings → Render Mode）。
   - 開 **Application SpaceWarp** 作為後備（最後手段，需 Meta 擴充）、**Fixed Foveated Rendering** 中高。
6. **glTFast**：Package Manager → Add by name `com.unity.cloud.gltfast`。meshopt 壓縮的 glb：glTFast 內建支援 `EXT_meshopt_compression`（Unity 6 版需安裝其 *meshopt* 解碼擴充：`com.unity.meshopt.decompress`；兩者不裝則匯入器會報缺少擴充）。
   - 匯入方式：把 glb 放進 `Assets/Models/`，ScriptedImporter 轉成 prefab；材質由 glTFast 產生 URP Lit（Shader Graph `glTF-pbrMetallicRoughness`）。**一律在編輯器匯入並儲存成 prefab／材質資產，不要在 Quest 上執行期載入**（啟動時間與 GC）。
7. **光照改烘焙**：靜態場景（門外、玄關、工作室）全部標 *Contribute GI*，用 **Progressive GPU/CPU Lightmapper** 烘 lightmap + Light Probes；Reflection Probe 取代 three 的 PMREM 暖色環境（工作室一顆、玄關一顆）；即時光源只留：玩家附近的少數點光源（工具展示聚光燈、爐火閃爍）。
8. **Android 建置**：Meta Quest Developer Hub 打開裝置開發者模式；`File → Build And Run` 或 `adb install`；設定 *Texture Compression = ASTC*、*Strip Engine Code*、*Incremental GC*。

## 2. 逐項對照：glb 帶得過去 vs. 必須用 C# 重寫

難度：★ 簡單（≤ 1 天）、★★ 中（2–4 天）、★★★ 難（1–2 週）、★★★★ 很難（2 週以上或需要大量實機迭代）。

| 項目 | 處理方式 | 難度 | 說明 |
|---|---|---|---|
| 靜態幾何（牆、穹頂、擺設、地板） | **glb 直接帶** | ★ | `*_static.glb`，匯入後標 Static、烘焙。注意：三角形很多（工作室約 60 萬以上，見匯出報告），需在 Unity 做 LOD／合批／遮擋剔除 |
| 材質（PBR、貼圖、頂點色） | **glb 帶＋整理** | ★★ | glTFast 轉 URP Lit；CanvasTexture 程序貼圖已烘成 PNG；頂點色材質（磚牆髒污）要確認 shader 有吃 `COLOR_0`；合併相同材質、貼圖用 ASTC 壓縮 |
| 節點名稱／階層 | **glb 帶** | ★ | 名稱對回 `userData`／config 節點名稱；Unity 會自動為重複名稱補尾碼，以 manifest 的路徑為準 |
| 光源 | **C# 重建** | ★★ | glb 不帶光源；`manifest.json` 的 `lights` 記錄原參數。three 單位（intensity／decay）與 Unity 不同，需目測調整；改烘焙 |
| 天空、雲 | **重寫（Skybox/Shader Graph）** | ★★ | 自訂 ShaderMaterial，不匯出 |
| 特效 shader：蒸汽、火花、灰塵、光束 | **重寫（VFX Graph 不支援 Quest 的 compute；用 Particle System + 自製 Shader Graph）** | ★★★ | 8 個 ShaderMaterial 全部重寫；Quest 上粒子數量與 overdraw 是主要效能風險 |
| 程式動畫（齒輪、鍾擺、飛船、爐火閃爍、煤氣燈閃爍） | **C# 重寫**（簡單 `Update()` 旋轉／正弦） | ★ | 邏輯單純，節點在 `*_interactive.glb` 且已命名 |
| 大門／金庫門開關 | **C# 重寫**（Coroutine／Tween） | ★★ | 門栓收回 → 門轉開 → 淡出 → 載入下一區；glb 帶幾何 |
| 玄關流程＋進度存檔 | **C# 重寫** | ★★ | 工安告示板翻頁、三段切削動畫（放映幕）、壓力錶、指示燈；進度改存 `PlayerPrefs`／JSON（原為 localStorage `machine-lab:xr-progress`）；放映幕動畫是 `public/previews/*.anim.js` 的程式繪圖，需決定重畫或預錄成影片（建議預錄 VideoPlayer） |
| 機台零件幾何 | **glb 直接帶**（原 glb 或匯出檔） | ★★ | meshopt 壓縮需 glTFast＋解碼擴充；422 個零件（銑床）要確認匯入後 draw call，必要時合併靜態部分 |
| 機台控制與狀態機（主軸、行程限制、啟停、檔位） | **C# 重寫** | ★★★★ | `MachineSession`、`LatheController`、`runtime.js` 等；以節點名稱（config JSON）找零件、軸向與行程上下限；建議把與引擎無關的數學（`src/lathe.js`、`machining/*`）逐檔移植並沿用 `*.test.js` 的測試向量寫成 Unity Test Framework 測試 |
| 切削模擬（高度場／旋轉工件、切屑） | **C# 重寫** | ★★★★ | `CuttingSimulation`、`HeadCuttingSimulation`、`WorkpieceState`、`Chips`；網格即時重建，Quest 上要用 Job/Burst 或降低解析度；**是最大不確定性** |
| 手輪抓握與每格進給與震動 | **C# 重寫**（XR Interaction Toolkit 自訂 `XRBaseInteractable`） | ★★★ | `wheelGrab.js` 的角度累積與 tick（每 10° 進給、每 30° 震動）；`XRController.SendHapticImpulse`；需 Quest 實機調手感 |
| 瞬移與搖桿走動 | **C# 重寫**（XRI Teleportation／Continuous Move） | ★★ | 圓盤錨點位置見 `workshop/teleportDiscs.js`；可走範圍（八角牆內縮 0.6 m、機台與工作桌矩形禁區）用 NavMesh 或手寫 `canStand`；VR 不自動轉視角，沿用淡出淡入 |
| 3D UI（左手選單、機台頁、DRO 儀表、牌子） | **C# 重寫**（World Space Canvas＋TextMeshPro） | ★★★ | 原本是 CanvasTexture；中文字型需 TMP 字型資產（沿用 `xr-sans-tc`/`xr-serif-tc` 子集）；釘選、跟隨、翻牌板動畫都要重做 |
| 工具箱流程（拿起／展示／切換／放回、聚光燈變暗） | **C# 重寫**（狀態機） | ★★★ | `toolboxCore.js` 的 `createToolFlow`；13 件工具 glb 已單獨匯出；抓住轉動檢視用 XRGrabInteractable |
| 音訊（機台 3D 音效、選單喀聲、警告聲、環境） | **重寫**（AudioSource＋空間化；音源需另取） | ★★ | `MachineSounds`/`xrAudio` 為 WebAudio 即時合成；Unity 建議改預錄 wav／ogg 循環（轉速用 pitch 調整），或移植合成器 |
| 暫存／陰影行為（陰影每兩格更新） | **不需要**（改烘焙） | — | |
| 桌機 `#/world` 除錯模式 | **不遷移** | — | 用 XR Device Simulator 取代 |

## 3. 遷移分段與驗收

每段結束都要在 **Quest 3 實機**驗收（Release 或 Development Build 皆可，用 OVR Metrics Tool 或 `adb shell dumpsys` 量 fps；目標 **72 fps，連續 60 秒無明顯掉格**）。

### 階段 1：匯出工具與計畫（本階段）
- **工作項目**：`src/dev/exportTool.js`（Shift+E／Shift+A）、`exports/` 輸出、manifest、本計畫、測試說明。
- **完成定義**：`npm test`、`npm run build` 通過；正式建置產物不含匯出工具；無頭瀏覽器實際匯出，`docs/export-report.md` 列出檔案、大小、三角形數與未能匯出項目。
- **實機驗收**：不需要（無 Quest 內容）。需要你在本機照 `docs/testing-guide.md` 跑一次並檢視 glb。

### 階段 2：Unity 骨架＋門外場景
- **工作項目**：建專案（第 1 節全部設定）；XR Origin、Device Simulator；匯入 `exterior_static.glb`＋`exterior_interactive.glb`；天空 Skybox；煤氣燈與日光重建並烘焙；大門點擊→開門；Quest build pipeline（可用 CLI 或 Build Profile 一鍵打包）；FPS 顯示（OVR Metrics 或自製）。
- **完成定義**：Quest 3 啟動後站在門外站位，可看清磚牆、穹頂、招牌；點大門（射線）門開啟。
- **實機驗收**：門外靜止與環顧 **≥ 72 fps**（WebXR 為 80 fps，不得更差）；Draw call < 300、三角形 < 30 萬（以 Frame Debugger／OVR Metrics 為準）；無閃爍、材質無粉紅。

### 階段 3：玄關＋瞬移／搖桿＋存檔
- **工作項目**：匯入 `vestibule_*.glb`；站位切換（淡出淡入）；工安告示板翻頁（TMP 內容取自 `src/data/safety-rules.json`）；放映幕（影片或程式繪圖）；壓力錶、指示燈、金庫門開啟與切換到下一場景（先放空房間佔位）；進度存檔；搖桿走動＋拋物線瞬移（含範圍限制）；3 個存檔欄位（沿用現有設計）。
- **完成定義**：從門外進玄關，讀完告示板、看完三段動畫，金庫門解鎖並開門；重啟 App 後進度仍在。
- **實機驗收**：玄關 **≥ 72 fps**（WebXR 為 62 fps）；走動與瞬移無暈眩感（淡出時間、加速度）；進度存檔重啟驗證。

### 階段 4：工作室靜態場景＋車床互動（最關鍵）
- **工作項目**：匯入 `workshop_*.glb`（需合批、LOD、遮擋剔除、烘焙 lightmap）；爐火／燈泡光源；匯入車床 glb（glTFast＋meshopt）；移植 `MachineSession`／車床控制器／行程限制／檔位；切削模擬 MVP（旋轉體工件車削）；手輪（大溜板、橫向、尾座）抓握與每格進給、震動；左手選單機台頁（DRO、啟停、轉速）。
- **完成定義**：從金庫門進入工作室，走到車床前，開主軸、轉手輪進刀，工件被車削變細，DRO 數值與桌機版一致（用 `lathe.test.js` 等測試向量驗證）。
- **實機驗收**：工作室靜止 **≥ 72 fps**（WebXR 為 20–30 fps，是遷移的主要理由）；車床操作中（切削＋切屑）**≥ 72 fps**；手輪手感經你確認。若未達標，本階段不結束，優先調整：合批／Draw call、烘焙取代即時光、降粒子、降 Render Scale、Foveated Rendering。

### 階段 5：銑床、鑽床、手輪、特效、音訊
- **工作項目**：銑床（X/Y/Z 手輪、主軸開關握桿、六面高度場以外的功能）；鑽床（進給手柄彈簧回位、鐵座）；其餘手輪；蒸汽／火花／灰塵／光束特效重寫；機台音效與環境音；工具箱與 13 件工具流程；機台切換（蒸汽遮擋過場）；存檔欄位完整化。
- **完成定義**：三台機台功能與桌機版對齊（以 `docs/xr-plan.md` 第 6 階段規格為準）；特效與音訊完整。
- **實機驗收**：三台機台操作中 **≥ 72 fps**；連續遊玩 20 分鐘無明顯發熱降頻、無記憶體增長（OVR Metrics）；提交完整驗收清單。

## 4. 風險與待確認事項

**風險**
1. **工作室三角形量**：工作室＋穹頂＋擺設總量很大（見匯出報告），WebXR 只有 20–30 fps 的主因。Unity 雖然 CPU 開銷較低，但仍需 LOD／合批／簡化；若不減面，72 fps 可能仍達不到。**階段 4 必須先用靜態場景驗證 fps，再做互動。**
2. **切削模擬效能與移植量**：網格即時重建＋切屑。建議先做最小可行版，再迭代。
3. **匯出不完整**：自訂 shader、粒子、InstancedMesh（已展開，節點數暴增）、動態 CanvasTexture 只能烘當下一格、透明排序，皆在 `manifest.json` 與 `docs/export-report.md` 逐項列出。
4. **meshopt 與 glTFast 版本相容**：需要在階段 2 一開始就用機台 glb 做匯入試驗。
5. **座標系**：three.js 右手系（+X 東、−Z 北、+Y 上），Unity 左手系。glTFast 匯入時會翻轉 Z；所有硬編碼座標（瞬移點、站位、圓盤）移植時要統一轉換（z → −z，yaw 方向反向）。
6. **單位與縮放**：公尺，一致；工具箱整組有 0.36 倍縮放，匯出保留在 ToolTray 節點。
7. **字型與文字**：中文 TMP 字型資產需涵蓋所有用字（可由 `src/xr/fonts/chars.txt` 產生）。
8. **音訊來源**：現有為即時合成，Unity 需決定移植合成或錄製素材。
9. **既有 bug**：見 `docs/known-bugs.md`（例如選單點擊問題），遷移時不要照搬行為。
10. **LFS**：`*.glb` 走 Git LFS，clone 後必須 `git lfs pull`，否則機台 glb 只是指標檔。

**待確認（需要你決定）**
- Quest 目標：僅 Quest 3，或要相容 Quest 2/3S？（影響畫質預算）
- 放映幕的三段切削動畫：預錄影片 vs. 在 Unity 重畫。
- 音訊：移植合成器 vs. 錄製／採用音效素材。
- 存檔格式：沿用「3 個存檔欄位」的內容定義（目前只有玄關進度＋規劃中的工件存檔），請確認欄位內容。
- 桌機版是否之後也要改用 Unity WebGL？（目前假設否。）
- 工作室擺設是否可適度減少或簡化以達 72 fps？
