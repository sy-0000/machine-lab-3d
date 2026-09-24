import {Group,Mesh,BufferGeometry,Float32BufferAttribute,BoxGeometry,CylinderGeometry,TorusGeometry,MeshStandardMaterial,DoubleSide} from 'three';

// Procedural cutting-tool meshes (world metres). The tool tip is always at local (0,-(shank+cutting),0);
// the adapters read that point, so nothing here may move it.

const materials={
  carbide:()=>new MeshStandardMaterial({color:'#a3adb6',metalness:.8,roughness:.3}),
  coating:()=>new MeshStandardMaterial({color:'#6f6c92',metalness:.75,roughness:.28}),
  tin:()=>new MeshStandardMaterial({color:'#d4a94c',metalness:.85,roughness:.25}),
  hss:()=>new MeshStandardMaterial({color:'#cfd7de',metalness:.9,roughness:.2}),
  dark:()=>new MeshStandardMaterial({color:'#2b3238',metalness:.7,roughness:.4}),
  gold:()=>new MeshStandardMaterial({color:'#dfb738',metalness:.85,roughness:.24,side:DoubleSide}),
};

/**
 * Surface of revolution whose radius depends on angle and height: r(angle, t) with t 0 (top) → 1 (tip).
 * `end` closes the bottom: 'flat' or a cone of the given half-angle (drill point).
 */
function sweptSurface(length,radiusAt,{around=96,rows=120,pointHalfAngle=null,maxRadius}){
  const positions=[],indices=[],tipLength=pointHalfAngle?maxRadius/Math.tan(pointHalfAngle):0;
  for(let j=0;j<=rows;j++){
    const t=j/rows,y=-length*t,fromTip=length*(1-t);
    const cone=tipLength&&fromTip<tipLength?fromTip/tipLength:1;
    for(let i=0;i<=around;i++){const a=i/around*Math.PI*2,r=radiusAt(a,t)*cone;positions.push(r*Math.cos(a),y,r*Math.sin(a));}
  }
  for(let j=0;j<rows;j++)for(let i=0;i<around;i++){const a=j*(around+1)+i,b=a+around+1;indices.push(a,a+1,b,a+1,b+1,b);}
  const top=positions.length/3;positions.push(0,0,0);const bottom=positions.length/3;positions.push(0,-length,0);
  for(let i=0;i<around;i++){indices.push(top,i+1,i);const a=rows*(around+1)+i;indices.push(bottom,a,a+1);}
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
// Flute cross-section: land (full radius) with a rounded gullet down to the core.
const flute=(a,flutes,core,landShare=.42)=>{
  const u=((a*flutes/(Math.PI*2))%1+1)%1;
  if(u<landShare)return 1;
  const g=(u-landShare)/(1-landShare);return core+(1-core)*Math.pow(Math.abs(2*g-1),1.6);
};
function mesh(geometry,material,name){const m=new Mesh(geometry,material);m.name=name;m.castShadow=m.receiveShadow=true;return m;}
function shankWithChamfer(group,radius,length,material,name){
  group.add(place(mesh(new CylinderGeometry(radius*.94,radius,radius*.12,40),material,name+'_Chamfer'),-radius*.06));
  const s=mesh(new CylinderGeometry(radius,radius,length-radius*.12,40),material,name);s.position.y=-(length+radius*.12)/2;group.add(s);
}
function place(object,y){object.position.y=y;return object;}

/** 4-flute square end mill with ER collet nut. */
export function buildEndMill(group,{radius,shankLength,cuttingLength},name='EndMill'){
  const coat=materials.coating(),body=materials.carbide(),dark=materials.dark();
  const nutH=Math.min(shankLength*.35,.012);
  group.add(place(mesh(new CylinderGeometry(radius*2.9,radius*2.6,nutH,6),dark,name+'_ColletNut'),-nutH/2));
  group.add(place(mesh(new TorusGeometry(radius*2.62,radius*.12,8,48),body,name+'_NutRing'),-nutH));
  group.children.at(-1).rotation.x=Math.PI/2;
  const exposed=new Group();exposed.position.y=-nutH;group.add(exposed);
  shankWithChamfer(exposed,radius,shankLength-nutH,body,name+'_Shank');
  const helix=Math.tan(30*Math.PI/180)*cuttingLength/radius; // radians of twist over the flute length
  const cutter=mesh(sweptSurface(cuttingLength,(a,t)=>{
    const lead=t>.985?(1-(t-.985)/.015*.06):1; // small corner chamfer at the end teeth
    return radius*flute(a+t*helix,4,.62)*lead;
  },{maxRadius:radius}),coat,name+'_Flutes');
  cutter.position.y=-shankLength;group.add(cutter);
}

/**
 * Indexable face mill (same look as the machine's original teaching FaceMill): arbor, flange,
 * conical body and square gold inserts whose bottom faces sit exactly on the tool tip plane.
 */
export function buildFaceMill(group,{radius,shankLength,cuttingLength},name='FaceMill'){
  const dark=materials.dark(),body=materials.carbide(),gold=materials.gold(),tip=-(shankLength+cuttingLength);
  const at=(m,y)=>{m.position.y=y;group.add(m);return m;};
  at(mesh(new CylinderGeometry(radius*.55,radius*.55,.024,32),dark,name+'_ArborShank'),-.012);
  at(mesh(new CylinderGeometry(radius*.86,radius*.86,.01,32),body,name+'_ArborFlange'),-.029);
  for(const angle of [0,Math.PI]){const key=mesh(new BoxGeometry(.006,.008,.01),dark,name+'_DriveKey');key.position.set(radius*.69*Math.cos(angle),-.029,radius*.69*Math.sin(angle));key.rotation.y=angle;group.add(key);}
  at(mesh(new CylinderGeometry(radius*.48,radius*.48,-.034-(tip+.021),32),dark,name+'_ArborNeck'),(-.034+tip+.021)/2);
  const bodyTop=tip+.021,bodyBottom=tip+.003;
  at(mesh(new CylinderGeometry(radius*.69,radius*.93,bodyTop-bodyBottom,40),body,name+'_CutterBody'),(bodyTop+bodyBottom)/2);
  at(mesh(new CylinderGeometry(radius*.34,radius*.34,.004,24),dark,name+'_CenterBolt'),bodyBottom-.001);
  const size=radius*.27,count=5;
  for(let i=0;i<count;i++){
    const a=i*Math.PI*2/count,pocket=new Group();pocket.name=`${name}_InsertPocket_${i}`;
    pocket.position.set((radius-size/2)*Math.cos(a),tip+size/2,(radius-size/2)*Math.sin(a));pocket.rotation.y=-a;
    const insert=mesh(new BoxGeometry(size,size,size*.42),gold,`${name}_Insert_${i}`);pocket.add(insert);
    const screw=mesh(new CylinderGeometry(size*.18,size*.18,size*.5,12),dark,`${name}_InsertScrew_${i}`);screw.rotation.x=Math.PI/2;screw.position.z=size*.3;pocket.add(screw);
    group.add(pocket);
  }
}

/** Twist drill with 118° point and two helical flutes. */
export function buildTwistDrill(group,{radius,shankLength,cuttingLength},name='Drill'){
  const tin=materials.tin(),hss=materials.hss();
  shankWithChamfer(group,radius*.98,shankLength,hss,name+'_Shank');
  const helix=Math.tan(30*Math.PI/180)*cuttingLength/radius;
  const body=mesh(sweptSurface(cuttingLength,(a,t)=>radius*flute(a+t*helix,2,.3,.36),
    {maxRadius:radius,pointHalfAngle:59*Math.PI/180,rows:140}),tin,name+'_Flutes');
  body.position.y=-shankLength;group.add(body);
}

/** Straight-flute hand/machine tap (M10 × 1.5 coarse standard) with square drive and chamfered lead. */
export function buildTap(group,{radius,shankLength,cuttingLength},name='Tap',pitch=.0015){
  const hss=materials.hss(),dark=materials.dark();
  const drive=Math.min(.008,shankLength*.35);
  group.add(place(mesh(new CylinderGeometry(radius*.62,radius*.62,drive,4),dark,name+'_SquareDrive'),-drive/2));
  const shank=new Group();shank.position.y=-drive;group.add(shank);
  shankWithChamfer(shank,radius*.8,shankLength-drive,hss,name+'_Shank');
  const depth=pitch*.6,lead=pitch*3.5;
  const body=mesh(sweptSurface(cuttingLength,(a,t)=>{
    const y=t*cuttingLength,phase=((y/pitch+a/(Math.PI*2))%1+1)%1,tri=1-Math.abs(2*phase-1);
    const fromTip=cuttingLength-y,taper=fromTip<lead?fromTip/lead:1;
    const thread=radius-depth+depth*tri*taper-(1-taper)*depth*.6;
    return Math.min(thread,radius*flute(a,4,.55,.62));
  },{maxRadius:radius,around:128,rows:Math.round(cuttingLength/pitch*14)}),hss,name+'_Threads');
  body.position.y=-shankLength;group.add(body);
}

/**
 * 80° rhombic (CNMG-style) insert. Same corner as the original triangular insert:
 * local tip (0, height/2, radius); the insert body extends back along −Z.
 */
export function createTurningInsert({radius=.0118,height=.0042,name='Insert',material=materials.gold(),screw:withScrew=true,edge=true}={}){
  const length=radius*1.55,centre=radius-length/2,half=length/2*Math.tan(40*Math.PI/180),top=height/2,chip=height*.18;
  const outline=[[0,radius],[half,centre],[0,radius-length],[-half,centre]];
  const inner=outline.map(([x,z])=>[x*.72,centre+(z-centre)*.72]);
  const positions=[],push=(...p)=>positions.push(...p);
  const quad=(a,b,c,d)=>{push(...a,...b,...c,...a,...c,...d);};
  const ring=(y,s=1)=>outline.map(([x,z])=>[x*s,y,centre+(z-centre)*s]);
  const up=ring(top),down=ring(-top),rim=ring(top-chip*.4,.99);
  for(let i=0;i<4;i++){const j=(i+1)%4;quad(down[i],down[j],up[j],up[i]);quad(up[i],up[j],rim[j],rim[i]);}
  // Bottom face and a recessed chip-breaker land on top.
  quad(down[3],down[2],down[1],down[0]);
  const land=inner.map(([x,z])=>[x,top-chip,z]);
  for(let i=0;i<4;i++){const j=(i+1)%4;quad(rim[i],rim[j],land[j],land[i]);}
  quad(land[0],land[1],land[2],land[3]);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  const insert=mesh(geometry,material,name);
  if(edge){
    insert.userData.cuttingEdge={version:1,units:'world',tip:[0,top,radius],operations:['turning','facing']};
    insert.userData.cuttingTipLocal=[0,top,radius]; // first-version compatibility marker
  }
  if(!withScrew)return insert;
  // Central clamping screw through the insert hole.
  const screw=mesh(new CylinderGeometry(radius*.2,radius*.2,height*1.1,20),materials.dark(),name+'_Screw');screw.position.z=centre;
  const head=mesh(new CylinderGeometry(radius*.26,radius*.22,height*.35,24),materials.hss(),name+'_ScrewHead');
  head.position.set(0,top+height*.1,centre);insert.add(screw,head);
  const socket=mesh(new CylinderGeometry(radius*.13,radius*.13,height*.2,6),materials.dark(),name+'_ScrewSocket');
  socket.position.set(0,top+height*.22,centre);insert.add(socket);
  return insert;
}
