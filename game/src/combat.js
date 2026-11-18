// Combat. One job: the pistol — fire, tracer, hit, and the consequences.
// Shooting is hitscan from the camera through the crosshair.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createCombat(G) {
  let cooldown = 0;
  let lastWantedShotAt = -99;
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1);
  const tracers = [];

  function muzzleWorldPos() {
    const p = G.player;
    return new THREE.Vector3(
      p.x + Math.sin(p.heading) * 0.8,
      1.4,
      p.z + Math.cos(p.heading) * 0.8,
    );
  }

  function shoot() {
    if (G.player.inCar) return;
    if (cooldown > 0) return;
    if (G.player.ammo <= 0) {
      G.hud.toast('Out of ammo — finish a mission to restock');
      G.audio.click();
      return;
    }
    cooldown = CONFIG.player.shootCooldown;
    G.player.ammo -= 1;
    G.audio.shot();
    G.effects.muzzle(muzzleWorldPos(), G.player.heading);

    // Aim from the camera through the centre of the screen.
    const origin = new THREE.Vector3();
    G.camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    const range = CONFIG.player.shootRange;

    // Find the closest thing the shot can hit: a pedestrian, a cop car,
    // a traffic car, or a building (which just eats the bullet).
    let bestT = range;
    let bestKind = null;
    let bestTarget = null;
    const ray = new THREE.Ray(origin, dir);
    const hitPoint = new THREE.Vector3();
    function testSphere(cx, cy, cz, r, kind, target) {
      const c = new THREE.Vector3(cx, cy, cz);
      const t = ray.distanceToPoint(c);
      if (t < 0 || t > bestT) return;
      // Perpendicular distance from the ray to the centre.
      const closest = new THREE.Vector3().copy(dir).multiplyScalar(t).add(origin);
      if (closest.distanceTo(c) > r + 0.4) return;
      bestT = t;
      bestKind = kind;
      bestTarget = target;
      hitPoint.copy(closest);
    }
    for (const ped of G.traffic.peds) {
      if (ped.alive) testSphere(ped.x, 1.1, ped.z, 0.7, 'ped', ped);
    }
    for (const car of G.police.cars) testSphere(car.x, 1.0, car.z, 2.2, 'cop', car);
    for (const car of G.traffic.cars) {
      if (car.parked || car === G.player.car) continue;
      testSphere(car.x, 1.0, car.z, 2.2, 'car', car);
    }
    const end = new THREE.Vector3().copy(dir).multiplyScalar(bestT).add(origin);
    const tracer = new THREE.Mesh(tracerGeo, tracerMat);
    const mid = new THREE.Vector3().addVectors(origin, end).multiplyScalar(0.5);
    tracer.position.copy(mid);
    tracer.lookAt(end);
    tracer.scale.z = Math.max(0.1, bestT);
    G.scene.add(tracer);
    tracers.push({ mesh: tracer, life: 0.09 });

    if (bestKind === 'ped') {
      const ped = bestTarget;
      ped.alive = false;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.5;
      G.effects.burst(ped.x, 0.8, ped.z, 0xd84a4a, 12);
      G.police.addWanted(1, 'shot a pedestrian');
    } else if (bestKind === 'cop') {
      G.effects.burst(bestTarget.x, 1.2, bestTarget.z, 0xffd23e, 10);
      G.police.addWanted(1, 'shot at police');
    } else if (bestKind === 'car') {
      G.effects.burst(bestTarget.x, 1.0, bestTarget.z, 0x9aa0a8, 8);
    } else {
      // A miss still draws the heat if the cops hear it recently enough.
      if (G.time - lastWantedShotAt > 10) {
        lastWantedShotAt = G.time;
        if (G.police.wanted > 0) G.police.addWanted(1, 'shots fired');
      }
    }
  }

  function update(dt) {
    if (cooldown > 0) cooldown -= dt;
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        G.scene.remove(t.mesh);
        tracers.splice(i, 1);
      }
    }
  }

  return { shoot, update };
}
