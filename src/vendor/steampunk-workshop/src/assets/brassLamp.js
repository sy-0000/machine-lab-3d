// Brass table lamp: weighted turned base, fluted column, amber glass shade over an Edison bulb,
// bead pull-chain. Exposes the bulb position as a light anchor.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';
import { createEdisonBulb } from '../utils/fixtures.js';

export function createBrassLamp(M) {
  const root = group('BrassTableLamp');
  add(root, lathe([[0, 0], [0.09, 0], [0.095, 0.012], [0.085, 0.03], [0.05, 0.045], [0.022, 0.06], [0, 0.062]], 28), M.brassAged, 'Base');
  add(root, lathe([[0, 0.06], [0.014, 0.06], [0.012, 0.1], [0.012, 0.3], [0.02, 0.31], [0.013, 0.33], [0.013, 0.38], [0, 0.38]], 14), M.brassPolished, 'Column');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(root, new THREE.CylinderGeometry(0.0025, 0.0025, 0.2, 4), M.brass, 'Flute', [Math.cos(a) * 0.013, 0.2, Math.sin(a) * 0.013]).userData.noShadow = true;
  }
  add(root, lathe([[0.02, 0], [0.024, 0.012], [0.02, 0.02]], 14), M.brass, 'Socket', [0, 0.38, 0]);
  const bulb = createEdisonBulb(M, { scale: 0.8 });
  bulb.rotation.x = Math.PI;
  bulb.position.set(0, 0.395, 0);
  root.add(bulb);
  // shade: flared amber glass bell with brass rims
  add(root, lathe([[0.075, 0.37], [0.085, 0.4], [0.07, 0.47], [0.045, 0.52], [0.035, 0.53]], 28), M.lampShade, 'Shade');
  add(root, new THREE.TorusGeometry(0.076, 0.004, 6, 28), M.brassPolished, 'ShadeRim', [0, 0.37, 0], [Math.PI / 2, 0, 0]);
  add(root, new THREE.TorusGeometry(0.036, 0.004, 6, 20), M.brassPolished, 'ShadeCollar', [0, 0.53, 0], [Math.PI / 2, 0, 0]);
  add(root, new THREE.SphereGeometry(0.012, 10, 8), M.brassPolished, 'Finial', [0, 0.545, 0]);
  const beads = [];
  for (let i = 0; i < 9; i++) beads.push(V(0.03, 0.44 - i * 0.012, 0.03));
  for (const p of beads) add(root, new THREE.SphereGeometry(0.003, 6, 4), M.brass, 'Bead', p.toArray()).userData.noShadow = true;
  return { object: root, anchors: { light: V(0, 0.45, 0) } };
}
