import {
  Group,
  Mesh,
  BoxGeometry,
  CylinderGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ToolBase } from './ToolBase.js';

function flutedGeometry(radius, length, flutes, tipLength = 0) {
  const positions = [], indices = [], around = 48, rows = 48;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const tipScale = tipLength ? Math.min(1, ((1 - t) * length) / tipLength) : 1;
    for (let i = 0; i <= around; i++) {
      const a = (i / around) * Math.PI * 2;
      const phase = flutes * (a - t * Math.PI * 2 * 1.15);
      const r = radius * (0.60 + 0.40 * Math.pow((1 + Math.cos(phase)) / 2, 3)) * tipScale;
      positions.push(r * Math.cos(a), -length * t, r * Math.sin(a));
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < around; i++) {
      const a = j * (around + 1) + i;
      const b = a + around + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const top = positions.length / 3;
  positions.push(0, 0, 0);
  const bottom = positions.length / 3;
  positions.push(0, -length, 0);
  for (let i = 0; i < around; i++) {
    indices.push(top, i + 1, i);
    const a = rows * (around + 1) + i;
    indices.push(bottom, a, a + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildTurningToolProcedural(group, def) {
  const silverSteel = new MeshStandardMaterial({ color: '#dce3ea', metalness: 0.88, roughness: 0.22 });
  const darkSteel = new MeshStandardMaterial({ color: '#323940', metalness: 0.8, roughness: 0.35 });
  const goldInsert = new MeshStandardMaterial({ color: '#dfb738', metalness: 0.85, roughness: 0.24 });
  const shimSteel = new MeshStandardMaterial({ color: '#b0b8c0', metalness: 0.85, roughness: 0.32 });
  const screwSteel = new MeshStandardMaterial({ color: '#a6b0b8', metalness: 0.9, roughness: 0.2 });

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

  // Carbide Insert (菱形/三角形)
  const insert = new Mesh(new CylinderGeometry(0.0118, 0.0118, 0.0042, 3), goldInsert);
  insert.rotation.y = -Math.PI / 2;
  // Upper cutting corner in this insert's local world units; consumed only by the adapter.
  insert.userData.cuttingTipLocal = [0, insert.geometry.parameters.height / 2, insert.geometry.parameters.radiusTop];
  insert.position.set(-0.195, 0.009 + 0.0042 / 2, 0);
  group.add(insert);

  // Wedge Clamp & Bolt
  const clamp = new Mesh(new BoxGeometry(0.024, 0.0055, 0.012), darkSteel);
  clamp.rotation.z = -0.15;
  clamp.position.set(-0.178, 0.009 + 0.006, 0);
  group.add(clamp);

  const screw = new Mesh(new CylinderGeometry(0.0035, 0.0035, 0.006, 16), screwSteel);
  screw.position.set(-0.172, 0.009 + 0.007, 0);
  group.add(screw);
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

function buildEndMillProcedural(group, def) {
  const steel = new MeshStandardMaterial({ color: '#aab4bd', metalness: 0.85, roughness: 0.28 });
  const radius = def.dimensions?.radius || 0.008;
  const shankLength = def.dimensions?.shankLength || 0.035;
  const cuttingLength = def.dimensions?.cuttingLength || 0.035;

  const shank = new Mesh(new CylinderGeometry(radius, radius, shankLength, 32), steel);
  shank.position.y = -shankLength / 2;
  group.add(shank);

  const flutes = new Mesh(flutedGeometry(radius, cuttingLength, 4, 0), steel);
  flutes.position.y = -shankLength;
  group.add(flutes);
}

function buildDrillBitProcedural(group, def) {
  const steel = new MeshStandardMaterial({ color: '#aab4bd', metalness: 0.85, roughness: 0.28 });
  const radius = def.dimensions?.radius || 0.006;
  const shankLength = def.dimensions?.shankLength || 0.025;
  const cuttingLength = def.dimensions?.cuttingLength || 0.049;

  const shank = new Mesh(new CylinderGeometry(radius, radius, shankLength, 32), steel);
  shank.position.y = -shankLength / 2;
  group.add(shank);

  const flutes = new Mesh(flutedGeometry(radius, cuttingLength, 2, radius * 1.1), steel);
  flutes.position.y = -shankLength;
  group.add(flutes);
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

    let loadedFromGLB = false;

    // Try loading GLB if available
    if (typeof fetch !== 'undefined' && toolDef.modelPath) {
      try {
        const root = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
          ? `${import.meta.env.BASE_URL}`.replace(/\/$/, '')
          : '';
        const url = `${root}${toolDef.modelPath.startsWith('/') ? '' : '/'}${toolDef.modelPath}`;
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          const gltfLoader = new GLTFLoader();
          const gltf = await gltfLoader.loadAsync(url);
          group.add(gltf.scene);
          loadedFromGLB = true;
        }
      } catch (err) {
        // Fall back to procedural
      }
    }

    if (!loadedFromGLB) {
      // Build high-fidelity procedural representation
      switch (toolDef.id) {
        case 'turning_tool':
          buildTurningToolProcedural(group, toolDef);
          break;
        case 'threading_tool':
          buildThreadingToolProcedural(group, toolDef);
          break;
        case 'knurling_tool':
          buildKnurlingToolProcedural(group, toolDef);
          break;
        case 'face_mill':
          buildFaceMillProcedural(group, toolDef);
          break;
        case 'end_mill':
          buildEndMillProcedural(group, toolDef);
          break;
        case 'drill_bit':
          buildDrillBitProcedural(group, toolDef);
          break;
        default:
          if (toolDef.type === 'drilling') {
            buildDrillBitProcedural(group, toolDef);
          } else if (toolDef.type === 'milling') {
            buildEndMillProcedural(group, toolDef);
          } else {
            buildTurningToolProcedural(group, toolDef);
          }
          break;
      }
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
