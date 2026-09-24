import { defineTurningEdge } from '../tools/cuttingEdge.js';
import {Group,Mesh,BoxGeometry,CylinderGeometry,BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,Vector3} from 'three';

// Small teaching tool attachments. The supplied machine meshes stay intact.
function flutedGeometry(radius,length,flutes,tipLength=0){
 const positions=[],indices=[],around=64,rows=64;
 for(let j=0;j<=rows;j++){
  const t=j/rows,tipScale=tipLength?Math.min(1,(1-t)*length/tipLength):1;
  for(let i=0;i<=around;i++){
   const a=i/around*Math.PI*2,phase=flutes*(a-t*Math.PI*2*1.15);
   const r=radius*(.60+.40*Math.pow((1+Math.cos(phase))/2,3))*tipScale;
   positions.push(r*Math.cos(a),-length*t,r*Math.sin(a));
  }
 }
 for(let j=0;j<rows;j++)for(let i=0;i<around;i++){const a=j*(around+1)+i,b=a+around+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const top=positions.length/3;positions.push(0,0,0);const bottom=positions.length/3;positions.push(0,-length,0);
 for(let i=0;i<around;i++){indices.push(top,i+1,i);const a=rows*(around+1)+i;indices.push(bottom,a,a+1);}
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

function buildTurningTool(group, def, lookup){
 const silverSteel=new MeshStandardMaterial({color:'#dce3ea',metalness:.88,roughness:.22});
 const darkSteel=new MeshStandardMaterial({color:'#323940',metalness:.8,roughness:.35});
 const goldInsert=new MeshStandardMaterial({color:'#dfb738',metalness:.85,roughness:.24});
 const chipbreakerMat=new MeshStandardMaterial({color:'#b89324',metalness:.8,roughness:.3});
 const shimSteel1=new MeshStandardMaterial({color:'#b0b8c0',metalness:.85,roughness:.32});
 const shimSteel2=new MeshStandardMaterial({color:'#d0d8df',metalness:.88,roughness:.25});
 const carbideSeatMat=new MeshStandardMaterial({color:'#282e33',metalness:.75,roughness:.4});
 const screwSteel=new MeshStandardMaterial({color:'#a6b0b8',metalness:.9,roughness:.2});
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

 // 3. Hardened Carbide Seat / Shim (刀片底座墊片)
 const seat=new Mesh(new CylinderGeometry(.0125,.0125,.0028,3),carbideSeatMat);
 seat.name=def.name+'_Seat';
 seat.rotation.y=-Math.PI/2;
 seat.position.set(-.195,.009+.0014,0);
 group.add(seat);lookup[seat.name]=seat;

 // 4. Carbide Insert with Chipbreaker (可轉位鎢鋼車刀片與斷屑槽)
 const insert=new Mesh(new CylinderGeometry(.0118,.0118,.0042,3),goldInsert);
 insert.name=def.name+'_Insert';
 insert.rotation.y=-Math.PI/2;
  // Upper cutting corner in this insert's local world units; consumed only by the adapter.
  defineTurningEdge(insert);
 insert.position.set(-.195,.009+.0028+.0021,0);
 group.add(insert);lookup[insert.name]=insert;

 const chipbreaker=new Mesh(new CylinderGeometry(.007,.007,.0008,16),chipbreakerMat);
 chipbreaker.name=def.name+'_Chipbreaker';
 chipbreaker.position.set(-.195,.009+.0028+.0042+.0004,0);
 group.add(chipbreaker);

 // 5. Heavy-Duty Wedge Clamp & Bolt (壓板鎖緊機構)
 const clamp=new Mesh(new BoxGeometry(.024,.0055,.012),darkSteel);
 clamp.name=def.name+'_Clamp';
 clamp.rotation.z=-.15;
 clamp.position.set(-.178,.009+.006,0);
 group.add(clamp);

 const screw=new Mesh(new CylinderGeometry(.0035,.0035,.006,16),screwSteel);
 screw.name=def.name+'_Screw';
 screw.position.set(-.172,.009+.007,0);
 group.add(screw);

 const socket=new Mesh(new CylinderGeometry(.0018,.0018,.002,6),darkSteel);
 socket.name=def.name+'_ScrewSocket';
 socket.position.set(-.172,.009+.0095,0);
 group.add(socket);
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
 const steel=new MeshStandardMaterial({color:'#aab4bd',metalness:.85,roughness:.28});
 if(def.tool==='turning'){
  buildTurningTool(group,def,lookup);
 }else if(def.tool==='facemill'||def.tool==='endmill'){
  buildFaceMill(group,def,lookup);
 }else{
  const shank=new Mesh(new CylinderGeometry(def.radius*.85,def.radius*.85,def.shankLength,32),steel);shank.name=def.name+'_Shank';shank.position.y=-def.shankLength/2;group.add(shank);
  const cutter=new Mesh(flutedGeometry(def.radius,def.cuttingLength,def.tool==='drill'?2:4,def.tool==='drill'?def.radius*1.1:0),steel);cutter.name=def.name+'_Flutes';cutter.position.y=-def.shankLength;group.add(cutter);
 }
 const parent=lookup[def.parent];if(!parent)throw Error(`刀具掛載點不存在：${def.parent}`);parent.attach(group);
 lookup[def.name]=group;
 if(def.name==='FaceMill')lookup['EndMill']=group;
 if(def.name==='EndMill')lookup['FaceMill']=group;
 return group;
}
