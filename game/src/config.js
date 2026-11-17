// Solmar Bay — world constants and tuning. One clear job: every number the
// rest of the game agrees on lives here, so a tweak lands in one place.
export const TILE = 64;
export const ROAD_W = 56;
export const BLOCK = 320; // road centre to road centre
export const GRID = 14; // roads per axis (0..13)
export const WORLD = GRID * BLOCK; // 4480 px square city
export const BEACH_H = 300; // sand strip along the south edge

export const COLORS = {
  grass: '#7fb069',
  grassDark: '#74a35f',
  sand: '#e8cf9a',
  sea: '#2f7fb8',
  seaDeep: '#256b9e',
  road: '#3a3f4a',
  roadEdge: '#2c3038',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#d9a05b', '#e8c07a', '#7fa8a0', '#b08968', '#a26769', '#8d9b6a', '#d68c8c'],
  buildingEdge: '#00000033',
  park: '#5e9a52',
};

// Player / car tuning
export const PLAYER = {
  radius: 13,
  walkSpeed: 235,
  runSpeed: 320,
  health: 100,
};

export const CAR = {
  length: 52,
  width: 26,
  accel: 520,
  brake: 900,
  reverseAccel: 320,
  maxSpeed: 560,
  maxReverse: 190,
  turnRate: 2.9,
  grip: 3.4,
};

export const POLICE = {
  spawnInterval: 2.2,
  maxCops: 10,
  ramSpeed: 590,
};

export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  decaySeconds: 14,
};

// Deterministic random: mulberry32. Shots and tests pass a fixed seed;
// normal play seeds from the clock.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
