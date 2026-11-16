// main.js — boot: renderer, AgX + post chain, procedural dusk sky, lights,
// second viewmodel camera, input, loop, window.__game API.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Game } from './game.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { buildRifle, buildHand } from './weapon.js';

// ---- grade pass: saturation + warm shadow lift (my own shader) ----
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, saturation: { value: 1.18 }, lift: { value: 0.02 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float saturation; uniform float lift; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 sat = mix(vec3(l), c.rgb, saturation);
      vec3 col = sat + vec3(0.02, 0.008, -0.012) * (1.0 - l) * lift * 50.0;
      gl_FragColor = vec4(col, c.a);
    }`,
};

// ---- procedural dusk sky: gradient dome + sun disc ----
function makeSky() {
  const geo = new THREE.SphereGeometry(300, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a1e3a) },
      mid: { value: new THREE.Color(0x8a4a3a) },
      horizon: { value: new THREE.Color(0xe07848) },
      sunDir: { value: new THREE.Vector3(-0.9, 0.14, -0.35).normalize() },
    },
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = h < 0.18 ? mix(horizon, mid, smoothstep(0.0, 0.18, h)) : mix(mid, top, smoothstep(0.18, 0.65, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.55, 0.25) * pow(s, 90.0) * 0.4;   // sun disc
        col += vec3(1.0, 0.45, 0.18) * pow(s, 6.0) * 0.03;   // haze around the sun
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

const params = new URLSearchParams(location.search);
const stageName = params.get('stage') || null;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb0705a, 26, 65); // fog colour = horizon colour
const sky = makeSky();
scene.add(sky);

// IBL from our own sky (PMREM) — no external HDRI
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  skyScene.add(makeSky());
  scene.environment = pmrem.fromScene(skyScene, 0.04).texture;
  pmrem.dispose();
}

// ---- lights: low warm sun + hemisphere fill + cool rim (proven position) ----
const sun = new THREE.DirectionalLight(0xffb070, 3.0);
sun.position.set(-36, 5.6, -14);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8a6a9a, 0x4a3628, 0.7));
// camera fill: warm light from behind the player so faces/fronts that turn
// away from the low sun stay readable instead of going black
const fill = new THREE.DirectionalLight(0xffd0a0, 0.45);
fill.position.set(0, 5, 25);
scene.add(fill);
const rim = new THREE.DirectionalLight(0x8a9ac0, 0.4);
rim.position.set(-14, 8, 2);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

// ---- second camera: the viewmodel (FOV 54, its own scene) ----
const vmScene = new THREE.Scene();
vmScene.environment = scene.environment; // metals need an env map or they go black
const vmCamera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.01, 3);
vmScene.add(new THREE.AmbientLight(0xffffff, 0.7));
const vmLight = new THREE.DirectionalLight(0xffe0b0, 1.5);
vmLight.position.set(0.4, 0.8, 0.6);
vmScene.add(vmLight);
const vmFill = new THREE.DirectionalLight(0xfff0d0, 0.7);
vmFill.position.set(-0.5, 0.2, -0.8);
vmScene.add(vmFill);
const vmRifle = buildRifle();
// FIX ROUND (16 Nov): VM was ~35% of frame width. Moved farther (z -1.0->-1.3),
// right (x 0.36->0.44) and down (y -0.33->-0.38) so the visible rifle is
// <=25% wide with the stock cropped by the bottom edge, like Kilnyard-0.
vmRifle.group.position.set(0.44, -0.38, -1.3);
vmRifle.group.rotation.set(0.12, -0.03, 0.02);
vmScene.add(vmRifle.group);
// viewmodel hands on the sockets (children of the rifle, so they move with it)
// FIX HAND (16 Nov): the trigger hand DANGLLED below the pistol grip and the
// support hand floated behind the foregrip. Probe-verified (node probe, rifle
// space): old trigger fingertips 0.039-0.051 m from the grip, BELOW its bottom
// edge; old support fingertips 0.061-0.081 m behind the foregrip. A pistol grip
// is a vertical bar, so the finger-curl plane must be HORIZONTAL (perp. to the
// grip axis) with the knuckle line ALONG the grip axis: R = Rx(grip tilt) *
// Rz(+90deg). The hand origin is offset so the grip sits inside the finger
// hook. After the fix (same probe): trigger fingertips 0.000-0.007 m from the
// grip surface, support fingertips 0.001-0.021 m from the foregrip, palms in
// contact with the grip's back-left corner. Do NOT move the rifle itself.
const vmHandR = buildHand(0x4a4438);
vmHandR.group.position.copy(vmRifle.gripSocket.position).add(new THREE.Vector3(-0.038, 0.034, -0.064));
vmHandR.group.rotation.set(0.35, 0, Math.PI / 2);
vmRifle.group.add(vmHandR.group);
const vmHandL = buildHand(0x4a4438);
// FIX HANDGUARD (16 Nov, referensi CS user 13:36 WIB): tangan support HARUS
// menggenggam HANDGUARD seperti referensi — jari melengkung KE ATAS melewati
// rel atas, jempol di sisi samping. Bukan di foregrip vertikal (pose lama:
// jari melayang 0.06-0.08 m di belakang foregrip). Handguard itu bar horizontal,
// jadi bidang curl jari harus vertikal melintang sumbu laras: R = Rx(-90deg) *
// Rz(-90deg) -> jari menunjuk ke ATAS, melengkung ke sisi kiri melewati rel.
// Probe-verified: ujung jari 0.012-0.018 m DI ATAS rel atas (kelihatan di atas
// rel, seperti referensi), telapak menempel di sisi kanan handguard (d=0.019 m).
// Posisi langsung di handguard (bukan supportSocket foregrip); foregrip tetap
// ada sebagai prop, kosong.
vmHandL.group.position.set(0.05, -0.02, 0.27);
vmHandL.group.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
vmRifle.group.add(vmHandL.group);
// viewmodel muzzle, for the flash
const vmMuzzle = new THREE.Object3D();
vmMuzzle.position.copy(vmRifle.muzzle.position);
vmRifle.group.add(vmMuzzle);

// ---- post chain (proven order): Render -> Bloom -> Grade -> Output -> SMAA ----
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.55, 0.88);
composer.addPass(bloom);
composer.addPass(new ShaderPass(GradeShader));
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(innerWidth, innerHeight));

const hud = new HUD();
const audio = new AudioSys();
const game = new Game(scene, camera, vmScene, vmCamera, hud, audio);
game._vmMuzzle = vmMuzzle;

// ---- input ----
const keys = {};
let locked = false;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  audio.resume();
  if (e.code === 'Enter') {
    if (game.state === 'menu') game.startMatch();
    else if (game.state === 'score') game.nextRound();
    else if (game.state === 'matchEnd') game.restart();
    else if (game.state === 'buy') game.beginLive();
  }
  if (e.code === 'KeyB' && game.state === 'buy') game.beginLive();
  if (e.code === 'KeyR' && game.state === 'live') { game.player.mag = 24; audio.reload(); }
  if (e.code === 'Digit1' && game.state === 'buy') buyItem(0);
  if (e.code === 'Digit2' && game.state === 'buy') buyItem(1);
  if (e.code === 'Digit3' && game.state === 'buy') buyItem(2);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousemove', (e) => {
  if (!locked || game.state !== 'live') return;
  game.player.yaw -= e.movementX * 0.0021;
  game.player.pitch = THREE.MathUtils.clamp(game.player.pitch - e.movementY * 0.0021, -1.2, 1.2);
});
renderer.domElement.addEventListener('click', () => {
  audio.resume();
  if (game.state === 'menu') { game.startMatch(); return; }
  if (game.state === 'live' && !locked) renderer.domElement.requestPointerLock();
  else if (game.state === 'live') game.playerShoot();
  else if (game.state === 'score') game.nextRound();
  else if (game.state === 'matchEnd') game.restart();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
});
function buyItem(col) {
  // buy the first unowned item of the column (demo economy)
  const items = [
    [{ name: 'Wren P9', price: 200 }, { name: 'Hornet SMG', price: 1200 }, { name: 'Longshot AR', price: 2700 }],
  ][0];
  const it = items[col];
  if (!it || game.player.cash < it.price) return;
  game.player.cash -= it.price;
  audio.buy();
  hud.setVitals(game.player.hp, game.player.armor, game.player.cash);
}

// ---- loop ----
const clock = new THREE.Clock();
let stepT = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const p = game.player;
  if (game.state === 'live' && !game.frozen) {
    const sp = 4.5 * dt;
    let mx = 0, mz = 0;
    if (keys.KeyW) { mx -= Math.sin(p.yaw); mz -= Math.cos(p.yaw); }
    if (keys.KeyS) { mx += Math.sin(p.yaw); mz += Math.cos(p.yaw); }
    if (keys.KeyA) { mx -= Math.cos(p.yaw); mz += Math.sin(p.yaw); }
    if (keys.KeyD) { mx += Math.cos(p.yaw); mz -= Math.sin(p.yaw); }
    if (mx || mz) {
      const l = Math.hypot(mx, mz);
      p.x += (mx / l) * sp;
      p.z += (mz / l) * sp;
      game.collide();
      stepT += dt;
      if (stepT > 0.42) { stepT = 0; audio.step(); }
    }
  }
  game.update(dt);
  composer.render();
  // viewmodel on top (own camera, depth cleared so it always reads)
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(vmScene, vmCamera);
  renderer.autoClear = true;
  window.__ready = true;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  vmCamera.aspect = camera.aspect;
  vmCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ---- __game API (harness contract) ----
window.__game = {
  game,
  aimAtNearest: () => game.aimAtNearest(),
  playerShoot: () => game.playerShoot(),
  reseedFeed: (s) => game.reseed(s),
  get frames() { return game.frames; },
  get state() { return game.state; },
  player: game.player,
  bots: game.bots,
  stage: (n) => game.stage(n),
  start: () => game.startMatch(),
  buy: (i) => buyItem(i),
  endRound: (w) => game.endRound(w),
  nextRound: () => game.nextRound(),
  endMatch: (w) => game.endMatch(w),
  restart: () => game.restart(),
};

if (stageName) game.stage(stageName);
else hud.showMenu(true);
loop();
