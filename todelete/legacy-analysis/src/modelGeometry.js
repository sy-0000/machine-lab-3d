import {Box3,Vector3} from 'three';
export function meshComponents(mesh) {
 const g=mesh.geometry, p=g.attributes.position, idx=g.index;const vertices=new Map(), parents=[];const ids=[];const v=new Vector3();
 const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);const key=v.toArray().map(n=>Math.round(n*1e6)).join(',');if(!vertices.has(key)){vertices.set(key,parents.length);parents.push(parents.length);}ids[i]=vertices.get(key);}
 const count=idx?.count??p.count;for(let i=0;i<count;i+=3){const a=root(ids[idx?idx.getX(i):i]);for(let j=1;j<3;j++) parents[root(ids[idx?idx.getX(i+j):i+j])]=a;}
 const groups=new Map();for(let i=0;i<count;i+=3){const a=root(ids[idx?idx.getX(i):i]);if(!groups.has(a))groups.set(a,{indices:[],bounds:new Box3()});const c=groups.get(a);for(let j=0;j<3;j++){const k=idx?idx.getX(i+j):i+j;c.indices.push(k);c.bounds.expandByPoint(v.fromBufferAttribute(p,k).applyMatrix4(mesh.matrixWorld));}}
 return [...groups.values()].map((c,i)=>({...c,id:i,center:c.bounds.getCenter(new Vector3()).toArray(),size:c.bounds.getSize(new Vector3()).toArray()}));
}
