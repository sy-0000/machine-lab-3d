# MACHINE LAB｜工具機 3D 互動教學

React、Vite、Three.js、React Three Fiber 與 Drei 製作的純前端網站，提供工安守則、刀具介紹、關卡預覽，以及車床、銑床、鑽床互動教室。套件版本為 3.0.0，模組架構名稱為 Machine System v1.0。

首頁不下載機台模型，進入加工教室後才載入。關卡頁目前是內容與規格預覽，尚未實作切削變形、評分或過關判定。

## 專案根目錄與啟動

本機根目錄是 `Assets/lathe-learning/`，也是 `.git`、`package.json` 所在位置。上傳的是這個資料夾的內容；組員 clone 後直接進入 clone 出來的資料夾，不必再找一層 `Assets/lathe-learning`。

準備 Node.js 22.12+、Git、Git LFS，在專案根目錄執行：

```powershell
git lfs install
git lfs pull
npm ci
npm run dev
```

開啟終端機顯示的網址，通常為 `http://localhost:5173/`。用 `npm ci` 依照 `package-lock.json` 安裝，不要手改 lockfile。首次 clone 和 GitHub 上傳步驟見 [LFS 與協作指南](docs/GITHUB_AND_LFS.md)。

## 組員要修改哪裡？

| 頁面／功能 | 路由 | 編輯位置 |
| --- | --- | --- |
| 首頁、導覽列、路由 | `#/` | `src/App.jsx` |
| 首頁機台名稱、簡介、排序 | `#/` | `src/machines/catalog.js` |
| 工安守則 | `#/safety` | `src/pages/SafetyPage.jsx` |
| 刀具介紹版面 | `#/tools` | `src/pages/ToolsPage.jsx` |
| 刀具名稱、說明、尺寸與用途 | `#/tools` | `src/tools/tool.config.js` |
| 關卡選擇／預覽、範例資料 | `#/levels` | `src/pages/LevelsPage.jsx`，資料在 `SAMPLE_LEVELS` |
| 加工教室、機台切換、狀態區 | `#/game`、`#/lathe`、`#/milling`、`#/drill` | `src/pages/GameWorkspace.jsx` |
| 操作控制台與按鈕 | 加工教室 | `src/components/ControlPanel.jsx` |
| 場景、相機與光線 | 加工教室 | `src/components/MachineScene.jsx` |
| 3D 點選、拖曳與動畫 | 加工教室 | `src/components/MachineModel.jsx` |
| 操作事件與 React 狀態 | 加工教室 | `src/hooks/useMachineControls.js` |
| 開發者掛載面板 | 加工教室 | `src/components/DeveloperPanel.jsx` |
| 全站配色、卡片與響應式版面 | 全站 | `src/styles/app.css` |

只改文案與排版，優先修改 `src/pages/` 與 CSS。刀具介紹由刀具目錄產生，新增資料請改 `tool.config.js`。關卡的進入按鈕目前只開啟對應機台，不會自動執行關卡。

## 3D 模型與機械設定

下表模型和 JSON 路徑均相對於 `public/models/`：

| 機台 | 模型 | 零件／行程設定 | 掛載點與控制器 |
| --- | --- | --- | --- |
| 車床 | `machines/lathe/lathe.glb` | `lathe_parts.json` | `src/machines/lathe/` |
| 銑床 | `machines/milling/milling.glb` | `milling_split_controls.json` | `src/machines/milling/` |
| 鑽床 | `machines/drill/drill.glb` | `drill_press_parts.json` | `src/machines/drill/` |

三個 GLB 是現行模型唯一來源，透過 Git LFS 儲存；銑床約 181 MiB。不要另存模型到舊路徑。

- `src/machines/core/`：機台載入、註冊、卸載、刀具與工件掛載。
- `src/machines/runtime.js`：各軸運動、主軸、刀架、煞車與示範工件。
- `src/machines/config.js`：將三種 JSON 轉為共用結構。
- `src/lathe.js`、`src/latheParts.js`：現行車床幾何轉接與預設資料，**仍在使用，不可當舊檔刪除**。
- `src/tools/`、`src/workpieces/`：模組刀具與工件。`src/machines/cuttingTools.js` 建立機台預設教學刀具。
- `public/models/deliver_milling_machine_split/`：保留來源 README 與節點 manifest；模型稽核仍使用 manifest。

掛載設定的 `position` 是相對父節點的局部座標，不能直接填世界座標。修改機械資料後需跑測試與模型稽核。

## 操作與驗證

空白處拖曳旋轉視角、滾輪縮放、右鍵拖曳平移。手輪可用滑鼠或控制台長按操作；車床刀架每次轉 10°。工件只能在主軸停止且啟動桿回位後裝卸。重設會恢復操作位置與相機，移除示範工件。

```powershell
npm test
npm run audit:models
npm run build
```

瀏覽器測試（第一次先安裝 Chromium）：

```powershell
npx playwright install chromium
npm run test:browser
```

測試自行啟動 Vite，預設連接埠 5220。如已占用：

```powershell
$env:PLAYWRIGHT_PORT = "5237"
npm run test:browser
Remove-Item Env:PLAYWRIGHT_PORT
```

開發網址加上 `?inspect=1` 可啟用診斷，例如 `http://localhost:5173/?inspect=1#/lathe`。`reports/` 保存稽核與歷史截圖，`tests/` 放瀏覽器測試。`dist/`、依賴與測試暫存不提交。

## GitHub 與協作

詳見 [GitHub 與 Git LFS 上傳指南](docs/GITHUB_AND_LFS.md)。目前已設定 `*.glb` 的 LFS 規則，但舊提交仍含普通 Git 大檔；首次推送前需依指南遷移歷史，僅刪除工作目錄的舊模型並不足夠。

組員日常流程：

```powershell
git switch main
git pull --ff-only
git switch -c feature/safety-content
# 修改對應頁面後
npm test
npm run build
git add src/pages/SafetyPage.jsx
git commit -m "Update safety page content"
git push -u origin feature/safety-content
```

在 GitHub 建立 Pull Request，檢查後合併。各人使用獨立分支；修改共同的 `App.jsx`、`app.css` 或大型模型前先協調。更新 GLB 後照常 add、commit、push，LFS hook 會處理內容。

## 部署

```powershell
npm run build
npm run preview
```

部署完整 `dist/` 至 HTTP(S) 靜態主機，不要直接雙擊 HTML。相對 base 與 hash 路由支援子目錄。上傳程式到 GitHub 不等於部署網站；部署平台建置前也必須下載 LFS 模型，否則會把指標文字當成 GLB。

## 文件與限制

- [封版紀錄與清理清單](docs/MACHINE_SYSTEM_V1_RELEASE.md)
- [架構文件](docs/ARCHITECTURE.md)
- [機台介面契約](docs/MACHINE_CONTRACT.md)

這是教學模擬，行程與進給比例不是已校正的實機數值。尚未實作真正切削與切屑；工件碰撞提示不是完整物理模擬。

- [第三方模型授權與來源](ASSETS_LICENSE.md)

## MachineSession 相容層

完整機台教室的玩家輸入現已經過 `MachineSession` → `MachineV1Adapter` → 既有 Machine System；舊槌柄局部原型仍獨立保留。API、教學 X/Z、單位、輸入鎖與更新時鐘見 [MachineSession 文件](docs/MACHINE_SESSION.md)。尚未新增正式關卡、DemoSequence、評分或完整切削。

- 可持久化車床槌柄與最小切削：[WorkpieceState](docs/WORKPIECE_STATE.md)（現有車床開發者面板：建立／儲存／載入）。
