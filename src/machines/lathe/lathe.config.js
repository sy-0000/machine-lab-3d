/**
 * Lathe Machine Configuration
 * 16K20 Engine Lathe Contract Definition
 */
export const LATHE_CONFIG = {
  id: 'lathe',
  name: '普通車床',
  modelName: '16K20',
  subtitle: '16K20 · 縱向與橫向進給',
  number: '01',
  description: '認識主軸、溜板、四方刀架與尾座的機械連動。',

  // Canonical and asset paths
  model: 'machines/lathe/lathe.glb',
  canonicalModel: 'machines/lathe/lathe.glb',
  config: 'lathe_parts.json',

  nodes: {
    spindle: 'SpindlePivot',
    chuck: 'ChuckAssembly',
    toolPost: 'ToolIndexPivot',
    carriage: 'CarriageAssembly',
    crossSlide: 'CrossSlideAssembly',
    tailstock: 'TailstockAssembly',
    tailQuill: 'TailQuill',
    startLever: 'StartLeverPivot',
    footBrake: 'FootBrake',
  },

  mounts: {
    tool: {
      parent: 'ToolIndexPivot',
      // Left slot: keep the shank above the slot floor and point its -X tip toward -Z.
      position: [-0.087, 0.062, 0.03],
      rotation: [0, -Math.PI / 2, 0],
      // Shorten along the tool's local shank axis; preserve width and height.
      scale: [0.6, 1, 1],
      description: '四方刀座左側刀槽 ToolMount，隨刀架旋轉、升降與溜板十字進給自然連動。',
    },
    workpiece: {
      parent: 'ChuckAssembly',
      // Chuck-local offset: world mount (-0.20274, 0.8525885, -0.0216612)
      // minus the chuck origin (-0.267, 0.8525885, -0.0216612).
      position: [0.06426, 0, 0],
      rotation: [0, 0, 0],
      description: '三爪自定心夾頭 WorkpieceMount，隨主軸旋轉自然連動。',
    },
  },

  limits: {
    spindleRpm: [0, 2000],
    carriageTravel: [-0.14, 0.14],
    crossSlideTravel: [0, 0.05],
    tailstockTravel: [-0.278, 0],
    quillTravel: [-0.11, 0],
    toolPostIndexingStepDegrees: 10,
  },

  defaultState: {
    rpm: 500,
    direction: 1,
    offsets: { x: 0, z: 0, tail: 0, quill: 0 },
    angles: { carriageHandwheel: 0, crossHandwheel: 0, tailstockHandwheel: 0, tailTravel: 0 },
    detents: { gearSelector: 1, speedMode: 1 },
    indexSteps: 0,
  },
};

export default LATHE_CONFIG;
