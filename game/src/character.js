// character.js — 7.5-head soldier built from parts. Proportions for a 1.80 m adult:
// head 0.24 m, shoulders 0.46 m (2 head-widths), pubis = body midpoint.
// No raw BoxGeometry on the body: chamfered boxes so edges catch light.
// Arms use analytic two-bone IK (law of cosines) so the wrists land on the rifle sockets.
import * as THREE from 'three';
import { chamferBox, box, capsule, ball, tube } from './geom.js';
import { buildRifle, buildHand } from './weapon.js';
import { nameTagTex } from './textures.js';

const DOWN = new THREE.Vector3(0, -1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

export const TEAMS = {
  EMBER: { shirt: 0x8a4a34, pants: 0x5a4a3c, vest: 0x6b5a3a, helmet: 0x5a5a3a, name: 'EMBER' },
  SLATE: { shirt: 0x6b7d8e, pants: 0x4d5a68, vest: 0x4a5458, helmet: 0x55604f, name: 'SLATE' },
};

function std(color, rough = 0.8, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
}

// Analytic two-bone IK. arm = { shoulder, elbow, wrist, upperLen, foreLen, pole }.
// All pivots live in the same parent space; target is in that space too.
export function solveArm(arm, target) {
  const S = arm.shoulder.position;
  const d0 = _v1.copy(target).sub(S);
  const d = THREE.MathUtils.clamp(d0.length(), Math.abs(arm.upperLen - arm.foreLen) + 0.01, arm.upperLen + arm.foreLen - 0.01);
  const dir = d0.normalize();
  const cosA = THREE.MathUtils.clamp(
    (arm.upperLen * arm.upperLen + d * d - arm.foreLen * arm.foreLen) / (2 * arm.upperLen * d), -1, 1);
  const A = Math.acos(cosA);
  const axis = _v2.crossVectors(dir, arm.pole).normalize();
  if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
  const elbowDir = _v3.copy(dir).applyAxisAngle(axis, A).normalize();
  const E = new THREE.Vector3().copy(S).addScaledVector(elbowDir, arm.upperLen);
  const foreDir = new THREE.Vector3().copy(target).sub(E).normalize();
  _q1.setFromUnitVectors(DOWN, elbowDir);
  arm.shoulder.quaternion.copy(_q1);
  _q2.setFromUnitVectors(DOWN, foreDir);
  arm.elbow.quaternion.copy(_q1.clone().invert().multiply(_q2));
  return E;
}

export function buildSoldier(teamKey, name, seed = 1) {
  const team = TEAMS[teamKey] || TEAMS.EMBER;
  const shirt = std(team.shirt, 0.85);
  const pants = std(team.pants, 0.9);
  const vestMat = std(team.vest, 0.75);
  const helmetMat = std(team.helmet, 0.6);
  const dark = std(0x1e1e1c, 0.9);       // balaclava
  const skin = std(0x8a6f56, 0.75);
  const bootMat = std(0x2a241e, 0.85);

  const root = new THREE.Group();        // at ground, faces +Z
  const upper = new THREE.Group();       // leans / turns with the torso
  upper.position.y = 0.86;
  root.add(upper);

  // ---- torso: two tapered segments + trapezius wedge ----
  const abdomen = chamferBox(0.40, 0.30, 0.22, 0.03, shirt);
  abdomen.position.set(0, 0.14, 0);
  upper.add(abdomen);
  const chest = chamferBox(0.46, 0.34, 0.25, 0.04, shirt);
  chest.position.set(0, 0.42, 0);
  upper.add(chest);
  const trap = chamferBox(0.34, 0.12, 0.20, 0.03, shirt);
  trap.position.set(0, 0.60, -0.01);
  upper.add(trap);
  // hips
  const hips = chamferBox(0.40, 0.20, 0.23, 0.03, pants);
  hips.position.set(0, -0.06, 0);
  upper.add(hips);
  // belt (not floating: sits on the hips)
  const belt = chamferBox(0.41, 0.06, 0.24, 0.015, std(0x2a241e, 0.8));
  belt.position.set(0, 0.03, 0);
  upper.add(belt);

  // ---- vest: full plate carrier + pouches (reads at 3 m) ----
  const plate = chamferBox(0.38, 0.34, 0.07, 0.02, vestMat);
  plate.position.set(0, 0.42, 0.15);
  upper.add(plate);
  const backPlate = chamferBox(0.38, 0.34, 0.06, 0.02, vestMat);
  backPlate.position.set(0, 0.42, -0.15);
  upper.add(backPlate);
  for (const px of [-0.11, 0.11]) {
    const pouch = chamferBox(0.12, 0.13, 0.06, 0.015, std(team.vest, 0.8));
    pouch.position.set(px, 0.36, 0.21);
    upper.add(pouch);
  }
  const sidePouch = chamferBox(0.06, 0.16, 0.12, 0.015, vestMat);
  sidePouch.position.set(0.24, 0.38, 0.05);
  upper.add(sidePouch);

  // ---- neck + head: balaclava ball, helmet over it, goggles in front ----
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.10, 10), skin);
  neck.position.set(0, 0.66, 0);
  upper.add(neck);
  const headG = new THREE.Group();
  headG.position.set(0, 0.80, 0);
  upper.add(headG);
  const skull = ball(0.115, dark);
  headG.add(skull);
  const helmet = ball(0.13, helmetMat);
  helmet.scale.set(1, 0.85, 1.05);
  helmet.position.set(0, 0.03, -0.01);
  headG.add(helmet);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.025, 16), helmetMat);
  brim.position.set(0, 0.055, 0);
  headG.add(brim);
  // goggle band (torus) + lenses IN FRONT of the band (z = +0.15 lesson)
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.024, 10, 24), dark);
  band.position.set(0, 0.01, 0.005);
  headG.add(band);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x2a3a48, metalness: 0.4, roughness: 0.15, envMapIntensity: 1.2 });
  for (const lx of [-0.048, 0.048]) {
    const lens = ball(0.032, lensMat);
    lens.scale.set(1, 0.75, 0.5);
    lens.position.set(lx, 0.01, 0.105);
    headG.add(lens);
  }
  // nose hint under the goggles (keeps the face from being a void)
  const nose = chamferBox(0.02, 0.035, 0.02, 0.008, dark);
  nose.position.set(0, -0.045, 0.105);
  headG.add(nose);

  // ---- arms: shoulder pivot -> upper -> elbow pivot -> forearm -> wrist ----
  function makeArm(side) { // side: -1 left, +1 right
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.26, 0.56, 0);
    upper.add(shoulder);
    const up = capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.30, 0), 0.055, shirt);
    shoulder.add(up);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.30, 0);
    shoulder.add(elbow);
    const fore = capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.28, 0), 0.048, shirt);
    elbow.add(fore);
    const wrist = new THREE.Group();
    wrist.position.set(0, -0.28, 0);
    elbow.add(wrist);
    return { shoulder, elbow, wrist, upperLen: 0.30, foreLen: 0.28, pole: new THREE.Vector3(side * 0.7, -0.6, -0.4).normalize() };
  }
  const armR = makeArm(1);
  const armL = makeArm(-1);

  // ---- legs: hip pivot -> thigh -> knee -> calf -> boot ----
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, -0.10, 0);
    upper.add(hip);
    const thigh = capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.42, 0), 0.07, pants);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.set(0, -0.42, 0);
    hip.add(knee);
    const kneeCap = ball(0.075, pants);
    knee.add(kneeCap);
    const calf = capsule(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.38, 0), 0.058, pants);
    knee.add(calf);
    const boot = chamferBox(0.11, 0.09, 0.26, 0.02, bootMat);
    boot.position.set(0, -0.44, 0.05);
    knee.add(boot);
    return { hip, knee };
  }
  const legR = makeLeg(1);
  const legL = makeLeg(-1);

  // ---- rifle: origin forward of the chest (z = 0.24 lesson) ----
  // FIX 9 POIN P4: rifle digeser ke kanan (x 0.06 -> 0.12) supaya popor
  // lebih dekat ke bahu kanan (bahu kanan di x 0.26). Posisi + sudut aim
  // -0.46 (di setPose) menaruh popor ~7 cm dari bahu kanan.
  const rifle = buildRifle();
  rifle.group.position.set(0.12, 0.57, 0.24);
  rifle.group.rotation.y = -0.06; // slight diagonal so the barrel reads from the front
  upper.add(rifle.group);

  // ---- hands on the sockets ----
  // FIX 9 POIN P4: sarung HITAM (was 0x4a4438 krem) — sarung krem di atas
  // baju tan = nol kontras, tangan musuh tidak terbaca sama sekali di
  // baseline (blob krem). Sarung hitam sama kayak tangan viewmodel.
  const handR = buildHand(0x17171a);
  const handL = buildHand(0x17171a);
  armR.wrist.add(handR.group);
  armL.wrist.add(handL.group);

  // ---- name tag (hidden in duel — old black-quad lesson) ----
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({
    map: nameTagTex(name, teamKey === 'EMBER' ? '#f0a080' : '#a0c0e0'),
    transparent: true, depthWrite: false,
  }));
  tag.scale.set(0.55, 0.14, 1);
  tag.position.set(0, 2.02, 0);
  root.add(tag);

  // blob shadow under the feet
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.015;
  root.add(blob);

  const soldier = {
    group: root, upper, head: headG, armR, armL, legR, legL,
    rifle, handR, handL, tag, name, team: teamKey,
    pose: 'idle', walkPhase: seed * 1.7, fall: 0, dead: false,
  };

  // Place both wrists on the rifle sockets via IK. Call after the soldier is
  // in the scene (needs updated world matrices).
  soldier.gripRifle = function () {
    upper.updateMatrixWorld(true);
    const tR = new THREE.Vector3();
    const tL = new THREE.Vector3();
    rifle.gripSocket.getWorldPosition(tR);
    rifle.supportSocket.getWorldPosition(tL);
    upper.worldToLocal(tR);
    upper.worldToLocal(tL);
    solveArm(armR, tR);
    solveArm(armL, tL);
    // hands: palm faces the grip, fingers curl around it (rifle axis = +Z)
    handR.group.rotation.set(0.5, 0, -0.35);
    handL.group.rotation.set(0.35, Math.PI, 0.25);
    // check: wrist-to-socket distance (for the socket probe)
    const wR = new THREE.Vector3(); const wL = new THREE.Vector3();
    armR.wrist.getWorldPosition(wR); armL.wrist.getWorldPosition(wL);
    const sR = new THREE.Vector3(); const sL = new THREE.Vector3();
    rifle.gripSocket.getWorldPosition(sR); rifle.supportSocket.getWorldPosition(sL);
    soldier.gripError = { dR: wR.distanceTo(sR), dL: wL.distanceTo(sL) };
  };

  soldier.setPose = function (pose, opts = {}) {
    soldier.pose = pose;
    upper.rotation.x = 0; upper.rotation.z = 0;
    upper.rotation.y = 0; // FIX 9 POIN P4: reset (aim pose memutar torso +0.46)
    upper.position.y = 0.86; // FIX 9 POIN P4 R2: reset (crouch menurunkan ke 0.62;
    // tanpa reset, crouch -> aim/idle membiarkan torso tetap jongkok)
    root.rotation.x = 0; root.position.y = 0;
    legR.hip.rotation.x = 0; legL.hip.rotation.x = 0;
    legR.knee.rotation.x = 0; legL.knee.rotation.x = 0;
    headG.rotation.x = 0;
    headG.rotation.y = 0; // FIX 9 POIN P4: reset (aim pose memutar kepala -0.46)
    if (pose === 'aim') {
      upper.rotation.x = 0.10; // lean into the shot
      // FIX 9 POIN P4 — shouldered rifle: popor di bahu kanan. Senapan
      // di-angle -0.46 (26 deg) ke kiri relatif ke torso supaya popor (z -0.35
      // di rifle space) mendarat di bahu kanan (x 0.26), BUKAN di tengah dada.
      // Torso di-blade +0.46 (menghadap kanan) supaya laras tetap menunjuk
      // lurus ke depan (ke target) — 0.46 - 0.46 = 0. Kepala diputar -0.46
      // supaya tetap menatap target (bukan ikut torso). Ini stance menembak
      // yang benar (bladed), bukan manekin menghadap depan. Tanpa blade,
      // popor di bahu kanan = laras 26 deg meleset dari target.
      rifle.group.rotation.x = 0; rifle.group.rotation.y = -0.46;
      upper.rotation.y = 0.46;
      headG.rotation.y = -0.46;
      headG.rotation.x = 0.06;
      legR.hip.rotation.x = -0.18; legL.hip.rotation.x = 0.10;
      legR.knee.rotation.x = 0.22; legL.knee.rotation.x = 0.12;
    } else if (pose === 'idle') {
      rifle.group.rotation.y = -0.85; // rifle across the chest, diagonal
      rifle.group.rotation.x = 0.15;
      legR.hip.rotation.x = -0.05; legL.hip.rotation.x = 0.05;
    } else if (pose === 'crouch') {
      upper.position.y = 0.62;
      legR.hip.rotation.x = -1.1; legL.hip.rotation.x = -0.9;
      legR.knee.rotation.x = 1.5; legL.knee.rotation.x = 1.4;
      upper.rotation.x = 0.22;
      // FIX 9 POIN P4 R2: shouldering yang sama kayak aim — di R1 crouch
      // masih pakai rotation.y -0.02 (laras lurus), jadi socket 0,594 m dari
      // bahu kiri (dL 0,0235, GAGAL) dan popor 0,173 m dari bahu kanan.
      // Crouch = aim sambil jongkok, jadi senapan tetap di bahu.
      rifle.group.rotation.y = -0.46;
      upper.rotation.y = 0.46;
      headG.rotation.y = -0.46;
    } else if (pose === 'dead') {
      soldier.dead = true;
      root.rotation.x = -Math.PI / 2 + 0.12;
      root.position.y = 0.16;
      tag.visible = false;
    }
    soldier.gripRifle();
  };

  // Walk cycle: legs swing, slight bob, rifle stays gripped.
  soldier.update = function (dt, moving) {
    if (soldier.dead) return;
    if (moving) {
      soldier.walkPhase += dt * 7;
      const s = Math.sin(soldier.walkPhase);
      legR.hip.rotation.x = s * 0.5;
      legL.hip.rotation.x = -s * 0.5;
      legR.knee.rotation.x = Math.max(0, -s) * 0.7;
      legL.knee.rotation.x = Math.max(0, s) * 0.7;
      root.position.y = Math.abs(Math.cos(soldier.walkPhase)) * 0.02;
      soldier.gripRifle();
    }
  };

  soldier.setPose('idle');
  return soldier;
}
