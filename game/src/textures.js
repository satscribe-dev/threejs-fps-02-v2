// textures.js — all textures are drawn on Canvas2D at runtime (no downloaded assets).
// Seeded RNG (mulberry32) keeps every texture deterministic.
import * as THREE from 'three';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---- container side: corrugation shading + serial + CSC + rust ----
export function containerSideTex(o) {
  const { serial = 'CLDU 482 913-7', maxGross = '30 480 KG', tare = '3 720 KG',
    base = '#b4502e', dark = '#8e3a20', light = '#c96a42', seed = 1, csc = true } = o;
  const [c, g] = canvas(1024, 512);
  const rng = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, 1024, 512);
  // corrugation: vertical ribs (light left edge, dark right edge)
  const ribs = 36;
  for (let i = 0; i < ribs; i++) {
    const x = (i / ribs) * 1024, w = 1024 / ribs;
    g.fillStyle = light; g.fillRect(x, 0, w * 0.28, 512);
    g.fillStyle = dark; g.fillRect(x + w * 0.72, 0, w * 0.28, 512);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + w * 0.45, 0, w * 0.12, 512);
  }
  // paint variation: faint horizontal bands + blotches
  for (let i = 0; i < 26; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    g.fillRect(0, rng() * 512, 1024, 6 + rng() * 26);
  }
  // rust streaks running down from the top edge
  for (let i = 0; i < 42; i++) {
    const x = rng() * 1024, y = rng() * 120, len = 30 + rng() * 160;
    const grd = g.createLinearGradient(0, y, 0, y + len);
    grd.addColorStop(0, 'rgba(70,32,12,0.55)');
    grd.addColorStop(1, 'rgba(70,32,12,0)');
    g.fillStyle = grd;
    g.fillRect(x, y, 3 + rng() * 7, len);
  }
  // stencil serial (big, off-white, slightly worn)
  g.fillStyle = 'rgba(240,232,210,0.92)';
  g.font = 'bold 92px "Arial Narrow", Arial, sans-serif';
  g.fillText(serial, 52, 300);
  g.font = 'bold 44px "Arial Narrow", Arial, sans-serif';
  g.fillText('MAX GROSS ' + maxGross, 56, 372);
  g.fillText('TARE ' + tare, 56, 424);
  // wear: erase thin horizontal scratches over the text
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 60; i++) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(rng() * 1024, rng() * 512, 20 + rng() * 90, 1.5);
  }
  g.globalCompositeOperation = 'source-over';
  // CSC plate: white rectangle with tiny dark text
  if (csc) {
    g.fillStyle = '#e8e2d2'; g.fillRect(700, 96, 260, 150);
    g.fillStyle = '#2a2a2a';
    g.font = 'bold 26px Arial, sans-serif';
    g.fillText('CSC', 716, 128);
    g.font = '20px Arial, sans-serif';
    g.fillText('ACE  20  4', 716, 158);
    g.fillText('USA 482 913', 716, 186);
    g.fillText('MAX 30 480', 716, 214);
  }
  // stencil "07" corner mark
  g.fillStyle = 'rgba(240,232,210,0.85)';
  g.font = 'bold 54px Arial, sans-serif';
  g.fillText('07', 940, 70);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- container door end: locking rods + handles ----
export function containerDoorTex(o) {
  const { base = '#b4502e', seed = 5 } = o;
  const [c, g] = canvas(512, 512);
  const rng = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18; i++) {
    const x = (i / 18) * 512, w = 512 / 18;
    g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x, 0, w * 0.3, 512);
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x + w * 0.7, 0, w * 0.3, 512);
  }
  for (let i = 0; i < 18; i++) {
    const x = rng() * 512, y = rng() * 90, len = 40 + rng() * 120;
    g.fillStyle = 'rgba(70,32,12,0.4)';
    g.fillRect(x, y, 4 + rng() * 6, len);
  }
  g.fillStyle = 'rgba(240,232,210,0.9)';
  g.font = 'bold 40px "Arial Narrow", Arial, sans-serif';
  g.fillText('CLDU', 30, 480);
  return tex(c);
}

// ---- cobble ground: stones ONLY (cracks/oil/tire moved to DECALS, P6) ----
// FIX 9 POIN P6: batu terlalu BESAR + terlalu seragam — di R0 close-up,
// batu ~1 m kayak cokelat batangan, nol variasi. Sekarang 28x28 batu per
// tile (was 16x16) + variasi warna LEBIH LEBAR (v 60-140, was 78-120) +
// highlight atas + bayangan bawah per batu (relief tanpa normal map).
// Repeat dinaikkan di map.js (8x6) -> batu ~0.31 m, mendekati cobble asli.
export function groundTex(seed = 7) {
  const [c, g] = canvas(1024, 1024);
  const rng = mulberry32(seed);
  g.fillStyle = '#55483a'; g.fillRect(0, 0, 1024, 1024); // mortar (gap) — R2: lebih terang, grid tidak terlalu keras
  // cobble stones: staggered rows of rounded rects
  // FIX 9 POIN P6 R2: tiap batu punya JITTER posisi + ukuran (was grid
  // sempurna — semua batu sama besar, baris/kolom sejajar, kelihatan
  // mesin-stempel). 5 rng() per batu, urutan SAMA di groundBumpTex supaya
  // bump sejajar dengan warna: v, xoff, yoff, wvar, hvar.
  const rows = 28, cols = 28;
  for (let r = 0; r < rows; r++) {
    for (let col = -1; col < cols; col++) {
      const v = 60 + Math.floor(rng() * 80);
      const xoff = (rng() - 0.5) * 5, yoff = (rng() - 0.5) * 5;
      const wvar = (rng() - 0.5) * 6, hvar = (rng() - 0.5) * 6;
      const x = ((col + (r % 2) * 0.5) / cols) * 1024 + xoff;
      const y = (r / rows) * 1024 + yoff;
      const w = 1024 / cols - 4 + wvar, h = 1024 / rows - 4 + hvar;
      g.fillStyle = `rgb(${v + 24},${v + 4},${v - 18})`;
      g.beginPath();
      g.roundRect(x + 2, y + 2, w, h, 6);
      g.fill();
      // top highlight + bottom shadow: batu punya relief
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath(); g.roundRect(x + 3, y + 3, w - 6, 7, 3); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.roundRect(x + 3, y + h - 9, w - 6, 7, 3); g.fill();
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- cobble height map (bumpMap): stones raised, gaps recessed ----
// Layout SAMA PERSIS dengan groundTex (seed + loop sama, 1 rng() per batu)
// supaya bump sejajar dengan warna. Dipakai sebagai bumpMap di map.js.
export function groundBumpTex(seed = 7) {
  const [c, g] = canvas(512, 512);
  const rng = mulberry32(seed);
  g.fillStyle = '#282828'; g.fillRect(0, 0, 512, 512); // gap = rendah
  // Jitter SAMA seperti groundTex (5 rng() per batu, urutan sama) supaya
  // bump sejajar dengan warna.
  const rows = 28, cols = 28;
  for (let r = 0; r < rows; r++) {
    for (let col = -1; col < cols; col++) {
      const v = 60 + Math.floor(rng() * 80);
      const xoff = (rng() - 0.5) * 5, yoff = (rng() - 0.5) * 5;
      const wvar = (rng() - 0.5) * 6, hvar = (rng() - 0.5) * 6;
      const x = ((col + (r % 2) * 0.5) / cols) * 512 + xoff / 2;
      const y = (r / rows) * 512 + yoff / 2;
      const w = 512 / cols - 2 + wvar / 2, h = 512 / rows - 2 + hvar / 2;
      const hv = 150 + Math.floor((v - 60) / 80 * 60); // batu = tinggi (150-210)
      g.fillStyle = `rgb(${hv},${hv},${hv})`;
      g.beginPath();
      g.roundRect(x + 1, y + 1, w, h, 3);
      g.fill();
    }
  }
  const t = tex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// roughness map for the ground: mid grey = dry, dark = wet/smooth
// FIX 9 POIN P6: noda air/minyak kecil DIHAPUS dari sini — repeat naik ke
// 8x6, noda kecil bakal berulang tiap 8,75 m (kelihatan tiling). Yang
// tersisa: variasi lembap skala BESAR (halo lembut). Air berdiri + minyak
// sekarang decal/puddle terpisah di map.js.
export function groundRoughTex(seed = 7) {
  const [c, g] = canvas(512, 512);
  const rng = mulberry32(seed);
  g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 512, 512); // dry ~0.7
  for (let i = 0; i < 10; i++) { // damp halos (large-scale only)
    const x = rng() * 512, y = rng() * 512, r = 60 + rng() * 120;
    const grd = g.createRadialGradient(x, y, 2, x, y, r);
    grd.addColorStop(0, 'rgba(90,90,90,0.5)');
    grd.addColorStop(1, 'rgba(90,90,90,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = tex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- floor DECALS (P6): large-scale yard features as separate planes ----
// Dipakai di map.js sebagai plane transparan di posisi dunia tertentu
// (bukan di-tile bareng cobble) — jadi retakan/noda/bekas ban tidak
// berulang tiap 8,75 m.
export function crackDecalTex(seed = 21) {
  const [c, g] = canvas(256, 256);
  const rng = mulberry32(seed);
  g.strokeStyle = 'rgba(28,20,14,0.6)'; g.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    let x = 30 + rng() * 196, y = 30 + rng() * 196;
    g.moveTo(x, y);
    for (let s = 0; s < 8; s++) { x += (rng() - 0.5) * 90; y += (rng() - 0.5) * 90; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c);
}
export function oilDecalTex(seed = 22) {
  const [c, g] = canvas(256, 256);
  const rng = mulberry32(seed);
  for (let i = 0; i < 3; i++) {
    const x = 60 + rng() * 136, y = 60 + rng() * 136, r = 30 + rng() * 55;
    const grd = g.createRadialGradient(x, y, 2, x, y, r);
    grd.addColorStop(0, 'rgba(16,12,9,0.65)');
    grd.addColorStop(1, 'rgba(16,12,9,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}
export function tireDecalTex(seed = 23) {
  const [c, g] = canvas(512, 256);
  const rng = mulberry32(seed);
  for (let i = 0; i < 2; i++) {
    const x = rng() * 512, y = rng() * 256, r = 140 + rng() * 180, a0 = rng() * Math.PI;
    g.strokeStyle = 'rgba(20,16,12,0.5)'; g.lineWidth = 12 + rng() * 6; // R2: lebih gelap + tebal (was 0.4 / 10+6)
    g.beginPath(); g.arc(x, y, r, a0, a0 + 0.8 + rng() * 0.7); g.stroke();
    g.beginPath(); g.arc(x, y, r + 28, a0, a0 + 0.8 + rng() * 0.7); g.stroke();
  }
  return tex(c);
}
export function gravelDecalTex(seed = 24) {
  const [c, g] = canvas(256, 256);
  const rng = mulberry32(seed);
  for (let i = 0; i < 420; i++) {
    const v = 90 + Math.floor(rng() * 90);
    g.fillStyle = `rgba(${v + 20},${v},${v - 20},${0.5 + rng() * 0.5})`;
    g.beginPath();
    g.arc(rng() * 256, rng() * 256, 1.5 + rng() * 3.5, 0, Math.PI * 2);
    g.fill();
  }
  return tex(c);
}
export function markingDecalTex(seed = 25) {
  // faded painted lane line (yellow) — worn, not a solid bar
  // R2: alpha 0.75 -> 0.5 + lebih banyak wear (was garis kuning segar)
  const [c, g] = canvas(256, 256);
  const rng = mulberry32(seed);
  g.fillStyle = 'rgba(210,170,60,0.5)';
  g.fillRect(108, 8, 40, 240);
  // wear: erase random scratches over the paint
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 140; i++) {
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(100 + rng() * 56, rng() * 256, 2 + rng() * 8, 2 + rng() * 20);
  }
  g.globalCompositeOperation = 'source-over';
  return tex(c);
}

// ---- brick wall with stains ----
export function brickTex(seed = 11, base = '#8a5a44') {
  const [c, g] = canvas(512, 512);
  const rng = mulberry32(seed);
  g.fillStyle = '#6e4636'; g.fillRect(0, 0, 512, 512);
  const bh = 32, bw = 84;
  for (let r = 0; r < 16; r++) {
    for (let col = -1; col < 7; col++) {
      const x = ((col + (r % 2) * 0.5) * bw), y = r * bh;
      const v = Math.floor(rng() * 26) - 13;
      g.fillStyle = `rgb(${138 + v},${90 + v},${68 + v})`;
      g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(x + 2, y + 2, bw - 4, 6);
    }
  }
  for (let i = 0; i < 20; i++) { // grime streaks
    const x = rng() * 512, y = rng() * 200, len = 40 + rng() * 160;
    const grd = g.createLinearGradient(0, y, 0, y + len);
    grd.addColorStop(0, 'rgba(30,20,14,0.35)'); grd.addColorStop(1, 'rgba(30,20,14,0)');
    g.fillStyle = grd; g.fillRect(x, y, 4 + rng() * 8, len);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- wood crate planks ----
export function woodTex(seed = 13) {
  const [c, g] = canvas(256, 256);
  const rng = mulberry32(seed);
  g.fillStyle = '#9a7448'; g.fillRect(0, 0, 256, 256);
  for (let p = 0; p < 4; p++) {
    const y = p * 64;
    const v = Math.floor(rng() * 24) - 12;
    g.fillStyle = `rgb(${154 + v},${116 + v},${72 + v})`;
    g.fillRect(0, y + 2, 256, 60);
    g.strokeStyle = 'rgba(60,40,18,0.5)'; g.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(0, y + 12 + rng() * 40);
      g.bezierCurveTo(80, y + 8 + rng() * 48, 170, y + 8 + rng() * 48, 256, y + 12 + rng() * 40);
      g.stroke();
    }
  }
  g.strokeStyle = 'rgba(50,32,14,0.6)'; g.lineWidth = 3;
  g.strokeRect(4, 4, 248, 248);
  g.beginPath(); g.moveTo(4, 4); g.lineTo(252, 252); g.moveTo(252, 4); g.lineTo(4, 252); g.stroke();
  return tex(c);
}

// ---- sign board: big name + small sub-line ----
export function signTex(main, sub, fg = '#f0e8d2', bg = '#1c1a18') {
  const [c, g] = canvas(512, 192);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 192);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 496, 176);
  g.fillStyle = fg;
  g.font = 'bold 64px "Arial Narrow", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(main, 256, 96);
  g.font = 'bold 34px "Arial Narrow", Arial, sans-serif';
  g.fillText(sub, 256, 152);
  return tex(c);
}

// ---- muzzle flash: 8-petal star on transparent ----
export function flashTex() {
  const [c, g] = canvas(128, 128);
  const cx = 64, cy = 64;
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    const len = p % 2 === 0 ? 78 : 46;
    const grd = g.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    grd.addColorStop(0, 'rgba(255,240,180,1)');
    grd.addColorStop(0.5, 'rgba(255,180,70,0.9)');
    grd.addColorStop(1, 'rgba(255,120,20,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a - 0.28) * 14, cy + Math.sin(a - 0.28) * 14);
    g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    g.lineTo(cx + Math.cos(a + 0.28) * 14, cy + Math.sin(a + 0.28) * 14);
    g.closePath(); g.fill();
  }
  const core = g.createRadialGradient(cx, cy, 1, cx, cy, 10);
  core.addColorStop(0, 'rgba(255,255,230,1)');
  core.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = core; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
  return tex(c);
}

// ---- smoke puff: soft noisy blob ----
export function smokeTex(seed = 21) {
  const [c, g] = canvas(128, 128);
  const rng = mulberry32(seed);
  const cx = 64, cy = 64;
  const base = g.createRadialGradient(cx, cy, 4, cx, cy, 62);
  base.addColorStop(0, 'rgba(235,228,220,0.85)');
  base.addColorStop(0.6, 'rgba(220,212,205,0.45)');
  base.addColorStop(1, 'rgba(220,212,205,0)');
  g.fillStyle = base; g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 26; i++) { // lumps
    const a = rng() * Math.PI * 2, r = rng() * 34;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, rr = 8 + rng() * 16;
    const grd = g.createRadialGradient(x, y, 1, x, y, rr);
    grd.addColorStop(0, 'rgba(245,240,235,0.5)');
    grd.addColorStop(1, 'rgba(245,240,235,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

// ---- soft round sprite (dust / glow / blob shadow) ----
export function softDiscTex(inner = 'rgba(255,255,255,0.9)', outer = 'rgba(255,255,255,0)') {
  const [c, g] = canvas(128, 128);
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  return tex(c);
}

// ---- name tag: small dark plate with name ----
export function nameTagTex(name, color = '#e8e0cc') {
  const [c, g] = canvas(256, 64);
  g.fillStyle = 'rgba(12,10,10,0.72)';
  g.beginPath(); g.roundRect(2, 6, 252, 52, 10); g.fill();
  g.fillStyle = color;
  g.font = 'bold 34px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(name, 128, 44);
  return tex(c);
}
