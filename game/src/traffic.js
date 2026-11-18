// Traffic and pedestrians. One job: fill the streets with life — cars
// cruising the road grid, parked cars to steal, and people on the sidewalks.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeCar, syncCarMesh } from './vehicles.js';

const TAXI_SPOT = { x: -6, z: 9, heading: 0 };

function makePedestrianMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: [0xd84a4a, 0x4a7ad8, 0x4ad87b, 0xd8c84a, 0x8a4ad8, 0xe8e8e8][rng.int(0, 5)],
    roughness: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.32), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 }),
  );
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2c343c, roughness: 1 });
  for (const x of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), legMat);
    leg.position.set(x, 0.3, 0);
    g.add(leg);
  }
  return g;
}

export function createTraffic(G) {
  const rng = G.rng;
  const cars = [];
  const peds = [];
  const group = new THREE.Group();
  group.name = 'traffic';
  G.scene.add(group);

  // The taxi: parked on the plaza edge, facing south down the service
  // alley, so a new player can steal it and drive a clear lane.
  const taxi = makeCar({
    x: TAXI_SPOT.x, z: TAXI_SPOT.z, heading: TAXI_SPOT.heading,
    parked: true, color: 0xe8c832, colorIndex: 2,
  });
  taxi.isTaxi = true;
  cars.push(taxi);
  group.add(taxi.mesh);
  syncCarMesh(taxi);

  // Other parked cars along road shoulders, well away from the taxi.
  const parkedSpots = [
    { x: -28, z: -60, heading: Math.PI / 2 }, { x: 28, z: -100, heading: -Math.PI / 2 },
    { x: -68, z: 60, heading: Math.PI / 2 }, { x: 68, z: -40, heading: -Math.PI / 2 },
    { x: -108, z: 100, heading: Math.PI / 2 }, { x: 108, z: 140, heading: -Math.PI / 2 },
    { x: -148, z: -120, heading: Math.PI / 2 }, { x: 148, z: 20, heading: -Math.PI / 2 },
    { x: 60, z: 148, heading: 0 }, { x: -60, z: -148, heading: Math.PI },
  ];
  parkedSpots.forEach((s, i) => {
    const car = makeCar({
      x: s.x, z: s.z, heading: s.heading, parked: true, colorIndex: (i + 3) % 10,
    });
    cars.push(car);
    group.add(car.mesh);
    syncCarMesh(car);
  });

  // Moving cars: each picks a road line and a direction and cruises it,
  // turning at intersections sometimes. Lane offset keeps them right.
  for (let i = 0; i < CONFIG.traffic.movingCars; i++) {
    const vertical = rng.chance(0.5);
    const road = rng.pick(CONFIG.roads);
    const dir = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-180, 180);
    const car = makeCar({
      x: vertical ? road + 2.5 * dir : along,
      z: vertical ? along : road + 2.5 * dir,
      heading: vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      colorIndex: rng.int(0, 9),
      trafficAxis: vertical ? 'z' : 'x',
      trafficDir: dir,
      trafficLane: 2.5 * dir,
      cruise: rng.range(7, 12),
    });
    cars.push(car);
    group.add(car.mesh);
    syncCarMesh(car);
  }

  // Pedestrians wander the sidewalks beside the roads.
  for (let i = 0; i < CONFIG.traffic.pedestrians; i++) {
    const road = rng.pick(CONFIG.roads);
    const vertical = rng.chance(0.5);
    const mesh = makePedestrianMesh(rng);
    const ped = {
      x: vertical ? road + (rng.chance(0.5) ? 9 : -9) : rng.range(-180, 180),
      z: vertical ? rng.range(-180, 180) : road + (rng.chance(0.5) ? 9 : -9),
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      mesh,
      alive: true,
      wander: rng.range(2, 6),
      targetHeading: 0,
    };
    peds.push(ped);
    group.add(mesh);
    mesh.position.set(ped.x, 0.3, ped.z);
  }

  function nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (!car.parked) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function update(dt) {
    // Moving traffic: cruise along its road; at an intersection, sometimes
    // turn onto the crossing road. Parked and player cars never move here.
    for (const car of cars) {
      if (car.parked || car.isPolice || car === G.player.car) continue;
      if (!car.trafficAxis) continue;
      const speed = car.cruise;
      if (car.trafficAxis === 'z') {
        car.z += car.trafficDir * speed * dt;
        if (car.z > 195) car.z = -195;
        if (car.z < -195) car.z = 195;
        const near = CONFIG.roads.find((r) => Math.abs(car.z - r) < 1.2);
        if (near !== undefined && rng.chance(0.004)) {
          car.trafficAxis = 'x';
          car.trafficDir = rng.chance(0.5) ? 1 : -1;
          car.heading = car.trafficDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.z = near + car.trafficLane;
        }
      } else {
        car.x += car.trafficDir * speed * dt;
        if (car.x > 195) car.x = -195;
        if (car.x < -195) car.x = 195;
        const near = CONFIG.roads.find((r) => Math.abs(car.x - r) < 1.2);
        if (near !== undefined && rng.chance(0.004)) {
          car.trafficAxis = 'z';
          car.trafficDir = rng.chance(0.5) ? 1 : -1;
          car.heading = car.trafficDir > 0 ? 0 : Math.PI;
          car.x = near + car.trafficLane;
        }
      }
      syncCarMesh(car);
    }

    // Pedestrians: stroll, turn at random, keep to the pavements.
    for (const ped of peds) {
      if (!ped.alive) continue;
      ped.wander -= dt;
      if (ped.wander <= 0) {
        ped.wander = rng.range(2, 6);
        ped.targetHeading = ped.heading + rng.range(-1.2, 1.2);
      }
      let dh = ped.targetHeading - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
      if (Math.abs(nx) < 196 && Math.abs(nz) < 196 && !G.world.collidesCircle(nx, nz, 0.5)) {
        ped.x = nx;
        ped.z = nz;
      } else {
        ped.targetHeading = ped.heading + Math.PI;
      }
      ped.mesh.position.set(ped.x, 0.3, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  return { cars, peds, nearestParked, update, taxiSpot: TAXI_SPOT };
}
