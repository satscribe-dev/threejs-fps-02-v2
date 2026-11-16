// weapon.js — rifles built from parts (no downloaded models), hands that grip,
// muzzle flash (petal star), tracers and smoke. All measurements in metres.
import * as THREE from 'three';
import { chamferBox, box, lathe, capsule, ball } from './geom.js';
import { flashTex, smokeTex } from './textures.js';

export const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.9, roughness: 0.4 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.85, roughness: 0.45 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x2e2a26, metalness: 0.0, roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x5e3d22, metalness: 0.0, roughness: 0.7 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x8a6d3b, metalness: 0.9, roughness: 0.35 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x2a3a48, metalness: 0.4, roughness: 0.15, envMapIntensity: 1.4 }),
};

// Rifle, forward = +Z, muzzle at z ~ +0.48. Origin at the receiver centre, y = bore line.
// Returns { group, muzzle (Object3D), gripSocket, supportSocket, ejectSocket, parts }.
export function buildRifle(opts = {}) {
  const g = new THREE.Group();
  const parts = [];
  const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); g.add(m); parts.push(m); return m; };

  // 1. receiver — extruded rounded slab (the body everything hangs from)
  const receiver = chamferBox(0.055, 0.075, 0.34, 0.012, MAT.steel);
  add(receiver, 0, 0, 0);
  // 2. barrel — lathe, stepped profile
  const barrel = lathe([[0.011, 0], [0.011, 0.16], [0.008, 0.17], [0.008, 0.30], [0.010, 0.31], [0.010, 0.33]], MAT.steelDark);
  barrel.rotation.x = Math.PI / 2; // lathe Y -> +Z
  add(barrel, 0, 0.012, 0.17);
  // 3. handguard — chamfered box with vent slots (slots as thin dark insets)
  const hg = chamferBox(0.062, 0.062, 0.22, 0.01, MAT.polymer);
  add(hg, 0, 0.008, 0.26);
  for (let i = 0; i < 4; i++) {
    add(box(0.064, 0.012, 0.02, MAT.steelDark), 0, 0.02, 0.19 + i * 0.045);
  }
  // 4. magazine — tapered, slightly curved look via two stacked boxes
  const mag1 = chamferBox(0.042, 0.11, 0.075, 0.008, MAT.polymer);
  mag1.rotation.x = 0.12; add(mag1, 0, -0.085, 0.02);
  const mag2 = chamferBox(0.038, 0.05, 0.07, 0.008, MAT.steelDark);
  mag2.rotation.x = 0.12; add(mag2, 0, -0.155, 0.035);
  // 5-7. stock: butt plate, cheek rest, buffer tube
  const butt = chamferBox(0.045, 0.11, 0.03, 0.01, MAT.polymer);
  add(butt, 0, -0.01, -0.235);
  const cheek = chamferBox(0.04, 0.035, 0.13, 0.008, MAT.wood);
  add(cheek, 0, 0.028, -0.19);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 12), MAT.steel);
  tube.rotation.x = Math.PI / 2; add(tube, 0, 0.005, -0.17);
  // 8. pistol grip
  const grip = chamferBox(0.038, 0.10, 0.05, 0.012, MAT.polymer);
  grip.rotation.x = 0.35; add(grip, 0, -0.075, -0.085);
  // 9-10. trigger + guard
  const trig = box(0.008, 0.035, 0.012, MAT.steelDark);
  trig.rotation.x = 0.2; add(trig, 0, -0.055, -0.045);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 8, 16, Math.PI), MAT.steelDark);
  guard.rotation.set(0, Math.PI / 2, 0); guard.rotation.z = Math.PI;
  add(guard, 0, -0.045, -0.045);
  // 11-12. optic: tube + lens
  const optic = lathe([[0.02, 0], [0.02, 0.09], [0.023, 0.09], [0.023, 0.10]], MAT.steelDark);
  optic.rotation.x = Math.PI / 2; add(optic, 0, 0.058, 0.03);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.017, 20), MAT.lens);
  add(lens, 0, 0.058, 0.132);
  // 13-14. iron sights
  const fs = box(0.006, 0.035, 0.008, MAT.steelDark);
  add(fs, 0, 0.05, 0.36);
  const rs = box(0.03, 0.025, 0.006, MAT.steelDark);
  add(rs, 0, 0.05, -0.10);
  // 15. top rail (Picatinny): thin bar + teeth
  const rail = box(0.04, 0.012, 0.30, MAT.steelDark);
  add(rail, 0, 0.043, 0.05);
  for (let i = 0; i < 12; i++) {
    add(box(0.042, 0.006, 0.008, MAT.steelDark), 0, 0.051, -0.08 + i * 0.024);
  }
  // 16. charging handle
  add(box(0.05, 0.012, 0.02, MAT.steelDark), 0, 0.038, -0.155);
  // 17. ejection port (dark inset on the side)
  add(box(0.002, 0.03, 0.07, MAT.steelDark), 0.028, 0.005, 0.06);
  // 18. muzzle brake
  const brake = lathe([[0.014, 0], [0.014, 0.045], [0.011, 0.05]], MAT.steel);
  brake.rotation.x = Math.PI / 2; add(brake, 0, 0.012, 0.50);
  // 19. sling swivel
  add(box(0.01, 0.02, 0.01, MAT.steelDark), 0, -0.02, -0.20);
  // 20. foregrip (vertical, under handguard — the support hand holds this)
  const fg = chamferBox(0.035, 0.07, 0.04, 0.01, MAT.polymer);
  fg.rotation.x = 0.1; add(fg, 0, -0.055, 0.30);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.012, 0.56);
  g.add(muzzle);
  const gripSocket = new THREE.Object3D();
  gripSocket.position.set(0, -0.075, -0.085); // centre of the pistol grip
  g.add(gripSocket);
  const supportSocket = new THREE.Object3D();
  supportSocket.position.set(0, -0.055, 0.30); // foregrip
  g.add(supportSocket);
  const ejectSocket = new THREE.Object3D();
  ejectSocket.position.set(0.035, 0.005, 0.06);
  g.add(ejectSocket);

  return { group: g, muzzle, gripSocket, supportSocket, ejectSocket, parts };
}

// ---- a hand: rounded palm, 4 three-segment curled fingers, thumb, cuff ----
// The hand's local +Z is "forward" (direction the fingers point when flat);
// fingers curl toward -Y (closing around a grip). Scale ~1 = adult hand.
export function buildHand(glove = 0x4a4438, skin = 0x8a6f56) {
  const g = new THREE.Group();
  const gloveMat = new THREE.MeshStandardMaterial({ color: glove, metalness: 0, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, metalness: 0, roughness: 0.7 });
  // palm: flattened sphere
  const palm = ball(0.042, gloveMat);
  palm.scale.set(1.05, 0.45, 1.25);
  palm.position.set(0, 0, 0.01);
  g.add(palm);
  // 4 fingers: 3 capsule segments each, curling 35/55/35 degrees.
  // Lengths taper: index 0.075, middle 0.085, ring 0.08, pinky 0.06 (segment ratio 40/30/30).
  const fingerLen = [0.075, 0.085, 0.08, 0.06];
  const fingerX = [-0.030, -0.010, 0.011, 0.029];
  const fingers = [];
  for (let f = 0; f < 4; f++) {
    const segs = [];
    let pivot = new THREE.Group();
    pivot.position.set(fingerX[f], 0, 0.055);
    g.add(pivot);
    let parent = pivot;
    const total = fingerLen[f];
    const lens = [total * 0.4, total * 0.3, total * 0.3];
    const curls = [0.61, 0.96, 0.61]; // 35, 55, 35 degrees in radians
    for (let s = 0; s < 3; s++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0, s === 0 ? 0 : lens[s - 1]);
      seg.rotation.x = s === 0 ? 0 : curls[s - 1];
      parent.add(seg);
      const cap = capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, lens[s]), 0.0085 - s * 0.0012, gloveMat);
      seg.add(cap);
      segs.push(seg);
      parent = seg;
    }
    // first segment curls from the knuckle
    pivot.rotation.x = curls[0];
    fingers.push({ pivot, segs });
  }
  // thumb: starts at the palm side near the wrist, points across the grip
  const thumbBase = new THREE.Group();
  thumbBase.position.set(-0.042, -0.005, 0.01);
  thumbBase.rotation.set(0.5, 0, 0.9);
  g.add(thumbBase);
  const th1 = capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.03), 0.009, gloveMat);
  thumbBase.add(th1);
  const th2 = new THREE.Group();
  th2.position.set(0, 0, 0.03); th2.rotation.x = 0.7;
  thumbBase.add(th2);
  th2.add(capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.028), 0.008, gloveMat));
  // cuff at the wrist
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.035, 12), gloveMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0, -0.055);
  g.add(cuff);
  // fingertip marker (used by the socket probe): tip of the middle finger
  const tip = new THREE.Object3D();
  tip.position.set(-0.010, -0.028, 0.115);
  g.add(tip);
  return { group: g, fingers, tip, skinMat };
}

// ---- muzzle flash: petal-star sprite + point light, frozen at peak ----
// The star is 8 kite QUADS (geometry, hard edges) over a soft glow sprite:
// a sprite-texture star alone never survived bloom+JPEG at 7 m — its thin
// petals washed into a ball in every round (R4-R6). Quads keep full opacity
// and hard points, so they read at distance.
let _flashTex = null;
export function makeFlash(scale = 0.15) {
  if (!_flashTex) _flashTex = flashTex();
  const group = new THREE.Group();
  const mat = new THREE.SpriteMaterial({
    map: _flashTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.95,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale * 2.8, scale * 2.8, 1);
  group.add(sprite);
  // 8 kite petals: long even, short odd — the star points
  const petalMat = new THREE.MeshBasicMaterial({
    color: 0xffb050, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, fog: false,
  });
  const r = scale * 2.8; // sprite half-size: petals span the same disc
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    const len = (p % 2 === 0 ? 0.55 : 0.36) * r;
    const w = 0.075 * r;
    const s = new THREE.Shape();
    s.moveTo(Math.cos(a - 0.3) * w, Math.sin(a - 0.3) * w);
    s.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    s.lineTo(Math.cos(a + 0.3) * w, Math.sin(a + 0.3) * w);
    s.lineTo(0, 0);
    s.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), petalMat);
    m.position.z = 0.002;
    group.add(m);
  }
  const light = new THREE.PointLight(0xffc060, 10, 5, 2);
  group.add(light);
  return group;
}

// ---- tracer: thin bright line from muzzle toward the target ----
export function makeTracer(from, to, opacity = 0.5) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(0.004, 0.004, len, 6, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe8b0, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// ---- smoke plume: cluster of soft sprites, warm-lit, visible at 7 m ----
// Tested close-up first in look-dev: small sprites vanished at distance, so the
// plume uses larger, more opaque puffs (0.35-0.7 m) stacked along the shot line.
let _smokeTex = null;
export function makeSmoke(origin, dir, count = 5, seed = 3) {
  if (!_smokeTex) _smokeTex = smokeTex();
  const group = new THREE.Group();
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({
      map: _smokeTex, transparent: true, opacity: 0.45 + rnd() * 0.15,
      depthWrite: false, color: 0xe8ded2,
    });
    const sp = new THREE.Sprite(mat);
    const d = 0.15 + i * 0.22 + rnd() * 0.1;
    sp.position.copy(origin).addScaledVector(dir, d);
    sp.position.x += (rnd() - 0.5) * 0.25;
    sp.position.y += (rnd() - 0.5) * 0.2 + i * 0.03;
    const sc = 0.42 + i * 0.12 + rnd() * 0.15;
    sp.scale.set(sc, sc, 1);
    group.add(sp);
  }
  return group;
}

// ---- ejected brass casing (tiny, for the action feel) ----
export function makeCasing() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.018, 8), MAT.brass);
  return m;
}
