# Machine Yard — Unity 專案（階段 2：骨架 + 門外場景）

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
