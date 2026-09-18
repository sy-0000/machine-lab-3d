import {writeFileSync}from 'node:fs';import {Vector3}from 'three';import {loadSource,readGLB}from './model-source.mjs';import {prepareModel,LATHE_PARTS,WHEELS,AXES,MODEL_NAME,disposeHighlights,disposeModel}from '../src/lathe.js';import {SPLITS}from '../src/latheParts.js';
const {scene}=await loadSource(),m=prepareModel(scene),{json}=readGLB();const triangleCounts={};for(const [name,mesh]of Object.entries(m.sources))if(mesh.isMesh)triangleCounts[name]=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
const data={model:MODEL_NAME,sourceNodes:json.nodes.length,sourceMeshes:json.meshes.length,reachableNodes:m.sourceInventory.length-1,reachableMeshes:m.sourceInventory.filter(n=>n.mesh).length,parts:LATHE_PARTS,limits:AXES,missing:m.missing,maximumAttachmentMatrixError:Math.max(...m.attachmentChecks.map(c=>c.error)),triangles:triangleCounts};writeFileSync(new URL('../reports/part-mapping.json',import.meta.url),JSON.stringify(data,null,2));
let text='# 16K20 真實模型零件對照與檢查紀錄\n\n';text+=`模型：${MODEL_NAME}。GLB 含 ${data.sourceNodes} 筆節點、${data.sourceMeshes} 筆網格；目前場景可達 ${data.reachableNodes} 個節點、${data.reachableMeshes} 個 Mesh。\n\n`;
text+='所有下列 Pivot 都是 **原始 GLB 世界座標**（X 沿床身、Y 向上、Z 朝前），建立群組後再將整台模型視覺置中。畫面檢查器顯示的是置中後的當前世界座標。軸符號是 Pivot 的局部軸，建立時與原模型世界軸對齊。\n\n';
text+='| 功能 | 輪身 GLB 來源 | 握把 GLB 來源 | 旋轉軸 | Pivot (X, Y, Z) | 速度 rad/s |\n|---|---|---|---|---|---|\n';
for(const [key,d]of Object.entries(WHEELS))text+=`| ${d.label} | ${d.wheelObjects.join('、')} | ${d.handleObjects.join('、')} | ${d.axis.toUpperCase()} | (${d.pivot.join(', ')}) | ${d.rotationSpeed} |\n`;
text+='\n`::` 後綴是從指定真實 Mesh 原始三角形建立的索引分區，不是 GLB 原生節點名稱，也不是新增的示意幾何。原始 Mesh 的每個三角形恰好分配一次，外觀與頂點不變。\n\n';
for(const [name,d]of Object.entries(SPLITS)){text+=`- ${name}：${d.description}。`;text+=d.parts.map(p=>`${p} ${triangleCounts[`${name}::${p}`]} 三角形`).join('；')+'。\n';}
text+='\n主軸與夾具：`Object_78::shaft` → `SpindlePivot`；`Object_78::chuckBody` 和 `Object_80`（三個夾爪）→ `ChuckAssembly` → `SpindlePivot`。`WorkpieceMount` 位於 (-0.20274, 0.8525885, -0.0216612)，是 ChuckAssembly 的子節點。若裝上示範工件，也只掛在此處。\n\n';
text+=`啟動拉桿：Object_12（桿）和 Object_38（球形握把），獨立 StartLeverPivot = (${LATHE_PARTS.startLever.pivot.join(', ')})，Z 軸，停止 0 rad、啟動 -0.65 rad。Object_10 固定支座不動。0.3 秒切換到 RUN 後才允許主軸加速，停止以 900 RPM/s 減速，保留夾頭停止角度。\n\n`;
text+='固定件包括 Object_22 主軸箱、Object_4 下方機箱、Object_14 床身、Object_193 夾頭防護罩、Object_10 拉桿支座、未列入對照表的機身、引擎與資訊板。不会以位置距離把鄰近機件加入旋轉群組。\n\n';
text+='| 控制 | 位移群組 | 實際位移軸 | 相對原點行程 |\n|---|---|---|---|\n';for(const [key,d]of Object.entries(AXES))text+=`| ${d.label} | ${d.name} | ${d.axis.toUpperCase()} | ${d.range.join(' ～ ')} |\n`;
text+='\n行程單位為模型單位，未經實機尺寸校準。UI 的 X/Y/Z 為教學進給標籤；橫向 Y 操作沿模型 Z，刀具高度 Z 操作沿模型 Y。尾座套筒 0 為載入時收回位置，負值向主軸伸出。\n\n';
text+=`重新掛接檢查：${m.attachmentChecks.length} 次 Group.attach，最大世界矩陣誤差 ${data.maximumAttachmentMatrixError}；缺少對照節點 ${m.missing.length}。\n\n`;
text+='## 外觀證據與仍需人工確認\n\n- [整體](full.png)、[縱向輪](carriage.png)、[橫向輪](cross.png)、[側向調節鈕](height.png)、[尾座輪](tail.png)、[主軸與夾爪](spindle.png)、[拉桿](lever.png) 為載入本次真實 GLB 後隔離部件截圖。\n';
for(const d of Object.values(LATHE_PARTS))if(d.note)text+=`- ${d.label}：${d.note}\n`;
text+='- 高度連動只升降 Object_149、Object_150、Object_152、Object_154、Object_156、Object_157 的刀座組合；不是宣稱原機械存在此升降傳動。原檔沒有明確的切削刃語意，因此安全距離採完整刀座組合的保守包圍盒。\n- 從原檔 geometry 可確認輪面、握把與支點，但實機功能、方向、行程、控制拉桿用途仍需教師核對。未改寫原始 GLB，未自動重新切割實體造型。\n- 新檔案未提供來源連結／授權，頁尾不沿用上一個 Oleg 模型的署名；授權資料需使用者補齊。\n';
writeFileSync(new URL('../reports/part-mapping.md',import.meta.url),text);disposeHighlights(m);disposeModel(m.scene);console.log(JSON.stringify({missing:data.missing,attachError:data.maximumAttachmentMatrixError,reachable:data.reachableNodes}));
