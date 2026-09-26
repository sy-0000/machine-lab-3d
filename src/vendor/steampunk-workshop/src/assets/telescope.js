// Brass refracting telescope on a wooden tripod with an alt-az fork mount, aimed up at the dome.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';

const HEAD_Y = 1.28;

export function createTelescope(M, { azimuth = -0.9, elevation = 0.62 } = {}) {
  const root = group('BrassTelescope');

  // tripod
  const spread = 0.55;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const foot = V(Math.cos(a) * spread, 0, Math.sin(a) * spread);
    const top = V(Math.cos(a) * 0.08, HEAD_Y - 0.08, Math.sin(a) * 0.08);
    const len = foot.distanceTo(top);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.032), M.woodDark);
    leg.name = 'TripodLeg';
    leg.position.copy(foot).lerp(top, 0.5);
    leg.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(foot).normalize());
    leg.rotateY(a);
    root.add(leg);
    add(root, new THREE.ConeGeometry(0.03, 0.06, 10), M.brassAged, 'LegFoot', [foot.x, 0.03, foot.z], [Math.PI, 0, 0]);
    const clamp = foot.clone().lerp(top, 0.62);
    add(root, new THREE.BoxGeometry(0.07, 0.04, 0.05), M.brass, 'LegClamp', [clamp.x, clamp.y, clamp.z], [0, -a, 0]);
    const mid = foot.clone().lerp(top, 0.35);
    const chainEnd = V(0, mid.y - 0.02, 0);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, mid.distanceTo(chainEnd), 4), M.brassAged);
    chain.position.copy(mid).lerp(chainEnd, 0.5);
    chain.quaternion.setFromUnitVectors(V(0, 1, 0), chainEnd.clone().sub(mid).normalize());
    chain.name = 'SpreaderChain';
    chain.userData.noShadow = true;
    root.add(chain);
  }
  add(root, lathe([[0, 0], [0.12, 0], [0.12, 0.06], [0.08, 0.1], [0, 0.1]], 24), M.brass, 'TripodHead', [0, HEAD_Y - 0.1, 0]);
  add(root, new THREE.SphereGeometry(0.02, 10, 8), M.brass, 'SpreaderRing', [0, 0.46, 0]);

  // mount
  const az = group('AzimuthMount', root, [0, HEAD_Y, 0], [0, azimuth, 0]);
  add(az, new THREE.CylinderGeometry(0.05, 0.06, 0.08, 20), M.brassAged, 'AzimuthBearing', [0, 0.04, 0]);
  for (const s of [-1, 1]) add(az, new THREE.BoxGeometry(0.025, 0.22, 0.06), M.brass, 'ForkArm', [s * 0.1, 0.18, 0]);
  add(az, new THREE.BoxGeometry(0.225, 0.03, 0.07), M.brass, 'ForkBase', [0, 0.085, 0]);
  const tube = group('TubeAssembly', az, [0, 0.26, 0], [0, 0, 0]);
  tube.rotation.x = -elevation;
  for (const s of [-1, 1]) add(tube, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), M.brassPolished, 'AltitudeKnob', [s * 0.12, 0, 0], [0, 0, Math.PI / 2]);
  // optical tube along +Z (objective forward)
  const profile = [
    [0, -0.62], [0.018, -0.62], [0.022, -0.6], [0.022, -0.5], [0.028, -0.49], [0.028, -0.4], [0.035, -0.39], [0.035, -0.3],
    [0.052, -0.29], [0.055, -0.27], [0.055, 0.5], [0.06, 0.51], [0.06, 0.53], [0.068, 0.55], [0.07, 0.68], [0.074, 0.7], [0.074, 0.72], [0.066, 0.72],
  ];
  add(tube, lathe(profile, 32), M.brass, 'OpticalTube', [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(tube, new THREE.CircleGeometry(0.066, 32), M.glass, 'Objective', [0, 0, 0.715]).userData.noShadow = true;
  add(tube, new THREE.CylinderGeometry(0.058, 0.058, 0.26, 32, 1, true), M.leatherDark, 'LeatherWrap', [0, 0, 0.08], [Math.PI / 2, 0, 0]);
  for (const z of [-0.06, 0.22, 0.45]) add(tube, new THREE.TorusGeometry(0.057, 0.006, 8, 32), M.brassPolished, 'TubeRing', [0, 0, z]);
  add(tube, new THREE.CylinderGeometry(0.02, 0.02, 0.05, 12), M.brassPolished, 'FocusKnob', [0.045, -0.02, -0.33], [0, 0, Math.PI / 2]);
  add(tube, lathe([[0, 0], [0.024, 0], [0.026, 0.02], [0.02, 0.05], [0, 0.05]], 16), M.rubber, 'Eyecup', [0, 0, -0.62], [-Math.PI / 2, 0, 0]);
  // finder scope
  for (const z of [0.1, 0.35]) add(tube, new THREE.BoxGeometry(0.01, 0.07, 0.014), M.brass, 'FinderBracket', [0, 0.085, z]);
  add(tube, new THREE.CylinderGeometry(0.017, 0.017, 0.36, 16), M.brassAged, 'FinderScope', [0, 0.12, 0.22], [Math.PI / 2, 0, 0]);
  return { object: root };
}
