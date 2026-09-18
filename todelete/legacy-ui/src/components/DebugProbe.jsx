import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Vector2, Raycaster } from 'three';
import { LATHE_PARTS, findInteractiveAncestor } from '../lathe';
// 開發模式唯讀快照供實際 pointer 瀏覽器測試使用；不暴露修改場景的 API。
export default function DebugProbe({ model, controls, orbit, interaction }) {
  const { camera, gl } = useThree();
  const elapsed = useRef(0);
  const cached = useRef({signature:'',picks:{}});
  useEffect(() => () => { delete window.__LATHE_DEBUG__; }, []);
  useFrame((_, delta) => {
    elapsed.current += delta;
    const rect = gl.domElement.getBoundingClientRect();
    camera.updateMatrixWorld();
    const ray = new Raycaster();
    const signature=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements,...Object.values(controls.offsets),...Object.values(controls.machine.angles),model.drive.leverAngle,rect.left,rect.top,rect.width,rect.height].map(v=>v.toFixed(5)).join(',');
    let picks=cached.current.picks;
    model.scene.updateWorldMatrix(true,true);
    if(!interaction.pressed && signature!==cached.current.signature){
    picks={};
    for (const name of Object.keys(LATHE_PARTS).filter(key => LATHE_PARTS[key].pivotName)) {
      if(!model.availability[name]){picks[name]=[];continue;}
      const candidates = [];
      model.nodes[LATHE_PARTS[name].pivotName].traverse(mesh => {
        const attr = mesh.geometry?.attributes.position; if (!attr || candidates.length>=2) return;
        const index = mesh.geometry.index;
        const count = index?.count ?? attr.count;
        for (let i = 0; i + 2 < count; i += Math.max(1, Math.floor(count / 600)) * 3) {
          const point = new Vector3();
          for (let j = 0; j < 3; j++) point.add(new Vector3().fromBufferAttribute(attr, index ? index.getX(i + j) : i + j));
          point.divideScalar(3).applyMatrix4(mesh.matrixWorld).project(camera);
          if (Math.abs(point.x) > 0.95 || Math.abs(point.y) > 0.9 || point.z > 1) continue;
          ray.setFromCamera(new Vector2(point.x, point.y), camera);
          if (findInteractiveAncestor(ray.intersectObject(model.scene, true)[0]?.object)?.userData.controlKey === name) candidates.push({ x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 });
          if (candidates.length >= 2) break;
        }
      });
      picks[name] = candidates;
    }
    cached.current={signature,picks};
    }
    window.__LATHE_DEBUG__ = { lastHit:model.lastHit,inputReady:model.inputReady, interaction, picks, drive: {...model.drive}, availability:model.availability, missing:model.missing, attachments:model.attachmentChecks, sourceCount:model.sourceNodeCount, reachableCount:model.sourceInventory.length-1, ownership:model.ownership, orbitEnabled: orbit.current?.enabled, camera: camera.position.toArray(), offsets: controls.offsets, angles: controls.machine.angles, nodes: Object.fromEntries(Object.entries({...model.sources,...model.nodes}).filter(([,n])=>n.parent).map(([name, node]) => [name, { position: node.position.toArray(), rotation: node.rotation.toArray().slice(0, 3), world: node.getWorldPosition(new Vector3()).toArray(), quaternion: node.getWorldQuaternion(camera.quaternion.clone()).toArray(), parent:node.parent?.name }])) };
  });
  return null;
}




