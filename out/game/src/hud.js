// hud.js — DOM HUD: round minimap, top bar, killfeed, radio, health/cash,
// weapon slots, ammo, buy menu, scoreboard. Mirrors the Kilnyard layout:
// minimap top-left, top bar centre, killfeed top-right, radio centre,
// health/armor/cash bottom-left, weapon + ammo bottom-right.
export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['minimap', 'topbar', 'killfeed', 'radio', 'health', 'armor', 'cash',
      'ammo', 'weapon', 'slots', 'buyMenu', 'scoreboard', 'crosshair', 'hitmarker',
      'dmg', 'menu', 'roundEnd', 'matchEnd', 'plantBar', 'hint']) {
      this.el[id] = document.getElementById(id);
    }
    this.mm = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.feed = [];
  }

  setScore(ember, slate, time, round, phaseLabel = '') {
    const t = this.el.topbar;
    if (!t) return;
    t.innerHTML =
      `<div class="tb-team ember">EMBER <b>${ember}</b></div>` +
      `<div class="tb-mid"><b>${time}</b><span>ROUND ${round} OF 12${phaseLabel ? ' · ' + phaseLabel : ''}</span></div>` +
      `<div class="tb-team slate"><b>${slate}</b> SLATE</div>`;
  }

  setVitals(health, armor, cash) {
    if (this.el.health) this.el.health.querySelector('b').textContent = health;
    if (this.el.armor) this.el.armor.querySelector('b').textContent = armor + (armor > 0 ? '+H' : '');
    if (this.el.cash) this.el.cash.querySelector('b').textContent = '$' + cash;
  }

  setWeapon(name, mag, reserve, slots) {
    if (this.el.weapon) this.el.weapon.querySelector('.w-name').textContent = name;
    if (this.el.ammo) this.el.ammo.innerHTML = `<b>${mag}</b> / ${reserve}`;
    if (this.el.slots && slots) {
      this.el.slots.innerHTML = slots.map((s, i) =>
        `<span class="${s.active ? 'on' : ''}">${i + 1} ${s.label}</span>`).join('');
    }
  }

  pushKill(text) {
    this.feed.unshift(text);
    if (this.feed.length > 4) this.feed.pop();
    if (this.el.killfeed) {
      this.el.killfeed.innerHTML = this.feed.map((f) => `<div>${f}</div>`).join('');
    }
  }

  radio(text) {
    if (this.el.radio) {
      this.el.radio.innerHTML = `<b>RADIO</b> ${text}`;
      this.el.radio.classList.add('show');
    }
  }

  hitmark() {
    if (!this.el.hitmarker) return;
    this.el.hitmarker.classList.add('show');
    setTimeout(() => this.el.hitmarker.classList.remove('show'), 120);
  }

  damage() {
    if (!this.el.dmg) return;
    this.el.dmg.classList.add('show');
    setTimeout(() => this.el.dmg.classList.remove('show'), 350);
  }

  // Round minimap: dark disc, rotates with the player yaw, FOV cone, dots, A/B.
  drawMinimap(yaw, player, bots, walls) {
    const ctx = this.mm;
    if (!ctx) return;
    const S = 200, C = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, 96, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, S, S);
    ctx.translate(C, C);
    ctx.rotate(-yaw); // world rotates under the player
    const sc = 2.6; // world metres -> px
    const wx = (x) => x * sc, wz = (z) => z * sc;
    // walls (from map data: simple rectangles)
    ctx.fillStyle = '#3a4148';
    for (const w of walls) ctx.fillRect(wx(w.x - w.w / 2), wz(w.z - w.d / 2), w.w * sc, w.d * sc);
    // containers as blocks
    ctx.fillStyle = '#5a4632';
    for (const c of (walls.containers || [])) {
      ctx.save();
      ctx.translate(wx(c.x), wz(c.z)); ctx.rotate(c.rot || 0);
      ctx.fillRect(-c.len * sc / 2, -1.2 * sc, c.len * sc, 2.4 * sc);
      ctx.restore();
    }
    // sites
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = '#e8b83a';
    ctx.fillText('A', wx(-14) - 5, wz(-8) + 5);
    ctx.fillText('B', wx(14) - 5, wz(-8) + 5);
    // bots
    for (const b of bots) {
      ctx.fillStyle = b.team === 'EMBER' ? '#e07840' : '#6a9ac0';
      ctx.beginPath(); ctx.arc(wx(b.x), wz(b.z), b.dead ? 3 : 4.5, 0, Math.PI * 2); ctx.fill();
    }
    // player + FOV cone (player is at the centre, facing up)
    ctx.fillStyle = 'rgba(120,220,120,0.25)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 60, -0.6 - Math.PI / 2, 0.6 - Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7ee07e';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // ring + N
    ctx.strokeStyle = 'rgba(220,220,220,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(C, C, 96, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ddd'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
    ctx.fillText('N', C, 18);
  }

  showBuy(cash, items) {
    const m = this.el.buyMenu;
    if (!m) return;
    m.classList.add('show');
    m.querySelector('.buy-cash').textContent = '$' + cash;
    const cols = m.querySelectorAll('.buy-col');
    items.forEach((col, i) => {
      if (!cols[i]) return;
      cols[i].innerHTML = `<h3>${i + 1} ${col.title}</h3>` + col.items.map((it) =>
        `<div class="buy-item ${it.owned ? 'owned' : ''} ${it.tooExpensive ? 'expensive' : ''}">
          <b>${it.name}</b><span>${it.owned ? 'Owned' : '$' + it.price}</span>
          <small>${it.desc}</small></div>`).join('');
    });
  }

  hideBuy() { if (this.el.buyMenu) this.el.buyMenu.classList.remove('show'); }

  showScore(ember, slate, rowsE, rowsS, victory) {
    const m = this.el.scoreboard;
    if (!m) return;
    const table = (team, rows) =>
      `<h4 class="${team.toLowerCase()}">${team} · ${team === 'EMBER' ? ember : slate}</h4>
       <table><tr><th>Player</th><th>K</th><th>A</th><th>D</th><th>HS</th><th>DMG</th><th>Cash</th></tr>` +
      rows.map((r) => `<tr class="${r.you ? 'you' : ''}"><td>${r.name}</td><td>${r.k}</td><td>${r.a}</td><td>${r.d}</td><td>${r.hs}%</td><td>${r.dmg}</td><td>${r.cash}</td></tr>`).join('') +
      `</table>`;
    m.querySelector('.score-body').innerHTML =
      `<h2>${victory ? 'VICTORY' : 'DEFEAT'}</h2>
       <p class="score-sub">Cinderline Yard · ${ember} : ${slate} · Enter for a new match</p>` +
      table('EMBER', rowsE) + table('SLATE', rowsS);
    m.classList.add('show');
  }

  hideScore() { if (this.el.scoreboard) this.el.scoreboard.classList.remove('show'); }

  showMenu(show) { if (this.el.menu) this.el.menu.classList.toggle('show', show); }

  showMatchEnd(victory, ember, slate) {
    const m = this.el.matchEnd;
    if (!m) return;
    m.querySelector('h2').textContent = victory ? 'VICTORY' : 'DEFEAT';
    m.querySelector('p').textContent = `Cinderline Yard · ${ember} : ${slate} — press Enter for a new match`;
    m.classList.add('show');
  }

  setPlant(progress) { // 0..1, null = hide
    const p = this.el.plantBar;
    if (!p) return;
    if (progress === null) { p.classList.remove('show'); return; }
    p.classList.add('show');
    p.querySelector('.plant-fill').style.width = Math.round(progress * 100) + '%';
  }

  hint(text) { if (this.el.hint) this.el.hint.textContent = text; }
}
