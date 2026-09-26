// Floor-standing library globe: turned tripod stand, wooden horizon ring, brass meridian and
// an aged cartographic sphere tilted to the Earth's axial angle.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';

const CENTER_Y = 0.98;
const R = 0.3;

export function createGlobe(M) {
  const root = group('LibraryGlobe');
  // three curved legs joined by a stretcher with a compass rose disc
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const pts = [
      dir.clone().multiplyScalar(0.42).setY(0.02),
      dir.clone().multiplyScalar(0.4).setY(0.3),
      dir.clone().multiplyScalar(0.34).setY(0.6),
      dir.clone().multiplyScalar(0.37).setY(CENTER_Y - 0.03),
    ];
    add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.022, 8), M.woodDark, 'Leg');
    add(root, new THREE.SphereGeometry(0.035, 12, 8), M.woodDark, 'Foot', [pts[0].x, 0.03, pts[0].z]);
    const s = dir.clone().multiplyScalar(0.39).setY(0.28);
    const stretcher = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.39, 8), M.woodDark);
    stretcher.position.copy(s).multiplyScalar(0.5).setY(0.28);
    stretcher.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    stretcher.name = 'Stretcher';
    root.add(stretcher);
  }
  add(root, lathe([[0, 0.26], [0.09, 0.26], [0.1, 0.28], [0.09, 0.3], [0, 0.3]], 24), M.woodDark, 'CompassHub');
  add(root, new THREE.CircleGeometry(0.08, 24), M.brassAged, 'CompassRose', [0, 0.301, 0], [-Math.PI / 2, 0, 0]);
  add(root, lathe([[R + 0.05, 0], [R + 0.12, 0], [R + 0.12, 0.03], [R + 0.05, 0.03]], 64), M.woodDark, 'HorizonRing', [0, CENTER_Y - 0.03, 0]);
  add(root, new THREE.RingGeometry(R + 0.05, R + 0.12, 64, 1), M.paper, 'HorizonCalendar', [0, CENTER_Y + 0.001, 0], [-Math.PI / 2, 0, 0]);

  const tilt = group('Meridian', root, [0, CENTER_Y, 0]);
  tilt.rotation.z = (23.4 * Math.PI) / 180;
  add(tilt, new THREE.TorusGeometry(R + 0.03, 0.009, 8, 72), M.brassPolished, 'MeridianRing', [0, 0, 0], [0, Math.PI / 2, 0]);
  for (const s of [-1, 1]) add(tilt, new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), M.brassPolished, 'AxisPin', [0, s * (R + 0.015), 0]);
  const sphere = add(tilt, new THREE.SphereGeometry(R, 64, 40), M.globe, 'GlobeSphere');
  sphere.rotation.y = 1.2;
  add(root, new THREE.BoxGeometry(0.05, 0.08, 0.05), M.brass, 'MeridianCradle', [0, CENTER_Y - R - 0.07, 0]);
  return { object: root };
}
