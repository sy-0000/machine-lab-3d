/**
 * Milling Machine Configuration
 * Vertical Knee-Type Milling Machine Contract Definition
 */
export const MILLING_CONFIG = {
  id: 'milling',
  name: '立式銑床',
  modelName: 'Knee-Type Vertical Milling Machine',
  subtitle: 'MILLING · 拆件互動版',
  number: '02',
  description: '操作 X／Y 手輪與 Z 升降，認識工作臺與鞍座的多軸連動。',

  // Canonical and asset paths
  model: 'machines/milling/milling.glb',
  canonicalModel: 'machines/milling/milling.glb',
  config: 'milling_split_controls.json',

  nodes: {
    spindle: 'Spindle_Rotor_Group',
    head: 'Head_Assembly',
    table: 'X_Axis_Table',
    saddle: 'Y_Axis_Saddle',
    knee: 'Knee_Z_Slide',
    startLever: 'MillingRightLever',
    xHandwheelLeft: 'X_Handwheel_Left_Group',
    xHandwheelRight: 'X_Handwheel_Right_Group',
    yHandwheel: 'Y_Handwheel_Group',
    zHandwheel: 'ZLiftWheel',
  },

  mounts: {
    tool: {
      parent: 'Spindle_Rotor_Group',
      position: [0.059423, 1.051, 0.008927],
      rotation: [0, 0, 0],
      description: '主軸端面 ToolMount，隨立銑頭主軸高速旋轉自然連動。',
    },
    workpiece: {
      parent: 'X_Axis_Table',
      position: [0.059423, 0.725, 0.008927],
      rotation: [0, 0, 0],
      description: '工作臺頂部 WorkpieceMount，隨 X 橫向、Y 縱向與 Z 升降三軸連動。',
    },
  },

  limits: {
    spindleRpm: [0, 2000],
    xTravel: [-0.3, 0.3],
    yTravel: [-0.15, 0.15],
    zTravel: [-0.2, 0],
  },

  defaultState: {
    rpm: 600,
    direction: 1,
    offsets: { X_Axis_Table: 0, Y_Axis_Saddle: 0, Knee_Z_Slide: 0 },
    angles: { X_Handwheel_Left_Group: 0, X_Handwheel_Right_Group: 0, Y_Handwheel_Group: 0, zLift: 0 },
    leverAngle: 0,
  },
};

export default MILLING_CONFIG;
