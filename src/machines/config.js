// Schema adapters translate supplied metadata; no geometry proximity or guessed node membership.
import lesson from './lessonDefaults.json' with {type:'json'};
const vector = axis => typeof axis==='string' ? ['x','y','z'].map(a=>a===axis?1:0) : axis;
export function normalizeConfig(id, raw) {
 const common={id,raw,lesson,nodeOffsets:raw.nodeOffsets||[],removeNodes:raw.removeNodes||[],hideNodes:raw.hideNodes||[],speedSelectors:raw.speedSelectors,geometrySplits:raw.geometrySplits||[],reparents:raw.reparents||[],axes:[],wheels:[],references:[],notes:[],safety:null,actions:raw.actions||[],extraGroups:raw.extraGroups||[],additions:raw.additions||[],defaultRpm:lesson.defaultRpm,maxRpm:lesson.defaultMaxRpm};
 if(raw.schemaVersion===2)return {...common,...raw,id,raw,lesson,references:raw.groups.flatMap(g=>g.objects),relationships:[],defaultRpm:lesson.defaultRpm};
 if(id==='lathe') {
  const p=raw.parts;
  return {...common,notes:raw.manualReview||[],references:[...Object.values(raw.mechanisms).flatMap(a=>a.objects),...Object.values(p).flatMap(a=>[...(a.objectNames||[]),...(a.wheelObjects||[]),...(a.handleObjects||[])])],
   axes:Object.entries(raw.axes).map(([key,a])=>({id:key,node:a.name,axis:vector(a.axis),range:a.range,label:a.label,enabled:true})),
   wheels:Object.entries(p).filter(([,a])=>a.wheelObjects).map(([key,a])=>({id:key,node:a.pivotName,pivot:a.pivot,axis:vector(a.axis),label:a.label,drives:a.key,ratio:a.ratio,speed:a.rotationSpeed})).concat(raw.extraWheels||[]),
   spindle:{node:'SpindlePivot',axis:vector(p.spindle.axis),pivot:p.spindle.pivot},
   lever:{node:p.startLever.pivotName,axis:vector(p.startLever.axis),pivot:p.startLever.pivot,runAngle:p.startLever.runAngle,duration:p.startLever.duration,label:p.startLever.label,bidirectional:p.startLever.bidirectional},
   safety:raw.safety,demoWorkpiece:raw.demoWorkpiece,
  };
 }
 if(id==='milling') {
  const labels={Knee_Z_Slide:'Z 軸／工作臺升降',Y_Axis_Saddle:'Y 軸／鞍座進給',X_Axis_Table:'X 軸／工作臺進給'};
  const names={X_Handwheel_Left_Group:'X 軸左手輪',X_Handwheel_Right_Group:'X 軸右手輪',Y_Handwheel_Group:'Y 軸手輪',Z_Handwheel_Group:'Z 軸手輪'};
  const axes=Object.entries(raw.motionHierarchy).map(([node,a])=>({id:node,node,axis:a.axis,range:a.travel,label:labels[node]||node,enabled:true}));
  const spindleEntry=Object.entries(raw.interactiveParts).find(([,p])=>p.type==='continuousRotate');
  return {...common,axes,maxRpm:spindleEntry[1].rpm[1],
   references:[...Object.keys(raw.interactiveParts),...Object.keys(raw.motionHierarchy),...Object.values(raw.motionHierarchy).flatMap(p=>p.children)],
   relationships:Object.entries(raw.motionHierarchy).flatMap(([parent,a])=>a.children.map(child=>({parent,child}))),
   wheels:Object.entries(raw.interactiveParts).filter(([,p])=>p.type==='rotate').map(([node,p])=>({id:node,node,pivot:p.pivot,axis:p.axis,label:names[node]||node,drives:p.controls,ratio:p.feedPerRadian??null,speed:lesson.wheelSpeedRadiansPerSecond,needsCalibration:p.feedPerRadian===undefined})),
   spindle:{node:spindleEntry[0],axis:spindleEntry[1].axis,pivot:spindleEntry[1].pivot},
   notes:['未提供銑床模型使用說明 .md。','缺少可辨識的刀具、刀把、虎鉗及工件；空掛點不代表已有實體零件。','膝座鑄件仍固定；Z 軸只帶動 JSON 已定義的滑座階層。','Y／Z 手輪用途及主軸 X 軸為原 JSON 的中信心設定，需人工校正。','行程為原 JSON 的教學預設，非實機規格。','JSON 未指定每圈進給量；手輪進給需先選擇教學比例。'],
  };
 }
 const i=raw.interactions, f=i.FeedHandlePivot;
 if(f.drives!=='Quill.position.y'||i.Quill.axis.some((value,index)=>value!==[0,1,0][index]))throw Error('鑽床 drives 與套筒 Y 軸設定不一致，請確認 JSON 後更新轉接 schema。');
 return {...common,
  references:[...Object.keys(i),...i.SpindleAssembly.includes,...i.SpindleAssembly.exclude,...Object.keys(raw.mounts)],
  relationships:[...i.SpindleAssembly.includes.map(child=>({parent:'SpindleAssembly',child})),{parent:'Quill',child:'SpindleAssembly'}],
  axes:[{id:'quill',node:'Quill',axis:i.Quill.axis,range:i.Quill.travelMeters,label:'套筒／垂直進給',enabled:true},{id:'table',node:'TableAssembly',axis:i.TableAssembly.axis,range:i.TableAssembly.travelMeters,label:'工作臺高度',enabled:i.TableAssembly.type==='linearTranslation'}],
  wheels:[{id:'feed',node:'FeedHandlePivot',pivot:f.pivotWorld,axis:f.axis,label:'套筒進給手柄',drives:'quill',angleRange:f.rotationLimitDegrees.map(v=>v*Math.PI/180),ratio:f.feedPerRadian??null,springReturn:f.springReturn,speed:lesson.feedHandleSpeedRadiansPerSecond,needsCalibration:f.feedPerRadian===undefined}],
  spindle:{node:'SpindleAssembly',axis:i.SpindleAssembly.axis,pivot:i.SpindleAssembly.pivotWorld,required:i.SpindleAssembly.includes,exclude:i.SpindleAssembly.exclude},
  toggle:{node:raw.switchNode||'SwitchLever',label:'主軸啟停開關'},
  notes:raw.manualReview,
 };
}
