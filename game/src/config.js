// Solmar Bay v2 — world constants, tuning and mission data.
// Original game for make.fun gta6-01. Every name, place and story beat is invented here.

export const WORLD = {
  GRID: 14, // blocks across / down
  BLOCK: 120, // building block side, px
  ROAD: 36, // street width, px
  PITCH: 156, // BLOCK + ROAD
  SIZE: 2184, // GRID * PITCH, world side px
  BEACH_H: 150, // sand strip along the south edge
  MARINA_W: 230, // water strip along the east edge
};

// Sun-soaked coastal palette.
export const COLORS = {
  grass: '#57a05a',
  grassDark: '#4b8f4e',
  road: '#34373d',
  roadEdge: '#4a4e55',
  lane: '#e8d44d',
  sidewalk: '#a9adb3',
  sand: '#dcc27e',
  water: '#2e6f8e',
  waterDeep: '#25607e',
  plaza: '#b9a98c',
  roofA: '#b0563c',
  roofB: '#3c6e8f',
  roofC: '#7a5a8f',
  roofD: '#c98a3c',
  roofE: '#5a7a4a',
  tree: '#2f6b34',
  treeLight: '#3f8546',
  carColors: ['#c23b2e', '#2e6fc2', '#e8b73c', '#3ca66b', '#8f3cc2', '#d8d8d8', '#222831', '#c2692e'],
  copCar: '#20242c',
  copLight: '#ff3b30',
  copLight2: '#2f7bff',
  player: '#ffd23c',
  playerCar: '#e8b73c',
};

export const TUNING = {
  walkSpeed: 178,
  runSpeed: 278,
  playerRadius: 13,
  carAccel: 400,
  carBrake: 560,
  carReverseMax: 170,
  carMaxSpeed: 440,
  carTurn: 2.7, // rad/s at full lock, scaled by speed
  carRadius: 16,
  trafficSpeedMin: 88,
  trafficSpeedMax: 145,
  pedSpeedMin: 34,
  pedSpeedMax: 62,
  bulletSpeed: 760,
  fireCooldown: 0.22,
  playerHp: 100,
  enemyHp: 45,
  enemyBulletDamage: 8,
  copRamDamage: 6,
  bustRange: 34,
  bustTime: 1.4,
  starsMax: 5,
  heatDecay: 3.2, // per second while hidden
  heatPerStar: 60,
  camZoom: 1.0,
  minimap: 168,
};

// Six story missions. Positions are block coords (bx, by); missions.js turns
// them into world coordinates with the city layout.
export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', giver: 'Lena Cruz', reward: 300,
    brief: 'Lena needs a wheelman. Steal any car, then bring it to her garage.',
    objectives: [
      { kind: 'steal', text: 'Steal a car (walk up and press E)' },
      { kind: 'goto', bx: 3, by: 5, r: 80, text: "Drive to Lena's garage" },
    ],
  },
  {
    id: 2, name: 'The Pickup', giver: 'Big T', reward: 500,
    brief: 'Big T has a friend waiting on the north side. Pick him up and drop him at the docks.',
    objectives: [
      { kind: 'goto', bx: 10, by: 3, r: 80, text: 'Drive to the pickup point' },
      { kind: 'pickup', bx: 10, by: 3, r: 60, text: 'Pick up the crew member (walk close)' },
      { kind: 'deliver', bx: 6, by: 10, r: 80, text: 'Drop him at the marina' },
    ],
  },
  {
    id: 3, name: 'Tail the Courier', giver: 'Lena Cruz', reward: 700,
    brief: 'A courier is moving product across town. Follow him for 20 seconds. Do not get spotted — stay close, not on his bumper.',
    objectives: [
      { kind: 'tail', seconds: 20, range: 280, text: 'Tail the courier (stay within range)' },
    ],
  },
  {
    id: 4, name: 'Warehouse Heat', giver: 'Big T', reward: 900,
    brief: 'Rivals are holed up in the east warehouse. Clear all four of them out.',
    objectives: [
      { kind: 'goto', bx: 12, by: 8, r: 90, text: 'Reach the east warehouse' },
      { kind: 'kill', count: 4, bx: 12, by: 8, text: 'Eliminate the rivals (0/4)' },
    ],
  },
  {
    id: 5, name: 'The Getaway', giver: 'Lena Cruz', reward: 1200,
    brief: 'Grab the package from the north lockup, then lose the heat and reach the safehouse.',
    objectives: [
      { kind: 'pickup', bx: 5, by: 2, r: 70, text: 'Grab the package' },
      { kind: 'survive', seconds: 30, stars: 3, text: 'Survive the heat (30s)' },
      { kind: 'goto', bx: 2, by: 11, r: 80, text: 'Reach the safehouse' },
    ],
  },
  {
    id: 6, name: 'City Hall Vault', giver: 'Big T', reward: 2500,
    brief: 'The big one. Crack the City Hall vault, then vanish to the safehouse with the whole city on your tail.',
    objectives: [
      { kind: 'goto', bx: 7, by: 7, r: 90, text: 'Reach City Hall plaza' },
      { kind: 'channel', seconds: 8, bx: 7, by: 7, r: 70, text: 'Crack the vault (stay in the circle)' },
      { kind: 'goto', bx: 2, by: 11, r: 80, text: 'Escape to the safehouse' },
    ],
  },
];

export const HELP_LINES = [
  'WASD / arrows — move (Shift to run)',
  'Mouse — aim, Click — shoot',
  'E — enter / exit car (steal it!)',
  'T — taxi job   P — pause   M — mute',
  'R — restart from save',
];
