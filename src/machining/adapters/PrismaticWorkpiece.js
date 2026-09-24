import {Group,Mesh,BufferGeometry,Float32BufferAttribute,MeshStandardMaterial} from 'three';
import {WorkpieceBase} from '../../workpieces/WorkpieceBase.js';
import {cloneHeadState} from '../HeadWorkpieceState.js';

// Display the same sampled solid used for milling; holes subtract their recorded depth.
export function headGeometry(s,mmToWorld){
  const positions=[],{nx,ny,resolutionMm:r}=s.surface;
  const tops=s.surface.topMm.slice();
  for(let i=0;i<tops.length;i++){
    const x=(i%nx+0.5)*r,y=(Math.floor(i/nx)+0.5)*r;
    for(const h of s.features)if(h.type==='hole'&&Math.hypot(x-h.xMm,y-h.yMm)<=h.diameterMm/2)tops[i]=Math.min(tops[i],Math.max(0,h.entryZMm-h.depthMm));
  }
  const point=(x,y,z)=>[mmToWorld(x-s.stock.lengthMm/2),mmToWorld(z),mmToWorld(y-s.stock.widthMm/2)];
  const quad=(a,b,c,d)=>positions.push(...a,...b,...c,...a,...c,...d);
  for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
    const i=iy*nx+ix,h=tops[i];if(h<=0)continue;
    const x=ix*r,X=Math.min(x+r,s.stock.lengthMm),y=iy*r,Y=Math.min(y+r,s.stock.widthMm);
    quad(point(x,y,h),point(x,Y,h),point(X,Y,h),point(X,y,h));
    quad(point(x,y,0),point(X,y,0),point(X,Y,0),point(x,Y,0));
    const sides=[[ix?tops[i-1]:0,[x,y],[x,Y]], [ix+1<nx?tops[i+1]:0,[X,Y],[X,y]],
      [iy?tops[i-nx]:0,[X,y],[x,y]],[iy+1<ny?tops[i+nx]:0,[x,Y],[X,Y]]];
    for(const [low,a,b] of sides)if(low<h)quad(point(...a,low),point(...b,low),point(...b,h),point(...a,h));
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export class PrismaticWorkpiece extends WorkpieceBase{
  constructor(state,mmToWorld){
    const s=cloneHeadState(state),group=new Group();
    super({id:s.id,name:'槌頭工件（可切削）',type:'block',dimensions:{lengthMeters:mmToWorld(s.stock.lengthMm),widthMeters:mmToWorld(s.stock.widthMm),heightMeters:mmToWorld(s.stock.heightMm)},object3D:group});
    this.state=s;this.mmToWorld=mmToWorld;
    this.mesh=new Mesh(headGeometry(s,mmToWorld),new MeshStandardMaterial({color:'#a3b4c2',metalness:0.8,roughness:0.4}));group.add(this.mesh);
  }
  exportState(){return cloneHeadState(this.state);}
  inspect(fn){return fn(this.state);}
  cut(fn){const next=fn(this.state);if(next===this.state)return false;this.mesh.geometry.dispose();this.mesh.geometry=headGeometry(next,this.mmToWorld);this.state=next;return true;}
}
