import {Box3,Vector3,MathUtils} from 'three';

// Classroom camera presets. Poses are computed from the loaded model's own nodes,
// so they follow the table / carriage wherever it has been moved.
export const CAMERA_VIEWS=[
  {id:'overview',label:'全景',key:'1'},
  {id:'work',label:'工作區',key:'2'},
  {id:'wheels',label:'手輪',key:'3'},
  {id:'tool',label:'刀具',key:'4'},
];
// Operator-side viewing directions per machine (same as the original default pose).
const FRONT={drill:[1,.6,2.4],milling:[2.4,.8,1.5],lathe:[.6,.55,2.4]};
const LIFT={overview:0,work:.45,wheels:.15,tool:.35};
/** Yaw (radians about +Y) of the operator side, i.e. where the overview camera stands. */
export const frontYaw=id=>{const [x,,z]=FRONT[id]||[1,.6,2];return Math.atan2(x,z);};

const nodeOf=(model,name)=>model.lookup[name]||model.pivots?.[name]||null;
function meshBox(objects){
  const box=new Box3();
  for(const object of objects){
    if(!object)continue;object.updateWorldMatrix(true,true);
    object.traverse(o=>{if(o.isMesh&&o.visible&&o.name!=='ContactMarker')box.expandByObject(o);});
  }
  return box;
}
function toolObjects(model){
  const names=(model.config.additions||[]).filter(a=>a.kind==='cuttingTool').map(a=>a.name);
  return [nodeOf(model,'ToolMount'),...names.map(n=>nodeOf(model,n))].filter(o=>o&&(o.name==='ToolMount'?o.children.length:true));
}
function focusBox(model,view){
  if(view==='wheels')return meshBox((model.config.wheels||[]).map(w=>nodeOf(model,w.node)));
  if(view==='tool')return meshBox(toolObjects(model));
  // work: stock + fixture + cutting tool; fall back to the tool region when nothing is mounted.
  const stock=meshBox([nodeOf(model,'WorkpieceMount')]),tool=meshBox(toolObjects(model));
  return stock.isEmpty()?tool:stock.union(tool);
}

/** Target and camera position for a preset, in scene (render) coordinates. */
export function cameraPose(model,view,camera,aspect){
  const half=MathUtils.degToRad(camera.fov/2),angle=Math.min(half,Math.atan(Math.tan(half)*aspect));
  const direction=new Vector3(...(FRONT[model.config.id]||[1,.6,2])).normalize();
  if(view==='overview'||!CAMERA_VIEWS.some(v=>v.id===view)){
    return {target:new Vector3(),position:direction.multiplyScalar(model.radius/Math.sin(angle)*1.08)};
  }
  const box=focusBox(model,view);
  if(box.isEmpty())return cameraPose(model,'overview',camera,aspect);
  const target=box.getCenter(new Vector3()),radius=Math.max(box.getSize(new Vector3()).length()/2,model.radius*.05);
  direction.y+=LIFT[view];direction.normalize();
  return {target,position:target.clone().addScaledVector(direction,radius/Math.sin(angle)*1.55)};
}
