// Combat: the player's pistol, bullets, and armed rivals. One job: shooting
// feels responsive and the numbers (damage, ammo, heat) stay in one place.
import { WANTED } from './config.js';

export class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.hp = 3;
    this.speed = 130;
    this.shootT = 1 + Math.random();
    this.dead = false;
    this.flash = 0;
    this.r = 12;
  }

  update(dt, world) {
    if (this.dead) return;
    const p = world.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.angle = Math.atan2(dy, dx);
    // Keep some distance, strafe a little.
    if (d > 260) {
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
    } else if (d < 140) {
      this.x -= Math.cos(this.angle) * this.speed * 0.6 * dt;
      this.y -= Math.sin(this.angle) * this.speed * 0.6 * dt;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.shootT -= dt;
    if (this.shootT <= 0 && d < 420) {
      this.shootT = 1.4 + Math.random() * 0.8;
      world.combat.enemyShoot(this, p);
    }
  }

  hit() {
    this.hp--;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Viper gang colours: purple jacket.
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#6c3483';
    ctx.beginPath();
    ctx.arc(0, -2, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(0, -11, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c1a3a';
    ctx.beginPath();
    ctx.arc(0, -13, 5, Math.PI, Math.PI * 2);
    ctx.fill();
    // Gun
    ctx.rotate(this.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(4, -1.5, 12, 3);
    ctx.restore();
    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(this.x - 14, this.y - 26, 28, 4);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(this.x - 14, this.y - 26, 28 * (this.hp / 3), 4);
  }
}

export class Combat {
  constructor(world) {
    this.world = world;
    this.bullets = []; // {x,y,vx,vy,life,from}
    this.ammo = 48;
    this.ammoMax = 120;
    this.fireT = 0;
    this.reloadT = 0;
  }

  get canShoot() {
    return this.fireT <= 0 && this.reloadT <= 0 && this.ammo > 0;
  }

  update(dt) {
    this.fireT = Math.max(0, this.fireT - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        this.ammo = this.ammoMax;
        this.world.sound.pickup();
      }
    }
    const w = this.world;
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      // Hit a building: spark and stop.
      if (w.city.buildingAt(b.x, b.y)) {
        b.life = 0;
        w.particles.spawn(b.x, b.y, { n: 4, color: '#ffb347', speed: 70, life: 0.3 });
      }
    }
    // Bullet hits: enemies, peds, police foot cops, player (enemy bullets).
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      if (b.from === 'player') {
        for (const e of w.missions.enemies) {
          if (!e.dead && Math.hypot(b.x - e.x, b.y - e.y) < 14) {
            b.life = 0;
            w.particles.spawn(b.x, b.y, { n: 6, color: '#ff6b6b', speed: 90 });
            if (e.hit()) {
              w.missions.onEnemyKilled();
              w.money += 25;
              w.sound.hit();
            }
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const f of w.police.footCops) {
          if (!f.dead && Math.hypot(b.x - f.x, b.y - f.y) < 13) {
            b.life = 0;
            f.dead = true;
            w.police.addHeat(WANTED.killCop);
            w.particles.spawn(f.x, f.y, { n: 8, color: '#c0392b', speed: 100 });
            break;
          }
        }
        if (b.life <= 0) continue;
        for (const ped of w.peds) {
          if (!ped.dead && Math.hypot(b.x - ped.x, b.y - ped.y) < 12) {
            b.life = 0;
            ped.dead = true;
            w.police.addHeat(WANTED.hitPed);
            w.particles.spawn(ped.x, ped.y, { n: 8, color: '#c0392b', speed: 100 });
            // Nearby peds flee.
            for (const other of w.peds) {
              if (!other.dead && Math.hypot(other.x - ped.x, other.y - ped.y) < 300) other.fleeFrom(b.x, b.y);
            }
            break;
          }
        }
      } else if (b.from === 'enemy') {
        const p = w.player;
        if (!p.inCar && Math.hypot(b.x - p.x, b.y - p.y) < 14) {
          b.life = 0;
          w.damagePlayer(8);
          w.particles.spawn(p.x, p.y, { n: 5, color: '#ff6b6b', speed: 80 });
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && Math.abs(b.x) < 6000 && Math.abs(b.y) < 6000);
  }

  playerShoot(x, y, angle) {
    if (!this.canShoot) return false;
    this.fireT = 0.16;
    this.ammo--;
    const spread = (Math.random() - 0.5) * 0.08;
    const sp = 900;
    this.bullets.push({
      x: x + Math.cos(angle) * 18,
      y: y + Math.sin(angle) * 18,
      vx: Math.cos(angle + spread) * sp,
      vy: Math.sin(angle + spread) * sp,
      life: 0.9,
      from: 'player',
    });
    this.world.sound.shoot();
    this.world.particles.spawn(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, {
      n: 3,
      color: '#ffe066',
      speed: 60,
      life: 0.12,
      size: 2,
    });
    if (this.ammo === 0) this.reloadT = 1.2;
    return true;
  }

  enemyShoot(enemy, player) {
    const a = Math.atan2(player.y - enemy.y, player.x - enemy.x) + (Math.random() - 0.5) * 0.22;
    const sp = 620;
    this.bullets.push({
      x: enemy.x + Math.cos(a) * 16,
      y: enemy.y + Math.sin(a) * 16,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1.0,
      from: 'enemy',
    });
    this.world.sound.shoot();
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}
