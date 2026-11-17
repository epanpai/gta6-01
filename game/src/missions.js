// Missions and side jobs. One job: the story arc — six missions from Lena
// Cruz and Big T — plus taxi fares, with objectives, markers and rewards.
import { Enemy } from './combat.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'Wheels Up',
    giver: 'Lena Cruz',
    briefing:
      "Welcome back to Solmar, Jax. First rule: nobody walks in this city. Steal a car — any car — and bring it to my garage on Coral Row.",
    reward: 500,
    steps: [
      { type: 'enterCar', label: 'Steal a car (walk up and press E)' },
      { type: 'goto', x: 'garage', label: 'Drive to Lena\'s Garage' },
    ],
  },
  {
    id: 'm2',
    title: 'The Pickup',
    giver: 'Lena Cruz',
    briefing:
      'A package is waiting at the Marina Docks. Drive there, grab it on foot, then deliver it to City Hall. No questions, no stops.',
    reward: 800,
    steps: [
      { type: 'goto', x: 'docks', label: 'Drive to the Marina Docks' },
      { type: 'collect', x: 'docks', label: 'Get out and grab the package' },
      { type: 'goto', x: 'hall', label: 'Deliver the package to City Hall' },
    ],
  },
  {
    id: 'm3',
    title: 'Hot Wheels',
    giver: 'Big T',
    briefing:
      "The PD put a price on your head, Jax — three stars. Lose them. Break line of sight, lay low, and don't get busted.",
    reward: 1200,
    steps: [{ type: 'loseWanted', label: 'Lose your 3-star wanted level' }],
  },
  {
    id: 'm4',
    title: 'The Drop',
    giver: 'Lena Cruz',
    briefing:
      'A client needs a ride to Palmera Beach, fast. The meter is running — get there in 90 seconds and the fare is yours.',
    reward: 1000,
    steps: [{ type: 'timedGoto', x: 'beach', seconds: 90, label: 'Reach Palmera Beach in 90 seconds' }],
  },
  {
    id: 'm5',
    title: 'Street Sweep',
    giver: 'Big T',
    briefing:
      "The Vipers took our corner on Plaza Street. Take it back. They're armed — so are you. Six of them. Make it count.",
    reward: 1500,
    steps: [{ type: 'kill', count: 6, x: 'plaza', label: 'Take out 6 Vipers at the plaza' }],
  },
  {
    id: 'm6',
    title: 'The Big Score',
    giver: 'Lena Cruz',
    briefing:
      'Tonight we hit the City Hall vault. Walk in, crack it, grab the cash — then run. Four stars, minimum. Meet me at the beach safehouse after.',
    reward: 5000,
    steps: [
      { type: 'goto', x: 'hall', label: 'Reach City Hall' },
      { type: 'channel', seconds: 8, x: 'hall', label: 'Crack the vault — stay at the door' },
      { type: 'goto', x: 'beach', label: 'Escape to the beach safehouse' },
    ],
  },
];

// Named places, resolved against the city at mission start.
export function placeFor(city, key) {
  const rx = city.roadsX;
  const ry = city.roadsY;
  switch (key) {
    case 'garage':
      return { x: rx[3], y: ry[3] };
    case 'docks':
      return { x: city.roadsX[12], y: city.roadsY[11] };
    case 'hall':
      return { x: rx[6], y: ry[6] };
    case 'beach':
      return { x: rx[7], y: city.roadsY[12] + 60 };
    case 'plaza':
      return { x: rx[8], y: ry[8] };
    default:
      return { x: rx[7], y: ry[7] };
  }
}

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.index = 0; // next mission to play
    this.active = null; // {def, step, timer, spawned}
    this.completed = 0;
    this.totalEarned = 0;
    this.marker = null; // {x, y, label, color}
    this.enemies = [];
    this.packageAt = null;
    this.banner = null; // {title, sub, t}
    this.channelT = 0;
  }

  get currentDef() {
    return MISSIONS[this.index] || null;
  }

  get done() {
    return this.index >= MISSIONS.length;
  }

  startMission() {
    const def = this.currentDef;
    if (!def || this.active) return false;
    this.active = { def, step: 0, timer: 0, kills: 0 };
    this.world.sound.missionStart();
    this.showBanner(def.title, `${def.giver}: ${def.briefing}`);
    if (def.id === 'm3') this.world.police.setWanted(3);
    if (def.id === 'm6') this.world.police.setWanted(0);
    this.enterStep();
    return true;
  }

  enterStep() {
    const { def, step } = this.active;
    const s = def.steps[step];
    this.marker = null;
    this.packageAt = null;
    this.channelT = 0;
    if (!s) {
      this.completeMission();
      return;
    }
    if (s.type === 'goto' || s.type === 'timedGoto' || s.type === 'channel') {
      const p = placeFor(this.world.city, s.x);
      this.marker = { x: p.x, y: p.y, label: s.label, color: '#ffd23f' };
    }
    if (s.type === 'collect') {
      const p = placeFor(this.world.city, s.x);
      this.marker = { x: p.x, y: p.y, label: s.label, color: '#ffd23f' };
      this.packageAt = { x: p.x + 40, y: p.y + 30 };
    }
    if (s.type === 'kill') {
      const p = placeFor(this.world.city, s.x);
      this.marker = { x: p.x, y: p.y, label: s.label, color: '#ff5555' };
      this.spawnEnemies(p.x, p.y, s.count);
    }
    if (s.type === 'loseWanted') {
      this.marker = null;
    }
    if (s.type === 'timedGoto') {
      this.active.timer = s.seconds;
    }
  }

  spawnEnemies(x, y, n) {
    this.enemies = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.enemies.push(new Enemy(x + Math.cos(a) * 120, y + Math.sin(a) * 120));
    }
  }

  nextStep() {
    this.active.step++;
    this.enterStep();
  }

  completeMission() {
    const def = this.active.def;
    this.world.money += def.reward;
    this.totalEarned += def.reward;
    this.completed++;
    this.index++;
    this.active = null;
    this.marker = null;
    this.enemies = [];
    this.packageAt = null;
    this.world.sound.missionDone();
    this.world.sound.cash();
    this.showBanner('Mission Complete', `${def.title} — +$${def.reward.toLocaleString()}`);
    this.world.onMissionComplete(def);
  }

  failMission(reason) {
    if (!this.active) return;
    this.world.sound.fail();
    this.showBanner('Mission Failed', reason || 'Try again — drive to the marker to restart.');
    this.active = null;
    this.marker = null;
    this.enemies = [];
    this.packageAt = null;
    if (this.world.police.wanted > 0) this.world.police.setWanted(0);
  }

  showBanner(title, sub) {
    this.banner = { title, sub, t: 4.5 };
  }

  update(dt) {
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (!this.active) return;
    const a = this.active;
    const s = a.def.steps[a.step];
    if (!s) return;
    const w = this.world;
    const p = w.player;

    if (s.type === 'enterCar') {
      if (p.inCar) this.nextStep();
    } else if (s.type === 'goto') {
      if (this.marker && Math.hypot(p.x - this.marker.x, p.y - this.marker.y) < 70) this.nextStep();
    } else if (s.type === 'timedGoto') {
      a.timer -= dt;
      if (this.marker && Math.hypot(p.x - this.marker.x, p.y - this.marker.y) < 70) {
        this.nextStep();
      } else if (a.timer <= 0) {
        this.failMission('Too slow — the client walked away.');
      }
    } else if (s.type === 'collect') {
      if (this.packageAt && !p.inCar && Math.hypot(p.x - this.packageAt.x, p.y - this.packageAt.y) < 40) {
        this.packageAt = null;
        w.sound.pickup();
        this.nextStep();
      }
    } else if (s.type === 'kill') {
      const alive = this.enemies.filter((e) => !e.dead).length;
      if (alive === 0 && a.kills >= s.count) this.nextStep();
    } else if (s.type === 'loseWanted') {
      if (w.police.wanted === 0) this.nextStep();
    } else if (s.type === 'channel') {
      if (this.marker && Math.hypot(p.x - this.marker.x, p.y - this.marker.y) < 80) {
        this.channelT += dt;
        if (this.channelT >= s.seconds) {
          w.police.setWanted(4);
          w.money += 0; // the cash comes at mission end
          this.nextStep();
        }
      } else {
        this.channelT = Math.max(0, this.channelT - dt);
      }
    }
  }

  onEnemyKilled() {
    if (this.active) this.active.kills++;
  }

  // The start marker for the next mission (shown in free roam).
  startMarker() {
    if (this.active || this.done) return null;
    const def = this.currentDef;
    const key = def.id === 'm1' ? 'garage' : def.id === 'm5' ? 'plaza' : 'hall';
    const p = placeFor(this.world.city, key);
    return { x: p.x, y: p.y, label: `${def.title} — drive here to start`, color: '#ffd23f', mission: def };
  }

  drawMarkers(ctx, cam) {
    const draw = (m, pulse) => {
      if (!m) return;
      const s = 1 + Math.sin(performance.now() / 300) * 0.08;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(s, s);
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(16, -8);
      ctx.lineTo(8, -8);
      ctx.lineTo(8, 6);
      ctx.lineTo(-8, 6);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-16, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, 2);
      ctx.restore();
    };
    draw(this.marker);
    const sm = this.startMarker();
    if (sm) draw(sm);
    if (this.packageAt) {
      ctx.save();
      ctx.translate(this.packageAt.x, this.packageAt.y);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-10, -7, 20, 14);
      ctx.fillStyle = '#8a6d00';
      ctx.fillRect(-10, -2, 20, 4);
      ctx.restore();
    }
    for (const e of this.enemies) e.draw(ctx);
  }
}

// Taxi side job: pick up a flagged pedestrian, drive them to their stop.
export class TaxiJob {
  constructor(world) {
    this.world = world;
    this.passenger = null; // ped
    this.dest = null; // {x,y}
    this.fare = 0;
    this.state = 'idle'; // idle | pickup | dropoff
  }

  update(dt) {
    const w = this.world;
    const p = w.player;
    if (this.state === 'idle') return;
    if (this.state === 'pickup') {
      if (this.passenger && Math.hypot(p.x - this.passenger.x, p.y - this.passenger.y) < 60) {
        this.passenger.dead = true; // gets in the cab
        this.state = 'dropoff';
        const c = w.city;
        this.dest = { x: c.roadsX[2 + Math.floor(Math.random() * 10)], y: c.roadsY[2 + Math.floor(Math.random() * 10)] };
        w.missions.showBanner('Passenger aboard', 'Drive to the drop-off marker.');
      }
    } else if (this.state === 'dropoff') {
      if (this.dest && Math.hypot(p.x - this.dest.x, p.y - this.dest.y) < 70) {
        w.money += this.fare;
        w.sound.cash();
        w.missions.showBanner('Fare complete', `+$${this.fare} — nice driving.`);
        this.state = 'idle';
        this.passenger = null;
        this.dest = null;
      }
    }
  }

  tryStart(ped) {
    if (this.state !== 'idle') return false;
    if (!ped || ped.dead) return false;
    this.passenger = ped;
    this.fare = 80 + Math.floor(Math.random() * 140);
    this.state = 'pickup';
    this.world.missions.showBanner('Taxi fare', `Pick up the passenger — fare $${this.fare}.`);
    return true;
  }
}
