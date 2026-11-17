// Cars: a box-built body, cabin, wheels and lights, plus arcade driving
// physics (accelerate, brake, reverse, steering that scales with speed,
// handbrake slide). One factory serves player cars, traffic and police.
import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';

let nextId = 1;

export function makeCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.75, CAR.length), paint);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.35, 0.65, CAR.length * 0.45), glass);
  cabin.position.set(0, 1.2, -0.25);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.3, 0.08, CAR.length * 0.42), paint);
  roof.position.set(0, 1.55, -0.25);
  group.add(roof);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }

  // Headlights and tail lights.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0x777744 });
  for (const sx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    lamp.position.set(sx, 0.62, CAR.length / 2 + 0.02);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x550000 });
  for (const sx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    lamp.position.set(sx, 0.62, -CAR.length / 2 - 0.02);
    group.add(lamp);
  }

  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: PALETTE.taxiYellow }));
    sign.position.set(0, 1.75, -0.25);
    group.add(sign);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: PALETTE.policeBlue, emissive: 0x112266 }));
    bar.position.set(0, 1.62, -0.25);
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR.width + 0.02, 0.3, CAR.length + 0.02), new THREE.MeshLambertMaterial({ color: PALETTE.policeBlue }));
    stripe.position.y = 0.55;
    stripe.scale.set(1, 1, 0.98);
    group.add(stripe);
  }
  return { group, wheels };
}

export function createCar(scene, { x, z, heading = 0, color, kind = 'traffic', parked = false, speed = 0 }) {
  const { group, wheels } = makeCarMesh(color, { taxi: kind === 'taxi', police: kind === 'police' });
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    id: nextId += 1,
    kind,
    mesh: group,
    wheels,
    x, z, heading,
    speed,
    parked,
    steer: 0,
    removed: false,
    waypoint: 0,
  };
}

// Arcade drive step. `drive` is { throttle: -1..1, steer: -1..1, brake: bool }.
export function driveCar(car, drive, dt, colliders, collideFn) {
  if (drive.throttle > 0) car.speed += CAR.accel * drive.throttle * dt;
  else if (drive.throttle < 0) car.speed += CAR.reverseAccel * drive.throttle * dt;
  if (drive.brake) car.speed -= Math.sign(car.speed) * CAR.brake * dt;
  car.speed -= car.speed * CAR.drag * dt;
  if (Math.abs(car.speed) < 0.05 && drive.throttle === 0) car.speed = 0;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));

  const steerTarget = drive.steer * CAR.steer * Math.min(1, Math.abs(car.speed) / 8);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * (car.speed / CAR.maxSpeed) * dt * 1.6;

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (collideFn && collideFn(nx, nz, 1.6)) {
    car.speed *= -0.25; // bounce off the building, keep some motion
  } else {
    car.x = nx;
    car.z = nz;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2.4;
}
