// Actors: the player on foot, pedestrians, traffic cars and police.
// Every moving thing in Solmar Bay lives here — one module, one job:
// move bodies around the city and answer "who is near whom".
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { pick, range } from './rng.js';
import { roadLines, nearestRoad, resolveCollisions, clampToCity } from './city.js';

// ---------------------------------------------------------------- cars
// A car is a low-poly body + cabin + four wheels, with a heading, a
// speed and a driver flag. The same builder makes parked cars, traffic
// cars and police cars; only the paint and the lights differ.
export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  // Headlights.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x555533 });
  for (const lx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    lamp.position.set(lx, 0.6, 2.22);
    group.add(lamp);
  }
  if (isPolice) {
    const barMat = new THREE.MeshLambertMaterial({ color: 0x2244cc, emissive: 0x112266 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), barMat);
    bar.position.set(0, 1.55, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.25, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
    );
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  return group;
}

export function makeCar(scene, x, z, angle, color, isPolice = false) {
  const mesh = makeCarMesh(color, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  scene.add(mesh);
  return {
    mesh, x, z, angle,
    speed: 0,
    isPolice,
    isTraffic: false,
    occupied: false, // a traffic driver sits inside
    health: 100,
    routeAxis: 'x', // traffic cars drive along one axis at a time
    routeDir: 1,
  };
}

// ---------------------------------------------------------------- player
export function makePlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), jacket);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 1.95;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.scale.set(1, 0.7, 1);
  hair.position.y = 2.1;
  group.add(hair);
  for (const lx of [-0.22, 0.22]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.3), jeans);
    leg.position.set(lx, 0.4, 0);
    leg.name = lx < 0 ? 'legL' : 'legR';
    group.add(leg);
  }
  for (const lx of [-0.5, 0.5]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.25), jacket);
    arm.position.set(lx, 1.15, 0);
    group.add(arm);
  }
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = makePlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { mesh, x, z, angle: 0, walkPhase: 0, moving: false };
}

// Move the player with WASD relative to the camera yaw. Returns true
// while any move key is held.
export function movePlayer(player, input, camYaw, dt, colliders, state) {
  let fx = 0;
  let fz = 0;
  if (input.forward) fz -= 1;
  if (input.back) fz += 1;
  if (input.left) fx -= 1;
  if (input.right) fx += 1;
  const moving = fx !== 0 || fz !== 0;
  player.moving = moving;
  if (!moving) return false;
  const len = Math.hypot(fx, fz);
  fx /= len;
  fz /= len;
  // Rotate the input vector by the camera yaw.
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  const wx = fx * cos - fz * sin;
  const wz = fx * sin + fz * cos;
  const speed = input.run ? CFG.RUN_SPEED : CFG.WALK_SPEED;
  player.x += wx * speed * dt;
  player.z += wz * speed * dt;
  player.angle = Math.atan2(wx, wz);
  player.mesh.rotation.y = player.angle;
  player.walkPhase += dt * speed * 1.6;
  const swing = Math.sin(player.walkPhase) * 0.5;
  const legL = player.mesh.getObjectByName('legL');
  const legR = player.mesh.getObjectByName('legR');
  if (legL) legL.rotation.x = swing;
  if (legR) legR.rotation.x = -swing;
  resolveCollisions(player, CFG.PLAYER_RADIUS, colliders);
  clampToCity(player);
  player.mesh.position.set(player.x, 0, player.z);
  return true;
}

// ---------------------------------------------------------------- pedestrians
export function makePedMesh(rng) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, PALETTE.pedSkin) });
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PALETTE.pedShirt) });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.4), shirt);
  body.position.y = 1.1;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 1.85;
  group.add(head);
  for (const lx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.75, 0.26), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    leg.position.set(lx, 0.38, 0);
    group.add(leg);
  }
  return group;
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  const lines = roadLines();
  for (let i = 0; i < count; i++) {
    const mesh = makePedMesh(rng);
    const onXRoad = rng() < 0.5;
    const line = pick(rng, lines);
    const along = range(rng, -180, 180);
    const side = (rng() < 0.5 ? -1 : 1) * (CFG.ROAD / 2 + 1.5);
    const x = onXRoad ? line + side : along;
    const z = onXRoad ? along : line + side;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh, x, z,
      angle: rng() * Math.PI * 2,
      speed: range(rng, 1.2, 2.4),
      panic: 0, // seconds of fleeing after a gunshot
      axis: onXRoad ? 'z' : 'x',
      dir: rng() < 0.5 ? -1 : 1,
      retarget: range(rng, 2, 8),
    });
  }
  return peds;
}

// Pedestrians stroll along the sidewalks, turn at intersections, and
// run away from the player for a few seconds after a gunshot.
export function updatePedestrians(peds, player, dt, colliders) {
  for (const p of peds) {
    p.retarget -= dt;
    if (p.retarget <= 0) {
      p.retarget = range(Math.random, 3, 9);
      if (Math.random() < 0.4) {
        p.axis = p.axis === 'x' ? 'z' : 'x';
        p.dir = Math.random() < 0.5 ? -1 : 1;
      } else {
        p.dir *= -1;
      }
    }
    const speed = p.panic > 0 ? p.speed * 3.2 : p.speed;
    if (p.panic > 0) p.panic -= dt;
    if (p.axis === 'x') p.x += p.dir * speed * dt;
    else p.z += p.dir * speed * dt;
    // At an intersection, snap onto the nearest road line.
    if (p.axis === 'x') p.z = nearestRoad(p.z);
    else p.x = nearestRoad(p.x);
    // Bounce off the city edge instead of walking into the sea.
    if (p.x > 190 || p.x < -190) p.dir *= -1;
    if (p.z > 195 || p.z < -190) p.dir *= -1;
    p.angle = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    p.mesh.rotation.y = p.angle;
    p.mesh.position.set(p.x, 0, p.z);
  }
}

// ---------------------------------------------------------------- traffic
export function spawnTraffic(scene, rng, count, parkingSpots) {
  const cars = [];
  const lines = roadLines();
  for (let i = 0; i < count; i++) {
    const onXRoad = rng() < 0.5;
    const line = pick(rng, lines);
    const along = range(rng, -170, 170);
    const lane = (rng() < 0.5 ? -1 : 1) * 3;
    const x = onXRoad ? line + lane : along;
    const z = onXRoad ? along : line + lane;
    const car = makeCar(scene, x, z, onXRoad ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2), pick(rng, PALETTE.car));
    car.isTraffic = true;
    car.occupied = true;
    car.speed = range(rng, CFG.TRAFFIC_SPEED * 0.7, CFG.TRAFFIC_SPEED);
    car.routeAxis = onXRoad ? 'z' : 'x';
    car.routeDir = rng() < 0.5 ? -1 : 1;
    cars.push(car);
  }
  // Parked, stealable cars at the fixed spots.
  for (const spot of parkingSpots) {
    const car = makeCar(scene, spot.x, spot.z, spot.angle, pick(rng, PALETTE.car));
    car.speed = 0;
    cars.push(car);
  }
  return cars;
}

// Traffic drives its road, turns at intersections sometimes, and slows
// when another car is right ahead — no pile-ups on Coral Row.
export function updateTraffic(cars, dt, playerCar) {
  for (const car of cars) {
    if (!car.isTraffic) continue;
    // Slow down if a car is close ahead.
    let blocked = false;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 9) {
        const ahead = car.routeAxis === 'x'
          ? Math.sign(dx) === car.routeDir && Math.abs(dz) < 3
          : Math.sign(dz) === car.routeDir && Math.abs(dx) < 3;
        if (ahead) { blocked = true; break; }
      }
    }
    const target = blocked ? 0 : CFG.TRAFFIC_SPEED;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    if (car.routeAxis === 'x') car.x += car.routeDir * car.speed * dt;
    else car.z += car.routeDir * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const nearX = Math.abs(car.x - nearestRoad(car.x)) < 1.2;
    const nearZ = Math.abs(car.z - nearestRoad(car.z)) < 1.2;
    if (nearX && nearZ && Math.random() < dt * 0.55) {
      if (car.routeAxis === 'x') {
        car.z = nearestRoad(car.z);
        car.routeAxis = 'z';
        car.routeDir = Math.random() < 0.5 ? -1 : 1;
      } else {
        car.x = nearestRoad(car.x);
        car.routeAxis = 'x';
        car.routeDir = Math.random() < 0.5 ? -1 : 1;
      }
    }
    // Wrap around the far edge so traffic never runs out.
    if (car.x > 195) car.x = -195;
    if (car.x < -195) car.x = 195;
    if (car.z > 200) car.z = -195;
    if (car.z < -195) car.z = 200;
    car.angle = car.routeAxis === 'x'
      ? (car.routeDir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.routeDir > 0 ? 0 : Math.PI);
    car.mesh.rotation.y = car.angle;
    car.mesh.position.set(car.x, 0, car.z);
  }
}

// ---------------------------------------------------------------- police
export function spawnPoliceCar(scene, x, z) {
  const car = makeCar(scene, x, z, 0, PALETTE.police, true);
  car.speed = 0;
  return car;
}

// A police car steers straight at the player and rams. It is deliberately
// a little slower than a driven car at full speed, so escape is possible.
export function updatePoliceCar(car, targetX, targetZ, dt, colliders) {
  const dx = targetX - car.x;
  const dz = targetZ - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.01) return;
  const wantAngle = Math.atan2(dx, dz);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const accel = dist > 8 ? CFG.POLICE_TOP_SPEED : CFG.POLICE_TOP_SPEED * 0.55;
  car.speed += (accel - car.speed) * Math.min(1, dt * 1.4);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  resolveCollisions(car, CFG.CAR_RADIUS, colliders);
  clampToCity(car);
  car.mesh.rotation.y = car.angle;
  car.mesh.position.set(car.x, 0, car.z);
  // Flash the light bar.
  const bar = car.mesh.getObjectByName('lightbar');
  if (bar) {
    const on = Math.floor(performance.now() / 260) % 2 === 0;
    bar.material.color.setHex(on ? 0x2244cc : 0xcc2222);
    bar.material.emissive.setHex(on ? 0x112266 : 0x661111);
  }
}

// Drive the player's car: arcade handling, W/S for throttle and brake,
// A/D to steer, with the speed feeding the HUD and the engine sound.
export function driveCar(car, input, dt, colliders) {
  if (input.forward) car.speed += CFG.CAR_ACCEL * dt;
  if (input.back) {
    car.speed -= (car.speed > 0.5 ? CFG.CAR_BRAKE : CFG.CAR_REVERSE) * dt;
  }
  if (!input.forward && !input.back) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
  }
  car.speed = Math.max(-CFG.CAR_REVERSE, Math.min(CFG.CAR_MAX_SPEED, car.speed));
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerAmount = steer * CFG.CAR_TURN * dt * Math.min(1, Math.abs(car.speed) / 8) * (car.speed < 0 ? -1 : 1);
  car.angle += steerAmount;
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  const pushed = resolveCollisions(car, CFG.CAR_RADIUS, colliders);
  if (pushed) car.speed *= 0.55;
  clampToCity(car);
  car.mesh.rotation.y = car.angle;
  car.mesh.position.set(car.x, 0, car.z);
}
