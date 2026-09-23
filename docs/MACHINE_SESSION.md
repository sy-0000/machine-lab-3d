# MachineSession：Machine System v1.0 相容層

本階段提供共用命令、座標與單位轉接、輸入所有權、掛載管理及單一機械更新入口。沒有實作正式關卡、DemoSequence、評分、完整切削或存檔系統，也沒有修改 GLB。

## 邊界與生命週期

```text
玩家面板／場景操作／開發面板／未來 Demo
  → MachineSession.command()
  → MachineV1Adapter
  → MachineBase 相容擴充／原 Controller
  → 原 runtime 與原 GLB
```

GameWorkspace 載入 Controller 後建立 Session；換機台或離開時先 dispose Session，再由 MachineRegistry 釋放機台。Registry 使用載入序號及 AbortSignal 排除過期載入。

Session 不將 runtime、Object3D 或 Controller 暴露給 Level / Demo。getState() 回傳資料快照。場景仍可讀模型作顯示、拾取與高亮，但不能直接執行機械運動。

## 命令 API

```js
const session = new MachineSession(machine);
const result = session.command({ type: 'spindle.start', direction: 1 });
// 同步命令回傳 {ok:true} 或 {ok:false,reason}。
// 資產命令回傳 Promise，必須 await 並檢查結果。
```

| type | 參數 | 說明 |
| --- | --- | --- |
| spindle.start / stop | direction: 1 或 -1／無 | 啟動或依既有機械模型減速 |
| spindle.speed | rpm | 車床須為可用檔位轉速，其餘檢查範圍 |
| spindle.toggle | direction | 保留拉桿啟停語意 |
| spindle.brake / releaseBrake | 無 | 保留非鎖定式煞車 |
| axis.move | axis, valueMm, mode, representation | 教學軸；mode 為 absolute（預設）或 relative |
| workOffset.set | axis, valueMm, representation | 將目前讀值設定為指定值，不移動機器 |
| workOffset.zero | axis, representation | 只歸零讀值 |
| tool.select | toolId 或 null | null 卸下模組刀具並恢復預設教學刀具 |
| workpiece.mount | spec：預設 ID 或 mm 規格 | 載入並掛載 |
| workpiece.unmount | 無 | 卸下並釋放 Session 掛載實體 |
| wheel.hold / release | key,direction／無 | 持續時間由更新時鐘計算 |
| teaching.set | enabled | 原教學比例開關 |
| detent.set / step | key,index／key,direction | 原檔位選擇 |
| tool.index | direction | 原刀架分度 |
| machine.reset | 無 | 重設機械與 Session 偏移，保留模組工件及刀具 |
| workpiece.toggleDemo | 無 | 舊示範毛胚，模組工件存在時拒絕 |
| machineAxis.set / jog | axisId,valueMm／axisId,deltaMm | 僅供舊教室相容，使用原機械 ID |

Level / Demo 使用 axis.move，不依賴 machineAxis.*。資產切換要求主軸命令停止、實際 RPM 為零、拉桿回位。量具不當作切削刀具掛載，刀具相容性由目錄驗證。

## 車床座標

| 教學欄位 | 單位／語意 | runtime ID | 模型方向 |
| --- | --- | --- | --- |
| X，diameter | mm，直徑讀值或直徑增量 | y | 模型 Z |
| X，radial | mm，半徑讀值或單側徑向增量 | y | 模型 Z |
| Z | mm，沿主軸／長度 | x | 模型 X |
| height | mm，刀具高度 | z | 模型 Y |
| tailstock | mm，尾座 | tail | 模型 X |
| tailQuill | mm，尾座套筒 | quill | 模型 X |

X 命令必須指定 representation。舊 Controller.moveX()/setX() 仍為縱向；moveZ()/setZ() 仍為高度，單位仍為公尺。

```js
// 此位置對應 Ø20 需教師／後續校準確認；不是自動量測。
session.command({type:'workOffset.set',axis:'X',representation:'diameter',valueMm:20});
session.command({type:'axis.move',axis:'X',representation:'diameter',valueMm:16.3});
// Δ直徑=-3.7 mm，Δ徑向=-1.85 mm；預設符號下 runtime.y 改變 -0.00185。
session.command({type:'axis.move',axis:'X',representation:'radial',mode:'relative',valueMm:-1.85});
session.command({type:'axis.move',axis:'Z',mode:'relative',valueMm:10});
```

latheCoordinates.js 只做 mm 數學。radialSign / longitudinalSign 可配置 ±1，預設沿原機械正方向，不是實機校準。真正刀尖、裝夾基準、刀架角度與工件中心線仍待下一階段確認，不能把相對讀值當作實際工件尺寸。

workOffsetsMm.X 保存徑向偏移；lathe.xDiameterMm 是兩倍徑向讀值，lathe.xRadialMm 保持半徑語意。Z 偏移以長度 mm 儲存。zero 不移動刀具，reset 清除 Session 偏移。

銑床 X/Y/Z 保留機械軸語意；鑽床提供 quill/table。尚未把工作臺方向轉成相對刀具的切削路徑。

## 單位

加工命令與狀態距離統一 mm。Adapter 固定 mmToWorld(mm)=mm/1000，worldToMm(world)=world*1000，拒絕 NaN / Infinity。查詢提供 machineAxesMm、axesMm、lathe、工件 dimensionsMm；安全距離為 gapMm。

舊 HTML 軸滑桿保留原公尺 DOM 值，由 Adapter 的 legacySliderCommand 轉成 mm 命令；微調直接提交 deltaMm。舊機械控制不冒充正式加工座標。

WorkpieceLoader 明確支援 units:'mm' 與 units:'m'。內建 preset 已標示 mm，Session 新工件規格固定 mm。只有未填 units 的舊 Loader 呼叫保留原推斷，隔離在 legacyWorkpieceUnits.js，禁止新加工層使用。舊 dimensions 欄位保留供相容，Session 只輸出明確 mm 欄位。

## 工件與刀具

- runtime.workpieceOwner='module' 由 MachineBase 管理，可以是 Group。runtime.reset 不釋放；MachineBase.reset 只還原局部變換。
- 舊示範工件由 runtime 管理，以物件樹清理，不假定頂層有 geometry/material。reset 仍移除它。
- 掛載模組工件會清理舊示範毛胚；模組工件存在時拒絕示範切換。
- mountTool 隱藏預設刀具，unmountTool 恢復載入時可見狀態。getActiveCuttingTool() 回傳一把刀或 null。
- 舊 MachineBase.unmountTool()/unmountWorkpiece() 仍交回實體，不自動 dispose；Session 擁有自己載入的實體，替換與卸下時釋放。
- 輸入交接或 Session dispose 會使未完成資產載入失效；遲到資產釋放，不得掛載。

## 輸入鎖

```js
const demoInput = session.createInput('demo');
const lease = session.lockInput(demoInput);
session.command({type:'spindle.start'}, demoInput); // 允許
session.command({type:'spindle.start'});            // player 被拒絕
session.unlockInput(lease);
```

以 input handle 識別所有權，不靠來源字串。只有持有 lease 才能解鎖；lockInput() 不給 owner 時阻止所有命令。交接會清掉持續手輪並停止主軸命令，實際減速仍需更新。讀取狀態不受鎖影響。這是應用內協調，不是安全隔離；外部舊 Controller 呼叫仍須遵守 Session 邊界。

## 更新時鐘

```js
const clock = session.claimClock();
session.update(deltaSeconds, {clock,frameId:0});
session.update(deltaSeconds, {clock,frameId:1});
session.releaseClock(clock);
```

Session 不啟動 requestAnimationFrame。MachineModel 的 R3F useFrame 只提供時間與 frameId，不再呼叫 stepMachine / turnControl / stepReturn。Session 經 Adapter 呼叫一次 MachineBase.step，內部依序處理手輪、彈簧回位及主軸。

Session 只能有一個 clock lease；重複或過期 frameId 不更新。同一台機器只能由一個 Session 接管；接管期間直接 machine.step(dt) 拒絕，避免雙倍計時。沒有 Session 的舊呼叫仍可照常 machine.step(dt)。

鑽床 heldControl 抑制該手柄回位，放開後由相同更新步驟回位。demand Canvas 活動時繼續 invalidate，閒置後第一幀不累積長時間空白間隔。

## 下一階段與驗證

仍使用既有可變 dt 機械更新。固定步長切削、重播快照、DemoSequence、工件持久化、實際刀尖校準、評分與正式關卡未實作。原槌柄局部原型保持獨立。

執行 npm test、npm run audit:models、npm run build、npm run test:browser。新增 src/machining/MachineSession.test.js 與 tests/machine-session.spec.js 覆蓋座標、單位、Group、刀具、輸入鎖、更新時鐘及玩家 UI 整合。
