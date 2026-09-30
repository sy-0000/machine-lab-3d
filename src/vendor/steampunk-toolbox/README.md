# 蒸汽龐克互動工具盒（網站嵌入版）

> 來源：`Assets/steampunk-toolbox`。網站的工具盒頁面（`src/components/SteampunkToolbox.jsx`）透過 `src/mount.js`
> 的 `mountToolbox(container, uiRoot)` 掛進頁面，取代原本全頁的 `main.js`；面板樣式改寫在 `src/styles/toolbox.css`。
> 為了嵌入頁面改過的地方：`core/cameraRig.js`（取景用畫布大小而非視窗大小）、`ui/infoPanel.js`（面板位置相對於畫布）、
> `interaction/pointerInput.js`（加 `dispose()`）。其餘模組與原專案相同；工具資料仍在 `src/config/tools.config.js`，
> 網站上的工具介紹卡片也讀這一份。下方為原專案說明（index.html、build.mjs、styles/ 未搬進網站）。

# 蒸汽龐克互動工具盒（Three.js 模組化專案）

## 執行
ES 模組需透過本機伺服器開啟（不能直接雙擊 index.html）：
```bash
cd steampunk-toolbox
python -m http.server 8000     # 或 npx serve .
# 瀏覽器開 http://localhost:8000
```
Three.js 由 index.html 的 import map 從 jsDelivr 載入（r186），不需 npm。

- 品質等級：`?q=low` / `?q=medium` / `?q=high`（預設 high，設定在 `src/config/quality.config.js`）
- 白模檢視：`?whitebox=1`
- 打包成單一 HTML：`npm i three esbuild && node build.mjs` → `dist/steampunk-toolbox.html`

## 操作
| 狀態 | 操作 |
|---|---|
| 瀏覽 | 拖曳旋轉、滾輪縮放、懸停工具浮起描邊、點擊拿起 |
| 展示 | 拖曳旋轉工具、← → 切換、Esc 或「放回盒中」返回 |

## 新增一件工具
1. 在 `src/assets/tools/` 新增模型模組，匯出 `createXxx(mat)`，回傳一個 `THREE.Group`
   （慣例：平躺、長軸沿 X、朝上為 +Y、原點約在中心；可選 `userData.update(time)` 做小動畫）。
2. 在 `src/config/tools.config.js` 加一筆資料（名稱、數量 quantity、成組件數 count、說明、model、slot 位置、display 旋轉與縮放）。
   尺寸請用 `src/utils/units.js` 的 `mm()` 以實際毫米建模，工具之間比例才會一致。
   除錯：`?layout=1` 會在主控台列出各工具範圍，並警告凹槽重疊或超出盒內。
凹槽會依模型實際輪廓自動挖出，主程式不需修改。

## 結構
```
index.html                 入口框架（只有容器與 import map）
styles/panel.css           資訊面板樣式
src/main.js                組裝各模組、主迴圈
src/config/                tools.config.js（工具資料）、quality.config.js（品質等級）
src/core/                  renderer、camera rig、工坊環境貼圖、後處理
src/lighting/lightRig.js   瀏覽／展示雙燈光狀態與平滑混合、燈泡呼吸
src/state/stateMachine.js  BROWSE → LIFTING → SHOWCASE ⇄ SWITCHING → RETURNING
src/interaction/           指標輸入（射線、拖曳）、工具動畫控制
src/fx/                    體積光錐、塵埃粒子、升起揚塵
src/ui/infoPanel.js        HTML 疊加層面板
src/materials/             程序化貼圖與材質庫
src/assets/                工具盒（含凹槽挖切）、工作台、背景、燈泡、tools/ 每件工具
docs/state-diagram.md      狀態圖與布局
AGENT.md                   需求摘要與步驟清單
```
每件資產都是獨立的 Group，可用 `GLTFExporter` 直接匯出。
