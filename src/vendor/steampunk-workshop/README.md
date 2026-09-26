# Steampunk Workshop — Three.js 遊戲背景場景

蒸汽龐克穹頂工作室場景，打包成可以直接放進 three.js 小遊戲的模組。

> **本專案只保留 `src/components/SteampunkWorkshopWorld.jsx` 用到的模組。** 單獨預覽頁（index.html、main.js、workshop.js）、
> examples/、機台位、相機／渲染器、blockout、glTF 匯出等獨立版檔案已移除，下方說明保留作為原始套件的參考。
房間正中央保留了一個「機台位」（Machine Slot），一次放一台工具機（車床、鑽床、銑床…）。

## 資料夾內容

```
steampunk-workshop/
├─ src/                    場景原始碼（ES modules）
│  ├─ workshop.js          ★ 對外入口：createWorkshop()
│  ├─ game/machineSlot.js  中央機台位（一次一台）
│  ├─ config/layout.js     房間尺寸、所有物件位置、MACHINE_SLOT、相機設定
│  └─ …                    core / lighting / materials / structure / assets / effects / utils
├─ examples/
│  ├─ machine-slot.html    範例：場景 + 可替換的工具機
│  ├─ machine-slot.js
│  └─ placeholderMachines.js  簡易車床 / 鑽床 / 銑床替身模型
├─ index.html              單獨預覽場景
├─ styles/main.css         全螢幕畫布 + 淡入
├─ scripts/serve.py        本機開發伺服器（停用快取）
├─ docs/LAYOUT.md          空間布局說明
├─ AGENT.md                需求與開發紀錄
└─ PROMPT.md               給 AI 助手的整合指令範本
```

大小約 0.5 MB。沒有圖片、模型檔，所有貼圖都在載入時程式生成（約 3–8 秒）。

## 需求

- three.js **r163 以上**（開發使用 r170）。
- 程式碼用 `import 'three'` 和 `import 'three/addons/...'`：
  - **Vite / webpack 等打包工具**：`npm i three` 即可，不用改任何路徑。
  - **不用打包工具**：在 HTML 放 import map（見 `index.html`）。
- 必須透過 http 伺服器開啟（ES modules 不能用 `file://`）：`python scripts/serve.py 5189`。

## 最小用法

```html
<div id="game" style="width: 100vw; height: 100vh"></div>
```

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWorkshop } from './steampunk-workshop/src/workshop.js';

const workshop = await createWorkshop(document.getElementById('game'), {
  quality: 'medium',        // 'low' | 'medium' | 'high'，不填 = 自動偵測
  idleAutoRotate: false,    // 遊戲中通常關掉閒置自動旋轉
});

const gltf = await new GLTFLoader().loadAsync('models/lathe.glb');
workshop.setMachine(gltf.scene, { disposePrevious: true });
workshop.focusMachine();    // 相機平滑飛到機台前
```

## API（`createWorkshop` 回傳的物件）

| 成員 | 說明 |
|---|---|
| `scene`, `camera`, `renderer`, `controls` | three.js 物件，可以自行加東西（UI 標記、粒子、射線點擊…） |
| `setMachine(object, opts)` | 放入一台工具機，**會自動移除前一台**。回傳 `{ object, holder, size }` |
| `clearMachine({ dispose })` | 移除目前機台 |
| `getMachine()` / `getMachineBounds()` | 目前機台 / 世界座標包圍盒 |
| `focusMachine(duration)` | 相機飛向機台 |
| `flyTo(pos, target, duration)` / `setView(pos, target)` / `resetView()` | 相機控制 |
| `setControlsEnabled(bool)` | 關閉滑鼠環繞（例如要點擊機台零件時） |
| `onUpdate(fn)` | 每幀呼叫 `fn(dt, elapsed)`，回傳取消函式；用來跑動畫 mixer、遊戲邏輯 |
| `start()` / `stop()` / `update(dt)` / `render()` | 預設自帶迴圈；`autoStart: false` 時由遊戲自己呼叫 |
| `resize()` / `dispose()` | 手動調整尺寸 / 完整釋放（離開關卡時） |

`setMachine` 選項：

| 選項 | 預設 | 說明 |
|---|---|---|
| `scale` | 1 | 先套用的等比縮放（模型單位是 mm 就填 `0.001`，cm 填 `0.01`） |
| `rotationY` | 面向預設相機 | 機台繞 Y 軸旋轉（弧度）；模型正面應朝 +Z |
| `fit` | `true` | 太大就等比縮小到機台位；`'always'` 連太小也放大；`false` 保持原大小 |
| `shadows` | `true` | 投射 / 接收陰影 |
| `disposePrevious` | `false` | 換機台時釋放前一台的 GPU 記憶體 |

## 機台位規格（`src/config/layout.js` 的 `MACHINE_SLOT`）

- 位置：房間中心 `(0, 0, 0)`，地板高度 y = 0，單位公尺，Y 軸朝上。
- 可用空間：水平最長邊 **4.2 m**、高度 **3.2 m**（上方吊燈最低約 3.8 m），中心周圍約 3 m 內淨空。
- 模型會被自動：縮到可放入、置中、底部貼齊地板、轉向預設相機、開啟陰影。
- 陽光光束落在中央附近，正上方有吊燈照明，機台會自然被打亮。

## 模型建議

- 格式 `.glb`（glTF 2.0），單位公尺，Y 軸朝上，正面朝 +Z，原點在底部中央最好（不是也沒關係，會自動置中）。
- 材質用 PBR（metallic / roughness）。場景提供環境反射，金屬會自然反射出工作室的暖色。
- 可以用 Draco 壓縮（範例已設定 DRACOLoader）。
- 模型內的動畫（主軸旋轉等）可以用 `AnimationMixer` 搭配 `workshop.onUpdate` 播放，見 `examples/machine-slot.js`。

## 範例

```bash
python scripts/serve.py 5189
```

開啟 `http://localhost:5189/examples/machine-slot.html`：

- 按 `1` / `2` / `3` 切換替身車床 / 鑽床 / 銑床。
- 把自己的 `.glb` 拖進網頁即可替換。
- 或用網址 `?model=models/lathe.glb` 直接載入。
- 按 `F` 對焦機台，`R` 重設視角，`C` 開關相機控制。

## 注意

- 場景本身不顯示任何 UI；遊戲 UI 請疊在容器上方（HTML/CSS）。
- 容器要有明確尺寸；載入時容器隱藏也沒關係，顯示時會自動調整大小。
- `debug: true` 會把輔助函式掛到 `window.workshop`（開發用）。
