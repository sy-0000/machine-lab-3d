import { validateWorkpieceState } from '../machining/WorkpieceState.js';
export function measureTaper(stock,{rangeMm,largeDiameterMm,smallDiameterMm,toleranceMm=null,toleranceStatus='unknown',status='confirmed'}) {
  validateWorkpieceState(stock);
  if(!Array.isArray(rangeMm)||rangeMm.length!==2||!rangeMm.every(Number.isFinite)||rangeMm[1]<=rangeMm[0]||
    ![largeDiameterMm,smallDiameterMm].every(n=>Number.isFinite(n)&&n>0)||
    (toleranceMm!==null&&(!Number.isFinite(toleranceMm)||toleranceMm<0)))throw new Error('Invalid taper target');
  const [start,end]=rangeMm,step=stock.profile.resolutionMm;
  const expected=z=>largeDiameterMm+(smallDiameterMm-largeDiameterMm)*(z-start)/(end-start);
  const cells=stock.profile.radiusMm.flatMap((r,i)=>{
    const a=Math.max(start,i*step),b=Math.min(end,(i+1)*step,stock.lengthMm);
    if(b<=a)return [];
    // Piecewise constant geometry: measure both cell edges, never hide stair-step error.
    return [{a,b,diameter:2*r,errors:[2*r-expected(a),2*r-expected(b)]}];
  });
  const errors=cells.flatMap(c=>c.errors),coverageMm=cells.reduce((n,c)=>n+c.b-c.a,0);
  const minErrorMm=errors.length?Math.min(...errors):null,maxErrorMm=errors.length?Math.max(...errors):null;
  const ready=status==='confirmed'&&toleranceStatus==='confirmed'&&toleranceMm!==null;
  const complete=Math.abs(coverageMm-(end-start))<1e-7&&start>=stock.clamping.endZMm;
  const overcut=ready&&errors.length?minErrorMm < -toleranceMm-1e-9:null;
  return {rangeMm:[...rangeMm],targetLengthMm:end-start,coverageMm,largeDiameterMm:cells[0]?.diameter??null,
    smallDiameterMm:cells.at(-1)?.diameter??null,minErrorMm,maxErrorMm,
    linearDeviationMm:errors.length?Math.max(...errors.map(Math.abs)):null,toleranceMm,overcut,
    status:!ready?'draft':!complete?'incomplete-range':overcut?'overcut':maxErrorMm>toleranceMm+1e-9?'not-yet-to-size':'within-tolerance'};
}
