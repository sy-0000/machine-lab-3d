import {CanvasTexture,Group,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace} from 'three';

// Compact engraved-style plates on the original green housing. Model disposal owns the textures.
export function createSelectorScale(def,scene,lookup){
 const group=new Group();group.name=def.name;group.position.fromArray(def.position);scene.add(group);lookup[def.name]=group;
 if(typeof document==='undefined')return;
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=def.panel==='table'?800:240;
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 const mesh=new Mesh(new PlaneGeometry(...def.size),new MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
 mesh.raycast=()=>{};group.add(mesh);group.userData.scale={canvas,texture,panel:def.panel,signature:''};
}

export function updateSelectorScales(m){
 const speed=m.config.speedSelectors;if(!speed)return;
 const gear=m.detents[speed.gear]??1,mode=m.detents[speed.mode]??0;
 for(const def of m.config.additions.filter(a=>a.kind==='selectorScale')){
  const data=m.lookup[def.name].userData.scale;if(!data)continue;
  const signature=JSON.stringify([gear,mode]);if(data.signature===signature)continue;data.signature=signature;
  const {canvas}=data,ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#17231ded';ctx.fillRect(5,5,w-10,h-10);ctx.strokeStyle='#dce3cf';ctx.lineWidth=5;ctx.strokeRect(8,8,w-16,h-16);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e5ead9';
  const cell=(text,x,y,width,height,active)=>{ctx.fillStyle=active?'#3d8065':'#17231d';ctx.fillRect(x,y,width,height);ctx.strokeStyle=active?'#f7d990':'#a8b5a3';ctx.lineWidth=active?5:2;ctx.strokeRect(x,y,width,height);ctx.fillStyle=active?'#fff2c9':'#edf0df';ctx.fillText(text,x+width/2,y+height/2);};
  if(data.panel==='table'){
   ctx.font='bold 48px sans-serif';ctx.fillText('SPINDLE  RPM',w/2,64);
   ctx.font='bold 42px sans-serif';cell('LOW',35,116,280,95,mode===0);cell('HIGH',325,116,280,95,mode===1);
   for(let row=0;row<speed.baseRpm.length;row++)for(let col=0;col<2;col++){ctx.font='48px sans-serif';cell(String(speed.baseRpm[row]*speed.multipliers[col]),35+col*290,225+row*130,280,120,row===gear&&col===mode);}
  }else if(data.panel==='mode'){
   ctx.font='bold 48px sans-serif';ctx.fillText('SPEED RANGE',w/2,48);
   ctx.font='bold 56px sans-serif';cell('LOW',25,95,285,120,mode===0);cell('HIGH',330,95,285,120,mode===1);
  }else{
   ctx.font='bold 48px sans-serif';ctx.fillText('RPM',w/2,48);
   ctx.font='bold 43px sans-serif';speed.baseRpm.forEach((rpm,i)=>cell(String(rpm*speed.multipliers[mode]),20+i*152,95,144,120,i===gear));
  }
  data.texture.needsUpdate=true;
 }
}
