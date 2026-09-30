// 體積光錐：加法混合的開口圓錐，沿長度與邊緣（視角菲涅耳）柔和衰減，並帶緩慢流動的雜訊
import * as THREE from 'three';

export function createVolumetricCone(apex, target, radiusAtTarget) {
  const dir = target.clone().sub(apex);
  const len = dir.length() * 1.25;
  const radius = radiusAtTarget * 1.25;
  const geo = new THREE.ConeGeometry(radius, len, 64, 24, true);
  geo.translate(0, -len / 2, 0); // 頂點位於原點
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 }, uLen: { value: len }, uColor: { value: new THREE.Color(0xffe2b0) } },
    vertexShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vNormalW; varying float vH;
      uniform float uLen;
      void main(){
        vH = -position.y / uLen;
        vec4 w = modelMatrix * vec4(position,1.0);
        vWorld = w.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vNormalW; varying float vH;
      uniform float uOpacity; uniform float uTime; uniform vec3 uColor;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        vec3 V = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vNormalW), V));
        float edge = pow(facing, 2.2);
        float along = smoothstep(0.0, 0.12, vH) * (1.0 - smoothstep(0.55, 1.0, vH));
        float n = 0.75 + 0.25 * noise(vWorld * 3.0 + vec3(0.0, -uTime * 0.15, uTime * 0.05));
        float a = uOpacity * edge * along * n * 0.42;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.position.copy(apex);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  cone.renderOrder = 5;
  cone.frustumCulled = false;
  cone.name = 'VolumetricCone';
  return {
    mesh: cone,
    update(time, s) { mat.uniforms.uTime.value = time; mat.uniforms.uOpacity.value = s; cone.visible = s > 0.01; },
  };
}
