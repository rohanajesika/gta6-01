// Wanted stars and the Solmar Bay Police Department: chase, ram, bust.
import * as THREE from 'three';
import { WANTED, clamp, dist2d, angleLerp } from './config.js';
import { makeCar, driveCar } from './vehicles.js';
import { collideCircle } from './city.js';

export class Police {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.cars = [];
    this.heat = 0;            // 0..500, stars = ceil(heat / 100)
    this.stars = 0;
    this.quietTimer = 0;
    this.bustTimer = 0;
    this.spawnTimer = 0;
  }

  get wanted() { return this.stars; }

  addHeat(amount, reason) {
    this.heat = clamp(this.heat + amount, 0, WANTED.maxStars * WANTED.heatPerStar);
    this.quietTimer = 0;
    this.stars = Math.ceil(this.heat / WANTED.heatPerStar);
    return reason;
  }

  setStars(n) {
    this.heat = n * WANTED.heatPerStar;
    this.stars = n;
  }

  spawnPolice(x, z) {
    const car = makeCar(this.scene, { x, z, yaw: 0, color: 0x1a1a1a, kind: 'police' });
    car.driver = 'police';
    this.cars.push(car);
    return car;
  }

  update(dt, player, onBusted) {
    // Quiet time decays heat when no police can see the player.
    const px = player.x, pz = player.z;
    let nearest = Infinity;
    for (const c of this.cars) nearest = Math.min(nearest, dist2d(c.x, c.z, px, pz));
    if (this.stars > 0) {
      if (nearest > 55) {
        this.quietTimer += dt;
        if (this.quietTimer > WANTED.decayDelay) {
          this.heat -= (WANTED.heatPerStar / WANTED.decayStep) * dt;
          this.stars = Math.ceil(Math.max(0, this.heat) / WANTED.heatPerStar);
          if (this.stars <= 0) { this.heat = 0; this.stars = 0; }
        }
      } else {
        this.quietTimer = 0;
      }
    }

    // Keep the right number of cruisers on the street.
    const want = this.stars === 0 ? 0 : Math.min(1 + this.stars, 5);
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.spawnPolice(px + Math.sin(a) * 70, pz + Math.cos(a) * 70);
      this.spawnTimer = 2.5;
    }
    if (this.cars.length > want) {
      // Despawn the farthest cruiser when the heat drops.
      let far = null, farD = -1;
      for (const c of this.cars) {
        const d = dist2d(c.x, c.z, px, pz);
        if (d > farD) { farD = d; far = c; }
      }
      if (far && farD > 60) {
        this.scene.remove(far.group);
        this.cars.splice(this.cars.indexOf(far), 1);
      }
    }

    // Chase: steer toward the player, ram on contact.
    for (const car of this.cars) {
      const d = dist2d(car.x, car.z, px, pz);
      let steer, throttle;
      if (car.formation) {
        // Hold a slot beside the player (used to stage the chase shot).
        const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
        const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
        const tx = px + fx * car.formation.along + rx * car.formation.side;
        const tz = pz + fz * car.formation.along + rz * car.formation.side;
        const wantYaw = Math.atan2(tx - car.x, tz - car.z);
        const dyaw = ((wantYaw - car.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        steer = clamp(dyaw * 1.4, -1, 1);
        const targetSpeed = (player.car ? Math.abs(player.car.speed) : 0) + 1;
        throttle = car.speed < targetSpeed ? 1 : 0.1;
      } else {
        const wantYaw = Math.atan2(px - car.x, pz - car.z);
        const dyaw = ((wantYaw - car.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        steer = clamp(dyaw * 1.4, -1, 1);
        const speedTarget = (15 + this.stars * 3.2) * (car.boost || 1);
        throttle = car.speed < speedTarget ? 1 : 0.1;
      }
      driveCar(car, throttle, steer, dt);
      collideCircle(this.colliders, car, 2.2);
      // Flash the light bar.
      const t = performance.now() / 180;
      const red = car.group.userData.lightRed;
      const blue = car.group.userData.lightBlue;
      if (red && blue) {
        const phase = Math.sin(t) > 0;
        red.material.color.setHex(phase ? 0xff0000 : 0x550000);
        blue.material.color.setHex(phase ? 0x112244 : 0x2266ff);
      }
      // Ram the player (formation cruisers hold their slot instead).
      if (d < 3.4 && !car.formation) {
        if (player.inCar) {
          player.car.speed *= 0.55;
          player.car.x += Math.sin(car.yaw) * 1.2;
          player.car.z += Math.cos(car.yaw) * 1.2;
          player.car.group.position.set(player.car.x, 0, player.car.z);
          player.crashShake = 0.5;
        } else {
          player.health -= 18 * dt;
          player.crashShake = 0.5;
        }
        if (player.onCrime) player.onCrime('ram', car);
      }
    }

    // Busted: a cruiser sits on top of the player on foot.
    if (this.stars > 0 && !player.inCar && nearest < 3.2) {
      this.bustTimer += dt;
      if (this.bustTimer > 1.6) {
        this.bustTimer = 0;
        onBusted();
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }
}
