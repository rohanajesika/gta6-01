// Solmar Bay — shared constants and mission script.
// All names, places and story beats are original to this game.
export const WORLD = {
  half: 240,            // city extends -240..240 on x and z
  streetStep: 60,       // streets every 60 m
  roadW: 14,            // road width
  sidewalkW: 4,
  beachZ: 222,          // sand strip starts here (south edge)
  oceanZ: 252,
};

export const STREETS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

export const PALETTE = {
  sky: 0x87bfe8,
  sun: 0xfff2d0,
  asphalt: 0x33363b,
  sidewalk: 0x9a938a,
  sand: 0xe8d29a,
  ocean: 0x1e6f8e,
  grass: 0x5d8a4a,
  building: [0xe8dcc8, 0xd8c2a8, 0xc8b8a0, 0xf0e0d0, 0xb8c8d8, 0xd8a888, 0xe0c8b0, 0xa8b8a8],
  car: [0xc0392b, 0x2471a3, 0xf1c40f, 0x7d3c98, 0x16a085, 0xe67e22, 0x2c3e50, 0xecf0f1, 0x922b21, 0x1abc9c],
};

export const PLAYER = {
  walk: 6.5,
  run: 11,
  radius: 0.6,
  health: 100,
  startCash: 50,
  startAmmo: 30,
};

export const CAR = {
  accel: 22,
  brake: 34,
  maxSpeed: 42,
  maxReverse: 12,
  steer: 1.9,
  grip: 8,
};

export const WANTED = {
  decayDelay: 14,     // seconds with no crime and no police near before stars drop
  decayStep: 8,       // seconds per star lost while hidden
  maxStars: 5,
  heatPerStar: 100,
};

// Story: Danny Cole, a courier who owes money to the wrong people in Solmar Bay.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'Mission 1 — First Fare',
    intro: 'Mara needs a package moved across town. No questions, quick cash.',
    reward: 150,
    steps: [
      { type: 'goto', pos: [-180, -180], r: 6, text: 'Pick up the package at the Marina Kiosk' },
      { type: 'goto', pos: [120, -60], r: 6, text: 'Deliver the package to the Bayview Diner' },
    ],
  },
  {
    id: 'm2',
    title: 'Mission 2 — Borrowed Wheels',
    intro: 'Rico will pay good money for a red Comet. "Borrow" one. He never asks how.',
    reward: 300,
    steps: [
      { type: 'steal', pos: [60, 0], r: 5, text: 'Steal the red Comet on Coral Ave (press E near it)' },
      { type: 'deliver', pos: [-120, 120], r: 8, text: 'Deliver the Comet to Rico’s Garage — stay in the car' },
    ],
  },
  {
    id: 'm3',
    title: 'Mission 3 — Harbor Lights',
    intro: 'One last job: grab the case at the harbor, then disappear. The whole force is watching.',
    reward: 600,
    steps: [
      { type: 'grab', pos: [180, 210], r: 6, text: 'Grab the case at the Harbor Pier' },
      { type: 'escape', pos: [0, 0], r: 0, text: 'Lose the heat — get your wanted level to zero' },
      { type: 'goto', pos: [-180, 60], r: 6, text: 'Reach the Safehouse on Palm Row' },
    ],
  },
];

export const SAVE_KEY = 'solmar-bay-save-v1';

// Snap a world position to the nearest road centre line (used for spawns).
export function nearestRoadCoord(v) {
  let best = STREETS[0];
  let bd = Infinity;
  for (const s of STREETS) {
    const d = Math.abs(v - s);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
