// Shared material library. Only MeshStandardMaterial features that map onto glTF PBR
// (baseColor, metallicRoughness packed ORM, normal, emissive, alpha) are used.
import * as THREE from 'three';
import { Textures, setTextureAnisotropy } from './textures.js';

function std(name, params) {
  const m = new THREE.MeshStandardMaterial(params);
  m.name = name;
  return m;
}

function pbr(name, set, extra = {}) {
  return std(name, {
    map: set.map,
    normalMap: set.normalMap || null,
    roughnessMap: set.orm,
    metalnessMap: set.orm,
    roughness: 1,
    metalness: 1,
    ...extra,
  });
}

export function createMaterials(quality) {
  setTextureAnisotropy(quality.anisotropy);
  const T = Textures;
  const M = {};

  const brass = T.brass();
  const copper = T.copper();
  const iron = T.iron();
  const steel = T.steel();

  M.brass = pbr('Brass', brass, { normalScale: new THREE.Vector2(0.4, 0.4) });
  M.brassPolished = pbr('BrassPolished', brass, { roughness: 0.5, color: 0xfff2d6, normalScale: new THREE.Vector2(0.2, 0.2) });
  M.brassAged = pbr('BrassAged', brass, { color: 0xb0916a, normalScale: new THREE.Vector2(0.5, 0.5) });
  M.copper = pbr('Copper', copper, { normalScale: new THREE.Vector2(0.5, 0.5) });
  M.copperBright = pbr('CopperBright', copper, { roughness: 0.7, color: 0xffe2d2, normalScale: new THREE.Vector2(0.3, 0.3) });
  M.castIron = pbr('CastIron', iron, { normalScale: new THREE.Vector2(0.8, 0.8) });
  M.ironDark = pbr('BlackenedIron', iron, { color: 0x7a7470, metalness: 0.7, normalScale: new THREE.Vector2(0.6, 0.6) });
  M.steel = pbr('Steel', steel, { normalScale: new THREE.Vector2(0.3, 0.3) });
  M.steelDark = pbr('SteelDark', steel, { color: 0x6c6c70, roughness: 1.2 });
  M.steelBlued = pbr('BluedSteel', steel, { color: 0x2b3a5c, roughness: 0.8 });
  M.paintRed = pbr('WornRedPaint', iron, { color: 0xc23a2a, metalness: 0.25, normalScale: new THREE.Vector2(0.5, 0.5) });
  M.paintGreen = pbr('WornGreenPaint', iron, { color: 0x4f7a5a, metalness: 0.2, normalScale: new THREE.Vector2(0.5, 0.5) });

  const woodDark = T.woodDark();
  const woodWorn = T.woodWorn();
  const woodPine = T.woodPine();
  const bench = T.benchTop();
  const woodParams = (set, extra = {}) => ({ map: set.map, normalMap: set.normalMap, roughnessMap: set.orm, roughness: 1, metalness: 0, ...extra });
  M.woodDark = std('WoodMahogany', woodParams(woodDark));
  M.woodWorn = std('WoodOak', woodParams(woodWorn));
  M.woodPine = std('WoodPine', woodParams(woodPine));
  M.woodPlanks = std('WoodPlanks', woodParams(T.woodPlanks()));
  M.woodHandle = std('WoodHandlePolished', woodParams(woodWorn, { roughness: 0.55, color: 0xd9b08a }));
  M.benchTop = std('WorkbenchTop', woodParams(bench, { normalScale: new THREE.Vector2(0.8, 0.8) }));

  const leather = T.leather();
  M.leather = std('Leather', { map: leather.map, normalMap: leather.normalMap, roughnessMap: leather.orm, roughness: 1, metalness: 0 });
  M.leatherDark = std('LeatherDark', { map: leather.map, normalMap: leather.normalMap, roughnessMap: leather.orm, roughness: 1, metalness: 0, color: 0x6e5040 });
  M.leatherBooks = std('LeatherBindings', { map: leather.map, normalMap: leather.normalMap, roughnessMap: leather.orm, roughness: 1, metalness: 0, vertexColors: true });

  const brick = T.brick();
  M.brick = std('Brick', { map: brick.map, normalMap: brick.normalMap, roughnessMap: brick.orm, roughness: 1, metalness: 0, vertexColors: true, normalScale: new THREE.Vector2(1.2, 1.2) });
  M.brickArch = std('BrickArch', { map: brick.map, normalMap: brick.normalMap, roughnessMap: brick.orm, roughness: 1, metalness: 0, color: 0x9a7a70 });
  const concrete = T.concrete();
  M.concrete = std('Concrete', { map: concrete.map, normalMap: concrete.normalMap, roughnessMap: concrete.orm, roughness: 1, metalness: 0, vertexColors: true });
  M.stone = std('GrindStone', { map: concrete.map, normalMap: concrete.normalMap, roughnessMap: concrete.orm, roughness: 1, metalness: 0, color: 0xc8bea6 });

  const glass = (name, color, opacity, extra = {}) =>
    std(name, { color, transparent: true, opacity, roughness: 0.04, metalness: 0, depthWrite: false, envMapIntensity: 1.6, ...extra });
  M.glass = glass('Glass', 0xdfeeee, 0.2);
  M.glassAmber = glass('GlassAmber', 0x8a5320, 0.62);
  M.glassGreen = glass('GlassGreen', 0x3e7250, 0.55);
  M.water = glass('Water', 0x6d9cb0, 0.55, { roughness: 0.1 });
  // Dome panes: plain alpha transparency (no transmission / refraction) so they stay cheap.
  const pane = (name, map) =>
    std(name, { map, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.05, metalness: 0, envMapIntensity: 0.6 });
  M.domeGlass = pane('DomeGlass', T.glassClean());
  M.domeGlassDusty = pane('DomeGlassDusty', T.glassDusty());
  M.domeGlassCracked = pane('DomeGlassCracked', T.glassCracked());

  const paper = T.paper();
  M.paper = std('Paper', { map: paper.map, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  M.blueprint = std('Blueprint', { map: T.blueprint(), roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  M.rollEnd = std('PaperRollEnd', { map: T.rollEnd(), roughness: 0.9, metalness: 0 });

  M.rubber = std('Rubber', { color: 0x1b1816, roughness: 0.85, metalness: 0 });
  M.cloth = std('ClothCable', { color: 0x2c2118, roughness: 0.95, metalness: 0 });
  M.rope = std('Rope', { color: 0x9a7c52, roughness: 1, metalness: 0 });
  M.straw = std('Straw', { color: 0xc4a35c, roughness: 1, metalness: 0 });
  M.darkInterior = std('CaseInterior', { color: 0x1c130c, roughness: 0.92, metalness: 0 });
  M.blackIron = std('BlackIron', { color: 0x1e1c1a, roughness: 0.55, metalness: 0.8 });
  M.coal = std('Coal', { color: 0x141210, roughness: 0.7, metalness: 0.05 });

  const embers = T.embers();
  M.embers = std('GlowingCoal', { color: 0x0e0b09, roughness: 1, metalness: 0, emissive: 0xff5a18, emissiveMap: embers, emissiveIntensity: 1.6, envMapIntensity: 0.2, flatShading: true });
  const fire = T.fire();
  M.fire = std('FireGlow', { color: 0x000000, roughness: 1, metalness: 0, emissive: 0xff8a3a, emissiveMap: fire, emissiveIntensity: 4.5 });
  M.emberIron = pbr('FireboxLining', iron, { color: 0x5a4a40, emissive: 0xff4a12, emissiveIntensity: 0.35 });

  M.bulbGlass = std('EdisonBulbGlass', { color: 0xfff1d6, emissive: 0xffa95a, emissiveIntensity: 0.9, transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0, depthWrite: false });
  M.filament = std('EdisonFilament', { color: 0x000000, emissive: 0xffc17a, emissiveIntensity: 10, roughness: 1, metalness: 0 });

  M.clockDial = std('ClockDial', { map: T.clockDial(), roughness: 0.55, metalness: 0 });
  M.gaugeDial = std('GaugeDial', { map: T.gaugeDial(), roughness: 0.5, metalness: 0 });
  M.nameplate = std('Nameplate', { map: T.nameplate(), roughness: 0.4, metalness: 0.9 });
  M.globe = std('GlobeMap', { map: T.globe(), roughness: 0.45, metalness: 0 });

  const peg = T.pegboard();
  peg.map.repeat.set(2, 1);
  peg.normalMap.repeat.set(2, 1);
  peg.orm.repeat.set(2, 1);
  M.pegboard = std('Pegboard', { map: peg.map, normalMap: peg.normalMap, roughnessMap: peg.orm, roughness: 1, metalness: 0 });

  // ---- revision 2 materials
  M.leatherOxblood = std('LeatherOxblood', { map: leather.map, normalMap: leather.normalMap, roughnessMap: leather.orm, roughness: 1, metalness: 0, color: 0xb05a44 });
  M.enamelBlack = std('BlackEnamel', { color: 0x151312, roughness: 0.32, metalness: 0.25 });
  M.ivory = std('Ivory', { color: 0xe4d6b4, roughness: 0.4, metalness: 0 });
  M.felt = std('GreenFelt', { color: 0x2f4a35, roughness: 1, metalness: 0 });
  M.vinyl = std('Shellac', { color: 0x0b0b0c, roughness: 0.22, metalness: 0.1 });
  M.slate = std('Slate', { map: concrete.map, normalMap: concrete.normalMap, roughnessMap: concrete.orm, roughness: 0.8, metalness: 0, color: 0x6a6f74 });
  M.porcelain = std('Porcelain', { color: 0xf1ece2, roughness: 0.2, metalness: 0 });
  const liquid = (name, color, emissive = 0x000000) =>
    std(name, { color, emissive, emissiveIntensity: 0.25, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0, depthWrite: false });
  M.liquidGreen = liquid('LiquidGreen', 0x3fae5e, 0x1f6a30);
  M.liquidAmber = liquid('LiquidAmber', 0xc98a2a, 0x4a2a05);
  M.liquidBlue = liquid('LiquidBlue', 0x3a7ad0, 0x10306a);
  M.liquidRed = liquid('LiquidRed', 0xb0302a, 0x401010);
  M.flameBlue = std('BunsenFlame', { color: 0x000000, emissive: 0x4a7dff, emissiveIntensity: 4, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1, metalness: 0 });
  M.canvasFabric = std('SailCloth', { map: T.canvasGores(), roughness: 0.88, metalness: 0 });
  M.bookPage = std('BookPage', { map: T.bookPage(), roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  M.lampShade = std('LampShadeGlass', { color: 0xe8b870, emissive: 0xffa04a, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0, side: THREE.DoubleSide });
  M.lightStrip = std('PictureLightStrip', { color: 0x000000, emissive: 0xffc98a, emissiveIntensity: 3.5, roughness: 1, metalness: 0 });

  M.oilStain = std('OilStainDecal', {
    map: T.stain(),
    transparent: true,
    depthWrite: false,
    roughness: 0.25,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  M.grating = std('Grating', { map: T.grating(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.6 });

  return M;
}
