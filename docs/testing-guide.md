# 測試說明：glb 匯出工具（階段 1）

照著做即可，不需要背景知識。每一步都有「預期結果」；結果不符就看最後的「常見問題」。

---

## 1. 取得分支

需要先裝好：Git、Git LFS、Node.js 20 以上、Chrome（或 Edge）。

1. 打開終端機，進到專案資料夾（已 clone 過的 `machine-lab-3d`）：

```bash
cd machine-lab-3d
```

2. 取得遠端分支：

```bash
git fetch origin unity-export
```

**預期結果**：沒有錯誤；可能出現 `* [new branch] unity-export -> origin/unity-export`。

3. 切換到分支：

```bash
git checkout unity-export
```

**預期結果**：`Switched to a new branch 'unity-export'`（或 `Switched to branch`）。

4. 拉下機台模型（Git LFS，**一定要做**，否則工作室打不開）：

```bash
git lfs install
```

```bash
git lfs pull
```

**預期結果**：`public/models/machines/lathe/lathe.glb` 約 6 MB（不是 132 bytes）。可以用下面指令確認：

```bash
ls -l public/models/machines/*/*.glb
```

5. 安裝套件：

```bash
npm install
```

**預期結果**：最後出現 `added … packages` 或 `up to date`，沒有 `ERR!`。

---

## 2. 啟動與匯出

1. 啟動開發伺服器：

```bash
npm run dev
```

**預期結果**：出現 `Local: http://localhost:5173/`。這個視窗不要關。

2. 用 Chrome 打開（注意 `?nobatch` 一定要加，否則工作室的節點名稱會被合併掉）：

```
http://localhost:5173/?area=lobby&nobatch#/world
```

**預期結果**：看到門外（Machine Yard 招牌與大門）。按 F12 打開開發者工具的 Console，看得到
`[export] 匯出工具就緒：Shift+E 匯出目前區域、Shift+A 匯出全部`。

3. **一次全部匯出（建議）**：先在畫面上點一下（讓鍵盤焦點在網頁），再按 **Shift + A**。

   工具會自動依序：門外/玄關 → 工作室（車床）→ 工作室（銑床）→ 工作室（鑽床），每到一處就匯出。
   **預期結果**：Console 陸續出現 `[export] exterior_static.glb … KB … tris` 等訊息；畫面會自己淡出淡入切換區域。
   有獨立顯卡的電腦約 3–8 分鐘（無 GPU 的雲端測試機實測約 30 分鐘）；匯出時畫面會停頓、風扇會轉，屬正常。最後一行是 `machine_drill_interactive.glb`。

4. **只匯出目前區域**：按 **Shift + E**。
   - 在門外或玄關按 → 產生 `exterior_*`、`vestibule_*`。
   - 在工作室按 → 產生 `workshop_*`、`toolbox_*`、`tools/*`、目前機台的 `machine_<id>_*`。
   - 要換機台：把網址的 `area=lobby` 改成 `area=workshop&machine=milling`（或 `drill`、`lathe`），保留 `&nobatch`，重新整理後按 Shift+E。例如：

```
http://localhost:5173/?area=workshop&machine=milling&nobatch#/world
```

5. **檔案位置**：專案根目錄的 `exports/` 資料夾（不會被 commit）。

**預期會產生的檔案**（全部匯出後，共 27 個 glb（14 個場景／機台檔＋13 個單件工具）＋1 個 manifest.json）：

| 檔案 | 內容 |
|---|---|
| `exterior_static.glb` / `exterior_interactive.glb` | 門外：外牆、穹頂、招牌／大門（可開關） |
| `vestibule_static.glb` / `vestibule_interactive.glb` | 玄關：牆、管線／金庫門、告示板、放映幕、牆面齒輪、閥門 |
| `workshop_static.glb` / `workshop_interactive.glb` | 穹頂工作室：擺設／會動的鐘擺、飛船、齒輪、瞬移圓盤 |
| `toolbox_static.glb` / `toolbox_interactive.glb` | 工作桌與工具箱／13 件工具（在箱內位置） |
| `tools/tool_*.glb`（13 個） | 每件工具單獨一檔，以工具中心為原點 |
| `machine_lathe_static.glb` / `machine_lathe_interactive.glb` | 車床：固定機身／會動的溜板、手輪、主軸、拉桿 |
| `machine_milling_static.glb` / `machine_milling_interactive.glb` | 銑床 |
| `machine_drill_static.glb` / `machine_drill_interactive.glb` | 鑽床 |
| `manifest.json` | 每個檔案的物件清單、被略過的物件與原因 |

（實際清單、大小與三角形數見 `docs/export-report.md`。）

---

## 3. 驗證匯出檔

### 3-1 用線上檢視器
1. 打開 https://gltf-viewer.donmccurdy.com/ （或 https://sandbox.babylonjs.com/）。
2. 把 `exports/exterior_static.glb` 拖進視窗。

**預期結果**：看到八角外牆與玻璃穹頂、磚牆有貼圖（不是全黑、不是全白）。

3. 在 Babylon Sandbox 按右下角「Inspector」→ 左側 Scene Explorer 展開節點。

**預期結果**：節點名稱是可讀的英文，例如 `OuterWall_0`、`GlassDome`、`MachineYardSign`、`OuterDoors`（不是 `node_0`）。

4. 機台：拖入 `machine_lathe_interactive.glb`，節點樹中應看得到 `CarriageAssembly`、`SpindlePivot` 等名稱（與 `public/models/lathe_parts.json` 中的名稱一致）。
5. 工具：拖入 `tools/tool_*.glb`，應是一件完整的工具，在畫面中央。

### 3-2 本機檢視器（不想上傳時）
VS Code 安裝擴充套件「glTF Tools」（Cesium），對 glb 按右鍵 → *glTF: Preview 3D Model*。

### 3-3 對照 manifest.json 要檢查的項目
用任何文字編輯器打開 `exports/manifest.json`：
- `files[]`：每個檔案的 `status` 應為 `"ok"`；`bytes` > 0。若是 `"empty"` 表示該部分沒有網格（正常情況不會出現）；`"failed"` 看 `error`。
- `files[].objects`：前三層節點清單——對照檢視器看到的名稱是否一致。
- `files[].interactiveReasons`（interactive 檔）：每個會動物件被分到 interactive 的理由。
- `groups[].skipped`：沒匯出的物件與原因（天空 shader、粒子、燈光、隱形點擊範圍、開發按鈕…）。
- `groups[].lights`：被略過的燈光參數（Unity 重建用）。
- `groups[].warnings`：透明材質、CanvasTexture 只烘了當下一格、`Batched_*`（若出現表示忘了加 `?nobatch`）。
- `groups[].expandedInstancedMeshes`：被展開的 InstancedMesh 與實例數。
- 機台的 `groups[].configNodesMissingInScene` 應為空陣列 `[]`；不是空的代表設定檔裡的名稱在模型中找不到。

---

## 4. 確認正式建置不含匯出工具

```bash
npm run build
```

**預期結果**：出現 `✓ built in …`。接著搜尋產物：

```bash
grep -rl "__xrExport\|GLTFExporter\|__export/" dist/ || echo "OK：沒有找到"
```

**預期結果**：印出 `OK：沒有找到`。若列出檔案，表示匯出工具被打包進正式版（失敗）。

---

## 5. 桌機版與 Quest 版行為檢查清單

在 `npm run dev` 開著的情況下逐項打勾：

**桌機版（`http://localhost:5173/`）**
- [ ] 首頁正常顯示，版本號 v3.0.0
- [ ] 工安守則頁可開啟，內容與之前相同
- [ ] 工具盒頁：可點選工具、升起、顯示名稱與說明、放回
- [ ] 加工教室：車床／銑床／鑽床模型可載入、可轉手輪、主軸可啟停
- [ ] 加工關卡可進入
- [ ] 按 Shift+E、Shift+A 在這些頁面**沒有任何效果**（匯出工具只在 `#/world`）

**Quest 版（`#/world`，可用桌機 Chrome 或 Quest 瀏覽器＋`npm run dev:xr`）**
- [ ] 門外：點大門 → 門開、進入玄關
- [ ] 玄關：告示板翻頁、放映幕播放、壓力錶進度變化
- [ ] 金庫門：解鎖後開門進入工作室，站在工作桌前
- [ ] 工作室圓頂布局、工作桌與工具箱、地板拉桿都在原位
- [ ] 瞬移圓盤（機台正面、兩側、工作桌前）可用
- [ ] 左手 Y 選單（桌機按 M）可打開，3 個存檔欄位等原設計不變
- [ ] F 鍵開關 FPS、L 鍵回到門外
- [ ] 機台手輪可轉、DRO 會變

自動測試（可選）：

```bash
npm test
```

**預期結果**：最後顯示 `# fail 0`。

---

## 6. 常見問題

| 狀況 | 原因與解法 |
|---|---|
| 按 Shift+A／Shift+E 沒反應 | ① 先在 3D 畫面上點一下讓網頁取得鍵盤焦點；② 確認網址有 `#/world`；③ Console 有沒有「匯出工具就緒」——沒有代表不是 `npm run dev`（`npm run preview`／正式版不含工具）；④ 輸入法要切到英文；⑤ 匯出進行中再按會被忽略，等它完成 |
| 工作室一直「載入中」或顯示「回應不是有效的 GLB 模型」 | 沒有拉 Git LFS：執行 `git lfs install` 與 `git lfs pull` 後重新整理 |
| `exports/` 沒有檔案，但瀏覽器跳出下載 | 匯出工具連不到開發伺服器的 `/__export/`（例如用別的伺服器開網頁），改成瀏覽器下載；檔案在「下載」資料夾，`tools/` 底下的檔名會變成 `tools__xxx.glb`。用 `npm run dev` 開網頁即可寫進 `exports/` |
| 瀏覽器問「是否允許下載多個檔案」 | 同上（退回下載模式）；選「允許」 |
| 檢視器裡貼圖全黑 | ① 檢視器沒有環境光：Babylon Sandbox 的 Inspector 調整環境、或換 donmccurdy viewer（預設有環境光）；② 金屬度高的材質（黃銅、鑄鐵）在沒有環境貼圖時看起來就是黑的，這是正常的 |
| 檢視器裡物件是粉紅或白色 | 該材質原本是自訂 shader，被略過或只有基底顏色；查 manifest 的 `skipped` / `warnings` |
| manifest 出現 `Batched_*` 警告 | 網址少了 `&nobatch`，重新整理後再匯出 |
| 匯出非常慢 | 大檔（工作室約 38 MB）要把貼圖編成 PNG；等 Console 出現「完成」再關頁面 |
| `npm run build` 後 grep 找到 `GLTFExporter` | 匯出工具被打包了（不應發生）；請回報 |

---

## 7. 階段 2（Unity 骨架＋門外場景）測試 — 與階段 1 一起測

> Unity 專案在 `unity/MachineYard/`，是在沒有 Unity 的環境寫的，**尚未編譯過**。完整步驟與驗收清單見 `unity/README.md`，這裡只列摘要。

1. 先完成第 2 節的匯出（至少要有 `exports/exterior_static.glb`、`exports/exterior_interactive.glb`）。
2. 裝 Unity 6 LTS（含 Android Build Support），Unity Hub 用「Add project from disk」開 `unity/MachineYard`。
   **預期結果**：套件解析完成，Console 沒有紅色編譯錯誤。有紅字 → 把訊息貼給我。
3. 依序執行選單 `Machine Yard ▸ 1. Apply Quest Settings`，手動勾 OpenXR / Meta Quest Support（`unity/README.md` 第 4 步），匯入 XRI 的 Starter Assets 範例。
4. 選單 `2. Import glb exports`（選 `exports/` 資料夾）→ `3. Build Exterior Scene`。
   **預期結果**：`Assets/Scenes/Exterior.unity` 產生，Scene 視窗看到磚牆八角建築與玻璃穹頂、大門與招牌。
5. Quest 3 開發者模式連線，`File ▸ Build And Run`。
   **預期結果**：戴上頭盔站在門外；左下角有 FPS，目標 ≥ 72；射線點大門，門約 1 秒向內推開。
6. 回報：FPS 數字（靜止與環顧）、門的方向是否正確、招牌文字是否鏡像、有無粉紅材質。

常見問題：門往外開 → 對調 `ExteriorDoors` 的兩個 openDegrees 正負號；整個場景左右相反 → `ThreeCoords.Mode` 改成 `NegateZ` 後重建場景；套件找不到版本 → Package Manager 升級該套件。
