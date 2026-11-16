# NOTES — CINDERLINE YARD (threejs-fps-02-v2)

Catatan penyebab + perbaikan per poin. Ditulis saat perbaikan dibuat,
bukan sesudahnya.

## P9 — muzzle smoke: sprite -> THREE.Points (16 Nov 2026)

**Penyebab (2 kegagalan pada plume lama):**
1. Plume lama = 5 sprite (`makeSmoke`, `weapon.js`) berukuran 0.42–1.0 m
   di sepanjang garis tembak. Dekat lensa (0.5 m) satu sprite 1 m menutup
   frame — asap "menumpuk" jadi dinding, bukan kepulan.
2. Sprite transparan DIHITAMKAN pass GTAO. Terbukti lewat diagnostik
   A–F (16 Nov, skrip `~/workspace/x-headless/smokediag*.mjs`):
   tekstur terang (pusat 243,238,233,254), material terang (d8cfc4),
   tapi render KOTAK HITAM. `fog=false` tetap hitam, `map=null` +
   warna polos tetap hitam, `depthWrite=true` tetap hitam. Sprite yang
   sama di VM scene (tanpa composer) render TERANG samar. Bola mesh
   (MeshStandardMaterial) render TERANG. THREE.Points + softDiscTex
   render TERANG + lembut. Vonis: GTAO yang menghitamkan sprite, bukan
   tekstur/fog/depthWrite.

**Perbaikan:**
- `makeSmoke` (`weapon.js`) sekarang mengembalikan `THREE.Points`:
  16 titik kecil (0.22 m, `sizeAttenuation`), `softDiscTex` hangat
  (232,222,210), opacity 0.6, `depthWrite: false`, warna 0xe8ded2,
  tersebar 0.1–1.0 m di sepanjang arah tembak terbalik + jitter lateral
  ±0.15 m. Titik kecil tidak menutup lensa di 0.5 m; Points lolos GTAO
  (terverifikasi di cerobong, diagnostik F). R1 pakai 12 titik 0.14 m /
  opacity 0.5 — di 7 m terlalu samar (10 px/titik), jadi R2 naik ke
  16 titik 0.22 m / opacity 0.6.
- `spawnSmoke` (`game.js`) memanggil `makeSmoke(..., 16, 3)`.
  Pemanggil tidak peduli Group vs Points (keduanya Object3D, ditambah
  ke `effects`, dihapus setelah 900 ms).
- Efek samping yang sama diperbaiki di Celah 2: asap cerobong tadinya
  6 sprite smokeTex (kotak hitam di langit) -> 3 lapis Points
  (2.5/3.5/4.5 m) di `map.js` (`smokePuffs`). `smokeTex` di
  `textures.js` kini tidak dipakai lagi di mana pun (fungsinya dibiarkan
  — hapus belakangan kalau mau bersih-bersih).

**Verifikasi:** mode harness `dust` (near 0.5 m + far ~7 m) + combat
re-shot, minimal 3 putaran QC. Bukti: `shots/after/dust-*-p9r*.jpg` +
`shots/after/1-combat-p9r*.jpg`.
