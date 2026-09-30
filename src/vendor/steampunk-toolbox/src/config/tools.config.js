// 資料驅動的工具清單：新增工具＝新增一筆資料＋一個模型模組，主程式不需修改。
// quantity : 面板顯示的數量；count：模型實際件數（成組收納與展示）
// slot     : 凹槽中心位置（工具盒座標，x 左右、z 前後，單位同場景）與 Y 軸旋轉
// display  : 展示時的歐拉角（弧度）與縮放
import { createVernierCaliper } from '../assets/tools/vernierCaliper.js';
import { createSteelRuler } from '../assets/tools/steelRuler.js';
import { createHexKey } from '../assets/tools/hexKey.js';
import { createTrySquare } from '../assets/tools/trySquare.js';
import { createFileSet } from '../assets/tools/fileSet.js';
import { createKnurlingTool } from '../assets/tools/knurlingTool.js';
import { createCenterPunch } from '../assets/tools/centerPunch.js';
import { createScriber } from '../assets/tools/scriber.js';
import { createPaintBrush } from '../assets/tools/paintBrush.js';
import { createBrassWireBrush } from '../assets/tools/brassWireBrush.js';
import { createJawCovers } from '../assets/tools/jawCovers.js';
import { createShimSet } from '../assets/tools/shimSet.js';
import { createSafetyGlasses } from '../assets/tools/safetyGlasses.js';

const HALF_PI = Math.PI / 2;

export const TOOLS = [
  {
    id: 'vernier-caliper', name: '150mm 游標卡尺', quantity: '×1',
    description: '量測外徑、內徑、深度與階差，最大量程 150 mm。先讀游標零線前的主尺整數毫米，再找游標與主尺對齊的刻線，最小讀值 0.02 mm。量測時爪面輕貼工件即可，不要用力夾緊。',
    model: createVernierCaliper,
    slot: { x: -0.25, z: 0.0, rotY: HALF_PI },
    display: { rotation: [1.0, 0, 0.12], scale: 1.15 },
  },
  {
    id: 'steel-ruler', name: '150mm 鋼尺', quantity: '×1',
    description: '正面上緣為公制刻度（最小 0.5 mm），下緣為英制。用來粗量長度，也是劃線針劃直線時的導引。讀數時視線要垂直刻度面，避免視差。',
    model: createSteelRuler,
    slot: { x: -0.095, z: 0.0, rotY: HALF_PI },
    display: { rotation: [1.05, 0, 0.1], scale: 1.5 },
  },
  {
    id: 'hex-key', name: 'M8 六角扳手', quantity: '×1',
    description: '對邊 6 mm 的 L 型內六角扳手，用來鎖緊或鬆開 M8 內六角螺絲。長臂端力臂大、好施力；球頭端可斜插快速旋轉。',
    model: createHexKey,
    slot: { x: 0.77, z: -0.06, rotY: 0 },
    display: { rotation: [0.7, 0, 0.3], scale: 2.0 },
  },
  {
    id: 'try-square', name: '直角規', quantity: '×1',
    description: '檢查工件兩面是否互相垂直，也可作為劃垂直線的基準。把規座貼緊基準面，觀察規片與工件之間有沒有透光縫隙。避免摔落，否則角度會失準。',
    model: createTrySquare,
    slot: { x: 0.43, z: 0.27, rotY: 0 },
    display: { rotation: [1.0, 0, 0.05], scale: 1.9 },
  },
  {
    id: 'files', name: '銼刀', quantity: '×3', count: 3,
    description: '平銼、半圓銼、圓銼各一支，用於去毛邊、修平面、修內圓弧與孔。只在往前推時切削，拉回時稍微提起，避免磨損銼齒；使用前確認木柄已裝緊。',
    model: createFileSet,
    slot: { x: -0.79, z: 0.0, rotY: HALF_PI },
    display: { rotation: [0.9, 0, 0.2], scale: 1.0 },
  },
  {
    id: 'knurling-tool', name: '壓花刀', quantity: '×1',
    description: '裝在車床刀座上，把兩只滾花輪壓進旋轉的工件表面，滾出菱形花紋、增加握持摩擦力。以低轉速進行並加切削油，第一刀就要壓足深度，花紋才不會亂。',
    model: createKnurlingTool,
    slot: { x: 0.17, z: 0.0, rotY: HALF_PI },
    display: { rotation: [0.6, 0, 0.25], scale: 1.3 },
  },
  {
    id: 'center-punch', name: '中心沖', quantity: '×1',
    description: '在劃線交點或孔位敲出錐形小凹點，讓鑽頭定位、不會滑走。先輕敲確認位置正確，再用手鎚敲定。',
    model: createCenterPunch,
    slot: { x: 0.065, z: 0.0, rotY: HALF_PI },
    display: { rotation: [0.3, 0, 0.3], scale: 1.9 },
  },
  {
    id: 'scriber', name: '劃線針', quantity: '×1',
    description: '在工件表面刻出細而清楚的加工線，常搭配鋼尺與直角規使用。直尖用於一般劃線，彎尖可伸進孔內劃線。針尖很利，收納時尖端朝內。',
    model: createScriber,
    slot: { x: -0.005, z: 0.0, rotY: HALF_PI },
    display: { rotation: [0.5, 0, 0.25], scale: 1.5 },
  },
  {
    id: 'paint-brush', name: '毛刷', quantity: '×1',
    description: '清除機台、虎鉗與工件上的切屑。清切屑一定要用毛刷，絕對不可以徒手撥或用嘴吹，以免割傷或切屑噴進眼睛。',
    model: createPaintBrush,
    slot: { x: -0.43, z: 0.0, rotY: HALF_PI },
    display: { rotation: [0.95, 0, 0.2], scale: 1.1 },
  },
  {
    id: 'brass-brush', name: '銅刷', quantity: '×1',
    description: '以細黃銅絲清除銼刀齒縫中卡住的屑料，以及工件表面的毛邊與鏽斑。銅比鋼軟，不容易刮傷工件表面。',
    model: createBrassWireBrush,
    slot: { x: -0.58, z: 0.0, rotY: HALF_PI },
    display: { rotation: [0.6, 0, 0.2], scale: 0.95 },
  },
  {
    id: 'jaw-covers', name: '鉗口罩', quantity: '×2', count: 2,
    description: '套在虎鉗鉗口上的紅銅軟護片，內側有磁鐵可直接吸附。夾持已加工面時，能避免鉗口的齒紋壓傷工件，兩片成對使用。',
    model: createJawCovers,
    slot: { x: 0.77, z: 0.27, rotY: 0 },
    display: { rotation: [0.45, 0.5, 0], scale: 2.0 },
  },
  {
    id: 'shims', name: '墊片', quantity: '數片',
    description: '墊在虎鉗內工件的下方，把工件架高到合適的加工高度，並讓工件底面保持平行。片上有打印厚度，可依需要組合使用。',
    model: createShimSet,
    slot: { x: 0.77, z: -0.33, rotY: HALF_PI },
    display: { rotation: [1.0, 0, 0.1], scale: 2.1 },
  },
  {
    id: 'safety-glasses', name: '安全護目鏡', quantity: '×2', count: 2,
    description: '一體式弧形鏡片加上軟質密合框，能完整包覆眼睛周圍，擋住切屑、砂輪粉屑與切削液噴濺；也可以直接戴在近視眼鏡外面。兩側的間接通氣孔可減少起霧，鬆緊帶可調整鬆緊。',
    model: createSafetyGlasses,
    slot: { x: 0.43, z: -0.265, rotY: HALF_PI },
    display: { rotation: [1.05, 0, 0], scale: 1.35 },
  },
];
