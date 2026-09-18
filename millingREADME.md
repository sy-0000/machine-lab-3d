# Milling Machine Interactive Model

## 交付檔案

- `milling_machine_interactive.glb`：Three.js 用互動銑床模型。
- `parts-map.json`：功能節點、軸向、軸心、行程與拆件稽核資料。
- `README.md`：模型結構、操作方式與人工確認事項。

## 模型檢查結果

- 原始格式：FBX 7700（二進位）。
- 原始場景：87 個網格、46 個材質、無動畫。
- 銑床本體原始面數：1,445,524 個三角面。
- GLB 輸出面數：1,445,428 個三角面。
- 差異：只移除 `pDisc1` 地板圓盤的 96 面；凳子與風扇屬於獨立場景物件，未納入銑床面數，也未輸出。
- GLB 回讀驗證：60 個網格、43 個材質；必要功能節點均存在，幾何面數與輸出紀錄一致。
- 單位：公尺；原始座標以 `0.01` 比例轉換。
- 座標：X＝前後、Y＝垂直、Z＝工作臺左右。

## 主要節點階層

```text
MillingMachine
├─ Frame_Static
│  ├─ Machine_Base_Knee_Static
│  └─ Column_Ram_Static
├─ Head_Assembly
│  ├─ Headstock_Static
│  └─ Spindle_Rotor_Group
│     ├─ Spindle_Rotor_*
│     └─ Tool_Holder_Missing
│        └─ Cutting_Tool_Missing
├─ Knee_Z_Slide
│  └─ Y_Axis_Saddle
│     ├─ Y_Handwheel_Group
│     └─ X_Axis_Table
│        ├─ Worktable_X_Slide_*
│        ├─ X_Handwheel_Left_Group
│        ├─ X_Handwheel_Right_Group
│        └─ Workholding
├─ Z_Handwheel_Group
├─ Controls
│  └─ Start_Lever_Missing
└─ Accessories
   └─ Work_Light_Static
```

帶有 `_Missing` 的節點是預留的功能掛載點，不含可辨識的原始幾何。

## 互動節點

| 節點 | 操作 | 旋轉／移動軸 | 對應運動 |
|---|---|---|---|
| `X_Handwheel_Left_Group` | 旋轉 | Z | `X_Axis_Table` 沿 Z 平移 |
| `X_Handwheel_Right_Group` | 旋轉 | Z | `X_Axis_Table` 沿 Z 平移 |
| `Y_Handwheel_Group` | 旋轉 | X | `Y_Axis_Saddle` 沿 X 平移 |
| `Z_Handwheel_Group` | 旋轉 | Z | `Knee_Z_Slide` 沿 Y 平移 |
| `Spindle_Rotor_Group` | 連續旋轉 | X | 主軸旋轉；`Headstock_Static` 保持固定 |

每個手輪的輪體與握把均為同一父群組下的獨立子網格。操作父群組即可一起旋轉，不會帶動其他手輪。

## Three.js 載入範例

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('/models/milling_machine_interactive.glb', (gltf) => {
  scene.add(gltf.scene);

  const xLeft = gltf.scene.getObjectByName('X_Handwheel_Left_Group');
  const table = gltf.scene.getObjectByName('X_Axis_Table');
  const spindle = gltf.scene.getObjectByName('Spindle_Rotor_Group');

  xLeft.rotation.z += 0.1;
  table.position.z = THREE.MathUtils.clamp(table.position.z + 0.002, -0.55, 0.55);
  spindle.rotation.x += 0.1;
});
```

實作滑鼠左右鍵時，建議只修改選取手輪父群組的旋轉值，再依旋轉增量換算滑座位移。完整軸心與示範行程請讀取 `parts-map.json`。

## 仍需人工確認

- 原 FBX 依材質把銑床合併成 `Back／Bottom／Head／Table／Signs` 大網格，沒有原始機械零件名稱；本次使用幾何連通、形狀、位置與機械關係重新拆分。
- X 軸左右手輪辨識信心高；Y、Z 手輪的機械身分為中等信心，應對照實機或原模型預覽確認。
- 底座與膝座鑄件仍共用合併網格；`Knee_Z_Slide` 已建立正確的功能父階層，但可見膝座鑄件尚未隨 Z 軸移動，需在 Blender 中人工圈選鑄件後移入該節點。
- 模型中沒有足夠明確、可獨立辨識的虎鉗、工件、刀柄、刀具與啟動拉桿，因此保留 `_Missing` 掛載節點，未用其他幾何冒充。
- `parts-map.json` 的行程是網頁示範用安全值，不是製造商規格。
- 原壓縮檔的部分貼圖檔名重複或缺少對應圖；GLB 已嵌入能可靠匹配的材質貼圖，其餘材質使用 PBR 係數作為後備。

## 建議人工修整順序

1. 在 Blender 中確認 Y、Z 手輪的實際功能。
2. 將可見膝座鑄件移入 `Knee_Z_Slide`。
3. 若原模型另有虎鉗、工件或刀具檔案，放入預留節點並修正軸心。
4. 依實機規格更新 `parts-map.json` 的行程與主軸轉速。
5. 若網頁載入速度重要，製作一份減面與壓縮貼圖版本；目前版本優先保留幾何完整度。
