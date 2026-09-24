import {cloneHeadState,surfaceAt,supportedHole} from './HeadWorkpieceState.js';
const eps=1e-7;
// Deterministic tool sweep, all coordinates in mm. No Level targets enter this module.
export function cutHead(state,from,to,tool,{running,rpm,direction=1}={}){
  if(!running||!(rpm>0)||!tool||![...Object.values(from),...Object.values(to),tool.diameterMm].every(Number.isFinite))return state;
  if(tool.type==='milling'){
    const {nx,ny,resolutionMm:r}=state.surface, radius=tool.diameterMm/2;
    const dx=to.xMm-from.xMm,dy=to.yMm-from.yMm,dz=to.zMm-from.zMm;
    let next=null;
    // Exact segment/disk intersection at each surface cell. Frame subdivision cannot
    // change a straight sweep's cut depth, and no fast feed can skip intermediate cells.
    for(let iy=Math.max(0,Math.floor((Math.min(from.yMm,to.yMm)-radius)/r));iy<Math.min(ny,Math.ceil((Math.max(from.yMm,to.yMm)+radius)/r));iy++)
      for(let ix=Math.max(0,Math.floor((Math.min(from.xMm,to.xMm)-radius)/r));ix<Math.min(nx,Math.ceil((Math.max(from.xMm,to.xMm)+radius)/r));ix++){
          const cx=(ix*r+Math.min((ix+1)*r,state.stock.lengthMm))/2,cy=(iy*r+Math.min((iy+1)*r,state.stock.widthMm))/2,i=iy*nx+ix;
          const vx=from.xMm-cx,vy=from.yMm-cy,a=dx*dx+dy*dy,b=2*(vx*dx+vy*dy),c=vx*vx+vy*vy-radius*radius;
          let enter=0,exit=1;
          if(a<1e-20){if(c>0)continue;}else{
            const disc=b*b-4*a*c;if(disc<0)continue;
            enter=Math.max(0,(-b-Math.sqrt(disc))/(2*a));exit=Math.min(1,(-b+Math.sqrt(disc))/(2*a));if(enter>exit)continue;
          }
          const z=Math.max(0,from.zMm+dz*(dz<0?exit:enter));
          let old=state.surface.topMm[i];
          for(const hole of state.features)if(Math.hypot(cx-hole.xMm,cy-hole.yMm)<=hole.diameterMm/2)old=Math.min(old,hole.entryZMm-hole.depthMm);
          if(z<old-eps&&old-z<=tool.cuttingLengthMm){next??=cloneHeadState(state);next.surface.topMm[i]=z;}
        }
    if(next){
      // Subsequent milling must not leave a stale, deeper thread/entry feature.
      for(const hole of next.features){
        let rim=0;for(let j=0;j<32;j++){const angle=j*Math.PI/16,rr=hole.diameterMm/2+r/2;rim=Math.max(rim,surfaceAt(next,hole.xMm+rr*Math.cos(angle),hole.yMm+rr*Math.sin(angle)));}
        const bottom=hole.entryZMm-hole.depthMm,newEntry=Math.min(hole.entryZMm,rim),removed=hole.entryZMm-newEntry;
        hole.entryZMm=newEntry;hole.depthMm=Math.max(0,newEntry-bottom);hole.through=bottom===0;
        if(hole.thread){hole.thread.tappedDepthMm=Math.max(0,hole.thread.tappedDepthMm-removed);if(hole.thread.tappedDepthMm<=eps)delete hole.thread;else if(!supportedHole(next,hole))hole.thread.state='interrupted';}
      }
      next.features=next.features.filter(h=>h.depthMm>eps);
      next.operationHistory.push({type:'milling',toolId:tool.id,from:{...from},to:{...to}});
    }
    return next||state;
  }
  // Drilling/tapping require an axial downward feed; sideways dragging never creates a hole.
  if(to.zMm>=from.zMm-eps||Math.hypot(to.xMm-from.xMm,to.yMm-from.yMm)>eps)return state;
  const existing=state.features.find(h=>h.type==='hole'&&Math.hypot(h.xMm-to.xMm,h.yMm-to.yMm)<eps);
  const entry=existing?.entryZMm??surfaceAt(state,to.xMm,to.yMm),depth=Math.min(entry,entry-to.zMm,tool.cuttingLengthMm);
  if(entry<=0||depth<=eps)return state;
  if(state.features.some(h=>h!==existing&&Math.hypot(h.xMm-to.xMm,h.yMm-to.yMm)<(h.diameterMm+tool.diameterMm)/2))return state;
  // Require a supported pilot circumference; a broken edge hole is not a valid M10 pilot.
  if(!supportedHole(state,{...to,diameterMm:tool.type==='tapping'?tool.pilotDiameterMm:tool.diameterMm}))return state;
  if(tool.type==='tapping'){
    if(direction!==1||!existing||Math.abs(existing.diameterMm-tool.pilotDiameterMm)>eps||from.zMm<existing.entryZMm-existing.depthMm-eps)return state;
    const tappedDepth=Math.min(existing.depthMm,depth);
    if(tappedDepth<=(existing.thread?.tappedDepthMm||0)+eps)return state;
    const next=cloneHeadState(state),hole=next.features.find(h=>h.id===existing.id);
    hole.thread={designation:tool.designation,state:'tapped',tappedDepthMm:tappedDepth,sourceHole:hole.id,pitchMm:null};
    next.operationHistory.push({type:'tapping',toolId:tool.id,holeId:hole.id,from:{...from},to:{...to}});return next;
  }
  if(tool.type!=='drilling'||direction!==1)return state;
  // No teleporting into solid stock; a continuous feed (e.g. a lever already pushed in while the spindle
  // was still spinning up) keeps drilling from where the tip is.
  if(!existing&&from.zMm<entry-eps&&from.zMm-to.zMm>1)return state;
  if(existing&&existing.diameterMm!==tool.diameterMm)return state;
  if(depth<=(existing?.depthMm||0)+eps)return state;
  const next=cloneHeadState(state),hole=existing?next.features.find(h=>h.id===existing.id):{
    id:'hole-'+(next.operationHistory.length+1),type:'hole',xMm:to.xMm,yMm:to.yMm,diameterMm:tool.diameterMm,entryZMm:entry,depthMm:0,through:false};
  hole.depthMm=depth;hole.through=depth>=entry-eps;if(!existing)next.features.push(hole);
  next.operationHistory.push({type:'drilling',toolId:tool.id,holeId:hole.id,from:{...from},to:{...to}});return next;
}
