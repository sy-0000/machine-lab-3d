import {Vector3,Matrix3,Raycaster} from 'three';
import {PrismaticWorkpiece} from './PrismaticWorkpiece.js';
import {cutHead} from '../HeadCuttingSimulation.js';
import {headBounds,surfaceAt} from '../HeadWorkpieceState.js';
import {createVise,createContactMarker} from '../fixtures.js';
import {isVisibleObject} from '../../machines/runtime.js';

/** Additive v1 boundary. Tool tip is transformed into the actual moving stock frame. */
export class HeadMachiningAdapter{
  constructor(machine,mmToWorld,worldToMm){this.machine=machine;this.mmToWorld=mmToWorld;this.worldToMm=worldToMm;}
  get workpiece(){const w=this.machine.currentWorkpiece;return w instanceof PrismaticWorkpiece?w:null;}
  calibrateTool(){
    const m=this.machine,tool=m.currentTool,edge=tool?.object3D.userData.axialCuttingEdge;
    // The drill press's v1 ToolMount sits ~0.5 m above the chuck; its own teaching drill is in the chuck.
    const chuckDrill=m.id==='drill'?m.runtime.lookup.TwistDrill:null,headTool=!!(tool?.id.startsWith('head_')&&edge);
    if(chuckDrill)chuckDrill.visible=!headTool;
    if(!headTool)return;
    // v1 mount positions are legacy values. Place this new procedural tool on the
    // actual spindle pivot axis, rather than accepting an orbiting off-axis tip.
    const pivot=m.runtime.pivots[m.config.spindle.node],root=tool.object3D;
    if(!pivot)throw new Error('Spindle pivot unavailable');m.rootScene.updateWorldMatrix(true,true);
    const tip=root.localToWorld(new Vector3(...edge.tip)),p=pivot.worldToLocal(tip.clone()),axis=new Vector3(...m.config.spindle.axis).normalize();
    const aligned=pivot.localToWorld(axis.multiplyScalar(p.dot(axis)));
    const delta=root.parent.worldToLocal(aligned).sub(root.parent.worldToLocal(tip));root.position.add(delta);m.rootScene.updateWorldMatrix(true,true);
    if(chuckDrill){
      // Seat the shank top where the chuck holds the machine's own drill (both lie on the spindle axis).
      const seat=root.parent.worldToLocal(chuckDrill.getWorldPosition(new Vector3())).sub(root.parent.worldToLocal(root.getWorldPosition(new Vector3())));
      root.position.add(seat);m.rootScene.updateWorldMatrix(true,true);
    }
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
    if(!this.workpiece.cut(s=>cutHead(s,from,after.position,after.tool,after))||!this.onChips)return;
    const m=this.machine,w=this.workpiece,p=after.position,st=w.state.stock,radius=after.tool.diameterMm/2,dir=after.direction||1;
    const local=(x,y,z)=>new Vector3(this.mmToWorld(x-st.lengthMm/2),this.mmToWorld(z),this.mmToWorld(y-st.widthMm/2));
    const clamp=(v,hi)=>Math.max(-1,Math.min(hi+1,v));
    // Each chip leaves from the cutter rim (never hidden under the cutter or inside the hole), flung along
    // the spindle rotation and outward. Milling chips leave at the cut depth; drill chips climb the flutes
    // and spill over the hole mouth.
    const source=()=>{
      const a=Math.random()*Math.PI*2,c=Math.cos(a),s=Math.sin(a),drill=m.id==='drill';
      const x=clamp(p.xMm+radius*c,st.lengthMm),y=clamp(p.yMm+radius*s,st.widthMm);
      const z=drill?surfaceAt(w.state,p.xMm,p.yMm)+1:Math.max(0,p.zMm)+.5;
      const at=w.object3D.localToWorld(local(x,y,z));
      const away=new Vector3(c*(drill?.7:.6)-s*dir*(drill?.5:.8),drill?.9:.5,s*(drill?.7:.6)+c*dir*(drill?.5:.8))
        .transformDirection(w.object3D.matrixWorld);
      return [at,away];
    };
    // Chips may land on the stock and vise; they pass through the cutter and the contact ring.
    this.onChips(source,null,Math.hypot(p.xMm-from.xMm,p.yMm-from.yMm,p.zMm-from.zMm),
      [m.currentTool.object3D,w.object3D.getObjectByName('ContactMarker')].filter(Boolean));
  }
  /** Tool touches stock: any sampled surface under / beside the cutter reaches the tip height. */
  contact(sample=this.sample()){const top=this.surfaceUnder(sample);return top>0&&sample.position.zMm<=top+0.05;}
  /** Highest stock surface under / beside the cutter (0 when the cutter is off the stock). */
  surfaceUnder(sample=this.sample()){
    const w=this.workpiece;if(!w||!sample)return 0;
    const s=w.state,{nx,ny,resolutionMm:res,topMm}=s.surface,t=sample.position,reach=sample.tool.diameterMm/2+0.05;
    let top=0;
    for(let iy=Math.max(0,Math.floor((t.yMm-reach)/res));iy<=Math.min(ny-1,Math.floor((t.yMm+reach)/res));iy++)
      for(let ix=Math.max(0,Math.floor((t.xMm-reach)/res));ix<=Math.min(nx-1,Math.floor((t.xMm+reach)/res));ix++)
        if(Math.hypot((ix+.5)*res-t.xMm,(iy+.5)*res-t.yMm)<=reach+res*.71)top=Math.max(top,topMm[iy*nx+ix]);
    return top;
  }
  /** Contact ring around the cutter at its tip; level 0 none, 1 touching, 2 cutting. */
  updateMarker(){
    const w=this.workpiece;if(!w)return 0;
    const sample=this.sample(),level=this.contact(sample)?(this.machine.running&&this.machine.runtime.rpm>0?2:1):0;
    let ring=w.object3D.getObjectByName('ContactMarker');
    if(!ring){ring=createContactMarker();w.object3D.add(ring);}
    ring.userData.setLevel(level);
    if(level){const p=sample.position,s=w.state.stock,r=sample.tool.diameterMm/2+0.3;
      ring.position.set(this.mmToWorld(p.xMm-s.lengthMm/2),this.mmToWorld(Math.max(0,p.zMm)),this.mmToWorld(p.yMm-s.widthMm/2));
      ring.rotation.set(Math.PI/2,0,0);ring.scale.setScalar(this.mmToWorld(r));}
    return level;
  }
  /** Vise under the stock, sized to reach the machine table directly below it. */
  fitFixture(){
    const m=this.machine,w=this.workpiece;if(!w)return;
    w.object3D.getObjectByName('Fixture_Vise')?.removeFromParent();
    m.rootScene.updateWorldMatrix(true,true);
    const origin=w.object3D.localToWorld(new Vector3()),down=w.object3D.localToWorld(new Vector3(0,-1,0)).sub(origin).normalize();
    const skip=[w.object3D,m.currentTool?.object3D].filter(Boolean),inside=o=>{for(;o;o=o.parent)if(skip.includes(o))return true;return false;};
    // Several rays over the stock footprint: a single centre ray drops through the drill table's hole.
    const {lengthMm,widthMm}=w.state.stock,ray=new Raycaster(),distances=[];
    for(const [x,z] of [[0,0],[-.4,-.4],[.4,-.4],[-.4,.4],[.4,.4]]){
      ray.set(w.object3D.localToWorld(new Vector3(this.mmToWorld(x*lengthMm),0,this.mmToWorld(z*widthMm))),down);
      const hit=ray.intersectObject(m.rootScene,true).find(h=>h.object.isMesh&&!inside(h.object)&&isVisibleObject(h.object));
      if(hit)distances.push(hit.distance);
    }
    const gapMm=distances.length?this.worldToMm(Math.min(...distances)):60;
    w.object3D.add(createVise(w.state.stock,gapMm,{swivel:m.id==='milling'}));
    m.rootScene.updateWorldMatrix(true,true);
  }
  state(){const p=this.sample(),top=this.surfaceUnder(p),contact=this.contact(p);return this.workpiece?{kind:'prismatic',tipMm:p?.position??null,bounds:headBounds(this.workpiece.state),
    // How far the tip sits below the surface it touches: a stopped tool this deep has overshot the touch-off.
    features:this.workpiece.exportState().features,contact,embedMm:contact?Math.max(0,top-p.position.zMm):0,operations:this.workpiece.state.operationHistory.length,
    coordinateNote:'X 圖面左端→右端；Y 毛胚前側→後側；Z 毛胚底面向上。單位 mm。'}:null;}
  /** Mount position: the drill press has no table X/Y feed, so its stock is set centred under the spindle;
   *  on the mill the cutter starts just outside the left end, centred across the width. */
  defaultSetup(){
    const s=this.workpiece.state.stock,p=this.sample();
    if(this.machine.id==='drill')return {xMm:s.lengthMm/2,yMm:s.widthMm/2};
    return {xMm:-(p.tool.diameterMm/2+8),yMm:s.widthMm/2};
  }
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
    w.object3D.position.copy(origin.add(local));this.machine.rootScene.updateWorldMatrix(true,true);this.fitFixture();
  }
  /** Drill press: slide the vise along the stock's X so the drill lines up with a scribed centre line. */
  slide(deltaMm){
    const m=this.machine,p=this.sample()?.position;
    if(m.id!=='drill')throw new Error('只有鑽床可以滑動虎鉗定位');
    if(!p)throw new Error('先裝上工件及刀具');
    if(!Number.isFinite(deltaMm))throw new Error('Invalid slide');
    if(p.zMm<=headBounds(this.workpiece.state).heightMm+0.5)throw new Error('鑽頭還在工件裡：放開進給、讓鑽頭回到上方再移動工件');
    const s=this.workpiece.state.stock,xMm=Math.round(Math.max(-10,Math.min(s.lengthMm+10,p.xMm+deltaMm))*1000)/1000;
    this.place({xMm,yMm:p.yMm,tipZMm:p.zMm});
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
