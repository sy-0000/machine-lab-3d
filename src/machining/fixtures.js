import {Group,Mesh,BoxGeometry,CylinderGeometry,TorusGeometry,MeshStandardMaterial,MeshBasicMaterial} from 'three';

// Procedural teaching fixtures. Visual only: cutting uses WorkpieceState, never these meshes.
// Built in mm around the prismatic workpiece's local frame (origin = stock bottom centre,
// X = length, Y = up, Z = width), then scaled to world metres.
const paint=()=>({
  body:new MeshStandardMaterial({color:'#3d5a73',metalness:.35,roughness:.55}),
  steel:new MeshStandardMaterial({color:'#aeb9c2',metalness:.85,roughness:.28}),
  ground:new MeshStandardMaterial({color:'#d9e0e5',metalness:.9,roughness:.18}),
  dark:new MeshStandardMaterial({color:'#262c31',metalness:.6,roughness:.45}),
});
function box(group,material,[x0,x1],[y0,y1],[z0,z1],name){
  const mesh=new Mesh(new BoxGeometry(x1-x0,y1-y0,z1-z0),material);
  mesh.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function cylinder(group,material,radius,length,[x,y,z],axis,name,segments=24){
  const mesh=new Mesh(new CylinderGeometry(radius,radius,length,segments),material);
  if(axis==='z')mesh.rotation.x=Math.PI/2;else if(axis==='x')mesh.rotation.z=Math.PI/2;
  mesh.position.set(x,y,z);mesh.name=name;mesh.castShadow=true;group.add(mesh);return mesh;
}

/**
 * Machine vise with parallels. gapMm = distance from stock bottom down to the machine table.
 * The jaws close across the stock width and grip its lower part only.
 */
export function createVise({lengthMm,widthMm,heightMm},gapMm,{swivel=true}={}){
  const g=Math.max(gapMm,14),m=paint(),vise=new Group();vise.name='Fixture_Vise';
  const grip=Math.min(8,heightMm*.4),jawT=16,halfJaw=Math.max(50,lengthMm*.56),halfW=widthMm/2;
  const bedTop=-Math.min(12,g*.3),baseTop=-g+(swivel?Math.min(40,g*.28):Math.min(10,g*.2));
  const zFixed=-halfW-jawT,zScrewEnd=halfW+jawT+Math.min(90,g*.7);
  if(swivel){
    cylinder(vise,m.body,halfJaw*1.05,baseTop+g-4,[0,(-g+baseTop-4)/2,0],'y','Vise_SwivelBase',48);
    cylinder(vise,m.dark,halfJaw*1.08,4,[0,baseTop-2,0],'y','Vise_SwivelRing',48);
  }else box(vise,m.body,[-halfJaw-8,halfJaw+8],[-g,baseTop],[zFixed-12,zScrewEnd],'Vise_BasePlate');
  // Body with a guide slot under the moving jaw.
  box(vise,m.body,[-halfJaw*.62,halfJaw*.62],[baseTop,bedTop],[zFixed-6,zScrewEnd],'Vise_Body');
  for(const side of [-1,1])box(vise,m.body,[side*halfJaw*.62-(side>0?0:10),side*halfJaw*.62+(side>0?10:0)],[baseTop,bedTop-6],[zFixed,zScrewEnd-8],'Vise_Rail');
  // Fixed jaw (cast) and moving jaw, each faced with a ground plate.
  box(vise,m.body,[-halfJaw,halfJaw],[bedTop,grip],[zFixed-6,-halfW-3],'Vise_FixedJaw');
  box(vise,m.ground,[-halfJaw,halfJaw],[bedTop+2,grip],[-halfW-3,-halfW],'Vise_FixedJawPlate');
  box(vise,m.steel,[-halfJaw*.9,halfJaw*.9],[bedTop,grip],[halfW+3,halfW+jawT],'Vise_MovingJaw');
  box(vise,m.ground,[-halfJaw*.9,halfJaw*.9],[bedTop+2,grip],[halfW,halfW+3],'Vise_MovingJawPlate');
  for(const x of [-halfJaw*.55,halfJaw*.55])for(const z of [-halfW-1.5,halfW+1.5])
    cylinder(vise,m.dark,1.8,1,[x,grip*.45+bedTop*.55,z],'z','Vise_JawScrew',12);
  // Parallels lift the stock so a through-drill passes between them.
  const parallelT=Math.min(4,widthMm*.2);
  for(const side of [-1,1])box(vise,m.ground,[-lengthMm/2+2,lengthMm/2-2],[bedTop,0],side<0?[-halfW,-halfW+parallelT]:[halfW-parallelT,halfW],'Vise_Parallel');
  // Lead screw and crank handle on the moving-jaw side.
  const screwY=(baseTop+bedTop)/2;
  cylinder(vise,m.steel,5,zScrewEnd-halfW-jawT+26,[0,screwY,(halfW+jawT+zScrewEnd+26)/2],'z','Vise_LeadScrew');
  cylinder(vise,m.dark,9,12,[0,screwY,zScrewEnd+20],'z','Vise_CrankHub');
  cylinder(vise,m.steel,3,70,[0,screwY,zScrewEnd+22],'x','Vise_CrankBar');
  for(const x of [-35,35])cylinder(vise,m.dark,5,16,[x,screwY,zScrewEnd+22],'x','Vise_CrankGrip',16);
  vise.scale.setScalar(.001);
  return vise;
}

// Glowing ring marking where the tool touches the stock ("that edge lights up").
export function createContactMarker(){
  // Drawn over the tool so the cue stays visible even when the tool post hides the contact point.
  const material=new MeshBasicMaterial({color:'#ffb547',transparent:true,opacity:.9,toneMapped:false,depthTest:false});
  const ring=new Mesh(new TorusGeometry(1,.07,10,72),material);ring.name='ContactMarker';ring.visible=false;ring.renderOrder=10;
  ring.scale.setScalar(1e-4); // unit torus; keep hidden bounds tiny until the adapter sizes it
  ring.userData.setLevel=level=>{ring.visible=level>0;material.color.set(level>1?'#ff6a2b':'#ffb547');};
  return ring;
}
