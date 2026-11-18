// The player. One job: Rook on foot and behind the wheel — movement,
// jumping, entering and leaving cars, health, cash, ammo, and the save.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { driveCar } from './vehicles.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  g.name = 'player';
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2e6fc2, roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.36), jacket);
  body.position.y = 1.1;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 }),
  );
  head.position.y = 1.82;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.8 }),
  );
  cap.position.y = 1.98;
  g.add(cap);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2c343c, roughness: 1 });
  for (const x of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.24), legMat);
    leg.position.set(x, 0.32, 0);
    g.add(leg);
  }
  return g;
}

export function createPlayer(G) {
  const cfg = CONFIG.player;
  const mesh = makePlayerMesh();
  G.scene.add(mesh);

  const player = {
    x: 0,
    z: 0,
    y: 0,
    vy: 0,
    heading: 0,
    camYaw: Math.PI,
    camPitch: 0.32,
    health: CONFIG.player.maxHealth,
    cash: CONFIG.player.startCash,
    ammo: CONFIG.player.startAmmo,
    inCar: false,
    car: null,
    mesh,
    lastDamageAt: -99,
    grounded: true,
  };

  function syncMesh() {
    mesh.position.set(player.x, player.y, player.z);
    mesh.rotation.y = player.heading;
  }

  function teleport(x, z) {
    player.x = x;
    player.z = z;
    player.y = 0;
    player.vy = 0;
    syncMesh();
  }

  function enterCar(car) {
    if (player.inCar) return false;
    player.inCar = true;
    player.car = car;
    car.parked = false;
    mesh.visible = false;
    // Taking a parked car for the first time is a crime; getting back
    // into a car already stolen raises nothing new.
    if (!car.stolen) {
      car.stolen = true;
      G.police.addWanted(1, 'stole a car');
    }
    G.audio.chime();
    G.hud.toast('You took the car — the law noticed');
    return true;
  }

  function exitCar() {
    if (!player.inCar || !player.car) return false;
    const car = player.car;
    const side = 2.6;
    const px = car.x + Math.cos(car.heading) * side;
    const pz = car.z - Math.sin(car.heading) * side;
    const resolved = G.world.resolveCircle(px, pz, CONFIG.player.radius);
    player.x = resolved.x;
    player.z = resolved.z;
    player.y = 0;
    player.vy = 0;
    player.inCar = false;
    player.car = null;
    mesh.visible = true;
    syncMesh();
    return true;
  }

  function damage(amount, cause) {
    if (player.health <= 0) return;
    player.health = Math.max(0, player.health - amount);
    player.lastDamageAt = G.time;
    G.effects.shake(0.5);
    G.hud.flashDamage();
    if (player.health <= 0) G.onWasted(cause);
  }

  function heal(amount) {
    player.health = Math.min(CONFIG.player.maxHealth, player.health + amount);
  }

  function update(dt) {
    const input = G.input;

    if (player.inCar && player.car) {
      driveCar(G, player.car, dt, input);
      player.x = player.car.x;
      player.z = player.car.z;
      player.heading = player.car.heading;
      G.audio.engine(Math.abs(player.car.speed) / CONFIG.car.maxSpeed, true);
      // Ramming a pedestrian at speed is a crime — and it hurts them.
      for (const ped of G.traffic.peds) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - player.x, ped.z - player.z) < 2.2 && Math.abs(player.car.speed) > 4) {
          ped.alive = false;
          ped.mesh.rotation.x = -Math.PI / 2;
          ped.mesh.position.y = 0.5;
          G.police.addWanted(1, 'hit a pedestrian');
          G.audio.thud();
          G.effects.burst(ped.x, 0.8, ped.z, 0xd84a4a, 10);
        }
      }
      return;
    }

    G.audio.engine(0, false);

    // Camera-relative movement on foot.
    const move = input.moveVector();
    const run = input.held('ShiftLeft') || input.held('ShiftRight');
    const speed = run ? cfg.runSpeed : cfg.walkSpeed;
    const sin = Math.sin(player.camYaw);
    const cos = Math.cos(player.camYaw);
    let mx = 0;
    let mz = 0;
    if (move.x !== 0 || move.y !== 0) {
      // Forward is away from the camera: camera looks along -sin/-cos.
      const fx = -sin;
      const fz = -cos;
      const rx = -cos;
      const rz = sin;
      mx = fx * move.y + rx * move.x;
      mz = fz * move.y + rz * move.x;
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      player.heading = Math.atan2(mx, mz);
    }
    const nx = player.x + mx * speed * dt;
    const nz = player.z + mz * speed * dt;
    const resolved = G.world.resolveCircle(nx, nz, cfg.radius);
    player.x = resolved.x;
    player.z = resolved.z;
    const clamped = G.world.clampToCity(player.x, player.z);
    player.x = clamped.x;
    player.z = clamped.z;

    // Jump + gravity.
    if (player.grounded && input.pressed('Space')) {
      player.vy = cfg.jumpSpeed;
      player.grounded = false;
    }
    if (!player.grounded) {
      player.vy -= cfg.gravity * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        player.grounded = true;
      }
    }

    // Passive recovery: a quiet few seconds patches Rook up.
    if (G.time - player.lastDamageAt > 8 && player.health > 0 && player.health < cfg.maxHealth) {
      player.health = Math.min(cfg.maxHealth, player.health + 2 * dt);
    }

    syncMesh();
  }

  function tryEnterCar() {
    if (player.inCar) {
      exitCar();
      return;
    }
    const car = G.traffic.nearestParked(player.x, player.z, cfg.enterRange);
    if (car) enterCar(car);
  }

  // Return the live player object itself, not a copy: every other system
  // reads G.player.x / .inCar / .car, so they must see the same fields
  // update() writes. (A spread copy here once froze the player at 0,0
  // for every reader while the real player drove away.)
  player.syncMesh = syncMesh;
  player.teleport = teleport;
  player.enterCar = enterCar;
  player.exitCar = exitCar;
  player.tryEnterCar = tryEnterCar;
  player.damage = damage;
  player.heal = heal;
  player.update = update;
  return player;
}
