// ai.js — bot brains for a 5v5 round: waypoints down 3 lanes, aim with error,
// burst fire, take damage, die, respawn next round. Seeded, so staged shots are stable.
import * as THREE from 'three';
import { buildSoldier } from './character.js';

export const BOT_NAMES = {
  EMBER: ['You', 'Sorrel', 'Vex', 'Brannock', 'Marlowe'],
  SLATE: ['Kestrel', 'Heron', 'Lancer', 'Wren', 'Tamper'],
};

// Lane waypoints across the yard (x, z). Bots walk them, then hold and aim.
const LANES = [
  [[-2, 14], [-2, 4], [-2, -4], [-6, -8]],     // mid
  [[-14, 12], [-14, 2], [-14, -6]],            // west / site A
  [[10, 12], [10, 2], [12, -6]],               // east / site B
];

export class Bot {
  constructor(scene, team, name, spawn, seed) {
    this.team = team;
    this.name = name;
    this.spawn = spawn;
    this.soldier = buildSoldier(team, name, seed);
    this.soldier.group.position.set(spawn[0], 0, spawn[1]);
    scene.add(this.soldier.group);
    this.hp = 100;
    this.dead = false;
    this.kills = 0; this.assists = 0; this.deaths = 0; this.hs = 0; this.dmg = 0;
    this.cash = 800;
    this.state = 'move';
    this.wp = 0;
    this.lane = LANES[seed % LANES.length];
    this.aimErr = 0;
    this.burstLeft = 0;
    this.cool = 0;
    this.target = null;
    this.yaw = team === 'EMBER' ? Math.PI : 0;
    this.soldier.group.rotation.y = this.yaw;
    this.soldier.setPose('idle');
  }

  get x() { return this.soldier.group.position.x; }
  get z() { return this.soldier.group.position.z; }

  reset(spawn) {
    this.hp = 100; this.dead = false; this.state = 'move'; this.wp = 0;
    this.soldier.dead = false;
    this.soldier.group.position.set(spawn[0], 0, spawn[1]);
    this.soldier.group.rotation.x = 0;
    this.soldier.group.rotation.y = this.team === 'EMBER' ? Math.PI : 0;
    this.soldier.tag.visible = true;
    this.soldier.setPose('idle');
  }

  // Pick the nearest living enemy within 26 m.
  acquire(enemies) {
    let best = null, bd = 26;
    for (const e of enemies) {
      if (e.dead || e === this) continue;
      const d = Math.hypot(e.x - this.x, e.z - this.z);
      if (d < bd) { bd = d; best = e; }
    }
    this.target = best;
    return best;
  }

  update(dt, enemies, onShoot) {
    if (this.dead) return;
    this.cool -= dt;
    const target = this.acquire(enemies);
    if (target) {
      // face the target, aim pose, burst fire
      const dx = target.x - this.x, dz = target.z - this.z;
      const want = Math.atan2(dx, dz);
      let dy = want - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += THREE.MathUtils.clamp(dy, -dt * 3.2, dt * 3.2);
      this.soldier.group.rotation.y = this.yaw;
      this.soldier.setPose('aim');
      this.state = 'aim';
      if (Math.abs(dy) < 0.12 && this.cool <= 0) {
        this.burstLeft = 3;
        this.cool = 0.9 + Math.random() * 0.5;
        this.aimErr = 0.03 + Math.random() * 0.05;
      }
      if (this.burstLeft > 0 && this.cool <= 0.15) {
        this.burstLeft--;
        this.cool = 0.12;
        onShoot(this, target, this.aimErr);
      }
      return;
    }
    // no target: walk the lane
    this.state = 'move';
    const wp = this.lane[this.wp];
    const dx = wp[0] - this.x, dz = wp[1] - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) { this.wp = (this.wp + 1) % this.lane.length; return; }
    const sp = 2.2 * dt;
    const nx = this.x + (dx / d) * sp, nz = this.z + (dz / d) * sp;
    this.soldier.group.position.x = nx;
    this.soldier.group.position.z = nz;
    const want = Math.atan2(dx, dz);
    let dy = want - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += THREE.MathUtils.clamp(dy, -dt * 3.2, dt * 3.2);
    this.soldier.group.rotation.y = this.yaw;
    this.soldier.update(dt, true);
  }

  damage(amount, attacker, headshot = false) {
    if (this.dead) return false;
    this.hp -= amount;
    this.dmg += 0;
    if (attacker) attacker.dmg += amount;
    if (headshot) this.hs++;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deaths++;
      if (attacker) attacker.kills++;
      this.soldier.setPose('dead');
      return true;
    }
    return false;
  }
}
