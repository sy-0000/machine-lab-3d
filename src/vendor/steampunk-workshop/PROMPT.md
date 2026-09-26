# 整合指令範本（貼給 AI 助手使用）

把下面整段貼給你的 AI 編碼助手，並把 `〈…〉` 換成你的實際內容。

---

我的網頁小遊戲使用 three.js。專案裡有一個資料夾 `steampunk-workshop/`，是一個已完成的蒸汽龐克工作室背景場景。請先閱讀 `steampunk-workshop/README.md`、`steampunk-workshop/src/workshop.js` 和 `steampunk-workshop/src/game/machineSlot.js` 再動手。

**背景場景的規則（請遵守，不要修改 `steampunk-workshop/src/` 內的檔案）：**
- 用 `createWorkshop(container, options)` 建立場景，它會回傳 `scene`、`camera`、`renderer`、`controls`，以及 `setMachine`、`clearMachine`、`focusMachine`、`onUpdate` 等 API。
- 房間正中央有一個機台位（`MACHINE_SLOT`），**一次只放一台工具機**。
  - `setMachine()` 會自動移除前一台，並自動縮放、置中、貼地、轉向相機、開陰影。
  - 可用空間：水平最長 4.2 m、高度 3.2 m。
- 場景單位是公尺，Y 軸朝上，地板在 y = 0。
- 場景自帶渲染迴圈；遊戲每幀的邏輯請用 `workshop.onUpdate((dt, elapsed) => { ... })` 掛上去，不要另開 `requestAnimationFrame`。
- 場景本身不顯示任何 UI；遊戲 UI 請用 HTML/CSS 疊在容器上。

**我的工具機模型：**
- 〈車床：models/lathe.glb〉
- 〈鑽床：models/drill_press.glb〉
- 〈銑床：models/milling_machine.glb〉
- 模型單位：〈公尺 / 公分 / 公釐〉（不是公尺請用 `setMachine` 的 `scale` 選項換算）
- 模型正面方向：〈+Z / -Z / +X…〉（需要時用 `rotationY` 修正，讓正面朝向玩家）
- 模型是否含動畫：〈有 / 沒有；例如主軸旋轉〉

**請完成：**
1. 在〈遊戲的主程式檔〉建立場景：
   ```js
   const workshop = await createWorkshop(容器, { quality: 'medium', idleAutoRotate: false });
   ```
   並在載入期間顯示我的讀取畫面（場景貼圖生成約需數秒）。
2. 寫一個 `machines.js` 模組：
   - 用 GLTFLoader（含 DRACOLoader）載入上面的模型，並快取已載入的模型，不要重複下載。
   - 提供 `showMachine(id)`，內部呼叫 `workshop.setMachine(model, { scale, rotationY, disposePrevious: false })`。
     因為有快取，換機台時不要釋放模型。
   - 切換後呼叫 `workshop.focusMachine()`。
   - 若模型有動畫，用 `AnimationMixer` 播放，並透過 `onUpdate` 更新；切換機台時取消前一台的 mixer。
3. 〈遊戲流程，例如：玩家從選單選擇工具機 → 顯示該機台 → 點擊機台零件觸發操作〉
   - 點擊偵測：用 `THREE.Raycaster`，只對 `workshop.getMachine()` 做射線檢測。
   - 需要點擊時，用 `workshop.setControlsEnabled(false)` 暫停相機環繞，結束後再開啟。
4. 離開遊戲或關卡時呼叫 `workshop.dispose()`。
5. 確認：
   - 同一時間場景裡只有一台機台。
   - 機台底部貼地、沒有穿模。
   - 切換流暢，沒有 console 錯誤。
   - 在瀏覽器實際跑過一次，截圖給我看。

---

### 小提醒
- 如果機台看起來太小或太大，先確認模型單位，用 `scale` 修正。不要改 `MACHINE_SLOT`，除非你要重新規劃房間。
- 如果機台正面沒對著玩家，調整 `rotationY`（弧度，`Math.PI` = 轉 180°）。
- 想看替身效果，可以先打開 `examples/machine-slot.html`，直接把 `.glb` 拖進網頁測試。
