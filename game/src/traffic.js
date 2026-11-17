// Traffic cars follow the street grid; pedestrians walk the sidewalks and flee crime.
import * as THREE from 'three';
import { STREETS, WORLD, clamp, dist2d, angleLerp } from './config.js';
import { makeCar, driveCar, randomCarColor } from './vehicles.js';
import { collideCircle } from './city.js';

function randomRoadPoint(rng) {
  // A point on a random street, offset into the right-hand lane.
  const horiz = rng.chance(0.5);
  const s = rng.pick(STREETS);
  const t = rng.range(-225, 225);
  const lane = rng.chance(0.5) ? 3.5 : -3.5;
  return horiz ? { x: t, z: s + lane, yaw: lane > 0 ? Math.PI / 2 : -Math.PI / 2 }
    : { x: s + lane, z: t, yaw: lane > 0 ? Math.PI : 0 };
}

export class Traffic {
  constructor(scene, colliders, rng) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = rng;
    this.cars = [];
    this.peds = [];
  }

  spawnCars(n) {
    for (let i = 0; i < n; i++) {
      const p = randomRoadPoint(this.rng);
      const car = makeCar(this.scene, { x: p.x, z: p.z, yaw: p.yaw, color: randomCarColor(this.rng), traffic: true });
      car.driver = 'traffic';
      car.ai = { speed: this.rng.range(7, 12), nextTurn: this.rng.range(4, 14), wait: 0 };
      this.cars.push(car);
    }
  }

  spawnParked(n, avoid) {
    const placed = [];
    for (let i = 0; i < n; i++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const p = randomRoadPoint(this.rng);
        const px = p.x + (Math.abs(p.yaw) < 0.1 || Math.abs(p.yaw - Math.PI) < 0.1 ? 5.6 : 0);
        const pz = p.z + (Math.abs(p.yaw - Math.PI / 2) < 0.1 || Math.abs(p.yaw + Math.PI / 2) < 0.1 ? 5.6 : 0);
        if (avoid && avoid.some((a) => dist2d(px, pz, a[0], a[1]) < 12)) continue;
        if (placed.some((q) => dist2d(px, pz, q.x, q.z) < 14)) continue;
        const car = makeCar(this.scene, { x: px, z: pz, yaw: p.yaw, color: randomCarColor(this.rng), parked: true });
        car.driver = null;
        placed.push(car);
        this.cars.push(car);
        break;
      }
    }
    return placed;
  }

  spawnPeds(n) {
    const skin = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac];
    const shirt = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xecf0f1];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.85, 0.32),
        new THREE.MeshLambertMaterial({ color: this.rng.pick(shirt) }),
      );
      body.position.y = 1.0;
      g.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 10, 8),
        new THREE.MeshLambertMaterial({ color: this.rng.pick(skin) }),
      );
      head.position.y = 1.68;
      g.add(head);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      legL.position.set(-0.14, 0.3, 0);
      g.add(legL);
      const legR = legL.clone();
      legR.position.x = 0.14;
      g.add(legR);
      const x = this.rng.range(-220, 220);
      const z = this.rng.range(-220, 215);
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.peds.push({
        group: g, legL, legR,
        x, z, yaw: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.2, 2.2),
        tx: x, tz: z,
        flee: 0, health: 50, walkPhase: this.rng.range(0, 6),
      });
    }
  }

  update(dt, playerPos, crimePos, crimeLevel) {
    const rng = this.rng;
    // Traffic cars: cruise along their street, turn at intersections, brake for cars ahead.
    for (const car of this.cars) {
      if (!car.isTraffic || car.driver !== 'traffic' || car.parked) continue;
      const ai = car.ai;
      ai.nextTurn -= dt;
      if (ai.wait > 0) { ai.wait -= dt; driveCar(car, 0, 0, dt); continue; }
      // Brake if another car is close ahead.
      let blocked = false;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.x - car.x, dz = other.z - car.z;
        const ahead = dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw);
        const side = Math.abs(dx * Math.cos(car.yaw) - dz * Math.sin(car.yaw));
        if (ahead > 0 && ahead < 11 && side < 2.6) { blocked = true; break; }
      }
      if (blocked) { driveCar(car, -0.4, 0, dt); continue; }
      if (ai.nextTurn <= 0) {
        // At (or near) an intersection, maybe turn onto the cross street.
        const onX = STREETS.some((s) => Math.abs(car.z - s) < 2);
        const onZ = STREETS.some((s) => Math.abs(car.x - s) < 2);
        if ((onX || onZ) && rng.chance(0.45)) {
          const left = rng.chance(0.5);
          car.targetYaw = car.yaw + (left ? Math.PI / 2 : -Math.PI / 2);
          ai.nextTurn = rng.range(6, 16);
        } else {
          ai.nextTurn = rng.range(2, 5);
        }
      }
      const dyaw = ((car.targetYaw - car.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const steer = clamp(dyaw * 1.2, -1, 1);
      const throttle = car.speed < ai.speed ? 0.7 : 0.05;
      driveCar(car, throttle, steer, dt);
      // Keep inside the city; bounce back at the edge.
      if (Math.abs(car.x) > WORLD.half + 8 || Math.abs(car.z) > WORLD.half + 8) {
        car.targetYaw = car.yaw + Math.PI;
        car.x = clamp(car.x, -WORLD.half, WORLD.half);
        car.z = clamp(car.z, -WORLD.half, WORLD.half);
      }
      collideCircle(this.colliders, car, 2.2);
    }

    // Pedestrians: stroll to random sidewalk points, flee from crime.
    for (const ped of this.peds) {
      if (ped.health <= 0) continue;
      if (crimePos && dist2d(ped.x, ped.z, crimePos.x, crimePos.z) < 26) ped.flee = 3;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const away = Math.atan2(ped.x - crimePos.x, ped.z - crimePos.z);
        ped.yaw = angleLerp(ped.yaw, away, Math.min(1, dt * 4));
        ped.x += Math.sin(ped.yaw) * 4.5 * dt;
        ped.z += Math.cos(ped.yaw) * 4.5 * dt;
      } else {
        if (dist2d(ped.x, ped.z, ped.tx, ped.tz) < 2) {
          ped.tx = clamp(ped.x + rng.range(-60, 60), -225, 225);
          ped.tz = clamp(ped.z + rng.range(-60, 60), -225, 215);
        }
        const want = Math.atan2(ped.tx - ped.x, ped.tz - ped.z);
        ped.yaw = angleLerp(ped.yaw, want, Math.min(1, dt * 3));
        ped.x += Math.sin(ped.yaw) * ped.speed * dt;
        ped.z += Math.cos(ped.yaw) * ped.speed * dt;
      }
      ped.walkPhase += dt * (ped.flee > 0 ? 14 : 7);
      ped.legL.rotation.x = Math.sin(ped.walkPhase) * 0.6;
      ped.legR.rotation.x = -Math.sin(ped.walkPhase) * 0.6;
      ped.group.position.set(ped.x, 0, ped.z);
      ped.group.rotation.y = ped.yaw;
    }
  }
}
