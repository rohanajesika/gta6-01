// Solmar Bay — the program that hands the game in.
//
// It runs on Node 22 with the standard library only, in a sandbox with
// no network: it copies game/ and screenshots/ from beside this file
// into /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with buildDossier from the kit's vendored
// make.fun library, exactly as the kit's starter does. Nothing else:
// no fetching, no code generation, no reading outside this folder.
//
// Run it locally the same way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in a half-empty output: the game and
// its screenshots must both be present beside this file.
for (const needed of ['game', 'screenshots']) {
  if (!existsSync(join(here, needed))) {
    throw new Error(`Solmar Bay: missing ${needed}/ beside main.ts — nothing to hand in`);
  }
}

// Count the files being handed in, so the run summary below reports
// real numbers instead of assuming the copy worked.
function countFiles(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countFiles(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

// The whole game, verbatim, and the screenshots of it.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps, as the kit's reference gate.json states them: the
// text cap shapes the dossier's bytes, the rest refuse an entry the
// scorer would refuse — more than 4 screenshots or one over 256 KiB,
// more than 993 files in game/ or 48 MiB of game files in all, or a
// path under game/ over 1000 bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Report what was actually written, so a silent short copy cannot
// pass as a successful hand-in.
const gameCount = countFiles(join(out, 'game'));
const shotCount = countFiles(join(out, 'screenshots'));
console.log(
  `Solmar Bay handed in: ${gameCount.files} game files (${gameCount.bytes} bytes), `
  + `${shotCount.files} screenshots (${shotCount.bytes} bytes), `
  + `dossier.json (${Buffer.byteLength(dossier, 'utf8')} bytes) -> ${out}`,
);
