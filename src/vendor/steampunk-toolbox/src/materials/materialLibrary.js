// 共用材質庫：清楚區分黃銅、紅銅、鑄鐵、鋼、木材、皮革、絨布、玻璃
import * as THREE from 'three';
import * as T from './textures.js';

export function createMaterialLibrary(quality) {
  const S = Math.min(quality.textureSize, 512);
  const tex = (c, o) => T.toTexture(c, o);

  // 刮痕粗糙度貼圖（各金屬共用不同種子）
  const brassRough = tex(T.scratchRoughCanvas(S, 0.32, 3, 1.2), { repeat: [3, 3] });
  const steelRough = tex(T.scratchRoughCanvas(S, 0.26, 8, 1.6), { repeat: [4, 4] });
  const brassColor = tex(T.brassColorCanvas(S), { srgb: true, repeat: [2, 2] });
  const copper = T.copperPatinaCanvases(S, 6, 0.4);
  const copperLight = T.copperPatinaCanvases(S, 12, 0.3);
  const iron = T.castIronCanvases(S);
  const leather = T.leatherCanvases(S);
  const leatherDark = T.leatherCanvases(S, 0x2c1a10);
  const woodHandle = T.woodCanvases(S, { dark: 0x2b150a, light: 0x7a4524, rings: 6, seed: 5 });
  const boxWood = T.woodCanvases(S, { dark: 0x1a0d06, light: 0x4a2a17, rings: 11, seed: 8 });
  const velvet = tex(T.velvetCanvas(S), { repeat: [3, 3] });
  const grip = tex(T.gripRoughCanvas(64), {});
  const fileTeeth = tex(T.fileTeethCanvas(256), { repeat: [18, 2] });
  const knurl = tex(T.knurlCanvas(256), { repeat: [3, 2] });

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);

  const lib = {
    brass: std({ map: brassColor, metalness: 1, roughness: 0.55 }),
    brassPolished: std({ color: 0xc9a355, metalness: 1, roughness: 0.5 }),
    brassDark: std({ map: brassColor, color: 0x8a7040, metalness: 1, roughness: 0.55 }),
    copper: std({
      map: tex(copper.color, { srgb: true, repeat: [1.5, 1.5] }),
      metalnessMap: tex(copper.metal, { repeat: [1.5, 1.5] }), metalness: 1,
      roughnessMap: tex(copper.rough, { repeat: [1.5, 1.5] }), roughness: 1,
    }),
    copperClean: std({
      map: tex(copperLight.color, { srgb: true }), metalnessMap: tex(copperLight.metal), metalness: 1,
      roughnessMap: tex(copperLight.rough), roughness: 1,
    }),
    castIron: std({ map: tex(iron.color, { srgb: true, repeat: [2, 2] }), roughnessMap: tex(iron.rough, { repeat: [2, 2] }), roughness: 1, metalness: 0.75 }),
    steel: std({ color: 0xa3a7ad, metalness: 1, roughness: 0.55 }),
    steelDark: std({ color: 0x5b5f66, metalness: 1, roughness: 0.42, roughnessMap: steelRough }),
    woodHandle: std({ map: tex(woodHandle.color, { srgb: true, repeat: [1, 2] }), roughnessMap: grip, roughness: 1, metalness: 0 }),
    woodDark: std({ map: tex(boxWood.color, { srgb: true, repeat: [1, 1] }), roughnessMap: tex(boxWood.rough), roughness: 0.9, metalness: 0 }),
    leather: std({ map: tex(leather.color, { srgb: true, repeat: [2, 2] }), bumpMap: tex(leather.bump, { repeat: [2, 2] }), bumpScale: 1.2, roughness: 0.62, metalness: 0 }),
    leatherDark: std({ map: tex(leatherDark.color, { srgb: true, repeat: [2, 2] }), bumpMap: tex(leatherDark.bump, { repeat: [2, 2] }), bumpScale: 1.2, roughness: 0.55 }),
    velvetGreen: phys({ color: 0x0b1f15, roughness: 0.95, roughnessMap: velvet, sheen: 1, sheenColor: new THREE.Color(0x2f5e42), sheenRoughness: 0.45 }),
    velvetRed: phys({ color: 0x24070a, roughness: 0.95, roughnessMap: velvet, sheen: 1, sheenColor: new THREE.Color(0x6e2629), sheenRoughness: 0.45 }),
    glass: phys({ color: 0xffffff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.18, clearcoat: 1, ior: 1.5, envMapIntensity: 1.6, depthWrite: false }),
    blackPaint: std({ color: 0x14110e, roughness: 0.5, metalness: 0.2 }),
    redPaint: std({ color: 0x7a1a14, roughness: 0.45, metalness: 0.1 }),
    whitebox: std({ color: 0xbdb8ae, roughness: 0.8, metalness: 0 }),
    // --- 工具專用 ---
    satinSteel: std({ color: 0xa9adb2, metalness: 1, roughness: 0.55 }),
    blackOxide: std({ color: 0x26272b, metalness: 0.85, roughness: 1, roughnessMap: tex(T.scratchRoughCanvas(S, 0.45, 21, 1.2), { repeat: [3, 3] }) }),
    fileSteel: std({ color: 0x5a5d62, metalness: 0.9, roughness: 0.6, bumpMap: fileTeeth, bumpScale: 3, roughnessMap: fileTeeth }),
    knurlSteel: std({ color: 0x9da2a8, metalness: 1, roughness: 0.6, bumpMap: knurl, bumpScale: 4 }),
    knurlBrass: std({ map: brassColor, metalness: 1, roughness: 0.6, bumpMap: knurl, bumpScale: 4 }),
    lens: phys({ color: 0xffe2a8, metalness: 0, roughness: 0.35, transparent: true, opacity: 0.18, envMapIntensity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    brassMesh: std({ map: brassColor, metalness: 1, roughness: 0.4, alphaMap: tex(T.perforatedCanvas(256, 12)), alphaTest: 0.5, side: THREE.DoubleSide }),
    bristleNatural: std({ color: 0xb49468, roughness: 0.85 }),
    bristleDark: std({ color: 0x3a2c1e, roughness: 0.8 }),
    brassWire: std({ color: 0xc9a050, metalness: 1, roughness: 0.6, bumpMap: fileTeeth, bumpScale: 2, side: THREE.DoubleSide }),
    magnet: std({ color: 0x1b1b1d, metalness: 0.4, roughness: 0.5 }),
    goggleLens: phys({ color: 0xeef6ff, metalness: 0, roughness: 0.2, transparent: true, opacity: 0.16, envMapIntensity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    goggleFrame: phys({ color: 0x9fb7c6, metalness: 0, roughness: 0.5, transparent: true, opacity: 0.55, envMapIntensity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    goggleSeal: std({ color: 0x5f7482, roughness: 0.6, metalness: 0 }),
    goggleVent: std({ color: 0x2c3238, roughness: 0.55, metalness: 0 }),
    goggleStrap: std({ color: 0x1f2a3a, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
  };
  lib._textures = { brassRough, steelRough };
  return lib;
}
