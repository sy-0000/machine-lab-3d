// Builds every structure and asset module, places them from config/layout.js and collects
// per-frame updaters and anchors (light positions, steam / spark emitters, dome panes).
import * as THREE from 'three';
import { ROOM, PLACEMENTS, placeOnWall, wallFrame } from '../config/layout.js';
import { createMaterials } from '../materials/library.js';
import { applyShadows, freezeStatic } from '../utils/finalize.js';
import { batchStatic } from '../utils/staticBatch.js';
import { createRoom } from '../structure/room.js';
import { createDome } from '../structure/dome.js';
import { createGallery } from '../structure/gallery.js';
import { createWallPipes } from '../structure/wallPipes.js';
import { createFloorDetails } from '../structure/floorDetails.js';
import { createBoiler } from '../assets/boiler.js';
import { createGrandfatherClock } from '../assets/grandfatherClock.js';
import { createWorkbench } from '../assets/workbench.js';
import { createGearTrain } from '../assets/gearTrain.js';
import { createToolWall, createGrinder } from '../assets/toolWall.js';
import { createPartsCabinet } from '../assets/smallParts.js';
import { createShelves } from '../assets/shelves.js';
import { createCrate, createBarrel } from '../assets/crates.js';
import { createTelescope } from '../assets/telescope.js';
import { createGlobe } from '../assets/globe.js';
import { createStool } from '../assets/stool.js';
import { createEdisonLamps } from '../assets/edisonLamps.js';
import { createBookcase } from '../assets/bookcase.js';
import { createLibraryLadder } from '../assets/libraryLadder.js';
import { createArmchair } from '../assets/armchair.js';
import { createSideTable } from '../assets/sideTable.js';
import { createCoalPile } from '../assets/coalPile.js';
import { createPipeStack } from '../assets/pipeStack.js';
import { createToolChest } from '../assets/toolChest.js';
import { createGramophone } from '../assets/gramophone.js';
import { createWritingDesk } from '../assets/writingDesk.js';
import { createChemistryBench } from '../assets/chemistryBench.js';
import { createAirship } from '../assets/airship.js';

const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

const onWall = (p) => (o) => {
  placeOnWall(o, p.wall, p.offset, p.along ?? 0, p.y ?? 0);
  if (p.rotationY) o.rotation.y += p.rotationY;
};
const atPosition = (p) => (o) => {
  o.position.set(...p.position);
  o.rotation.y = p.rotationY ?? 0;
};

export async function buildWorld(scene, quality) {
  const M = createMaterials(quality);
  const root = new THREE.Group();
  root.name = 'Workshop';
  scene.add(root);

  const updaters = [];
  const anchors = { lamps: [], steam: [], fire: null, sparks: null };

  const mount = (asset, placement) => {
    if (placement) placement(asset.object);
    root.add(asset.object);
    asset.object.updateMatrixWorld(true);
    applyShadows(asset.object);
    if (asset.update) updaters.push(asset.update);
    return asset;
  };
  const worldAnchor = (asset, key) => asset.object.localToWorld(asset.anchors[key].clone());

  // ---- architecture
  mount(createRoom(M));
  await yieldFrame();
  const dome = mount(createDome(M));
  mount(createGallery(M));
  await yieldFrame();

  // ---- hero machinery
  const boiler = mount(createBoiler(M), onWall({ ...PLACEMENTS.boiler, y: 0 }));
  anchors.fire = worldAnchor(boiler, 'fireLight');
  anchors.sparks = { position: worldAnchor(boiler, 'fireMouth'), direction: new THREE.Vector3(0, 0.35, 1).normalize() };
  anchors.steam.push({ position: worldAnchor(boiler, 'safetyValve'), direction: new THREE.Vector3(0.2, 1, 0.1), strength: 1.2 });
  anchors.steam.push({ position: worldAnchor(boiler, 'whistle'), direction: new THREE.Vector3(-0.1, 1, 0.1), strength: 0.7 });
  await yieldFrame();

  const gears = mount(createGearTrain(M), onWall({ ...PLACEMENTS.gearTrain, y: 0 }));
  anchors.steam.push({ position: worldAnchor(gears, 'steamLeak'), direction: new THREE.Vector3(0.2, 0.5, 1), strength: 0.45 });
  const g1 = PLACEMENTS.gearTrain;
  const pipes = mount(
    createWallPipes(M, {
      boiler: {
        steamOutlet: worldAnchor(boiler, 'steamOutlet'),
        flue: worldAnchor(boiler, 'flue'),
        portLeft: worldAnchor(boiler, 'portLeft'),
        portRight: worldAnchor(boiler, 'portRight'),
      },
      gearFeed: { world: worldAnchor(gears, 'feedTop'), offset: g1.offset + gears.anchors.feedTop.z, x: gears.anchors.feedTop.x },
    }),
  );
  anchors.steam.push(...pipes.steam);
  await yieldFrame();

  mount(createGrandfatherClock(M), onWall(PLACEMENTS.clock));
  const bench = mount(createWorkbench(M), atPosition(PLACEMENTS.workbench));
  mount(createStool(M), atPosition(PLACEMENTS.stool));
  await yieldFrame();

  // ---- walls: tools, storage
  mount(createToolWall(M), onWall(PLACEMENTS.toolWall));
  mount({ object: createPartsCabinet(M) }, onWall(PLACEMENTS.partsCabinet));
  const grinder = mount(createGrinder(M), onWall(PLACEMENTS.grinder));
  grinder.object.rotation.y += Math.PI / 2;
  mount(createShelves(M), onWall(PLACEMENTS.shelves));
  await yieldFrame();

  PLACEMENTS.crates.forEach((c, i) => {
    const crate = mount(createCrate(M, { w: c.size[0], h: c.size[1], d: c.size[2], open: c.open, seed: i + 1 }), onWall(c));
    if (c.stack) {
      const top = mount(createCrate(M, { w: c.size[0] * 0.8, h: c.size[1] * 0.8, d: c.size[2] * 0.85, seed: i + 11 }), onWall(c));
      top.object.position.y = crate.height + 0.02;
      top.object.rotation.y += 0.15;
      top.object.updateMatrixWorld(true);
    }
  });
  for (const b of PLACEMENTS.barrels) mount(createBarrel(M), onWall(b));
  mount(createTelescope(M, { azimuth: -2.35, elevation: 0.72 }), atPosition(PLACEMENTS.telescope));
  mount(createGlobe(M), atPosition(PLACEMENTS.globe));
  await yieldFrame();

  // ---- revision 2: library wall, reading corner, boiler surroundings, lab & writing corner
  const bookcase = mount(createBookcase(M), onWall(PLACEMENTS.bookcase));
  anchors.lamps.push({ position: worldAnchor(bookcase, 'light'), color: 0xffc07a, intensity: 14, distance: 10, seed: 31 });
  mount(createLibraryLadder(M), onWall({ ...PLACEMENTS.ladder, offset: 0 }));
  mount(createArmchair(M), onWall(PLACEMENTS.armchair));
  const table = mount(createSideTable(M), onWall(PLACEMENTS.sideTable));
  anchors.lamps.push({ position: worldAnchor(table, 'light'), color: 0xffa352, intensity: 3.2, distance: 5, seed: 32 });
  await yieldFrame();
  mount(createCoalPile(M), onWall(PLACEMENTS.coalPile));
  mount(createPipeStack(M), onWall(PLACEMENTS.pipeStack));
  mount(createToolChest(M), onWall(PLACEMENTS.toolChest));
  mount(createGramophone(M), onWall(PLACEMENTS.gramophone));
  mount(createWritingDesk(M), onWall(PLACEMENTS.writingDesk));
  mount(createChemistryBench(M), onWall(PLACEMENTS.chemistryBench));
  const shipAt = PLACEMENTS.airship.position;
  mount(createAirship(M, { cableTop: ROOM.tieBeamY - 0.23 - shipAt[1] }), atPosition(PLACEMENTS.airship));
  await yieldFrame();

  // ---- lighting fixtures
  const lamps = mount(createEdisonLamps(M));
  anchors.lamps.push(...lamps.lights);

  // ---- floor dressing
  const benchPos = new THREE.Vector3(...PLACEMENTS.workbench.position);
  const benchLocal = (x, z) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), PLACEMENTS.workbench.rotationY).add(benchPos);
  mount(
    createFloorDetails(M, {
      boilerFront: wallFrame(0, PLACEMENTS.boiler.offset + 1.9).position,
      vise: benchLocal(-1.0, 0.4),
      workbench: benchLocal(0, 0.5),
      grinder: wallFrame(6, PLACEMENTS.grinder.offset, PLACEMENTS.grinder.along).position,
    }),
  );
  void bench;

  const params = new URLSearchParams(location.search);
  const batching = params.has('nobatch') ? null : batchStatic(root);
  freezeStatic(root);

  // Fresh, un-batched copies of each asset for glTF export (see tools/exportGLTF.js).
  const factories = new Map([
    ['SteamBoiler', () => createBoiler(M).object],
    ['GrandfatherClock', () => createGrandfatherClock(M).object],
    ['Workbench', () => createWorkbench(M).object],
    ['GearTrainWall', () => createGearTrain(M).object],
    ['ToolWall', () => createToolWall(M).object],
    ['PedestalGrinder', () => createGrinder(M).object],
    ['PartsCabinet', () => createPartsCabinet(M)],
    ['Shelving', () => createShelves(M).object],
    ['Crate', () => createCrate(M).object],
    ['OpenCrate', () => createCrate(M, { open: true }).object],
    ['Barrel', () => createBarrel(M).object],
    ['BrassTelescope', () => createTelescope(M).object],
    ['LibraryGlobe', () => createGlobe(M).object],
    ['LeatherStool', () => createStool(M).object],
    ['EdisonLighting', () => createEdisonLamps(M).object],
    ['GlassDome', () => createDome(M).object],
    ['Gallery', () => createGallery(M).object],
    ['RoomShell', () => createRoom(M).object],
    ['LibraryBookcase', () => createBookcase(M).object],
    ['LibraryLadder', () => createLibraryLadder(M).object],
    ['LeatherArmchair', () => createArmchair(M).object],
    ['ReadingSideTable', () => createSideTable(M).object],
    ['CoalPile', () => createCoalPile(M).object],
    ['PipeStock', () => createPipeStack(M).object],
    ['BrassToolChest', () => createToolChest(M).object],
    ['Gramophone', () => createGramophone(M).object],
    ['WritingDesk', () => createWritingDesk(M).object],
    ['ChemistryBench', () => createChemistryBench(M).object],
    ['AirshipModel', () => createAirship(M).object],
  ]);

  return {
    object: root,
    materials: M,
    panels: dome.panels,
    anchors,
    factories,
    batching,
    update(dt, t, camera) {
      for (const u of updaters) u(dt, t, camera);
    },
  };
}
