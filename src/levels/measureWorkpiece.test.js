import test from 'node:test';
import assert from 'node:assert/strict';
import { measureWorkpiece } from './measureWorkpiece.js';
import { defineLevel } from './LevelDefinition.js';
import { LEVEL_1 } from './level1.js';
import { createHandleState } from '../machining/WorkpieceState.js';
import { drawingZToCoordinates } from './hammerDrawingSpec.js';
// These ranges, final lengths and tolerances are synthetic test inputs, not drawing values.
const targets={status:'confirmed',diameterMm:16.3,diameterToleranceMm:0.05,machiningZRange:[200,210],finalLengthMm:299,lengthToleranceMm:0.1};
function specimen(diameter=16.3) {
  const s=createHandleState();s.lengthMm=299;s.profile.radiusMm.length=598;
  for(let i=400;i<420;i++)s.profile.radiusMm[i]=diameter/2;
  return s;
}
test('radius 8.15 measures diameter 16.3 using profile only, without history or UI values; no mutations',()=>{
  const s=specimen(),before=JSON.stringify(s),m=measureWorkpiece(s,targets);
  assert.deepEqual(m.diameter.actual,{minMm:16.3,maxMm:16.3});assert.deepEqual(m.diameter.error,{minMm:0,maxMm:0});
  assert.equal(m.status,'pass');assert.equal(m.diameter.coverageMm,10);assert.equal(m.length.actualMm,299);
  assert.equal(JSON.stringify(s),before);
});
test('every overlapping cell is inspected; a single uncut or boundary cell prevents passing',()=>{
  const s=specimen();s.profile.radiusMm[410]=10;
  let m=measureWorkpiece(s,targets);assert.equal(m.status,'fail');assert.equal(m.diameter.actual.maxMm,20);
  assert.equal(m.diameter.status,'not-yet-to-size');
  m=measureWorkpiece(s,{...targets,machiningZRange:[205.25,205.75]});
  assert.equal(m.diameter.status,'not-yet-to-size');assert.equal(m.diameter.coverageMm,0.5);
  const onePoint=createHandleState();onePoint.profile.radiusMm[400]=8.15;
  assert.equal(measureWorkpiece(onePoint,targets).status,'fail');
});
test('Z end is exclusive, outside cuts do not substitute for required range, and missing tail cannot pass',()=>{
  const s=specimen();s.profile.radiusMm[420]=5;
  assert.equal(measureWorkpiece(s,targets).status,'pass');
  assert.equal(measureWorkpiece(s,{...targets,machiningZRange:[220,230]}).diameter.status,'not-yet-to-size');
  const missing=measureWorkpiece(s,{...targets,finalLengthMm:300,lengthToleranceMm:2,machiningZRange:[298,300]});
  assert.equal(missing.diameter.fullCoverage,false);assert.equal(missing.diameter.coverageMm,1);
  assert.equal(missing.diameter.status,'incomplete-range');assert.equal(missing.status,'fail');
  const absent=measureWorkpiece(s,{...targets,finalLengthMm:300,machiningZRange:[299,300]});
  assert.equal(absent.diameter.actual,null);assert.equal(absent.status,'fail');
});
test('tolerance boundaries are inclusive; below nominal is distinct from actual overcut',()=>{
  for(const value of [16.25,16.3,16.35])assert.equal(measureWorkpiece(specimen(value),targets).diameter.status,'within-tolerance');
  const low=measureWorkpiece(specimen(16.28),targets);
  assert.equal(low.diameter.relation,'under-target');assert.equal(low.overcut,false);assert.equal(low.status,'pass');
  assert.equal(measureWorkpiece(specimen(16.249),targets).diameter.status,'overcut');
  assert.equal(measureWorkpiece(specimen(16.351),targets).diameter.status,'not-yet-to-size');
  assert.equal(measureWorkpiece(specimen(16.2999999),{...targets,diameterToleranceMm:0}).diameter.status,'overcut');
});
test('mixed oversize/overcut retains extremes and signed errors rather than hiding them in an average',()=>{
  const s=specimen();s.profile.radiusMm[400]=8;s.profile.radiusMm[401]=10;
  const before=JSON.stringify(s),m=measureWorkpiece(s,targets);
  assert.equal(m.diameter.status,'overcut');assert.equal(m.diameter.relation,'mixed');assert.equal(m.overcut,true);
  assert.ok(m.diameter.error.minMm<0);assert.ok(m.diameter.error.maxMm>0);assert.equal(JSON.stringify(s),before);
});
test('actual length uses geometry length; too short is overcut and too long is unfinished',()=>{
  assert.equal(measureWorkpiece(specimen(),{...targets,finalLengthMm:299.1}).length.status,'within-tolerance');
  const short=measureWorkpiece(specimen(),{...targets,finalLengthMm:299.2});
  assert.equal(short.length.status,'overcut');assert.equal(short.overcut,true);assert.ok(short.length.errorMm<0);
  assert.equal(measureWorkpiece(specimen(),{...targets,finalLengthMm:298.8}).length.status,'not-yet-to-size');
});
test('draft targets, absent ranges and unknown tolerance never fall back to a point or whole stock pass',()=>{
  const s=specimen(),m=measureWorkpiece(s,LEVEL_1.targets);
  assert.equal(m.status,'draft');assert.equal(m.diameter.actual,null);assert.equal(m.diameter.machiningZRange,null);
  assert.equal(m.diameter.error,null);assert.equal(m.length.errorMm,59);assert.equal(m.overcut,null);
  assert.deepEqual(m.observedCutDiameter,{minMm:16.3,maxMm:16.3});
  assert.equal(measureWorkpiece(s,{...targets,status:'draft'}).status,'draft');
  for(const key of ['diameterMm','diameterToleranceMm','machiningZRange','finalLengthMm','lengthToleranceMm']) {
    assert.equal(measureWorkpiece(s,{...targets,status:'draft',[key]:null}).status,'draft');
    assert.throws(()=>defineLevel({...LEVEL_1,targets:{...targets,[key]:null}}));
  }
  for(const tolerance of [-1,NaN,Infinity])assert.throws(()=>measureWorkpiece(s,{...targets,diameterToleranceMm:tolerance}));
  for(const range of [[210,200],[200,200],[0,210],[200,301]])assert.throws(()=>measureWorkpiece(s,{...targets,machiningZRange:range}));
});

test('confirmed criteria evaluate independently; unknown criteria never count as accepted',()=>{
  const confirmation={diameterMm:'confirmed',diameterToleranceMm:'confirmed',machiningZRange:'confirmed',finalLengthMm:'unknown',lengthToleranceMm:'unknown'};
  const partial={...targets,status:'draft',finalLengthMm:null,lengthToleranceMm:null,confirmation};
  let m=measureWorkpiece(specimen(),partial);
  assert.equal(m.diameter.status,'within-tolerance');assert.equal(m.status,'draft');assert.equal(m.pending,true);assert.equal(m.overcut,null);
  m=measureWorkpiece(specimen(16),partial);
  assert.equal(m.status,'fail');assert.equal(m.overcut,true);assert.equal(m.length.status,'draft');
  const lengthOnly={...LEVEL_1.targets,lengthToleranceMm:0.1,confirmation:{...LEVEL_1.targets.confirmation,lengthToleranceMm:'confirmed'}};
  m=measureWorkpiece(specimen(),lengthOnly);
  assert.equal(m.length.status,'not-yet-to-size');assert.equal(m.length.errorMm,59);assert.equal(m.status,'fail');
  const stock=createHandleState();stock.lengthMm=240;stock.profile.radiusMm.length=480;
  m=measureWorkpiece(stock,lengthOnly);assert.equal(m.length.status,'within-tolerance');assert.equal(m.status,'draft');
  assert.throws(()=>measureWorkpiece(stock,{...partial,confirmation:{...confirmation,machiningZRange:'unknown',diameterMm:'typo'}}));
});

test('drawing placement and player zero are explicit, independent of 300 mm blank',()=>{
  // Synthetic chosen orientation, NOT an approved machining range for Level 1.
  const placement={datumPhysicalZMm:240,direction:-1,workZeroPhysicalZMm:300};
  assert.deepEqual(drawingZToCoordinates(20,placement),{physicalZMm:220,workZMm:-80});
  assert.deepEqual(drawingZToCoordinates(120,placement),{physicalZMm:120,workZMm:-180});
  assert.deepEqual(drawingZToCoordinates(20,{...placement,workZeroPhysicalZMm:240}),{physicalZMm:220,workZMm:-20});
  assert.throws(()=>drawingZToCoordinates(20,{direction:-1,workZeroPhysicalZMm:300}));
  assert.equal(LEVEL_1.targets.finalLengthMm,240);assert.equal(LEVEL_1.targets.machiningZRange,null);
});
