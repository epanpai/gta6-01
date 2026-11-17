// Shooting, bullets and armed rivals.

import { TUNING } from './config.js';
import { range, dist2, clamp } from './rng.js';
import { collideCircle } from './city.js';
import { addParticle } from './entities.js';
import { hurtPlayer } from './police.js';

export function spawnEnemies(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + range(G.rng, -0.4, 0.4);
    const r = range(G.rng, 70, 150);
    G.enemies.push({
      x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
      angle: a, hp: TUNING.enemyHp, shootCd: range(G.rng, 0.5, 1.5),
      speed: 95,
    });
  }
}

export function shoot(G) {
  const p = G.player;
  if (!p.alive || p.fireCd > 0 || G.mode !== 'play') return false;
  p.fireCd = TUNING.fireCooldown;
  const a = p.aim;
  G.bullets.push({
    x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * TUNING.bulletSpeed, vy: Math.sin(a) * TUNING.bulletSpeed,
    life: 0.9, from: 'player',
  });
  G.events.push({ type: 'shoot' });
  return true;
}

function bulletBlocked(G, x, y) {
  // A bullet dies inside a building or water.
  for (const b of G.city.blocks) {
    for (const bd of b.buildings) {
      if (x >= bd.x && x <= bd.x + bd.w && y >= bd.y && y <= bd.y + bd.h) return true;
    }
  }
  return x < 0 || y < 0 || x > G.city.size || y > G.city.size;
}

export function updateCombat(G, dt) {
  const p = G.player;
  // Player bullets.
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0 || bulletBlocked(G, b.x, b.y);
    if (!dead && b.from === 'player') {
      for (let j = G.enemies.length - 1; j >= 0; j--) {
        const e = G.enemies[j];
        if (dist2(b.x, b.y, e.x, e.y) < 20 * 20) {
          e.hp -= 34;
          addParticle(G, b.x, b.y, '#ff5a4a', 6, 140);
          if (e.hp <= 0) {
            G.enemies.splice(j, 1);
            addParticle(G, e.x, e.y, '#ff5a4a', 14, 200);
            G.events.push({ type: 'kill', x: e.x, y: e.y });
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'enemy' && p.alive) {
      const rr = p.inCar ? 22 : 15;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        hurtPlayer(G, TUNING.enemyBulletDamage, 'bullet');
        addParticle(G, b.x, b.y, '#ff5a4a', 5, 120);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
  // Enemy AI: close in and shoot.
  for (const e of G.enemies) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.shootCd -= dt;
    if (p.alive && d < 460) {
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      if (d > 130) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
        const fixed = collideCircle(G.city, e.x, e.y, 11);
        e.x = fixed.x; e.y = fixed.y;
      }
      if (e.shootCd <= 0 && d < 420) {
        e.shootCd = range(G.rng, 0.9, 1.7);
        const a = e.angle + range(G.rng, -0.08, 0.08);
        G.bullets.push({
          x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 18,
          vx: Math.cos(a) * 620, vy: Math.sin(a) * 620,
          life: 1.1, from: 'enemy',
        });
        G.events.push({ type: 'enemyShoot' });
      }
    }
  }
  // Slow health regen out of combat.
  if (p.alive && p.hp > 0 && p.hp < TUNING.playerHp && G.time - p.lastDamageAt > 6) {
    p.hp = Math.min(TUNING.playerHp, p.hp + 2.5 * dt);
  }
}
