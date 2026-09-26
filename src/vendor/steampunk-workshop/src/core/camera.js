import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, ROOM } from '../config/layout.js';

// Third-person orbit camera with damped rotation, eased zoom and hard spatial limits.
export function createCameraRig(domElement) {
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, domElement.clientWidth / domElement.clientHeight || 1, 0.05, 140);
  camera.position.copy(CAMERA.position);

  const controls = new OrbitControls(camera, domElement);
  controls.target.copy(CAMERA.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.45;
  controls.panSpeed = 0.55;
  controls.screenSpacePanning = true;
  controls.enableZoom = false; // replaced by the eased zoom below
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.autoRotateSpeed = 0.22;
  controls.update();

  let desiredDistance = camera.position.distanceTo(controls.target);
  let idle = 0;
  let enabled = true;
  let idleAutoRotate = true; // start a slow orbit after 30 s without input
  let flight = null; // active flyTo() transition
  const listeners = [];
  const on = (el, type, fn, opts) => {
    el.addEventListener(type, fn, opts);
    listeners.push([el, type, fn, opts]);
  };

  const clampDistance = (d) => THREE.MathUtils.clamp(d, CAMERA.minDistance, CAMERA.maxDistance);
  const wake = () => {
    idle = 0;
    controls.autoRotate = false;
    flight = null;
  };

  on(
    domElement,
    'wheel',
    (e) => {
      if (!enabled) return;
      e.preventDefault();
      wake();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      desiredDistance = clampDistance(desiredDistance * Math.exp(delta * 0.0012));
    },
    { passive: false },
  );

  // pinch zoom for touch screens
  const touches = new Map();
  let pinchStart = 0;
  let pinchBase = desiredDistance;
  const pinchDistance = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  on(domElement, 'pointerdown', (e) => {
    if (!enabled) return;
    wake();
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      pinchStart = pinchDistance();
      pinchBase = desiredDistance;
    }
  });
  on(domElement, 'pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinchStart > 0) {
      desiredDistance = clampDistance(pinchBase * (pinchStart / Math.max(1, pinchDistance())));
    }
  });
  const release = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchStart = 0;
  };
  on(domElement, 'pointerup', release);
  on(domElement, 'pointercancel', release);

  const offset = new THREE.Vector3();

  function clampTarget() {
    const t = controls.target;
    const r = Math.hypot(t.x, t.z);
    if (r > CAMERA.targetMaxRadius) {
      t.x *= CAMERA.targetMaxRadius / r;
      t.z *= CAMERA.targetMaxRadius / r;
    }
    t.y = THREE.MathUtils.clamp(t.y, CAMERA.targetMinY, CAMERA.targetMaxY);
  }

  // Keeps the camera inside the brick walls (below the dome springing) and inside the dome shell.
  function clampCamera() {
    const p = camera.position;
    const H = ROOM.wallHeight;
    const D = ROOM.domeRise;
    p.y = THREE.MathUtils.clamp(p.y, CAMERA.minY, H + D - 1.4);
    let maxR = CAMERA.maxRadius;
    if (p.y > H - 1) {
      const k = Math.max(0, (p.y - (H - 1)) / (D + 1));
      maxR = Math.min(maxR, ROOM.apothem * Math.sqrt(Math.max(0, 1 - k * k)) - 1.6);
      maxR = Math.max(maxR, 0.5);
    }
    const r = Math.hypot(p.x, p.z);
    if (r > maxR) {
      p.x *= maxR / r;
      p.z *= maxR / r;
      return true;
    }
    return false;
  }

  function update(dt) {
    idle += dt;
    if (enabled && idleAutoRotate && idle > 30 && !controls.autoRotate) controls.autoRotate = true;

    if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.duration);
      const e = flight.t * flight.t * (3 - 2 * flight.t);
      camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
      desiredDistance = camera.position.distanceTo(controls.target);
      if (flight.t >= 1) flight = null;
    }

    // eased zoom along the current view ray
    offset.subVectors(camera.position, controls.target);
    const dist = offset.length();
    const k = 1 - Math.exp(-dt * 6.5);
    const next = dist + (desiredDistance - dist) * k;
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), next);

    controls.update(dt);
    clampTarget();
    if (clampCamera()) {
      const actual = camera.position.distanceTo(controls.target);
      if (desiredDistance > actual) desiredDistance = Math.max(CAMERA.minDistance, actual);
    }
  }

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setView(position, target) {
    controls.target.copy(target);
    camera.position.copy(position);
    desiredDistance = clampDistance(position.distanceTo(target));
    controls.update();
  }

  // Smoothly move to a new view (eased); user input cancels it.
  function flyTo(position, target, duration = 1.6) {
    flight = {
      t: 0,
      duration: Math.max(0.01, duration),
      fromPos: camera.position.clone(),
      toPos: position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
    };
    idle = 0;
    controls.autoRotate = false;
  }

  // Disable when the game needs the pointer (e.g. clicking machine parts).
  function setEnabled(value) {
    enabled = value;
    controls.enabled = value;
    if (!value) controls.autoRotate = false;
  }

  function setIdleAutoRotate(value) {
    idleAutoRotate = value;
    if (!value) controls.autoRotate = false;
  }

  function dispose() {
    for (const [el, type, fn, opts] of listeners) el.removeEventListener(type, fn, opts);
    controls.dispose();
  }

  return { camera, controls, update, resize, setView, flyTo, setEnabled, setIdleAutoRotate, dispose };
}
