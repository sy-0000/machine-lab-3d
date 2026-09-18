# MACHINE LAB｜工具機 3D 互動教學網站

在 `Assets/lathe-learning` 的既有專案上整合車床、銑床與鑽床。使用 Vite、React、Three.js、React Three Fiber 與 Drei；純前端，不需要後端或資料庫。

## 安裝、啟動、建置

Node.js 22.12+。在專案資料夾執行：

```bash
npm install
npm run dev
```

開啟終端機顯示的網址，通常是 http://localhost:5173/ 。首頁有三張機器入口卡片。

```bash
npm run build
npm run preview
```

將完整 `dist/` 部署到支援大型靜態檔案的 HTTP(S) 主機。`base: './'` 與 hash 路由支援子目錄部署，首頁網址以 `/` 結尾，不需要伺服器路由重寫。銑床 GLB 約 160 MB，須確認主機單檔大小限制。首頁不下載 GLB，選擇機器後才載入；切換頁面會取消未完成的下載並釋放模型資源。

## 檔案來源與限制

| 機器 | GLB，位於 public/models | JSON | 說明來源 |
| --- | --- | --- | --- |
| 車床 | lathe_16k20_dark_green_no_backboard.glb | lathe_parts.json | 原專案 README、src/latheParts.js、reports/part-mapping.md |
| 銑床 | milling_machine_interactive.glb | parts-map.json（使用者原檔，未修改） | JSON 及真實 GLB 階層；未找到使用者的 .md |
| 鑽床 | drill_press_interactive.glb | drill_press_parts.json（使用者原檔，未修改） | JSON 及真實 GLB 階層；未找到使用者的 .md |

車床 JSON 是由既有設定原值遷移，不是使用者另行提供的機械校正資料。新增的銑床／鑽床功能不猜測節點、機械用途、旋轉軸或分組；原 JSON 已標示待確認／缺件的功能保持標示或停用。每個機器頁顯示核對錯誤和待校正清單。生成的 [整合核對說明](reports/machine-integration.md) 不是原模型作者文件。

**目前不能宣稱所有原始 JSON 節點皆通過。** 銑床的 `Worktable_X_Slide` 在 GLB 沒有同名節點，畫面明確報錯；實際既有 `X_Axis_Table` 仍可帶動它原有的材質子網格。沒有自行建立假同名群組來掩蓋錯誤。

## 共用架構

```text
src/
  App.jsx                         首頁、hash 路由、延後載入教室
  components/
    MachineScene.jsx              共用 Canvas、相機、OrbitControls、光影地面
    MachineModel.jsx              共用 Pointer Events、useFrame 動畫
    ControlPanel.jsx              共用滑桿、RPM、觸控按住按鈕
    PartTooltip.jsx               繁體中文 fixed Tooltip
    LoadingScreen.jsx             下載與解析進度
    MachineDebug.jsx              開發測試唯讀快照
  hooks/useMachineControls.js     共用狀態與操作入口
  machines/
    LathePage.jsx / MillingPage.jsx / DrillPressPage.jsx
    MachinePage.jsx               共用 GLB / JSON 載入與狀態介面
    catalog.js                    模型與設定檔入口
    config.js                     使用者 JSON schema 的正規化轉接層
    lessonDefaults.json           明示的教學／呈現參數，不是實機規格
    runtime.js                    共用 Pivot、行程、旋轉、重設、安全距離
    runtime.test.js
```

三個 Page 只有入口設定，不複製控制程式。舊 `lathe.js` 的幾何分區／階層準備器只作車床匯入轉接與歷史回歸驗證，實際三台機器的動畫與輸入均使用 `machines/runtime.js`、`MachineModel.jsx`。舊車床元件及測試紀錄保留供追溯，未接到首頁。

模型只在頁面載入時準備一次，所有節點的 position、quaternion、scale 均保存獨立副本。已有模型階層不依鄰近距離重新分組；JSON 世界 Pivot 以 wrapper + `attach()` 建立，每次掛接驗證世界矩陣差小於 1e-6。移動採初始位置加軸向偏移；旋轉採初始 quaternion 乘局部軸旋轉。每個手輪獨立 Pivot，轉動單一手輪不會旋轉其他手輪握把。

## 操作方式

- 空白處拖曳旋轉，滾輪縮放，右鍵拖曳平移；手機單指旋轉、雙指縮放／平移。
- Hover 可操作零件，顯示繁體中文說明並高亮所屬輪身與握把。
- 左鍵按住負向旋轉，右鍵按住正向旋轉；短按小步進，持續操作由 `useFrame` 與 `delta` 更新。
- 按住期間停用 OrbitControls；放開、取消、失去捕捉、失焦、重設、卸載都會停止操作。
- 手機可先點選零件看說明；在控制面板選擇手輪，按住負向／正向按鈕操作。按鈕也支援鍵盤空白鍵與 Enter。
- 滑桿遵守 JSON 行程，並在比例已知時同步輪角。主軸停止後保留當前角度；「重設」則依本次需求將包含主軸在內的角度、所有位置與相機恢復初始值，RPM 回 500、關閉教學比例模式，移除額外裝上的示範工件。
- 車床保留拉桿先到位、主軸再加速的流程；鑽床 `SwitchLever` 只作 JSON 指定的 clickToggle，不虛構未提供的拉桿轉軸。
- 車床可選擇裝上舊版已定義的圓柱示範工件，明確區別於原 GLB。它掛於 WorkpieceMount，繼承夾頭／主軸旋轉。主軸運轉、減速或拉桿未回原位時不能拆裝。

### 缺少進給比例的處理

銑床 JSON 沒有螺桿導程，鑽床也未定義手柄角度與套筒零點對應。因此這些手輪的連動預設停用，已定義的滑桿仍可操作。使用者可勾選「啟用教學進給比例」：

- 銑床 10 圈走完全行程；參數在 `lessonDefaults.json`。
- 鑽床初始 0° 對應套筒 0，−115° 對應 −0.085 m，正向到 35° 時套筒仍受 0 上限限制。

以上均為明示教學選項，**不是從幾何推測出的實機參數**。若補齊經確認的 `feedPerRadian`，可放入各手輪原 JSON 項目（鑽床為 interactions.FeedHandlePivot），轉接層會優先使用該值，不再要求教學模式。手輪正負向和實機進給方向仍需現場校正。

## 節點核對結果

| 機器 | GLB 節點 / Mesh | 核對結果 |
| --- | --- | --- |
| 車床 | 182 / 172（場景可達 180 / 170） | 目前遷移設定參照均可找到；原檔兩個背板記錄未掛入場景 |
| 銑床 | 79 / 60 | Worktable_X_Slide 缺少同名節點；其餘指定操作節點已找到 |
| 鑽床 | 62 / 42 | JSON 節點均可找到；三個 MOUNT 是空掛點，不能當成實體零件 |

完整逐項參照、來源階層、每個手輪的世界 Pivot／軸向、行程與掛接誤差：

- [machine-audit.json](reports/machine-audit.json)
- [machine-integration.md](reports/machine-integration.md)
- [車床既有詳細對照](reports/part-mapping.md)

重新核對：`npm run audit:models`。Node 端解析真實 GLB 幾何並略過貼圖解碼；真實材質載入在瀏覽器測試驗證。

## 安全警告與尚未具備的功能

車床使用包含祖先變換的世界 Box3，計算刀座與夾頭／示範工件的間隙；0.07 為黃警告、0.02 為紅警告，數值在 `lathe_parts.json.safety`。主軸減速期間仍依實際 RPM 判斷。移動刀具時也會給黃色提示，紅色優先。

銑床原模型缺少可辨識的切削刀具、虎鉗與工件；鑽床缺少工件與虎鉗，也未提供接近距離閾值。因此頁面會顯示「接近偵測未啟用」，保留主軸運轉中進給的通用黃色提示，不能假稱已有精確紅色距離警告。

待人工補齊／校正：

1. 銑床 Worktable_X_Slide 名稱不一致；Y／Z 手輪用途、主軸 X 軸、所有 Pivot 與教學行程；目前膝座鑄件仍固定。
2. 銑床缺少刀把、刀具、虎鉗、工件及啟動拉桿；只有原模型的主軸可旋轉。
3. 鑽床工作臺升降／旋轉仍屬 PendingVerification，預設停用；升降手輪未建模，不能提供真實手輪操作。
4. 鑽床 Spindle／Chuck／DrillBit 幾何分界、HeadSideRod 用途、手柄角度到套筒位置關係；35° 正向空行程屬教學選擇。
5. 車床高度旋鈕與拉桿的實機用途；縱向輪為整合式握持環，沒有獨立凸出握把；刀座 Box3 並非精確切削刃。
6. 所有機器的實機尺寸、導程、允許 RPM、夾具／工件安裝設定和安全閾值；模型來源與授權。
7. 未收到的銑床／鑽床模型 .md 文件，以及實體手機操作驗證。

## 測試

```bash
npm test
npm run audit:models
npm run build
```

瀏覽器檔案留在專案內（PowerShell）：

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright-browsers'
npx playwright install chromium
npm run test:browser
```

`npm test` 包含 13 項原車床幾何回歸測試與 6 項共用核心測試，使用三個真實 GLB 驗證 Pivot、父子繼承、握把隔離、行程、主軸外殼靜止、工件連動、重設、世界距離、30/144 FPS 一致性與缺件報錯。瀏覽器測試操作真實 DOM 和 Pointer Events，開發模式 `?inspect=1` 只提供唯讀快照，沒有修改模型的測試後門。正式版不暴露快照。

最新實際執行結果見 [驗證紀錄](reports/verification.md)。原車床版本測試紀錄保留在 reports/lathe-implementation.md 與 reports/lathe-browser-tests.previous.txt，不代表整合版瀏覽器測試結果。
