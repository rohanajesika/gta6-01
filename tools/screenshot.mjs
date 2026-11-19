// Take Solmar Bay's screenshots: serve game/, open each ?shot= URL in
// headless Chromium, wait for the scene to settle, and capture a JPEG.
// Usage: node tools/screenshot.mjs [--port 8091]
// Reads shots.json, writes screenshots/, and reports console errors.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectPage, launchChrome, sleep } from './cdp.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '..');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const httpPort = portIndex === -1 ? 8091 : Number(args[portIndex + 1]);
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));

mkdirSync(join(root, 'screenshots'), { recursive: true });

// Serve game/ with the entry's own server.
const server = spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(httpPort)], {
  cwd: root, stdio: 'ignore',
});
await sleep(1500);

const chrome = launchChrome(9223, '/tmp/solmar-shots-profile');
const client = await connectPage(9223);
await client.send('Page.enable');
await client.send('Runtime.enable');
await client.send('Log.enable');

let failures = 0;
for (const shot of shots) {
  const url = `http://127.0.0.1:${httpPort}/index.html${shot.query}`;
  console.log(`shot ${shot.name} <- ${url}`);
  await client.send('Page.navigate', { url });
  try {
    await client.waitFor(`window.__solmarShot === 'ready'`, 120000);
  } catch (err) {
    console.log(`  TIMEOUT waiting for scene: ${err.message}`);
    failures += 1;
  }
  await sleep(400);
  const res = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  const buf = Buffer.from(res.data, 'base64');
  writeFileSync(join(root, 'screenshots', shot.name), buf);
  console.log(`  wrote ${shot.name} (${buf.length} bytes)`);
}
// The browser's automatic favicon.ico request 404s — it is not a game
// reference and the game never asks for it, so it is not an error here.
const realErrors = client.consoleMessages.filter((m) => !m.includes('favicon.ico'));
console.log(`console errors: ${realErrors.length}`);
for (const m of realErrors) console.log(`  ERROR: ${m}`);
console.log(`exceptions: ${client.exceptions.length}`);
for (const m of client.exceptions) console.log(`  EXCEPTION: ${m}`);
if (realErrors.length > 0 || client.exceptions.length > 0) failures += 1;

client.close();
chrome.kill('SIGKILL');
server.kill('SIGKILL');
process.exit(failures === 0 ? 0 : 1);
