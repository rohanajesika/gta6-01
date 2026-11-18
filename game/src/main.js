// Solmar Bay — bootstrap. One job: build every system in order, wire the
// menus and the save, and run the frame loop. Nothing here is game logic;
// the systems own that.
import { CONFIG } from './config.js';
import { makeRng } from './rng.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createWorld } from './world.js';
import { createTraffic } from './traffic.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createEffects } from './effects.js';
import { createHud } from './hud.js';
import { createRender } from './render.js';
import { applyShot, createShotTracker } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shotStage = params.get('shot');

const G = {
  time: 0,
  started: false,
  state: 'title', // title | playing | paused | busted | wasted | story
  seed,
};

// Rendering first: the other systems add meshes to this scene.
G.render = createRender(G);
G.scene = G.render.scene;
G.camera = G.render.camera;
G.rng = makeRng(seed);
G.input = createInput(document.getElementById('game'));
G.audio = createAudio();
G.city = buildCity(G.scene, G.rng);
G.world = createWorld(G.city);
G.effects = createEffects(G);
G.traffic = createTraffic(G);
G.player = createPlayer(G);
G.police = createPolice(G);
G.missions = createMissions(G);
G.combat = createCombat(G);
G.hud = createHud(G);

// ---- Save / load -------------------------------------------------------
function saveGame() {
  try {
    localStorage.setItem(CONFIG.saveKey, JSON.stringify({
      v: 1,
      cash: G.player.cash,
      health: Math.round(G.player.health),
      ammo: G.player.ammo,
      mission: G.missions.index,
      step: G.missions.step,
      x: Math.round(G.player.x * 10) / 10,
      z: Math.round(G.player.z * 10) / 10,
      wanted: G.police.wanted,
    }));
  } catch {
    /* storage unavailable (private mode) — the game still plays */
  }
}
G.saveGame = saveGame;

function readSave() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    return s;
  } catch {
    return null;
  }
}

function loadSave() {
  const s = readSave();
  if (!s) return false;
  if (G.player.inCar) G.player.exitCar();
  G.player.cash = s.cash;
  G.player.health = s.health;
  G.player.ammo = s.ammo;
  G.player.teleport(s.x, s.z);
  G.missions.restore(s.mission, s.step);
  G.police.setWanted(s.wanted, true);
  return true;
}
G.loadSave = loadSave;
G.hasSave = () => readSave() !== null;

// ---- Flow --------------------------------------------------------------
function showOnly(id) {
  for (const name of ['start-screen', 'pause-menu', 'busted-screen', 'wasted-screen', 'story-screen']) {
    document.getElementById(name).classList.toggle('hidden', name !== id);
  }
  document.getElementById('hud').classList.toggle('hidden', id === 'start-screen');
  document.getElementById('crosshair').classList.toggle('hidden', id === 'start-screen');
}

function startGame(fromSave) {
  G.audio.unlock();
  if (fromSave) {
    loadSave();
    G.hud.toast('Save loaded — welcome back to Solmar Bay');
  } else {
    if (G.player.inCar) G.player.exitCar();
    G.player.cash = CONFIG.player.startCash;
    G.player.health = CONFIG.player.maxHealth;
    G.player.ammo = CONFIG.player.startAmmo;
    G.player.teleport(0, 0);
    G.player.heading = Math.PI;
    G.player.camYaw = Math.PI;
    G.police.setWanted(0, true);
    G.missions.startMission(0);
  }
  G.started = true;
  G.state = 'playing';
  showOnly(null);
}

function respawn(cause) {
  if (G.player.inCar) G.player.exitCar();
  const loss = cause === 'busted'
    ? Math.max(50, Math.round(G.player.cash * 0.1))
    : Math.min(150, G.player.cash);
  G.player.cash = Math.max(0, G.player.cash - loss);
  G.player.health = CONFIG.player.maxHealth;
  G.player.teleport(0, 0);
  G.police.setWanted(0, true);
  G.hud.toast(`Back on the streets — lost $${loss}`);
  G.state = 'playing';
  showOnly(null);
}

G.onBusted = () => {
  if (G.state !== 'playing') return;
  G.audio.busted();
  G.audio.setSiren(false);
  G.state = 'busted';
  showOnly('busted-screen');
};
G.onWasted = () => {
  if (G.state !== 'playing') return;
  G.audio.busted();
  G.audio.setSiren(false);
  G.state = 'wasted';
  showOnly('wasted-screen');
};
G.showStoryComplete = (title, text) => {
  document.getElementById('story-title').textContent = title;
  document.getElementById('story-text').textContent = text;
  G.state = 'story';
  showOnly('story-screen');
};

// ---- Menu wiring -------------------------------------------------------
const $ = (id) => document.getElementById(id);
$('btn-start').addEventListener('click', () => startGame(false));
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-resume').addEventListener('click', () => {
  G.state = 'playing';
  showOnly(null);
});
$('btn-save').addEventListener('click', () => {
  saveGame();
  G.hud.toast('Game saved');
});
$('btn-quit').addEventListener('click', () => window.location.reload());
$('btn-busted-continue').addEventListener('click', () => respawn('busted'));
$('btn-wasted-continue').addEventListener('click', () => respawn('wasted'));
$('btn-story-continue').addEventListener('click', () => {
  G.state = 'playing';
  showOnly(null);
});
if (!G.hasSave()) $('btn-continue').classList.add('hidden');

// ---- Frame loop --------------------------------------------------------
const shotTracker = shotStage ? createShotTracker() : null;
let lastNow = performance.now();

function togglePause() {
  if (G.state === 'playing') {
    G.state = 'paused';
    showOnly('pause-menu');
  } else if (G.state === 'paused') {
    G.state = 'playing';
    showOnly(null);
  }
}

function step(dt) {
  G.player.update(dt);
  G.traffic.update(dt);
  G.police.update(dt);
  G.missions.update(dt);
  G.combat.update(dt);
  G.effects.update(dt);
}

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const rawDt = Math.min((now - lastNow) / 1000, 0.33);
  lastNow = now;
  if (G.state === 'playing') {
    G.time += rawDt;
    if (shotStage) {
      // Screenshot staging is a diorama: hold the composed scene still
      // so the frame the driver captures is the one that was staged —
      // no chase, no decay, no mission can fire while the photo is taken.
    } else {
      // Edge-triggered keys, read once per frame.
      if (G.input.pressed('KeyE')) G.player.tryEnterCar();
      if (G.input.pressed('KeyF')) G.combat.shoot();
      if (G.input.pressed('KeyP') || G.input.pressed('Escape')) togglePause();
      if (G.input.pressed('KeyM')) {
        G.audio.setMuted(!G.audio.muted);
        G.hud.toast(G.audio.muted ? 'Sound off' : 'Sound on');
      }
      // Substep the physics so a slow frame never tunnels through a wall.
      let remaining = rawDt;
      while (remaining > 0) {
        const dt = Math.min(remaining, 0.05);
        step(dt);
        remaining -= dt;
      }
    }
    G.hud.update(rawDt);
  } else if (G.state === 'paused') {
    if (G.input.pressed('KeyP') || G.input.pressed('Escape')) togglePause();
  }
  G.render.updateCamera(rawDt);
  G.render.render();
  G.input.endFrame();
  if (shotTracker) shotTracker.tick();
}

// Shot staging runs before the first frame: the scene the driver
// screenshots is already composed when rendering starts.
if (shotStage) {
  G.state = 'playing';
  applyShot(G, shotStage);
  G.started = true;
}

window.__game = G;
window.__shotReady = false;
frame();
