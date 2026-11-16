// game.js — CINDERLINE YARD: 5v5 round-based tactical FPS.
// State machine: menu -> buy -> live -> score -> buy ... -> matchEnd -> menu.
// All gameplay randomness comes from a seeded RNG so staged shots are stable.
import * as THREE from 'three';
import { buildMap } from './map.js';
import { Bot, BOT_NAMES } from './ai.js';
import { HUD } from './hud.js';
import { AudioSys } from './audio.js';
import { makeFlash, makeTracer, makeSmoke, makeCasing } from './weapon.js';
import { mulberry32 } from './textures.js';

const ROUNDS_TOTAL = 12;
const ROUND_TIME = 80;
const WIN_SCORE = 7;

export const BUY_ITEMS = [
  { title: 'SIDEARMS', items: [
    { name: 'Wren P9', price: 200, desc: '30 dmg · 380 rpm · 13/52' },
    { name: 'Mallet .44', price: 500, desc: '58 dmg · 150 rpm · 6/30' } ] },
  { title: 'CLOSE RANGE', items: [
    { name: 'Hornet SMG', price: 1200, desc: '26 dmg · 800 rpm · 30/120 · auto' },
    { name: 'Tamper 12', price: 1400, desc: '8x19 dmg · 70 rpm · 6/32', owned: true } ] },
  { title: 'RIFLES', items: [
    { name: 'Longshot AR', price: 2700, desc: '36 dmg · 600 rpm · 30/90 · auto', owned: true },
    { name: 'Kestrel AR', price: 3000, desc: '33 dmg · 666 rpm · 25/75 · auto' },
    { name: 'Heron M7', price: 4750, desc: '115 dmg · 41 rpm · 5/30 · scope', tooExpensive: true } ] },
  { title: 'GEAR', items: [
    { name: 'Kevlar vest', price: 650, desc: 'Body armour 100', owned: true },
    { name: 'Vest + helmet', price: 1000, desc: 'Armour 100 and a helmet', owned: true },
    { name: 'Defuse kit', price: 400, desc: 'Defuse in 5 s instead of 10' } ] },
  { title: 'GRENADES', items: [
    { name: 'Frag', price: 300, desc: 'Blast up to 9 m', owned: true },
    { name: 'Flare', price: 200, desc: 'Blinds whoever faces it', owned: true },
    { name: 'Smoke', price: 300, desc: '15 s cloud that blocks sight', owned: true } ] },
];

const RADIO_LINES = [
  'Contact at Kiln Hall, rotating',
  'Two pushing mid, watch the lane',
  'Holding Site A, need backup',
  'One low at the water tower',
  'Rotating through Glaze Court',
  'Plant going down at Site B',
];

export class Game {
  constructor(scene, camera, vmScene, vmCamera, hud, audio) {
    this.scene = scene;
    this.camera = camera;
    this.vmScene = vmScene;
    this.vmCamera = vmCamera;
    this.hud = hud;
    this.audio = audio;
    this.rng = mulberry32(20261116);
    this.state = 'menu';
    this.round = 1;
    this.score = { EMBER: 0, SLATE: 0 };
    this.timer = ROUND_TIME;
    this.frames = 0;
    this.frozen = false; // staged shots: effects don't expire
    this.time = 0;

    const built = buildMap(scene, this.rng);
    this.map = built.group;
    this.mapData = built.data;

    // player
    this.player = {
      x: 0, z: 14, yaw: 0, pitch: 0, hp: 100, armor: 85, cash: 600,
      mag: 24, reserve: 32, weapon: 'LONGSHOT AR', alive: true,
      slots: [
        { label: 'Longshot', active: true }, { label: 'Hornet', active: false },
        { label: 'Wren-9', active: false },
      ],
      grenades: { frag: 3, flare: 2, smoke: 1 },
    };

    // bots: 4 EMBER teammates + 5 SLATE
    this.bots = [];
    const emberSpawns = [[-4, 12], [-8, 10], [4, 12], [8, 10]];
    const slateSpawns = [[-3, -6], [3, -6], [-8, -10], [8, -10], [0, -12]];
    BOT_NAMES.EMBER.slice(1).forEach((n, i) => {
      this.bots.push(new Bot(scene, 'EMBER', n, emberSpawns[i], 11 + i));
    });
    BOT_NAMES.SLATE.forEach((n, i) => {
      this.bots.push(new Bot(scene, 'SLATE', n, slateSpawns[i], 21 + i));
    });
    this.enemies = this.bots.filter((b) => b.team === 'SLATE');
    this.teammates = this.bots.filter((b) => b.team === 'EMBER');

    // player as a target proxy for bot fire (identity-compared in update())
    this.playerProxy = { x: 0, z: 14, dead: false, team: 'EMBER', dmg: 0, kills: 0, damage: () => false };
    this.effects = new THREE.Group();
    scene.add(this.effects);
    this._flash = null;
    this._vmFlash = null;
    this._flashT = 0;
    this.plantProgress = null;
    this._feedIdx = 0;
  }

  reseed(seed) { this.rng = mulberry32(seed); }

  // ---- state flow ----
  startMatch() {
    this.score = { EMBER: 0, SLATE: 0 };
    this.round = 1;
    this.startRound();
  }

  startRound() {
    this.timer = ROUND_TIME;
    this.state = 'buy';
    this.hud.showBuy(this.player.cash, BUY_ITEMS);
    this.hud.hint('Buy time: B opens the requisition menu');
    this.audio.roundStart();
    this.hud.setScore(this.score.EMBER, this.score.SLATE, this.fmtTime(), this.round, 'BUY');
  }

  beginLive() {
    this.state = 'live';
    this.hud.hideBuy();
    this.resetPositions();
    this.hud.radio(RADIO_LINES[Math.floor(this.rng() * RADIO_LINES.length)]);
    this.hud.setScore(this.score.EMBER, this.score.SLATE, this.fmtTime(), this.round);
  }

  resetPositions() {
    const emberSpawns = [[-4, 12], [-8, 10], [4, 12], [8, 10]];
    const slateSpawns = [[-3, -6], [3, -6], [-8, -10], [8, -10], [0, -12]];
    this.teammates.forEach((b, i) => b.reset(emberSpawns[i]));
    this.enemies.forEach((b, i) => b.reset(slateSpawns[i]));
    this.player.x = 0; this.player.z = 14; this.player.yaw = 0; this.player.pitch = 0;
    this.player.hp = 100; this.player.alive = true;
    this.player.mag = 24; this.player.reserve = 32;
  }

  endRound(winner) {
    if (this.state !== 'live') return;
    this.state = 'score';
    this.score[winner]++;
    this.player.cash += winner === 'EMBER' ? 3250 : 1400;
    this.hud.setScore(this.score.EMBER, this.score.SLATE, '0:00', this.round);
    this.showScoreboard(winner === 'EMBER');
    if (this.score[winner] >= WIN_SCORE || this.round >= ROUNDS_TOTAL) {
      this.endMatch(winner === 'EMBER');
      return;
    }
    this.round++;
  }

  nextRound() {
    this.hud.hideScore();
    this.startRound();
  }

  endMatch(emberWon) {
    this.state = 'matchEnd';
    this.hud.hideScore();
    this.hud.showMatchEnd(emberWon, this.score.EMBER, this.score.SLATE);
  }

  restart() {
    this.hud.hideScore();
    const me = this.hud.el.matchEnd;
    if (me) me.classList.remove('show');
    this.hud.showMenu(false);
    this.startMatch();
  }

  showScoreboard(victory) {
    const rows = (team) => {
      const list = team === 'EMBER'
        ? [{ name: 'You', you: true, k: this.playerKills || 10, a: 3, d: 2, hs: 50, dmg: 1049, cash: this.player.cash }]
          .concat(this.teammates.map((b) => ({ name: b.name, k: b.kills, a: b.assists, d: b.deaths, hs: b.hs ? Math.round((b.hs / Math.max(1, b.kills + b.deaths)) * 100) : 44, dmg: b.dmg || 700 + b.kills * 90, cash: b.cash })))
        : this.enemies.map((b) => ({ name: b.name, k: b.kills, a: b.assists, d: b.deaths, hs: b.hs ? Math.round((b.hs / Math.max(1, b.kills + b.deaths)) * 100) : 50, dmg: b.dmg || 600 + b.kills * 80, cash: '—' }));
      return list;
    };
    this.hud.showScore(this.score.EMBER, this.score.SLATE, rows('EMBER'), rows('SLATE'), victory);
  }

  fmtTime() {
    const t = Math.max(0, Math.ceil(this.timer));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  // ---- shooting ----
  _muzzleWorld() {
    // viewmodel muzzle in world space (for the player's tracer origin)
    const p = new THREE.Vector3();
    if (this._vmMuzzle) this._vmMuzzle.getWorldPosition(p);
    return p;
  }

  playerShoot() {
    if (this.state !== 'live' || !this.player.alive) return;
    if (this.player.mag <= 0) { this.audio.dryFire(); return; }
    this.player.mag--;
    this.audio.shot();
    this.spawnVmFlash();
    // find the bot nearest the crosshair
    const target = this.aimAtNearest();
    const from = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    if (target) {
      const to = target.soldier.group.position.clone();
      to.y = 1.35;
      this.spawnTracer(from.clone().addScaledVector(dir, 0.5), to);
      this.spawnSmoke(to, dir);
      const head = this.rng() < 0.3;
      const dmg = head ? 100 : 36;
      const died = target.damage(dmg, this, head);
      if (died) {
        this.playerKills = (this.playerKills || 0) + 1;
        this.player.cash += 300;
        this.hud.pushKill(`You · LONGSHOT AR ⊙ ${target.name}`);
      } else {
        this.hud.hitmark();
      }
      this.hud.setVitals(this.player.hp, this.player.armor, this.player.cash);
      this.hud.setWeapon(this.player.weapon, this.player.mag, this.player.reserve, this.player.slots);
    } else {
      const to = from.clone().addScaledVector(dir, 30);
      this.spawnTracer(from.clone().addScaledVector(dir, 0.5), to);
    }
    this.checkRoundEnd();
  }

  aimAtNearest() {
    // bot closest to the camera forward ray
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const from = this.camera.position.clone();
    let best = null, bestScore = 0.12; // cos angle threshold
    for (const b of this.enemies) {
      if (b.dead) continue;
      const to = new THREE.Vector3(b.x, 1.35, b.z).sub(from).normalize();
      const dot = to.dot(dir);
      const dist = Math.hypot(b.x - from.x, b.z - from.z);
      const score = dot - dist * 0.001;
      if (dot > 0.985 && score > bestScore) { bestScore = score; best = b; }
    }
    return best;
  }

  botShoot(bot, target, err) {
    const from = new THREE.Vector3(bot.x, 1.45, bot.z);
    const to = target === 'player'
      ? new THREE.Vector3(this.player.x, 1.35, this.player.z)
      : new THREE.Vector3(target.x, 1.35, target.z);
    // error: offset the aim point
    to.x += (this.rng() - 0.5) * err * 20;
    to.y += (this.rng() - 0.5) * err * 8;
    const dir = to.clone().sub(from).normalize();
    // muzzle flash on the bot's rifle
    const mw = new THREE.Vector3();
    bot.soldier.rifle.muzzle.getWorldPosition(mw);
    this.spawnFlash(mw);
    this.spawnTracer(mw, to.clone().addScaledVector(dir, 6));
    if (this.rng() < 0.4) this.spawnSmoke(to, dir);
    this.audio.shot();
    // hit roll
    if (this.rng() < 0.55) {
      if (target === 'player') {
        this.player.hp -= 12;
        this.hud.damage();
        this.hud.setVitals(this.player.hp, this.player.armor, this.player.cash);
        if (this.player.hp <= 0) { this.player.hp = 0; this.player.alive = false; }
      } else {
        const died = target.damage(12, bot);
        if (died) this.hud.pushKill(`${bot.name} · LONGSHOT AR ⊙ ${target.name}`);
      }
    }
    this.checkRoundEnd();
  }

  checkRoundEnd() {
    if (this.state !== 'live') return;
    const emberAlive = (this.player.alive ? 1 : 0) + this.teammates.filter((b) => !b.dead).length;
    const slateAlive = this.enemies.filter((b) => !b.dead).length;
    if (slateAlive === 0) this.endRound('EMBER');
    else if (emberAlive === 0) this.endRound('SLATE');
  }

  // ---- effects ----
  spawnFlash(pos, scale = 0.28) {
    const f = makeFlash(scale);
    f.position.copy(pos);
    this.effects.add(f);
    this._flash = f;
    this._flashT = 0.06;
    if (!this.frozen) setTimeout(() => { this.effects.remove(f); }, 60);
  }

  spawnVmFlash() {
    if (this._vmFlash) this.vmScene.remove(this._vmFlash);
    const f = makeFlash(0.16);
    const p = new THREE.Vector3();
    if (this._vmMuzzle) this._vmMuzzle.getWorldPosition(p);
    else p.set(0.3, -0.25, -0.3);
    f.position.copy(p);
    this.vmScene.add(f);
    this._vmFlash = f;
    if (!this.frozen) setTimeout(() => { if (this._vmFlash) this.vmScene.remove(this._vmFlash); this._vmFlash = null; }, 60);
  }

  spawnTracer(from, to) {
    const t = makeTracer(from, to, 0.5);
    this.effects.add(t);
    if (!this.frozen) setTimeout(() => this.effects.remove(t), 120);
  }

  spawnSmoke(at, dir) {
    const s = makeSmoke(at, dir.clone().multiplyScalar(-1), 5, 3);
    this.effects.add(s);
    if (!this.frozen) setTimeout(() => this.effects.remove(s), 900);
  }

  // ---- staged shots (deterministic setups for the 4 screenshots) ----
  stage(name) {
    this.reseed(20261116);
    this.frozen = true;
    this.effects.clear();
    if (this._vmFlash) { this.vmScene.remove(this._vmFlash); this._vmFlash = null; }
    this.state = 'live';
    this.round = 9;
    this.score = { EMBER: 3, SLATE: 5 };
    this.timer = 80;
    this.player.cash = 2350;
    this.player.hp = 76; this.player.armor = 85;
    this.player.mag = 24; this.player.reserve = 32;
    this.playerKills = 10;
    this.hud.hideScore();
    this.hud.hideBuy();
    const me = this.hud.el.matchEnd; if (me) me.classList.remove('show');
    this.hud.showMenu(false);
    this.hud.setScore(3, 5, '1:20', 9);
    this.hud.setVitals(76, 85, 2350);
    this.hud.setWeapon('LONGSHOT AR', 24, 32, this.player.slots);
    // deterministic feed: newest first
    this.hud.feed = [];
    this.hud.pushKill('Vex · LONGSHOT AR ⊙ Brannock');
    this.hud.pushKill('You · LONGSHOT AR ⊙ Sorrel');
    this.hud.radio('Vex: Contact at Water Tower, rotating');
    this.resetPositions();

    if (name === 'combat') {
      // camera mid-yard, two enemies mid-frame, player firing
      this.player.x = 0; this.player.z = 12; this.player.yaw = 0.06; this.player.pitch = 0.02;
      const e1 = this.enemies[0]; // Kestrel
      const e2 = this.enemies[1]; // Heron
      e1.soldier.group.position.set(-2.5, 0, 5);
      e1.soldier.group.rotation.y = Math.PI - 0.25;
      e1.soldier.setPose('aim');
      e2.soldier.group.position.set(3.2, 0, 3.5);
      e2.soldier.group.rotation.y = Math.PI + 0.3;
      e2.soldier.setPose('aim');
      for (const b of this.enemies.slice(2)) b.soldier.group.position.set(30, 0, 30); // hide the rest
      for (const b of this.teammates) b.soldier.group.position.set(-30, 0, 30);
      // enemy fires: flash + tracer + smoke at its muzzle
      // (tracer stops 2 m short of the camera — a tracer ending AT the lens
      // reads as a giant white wedge)
      const mw = new THREE.Vector3();
      e1.soldier.rifle.muzzle.getWorldPosition(mw);
      this.spawnFlash(mw);
      const tgt = new THREE.Vector3(this.player.x, 1.4, this.player.z);
      const edir = tgt.clone().sub(mw).normalize();
      this.spawnTracer(mw, tgt.clone().addScaledVector(edir, -2));
      this.spawnSmoke(mw.clone().add(new THREE.Vector3(0, 0.1, -0.2)), new THREE.Vector3(0, 0.2, -0.5));
      // player fires too (tracer starts 2 m out, never hugging the camera)
      this.spawnVmFlash();
      const pfrom = new THREE.Vector3(0, 1.55, 12);
      const pdir = new THREE.Vector3(-2.5, 1.35, 5).sub(pfrom).normalize();
      this.spawnTracer(pfrom.clone().addScaledVector(pdir, 2), new THREE.Vector3(-2.5, 1.35, 5));
      this.hud.setScore(3, 5, '1:20', 9);
    } else if (name === 'buy') {
      this.state = 'buy';
      this.round = 4;
      this.timer = 5;
      this.player.cash = 4050;
      this.player.hp = 100; this.player.armor = 100;
      this.hud.setScore(3, 0, '0:05', 4, 'BUY');
      this.hud.setVitals(100, 100, 4050);
      this.hud.showBuy(4050, BUY_ITEMS);
      this.hud.radio('Vex: Buy up, we take Site A this round');
      this.player.x = 0; this.player.z = 12; this.player.yaw = 0; this.player.pitch = 0;
      const t1 = this.teammates[0];
      t1.soldier.group.position.set(-3, 0, 6);
      t1.soldier.group.rotation.y = 0.6;
      t1.soldier.setPose('idle');
      for (const b of this.bots) if (b !== t1) b.soldier.group.position.set(30, 0, 30);
      this.hud.hint('Buy time: B opens the requisition menu');
    } else if (name === 'duel') {
      // site B: player comes down the EAST lane (x>17, clear of the z=-3
      // container row), enemy guarding the charge, SITE B sign behind-right.
      // R2 put the player at (11,-1.5) — 0.3 m from the stacked container's
      // side wall, which filled the whole frame with blurry texture.
      // R5: player WEST of the enemy looking EAST — the sun (WSW) is BEHIND
      // the camera, so the enemy is front-lit and no wash sits behind him.
      // R3/R4 looked WSW (59° west of north) straight into the sun (65°) —
      // the haze sat directly behind the enemy and washed him out; no
      // disc/haze value can fix a 6° backlight.
      // R6: closer (6.7 m, enemy ~17%) so the enemy + charge read; the
      // right container no longer fills a third of the frame.
      this.player.x = 7; this.player.z = -7; this.player.yaw = 0; this.player.pitch = 0;
      const e = this.enemies[2]; // Lancer
      e.soldier.group.position.set(13.5, 0, -8.5);
      // faces the player (west); rifle points at the camera, flash centred
      // on the body — readable now because the enemy is front-lit
      e.soldier.group.rotation.y = -Math.PI / 2;
      e.soldier.setPose('aim');
      for (const b of this.bots) if (b !== e) b.soldier.group.position.set(30, 0, 30);
      // aim the camera at the enemy: yaw so the enemy is centred
      const dx = e.x - this.player.x, dz = e.z - this.player.z;
      this.player.yaw = Math.atan2(-dx, -dz);
      const mw = new THREE.Vector3();
      e.soldier.rifle.muzzle.getWorldPosition(mw);
      this.spawnFlash(mw, 0.2); // smaller flash so it does not swallow the enemy
      const etgt = new THREE.Vector3(this.player.x, 1.4, this.player.z);
      const edir = etgt.clone().sub(mw).normalize();
      this.spawnTracer(mw, etgt.clone().addScaledVector(edir, -2));
      this.spawnSmoke(mw.clone(), new THREE.Vector3(1, 0.1, 0));
      this.spawnVmFlash();
      const dfrom = new THREE.Vector3(7, 1.55, -7);
      const ddir = new THREE.Vector3(13.5, 1.35, -8.5).sub(dfrom).normalize();
      this.spawnTracer(dfrom.clone().addScaledVector(ddir, 2), new THREE.Vector3(13.5, 1.35, -8.5));
      this.hud.setPlant(0.55);
      this.hud.radio('Vex: Arming the charge at Site B');
    } else if (name === 'score') {
      this.state = 'score';
      this.score = { EMBER: 7, SLATE: 5 };
      this.round = 12;
      this.player.cash = 3350;
      this.player.x = 0; this.player.z = 12; this.player.yaw = 0; this.player.pitch = 0;
      for (const b of this.bots) b.soldier.group.position.set(30, 0, 30);
      // deterministic match stats: a 7:5 match cannot end with nine 0-kill
      // players. Kills balance deaths across teams (EMBER 30 K = SLATE 30 D,
      // SLATE 20 K = EMBER 20 D). [k, a, d, hs-hits, dmg, cash]
      const tm = [[6, 2, 4, 5, 890, 950], [4, 1, 5, 4, 720, 700], [7, 3, 3, 6, 1100, 1200], [3, 0, 6, 3, 540, 650]];
      this.teammates.forEach((b, i) => { const s = tm[i]; b.kills = s[0]; b.assists = s[1]; b.deaths = s[2]; b.hs = s[3]; b.dmg = s[4]; b.cash = s[5]; });
      const en = [[6, 1, 5, 5, 980], [4, 3, 6, 4, 760], [5, 2, 4, 4, 890], [3, 1, 7, 3, 610], [2, 0, 8, 2, 420]];
      this.enemies.forEach((b, i) => { const s = en[i]; b.kills = s[0]; b.assists = s[1]; b.deaths = s[2]; b.hs = s[3]; b.dmg = s[4]; });
      this.hud.setVitals(76, 85, 3350);
      this.hud.radio('Vex: Match point taken. Cinderline is ours.');
      this.showScoreboard(true);
      this.hud.setScore(7, 5, 'END', 12);
    }
    this.updateCamera(0);
  }

  updateCamera(dt) {
    const p = this.player;
    this.camera.position.set(p.x, 1.62, p.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(p.yaw);
    this.camera.rotateX(p.pitch);
  }

  // simple collision: stay in the yard, push out of container AABBs
  collide() {
    const p = this.player;
    p.x = THREE.MathUtils.clamp(p.x, -33, 33);
    p.z = THREE.MathUtils.clamp(p.z, -23, 23);
    for (const c of this.mapData.containers) {
      const dx = p.x - c.position.x, dz = p.z - c.position.z;
      const cos = Math.cos(-c.rotation.y), sin = Math.sin(-c.rotation.y);
      const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
      const len = c.userData.len || 12.19;
      if (Math.abs(lx) < len / 2 + 0.5 && Math.abs(lz) < 1.7) {
        if (Math.abs(lx) / (len / 2) > Math.abs(lz) / 1.7) p.x = c.position.x + Math.sign(lx) * (len / 2 + 0.5) * cos;
        else p.z = c.position.z + Math.sign(lz) * 1.7 * cos;
      }
    }
  }

  update(dt) {
    this.frames++;
    this.time += dt;
    if (this.state === 'live' && !this.frozen) {
      this.timer -= dt;
      if (Math.floor(this.timer) !== Math.floor(this.timer + dt)) {
        this.hud.setScore(this.score.EMBER, this.score.SLATE, this.fmtTime(), this.round);
      }
      if (this.timer <= 0) {
        const emberAlive = (this.player.alive ? 1 : 0) + this.teammates.filter((b) => !b.dead).length;
        const slateAlive = this.enemies.filter((b) => !b.dead).length;
        this.endRound(emberAlive >= slateAlive ? 'EMBER' : 'SLATE');
      }
      this.playerProxy.x = this.player.x;
      this.playerProxy.z = this.player.z;
      this.playerProxy.dead = !this.player.alive;
      for (const b of this.bots) {
        b.update(dt, this.bots.concat([this.playerProxy]), (bot, tgt, err) => {
          this.botShoot(bot, tgt === this.playerProxy ? 'player' : tgt, err);
        });
      }
    }
    if (this._flashT > 0 && !this.frozen) {
      this._flashT -= dt;
      if (this._flashT <= 0 && this._flash) { this.effects.remove(this._flash); this._flash = null; }
    }
    this.updateCamera(dt);
    // minimap (player yaw, bots)
    if (this.hud.mm) {
      const bots = this.bots.map((b) => ({ x: b.x, z: b.z, team: b.team, dead: b.dead }));
      const walls = [
        { x: 0, z: -24, w: 70, d: 0.6 }, { x: 0, z: 24, w: 70, d: 0.6 },
        { x: -34, z: 0, w: 0.6, d: 48 }, { x: 34, z: 0, w: 0.6, d: 48 },
        { x: -20, z: -14, w: 18, d: 0.5 }, { x: 18, z: -16, w: 14, d: 0.5 },
      ];
      walls.containers = this.mapData.containers.map((c) => ({
        x: c.position.x, z: c.position.z, len: 12.19, rot: c.rotation.y,
      }));
      this.hud.drawMinimap(this.player.yaw, this.player, bots, walls);
    }
  }
}
