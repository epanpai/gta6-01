// Solmar Bay — the world and the game loop. One job: own every system
// (city, player, traffic, police, missions, combat, HUD, save) and run the
// frame: read input, update the world, draw it.
import { BLOCK, GRID, WORLD, BEACH_H, PLAYER, CAR, WANTED, clamp, lerp, mulberry32 } from './config.js';
import { City } from './city.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { Car, Ped, Particles, randomCarSpec } from './entities.js';
import { Renderer } from './render.js';
import { Police } from './police.js';
import { MissionManager, TaxiJob, placeFor } from './missions.js';
import { Combat } from './combat.js';
import { Hud, drawTitle, drawHowTo, drawPaused, drawEnd } from './hud.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { applyShot } from './shots.js';

export class World {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.city = new City(seed);
    this.cityW = WORLD;
    this.cityH = WORLD;
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.renderer = new Renderer(canvas);
    this.hud = new Hud();
    this.particles = new Particles();
    this.police = new Police(this);
    this.missions = new MissionManager(this);
    this.taxi = new TaxiJob(this);
    this.combat = new Combat(this);
    this.player = {
      x: this.city.roadsX[7],
      y: this.city.roadsY[7],
      angle: 0,
      health: PLAYER.health,
      walkPhase: 0,
      inCar: false,
      car: null,
      hurtT: 0,
      moving: false,
    };
    this.cars = []; // traffic + parked + the player's car
    this.traffic = [];
    this.peds = [];
    this.cashPickups = [];
    this.money = 150;
    this.state = 'title'; // title | howto | playing | paused | busted | wasted | won
    this.started = false;
    this.frozen = false; // screenshot poses: render only, no simulation
    this.camera = { x: this.player.x, y: this.player.y, zoom: 1 };
    this.aimAngle = 0;
    this.saveExists = !!loadGame();
    this.saveT = 0;
    this.playT = 0;
    this.spawnT = 0;
    this.endKind = null;
    this.seedTraffic();
    this.seedPeds();
    this.seedCash();
  }

  // --- Spawning -------------------------------------------------------------
  seedTraffic() {
    // Parked cars along roads and in parking lots.
    for (let i = 0; i < 26; i++) {
      const rx = this.city.roadsX[1 + Math.floor(this.rng() * (GRID - 2))];
      const ry = this.city.roadsY[1 + Math.floor(this.rng() * (GRID - 2))];
      const vertical = this.rng() < 0.5;
      const x = vertical ? rx + (this.rng() < 0.5 ? -16 : 16) : rx + (this.rng() - 0.5) * 200;
      const y = vertical ? ry + (this.rng() - 0.5) * 200 : ry + (this.rng() < 0.5 ? -16 : 16);
      const angle = vertical ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : this.rng() < 0.5 ? 0 : Math.PI;
      const spec = randomCarSpec(this.rng);
      this.cars.push(new Car(x, y, angle, spec, { parked: true }));
    }
    for (let i = 0; i < 12; i++) this.spawnTrafficNear(this.player.x, this.player.y, 1);
  }

  spawnTrafficCar(anywhere) {
    const p = this.player;
    let x;
    let y;
    let tries = 0;
    do {
      const rx = this.city.roadsX[1 + Math.floor(this.rng() * (GRID - 2))];
      const ry = this.city.roadsY[1 + Math.floor(this.rng() * (GRID - 2))];
      if (anywhere || Math.hypot(rx - p.x, ry - p.y) < 1100) {
        x = rx;
        y = ry;
      } else {
        x = p.x + (this.rng() - 0.5) * 1600;
        y = p.y + (this.rng() - 0.5) * 1600;
        const s = this.city.snapToRoad(x, y);
        x = s.x;
        y = s.y;
      }
      tries++;
    } while (tries < 8 && !anywhere && Math.hypot(x - p.x, y - p.y) < 420);
    const s = this.city.snapToRoad(x, y);
    const vertical = s.vertical;
    const dir = this.rng() < 0.5 ? 1 : -1;
    const lane = vertical ? s.x + (dir > 0 ? 14 : -14) : s.y + (dir > 0 ? 14 : -14);
    const spec = randomCarSpec(this.rng);
    const car = new Car(
      vertical ? lane : s.x,
      vertical ? s.y : lane,
      vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      spec,
      { ai: { axis: vertical ? 'y' : 'x', dir, lane, pace: this.rng() } },
    );
    car.speed = 120 + this.rng() * 60;
    this.cars.push(car);
    this.traffic.push(car);
    return car;
  }

  spawnTrafficNear(x, y, n) {
    for (let i = 0; i < n; i++) {
      const s = this.city.snapToRoad(x + (this.rng() - 0.5) * 900, y + (this.rng() - 0.5) * 900);
      const vertical = s.vertical;
      const dir = this.rng() < 0.5 ? 1 : -1;
      const lane = vertical ? s.x + (dir > 0 ? 14 : -14) : s.y + (dir > 0 ? 14 : -14);
      const spec = randomCarSpec(this.rng);
      const car = new Car(
        vertical ? lane : s.x,
        vertical ? s.y : lane,
        vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
        spec,
        { ai: { axis: vertical ? 'y' : 'x', dir, lane, pace: this.rng() } },
      );
      car.speed = 120 + this.rng() * 80;
      this.cars.push(car);
      this.traffic.push(car);
    }
  }

  seedPeds() {
    for (let i = 0; i < 42; i++) {
      const rx = this.city.roadsX[1 + Math.floor(this.rng() * (GRID - 2))];
      const ry = this.city.roadsY[1 + Math.floor(this.rng() * (GRID - 2))];
      const vertical = this.rng() < 0.5;
      const ped = new Ped(
        vertical ? rx + (this.rng() < 0.5 ? -36 : 36) : rx + (this.rng() - 0.5) * 240,
        vertical ? ry + (this.rng() - 0.5) * 240 : ry + (this.rng() < 0.5 ? -36 : 36),
        this.rng,
      );
      ped.wantsTaxi = this.rng() < 0.22;
      this.peds.push(ped);
    }
  }

  spawnPedsNear(x, y, n) {
    for (let i = 0; i < n; i++) {
      const s = this.city.snapToRoad(x + (this.rng() - 0.5) * 700, y + (this.rng() - 0.5) * 700);
      const ped = new Ped(
        s.vertical ? s.x + (this.rng() < 0.5 ? -36 : 36) : s.x + (this.rng() - 0.5) * 200,
        s.vertical ? s.y + (this.rng() - 0.5) * 200 : s.y + (this.rng() < 0.5 ? -36 : 36),
        this.rng,
      );
      this.peds.push(ped);
    }
  }

  seedCash() {
    for (let i = 0; i < 10; i++) {
      const rx = this.city.roadsX[1 + Math.floor(this.rng() * (GRID - 2))];
      const ry = this.city.roadsY[1 + Math.floor(this.rng() * (GRID - 2))];
      this.cashPickups.push({
        x: rx + (this.rng() - 0.5) * 180,
        y: ry + (this.rng() - 0.5) * 180,
        amount: 50 + Math.floor(this.rng() * 150),
      });
    }
  }

  // --- Queries used by cars / police ---------------------------------------
  collidesBuilding(x, y, r) {
    const b = this.city.buildingAt(x, y);
    if (b) return true;
    // Keep out of the sea.
    if (this.city.isSea(x, y)) return true;
    return false;
  }

  carAhead(car, dist) {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const other of this.cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * fx + dy * fy;
      const side = Math.abs(dx * -fy + dy * fx);
      if (along > 0 && along < dist && side < 30) return other;
    }
    for (const cop of this.police.cops) {
      const dx = cop.x - car.x;
      const dy = cop.y - car.y;
      const along = dx * fx + dy * fy;
      const side = Math.abs(dx * -fy + dy * fx);
      if (along > 0 && along < dist && side < 30) return cop;
    }
    return null;
  }

  maybeTurnTraffic(car, dt) {
    if (!car.ai) return;
    car.turnCd = (car.turnCd || 0) - dt;
    if (car.turnCd > 0) return;
    // Near an intersection centre?
    const cx = this.city.nearestRoadX(car.x);
    const cy = this.city.nearestRoadY(car.y);
    const nearX = Math.abs(car.x - cx) < 26;
    const nearY = Math.abs(car.y - cy) < 26;
    if (!nearX || !nearY) return;
    car.turnCd = 2 + Math.random() * 2;
    if (Math.random() > 0.45) return; // mostly go straight
    // Turn: switch axis, keep moving away from the intersection.
    if (car.ai.axis === 'x') {
      const dir = Math.random() < 0.5 ? 1 : -1;
      car.ai = { axis: 'y', dir, lane: cx + (dir > 0 ? 14 : -14), pace: car.ai.pace };
      car.y = cy + (dir > 0 ? 14 : -14);
    } else {
      const dir = Math.random() < 0.5 ? 1 : -1;
      car.ai = { axis: 'x', dir, lane: cy + (dir > 0 ? 14 : -14), pace: car.ai.pace };
      car.x = cx + (dir > 0 ? 14 : -14);
    }
  }

  // --- Player actions --------------------------------------------------------
  enterCar(car, silent) {
    const p = this.player;
    if (p.inCar) return;
    if (car.ai) {
      // Stealing a moving car: the driver bails and the law notices.
      car.ai = null;
      this.traffic = this.traffic.filter((c) => c !== car);
      if (!silent) {
        this.police.addHeat(WANTED.stealCar);
        this.hud.showToast('Car stolen! The PD has been tipped off (+1 ★)');
        const ped = new Ped(car.x - 30, car.y + 20, this.rng);
        ped.fleeFrom(car.x, car.y);
        this.peds.push(ped);
      }
    } else if (car.parked && !car.wasPlayerCar && !silent) {
      this.police.addHeat(WANTED.stealCar);
      this.hud.showToast('Car stolen! The PD has been tipped off (+1 ★)');
    }
    car.parked = false;
    car.stolen = true;
    p.inCar = true;
    p.car = car;
    car.wasPlayerCar = true;
    this.sound.engineStart(0);
  }

  exitCar() {
    const p = this.player;
    if (!p.inCar) return;
    const car = p.car;
    car.parked = true;
    car.speed = 0;
    car.throttle = 0;
    car.steer = 0;
    // Step out to the side.
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    p.angle = car.angle;
    p.inCar = false;
    p.car = null;
    this.sound.engineStop();
  }

  nearestCar(maxD) {
    const p = this.player;
    let best = null;
    let bestD = maxD;
    for (const c of this.cars) {
      if (c === p.car) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  damagePlayer(n) {
    const p = this.player;
    if (p.hurtT > 0 || this.state !== 'playing') return;
    p.hurtT = 0.5;
    p.health -= n;
    this.sound.hit();
    if (p.health <= 0) this.wasted();
  }

  busted() {
    if (this.state !== 'playing') return;
    this.money = Math.max(0, this.money - 200);
    this.police.clearAll();
    this.state = 'busted';
    this.endKind = 'busted';
    this.sound.busted();
    this.sound.siren(false);
    this.sound.engineStop();
    saveGame(this);
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.money = Math.max(0, this.money - 200);
    this.player.health = PLAYER.health;
    this.player.x = this.city.roadsX[6];
    this.player.y = this.city.roadsY[6] + 80;
    if (this.player.inCar) {
      this.player.car.parked = true;
      this.player.car = null;
      this.player.inCar = false;
    }
    this.police.clearAll();
    this.state = 'wasted';
    this.endKind = 'wasted';
    this.sound.fail();
    this.sound.siren(false);
    this.sound.engineStop();
    saveGame(this);
  }

  onWantedUp(n) {
    this.hud.showToast(n >= 3 ? `WANTED LEVEL ${n} — the whole PD is after you!` : `Wanted level ${n}`);
  }

  onWantedDown(n) {
    if (n === 0) this.hud.showToast('You lost them. The heat is off.');
  }

  onMissionComplete(def) {
    if (this.missions.done) {
      this.state = 'won';
      this.endKind = 'won';
      this.sound.engineStop();
      saveGame(this);
    } else {
      saveGame(this);
    }
  }

  currentObjectiveText() {
    if (this.missions.active) {
      const s = this.missions.active.def.steps[this.missions.active.step];
      if (!s) return null;
      let label = s.label;
      if (s.type === 'timedGoto') label += ` — ${Math.ceil(this.missions.active.timer)}s`;
      if (s.type === 'kill') label += ` (${this.missions.active.kills}/${s.count})`;
      if (s.type === 'channel') label += ` — hold still!`;
      return `★ ${this.missions.active.def.title}: ${label}`;
    }
    if (!this.missions.done) {
      const def = this.missions.currentDef;
      return `Drive to the yellow ! to start: ${def.title} ($${def.reward})`;
    }
    return null;
  }

  activeMarker() {
    if (this.missions.marker) return this.missions.marker;
    const sm = this.missions.startMarker();
    if (sm) return sm;
    if (this.taxi.state === 'dropoff' && this.taxi.dest) {
      return { x: this.taxi.dest.x, y: this.taxi.dest.y, label: 'Drop-off', color: '#7ee787' };
    }
    if (this.taxi.state === 'pickup' && this.taxi.passenger) {
      return { x: this.taxi.passenger.x, y: this.taxi.passenger.y, label: 'Passenger', color: '#7ee787' };
    }
    return null;
  }

  // --- Game flow -------------------------------------------------------------
  startNewGame() {
    clearSave();
    this.money = 150;
    this.missions.index = 0;
    this.missions.completed = 0;
    this.missions.totalEarned = 0;
    this.missions.active = null;
    this.missions.marker = null;
    this.missions.enemies = [];
    this.player.health = PLAYER.health;
    this.player.x = this.city.roadsX[7];
    this.player.y = this.city.roadsY[7];
    this.player.inCar = false;
    this.player.car = null;
    this.police.clearAll();
    this.state = 'playing';
    this.started = true;
    this.sound.ensure();
    this.sound.startMusic();
    this.missions.showBanner('Solmar Bay', 'Jax Moreno is back in town. Find a car, then find Lena.');
    saveGame(this);
  }

  continueGame() {
    const s = loadGame();
    if (!s) return this.startNewGame();
    this.money = s.money;
    this.missions.index = s.missionIndex;
    this.missions.completed = s.completed;
    this.missions.totalEarned = s.totalEarned;
    this.player.x = s.x;
    this.player.y = s.y;
    this.player.health = s.health;
    this.player.inCar = false;
    this.player.car = null;
    this.police.clearAll();
    this.state = 'playing';
    this.started = true;
    this.sound.ensure();
    this.sound.startMusic();
    this.missions.showBanner('Welcome back', `Mission ${this.missions.index + 1} of ${6} — $${Math.floor(this.money).toLocaleString()} in your pocket.`);
  }

  // --- Update ------------------------------------------------------------------
  update(dt) {
    const inp = this.input;
    const p = this.player;

    // Title screen.
    if (this.state === 'title' || this.state === 'howto') {
      if (inp.clicked) {
        const vw = this.canvas.clientWidth;
        const vh = this.canvas.clientHeight;
        if (this.state === 'howto') {
          this.state = 'title';
        } else {
          const btns = this.saveExists ? 3 : 2;
          let hit = -1;
          for (let i = 0; i < btns; i++) {
            const by = vh * 0.52 + i * 56;
            if (inp.mouseX > vw / 2 - 170 && inp.mouseX < vw / 2 + 170 && inp.mouseY > by && inp.mouseY < by + 44) hit = i;
          }
          if (hit === 0) {
            if (this.saveExists) this.continueGame();
            else this.startNewGame();
          } else if (hit === 1 && this.saveExists) {
            this.startNewGame();
          } else if ((hit === 1 && !this.saveExists) || hit === 2) {
            this.state = 'howto';
          }
        }
      }
      if (inp.wasPressed('Enter')) this.startNewGame();
      return;
    }

    // End screens.
    if (this.state === 'busted' || this.state === 'wasted' || this.state === 'won') {
      if (inp.clicked || inp.wasPressed('Enter')) {
        this.state = 'playing';
        this.player.health = PLAYER.health;
        this.sound.ensure();
        this.sound.startMusic();
      }
      return;
    }

    // Pause.
    if (inp.wasPressed('KeyP')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      if (this.state === 'paused') this.sound.engineStop();
    }
    if (this.state === 'paused') {
      if (inp.wasPressed('KeyR')) this.continueGame();
      return;
    }
    if (inp.wasPressed('KeyM')) {
      const muted = this.sound.toggleMute();
      this.hud.showToast(muted ? 'Muted' : 'Sound on');
    }
    if (inp.wasPressed('KeyR') && this.state === 'playing') this.continueGame();

    this.playT += dt;
    p.hurtT = Math.max(0, p.hurtT - dt);

    // Aim from the mouse.
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    const mwX = this.camera.x + (inp.mouseX - vw / 2) / this.camera.zoom;
    const mwY = this.camera.y + (inp.mouseY - vh / 2) / this.camera.zoom;
    this.aimAngle = Math.atan2(mwY - p.y, mwX - p.x);

    if (p.inCar) {
      const car = p.car;
      const mv = inp.moveVector();
      car.throttle = -mv.y; // W = forward
      car.steer = mv.x;
      if (inp.down('Space')) {
        car.speed *= 1 - 2.2 * dt;
        if (Math.random() < dt * 20) this.particles.smoke(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
      }
      car.update(dt, this);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      this.sound.engineStart(Math.abs(car.speed) / CAR.maxSpeed);
      if (inp.wasPressed('KeyE')) this.exitCar();
      // Hitting pedestrians with the car.
      if (Math.abs(car.speed) > 150) {
        for (const ped of this.peds) {
          if (!ped.dead && Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
            ped.dead = true;
            this.police.addHeat(WANTED.hitPed);
            this.particles.spawn(ped.x, ped.y, { n: 10, color: '#c0392b', speed: 120 });
            this.sound.crash();
          }
        }
      }
    } else {
      this.sound.engineStop();
      const mv = inp.moveVector();
      const running = inp.down('ShiftLeft') || inp.down('ShiftRight');
      const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const nx = p.x + mv.x * speed * dt;
      const ny = p.y + mv.y * speed * dt;
      p.moving = mv.x !== 0 || mv.y !== 0;
      if (p.moving) p.walkPhase += dt * 10;
      if (!this.city.buildingAt(nx, p.y) && !this.city.isSea(nx, p.y)) p.x = nx;
      if (!this.city.buildingAt(p.x, ny) && !this.city.isSea(p.x, ny)) p.y = ny;
      p.x = clamp(p.x, 20, WORLD - 20);
      p.y = clamp(p.y, 20, WORLD - 80);
      p.angle = this.aimAngle;
      if (inp.mouseDown) {
        if (this.combat.playerShoot(p.x, p.y, this.aimAngle)) {
          this.police.addHeat(0.05);
          for (const ped of this.peds) {
            if (!ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 320) ped.fleeFrom(p.x, p.y);
          }
        }
      }
      if (inp.wasPressed('KeyE')) {
        const car = this.nearestCar(70);
        if (car) this.enterCar(car);
        else {
          // Maybe start a mission at its marker.
          const sm = this.missions.startMarker();
          if (sm && Math.hypot(p.x - sm.x, p.y - sm.y) < 90) this.missions.startMission();
        }
      }
      if (inp.wasPressed('KeyT')) {
        let best = null;
        let bestD = 70;
        for (const ped of this.peds) {
          if (!ped.dead && ped.wantsTaxi) {
            const d = Math.hypot(ped.x - p.x, ped.y - p.y);
            if (d < bestD) {
              bestD = d;
              best = ped;
            }
          }
        }
        if (best) this.taxi.tryStart(best);
      }
    }

    // E near a mission start marker while in a car also starts it.
    if (inp.wasPressed('KeyE') && p.inCar) {
      const sm = this.missions.startMarker();
      if (sm && Math.hypot(p.x - sm.x, p.y - sm.y) < 90) this.missions.startMission();
    }

    // Traffic + peds + systems.
    for (const car of this.cars) {
      if (car === p.car) continue;
      car.update(dt, this);
    }
    this.cars = this.cars.filter((c) => !c.dead);
    this.traffic = this.traffic.filter((c) => !c.dead);
    // Keep traffic topped up near the player.
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.traffic.length < 16) {
      this.spawnT = 0.6;
      this.spawnTrafficCar(false);
    }
    // Despawn traffic far away.
    for (const c of this.traffic) {
      if (Math.hypot(c.x - p.x, c.y - p.y) > 1800) c.dead = true;
    }
    for (const ped of this.peds) ped.update(dt, this);
    this.peds = this.peds.filter((ped) => !ped.dead);
    if (this.peds.length < 30 && Math.random() < dt * 0.5) this.spawnPedsNear(p.x, p.y, 2);

    // Car-car collisions (player car vs traffic).
    if (p.inCar) {
      for (const other of this.cars) {
        if (other === p.car || other.parked) continue;
        const d = Math.hypot(other.x - p.car.x, other.y - p.car.y);
        if (d < 44) {
          const push = (44 - d) / 2;
          const a = Math.atan2(other.y - p.car.y, other.x - p.car.x);
          other.x += Math.cos(a) * push;
          other.y += Math.sin(a) * push;
          p.car.x -= Math.cos(a) * push * 0.5;
          p.car.y -= Math.sin(a) * push * 0.5;
          const impact = Math.abs(p.car.speed - other.speed);
          if (impact > 140) {
            this.sound.crash();
            this.particles.spawn(p.car.x, p.car.y, { n: 6, color: '#ffb347', speed: 90 });
            this.damagePlayer(3);
            other.speed *= 0.5;
            p.car.speed *= 0.7;
          }
        }
      }
    }

    // Cash pickups.
    for (const c of this.cashPickups) {
      if (Math.hypot(p.x - c.x, p.y - c.y) < 34) {
        c.taken = true;
        this.money += c.amount;
        this.sound.cash();
        this.hud.showToast(`+$${c.amount} found on the street`);
        this.particles.spawn(c.x, c.y, { n: 8, color: '#7ee787', speed: 80 });
      }
    }
    this.cashPickups = this.cashPickups.filter((c) => !c.taken);

    this.police.update(dt);
    this.missions.update(dt);
    for (const e of this.missions.enemies) e.update(dt, this);
    this.missions.enemies = this.missions.enemies.filter((e) => !e.dead || this.missions.active);
    this.taxi.update(dt);
    this.combat.update(dt);
    this.particles.update(dt);

    // Camera follows the player, zooming out a little at speed.
    const targetZoom = p.inCar ? 0.85 : 1.0;
    this.camera.zoom = lerp(this.camera.zoom, targetZoom, 1 - Math.pow(0.001, dt));
    this.camera.x = lerp(this.camera.x, p.x, 1 - Math.pow(0.0001, dt));
    this.camera.y = lerp(this.camera.y, p.y, 1 - Math.pow(0.0001, dt));

    // Autosave.
    this.saveT += dt;
    if (this.saveT > 12) {
      this.saveT = 0;
      saveGame(this);
    }
  }

  // --- Draw ------------------------------------------------------------------
  draw() {
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    this.renderer.draw(this, this.camera);
    const ctx = this.renderer.ctx;
    // Cash pickups under the HUD.
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    for (const c of this.cashPickups) {
      const pulse = 1 + Math.sin(performance.now() / 250) * 0.15;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.restore();
    }
    // Taxi-seeking peds wave a green $.
    for (const ped of this.peds) {
      if (ped.wantsTaxi && !ped.dead) {
        ctx.save();
        ctx.translate(ped.x, ped.y - 26);
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 1);
        ctx.restore();
      }
    }
    ctx.restore();

    if (this.state === 'playing' || this.state === 'paused') {
      this.hud.draw(ctx, vw, vh, this, this.camera);
      if (this.state === 'paused') drawPaused(ctx, vw, vh);
    } else if (this.state === 'title') {
      drawTitle(ctx, vw, vh, this, this.saveExists);
    } else if (this.state === 'howto') {
      drawHowTo(ctx, vw, vh);
    } else if (this.state === 'busted' || this.state === 'wasted' || this.state === 'won') {
      this.hud.draw(ctx, vw, vh, this, this.camera);
      drawEnd(ctx, vw, vh, this.endKind, this);
    }
  }

  drawEntities(ctx, view) {
    // Parked + traffic cars.
    for (const car of this.cars) {
      if (car.x < view.x0 - 60 || car.x > view.x1 + 60 || car.y < view.y0 - 60 || car.y > view.y1 + 60) continue;
      car.draw(ctx);
    }
    for (const ped of this.peds) {
      if (ped.x < view.x0 - 30 || ped.x > view.x1 + 30 || ped.y < view.y0 - 30 || ped.y > view.y1 + 30) continue;
      ped.draw(ctx);
    }
    this.police.draw(ctx);
    this.missions.drawMarkers(ctx);
    this.renderer.drawPlayer(ctx, this.player, this.aimAngle);
    this.combat.draw(ctx);
    this.particles.draw(ctx);
  }
}

// --- Boot ----------------------------------------------------------------------
const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const seedParam = parseInt(params.get('seed') || '', 10);
const seed = Number.isFinite(seedParam) ? seedParam : (Date.now() % 2147483647);
const world = new World(canvas, seed);
window.__solmar = world;

const shot = params.get('shot');
if (shot) {
  world.frozen = true;
  applyShot(world, shot);
}

let last = performance.now();
let frames = 0;
function frame(now) {
  const dt = Math.min(1 / 30, Math.max(0.001, (now - last) / 1000));
  last = now;
  try {
    if (!world.frozen) world.update(dt);
  } catch (err) {
    console.error('update error', err);
  }
  try {
    world.draw();
  } catch (err) {
    console.error('draw error', err);
  }
  world.input.endFrame();
  frames++;
  if (frames === 3) window.__solmarReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
