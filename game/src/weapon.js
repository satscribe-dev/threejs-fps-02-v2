// weapon.js — rifles built from parts (no downloaded models), hands that grip,
// muzzle flash (petal star), tracers and smoke. All measurements in metres.
import * as THREE from 'three';
import { chamferBox, box, lathe, capsule, ball } from './geom.js';
import { flashTex, softDiscTex, rifleSkinTex } from './textures.js';

// CELAH 1 + SKIN (16 Nov): "EMBER SPLINTER" — skin prosedural buat viewmodel
// SAJA (musuh tetap polos: buildRifle() tanpa opts.skin). Satu material
// dipakai keempat bagian yang di-skin (receiver + handguard + butt +
// cheek) supaya polanya nyambung; tekstur dibuat sekali (lazy) dan dipakai
// ulang. Barrel/bolt/rail/mag tetap metal/polymer — kontras metal vs skin
// yang bikin skin kebaca, bukan skin di semua bagian.
let _skinMat = null;
function skinMat() {
  if (!_skinMat) {
    _skinMat = new THREE.MeshStandardMaterial({ map: rifleSkinTex(), roughness: 0.6, metalness: 0.15 });
  }
  return _skinMat;
}

// R3: remap UV supaya tekstur skin mencakup SELURUH bagian (bukan slice
// acak). ExtrudeGeometry UV-nya mentah dalam meter — receiver (0,32 m)
// cuma menampilkan strip 6 cm dari tekstur 1 m, jadi R1/R2 itu lotre
// (R1: tan+oranye = salmon; R2: charcoal = hampir hitam). Di sini u <-
// panjang lokal (z) dan v <- tinggi lokal (y), keduanya 0..1 di bounding
// box geometri — sisi +X (yang menghadap kamera VM) menampilkan pola
// lengkap. Hanya dipakai di bagian ber-skin; material polos tidak pakai UV.
function skinUVs(mesh) {
  const geo = mesh.geometry;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  const sz = (bb.max.z - bb.min.z) || 1, sy = (bb.max.y - bb.min.y) || 1;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getZ(i) - bb.min.z) / sz, (pos.getY(i) - bb.min.y) / sy);
  }
  uv.needsUpdate = true;
  return mesh;
}

export const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4b4f53, metalness: 0.9, roughness: 0.38 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x26282b, metalness: 0.85, roughness: 0.45 }),
  // receiver gunmetal: metalness 0.55 (was steel 0.9) — a near-pure metal
  // reflects the dark dusk sky from the camera side and reads PURE BLACK.
  // Lower metalness lets the VM lights lift the side face to dark grey.
  receiver: new THREE.MeshStandardMaterial({ color: 0x565a5e, metalness: 0.55, roughness: 0.5 }),
  bolt: new THREE.MeshStandardMaterial({ color: 0x9a9da0, metalness: 0.9, roughness: 0.3 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x6b5d4f, metalness: 0.0, roughness: 0.8 }),
  // FIX 9 POIN P1 R4: polymer 0x38322c -> 0x6b5d4f (coklat-abu medium). Sarung
  // hitam di atas polymer gelap = nol kontras, jari menyatu jadi massa gelap.
  // Referensi CS: sarung hitam terbaca karena handguard TERANG. Ini bukan
  // copy warna CS (bukan tan/FDE) — medium warm grey, senapan tetap two-tone
  // gunmetal + polymer, bentuk/detail kita sendiri. Membantu poin 1 + 2.
  wood: new THREE.MeshStandardMaterial({ color: 0x5e3d22, metalness: 0.0, roughness: 0.7 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x8a6d3b, metalness: 0.9, roughness: 0.35 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x2a3a48, metalness: 0.4, roughness: 0.15, envMapIntensity: 1.4 }),
  // FIX 9 POIN P3: tactical sleeve — tan/olive (CS Dust reference: the
  // sleeve runs from the wrist to the frame edge, tan/olive, NOT black).
  // Rough cloth, no metalness. sleeveDark = cloth fold at the elbow.
  sleeve: new THREE.MeshStandardMaterial({ color: 0x6b6a4a, metalness: 0.0, roughness: 0.9 }),
  sleeveDark: new THREE.MeshStandardMaterial({ color: 0x55543c, metalness: 0.0, roughness: 0.95 }),
};

// Rifle, forward = +Z, muzzle at z ~ +0.48. Origin at the receiver centre, y = bore line.
// Returns { group, muzzle (Object3D), gripSocket, supportSocket, ejectSocket, parts }.
// opts.skin: pakai skin "EMBER SPLINTER" di receiver + handguard + stock
// (hanya viewmodel — musuh memanggil buildRifle() tanpa skin, tetap polos).
export function buildRifle(opts = {}) {
  const g = new THREE.Group();
  const parts = [];
  const add = (m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); g.add(m); parts.push(m); return m; };
  const skin = opts.skin ? skinMat() : null;

  // 1. receiver — extruded rounded slab (the body everything hangs from)
  // FIX VM-LOOK (16 Nov): was 0.055 x 0.075 — a fat black slab that merged
  // with the handguard into one black log on screen. Slimmed to 0.048 x 0.062
  // (CS proportions) so the magazine, rail and trigger break the silhouette.
  const receiver = chamferBox(0.048, 0.062, 0.32, 0.012, skin ?? MAT.receiver);
  if (skin) skinUVs(receiver);
  add(receiver, 0, 0, 0);
  // 2. barrel — lathe, stepped profile
  const barrel = lathe([[0.011, 0], [0.011, 0.16], [0.008, 0.17], [0.008, 0.30], [0.010, 0.31], [0.010, 0.33]], MAT.steelDark);
  barrel.rotation.x = Math.PI / 2; // lathe Y -> +Z
  add(barrel, 0, 0.012, 0.17);
  // 3. handguard — chamfered box with vent slots (slots as thin dark insets)
  // FIX VM-LOOK: was 0.062 x 0.062 (chunkier than the receiver — the main
  // "black log" mass). Slimmed to 0.050 x 0.050, slimmer than the receiver.
  const hg = chamferBox(0.050, 0.050, 0.22, 0.01, skin ?? MAT.polymer);
  if (skin) skinUVs(hg);
  add(hg, 0, 0.008, 0.26);
  for (let i = 0; i < 4; i++) {
    add(box(0.052, 0.010, 0.02, MAT.steelDark), 0, 0.02, 0.19 + i * 0.045);
  }
  // 4. magazine — tapered, slightly curved look via two stacked boxes
  const mag1 = chamferBox(0.042, 0.11, 0.075, 0.008, MAT.polymer);
  mag1.rotation.x = 0.12; add(mag1, 0, -0.085, 0.02);
  const mag2 = chamferBox(0.038, 0.05, 0.07, 0.008, MAT.steelDark);
  mag2.rotation.x = 0.12; add(mag2, 0, -0.155, 0.035);
  // 5-7. stock: butt plate, cheek rest, buffer tube
  const butt = chamferBox(0.045, 0.11, 0.03, 0.01, skin ?? MAT.polymer);
  if (skin) skinUVs(butt);
  add(butt, 0, -0.01, -0.235);
  const cheek = chamferBox(0.04, 0.035, 0.13, 0.008, skin ?? MAT.wood);
  if (skin) skinUVs(cheek);
  add(cheek, 0, 0.028, -0.19);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.13, 12), MAT.steel);
  tube.rotation.x = Math.PI / 2; add(tube, 0, 0.005, -0.17);
  // 8. pistol grip
  const grip = chamferBox(0.038, 0.10, 0.05, 0.012, MAT.polymer);
  grip.rotation.x = 0.35; add(grip, 0, -0.075, -0.085);
  // 9-10. trigger + guard
  // FIX 9 POIN P2 R2: trigger blade silver (was steelDark near-black) — the
  // black index finger ON a black trigger was invisible; a silver blade makes
  // the finger-on-trigger read, and a real trigger is often a distinct finish.
  const trig = box(0.012, 0.042, 0.012, MAT.bolt);
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
  // FIX VM-LOOK: the old post (0.006 x 0.035) was sub-pixel at VM distance.
  // Taller post + protective wings so the front sight READS like the CS one.
  const fs = box(0.010, 0.048, 0.010, MAT.steelDark);
  add(fs, 0, 0.056, 0.36);
  add(box(0.004, 0.022, 0.010, MAT.steelDark), -0.013, 0.044, 0.36);
  add(box(0.004, 0.022, 0.010, MAT.steelDark), 0.013, 0.044, 0.36);
  const rs = box(0.03, 0.025, 0.006, MAT.steelDark);
  add(rs, 0, 0.05, -0.10);
  // 15. top rail (Picatinny): thin bar + teeth
  // FIX VM-LOOK: teeth were 0.006 tall (invisible). Now 0.010 so the rail
  // reads as a separate serrated line above the handguard, not a black blob.
  const rail = box(0.04, 0.012, 0.30, MAT.steelDark);
  add(rail, 0, 0.043, 0.05);
  for (let i = 0; i < 12; i++) {
    add(box(0.044, 0.010, 0.008, MAT.steelDark), 0, 0.053, -0.08 + i * 0.024);
  }
  // 16. charging handle
  add(box(0.05, 0.012, 0.02, MAT.steelDark), 0, 0.038, -0.155);
  // 17. ejection port (dark inset on the side) + silver bolt inside it
  // FIX VM-LOOK: the old port was a 0.002 dark slab — invisible, so the
  // receiver side was one flat black plane. The silver bolt + selector + pins
  // below break the side face up so it reads as a rifle, not a black log.
  // All on the local +X side (x +0.024..0.028): that side faces the VM camera.
  add(box(0.002, 0.03, 0.07, MAT.steelDark), 0.028, 0.005, 0.06);
  add(box(0.005, 0.018, 0.05, MAT.bolt), 0.027, 0.005, 0.06);
  // 17b. selector switch (disc) + takedown pins + mag release, camera side
  const sel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), MAT.steelDark);
  sel.rotation.z = Math.PI / 2; add(sel, 0.026, -0.005, -0.05);
  for (const [py, pz] of [[0.012, 0.12], [-0.012, -0.13]]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 10), MAT.steel);
    pin.rotation.z = Math.PI / 2; add(pin, 0.026, py, pz);
  }
  add(box(0.004, 0.012, 0.015, MAT.steelDark), 0.026, -0.022, -0.01);
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
  // FIX 9 POIN P4: support socket PINDAH dari foregrip (z 0.30) ke HANDGUARD
  // (z 0.22, y -0.017 = permukaan bawah handguard). Tangan kiri musuh HARUS
  // di handguard 25-35 cm di depan pistol grip (grip z -0.085 -> 0.22 =
  // 30,5 cm, sama kayak tangan support viewmodel). Socket lama bikin IK
  // kehabisan jangkauan: bahu kiri -> socket 0,63 m > 0,58 m maks (dL
  // baseline 0,0554 m). Socket baru: ~0,52-0,55 m, dalam jangkauan.
  supportSocket.position.set(0, -0.017, 0.22); // handguard
  g.add(supportSocket);
  const ejectSocket = new THREE.Object3D();
  ejectSocket.position.set(0.035, 0.005, 0.06);
  g.add(ejectSocket);

  return { group: g, muzzle, gripSocket, supportSocket, ejectSocket, parts };
}

// ---- a hand: rounded palm, 4 three-segment curled fingers, thumb, cuff ----
// The hand's local +Z is "forward" (direction the fingers point when flat);
// fingers curl toward -Y (closing around a grip). Scale ~1 = adult hand.
// opts.triggerFinger: the index finger stays nearly straight and angles
// toward the trigger (firing pose) instead of curling around the grip.
export function buildHand(glove = 0x17171a, skin = 0x8a6f56, opts = {}) {
  const g = new THREE.Group();
  const gloveMat = new THREE.MeshStandardMaterial({ color: glove, metalness: 0, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, metalness: 0, roughness: 0.7 });
  // palm: flattened sphere
  // FIX VM-LOOK (16 Nov): palm was r 0.042 — the hands read small and pale
  // against the rifle. Chunkier palm (r 0.052) + thicker fingers + longer
  // cuff/sleeve so the BLACK glove is the focal point, like the CS reference.
  // Finger LENGTHS and curls are unchanged, so the fingertip positions (and
  // the grip contact the probe verifies) do not move.
  const palm = ball(0.052, gloveMat);
  palm.scale.set(0.95, 0.36, 1.35);
  // FIX 9 POIN P1 R2: palm flatter (was 1.05, 0.45, 1.25) — round 1 it read as
  // a ball under the handguard; a flatter, longer palm hugs the handguard
  // bottom and reads as a hand, not a mitten. (Shared by VM + enemy hands.)
  palm.position.set(0, 0, 0.01);
  g.add(palm);
  // 4 fingers: 3 capsule segments each, curling 35/55/35 degrees.
  // Lengths taper: index 0.075, middle 0.085, ring 0.08, pinky 0.06 (segment ratio 40/30/30).
  // FIX 9 POIN P1 R3: spread the finger bases WIDE (was -0.030..0.029) so the
  // fingertips land OUTSIDE the handguard box (|x| 0.025..0.045) instead of
  // clipping through it. Round 2's fan (pivot.rotation.y) was the wrong
  // mechanism — the tip sits almost above the pivot (z-offset 0.013), so the
  // fan barely moved the tips and pushed the index 2.9 cm off the surface.
  // The spread puts the near-side fingers on the camera side of the handguard
  // and the far-side fingers at the far edge, tips peeking over the rail.
  const fingerLen = [0.075, 0.085, 0.08, 0.06];
  // FIX 9 POIN P2 R4: index KEMBALI ke -0.038 (was -0.044 di R3) — R3
  // melebarkan spread index ikut menggeser ujung jari tangan KIRI keluar
  // handguard (probe handL index 0.018 -> 0.024, GAGAL >2 cm). Jari 1-3
  // tetap lebar (-0.032/0.032/0.044): probe handL mereka tetap lolos
  // (0.012/0.002/0.014) dan probe handR tidak berubah.
  // BOMB R2 (16 Nov): spread lebar di atas dirancang buat handguard senapan
  // yang SEMPIT (0,05 m) — jari harus di dua sisi handguard. Buat BLOK BOM
  // (0,17 m), tangan di SATU sisi: semua jari harus di sisi yang sama,
  // dalam klaster sempit di dekat muka blok (±0,085). opts.fingerX menimpa
  // spread default (nilai dicerminkan per tangan di main.js — kiri negatif,
  // kanan positif — karena Rz(180) membalik sumbu X).
  const fingerX = opts.fingerX ?? [-0.038, -0.032, 0.032, 0.044];
  // FIX 9 POIN P1 R5 (koreksi user 17:12 + ref CS Dust baru): jari di-STAGGER
  // sepanjang handguard (index paling depan, kelingking paling belakang) —
  // dari samping/3q, ke-4 jari ada di 4 titik berbeda sepanjang laras dan
  // terbaca terpisah, bukan 2 pasang yang saling menumpuk. (Sebelumnya semua
  // pivot di z yang sama, jadi dari samping jari menumpuk jadi satu massa.)
  const fingerZ = [0.069, 0.060, 0.050, 0.041];
  const fingers = [];
  for (let f = 0; f < 4; f++) {
    const segs = [];
    let pivot = new THREE.Group();
    pivot.position.set(fingerX[f], 0, fingerZ[f]);
    g.add(pivot);
    let parent = pivot;
    // FIX 9 POIN P2: index finger (f==0) on the trigger when triggerFinger
    // is set — nearly straight (curls 0.10/0.15/0.10) and angled toward the
    // trigger blade (pivot rotation.y 0.79, rotation.x 0.68: computed from the
    // hand pose so the tip lands on the trigger at rifle (0,-0.055,-0.045)).
    // Length 0.085 (was 0.075) — the trigger is 0.086 m from the index base.
    const total = f === 0 && opts.triggerFinger ? 0.085 : fingerLen[f];
    const lens = [total * 0.4, total * 0.3, total * 0.3];
    const curls = f === 0 && opts.triggerFinger ? [0.10, 0.15, 0.10] : [0.61, 0.96, 0.61]; // 35, 55, 35 degrees in radians
    for (let s = 0; s < 3; s++) {
      const seg = new THREE.Group();
      seg.position.set(0, 0, s === 0 ? 0 : lens[s - 1]);
      seg.rotation.x = s === 0 ? 0 : curls[s - 1];
      parent.add(seg);
      const cap = capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, lens[s]), 0.0095 - s * 0.0012, gloveMat);
      seg.add(cap);
      segs.push(seg);
      parent = seg;
    }
    // first segment curls from the knuckle
    if (f === 0 && opts.triggerFinger) {
      pivot.rotation.set(0.68, 0.79, 0);
    } else {
      pivot.rotation.x = curls[0];
    }
    fingers.push({ pivot, segs });
  }
  // thumb: starts at the palm side near the wrist, points across the grip
  // FIX 9 POIN P2 R3: thumb base ke sisi KAMERA (hand-local y -0.035 ->
  // rifle +X setelah rotasi tangan) — sebelumnya thumb di garis tengah grip
  // (x ~0.005) dan tersembunyi di balik grip dari kamera samping. Jempol
  // harus kebaca di sisi grip, seperti referensi CS.
  // BOMB R2 (16 Nov): opts.thumbX menimpa posisi dasar jempol (default
  // -0,030 — buat tangan senapan). Buat tangan bom, jempol harus di sisi
  // LUAR blok (bukan menembus blok / melayang jauh) — dicerminkan per
  // tangan di main.js (kiri +0,015 / kanan -0,015, atau 0 = tepat di
  // luar muka blok).
  const thumbBase = new THREE.Group();
  thumbBase.position.set(opts.thumbX ?? -0.030, -0.035, 0.01);
  thumbBase.rotation.set(0.5, 0, 0.9);
  g.add(thumbBase);
  const th1 = capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.03), 0.012, gloveMat);
  thumbBase.add(th1);
  const th2 = new THREE.Group();
  th2.position.set(0, 0, 0.03); th2.rotation.x = 0.7;
  thumbBase.add(th2);
  th2.add(capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.028), 0.011, gloveMat));
  // cuff + sleeve at the wrist: longer than before so the forearm reads as
  // part of the glove mass (CS: the sleeve runs from the wrist to the frame
  // edge). The cuff is on the hand's -Z side, away from the fingers.
  // FIX 9 POIN P2 R3: cuff dirampingkan (r 0.038/0.043, len 0.08 — was
  // 0.042/0.048, 0.10): di close-up R2 manset hitam raksasa mendominasi
  // tangan. Lengan penuh yang sesungguhnya datang di poin 3.
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.043, 0.08, 12), gloveMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0, -0.085);
  g.add(cuff);
  // fingertip marker (used by the socket probe): tip of the middle finger
  const tip = new THREE.Object3D();
  tip.position.set(-0.010, -0.028, 0.115);
  g.add(tip);
  return { group: g, fingers, tip, skinMat };
}

// FIX 9 POIN P3 — full arm: forearm (tapering) + elbow + upper arm, in a
// tactical sleeve (tan/olive, CS Dust reference). The arm is a child of the
// HAND group, so it follows the hand during recoil / sway / reload / weapon
// switch — it can never detach from the wrist. The direction is given in VM
// space (down + outward + toward the camera, so the arm runs to the bottom
// corner and ALWAYS exits the frame) and converted to hand-local via the
// hand's world quaternion — call AFTER the rifle is in the scene and
// updateMatrixWorld() has run, or the conversion is garbage.
// Elbow: the upper arm bends ~20 deg further down than the forearm (a real
// arm is never a straight pipe). A darker fold ring at the elbow suggests
// cloth creasing. The forearm starts inside the palm (hidden) and passes
// through the black glove cuff at the wrist, so there is no open gap and no
// visible cut — the arm end (armEnd marker) must project OUTSIDE the frame.
// Returns { group, armEnd }.
export function buildArm(handGroup, dirVM, opts = {}) {
  const g = new THREE.Group();
  const q = new THREE.Quaternion();
  handGroup.getWorldQuaternion(q);
  const qInv = q.clone().invert();
  const foreDir = dirVM.clone().normalize();
  // elbow bend: rotate the forearm direction toward VM down (-Y) so the
  // upper arm runs more steeply down to the frame edge.
  const down = new THREE.Vector3(0, -1, 0);
  const bendAxis = new THREE.Vector3().crossVectors(foreDir, down);
  if (bendAxis.lengthSq() < 1e-6) bendAxis.set(1, 0, 0); // parallel: any axis
  bendAxis.normalize();
  const upperDir = foreDir.clone().applyAxisAngle(bendAxis, THREE.MathUtils.degToRad(opts.bend ?? 20));
  const foreLocal = foreDir.clone().applyQuaternion(qInv);
  const upperLocal = upperDir.clone().applyQuaternion(qInv);
  const foreLen = opts.foreLen ?? 0.28;
  const upperLen = opts.upperLen ?? 0.30;
  const elbow = foreLocal.clone().multiplyScalar(foreLen);
  // tapered cylinder helper (wrist -> elbow): a real forearm tapers from the
  // wrist to the elbow; a uniform capsule reads as a pipe. Open ends are
  // fine — the wrist end hides inside the palm, the elbow end inside the
  // elbow ball, the far end outside the frame.
  const taperTube = (a, b, rA, rB, mat) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, len, 12), mat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  };
  // forearm: wrist -> elbow (sleeve), tapering 0.036 (wrist) -> 0.046 (elbow).
  // Starts at the hand origin, inside the palm, so the wrist joint is never open.
  g.add(taperTube(new THREE.Vector3(0, 0, 0), elbow, 0.036, 0.046, MAT.sleeve));
  // elbow: ball (joint) + subtler fold ring (cloth crease at the bend).
  // R2: ring lebih tipis + lebih terang (was sleeveDark 0x55543c, tube 0.007 —
  // di R1 kebaca seperti tali/strap gelap, bukan lipatan kain).
  const elbowBall = ball(0.046, MAT.sleeve);
  elbowBall.position.copy(elbow);
  g.add(elbowBall);
  const foldMat = new THREE.MeshStandardMaterial({ color: 0x60604a, metalness: 0.0, roughness: 0.95 });
  const fold = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 8, 18), foldMat);
  fold.position.copy(elbow);
  fold.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), foreLocal.clone().normalize());
  g.add(fold);
  // upper arm: elbow -> end, tapering 0.046 -> 0.054 (slightly thicker).
  const end = elbow.clone().addScaledVector(upperLocal, upperLen);
  g.add(taperTube(elbow, end, 0.046, 0.054, MAT.sleeve));
  // armEnd marker: the harness projects this — it MUST be outside the frame.
  const armEnd = new THREE.Object3D();
  armEnd.name = 'armEnd';
  armEnd.position.copy(end);
  g.add(armEnd);
  handGroup.add(g);
  return { group: g, armEnd };
}

// ---- muzzle flash: petal-star sprite + point light, frozen at peak ----
// The star is 8 kite QUADS (geometry, hard edges) over a soft glow sprite:
// a sprite-texture star alone never survived bloom+JPEG at 7 m — its thin
// petals washed into a ball in every round (R4-R6). Quads keep full opacity
// and hard points, so they read at distance.
let _flashTex = null;
// BOMB R2 (16 Nov) — blok charge C4-style, BUKAN dua drum raksasa.
// Koreksi user 23:17 + 23:24 WIB: bom lama (dua silinder hijau mulus +
// panel peach polos) kebaca kayak teropong, tanpa timer. Dan timer baru
// NYALA setelah di-plant — Kilnyard-2 lagi PLANTING (bar ~55%), jadi di
// shot arming ini layar timer HARUS GELAP/MATI, bukan nyala merah.
// Yang dibangun: SATU blok charge persegi (olive drab, tutup ujung gelap)
// + unit timer di atas (layar kaca GELAP — hardware ada, mati; keypad
// 3x3 tombol; LED merah GELAP tanpa emissive) + kabel + tali pengikat.
// Sumbu panjang = Z (seperti senapan); tangan megang di sisi blok lewat
// anchor gripL/gripR. Prosedural penuh, tidak ada rng — deterministik.
export function buildBomb() {
  const g = new THREE.Group();
  const oliveMat = new THREE.MeshStandardMaterial({ color: 0x44521f, metalness: 0.15, roughness: 0.55 });
  const oliveDarkMat = new THREE.MeshStandardMaterial({ color: 0x2e3a16, metalness: 0.15, roughness: 0.6 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, metalness: 0.3, roughness: 0.5 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x11161c, metalness: 0.4, roughness: 0.2 });
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.2, roughness: 0.6 });
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.2, roughness: 0.5 });
  const buttonTopMat = new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.2, roughness: 0.45 });
  const ledOffMat = new THREE.MeshStandardMaterial({ color: 0x330000, metalness: 0.1, roughness: 0.4 });
  const cableRedMat = new THREE.MeshStandardMaterial({ color: 0x5a1a1a, metalness: 0.0, roughness: 0.6 });
  const cableBlackMat = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.0, roughness: 0.6 });
  // 1. badan charge: SATU blok persegi (chamfer), bukan dua drum.
  const body = chamferBox(0.17, 0.10, 0.30, 0.015, oliveMat);
  g.add(body);
  // 2. tutup ujung lebih gelap (depan + belakang)
  for (const ez of [-0.15, 0.15]) {
    const cap = box(0.172, 0.102, 0.012, oliveDarkMat);
    cap.position.set(0, 0, ez);
    g.add(cap);
  }
  // 3. tali pengikat gelap di tengah — mengikat blok jadi SATU charge
  const strap = box(0.176, 0.106, 0.03, bezelMat);
  strap.position.set(0, 0, -0.08);
  g.add(strap);
  // 4. unit timer di atas blok: housing gelap + layar kaca GELAP (mati) +
  // keypad 3x3 + LED merah GELAP (tanpa emissive — timer baru nyala abis
  // plant, bukan pas arming). Layar cukup besar buat kebaca sebagai layar
  // timer, tapi GELAP: kaca 0x11161c, roughness 0.2 — cuma kilau samar
  // dari lampu VM, tanpa angka, tanpa cahaya.
  const housing = box(0.13, 0.03, 0.17, housingMat);
  housing.position.set(0, 0.065, 0.01);
  g.add(housing);
  // bezel layar: lempeng gelap di bawah layar (bingkai)
  const bezel = box(0.09, 0.006, 0.07, bezelMat);
  bezel.position.set(0, 0.082, -0.045);
  g.add(bezel);
  // layar timer GELAP (mati)
  const screen = box(0.08, 0.006, 0.06, screenMat);
  screen.position.set(0, 0.084, -0.045);
  g.add(screen);
  // keypad 3x3 tombol kecil di belakang layar (dua warna berselang biar
  // tiap tombol kebaca terpisah, bukan satu lempeng)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const key = box(0.02, 0.007, 0.02, (r + c) % 2 === 0 ? buttonMat : buttonTopMat);
      key.position.set(-0.026 + c * 0.026, 0.083, 0.03 + r * 0.026);
      g.add(key);
    }
  }
  // LED merah GELAP (mati) di ujung depan housing
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), ledOffMat);
  led.position.set(0.05, 0.082, 0.085);
  g.add(led);
  // 5. kabel merah + hitam dari housing turun ke sisi kanan blok
  const cable = (mat, x) => {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 8), mat);
    v.position.set(x, 0.03, 0.06);
    g.add(v);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 8), mat);
    h.rotation.x = Math.PI / 2;
    h.position.set(x, -0.005, 0.0);
    g.add(h);
  };
  cable(cableRedMat, 0.088);
  cable(cableBlackMat, 0.096);
  // anchor tangan: di SISI blok (x ±0.105), telapak di bawah sisi blok,
  // jari melingkar ke atas melewati sisi blok dan kebaca kamera. (R2 lama:
  // anchor di bawah silinder — tangan ketutup; di sisi luar, jari kebaca.)
  // BOMB R2: anchor naik y -0.05 -> -0.02 — ujung jari (naik ~0,06 dari
  // pivot) kini di y ~0,04, dekat tepi atas blok (0,05), jadi jari
  // mengait ke tepi atas, bukan berhenti di tengah sisi blok.
  // BOMB R3: anchor naik lagi y -0.02 -> 0.00 — ujung jari kini di
  // y ~0,06, MELEWATI tepi atas (0,05): jari mengait ke atas tepi,
  // bukan cuma menunjuk ke atas di samping blok (R2: di close-up depan
  // jari kebaca seperti cakar, bukan genggaman). Telapak kini di
  // tengah sisi blok (y 0,00), menempel di muka blok.
  const gripL = new THREE.Object3D();
  gripL.position.set(-0.105, 0.00, 0.05);
  g.add(gripL);
  const gripR = new THREE.Object3D();
  gripR.position.set(0.105, 0.00, 0.05);
  g.add(gripR);
  return { group: g, gripL, gripR };
}

export function makeFlash(scale = 0.15, lightIntensity = 10) {
  if (!_flashTex) _flashTex = flashTex();
  const group = new THREE.Group();
  // Soft glow ball KEPT SMALLER/DIMMER than the star: in R4-R7 the ball
  // (sprite 2.8x, opacity 0.95) swallowed the petals at 7 m and read as a
  // white blob in full frame. The star must extend BEYOND the ball.
  const mat = new THREE.SpriteMaterial({
    map: _flashTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.7,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale * 2.0, scale * 2.0, 1);
  group.add(sprite);
  // 8 kite petals: long even, short odd — the star points.
  // FIX ROUND (16 Nov): petals 2x WIDER and LONGER than R7 (w 0.075r->0.15r,
  // even len 0.55->0.75, odd 0.36->0.5) and r 2.8->3.2 so the rays stick out
  // past the glow ball — at 7 m a 3px ray washes out in bloom+JPEG, a 10px
  // ray survives.
  const petalMat = new THREE.MeshBasicMaterial({
    color: 0xffb050, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, fog: false,
  });
  const r = scale * 3.2; // petal span: wider than the glow disc
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    const len = (p % 2 === 0 ? 0.75 : 0.5) * r;
    const w = 0.15 * r;
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
  const light = new THREE.PointLight(0xffc060, lightIntensity, 5, 2);
  group.add(light);
  return group;
}

// ---- tracer: bright line from muzzle toward the target ----
// FIX ROUND (16 Nov): radius 0.004 was sub-pixel at 7 m (0.008 m dia ~ 0.5 px)
// so the tracer was invisible in full frame. 0.012 (0.024 m dia ~ 1.5 px at
// 7 m, ~4 px at 2 m) reads as a line without becoming the R1 wedge — both
// ends stay >= 2 m from the camera, so a thicker line cannot fill the lens.
export function makeTracer(from, to, opacity = 0.5) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(0.012, 0.012, len, 6, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe8b0, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// ---- muzzle smoke: small soft points, NOT big sprites ----
// Cause (diagnosed 16 Nov, celah 2 + P9): the old plume was 5 sprites
// (0.42-1.0 m, smokeTex) — two failures: (1) near the lens a 1 m sprite
// fills the frame, so the plume "piled up" as a wall; (2) transparent
// sprites are blackened by the GTAO pass (proven A-F: texture light,
// fog=false/map=null/depthWrite=true still black, light in the VM
// without the composer; mesh spheres and THREE.Points render light).
// Fix: THREE.Points + softDiscTex, 12 small points (0.14 m) spread along
// the shot line — small enough not to wall the lens at 0.5 m, and Points
// survive GTAO (verified at the chimney, diagnostic F).
let _puffTex = null;
export function makeSmoke(origin, dir, count = 16, seed = 3) {
  if (!_puffTex) _puffTex = softDiscTex('rgba(232,222,210,0.9)', 'rgba(232,222,210,0)');
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const d = 0.1 + i * 0.08 + rnd() * 0.06;
    // R3: sebaran lateral dilebarin (+-0.2 m) + naik i*0.04 (total 0.64 m)
    // — plume di 7 m tadinya gumpalan ~30 px yang ketutup bintang flash
    // (0.36) di posisi yang sama; sekarang melebar + naik ke atas/samping
    // flash, jadi mengintip dari balik bintang.
    pos[i * 3] = origin.x + dir.x * d + (rnd() - 0.5) * 0.4;
    pos[i * 3 + 1] = origin.y + dir.y * d + (rnd() - 0.5) * 0.32 + i * 0.04;
    pos[i * 3 + 2] = origin.z + dir.z * d + (rnd() - 0.5) * 0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.22, sizeAttenuation: true, map: _puffTex, transparent: true,
    opacity: 0.6, depthWrite: false, color: 0xe8ded2,
  }));
  pts.frustumCulled = false;
  return pts;
}

// ---- ejected brass casing (tiny, for the action feel) ----
export function makeCasing() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.018, 8), MAT.brass);
  return m;
}
