// Minimal Chrome DevTools Protocol helper for Solmar Bay's own tooling.
// Node 22+ ships a global WebSocket, so no dependency is needed: launch
// headless Chromium with --remote-debugging-port, connect, and drive it.
import { spawn } from 'node:child_process';

export const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wait until the DevTools HTTP endpoint answers.
export async function waitForDevTools(port, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      // Not up yet.
    }
    await sleep(250);
  }
  throw new Error(`DevTools did not answer on port ${port}`);
}

export function launchChrome(port, userDataDir) {
  const child = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--window-size=1280,800',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });
  return child;
}

// Connect to a fresh page target and return a small CDP client whose
// send() talks to that page's session.
export async function connectPage(port) {
  const version = await waitForDevTools(port);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  const client = { consoleMessages: [], exceptions: [] };

  function noteEvent(method, params) {
    for (const fn of listeners) fn(method, params);
    if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      client.consoleMessages.push(params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (method === 'Runtime.exceptionThrown') {
      client.exceptions.push(params.exceptionDetails?.text ?? JSON.stringify(params.exceptionDetails));
    }
    if (method === 'Log.entryAdded' && params.entry.level === 'error') {
      client.consoleMessages.push(`${params.entry.text} ${params.entry.url ?? ''}`);
    }
  }

  // Browser-level send (used once, to create and attach the target).
  function browserSend(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      noteEvent(msg.method, msg.params);
    }
  };

  const target = await browserSend('Target.createTarget', { url: 'about:blank' });
  const session = await browserSend('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const sessionId = session.sessionId;

  // From here, send() speaks to the page session. In flat mode the
  // browser routes a message by the sessionId field carried on the
  // message itself — Target.sendMessageToTarget is rejected.
  client.send = (method, params = {}) => {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  };

  client.onEvent = (fn) => listeners.push(fn);
  client.eval = async (expression) => {
    const res = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(`page eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    return res.result?.value;
  };
  client.waitFor = async (expression, timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const value = await client.eval(expression);
        if (value) return value;
      } catch {
        // Page still loading.
      }
      await sleep(250);
    }
    throw new Error(`timed out waiting for: ${expression}`);
  };
  client.close = () => ws.close();
  return client;
}
