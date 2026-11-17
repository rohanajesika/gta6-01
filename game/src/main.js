// Solmar Bay — an original open-world crime game. Entry point and game loop.
import * as THREE from 'three';
import { WORLD, PLAYER, MISSIONS, SAVE_KEY, clamp, lerp, dist2d, angleLerp } from './config.js';
import { makeRng } from './rng.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { buildCity, collideCircle } from './city.js';
import { makeCar, driveCar, randomCarColor } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { Effects } from './effects.js';
import { stageShot, shotTick } from './shots.js';

const SEED = 20261117;

function makePlayerMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf1c27d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), shirt);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.72;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.56), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  cap.position.y = 1.92;
  g.add(cap);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), shirt);
  armL.position.set(-0.42, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.24), pants);
  legL.position.set(-0.15, 0.33, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  g.add(legR);
  g.userData = { armL, armR, legL, legR };
  return g;
}

export function createGame() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0x9fc8e8, 180, 520);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 30, 60);

  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbfd9ee, 1.1));
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.7);
  scene.add(hemi);

  const rng = makeRng(SEED);
  const G = {
    scene, camera, renderer, rng,
    audio: new AudioEngine(),
    input: new Input(canvas),
    fx: null, hud: null, traffic: null, police: null, missions: null, combat: null,
    city: null, cars: [],
    started: false, paused: false, muted: false, autoDrive: false,
    time: 0, crashShake: 0, storyShown: false,
    player: null, taxi: null, missionCar: null,
  };
  G.fx = new Effects(scene);
  G.hud = new Hud();
  G.city = buildCity(scene, rng);
  G.traffic = new Traffic(scene, G.city.colliders, rng);
  G.police = new Police(scene, G.city.colliders);
  G.missions = new Missions(scene);
  G.combat = new Combat(scene);

  // Player.
  const mesh = makePlayerMesh();
  mesh.position.set(-30, 0, 30);
  scene.add(mesh);
  const player = {
    mesh, x: -30, z: 30, yaw: 0, camYaw: 0, camPitch: 0.32,
    health: PLAYER.health, cash: PLAYER.startCash, ammo: PLAYER.startAmmo,
    inCar: false, car: null, moveSpeed: 0, walkPhase: 0,
    crashShake: 0, onCrime: null,
  };
  player.enterCar = (car) => enterCar(G, car);
  player.exitCar = () => exitCar(G);
  G.player = player;
  player.onCrime = () => {};

  // Hero cars: a yellow taxi and the red Comet for mission 2.
  G.taxi = makeCar(scene, { x: -6, z: 0, yaw: Math.PI / 2, color: 0xf1c40f, kind: 'taxi', name: 'Taxi' });
  G.missionCar = makeCar(scene, { x: 60, z: 5.6, yaw: Math.PI / 2, color: 0xc0392b, name: 'Comet' });
  G.missions.targetCar = G.missionCar;
  G.cars.push(G.taxi, G.missionCar);

  // Street life: moving traffic, parked cars, pedestrians.
  G.traffic.spawnCars(9);
  G.traffic.spawnParked(10, [[60, 0], [-6, 0], [-30, 30]]);
  G.traffic.spawnPeds(16);
  G.cars.push(...G.traffic.cars);

  wireUI(G);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.__game = G;
  window.__shotReady = false;

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) stageShot(G, shot);

  let lastT = performance.now();
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    if (!G.paused) {
      G.time += dt;
      update(G, dt);
    }
    renderer.render(scene, camera);
    shotTick(G);
  }
  loop();
  return G;
}

function enterCar(G, car) {
  const p = G.player;
  if (p.inCar || !car) return;
  if (car.driver === 'traffic') {
    car.driver = null;
    car.isTraffic = false;
    car.parked = false;
    G.police.addHeat(40, 'carjack');
    G.hud.toast('You jacked the car! The driver ran off.');
    G.audio.honk();
  } else if (car.parked || car.driver === null) {
    if (car !== G.taxi && car !== G.missionCar) {
      G.police.addHeat(25, 'theft');
      G.hud.toast('You stole the car!');
    }
  }
  car.isPlayer = true;
  car.driver = 'player';
  p.inCar = true;
  p.car = car;
  p.mesh.visible = false;
  G.audio.engineStart();
}

function exitCar(G) {
  const p = G.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  car.isPlayer = false;
  car.driver = null;
  car.speed = 0;
  const side = Math.cos(car.yaw) >= 0 ? 1 : -1;
  p.x = car.x + Math.cos(car.yaw) * 2.2 * side;
  p.z = car.z - Math.sin(car.yaw) * 2.2 * side;
  p.x = clamp(p.x, -WORLD.half, WORLD.half);
  p.z = clamp(p.z, -WORLD.half, WORLD.half);
  p.yaw = car.yaw;
  p.camYaw = car.yaw;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.yaw;
  p.mesh.visible = true;
  p.inCar = false;
  p.car = null;
  G.audio.engineSet(0, false);
}

function nearestCar(G, maxD) {
  const p = G.player;
  let best = null, bestD = maxD;
  for (const car of G.cars) {
    if (car.isPolice) continue;
    if (car.driver === 'player') continue;
    const d = dist2d(p.x, p.z, car.x, car.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function update(G, dt) {
  const p = G.player;
  const input = G.input;

  // Pause toggle.
  if (input.pressed('KeyP') || input.pressed('Escape')) {
    if (G.started) setPaused(G, !G.paused);
  }
  if (!G.started || G.paused) return;

  // Mouse look.
  const { dx, dy } = input.consumeMouse();
  if (input.locked || dx !== 0 || dy !== 0) {
    p.camYaw -= dx * 0.0028;
    p.camPitch = clamp(p.camPitch + dy * 0.0022, -0.15, 0.85);
  }

  const axis = input.axis();
  if (p.inCar && p.car) {
    // --- Driving ---
    const car = p.car;
    const throttle = G.autoDrive ? 0.8 : axis.y;
    const steer = -axis.x;
    const moved = driveCar(car, throttle, steer, dt);
    p.x = car.x; p.z = car.z; p.yaw = car.yaw;
    if (collideCircle(G.city.colliders, car, 2.2)) {
      if (Math.abs(car.speed) > 12) { G.audio.crash(); p.crashShake = 0.6; G.fx.burst(car.x, 1, car.z, 0xcccccc, 10, 4); }
      car.speed *= 0.35;
      car.group.position.set(car.x, 0, car.z);
    }
    // Skid marks on hard turns at speed.
    if (Math.abs(car.steer) > 1.2 && Math.abs(car.speed) > 14 && Math.random() < 0.5) {
      G.fx.skid(car.x - Math.sin(car.yaw) * 1.4, car.z - Math.cos(car.yaw) * 1.4, car.yaw);
    }
    // Running over a pedestrian is a crime.
    for (const ped of G.traffic.peds) {
      if (ped.health <= 0) continue;
      if (dist2d(car.x, car.z, ped.x, ped.z) < 2.2 && Math.abs(car.speed) > 3) {
        ped.health = 0;
        ped.group.visible = false;
        G.police.addHeat(70, 'hit-ped');
        G.audio.crash();
        p.crashShake = 0.5;
        G.fx.burst(ped.x, 1, ped.z, 0xff5544, 12, 5);
        G.hud.toast('You hit a pedestrian!');
      }
    }
    // Bump traffic cars.
    for (const other of G.traffic.cars) {
      if (other === car || other.isPolice) continue;
      if (dist2d(car.x, car.z, other.x, other.z) < 4.2) {
        const push = 4.2 - dist2d(car.x, car.z, other.x, other.z);
        const a = Math.atan2(other.x - car.x, other.z - car.z);
        other.x += Math.sin(a) * push * 0.5;
        other.z += Math.cos(a) * push * 0.5;
        other.group.position.set(other.x, 0, other.z);
        if (Math.abs(car.speed) > 8) { G.audio.crash(); p.crashShake = 0.4; }
        car.speed *= 0.92;
      }
    }
    G.audio.engineSet(Math.abs(car.speed) / 42, true);
    if (input.pressed('KeyE')) exitCar(G);
    if (input.down('Space')) driveCar(car, -1, 0, dt * 0.4);
  } else {
    // --- On foot ---
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? PLAYER.run : PLAYER.walk;
    const sin = Math.sin(p.camYaw), cos = Math.cos(p.camYaw);
    const mx = (axis.x * cos + axis.y * sin) * speed;
    const mz = (-axis.x * sin + axis.y * cos) * speed;
    const moving = Math.hypot(axis.x, axis.y) > 0;
    if (moving) {
      p.x += mx * dt;
      p.z += mz * dt;
      p.yaw = angleLerp(p.yaw, Math.atan2(mx, mz), Math.min(1, dt * 10));
      p.moveSpeed = speed;
      p.walkPhase += dt * speed * 1.4;
    } else {
      p.moveSpeed = 0;
    }
    p.x = clamp(p.x, -WORLD.half, WORLD.half);
    p.z = clamp(p.z, -WORLD.half, WORLD.half);
    collideCircle(G.city.colliders, p, PLAYER.radius);
    // Walk into a parked car: slide around it.
    for (const car of G.cars) {
      if (car.isPolice) continue;
      const d = dist2d(p.x, p.z, car.x, car.z);
      if (d < 2.4 && d > 0.01) {
        p.x = car.x + ((p.x - car.x) / d) * 2.4;
        p.z = car.z + ((p.z - car.z) / d) * 2.4;
      }
    }
    // Walk animation.
    const swing = moving ? Math.sin(p.walkPhase) * 0.7 : 0;
    const ud = p.mesh.userData;
    ud.legL.rotation.x = swing;
    ud.legR.rotation.x = -swing;
    ud.armL.rotation.x = -swing * 0.8;
    ud.armR.rotation.x = swing * 0.8;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.yaw;
    G.audio.engineSet(0, false);

    if (input.pressed('KeyE')) {
      const car = nearestCar(G, 4.2);
      if (car) enterCar(G, car);
    }
    if (input.mouseDown) G.combat.punch(G);
    if (input.pressed('KeyF')) G.combat.shoot(G);
  }

  // Health regen, slow but real.
  if (p.health > 0 && p.health < PLAYER.health) p.health = Math.min(PLAYER.health, p.health + 1.2 * dt);

  // Crime scene for fleeing pedestrians.
  const crime = G.police.wanted > 0 ? { x: p.x, z: p.z } : null;
  G.traffic.update(dt, { x: p.x, z: p.z }, crime, G.police.wanted);
  G.police.update(dt, p, () => busted(G));
  const reward = G.missions.update(dt, G);
  if (reward > 0) {
    p.cash += reward;
    saveGame(G);
  }
  G.combat.update(dt, G);
  G.fx.update(dt);
  G.hud.update(dt, G);

  // Siren follows the nearest cruiser.
  G.audio.sirenSet(G.police.cars.length > 0 && G.police.wanted > 0);

  // Wasted.
  if (p.health <= 0) wasted(G);

  // Story complete overlay, once.
  if (G.missions.done && !G.storyShown) {
    G.storyShown = true;
    G.hud.showOverlay('story');
    setTimeout(() => G.hud.showOverlay(null), 6000);
    saveGame(G);
  }

  updateCamera(G, dt);
  p.crashShake = Math.max(0, p.crashShake - dt * 1.4);
}

function updateCamera(G, dt) {
  const p = G.player;
  const cam = G.camera;
  let tx, ty, tz, lx, ly, lz;
  if (p.inCar && p.car) {
    const car = p.car;
    const back = G.shotCamBack ?? 10.5, up = 4.2;
    // Chase cam eases toward the car's rear.
    p.camYaw = angleLerp(p.camYaw, car.yaw + Math.PI, Math.min(1, dt * 1.6));
    tx = car.x + Math.sin(p.camYaw) * back;
    tz = car.z + Math.cos(p.camYaw) * back;
    ty = up;
    lx = car.x + Math.sin(car.yaw) * 8;
    ly = 1.4;
    lz = car.z + Math.cos(car.yaw) * 8;
  } else {
    const dist = 7.5;
    const h = 2.2 + p.camPitch * 4;
    tx = p.x + Math.sin(p.camYaw) * dist;
    tz = p.z + Math.cos(p.camYaw) * dist;
    ty = h;
    lx = p.x;
    ly = 1.5;
    lz = p.z;
  }
  const k = 1 - Math.exp(-dt * 10);
  cam.position.x = lerp(cam.position.x, tx, k);
  cam.position.y = lerp(cam.position.y, ty, k);
  cam.position.z = lerp(cam.position.z, tz, k);
  if (p.crashShake > 0) {
    cam.position.x += (Math.random() - 0.5) * p.crashShake * 0.5;
    cam.position.y += (Math.random() - 0.5) * p.crashShake * 0.4;
  }
  cam.lookAt(lx, ly, lz);
}

function busted(G) {
  const p = G.player;
  G.audio.busted();
  G.audio.sirenSet(false);
  p.cash = Math.floor(p.cash * 0.8);
  G.police.setStars(0);
  p.health = PLAYER.health;
  G.hud.showOverlay('busted');
  G.paused = true;
  setTimeout(() => {
    p.x = 0; p.z = 180; p.yaw = 0; p.camYaw = 0;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.visible = true;
    if (p.inCar) { p.car.isPlayer = false; p.car.driver = null; p.inCar = false; p.car = null; }
    G.hud.showOverlay(null);
    G.paused = false;
  }, 2600);
}

function wasted(G) {
  const p = G.player;
  p.cash = Math.floor(p.cash * 0.85);
  p.health = PLAYER.health;
  G.police.setStars(0);
  G.hud.showOverlay('wasted');
  G.paused = true;
  setTimeout(() => {
    p.x = -60; p.z = 180; p.yaw = 0; p.camYaw = 0;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.visible = true;
    if (p.inCar) { p.car.isPlayer = false; p.car.driver = null; p.inCar = false; p.car = null; }
    G.hud.showOverlay(null);
    G.paused = false;
  }, 2600);
}

function saveGame(G) {
  const p = G.player;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: p.cash, health: p.health, ammo: p.ammo,
      mission: G.missions.index, step: G.missions.step,
      x: p.x, z: p.z, yaw: p.yaw, wanted: G.police.wanted,
    }));
    return true;
  } catch { return false; }
}

function loadGame(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    const p = G.player;
    p.cash = s.cash ?? PLAYER.startCash;
    p.health = s.health ?? PLAYER.health;
    p.ammo = s.ammo ?? PLAYER.startAmmo;
    G.missions.index = Math.min(s.mission ?? 0, MISSIONS.length - 1);
    G.missions.step = s.step ?? 0;
    p.x = s.x ?? -30; p.z = s.z ?? 30; p.yaw = s.yaw ?? 0; p.camYaw = p.yaw;
    p.mesh.position.set(p.x, 0, p.z);
    G.police.setStars(s.wanted ?? 0);
    return true;
  } catch { return false; }
}

function setPaused(G, paused) {
  G.paused = paused;
  document.getElementById('pause-menu').classList.toggle('hidden', !paused);
  if (!paused) G.input.requestLock();
  else G.input.releaseLock();
}

function wireUI(G) {
  const startBtn = document.getElementById('btn-start');
  const contBtn = document.getElementById('btn-continue');
  const resumeBtn = document.getElementById('btn-resume');
  const saveBtn = document.getElementById('btn-save');
  const restartBtn = document.getElementById('btn-restart');
  const muteBtn = document.getElementById('btn-mute');
  const storyBtn = document.getElementById('btn-story-keep');
  let hasSave = false;
  try { hasSave = !!localStorage.getItem(SAVE_KEY); } catch { hasSave = false; }
  contBtn.style.display = hasSave ? '' : 'none';

  const start = (load) => {
    G.audio.ensure();
    G.audio.click();
    if (load) loadGame(G);
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    G.started = true;
    G.input.requestLock();
    G.hud.toast(MISSIONS[G.missions.index]?.intro ?? 'Welcome to Solmar Bay.', 5);
  };
  startBtn.addEventListener('click', () => start(false));
  contBtn.addEventListener('click', () => start(true));
  resumeBtn.addEventListener('click', () => { G.audio.click(); setPaused(G, false); });
  saveBtn.addEventListener('click', () => {
    if (saveGame(G)) { saveBtn.textContent = 'Saved ✓'; setTimeout(() => { saveBtn.textContent = 'Save game'; }, 1500); }
  });
  restartBtn.addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* no storage */ }
    window.location.reload();
  });
  muteBtn.addEventListener('click', () => {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
    muteBtn.textContent = G.muted ? 'Unmute' : 'Mute';
  });
  storyBtn.addEventListener('click', () => G.hud.showOverlay(null));
  document.getElementById('game-canvas').addEventListener('click', () => {
    if (G.started && !G.paused) G.input.requestLock();
  });
}

createGame();
