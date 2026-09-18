import fs from 'node:fs';
const dir='public/models/',read=name=>JSON.parse(fs.readFileSync(dir+name)),write=(name,data)=>fs.writeFileSync(dir+name,JSON.stringify(data,null,2)+'\n');
const lathe=read('lathe_parts.json');
lathe.mechanisms.CrossSlideAssembly.objects=lathe.mechanisms.CrossSlideAssembly.objects.filter(n=>n!=='Object_103');
lathe.mechanisms.ToolHeightAssembly.objects.unshift('Object_103');
const leverParts=['Object_129','Object_131','Object_133','Object_135'];
lathe.mechanisms.CarriageAssembly.objects=lathe.mechanisms.CarriageAssembly.objects.filter(n=>!leverParts.includes(n));
lathe.parts.startLever={...lathe.parts.startLever,objectNames:leverParts,rodObjects:leverParts.filter(n=>n!=='Object_135'),handleObjects:['Object_135'],axis:'x',pivot:[.31396687,.526,.274422],parent:'CarriageAssembly',runAngle:-.6,note:'依使用者指定改用縱向手輪右側長桿；Object_127／137 短桿保持固定。'};
lathe.axes.tail.range=[-.55,.04];lathe.axes.z.range=[0,.06];
lathe.extraGroups=[{name:'ToolIndexPivot',parent:'ToolHeightAssembly',pivot:[.0803634,.7797539,.0566564],objects:[...lathe.mechanisms.ToolHeightAssembly.objects]}];
lathe.actions=[{id:'toolIndex',node:'ToolIndexPivot',type:'index',axis:[0,1,0],step:-Math.PI/4,label:'刀座右轉 45°'},{id:'footBrake',node:'FootBrake',type:'emergency',label:'腳踏緊急煞車'}];
lathe.additions=[{name:'FootBrake',kind:'pedal',position:[.15,.16,.43],length:1.25,radius:.018,color:'#df654a'}];
lathe.manualReview=['刀座本體 Object_103 與上方壓板／螺絲整組升降；Object_101／147 留在底座。','刀座每次點擊沿模型 Y 軸順時針 45°，累計八次一圈。','尾座負行程擴至 -0.55 模型單位，需注意與刀座接近。','右側長桿改作主軸啟停；腳踏煞車為依使用者要求新增的教學幾何，急停後需解除。'];write('lathe_parts.json',lathe);
const drill=read('drill_press_parts.json');drill.interactions.FeedHandlePivot.feedPerRadian=.085/(115*Math.PI/180);drill.interactions.FeedHandlePivot.rotationLimitDegrees=[-115,0];drill.interactions.FeedHandlePivot.springReturn={speed:2.5,holdDirection:-1};drill.interactions.TableAssembly.type='linearTranslation';drill.interactions.TableAssembly.note='依使用者要求啟用原 JSON 升降行程，作教學操作。';
drill.additions=[{name:'QuillExtension',kind:'sleeve',top:[0,.592,.1421577],bottomY:.550,radius:.021,drives:'quill',color:'#aeb9bd'}];
drill.manualReview=['已閱讀 drillingREADME.md；握柄按住向下進給，放開彈簧回位。','SwitchLever 作主軸啟停開關；工作臺使用原 JSON 的垂直行程。','QuillExtension 為新增的可伸縮教學套筒，補足下降後露出的連接段。','原檔沒有工作臺升降手輪、虎鉗與工件；本版使用工作臺本體的面板升降控制。'];write('drill_press_parts.json',drill);
const manifest=read('deliver_milling_machine_split/milling_machine_split_manifest.json');
const names=(prefix,ids)=>ids.map(i=>`${prefix}_Part_${String(i).padStart(3,'0')}`);
const left=names('Table',[1,3,6,8,11,12,14,48,58,59,64,67,68]);
const right=names('Table',[0,2,5,7,9,10,13,47,56,57,63,65,66]);
const y=names('Bottom',[2,3,4,7,11,12,13,92,105,106,125,126,127]);
const saddle=names('Bottom',[6,77,84,94,101,118,119,120,121,122,123,124]);
const groups=[{name:'Head_Assembly',objects:manifest.parts.filter(p=>p.name.startsWith('Head_')).map(p=>p.name)},
 {name:'Knee_Z_Slide',objects:[]},{name:'Y_Axis_Saddle',parent:'Knee_Z_Slide',objects:saddle},
 {name:'X_Axis_Table',parent:'Y_Axis_Saddle',objects:manifest.parts.filter(p=>p.name.startsWith('Table_')&&!left.includes(p.name)&&!right.includes(p.name)).map(p=>p.name)},
 {name:'X_Handwheel_Left_Group',parent:'X_Axis_Table',objects:left},{name:'X_Handwheel_Right_Group',parent:'X_Axis_Table',objects:right},
 {name:'Y_Handwheel_Group',parent:'Y_Axis_Saddle',objects:y},
 {name:'Spindle_Rotor_Group',parent:'Head_Assembly',objects:['Head_Part_020']},
 {name:'MillingSwitch',parent:'Head_Assembly',objects:['Head_Part_071']}];
const axis=(id,node,vector,range,label)=>({id,node,axis:vector,range,label,enabled:true});
const wheel=(id,pivot,vector,drives,label,ratio)=>({id,node:id,pivot,axis:vector,drives,label,ratio,speed:2.4});
write('milling_split_controls.json',{schemaVersion:2,model:'deliver_milling_machine_split/milling_machine_split.glb',groups,
 axes:[axis('X_Axis_Table','X_Axis_Table',[0,0,1],[-.4,.4],'X 軸／工作臺進給'),axis('Y_Axis_Saddle','Y_Axis_Saddle',[1,0,0],[-.15,.15],'Y 軸／鞍座進給'),axis('Knee_Z_Slide','Knee_Z_Slide',[0,1,0],[-.15,.18],'Z 軸／工作臺升降')],
 wheels:[wheel('X_Handwheel_Left_Group',[-.030288,.706218,-.729364],[0,0,1],'X_Axis_Table','X 軸左手輪',.018),wheel('X_Handwheel_Right_Group',[-.060988,.710102,.692064],[0,0,1],'X_Axis_Table','X 軸右手輪',.018),wheel('Y_Handwheel_Group',[.393986,.554001,.006382],[1,0,0],'Y_Axis_Saddle','Y 軸手輪',.0075)],
 spindle:{node:'Spindle_Rotor_Group',axis:[0,1,0],pivot:manifest.parts.find(p=>p.name==='Head_Part_020').pivot_m,required:['Head_Part_020'],exclude:['Head_Part_001','Head_Part_034']},
 toggle:{node:'MillingSwitch',label:'銑床主軸電源開關'},maxRpm:2500,neutralMaterials:true,
 notes:['使用新拆件模型：422 個獨立零件，無內嵌材質／UV；本版配置中性工業材質與法線。','逐件畫面與幾何對照確認 X／Y 手輪；修正舊 X 左輪會帶動齒輪箱外殼的問題。','下端主軸改為 Head_Part_020 沿 Y 旋轉；舊版上方刻度面板保持固定。','開關使用上方電氣盒突出的 Head_Part_071，作教學啟停控制。','舊 Z 手輪對照實際為床身標牌，已移除錯誤互動；Z 升降使用滑桿。','導程與縮限後行程為教學值，非製造商校正資料；未建立不存在的刀具或虎鉗。'],
 provenance:{manifest:'deliver_milling_machine_split/milling_machine_split_manifest.json',readmes:['millingREADME.md','deliver_milling_machine_split/README.txt'],evidence:'reports/v2-*.png and split-correspondence.json; explicit reviewed membership, not proximity grouping'}});
