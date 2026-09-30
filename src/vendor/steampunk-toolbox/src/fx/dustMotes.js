// 光錐中的漂浮塵埃：GPU 驅動的 Points（位置於著色器中漂移與循環）
import * as THREE from 'three';

export function createDustMotes(count, apex, target, radius) {
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = Math.random(); seeds[i * 4 + 1] = Math.random();
    seeds[i * 4 + 2] = Math.random(); seeds[i * 4 + 3] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uApex: { value: apex.clone() }, uTarget: { value: target.clone() },
      uRadius: { value: radius }, uPixel: { value: 1 }, uColor: { value: new THREE.Color(0xffe6c0) },
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime; uniform vec3 uApex; uniform vec3 uTarget; uniform float uRadius; uniform float uPixel;
      varying float vTw; varying float vFade;
      void main(){
        float h = fract(aSeed.x + uTime * (0.006 + aSeed.w * 0.01));  // 緩慢下沉並循環
        h = 0.18 + h * 0.95;
        vec3 axis = uTarget - uApex;
        vec3 center = uApex + axis * h;
        float r = uRadius * h * sqrt(aSeed.y) * 0.9;
        float ang = aSeed.z * 6.2831 + uTime * (0.05 + aSeed.w * 0.08);
        vec3 side = normalize(cross(axis, vec3(0.0,0.0,1.0)));
        vec3 side2 = normalize(cross(axis, side));
        vec3 p = center + (side * cos(ang) + side2 * sin(ang)) * r;
        p += vec3(sin(uTime*0.7+aSeed.x*40.0), cos(uTime*0.5+aSeed.y*30.0), sin(uTime*0.6+aSeed.z*20.0)) * 0.01;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.0 + aSeed.w * 2.0) * uPixel * (1.6 / -mv.z);
        vTw = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed.w * 2.0) + aSeed.x * 50.0);
        vFade = smoothstep(0.18, 0.3, h) * (1.0 - smoothstep(0.95, 1.13, h));
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; uniform vec3 uColor; varying float vTw; varying float vFade;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * uOpacity * vTw * vFade * 0.9;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  points.name = 'DustMotes';
  return {
    points,
    setPixelRatio(pr, height) { mat.uniforms.uPixel.value = pr * height / 900 * 3.2; },
    update(time, s) { mat.uniforms.uTime.value = time; mat.uniforms.uOpacity.value = s; points.visible = s > 0.01; },
  };
}
