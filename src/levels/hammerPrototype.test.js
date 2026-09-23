import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttempt, advanceAttempt, cutProfile, blankProfile, HAMMER_LEVELS, validateSave} from './hammerPrototype.js';
test('swept cuts only remove material inside this level and never restore it', () => {
 const level = HAMMER_LEVELS[0];
 const cut = cutProfile(blankProfile(), 110, 30, 10, level);
 assert.equal(cut[20], 12); assert.equal(cut[100], 10); assert.equal(cut[260], 12);
 assert.deepEqual(cutProfile(cut, 110, 30, 11, level), cut);
});
test('feed clamps exactly at the endpoint and completes only after spindle stop', () => {
 let state = {...createAttempt(), phase: 'running', zero: 110};
 for(let i=0;i<2000 && state.phase!=='complete';i++) state=advanceAttempt(state, 0.02);
 assert.equal(state.phase, 'complete'); assert.equal(state.position, 30); assert.equal(state.rpm, 0);
 assert.equal(state.profile[60], 10); assert.equal(state.profile[220], 10);
});
test('stationary cutting leaves bounded marks; pause cannot continue cutting', () => {
 let state = {...createAttempt(), phase:'running', rpm:600, feedEnabled:false};
 for(let i=0;i<200;i++) state=advanceAttempt(state, 0.1);
 assert.equal(state.position,110); assert.equal(state.marks.length,1); assert.equal(state.marks[0].severity,1);
 assert.equal(state.profile[220],10);
 const paused={...state,phase:'paused'}; assert.equal(advanceAttempt(paused,1),paused);
});
test('second level inherits a copy and retry snapshot remains unchanged', () => {
 const profile=cutProfile(blankProfile(),110,30,10,HAMMER_LEVELS[0]);
 const initial=createAttempt(1,profile,[{position:50,severity:0.3}]);
 let state={...initial,phase:'running',rpm:600};
 for(let i=0;i<200;i++) state=advanceAttempt(state,0.1);
 assert.equal(state.profile[100],10); assert.equal(state.profile[250],8);
 assert.equal(initial.profile[250],12); assert.equal(profile[250],12);
 assert.equal(state.marks[0].position,50);
});
test('malformed or incompatible saved data is rejected', () => {
 const valid={version:1,completedLevel:0,profile:blankProfile(),marks:[]};
 assert.equal(validateSave(valid),true);
 for(const bad of [null,{}, {...valid,version:2}, {...valid,profile:[12]}, {...valid,marks:[{position:Infinity,severity:1}]}]) assert.equal(validateSave(bad),false);
});
