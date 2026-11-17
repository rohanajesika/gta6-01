// Danny Cole on foot: a capsule figure that walks, runs, punches and shoots,
// enters and exits cars, and carries cash, health and ammo. The camera follows
// behind his heading; dragging the mouse orbits it.
import * as THREE from 'three';
import { PLAYER, PALETTE, WANTED } from './config.js';
import { collideCircle, clampToCity } from './city.js';
import { createCar, driveCar } from './vehicles.js';

export function createPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: PALETTE.playerJacket });
  const pants = new THREE.MeshLambertMaterial({ color: PALETTE.playerPants });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 8), jacket);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 2.05;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 6), pants);
  legL.position.set(-0.2, 0.45, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 6), pants);
  legR.position.set(0.2, 0.45, 0);
  group.add(legR);
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = createPlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x, z,
    heading: 0,
    camYaw: 0,
    health: PLAYER.maxHealth,
    cash: PLAYER.startCash,
    ammo: PLAYER.startAmmo,
    reserveAmmo: PLAYER.reserveAmmo,
    inCar: false,
    car: null,
    punchCooldown: 0,
    shootCooldown: 0,
    moving: false,
    lastHurtAt: -999, // game time of the last damage taken
  };
}

export function nearestCar(player, cars, maxDist = PLAYER.enterRange) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.removed) continue;
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.inCar = true;
  p.car = car;
  car.parked = false;
  car.speed = 0;
  p.mesh.visible = false;
  if (car.kind === 'traffic' || car.kind === 'taxi') {
    G.police.addWanted(1, 'You stole a car!');
    G.hud.say('Car stolen — the police are on their way!');
  }
  if (car.kind === 'comet') {
    G.police.addWanted(1, 'You stole the red Comet!');
    G.hud.say('Comet stolen! Get it to the garage!');
  }
  G.audio.click();
}

export function exitCar(G) {
  const p = G.player;
  if (!p.inCar || !p.car) return;
  const car = p.car;
  p.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.2;
  p.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.2;
  p.heading = car.heading;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.visible = true;
  p.inCar = false;
  p.car = null;
  G.audio.click();
}

export function updatePlayer(G, dt, input) {
  const p = G.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.camYaw += input.takeLook() * 0.005;

  if (p.inCar && p.car) {
    const axis = input.axis();
    driveCar(p.car, { throttle: axis.fwd, steer: -axis.strafe, brake: input.handbrake() }, dt, G.city.colliders, (x, z, r) => collideCircle(G.city.colliders, x, z, r));
    const c = clampToCity(p.car.x, p.car.z);
    p.car.x = c.x;
    p.car.z = c.z;
    p.x = p.car.x;
    p.z = p.car.z;
    p.heading = p.car.heading;
    G.audio.setEngine(Math.abs(p.car.speed) / 34, true);
    return;
  }
  G.audio.setEngine(0, false);

  const axis = input.axis();
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const sin = Math.sin(p.camYaw);
  const cos = Math.cos(p.camYaw);
  // Forward is where the camera looks; strafe is perpendicular.
  const mx = (-sin * axis.fwd + cos * axis.strafe) * speed;
  const mz = (-cos * axis.fwd - sin * axis.strafe) * speed;
  p.moving = axis.fwd !== 0 || axis.strafe !== 0;
  if (p.moving) {
    const nx = p.x + mx * dt;
    const nz = p.z + mz * dt;
    if (!collideCircle(G.city.colliders, nx, p.z, PLAYER.radius)) p.x = nx;
    if (!collideCircle(G.city.colliders, p.x, nz, PLAYER.radius)) p.z = nz;
    const c = clampToCity(p.x, p.z);
    p.x = c.x;
    p.z = c.z;
    p.heading = Math.atan2(mx, mz);
    p.mesh.rotation.y = p.heading;
    // Simple walk bob.
    p.mesh.position.y = Math.abs(Math.sin(G.time * 10)) * 0.08;
  } else {
    p.mesh.position.y = 0;
  }
  p.mesh.position.set(p.x, p.mesh.position.y, p.z);
}

export function damagePlayer(G, amount, cause) {
  const p = G.player;
  p.health = Math.max(0, p.health - amount);
  p.lastHurtAt = G.time;
  G.hud.flashDamage();
  if (p.health <= 0) G.endGame(cause || 'wasted');
}

// Slow recovery while clean: with no wanted level and no damage for a
// while, Danny patches himself up at 3 HP a second.
export function recoverPlayer(G, dt) {
  const p = G.player;
  if (G.police.wanted === 0 && p.health > 0 && p.health < PLAYER.maxHealth && G.time - p.lastHurtAt > 8) {
    p.health = Math.min(PLAYER.maxHealth, p.health + 3 * dt);
  }
}

export function healPlayer(G, amount) {
  G.player.health = Math.min(PLAYER.maxHealth, G.player.health + amount);
}
