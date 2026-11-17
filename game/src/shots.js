// Screenshot poses. One job: when the page opens with ?shot=<name>, set the
// world up deterministically so the screenshots show the game at its best —
// no menu, no randomness between runs of the same shot.
import { Car } from './entities.js';

export const SHOTS = ['start', 'drive', 'chase', 'mission'];

export function applyShot(world, name) {
  const w = world;
  const p = w.player;
  if (name === 'start') {
    // Title screen: the menu draws itself; keep the world behind it pretty.
    w.state = 'title';
    p.x = w.city.roadsX[7];
    p.y = w.city.roadsY[7];
    return;
  }
  w.state = 'playing';
  w.started = true;
  if (name === 'drive') {
    // Driving a stolen coral coupe through downtown traffic, HUD + minimap on.
    const car = new Car(w.city.roadsX[7], w.city.roadsY[6] + 14, 0, { name: 'Coral Coupe', color: '#e4572e' });
    car.speed = 380;
    w.cars.push(car);
    w.enterCar(car, true);
    p.x = car.x;
    p.y = car.y;
    w.spawnTrafficNear(p.x, p.y, 10);
    w.spawnPedsNear(p.x, p.y, 12);
    w.camera.x = p.x + 120;
    w.camera.y = p.y + 40;
    w.camera.zoom = 0.9;
    w.missions.showBanner('Wheels Up', 'Steal a car — any car — and bring it to Lena\'s Garage.');
    w.missions.active = { def: { title: 'Wheels Up', steps: [{ type: 'goto', label: 'Drive to Lena\'s Garage' }] }, step: 0, timer: 0, kills: 0 };
    w.missions.marker = { x: w.city.roadsX[3], y: w.city.roadsY[3], label: 'Drive to Lena\'s Garage', color: '#ffd23f' };
  } else if (name === 'chase') {
    // Three-star police chase at the plaza: sirens, cop cars closing in.
    const car = new Car(w.city.roadsX[8], w.city.roadsY[8] - 14, Math.PI / 2, { name: 'Cherry Sport', color: '#c0392b' });
    car.speed = 420;
    w.cars.push(car);
    w.enterCar(car, true);
    p.x = car.x;
    p.y = car.y;
    w.police.setWanted(3);
    w.police.spawnCopCar();
    w.police.spawnCopCar();
    w.police.spawnCopCar();
    for (const c of w.police.cops) {
      c.x = p.x + (Math.random() - 0.5) * 420;
      c.y = p.y - 150 - Math.random() * 120;
    }
    w.spawnTrafficNear(p.x, p.y, 8);
    w.spawnPedsNear(p.x, p.y, 10);
    w.camera.x = p.x;
    w.camera.y = p.y + 60;
    w.camera.zoom = 0.85;
    w.missions.showBanner('Hot Wheels', 'Three stars. Lose them — break line of sight and lay low.');
    w.missions.active = { def: { title: 'Hot Wheels', steps: [{ type: 'loseWanted', label: 'Lose your 3-star wanted level' }] }, step: 0, timer: 0, kills: 0 };
  } else if (name === 'mission') {
    // On foot at the plaza, pistol out, Vipers closing in — mission 5 in progress.
    p.x = w.city.roadsX[8];
    p.y = w.city.roadsY[8] + 90;
    p.angle = -Math.PI / 2;
    w.aimAngle = -Math.PI / 2;
    w.missions.active = { def: { title: 'Street Sweep', steps: [{ type: 'kill', count: 6, label: 'Take out 6 Vipers at the plaza' }] }, step: 0, timer: 0, kills: 2 };
    w.missions.marker = { x: w.city.roadsX[8], y: w.city.roadsY[8], label: 'Take out 6 Vipers at the plaza', color: '#ff5555' };
    w.missions.spawnEnemies(w.city.roadsX[8], w.city.roadsY[8], 6);
    w.missions.enemies[0].dead = true;
    w.missions.enemies[1].dead = true;
    w.spawnPedsNear(p.x, p.y, 8);
    w.money = 2450;
    w.camera.x = p.x;
    w.camera.y = p.y - 40;
    w.camera.zoom = 1.0;
    w.missions.showBanner('Street Sweep', 'The Vipers took our corner. Take it back — six of them.');
  }
}
