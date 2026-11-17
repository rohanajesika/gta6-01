// Traffic and pedestrians. Cars loop around the road grid on waypoint routes
// (right-hand side, one lane each way); pedestrians stroll the sidewalks and
// scatter when a car or a gunshot comes too close.
import * as THREE from 'three';
import { CITY, PALETTE, TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { createCar, driveCar } from './vehicles.js';
import { collideCircle, clampToCity } from './city.js';

function roadRoute(rng) {
  // A rectangular loop around two adjacent roads.
  const a = rng.pick(CITY.roads);
  const b = rng.pick(CITY.roads);
  const c = rng.pick(CITY.roads);
  const d = rng.pick(CITY.roads);
  return [
    [a, -200], [a, 200], [b, 200], [b, -200],
    [c, -200], [c, 200], [d, 200], [d, -200],
  ];
}

export function createTraffic(scene, rng) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const road = rng.pick(CITY.roads);
    const along = rng.range(-200, 200);
    const vertical = rng.next() > 0.5;
    const car = createCar(scene, {
      x: vertical ? road : along,
      z: vertical ? along : road,
      heading: vertical ? (rng.next() > 0.5 ? 0 : Math.PI) : (rng.next() > 0.5 ? Math.PI / 2 : -Math.PI / 2),
      color: rng.pick(PALETTE.carPaint),
      kind: 'traffic',
      speed: rng.range(6, 11),
    });
    car.route = roadRoute(rng);
    cars.push(car);
  }
  // Parked cars: the yellow taxi by the start, the red Comet, and a few more.
  const taxi = createCar(scene, { x: -6, z: 0, heading: Math.PI / 2, color: PALETTE.taxiYellow, kind: 'taxi', parked: true });
  cars.push(taxi);
  const comet = createCar(scene, { x: 120, z: -57, heading: Math.PI, color: PALETTE.cometRed, kind: 'comet', parked: true });
  cars.push(comet);
  for (const [x, z, h] of [[30, 63, 0], [-90, -57, Math.PI / 2], [60, -123, 0], [-150, 3, Math.PI / 2], [180, 93, Math.PI]]) {
    cars.push(createCar(scene, { x, z, heading: h, color: rng.pick(PALETTE.carPaint), kind: 'traffic', parked: true }));
  }
  return { cars, taxi, comet };
}

function pedMesh(shirt) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 4, 8), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
  head.position.y = 1.75;
  group.add(head);
  return group;
}

export function createPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const mesh = pedMesh(rng.pick(PALETTE.pedShirts));
    const x = rng.pick(CITY.roads) + rng.range(-14, 14);
    const z = rng.range(-190, 190);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({ mesh, x, z, heading: rng.range(0, Math.PI * 2), speed: rng.range(1, 2.2), panic: 0, alive: true });
  }
  return { peds };
}

export function updateTraffic(G, dt) {
  const { cars } = G.traffic;
  for (const car of cars) {
    if (car.removed || car.parked) continue;
    if (G.player.inCar && G.player.car === car) continue; // player drives this one
    if (G.police.cars.includes(car)) continue; // police module drives its own
    // A stolen parked car has no route yet: give it one so it joins traffic.
    if (!car.route) car.route = roadRoute(G.rng);
    // Follow the route: steer toward the next waypoint.
    const wp = car.route[car.waypoint];
    const dx = wp[0] - car.x;
    const dz = wp[1] - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 6) {
      car.waypoint = (car.waypoint + 1) % car.route.length;
      continue;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Slow down for a car stopped ahead.
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.removed) continue;
      const ox = other.x - car.x;
      const oz = other.z - car.z;
      const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (ahead > 0 && ahead < 9 && side < 2.4) { blocked = true; break; }
    }
    const targetSpeed = blocked ? 0 : 9;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.heading += Math.max(-1.4 * dt, Math.min(1.4 * dt, diff));
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!collideCircle(G.city.colliders, nx, nz, 1.6)) {
      car.x = nx;
      car.z = nz;
    } else {
      car.waypoint = (car.waypoint + 1) % car.route.length;
    }
    const c = clampToCity(car.x, car.z);
    car.x = c.x;
    car.z = c.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2.4;
  }
}

export function updatePedestrians(G, dt) {
  for (const ped of G.peds.peds) {
    if (!ped.alive) continue;
    // Panic: run away from the player when a shot was fired or a car is close.
    const pd = Math.hypot(ped.x - G.player.x, ped.z - G.player.z);
    if (pd < 12 && (G.combat.shotRecently > 0 || (G.player.inCar && Math.abs(G.player.car?.speed || 0) > 8))) {
      ped.panic = 2;
    }
    ped.panic = Math.max(0, ped.panic - dt);
    const speed = ped.panic > 0 ? 5 : ped.speed;
    if (ped.panic > 0) {
      ped.heading = Math.atan2(ped.x - G.player.x, ped.z - G.player.z);
    } else if (G.rng.next() < dt * 0.08) {
      ped.heading += G.rng.range(-1.2, 1.2);
    }
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    if (!collideCircle(G.city.colliders, nx, nz, 0.6)) {
      ped.x = nx;
      ped.z = nz;
    } else {
      ped.heading += Math.PI / 2;
    }
    const c = clampToCity(ped.x, ped.z);
    ped.x = c.x;
    ped.z = c.z;
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(G.time * 8 + ped.x)) * 0.05, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // A fast car hitting a pedestrian is a crime — and the pedestrian goes down.
    if (G.player.inCar && G.player.car) {
      const cd = Math.hypot(ped.x - G.player.car.x, ped.z - G.player.car.z);
      if (cd < 1.8 && Math.abs(G.player.car.speed) > 6) {
        ped.alive = false;
        ped.mesh.visible = false;
        G.police.addWanted(1, 'You hit a pedestrian!');
        G.hud.say('You hit a pedestrian! Wanted level up.');
        G.audio.crash();
        G.player.car.speed *= 0.6;
      }
    }
  }
}
