# Machine System v1.0 發布與封版報告 (RELEASE NOTES)

**版本**: Machine System v1.0 (Architecture Frozen)  
**封版整理日期**: 2026-09-20  
**架構目標**: 統一 Three.js 主網站，三大工具機（車床、銑床、鑽床）作為可隨時動態載入與卸載的獨立 Machine Module，提供未來 Level System 穩固的加工基礎架構。

---

## 一、Machine System v1.0 核心功能清單

1. **單一主網站與單一共用 3D Scene**：
   - 全站整合為單一 Single Page Application (SPA)，包含：
     - 首頁 (`#/`)
     - 工安守則 (`#/safety`)
     - 刀具介紹 (`#/tools`)
     - 關卡規劃預覽 (`#/levels`)
     - 加工教室 (`#/game` 或 `#/[machineId]`)
   - 加工教室共用同一個 Three.js Canvas（Camera、Lights、Grid、OrbitControls、Raycaster 全面共用）。
   - 切換機台時在同一個 3D 世界內完成卸載、垃圾回收與新機台掛載，不重新整理網頁，不重複建立 WebGL Context。

2. **核心工具機模組化架構 (`src/machines/core/`)**：
   - `MachineBase`：工具機抽象基底類別，實作完整的生命週期管控與 Mount Point 管理。
   - `MachineRegistry`：工具機註冊表，支援 `MachineRegistry.load(id)` 與 `MachineRegistry.unload()`，自動避免重複載入與記憶體洩漏。
   - `MachineLoader`：集中載入並檢驗 Config 與 GLB 二進制結構。

3. **三台標準工具機模組 (`src/machines/[lathe|milling|drill]/`)**：
   - **普通車床 (Lathe Module - 16K20 Engine Lathe)**：
     - 控制器：`LatheController`
     - 設定檔：`lathe.config.js`
     - 掛載點：四方刀架 `ToolMount`、三爪夾頭 `WorkpieceMount`
     - 運動連動：主軸正反轉、變速箱 8 段轉速、床鞍溜板縱向進給、十字溜板橫向進給、四方刀架 10° 步進分度、尾座移動與心軸進給、緊急腳踏煞車。
   - **立式銑床 (Milling Module - Vertical Knee-Type Mill)**：
     - 控制器：`MillingController`
     - 設定檔：`milling.config.js`
     - 掛載點：立銑頭主軸 `ToolMount`、工作臺頂面 `WorkpieceMount`
     - 運動連動：主軸旋轉、X 軸工作臺橫向進給、Y 軸鞍座前後進給、Z 軸膝座升降進給、離合啟動手柄。
   - **桌上鑽床 (Drill Module - TB 145 Bench Drill Press)**：
     - 控制器：`DrillController`
     - 設定檔：`drill.config.js`
     - 掛載點：鑽夾頭 `ToolMount`、工作臺頂面 `WorkpieceMount`
     - 運動連動：主軸旋轉、套筒 (Quill) 垂直進給下壓（含彈簧回位）、工作臺高度調節。

4. **獨立刀具系統 (`src/tools/`)**：
   - `ToolBase`、`tool.config.js`、`ToolLoader`、`ToolRegistry`。
   - 外部系統僅透過 Tool ID 呼叫，不需知道模型路徑。
   - 內建支援刀具：
     - `turning_tool`: 95° 外徑精車刀（含刀桿、刀片底座、可轉位金黃鎢鋼刀片、斷屑槽、壓板鎖緊螺栓）
     - `threading_tool`: 60° 三角螺紋車刀
     - `knurling_tool`: 雙輪斜網紋滾花刀
     - `end_mill`: 四刃平頭立銑刀
     - `face_mill`: 捨棄式四刃面銑刀盤
     - `drill_bit`: 118° 標準頂角雙刃麻花鑽頭
     - `caliper`: 游標卡尺（量具元資料）

5. **獨立工件系統 (`src/workpieces/`)**：
   - `WorkpieceBase`、`WorkpieceLoader`、`WorkpieceRegistry`。
   - 支援依預設 ID 或動態規格（直徑、長度、材質）自動生成 3D 工件。
   - 內建支援預設工件：
     - `cylinder_30x100`: 鋁合金圓棒 Ø30×100mm
     - `cylinder_50x150`: 中碳鋼圓棒 Ø50×150mm
     - `cylinder_26x180`: 車床示範圓棒 Ø52×180mm
     - `block_100x60x40`: 鋁合金銑削方塊 100×40×60mm
     - `block_120x80x50`: 中碳鋼工件方塊 120×50×80mm

6. **開發者除錯面板 (`DeveloperPanel.jsx`)**：
   - 浮動開關「🛠️ 開發者測試面板」，可於開發或調試模式隨時展開。
   - 即時下拉切換 Machine、Workpiece、Tool。
   - 提供 `[ 載入 (Load) ]`、`[ 卸載 (Unload) ]`、`[ 重設 (Reset) ]` 按鈕。
   - 提供 4 組快速測試組合按鈕：
     - `Lathe + Turning Tool`
     - `Lathe + Threading Tool`
     - `Milling + End Mill`
     - `Drill + Drill Bit`
   - 即時顯示目前掛載之刀具與工件狀態。

---

## 二、測試與建置驗證結果

1. **單元測試 (Unit Tests)**：
   - 執行指令：`npm test`
   - 結果：**33 項測試全數通過 (33 Pass, 0 Fail)**。
   - 測試項目涵蓋：
     - 機台階層對齊、世界座標保護（誤差 < 1e-6）
     - 各軸向導軌行程極限與手輪進給比例
     - 主軸正轉、反轉、加減速與離合手柄連動
     - 變速箱 Detents 與腳踏煞車
     - 四方刀架分度步進
     - 鑽床套筒進給與彈簧回位
     - 銑床三軸導軌獨立運動
     - `MachineRegistry` 生命週期、卸載清理、自然旋轉繼承與刀具/工件掛載整合

2. **生產環境建置 (Production Build)**：
   - 執行指令：`npm run build`
   - 結果：**建置成功 (Exit Code 0)**，產出最佳化 `dist/` 靜態檔案。

---

## 三、未來 Level System 的標準整合方式

未來 Level System 僅需提供關卡資料（JSON），不包含任何 3D 或模型節點邏輯：

```javascript
// 範例關卡 JSON
const levelData = {
  id: "lathe_01",
  machine: "lathe",
  workpiece: {
    type: "cylinder",
    diameter: 30,
    length: 100,
    material: "aluminum"
  },
  allowedTools: [
    "turning_tool",
    "caliper"
  ],
  objective: {
    operation: "turning",
    targetDiameter: 25,
    targetLength: 40
  }
};

// Level Runner 啟動關卡
async function loadLevel(levelData, scene) {
  // 1. 載入機台（自動卸載前一台）
  const machine = await MachineRegistry.load(levelData.machine);
  scene.add(machine.object3D);

  // 2. 建立並掛載工件
  const workpiece = await WorkpieceRegistry.load(levelData.workpiece);
  await machine.mountWorkpiece(workpiece);

  // 3. 載入第一把允許的刀具
  const tool = await ToolRegistry.load(levelData.allowedTools[0]);
  await machine.mountTool(tool);

  // 4. 啟用機台
  machine.activate();
}
```

---

## 四、已知限制與注意事項 (Known Issues & Notes)

1. **大型二進制檔案大小與 GitHub 限制**：
   - 銑床模型 `public/models/machines/milling/milling.glb` 達 **180.91 MB**，超過 GitHub 單檔 100 MB 限制。
   - 若要推送至 GitHub，強烈建議在推送到遠端前設定 Git LFS 追蹤 `*.glb`。
2. **唯一模型來源與 Git LFS**：
   - 現行模型僅保留 `public/models/machines/{lathe,milling,drill}/` 下的三個 GLB，由 Git LFS 管理。組員 clone 後執行 `git lfs pull`。
   - 舊模型已從最新工作目錄移除，但普通 Git 歷史仍有大型 GLB。首次推送前須按 [上傳指南](GITHUB_AND_LFS.md) 遷移歷史；本次沒有自動改寫歷史或推送 GitHub。
3. **切削與切屑效果**：
   - v1.0 依規劃不包含工件網格變形 (mesh deformation)、體素布林切削 (CSG/Voxel boolean) 及鐵屑粒子系統，此部分將留待未來的 Machining System 實作。

## 五、封版清理與介面更新

- 新版桌面首頁使用左圖右文的橫式卡片，手機版上下排列。
- 移除未被新版 App 使用的 `MachinePage.jsx`、`LathePage.jsx`、`MillingPage.jsx`、`DrillPressPage.jsx`；加工教室統一由 `src/pages/GameWorkspace.jsx` 進入。
- 移除依賴已刪除原始模型的一次性腳本：`match-split.mjs`、`restore-milling-materials.mjs`、`patch-milling-back-materials.mjs`。
- 納入已整理的 `todelete/` 與舊模型刪除；舊版來源可由 Git 歷史追溯。
- 保留仍被核心引用的 `lathe.js`、`latheParts.js`、模型 manifest、來源 README、測試及稽核工具。保留的 inspect 腳本改用現行模型路徑。
- README 改寫為新版頁面編輯地圖、啟動與測試說明；新增 `GITHUB_AND_LFS.md`。
- 車床刀具移到左槽、縮短伸出量；工件掛載點使用夾頭局部座標，並加入移動後裝卸與位置回歸測試。
- 瀏覽器測試支援 `PLAYWRIGHT_PORT`，避免占用既有開發伺服器。
