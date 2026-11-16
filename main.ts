// CINDERLINE YARD v2 — entrypoint (Node 22, standard library only).
// Stages the game into the output directory and writes dossier.json with
// the kit's buildDossier. Run as `node main.ts` from the repository root;
// MAKEFUN_OUTPUT_DIR overrides the output directory (default ./out).
import * as fs from "node:fs";
import * as path from "node:path";
import * as dossier from "./vendor/makefun-threejs.ts";
const repoRoot = path.dirname(new URL(import.meta.url).pathname);
const outDir = process.env.MAKEFUN_OUTPUT_DIR || path.join(repoRoot, "out");
const caps = { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 };
fs.mkdirSync(outDir, { recursive: true });
fs.cpSync(path.join(repoRoot, "game"), path.join(outDir, "game"), { recursive: true, force: true });
fs.cpSync(path.join(repoRoot, "screenshots"), path.join(outDir, "screenshots"), { recursive: true, force: true });
fs.writeFileSync(path.join(outDir, "dossier.json"), dossier.buildDossier(outDir, caps));
console.log(`dossier written: ${path.join(outDir, "dossier.json")}`);
