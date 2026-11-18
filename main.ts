// Solmar Bay — the entrypoint for make.fun's gta6-01 bounty (Node 22,
// standard library only). It hands the game in: copies this repository's
// game/ and screenshots/ to the output directory and writes
// /output/dossier.json with the kit's vendored library, so the sealed
// scorer can rebuild the same dossier byte for byte.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output. The run
// is deterministic: the same repository always writes the same bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps for this bounty (reference/gate.json): only
// text_max_bytes shapes the dossier's bytes; the others refuse an entry
// the scorer would refuse, so this program fails the same way, early,
// instead of handing in something the gate would reject. The same
// numbers appear twice on purpose: once here for this program's own
// validation, once as a literal at the buildDossier call below, because
// the gate preflight reads the caps out of that call's literal.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  throw new Error(`main.ts: ${message}`);
}

// Validate the inputs before copying anything, so a broken repository
// fails loudly here instead of producing a half-written output.
const gameDir = join(here, 'game');
const indexPath = join(gameDir, 'index.html');
if (!existsSync(indexPath) || !statSync(indexPath).isFile()) {
  fail('game/index.html is missing — the game has no entry page');
}
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
  fail('screenshots/ is missing — the entry needs 3 or 4 screenshots');
}
const shotNames = readdirSync(shotsDir).filter((name) => !name.startsWith('.')).sort();
if (shotNames.length < 3 || shotNames.length > CAPS.screenshots.max) {
  fail(`screenshots/ holds ${shotNames.length} images, need 3 or 4`);
}
let shotBytes = 0;
for (const name of shotNames) {
  const path = join(shotsDir, name);
  if (!statSync(path).isFile()) fail(`screenshots/${name} is not a regular file`);
  const size = statSync(path).size;
  if (size > CAPS.screenshots.max_bytes) {
    fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
  }
  shotBytes += size;
}

// Start from a clean output: stale files from an earlier run would make
// two runs of the same repository write different bytes.
rmSync(join(out, 'game'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
rmSync(join(out, 'dossier.json'), { force: true });
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A short build summary on stdout: what went in, and the dossier's hash,
// so two runs can be compared without diffing the whole output.
const gameFiles = readdirSync(join(out, 'game'), { recursive: true });
const sha = createHash('sha256').update(dossier).digest('hex').slice(0, 16);
console.log(
  `Solmar Bay: ${gameFiles.length} game entries, ${shotNames.length} screenshots ` +
    `(${shotBytes} bytes), dossier ${dossier.length} bytes sha256:${sha}`,
);
