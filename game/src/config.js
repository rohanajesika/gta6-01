// Solmar Bay — configuration and mission data.
// One job: every tunable number and every story beat lives here, so the
// rest of the game reads plain values instead of hiding magic numbers.

export const CONFIG = {
  // World layout: a 400x400 m coastal city, roads every 40 m.
  worldHalf: 200,
  roadSpacing: 40,
  roadWidth: 12,
  roads: [-180, -140, -100, -60, -20, 20, 60, 100, 140, 180],
  // Beach strip west of the city, then open water.
  beachX: -200,
  sandFrom: -252,
  waterFrom: -560,

  // The plaza block at the city centre stays building-free; the taxi waits
  // there. A 6 m service alley (x in [-9, -3]) stays clear of buildings so
  // a car driven south from the plaza always has a lane.
  plazaHalf: 14,
  alleyMin: -9,
  alleyMax: -3,

  player: {
    walkSpeed: 8,
    runSpeed: 12.5,
    jumpSpeed: 7.5,
    gravity: 22,
    radius: 0.6,
    maxHealth: 100,
    startCash: 250,
    startAmmo: 48,
    maxAmmo: 120,
    enterRange: 6,
    shootRange: 70,
    shootDamage: 34,
    shootCooldown: 0.28,
  },

  car: {
    accel: 15,
    brake: 32,
    maxSpeed: 27,
    reverseMax: 9,
    steerRate: 2.1,
    radius: 1.9,
    length: 4.4,
    width: 2.0,
  },

  traffic: {
    movingCars: 10,
    parkedCars: 10,
    pedestrians: 24,
    cruiseSpeed: 9,
  },

  police: {
    wantedDecaySeconds: 22,
    maxCops: 6,
    chaseSpeed: 17.5,
    spawnDistance: 26,
    bustHoldSeconds: 1.6,
    bustTouchDistance: 3.2,
    ramDamage: 6,
    ramCooldownSeconds: 1.2,
  },

  saveKey: 'solmar-bay-save-v1',
  shotFrames: 25,
};

// Story: Rook, a wheelman new to Solmar Bay, runs jobs for Mara Voss, a
// fixer who works out of the Marina Kiosk. Three jobs, each with its steps;
// finish the last one and the city is his.
export const MISSIONS = [
  {
    id: 'first-pickup',
    title: 'First Pickup',
    briefing:
      'Mara Voss needs a driver she can trust. Meet her at the Marina Kiosk, south-west corner of the bay, then move her car.',
    reward: 500,
    steps: [
      {
        objective: 'Meet Mara at the Marina Kiosk',
        pos: { x: -180, z: -180 },
        kind: 'goto',
        radius: 9,
      },
      {
        objective: 'Steal a car and deliver it to Sunset Garage',
        pos: { x: 180, z: 180 },
        kind: 'deliver_car',
        radius: 11,
      },
    ],
  },
  {
    id: 'heat-run',
    title: 'Heat Run',
    briefing:
      'The delivery was flagged. Bay PD is on you — three stars and climbing. Lose the heat: get your wanted level to zero.',
    reward: 800,
    steps: [
      {
        objective: 'Lose the cops — get wanted level to zero',
        pos: null,
        kind: 'escape',
        radius: 0,
      },
    ],
  },
  {
    id: 'last-delivery',
    title: 'The Last Delivery',
    briefing:
      'One last package for Mara, to Pier Point on the north-west shore. Bring it in clean and the bay is yours.',
    reward: 1200,
    steps: [
      {
        objective: 'Deliver the package to Pier Point',
        pos: { x: -180, z: 180 },
        kind: 'goto',
        radius: 9,
      },
    ],
  },
];

export const STORY_COMPLETE_TITLE = 'Story Complete';
export const STORY_COMPLETE_TEXT =
  'The package is delivered, Mara is paid, and Solmar Bay is yours. Free roam continues — keep the engine warm.';
