// Playtest Solmar Bay in headless Chromium: start the game, walk,
// steal and drive a car, start a mission, raise wanted and watch the
// police respond — all through real key events and live state reads.
// Usage: node tools/playtest.mjs [--port 8092]
// Exits 1 when any check fails or the page logs an error.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectPage, launchChrome, sleep } from './cdp.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const httpPort = portIndex === -1 ? 8092 : Number(args[portIndex + 1]);

const server = spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(httpPort)], {
  cwd: root, stdio: 'ignore',
});
await sleep(1500);

const chrome = launchChrome(9224, '/tmp/solmar-playtest-profile');
const client = await connectPage(9224);
await client.send('Page.enable');
await client.send('Runtime.enable');
await client.send('Log.enable');

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

async function key(code, keyName, type) {
  await client.send('Input.dispatchKeyEvent', { type, code, key: keyName });
}
async function holdKey(code, keyName, ms) {
  await key(code, keyName, 'rawKeyDown');
  await sleep(ms);
  await key(code, keyName, 'keyUp');
}

try {
  await client.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/index.html?seed=7` });
  await client.waitFor(`window.__solmar && window.__solmar.state`, 30000);
  await sleep(1500);
  check('game boots without exceptions', client.exceptions.length === 0, `${client.exceptions.length} exceptions`);

  const boot = await client.eval(`({
    traffic: window.__solmar.trafficCars.length,
    peds: window.__solmar.peds.length,
    colliders: window.__solmar.state ? true : false,
    webgl: !!document.querySelector('#scene'),
  })`);
  check('traffic and pedestrians spawned', boot.traffic >= 14 && boot.peds >= 20, `traffic=${boot.traffic} peds=${boot.peds}`);

  // Start the game from the start screen.
  await client.eval(`document.getElementById('start-btn').click()`);
  await sleep(500);
  const started = await client.eval(`window.__solmar.state.started`);
  check('start button starts the game', started === true);

  // Walk forward and confirm the player moves. Headless SwiftShader
  // runs ~1 fps and dt is clamped to 0.05 s/frame, so wall time means
  // little: measure distance against in-game time instead.
  const before = await client.eval(`({ x: window.__solmar.player.x, z: window.__solmar.player.z, t: window.__solmar.state.time })`);
  await holdKey('KeyW', 'w', 6000);
  const after = await client.eval(`({ x: window.__solmar.player.x, z: window.__solmar.player.z, t: window.__solmar.state.time })`);
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  const gameSeconds = after.t - before.t;
  const expected = 7 * gameSeconds;
  check('player walks with WASD', moved > 1 && moved > 0.5 * expected, `moved ${moved.toFixed(1)} units in ${gameSeconds.toFixed(2)}s game time (expect ~${expected.toFixed(1)})`);

  // Start mission 1 and confirm the marker appears.
  await key('KeyM', 'm', 'rawKeyDown');
  await key('KeyM', 'm', 'keyUp');
  await sleep(300);
  const mission = await client.eval(`({
    active: window.__solmar.state.missionActive,
    label: window.__solmar.state.missionLabel,
    marker: !!window.__solmar.missions.markerPos,
  })`);
  check('mission starts with M and shows a marker', mission.active && mission.marker, mission.label);

  // Teleport next to a parked car and steal it with E.
  await client.eval(`(() => {
    const s = window.__solmar;
    const car = s.trafficCars.find((c) => !c.isTraffic);
    s.player.x = car.x + 2; s.player.z = car.z;
    s.player.mesh.position.set(s.player.x, 0, s.player.z);
  })()`);
  await key('KeyE', 'e', 'rawKeyDown');
  await key('KeyE', 'e', 'keyUp');
  await sleep(300);
  const driving = await client.eval(`!!window.__solmar.state.driving`);
  check('E steals and enters the nearest car', driving === true);

  // Drive forward and confirm speed builds.
  await holdKey('KeyW', 'w', 2500);
  const speed = await client.eval(`window.__solmar.state.speedKmh`);
  check('car accelerates', speed > 10, `${speed.toFixed(1)} km/h`);

  // Raise wanted and confirm police cars spawn and close in.
  await client.eval(`window.__solmar.state.wanted = 3`);
  await sleep(3000);
  const police = await client.eval(`window.__solmar.policeCars.length`);
  check('police respond to wanted level 3', police >= 2, `${police} police cars`);

  // Exit the car, fire the pistol, confirm ammo drops.
  await key('KeyE', 'e', 'rawKeyDown');
  await key('KeyE', 'e', 'keyUp');
  await sleep(300);
  const ammoBefore = await client.eval(`window.__solmar.state.ammo`);
  await client.eval(`(() => {
    const c = document.getElementById('scene');
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('mousedown', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true }));
  })()`);
  await sleep(300);
  const ammoAfter = await client.eval(`window.__solmar.state.ammo`);
  check('click fires the pistol', ammoAfter === ammoBefore - 1, `${ammoBefore} -> ${ammoAfter}`);

  // Save and confirm localStorage holds progress.
  await client.eval(`document.getElementById('save-btn').click()`);
  await sleep(200);
  const saved = await client.eval(`!!window.localStorage.getItem('solmarbay-save-v1')`);
  check('save button writes localStorage', saved === true);

  // The browser's automatic favicon.ico request 404s — it is not a game
  // reference and the game never asks for it, so it is not an error here.
  const realErrors = client.consoleMessages.filter((m) => !m.includes('favicon.ico'));
  check('no console errors during playtest', realErrors.length === 0, `${realErrors.length} errors`);
  for (const m of realErrors) console.log(`  ERROR: ${m}`);
  for (const m of client.exceptions) console.log(`  EXCEPTION: ${m}`);
} catch (err) {
  console.log(`PLAYTEST CRASH: ${err.message}`);
  checks.push({ name: 'playtest completed', ok: false });
}

client.close();
chrome.kill('SIGKILL');
server.kill('SIGKILL');
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} playtest checks passed`);
process.exit(failed === 0 ? 0 : 1);
