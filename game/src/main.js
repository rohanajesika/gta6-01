// Solmar Bay — entry point. Builds the renderer, the city and every
// actor, then runs the frame loop: input, movement, traffic, police,
// missions, combat and the HUD, in that order, every frame.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { mulberry32, seedFromUrl, pick } from './rng.js';
import { createState, addWanted, setMessage, saveGame, loadGame, applySave } from './state.js';
import { buildCity, resolveCollisions, clampToCity } from './city.js';
import {
  makeCar, makePlayerMesh, createPlayer, movePlayer,
  spawnPedestrians, updatePedestrians, spawnTraffic, updateTraffic,
  spawnPoliceCar, updatePoliceCar, driveCar,
} from './actors.js';
import { shoot, punch, stealCar, checkRunOver, updateWanted, bustPlayer } from './combat.js';
import {
  createMissionManager, startMission, updateMissions, updateRivals,
} from './missions.js';
import { drawMinimap, updateHud, showScreen, setOverText, bindMenus } from './hud.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(window.location.search);
const seed = seedFromUrl();
const rng = mulberry32(seed);
const state = createState();
const audio = createAudio();

// ---------------------------------------------------------------- scene
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 120, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 6, 12);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a6a45, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2cc, 2.0);
sun.position.set(120, 180, 60);
scene.add(sun);

const { colliders, parkingSpots } = buildCity(scene, rng);
const player = createPlayer(scene, -44, -18);
const peds = spawnPedestrians(scene, rng, CFG.PEDESTRIANS);
const trafficCars = spawnTraffic(scene, rng, CFG.TRAFFIC_CARS, parkingSpots);
const policeCars = [];
const officers = []; // foot officers who chase the player when wanted
const missions = createMissionManager(scene, state);
let camYaw = Math.PI; // behind the player, looking north
let camPitch = 0.32;

// ---------------------------------------------------------------- HUD elements
const els = {
  cash: document.getElementById('cash'),
  healthFill: document.getElementById('health-fill'),
  ammo: document.getElementById('ammo'),
  mission: document.getElementById('mission'),
  stars: document.getElementById('stars'),
  speed: document.getElementById('speed'),
  speedLabel: document.getElementById('speed-box'),
  toast: document.getElementById('toast'),
  hint: document.getElementById('hint'),
  start: document.getElementById('start-screen'),
  pause: document.getElementById('pause-screen'),
  over: document.getElementById('over-screen'),
  overTitle: document.getElementById('over-title'),
  overDetail: document.getElementById('over-detail'),
  startBtn: document.getElementById('start-btn'),
  resumeBtn: document.getElementById('resume-btn'),
  restartBtn: document.getElementById('restart-btn'),
  saveBtn: document.getElementById('save-btn'),
};
const minimapCanvas = document.getElementById('minimap');

// ---------------------------------------------------------------- input
const input = { forward: false, back: false, left: false, right: false, run: false };
const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};
let dragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] !== undefined) {
    input[KEYMAP[e.code]] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code === 'KeyF') doPunch();
  if (e.code === 'KeyM') startNextMission();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyS' && !e.repeat) doSave();
  if (e.code === 'KeyR' && !e.repeat) state.ammo = CFG.PISTOL_AMMO;
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
});
canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  audio.unlock();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastMouseX) * 0.005;
  camPitch = Math.max(0.08, Math.min(0.9, camPitch + (e.clientY - lastMouseY) * 0.003));
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});
window.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  // A short click (not a drag) fires the pistol while on foot.
  if (Math.abs(e.clientX - lastMouseX) < 4 && Math.abs(e.clientY - lastMouseY) < 4) {
    doShoot();
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- actions
function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of trafficCars) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function tryEnterExitCar() {
  if (!state.started || state.paused || state.over) return;
  audio.unlock();
  if (state.driving) {
    const car = state.driving;
    state.driving = null;
    player.x = car.x + Math.sin(car.angle + Math.PI / 2) * 3;
    player.z = car.z + Math.cos(car.angle + Math.PI / 2) * 3;
    clampToCity(player);
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.visible = true;
    return;
  }
  const car = nearestCar(4.5);
  if (!car) return;
  stealCar(state, car, peds);
  state.driving = car;
  player.mesh.visible = false;
  audio.pickup();
}

function doShoot() {
  if (!state.started || state.paused || state.over || state.driving) return;
  const result = shoot(
    state, scene, camera, peds, missions.rivals, policeCars, trafficCars,
    (hit, kind) => {
      if (kind === 'shot') audio.shot();
      else audio.emptyClick();
      void hit;
    },
  );
  void result;
}

function doPunch() {
  if (!state.started || state.paused || state.over || state.driving) return;
  if (punch(state, player, peds, missions.rivals)) audio.punch();
}

function startNextMission() {
  if (!state.started || state.paused || state.over || state.missionActive) return;
  if (state.missionIndex >= 5) {
    setMessage(state, 'Story complete — Solmar Bay is yours. Free roam!', 4);
    return;
  }
  startMission(missions, state.missionIndex);
  audio.chime();
}

function togglePause() {
  if (!state.started || state.over) return;
  state.paused = !state.paused;
  showScreen(els, state.paused ? 'pause' : 'none');
}

function doSave() {
  if (!state.started) return;
  if (saveGame(state)) setMessage(state, 'Progress saved', 2);
}

function gameOver(reason) {
  if (reason === 'busted') {
    bustPlayer(state);
    setOverText(els, 'Busted', 'The Bay Police caught up with you. $200 bail — back to the streets.');
  } else {
    state.over = true;
    state.overReason = 'wasted';
    setOverText(els, 'Wasted', 'Mara went down in Solmar Bay. The city keeps moving.');
  }
  showScreen(els, 'over');
}

function respawn() {
  state.over = false;
  state.overReason = '';
  state.health = CFG.PLAYER_HEALTH;
  state.wanted = 0;
  state.quietTimer = 0;
  state.driving = null;
  player.x = -44;
  player.z = -18;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  for (const car of policeCars) scene.remove(car.mesh);
  policeCars.length = 0;
  for (const o of officers) scene.remove(o.mesh);
  officers.length = 0;
  showScreen(els, 'none');
}

// ---------------------------------------------------------------- police
function ensurePolice(dt) {
  const want = state.wanted > 0 ? Math.min(state.wanted, 3) : 0;
  while (policeCars.length < want) {
    const angle = rng() * Math.PI * 2;
    const x = player.x + Math.sin(angle) * 70;
    const z = player.z + Math.cos(angle) * 70;
    policeCars.push(spawnPoliceCar(scene, Math.max(-190, Math.min(190, x)), Math.max(-190, Math.min(190, z))));
  }
  while (policeCars.length > want) {
    const car = policeCars.pop();
    scene.remove(car.mesh);
  }
  // Foot officers join the chase at two stars and above, on foot only.
  if (state.wanted >= 2 && !state.driving && officers.length < 2) {
    const mesh = makePlayerMesh();
    mesh.traverse((child) => {
      if (child.isMesh && child.geometry && child.geometry.parameters && child.geometry.parameters.width === 0.8) {
        child.material = child.material.clone();
        child.material.color.setHex(0x1a2a4a);
      }
    });
    const angle = rng() * Math.PI * 2;
    mesh.position.set(player.x + Math.sin(angle) * 25, 0, player.z + Math.cos(angle) * 25);
    scene.add(mesh);
    officers.push({ mesh, x: mesh.position.x, z: mesh.position.z, speed: 6.5 });
  }
  if (state.wanted < 2) {
    for (const o of officers) scene.remove(o.mesh);
    officers.length = 0;
  }
  void dt;
}

function updateOfficers(dt) {
  for (const o of officers) {
    const dx = player.x - o.x;
    const dz = player.z - o.z;
    const dist = Math.hypot(dx, dz);
    if (dist < CFG.BUST_DISTANCE) {
      gameOver('busted');
      return;
    }
    if (dist > 0.01) {
      o.x += (dx / dist) * o.speed * dt;
      o.z += (dz / dist) * o.speed * dt;
      o.mesh.rotation.y = Math.atan2(dx, dz);
    }
    o.mesh.position.set(o.x, 0, o.z);
  }
}

// ---------------------------------------------------------------- camera
function updateCamera(dt) {
  const target = state.driving
    ? { x: state.driving.x, z: state.driving.z, angle: state.driving.angle }
    : { x: player.x, z: player.z, angle: player.angle };
  const dist = state.driving ? 13 : 9.5;
  const height = state.driving ? 5.5 : 4.2;
  // Camera sits behind the facing direction, eased by the mouse orbit.
  const lookYaw = state.driving ? target.angle + Math.PI + (camYaw - Math.PI) * 0.4 : camYaw;
  const cx = target.x + Math.sin(lookYaw) * dist;
  const cz = target.z + Math.cos(lookYaw) * dist;
  const want = new THREE.Vector3(cx, height + Math.sin(camPitch) * 4, cz);
  camera.position.lerp(want, Math.min(1, dt * 5));
  camera.lookAt(target.x, 1.6, target.z);
}

// ---------------------------------------------------------------- shot staging
// ?shot=cover|drive|chase|mission stages a real game state (same code
// paths as play) so the screenshots show the finished game, and sets
// window.__solmarShot when the scene has settled.
function stageShot(kind) {
  state.started = true;
  showScreen(els, 'none');
  if (kind === 'cover') {
    // On Coral Row itself (road x=-88), facing the parked coupe and
    // the mission beacon up the street — never inside a building block.
    // The player stands a little off the centre line so the coupe
    // reads beside them instead of hiding behind them.
    player.x = -85; player.z = 14;
    player.angle = 0;
    player.mesh.rotation.y = 0;
    startMission(missions, 0);
    camYaw = Math.PI;
  } else if (kind === 'drive') {
    const car = trafficCars.find((c) => !c.isTraffic) || trafficCars[0];
    state.driving = car;
    player.mesh.visible = false;
    car.x = 0; car.z = -60; car.angle = 0; car.speed = 18;
    car.mesh.position.set(car.x, 0, car.z);
    camYaw = Math.PI;
  } else if (kind === 'chase') {
    // Mid-block on the north boulevard (road x=0), police already
    // closing in behind — the chase reads in one frame.
    const car = trafficCars.find((c) => !c.isTraffic) || trafficCars[0];
    state.driving = car;
    player.mesh.visible = false;
    car.x = 0; car.z = -40; car.angle = 0; car.speed = 22;
    car.mesh.position.set(car.x, 0, car.z);
    state.wanted = 3;
    policeCars.push(spawnPoliceCar(scene, 4, -72));
    policeCars.push(spawnPoliceCar(scene, -4, -82));
    camYaw = Math.PI;
    setMessage(state, 'Wanted — 3 stars', 5);
  } else if (kind === 'mission') {
    player.x = 44; player.z = 160;
    state.missionIndex = 3;
    startMission(missions, 3);
    camYaw = Math.PI * 1.15;
  }
  player.mesh.position.set(player.x, 0, player.z);
  state.playerX = player.x;
  state.playerZ = player.z;
}

// ---------------------------------------------------------------- menus
bindMenus(els, {
  onStart: () => {
    audio.unlock();
    state.started = true;
    showScreen(els, 'none');
    const save = loadGame();
    if (save) {
      applySave(state, save);
      setMessage(state, `Welcome back — save loaded ($${state.cash}, ${state.missionsDone} jobs done)`, 5);
    }
    setMessage(state, 'Press M to start your first job from Delia', 5);
  },
  onResume: () => { state.paused = false; showScreen(els, 'none'); },
  onRestart: () => respawn(),
  onSave: () => doSave(),
});

// ---------------------------------------------------------------- main loop
let last = performance.now();
const shotKind = params.get('shot');
if (shotKind) stageShot(shotKind);

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;

  if (state.started && !state.paused && !state.over) {
    state.time += dt;
    state.playerX = player.x;
    state.playerZ = player.z;

    if (state.driving) {
      // Staged driving shots cruise on their own so the car is moving
      // when the screenshot is taken; real play still needs the key.
      const driveInput = (shotKind === 'drive' || shotKind === 'chase')
        ? { ...input, forward: true }
        : input;
      driveCar(state.driving, driveInput, dt, colliders);
      checkRunOver(state, state.driving, peds);
      state.speedKmh = Math.abs(state.driving.speed) * 3.6;
      player.x = state.driving.x;
      player.z = state.driving.z;
    } else {
      movePlayer(player, input, camYaw, dt, colliders, state);
      state.speedKmh = 0;
    }

    updateTraffic(trafficCars, dt, state.driving);
    updatePedestrians(peds, player, dt, colliders);
    updateWanted(state, dt);
    updateMissions(missions, player, dt);
    updateRivals(missions, player, dt);
    ensurePolice(dt);
    for (const car of policeCars) {
      updatePoliceCar(car, player.x, player.z, dt, colliders);
      // A police ram at speed hurts the player and their car.
      if (Math.hypot(car.x - player.x, car.z - player.z) < 3.2) {
        state.health -= 22 * dt;
        if (state.driving) state.driving.speed *= 0.98;
      }
    }
    updateOfficers(dt);

    // Slow health regen while the heat is off.
    if (state.wanted === 0 && state.health < CFG.PLAYER_HEALTH) {
      state.health = Math.min(CFG.PLAYER_HEALTH, state.health + 1.2 * dt);
    }
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.health <= 0 && !state.over) gameOver('wasted');

    audio.setDriving(state.speedKmh, state.wanted);
  }

  // The mission beacon pulses so it reads from across the city.
  if (missions.marker) {
    missions.marker.material.opacity = 0.28 + 0.12 * Math.sin(now / 300);
    missions.marker.rotation.y += dt * 0.4;
  }
  updateCamera(dt);
  updateHud(state, els);
  if (state.started) {
    drawMinimap(minimapCanvas, state, player, policeCars, trafficCars, missions.markerPos);
  }
  renderer.render(scene, camera);

  if (shotKind && state.time > 1.5) window.__solmarShot = 'ready';
}

requestAnimationFrame(frame);

// Expose the live game for playtesting and debugging.
window.__solmar = { state, player, trafficCars, peds, policeCars, missions, seed };
