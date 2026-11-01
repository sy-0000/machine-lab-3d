// 離線幾何檢查（不需要 Unity）：用匯出的 glb 與 machine_*_runtime.json，檢查
//   1) 車床：槌柄工件前 40 mm（夾持區）是否落在三爪夾頭的夾爪範圍內；
//   2) 鑽床：程序化鑽頭的刀柄頂端位置（＝原有 TwistDrill 節點原點）與夾頭（鑽夾頭）是否重疊、刀尖是否在主軸軸線上。
// 用法：node scripts/check-geometry.mjs   （座標全部是 three.js 的機台局部座標，公尺）
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { Matrix4, Vector3, Quaternion, Box3 } from 'three';
import { readFileSync } from 'node:fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const localOf = n => new Matrix4().compose(new Vector3(...n.getTranslation()), new Quaternion(...n.getRotation()), new Vector3(...n.getScale()));
function index(doc) {
  const parent = new Map();
  for (const n of doc.getRoot().listNodes()) for (const c of n.listChildren()) parent.set(c, n);
  const world = n => { const m = localOf(n); for (let p = parent.get(n); p; p = parent.get(p)) m.premultiply(localOf(p)); return m; };
  const byName = name => doc.getRoot().listNodes().filter(n => n.getName() === name);
  return { parent, world, byName };
}
// 子樹所有頂點在 frame 節點座標中的包圍盒（可用 filter 只取名稱符合的網格）
function boxIn(ix, subtree, frameInv, filter = () => true) {
  const box = new Box3(), v = new Vector3(), tmp = [0, 0, 0];
  const visit = n => {
    const mesh = n.getMesh();
    if (mesh && filter(n)) { const m = new Matrix4().multiplyMatrices(frameInv, ix.world(n)); for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION'); for (let i = 0; i < a.getCount(); i++) { a.getElement(i, tmp); box.expandByPoint(v.fromArray(tmp).applyMatrix4(m)); } } }
    n.listChildren().forEach(visit);
  };
  visit(subtree); return box;
}
const f = (b, k) => `${(b.min[k] * 1000).toFixed(1)}…${(b.max[k] * 1000).toFixed(1)} mm`;

// ---- 車床
{
  const cfg = JSON.parse(readFileSync('exports/machine_lathe_runtime.json', 'utf8'));
  const doc = await io.read('exports/machine_lathe_interactive.glb'), ix = index(doc);
  const chuck = ix.byName(cfg.mounts.workpiece.parent)[0];
  const inv = ix.world(chuck).invert();
  const all = boxIn(ix, chuck, inv);
  const jaws = boxIn(ix, chuck, inv, n => /jaw/i.test(n.getName()));
  const mountX = cfg.mounts.workpiece.position[0];
  console.log('車床 ChuckAssembly 局部座標（工件沿 +X）');
  console.log(`  夾頭整體 x ${f(all, 'x')}；夾爪 ${jaws.isEmpty() ? '（找不到名稱含 jaw 的網格）' : 'x ' + f(jaws, 'x') + '，y ' + f(jaws, 'y') + '，z ' + f(jaws, 'z')}`);
  console.log(`  工件掛點 x = ${(mountX * 1000).toFixed(1)} mm；夾持區 x ${(mountX * 1000).toFixed(1)}…${((mountX + 0.04) * 1000).toFixed(1)} mm；工件半徑 10 mm`);
  const names = new Set(); const visit = n => { if (n.getMesh()) names.add(n.getName()); n.listChildren().forEach(visit); }; visit(chuck);
  console.log('  夾頭內的網格：', [...names].slice(0, 30).join(', '));
  if (!jaws.isEmpty()) {
    const overlap = Math.min(jaws.max.x, mountX + 0.04) - Math.max(jaws.min.x, mountX);
    console.log(`  → 夾持區與夾爪沿軸向重疊 ${(overlap * 1000).toFixed(1)} mm（> 0 表示工件有一段在夾爪裡）`);
  }
}

// ---- 鑽床
{
  const cfg = JSON.parse(readFileSync('exports/machine_drill_runtime.json', 'utf8'));
  for (const file of ['exports/machine_drill_interactive.glb', 'exports/machine_drill_static.glb']) {
    const doc = await io.read(file), ix = index(doc);
    const drill = ix.byName('TwistDrill')[0], spindle = ix.byName(cfg.spindle.node)[0];
    if (!drill || !spindle) continue;
    const inv = ix.world(spindle).invert();
    const origin = new Vector3().applyMatrix4(new Matrix4().multiplyMatrices(inv, ix.world(drill)));
    const drillBox = boxIn(ix, drill, inv);
    const chuckBox = boxIn(ix, spindle, inv, n => /chuck/i.test(n.getName()) && !/twist|drill/i.test(n.getName()));
    console.log(`鑽床 ${file}（${cfg.spindle.node} 局部座標）`);
    console.log(`  原有 TwistDrill 原點 (${(origin.x * 1000).toFixed(1)}, ${(origin.y * 1000).toFixed(1)}, ${(origin.z * 1000).toFixed(1)}) mm；鑽頭網格 y ${f(drillBox, 'y')}，x ${f(drillBox, 'x')}，z ${f(drillBox, 'z')}`);
    console.log(`  鑽夾頭 ${chuckBox.isEmpty() ? '（找不到名稱含 chuck 的網格）' : 'y ' + f(chuckBox, 'y') + '，x ' + f(chuckBox, 'x') + '，z ' + f(chuckBox, 'z')}`);
    console.log(`  主軸軸線（pivot 世界座標）${JSON.stringify(cfg.spindle.pivot)}；掛點 ${JSON.stringify(cfg.mounts.tool.position)}`);
    for (const id of ['head_drill_85', 'head_drill_10']) {
      const shank = 0.025, cut = 0.049;
      console.log(`  Unity 的 ${id}：刀柄頂 y=${(origin.y * 1000).toFixed(1)}，刀柄 ${(origin.y * 1000 - shank * 1000).toFixed(1)}…${(origin.y * 1000).toFixed(1)}，刀尖 y=${((origin.y - shank - cut) * 1000).toFixed(1)} mm`);
    }
    break;
  }
}
