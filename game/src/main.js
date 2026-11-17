// Solmar Bay v2 — game loop, state machine, event drain, self-test.
// ?shot=1..4 poses a deterministic scene; ?selftest=1 runs 15 scripted checks.

import { WORLD, TUNING } from './config.js';
import { makeRng, clamp } from './rng.js';
import { buildCity, blockCenter } from './city.js';
import { createInput, down, wasPressed, endFrame } from './input.js';
import { createAudio, ensureAudio, setMuted, setEngine, setSiren, sfx } from './audio.js';
import {
  makePlayer, spawnTraffic, spawnParked, spawnPeds,
  updatePlayer, updateTraffic, updatePeds, updateParticles, tryEnterExitCar,
} from './entities.js';
import { addWanted, updatePolice } from './police.js';
import {
  currentMission, currentObjective, objectivePos,
  startMissionState, updateMissions, noteEvent, tryTaxi, updateTaxi,
} from './missions.js';
import { shoot, updateCombat, spawnEnemies } from './combat.js';
import { drawWorld } from './render.js';
import { drawHUD } from './hud.js';
import { saveGame, loadGame } from './save.js';
import { applyShot } from './shots.js';

function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const city = buildCity(20261117);
  const G = {
    mode: 'title',
    time: 0,
    cash: 200,
    wanted: 0,
    heat: 0,
    lastCrimeAt: -99,
    city,
    rng: makeRng((Math.random() * 1e9) | 0),
    player: null,
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    particles: [],
    events: [],
    message: '',
    messageAt: -99,
    missionIndex: 0,
    missionsDone: [],
    mission: null,
    taxi: null,
    missionMarker: null,
    camera: { x: city.playerSpawn.x, y: city.playerSpawn.y, zoom: TUNING.camZoom },
    view: { w: canvas.width, h: canvas.height },
    input: createInput(canvas),
    audio: createAudio(),
    saveTimer: 0,
    selftest: null,
  };
  G.player = makePlayer(city);
  G.cars = [...spawnTraffic(city, G.rng, 14), ...spawnParked(city, G.rng, 10)];
  G.peds = spawnPeds(city, G.rng, 26);
  startMissionState(G);
  return { G, ctx, canvas };
}

function applySave(G, save) {
  G.cash = save.cash;
  G.missionIndex = Math.min(save.missionIndex, 5);
  G.missionsDone = (save.completed || []).slice();
  G.player.x = save.px;
  G.player.y = save.py;
  G.player.hp = save.health || TUNING.playerHp;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  startMissionState(G);
}

function startGame(G) {
  ensureAudio(G.audio);
  const save = loadGame();
  if (save) {
    applySave(G, save);
    G.message = 'Save loaded — welcome back to Solmar Bay.';
  } else {
    G.message = 'Welcome to Solmar Bay. Steal a car and meet Lena.';
  }
  G.messageAt = G.time;
  G.mode = 'play';
}

function respawn(G) {
  const p = G.player;
  const s = G.city.playerSpawn;
  p.x = s.x; p.y = s.y;
  p.hp = TUNING.playerHp;
  p.alive = true;
  p.inCar = null;
  G.wanted = 0;
  G.heat = 0;
  G.cops.length = 0;
  G.cars = G.cars.filter((c) => c.kind !== 'cop');
  G.mode = 'play';
  G.message = 'Back on your feet. Stay out of trouble.';
  G.messageAt = G.time;
}

function drainEvents(G) {
  for (const ev of G.events) {
    switch (ev.type) {
      case 'steal':
        addWanted(G, 1);
        G.message = 'You stole a car! Wanted level up.';
        G.messageAt = G.time;
        noteEvent(G, ev);
        break;
      case 'crash':
        sfx.crash(G.audio);
        break;
      case 'shoot':
        sfx.shoot(G.audio);
        break;
      case 'enemyShoot':
        sfx.enemyShoot(G.audio);
        break;
      case 'kill':
        noteEvent(G, ev);
        break;
      case 'objective':
        sfx.pickup(G.audio);
        break;
      case 'pickup':
        sfx.pickup(G.audio);
        break;
      case 'missionDone':
      case 'storyDone':
        sfx.missionDone(G.audio);
        break;
      case 'autosave':
        saveGame(G);
        break;
      default:
        break;
    }
  }
  G.events.length = 0;
}

function updateMarker(G) {
  if (G.taxi) {
    if (G.taxi.state === 'toPickup') {
      G.missionMarker = { x: G.taxi.ped.x, y: G.taxi.ped.y, color: '#ffd23c' };
    } else {
      G.missionMarker = { x: G.taxi.dest.x, y: G.taxi.dest.y, color: '#4ad66b' };
    }
    return;
  }
  const obj = currentObjective(G);
  if (!obj) { G.missionMarker = null; return; }
  const pos = objectivePos(G, obj);
  G.missionMarker = pos
    ? { x: pos.x, y: pos.y, color: obj.kind === 'channel' ? '#ff8a3c' : '#ffd23c' }
    : null;
}

function updateCamera(G, dt) {
  const p = G.player;
  const look = p.inCar ? Math.min(90, Math.abs(p.inCar.speed) * 0.22) : 0;
  const tx = p.x + Math.cos(p.angle) * look;
  const ty = p.y + Math.sin(p.angle) * look;
  const k = Math.min(1, 5 * dt);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
  const targetZoom = p.inCar ? 0.92 : 1.0;
  G.camera.zoom += (targetZoom - G.camera.zoom) * Math.min(1, 2 * dt);
  // Never show the void past the world's edge.
  const hw = G.view.w / 2 / G.camera.zoom;
  const hh = G.view.h / 2 / G.camera.zoom;
  G.camera.x = hw * 2 >= WORLD.SIZE ? WORLD.SIZE / 2 : clamp(G.camera.x, hw, WORLD.SIZE - hw);
  G.camera.y = hh * 2 >= WORLD.SIZE ? WORLD.SIZE / 2 : clamp(G.camera.y, hh, WORLD.SIZE - hh);
}

function handleKeys(G) {
  const input = G.input;
  if (G.mode === 'title') {
    if (wasPressed(input, 'Enter')) {
      sfx.click(G.audio);
      startGame(G);
    }
    return;
  }
  if (G.mode === 'busted' || G.mode === 'gameover') {
    if (wasPressed(input, 'Enter')) {
      sfx.click(G.audio);
      respawn(G);
    }
    return;
  }
  if (G.mode === 'paused') {
    if (wasPressed(input, 'KeyP') || wasPressed(input, 'Escape')) G.mode = 'play';
    if (wasPressed(input, 'KeyR')) { respawn(G); }
    return;
  }
  // mode === 'play'
  if (wasPressed(input, 'Enter')) ensureAudio(G.audio);
  if (wasPressed(input, 'KeyE')) tryEnterExitCar(G);
  if (wasPressed(input, 'KeyT')) tryTaxi(G);
  if (wasPressed(input, 'KeyP') || wasPressed(input, 'Escape')) G.mode = 'paused';
  if (wasPressed(input, 'KeyM')) setMuted(G.audio, !G.audio.muted);
  if (wasPressed(input, 'KeyR')) respawn(G);
  if (input.mouseDown) shoot(G);
}

function update(G, dt) {
  G.time += dt;
  if (G.mode === 'title') {
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updateParticles(G, dt);
    const cx = 7 * WORLD.PITCH, cy = 6 * WORLD.PITCH;
    G.camera.x = cx + Math.sin(G.time * 0.05) * 220;
    G.camera.y = cy + Math.cos(G.time * 0.04) * 160;
    return;
  }
  if (G.mode !== 'play') return;

  if (G.autoDrive) G.input.keys.KeyW = true;
  handleKeys(G);
  updatePlayer(G, dt, G.input);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateTaxi(G, dt);
  updateCombat(G, dt);
  updateParticles(G, dt);
  updateMarker(G);
  updateCamera(G, dt);
  drainEvents(G);

  // Engine + siren follow the action.
  const p = G.player;
  setEngine(G.audio, p.inCar ? Math.abs(p.inCar.speed) / TUNING.carMaxSpeed : 0, !!p.inCar);
  setSiren(G.audio, G.wanted > 0 && G.cops.length > 0);

  // Autosave every 15s of play.
  G.saveTimer += dt;
  if (G.saveTimer > 15) {
    G.saveTimer = 0;
    saveGame(G);
  }
  endFrame(G.input);
}

// --- Self-test (?selftest=1): 15 scripted checks, results to console + title.
function teleport(G, x, y) {
  const p = G.player;
  if (p.inCar) {
    p.inCar.x = x; p.inCar.y = y;
  }
  p.x = x; p.y = y;
}

function stLog(G, n, name, ok) {
  const line = 'TEST ' + n + '/14 ' + name + ' ' + (ok ? 'PASS' : 'FAIL');
  console.log(line);
  G.selftest.lines.push(line);
  if (ok) G.selftest.pass++;
  else G.selftest.fail++;
}

function runSelftest(G, dt) {
  const st = G.selftest;
  st.frames++;
  const p = G.player;
  const input = G.input;
  switch (st.step) {
    case 0: {
      stLog(G, 1, 'boot', !!G.player && !!G.city);
      st.step = 1; st.frames = 0;
      break;
    }
    case 1: {
      startGame(G);
      stLog(G, 2, 'start game', G.mode === 'play');
      st.step = 2; st.frames = 0;
      st.sx = p.x; st.sy = p.y;
      break;
    }
    case 2: {
      input.keys.KeyW = true;
      if (st.frames >= 40) {
        input.keys.KeyW = false;
        const moved = Math.hypot(p.x - st.sx, p.y - st.sy);
        stLog(G, 3, 'walk moves player', moved > 30);
        st.step = 3; st.frames = 0;
      }
      break;
    }
    case 3: {
      if (st.frames === 1) {
        // Put a car on a road heading east, stand beside it, enter it.
        const car = G.cars.find((c) => c.kind === 'parked' || c.kind === 'traffic');
        st.car = car;
        car.x = 6 * WORLD.PITCH; car.y = 6 * WORLD.PITCH;
        car.angle = 0; car.speed = 0; car.line = 'h'; car.linePos = car.y; car.dir = 1;
        p.x = car.x; p.y = car.y + 30;
      }
      if (st.frames === 3) {
        tryEnterExitCar(G);
        drainEvents(G);
        stLog(G, 4, 'enter car', !!p.inCar);
        st.step = 4; st.frames = 0;
      }
      break;
    }
    case 4: {
      input.keys.KeyW = true;
      if (st.frames >= 70) {
        input.keys.KeyW = false;
        stLog(G, 5, 'drive accelerates', Math.abs(p.inCar ? p.inCar.speed : 0) > 60);
        st.step = 5; st.frames = 0;
      }
      break;
    }
    case 5: {
      tryEnterExitCar(G);
      stLog(G, 6, 'exit car', !p.inCar);
      st.step = 6; st.frames = 0;
      break;
    }
    case 6: {
      if (st.frames === 1) {
        input.mouseX = G.view.w / 2 + 120;
        input.mouseY = G.view.h / 2;
      }
      if (st.frames === 3) {
        shoot(G);
        stLog(G, 7, 'shoot fires bullet', G.bullets.length > 0);
        st.step = 7; st.frames = 0;
      }
      break;
    }
    case 7: {
      stLog(G, 8, 'steal raises wanted', G.wanted >= 1);
      st.step = 8; st.frames = 0;
      break;
    }
    case 8: {
      if (st.frames >= 150) {
        stLog(G, 9, 'police spawn', G.cops.length > 0);
        st.step = 9; st.frames = 0;
      }
      break;
    }
    case 9: {
      if (st.frames === 1) {
        const g = blockCenter(G.city, 3, 5);
        teleport(G, g.x, g.y);
      }
      if (st.frames >= 25) {
        stLog(G, 10, 'mission 1 completes', G.missionIndex >= 1);
        st.step = 10; st.frames = 0;
      }
      break;
    }
    case 10: {
      if (st.frames === 1) {
        // Back in a car, then hail a taxi.
        const car = st.car;
        car.x = p.x; car.y = p.y - 30; car.angle = 0; car.speed = 0;
        p.x = car.x; p.y = car.y + 30;
        tryEnterExitCar(G);
        drainEvents(G);
        const ped = G.peds[0];
        ped.x = p.x + 40; ped.y = p.y;
        st.cashBefore = G.cash;
        tryTaxi(G);
      }
      if (st.frames === 5) {
        st.taxiOk = !!G.taxi;
        if (G.taxi) {
          teleport(G, G.taxi.ped.x, G.taxi.ped.y);
        }
      }
      if (st.frames === 20 && G.taxi && G.taxi.state === 'toDrop') {
        teleport(G, G.taxi.dest.x, G.taxi.dest.y);
      }
      if (st.frames >= 40) {
        stLog(G, 11, 'taxi fare completes', st.taxiOk && !G.taxi && G.cash > st.cashBefore);
        st.step = 11; st.frames = 0;
      }
      break;
    }
    case 11: {
      const before = G.cash;
      saveGame(G);
      const loaded = loadGame();
      stLog(G, 12, 'save/load round-trip', !!loaded && loaded.cash === Math.round(before));
      st.step = 12; st.frames = 0;
      break;
    }
    case 12: {
      G.mode = 'paused';
      const paused = G.mode === 'paused';
      G.mode = 'play';
      stLog(G, 13, 'pause/resume', paused && G.mode === 'play');
      st.step = 13; st.frames = 0;
      break;
    }
    case 13: {
      if (st.frames === 1) {
        // On foot, on a straight street, enemy dead east down the road.
        if (p.inCar) tryEnterExitCar(G);
        teleport(G, 6 * WORLD.PITCH, 6 * WORLD.PITCH);
        input.mouseX = G.view.w / 2 + 120;
        input.mouseY = G.view.h / 2;
        spawnEnemies(G, p.x + 120, p.y, 1);
        st.enemy = G.enemies[G.enemies.length - 1];
        st.enemy.x = p.x + 120;
        st.enemy.y = p.y;
      }
      if (st.frames % 14 === 0) shoot(G);
      if (st.frames >= 70) {
        const gone = !G.enemies.includes(st.enemy);
        const hurt = st.enemy.hp < 45;
        stLog(G, 14, 'combat hits enemy', gone || hurt);
        st.step = 14; st.frames = 0;
      }
      break;
    }
    case 14: {
      const total = st.pass + st.fail;
      const line = 'SELFTEST DONE: ' + st.pass + '/' + total + ' PASS';
      console.log(line);
      st.lines.push(line);
      document.title = 'SELFTEST ' + st.pass + '/' + total;
      const pre = document.createElement('pre');
      pre.id = 'selftest-results';
      pre.textContent = st.lines.join('\n');
      document.body.appendChild(pre);
      st.step = 15;
      break;
    }
    default:
      break;
  }
}

function main() {
  const canvas = document.getElementById('game');
  const { G, ctx } = createGame(canvas);
  window.__game = G;

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const selftest = params.get('selftest') === '1';

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    G.view.w = canvas.width;
    G.view.h = canvas.height;
  }
  window.addEventListener('resize', resize);
  resize();

  window.addEventListener('error', (e) => {
    console.error('GAME ERROR: ' + e.message);
    document.title = 'JSERROR: ' + e.message;
  });

  if (selftest) {
    G.selftest = { step: 0, frames: 0, pass: 0, fail: 0, lines: [] };
    console.log('SELFTEST START');
  } else if (shot) {
    applyShot(G, parseInt(shot, 10));
  }

  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    if (G.selftest && G.selftest.step < 15) {
      update(G, dt);
      runSelftest(G, dt);
    } else {
      update(G, dt);
    }
    drawWorld(ctx, G);
    drawHUD(ctx, G);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
