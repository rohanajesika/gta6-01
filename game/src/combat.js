// Combat: fists and pistol, health, ammo pickups, car damage smoke.
import * as THREE from 'three';
import { dist2d } from './config.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.pickups = [];
    this._buildPickups();
  }

  _buildPickups() {
    // Ammo crates around town: green glowing boxes.
    const spots = [[-60, -120], [60, 120], [-180, 0], [120, 180], [0, -180], [180, -120]];
    for (const [x, z] of spots) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.7, 1.1),
        new THREE.MeshLambertMaterial({ color: 0x27ae60, emissive: 0x1a5c2e }),
      );
      box.position.set(x, 0.55, z);
      this.scene.add(box);
      this.pickups.push({ mesh: box, x, z, taken: false, respawn: 0 });
    }
  }

  punch(G) {
    if (this.punchCooldown > 0) return;
    this.punchCooldown = 0.45;
    const p = G.player;
    G.audio.punch();
    const fx = G.fx;
    const px = p.x + Math.sin(p.yaw) * 1.4;
    const pz = p.z + Math.cos(p.yaw) * 1.4;
    fx.burst(px, 1.2, pz, 0xffe08a, 8, 3);
    let hitAnything = false;
    for (const ped of G.traffic.peds) {
      if (ped.health <= 0) continue;
      if (dist2d(ped.x, ped.z, px, pz) < 1.6) {
        ped.health -= 34;
        hitAnything = true;
        fx.burst(ped.x, 1.4, ped.z, 0xff5544, 10, 4);
        if (ped.health <= 0) {
          ped.group.visible = false;
          G.police.addHeat(60, 'assault');
          G.hud.toast('You knocked out a pedestrian — the cops noticed.');
        }
      }
    }
    for (const cop of G.police.cars) {
      if (dist2d(cop.x, cop.z, px, pz) < 2.4) {
        cop.health -= 25;
        hitAnything = true;
        fx.burst(cop.x, 1.2, cop.z, 0xff5544, 10, 4);
        G.police.addHeat(50, 'assault-cop');
        if (cop.health <= 0) this._disableCop(G, cop);
      }
    }
    if (hitAnything) p.crashShake = 0.25;
  }

  shoot(G) {
    if (this.shootCooldown > 0 || G.player.ammo <= 0) return;
    this.shootCooldown = 0.28;
    const p = G.player;
    p.ammo -= 1;
    G.audio.shot();
    G.fx.muzzle(p);
    G.police.addHeat(25, 'gunfire');
    // Hitscan: nearest ped / police car / traffic car within a cone of the aim.
    const dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
    let best = null, bestD = 60;
    const consider = (x, z, obj) => {
      const rx = x - p.x, rz = z - p.z;
      const along = rx * dx + rz * dz;
      const side = Math.abs(rx * dz - rz * dx);
      if (along > 0 && along < bestD && side < 1.6) { bestD = along; best = obj; }
    };
    for (const ped of G.traffic.peds) if (ped.health > 0) consider(ped.x, ped.z, { kind: 'ped', obj: ped });
    for (const cop of G.police.cars) consider(cop.x, cop.z, { kind: 'cop', obj: cop });
    for (const car of G.traffic.cars) {
      if (car === p.car) continue;
      consider(car.x, car.z, { kind: 'car', obj: car });
    }
    const hx = p.x + dx * bestD, hz = p.z + dz * bestD;
    G.fx.tracer(p, hx, hz);
    if (!best) { G.fx.burst(hx, 1.0, hz, 0xcccccc, 5, 2); return; }
    G.fx.burst(hx, 1.2, hz, 0xff5544, 12, 4);
    if (best.kind === 'ped') {
      best.obj.health -= 50;
      if (best.obj.health <= 0) {
        best.obj.group.visible = false;
        G.police.addHeat(80, 'shooting');
      }
    } else if (best.kind === 'cop') {
      best.obj.health -= 40;
      G.police.addHeat(60, 'shooting-cop');
      if (best.obj.health <= 0) this._disableCop(G, best.obj);
    } else if (best.kind === 'car') {
      best.obj.health -= 22;
      if (best.obj.health <= 0 && !best.obj.smoke) {
        best.obj.smoke = true;
        G.hud.toast('That car is wrecked.');
      }
    }
  }

  _disableCop(G, cop) {
    cop.driver = null;
    cop.speed = 0;
    G.scene.remove(cop.group);
    G.police.cars.splice(G.police.cars.indexOf(cop), 1);
    G.fx.burst(cop.x, 1.2, cop.z, 0x888888, 20, 6);
    G.hud.toast('Police cruiser disabled!');
  }

  update(dt, G) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    for (const pk of this.pickups) {
      if (pk.taken) {
        pk.respawn -= dt;
        if (pk.respawn <= 0) { pk.taken = false; pk.mesh.visible = true; }
        continue;
      }
      pk.mesh.rotation.y += dt * 1.5;
      if (dist2d(G.player.x, G.player.z, pk.x, pk.z) < 1.8) {
        pk.taken = true;
        pk.respawn = 45;
        pk.mesh.visible = false;
        G.player.ammo += 24;
        G.audio.pickup();
        G.hud.toast('+24 ammo');
      }
    }
  }
}
