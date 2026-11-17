// Deterministic screenshot scenes (?shot=1..4). Each one poses the game with a
// fixed seed so the same shot renders the same scene every run.

import { WORLD } from './config.js';
import { makeRng } from './rng.js';
import { blockCenter, randomRoadPoint } from './city.js';
import { makeCar } from './entities.js';
import { spawnEnemies } from './combat.js';
import { addWanted } from './police.js';
import { startMissionState } from './missions.js';

export function applyShot(G, n) {
  const rng = makeRng(1000 + n);
  const p = G.player;
  const downtown = { x: 7 * WORLD.PITCH, y: 6 * WORLD.PITCH };

  if (n === 1) {
    // Title screen over a busy downtown intersection.
    G.mode = 'title';
    p.x = downtown.x; p.y = downtown.y;
    G.camera.x = downtown.x; G.camera.y = downtown.y;
    for (let i = 0; i < 6; i++) {
      const rp = randomRoadPoint(G.city, rng);
      const c = makeCar(rp.x, rp.y, 0, '#c23b2e', 'traffic');
      c.line = 'v'; c.linePos = rp.x; c.dir = 1;
      c.targetSpeed = 110; c.speed = 110;
      G.cars.push(c);
    }
    return;
  }

  G.mode = 'play';
  if (n === 2) {
    // Driving through downtown — the car is freshly stolen, so the first
    // mission objective completes on the next frame and the garage marker shows.
    const c = makeCar(downtown.x, downtown.y - 40, -Math.PI / 2, '#e8b73c', 'player');
    c.speed = 230;
    c.stolen = true;
    G.cars.push(c);
    p.inCar = c; c.isPlayer = true;
    p.x = c.x; p.y = c.y;
    G.autoDrive = true;
    G.events.push({ type: 'steal' });
    G.camera.x = c.x; G.camera.y = c.y;
    for (let i = 0; i < 5; i++) {
      const rp = randomRoadPoint(G.city, rng);
      const t = makeCar(rp.x, rp.y, 0, '#2e6fc2', 'traffic');
      t.line = 'h'; t.linePos = rp.y; t.dir = 1;
      t.targetSpeed = 120; t.speed = 120;
      G.cars.push(t);
    }
    G.message = 'Solmar Bay — downtown cruise';
    G.messageAt = G.time;
    return;
  }

  if (n === 3) {
    // Three-star police chase, starting on the 936 street heading east.
    const c = makeCar(downtown.x, downtown.y, 0, '#e8b73c', 'player');
    c.speed = 300;
    G.cars.push(c);
    p.inCar = c; c.isPlayer = true;
    p.x = c.x; p.y = c.y;
    G.autoDrive = true;
    addWanted(G, 3);
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(c.x - 180 - i * 90, c.y + (i - 1) * 60, 0, '#20242c', 'cop');
      cop.speed = 320; cop.targetSpeed = 330;
      G.cops.push(cop);
      G.cars.push(cop);
    }
    G.camera.x = c.x; G.camera.y = c.y;
    G.message = '3 stars — lose the cops!';
    G.messageAt = G.time;
    return;
  }

  // Shot 4: mission 4 (Warehouse Heat) in progress.
  G.missionIndex = 3;
  startMissionState(G);
  const wh = blockCenter(G.city, 12, 8);
  p.inCar = null;
  p.x = wh.x - 90; p.y = wh.y + 40;
  p.hp = 100;
  // Jump straight to the kill objective and put the rivals in frame.
  G.mission.objIndex = 1;
  G.mission.progress = 0;
  spawnEnemies(G, wh.x, wh.y, 4);
  addWanted(G, 1);
  G.camera.x = wh.x; G.camera.y = wh.y;
  G.message = 'Mission 4: Warehouse Heat — clear the rivals';
  G.messageAt = G.time;
}
