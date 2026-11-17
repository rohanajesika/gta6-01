// Cars: low-poly box builds, arcade driving, police and taxi variants.
import * as THREE from 'three';
import { CAR, PALETTE, clamp } from './config.js';

let carSeq = 0;

export function makeCarMesh(colorHex, kind = 'sedan') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.08, kind === 'taxi' ? -0.2 : -0.3);
  group.add(cabin);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 0.4), darkMat);
  bumperF.position.set(0, 0.35, 2.25);
  group.add(bumperF);
  const bumperB = bumperF.clone();
  bumperB.position.z = -2.25;
  group.add(bumperB);

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const dx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), headMat);
    h.position.set(dx, 0.62, 2.46);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const dx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), tailMat);
    t.position.set(dx, 0.62, -2.46);
    group.add(t);
  }

  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.42, -0.3);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.42), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    red.position.set(-0.28, 1.42, -0.3);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.42), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.28, 1.42, -0.3);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe14d }));
    sign.position.set(0, 1.45, -0.2);
    group.add(sign);
  }

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(wx, 0.36, wz);
    group.add(w);
    wheels.push(w);
  }
  return { group, wheels };
}

export function makeCar(scene, opts = {}) {
  const id = ++carSeq;
  const color = opts.color ?? 0x888888;
  const kind = opts.kind ?? 'sedan';
  const { group, wheels } = makeCarMesh(color, kind);
  group.position.set(opts.x ?? 0, 0, opts.z ?? 0);
  group.rotation.y = opts.yaw ?? 0;
  scene.add(group);
  const car = {
    id,
    kind,
    group,
    wheels,
    x: opts.x ?? 0,
    z: opts.z ?? 0,
    yaw: opts.yaw ?? 0,
    speed: 0,
    steer: 0,
    health: 100,
    color,
    isPlayer: false,
    isPolice: kind === 'police',
    isTraffic: !!opts.traffic,
    parked: !!opts.parked,
    ai: null,           // traffic brain
    targetYaw: opts.yaw ?? 0,
    driver: null,       // 'player' | 'traffic' | null
    smoke: null,
    name: opts.name ?? `Car ${id}`,
  };
  return car;
}

// Arcade drive: throttle -1..1, steer -1..1. Returns distance moved.
export function driveCar(car, throttle, steer, dt) {
  const maxF = CAR.maxSpeed;
  const maxR = CAR.maxReverse;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.accel * 0.6 * throttle * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
  }
  car.speed = clamp(car.speed, -maxR, maxF);
  const steerTarget = steer * CAR.steer * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 7);
  if (Math.abs(car.speed) > 0.05) {
    car.yaw += (car.steer * (car.speed / Math.max(6, Math.abs(car.speed)))) * dt * (car.speed >= 0 ? 1 : -1) * 0.9;
  }
  const dx = Math.sin(car.yaw) * car.speed * dt;
  const dz = Math.cos(car.yaw) * car.speed * dt;
  car.x += dx;
  car.z += dz;
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.yaw;
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.wheels) w.rotation.x += spin;
  if (car.wheels[0]) car.wheels[0].rotation.y = car.steer * 0.35;
  if (car.wheels[1]) car.wheels[1].rotation.y = car.steer * 0.35;
  return Math.hypot(dx, dz);
}

export function carColorName(hex) {
  const names = {
    0xc0392b: 'red', 0x2471a3: 'blue', 0xf1c40f: 'yellow', 0x7d3c98: 'purple',
    0x16a085: 'teal', 0xe67e22: 'orange', 0x2c3e50: 'black', 0xecf0f1: 'white',
    0x922b21: 'maroon', 0x1abc9c: 'mint',
  };
  return names[hex] ?? 'grey';
}

export function randomCarColor(rng) { return rng.pick(PALETTE.car); }
