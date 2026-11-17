// Story missions (six, in order) and the taxi side job.
// Objectives resolve block coords to world coords through the city layout.

import { MISSIONS, TUNING } from './config.js';
import { blockCenter, randomRoadPoint } from './city.js';
import { makeCar } from './entities.js';
import { spawnEnemies } from './combat.js';
import { addWanted } from './police.js';
import { dist2 } from './rng.js';

export function currentMission(G) {
  return MISSIONS[G.missionIndex] || null;
}

export function currentObjective(G) {
  const m = currentMission(G);
  if (!m || !G.mission) return null;
  return m.objectives[G.mission.objIndex] || null;
}

export function startMissionState(G) {
  const m = currentMission(G);
  if (!m) return;
  G.mission = { def: m, objIndex: 0, progress: 0, timer: 0, started: false };
  beginObjective(G);
}

function beginObjective(G) {
  const obj = currentObjective(G);
  if (!obj || !G.mission) return;
  G.mission.progress = 0;
  G.mission.timer = 0;
  G.mission.started = false;
  if (obj.kind === 'tail') {
    const p = randomRoadPoint(G.city, G.rng);
    const car = makeCar(p.x, p.y, 0, '#7a2e8f', 'mission');
    car.line = 'v'; car.linePos = p.x; car.dir = 1;
    car.targetSpeed = 120; car.speed = 120;
    G.cars.push(car);
    G.mission.courier = car;
    G.mission.waypoint = randomRoadPoint(G.city, G.rng);
  }
  if (obj.kind === 'kill') {
    const c = blockCenter(G.city, obj.bx, obj.by);
    spawnEnemies(G, c.x, c.y, obj.count);
    G.mission.started = true;
  }
  if (obj.kind === 'survive') {
    addWanted(G, obj.stars || 3);
    G.mission.started = true;
  }
  if (obj.kind === 'channel') {
    addWanted(G, 4);
    G.mission.started = true;
  }
}

export function objectivePos(G, obj) {
  if (!obj) return null;
  if (obj.kind === 'tail') {
    const c = G.mission && G.mission.courier;
    return c ? { x: c.x, y: c.y } : null;
  }
  if (obj.kind === 'survive' || obj.kind === 'steal') return null;
  if (obj.kind === 'kill') {
    return blockCenter(G.city, obj.bx, obj.by);
  }
  if (obj.bx !== undefined) return blockCenter(G.city, obj.bx, obj.by);
  return null;
}

export function noteEvent(G, ev) {
  const obj = currentObjective(G);
  if (!obj || !G.mission) return;
  if (ev.type === 'steal' && obj.kind === 'steal') completeObjective(G);
  if (ev.type === 'kill' && obj.kind === 'kill') {
    G.mission.progress += 1;
    if (G.mission.progress >= obj.count) completeObjective(G);
  }
}

function completeObjective(G) {
  const m = G.mission.def;
  G.mission.objIndex += 1;
  G.events.push({ type: 'objective', text: 'Objective complete!' });
  if (G.mission.objIndex >= m.objectives.length) {
    completeMission(G);
  } else {
    beginObjective(G);
  }
}

function completeMission(G) {
  const m = G.mission.def;
  G.cash += m.reward;
  G.missionsDone.push(m.id);
  G.message = 'Mission complete: ' + m.name + '  +$' + m.reward;
  G.events.push({ type: 'missionDone' });
  G.mission = null;
  G.missionIndex += 1;
  if (G.missionIndex >= MISSIONS.length) {
    G.message = 'Story complete! Solmar Bay is yours. +$' + m.reward;
    G.events.push({ type: 'storyDone' });
  } else {
    startMissionState(G);
    G.message = 'New mission: ' + currentMission(G).name + ' — ' + currentMission(G).brief;
  }
  G.events.push({ type: 'autosave' });
}

export function updateMissions(G, dt) {
  const obj = currentObjective(G);
  if (!obj || !G.mission) return;
  const p = G.player;
  if (!p.alive) return;

  if (obj.kind === 'goto' || obj.kind === 'deliver') {
    const t = objectivePos(G, obj);
    if (t && dist2(p.x, p.y, t.x, t.y) < obj.r * obj.r) completeObjective(G);
  } else if (obj.kind === 'pickup') {
    const t = objectivePos(G, obj);
    if (t && !p.inCar && dist2(p.x, p.y, t.x, t.y) < obj.r * obj.r) completeObjective(G);
  } else if (obj.kind === 'tail') {
    const c = G.mission.courier;
    if (c) {
      // Courier cruises between random road points.
      const w = G.mission.waypoint;
      const dx = w.x - c.x, dy = w.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 50) {
        G.mission.waypoint = randomRoadPoint(G.city, G.rng);
      } else {
        const want = Math.atan2(dy, dx);
        let diff = want - c.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
        c.speed = 120;
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
      }
      const pd = Math.hypot(p.x - c.x, p.y - c.y);
      if (pd < obj.range) {
        G.mission.progress += dt;
        if (G.mission.progress >= obj.seconds) completeObjective(G);
      }
    }
  } else if (obj.kind === 'survive') {
    G.mission.timer += dt;
    if (G.mission.timer >= obj.seconds) completeObjective(G);
  } else if (obj.kind === 'channel') {
    const t = objectivePos(G, obj);
    if (t && dist2(p.x, p.y, t.x, t.y) < obj.r * obj.r) {
      G.mission.progress += dt;
      if (G.mission.progress >= obj.seconds) completeObjective(G);
    } else {
      G.mission.progress = Math.max(0, G.mission.progress - dt * 0.5);
    }
  }
}

// --- Taxi side job ---
export function tryTaxi(G) {
  const p = G.player;
  if (!p.inCar || G.taxi) return false;
  let best = null, bestD = 130 * 130;
  for (const ped of G.peds) {
    if (ped.fare) continue;
    const d = dist2(p.x, p.y, ped.x, ped.y);
    if (d < bestD) { bestD = d; best = ped; }
  }
  if (!best) return false;
  best.fare = true;
  const dest = randomRoadPoint(G.city, G.rng);
  G.taxi = {
    state: 'toPickup', ped: best, dest,
    reward: 40 + Math.round(Math.hypot(dest.x - best.x, dest.y - best.y) / 40),
  };
  G.message = 'Taxi fare: pick up the passenger (yellow marker).';
  return true;
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t) return;
  const p = G.player;
  if (!p.inCar) {
    // Passenger walks away if you ditch the car.
    t.ped.fare = false;
    G.taxi = null;
    G.message = 'Fare cancelled — you left the car.';
    return;
  }
  if (t.state === 'toPickup') {
    if (dist2(p.x, p.y, t.ped.x, t.ped.y) < 60 * 60) {
      t.state = 'toDrop';
      const i = G.peds.indexOf(t.ped);
      if (i >= 0) G.peds.splice(i, 1);
      G.message = 'Passenger aboard. Drive to the green marker.';
    }
  } else if (dist2(p.x, p.y, t.dest.x, t.dest.y) < 70 * 70) {
    G.cash += t.reward;
    G.message = 'Fare complete! +$' + t.reward;
    G.events.push({ type: 'pickup' });
    G.taxi = null;
  }
}
