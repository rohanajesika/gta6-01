// Screenshot staging. One job: given ?shot=<stage>&seed=1, put the game
// into a deterministic, readable composition for that shot, then signal
// the driver with window.__shotReady once enough frames have rendered.
import { CONFIG } from './config.js';
import { syncCarMesh } from './vehicles.js';

export function applyShot(G, stage) {
  const player = G.player;
  const taxi = G.traffic.cars.find((c) => c.isTaxi);

  // Enter the taxi where it actually sits, then move the driven car to
  // the staged spot — entering it from across the map would find no car.
  function putPlayerInTaxi(x, z, heading, speed) {
    if (player.inCar) player.exitCar();
    player.teleport(taxi.x, taxi.z + 3);
    player.tryEnterCar();
    const car = player.car;
    if (car) {
      car.x = x;
      car.z = z;
      car.heading = heading;
      car.speed = speed;
      car.parked = false;
      syncCarMesh(car);
      player.x = x;
      player.z = z;
      player.heading = heading;
      player.camYaw = heading + Math.PI;
    }
  }

  function placeCopsBehind(x, z, heading) {
    G.police.setWanted(3, true);
    const spots = [
      { x: x + 1, z: z + 16 },
      { x: x - 4, z: z + 25 },
      { x: x + 4, z: z + 34 },
    ];
    G.police.cars.forEach((car, i) => {
      const s = spots[i % spots.length];
      car.x = s.x;
      car.z = s.z;
      car.heading = heading;
      car.speed = 10;
      car.mesh.position.set(s.x, 0, s.z);
      car.mesh.rotation.y = heading;
    });
  }

  if (stage === 'chase') {
    // Cover: a police chase with wanted stars, the minimap and the
    // mission objective all on screen at once. Staged on the open road
    // x=-20, so no building ever stands between the camera and the cars.
    putPlayerInTaxi(-20, 40, 0, 9);
    placeCopsBehind(-20, 40, 0);
    G.missions.restore(0);
    G.render.setShotCamera(
      { x: -13, y: 4.5, z: 24 },
      { x: -20, y: 1.5, z: 60 },
    );
  } else if (stage === 'drive') {
    putPlayerInTaxi(20, 60, 0, 13);
    G.police.setWanted(0, true);
    G.missions.restore(0);
    // Two traffic cars ahead on the same road for depth — never the
    // player's own car.
    const ahead = G.traffic.cars.filter((c) => !c.parked && !c.isPolice && c !== G.player.car).slice(0, 2);
    if (ahead[0]) {
      ahead[0].x = 22.5; ahead[0].z = 18; ahead[0].heading = 0;
      ahead[0].mesh.position.set(22.5, 0, 18);
    }
    if (ahead[1]) {
      ahead[1].x = 17.5; ahead[1].z = -14; ahead[1].heading = 0;
      ahead[1].mesh.position.set(17.5, 0, -14);
    }
  } else if (stage === 'mission') {
    if (player.inCar) player.exitCar();
    player.teleport(-168, -168);
    player.heading = Math.atan2(-12, -12);
    player.camYaw = Math.PI / 4;
    player.mesh.position.set(-168, 0, -168);
    player.mesh.rotation.y = player.heading;
    G.police.setWanted(0, true);
    G.missions.restore(0);
    // A couple of pedestrians near the kiosk for street life.
    G.traffic.peds.slice(0, 2).forEach((ped, i) => {
      ped.x = -172 + i * 6;
      ped.z = -172;
      ped.mesh.position.set(ped.x, 0.3, ped.z);
    });
  } else {
    // 'walk' (default): Rook on foot in the plaza, taxi and city behind.
    // Note: (8, 8) is a lamp-post spot, so the player stands at (2, 12)
    // instead — otherwise the pole rises straight through his head.
    if (player.inCar) player.exitCar();
    player.teleport(2, 12);
    player.heading = Math.atan2(-8, -3);
    player.camYaw = 1.21;
    player.mesh.position.set(2, 0, 12);
    player.mesh.rotation.y = player.heading;
    G.police.setWanted(0, true);
    G.missions.restore(0);
    G.traffic.peds.slice(0, 3).forEach((ped, i) => {
      ped.x = 12 - i * 4;
      ped.z = 14 + i * 3;
      ped.mesh.position.set(ped.x, 0.3, ped.z);
    });
  }

  G.started = true;
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('crosshair').classList.remove('hidden');
}

// Count rendered frames after staging; the driver waits on this flag.
export function createShotTracker() {
  let frames = 0;
  return {
    get ready() {
      return frames >= CONFIG.shotFrames;
    },
    tick() {
      frames += 1;
      if (frames >= CONFIG.shotFrames) window.__shotReady = true;
    },
  };
}
