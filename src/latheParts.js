// Coordinates are measured in the original GLB WORLD frame (X = bed, Y = up, Z = front).
// GLTFLoader sanitizes spaces in source group names to underscores. Object_XXX names are unchanged.
export const MODEL_NAME = 'machines/lathe/lathe.glb';
export const LATHE_PARTS = {
  spindle: { objectNames: ['Object_78::shaft'], axis: 'x', pivot: [-0.267, 0.8525885, -0.0216612] },
  chuck: { objectNames: ['Object_78::chuckBody', 'Object_80'], parent: 'spindle' },
  carriageHandwheel: { wheelObjects: ['Object_117::wheelBody'], handleObjects: ['Object_117::gripRim'], axis: 'z', pivot: [0.0791843, 0.4864774, 0.349], pivotName: 'CarriageHandwheelPivot', baseName: 'CarriageHandwheel', parent: 'CarriageAssembly', label: '縱向進給手輪', key: 'x', ratio: 0.018, rotationSpeed: 2.4, help: ['左鍵：向左移動', '右鍵：向右移動'], note: 'Object_117 無獨立凸出握把；外緣握持面與輪身依原始三角形分區，未新增握把。' },
  crossSlideHandwheel: { wheelObjects: ['Object_107'], handleObjects: ['Object_109'], axis: 'z', pivot: [0.0791951, 0.6833978, 0.397], pivotName: 'CrossSlideHandwheelPivot', baseName: 'CrossSlideHandwheel', parent: 'CarriageAssembly', label: '橫向進給手輪', key: 'y', ratio: 0.0075, rotationSpeed: 2.4, help: ['左鍵：刀具靠近', '右鍵：刀具遠離'], note: '實際輪面在 XY 平面，因此使用 Z 軸；Object_107 包含與輪身連成一體的握把桿，Object_109 是末端球形握把。' },
  heightHandwheel: { wheelObjects: ['Object_145::wheelBody'], handleObjects: ['Object_145::grip'], axis: 'x', pivot: [0.407, 0.7619079, 0.0566564], pivotName: 'HeightHandwheelPivot', baseName: 'HeightHandwheel', parent: 'CrossSlideAssembly', label: '高度調整手輪', key: 'z', ratio: 0.003, rotationSpeed: 2, help: ['左鍵：降低刀具', '右鍵：升高刀具'], note: '側向調節旋鈕的外觀已確認；高度連動是教學配置，原模型沒有機構語意，需實機教師確認。Object_143 支座保持固定。' },
  tailstockHandwheel: { wheelObjects: ['Object_68', 'Object_70', 'Object_72'], handleObjects: ['Object_189'], axis: 'x', pivot: [1.038285, 0.8525885, -0.0216612], pivotName: 'TailstockHandwheelPivot', baseName: 'TailstockHandwheel', parent: 'TailstockAssembly', label: '尾座手輪', key: 'quill', ratio: 0.008, rotationSpeed: 2.4, help: ['左鍵：套筒伸出', '右鍵：套筒縮回'] },
  startLever: { objectNames: ['Object_12', 'Object_38'], rodObjects: ['Object_12'], handleObjects: ['Object_38'], axis: 'z', pivot: [-0.4023504, 0.3522738, 0.3674505], pivotName: 'StartLeverPivot', label: '主軸啟動拉桿', help: ['點擊切換啟動／停止'], stopAngle: 0, runAngle: -0.65, duration: 0.3, note: 'Object_10 為固定支座；此拉桿依位置與外觀指定為啟停教學控制，須人工確認實機用途。' },
};
export const WHEELS = Object.fromEntries(Object.entries(LATHE_PARTS).filter(([, p]) => p.wheelObjects));
export const MECHANISMS = {
  CarriageAssembly: { objects: ['Object_93','Object_94','Object_96','Object_98','Object_99','Object_105','Object_111','Object_113','Object_115','Object_119','Object_121','Object_123','Object_125','Object_127','Object_129','Object_131','Object_133','Object_135','Object_137','Object_139','Object_141'], parent: null },
  CrossSlideAssembly: { objects: ['Object_101','Object_103','Object_147','Object_143'], parent: 'CarriageAssembly' },
  ToolHeightAssembly: { objects: ['Object_149','Object_150','Object_152','Object_154','Object_156','Object_157'], parent: 'CrossSlideAssembly' },
  TailstockAssembly: { objects: ['Object_64','Object_66','Object_76'], parent: null },
  TailstockQuill: { objects: ['Object_74'], parent: 'TailstockAssembly' },
};
export const AXES = {
  x: { name: 'CarriageAssembly', axis: 'x', label: 'X軸／縱向進給', range: [-0.24, 0.38], hint: '帶動大溜板、橫向滑座與刀座' },
  y: { name: 'CrossSlideAssembly', axis: 'z', label: 'Y軸／橫向進給', range: [-0.065, 0.065], hint: '沿模型 Z 軸靠近／遠離工件' },
  z: { name: 'ToolHeightAssembly', axis: 'y', label: 'Z軸／刀具高度', range: [-0.015, 0.035], hint: '只升降上方刀座與刀具；教學連動' },
  tail: { name: 'TailstockAssembly', axis: 'x', label: '尾座位置', range: [-0.12, 0.04], hint: '沿床身調整尾座本體' },
  quill: { name: 'TailstockQuill', axis: 'x', label: '尾座套筒', range: [-0.08, 0], hint: '負值伸向主軸，0 為載入時收回位置' },
};
export const SPLITS = {
  Object_117: { parts: ['wheelBody','gripRim'], select: p => Math.hypot(p.x-0.0791843,p.y-0.4864774)>0.053 ? 'gripRim' : 'wheelBody', description: '外緣半徑 > 0.053 的原始三角形為整合式握持環' },
  Object_145: { parts: ['wheelBody','grip'], select: p => p.x>0.418 ? 'grip' : 'wheelBody', description: '原始三角形中心 X > 0.418 為向外凸出的整合握把' },
  Object_78: { parts: ['shaft','chuckBody'], select: p => p.x> -0.335 ? 'chuckBody' : 'shaft', description: '原始三角形中心 X > -0.335 為夾头盤，其餘為穿過主軸箱的軸' },
};
