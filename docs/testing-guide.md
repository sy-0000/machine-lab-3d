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

**預期會產生的檔案**（全部匯出後，共 27 個 glb（14 個場景／機台檔＋13 個單件工具）＋ 3 個 `machine_<id>_runtime.json`（機台控制設定，Unity 階段 4 用）＋ 1 個 manifest.json）：

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
| `machine_lathe_runtime.json`、`machine_milling_runtime.json`、`machine_drill_runtime.json` | 機台軸／手輪／主軸／拉桿／段位／掛點／刀片尖端的設定 |
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


---

## 8. 階段 3（玄關＋瞬移／搖桿＋存檔）測試 — 與階段 1、2 一起測

> 同樣尚未在 Unity 編譯過。完整步驟與驗收清單在 `unity/README.md` 的「階段 3」一節。

1. 第 7 節的步驟做完後，再執行一次選單 `2. Import glb exports`（會多匯入 `vestibule_*.glb`）。
2. 照 `unity/README.md` 階段 3 建立中文字型資產 `Resources/MachineYardFont`。
3. 選單 `4. Build Lobby Scene (stage 3)` → `Build And Run` 到 Quest 3。
   **預期結果**：能從門外走完整個流程：開大門 → 讀告示板 → 看三段動畫 → 解鎖金庫門 → 進佔位工作室 → 用瞬移圓盤。
4. 回報：①玄關 fps（靜止、環顧）；②門與指針方向是否正確；③中文是否正常；④搖桿走動手感、有沒有穿牆；⑤瞬移拋物線能不能指到圓盤；⑥重啟後進度是否保留。

常見問題：中文方塊 → 沒建 `MachineYardFont`；移動重複或抖動 → Starter Assets 的 Move/Turn provider 沒被停用（重跑選單 4）；搖桿沒反應 → Project Settings ▸ Player ▸ Active Input Handling 要含 Input System（Both 或 Input System Package）。


---

## 9. 階段 4（工作室＋車床互動）測試 — 與前面一起測

> 完整說明與驗收清單在 `unity/README.md` 的「階段 4」。以下是最短路徑。

### 9-1 先跑一個不需要 Unity 的檢查（約 1 分鐘）
需要 dotnet 8（`dotnet --version`）：

```bash
npm run test:unity-core
```

**預期結果**：最後一行 `約 1153966 checks, 0 failures`（數字可能因標準答案更新而略有不同，但失敗必須是 0）。這是車床切削、主軸、手輪行程的數學，與網站 JS 逐項比對。

### 9-2 重新匯出（修正了隱藏零件）
照第 2 節再跑一次 `Shift+A`（`?area=lobby&nobatch#/world`）。**預期結果**：`exports/` 多了 `machine_lathe_runtime.json`；`machine_lathe_static.glb` 的三角形比上次少（約 8.5 萬，原本 19.6 萬含被隱藏的舊零件）。

### 9-3 Unity
1. 選單 `2. Import glb exports (lobby)`（若有更新）、`2b. Import glb exports (workshop + lathe)`。
2. 選單 `4. Build Lobby + Workshop Scene (stage 3-4)`。**預期結果**：Console 出現「工作室與車床已建立」，以及停用小零件數、光源數。
3. Build And Run 到 Quest 3，照 `unity/README.md` 階段 4 的清單逐項操作。
4. 回報：①工作室靜止 fps、車床操作中 fps（OVR Metrics 的 draw call／三角形也貼上）；②拉桿、手輪、段位旋鈕的方向與手感是否正確；③工件被車削的樣子；④DRO 數值是否與桌機一致；⑤任何粉紅材質或穿幫。

常見問題：fps 很低 → 預期內，貼數字給我決定要簡化什麼；手輪抓不到 → 射線要指到手輪再按 grip；面板叫不出來 → 左手 **X**（不是 Y，Y 是階段 3 的簡易選單）。


## 10. 階段 5（銑床、鑽床、工具箱、特效、音訊、存檔）測試 — 與前面一起測

> 完整說明與驗收清單在 `unity/README.md` 的「階段 5」。以下是最短路徑。

### 10-1 不需要 Unity 的檢查（約 1 分鐘）
```bash
npm run test:unity-core
```
**預期結果**：輸出裡有 `head: 257 步（…步有改動），含面銑／立銑／鑽孔／攻牙／孔邊再銑`、`springReturn: 193 步`、`synth: …`、`dto: …`，最後一行 `約 1153966 checks, 0 failures`。這包含槌頭銑削／鑽孔／攻牙與網站 JS 逐步比對、鑽床彈簧手柄回位、存檔格式來回與壞檔拒絕、合成音的基本性質。

### 10-2 工具資料（已附在專案裡，只有網站資料更新時才需要）
```bash
node scripts/export-tools-json.mjs
```
**預期結果**：`tools.json: 13 件`，寫到 `unity/MachineYard/Assets/Resources/tools.json`。

### 10-3 Unity
1. 選單 `2b. Import glb exports (workshop + machines)`（會多匯入銑床、鑽床，約 200 MB）。
2. 選單 `4. Build Lobby + Workshop Scene (stage 3-5)`。**預期結果**：Console 沒有「略過這台機台」的警告；有「工作室與車床已建立」。
3. Build And Run 到 Quest 3，照 `unity/README.md` 階段 5 的銑床／鑽床／工具箱／存檔清單逐項操作。
4. 回報：①三台機台操作中的 fps（OVR Metrics 的 draw call／三角形也貼上）；②銑床三個手輪方向與 DRO 是否和桌機一致；③鑽床手柄放開是否回彈、孔的位置與深度；④刀具是否隨主軸轉動且不偏心（刀尖在主軸中心）；⑤切屑、火花、蒸汽、聲音的感覺；⑥工具箱升起的位置與說明面板是否在視線前方；⑦存檔／讀檔；⑧任何粉紅材質、穿幫或編譯錯誤。

常見問題：換機台沒反應 → 要先進過工廠（打開金庫門）；刀具不見 → 看 Console 是否有「機台節點不存在於匯入模型」；鑽孔沒有孔 → 鑽頭要先停在工件上方、對準劃線，主軸轉動中往下拉手柄（反轉不會鑽）；攻牙無效 → 要先有 Ø8.5 底孔、用 M10 絲攻正轉。


## 11. 階段 5 之後的修正（互動、移動、字型、放映幕）— 與前面一起測

### 11-1 Unity 準備
1. 選單 `1. Apply Quest Settings`，並在 Meta Quest Support ▸ Target Devices 只勾 **Quest 3**。
2. 選單 `0b. Create CJK font asset (Noto Sans TC)`。**預期結果**：Console 出現「已建立 Assets/Resources/MachineYardFont.asset：約 1070 字」，沒有「字型裡沒有的字」。
3. 選單 `4. Build Lobby + Workshop Scene (stage 3-5)`。

### 11-2 實機檢查
- [ ] **trigger 點擊**：面板按鈕、大門、金庫門手輪、告示板、放映幕按鈕都用 trigger 就有反應（不再需要 grip）
- [ ] **拉桿**：trigger＝正轉、grip＝反轉；**手輪**：grip 抓住畫圈
- [ ] 射線是金色細線、指到可操作的東西有小圓點；XRI 原本的藍色射線不見了
- [ ] 中文都正常顯示（沒有方塊）
- [ ] 放映幕播出網站的三段動畫（車床、銑床、鑽床），播完自動換下一段；看完三段後壓力錶滿格
- [ ] 左手 Y 選單：「移動方式」切到只用瞬移後左搖桿不能走；「轉向」在 30°／45°／平滑之間切換；「暗角」開關
- [ ] 平滑走動時視野四周變暗、停下恢復
- [ ] 右搖桿往前推：指到地板（不是圓盤）時拋物線變淡藍色，放開瞬移過去、面向不變
- [ ] 握著手輪時推搖桿不會移動
- [ ] 車床：刀尖碰到工件外圓時出現光圈（轉動中切削是橘色）

### 11-3 網站版選單（已修正）
在 Quest 瀏覽器開網站 VR：左手 Y 開選單，連續點不同的跳轉項目（例如回玄關、去工作室），每次都要有反應，不會再「點了沒反應、之後全部點不動」。


## 12. 門、出口、自我檢查、減面、選單測試

### 12-1 不需要 Unity
```bash
node scripts/check-geometry.mjs
```
**預期結果**：印出車床夾爪範圍（x 8–64 mm）與工件掛點（64.3 mm），以及鑽頭刀柄位置（在鑽夾頭內）。

```bash
npx playwright test tests/xr-menu.spec.js --workers=1
```
**預期結果**：`1 passed`（約 3 分鐘；網站 VR 選單的跳轉連點三次都成功）。

```bash
node scripts/simplify-exports.mjs
```
**預期結果**：表格列出每個檔案原始、50%、25% 的三角形數，檔案寫到 `exports/lod/`（需要先有完整匯出）。

### 12-2 Unity
1. 選單 `2b`（會一起匯入 `lod/`）→ `4` 建場景 → **`5. Self-check`**。**預期結果**：Console 顯示「0 個錯誤」；專案根目錄產生 `SelfCheck.md`（有錯誤或 fps 不夠時把這個檔案貼給我）。
2. Window ▸ General ▸ Test Runner ▸ EditMode ▸ Run All。**預期結果**：6 個測試通過（沒匯入機台時 1 個 Inconclusive）。
3. fps 不夠時：選單 `Detail ▸ 50%`（或 25%）→ `4` 重建 → `6. Bake occlusion culling` → 存檔 → Build。

### 12-3 實機
- [ ] 玄關的門是**拱形鋼門**（不是圓門），兩側壓力錶、上方指示燈都沒被擋住
- [ ] 在門前點手輪 → 畫面淡出、退後一步 → 手輪轉、門栓收回噴蒸汽、門**往自己這邊（玄關）**轉開 → 進工廠
- [ ] 工作室：轉身看工作桌後方，是同一種拱形鋼門；trigger 點門 → 手輪轉、門栓收回、門往外轉開 → 淡出 → 站在玄關金庫門外，門在面前關上（門栓伸出噴蒸汽、手輪反轉）
- [ ] 再點金庫手輪：完整開門動畫再播一次 → 回到工作室
- [ ] 指到手輪、拉桿、按鈕會發亮（綠色光暈）
- [ ] 車床裝上工件：工件左端插在三爪夾頭的爪子裡（約 4 cm），不是貼在夾頭前面


## 13. 貼圖瘦身與一鍵打包（建議的完整上機流程）

### 13-1 網站專案（一次）
```bash
node scripts/simplify-exports.mjs
```
```bash
node scripts/slim-textures.mjs
```
**預期結果**：最後一行約 `合計 500 MB → 144 MB（貼圖 404 → 49 MB；最長邊 ≤ 1024）`，產生 `exports/quest/`。

### 13-2 Unity
1. 選單 `1. Apply Quest Settings` → XR Plug-in Management ▸ Android 勾 OpenXR → OpenXR ▸ Meta Quest Support（Target Devices 只勾 Quest 3）。
2. 選單 `0b`（字型）→ `2` 與 `2b`，資料夾都選 **exports/quest** → `4` 建場景。
3. 選單 `5. Self-check`：0 個錯誤；看 `SelfCheck.md` 的貼圖記憶體。
4. Quest 3 用 USB 接電腦（開發者模式）→ 選單 **`7b. Build And Run on Quest 3`**。**預期結果**：對話框顯示 APK 大小與耗時，頭盔自動啟動 Machine Yard。只要 APK 就選 `7`。

### 13-3 門的 3D 預覽（不需要頭盔）
```bash
npm run dev
```
開 http://localhost:5173/dev/door-preview.html：拖曳轉視角，按「開門／關門」看動畫，「工作室出口」切換到較高的版本。
