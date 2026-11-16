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

// ---- cobble ground: stones + cracks + oil + tire marks ----
export function groundTex(seed = 7) {
  const [c, g] = canvas(1024, 1024);
  const rng = mulberry32(seed);
  g.fillStyle = '#6a5c4c'; g.fillRect(0, 0, 1024, 1024);
  // cobble stones: staggered rows of rounded rects
  const rows = 16, cols = 16;
  for (let r = 0; r < rows; r++) {
    for (let col = -1; col < cols; col++) {
      const x = ((col + (r % 2) * 0.5) / cols) * 1024;
      const y = (r / rows) * 1024;
      const w = 1024 / cols - 5, h = 1024 / rows - 5;
      const v = 78 + Math.floor(rng() * 42);
      g.fillStyle = `rgb(${v + 24},${v + 4},${v - 18})`;
      g.beginPath();
      g.roundRect(x + 2, y + 2, w, h, 9);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.09)';
      g.beginPath(); g.roundRect(x + 4, y + 3, w - 6, 10, 5); g.fill();
    }
  }
  // cracks: dark jagged polylines
  g.strokeStyle = 'rgba(30,22,16,0.55)'; g.lineWidth = 2.5;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    let x = rng() * 1024, y = rng() * 1024;
    g.moveTo(x, y);
    for (let s = 0; s < 7; s++) { x += (rng() - 0.5) * 120; y += (rng() - 0.5) * 120; g.lineTo(x, y); }
    g.stroke();
  }
  // oil stains: dark soft blobs
  for (let i = 0; i < 9; i++) {
    const x = rng() * 1024, y = rng() * 1024, r = 26 + rng() * 60;
    const grd = g.createRadialGradient(x, y, 2, x, y, r);
    grd.addColorStop(0, 'rgba(18,14,10,0.6)');
    grd.addColorStop(1, 'rgba(18,14,10,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // tire marks: two parallel dark arcs
  for (let i = 0; i < 5; i++) {
    const x = rng() * 1024, y = rng() * 1024, r = 120 + rng() * 160, a0 = rng() * Math.PI;
    g.strokeStyle = 'rgba(20,16,12,0.35)'; g.lineWidth = 9 + rng() * 6;
    g.beginPath(); g.arc(x, y, r, a0, a0 + 0.9 + rng() * 0.8); g.stroke();
    g.beginPath(); g.arc(x, y, r + 26, a0, a0 + 0.9 + rng() * 0.8); g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// roughness map for the ground: mid grey = dry, dark = wet/smooth (puddles + oil)
export function groundRoughTex(seed = 7) {
  const [c, g] = canvas(512, 512);
  const rng = mulberry32(seed);
  g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 512, 512); // dry ~0.7
  for (let i = 0; i < 26; i++) { // damp halos
    const x = rng() * 512, y = rng() * 512, r = 30 + rng() * 70;
    const grd = g.createRadialGradient(x, y, 2, x, y, r);
    grd.addColorStop(0, 'rgba(90,90,90,0.7)');
    grd.addColorStop(1, 'rgba(90,90,90,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 8; i++) { // standing water: very smooth
    const x = rng() * 512, y = rng() * 512, r = 18 + rng() * 34;
    const grd = g.createRadialGradient(x, y, 2, x, y, r);
    grd.addColorStop(0, 'rgba(40,40,40,0.95)');
    grd.addColorStop(1, 'rgba(40,40,40,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 9; i++) { // oil: mid-dark, NOT mirror (lesson: #606060 not #303030)
    const x = rng() * 512, y = rng() * 512, r = 14 + rng() * 30;
    const grd = g.createRadialGradient(x, y, 2, x, y, r);
    grd.addColorStop(0, 'rgba(96,96,96,0.8)');
    grd.addColorStop(1, 'rgba(96,96,96,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = tex(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
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
