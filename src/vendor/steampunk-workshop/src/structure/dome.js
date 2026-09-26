// Faceted octagonal glass dome: cast-iron ribs, ring purlins, mullions, riveted seams,
// glazing panes (clean / dusty / cracked) and a glazed oculus lantern.
import * as THREE from 'three';
import { ROOM } from '../config/layout.js';
import { mulberry32 } from '../materials/noise.js';
import { GeoBatch, add, group } from '../utils/geometry.js';
import { RivetSet } from '../utils/rivets.js';

const RINGS = 7;
const COLUMNS = 3;

export function createDome(M) {
  const root = group('GlassDome');
  const { circumradius: Rc, wallHeight: H, domeRise: D, oculusRadius: Ro, sides } = ROOM;
  const aTop = Math.acos(Ro / Rc);
  const rand = mulberry32(2024);

  const vertexDir = (j) => {
    const a = (j + 0.5) * ((Math.PI * 2) / sides);
    return new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
  };
  // Point on sector k (between vertices k-1 and k), fraction u across, elevation angle a.
  const P = (k, u, a) => {
    const v = vertexDir(k - 1).lerp(vertexDir(k), u);
    return new THREE.Vector3(v.x * Rc * Math.cos(a), H + D * Math.sin(a), v.z * Rc * Math.cos(a));
  };
  const outward = (p) => new THREE.Vector3(p.x / (Rc * Rc), (p.y - H) / (D * D), p.z / (Rc * Rc)).normalize();
  const ringA = (i) => aTop * Math.pow(i / RINGS, 0.92);

  // ---- glazing
  const paneSets = { clean: [], dusty: [], cracked: [] };
  const panels = [];
  for (let k = 0; k < sides; k++) {
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < COLUMNS; j++) {
        const u0 = j / COLUMNS;
        const u1 = (j + 1) / COLUMNS;
        const a0 = ringA(i);
        const a1 = ringA(i + 1);
        const q = [P(k, u0, a0), P(k, u1, a0), P(k, u1, a1), P(k, u0, a1)];
        const r = rand();
        const set = r < 0.035 ? 'cracked' : r < 0.42 ? 'dusty' : 'clean';
        paneSets[set].push(q);
        const center = q.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(0.25);
        panels.push({ center, width: q[0].distanceTo(q[1]), height: q[0].distanceTo(q[3]), ring: i, sector: k });
      }
    }
  }
  const paneGeometry = (quads) => {
    const pos = [];
    const uv = [];
    for (const q of quads) {
      const tri = [0, 1, 2, 0, 2, 3];
      const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (const t of tri) {
        pos.push(q[t].x, q[t].y, q[t].z);
        uv.push(uvs[t][0], uvs[t][1]);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  };
  const glassMats = { clean: M.domeGlass, dusty: M.domeGlassDusty, cracked: M.domeGlassCracked };
  for (const key of Object.keys(paneSets)) {
    if (!paneSets[key].length) continue;
    const m = add(root, paneGeometry(paneSets[key]), glassMats[key], `Glazing_${key}`);
    m.userData.noShadow = true;
    m.renderOrder = 1;
  }

  // ---- iron frame
  const frame = new GeoBatch();
  const rivets = new RivetSet(0.02);
  const unitBox = (w, d) => new THREE.BoxGeometry(w, 1, d);
  const ribGeo = unitBox(0.24, 0.34);
  const purlinGeo = unitBox(0.16, 0.2);
  const mullionGeo = unitBox(0.07, 0.12);
  const inset = (p, depth) => p.clone().addScaledVector(outward(p), -depth);

  const ribSteps = 26;
  for (let j = 0; j < sides; j++) {
    for (let s = 0; s < ribSteps; s++) {
      const a0 = (aTop * s) / ribSteps;
      const a1 = (aTop * (s + 1)) / ribSteps;
      const p0 = P(j + 1, 0, a0);
      const p1 = P(j + 1, 0, a1);
      const n = outward(p0.clone().lerp(p1, 0.5));
      frame.segment(ribGeo, inset(p0, 0.17), inset(p1, 0.17), n);
      // double rivet row on the rib's inner flange
      const side = new THREE.Vector3().crossVectors(p1.clone().sub(p0), n).normalize();
      for (let t = 0; t < 2; t++) {
        const pr = inset(p0.clone().lerp(p1, t / 2), 0.345);
        rivets.add(pr.clone().addScaledVector(side, 0.075), n.clone().negate());
        rivets.add(pr.clone().addScaledVector(side, -0.075), n.clone().negate());
      }
    }
  }
  for (let i = 1; i <= RINGS; i++) {
    const a = ringA(i);
    for (let k = 0; k < sides; k++) {
      const p0 = P(k, 0, a);
      const p1 = P(k, 1, a);
      const n = outward(p0.clone().lerp(p1, 0.5));
      const g = i === RINGS ? unitBox(0.3, 0.34) : purlinGeo;
      frame.segment(g, inset(p0, 0.1), inset(p1, 0.1), n);
      // gusset plate where purlin meets rib
      const gp = inset(p0, 0.3);
      rivets.add(gp.clone().addScaledVector(p1.clone().sub(p0).normalize(), 0.2), n.clone().negate());
    }
  }
  for (let k = 0; k < sides; k++) {
    for (let j = 1; j < COLUMNS; j++) {
      const u = j / COLUMNS;
      for (let i = 0; i < RINGS; i++) {
        const p0 = P(k, u, ringA(i));
        const p1 = P(k, u, ringA(i + 1));
        const n = outward(p0.clone().lerp(p1, 0.5));
        frame.segment(mullionGeo, inset(p0, 0.06), inset(p1, 0.06), n);
      }
    }
  }
  // springing ring on the cornice
  for (let k = 0; k < sides; k++) {
    const p0 = P(k, 0, 0);
    const p1 = P(k, 1, 0);
    frame.segment(unitBox(0.3, 0.5), inset(p0, 0.2).setY(H + 0.12), inset(p1, 0.2).setY(H + 0.12), new THREE.Vector3(0, 1, 0));
  }
  root.add(frame.build(M.castIron, 'DomeFrame'));
  root.add(rivets.build(M.castIron, 'DomeRivets'));

  // ---- oculus lantern
  const lantern = group('OculusLantern', root, [0, H + D * Math.sin(aTop), 0]);
  const lr = Ro * 0.98;
  const lh = 1.1;
  const post = new GeoBatch();
  const lanternGlass = [];
  for (let k = 0; k < sides; k++) {
    const d0 = vertexDir(k - 1).multiplyScalar(lr);
    const d1 = vertexDir(k).multiplyScalar(lr);
    post.segment(new THREE.BoxGeometry(0.1, 1, 0.1), d1.clone(), d1.clone().setY(lh));
    lanternGlass.push([d0.clone(), d1.clone(), d1.clone().setY(lh), d0.clone().setY(lh)]);
  }
  post.add(new THREE.CylinderGeometry(lr + 0.1, lr + 0.1, 0.12, sides, 1, false, Math.PI / 8).translate(0, lh, 0));
  lantern.add(post.build(M.castIron, 'LanternFrame'));
  const lg = add(lantern, paneGeometry(lanternGlass), M.domeGlassDusty, 'LanternGlass');
  lg.userData.noShadow = true;
  add(lantern, new THREE.ConeGeometry(lr + 0.25, 1.0, sides, 1, false, Math.PI / 8), M.copper, 'LanternRoof', [0, lh + 0.56, 0]);
  add(lantern, new THREE.SphereGeometry(0.16, 16, 10), M.brassAged, 'Finial', [0, lh + 1.12, 0]);
  add(lantern, new THREE.CylinderGeometry(0.02, 0.04, 0.6, 8), M.brassAged, 'FinialSpike', [0, lh + 1.45, 0]);

  return { object: root, panels };
}
