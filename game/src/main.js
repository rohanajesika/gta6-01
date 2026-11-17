// Solmar Bay — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, game over. ?seed=N fixes the city layout;
// ?shot=chase|street|drive|mission stages that scene instead of running the
// loop, paints it and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { STEP, SAVE_KEY, STORY, CONTROLS, skyColor } from './config.js';
import { createRandom } from './rng.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_SHOOT, ACTION_PUNCH, ACTION_RELOAD, ACTION_MUTE } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayer, enterCar, exitCar, nearestCar, recoverPlayer } from './player.js';
import { createTraffic, createPedestrians, updateTraffic, updatePedestrians } from './traffic.js';
import { createPolice, addWanted, spawnCopAt, updatePolice } from './police.js';
import { createCombat, shoot, punch, reload, updateCombat } from './combat.js';
import { createMissions, refreshMarker, updateMissions, startMissionGuards } from './missions.js';
import { createEffects, burst, muzzle, updateEffects, shakeOffset } from './effects.js';
import { createHud, say, setObjective, flashDamage, updateHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = skyColor();
scene.fog = new THREE.Fog(0x9fc8dd, 120, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x5a5148, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(120, 200, 60);
scene.add(sun);

const G = {
  scene, camera, renderer,
  rng: createRandom(seed),
  time: 0,
  screen: 'title',
  started: false,
  camYaw: 0,
  input: createInput(canvas),
  audio: createAudio(),
};
G.city = buildCity(scene, G.rng);
G.traffic = createTraffic(scene, G.rng);
G.peds = createPedestrians(scene, G.rng);
G.player = createPlayer(scene, 0, 6);
G.police = createPolice(scene);
G.combat = createCombat(scene);
G.missions = createMissions();
G.effects = createEffects(scene);
G.hud = createHud();

// Wire the cross-module calls so each module talks through G.
G.police.addWanted = (stars, reason) => addWanted(G, stars, reason);
G.police.spawnCopAt = (g, x, z, heading) => spawnCopAt(g, x, z, heading);
G.effects.burst = (x, y, z, color, count) => burst(G, x, y, z, color, count);
G.effects.muzzle = (x, y, z) => muzzle(G, x, y, z);
G.hud.say = (text) => say(G, text);
G.hud.setObjective = (text) => setObjective(G, text);
G.hud.flashDamage = () => flashDamage(G);
G.player.exitCar = () => exitCar(G);

// Remember where every car started so a restart can put the city back.
for (const car of G.traffic.cars) {
  car.home = { x: car.x, z: car.z, heading: car.heading, parked: car.parked };
}

// Mission beacon: a tall pulsing column over the current objective.
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
);
beacon.visible = false;
scene.add(beacon);
const beaconTop = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.4),
  new THREE.MeshBasicMaterial({ color: 0xffe066 }),
);
beaconTop.visible = false;
scene.add(beaconTop);

function announce(message) {
  statusEl.textContent = message;
}

function saveGame() {
  try {
    const p = G.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: p.cash, health: p.health, ammo: p.ammo, reserveAmmo: p.reserveAmmo,
      missionIndex: G.missions.index, missionStep: G.missions.step,
      x: p.x, z: p.z, wanted: G.police.wanted,
    }));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}
G.saveGame = saveGame;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function applySave(save) {
  const p = G.player;
  p.cash = save.cash;
  p.health = save.health;
  p.ammo = save.ammo;
  p.reserveAmmo = save.reserveAmmo;
  G.missions.index = save.missionIndex;
  G.missions.step = save.missionStep;
  G.missions.done = G.missions.index >= 3;
  G.police.wanted = save.wanted || 0;
  p.x = save.x;
  p.z = save.z;
  p.mesh.position.set(p.x, 0, p.z);
  refreshMarker(G);
}

function resetWorld() {
  const p = G.player;
  if (p.inCar) exitCar(G);
  p.x = 0; p.z = 6; p.heading = 0; p.camYaw = 0;
  p.health = 100; p.cash = 120; p.ammo = 24; p.reserveAmmo = 48;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.visible = true;
  for (const car of G.traffic.cars) {
    car.x = car.home.x; car.z = car.home.z; car.heading = car.home.heading;
    car.parked = car.home.parked; car.speed = 0; car.removed = false;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.mesh.visible = true;
  }
  for (const car of [...G.police.cars]) {
    scene.remove(car.mesh);
  }
  G.police.cars.length = 0;
  G.police.wanted = 0;
  G.police.quietTimer = 0;
  G.police.bustTimer = 0;
  for (const g of [...G.combat.guards]) scene.remove(g.mesh);
  G.combat.guards.length = 0;
  for (const pd of G.peds.peds) {
    pd.alive = true;
    pd.mesh.visible = true;
    pd.panic = 0;
  }
  G.missions.index = 0;
  G.missions.step = 0;
  G.missions.done = false;
  refreshMarker(G);
}

function endGame(reason) {
  if (G.screen !== 'play') return;
  G.screen = 'over';
  G.audio.setEngine(0, false);
  G.audio.setSiren(false, 0);
  const over = document.getElementById('over-screen');
  document.getElementById('over-title').textContent = reason === 'busted' ? 'BUSTED!' : 'WASTED!';
  document.getElementById('over-text').textContent =
    reason === 'busted'
      ? 'The Solmar police caught Danny. The Marlin crew will not wait forever.'
      : 'Danny did not make it. Solmar Bay keeps its secrets.';
  document.getElementById('hud').classList.add('hidden');
  over.classList.remove('hidden');
  announce(reason === 'busted' ? 'Busted by the police.' : 'Wasted.');
}
G.endGame = endGame;

function startGame(fromSave) {
  resetWorld();
  if (fromSave) {
    const save = readSave();
    if (save) applySave(save);
  }
  G.screen = 'play';
  G.started = true;
  G.audio.unlock();
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  say(G, STORY.missions[G.missions.index]?.brief || STORY.intro);
  announce('Playing Solmar Bay.');
}

function stepWorld(dt, quiet) {
  G.time += dt;
  if (G.screen === 'play' || quiet) {
    updatePlayer(G, dt, G.input);
    recoverPlayer(G, dt);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    updateCombat(G, dt);
    updateMissions(G);
    startMissionGuards(G);
    updateEffects(G, dt);
  }
}
G.stepWorld = stepWorld;

function followCamera(dt) {
  const p = G.player;
  // Desired camera yaw: behind the car when driving, behind the look
  // direction on foot. Smooth it so turns do not snap.
  const want = p.inCar && p.car ? p.car.heading + Math.PI : p.camYaw;
  let diff = want - G.camYaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  G.camYaw += diff * Math.min(1, dt * 6);
  const dist = p.inCar ? 13 : 9;
  const height = p.inCar ? 5 : 3.6;
  const fx = -Math.sin(G.camYaw);
  const fz = -Math.cos(G.camYaw);
  const shake = shakeOffset(G);
  camera.position.set(
    p.x - fx * dist + shake.x,
    height + shake.y,
    p.z - fz * dist,
  );
  camera.lookAt(p.x + fx * 4, 1.6, p.z + fz * 4);
}

function renderFrame(dt) {
  followCamera(dt);
  if (G.missions.marker) {
    beacon.visible = true;
    beaconTop.visible = true;
    beacon.position.set(G.missions.marker.x, 30, G.missions.marker.z);
    beacon.material.opacity = 0.25 + 0.15 * Math.sin(G.time * 3);
    beaconTop.position.set(G.missions.marker.x, 4 + Math.sin(G.time * 2) * 0.6, G.missions.marker.z);
    beaconTop.rotation.y += dt;
  } else {
    beacon.visible = false;
    beaconTop.visible = false;
  }
  updateHud(G, dt);
  renderer.render(scene, camera);
}

function handleActions() {
  const actions = G.input.takeActions();
  if (actions & ACTION_MUTE) {
    G.audio.setMuted(!G.audio.isMuted());
    say(G, G.audio.isMuted() ? 'Sound muted.' : 'Sound on.');
  }
  if (G.screen === 'title' || G.screen === 'over') {
    if (actions & ACTION_CONFIRM) startGame(false);
    return;
  }
  if (actions & ACTION_PAUSE) {
    if (G.screen === 'play') {
      G.screen = 'paused';
      document.getElementById('pause-menu').classList.remove('hidden');
      announce('Paused.');
    } else if (G.screen === 'paused') {
      G.screen = 'play';
      document.getElementById('pause-menu').classList.add('hidden');
      announce('Playing.');
    }
    return;
  }
  if (G.screen !== 'play') return;
  if (actions & ACTION_ENTER) {
    if (G.player.inCar) exitCar(G);
    else {
      const car = nearestCar(G.player, G.traffic.cars);
      if (car) enterCar(G, car);
    }
  }
  if (actions & ACTION_SHOOT) shoot(G);
  if (actions & ACTION_PUNCH) punch(G);
  if (actions & ACTION_RELOAD) reload(G);
}

function runShot(name) {
  stageShot(name, G);
  let painted = 0;
  function paint() {
    G.time += 1 / 60;
    renderFrame(1 / 60);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const save = readSave();
  const btnContinue = document.getElementById('btn-continue');
  if (save) btnContinue.classList.remove('hidden');
  else btnContinue.classList.add('hidden');
  document.getElementById('btn-start').addEventListener('click', () => { G.audio.unlock(); startGame(false); });
  btnContinue.addEventListener('click', () => { G.audio.unlock(); startGame(true); });
  document.getElementById('btn-resume').addEventListener('click', () => {
    G.screen = 'play';
    document.getElementById('pause-menu').classList.add('hidden');
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    saveGame();
    say(G, 'Game saved.');
  });
  document.getElementById('btn-restart').addEventListener('click', () => startGame(false));
  document.getElementById('btn-again').addEventListener('click', () => startGame(false));
  document.getElementById('btn-title').addEventListener('click', () => {
    G.screen = 'title';
    document.getElementById('over-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
  });
  refreshMarker(G);

  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (G.screen === 'play') {
      while (accumulator >= STEP) {
        stepWorld(STEP, false);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      if (G.screen === 'title') {
        // Idle attract mode: slow orbit around downtown.
        G.time += 1 / 60;
        camera.position.set(Math.sin(G.time * 0.05) * 90, 42, Math.cos(G.time * 0.05) * 90);
        camera.lookAt(0, 4, 0);
      }
    }
    if (G.screen !== 'title') renderFrame(1 / 60);
    else renderer.render(scene, camera);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') {
      G.screen = 'paused';
      document.getElementById('pause-menu').classList.remove('hidden');
      announce('Paused.');
    }
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  announce('Solmar Bay. Press Space or click Start to play.');
  requestAnimationFrame(frame);
}

// Exposed for playtesting and screenshots (not part of the game itself).
window.__game = G;
window.__game.started = false;

if (shot) runShot(shot);
else runGame();
