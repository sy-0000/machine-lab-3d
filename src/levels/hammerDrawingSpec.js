// Transcribed from the user's cropped engineering drawing; mm unless stated.
const confirmed=value=>({status:'confirmed',value});
const unknown=note=>({status:'unknown',value:null,note});
export const HAMMER_DRAWING={
  source:'codex-clipboard-d40e6510-ce1d-49c9-b35b-df5edc47586f.png',units:'mm',
  handle:{
    blank:{diameterMm:20,lengthMm:300,source:'user specification'},
    finalLengthMm:confirmed(240),
    leftEndLengthMm:confirmed(20),taperLengthMm:confirmed(100),
    taperSmallDiameterMm:confirmed(9.3),taperLargeDiameterMm:confirmed(16.3),
    taperDrawingRangeMm:{status:'confirmed',value:[20,120],source:'20 + 100 dimension chain; drawing left end datum'},
    smallDiameterTolerance:unknown('A stacked tolerance is present at Ø9.3; lower digits require a clearer image. Do not transfer it to Ø16.3.'),
    leftChamfer:confirmed({sizeMm:1,angleDeg:45}),endSphereRadiusMm:confirmed(9),
    surfaceRoughness:confirmed({value:6.3,unit:'µm',note:'surface texture annotation, not dimensional tolerance'}),
    gripDiameterMm:unknown('No explicit diameter visible; do not infer from SR9'),
    thread:unknown('Left-side annotation cropped; head M10 does not confirm handle thread specification'),
    knurl:{present:confirmed(true),rangeMm:unknown('No axial dimensions visible'),pitchMm:unknown('Not shown')},
    cylindrical163RangeMm:unknown('Ø16.3 labels the taper large end, not an explicitly dimensioned constant-diameter region'),
    diameterToleranceMm:unknown('No tolerance shown for Ø16.3'),lengthToleranceMm:unknown('No tolerance or general tolerance table visible'),
  },
  head:{
    stockMm:{status:'confirmed',value:{lengthMm:90,widthMm:20,heightMm:20},source:'User confirmation: 20×20×90 stock'},
    basicSizeMm:{status:'confirmed',value:{lengthMm:86,widthMm:18.5,heightMm:18.5},source:'User confirmation: basic milling size 18.5×18.5×86'},
    holeAcrossMm:unknown('Second positioning dimension not confirmed'),
    holeDepthMm:unknown('Hole depth / through requirement not confirmed'),
    finalLengthMm:confirmed(86),leftSectionSizeMm:confirmed(18.5),leftEndSizeMm:confirmed(12.5),
    rightEndSizeMm:confirmed(12.5),holeCenterFromLeftMm:confirmed(40),rightSectionLengthMm:confirmed(38),
    upperViewDimension36:{...confirmed(36),featureStatus:'unknown',note:'Exact association of extension line requires clearer drawing'},
    leftChamfer:confirmed({sizeMm:1.5,angleDeg:45}),rightChamfer:confirmed({sizeMm:3,angleDeg:45}),tipRadiusMm:confirmed(1.5),
    thread:confirmed('M10'),tapDrillDiameterMm:confirmed(8.5),
    threadPitchAndDepth:unknown('Not explicitly dimensioned in supplied image'),
    tolerances:unknown('No readable dimensional/general tolerances'),surfaceRoughness:confirmed({value:6.3,unit:'µm'}),
  },
};

/** Explicit placement, never inferred from raw-stock length or the player's zero. */
export function drawingZToCoordinates(drawingZMm,{datumPhysicalZMm,direction,workZeroPhysicalZMm}) {
  if(![drawingZMm,datumPhysicalZMm,workZeroPhysicalZMm].every(Number.isFinite)||![1,-1].includes(direction))
    throw new Error('Explicit drawing placement and work zero required');
  const physicalZMm=datumPhysicalZMm+direction*drawingZMm;
  return {physicalZMm,workZMm:physicalZMm-workZeroPhysicalZMm};
}
