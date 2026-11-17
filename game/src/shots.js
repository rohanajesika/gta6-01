// ?shot= staging: deterministic scenes for the four screenshots.
// The game itself stages these; nothing here is edited or composited.
import { driveCar } from './vehicles.js';

export function stageShot(G, mode) {
  const p = G.player;
  const hideStart = () => {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    G.started = true;
    G.paused = false;
  };

  // Move street life away from the staged camera so it never photobombs the shot.
  const clearNear = (x, z, r) => {
    for (const car of G.traffic.cars) {
      if (car === G.taxi || car === G.missionCar) continue;
      if (Math.hypot(car.x - x, car.z - z) < r) {
        car.x = 200 - Math.random() * 40;
        car.z = -200 + Math.random() * 60;
        car.group.position.set(car.x, 0, car.z);
      }
    }
  };
  // Move pedestrians away from a staged drive so the car does not run one over.
  const clearPeds = (x, z, r) => {
    for (const ped of G.traffic.peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < r) {
        ped.x = 200 - Math.random() * 40;
        ped.z = -200 + Math.random() * 60;
        ped.tx = ped.x; ped.tz = ped.z;
        ped.group.position.set(ped.x, 0, ped.z);
      }
    }
  };
  const gatherPeds = (x, z, n) => {
    let placed = 0;
    for (const ped of G.traffic.peds) {
      if (placed >= n) break;
      ped.x = x + (placed - n / 2) * 4 + Math.random() * 2;
      ped.z = z + 6 + Math.random() * 6;
      ped.tx = ped.x; ped.tz = ped.z;
      ped.group.position.set(ped.x, 0, ped.z);
      placed++;
    }
  };

  if (mode === 'chase') {
    // Cover: police chase with 3 wanted stars, a mission objective on the HUD.
    hideStart();
    G.missions.index = 2; G.missions.step = 1; // Harbor Lights: escape the heat
    const car = G.missionCar;
    p.enterCar(car);
    G.police.setStars(3);
    car.x = -40; car.z = 60; car.yaw = Math.PI / 2; car.speed = 26;
    car.group.position.set(car.x, 0, car.z);
    p.camYaw = Math.PI / 2;
    G.autoDrive = true;
    G.shotCamBack = 8;
    clearNear(car.x, car.z, 70);
    clearPeds(car.x, car.z, 70);
    // Cruisers hold formation slots beside the player so the chase reads on camera.
    for (const side of [4.5, -4.5]) {
      const cop = G.police.spawnPolice(car.x + 2, 60 - side);
      cop.speed = 30;
      cop.yaw = Math.PI / 2;
      cop.formation = { along: 2, side };
    }
    G.audio.sirenSet(true);
  } else if (mode === 'street') {
    // On foot in the city, pedestrians and traffic around.
    hideStart();
    p.x = -20; p.z = 0; p.yaw = Math.PI / 2; p.camYaw = p.yaw;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.yaw;
    G.missions.index = 0; G.missions.step = 0;
    gatherPeds(-14, 0, 5);
    clearNear(p.x, p.z, 30);
  } else if (mode === 'drive') {
    // Cruising down the boulevard in a yellow cab.
    hideStart();
    const car = G.taxi;
    p.enterCar(car);
    car.x = -120; car.z = 0; car.yaw = Math.PI / 2; car.speed = 24;
    car.group.position.set(car.x, 0, car.z);
    p.camYaw = Math.PI / 2;
    G.autoDrive = true;
    G.shotCamBack = 8;
    clearNear(car.x, car.z, 45);
    clearPeds(-60, 0, 70);
    G.missions.index = 0; G.missions.step = 1;
  } else if (mode === 'mission') {
    // Mission 3 at the Harbor Pier: the case, the beacon, the ocean.
    hideStart();
    G.missions.index = 2; G.missions.step = 0;
    p.x = 170; p.z = 222; p.yaw = Math.PI; p.camYaw = 0;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.yaw;
    G.police.setStars(2);
    const cop = G.police.spawnPolice(120, 150);
    cop.speed = 10;
    clearNear(p.x, p.z, 30);
  }
  // Let the scene settle, then signal the screenshot driver.
  G.shotFrames = 0;
  G.shotReadyAfter = 50;
}

export function shotTick(G) {
  if (G.shotReadyAfter === undefined) return;
  G.shotFrames += 1;
  if (G.shotFrames >= G.shotReadyAfter && !window.__shotReady) {
    // One extra beat so the HUD paints before the capture.
    requestAnimationFrame(() => { window.__shotReady = true; });
    G.shotReadyAfter = undefined;
  }
}
