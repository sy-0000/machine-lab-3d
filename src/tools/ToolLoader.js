import {
  Group,
  Mesh,
  BoxGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
} from 'three';
import { buildEndMill, buildTwistDrill, buildTap, createTurningInsert } from './toolGeometry.js';
import { ToolBase } from './ToolBase.js';

function buildTurningToolProcedural(group, def) {
  const silverSteel = new MeshStandardMaterial({ color: '#dce3ea', metalness: 0.88, roughness: 0.22 });
  const shimSteel = new MeshStandardMaterial({ color: '#b0b8c0', metalness: 0.85, roughness: 0.32 });

  // Shim
  const shim = new Mesh(new BoxGeometry(0.145, 0.008, 0.022), shimSteel);
  shim.position.set(-0.015, -0.015, 0);
  group.add(shim);

  // Shank
  const shank = new Mesh(new BoxGeometry(0.165, 0.018, 0.018), silverSteel);
  shank.position.set(-0.055, 0, 0);
  group.add(shank);

  // Straight head overlaps the shank and supports the insert.
  const head = new Mesh(new BoxGeometry(0.064, 0.018, 0.018), silverSteel);
  head.position.set(-0.166, 0, 0);
  group.add(head);

  // 80° rhombic carbide insert with centre screw; same cutting corner as before.
  const insert = createTurningInsert({ radius: 0.0118, height: 0.0042 });
  insert.rotation.y = -Math.PI / 2;
  insert.position.set(-0.195, 0.009 + 0.0042 / 2, 0);
  group.add(insert);
}

function buildThreadingToolProcedural(group, def) {
  const silverSteel = new MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.25 });
  const goldInsert = new MeshStandardMaterial({ color: '#dfb738', metalness: 0.85, roughness: 0.24 });
  const darkSteel = new MeshStandardMaterial({ color: '#2b3137', metalness: 0.8, roughness: 0.4 });

  const shank = new Mesh(new BoxGeometry(0.165, 0.018, 0.018), silverSteel);
  shank.position.set(-0.055, 0, 0);
  group.add(shank);

  // 60-degree threading tip
  const insert = new Mesh(new CylinderGeometry(0.01, 0.01, 0.004, 3), goldInsert);
  insert.rotation.y = Math.PI / 6;
  insert.position.set(-0.19, 0.009, 0);
  group.add(insert);

  const clamp = new Mesh(new BoxGeometry(0.02, 0.005, 0.012), darkSteel);
  clamp.position.set(-0.175, 0.013, 0);
  group.add(clamp);
}

function buildKnurlingToolProcedural(group, def) {
  const steel = new MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.3 });
  const knurlMat = new MeshStandardMaterial({ color: '#475569', metalness: 0.85, roughness: 0.2 });

  const shank = new Mesh(new BoxGeometry(0.14, 0.02, 0.02), steel);
  shank.position.set(-0.05, 0, 0);
  group.add(shank);

  const fork = new Mesh(new BoxGeometry(0.04, 0.04, 0.022), steel);
  fork.position.set(-0.13, 0, 0);
  group.add(fork);

  for (const yOffset of [-0.012, 0.012]) {
    const wheel = new Mesh(new CylinderGeometry(0.01, 0.01, 0.008, 24), knurlMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(-0.155, yOffset, 0);
    group.add(wheel);
  }
}

function buildFaceMillProcedural(group, def) {
  const toolSteel = new MeshStandardMaterial({ color: '#c2cbd2', metalness: 0.88, roughness: 0.25 });
  const darkColletMat = new MeshStandardMaterial({ color: '#323a40', metalness: 0.8, roughness: 0.35 });
  const flangeMat = new MeshStandardMaterial({ color: '#a4adb5', metalness: 0.85, roughness: 0.28 });
  const insertGold = new MeshStandardMaterial({ color: '#dfb738', metalness: 0.85, roughness: 0.24 });

  const shank = new Mesh(new CylinderGeometry(0.016, 0.016, 0.024, 32), darkColletMat);
  shank.position.y = -0.012;
  group.add(shank);

  const flange = new Mesh(new CylinderGeometry(0.025, 0.025, 0.01, 32), flangeMat);
  flange.position.y = -0.029;
  group.add(flange);

  const cutterBody = new Mesh(new CylinderGeometry(0.02, 0.028, 0.02, 32), toolSteel);
  cutterBody.position.y = -0.056;
  group.add(cutterBody);

  const insertCount = 4, insertRadius = 0.0255;
  for (let i = 0; i < insertCount; i++) {
    const a = (i * Math.PI * 2) / insertCount;
    const insertGroup = new Group();
    insertGroup.position.set(insertRadius * Math.cos(a), -0.063, insertRadius * Math.sin(a));
    insertGroup.rotation.y = a;

    const insert = new Mesh(new BoxGeometry(0.0078, 0.0078, 0.0035), insertGold);
    insert.rotation.z = -0.12;
    insert.rotation.x = 0.15;
    insertGroup.add(insert);
    group.add(insertGroup);
  }
}

export class ToolLoader {
  /**
   * Load or construct a 3D Tool instance from a tool definition.
   * @param {Object} toolDef
   * @returns {Promise<ToolBase>}
   */
  static async load(toolDef) {
    if (!toolDef || !toolDef.id) {
      throw new Error(`無效的刀具定義：${JSON.stringify(toolDef)}`);
    }

    const group = new Group();
    group.name = `Tool_${toolDef.id}`;

    // Procedural only: no tool GLBs ship with the site.
    const loadedFromGLB = false;
    const dims = toolDef.dimensions || {};
    const axial = { radius: dims.radius || 0.006, shankLength: dims.shankLength || 0.025, cuttingLength: dims.cuttingLength || 0.049 };
    switch (toolDef.id) {
      case 'turning_tool': buildTurningToolProcedural(group, toolDef); break;
      case 'threading_tool': buildThreadingToolProcedural(group, toolDef); break;
      case 'knurling_tool': buildKnurlingToolProcedural(group, toolDef); break;
      case 'face_mill': buildFaceMillProcedural(group, toolDef); break;
      default:
        if (toolDef.type === 'tapping') buildTap(group, axial, toolDef.id);
        else if (toolDef.type === 'drilling') buildTwistDrill(group, axial, toolDef.id);
        else if (toolDef.type === 'milling') buildEndMill(group, axial, toolDef.id);
        else buildTurningToolProcedural(group, toolDef);
    }

    // Explicit procedural axial cutting reference; imported GLBs never get guessed tips.
    if(!loadedFromGLB && ['milling','drilling','tapping'].includes(toolDef.type) && toolDef.id!=='face_mill'){
      group.userData.axialCuttingEdge={units:'world',tip:[0,-(toolDef.dimensions.shankLength+toolDef.dimensions.cuttingLength),0],
        diameterMm:toolDef.dimensions.radius*2000,cuttingLengthMm:toolDef.dimensions.cuttingLength*1000,
        type:toolDef.type,id:toolDef.id,designation:toolDef.designation,pilotDiameterMm:toolDef.pilotDiameterMm};
    }
    // Enable shadows on all tool meshes
    group.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return new ToolBase({
      id: toolDef.id,
      name: toolDef.name,
      type: toolDef.type,
      object3D: group,
      dimensions: toolDef.dimensions,
      metadata: {
        compatibleMachines: toolDef.compatibleMachines,
        operations: toolDef.operations,
        description: toolDef.description,
        loadedFromGLB,
      },
    });
  }
}
