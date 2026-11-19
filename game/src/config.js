// Solmar Bay — shared tuning constants for the whole game.
// One place for every number the other modules agree on, so a balance
// change never has to be hunted through five files.
export const CFG = {
  // City layout: roads run on a square grid, BLOCK apart, ROAD wide.
  BLOCK: 44,
  ROAD: 12,
  ROAD_COUNT: 9, // road centre lines at -176 .. +176
  CITY_HALF: 198, // playable edge; the beach and sea lie south of it
  SEA_Z: 216, // the waterline starts here (south edge)

  // Player on foot.
  WALK_SPEED: 7,
  RUN_SPEED: 11.5,
  PLAYER_RADIUS: 0.9,
  PLAYER_HEALTH: 100,

  // Driving.
  CAR_ACCEL: 26,
  CAR_BRAKE: 42,
  CAR_REVERSE: 12,
  CAR_MAX_SPEED: 34,
  CAR_TURN: 1.9,
  CAR_RADIUS: 1.6,

  // Traffic and crowds.
  TRAFFIC_CARS: 14,
  PEDESTRIANS: 26,
  TRAFFIC_SPEED: 9,

  // Police and wanted level.
  WANTED_MAX: 5,
  WANTED_DECAY_SECONDS: 28, // quiet seconds before one star drops
  POLICE_CARS_PER_STAR: 1,
  POLICE_TOP_SPEED: 30,
  BUST_DISTANCE: 2.6, // an officer this close on foot busts the player

  // Combat.
  PISTOL_DAMAGE: 34,
  PISTOL_AMMO: 12,
  PISTOL_RANGE: 60,
  PUNCH_DAMAGE: 12,
  PUNCH_RANGE: 2.4,

  // Economy.
  START_CASH: 250,
  MISSION_REWARDS: [400, 650, 900, 1200, 2500],
};

// Sun-soaked coastal palette: warm sand, pastel towers, teal sea.
export const PALETTE = {
  sky: 0x8ec9e8,
  fog: 0xa8d4e6,
  sand: 0xe8d3a8,
  grass: 0x7fae62,
  asphalt: 0x3a3f46,
  sidewalk: 0xb9b3a4,
  sea: 0x1e7f9e,
  building: [0xf2d8a7, 0xe8a87c, 0xf7ede2, 0xa8c8d8, 0xd8a0a8, 0xc8d8a0, 0xe8c8e0, 0xb8b8d8],
  car: [0xc0392b, 0x2471a3, 0xf1c40f, 0x1e8449, 0x7d3c98, 0xe67e22, 0xeeeeee, 0x222222, 0x16a085],
  police: 0x1a2a4a,
  pedSkin: [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0],
  pedShirt: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x34495e],
};

// Mission story beats. Positions are world coordinates the mission
// module turns into markers, objectives and rewards.
export const MISSION_DEFS = [
  {
    id: 'm1',
    title: 'First Wheels',
    giver: 'Delia Kross',
    brief: 'Delia needs a ride, fast. Take the parked coupe on Coral Row and bring it to the garage on Palm Court.',
    steps: [
      { kind: 'goto', label: 'Steal the coupe on Coral Row', x: -88, z: 22 },
      { kind: 'drive', label: 'Drive the coupe to the Palm Court garage', x: 44, z: -88 },
    ],
  },
  {
    id: 'm2',
    title: 'Bayfront Pickup',
    giver: 'Delia Kross',
    brief: 'A package is waiting at the marina pier. Pick it up on foot and walk it back to Delia at the cafe. Keep it quiet — no heat.',
    steps: [
      { kind: 'goto', label: 'Collect the package at the marina pier', x: 0, z: 190 },
      { kind: 'goto', label: 'Deliver the package to Delia at the cafe', x: -44, z: -22 },
    ],
  },
  {
    id: 'm3',
    title: 'The Getaway',
    giver: 'Marco Reyes',
    brief: 'Marco borrowed the wrong car. The Bay Police are already rolling. Lose them — drop your wanted level to zero.',
    steps: [
      { kind: 'escape', label: 'Lose the police — get your wanted level to zero', x: 0, z: 0 },
    ],
  },
  {
    id: 'm4',
    title: 'Dockside Deal',
    giver: 'Delia Kross',
    brief: 'Rivals are crashing the dockside deal. Hold the pier and drive them off — your pistol is loaded, make it count.',
    steps: [
      { kind: 'defend', label: 'Defend the pier — stop 4 rivals', x: 44, z: 176 },
    ],
  },
  {
    id: 'm5',
    title: 'Solmar Heist',
    giver: 'Delia Kross',
    brief: 'The big one. Grab the vault case from the marina office, then outrun the whole city to the hideout on Coral Row.',
    steps: [
      { kind: 'goto', label: 'Grab the vault case at the marina office', x: -44, z: 176 },
      { kind: 'drive', label: 'Escape to the hideout on Coral Row', x: -88, z: 66 },
    ],
  },
];

// Where the story's named places sit, for the HUD and the minimap.
export const PLACES = [
  { name: 'Marina Pier', x: 0, z: 190 },
  { name: 'Palm Court Garage', x: 44, z: -88 },
  { name: 'Coral Row', x: -88, z: 22 },
  { name: 'Cafe Delia', x: -44, z: -22 },
  { name: 'Hideout', x: -88, z: 66 },
  { name: 'Solmar Beach', x: 0, z: 210 },
];
