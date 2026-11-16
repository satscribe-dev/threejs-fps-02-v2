// geom.js — small geometry builders. Everything here is my own code; no copied helpers.
import * as THREE from 'three';

// Rounded-rect shape (for chamfered boxes).
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// Chamfered box: extruded rounded rect with bevel, centred on origin.
// This is what makes edges catch light instead of the flat "toy box" look.
export function chamferBox(w, h, d, r, mat) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const depth = Math.max(d - rr * 2, 0.001);
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, h, rr), {
    depth, bevelEnabled: true, bevelThickness: rr, bevelSize: rr,
    bevelSegments: 2, curveSegments: 6, steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// Plain box helper (used only where a hard edge is honest: crates, plates, tiles).
export function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// Cylinder between two points (arms, legs, cables, rods, poles).
export function tube(a, b, r, mat, seg = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

// Trapezoid corrugation: a panel whose face is a zig-zag of trapezoid ribs.
// profile runs along X (length), extruded along Z (depth). Real 3D ribs, real shadows.
export function corrugatedPanel(len, height, mat, opts = {}) {
  const pitch = opts.pitch ?? 0.28;      // rib spacing (ISO ~0.25-0.30 m)
  const amp = opts.amp ?? 0.035;        // rib depth
  const flat = opts.flat ?? 0.10;        // flat top width per rib
  const s = new THREE.Shape();
  const n = Math.max(1, Math.round(len / pitch));
  const p = len / n;
  const x0 = -len / 2, y0 = -height / 2;
  s.moveTo(x0, y0);
  s.lineTo(x0 + len, y0);
  s.lineTo(x0 + len, y0 + height);
  // top edge: zig-zag back to the left
  for (let i = n - 1; i >= 0; i--) {
    const xa = x0 + i * p;
    s.lineTo(xa + p, y0 + height - amp);
    s.lineTo(xa + p - flat, y0 + height - amp);
    s.lineTo(xa + flat * 0.4, y0 + height);
    s.lineTo(xa, y0 + height);
  }
  s.lineTo(x0, y0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -0.025);
  // ExtrudeGeometry UVs are raw shape coords (0..len) — a 12 m panel would
  // tile the texture ~12x (wallpaper). Remap to 0..1 across the panel so the
  // serial/CSC print once, like a real container side.
  {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + len / 2) / len, (pos.getY(i) + height / 2) / height);
    }
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// Lathe profile helper: points as [radius, y] pairs.
export function lathe(profile, mat, seg = 20) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, seg);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// Capsule between two points (fingers, limbs with soft ends).
export function capsule(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(dir.length(), 0.001);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

// Sphere helper.
export function ball(r, mat, w = 18, h = 12) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
}

// Flat circular blob shadow (cheap AO under characters/props).
export function blobShadow(r, opacity, tex) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}
