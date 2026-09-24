import { Group, Mesh, TubeGeometry, Curve, Vector3, MeshStandardMaterial, Raycaster } from 'three';

// Visual swarf only: chips never feed back into cutting or measurement.
// World units are metres. Geometries and materials are built once and reused.
const GRAVITY = 9.8, MAX = 120, LIFETIME = 4; // m/s², chips alive at once, seconds before a falling chip is parked

class Helix extends Curve {
  constructor({ radius, grow = 0, turns, pitch }) { super(); Object.assign(this, { radius, grow, turns, pitch }); }
  getPoint(t, target = new Vector3()) {
    const a = t * this.turns * Math.PI * 2, r = this.radius * (1 + this.grow * t);
    return target.set(r * Math.cos(a), this.pitch * this.turns * t, r * Math.sin(a));
  }
}
const rand = (a, b) => a + Math.random() * (b - a);
// Chip shapes per machine: lathe = long springy coils, milling = short C / comma chips, drill = tight helices.
const SHAPES = {
  // Sizes are slightly exaggerated so chips read at classroom viewing distance.
  lathe: () => ({ radius: rand(.005, .009), grow: rand(-.3, .4), turns: rand(2, 6), pitch: rand(.003, .008), thick: rand(.0005, .0008) }),
  milling: () => ({ radius: rand(.004, .007), grow: rand(-.4, .2), turns: rand(.4, 1.1), pitch: rand(0, .0015), thick: rand(.0006, .001) }),
  drill: () => ({ radius: rand(.004, .006), grow: rand(-.1, .2), turns: rand(1.5, 3.5), pitch: rand(.003, .006), thick: rand(.0005, .0008) }),
};
const TINTS = ['#c9ced3', '#c9ced3', '#b8bec4', '#d7dce0', '#d9b35a', '#6f7fb8', '#8f73ad'];

export class ChipSystem {
  constructor(root, kind) {
    this.root = root; this.kind = kind in SHAPES ? kind : 'lathe';
    this.group = new Group(); this.group.name = 'Chips'; root.add(this.group);
    this.materials = TINTS.map(color => new MeshStandardMaterial({ color, metalness: .9, roughness: .32 }));
    this.geometries = Array.from({ length: 14 }, () => { const s = SHAPES[this.kind](); return new TubeGeometry(new Helix(s), Math.max(12, Math.round(s.turns * 18)), s.thick, 5, false); });
    this.chips = []; this.budget = 0; this.ignore = [];
    this.ray = new Raycaster(); this.from = new Vector3(); this.to = new Vector3(); this.dir = new Vector3(); this.normal = new Vector3();
  }
  get moving() { return this.chips.some(c => !c.rest); }
  /**
   * at: cutting point (world), or a function returning a fresh [at, away] per chip; away: throw direction (world);
   * amount: chips to add (fractional carries over); ignore: objects chips pass through (the tool, a spinning lathe stock).
   */
  emit(at, away, amount, ignore = []) {
    this.ignore = ignore;
    this.budget = Math.min(6, this.budget + amount);
    while (this.budget >= 1) { this.budget--; const [p, d] = typeof at === 'function' ? at() : [at, away]; this.spawn(p, d); }
  }
  spawn(at, away) {
    let chip = this.chips.length >= MAX ? this.chips.shift() : null;
    if (!chip) { chip = { mesh: new Mesh(this.geometries[0], this.materials[0]) }; chip.mesh.castShadow = true; this.group.add(chip.mesh); }
    chip.mesh.geometry = this.geometries[Math.floor(Math.random() * this.geometries.length)];
    chip.mesh.material = this.materials[Math.floor(Math.random() * this.materials.length)];
    this.group.updateWorldMatrix(true, false);
    // Start just outside the cut so the first collision test does not begin inside the stock.
    chip.mesh.position.copy(this.group.worldToLocal(this.from.copy(at).addScaledVector(away, .004)));
    chip.mesh.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
    // Lathe coils and face-mill chips are flung clear of the cutter; drill chips spill out of the hole.
    const speed = this.kind === 'drill' ? rand(.25, .5) : rand(.45, .85);
    chip.velocity = new Vector3(away.x + rand(-.5, .5), away.y + rand(.2, .8), away.z + rand(-.5, .5)).normalize().multiplyScalar(speed);
    chip.spin = new Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    chip.rest = false; chip.bounces = 0; chip.age = 0;
    this.chips.push(chip);
  }
  #skip(object) {
    for (let o = object; o; o = o.parent) if (o === this.group || this.ignore.includes(o) || !o.visible) return true;
    return false;
  }
  /** Sweep each flying chip along its path this frame; stop or bounce on the first surface it meets. */
  update(dt) {
    if (!(dt > 0) || !this.chips.length) return;
    const step = Math.min(dt, .05);
    this.group.updateWorldMatrix(true, false);
    for (const c of this.chips) {
      if (c.rest) continue;
      c.age += step;
      c.velocity.y -= GRAVITY * step;
      c.mesh.rotation.x += c.spin.x * step; c.mesh.rotation.y += c.spin.y * step; c.mesh.rotation.z += c.spin.z * step;
      this.group.localToWorld(this.from.copy(c.mesh.position));
      this.to.copy(c.mesh.position).addScaledVector(c.velocity, step); this.group.localToWorld(this.to);
      const length = this.dir.subVectors(this.to, this.from).length();
      let hit = null;
      if (length > 1e-6) {
        this.ray.set(this.from, this.dir.divideScalar(length)); this.ray.far = length + .001;
        hit = this.ray.intersectObject(this.root, true).find(h => h.object.isMesh && !this.#skip(h.object));
      }
      if (!hit) { c.mesh.position.addScaledVector(c.velocity, step); if (c.age > LIFETIME) c.rest = true; continue; }
      // Land just above the surface; bounce off its normal, losing most of the speed.
      this.normal.copy(hit.face?.normal ?? { x: 0, y: 1, z: 0 }).transformDirection(hit.object.matrixWorld);
      c.mesh.position.copy(this.group.worldToLocal(this.to.copy(hit.point).addScaledVector(this.normal, .0008)));
      if (++c.bounces > 2 || c.velocity.length() < .2) { c.rest = true; continue; }
      c.velocity.reflect(this.normal).multiplyScalar(.3); c.spin.multiplyScalar(.4);
    }
  }
  clear() { for (const c of this.chips) this.group.remove(c.mesh); this.chips = []; }
  dispose() { this.clear(); this.group.removeFromParent(); for (const g of this.geometries) g.dispose(); for (const m of this.materials) m.dispose(); }
}
