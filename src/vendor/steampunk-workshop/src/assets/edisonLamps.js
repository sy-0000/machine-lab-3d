// Edison-bulb lighting fixtures: the chandelier ring over the workbench (hung by chain from the
// tie-beam hub), pendants under the gallery and scrolled wall sconces. Each fixture's bulb
// materials breathe with the same curve as its point light (lighting/flicker.js).
import * as THREE from 'three';
import { ROOM, PLACEMENTS, wallFrame } from '../config/layout.js';
import { add, group, lathe, V } from '../utils/geometry.js';
import { createEdisonBulb, createCable } from '../utils/fixtures.js';
import { lampBreath } from '../lighting/flicker.js';

function chain(M, a, b, link = 0.028) {
  const len = a.distanceTo(b);
  const n = Math.max(2, Math.floor(len / (link * 0.8)));
  const geo = new THREE.TorusGeometry(link * 0.42, link * 0.1, 4, 8);
  geo.scale(1, 1.6, 1);
  const mesh = new THREE.InstancedMesh(geo, M.blackIron, n);
  mesh.name = 'Chain';
  const dir = b.clone().sub(a).normalize();
  const q0 = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
  const twist = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const q = i % 2 ? q0.clone().multiply(twist) : q0.clone();
    m.compose(a.clone().lerp(b, (i + 0.5) / n), q, V(1, 1, 1));
    mesh.setMatrixAt(i, m);
  }
  mesh.userData.noShadow = true;
  return mesh;
}

function bulbMaterials(M) {
  return { glass: M.bulbGlass.clone(), filament: M.filament.clone() };
}

function shade(M, radius = 0.12) {
  const outer = lathe([[0.02, 0.06], [0.03, 0.05], [radius * 0.55, 0.0], [radius, -0.07], [radius + 0.006, -0.075]], 24);
  const g = group('Shade');
  add(g, outer, M.copper, 'ShadeOuter');
  add(g, lathe([[0.02, 0.058], [0.03, 0.048], [radius * 0.55, -0.002], [radius - 0.002, -0.07]], 24, 0, Math.PI * 2, true), M.brassPolished, 'ShadeInner');
  return g;
}

export function createEdisonLamps(M) {
  const root = group('EdisonLighting');
  const fixtures = [];
  const lights = [];

  // ---- chandelier ring over the workbench
  const clusterPos = V(...PLACEMENTS.lampCluster.position);
  const cm = bulbMaterials(M);
  const cluster = group('LampCluster', root, clusterPos.toArray());
  add(cluster, new THREE.TorusGeometry(0.55, 0.018, 8, 48), M.blackIron, 'Ring', [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(cluster, new THREE.TorusGeometry(0.2, 0.014, 8, 32), M.brassAged, 'InnerRing', [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = add(cluster, new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6), M.brassAged, 'Spoke', [Math.cos(a) * 0.375, 0, Math.sin(a) * 0.375], [0, -a, Math.PI / 2]);
    s.userData.noShadow = true;
  }
  const collar = V(0, 0.9, 0);
  add(cluster, lathe([[0, 0], [0.05, 0], [0.06, 0.04], [0.03, 0.08], [0, 0.09]], 16), M.brass, 'Collar', collar.toArray());
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    cluster.add(chain(M, V(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55), collar.clone()));
  }
  const hub = V(0, ROOM.tieBeamY - 0.36, 0).sub(clusterPos);
  cluster.add(chain(M, collar.clone().setY(collar.y + 0.09), hub, 0.034));
  const drops = [0.38, 0.62, 0.46, 0.74, 0.4, 0.58, 0.68, 0.5];
  drops.forEach((len, i) => {
    const a = (i / drops.length) * Math.PI * 2;
    const r = i % 2 ? 0.55 : 0.2;
    const top = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const bottom = top.clone().setY(-len);
    cluster.add(createCable(top, bottom, M.cloth, 0.004, 0.0));
    const bulb = createEdisonBulb(M, { scale: 1.15, glass: cm.glass, filament: cm.filament });
    bulb.position.copy(bottom);
    cluster.add(bulb);
  });
  const centre = createEdisonBulb(M, { scale: 1.6, glass: cm.glass, filament: cm.filament });
  centre.position.set(0, -0.86, 0);
  cluster.add(createCable(V(0, 0, 0), V(0, -0.86, 0), M.cloth, 0.005, 0));
  cluster.add(centre);
  fixtures.push({ mats: cm, seed: 1 });
  lights.push({ position: clusterPos.clone().add(V(0, -0.6, 0)), color: 0xffb466, intensity: 22, distance: 14, seed: 1 });

  // ---- pendants under the gallery (hung from the inner edge beam)
  const pendantSpots = [
    { k: 4, along: -1.6, light: false },
    { k: 4, along: 1.8, light: false },
    { k: 5, along: 0.3, light: true },
    { k: 6, along: 1.3, light: false },
    { k: 3, along: 0.2, light: false },
  ];
  for (const [i, spot] of pendantSpots.entries()) {
    const f = wallFrame(spot.k, ROOM.galleryDepth - 0.1, spot.along, ROOM.galleryY - 0.28);
    const pm = bulbMaterials(M);
    const pend = group('GalleryPendant', root, f.position.toArray());
    pend.add(createCable(V(0, 0, 0), V(0, -0.36, 0), M.cloth, 0.005, 0));
    const sh = shade(M, 0.14);
    sh.position.y = -0.39;
    pend.add(sh);
    const bulb = createEdisonBulb(M, { scale: 1.2, glass: pm.glass, filament: pm.filament });
    bulb.position.y = -0.37;
    pend.add(bulb);
    fixtures.push({ mats: pm, seed: 10 + i });
    if (spot.light) lights.push({ position: f.position.clone().add(V(0, -0.9, 0)).addScaledVector(f.normal, 0.3), color: 0xffa24e, intensity: 7, distance: 8, seed: 10 + i });
  }

  // ---- wall sconces
  const sconceSpots = [
    { k: 2, along: 1.9, y: 2.9, light: false },
    { k: 1, along: -3.3, y: 2.9, light: true },
    { k: 1, along: 3.3, y: 2.9, light: false },
    { k: 0, along: -2.65, y: 3.1, light: false },
    { k: 0, along: 2.65, y: 3.1, light: false },
  ];
  for (const [i, spot] of sconceSpots.entries()) {
    const f = wallFrame(spot.k, 0, spot.along, spot.y);
    const sm = bulbMaterials(M);
    const sc = group('WallSconce', root, f.position.toArray(), [0, f.rotationY, 0]);
    add(sc, new THREE.CylinderGeometry(0.07, 0.07, 0.025, 20), M.brassAged, 'Backplate', [0, 0, 0.012], [Math.PI / 2, 0, 0]);
    const arm = [V(0, 0, 0.02), V(0, 0.02, 0.12), V(0, 0.1, 0.22), V(0, 0.2, 0.26), V(0, 0.22, 0.3)];
    add(sc, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arm), 24, 0.012, 8), M.blackIron, 'ScrollArm');
    add(sc, new THREE.TorusGeometry(0.04, 0.006, 6, 16), M.blackIron, 'Scroll', [0, -0.04, 0.06], [0, Math.PI / 2, 0]);
    const sh = shade(M, 0.11);
    sh.position.set(0, 0.2, 0.3);
    sc.add(sh);
    const bulb = createEdisonBulb(M, { scale: 1.1, glass: sm.glass, filament: sm.filament });
    bulb.position.set(0, 0.22, 0.3);
    sc.add(bulb);
    fixtures.push({ mats: sm, seed: 20 + i });
    if (spot.light) lights.push({ position: f.position.clone().addScaledVector(f.normal, 0.55).setY(spot.y + 0.05), color: 0xffab5c, intensity: 6, distance: 8, seed: 20 + i });
  }

  const update = (dt, t) => {
    for (const fx of fixtures) {
      const b = lampBreath(t, fx.seed);
      fx.mats.filament.emissiveIntensity = 10 * b * b;
      fx.mats.glass.emissiveIntensity = 0.9 * b;
    }
  };

  return { object: root, update, lights };
}
