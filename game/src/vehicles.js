// Cars. One job: build a car mesh, and drive it — acceleration, steering,
// braking, and sliding along building walls. Both the player's car and
// traffic and police cars are the same object shape.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const BODY_COLORS = [
  0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8,
  0x22262b, 0x8a5fc2, 0xe07b28, 0x4fc2c2, 0xb8b8b8,
];

export function createCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  group.name = isPolice ? 'police-car' : 'car';
  const bodyMat = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1c2733 : color,
    roughness: 0.35,
    metalness: 0.55,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a2027, roughness: 0.15, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.2, 4.42),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }),
    );
    stripe.position.y = 0.62;
    group.add(stripe);
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 0.9 }),
    );
    lightBar.position.set(0, 1.45, -0.2);
    group.add(lightBar);
    lightBar.userData.isLightBar = true;
    group.userData.lightBar = lightBar;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffedb0, emissiveIntensity: 0.8,
  });
  for (const x of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), headMat);
    light.position.set(x, 0.6, 2.21);
    group.add(light);
  }
  return group;
}

export function makeCar(opts) {
  const color = opts.color ?? BODY_COLORS[(opts.colorIndex ?? 0) % BODY_COLORS.length];
  const mesh = createCarMesh(color, !!opts.isPolice);
  return {
    x: opts.x,
    z: opts.z,
    heading: opts.heading ?? 0,
    speed: 0,
    parked: !!opts.parked,
    stolen: false,
    isPolice: !!opts.isPolice,
    color,
    mesh,
    steer: 0,
    // Traffic cars drive themselves; the player's car is driven by input.
    trafficAxis: opts.trafficAxis ?? null,
    trafficDir: opts.trafficDir ?? 1,
    trafficLane: opts.trafficLane ?? 0,
    cruise: opts.cruise ?? CONFIG.traffic.cruiseSpeed,
  };
}

export function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
}

// Drive the player's car one substep: throttle, brake, reverse, steer.
// Returns true when the car scraped a building this step.
export function driveCar(G, car, dt, input) {
  const cfg = CONFIG.car;
  const move = input.moveVector();
  const throttle = move.y;
  if (throttle > 0) car.speed += cfg.accel * dt;
  else if (throttle < 0) {
    car.speed -= (car.speed > 0.5 ? cfg.brake : cfg.accel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (car.speed > cfg.maxSpeed) car.speed = cfg.maxSpeed;
  if (car.speed < -cfg.reverseMax) car.speed = -cfg.reverseMax;
  // Space is the handbrake: a hard stop in either direction.
  if (input.held('Space')) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 42 * dt);
  }
  const steerInput = -move.x;
  const steerTarget = steerInput * cfg.steerRate;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 6);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = G.world.resolveCarCollision(nx, nz, cfg.radius);
  car.x = hit.x;
  car.z = hit.z;
  if (hit.collided) {
    const impact = Math.abs(car.speed);
    car.speed *= 0.45;
    if (impact > 9) G.audio.crash();
  }
  // Keep the car inside the city + beach.
  car.x = Math.max(-245, Math.min(198, car.x));
  car.z = Math.max(-198, Math.min(198, car.z));
  syncCarMesh(car);
  return hit.collided;
}
