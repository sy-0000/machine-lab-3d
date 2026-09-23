# Machine System v1.0 工具機合約規範 (MACHINE CONTRACT)

本文檔定義 **Machine System v1.0** 的工具機規範與程式介面合約。
上層系統（如 Level System、Machining System）必須嚴格依循此合約進行操作，嚴禁跨層直接操作底層 3D 模型節點。

---

## 一、核心架構原則 (Core Architectural Rules)

1. **三維模型只代表外觀與關節 (Body Only)**：
   GLB 模型內部階層只由 Machine Config 與 Machine Controller 負責解析與組裝。
2. **禁止直接穿透操作 (No Direct Object Manipulation)**：
   - ❌ **禁止**：`scene.getObjectByName("CrossSlide")`
   - ❌ **禁止**：`mesh.position.x += 0.01`
   - ❌ **禁止**：`toolPost.add(tool)`
   - ✅ **必須**：使用 `machine.moveX(0.01)`
   - ✅ **必須**：使用 `machine.mountTool(tool)`
   - ✅ **必須**：使用 `machine.mountWorkpiece(workpiece)`
3. **自然運動繼承 (Natural Hierarchy Inheritance)**：
   - 刀具掛載於 `ToolMount`，工件掛載於 `WorkpieceMount`。
   - 父節點轉動或位移時，掛載物件自動隨之運動，嚴禁每 frame 手動同步座標。

---

## 二、普通車床合約 (Lathe Contract: 16K20 Engine Lathe)

### 1. 機台基本規格
- **Machine ID**: `lathe`
- **Controller Class**: `LatheController` (`src/machines/lathe/LatheController.js`)
- **Config Path**: `src/machines/lathe/lathe.config.js` / `public/models/lathe_parts.json`
- **GLB Path**: `public/models/machines/lathe/lathe.glb`

### 2. 坐標系與軸向定義 (Coordinate System & Motion)
- **坐標系**: Three.js 右手坐標系（Y 向上，Z 向前/操作者，X 向右）。
- **主軸軸向 (Spindle)**: 繞 X 軸轉動（軸向量 `[1, 0, 0]`）。
- **縱向進給 (Carriage / X 軸)**: 沿車床導軌移動（Z 軸向量 `[0, 0, 1]`，範圍 `[-0.14, 0.14]` 米）。
- **橫向進給 (Cross Slide / Z 軸)**: 十字溜板進給（Y 軸向量 `[0, 1, 0]`，範圍 `[0, 0.05]` 米）。
- **尾座移動 (Tailstock)**: 沿導軌滑移（Z 軸向量 `[0, 0, 1]`，範圍 `[-0.278, 0]` 米）。
- **尾座心軸 (Tail Quill)**: 套筒伸出（Z 軸向量 `[0, 0, 1]`，範圍 `[-0.11, 0]` 米）。
- **四方刀架分度 (Tool Post Indexing)**: 繞 Y 軸旋轉，步進角度為 `10°`。

### 3. 掛載點定義 (Mount Points)
- **ToolMount**:
  - **Parent Node**: `ToolIndexPivot` (四方刀架旋轉中心)
  - **Position**: `[-0.010, 0.061, 0.0]` (安裝於四方刀架左側刀槽，水平向左朝向工件)
  - **Rotation**: `[0, 0, 0]`
  - **Scale**: `[1, 1, 1]`
  - **行為**: 隨四方刀架旋轉及十字溜板進給自動連動。
- **WorkpieceMount**:
  - **Parent Node**: `ChuckAssembly` (三爪自定心夾頭)
  - **Position**: `[-0.20274, 0.8525885, -0.0216612]`
  - **Rotation**: `[0, 0, 0]`
  - **Scale**: `[1, 1, 1]`
  - **行為**: 隨主軸及夾頭旋轉自然同軸轉動。

### 4. 重要節點對應 (Key Node Mapping)
- `SpindlePivot`: 主軸旋轉中心
- `ChuckAssembly`: 夾頭與卡爪組件（隸屬 `SpindlePivot`）
- `ToolIndexPivot`: 四方刀架分度旋轉核心
- `CrossSlideAssembly`: 十字溜板
- `CarriageAssembly`: 床鞍溜板總成
- `TailstockAssembly`: 尾座總成
- `TailQuill`: 尾座套筒
- `StartLeverPivot`: 正反轉啟動手柄
- `FootBrake`: 腳踏緊急煞車板

### 5. 主軸轉速與旋轉方向
- **轉速範圍 (RPM)**: 0 ~ 2000 RPM（預設 500 RPM）。
- **檔位選擇 (Gearbox Detents)**:
  - `gearSelector`: 4 檔位基數 `[12.5, 50, 200, 800]`
  - `speedMode`: 2 檔乘數 `[1, 2.5]`（LOW: 1x, HIGH: 2.5x），組合支援 8 種轉速。
- **旋轉方向**:
  - 正轉 (`direction = 1`): 工件朝操作者順時針車削。
  - 反轉 (`direction = -1`): 工件逆時針旋轉。

### 6. Controller 公開 API
```javascript
// 生命週期與基本操作
await machine.load();
machine.activate();
machine.reset();
machine.deactivate();
machine.dispose(); // 或 machine.unload()

// 刀具與工件掛載
await machine.mountTool(tool);
await machine.unmountTool();
await machine.mountWorkpiece(workpiece);
await machine.unmountWorkpiece();

// 主軸控制
machine.startSpindle(direction); // 1 = 正轉, -1 = 反轉
machine.stopSpindle();
machine.setSpindleRPM(rpm);
machine.setSpeedRange(rangeIndex);

// 進給運動
machine.moveX(delta);  // 縱向進給
machine.setX(value);
machine.zeroX();       // DRO 歸零
machine.moveZ(delta);  // 橫向進給
machine.setZ(value);
machine.zeroZ();

// 尾座與刀座
machine.moveTailstock(delta);
machine.feedTailQuill(delta);
machine.indexToolPost(direction); // 1 = +10°, -1 = -10°
machine.rotateToolPost(degrees);  // 旋轉至指定角度

// 安全防護與煞車
machine.emergencyBrake();
machine.releaseEmergencyBrake();

// 狀態讀取
const state = machine.getState();
```

---

## 三、立式銑床合約 (Milling Contract: Vertical Knee-Type Mill)

### 1. 機台基本規格
- **Machine ID**: `milling`
- **Controller Class**: `MillingController` (`src/machines/milling/MillingController.js`)
- **Config Path**: `src/machines/milling/milling.config.js` / `public/models/milling_split_controls.json`
- **GLB Path**: `public/models/machines/milling/milling.glb`

### 2. 坐標系與軸向定義 (Coordinate System & Motion)
- **坐標系**: Three.js 右手坐標系。
- **主軸軸向 (Spindle)**: 繞 Y 軸垂直高速旋轉（軸向量 `[0, 1, 0]`）。
- **工作臺橫向進給 (X 軸 / Table)**: 沿鞍座移動（範圍 `[-0.3, 0.3]` 米）。
- **鞍座縱向進給 (Y 軸 / Saddle)**: 前後移動（範圍 `[-0.15, 0.15]` 米）。
- **升降臺垂直進給 (Z 軸 / Knee)**: 上下垂直升降（範圍 `[-0.2, 0]` 米）。

### 3. 掛載點定義 (Mount Points)
- **ToolMount**:
  - **Parent Node**: `Spindle_Rotor_Group` (立銑頭主軸旋轉子)
  - **Position**: `[0.059423, 1.051, 0.008927]`
  - **Rotation**: `[0, 0, 0]`
  - **Scale**: `[1, 1, 1]`
  - **行為**: 隨銑削主軸高速旋轉自然連動。
- **WorkpieceMount**:
  - **Parent Node**: `X_Axis_Table` (工作臺總成)
  - **Position**: `[0.059423, 0.725, 0.008927]`
  - **Rotation**: `[0, 0, 0]`
  - **Scale**: `[1, 1, 1]`
  - **行為**: 隨 X 軸橫向、Y 軸前後、Z 軸垂直升降三軸自然位移。

### 4. 重要節點對應 (Key Node Mapping)
- `Spindle_Rotor_Group`: 銑削主軸轉子
- `Head_Assembly`: 立銑頭總成（主軸箱固定不旋轉外殼）
- `X_Axis_Table`: 工作臺滑座
- `Y_Axis_Saddle`: 鞍座滑座
- `Knee_Z_Slide`: 升降膝座
- `MillingRightLever`: 主軸離合啟動手柄
- `X_Handwheel_Left_Group` / `X_Handwheel_Right_Group`: X 軸左右手輪
- `Y_Handwheel_Group`: Y 軸手輪
- `ZLiftWheel`: Z 軸升降手輪

### 5. Controller 公開 API
```javascript
// 主軸控制
machine.startSpindle();
machine.stopSpindle();
machine.setSpindleRPM(rpm);

// 三軸進給
machine.moveX(delta); // 工作臺 X 進給
machine.setX(value);
machine.zeroX();

machine.moveY(delta); // 鞍座 Y 進給
machine.setY(value);
machine.zeroY();

machine.moveZ(delta); // 膝座 Z 升降
machine.setZ(value);
machine.zeroZ();

// 刀具與工件掛載
await machine.mountTool(tool);       // 掛載立銑刀或面銑刀
await machine.mountWorkpiece(workpiece); // 掛載方塊或圓柱工件
```

---

## 四、桌上鑽床合約 (Drill Contract: TB 145 Drill Press)

### 1. 機台基本規格
- **Machine ID**: `drill`
- **Controller Class**: `DrillController` (`src/machines/drill/DrillController.js`)
- **Config Path**: `src/machines/drill/drill.config.js` / `public/models/drill_press_parts.json`
- **GLB Path**: `public/models/machines/drill/drill.glb`

### 2. 坐標系與軸向定義 (Coordinate System & Motion)
- **主軸軸向 (Spindle)**: 繞 Y 軸垂直旋轉（軸向量 `[0, 1, 0]`）。
- **套筒進給 (Quill / 垂直進給)**: 沿 Y 軸垂直下壓（行程 `[-0.085, 0]` 米，負值向下切削）。
- **進給手柄 (FeedHandlePivot)**: 旋轉角範圍 `[-115°, 0°]`，具備彈簧回位 (Spring-Return)。
- **工作臺高度 (TableAssembly)**: 升降調節（行程 `[0, 0.25]` 米）。

### 3. 掛載點定義 (Mount Points)
- **ToolMount**:
  - **Parent Node**: `SpindleAssembly` (主軸總成)
  - **Position**: `[0, 0.503, 0.1422]`
  - **Rotation**: `[0, 0, 0]`
  - **Scale**: `[1, 1, 1]`
  - **行為**: 隨套筒垂直下降進給，同時隨主軸高速旋轉。
- **WorkpieceMount**:
  - **Parent Node**: `TableAssembly` (鑽床工作臺)
  - **Position**: `[0, 0.25, 0.1422]`
  - **Rotation**: `[0, 0, 0]`
  - **Scale**: `[1, 1, 1]`
  - **行為**: 隨工作臺高度升降調節自然連動。

### 4. Controller 公開 API
```javascript
// 主軸控制
machine.startSpindle();
machine.stopSpindle();

// 鑽孔垂直進給
machine.feedSpindle(delta); // 下壓進給 (負值向下)
machine.setQuill(value);
machine.zeroQuill();

// 工作臺高度調整
machine.moveTable(delta);
machine.setTable(value);

// 刀具與工件掛載
await machine.mountTool(drillBit);
await machine.mountWorkpiece(workpiece);
```

---

## 五、Level System 權限邊界規範 (Permission Boundary)

### 允許呼叫 (Whitelisted Public APIs):
1. `MachineRegistry.load(machineId)`
2. `MachineRegistry.unload()`
3. `ToolRegistry.load(toolId)`
4. `WorkpieceRegistry.load(workpieceSpec)`
5. `machine.mountTool(tool)`
6. `machine.unmountTool()`
7. `machine.mountWorkpiece(workpiece)`
8. `machine.unmountWorkpiece()`
9. `machine.reset()`
10. `machine.getState()`
11. 各 Controller 具體進給與主軸方法（如 `moveX`, `moveY`, `moveZ`, `feedSpindle`, `startSpindle`, `stopSpindle` 等）。

### 嚴格禁止操作 (Blacklisted Internal Direct Operations):
1. ❌ 禁止使用 `GLTFLoader` 直接載入機器 GLB。
2. ❌ 禁止透過 `scene.getObjectByName(...)` 取得零件並直接設定 `position` / `rotation` / `scale`。
3. ❌ 禁止手動將 Tool 或 Workpiece 加入至任何非 `ToolMount` / `WorkpieceMount` 的任意 Mesh。
4. ❌ 禁止繞過 Controller 直接設定主軸角度或導軌距離。
5. ❌ 禁止在 Level System 中寫死特定 GLB 模型內部路徑或硬編碼節點名稱。

## 相容層補充（以目前程式為準）

原文件部分車床軸向、行程與掛載數值已落後於現行 JSON。現行 runtime 為 `x` 縱向、`y` 橫向、`z` 高度；舊 Controller `moveX` 保留縱向，`moveZ` 保留高度，不能直接當作教學 X/Z。新增 Session 經 Adapter 將教學 X 映射到 runtime `y`、教學 Z 映射到 runtime `x`，詳見 [MachineSession 相容層](MACHINE_SESSION.md)。本次不改 GLB、不重新定義舊方法。

MachineBase 新增 `setAxisPosition`、手輪／檔位控制、active cutting tool 查詢及更新時鐘所有權。`step(dt)` 在未被 Session 接管時維持原用法；接管後只有 Session 的 clock owner 可更新。Level / Demo 必須呼叫 Session，不可直接操作 runtime 或 Three.js 節點。
