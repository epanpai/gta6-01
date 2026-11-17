// Player, traffic, pedestrians, particles and car physics.
// Gameplay events (steal, crash, kill) go on G.events for main.js to score.

import { WORLD, COLORS, TUNING } from './config.js';
import { makeRng, range, intRange, pick, clamp, angleDiff, dist2 } from './rng.js';
import { collideCircle, isRoad, randomRoadPoint, nearestRoadPoint } from './city.js';
import { down } from './input.js';

export function makePlayer(city) {
  const s = city.playerSpawn;
  return {
    x: s.x, y: s.y, angle: -Math.PI / 2, aim: -Math.PI / 2,
    hp: TUNING.playerHp, speed: 0, inCar: null,
    lastDamageAt: -99, fireCd: 0, alive: true,
  };
}

export function makeCar(x, y, angle, color, kind) {
  return {
    x, y, angle, speed: 0, color,
    kind: kind || 'traffic', // traffic | parked | player | cop | mission
    line: null, linePos: 0, dir: 1,
    stolen: false, isPlayer: false,
    targetSpeed: 0, wobble: 0,
  };
}

export function spawnTraffic(city, rng, n) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(city, rng);
    const vertical = rng() < 0.5;
    const c = makeCar(p.x, p.y, vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI), pick(rng, COLORS.carColors), 'traffic');
    c.line = vertical ? 'v' : 'h';
    c.linePos = vertical ? p.x : p.y;
    c.dir = rng() < 0.5 ? 1 : -1;
    c.angle = vertical ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
    c.targetSpeed = range(rng, TUNING.trafficSpeedMin, TUNING.trafficSpeedMax);
    c.speed = c.targetSpeed;
    cars.push(c);
  }
  return cars;
}

export function spawnParked(city, rng, n) {
  const cars = [];
  let tries = 0;
  while (cars.length < n && tries < 300) {
    tries++;
    const p = randomRoadPoint(city, rng);
    const vertical = rng() < 0.5;
    const off = (rng() < 0.5 ? -1 : 1) * (WORLD.ROAD / 2 - 6);
    const x = vertical ? p.x + off : p.x;
    const y = vertical ? p.y : p.y + off;
    if (dist2(x, y, city.playerSpawn.x, city.playerSpawn.y) < 120 * 120) continue;
    const c = makeCar(x, y, vertical ? Math.PI / 2 : 0, pick(rng, COLORS.carColors), 'parked');
    cars.push(c);
  }
  return cars;
}

export function spawnPeds(city, rng, n) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(city, rng);
    peds.push({
      x: p.x + range(rng, -14, 14), y: p.y + range(rng, -14, 14),
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, TUNING.pedSpeedMin, TUNING.pedSpeedMax),
      tx: p.x, ty: p.y, wait: range(rng, 0, 3),
      color: pick(rng, ['#e84a5f', '#4a90e8', '#e8e84a', '#9b59b6', '#ecf0f1', '#e67e22']),
      kind: 'walker', fare: false,
    });
  }
  return peds;
}

export function addParticle(G, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 120) * (0.4 + Math.random() * 0.8);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
      color, size: 2 + Math.random() * 3,
    });
  }
}

export function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    if (p.life <= 0) G.particles.splice(i, 1);
  }
}

function nearestCar(G, x, y, maxD) {
  let best = null, bestD = maxD * maxD;
  for (const c of G.cars) {
    const d = dist2(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function updatePlayer(G, dt, input) {
  const p = G.player;
  if (!p.alive) return;
  p.fireCd = Math.max(0, p.fireCd - dt);
  if (p.inCar) {
    updateDriving(G, dt, input);
    return;
  }
  // On foot.
  let mx = 0, my = 0;
  if (down(input, 'KeyW', 'ArrowUp')) my -= 1;
  if (down(input, 'KeyS', 'ArrowDown')) my += 1;
  if (down(input, 'KeyA', 'ArrowLeft')) mx -= 1;
  if (down(input, 'KeyD', 'ArrowRight')) mx += 1;
  const running = down(input, 'ShiftLeft', 'ShiftRight');
  const sp = (running ? TUNING.runSpeed : TUNING.walkSpeed);
  if (mx || my) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * sp * dt;
    p.y += (my / len) * sp * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = sp;
  } else {
    p.speed = 0;
  }
  // Aim at the mouse in world space.
  const wx = G.camera.x + (input.mouseX - G.view.w / 2) / G.camera.zoom;
  const wy = G.camera.y + (input.mouseY - G.view.h / 2) / G.camera.zoom;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  const fixed = collideCircle(G.city, p.x, p.y, TUNING.playerRadius);
  p.x = fixed.x; p.y = fixed.y;
}

function updateDriving(G, dt, input) {
  const p = G.player;
  const car = p.inCar;
  const fwd = down(input, 'KeyW', 'ArrowUp') ? 1 : 0;
  const back = down(input, 'KeyS', 'ArrowDown') ? 1 : 0;
  const left = down(input, 'KeyA', 'ArrowLeft') ? 1 : 0;
  const right = down(input, 'KeyD', 'ArrowRight') ? 1 : 0;
  const brake = down(input, 'Space');

  if (fwd) car.speed += TUNING.carAccel * dt;
  if (back) {
    if (car.speed > 20) car.speed -= TUNING.carBrake * dt;
    else car.speed -= TUNING.carAccel * 0.55 * dt;
  }
  if (brake) car.speed -= Math.sign(car.speed) * TUNING.carBrake * 1.4 * dt;
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * 60 * dt;
  if (Math.abs(car.speed) < 4 && !fwd && !back) car.speed = 0;
  car.speed = clamp(car.speed, -TUNING.carReverseMax, TUNING.carMaxSpeed);

  const spd = Math.abs(car.speed) / TUNING.carMaxSpeed;
  const steer = (right - left) * TUNING.carTurn * (0.35 + 0.65 * spd) * Math.sign(car.speed || 1);
  car.angle += steer * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = collideCircle(G.city, car.x, car.y, TUNING.carRadius);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    if (Math.abs(car.speed) > 120) {
      G.events.push({ type: 'crash', x: car.x, y: car.y });
      addParticle(G, car.x, car.y, '#ffb347', 8, 160);
    }
    car.speed *= 0.45;
    car.x = fixed.x; car.y = fixed.y;
  }
  p.x = car.x; p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
}

export function tryEnterExitCar(G) {
  const p = G.player;
  if (!p.alive) return;
  if (p.inCar) {
    const car = p.inCar;
    car.isPlayer = false;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    const fixed = collideCircle(G.city, p.x, p.y, TUNING.playerRadius);
    p.x = fixed.x; p.y = fixed.y;
    return;
  }
  const car = nearestCar(G, p.x, p.y, 58);
  if (!car) return;
  p.inCar = car;
  car.isPlayer = true;
  if (car.kind === 'traffic' || car.kind === 'parked') {
    if (!car.stolen) {
      car.stolen = true;
      G.events.push({ type: 'steal', x: car.x, y: car.y });
    }
    car.kind = 'player';
    car.targetSpeed = 0;
  }
  p.x = car.x; p.y = car.y;
}

export function updateTraffic(G, dt) {
  const cam = G.camera;
  for (const c of G.cars) {
    if (c.kind === 'player' || c.isPlayer) continue;
    if (c.kind === 'parked' || c.kind === 'mission') continue;
    // Keep traffic near the player: recycle far-away cars.
    const d = dist2(c.x, c.y, cam.x, cam.y);
    if (d > 1300 * 1300) {
      const p = randomRoadPoint(G.city, G.rng);
      const vertical = G.rng() < 0.5;
      c.line = vertical ? 'v' : 'h';
      c.linePos = vertical ? p.x : p.y;
      c.dir = G.rng() < 0.5 ? 1 : -1;
      c.x = vertical ? p.x : p.x;
      c.y = vertical ? p.y : p.y;
      c.angle = vertical ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
      c.speed = c.targetSpeed;
      continue;
    }
    // Ease toward target speed, slower if a car is right ahead.
    let target = c.targetSpeed;
    for (const o of G.cars) {
      if (o === c || o.line !== c.line || o.dir !== c.dir) continue;
      const ahead = c.line === 'v' ? (o.y - c.y) * c.dir : (o.x - c.x) * c.dir;
      if (ahead > 0 && ahead < 64) { target = Math.min(target, o.speed * 0.8); break; }
    }
    c.speed += clamp(target - c.speed, -220 * dt, 160 * dt);
    // Drive along the street; maybe turn at an intersection.
    const step = c.speed * c.dir * dt;
    if (c.line === 'v') {
      c.y += step;
      c.x += (c.linePos - c.x) * Math.min(1, 6 * dt);
      c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const near = Math.abs(((c.y % WORLD.PITCH) + WORLD.PITCH) % WORLD.PITCH) < 6 ||
        Math.abs((((c.y % WORLD.PITCH) + WORLD.PITCH) % WORLD.PITCH) - WORLD.PITCH) < 6;
      if (near && G.rng() < 0.012) {
        c.line = 'h'; c.linePos = Math.round(c.y / WORLD.PITCH) * WORLD.PITCH;
        c.dir = G.rng() < 0.5 ? 1 : -1;
      }
      if (c.y < 0) { c.y = 0; c.dir = 1; }
      if (c.y > WORLD.SIZE) { c.y = WORLD.SIZE; c.dir = -1; }
    } else {
      c.x += step;
      c.y += (c.linePos - c.y) * Math.min(1, 6 * dt);
      c.angle = c.dir > 0 ? 0 : Math.PI;
      const near = Math.abs(((c.x % WORLD.PITCH) + WORLD.PITCH) % WORLD.PITCH) < 6 ||
        Math.abs((((c.x % WORLD.PITCH) + WORLD.PITCH) % WORLD.PITCH) - WORLD.PITCH) < 6;
      if (near && G.rng() < 0.012) {
        c.line = 'v'; c.linePos = Math.round(c.x / WORLD.PITCH) * WORLD.PITCH;
        c.dir = G.rng() < 0.5 ? 1 : -1;
      }
      if (c.x < 0) { c.x = 0; c.dir = 1; }
      if (c.x > WORLD.SIZE) { c.x = WORLD.SIZE; c.dir = -1; }
    }
    const fixed = collideCircle(G.city, c.x, c.y, TUNING.carRadius - 2);
    c.x = fixed.x; c.y = fixed.y;
  }
  // Player car vs traffic: simple push-apart + slow down.
  const pc = G.player.inCar;
  if (pc) {
    for (const c of G.cars) {
      if (c === pc || c.kind === 'parked') continue;
      const d2 = dist2(pc.x, pc.y, c.x, c.y);
      if (d2 < 34 * 34 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (34 - d) / 2;
        const nx = (c.x - pc.x) / d, ny = (c.y - pc.y) / d;
        c.x += nx * push; c.y += ny * push;
        pc.x -= nx * push; pc.y -= ny * push;
        const rel = Math.abs(pc.speed - c.speed);
        if (rel > 90) {
          G.events.push({ type: 'crash', x: pc.x, y: pc.y });
          addParticle(G, pc.x, pc.y, '#ffb347', 6, 140);
        }
        pc.speed *= 0.7; c.speed *= 0.7;
      }
    }
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.fare) continue; // fare ped waits for the taxi pickup
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const p = nearestRoadPoint(G.city, ped.x + range(G.rng, -260, 260), ped.y + range(G.rng, -260, 260));
      ped.tx = p.x + range(G.rng, -12, 12);
      ped.ty = p.y + range(G.rng, -12, 12);
      ped.wait = range(G.rng, 0, 2.5);
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.y += (dy / d) * ped.speed * dt;
    const fixed = collideCircle(G.city, ped.x, ped.y, 9);
    ped.x = fixed.x; ped.y = fixed.y;
  }
}
