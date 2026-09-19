import {CanvasTexture,Group,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace} from 'three';

// Textures belong to the model and are released by disposeMachine/disposeModel.
export function createSelectorScale(def,scene,lookup){
 const group=new Group();group.name=def.name;group.position.fromArray(def.position);scene.add(group);lookup[def.name]=group;
 if(typeof document==='undefined')return;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=340;
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 const geometry=new PlaneGeometry(.20,.20*340/512);geometry.translate(0,.20*(285-170)/512,0);
 const mesh=new Mesh(geometry,new MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
 mesh.raycast=()=>{};group.add(mesh);group.userData.scale={canvas,texture,selector:def.selector,signature:''};
}

export function updateSelectorScales(m){
 const speed=m.config.speedSelectors;if(!speed)return;
 const gear=m.detents[speed.gear]??1,mode=m.detents[speed.mode]??1;
 for(const def of m.config.additions.filter(a=>a.kind==='selectorScale')){
  const data=m.lookup[def.name].userData.scale;if(!data)continue;
  const selected=data.selector===speed.gear?gear:mode;
  const values=data.selector===speed.gear?speed.baseRpm.map(r=>r*speed.multipliers[mode]):speed.multipliers.map(r=>r*speed.baseRpm[gear]);
  const signature=JSON.stringify([selected,values]);if(data.signature===signature)continue;data.signature=signature;
  const ctx=data.canvas.getContext('2d');ctx.clearRect(0,0,512,340);ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<4;i++){
   const start=-Math.PI+i*Math.PI/4,end=start+Math.PI/4,middle=(start+end)/2;
   ctx.beginPath();ctx.arc(256,285,246,start+.008,end-.008);ctx.arc(256,285,121,end-.008,start+.008,true);ctx.closePath();
   ctx.fillStyle=i===selected?'#43c9a4':'#1c2929';ctx.fill();ctx.strokeStyle='#b5c9bd';ctx.lineWidth=2;ctx.stroke();
   ctx.font='bold 30px sans-serif';ctx.fillStyle=i===selected?'#10251f':'#f1f5de';
   ctx.fillText(String(values[i]),256+216*Math.cos(middle),285+216*Math.sin(middle));
   if(data.selector===speed.mode){ctx.font='20px sans-serif';ctx.fillText('×'+speed.multipliers[i],256+143*Math.cos(middle),285+143*Math.sin(middle));}
  }
  ctx.font='bold 23px sans-serif';ctx.fillStyle='#e5eedc';ctx.fillText(data.selector===speed.gear?'RPM':'MODE / RPM',256,20);
  data.texture.needsUpdate=true;
 }
}
