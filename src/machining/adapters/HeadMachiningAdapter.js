import {Vector3,Matrix3} from 'three';
import {PrismaticWorkpiece} from './PrismaticWorkpiece.js';
import {cutHead} from '../HeadCuttingSimulation.js';
import {headBounds} from '../HeadWorkpieceState.js';

/** Additive v1 boundary. Tool tip is transformed into the actual moving stock frame. */
export class HeadMachiningAdapter{
  constructor(machine,mmToWorld,worldToMm){this.machine=machine;this.mmToWorld=mmToWorld;this.worldToMm=worldToMm;}
  get workpiece(){const w=this.machine.currentWorkpiece;return w instanceof PrismaticWorkpiece?w:null;}
  calibrateTool(){
    const m=this.machine,tool=m.currentTool,edge=tool?.object3D.userData.axialCuttingEdge;
    if(!tool?.id.startsWith('head_')||!edge)return;
    // v1 mount positions are legacy values. Place this new procedural tool on the
    // actual spindle pivot axis, rather than accepting an orbiting off-axis tip.
    const pivot=m.runtime.pivots[m.config.spindle.node],root=tool.object3D;
    if(!pivot)throw new Error('Spindle pivot unavailable');m.rootScene.updateWorldMatrix(true,true);
    const tip=root.localToWorld(new Vector3(...edge.tip)),p=pivot.worldToLocal(tip.clone()),axis=new Vector3(...m.config.spindle.axis).normalize();
    const aligned=pivot.localToWorld(axis.multiplyScalar(p.dot(axis)));
    const delta=root.parent.worldToLocal(aligned).sub(root.parent.worldToLocal(tip));root.position.add(delta);m.rootScene.updateWorldMatrix(true,true);
  }
  sample(){
    const m=this.machine,w=this.workpiece,tool=m.currentTool,edge=tool?.object3D.userData.axialCuttingEdge;
    if(!w||!edge||edge.units!=='world'||!tool.object3D.visible)return null;
    m.rootScene.updateWorldMatrix(true,true);
    const p=w.object3D.worldToLocal(tool.object3D.localToWorld(new Vector3(...edge.tip)));
    const rounded=n=>Math.round(n*1e9)/1e9;
    return {position:{xMm:rounded(this.worldToMm(p.x)+w.state.stock.lengthMm/2),yMm:rounded(this.worldToMm(p.z)+w.state.stock.widthMm/2),zMm:rounded(this.worldToMm(p.y))},
      tool:edge,rpm:m.runtime.rpm,running:m.running,direction:m.direction};
  }
  cut(before,after){
    if(!before||!after||before.tool.id!==after.tool.id)return;
    const from=before.running&&before.rpm>0?before.position:after.position;
    this.workpiece.cut(s=>cutHead(s,from,after.position,after.tool,after));
  }
  state(){const p=this.sample();return this.workpiece?{kind:'prismatic',tipMm:p?.position??null,bounds:headBounds(this.workpiece.state),
    features:this.workpiece.exportState().features,operations:this.workpiece.state.operationHistory.length,
    coordinateNote:'X 圖面左端→右端；Y 毛胚前側→後側；Z 毛胚底面向上。單位 mm。'}:null;}
  // A fixture/setup placement, not removal. No drawing target is involved.
  place({xMm=0,yMm=0,clearanceMm=5,tipZMm}={}){
    if(this.machine.running||this.machine.runtime.rpm>0)throw new Error('停機後才能重新定位裝夾');
    const w=this.workpiece,p=this.sample()?.position;if(!p)throw new Error('先裝上具刀尖定義的刀具');
    if(![xMm,yMm,clearanceMm].every(Number.isFinite)||clearanceMm<0||(tipZMm!==undefined&&!Number.isFinite(tipZMm)))throw new Error('Invalid setup');
    const delta=new Vector3(this.mmToWorld(p.xMm-xMm),this.mmToWorld(p.zMm-(tipZMm??w.state.stock.heightMm+clearanceMm)),this.mmToWorld(p.yMm-yMm));
    const origin=w.object3D.position.clone();
    // Mount frames have identity rotation in v1; transform the displacement for future rotated fixtures.
    const a=w.object3D.localToWorld(new Vector3()),b=w.object3D.localToWorld(delta);
    const local=w.object3D.parent.worldToLocal(b).sub(w.object3D.parent.worldToLocal(a));
    w.object3D.position.copy(origin.add(local));this.machine.rootScene.updateWorldMatrix(true,true);
  }
  move({xMm,yMm,zMm}){
    const m=this.machine,before=this.sample();if(!before)throw new Error('先裝上槌頭工件及刀具');
    const target={...before.position,...Object.fromEntries(Object.entries({xMm,yMm,zMm}).filter(([,v])=>v!==undefined))};
    if(!Object.values(target).every(Number.isFinite))throw new Error('Invalid machining coordinates');
    if(m.id==='drill'&&(Math.abs(target.xMm-before.position.xMm)>1e-6||Math.abs(target.yMm-before.position.yMm)>1e-6))throw new Error('鑽床 X/Y 請停機後使用裝夾定位');
    const ids=m.id==='milling'?['X_Axis_Table','Y_Axis_Saddle','Knee_Z_Slide']:['quill'];
    const old=m.getState().offsets,columns=[];
    // Measure the existing v1 axis directions in the workpiece frame; no axis-name sign guesses.
    for(const id of ids){
      const axis=m.config.axes.find(a=>a.id===id),delta=old[id]+0.001<=axis.range[1]?0.001:-0.001;
      let p;try{m.setAxisPosition(id,old[id]+delta);p=this.sample().position;}finally{m.setAxisPosition(id,old[id]);}
      columns.push(new Vector3(p.xMm-before.position.xMm,p.yMm-before.position.yMm,p.zMm-before.position.zMm).divideScalar(this.worldToMm(delta)));
    }
    const diff=new Vector3(target.xMm-before.position.xMm,target.yMm-before.position.yMm,target.zMm-before.position.zMm);
    let deltas;
    if(ids.length===3){const [a,b,c]=columns,matrix=new Matrix3().set(a.x,b.x,c.x,a.y,b.y,c.y,a.z,b.z,c.z);if(Math.abs(matrix.determinant())<1e-8)throw new Error('Unsupported mounting axes');deltas=diff.applyMatrix3(matrix.invert()).toArray();}
    else {if(Math.abs(columns[0].z)<1e-8)throw new Error('Unsupported quill direction');deltas=[diff.z/columns[0].z];}
    const values=ids.map((id,i)=>old[id]+this.mmToWorld(deltas[i]));
    ids.forEach((id,i)=>{const a=m.config.axes.find(a=>a.id===id);if(values[i]<a.range[0]-1e-8||values[i]>a.range[1]+1e-8)throw new Error('Requested cut exceeds machine travel');});
    ids.forEach((id,i)=>m.setAxisPosition(id,values[i]));this.cut(before,this.sample());
  }
}
