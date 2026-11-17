// Wanted level and the Solmar PD. One job: turn the player's crimes into
// stars, spawn police cars and foot cops that hunt the player, and let the
// heat cool off when the player stays out of sight.
import { Car, randomCarSpec } from './entities.js';
import { POLICE, WANTED, clamp, mulberry32 } from './config.js';

export class Police {
  constructor(world) {
    this.world = world;
    this.wanted = 0;
    this.heat = 0; // 0..1 progress toward the next star
    this.decayT = 0;
    this.spawnT = 0;
    this.cops = []; // police Car entities
    this.footCops = []; // {x,y,angle,speed}
    this.bustedT = 0; // how long a cop has been touching the player on foot
    this.sirenOn = false;
    this.rng = mulberry32(1337);
  }

  addHeat(amount) {
    if (this.wanted >= 5) return;
    this.heat += amount;
    while (this.heat >= 1 && this.wanted < 5) {
      this.heat -= 1;
      this.wanted++;
      this.world.onWantedUp(this.wanted);
    }
    this.decayT = WANTED.decaySeconds;
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.heat = 0;
    this.decayT = WANTED.decaySeconds;
  }

  clearAll() {
    this.wanted = 0;
    this.heat = 0;
    this.cops = [];
    this.footCops = [];
    this.bustedT = 0;
  }

  wantedCars() {
    return Math.min(POLICE.maxCops, this.wanted * 2);
  }

  update(dt) {
    const w = this.world;
    const p = w.player;
    // Decay: only when no cop is near the player.
    const nearest = this.nearestCopDist();
    if (this.wanted > 0 && nearest > 700) {
      this.decayT -= dt;
      if (this.decayT <= 0) {
        this.wanted--;
        this.decayT = WANTED.decaySeconds;
        this.heat = 0;
        w.onWantedDown(this.wanted);
      }
    } else {
      this.decayT = WANTED.decaySeconds;
    }

    // Spawn police cars up to the wanted level's quota.
    this.spawnT -= dt;
    if (this.wanted > 0 && this.cops.length < this.wantedCars() && this.spawnT <= 0) {
      this.spawnT = POLICE.spawnInterval;
      this.spawnCopCar();
    }
    // Foot cops appear at high wanted levels when the player is on foot.
    if (this.wanted >= 2 && !p.inCar && this.footCops.length < this.wanted - 1 && this.spawnT <= 0) {
      this.spawnT = POLICE.spawnInterval;
      this.spawnFootCop();
    }

    // Chase AI: police cars steer toward the player and ram.
    for (const cop of this.cops) {
      const dx = p.x - cop.x;
      const dy = p.y - cop.y;
      const d = Math.hypot(dx, dy);
      const wantAngle = Math.atan2(dy, dx);
      let da = wantAngle - cop.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      cop.steer = clamp(da * 1.6, -1, 1);
      cop.throttle = d > 60 ? 1 : 0.4;
      cop.update(dt, w);
      // A cop wedged against a building repositions onto a nearby road.
      if (Math.abs(cop.speed) < 25) cop.stuckT = (cop.stuckT || 0) + dt;
      else cop.stuckT = 0;
      if (cop.stuckT > 3) {
        cop.stuckT = 0;
        const a = Math.random() * Math.PI * 2;
        const s = w.city.snapToRoad(p.x + Math.cos(a) * 500, p.y + Math.sin(a) * 500);
        cop.x = s.x;
        cop.y = s.y;
        cop.speed = 0;
      }
      // Ram the player: if the cop hits the player's car, damage + slow both.
      if (p.inCar && d < 46) {
        cop.speed *= 0.6;
        p.car.speed *= 0.82;
        if (Math.abs(p.car.speed) > 120) {
          w.damagePlayer(2);
          w.particles.spawn(p.x, p.y, { n: 6, color: '#ffb347', speed: 90 });
        }
      }
      // On foot: a cop car touching the player busts them.
      if (!p.inCar && d < 34) {
        this.bustedT += dt;
      }
    }
    this.cops = this.cops.filter((c) => !c.dead);

    // Foot cops run at the player.
    for (const fc of this.footCops) {
      const dx = p.x - fc.x;
      const dy = p.y - fc.y;
      const d = Math.hypot(dx, dy) || 1;
      fc.angle = Math.atan2(dy, dx);
      fc.x += Math.cos(fc.angle) * fc.speed * dt;
      fc.y += Math.sin(fc.angle) * fc.speed * dt;
      if (!p.inCar && d < 26) this.bustedT += dt;
      if (p.inCar && d < 40) {
        // Run over a foot cop: big heat, and the cop goes down.
        fc.dead = true;
        this.addHeat(WANTED.killCop);
        w.particles.spawn(fc.x, fc.y, { n: 10, color: '#c0392b', speed: 100 });
      }
    }
    this.footCops = this.footCops.filter((f) => !f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 1600);

    // Busted: held by a cop on foot for ~1.6 s.
    if (this.bustedT > 0 && (p.inCar || this.nearestCopDist() > 60)) {
      this.bustedT = Math.max(0, this.bustedT - dt * 2);
    }
    if (this.bustedT > 1.6) {
      w.busted();
    }

    // Siren follows the wanted level.
    const siren = this.wanted > 0 && this.cops.length > 0;
    if (siren !== this.sirenOn) {
      this.sirenOn = siren;
      w.sound.siren(siren);
    } else if (siren) {
      w.sound.siren(true); // re-arm the two-tone sweep
    }
  }

  nearestCopDist() {
    const p = this.world.player;
    let best = Infinity;
    for (const c of this.cops) best = Math.min(best, Math.hypot(c.x - p.x, c.y - p.y));
    for (const f of this.footCops) best = Math.min(best, Math.hypot(f.x - p.x, f.y - p.y));
    return best;
  }

  spawnCopCar() {
    const w = this.world;
    const p = w.player;
    // Spawn on a road 500-700 px away from the player.
    const a = this.rng() * Math.PI * 2;
    const x = p.x + Math.cos(a) * 620;
    const y = p.y + Math.sin(a) * 620;
    const s = w.city.snapToRoad(x, y);
    const spec = { name: 'Interceptor', color: '#f4f6f7' };
    const cop = new Car(s.x, s.y, Math.atan2(p.y - s.y, p.x - s.x), spec, { isPolice: true });
    this.cops.push(cop);
  }

  spawnFootCop() {
    const w = this.world;
    const p = w.player;
    const a = this.rng() * Math.PI * 2;
    this.footCops.push({
      x: p.x + Math.cos(a) * 320,
      y: p.y + Math.sin(a) * 320,
      angle: 0,
      speed: 215,
      dead: false,
    });
  }

  draw(ctx) {
    for (const c of this.cops) c.draw(ctx);
    for (const f of this.footCops) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b2a4a';
      ctx.beginPath();
      ctx.arc(0, -2, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f0c8a0';
      ctx.beginPath();
      ctx.arc(0, -11, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b2a4a';
      ctx.beginPath();
      ctx.arc(0, -13, 5, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
