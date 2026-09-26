// Vertical riveted steam boiler: cast-iron firebox with glowing door, copper shell with brass
// bands, gauges, sight glass, safety valve, whistle, manhole, name plate and a coal scuttle.
import * as THREE from 'three';
import { add, group, lathe, V, scaleUV } from '../utils/geometry.js';
import { RivetSet } from '../utils/rivets.js';
import { createGauge, setGaugeValue, createValve } from '../utils/fixtures.js';
import { fireFlicker } from '../lighting/flicker.js';
import { mulberry32 } from '../materials/noise.js';

const FIRE_R = 1.25;
const SHELL_R = 1.08;
const SHELL_Y0 = 1.72;
const SHELL_Y1 = 4.35;
const DOOR_Y = 0.95;

export function createBoiler(M) {
  const root = group('SteamBoiler');
  const rivets = new RivetSet(0.016);
  const smallRivets = new RivetSet(0.011);
  const rand = mulberry32(7);

  // ---- base plate & firebox
  add(root, new THREE.BoxGeometry(3.0, 0.22, 2.9), M.castIron, 'BasePlate', [0, 0.11, 0]);
  for (const [x, z] of [[-1.35, -1.3], [1.35, -1.3], [-1.35, 1.3], [1.35, 1.3]]) {
    add(root, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 6), M.steelDark, 'AnchorNut', [x, 0.245, z]);
  }
  add(
    root,
    scaleUV(lathe([[0, 0.22], [1.4, 0.22], [1.4, 0.32], [1.3, 0.37], [FIRE_R, 0.42], [FIRE_R, 1.55], [1.3, 1.6], [1.3, 1.7], [1.1, 1.72], [0, 1.72]], 48), 6, 2),
    M.castIron,
    'Firebox',
  );
  rivets.ring(FIRE_R + 0.005, 0.5, 56);
  rivets.ring(FIRE_R + 0.005, 1.48, 56, 0.05);

  // fire-door housing with an opening onto the glowing grate
  const door = group('FireDoor', root, [0, DOOR_Y, 0]);
  const zF = FIRE_R - 0.08;
  const housing = [
    [0.98, 0.17, 0, 0.315],
    [0.98, 0.17, 0, -0.315],
    [0.19, 0.46, -0.405, 0],
    [0.19, 0.46, 0.405, 0],
  ];
  for (const [w, h, x, y] of housing) add(door, new THREE.BoxGeometry(w, h, 0.34), M.castIron, 'DoorHousing', [x, y, zF + 0.17]);
  add(door, new THREE.BoxGeometry(1.06, 0.06, 0.38), M.castIron, 'HousingLip', [0, 0.42, zF + 0.19]);
  add(door, new THREE.PlaneGeometry(0.62, 0.46), M.fire, 'FireGlow', [0, 0, zF + 0.01]).userData.noShadow = true;
  for (const [x, ry] of [[-0.31, Math.PI / 2], [0.31, -Math.PI / 2]]) {
    add(door, new THREE.PlaneGeometry(0.34, 0.46), M.emberIron, 'CavityWall', [x, 0, zF + 0.17], [0, ry, 0]);
  }
  add(door, new THREE.PlaneGeometry(0.62, 0.34), M.emberIron, 'CavityTop', [0, 0.23, zF + 0.17], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    add(door, new THREE.CylinderGeometry(0.014, 0.014, 0.6, 6), M.blackIron, 'GrateBar', [0, -0.19, zF + 0.04 + i * 0.05], [0, 0, Math.PI / 2]);
  }
  const coalGeo = new THREE.DodecahedronGeometry(0.045, 0);
  const coals = new THREE.InstancedMesh(coalGeo, M.embers, 26);
  coals.name = 'GlowingCoals';
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) {
    const s = 0.6 + rand() * 0.8;
    m4.compose(
      V((rand() - 0.5) * 0.52, -0.16 + rand() * 0.06, zF + 0.02 + rand() * 0.26),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3)),
      V(s, s * 0.8, s),
    );
    coals.setMatrixAt(i, m4);
  }
  coals.userData.noShadow = true;
  door.add(coals);
  rivets.rect(V(0, DOOR_Y, zF + 0.345), 0.44, 0.3, V(0, 0, 1), 0.09);

  // hinged door leaf, swung open
  const hinge = group('DoorHinge', door, [-0.5, 0, zF + 0.35]);
  hinge.rotation.y = -1.95;
  const leaf = group('DoorLeaf', hinge, [0.34, 0, 0]);
  add(leaf, new THREE.BoxGeometry(0.66, 0.5, 0.045), M.castIron, 'Leaf');
  add(leaf, new THREE.BoxGeometry(0.5, 0.34, 0.02), M.castIron, 'LeafPanel', [0, 0, 0.03]);
  add(leaf, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), M.brassAged, 'DraftDisc', [0.05, 0.02, 0.05], [Math.PI / 2, 0, 0]);
  add(leaf, new THREE.BoxGeometry(0.2, 0.025, 0.03), M.steelDark, 'Latch', [0.22, 0, 0.05]);
  add(leaf, new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10), M.woodHandle, 'LatchGrip', [0.3, 0, 0.07], [Math.PI / 2, 0, 0]);
  for (const y of [-0.18, 0.18]) add(hinge, new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10), M.castIron, 'HingeKnuckle', [0, y, 0]);

  // ash-pit door with vents
  const ash = group('AshPitDoor', root, [0, 0.43, FIRE_R - 0.02]);
  add(ash, new THREE.BoxGeometry(0.62, 0.2, 0.08), M.castIron, 'AshDoor', [0, 0, 0.04]);
  for (let i = 0; i < 4; i++) add(ash, new THREE.BoxGeometry(0.08, 0.1, 0.02), M.blackIron, 'Vent', [-0.18 + i * 0.12, 0, 0.085]);
  add(ash, new THREE.BoxGeometry(0.1, 0.03, 0.04), M.brassAged, 'AshHandle', [0.24, 0, 0.1]);

  // ---- copper shell with brass bands
  add(root, scaleUV(new THREE.CylinderGeometry(SHELL_R, SHELL_R, SHELL_Y1 - SHELL_Y0, 64, 1, true), 5, 2.4), M.copper, 'Shell', [0, (SHELL_Y0 + SHELL_Y1) / 2, 0]);
  for (const y of [1.8, 2.72, 3.55, 4.3]) {
    add(root, scaleUV(new THREE.CylinderGeometry(SHELL_R + 0.028, SHELL_R + 0.028, 0.13, 64), 5, 0.2), M.brass, 'Band', [0, y, 0]);
    rivets.ring(SHELL_R + 0.028, y + 0.035, 64);
    rivets.ring(SHELL_R + 0.028, y - 0.035, 64, Math.PI / 64);
  }
  // vertical lap seam
  for (let y = 1.9; y < 4.22; y += 0.07) {
    for (const da of [-0.035, 0.035]) {
      const a = 2.3 + da;
      rivets.add(V(Math.cos(a) * SHELL_R, y, Math.sin(a) * SHELL_R), V(Math.cos(a), 0, Math.sin(a)));
    }
  }
  // crown
  add(root, scaleUV(new THREE.SphereGeometry(SHELL_R + 0.005, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2), 5, 1.5), M.brassAged, 'Crown', [0, SHELL_Y1, 0], [0, 0, 0], [1, 0.42, 1]);
  rivets.ring(SHELL_R * 0.92, SHELL_Y1 + 0.18, 48);

  // steam dome, safety valve, whistle
  const top = SHELL_Y1 + 0.42;
  add(root, lathe([[0, 0], [0.4, 0], [0.4, 0.06], [0.32, 0.09], [0.3, 0.42], [0.34, 0.45], [0.34, 0.5], [0.2, 0.6], [0.08, 0.63], [0, 0.63]], 40), M.brass, 'SteamDome', [0, top - 0.08, 0]);
  smallRivets.ring(0.365, top - 0.05, 24);
  const sv = group('SafetyValve', root, [0.55, top - 0.2, 0.18]);
  add(sv, lathe([[0, 0], [0.09, 0], [0.09, 0.05], [0.06, 0.07], [0.055, 0.32], [0.075, 0.34], [0.075, 0.4], [0.03, 0.44], [0, 0.44]], 20), M.brassPolished, 'ValveColumn');
  add(sv, new THREE.BoxGeometry(0.5, 0.025, 0.03), M.steelDark, 'Lever', [0.2, 0.46, 0], [0, 0, -0.08]);
  add(sv, new THREE.CylinderGeometry(0.06, 0.06, 0.09, 16), M.castIron, 'LeverWeight', [0.42, 0.42, 0]);
  const whistle = group('Whistle', root, [-0.45, top - 0.25, 0.3]);
  add(whistle, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 10), M.brass, 'WhistleStem', [0, 0.15, 0]);
  add(whistle, lathe([[0.02, 0], [0.05, 0.02], [0.05, 0.24], [0.045, 0.26], [0.05, 0.28], [0.02, 0.3], [0, 0.31]], 18), M.brassPolished, 'WhistleBell', [0, 0.3, 0]);
  add(whistle, new THREE.BoxGeometry(0.16, 0.012, 0.02), M.steel, 'WhistleLever', [0.07, 0.34, 0], [0, 0, 0.3]);

  // flue collar at the back of the crown (the chimney pipe itself is part of the wall pipework)
  add(root, new THREE.CylinderGeometry(0.28, 0.3, 0.3, 24), M.castIron, 'FlueCollar', [0, top - 0.02, -0.62]);
  smallRivets.ring(0.3, top - 0.1, 18, 0, V(0, 0, -0.62));

  // ---- front fittings: gauges on pigtail siphons, manhole, name plate, sight glass
  const gauges = [];
  for (const [x, v] of [[-0.36, 0.55], [0.36, 0.42]]) {
    const stemBase = V(x, 3.08, Math.sqrt(SHELL_R * SHELL_R - x * x));
    const out = V(x, 0, stemBase.z).normalize();
    const stemEnd = stemBase.clone().addScaledVector(out, 0.16);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8), M.brass);
    stem.position.copy(stemBase.clone().lerp(stemEnd, 0.5));
    stem.quaternion.setFromUnitVectors(V(0, 1, 0), out);
    stem.name = 'GaugeStem';
    root.add(stem);
    const pig = add(root, new THREE.TorusGeometry(0.035, 0.009, 6, 18), M.brass, 'Pigtail', [stemEnd.x, stemEnd.y + 0.04, stemEnd.z], [0, Math.atan2(out.x, out.z) + Math.PI / 2, 0]);
    pig.userData.noShadow = true;
    const gauge = createGauge(M, { radius: 0.13, depth: 0.06 });
    gauge.object.position.set(stemEnd.x, stemEnd.y + 0.2, stemEnd.z);
    gauge.object.rotation.y = Math.atan2(out.x, out.z);
    root.add(gauge.object);
    gauges.push({ needle: gauge.needle, base: v, seed: gauges.length * 3.1 });
  }
  const manhole = group('Manhole', root, [0, 3.95, SHELL_R - 0.01]);
  add(manhole, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 32), M.brassAged, 'Cover', [0, 0, 0.03], [Math.PI / 2, 0, 0], [1.35, 1, 1]);
  add(manhole, new THREE.BoxGeometry(0.62, 0.05, 0.05), M.steelDark, 'Yoke', [0, 0, 0.09]);
  add(manhole, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), M.steelDark, 'YokeNut', [0, 0, 0.12], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    smallRivets.add(V(Math.cos(a) * 0.23, Math.sin(a) * 0.17, 0.06).add(manhole.position), V(0, 0, 1));
  }
  const plate = add(root, new THREE.CylinderGeometry(SHELL_R + 0.004, SHELL_R + 0.004, 0.22, 48, 1, true, -0.34, 0.68), M.nameplate, 'NamePlate', [0, 2.3, 0]);
  plate.userData.noShadow = true;

  const sight = group('SightGlass', root);
  sight.position.set(Math.sin(0.62) * (SHELL_R + 0.12), 2.2, Math.cos(0.62) * (SHELL_R + 0.12));
  sight.rotation.y = 0.62;
  for (const y of [0, 0.62]) {
    add(sight, new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), M.brass, 'Cock', [0, y, 0]);
    add(sight, new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), M.brass, 'CockArm', [0, y, -0.07], [Math.PI / 2, 0, 0]);
    add(sight, new THREE.BoxGeometry(0.1, 0.012, 0.012), M.steelDark, 'CockHandle', [0.05, y + 0.03, 0.02]);
  }
  add(sight, new THREE.CylinderGeometry(0.022, 0.022, 0.52, 12), M.glass, 'GlassTube', [0, 0.31, 0]).userData.noShadow = true;
  add(sight, new THREE.CylinderGeometry(0.016, 0.016, 0.26, 10), M.water, 'WaterColumn', [0, 0.19, 0]).userData.noShadow = true;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(sight, new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), M.brass, 'GuardRod', [Math.cos(a) * 0.035, 0.31, Math.sin(a) * 0.035]);
  }

  // side ports (the wall pipework continues from these anchors)
  const ports = [
    { name: 'PortLeft', p: V(-SHELL_R, 2.2, 0.1), n: V(-1, 0, 0) },
    { name: 'PortRight', p: V(SHELL_R, 2.0, 0.1), n: V(1, 0, 0) },
  ];
  for (const port of ports) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 20), M.brass);
    flange.position.copy(port.p).addScaledVector(port.n, 0.02);
    flange.quaternion.setFromUnitVectors(V(0, 1, 0), port.n);
    flange.name = port.name;
    root.add(flange);
    smallRivets.circle(port.p.clone().addScaledVector(port.n, 0.046), port.n, 0.09, 8);
  }
  // blow-down valve at the foot
  const blow = createValve(M, { size: 1.1 });
  blow.object.position.set(0.95, 0.52, 0.85);
  blow.object.rotation.y = -0.7;
  root.add(blow.object);
  add(root, new THREE.CylinderGeometry(0.03, 0.03, 0.35, 10), M.brass, 'BlowPipe', [0.8, 0.52, 0.72], [0, -0.7, Math.PI / 2]);

  // ---- coal scuttle & shovel
  const scuttle = group('CoalScuttle', root, [1.55, 0, 1.25], [0, -0.5, 0]);
  add(scuttle, lathe([[0, 0.02], [0.2, 0.02], [0.22, 0.05], [0.26, 0.34], [0.28, 0.36], [0.27, 0.38]], 28), M.castIron, 'Bucket');
  add(scuttle, lathe([[0, 0.06], [0.21, 0.06], [0.25, 0.34], [0.26, 0.37]], 28, 0, Math.PI * 2, true), M.darkInterior, 'BucketInside');
  add(scuttle, new THREE.TorusGeometry(0.27, 0.012, 6, 24, Math.PI), M.steelDark, 'Bail', [0, 0.38, 0], [0, 0, 0]);
  const lumps = new THREE.InstancedMesh(coalGeo, M.coal, 40);
  lumps.name = 'CoalLumps';
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.22;
    const s = 0.8 + rand() * 1.1;
    m4.compose(V(Math.cos(a) * r, 0.3 + rand() * 0.07 - r * 0.2, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3)), V(s, s, s));
    lumps.setMatrixAt(i, m4);
  }
  scuttle.add(lumps);
  const shovel = group('Shovel', root, [1.2, 0, 1.52], [0, 0.4, 0]);
  shovel.rotation.z = 0.32;
  add(shovel, new THREE.CylinderGeometry(0.018, 0.02, 0.9, 10), M.woodHandle, 'ShovelShaft', [0, 0.72, 0]);
  add(shovel, new THREE.TorusGeometry(0.05, 0.012, 6, 16), M.woodHandle, 'ShovelGrip', [0, 1.2, 0]);
  add(shovel, new THREE.BoxGeometry(0.22, 0.28, 0.012), M.steelDark, 'Blade', [0, 0.15, 0.02], [0.25, 0, 0]);
  add(shovel, new THREE.CylinderGeometry(0.02, 0.028, 0.14, 10), M.steelDark, 'Socket', [0, 0.32, 0]);

  root.add(rivets.build(M.brassAged, 'BoilerRivets'));
  root.add(smallRivets.build(M.steelDark, 'BoilerBolts'));

  const fireTex = M.fire.emissiveMap;
  const update = (dt, t) => {
    const f = fireFlicker(t);
    M.fire.emissiveIntensity = 4.5 * f;
    M.embers.emissiveIntensity = 1.6 * (0.7 + 0.3 * f);
    M.emberIron.emissiveIntensity = 0.35 * f;
    fireTex.offset.y = (fireTex.offset.y - dt * 0.35) % 1;
    fireTex.offset.x = Math.sin(t * 0.7) * 0.05;
    for (const g of gauges) setGaugeValue(g.needle, g.base + Math.sin(t * 0.6 + g.seed) * 0.015 + Math.sin(t * 7.1 + g.seed) * 0.004);
  };

  return {
    object: root,
    update,
    anchors: {
      fireLight: V(0, DOOR_Y + 0.1, FIRE_R + 1.25),
      fireMouth: V(0, DOOR_Y - 0.05, FIRE_R + 0.2),
      safetyValve: V(0.55, top + 0.26, 0.18),
      whistle: V(-0.45, top + 0.38, 0.3),
      steamOutlet: V(0, top + 0.55, 0),
      flue: V(0, top + 0.12, -0.62),
      portLeft: ports[0].p.clone().addScaledVector(ports[0].n, 0.045),
      portRight: ports[1].p.clone().addScaledVector(ports[1].n, 0.045),
    },
  };
}
