import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, MathUtils } from 'three';
import { CAMERA, ROOM } from '../vendor/steampunk-workshop/src/config/layout.js';
import { resolveQuality } from '../vendor/steampunk-workshop/src/config/quality.js';
import { createScene } from '../vendor/steampunk-workshop/src/core/scene.js';
import { createSky } from '../vendor/steampunk-workshop/src/core/sky.js';
import { createPostPipeline } from '../vendor/steampunk-workshop/src/core/postprocessing.js';
import { buildWorld } from '../vendor/steampunk-workshop/src/app/world.js';
import { createLights } from '../vendor/steampunk-workshop/src/lighting/lights.js';
import { createEffects } from '../vendor/steampunk-workshop/src/effects/effects.js';

// 蒸汽龐克穹頂工作室（src/vendor/steampunk-workshop，未修改）當作機台操作的背景。
// 不用 createWorkshop()（它會自己開 renderer 與迴圈），而是把同一套房間、燈光、天空、粒子與後製
// 直接建進 R3F 的場景：機台照得到工作室的光、影子落在水泥地上，也只有一個 WebGL context。
// 工作室單位是公尺，機台模型也是公尺，所以不縮放；房間中央的機台位對齊機台中心，地板對齊機台底部。

// Yaw of the workshop's default view (camera → target); the room is turned so the machine's front sees this side.
const ROOM_YAW = Math.atan2(CAMERA.position.x - CAMERA.target.x, CAMERA.position.z - CAMERA.target.z);

// Keep the camera inside the brick walls and the dome, and the orbit target near the centre (room-local coordinates).
function clampToRoom(camera, orbit, base) {
  const p = camera.position, H = ROOM.wallHeight, D = ROOM.domeRise;
  p.y = MathUtils.clamp(p.y, base + CAMERA.minY * .5, base + H + D - 1.4);
  const y = p.y - base, k = Math.max(0, (y - (H - 1)) / (D + 1));
  const maxR = y > H - 1 ? Math.max(.5, Math.min(CAMERA.maxRadius, ROOM.apothem * Math.sqrt(Math.max(0, 1 - k * k)) - 1.6)) : CAMERA.maxRadius;
  const r = Math.hypot(p.x, p.z);
  if (r > maxR) { p.x *= maxR / r; p.z *= maxR / r; }
  const t = orbit?.target;
  if (!t) return;
  const tr = Math.hypot(t.x, t.z);
  if (tr > CAMERA.targetMaxRadius) { t.x *= CAMERA.targetMaxRadius / tr; t.z *= CAMERA.targetMaxRadius / tr; }
  t.y = MathUtils.clamp(t.y, base, base + CAMERA.targetMaxY);
}

/**
 * @param {number} floor    world y of the workshop floor (machine bottom, or the pedestal foot)
 * @param {number} facing   yaw of the machine's operator side (see frontYaw)
 * @param {boolean} low     low graphics: 'low' quality tier (no post, fewer particles)
 * @param {Function} onReady called once the room is built and shown
 */
export default function SteampunkWorkshopWorld({ floor, facing = 0, low = false, onReady }) {
  const { gl, scene, camera, size, controls, invalidate } = useThree();
  const room = useRef(null), post = useRef(null), elapsed = useRef(0), frame = useRef(0), ready = useRef(onReady);
  ready.current = onReady;
  const quality = useRef(null);
  quality.current ??= resolveQuality(low ? 'low' : new URLSearchParams(location.search).get('quality') || 'medium');

  // Build the room once per renderer: fog + reflections on the R3F scene, everything else in one group.
  useEffect(() => {
    let cancelled = false;
    const q = quality.current, root = new Group();
    root.name = 'SteampunkWorkshop';
    const env = createScene(gl);
    const saved = { environment: scene.environment, environmentIntensity: scene.environmentIntensity, fog: scene.fog, background: scene.background };
    const autoUpdate = gl.shadowMap.autoUpdate;
    (async () => {
      const sky = createSky(root);
      const world = await buildWorld(root, q);
      if (cancelled) return;
      const lights = createLights(root, q, world.anchors);
      const effects = world.panels ? createEffects(root, gl, camera, q, world) : null;
      Object.assign(scene, { environment: env.environment, environmentIntensity: env.environmentIntensity, fog: env.fog, background: null });
      scene.add(root);
      // The room is static; like createWorkshop(), refresh the shadow map every other frame.
      gl.shadowMap.autoUpdate = false;
      gl.shadowMap.needsUpdate = true;
      room.current = { root, world, lights, effects, sky };
      effects?.resize();
      invalidate();
      ready.current?.();
    })().catch(error => console.error('蒸汽龐克工作室載入失敗', error));
    return () => {
      cancelled = true;
      scene.remove(root);
      Object.assign(scene, saved);
      gl.shadowMap.autoUpdate = autoUpdate;
      env.environment?.dispose();
      root.traverse(o => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
      });
      room.current = null;
    };
  }, [gl, scene]); // eslint-disable-line react-hooks/exhaustive-deps -- the camera is only read for particle sizes (see resize below)

  // Bloom, warm grade and vignette from the workshop's post pipeline (the 'low' tier renders directly).
  useEffect(() => {
    const p = createPostPipeline(gl, scene, camera, quality.current);
    post.current = p;
    return () => { p.dispose(); if (post.current === p) post.current = null; };
  }, [gl, scene, camera]);
  useEffect(() => {
    post.current?.setSize(size.width, size.height);
    room.current?.effects?.resize();
  }, [size, gl, camera]);

  // Priority 1: this takes over rendering from R3F (so the post pipeline draws the frame).
  useFrame((state, delta) => {
    const dt = Math.min(delta, .05), current = room.current;
    if (current) {
      // Stand the slot on the machine's floor and turn the room so the operator side looks across it.
      current.root.position.y = floor;
      current.root.rotation.y = facing - ROOM_YAW;
      elapsed.current += dt;
      if (frame.current++ % 2 === 0) gl.shadowMap.needsUpdate = true;
      clampToRoom(camera, controls, floor);
      current.world.update(dt, elapsed.current, camera);
      current.lights.update(elapsed.current);
      current.effects?.update(dt, elapsed.current);
      current.sky.update(dt, elapsed.current);
      state.invalidate(); // steam, dust, gears and the pendulum keep moving
    }
    if (post.current) post.current.render(dt, elapsed.current);
    else gl.render(scene, camera);
  }, 1);
  return null;
}
