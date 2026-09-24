// Canonical part coordinates: X from drawing left end, Y across stock, Z up from bottom.
// A sampled top surface supports face/side milling and 2.5D contours, not undercuts.
export function createHeadState({lengthMm,widthMm,heightMm,resolutionMm=0.5}) {
  if(![lengthMm,widthMm,heightMm,resolutionMm].every(n=>Number.isFinite(n)&&n>0))throw new Error('請明確輸入毛胚長、寬、高（mm）');
  const nx=Math.ceil(lengthMm/resolutionMm),ny=Math.ceil(widthMm/resolutionMm);
  if(nx*ny>50000)throw new Error('毛胚超出教學網格容量');
  return {version:1,id:'hammer-head',kind:'prismatic',units:'mm',
    stock:{lengthMm,widthMm,heightMm,status:'user-specified'},
    surface:{resolutionMm,nx,ny,topMm:Array(nx*ny).fill(heightMm)},
    features:[],surfaceMarks:[],operationHistory:[]};
}
export function validateHeadState(s){
  if(s?.version!==1||s.kind!=='prismatic'||s.units!=='mm')throw new Error('Invalid head state');
  const ref=createHeadState({...s.stock,resolutionMm:s.surface?.resolutionMm});
  if(s.surface.nx!==ref.surface.nx||s.surface.ny!==ref.surface.ny||!Array.isArray(s.surface.topMm)||s.surface.topMm.length!==ref.surface.topMm.length||
    !s.surface.topMm.every(h=>Number.isFinite(h)&&h>=0&&h<=s.stock.heightMm)||
    !['features','surfaceMarks','operationHistory'].every(k=>Array.isArray(s[k])))throw new Error('Invalid head geometry');
  for(const h of s.features){
    if(h.type!=='hole'||typeof h.id!=='string'||![h.xMm,h.yMm,h.diameterMm,h.entryZMm,h.depthMm].every(Number.isFinite)||h.diameterMm<=0||h.depthMm<=0||h.depthMm>h.entryZMm||
      (h.thread&&(!Number.isFinite(h.thread.tappedDepthMm)||h.thread.tappedDepthMm<=0||h.thread.tappedDepthMm>h.depthMm||h.thread.sourceHole!==h.id)))throw new Error('Invalid hole feature');
  }
  return s;
}
export const cloneHeadState=s=>JSON.parse(JSON.stringify(validateHeadState(s)));
export function surfaceAt(s,x,y){
  if(x<0||y<0||x>=s.stock.lengthMm||y>=s.stock.widthMm)return 0;
  return s.surface.topMm[Math.floor(y/s.surface.resolutionMm)*s.surface.nx+Math.floor(x/s.surface.resolutionMm)];
}
export function supportedHole(s,h){
  for(let i=0;i<32;i++){const angle=i*Math.PI/16;
    if(surfaceAt(s,h.xMm+h.diameterMm/2*Math.cos(angle),h.yMm+h.diameterMm/2*Math.sin(angle))<=0)return false;}
  return true;
}
export function headBounds(s){
  let minX=Infinity,maxX=0,minY=Infinity,maxY=0,height=0;
  const {nx,topMm,resolutionMm:r}=s.surface;
  topMm.forEach((h,i)=>{if(h>0){const x=i%nx*r,y=Math.floor(i/nx)*r;minX=Math.min(minX,x);maxX=Math.max(maxX,Math.min(x+r,s.stock.lengthMm));minY=Math.min(minY,y);maxY=Math.max(maxY,Math.min(y+r,s.stock.widthMm));height=Math.max(height,h);}});
  return {minX:Number.isFinite(minX)?minX:0,lengthMm:maxX-(Number.isFinite(minX)?minX:0),widthMm:maxY-(Number.isFinite(minY)?minY:0),heightMm:height};
}
