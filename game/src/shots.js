// Screenshot scenes behind ?shot=chase|street|drive|mission (with &seed=N).
// Each one poses the real game — same renderer, same rules — in a fixed
// state, so the frame is what a short game really looks like and the same
// seed always gives the same frame.
import { refreshMarker } from './missions.js';

function putPlayerInCar(G, car, speed) {
  const p = G.player;
  p.inCar = true;
  p.car = car;
  car.parked = false;
  car.speed = speed;
  p.mesh.visible = false;
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
}

export function stageShot(name, G) {
  const p = G.player;
  G.screen = 'play';
  G.started = true;
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');

  if (name === 'chase') {
    // Police chase while driving: wanted 3, two cop cars closing in, the
    // mission objective and the minimap visible on the HUD. Everything sits
    // on the road x=0 so the chase camera has a clear view.
    const taxi = G.traffic.taxi;
    taxi.x = 0; taxi.z = 40; taxi.heading = 0;
    taxi.mesh.position.set(taxi.x, 0, taxi.z);
    taxi.mesh.rotation.y = taxi.heading;
    putPlayerInCar(G, taxi, 24);
    p.camYaw = taxi.heading + Math.PI;
    G.camYaw = p.camYaw;
    G.police.wanted = 3;
    G.police.quietTimer = 0;
    G.missions.index = 0;
    G.missions.step = 1;
    refreshMarker(G);
    const cops = [
      G.police.spawnCopAt(G, taxi.x - 4, taxi.z + 20, 0),
      G.police.spawnCopAt(G, taxi.x + 3, taxi.z - 18, 0),
    ];
    for (const c of cops) { c.speed = 22; c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.heading; }
    G.hud.say('Wanted level 3 — lose the cops!');
  } else if (name === 'drive') {
    // Cruising down Coral Row in the taxi.
    const taxi = G.traffic.taxi;
    taxi.x = 60; taxi.z = -40; taxi.heading = Math.PI;
    taxi.mesh.position.set(taxi.x, 0, taxi.z);
    taxi.mesh.rotation.y = taxi.heading;
    putPlayerInCar(G, taxi, 18);
    p.camYaw = taxi.heading + Math.PI;
    G.camYaw = p.camYaw;
    G.missions.index = 0;
    G.missions.step = 0;
    refreshMarker(G);
  } else if (name === 'mission') {
    // On foot on the road by the Marina Kiosk, looking at the kiosk and the
    // mission beacon. Standing just outside the 12 m pickup radius so the
    // scene stays on step 0 instead of advancing while the world settles.
    p.x = -156; p.z = -180;
    p.heading = -Math.PI / 4;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.camYaw = p.heading + Math.PI;
    G.camYaw = p.camYaw;
    G.missions.index = 0;
    G.missions.step = 0;
    refreshMarker(G);
    G.hud.say('Pick up the package at the Marina Kiosk.');
  } else {
    // street: on foot at a busy downtown intersection, traffic and
    // pedestrians around.
    p.x = 4; p.z = 6;
    p.heading = 0.4;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.camYaw = 0.4 + Math.PI;
    G.camYaw = p.camYaw;
    G.missions.index = 0;
    G.missions.step = 0;
    refreshMarker(G);
  }
  // Let the world settle for a few frames so traffic and peds spread out.
  for (let i = 0; i < 30; i += 1) {
    G.stepWorld(1 / 60, true);
  }
  // The settle steps coast the cars down; put the staged speeds back so the
  // chase and drive shots show motion.
  if (name === 'chase' && p.inCar && p.car) p.car.speed = 24;
  if (name === 'drive' && p.inCar && p.car) p.car.speed = 18;
  return { screen: 'play' };
}
