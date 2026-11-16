// map.js — CINDERLINE YARD: a dusk rail yard, 3 lanes, 2 sites, one landmark.
// Containers are ISO-proportioned with real corrugation, serials, CSC plates and
// locking rods; the ground is wet cobble; every 10x10 m cell holds a prop, decal or light.
import * as THREE from 'three';
import { box, chamferBox, tube, corrugatedPanel, ball, blobShadow } from './geom.js';
import { containerSideTex, containerDoorTex, groundTex, groundRoughTex, groundBumpTex, crackDecalTex, oilDecalTex, tireDecalTex, gravelDecalTex, markingDecalTex, brickTex, woodTex, signTex, softDiscTex } from './textures.js';
import { mulberry32 } from './textures.js';

const CONTAINERS = [
  // serial, maxGross, tare, color, length, x, z, rotY, stacked
  ['CLDU 482 913-7', '30 480 KG', '3 720 KG', '#b4502e', 12.19, 0, -3.0, 0.0, false],
  ['TCLU 309 5552', '30 480 KG', '3 700 KG', '#4a6a52', 6.06, -9.5, -3.0, 0.0, false],
  ['MSKU 771 204-9', '30 480 KG', '3 800 KG', '#5a6a7a', 12.19, 10.5, -3.0, 0.0, true],
  ['CLDU 771 330-1', '30 480 KG', '3 720 KG', '#8a3a2a', 6.06, -15, 4.5, 0.35, false],
  ['TCLU 482 117-4', '30 480 KG', '3 700 KG', '#b4502e', 12.19, 2, -12.5, 0.0, false],
  ['MSKU 204 881-6', '30 480 KG', '3 800 KG', '#6a5a3a', 6.06, 16, 5.5, -0.4, false],
  ['CLDU 119 552-0', '30 480 KG', '3 720 KG', '#4a6a52', 6.06, -6, 10.5, 0.15, false],
];

function container(serial, maxGross, tare, base, len, seed) {
  const g = new THREE.Group();
  const W = 2.44, H = 2.59;
  const sideTex = containerSideTex({ serial, maxGross, tare, base, seed });
  const doorTex = containerDoorTex({ base, seed: seed + 1 });
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.62, metalness: 0.25 });
  const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.62, metalness: 0.25 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.5, roughness: 0.55 });
  // long sides: real corrugation (trapezoid loft)
  for (const z of [-W / 2, W / 2]) {
    const panel = corrugatedPanel(len, H, sideMat, { pitch: 0.28, amp: 0.035 });
    panel.position.set(0, H / 2, z);
    if (z < 0) panel.rotation.y = Math.PI;
    g.add(panel);
  }
  // door end (+X): flat panel + 4 locking rods with handles
  const door = box(0.06, H - 0.1, W - 0.1, doorMat);
  door.position.set(len / 2, H / 2, 0);
  g.add(door);
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.4 });
  for (const rz of [-0.85, -0.3, 0.3, 0.85]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, H - 0.25, 8), rodMat);
    rod.position.set(len / 2 + 0.05, H / 2, rz);
    g.add(rod);
    const handle = box(0.03, 0.16, 0.05, rodMat);
    handle.position.set(len / 2 + 0.07, H / 2 + 0.1, rz + 0.05);
    handle.rotation.z = 0.5;
    g.add(handle);
  }
  // closed end (-X)
  const end = box(0.06, H - 0.1, W - 0.1, sideMat);
  end.position.set(-len / 2, H / 2, 0);
  g.add(end);
  // roof
  const roof = box(len, 0.06, W, frameMat);
  roof.position.set(0, H, 0);
  g.add(roof);
  // corner posts + castings
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = box(0.12, H, 0.12, frameMat);
    post.position.set(sx * (len / 2 - 0.06), H / 2, sz * (W / 2 - 0.06));
    g.add(post);
    const cast = box(0.16, 0.16, 0.16, frameMat);
    cast.position.set(sx * (len / 2 - 0.06), H - 0.08, sz * (W / 2 - 0.06));
    g.add(cast);
  }
  return g;
}

export function buildMap(scene, rng) {
  const map = new THREE.Group();
  scene.add(map);
  const data = { containers: [], walls: [], puddles: [], sites: {} };

  // ---- ground: wet cobble ----
  // FIX 9 POIN P6: repeat 4x3 -> 8x6 (batu ~0.31 m, bukan ~1 m) + bumpMap
  // (relief batu dari groundBumpTex). Roughness map sudah disederhanakan
  // (variasi lembap skala besar saja; noda kecil pindah ke decal).
  const gTex = groundTex(7);
  gTex.repeat.set(8, 6);
  const gRough = groundRoughTex(7);
  gRough.repeat.set(8, 6);
  const gBump = groundBumpTex(7);
  gBump.repeat.set(8, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 50),
    new THREE.MeshStandardMaterial({ map: gTex, roughnessMap: gRough, bumpMap: gBump, bumpScale: 0.03, roughness: 1.0, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  map.add(ground);

  // ---- floor DECALS (P6): large-scale yard features as separate planes ----
  // Retakan / noda minyak / bekas ban / kerikil / marka jalan — ditaruh di
  // posisi dunia tertentu, BUKAN di-tile, supaya tidak berulang tiap 8,75 m.
  // polygonOffset + y bertingkat (0.015-0.03) cegah z-fighting antar decal.
  function addDecal(texFn, seed, x, z, w, d, rotY = 0, y = 0.015) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: texFn(seed), transparent: true, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rotY;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    map.add(m);
  }
  // tire marks along the main lane (combat camera looks down this lane)
  addDecal(tireDecalTex, 23, 0, 4, 8, 4, 0, 0.015);
  addDecal(tireDecalTex, 33, -6, -6, 7, 3.5, 0.6, 0.018);
  // oil stains: under the drums (left) + near the containers (right)
  addDecal(oilDecalTex, 22, -15, -6, 3, 3, 0, 0.02);
  addDecal(oilDecalTex, 32, 4, -8, 2.5, 2.5, 0, 0.022);
  addDecal(oilDecalTex, 42, 8, 6, 2, 2, 0, 0.024);
  // cracks: scattered across the yard (posisi dijauhi dari genangan supaya
  // decal tidak menimpa puddle: puddle di (-1,-6.5) dan (13,-1))
  addDecal(crackDecalTex, 21, -8, 6, 3, 3, 0, 0.026);
  addDecal(crackDecalTex, 31, 8, 4, 2.5, 2.5, 0.9, 0.028);
  addDecal(crackDecalTex, 41, -4, -9, 3, 3, 0.4, 0.03);
  addDecal(crackDecalTex, 51, 12, -4, 2, 2, 1.2, 0.032);
  // gravel patches: near the pallets / crates (dijauhi dari puddle (4,8.5))
  addDecal(gravelDecalTex, 24, 8, 9, 3.5, 3.5, 0, 0.034);
  addDecal(gravelDecalTex, 34, -12, 2, 3, 3, 0, 0.036);
  // faded lane markings: dashed centre line down the main lane
  addDecal(markingDecalTex, 25, 0, 8, 1.2, 2.4, 0, 0.038);
  addDecal(markingDecalTex, 35, 0, 2, 1.2, 2.4, 0, 0.04);
  addDecal(markingDecalTex, 45, 0, -4, 1.2, 2.4, 0, 0.042);

  // ---- puddles: flat discs that catch the sky (roughness 0.15) ----
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x8a7a68, roughness: 0.15, metalness: 0.1, envMapIntensity: 2.0, transparent: true, opacity: 0.75,
  });
  const puddleSpots = [[-4, 2.5, 1.6], [6, 1.5, 1.2], [-11, -6, 1.4], [9, -8, 1.8], [4, 8.5, 0.8], [-1, -6.5, 0.9], [13, -1, 1.3]];
  for (const [x, z, r] of puddleSpots) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 24), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.012, z);
    map.add(p);
    data.puddles.push([x, z, r]);
  }

  // ---- containers ----
  CONTAINERS.forEach((c, i) => {
    const [serial, mg, tare, base, len, x, z, rot, stacked] = c;
    const cont = container(serial, mg, tare, base, len, 10 + i * 7);
    cont.userData.len = len;
    cont.position.set(x, 0, z);
    cont.rotation.y = rot;
    map.add(cont);
    data.containers.push(cont);
    if (stacked) {
      const top = container('CLDU 482 913-7', mg, tare, '#8a5a44', 6.06, 40 + i * 7);
      top.position.set(x - 1, 2.59, z);
      top.rotation.y = rot;
      map.add(top);
      data.containers.push(top);
    }
  });

  // ---- perimeter + mid brick walls ----
  const brick = brickTex(11);
  brick.repeat.set(6, 2);
  const brickMat = new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9 });
  function wall(w, h, d, x, y, z, ry = 0) {
    const m = box(w, h, d, brickMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    map.add(m);
    data.walls.push(m);
    return m;
  }
  wall(70, 5, 0.6, 0, 2.5, -24);
  wall(70, 5, 0.6, 0, 2.5, 24);
  wall(0.6, 5, 48, -34, 2.5, 0);
  wall(0.6, 5, 48, 34, 2.5, 0);
  wall(18, 3.4, 0.5, -20, 1.7, -14); // mid wall, site A side
  wall(14, 3.4, 0.5, 18, 1.7, -16);

  // ---- signs ----
  function sign(main, sub, w, x, y, z, ry) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.375),
      new THREE.MeshStandardMaterial({ map: signTex(main, sub), roughness: 0.7 }),
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    map.add(m);
    return m;
  }
  sign('CINDERLINE', 'YARD 07', 6, 0, 4.6, -23.6, 0);
  sign('SITE A', 'KILN HALL', 3.2, -20, 3.2, -13.7, 0);
  sign('SITE B', 'GLAZE COURT', 3.2, 18, 3.2, -15.7, 0);

  // ---- water tower (landmark) ----
  const tower = new THREE.Group();
  tower.position.set(-19, 0, -16);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3230, metalness: 0.6, roughness: 0.5 });
  for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    tower.add(tube(new THREE.Vector3(lx, 0, lz), new THREE.Vector3(lx * 0.7, 6.5, lz * 0.7), 0.09, legMat));
  }
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x9a4a30, metalness: 0.3, roughness: 0.6 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 2.6, 20), tankMat);
  tank.position.y = 7.8;
  tower.add(tank);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.15, 1.1, 20), new THREE.MeshStandardMaterial({ color: 0x6a3a26, roughness: 0.7 }));
  cone.position.y = 9.65;
  tower.add(cone);
  const tsign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.28),
    new THREE.MeshStandardMaterial({ map: signTex('CINDERLINE', ''), roughness: 0.7 }),
  );
  tsign.position.set(0, 7.8, 2.05);
  tower.add(tsign);
  map.add(tower);
  data.landmark = tower;

  // ---- floodlight towers (glow sprites, NOT cones — cones read as white triangles) ----
  const glowTex = softDiscTex('rgba(255,230,170,0.95)', 'rgba(255,230,170,0)');
  function floodlight(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 10), legMat);
    pole.position.y = 3.5;
    g.add(pole);
    const head = box(0.7, 0.3, 0.25, new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.5 }));
    head.position.set(0, 7.1, 0);
    head.rotation.x = 0.5;
    g.add(head);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.85, depthWrite: false }));
    glow.scale.set(1.8, 1.8, 1);
    glow.position.set(0, 7.1, 0.3);
    g.add(glow);
    const light = new THREE.PointLight(0xffd9a0, 14, 22, 1.8);
    light.position.set(0, 6.8, 0.4);
    g.add(light);
    map.add(g);
    return g;
  }
  floodlight(-10, 6);
  floodlight(12, 4);

  // ---- sagging cables between the towers ----
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.9 });
  function cable(a, b, sag) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      pts.push(p);
    }
    for (let i = 0; i < pts.length - 1; i++) map.add(tube(pts[i], pts[i + 1], 0.02, cableMat, 6));
  }
  cable(new THREE.Vector3(-10, 7, 6), new THREE.Vector3(12, 7, 4), 1.1);
  cable(new THREE.Vector3(-10, 7, 6), new THREE.Vector3(-19, 8.5, -16), 1.6);

  // ---- props: crates, pallets, drums, barricades, sandbags ----
  const wood = woodTex(13);
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 });
  function crate(x, z, s, ry = 0) {
    const m = chamferBox(s, s, s, 0.02, woodMat);
    m.position.set(x, s / 2, z);
    m.rotation.y = ry;
    map.add(m);
    return m;
  }
  crate(-6.5, 0.5, 0.9, 0.3); crate(-6.5, 0.5, 0.9, 0.3).position.y = 1.35;
  crate(-5.6, 0.2, 0.7, 0.9);
  crate(7.5, -6.5, 1.0, 0.2); crate(8.5, -6.8, 0.7, 0.5);
  crate(-13, -9, 0.9, 0.1);
  crate(14, 8, 0.8, 0.7);
  // foreground framing (combat camera sits at z=12): crates left, drums right
  crate(-3.5, 9.5, 0.9, 0.4); crate(-3.5, 9.5, 0.7, 0.9).position.y = 1.25;
  function pallet(x, z, ry = 0) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const slat = box(1.2, 0.04, 0.14, woodMat);
      slat.position.set(0, 0.14, -0.5 + i * 0.25);
      g.add(slat);
    }
    for (const bx of [-0.5, 0, 0.5]) {
      const block = box(0.12, 0.12, 1.1, woodMat);
      block.position.set(bx, 0.06, 0);
      g.add(block);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    map.add(g);
    return g;
  }
  pallet(3, 6.5, 0.4); pallet(-3, -7, 1.1); pallet(11, 0.5, 0.2);
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x5a6a72, metalness: 0.5, roughness: 0.55 });
  const drumMat2 = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, metalness: 0.4, roughness: 0.6 });
  function drum(x, z, mat) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 16), mat);
    d.position.set(x, 0.45, z);
    map.add(d);
    return d;
  }
  drum(-12.5, 1.5, drumMat); drum(-11.8, 2.1, drumMat2); drum(5, -9.5, drumMat);
  drum(4.5, 10, drumMat); drum(5.2, 10.4, drumMat2);
  // barricades: wooden A-frames
  function barricade(x, z, ry) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const leg = box(0.08, 1.1, 0.08, woodMat);
      leg.position.set(s * 0.5, 0.55, 0);
      leg.rotation.z = s * 0.35;
      g.add(leg);
    }
    const plank = box(1.4, 0.18, 0.06, woodMat);
    plank.position.set(0, 0.95, 0);
    g.add(plank);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    map.add(g);
  }
  barricade(-2, -5.5, 0.3); barricade(4, 2.5, -0.5);
  // sandbags near site A
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const s = chamferBox(0.55, 0.22, 0.35, 0.06, sandMat);
    s.position.set(-16 + (i % 3) * 0.6, 0.11 + Math.floor(i / 3) * 0.22, -6.5 + (i % 2) * 0.4);
    s.rotation.y = (i * 0.4) % 0.8;
    map.add(s);
  }
  // barbed wire helix on the mid wall
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4 });
  const helixPts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    helixPts.push(new THREE.Vector3(-28 + t * 16, 3.6 + Math.sin(t * Math.PI * 10) * 0.18, -14 + Math.cos(t * Math.PI * 10) * 0.18));
  }
  for (let i = 0; i < helixPts.length - 1; i++) map.add(tube(helixPts[i], helixPts[i + 1], 0.012, wireMat, 5));

  // ---- LEFT SIDE DETAIL (P7): the left mid-ground was bare cobble ----
  // The right side has stacked containers + pallet + drum in the mid-ground;
  // the left had only a lamp post + a container + empty cobble. Add: pipe
  // rack, rusted drum cluster, pallets, cable spool + ground cable, a
  // directed SPOTLIGHT, and barbed wire on the left perimeter wall.
  // Positions avoid: site A (-18..-10, -12..-4), mid wall (z -14),
  // water tower (-19,-16), left containers, existing drums (-12.5,1.5).
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x7a3a22, metalness: 0.3, roughness: 0.8 });
  const rustDrumMat = new THREE.MeshStandardMaterial({ color: 0x6a3a28, metalness: 0.4, roughness: 0.75 });
  // pipe rack: 4 rusted pipes stacked 2x2 on A-frame supports, along z
  function pipeRack(x, z, ry = 0) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      for (const sz of [-1.6, 1.6]) {
        const leg = box(0.1, 0.9, 0.1, legMat);
        leg.position.set(s * 0.5, 0.45, sz);
        leg.rotation.x = -s * 0.3;
        g.add(leg);
      }
    }
    for (const [px, py] of [[-0.14, 0.85], [0.14, 0.85], [-0.14, 1.1], [0.14, 1.1]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 12), rustMat);
      p.rotation.x = Math.PI / 2;
      p.position.set(px, py, 0);
      g.add(p);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    map.add(g);
    return g;
  }
  pipeRack(-9, 4, 0); // R2: was (-22,0) — tersembunyi di balik kontainer gelap dari kamera side-left; kini di tengah lane kiri, terlihat
  // rusted drum cluster (3) near the pipe rack
  drum(-14, 6, rustDrumMat); drum(-13.2, 6.6, rustDrumMat); drum(-13.6, 5.2, drumMat2); // R2: was (-20,5) — sama, tersembunyi; kini di samping lampu kiri
  // pallets: the left mid-ground had none (right has one at (11,0.5))
  pallet(-13, 9, 0.3); pallet(-12, 10.5, 0.9);
  // cable spool + ground cable run to the left wall
  const spool = new THREE.Group();
  const spoolCore = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 14), woodMat);
  spoolCore.rotation.z = Math.PI / 2;
  spoolCore.position.y = 0.7;
  spool.add(spoolCore);
  for (const sx of [-0.4, 0.4]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 14), woodMat);
    disc.rotation.z = Math.PI / 2;
    disc.position.set(sx, 0.7, 0);
    spool.add(disc);
  }
  spool.position.set(-16, 0, 10);
  spool.rotation.y = 0.5;
  map.add(spool);
  // ground cable: sagging tube from the spool to the pipe rack (visible
  // across the open left floor). R2: was ke dinding kiri (-33,6) — di luar
  // frame + terlalu tipis/gelap; kini radius 0.05, rute pendek yang terlihat.
  const cablePts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const p = new THREE.Vector3().lerpVectors(new THREE.Vector3(-16, 0.05, 10), new THREE.Vector3(-9, 0.05, 4), t);
    p.y += Math.sin(t * Math.PI) * 0.06;
    cablePts.push(p);
  }
  for (let i = 0; i < cablePts.length - 1; i++) map.add(tube(cablePts[i], cablePts[i + 1], 0.05, cableMat, 6));
  // directed SPOTLIGHT on a pole (left side was lit only by a general lamp)
  const spot = new THREE.Group();
  spot.position.set(-18, 0, 12);
  const spotPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 10), legMat);
  spotPole.position.y = 3.5;
  spot.add(spotPole);
  const spotHead = box(0.7, 0.3, 0.25, new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.5 }));
  spotHead.position.set(0, 7.1, 0);
  spotHead.rotation.x = 0.9; // aimed down into the yard
  spot.add(spotHead);
  const spotGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.85, depthWrite: false }));
  spotGlow.scale.set(1.8, 1.8, 1);
  spotGlow.position.set(0, 7.1, 0.3);
  spot.add(spotGlow);
  const spotLight = new THREE.SpotLight(0xffd9a0, 150, 30, 0.55, 0.5, 1.5); // 150: jarak target ~23 m, decay 1.5 -> pool terang di lantai
  spotLight.position.set(0, 7, 0);
  spotLight.target.position.set(18, 0, -12); // aimed at the yard centre
  spot.add(spotLight);
  spot.add(spotLight.target);
  map.add(spot);
  // barbed wire helix on the DARK LEFT CONTAINER roof (CLDU 771 330-1 at
  // (-15,4.5), rot 0.35 — foreground-left di kamera side-left, jadi wire
  // terlihat). R2: was di dinding perimeter kiri (x -34) — di luar frame.
  const wirePts2 = [];
  const cax = Math.cos(0.35), caz = -Math.sin(0.35); // container long axis
  const cpx = Math.sin(0.35), cpz = Math.cos(0.35); // perpendicular axis
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const along = (t - 0.5) * 5.5;
    wirePts2.push(new THREE.Vector3(
      -15 + along * cax + Math.cos(t * Math.PI * 10) * 0.15 * cpx,
      2.75 + Math.sin(t * Math.PI * 10) * 0.15,
      4.5 + along * caz + Math.cos(t * Math.PI * 10) * 0.15 * cpz));
  }
  for (let i = 0; i < wirePts2.length - 1; i++) map.add(tube(wirePts2[i], wirePts2[i + 1], 0.02, wireMat, 5)); // R3: radius 0.012 -> 0.02 (di R2 terlalu tipis, tidak kebaca)

  // ---- site floors ----
  // Site A: green tiles (Kilnyard shot 2) + charge device
  const siteA = new THREE.Group();
  siteA.position.set(-14, 0, -8);
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileCanvas.height = 256;
  const tg = tileCanvas.getContext('2d');
  tg.fillStyle = '#1d4a38'; tg.fillRect(0, 0, 256, 256);
  tg.strokeStyle = '#2a6a50'; tg.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    tg.beginPath(); tg.moveTo(i * 32, 0); tg.lineTo(i * 32, 256); tg.stroke();
    tg.beginPath(); tg.moveTo(0, i * 32); tg.lineTo(256, i * 32); tg.stroke();
  }
  tg.strokeStyle = '#d8b83a'; tg.lineWidth = 6; tg.strokeRect(4, 4, 248, 248);
  const tileTex = new THREE.CanvasTexture(tileCanvas);
  tileTex.colorSpace = THREE.SRGBColorSpace;
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(2, 2);
  const floorA = new THREE.Mesh(new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.55, metalness: 0.05 }));
  floorA.rotation.x = -Math.PI / 2;
  floorA.position.y = 0.02;
  siteA.add(floorA);
  const charge = new THREE.Group();
  const chargeBody = chamferBox(0.7, 0.35, 0.5, 0.05, new THREE.MeshStandardMaterial({ color: 0x4a5a3a, metalness: 0.4, roughness: 0.5 }));
  chargeBody.position.y = 0.2;
  charge.add(chargeBody);
  const chargeLight = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0xff5030 }));
  chargeLight.rotation.x = -Math.PI / 2;
  chargeLight.position.set(0, 0.39, 0);
  charge.add(chargeLight);
  charge.position.set(1.5, 0, 1);
  siteA.add(charge);
  map.add(siteA);
  data.sites.A = siteA;
  // Site B: marked zone (painted rectangle + posts)
  const siteB = new THREE.Group();
  siteB.position.set(14, 0, -8);
  const zone = new THREE.Mesh(new THREE.PlaneGeometry(7, 7),
    new THREE.MeshStandardMaterial({ color: 0x8a2a20, transparent: true, opacity: 0.35, roughness: 0.8 }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.y = 0.02;
  siteB.add(zone);
  // charge device at Site B too (the duel shot arms the charge here)
  const chargeB = new THREE.Group();
  const chargeBBody = chamferBox(0.7, 0.35, 0.5, 0.05, new THREE.MeshStandardMaterial({ color: 0x4a5a3a, metalness: 0.4, roughness: 0.5 }));
  chargeBBody.position.y = 0.2;
  chargeB.add(chargeBBody);
  const chargeBLight = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0xff5030 }));
  chargeBLight.rotation.x = -Math.PI / 2;
  chargeBLight.position.set(0, 0.39, 0);
  chargeB.add(chargeBLight);
  chargeB.position.set(-0.5, 0, 1.5);
  chargeB.scale.setScalar(1.4);
  siteB.add(chargeB);
  map.add(siteB);
  data.sites.B = siteB;

  return { group: map, data };
}
