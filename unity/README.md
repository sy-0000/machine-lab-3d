# Machine Yard — Unity 專案（階段 2 骨架＋門外場景、階段 3 玄關＋瞬移／搖桿＋存檔）

> ⚠️ **這些檔案是在沒有 Unity 的雲端環境寫的，尚未在 Unity 編輯器編譯或執行過。** 第一次開專案可能有小的編譯錯誤或 API 版本差異（套件版本以 Package Manager 解析為準）。遇到時把 Console 訊息貼給我即可修。

資料夾：`unity/MachineYard/`（Unity 專案根目錄；用 Unity Hub 的「Add project from disk」選它）。

## 內容
| 檔案 | 作用 |
|---|---|
| `Packages/manifest.json` | URP、XR Interaction Toolkit 3.x、OpenXR + Meta、glTFast + meshopt 解碼 |
| `Assets/Scripts/Editor/QuestProjectSetup.cs` | 選單 1：套用 Android／IL2CPP／ARM64／Vulkan／Linear／ASTC／API 32 |
| `Assets/Scripts/Editor/ExportImporter.cs` | 選單 2：從網站專案 `exports/` 複製 `exterior_*.glb` 進 `Assets/Models/` |
| `Assets/Scripts/Editor/ExteriorSceneBuilder.cs` | 選單 3：建出門外場景（模型、日光、煤氣燈、霧、天空、XR rig、FPS 顯示、大門互動） |
| `Assets/Scripts/Runtime/ExteriorDoors.cs` | 射線點大門 → 1 秒推開（對應 `exterior.js` 的 `openDoors`） |
| `Assets/Scripts/Runtime/ThreeCoords.cs` | three.js → Unity 座標換算（全專案唯一的轉換點） |
| `Assets/Scripts/Runtime/GasLanternFlicker.cs`、`FpsHud.cs` | 煤氣燈閃爍、視野左下 FPS |

## 步驟
1. 安裝 **Unity 6 LTS（6000.0.x）**，Unity Hub 勾 *Android Build Support*（含 OpenJDK、SDK、NDK）。`ProjectVersion.txt` 寫的版本只是占位，Hub 會問你要不要用已安裝的 6000.0.x 開啟，選「是」。
2. Unity Hub ▸ Add ▸ Add project from disk ▸ 選 `unity/MachineYard`。第一次開啟會解析套件，數分鐘。若 Console 報套件版本找不到，到 Package Manager 把該套件升級到「Unity Registry」顯示的最新 6.x/3.x 版。
3. 選單 **Machine Yard ▸ 1. Apply Quest Settings**。
4. **Project Settings ▸ XR Plug-in Management ▸ Android 分頁**：勾 **OpenXR**；OpenXR 子頁 *Enabled Interaction Profiles* 加 **Oculus Touch Controller Profile**，*OpenXR Feature Groups* 勾 **Meta Quest Support**；Render Mode 選 **Single Pass Instanced**。
5. **Package Manager ▸ XR Interaction Toolkit ▸ Samples ▸ 匯入「Starter Assets」**（提供 XR Origin 與射線手把 prefab）。
6. 選單 **Machine Yard ▸ 2. Import glb exports**，選網站專案的 `exports/` 資料夾（需先照 `docs/testing-guide.md` 匯出）。等匯入進度條跑完（`exterior_static.glb` 約 13 MB）。
7. 選單 **Machine Yard ▸ 3. Build Exterior Scene**，會產生並存檔 `Assets/Scenes/Exterior.unity` 且加入 Build Settings。
8. 在編輯器按 Play（可用 XR Device Simulator），或 Quest 開發者模式 ▸ **File ▸ Build And Run**。

## 實機驗收（階段 2，完成定義見 `docs/unity-migration-plan.md`）
- [ ] 站在門外，看得到磚牆八角建築、玻璃穹頂、玄關外殼、拱門大門、兩盞煤氣燈、「Machine Yard」招牌；招牌文字清楚（不是黑塊）
- [ ] 大門在正前方，左右沒有鏡像（招牌文字不反）；若左右相反，把 `ThreeCoords.Mode` 改成 `NegateZ` 重建場景
- [ ] 射線指大門、扣板機 → 大門約 1 秒向**內**推開；若往外開，對調 `ExteriorDoors` 的兩個 openDegrees 正負號
- [ ] 視野左下角 FPS：環顧與靜止都 **≥ 72 fps**（WebXR 為 80）；Draw call < 300、三角形 < 30 萬（OVR Metrics Tool 或 Frame Debugger）
- [ ] 沒有粉紅材質；磚牆不是全白或全黑

## 已知限制（階段 2 刻意留到之後）
- **光照尚未烘焙**：glTF 沒有 lightmap UV，先用即時日光 + 環境光量 fps。若 fps 不足，下一步在 Unity 裡為網格產生第二組 UV（`Unwrapping.GenerateSecondaryUVSet`）後烘焙 lightmap。
- 天空用 Unity 內建 Procedural Skybox，不是網站的雲層 shader。
- 日光強度、煤氣燈強度是目測初值（three.js 與 Unity 光照單位不同），需要實機調整。
- 暫無玄關／金庫門（階段 3）。
- 材質由 glTFast 轉 URP Lit；透明玻璃的渲染排序需實機確認。


---

# 階段 3：玄關 + 瞬移／搖桿 + 存檔

> 同樣是在沒有 Unity 的環境寫的，**未編譯、未執行**。

## 新增內容
| 檔案 | 作用（對應網站的哪支程式） |
|---|---|
| `Editor/LobbySceneBuilder.cs` | 選單 **4. Build Lobby Scene (stage 3)**：建出 `Assets/Scenes/Lobby.unity`（門外＋玄關＋金庫門＋佔位工作室），接好下面所有腳本；取代階段 2 的 Exterior 場景 |
| `Runtime/LobbyFlow.cs` | 流程與站位 outside/center/board/screen/vault（`Lobby.js`）：點大門→開門→進玄關；點告示板／放映幕→走到面板前；「退後」；金庫手輪（不在門前先走過去；未解鎖抖動＋提示；解鎖→開門→進工廠） |
| `Runtime/Stations.cs` | 固定站位資料（`STATIONS`、`teleportDiscs.js`）＋ `StationMover`：淡出→移到站位並轉向→淡入 |
| `Runtime/ScreenFade.cs` | 相機前的黑色面片淡入淡出 |
| `Runtime/VaultDoorController.cs` | 金庫門（`vaultDoor.js`）：手輪轉→門栓收回→門轉開；兩支壓力錶指針；指示燈紅/綠 |
| `Runtime/SafetyBoardController.cs` | 工安告示板（`SafetyBoard.js`）：讀 `Resources/safety-rules.json`，一節一頁；翻到最後一頁算讀完 |
| `Runtime/ProjectionScreenController.cs` | 放映幕（`ProjectionScreen.js`、`AnimationScreen.js`）：三段輪播，從頭完整播完才算看完 |
| `Runtime/ProgressStore.cs` | 進度存檔（`progress.js`，欄位相同）→ `persistentDataPath/progress.json` |
| `Runtime/SaveSlots.cs` | **三格存檔**儲存層（`xr-plan.md`「工件存檔」格式 `{ version, slots[3] }`，含讀取相容規則）→ `saves.json` |
| `Runtime/StickLocomotion.cs`、`WalkArea.cs` | 搖桿走動（`Locomotion.js`）：左手平滑 1.6 m/s、右手快速轉向 30°；可站範圍照 `canStand` |
| `Runtime/StickTeleport.cs` | 瞬移（`Teleport.js`）：右手搖桿往前推出拋物線，指到圓盤高亮，放開移動；進過工廠才解鎖 |
| `Runtime/DebugMenu.cs` | 簡易選單（左手 **Y**）：回門外／回玄關、三格存檔狀態、[DEV] 直接解鎖／重置進度 |

## 步驟（接在階段 2 之後）
1. 再執行一次 **2. Import glb exports**（現在也會匯入 `vestibule_*.glb` 並複製 `safety-rules.json`）。
2. **中文字型**（告示板、選單用）：取一個含繁中的 TTF（例如 Noto Sans TC，OFL 授權），放進 `Assets/Fonts/`；`Window ▸ TextMeshPro ▸ Font Asset Creator` 建立 **Dynamic** 的 Font Asset，存成 `Assets/Resources/MachineYardFont.asset`。沒建的話中文會顯示成方塊（程式會警告）。
3. 選單 **4. Build Lobby Scene (stage 3)**。它會停用 Starter Assets rig 內建的 Move/Turn/Teleport provider（改用本專案的腳本）。
4. Play 或 Build And Run。

## 實機驗收（階段 3，完成定義見 `docs/unity-migration-plan.md`）
- [ ] 門外：射線點大門 → 門向**內**開 → 自動淡出淡入到玄關中央
- [ ] 玄關：點告示板紙面 → 走到板前；「下一頁」翻頁，中文清楚；翻到最後一頁後金庫左邊壓力錶打滿（噴蒸汽效果尚未做）
- [ ] 點放映幕 → 走到幕前；三段（目前是 12 秒佔位計時，除非指定了 VideoClip）各自從頭播完後，右邊壓力錶逐段上升
- [ ] 兩項完成後指示燈由紅變綠；點金庫手輪：未解鎖 → 手輪抖動＋提示 3 秒；解鎖 → 手輪轉、門栓收回、門轉開（向工作室方向）→ 淡出 → 進佔位工作室工作桌前
- [ ] 搖桿走動：左手平滑移動、碰牆會沿邊滑、走不出玄關／八角牆；右手左右扳快速轉 30°
- [ ] 進工廠後：右手搖桿往前推出拋物線，指到黃銅圓盤變金色，放開瞬移到圓盤並面向機台佔位；沒指到圓盤放開不動
- [ ] 重啟 App：壓力錶與指示燈維持完成狀態，只需點手輪；左手 Y 選單可「回門外」「回玄關」，[DEV] 可重置進度
- [ ] 玄關 **≥ 72 fps**（WebXR 為 62 fps）；走動與瞬移無暈眩感

## 階段 3 的取捨與已知限制
- **放映幕內容**：網站是 `public/previews/*.anim.js` 的程式繪圖，無法匯出。這裡先用佔位計時讓流程可測；要正式版請把三段預錄成影片，指定到 `ProjectionScreenController.clips[i].video`（影片貼到 `Picture` 的材質屬性名 `_BaseMap`，若 glTFast 版本的屬性名不同需改）。
- **告示板分頁**：網站會把過長的節自動續頁；目前 4 節都很短，所以一節一頁、字自動縮放。
- **三格存檔**目前只有儲存層與選單顯示；實際存工件要等階段 4（車床工件狀態）。網站版的存檔也尚未實作（`xr-plan.md` 第 9 階段），這是依該規格先做的格式。
- **蒸汽粒子**（門栓噴蒸汽、壓力錶完成噴蒸汽）、牆面齒輪轉動、閥門手輪抓握、玄關裝飾物尚未做（階段 5 特效／後續）。
- **佔位工作室**是遠處的一個圓盤地板＋機台／工作桌方塊＋4 個圓盤，座標與玄關分開（`WorkshopOffsetThree`）；真正的工作室在階段 4。
- 門與指針的旋轉方向都在執行時實測決定，不靠猜測；若仍反向，看 `XrUtil.SwingSign`。
- TextMeshPro 3D 的字級單位不直觀，文字都用自動縮放塞進矩形；若字太小/太大，調整各控制器裡的矩形大小。


---

# 階段 4：工作室靜態場景 + 車床互動（最關鍵）

> **驗證程度（請先讀）**
> - ✅ `Assets/Scripts/Core/`（切削、車端面、夾頭碰撞、主軸加速與拉桿、軸行程與手輪）是純 C#，已在這裡用 .NET 編譯，並與網站 JS 產生的標準答案逐項比對：**79,022 項、0 失敗**；刻意改壞兩處邏輯（夾持區邊界、端面長度）都會被抓到。執行：`npm run test:unity-core`（需要 dotnet 8）。
> - ✅ 左右手系的旋轉換算（鏡像後角度變號）用 three.js 數值驗證，誤差 ~1e-16（NegateX、NegateZ 兩種模式）。
> - ⚠️ 其餘 Runtime／Editor 腳本只用**手寫的 Unity API 替身**做過型別檢查（能抓拼字與型別，抓不到 Unity／XRI 真實 API 與我記憶不符之處），**沒有在 Unity 執行過**。手感、視覺、fps 全部要你在 Quest 上驗。

## 新增內容
| 檔案 | 作用（對應網站） |
|---|---|
| `Core/*.cs` | 純數學：`Cutting`（cutRevolvedProfile／cutFacing／entersChuck）、`SpindleModel`（stepMachine）、`AxisModel`（setAxis／turnControlBy／wheelRatio）、`RevolvedState`（槌柄工件：半徑 10、長 300、0.5 mm 一格、夾持 0–40 mm） |
| `Runtime/LatheMachine.cs` | 用 Core 驅動匯入模型的節點：5 條軸沿局部軸向平移、手輪／主軸／拉桿／段位旋鈕繞軸旋轉、刀座每 10° 分度、立柱隨高度伸縮、腳踏煞車 |
| `Runtime/LatheCuttingController.cs` | 量刀尖在「不旋轉的工件座標」的位置（`MachineV1Adapter.#cuttingSample`），每次軸／手輪動作前後取樣並切削；撞夾頭判斷；`AlignCuttingTip`（掛上工件時把刀尖高度對準中心） |
| `Runtime/LatheWorkpiece.cs` | 可切削工件的旋轉網格（`RevolvedWorkpiece.profileGeometry`），被切削後重建；掛在夾頭的 `WorkpieceMount` 隨主軸轉 |
| `Runtime/WheelGrab.cs` | 抓住手輪畫圈（`wheelGrab.js`）：手在 0.22 m 內用手的位置，否則用射線打轉動平面；每 10° 一格 |
| `Runtime/MachineControlWiring.cs` | `vrMachineControls.js`：手輪＝按住 grip 畫圈，每格進給「每格進給量」（0.01/0.1/1 mm），碰行程限制較強震動；拉桿／段位／刀座／煞車＝trigger 正向、grip 反向；切削時握手輪的手持續輕震 |
| `Runtime/MachinePanel.cs` | 左手 **X** 叫出並釘在原地：轉速、DRO、刀尖與工件直徑、接觸；按鈕：啟動／反轉／停止、進給量、裝上工件、車外徑⇄車端面、X/Z 歸零、重設機台 |
| `Editor/WorkshopBuilder.cs` | 匯入的工作室＋工具箱＋車床建成場景、瞬移圓盤、光源（讀 manifest）、停用小於 5 cm 的裝飾零件 |
| `MachineYard.CoreTests/`（在 unity/ 下） | dotnet 測試專案：編譯 Core 並比對 `golden.json` |

## 步驟（接在階段 3 之後）
1. 重新匯出（修正了隱藏零件與新增 `machine_lathe_runtime.json`）：照 `docs/testing-guide.md` 第 2 節再跑一次 Shift+A。
2. 選單 **2. Import glb exports (lobby)**（若匯出有更新）→ **2b. Import glb exports (workshop + machines)**（階段 5 起含銑床、鑽床，共約 200 MB，匯入要等幾分鐘）。
3. 選單 **4. Build Lobby + Workshop Scene (stage 3-5)**。Console 會印出停用的小零件數與光源數。
4. Build And Run。流程：門外 → 玄關 → 解鎖金庫門（或左手 Y 選單 [DEV] 直接解鎖）→ 進入工作室（工作桌前）→ 瞬移圓盤到「機台正面」。

## 車床操作（實機驗收，完成定義見 `docs/unity-migration-plan.md`）
- [ ] 左手 **X** 叫出面板 →「裝上工件」→ 夾頭上出現銀色槌柄（半徑 10 mm、長 300 mm）
- [ ] 拉動啟動拉桿（射線指著按 trigger）→ 拉桿動、主軸加速到 1000 rpm（預設檔位）、夾頭與工件旋轉；再按 trigger 停止；grip＝反轉
- [ ] 轉左側段位旋鈕（trigger／grip）→ 轉速在 250/500/750/1000（×1 或 ×2）之間變
- [ ] 抓住橫向手輪（grip，畫圈）：每轉過 10° 刀座橫向進給 0.1 mm（面板可切 0.01/1）；DRO 的 X 直徑跟著變；碰到行程限制時強震動
- [ ] 主軸轉動中，用縱向手輪把刀移到工件上、橫向進刀 → 工件被車細；面板「工件此處直徑」變小；握手輪的手持續輕震
- [ ] DRO 數值與桌機版一致（同樣的手輪格數 → 同樣的 X/Z mm）
- [ ] 把刀撞向夾頭 → 面板顯示「危險」、不再切削、較強震動
- [ ] 腳踏煞車：主軸停止、踏板下沉
- [ ] 工作室靜止環顧 **≥ 72 fps**（WebXR 為 20–30 fps）；車床操作中（切削）**≥ 72 fps**

## 重要的風險與取捨
- **三角形預算**：工作室靜態 555,304、車床靜態 85,272 + 互動 306,815、工具箱 ~98,000，合計約 **105 萬**。Quest 3 在 72 fps 通常撐不住這個量（雙眼）。已預設停用 5 cm 以下的小零件（約省十餘萬），但很可能仍需要：LOD／簡化網格、遮擋剔除（Occlusion Culling 烘焙）、把工作室遠處擺設換成低面數。**階段 4 的主要工作其實是用實機 fps 驅動這些取捨**——請把 fps 數字與 OVR Metrics 的 draw call／三角形回報給我。
- **車床互動節點 307k 三角形偏重**：會動的整組溜板／刀架。需要時可在 Unity 用 mesh 簡化（Mesh Simplifier）處理，或請我把匯出分得更細（例如把大溜板的鑄件拆成靜態）。
- **光源強度**是目測初值（`WorkshopBuilder.PointScale/SunScale`）；沒有烘焙，即時光源數量多會吃 fps。
- 階段 4 當時未做的項目（銑床／鑽床、切屑、工具箱、特效、音訊、工件存檔）已在階段 5 補上，見下一節。
- **工件取下／重新裝夾、調頭**不在本階段（網站規劃的第 10 階段）。
- 手輪抓握的角度方向、拉桿方向等「手性」相關行為，若實機方向相反：先試 `ThreeCoords.Mode`；個別旋轉符號集中在 `ThreeCoords.AxisAngle`。

---

# 階段 5：銑床、鑽床、工具箱、特效、音訊、存檔

## 新增內容
| 檔案 | 作用（對應網站） |
|---|---|
| `Core/HeadWorkpiece.cs` | 槌頭毛胚（`HeadWorkpieceState.js`）與銑削／鑽孔／攻牙（`HeadCuttingSimulation.js cutHead`）：高度場 0.5 mm 一格，刀路線段與每格圓盤的精確交點；孔入口隨後續銑削降低、牙深縮短；`SurfaceUnder`／`Contact`（接觸光圈） |
| `Core/AxisModel.cs`（擴充） | `StepReturn`：鑽床進給手柄放開後彈簧回位（`runtime.js stepReturn`） |
| `Core/MachineSynth.cs` | 程序化聲音（`MachineSounds.js`＋`xrAudio.warn`）：馬達嗡嗡聲隨轉速、切削帶通雜訊（銑床／鑽床依刀刃通過率調幅）、手輪喀聲（節流）、警告兩短聲。純 C#，沒有音檔 |
| `Core/WorkpieceDto.cs` | 存檔格式（槌頭高度場、車床半徑剖面）與嚴格驗證 |
| `Runtime/HeadMachining.cs` | 銑床／鑽床的加工：裝刀、掛毛胚、量刀尖（毛胚座標 mm）、切削、接觸光圈、切屑事件、裝夾（`Place`／`Slide`／`DefaultSetup`）、簡化虎鉗、DRO |
| `Runtime/HeadTools.cs` | 5 支槌頭刀具（Ø58 面銑刀、Ø8 立銑刀、Ø8.5／Ø10 鑽頭、M10 絲攻）的定義與程序化模型 |
| `Runtime/HeadWorkpieceView.cs` | 毛胚網格（`headGeometry`）；同高度的連續格子合併成長方形，面銑後只剩幾十個四邊形 |
| `Runtime/HeadMachinePanel.cs` | 銑床／鑽床面板（左手 **X**）：DRO、刀具、刀尖位置、接觸、孔資料、換刀、新工件、歸零、鑽床滑動虎鉗、存檔／讀檔 |
| `Runtime/LatheMachine.cs`（擴充） | 銑床開關（toggle）、鑽床彈簧手柄（握住不回彈、放開回彈）、套筒延伸（sleeve）隨套筒伸縮、教學比例自動開啟 |
| `Runtime/MachineControlWiring.cs`（擴充） | 鑽床進給手柄：照真實比例跟手轉（−115°～0°）；銑床開關 trigger＝正轉、grip＝反轉 |
| `Runtime/Effects.cs` | 粒子特效：切屑、火花、蒸汽（`ParticleBurst`，固定粒子上限）、灰塵（`DustMotes`）；`MachineEffects` 把車床／銑鑽床事件接到特效 |
| `Runtime/MachineAudio.cs` | 機台聲音：串流 AudioClip 播放 `MachineSynth`，3D 音源在機台中央上方 1 m |
| `Runtime/MachineSwitcher.cs` | 換機台：蒸汽遮擋 → 切換 → 蒸汽散去；兩側瞬移圓盤依各機台移動 |
| `Runtime/ToolboxFlow.cs` | 工具箱流程：點工具 → 升起到展示點（放大 1.8 倍）→ 聚光、其他燈光降到 15% → 說明面板 → 上一項／下一項／放回；展示中 grip 抓住轉動 |
| `Runtime/WorkpieceSaves.cs`、`SlotConfirm.cs` | 3 格存檔的寫入／讀回（車床工件只能讀回車床；銑床與鑽床可互讀），覆蓋已有工件要 3 秒內連按兩次 |
| `Resources/tools.json` | 13 件工具的名稱、說明、展示角度（`scripts/export-tools-json.mjs` 從網站資料產生） |

## 步驟（接在階段 4 之後）
1. 照 `docs/testing-guide.md` 第 2 節的匯出若有更新就重跑；否則用現有 `exports/`（已含三台機台的 glb 與 `machine_*_runtime.json`）。
2. 選單 **2b. Import glb exports (workshop + machines)** → **4. Build Lobby + Workshop Scene (stage 3-5)**。
3. 進工作室後：左手 **Y** 選單有「車床／銑床／鑽床」三顆按鈕（需已進過工廠）；左手 **X** 叫出目前機台的面板。

## 銑床驗收
- [ ] 選單切到銑床：蒸汽遮住畫面後換成銑床（朝向與網站相同，操作側朝 +Z）
- [ ] 面板「新工件」：虎鉗夾著 20 × 20 × 90 mm 方料，刀（Ø58 面銑刀）在工件左側外面
- [ ] 右上方握桿、開關：trigger＝正轉；轉速上升到 500 rpm、刀具跟著轉
- [ ] X／Y／Z 手輪（grip 畫圈）：X 左右、Y 前後、Z 升降；DRO 跟著變；碰行程限制強震動
- [ ] Z 上升到刀尖碰工件：光圈亮黃（接觸）；轉動中切削變橘；面板「上表面最高／最低」下降；有切屑飛出、有切削聲
- [ ] 切過的地方是平的（面銑 1.5 mm 後上表面最高＝最低＝18.5）；換立銑刀可以切溝
- [ ] 停止的刀壓進工件：警告聲＋面板紅字＋火花
## 鑽床驗收
- [ ] 切到鑽床：機台在鐵座上；進給手柄（grip 抓住）往下拉，套筒下降，**放開後彈簧回位**
- [ ] 鑽頭（Ø10）在 X=45 的位置上方；「工件 −5／−1／+1／+5」滑動虎鉗對準兩條劃線（X=25、X=65）
- [ ] 啟動後拉手柄往下：孔出現、面板列出「孔 X=… Ø… 深 …」；鑽穿標示（鑽穿）
- [ ] 換 Ø8.5 鑽頭鑽底孔，再換 M10 絲攻攻牙：面板顯示「M10 攻牙 …」；沒有底孔時攻牙無效；反轉不能攻牙
## 工具箱、特效、音訊、存檔
- [ ] 工作桌上點任一工具：蒸汽一團、工具升起放大、其他燈光變暗、說明面板出現在視線前方；上一項／下一項／放回盒中；grip 抓住轉動
- [ ] 灰塵在工作室漂浮；金庫門門栓收回與壓力錶滿格時噴蒸汽
- [ ] 機台聲音從機台方向傳來，轉速越高越高音；手輪每格有喀聲；切削有嘶嘶聲；撞夾頭／壓刀有警告聲
- [ ] 面板「存檔 1/2/3」：空格直接存；已有工件的格子要連按兩次才覆蓋；「讀檔」讀回；車床工件讀不進銑床／鑽床，銑床與鑽床可互讀
- [ ] 重啟 App 後存檔還在；三台機台操作中 **≥ 72 fps**；連續遊玩 20 分鐘無明顯發熱降頻

## 階段 5 的取捨與已知限制
- **翻牌板風格的 3D 選單／機台頁沒有重做**（決策 D26）：仍是簡易面板，功能齊全但外觀不是網站的翻牌板。
- **光束（SunBeam × 7）沒有重做**：匯出時它們是自訂 shader 被略過，manifest 沒有記錄位置；需要時要擴充匯出工具記錄位置再用加法混合的長錐體重建。爐火火星（FireboxSparks）、玄關蒸汽噴口位置同理，目前只有門栓與壓力錶、機台過場、工具升起會噴蒸汽。
- **接觸光圈**用 LineRenderer，不會「穿透」遮擋（網站是 depthTest 關閉的圓環）。
- **虎鉗**是簡化的方塊組合（沒有鎖緊螺桿與手把），高度依毛胚離工作臺的距離。
- **關卡（星星評分、挑戰步驟）沒有移植**——VR 版沒有這個功能（網站桌機版才有）。
- **槌頭毛胚的鑽孔／攻牙在 Unity 端的容許值**：float 量到的橫向漂移 < 0.01 mm 視為純軸向（Core 本身與網站一致，容許 1e-7 mm），見 D27。
- 銑床／鑽床的原始教學刀具（FaceMill、TwistDrill 節點）會在裝上程序化刀具時隱藏，避免重疊。

---

# 階段 5 之後的修正

| 項目 | 內容 |
|---|---|
| 互動（D31） | `Runtime/XrPointer.cs`：自己的射線指標，trigger＝點擊、grip＝抓住／反向，與網站一致。所有可操作物件用 `PointerTarget`（取代 XRI 的 XRSimpleInteractable）；場景建置會停用 rig 的 XRI Interactor |
| 移動（D32） | `Runtime/Comfort.cs`（設定與視野暗角）、`StickLocomotion`（只用瞬移、轉向方式、握手輪時暫停）、`StickTeleport`（自由瞬移到地板）；左手 Y 選單三顆按鈕切換 |
| 字型（D33） | `Assets/Fonts/MachineYardSansTC.ttf`（Noto Sans TC 子集，OFL）＋選單 **0b. Create CJK font asset** → `Resources/MachineYardFont.asset` |
| 放映幕（D35） | `Assets/Videos/preview_{lathe,milling,drill}.mp4`（網站動畫逐格錄製），場景建置時自動指定 |
| 只支援 Quest 3（D34） | Target Devices 只勾 Quest 3 |
| 車床精度 | 刀尖量測改用局部座標鏈（與銑床／鑽床相同，D27） |
| 車床接觸光圈 | 刀尖碰到工件外圓時畫一圈（轉動中切削為橘色） |
| 銑鑽床新工件 | 主軸轉動中按「新工件」改為提示「停機後才能換新工件」（原本毛胚可能留在刀具裡） |

步驟：選單 **1** → Target Devices 只勾 Quest 3 → **0b** → **2b**（若未匯入）→ **4** → Build And Run。驗收清單見 `docs/testing-guide.md` 第 11 節。

## 門、出口與工具（第二批修正）
| 項目 | 內容 |
|---|---|
| 金庫門往外開（D36） | 開門前先退到門扇掃不到的位置；從工作室回來時門在面前關上 |
| 工作室出口（D37） | `Runtime/WorkshopExitDoor.cs`：點工作桌後方的拱門 → 雙門往外推開 → 回玄關 |
| 指到發亮 | `Runtime/Highlighter.cs`：與網站相同的綠色光暈（#30a888 × 0.5） |
| 工件插進夾頭（D38） | 車床工件往夾頭內推 40 mm |
| 自我檢查 | 選單 **5. Self-check** → `SelfCheck.md`；`Assets/Tests/EditMode` 6 個 Unity 測試 |
| 減面（D39） | 選單 **Detail ▸ 100/50/25%**、**6. Bake occlusion culling** |
| asmdef（D40） | Runtime／Editor 補上 Core、TextMeshPro 參照（原本在 Unity 裡會編譯失敗） |
| 拱形防爆鋼門（D41） | `Runtime/ArchedBlastDoor.cs`：玄關圓門與工作室木拱門都換成同一種拱形鋼門，保留手輪、門栓、蒸汽、往外開的特效（正視圖：`docs/images/blast-door-preview.png`） |
