// Combat and the wanted system: shooting, punching, busted/wasted,
// and the heat that brings the Bay Police down on the player.
import * as THREE from 'three';
import { CFG } from './config.js';
import { addWanted, setMessage } from './state.js';

// Fire the pistol from the camera through the crosshair. Raycasts
// against pedestrians, rival attackers and police cars; a hit on a
// bystander is a crime, a hit on a rival is mission progress.
export function shoot(state, scene, camera, peds, rivals, policeCars, trafficCars, onShot) {
  if (state.ammo <= 0) {
    setMessage(state, 'Out of ammo — find the ammo crate at the marina office', 3);
    if (onShot) onShot(null, 'empty');
    return null;
  }
  state.ammo -= 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  ray.far = CFG.PISTOL_RANGE;

  const targets = [];
  for (const p of peds) targets.push({ mesh: p.mesh, kind: 'ped', ref: p });
  for (const r of rivals) targets.push({ mesh: r.mesh, kind: 'rival', ref: r });
  for (const c of policeCars) targets.push({ mesh: c.mesh, kind: 'police', ref: c });
  for (const c of trafficCars) targets.push({ mesh: c.mesh, kind: 'car', ref: c });
  const hits = ray.intersectObjects(targets.map((t) => t.mesh), true);
  let result = null;
  if (hits.length > 0) {
    let obj = hits[0].object;
    while (obj && !targets.some((t) => t.mesh === obj)) obj = obj.parent;
    const hit = targets.find((t) => t.mesh === obj);
    if (hit) {
      result = { kind: hit.kind, point: hits[0].point.clone() };
      if (hit.kind === 'ped') {
        hit.ref.flee = true;
        addWanted(state, 1);
        setMessage(state, 'You shot a bystander — the police were called', 3);
      } else if (hit.kind === 'rival') {
        hit.ref.health -= CFG.PISTOL_DAMAGE;
        if (hit.ref.health <= 0 && !hit.ref.dead) {
          hit.ref.dead = true;
          state.kills += 1;
          state.defendLeft = Math.max(0, state.defendLeft - 1);
        }
      } else if (hit.kind === 'police') {
        addWanted(state, 1);
        setMessage(state, 'You fired on the police — wanted level up', 3);
      } else if (hit.kind === 'car') {
        hit.ref.health -= CFG.PISTOL_DAMAGE;
      }
    }
  }
  // Every shot is loud: nearby pedestrians panic, and the noise alone
  // draws a star when the player is already on the police radar.
  for (const p of peds) {
    const d = Math.hypot(p.x - state.playerX, p.z - state.playerZ);
    if (d < 30) p.panic = 4;
  }
  if (onShot) onShot(result, 'shot');
  return result;
}

// A punch: short range, no ammo, no noise — but it still counts as a
// crime when a bystander takes it.
export function punch(state, player, peds, rivals) {
  const px = player.x + Math.sin(player.angle) * 1.2;
  const pz = player.z + Math.cos(player.angle) * 1.2;
  let hitAny = false;
  for (const p of peds) {
    if (Math.hypot(p.x - px, p.z - pz) < CFG.PUNCH_RANGE) {
      p.panic = 5;
      addWanted(state, 1);
      setMessage(state, 'You assaulted a bystander — the police were called', 3);
      hitAny = true;
    }
  }
  for (const r of rivals) {
    if (!r.dead && Math.hypot(r.x - px, r.z - pz) < CFG.PUNCH_RANGE) {
      r.health -= CFG.PUNCH_DAMAGE;
      if (r.health <= 0) {
        r.dead = true;
        state.kills += 1;
        state.defendLeft = Math.max(0, state.defendLeft - 1);
      }
      hitAny = true;
    }
  }
  return hitAny;
}

// Stealing a car: an occupied traffic car loses its driver (who flees on
// foot) and the theft raises the wanted level by one star.
export function stealCar(state, car, peds) {
  if (car.occupied) {
    car.occupied = false;
    const ped = peds.find((p) => Math.hypot(p.x - car.x, p.z - car.z) < 12);
    if (ped) ped.panic = 8;
    addWanted(state, 1);
    state.carsStolen += 1;
    setMessage(state, 'Car stolen — the owner called the police', 3);
  } else {
    state.carsStolen += 1;
    setMessage(state, 'You took the car', 2);
  }
  return car;
}

// Running someone over with a car is the fastest way to five stars.
export function checkRunOver(state, car, peds) {
  for (const p of peds) {
    if (Math.abs(car.speed) < 4) continue;
    if (Math.hypot(p.x - car.x, p.z - car.z) < 2.2) {
      p.panic = 6;
      // Shove the pedestrian clear of the wheels.
      p.x += (p.x - car.x) * 0.9 + 2;
      p.z += (p.z - car.z) * 0.9 + 2;
      addWanted(state, 1);
      setMessage(state, 'You ran someone over — wanted level up', 3);
    }
  }
}

// Wanted decay: stay quiet and the heat cools, one star at a time.
export function updateWanted(state, dt) {
  if (state.wanted <= 0) return;
  state.quietTimer += dt;
  if (state.quietTimer >= CFG.WANTED_DECAY_SECONDS) {
    state.wanted -= 1;
    state.quietTimer = 0;
    if (state.wanted === 0) setMessage(state, 'You lost the police — clean again', 3);
    else setMessage(state, `Wanted level dropped to ${state.wanted} star${state.wanted > 1 ? 's' : ''}`, 3);
  }
}

// An officer on foot who reaches the player busts them: cash lost,
// a night in the cells, respawn at the cafe with half health.
export function bustPlayer(state) {
  state.over = true;
  state.overReason = 'busted';
  state.cash = Math.max(0, state.cash - 200);
}
