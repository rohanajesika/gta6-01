// Wanted level and police. Crimes raise stars (max 5); stars fade after a
// quiet stretch. Police cars spawn on the roads, chase the player, ram the
// player's car, and bust the player on foot when they stand close too long.
import { WANTED, PALETTE, CITY } from './config.js';
import { createCar } from './vehicles.js';
import { collideCircle, clampToCity } from './city.js';
import { damagePlayer } from './player.js';

export function createPolice(scene) {
  return {
    scene,
    wanted: 0,
    cars: [],
    quietTimer: 0,
    bustTimer: 0,
    ramCooldown: 0,
  };
}

export function addWanted(G, stars, reason) {
  const p = G.police;
  const before = p.wanted;
  p.wanted = Math.min(WANTED.max, p.wanted + stars);
  p.quietTimer = 0;
  if (p.wanted > before) {
    G.hud.say(reason || `Wanted level ${p.wanted}`);
    G.audio.setSiren(true, 0);
  }
}

function spawnCop(G) {
  // Spawn on a road near the player (never inside a block), so the chase
  // is never stuck behind a building from the start.
  const p = G.player;
  const roads = CITY.roads;
  const nearest = (v) => roads.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const sign = G.rng.next() > 0.5 ? 1 : -1;
  let x;
  let z;
  if (G.rng.next() > 0.5) {
    x = nearest(p.x);
    z = clampToCity(p.x, p.z + sign * 55).z;
  } else {
    z = nearest(p.z);
    x = clampToCity(p.x + sign * 55, p.z).x;
  }
  return spawnCopAt(G, x, z, Math.atan2(p.x - x, p.z - z));
}

export function spawnCopAt(G, x, z, heading) {
  const car = createCar(G.scene, {
    x, z, heading,
    color: PALETTE.policeWhite, kind: 'police', speed: 12,
  });
  G.police.cars.push(car);
  return car;
}

export function updatePolice(G, dt) {
  const p = G.police;
  p.ramCooldown = Math.max(0, p.ramCooldown - dt);
  G.audio.setSiren(p.wanted > 0, dt);

  // Wanted stars fade after a quiet stretch with no new crime.
  if (p.wanted > 0) {
    p.quietTimer += dt;
    if (p.quietTimer > WANTED.decaySeconds && p.cars.length === 0) {
      p.wanted -= 1;
      p.quietTimer = 0;
      G.hud.say(p.wanted === 0 ? 'You lost the cops.' : `Wanted level down to ${p.wanted}`);
    }
  }

  // Keep one cop car per star (up to 4) while wanted.
  const wantCops = Math.min(4, p.wanted);
  while (p.cars.length < wantCops) spawnCop(G);

  // Chase: steer toward the player, faster than traffic, ramming on contact.
  for (const car of [...p.cars]) {
    const dx = G.player.x - car.x;
    const dz = G.player.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (p.wanted === 0 && dist > 120) {
      car.removed = true;
      car.mesh.visible = false;
      p.cars.splice(p.cars.indexOf(car), 1);
      continue;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const targetSpeed = dist > 12 ? 26 : 14;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    if (!collideCircle(G.city.colliders, nx, nz, 1.6)) {
      car.x = nx;
      car.z = nz;
    } else if (!collideCircle(G.city.colliders, nx, car.z, 1.6)) {
      car.x = nx; // slide along the building face instead of stopping dead
    } else if (!collideCircle(G.city.colliders, car.x, nz, 1.6)) {
      car.z = nz;
    }
    const c = clampToCity(car.x, car.z);
    car.x = c.x;
    car.z = c.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;

    if (dist < 4.5) {
      if (G.player.inCar && G.player.car) {
        // Ram: shove the player's car and slow it down.
        if (p.ramCooldown <= 0) {
          G.player.car.speed *= 0.55;
          damagePlayer(G, WANTED.copRamDamage, 'busted');
          G.audio.crash();
          G.effects.burst(car.x, 1, car.z, 0xff5533, 8);
          p.ramCooldown = 1.2;
        }
      } else {
        // On foot: standing next to a cop car starts the bust timer.
        p.bustTimer += dt;
        G.hud.say(`The police are grabbing you... ${Math.ceil(WANTED.bustSeconds - p.bustTimer)}`);
        if (p.bustTimer >= WANTED.bustSeconds) {
          G.endGame('busted');
          return;
        }
      }
    } else {
      p.bustTimer = Math.max(0, p.bustTimer - dt * 2);
    }
  }
}
