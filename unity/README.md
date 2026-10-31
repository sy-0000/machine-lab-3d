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
