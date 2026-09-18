# 三機整合核對說明

本文件由既有專案與使用者提供的 JSON / GLB 生成，不是原模型製作者提供的使用說明。完整原始階層及逐項結果在 machine-audit.json。

## 車床

沿用 lathe_parts.json 的既有對照。SpindlePivot 包含 Object_78::shaft，ChuckAssembly 包含 Object_78::chuckBody、Object_80 與 WorkpieceMount。Object_22 等外殼不納入旋轉。Object_117、Object_145、Object_78 的分區沿用舊版真實三角形索引，不新增機械外形。

| 手輪 | 輪身／握把 | 世界 Pivot | 軸 | 移動與行程 |
| --- | --- | --- | --- | --- |
| 縱向 | Object_117::wheelBody / ::gripRim | (0.0791843, 0.4864774, 0.349) | Z | CarriageAssembly X，[-0.24, 0.38] |
| 橫向 | Object_107 / Object_109 | (0.0791951, 0.6833978, 0.397) | Z | CrossSlideAssembly Z，[-0.065, 0.065] |
| 高度 | Object_145::wheelBody / ::grip | (0.407, 0.7619079, 0.0566564) | X | ToolHeightAssembly Y，[-0.015, 0.035] |
| 尾座 | Object_68、70、72 / Object_189 | (1.038285, 0.8525885, -0.0216612) | X | TailstockQuill X，[-0.08, 0] |

TailstockAssembly 本體 X 行程 [-0.12, 0.04]。主軸 Pivot (-0.267, 0.8525885, -0.0216612)，X 軸。拉桿 Object_12 / Object_38，Pivot (-0.4023504, 0.3522738, 0.3674505)，Z 軸，0 → -0.65 rad，0.3 秒。

## 銑床

原 JSON 定義階層：Knee_Z_Slide → Y_Axis_Saddle → X_Axis_Table → Workholding。GLB 既有階層符合這些有效節點；Workholding 下 Vise_Missing → Workpiece_Missing 均為空節點。Spindle_Rotor_Group 下 Tool_Holder_Missing → Cutting_Tool_Missing 亦為空節點。

| 控制群組 | 實際所屬握把 | JSON 世界 Pivot | 軸 | 控制對象 |
| --- | --- | --- | --- | --- |
| X_Handwheel_Left_Group | X_Left_Handle_Mat34 | (-0.030288, 0.706218, -0.729364) | Z | X_Axis_Table |
| X_Handwheel_Right_Group | X_Right_Handle_Mat35 | (-0.060988, 0.710102, 0.692064) | Z | X_Axis_Table |
| Y_Handwheel_Group | Y_Handwheel_Handle_Mat11 | (0.393986, 0.554001, 0.006382) | X | Y_Axis_Saddle |
| Z_Handwheel_Group | Z_Handwheel_Handle_Mat20 | (-0.580015, 0.499931, 0.260787) | Z | Knee_Z_Slide |

工作臺 X 功能沿模型 Z，[-0.55, 0.55]；Y 功能沿模型 X，[-0.25, 0.25]；Z 功能沿模型 Y，[-0.35, 0.35]。輪身所有材質子網格仍留在 GLB 原群組，不用相近距離選取。

主軸 Spindle_Rotor_Group，X 軸，世界 Pivot (0.35703, 1.776645, 0)，RPM [0,2500]。只轉動它的後代；Head_Assembly 其餘外殼、工作臺與 Workholding 不旋轉。

**實際錯誤**：JSON children 中 Worktable_X_Slide 沒有同名節點。GLB 是 Worktable_X_Slide_Mat34、Mat35、Mat07、Mat36、Mat37 五個真實網格；本版列出錯誤，不自動把名稱替換成另一個物件。它們已經是 X_Axis_Table 的後代，故已驗證群組仍可操作。

**待確認**：Y/Z 手輪、主軸方向與 Pivot 中信心值、膝座鑄件固定、導程缺失、教學行程非實機規格。刀具、刀把、虎鉗、工件與啟動拉桿缺失，不能假稱可操作這些幾何。

## 鑽床

Quill → SpindleAssembly → Spindle / Chuck / DrillBit。主軸 Y 軸，世界 Pivot (0, 0.5608, 0.1422)。HeadHousing 是外殼父群組，永不作為旋轉目標。Quill 沿 Y，行程 [-0.085, 0]，帶動旋轉總成垂直進給。

FeedHandlePivot 世界 Pivot (0.0949, 0.5928, 0.1182)，X 軸，[-115°,35°]。原群組包含 FeedHandle01、02、03；各自 Grip、EndCap、Collar、Rod 仍留在原階層，均繼承同一進給手柄 Pivot。

TableAssembly → TableBracket → WorkTable → Vise_MOUNT → Workpiece_MOUNT。工件掛點不屬於 SpindleAssembly。TableAssembly Y 行程 [-0.32,0.18] 及 TableRotationPivot 均在來源標為待確認，所以停用。TableLiftHandwheel_MOUNT、Vise_MOUNT、Workpiece_MOUNT 是空掛點；沒有建立假的手輪／夾具幾何。

SwitchLever 依 JSON 作點擊啟停，沒有為它編造旋轉軸。HeadSideRod 與 SurfaceDetailsAndLabels 保持原模型靜止狀態。

## 共同限制

銑床／鑽床的作者 .md 尚未在允許資料夾中找到。教學比例需要使用者在介面勾選，詳見 README。接近警告只能在刀具、工件／夾具及閾值都已定義後啟用；目前僅車床具備此設定。原始 JSON 軸向及 Pivot 未依視覺擅自修正。
