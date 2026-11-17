// Wanted level, police cars, foot cops and the bust timer.
// Crimes push events on G; this module turns stars into pressure.

import { WORLD, COLORS, TUNING } from './config.js';
import { range, intRange, clamp, angleDiff, dist2 } from './rng.js';
import { collideCircle, randomRoadPoint } from './city.js';
import { makeCar, addParticle } from './entities.js';

export function addWanted(G, stars) {
  G.wanted = clamp(G.wanted + stars, 0, TUNING.starsMax);
  G.heat = Math.max(G.heat, TUNING.heatPerStar * 0.6);
  G.lastCrimeAt = G.time;
}

export function copsWanted(G) {
  // How many cop cars the current stars call for.
  return [0, 2, 3, 4, 5, 6][G.wanted] || 0;
}

export function makeCopCar(G, near) {
  const p = randomRoadPoint(G.city, G.rng);
  const c = makeCar(near ? G.player.x + range(G.rng, -500, 500) : p.x, near ? G.player.y + range(G.rng, -500, 500) : p.y, 0, COLORS.copCar, 'cop');
  c.speed = range(G.rng, 200, 260);
  c.targetSpeed = 300;
  return c;
}

export function updatePolice(G, dt) {
  // Heat fades while no cop is near and no crime happened recently.
  const p = G.player;
  let nearestCop = Infinity;
  for (const c of G.cops) {
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    if (d < nearestCop) nearestCop = d;
  }
  if (G.wanted > 0 && nearestCop > 460 && G.time - G.lastCrimeAt > 6) {
    G.heat -= TUNING.heatDecay * dt;
    if (G.heat <= 0) {
      G.wanted -= 1;
      G.heat = G.wanted > 0 ? TUNING.heatPerStar * 0.5 : 0;
      if (G.wanted === 0) G.message = 'You lost the cops.';
    }
  }

  // Spawn / despawn cop cars to match the wanted level.
  const want = copsWanted(G);
  const cars = G.cops.filter((c) => c.kind === 'cop');
  if (cars.length < want) {
    const c = makeCopCar(G, cars.length === 0);
    G.cops.push(c);
    G.cars.push(c);
  } else if (cars.length > want) {
    const extra = cars[cars.length - 1];
    G.cops.splice(G.cops.indexOf(extra), 1);
    G.cars.splice(G.cars.indexOf(extra), 1);
  }
  // Foot cops at 3+ stars.
  const footWant = G.wanted >= 3 ? Math.min(3, G.wanted - 1) : 0;
  const foot = G.cops.filter((c) => c.kind === 'footcop');
  if (foot.length < footWant) {
    const a = G.rng() * Math.PI * 2;
    G.cops.push({
      kind: 'footcop', x: p.x + Math.cos(a) * 320, y: p.y + Math.sin(a) * 320,
      speed: 150, angle: 0, bust: 0,
    });
  } else if (foot.length > footWant) {
    const extra = foot[foot.length - 1];
    G.cops.splice(G.cops.indexOf(extra), 1);
  }

  // Cop car AI: steer toward the player and ram.
  for (const c of G.cops) {
    if (c.kind === 'footcop') {
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d > 4) {
        const a = Math.atan2(p.y - c.y, p.x - c.x);
        c.x += Math.cos(a) * c.speed * dt;
        c.y += Math.sin(a) * c.speed * dt;
        c.angle = a;
      }
      const fixed = collideCircle(G.city, c.x, c.y, 10);
      c.x = fixed.x; c.y = fixed.y;
      // Bust: standing next to the player on foot.
      if (!p.inCar && p.alive && d < TUNING.bustRange) {
        c.bust += dt;
        if (c.bust >= TUNING.bustTime) bustPlayer(G);
      } else {
        c.bust = Math.max(0, c.bust - dt * 2);
      }
      continue;
    }
    // Car chase.
    const wantAngle = Math.atan2(p.y - c.y, p.x - c.x);
    const diff = angleDiff(c.angle, wantAngle);
    c.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const target = p.inCar ? 330 : 260;
    c.speed += clamp(target - c.speed, -300 * dt, 240 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    const fixed = collideCircle(G.city, c.x, c.y, TUNING.carRadius - 2);
    if (fixed.x !== c.x || fixed.y !== c.y) {
      c.speed *= 0.5;
      c.angle += 0.6;
    }
    c.x = fixed.x; c.y = fixed.y;
    // Ram the player's car.
    if (p.inCar && p.alive) {
      const d2 = dist2(c.x, c.y, p.x, p.y);
      if (d2 < 36 * 36) {
        const d = Math.sqrt(d2) || 1;
        const nx = (p.x - c.x) / d, ny = (p.y - c.y) / d;
        p.x += nx * 14; p.y += ny * 14;
        if (p.inCar) p.inCar.speed *= 0.82;
        hurtPlayer(G, TUNING.copRamDamage * dt * 3, 'ram');
        if (G.rng() < dt * 2) addParticle(G, c.x, c.y, '#ffb347', 3, 120);
      }
    }
  }
}

export function hurtPlayer(G, dmg, src) {
  const p = G.player;
  if (!p.alive || G.mode !== 'play') return;
  if (G.time - p.lastDamageAt < 0.05 && src === 'ram') return;
  p.hp -= dmg;
  p.lastDamageAt = G.time;
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    G.mode = 'gameover';
    G.cash = Math.max(0, Math.round(G.cash * 0.9));
    G.message = 'Flatlined. The crew pulled you out — minus 10%.';
  }
}

export function bustPlayer(G) {
  const p = G.player;
  if (G.mode !== 'play') return;
  G.mode = 'busted';
  const lost = Math.round(G.cash * 0.2);
  G.cash -= lost;
  G.wanted = 0;
  G.heat = 0;
  G.cops.length = 0;
  G.cars = G.cars.filter((c) => c.kind !== 'cop');
  // Respawn at the plaza, on foot.
  const s = G.city.playerSpawn;
  p.x = s.x; p.y = s.y;
  p.inCar = null;
  p.hp = Math.max(p.hp, 60);
  G.message = 'BUSTED! The cops took $' + lost + '. Press ENTER to walk free.';
}
