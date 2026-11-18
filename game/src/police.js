// Police and the wanted level. One job: turn crimes into stars, stars
// into black-and-white cruisers that hunt the player, and a long enough
// touch into a bust.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeCar, syncCarMesh } from './vehicles.js';

export function createPolice(G) {
  const cars = [];
  let wanted = 0;
  let decayTimer = 0;
  let bustTimer = 0;
  let lastCrimeAt = -99;
  const group = new THREE.Group();
  group.name = 'police';
  G.scene.add(group);

  function addWanted(n, why) {
    if (wanted >= 5) return;
    wanted = Math.min(5, wanted + n);
    lastCrimeAt = G.time;
    decayTimer = 0;
    if (why) G.hud.toast(`Wanted level ${wanted} — ${why}`);
    G.audio.setSiren(wanted > 0);
    spawnToMatch();
  }

  function spawnToMatch() {
    const want = Math.min(wanted + 1, CONFIG.police.maxCops);
    while (cars.length < want) {
      // Spawn on the player's own road line, offset along it, so the
      // cruiser starts on open tarmac with a clear run at the player —
      // a cop dropped inside a block would spend the chase grinding
      // against building walls instead of closing in.
      let bestX = CONFIG.roads[0];
      let bestZ = CONFIG.roads[0];
      for (const r of CONFIG.roads) {
        if (Math.abs(r - G.player.x) < Math.abs(bestX - G.player.x)) bestX = r;
        if (Math.abs(r - G.player.z) < Math.abs(bestZ - G.player.z)) bestZ = r;
      }
      const vertical = Math.abs(bestX - G.player.x) <= Math.abs(bestZ - G.player.z);
      let dir = G.rng.chance(0.5) ? 1 : -1;
      const off = CONFIG.police.spawnDistance * dir;
      let x;
      let z;
      let heading;
      if (vertical) {
        x = bestX;
        z = G.player.z + off;
        if (z > 195 || z < -195) { z = G.player.z - off; dir = -dir; }
        heading = dir > 0 ? Math.PI : 0;
      } else {
        x = G.player.x + off;
        z = bestZ;
        if (x > 195 || x < -195) { x = G.player.x - off; dir = -dir; }
        heading = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      const car = makeCar({
        x, z, heading,
        isPolice: true,
      });
      cars.push(car);
      group.add(car.mesh);
      syncCarMesh(car);
    }
  }

  function removeCar(car) {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    group.remove(car.mesh);
  }

  function update(dt) {
    // Wanted decays when Rook stays clean.
    if (wanted > 0 && G.time - lastCrimeAt > CONFIG.police.wantedDecaySeconds) {
      decayTimer += dt;
      if (decayTimer > CONFIG.police.wantedDecaySeconds) {
        wanted -= 1;
        decayTimer = 0;
        lastCrimeAt = G.time;
        G.hud.toast(`Wanted level ${wanted}`);
        if (wanted === 0) {
          G.audio.setSiren(false);
          for (const car of [...cars]) removeCar(car);
        }
      }
    }
    if (wanted === 0) return;
    spawnToMatch();

    const px = G.player.x;
    const pz = G.player.z;
    let touching = false;
    for (const car of [...cars]) {
      // Chase: far away, drive to the road point nearest the player
      // (roads are open); close in, steer straight at the player.
      // Slow down as the gap closes, or the turning circle is so wide
      // the cruiser can only orbit the player, never catch them.
      const dist = Math.hypot(px - car.x, pz - car.z);
      const target = dist > 30 ? G.world.nearestRoadPoint(px, pz) : { x: px, z: pz };
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const turnRate = dist > 25 ? 2.4 : 3.4;
      car.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, dh));
      car.speed = dist > 25 ? CONFIG.police.chaseSpeed : dist > 10 ? 10 : 5;
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const hit = G.world.resolveCarCollision(nx, nz, CONFIG.car.radius);
      car.x = hit.x;
      car.z = hit.z;
      if (hit.collided) car.speed *= 0.5;
      syncCarMesh(car);
      // Light bar flashes while the chase is on.
      if (car.mesh.userData.lightBar) {
        car.mesh.userData.lightBar.material.emissiveIntensity = 0.6 + Math.sin(G.time * 12) * 0.5;
      }

      if (dist < CONFIG.police.bustTouchDistance) {
        if (!G.player.inCar) {
          touching = true;
        } else if (G.time - (car.lastRamAt ?? -99) > CONFIG.police.ramCooldownSeconds) {
          // Ramming the player's car: one thud and a scrape of health
          // per cop per second — a chase must hurt, never insta-kill.
          car.lastRamAt = G.time;
          G.player.damage(CONFIG.police.ramDamage, 'rammed by police');
          G.audio.thud();
        }
      }
      // Cops too far behind fall off and are replaced by fresh ones
      // near the player — a cruiser a hundred metres back is off
      // screen anyway, and the chase must stay on the player.
      if (dist > 90) removeCar(car);
    }

    if (touching) {
      bustTimer += dt;
      G.hud.toast(`BUSTED in ${Math.max(0, CONFIG.police.bustHoldSeconds - bustTimer).toFixed(1)}s — run!`);
      if (bustTimer >= CONFIG.police.bustHoldSeconds) {
        bustTimer = 0;
        G.onBusted();
      }
    } else {
      bustTimer = 0;
    }
  }

  return {
    cars,
    get wanted() {
      return wanted;
    },
    setWanted(value, silent = false) {
      wanted = Math.max(0, Math.min(5, value));
      lastCrimeAt = G.time;
      decayTimer = 0;
      if (!silent) G.hud.toast(`Wanted level ${wanted}`);
      G.audio.setSiren(wanted > 0);
      if (wanted === 0) for (const car of [...cars]) removeCar(car);
      else spawnToMatch();
    },
    addWanted,
    update,
  };
}
