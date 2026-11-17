// Moving things: cars (player-driven and traffic), pedestrians and
// particles. Physics and drawing live with each entity; the game loop in
// main.js only calls update/draw.
import { CAR, clamp, mulberry32 } from './config.js';

export const CAR_COLORS = [
  { name: 'Coral Coupe', color: '#e4572e' },
  { name: 'Aqua Sedan', color: '#17a2b8' },
  { name: 'Sun Taxi', color: '#f2c200' },
  { name: 'Mint Hatch', color: '#3fae7a' },
  { name: 'Cherry Sport', color: '#c0392b' },
  { name: 'Sky Van', color: '#5b8dd9' },
  { name: 'Grape SUV', color: '#7d5ba6' },
  { name: 'Sand Pickup', color: '#c9a227' },
  { name: 'Slate Cruiser', color: '#5d6d7e' },
  { name: 'Pink Lowrider', color: '#e75480' },
];

export class Car {
  constructor(x, y, angle, spec, opts = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.spec = spec;
    this.color = spec.color;
    this.name = spec.name;
    this.isPolice = !!opts.isPolice;
    this.isTaxi = spec.name === 'Sun Taxi';
    this.parked = !!opts.parked;
    this.steer = 0;
    this.throttle = 0;
    this.brakeLight = false;
    this.ai = opts.ai || null; // traffic brain: {axis, dir, lane}
    this.stuckT = 0;
    this.smoke = 0;
  }

  get moving() {
    return Math.abs(this.speed) > 5;
  }

  update(dt, world) {
    if (this.parked) return;
    if (this.ai) {
      this.updateTraffic(dt, world);
      return;
    }
    // Player / police driven: throttle + steering already set by the driver.
    const maxF = this.isPolice ? 600 : CAR.maxSpeed;
    if (this.throttle > 0) this.speed += CAR.accel * this.throttle * dt;
    else if (this.throttle < 0) {
      if (this.speed > 5) this.speed -= CAR.brake * dt;
      else this.speed += CAR.reverseAccel * this.throttle * dt * -1 * -1; // reverse
      if (this.speed < 0 && this.throttle < 0) this.speed = Math.max(this.speed, -CAR.maxReverse);
    }
    // Drag + rolling resistance
    this.speed -= this.speed * 0.55 * dt;
    if (Math.abs(this.speed) < 4 && this.throttle === 0) this.speed = 0;
    this.speed = clamp(this.speed, -CAR.maxReverse, maxF);
    const spdFactor = clamp(Math.abs(this.speed) / 260, 0, 1);
    const dir = this.speed >= 0 ? 1 : -1;
    this.angle += this.steer * CAR.turnRate * spdFactor * dt * dir;
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    if (world && world.collidesBuilding(nx, ny, 20)) {
      this.speed *= -0.25;
      this.crashSnd = true;
    } else {
      this.x = nx;
      this.y = ny;
    }
    this.x = clamp(this.x, 30, world ? world.cityW - 30 : 4450);
    this.y = clamp(this.y, 30, world ? world.cityH - 30 : 4450);
    this.brakeLight = this.throttle < 0 && this.speed > 5;
  }

  updateTraffic(dt, world) {
    const city = world.city;
    // Target speed with a little per-car variety.
    const target = 150 + (this.ai.pace || 0) * 60;
    const ahead = world.carAhead(this, 70);
    const want = ahead ? 0 : target;
    if (this.speed < want) this.speed += CAR.accel * 0.5 * dt;
    else if (this.speed > want) this.speed -= CAR.brake * 0.6 * dt;
    this.speed = clamp(this.speed, 0, target);
    // Follow the lane: steer toward the lane line.
    const lane = this.ai.lane;
    let err = 0;
    if (this.ai.axis === 'x') {
      err = lane - this.y;
      const wantAngle = this.ai.dir > 0 ? 0 : Math.PI;
      this.angle += clamp(wantAngle - this.angle, -1, 1) * 0 + clamp(err * 0.02, -0.6, 0.6) * dt * 2;
      // Simple approach: blend angle toward the road direction, plus lane correction.
      let da = wantAngle - this.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.angle += clamp(da, -1.6 * dt, 1.6 * dt) + clamp(err * 0.004, -0.5, 0.5) * dt;
    } else {
      err = lane - this.x;
      const wantAngle = this.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      let da = wantAngle - this.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      this.angle += clamp(da, -1.6 * dt, 1.6 * dt) + clamp(err * 0.004, -0.5, 0.5) * dt;
    }
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    // At an intersection, maybe turn.
    if (world) world.maybeTurnTraffic(this, dt);
    // Despawn far outside the city (respawned by the world).
    if (this.x < -80 || this.y < -80 || this.x > world.cityW + 80 || this.y > world.cityH + 80) {
      this.dead = true;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Body
    ctx.fillStyle = this.isPolice ? '#f4f6f7' : this.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    ctx.fill();
    // Cabin
    ctx.fillStyle = this.isPolice ? '#1b2a4a' : 'rgba(20,30,45,0.85)';
    roundRect(ctx, -8, -CAR.width / 2 + 4, 20, CAR.width - 8, 4);
    ctx.fill();
    // Windshield
    ctx.fillStyle = 'rgba(180,220,240,0.7)';
    ctx.fillRect(10, -CAR.width / 2 + 5, 4, CAR.width - 10);
    // Headlights / taillights
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 2, 2, 5);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 7, 2, 5);
    ctx.fillStyle = this.brakeLight ? '#ff2e2e' : '#a33';
    ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 2, 2, 5);
    ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 7, 2, 5);
    if (this.isPolice) {
      // Light bar
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(-4, -CAR.width / 2 + 1, 8, 6);
      ctx.fillStyle = '#2266ff';
      ctx.fillRect(-4, CAR.width / 2 - 7, 8, 6);
      ctx.fillStyle = '#1b2a4a';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', -14, 2);
    }
    if (this.isTaxi) {
      ctx.fillStyle = '#222';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', -14, 2);
    }
    ctx.restore();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PED_SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
const PED_PANTS = ['#2c3e50', '#34495e', '#7f8c8d', '#5d4037'];

export class Ped {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.angle = rng() * Math.PI * 2;
    this.speed = 45 + rng() * 40;
    this.shirt = PED_SHIRTS[Math.floor(rng() * PED_SHIRTS.length)];
    this.pants = PED_PANTS[Math.floor(rng() * PED_PANTS.length)];
    this.r = 11;
    this.walkPhase = rng() * Math.PI * 2;
    this.fleeT = 0;
    this.fleeX = 0;
    this.fleeY = 0;
    this.dead = false;
    this.changeT = 2 + rng() * 4;
    this.wantsTaxi = false;
  }

  update(dt, world) {
    if (this.dead) return;
    this.changeT -= dt;
    if (this.fleeT > 0) {
      this.fleeT -= dt;
      const dx = this.x - this.fleeX;
      const dy = this.y - this.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      this.angle = Math.atan2(dy / d, dx / d);
      const sp = 190;
      this.x += Math.cos(this.angle) * sp * dt;
      this.y += Math.sin(this.angle) * sp * dt;
    } else {
      if (this.changeT <= 0) {
        this.changeT = 2 + Math.random() * 4;
        // Keep to sidewalks: pick a nearby road and walk along it.
        const s = world.city.snapToRoad(this.x, this.y);
        const along = Math.random() < 0.5 ? 0 : Math.PI;
        if (s.vertical) this.angle = along === 0 ? Math.PI / 2 : -Math.PI / 2;
        else this.angle = along;
        // Nudge onto the sidewalk edge.
        if (s.vertical) this.x = s.x + (Math.random() < 0.5 ? -36 : 36);
        else this.y = s.y + (Math.random() < 0.5 ? -36 : 36);
      }
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
    }
    this.walkPhase += dt * (this.fleeT > 0 ? 14 : 7);
    // Stay inside the city, off the sea.
    this.x = clamp(this.x, 20, world.cityW - 20);
    this.y = clamp(this.y, 20, world.cityH - 90);
    if (world.city.buildingAt(this.x, this.y)) {
      // Walked into a wall: turn around.
      this.angle += Math.PI;
      this.x += Math.cos(this.angle) * 6;
      this.y += Math.sin(this.angle) * 6;
    }
  }

  fleeFrom(x, y) {
    this.fleeX = x;
    this.fleeY = y;
    this.fleeT = 2.5;
  }

  draw(ctx) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    const bob = Math.sin(this.walkPhase) * 1.5;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.fillStyle = this.pants;
    const legSwing = Math.sin(this.walkPhase) * 4;
    ctx.fillRect(-3 + legSwing * 0.4, 2, 3, 7);
    ctx.fillRect(1 - legSwing * 0.4, 2, 3, 7);
    // Body
    ctx.fillStyle = this.shirt;
    ctx.beginPath();
    ctx.arc(0, -2 + bob * 0.3, 7.5, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath();
    ctx.arc(0, -11 + bob * 0.3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Hair
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(0, -13 + bob * 0.3, 5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Particles {
  constructor() {
    this.list = [];
  }

  spawn(x, y, opts = {}) {
    const n = opts.n || 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 120) * (0.4 + Math.random() * 0.8);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: opts.life || 0.6,
        maxLife: opts.life || 0.6,
        size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
        color: opts.color || '#ffcf4d',
        gravity: opts.gravity || 0,
      });
    }
  }

  smoke(x, y) {
    this.list.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: -25 - Math.random() * 20,
      life: 0.9,
      maxLife: 0.9,
      size: 8 + Math.random() * 6,
      color: 'rgba(120,120,120,0.5)',
      gravity: -10,
    });
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - 1.5 * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
    if (this.list.length > 400) this.list.splice(0, this.list.length - 400);
  }

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

export function randomCarSpec(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}

export function makeRng(seed) {
  return mulberry32(seed);
}
