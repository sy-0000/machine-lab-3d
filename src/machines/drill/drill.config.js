/**
 * Drill Press Configuration
 * Bench Drill Press Contract Definition
 */
export const DRILL_CONFIG = {
  id: 'drill',
  name: '桌上鑽床',
  modelName: 'Bench Drill Press',
  subtitle: 'DRILL PRESS · 套筒進給',
  number: '03',
  description: '觀察進給手柄、套筒 (Quill)、夾頭與鑽頭的聯動關係。',

  // Canonical and asset paths
  model: 'machines/drill/drill.glb',
  canonicalModel: 'machines/drill/drill.glb',
  config: 'drill_press_parts.json',

  nodes: {
    spindle: 'SpindleAssembly',
    quill: 'Quill',
    feedHandle: 'FeedHandlePivot',
    table: 'TableAssembly',
    switch: 'SwitchLever',
    quillExtension: 'QuillExtension',
  },

  mounts: {
    tool: {
      parent: 'SpindleAssembly',
      position: [0, 0.503, 0.1422],
      rotation: [0, 0, 0],
      description: '鑽夾頭 ToolMount，隨套筒垂直進給與主軸高速旋轉自然連動。',
    },
    workpiece: {
      parent: 'TableAssembly',
      position: [0, 0.25, 0.1422],
      rotation: [0, 0, 0],
      description: '工作臺頂面 WorkpieceMount，隨工作臺高度升降調整連動。',
    },
  },

  limits: {
    spindleRpm: [0, 2000],
    quillTravel: [-0.085, 0],
    tableTravel: [0, 0.25],
    feedHandleDegrees: [-115, 0],
  },

  defaultState: {
    rpm: 500,
    direction: 1,
    offsets: { quill: 0, table: 0 },
    angles: { feed: 0 },
  },
};

export default DRILL_CONFIG;
