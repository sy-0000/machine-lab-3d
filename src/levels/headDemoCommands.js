import {headBounds,surfaceAt} from '../machining/HeadWorkpieceState.js';
// Practice paths only: examples are deliberately not drawing acceptance geometry.
export function headDemoCommands(def,input){
  const {lengthMm:l,widthMm:w,heightMm:h}=input.stock;
  const bounds=headBounds(input),top=bounds.heightMm;
  const move=(xMm,yMm,zMm)=>({type:'head.move',xMm,yMm,zMm});
  const commands=[{type:'head.setup',xMm:0,yMm:w/2},{type:'spindle.start'},{wait:'running'}];
  if(def.machine==='milling'){
    if(top<=1.5)throw new Error('Checkpoint 剩餘高度不足以示範，請先檢查實際工件');
    commands.push(move(0,w/2,top-0.5));
    for(let i=1;i<=20;i++)commands.push(move(l*i/20,w/2,def.id==='head-profile'?top-0.5-i/20:top-0.5));
    commands.push(move(l,w/2,h+5));
  }else{
    // Unknown Y/depth use explicit practice setup, never confirmed drawing requirements.
    const hole=input.features.find(f=>f.type==='hole'&&f.diameterMm===def.targets.pilotDiameter?.value);
    if(def.id==='head-tap'&&!hole)throw new Error('示範需要本關 checkpoint 的有效 Ø8.5 底孔');
    const x=hole?.xMm??bounds.minX+def.targets.x.value,y=hole?.yMm??w/2;
    commands.splice(0,1,{type:'head.setup',xMm:x,yMm:y});
    const entry=hole?.entryZMm??surfaceAt(input,x,y),depth=def.id==='head-tap'?Math.min(2,hole.depthMm):2;
    if(entry<=0)throw new Error('示範定位處無材料；請先檢查 checkpoint');
    commands.push({type:'head.move',zMm:entry+0.5},{type:'head.move',zMm:entry-depth},{type:'head.move',zMm:h+5});
  }
  commands.push({type:'spindle.stop'},{wait:'stopped'});return commands;
}
