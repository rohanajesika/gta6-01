// Solmar Bay — every tuning number, colour and story beat in one place.
// A coastal open-world crime game: on foot and by car, traffic, pedestrians,
// car theft, a wanted level with police response, three story missions, combat,
// a HUD with a minimap, a start screen and saving. Original city, names and art.
import * as THREE from 'three';

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-bay-save-v1';
export const CITY = {
  half: 210, // drivable city extent, metres from the centre
  roadSpacing: 60,
  roadWidth: 11,
  roads: [-180, -120, -60, 0, 60, 120, 180],
  beachX: 216, // sand starts here, east edge
  waterX: 292, // sea starts here
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 11,
  radius: 0.7,
  maxHealth: 100,
  startCash: 120,
  startAmmo: 24,
  reserveAmmo: 48,
  enterRange: 8,
  punchRange: 2.2,
  punchDamage: 25,
  bulletDamage: 34,
};

export const CAR = {
  accel: 16,
  brake: 26,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 9,
  steer: 1.9,
  drag: 0.55,
  handbrakeDrag: 4.2,
  length: 4.4,
  width: 1.9,
};

export const TRAFFIC_COUNT = 10;
export const PED_COUNT = 14;

export const WANTED = {
  max: 5,
  decaySeconds: 22, // one star fades after this long with no new crime
  bustSeconds: 3, // standing next to a cop car this long gets you busted
  bustRange: 5,
  copRamDamage: 6,
};

export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0x9fc8dd,
  ground: 0x3a3f45,
  sidewalk: 0x8d9299,
  roadLine: 0xf5d76e,
  sand: 0xe3c98f,
  water: 0x2e7fa8,
  pier: 0x8a6b4a,
  building: [0x9aa7b8, 0xb8a08a, 0x7e8fa3, 0xa89080, 0x6f7f92, 0xc2b49a, 0x8a94a6, 0x5f7086],
  roof: 0x4a4f57,
  glass: 0x2c3e50,
  playerJacket: 0xd9552c,
  playerPants: 0x2b3440,
  pedShirts: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1],
  carPaint: [0xc0392b, 0x2980b9, 0x27ae60, 0xf1c40f, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400],
  taxiYellow: 0xf7c948,
  cometRed: 0xd21f2b,
  policeWhite: 0xf2f3f4,
  policeBlue: 0x1f4fd8,
  hudText: '#f4f6f8',
  hudMuted: '#aab4bf',
  star: '#ffd23f',
  objective: '#ffe066',
};

// Danny Cole owes the Marlin crew $2,400. Three jobs clear the debt.
export const STORY = {
  intro:
    'Danny Cole owes the Marlin crew $2,400. Three jobs and the debt is gone — if the Solmar police do not catch him first.',
  missions: [
    {
      name: 'The Package',
      brief: 'Pick up the package at the Marina Kiosk, then deliver it to Harbor Pier.',
      steps: [
        { text: 'Pick up the package at the Marina Kiosk', at: [-180, -180] },
        { text: 'Deliver the package to Harbor Pier', at: [268, 180] },
      ],
      reward: 500,
    },
    {
      name: 'Borrowed Comet',
      brief: 'The crew needs a fast car. "Borrow" the red Comet parked on Coral Row and bring it to the garage on Palm Ave.',
      steps: [
        { text: 'Steal the red Comet on Coral Row', at: [120, -60], car: 'comet' },
        { text: 'Drive the Comet to the garage on Palm Ave', at: [-120, 120] },
      ],
      reward: 800,
    },
    {
      name: 'The Last Job',
      brief: 'One last pickup at Harbor Pier. The pier is guarded — deal with the guards, grab the duffel, and bring it home to Danny\'s apartment.',
      steps: [
        { text: 'Reach Harbor Pier', at: [268, 180] },
        { text: 'Deal with the pier guards (3)', at: [268, 180] },
        { text: 'Grab the duffel and take it to Danny\'s apartment', at: [-60, -120] },
      ],
      reward: 2000,
    },
  ],
};

export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse drag', 'Look around'],
  ['Shift', 'Run'],
  ['E', 'Enter / exit a car (steal it)'],
  ['F', 'Fire pistol'],
  ['Left click', 'Punch'],
  ['R', 'Reload'],
  ['Space', 'Handbrake (in a car)'],
  ['P / Esc', 'Pause'],
  ['M', 'Mute sound'],
];

export function skyColor() {
  return new THREE.Color(PALETTE.sky);
}
