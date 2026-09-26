import { Vector3 } from 'three';
import { isVisibleObject } from '../../machines/runtime.js';
import { RevolvedWorkpiece } from './RevolvedWorkpiece.js';
import { PrismaticWorkpiece } from './PrismaticWorkpiece.js';
import { HeadMachiningAdapter } from './HeadMachiningAdapter.js';
import { LATHE_MACHINING } from '../latheMachining.config.js';
import { cutRevolvedProfile, cutFacing, entersChuck } from '../CuttingSimulation.js';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { createContactMarker } from '../fixtures.js';
import { ChipSystem } from '../Chips.js';
import { WorkpieceRegistry } from '../../workpieces/WorkpieceRegistry.js';
import { createLatheCoordinates, LATHE_AXES, diameterToRadiusMm, finite } from './latheCoordinates.js';

// The v1 scene uses metres. No magnitude-dependent unit inference at this boundary.
export const mmToWorld = mm => finite(mm, 'mm') / 1000;
// Up over the insert and a little toward the operator: coils settle on the tool post and carriage, in view.
const LATHE_THROW = new Vector3(.15, 1, .35).normalize();
export const worldToMm = world => finite(world, 'world') * 1000;
// Compatibility for the existing HTML range controls; their old DOM values remain metres.
export const legacySliderCommand = (axisId, worldValue) => ({
  type: 'machineAxis.set', axisId, valueMm: worldToMm(Number(worldValue)),
});
const AXES = {
  lathe: LATHE_AXES,
  milling: { X: 'X_Axis_Table', Y: 'Y_Axis_Saddle', Z: 'Knee_Z_Slide' },
  drill: { quill: 'quill', table: 'table' },
};

/** Sole machining boundary to v1. No node/runtime references escape its state query. */
export class MachineV1Adapter {
  #machine;
  #coordinates;
  #offsets = {};
  #clock = Symbol('machine-session-clock');
  #disposed = false;
  #calibration = null;
  #machiningMode = 'turning';
  #datum = {X:0,Z:0};
  #events = [];
  #chipSystem = null;
  #cutCount = 0; // material-removal events, for the machining sound
  // Taper attachment: while engaged, every carriage (Z) move drags the cross slide along a guide bar set to
  // angleDeg (taper half-angle from Z; positive = diameter grows toward the chuck), so feeding Z alone cuts a taper.
  #taper = { enabled: false, angleDeg: 3 };
  #dt = 0; // current frame step; 0 for one-off commands
  #unsafe = false;
  constructor(machine, { latheCoordinates = {}, tools = ToolRegistry, workpieces = WorkpieceRegistry } = {}) {
    if (!machine?.runtime || !AXES[machine.id]) throw new Error('A loaded supported machine is required');
    this.#machine = machine;
    this.head = new HeadMachiningAdapter(machine,mmToWorld,worldToMm);
    this.head.onChips = (at, away, travelMm, ignore) => this.#emitChips(at, away, travelMm, ignore);
    this.#coordinates = createLatheCoordinates(latheCoordinates);
    this.tools = tools;
    this.workpieces = workpieces;
    machine.claimUpdateClock(this.#clock);
  }
  get available() { return !this.#disposed && !!this.#machine.runtime; }
  #requireMachine() { if (!this.available) throw new Error('Machine session is disposed or unloaded'); }
  #machineMm() { return Object.fromEntries(Object.entries(this.#machine.getState().offsets).map(([id, value]) => [id, worldToMm(value)])); }
  #axisId(axis) {
    const id = AXES[this.#machine.id][axis];
    if (!id) throw new Error('Unsupported teaching axis: ' + axis);
    return id;
  }
  getState() {
    this.#requireMachine();
    const m = this.#machine, state = m.getState(), machineAxesMm = this.#machineMm();
    const axesMm = Object.fromEntries(Object.entries(AXES[m.id]).map(([axis, id]) => [axis, (machineAxesMm[id] || 0) - (this.#offsets[axis] || 0)]));
    let lathe = null;
    if (m.id === 'lathe') {
      lathe = this.#coordinates.fromMachineMm({ longitudinalMm: machineAxesMm.x, radialMm: machineAxesMm.y }, this.#offsets);
      axesMm.X = lathe.xDiameterMm; axesMm.Z = lathe.zMm;
    }
    const workpiece = m.currentWorkpiece;
    const dimensions = workpiece?.dimensions;
    const dimensionsMm = !dimensions ? null : workpiece.type === 'cylinder'
      ? { radiusMm: worldToMm(dimensions.radius), diameterMm: worldToMm(dimensions.radius * 2), lengthMm: worldToMm(dimensions.lengthMeters) }
      : { widthMm: worldToMm(dimensions.widthMeters), heightMm: worldToMm(dimensions.heightMeters), lengthMm: worldToMm(dimensions.lengthMeters) };
    const { gap, ...warning } = state.safety;
    return {
      id: m.id, name: m.name, units: 'mm', running: state.running, direction: state.direction,
      rpm: state.rpm, requestedRpm: state.targetRpm, targetRpm: state.effectiveTargetRpm,
      spindleAvailable: state.spindleAvailable, spindleAngle: state.spindleAngle,
      leverAngle: state.leverAngle, teaching: m.teaching,
      axesMm, machineAxesMm, lathe, workOffsetsMm: { ...this.#offsets },
      // Depth stop in the same readout (work-offset) coordinates the student sees on the DRO.
      feedStopMm: m.runtime.feedStop ? worldToMm(m.runtime.feedStop.value) - (this.#offsets[m.runtime.feedStop.readout] || 0) : null,
      activeCuttingTool: state.activeCuttingTool,
      cuttingTipMm: this.#cuttingSample()?.position || null,
      machining: this.#machiningState(), headMachining:this.head.state(), cutCount: this.#cutCount,
      workpiece: workpiece ? { id: workpiece.id, name: workpiece.name, type: workpiece.type, dimensionsMm, machinable: workpiece instanceof RevolvedWorkpiece || workpiece instanceof PrismaticWorkpiece } : null,
      hasDemoWorkpiece: !!m.runtime.workpiece && m.runtime.workpieceOwner !== 'module',
      warning: { ...warning, ...(gap === undefined ? {} : { gapMm: Number.isFinite(gap) ? worldToMm(gap) : null }) },
    };
  }
  setMachineAxisMm(axisId, valueMm) {
    this.#requireMachine();
    const headBefore=this.head.sample();
    const before = this.#cuttingSample();
    this.#machine.setAxisPosition(axisId, mmToWorld(valueMm));
    if (axisId === 'x') this.#followTaper(before);
    this.#cut(before, this.#cuttingSample());
    this.head.cut(headBefore,this.head.sample());
  }
  moveAxis({ axis, valueMm, mode = 'absolute', representation }) {
    this.#requireMachine(); finite(valueMm);
    if (!['absolute', 'relative'].includes(mode)) throw new Error('Motion mode must be absolute or relative');
    const m = this.#machine, id = this.#axisId(axis), current = this.#machineMm()[id];
    let target;
    if (m.id === 'lathe' && ['X', 'Z'].includes(axis)) {
      target = this.#coordinates.toMachineMm(axis, valueMm, representation, mode === 'absolute' ? this.#offsets[axis] || 0 : 0);
    } else target = valueMm + (mode === 'absolute' ? this.#offsets[axis] || 0 : 0);
    this.setMachineAxisMm(id, target + (mode === 'relative' ? current : 0));
  }
  setReadout({ axis, valueMm = 0, representation }) {
    this.#requireMachine(); finite(valueMm);
    const m = this.#machine, id = this.#axisId(axis), actual = this.#machineMm()[id];
    if (m.id === 'lathe' && axis === 'X') {
      if (!['diameter', 'radial'].includes(representation)) throw new Error('X requires diameter or radial representation');
      this.#offsets.X = actual * this.#coordinates.radialSign - (representation === 'diameter' ? diameterToRadiusMm(valueMm) : valueMm);
    } else this.#offsets[axis] = actual * (m.id === 'lathe' && axis === 'Z' ? this.#coordinates.longitudinalSign : 1) - valueMm;
  }
  start(direction = 1) {
    this.#requireMachine();
    if (![1, -1].includes(direction)) throw new Error('Direction must be +1 or -1');
    if (!this.#machine.getState().spindleAvailable) throw new Error('Spindle unavailable');
    if (!this.#machine.startSpindle(direction)) throw new Error('Spindle start rejected');
  }
  stop() { this.#machine.stopSpindle(); }
  setSpeed(rpm) {
    this.#requireMachine(); finite(rpm, 'rpm');
    if (rpm < 0 || rpm > this.#machine.config.maxRpm) throw new Error('RPM outside machine range');
    const selectors = this.#machine.config.speedSelectors;
    if (selectors) {
      const pairs = selectors.baseRpm.flatMap((base, gear) => selectors.multipliers.map((factor, mode) => ({ gear, mode, rpm: base * factor })));
      const pair = pairs.find(pair => pair.rpm === rpm);
      if (!pair) throw new Error('RPM must match an available spindle detent');
      this.#machine.setControlDetent(selectors.gear, pair.gear);
      this.#machine.setControlDetent(selectors.mode, pair.mode);
    }
    this.#machine.setSpindleRPM(rpm);
  }
  validateWheel(key, direction) {
    const wheel = this.#machine.config.wheels.find(wheel => wheel.id === key);
    if (!wheel || ![1, -1].includes(direction)) throw new Error('Invalid handwheel command');
    if (wheel.needsCalibration && !this.#machine.teaching) throw new Error('Teaching ratio must be enabled');
  }
  control(type, command) {
    this.#requireMachine(); const m = this.#machine;
    switch (type) {
      case 'teaching.set': m.setTeachingEnabled(command.enabled); break;
      case 'detent.set': {
        const def = m.config.actions?.find(action => action.id === command.key && action.type === 'detent');
        if (!def || !Number.isInteger(command.index) || command.index < 0 || command.index >= def.degrees.length) throw new Error('Invalid detent');
        m.setControlDetent(command.key, command.index); break;
      }
      case 'detent.step': {
        if (!m.config.actions?.some(action => action.id === command.key && action.type === 'detent') || ![1, -1].includes(command.direction)) throw new Error('Invalid detent command');
        m.stepControlDetent(command.key, command.direction); break;
      }
      case 'tool.index': if (![1, -1].includes(command.direction)) throw new Error('Invalid index direction'); m.indexToolPost(command.direction); break;
      // Quill lock: a spring-return feed lever keeps its position (real drill presses have a quill lock).
      // Drill press depth stop: the spring-return lever cannot feed below it. depthMm is a DRO reading.
      case 'feed.stop': {
        if (command.depthMm === null) { m.runtime.feedStop = null; break; }
        const axis = Object.entries(AXES[m.id]).find(([, id]) => id === command.axisId)?.[0];
        if (!axis || !Number.isFinite(command.depthMm)) throw new Error('Invalid depth stop');
        m.runtime.feedStop = { axis: command.axisId, readout: axis, value: mmToWorld(command.depthMm + (this.#offsets[axis] || 0)) };
        break;
      }
      // Continuous handwheel speed while held, scaled by the selected feed step.
      case 'hold.speed': m.runtime.holdSpeedScale = Math.max(0.005, Math.min(3, Number(command.scale) || 1)); break;
      case 'spindle.brake': m.emergencyBrake(); break;
      case 'spindle.releaseBrake': m.releaseEmergencyBrake(); break;
      case 'workpiece.toggleDemo': if (!m.toggleDemoWorkpiece()) throw new Error('Demo workpiece cannot be toggled while running or a modular workpiece is mounted'); break;
      default: throw new Error('Unsupported control: ' + type);
    }
  }
  #requireStopped() {
    this.#requireMachine(); const state = this.#machine.getState();
    if (state.running || state.rpm > 0 || state.leverAngle !== 0) throw new Error('Stop the spindle before changing tools or workpieces');
  }
  async selectTool(id, stillCurrent) {
    this.#requireStopped();
    const def = id === null ? null : this.tools.get(id);
    if (id !== null && (!def || def.type === 'measuring' || (def.compatibleMachines && !def.compatibleMachines.includes(this.#machine.id)))) throw new Error('Unsupported cutting tool for this machine');
    const tool = def ? await this.tools.load(id) : null;
    if (!stillCurrent() || !this.available) { tool?.dispose(); return false; }
    try { this.#requireStopped(); } catch (error) { tool?.dispose(); throw error; }
    this.#restoreCalibration();
    const previous = this.#machine.currentTool;
    if (tool) await this.#machine.mountTool(tool); else await this.#machine.unmountTool();
    previous?.dispose();
    this.head.calibrateTool();
    if (this.#cuttingSample()) this.alignCuttingTip();
    return true;
  }
  exportWorkpieceState() {
    this.#requireMachine();
    if (!(this.#machine.currentWorkpiece instanceof RevolvedWorkpiece) && !(this.#machine.currentWorkpiece instanceof PrismaticWorkpiece)) throw new Error('No machinable workpiece mounted');
    return this.#machine.currentWorkpiece.exportState();
  }
  async mountWorkpieceState(state, stillCurrent) {
    this.#requireStopped();
    if(state?.kind==='prismatic'){
      if(!['milling','drill'].includes(this.#machine.id))throw new Error('Prismatic workpieces require milling/drill');
      const w=new PrismaticWorkpiece(state,mmToWorld);
      if(!stillCurrent()){w.dispose();return false;}
      const previous=this.#machine.currentWorkpiece;
      await this.#machine.mountWorkpiece(w);previous?.dispose();this.#clearChips();
      // Milling: stock lies along the table's long (X) travel so one feed pass covers its length.
      if(this.#machine.id==='milling')w.object3D.rotation.y=Math.PI/2;
      if(this.head.sample())this.head.place(this.head.defaultSetup());else this.head.fitFixture();return true;
    }
    if (this.#machine.id !== 'lathe') throw new Error('Revolved workpieces require a lathe');
    const workpiece = new RevolvedWorkpiece(state, mmToWorld);
    if (!stillCurrent()) { workpiece.dispose(); return false; }
    const previous = this.#machine.currentWorkpiece;
    await this.#machine.mountWorkpiece(workpiece); this.#clearChips();
    this.#datum = {X:0,Z:0}; this.#machiningMode = 'turning'; this.#unsafe = false;
    if (this.#cuttingSample()) this.alignCuttingTip();
    previous?.dispose(); return true;
  }
  // Physical tip expressed in a non-spinning workpiece frame, independent of UI work offsets.
  // The v1 workpiece's local +X is teaching Z; transverse U/V retain tool height information.
  #cuttingSample() {
    const m = this.#machine, workpiece = m.currentWorkpiece;
    if (m.id !== 'lathe' || !(workpiece instanceof RevolvedWorkpiece)) return null;
    const active = m.getActiveCuttingTool();
    if (active?.type !== 'turning') return null;
    const root = active.source === 'module' ? m.currentTool.object3D : m.runtime.lookup[active.id];
    if (!root || !isVisibleObject(root)) return null;
    let insert = null;
    root.traverse(node => { if (node.userData.cuttingEdge?.version === 1 && node.userData.cuttingEdge.units === 'world' && isVisibleObject(node)) insert = node; });
    // Imported tools need an explicit tip calibration; never fall back to a bounding-box guess.
    if (!insert) return null;
    m.rootScene.updateWorldMatrix(true, true);
    const scenePoint = point => m.rootScene.worldToLocal(point);
    const origin = scenePoint(workpiece.object3D.localToWorld(new Vector3()));
    const axis = scenePoint(workpiece.object3D.localToWorld(new Vector3(1, 0, 0))).sub(origin).normalize();
    const u = new Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
    const v = new Vector3().crossVectors(axis, u).normalize();
    const world = insert.localToWorld(new Vector3().fromArray(insert.userData.cuttingEdge.tip));
    const point = scenePoint(world.clone()).sub(origin);
    const mm = value => Math.round(worldToMm(value) * 1e9) / 1e9 || 0;
    return { toolId: active.id, rpm: m.runtime.rpm, world,
      position: { zMm: mm(point.dot(axis)), uMm: mm(point.dot(u)), vMm: mm(point.dot(v)) } };
  }
  #cut(before, after) {
    if (!after || !before || before.toolId !== after.toolId) return;
    // On the first rotating frame, contact at the final tip only; no sweep through a stopped move.
    const from = before.rpm > 0 ? before.position : after.position;
    const workpiece=this.#machine.currentWorkpiece;
    const danger=workpiece.inspect(state=>this.#danger(state));
    const unsafe=entersChuck(before.position,after.position,danger);
    if (unsafe && !this.#unsafe) this.#events.push({type:'unsafe',code:'chuck-collision',
      sequence:(this.#events.at(-1)?.sequence||0)+1,toolId:after.toolId,from:{...before.position},to:{...after.position}});
    this.#events=this.#events.slice(-100); this.#unsafe=unsafe;
    if (unsafe) return;
    const removed = workpiece.cut(state => (this.#machiningMode==='facing'?cutFacing:cutRevolvedProfile)(state, from, after.position,
      { rpm: before.rpm > 0 ? before.rpm : after.rpm, toolId: after.toolId, facing:LATHE_MACHINING.facing }));
    // Lathe chips curl off the tip toward the operator.
    if (removed) {
      // Chips pass through the spinning stock and the tool, and land on the carriage, bed or deck.
      const m = this.#machine, active = m.getActiveCuttingTool(), toolRoot = active?.source === 'module' ? m.currentTool?.object3D : m.runtime.lookup[active?.id];
      this.#emitChips(after.world, LATHE_THROW, Math.hypot(after.position.zMm - from.zMm, after.position.vMm - from.vMm), [workpiece.object3D, toolRoot].filter(Boolean));
    }
  }
  #chips() { return this.#chipSystem ??= new ChipSystem(this.#machine.rootScene, this.#machine.id); }
  // [chips per second while cutting on a held handwheel, mm of tool travel per chip] for each machine.
  static #CHIP_RATE = { lathe: [10, 4], milling: [20, 1.2], drill: [10, 1.2] };
  #emitChips(at, away, travelMm, ignore) {
    if (!at) return;
    this.#cutCount++;
    const [perSecond, mmPerChip] = MachineV1Adapter.#CHIP_RATE[this.#machine.id] || MachineV1Adapter.#CHIP_RATE.lathe;
    this.#chips().emit(at, away, Math.max(perSecond * this.#dt, travelMm / mmPerChip), ignore);
  }
  #clearChips() { this.#chipSystem?.clear(); }
  #danger(state) {
    return {...LATHE_MACHINING.chuckDanger,endZMm:state.clamping.endZMm};
  }
  #restoreCalibration() {
    if (this.#calibration) this.#calibration.root.position.copy(this.#calibration.position);
    this.#calibration=null;
  }
  alignCuttingTip() {
    this.#requireStopped();
    this.#restoreCalibration();
    const sample=this.#cuttingSample();
    if (!sample) throw new Error('Active tool has no calibrated turning edge');
    const m=this.#machine,active=m.getActiveCuttingTool();
    const root=active.source==='module'?m.currentTool.object3D:m.runtime.lookup[active.id];
    this.#calibration={root,position:root.position.clone()};
    // Move the actual procedural tool assembly, not just its reported tip / virtual offset.
    const point=m.rootScene.worldToLocal(root.getWorldPosition(new Vector3()));
    point.y-=mmToWorld(sample.position.uMm);
    root.position.copy(root.parent.worldToLocal(m.rootScene.localToWorld(point)));
    m.rootScene.updateWorldMatrix(true,true);
  }
  // Visual contact cue only: a glowing ring where the tip touches (amber) or cuts (orange).
  #updateContactMarkers() {
    const wp = this.#machine.currentWorkpiece;
    if (wp instanceof PrismaticWorkpiece) { this.head.updateMarker(); return; }
    if (!(wp instanceof RevolvedWorkpiece)) return;
    const m = this.#machiningState();
    let ring = wp.object3D.getObjectByName('ContactMarker');
    if (!ring) { ring = createContactMarker(); wp.object3D.add(ring); }
    const level = m?.contact && !m.unsafe ? (this.#machine.runtime.rpm > 0 ? 2 : 1) : 0;
    ring.userData.setLevel(level);
    if (level) {
      ring.position.set(mmToWorld(m.physicalZMm), 0, 0); ring.rotation.set(0, Math.PI / 2, 0);
      ring.scale.setScalar(mmToWorld(m.diameterAtTipMm / 2 + 0.3));
    }
  }
  setTaperAttachment({ enabled, angleDeg = this.#taper.angleDeg }) {
    if (this.#machine.id !== 'lathe') throw new Error('錐度靠模只用於車床');
    finite(angleDeg, 'angleDeg');
    if (Math.abs(angleDeg) > 10) throw new Error('錐度靠模角度限 ±10°');
    this.#taper = { enabled: !!enabled, angleDeg };
  }
  // The tip's Z change since `before` moves the cross slide by −ΔZ·tanθ radially (a single straight sweep, so
  // the following #cut removes a true taper). Held at the cross-slide travel limit; X jogs still add depth on top.
  #followTaper(before) {
    const taper = this.#taper;
    if (!taper.enabled || !before) return;
    const after = this.#cuttingSample();
    if (!after || after.toolId !== before.toolId) return;
    const dz = after.position.zMm - before.position.zMm;
    if (Math.abs(dz) < 1e-9) return;
    const radial = -dz * Math.tan(taper.angleDeg * Math.PI / 180);
    const [low, high] = this.#machine.config.axes.find(a => a.id === 'y').range.map(worldToMm);
    // Same convention as moveMachiningAxis: +radial is −machine y.
    this.#machine.setAxisPosition('y', mmToWorld(Math.max(low, Math.min(high, this.#machineMm().y - radial))));
  }
  setMachiningMode(mode) {
    if (!['turning','facing'].includes(mode)) throw new Error('Unsupported cutting mode');
    this.#machiningMode=mode;
  }
  #machiningState() {
    const wp=this.#machine.currentWorkpiece;
    if (!(wp instanceof RevolvedWorkpiece)) return null;
    const sample=this.#cuttingSample(),p=sample?.position;
    return wp.inspect(state=>{
      const index=p?Math.min(state.profile.radiusMm.length-1,Math.floor(p.zMm/state.profile.resolutionMm)):-1;
      const atStock=p && p.zMm>=0 && p.zMm<=state.lengthMm;
      const radius=atStock?state.profile.radiusMm[index]:null;
      const protectedZone=!!p && p.zMm<=state.clamping.endZMm;
      const unsafe=!!p && entersChuck(p,p,this.#danger(state));
      const x=p?p.vMm:null; // the tip works on the operator (+v) side of the axis
      return {mode:this.#machiningMode, taperAttachment:{...this.#taper}, lengthMm:state.lengthMm, clamping:{...state.clamping},
        facingMaxDepthMm:LATHE_MACHINING.facing.maxDepthMm,
        centerAligned:!!p && Math.abs(p.uMm)<=LATHE_MACHINING.facing.centerToleranceMm,
        heightErrorMm:p?.uMm??null, xRadialMm:x, xDiameterMm:p?2*(x-this.#datum.X):null,
        zMm:p?p.zMm-this.#datum.Z:null, physicalZMm:p?.zMm??null, datumMm:{...this.#datum},
        contact:!!p && !!atStock && !protectedZone && Math.hypot(p.uMm,p.vMm)<=radius+1e-7,
        diameterAtTipMm:radius===null?null:radius*2, unsafe, events:this.#events.map(event=>({...event,from:{...event.from},to:{...event.to}}))};
    });
  }
  moveMachiningAxis({axis,valueMm,representation,mode='absolute'}) {
    finite(valueMm); if (!['absolute','relative'].includes(mode)) throw new Error('Invalid motion mode');
    const p=this.#cuttingSample()?.position;
    if (!p || !['X','Z'].includes(axis)) throw new Error('A mounted profile and turning edge are required');
    if (axis==='X' && !['diameter','radial'].includes(representation)) throw new Error('X requires diameter or radial representation');
    const value=axis==='X' && representation==='diameter'?diameterToRadiusMm(valueMm):valueMm;
    const actual=axis==='X'?p.vMm:p.zMm;
    const delta=mode==='relative'?value:value+this.#datum[axis]-actual;
    const id=axis==='X'?'y':'x', sign=axis==='X'?-1:1;
    const target=this.#machineMm()[id]+sign*delta;
    const limits=this.#machine.config.axes.find(a=>a.id===id).range.map(worldToMm);
    if (target<limits[0]-1e-7 || target>limits[1]+1e-7) throw new Error('Requested tip position exceeds machine travel');
    this.setMachineAxisMm(id,target);
  }
  // One physical linear sweep, not two axis-aligned cuts. Coordinates are work X diameter / Z, mm.
  moveMachiningLine({xDiameterMm,zMm}) {
    finite(xDiameterMm);finite(zMm);
    const before=this.#cuttingSample();
    if(!before)throw new Error('A mounted profile and turning edge are required');
    const axes=this.#machineMm();
    const targets={y:axes.y-(xDiameterMm/2+this.#datum.X-before.position.vMm),
      x:axes.x+zMm+this.#datum.Z-before.position.zMm};
    for(const [id,value] of Object.entries(targets)) {
      const limits=this.#machine.config.axes.find(a=>a.id===id).range.map(worldToMm);
      if(value<limits[0]-1e-7||value>limits[1]+1e-7)throw new Error('Requested tip position exceeds machine travel');
    }
    for(const [id,value] of Object.entries(targets))this.#machine.setAxisPosition(id,mmToWorld(value));
    this.#cut(before,this.#cuttingSample());
  }
  setMachiningDatum({axis,valueMm=0,representation}) {
    finite(valueMm); const p=this.#cuttingSample()?.position;
    if (!p || !['X','Z'].includes(axis)) throw new Error('No machining coordinate frame');
    if (axis==='X' && !['diameter','radial'].includes(representation)) throw new Error('X requires diameter or radial representation');
    this.#datum[axis]=(axis==='X'?p.vMm:p.zMm)-(axis==='X' && representation==='diameter'?valueMm/2:valueMm);
  }
  clearMachiningDatum() {
    this.#requireMachine();
    this.#datum = {X:0,Z:0};
  }
  async mountWorkpiece(spec, stillCurrent) {
    this.#requireStopped();
    if (typeof spec !== 'string') {
      if (!spec || !['cylinder', 'block'].includes(spec.type) || (spec.units !== undefined && spec.units !== 'mm')) throw new Error('Session workpiece specs must use mm');
      for (const key of spec.type === 'cylinder' ? ['diameter', 'length'] : ['width', 'height', 'length']) {
        if (!Number.isFinite(spec[key]) || spec[key] <= 0) throw new Error('Required positive dimension in mm: ' + key);
      }
    }
    const workpiece = await this.workpieces.load(typeof spec === 'string' ? spec : { ...spec, units: 'mm' });
    if (!stillCurrent() || !this.available) { workpiece.dispose(); return false; }
    try { this.#requireStopped(); } catch (error) { workpiece.dispose(); throw error; }
    this.#restoreCalibration();
    const previous = this.#machine.currentWorkpiece;
    await this.#machine.mountWorkpiece(workpiece);
    previous?.dispose(); return true;
  }
  async unmountWorkpiece(stillCurrent) {
    this.#requireStopped(); if (!stillCurrent()) return false;
    this.#restoreCalibration();
    const workpiece = await this.#machine.unmountWorkpiece(); workpiece?.dispose(); this.#clearChips(); return true;
  }
  reset() {
    this.#clearChips();
    const headPosition=this.head.workpiece?.object3D.position.clone();
    this.#requireMachine(); this.#restoreCalibration(); this.#machine.reset();
    if(headPosition)this.head.workpiece.object3D.position.copy(headPosition);
    this.head.calibrateTool();
    this.#machine.setTeachingEnabled(false); this.#offsets = {}; this.#datum = {X:0,Z:0};
    this.#unsafe=false; this.#taper = { ...this.#taper, enabled: false };
    if (this.#cuttingSample()) this.alignCuttingTip();
  }
  step(dt, heldControl) {
    if (!this.available) return false;
    const headBefore=this.head.sample();
    const before = this.#cuttingSample();
    const active = this.#machine.step(dt, { owner: this.#clock, heldControl });
    this.#followTaper(before);
    this.#dt = dt;
    if (dt > 0) this.#cut(before, this.#cuttingSample());
    if (dt > 0) this.head.cut(headBefore,this.head.sample());
    this.#dt = 0;
    this.#chipSystem?.update(dt);
    this.#updateContactMarkers();
    // Keep the on-demand frame loop alive while chips are still flying.
    return active || !!this.#chipSystem?.moving;
  }
  dispose() {
    if (this.#disposed) return;
    this.#chipSystem?.dispose(); this.#chipSystem = null;
    this.#restoreCalibration(); this.stop(); this.#machine.releaseUpdateClock(this.#clock); this.#disposed = true;
  }
}
