import { defineLevel } from './LevelDefinition.js';
import { createHandleState } from '../machining/WorkpieceState.js';
import { HAMMER_DRAWING } from './hammerDrawingSpec.js';

export const LEVEL_1=defineLevel({
  id:'handle-basic',title:'槌柄－基礎車削',machineId:'lathe',units:'mm',
  initialWorkpiece:createHandleState(),
  targets:{status:'draft',diameterMm:null,
    diameterToleranceMm:null,machiningZRange:null,finalLengthMm:HAMMER_DRAWING.handle.finalLengthMm.value,lengthToleranceMm:null,
    confirmation:{diameterMm:'unknown',diameterToleranceMm:'unknown',machiningZRange:'unknown',finalLengthMm:'confirmed',lengthToleranceMm:'unknown'}},
  drawingSetup:{datum:'handle-left-end',placementStatus:'draft',datumPhysicalZMm:null,direction:null,
    note:'Confirm mounting orientation and basic-turning allowance before converting drawing Z to physical profile Z.'},
  setup:{contactEpsilonMm:1e-6}, // Contact roundoff only, never a dimensional acceptance tolerance.
  todos:['Ø16.3 為錐段大端；基礎等徑車削範圍及裝夾方向待確認','正式尺寸公差'],
  steps:[
    {id:'mount',title:'裝夾毛胚',hint:'按「裝夾本關毛胚」，取得獨立的 Ø20 × 300 mm 工件。'},
    {id:'center',title:'刀具自動對中心高',hint:'裝夾時沿用機台刀尖校正，確認實際中心高對準。'},
    {id:'start',title:'啟動主軸',hint:'啟動主軸，等待實際轉速大於零。'},
    {id:'outer-contact',title:'刀具接觸外圓',hint:'使用 X 手輪靠近外圓。未歸零時，Ø20 表面對應 X20；避開夾持區。'},
    {id:'x-zero',title:'X 對刀／設零',hint:'保持刀尖接觸外圓，按「X 歸零」。只設基準，不改變尺寸。'},
    {id:'face-contact',title:'刀具接觸端面',hint:'先退刀，再移至自由端外側，手動靠到端面。首次端面 Z300；徑向刀尖需在端面半徑內。'},
    {id:'z-zero',title:'Z 對刀／設零',hint:'保持端面接觸，按「Z 歸零」，建立端面基準。'},
    {id:'machine',title:'實際端面與外徑車削',hint:'總長名義目標 240 mm；以端面模式分次徑向掃到中心。外徑只練習實際減料，不要求整段 Ø16.3；保留錐段加工餘量。'},
    {id:'stop',title:'停止主軸',hint:'停止主軸並等待完全停轉。'},
    {id:'inspect',title:'檢查加工結果',hint:'按「檢查加工結果」，讀取真實工件尺寸；未完成時可繼續加工或 Retry。'},
  ],
});
