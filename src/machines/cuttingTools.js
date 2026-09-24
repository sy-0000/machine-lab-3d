import { createTurningInsert,buildEndMill,buildTwistDrill } from '../tools/toolGeometry.js';
import {Group,Mesh,BoxGeometry,CylinderGeometry,MeshStandardMaterial} from 'three';

// Small teaching tool attachments. The supplied machine meshes stay intact.
function buildTurningTool(group, def, lookup){
 const silverSteel=new MeshStandardMaterial({color:'#dce3ea',metalness:.88,roughness:.22});
 const darkSteel=new MeshStandardMaterial({color:'#323940',metalness:.8,roughness:.35});
 const shimSteel1=new MeshStandardMaterial({color:'#b0b8c0',metalness:.85,roughness:.32});
 const shimSteel2=new MeshStandardMaterial({color:'#d0d8df',metalness:.88,roughness:.25});
 const carbideSeatMat=new MeshStandardMaterial({color:'#282e33',metalness:.75,roughness:.4});
 const laserLabelMat=new MeshStandardMaterial({color:'#47525d',roughness:.6});

 // 1. Shims (車刀墊片) filling the gap between slot floor (-0.0201) and shank bottom (-0.0090)
 const shimBottom=new Mesh(new BoxGeometry(.145,.0065,.022),shimSteel1);
 shimBottom.name=def.name+'_Shim_Bottom';
 shimBottom.position.set(-.015,-.0201+.0065/2,0);
 group.add(shimBottom);lookup[shimBottom.name]=shimBottom;

 const shimTop=new Mesh(new BoxGeometry(.132,.0046,.020),shimSteel2);
 shimTop.name=def.name+'_Shim_Top';
 shimTop.position.set(-.020,-.0201+.0065+.0046/2,0);
 group.add(shimTop);lookup[shimTop.name]=shimTop;

 // 2. Main Silver Tool Shank (銀色車刀桿主體與倒角刀頭)
 const shank=new Mesh(new BoxGeometry(.165,.018,.018),silverSteel);
 shank.name=def.name+'_Shank';
 shank.position.set(-.055,0,0);
 group.add(shank);lookup[shank.name]=shank;

 // Straight head overlaps the shank and supports the insert seat.
 const head=new Mesh(new BoxGeometry(.064,.018,.018),silverSteel);
 head.name=def.name+'_Head';
 head.position.set(-.166,0,0);
 group.add(head);lookup[head.name]=head;

 const label=new Mesh(new BoxGeometry(.065,.007,.0006),laserLabelMat);
 label.name=def.name+'_LaserLabel';
 label.position.set(-.06,0,.0093);
 group.add(label);

 // 3. Carbide seat under the insert (刀片底座墊片)
 const seat=createTurningInsert({radius:.0122,height:.0028,name:def.name+'_Seat',material:carbideSeatMat,screw:false,edge:false});
 seat.rotation.y=-Math.PI/2;
 seat.position.set(-.195,.009+.0014,0);
 group.add(seat);lookup[seat.name]=seat;

 // 4. 80° rhombic carbide insert with chip-breaker land and centre screw (可轉位鎢鋼車刀片)
 // Same cutting corner as the earlier triangular insert; the adapter reads insert.userData.cuttingEdge.
 const insert=createTurningInsert({radius:.0118,height:.0042,name:def.name+'_Insert'});
 insert.rotation.y=-Math.PI/2;
 insert.position.set(-.195,.009+.0028+.0021,0);
 group.add(insert);lookup[insert.name]=insert;
}

function buildFaceMill(group, def, lookup){
 const toolSteel=new MeshStandardMaterial({color:'#c2cbd2',metalness:.88,roughness:.25});
 const darkColletMat=new MeshStandardMaterial({color:'#323a40',metalness:.8,roughness:.35});
 const flangeMat=new MeshStandardMaterial({color:'#a4adb5',metalness:.85,roughness:.28});
 const insertGold=new MeshStandardMaterial({color:'#dfb738',metalness:.85,roughness:.24});
 const boltMat=new MeshStandardMaterial({color:'#282e34',metalness:.75,roughness:.4});
 const screwMat=new MeshStandardMaterial({color:'#1e2226',metalness:.6,roughness:.5});

 // 1. Arbor Adapter / Collet (面銑刀接桿與夾頭段)
 const shank=new Mesh(new CylinderGeometry(.016,.016,.024,32),darkColletMat);
 shank.name=def.name+'_ArborShank';shank.position.y=-.012;group.add(shank);

 const flange=new Mesh(new CylinderGeometry(.025,.025,.010,32),flangeMat);
 flange.name=def.name+'_ArborFlange';flange.position.y=-.029;group.add(flange);

 for(const angle of [0,Math.PI]){
  const key=new Mesh(new BoxGeometry(.006,.008,.010),darkColletMat);
  key.position.set(.020*Math.cos(angle),-.029,.020*Math.sin(angle));
  key.rotation.y=angle;group.add(key);
 }

 const neck=new Mesh(new CylinderGeometry(.014,.014,.012,32),darkColletMat);
 neck.name=def.name+'_ArborNeck';neck.position.y=-.040;group.add(neck);

 // 2. Face Mill Cutter Body (面銑刀盤本體 - Conical Cutter Head)
 const cutterBody=new Mesh(new CylinderGeometry(.020,.028,.020,32),toolSteel);
 cutterBody.name=def.name+'_CutterBody';cutterBody.position.y=-.056;group.add(cutterBody);

 const centerBolt=new Mesh(new CylinderGeometry(.010,.010,.005,24),boltMat);
 centerBolt.name=def.name+'_CenterBolt';centerBolt.position.y=-.064;group.add(centerBolt);

 const boltSocket=new Mesh(new CylinderGeometry(.0045,.0045,.003,6),darkColletMat);
 boltSocket.name=def.name+'_CenterBoltSocket';boltSocket.position.y=-.063;group.add(boltSocket);

 // 3. Indexable Face Milling Inserts (可轉位銑削刀片 - 4 刃對稱分佈)
 const insertCount=4,insertRadius=.0255;
 for(let i=0;i<insertCount;i++){
  const a=(i*Math.PI*2)/insertCount;
  const insertGroup=new Group();
  insertGroup.name=`${def.name}_InsertPocket_${i}`;
  insertGroup.position.set(insertRadius*Math.cos(a),-.063,insertRadius*Math.sin(a));
  insertGroup.rotation.y=a;

  const pocket=new Mesh(new BoxGeometry(.0085,.0085,.003),darkColletMat);
  pocket.position.set(0,0,-.002);insertGroup.add(pocket);

  const insert=new Mesh(new BoxGeometry(.0078,.0078,.0035),insertGold);
  insert.name=`${def.name}_Insert_${i}`;
  insert.rotation.z=-.12;insert.rotation.x=.15;insertGroup.add(insert);

  const screw=new Mesh(new CylinderGeometry(.0016,.0016,.004,12),screwMat);
  screw.rotation.x=Math.PI/2;screw.position.z=.0015;insertGroup.add(screw);

  group.add(insertGroup);
 }
}

export function createCuttingTool(def,scene,lookup){
 const group=new Group();group.name=def.name;group.position.fromArray(def.position);scene.add(group);
 if(def.rotation)group.rotation.fromArray(def.rotation);
 if(def.scale)group.scale.fromArray(def.scale);
 if(def.tool==='turning'){
  buildTurningTool(group,def,lookup);
 }else if(def.tool==='facemill'||def.tool==='endmill'){
  buildFaceMill(group,def,lookup);
 }else{
  const dims={radius:def.radius,shankLength:def.shankLength,cuttingLength:def.cuttingLength};
  if(def.tool==='drill')buildTwistDrill(group,dims,def.name);else buildEndMill(group,dims,def.name);
 }
 const parent=lookup[def.parent];if(!parent)throw Error(`刀具掛載點不存在：${def.parent}`);parent.attach(group);
 lookup[def.name]=group;
 if(def.name==='FaceMill')lookup['EndMill']=group;
 if(def.name==='EndMill')lookup['FaceMill']=group;
 return group;
}
