# MACHINE LAB｜工具機 3D 互動教學網站

React、Vite、Three.js、React Three Fiber、Drei 純前端專案。首頁選擇車床、銑床或鑽床，三者共用模型載入、相機、操作與動畫核心。

## 安裝與啟動

使用 Node.js 22.12+，在 `Assets/lathe-learning` 執行：

```bash
npm install
npm run dev
```

開啟終端機顯示的網址（通常 http://localhost:5173/）。不要直接開啟 dist/index.html；GLB 載入需要 HTTP 伺服器。

```bash
npm run build
npm run preview
```

部署完整 `dist/` 至靜態 HTTP(S) 主機。相對 base 與 hash 路由支援子目錄，不需後端路由規則。首頁不下載模型；選擇機器才載入。新銑床約 20 MB，取代舊約 160 MB 模型。

## 版本

修改前已建立獨立 Git 儲存庫，第一版 commit `4ba2985`，標籤 `v1.0.0`。本次修改另存第二版標籤 `v2.0.0`。尚未設定遠端或上傳。舊資料整理於 `todelete/`，詳見其中清單；移動資料沒有刪除。

## 本版操作

- 空白處拖曳旋轉、滾輪縮放、右鍵拖曳平移；手機雙指縮放及平移。
- 可操作零件會高亮、顯示繁體中文說明。手輪左鍵按住負向、右鍵按住正向；面板提供手機及鍵盤可用的雙向按鈕。
- 車床：刀座較小本體 `Object_103` 與上方零件一起升降；底座 `Object_101/147` 留在原處。點刀座或面板按鈕，每次由上往下看往右轉 45°，八次一圈。
- 尾座負向行程擴至 −0.55；高度範圍為 0～0.06。手輪右側長桿 `Object_129/131/133/135` 改作主軸啟停，跟隨溜板移動。
- 車床正面底部新增紅色橫向腳踏煞車。點它會立即停止主軸並鎖定啟動；按「解除煞車」後才可再次啟動。這是新增教學幾何，不是原 GLB 零件。
- 鑽床：按住進給握柄或「按住下降」按鈕，套筒、夾頭及鑽頭下降；放開、取消或失焦自動回位。補入伸縮套筒，下降時保持連接。點 `SwitchLever` 切換主軸；工作臺高度滑桿已啟用。
- 銑床：新拆件模型的左右 X 手輪、前方 Y 手輪均可操作；點機身電氣盒上的開關啟停主軸。Z 升降由面板滑桿控制。
- 停止主軸會減速並保留角度；腳踏煞車立即停止。重設恢復全部位置、角度、相機與 500 RPM，解除煞車，移除示範工件。

## 模型、設定與節點核對

| 機器 | public/models 中的模型 | 控制設定 | 原始節點 / Mesh | 缺少參照 |
| --- | --- | --- | --- | --- |
| 車床 | lathe_16k20_dark_green_no_backboard.glb | lathe_parts.json | 182 / 172 | 0 |
| 銑床 | deliver_milling_machine_split/milling_machine_split.glb | milling_split_controls.json | 422 / 422 | 0 |
| 鑽床 | drill_press_interactive.glb | drill_press_parts.json | 62 / 42 | 0 |

車床原始 GLB 有兩個未掛入場景的背板紀錄。新增功能群組與教學幾何由設定檔明確建立，不冒充原始 GLB 節點。逐項參照、世界 Pivot、父子關係與掛接誤差見 [machine-audit.json](reports/machine-audit.json)。新版機械對照與限制見 [v2-model-mapping.md](reports/v2-model-mapping.md)。

已讀取使用者提供的 `drillingREADME.md`、`millingREADME.md`、`lathe_16k20_dark_green_README.md`，以及新拆件資料夾內 `README.txt` 與 manifest。舊 millingREADME 描述舊語意分組，不可直接套用新模型。

新銑床依三角形世界座標對照舊來源、逐件隔離檢視後，明列功能成員。未以距離相近分組。其 GLB 不含 UV、法線與材質；程式補算法線並使用工業灰綠 PBR 材質。原始貼圖缺乏 UV 對應，移至 todelete 保存，沒有假稱已還原貼圖。

## 架構

`src/machines/catalog.js` 指定模型及 JSON；`config.js` 正規化設定；`runtime.js` 處理群組、獨立 Pivot、行程、世界距離、煞車及回位。`MachineScene`、`MachineModel`、`ControlPanel`、`PartTooltip` 和 `useMachineControls` 三台共用。

初始位置、角度、比例均複製保存；變換採初始值加偏移，動畫使用 useFrame/delta。掛接驗證世界矩陣不變。車床 `lathe.js` 仍用於原模型幾何轉接；旧專用 React 元件已移至 todelete，現用流程不依賴它們。

## 安全與校正限制

車床以世界 Box3 計算刀座到夾頭／示範工件的間隙，黃紅閾值 0.07 / 0.02。銑床缺少已確認刀具、虎鉗與工件；鑽床缺少工件及夾具，兩者保留運轉進給提示，但接近距離警告未啟用。

手輪導程、行程、開關功能對應、腳踏煞車尺寸及套筒尺寸是本版教學設定，仍需實機校正。銑床 Z 手輪尚未可靠辨認，膝座鑄件與底座合併，Z 僅移動已分離的鞍座／工作臺。鑽床沒有獨立工作臺升降手輪，使用滑桿。未驗證實體手機，瀏覽器觸控模擬結果見測試紀錄。

## 測試

```bash
npm test
npm run audit:models
npm run build
```

瀏覽器測試（PowerShell，瀏覽器安裝留在專案內）：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright-browsers'
npx playwright install chromium
npm run test:browser
```

測試使用真實 GLB；開發模式 `?inspect=1` 提供唯讀快照，沒有直接變更狀態的測試後門。實際結果見 [v2-verification.md](reports/v2-verification.md)。

最初指定模型的授權記錄：3D model “lathe” by Oleg, licensed under CC BY 4.0. [原來源](https://sketchfab.com/3d-models/lathe-cfaed4ba749a46f2baf4012bedd00b6d)。目前替換模型及其他兩台模型的授權仍請依提供來源確認。
