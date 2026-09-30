import * as THREE from 'three';

// 將 XY 平面的 Shape 擠出成「平躺」網格：厚度朝 +Y，Shape 的 y 對應世界 -Z。
export function extrudeFlat(shape, depth, material, bevel = 0.002, curveSegments = 24) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, curveSegments,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// 旋轉體：profile 為 [r, y] 陣列，回傳沿 +X 方向（y→x）的網格。
export function latheAlongX(profile, material, segments = 48) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.rotateZ(-Math.PI / 2);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function latheY(profile, material, segments = 48) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, segments), material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function mesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// 沿 X 軸的圓柱
export function cylinderX(rTop, rBot, len, material, seg = 32) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, seg);
  g.rotateZ(-Math.PI / 2);
  return mesh(g, material);
}

// 帶縱向溝槽（滾花／木柄凹槽）的圓柱，沿 X 軸
export function flutedCylinderX(radius, len, flutes, depth, material, seg = 96, taper = 0) {
  const g = new THREE.CylinderGeometry(radius, radius, len, seg, 24);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const r = Math.hypot(v.x, v.z);
    if (r < 1e-5) continue;
    const yN = v.y / len + 0.5; // 0..1
    const bulge = 1 + taper * Math.sin(Math.PI * yN);
    const k = (1 - depth * Math.pow(Math.max(0, Math.cos(a * flutes)), 2)) * bulge;
    p.setXYZ(i, (v.x / r) * radius * k, v.y, (v.z / r) * radius * k);
  }
  g.computeVertexNormals();
  g.rotateZ(-Math.PI / 2);
  return mesh(g, material);
}

// 圓角矩形 Shape
export function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function circlePath(x, y, r) {
  const p = new THREE.Path();
  p.absarc(x, y, r, 0, Math.PI * 2, true);
  return p;
}

// 半徑沿長度漸變的管（用於劃線針彎尖等）
export function taperTube(curve, r0, r1, material, tubular = 48, radial = 16) {
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const p = geo.attributes.position;
  const pts = curve.getSpacedPoints(tubular);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / (radial + 1));
    const c = pts[Math.min(ring, tubular)];
    const t = ring / tubular;
    v.fromBufferAttribute(p, i).sub(c).setLength(r0 + (r1 - r0) * t).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return mesh(geo, material);
}

// 超橢圓輪廓點（鏡片等圓角方形）
export function superellipsePoints(a, b, n = 3, count = 64) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    pts.push(new THREE.Vector2(a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)));
  }
  return pts;
}
