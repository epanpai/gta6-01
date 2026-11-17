// HUD: cash, health, wanted stars, objective panel, minimap, messages,
// title / pause / busted / game-over screens. All drawn on the same canvas.

import { WORLD, COLORS, TUNING, HELP_LINES } from './config.js';
import { currentMission, currentObjective, objectivePos } from './missions.js';

function stars(ctx, x, y, n) {
  ctx.font = '22px system-ui';
  ctx.textAlign = 'left';
  for (let i = 0; i < TUNING.starsMax; i++) {
    ctx.fillStyle = i < n ? '#ffd23c' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x + i * 24, y);
  }
}

function drawMinimap(ctx, G) {
  const size = TUNING.minimap;
  const x0 = 14, y0 = G.view.h - size - 14;
  const s = size / WORLD.SIZE;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,12,0.82)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Sea + land.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#57a05a';
  ctx.fillRect(x0, y0, size, size - WORLD.BEACH_H * s);
  // Roads.
  ctx.fillStyle = '#34373d';
  for (const x of G.city.streetsX) ctx.fillRect(x0 + x * s - 1, y0, 2, size);
  for (const y of G.city.streetsY) ctx.fillRect(x0, y0 + y * s - 1, size, 2);
  // Player.
  const p = G.player;
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath(); ctx.arc(x0 + p.x * s, y0 + p.y * s, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#20242c';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x0 + p.x * s, y0 + p.y * s, 4, 0, Math.PI * 2); ctx.stroke();
  // Cops.
  ctx.fillStyle = '#ff3b30';
  for (const c of G.cops) {
    ctx.beginPath(); ctx.arc(x0 + c.x * s, y0 + c.y * s, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Objective marker.
  if (G.missionMarker) {
    const m = G.missionMarker;
    const pulse = 3 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = m.color || '#ffd23c';
    ctx.beginPath(); ctx.arc(x0 + m.x * s, y0 + m.y * s, pulse, 0, Math.PI * 2); ctx.fill();
  }
  // Camera view rect.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(
    x0 + (G.camera.x - G.view.w / 2 / G.camera.zoom) * s,
    y0 + (G.camera.y - G.view.h / 2 / G.camera.zoom) * s,
    (G.view.w / G.camera.zoom) * s,
    (G.view.h / G.camera.zoom) * s,
  );
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,16,12,0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawHUD(ctx, G) {
  const { w, h } = G.view;
  const p = G.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash + health.
  panel(ctx, 12, 12, 220, 64);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 22px system-ui';
  ctx.fillText('$' + Math.round(G.cash).toLocaleString('en-US'), 24, 40);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '13px system-ui';
  ctx.fillText('HP', 24, 62);
  ctx.fillStyle = '#333';
  ctx.fillRect(52, 50, 140, 12);
  ctx.fillStyle = p.hp > 30 ? '#4ad66b' : '#ff4a3c';
  ctx.fillRect(52, 50, 140 * Math.max(0, p.hp / TUNING.playerHp), 12);

  // Top-right: wanted stars + mission name.
  const m = currentMission(G);
  panel(ctx, w - 244, 12, 232, 64);
  stars(ctx, w - 232, 38, G.wanted);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '13px system-ui';
  ctx.fillText(m ? 'Mission ' + m.id + '/6: ' + m.name : 'Story complete!', w - 232, 62);

  // Objective panel (bottom centre).
  const obj = currentObjective(G);
  if (obj && G.mode === 'play') {
    const text = obj.text;
    ctx.font = 'bold 15px system-ui';
    const tw = ctx.measureText(text).width;
    const bw = Math.min(w - 40, tw + 28);
    panel(ctx, (w - bw) / 2, h - 84, bw, 34);
    ctx.fillStyle = '#ffd23c';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h - 61);
    ctx.textAlign = 'left';
    if (obj.kind === 'tail' || obj.kind === 'survive' || obj.kind === 'channel') {
      const total = obj.seconds || 1;
      const done = obj.kind === 'tail' || obj.kind === 'channel'
        ? (G.mission ? G.mission.progress : 0) : (G.mission ? G.mission.timer : 0);
      const frac = Math.max(0, Math.min(1, done / total));
      ctx.fillStyle = '#333';
      ctx.fillRect((w - bw) / 2 + 10, h - 44, bw - 20, 6);
      ctx.fillStyle = '#ffd23c';
      ctx.fillRect((w - bw) / 2 + 10, h - 44, (bw - 20) * frac, 6);
    }
    if (obj.kind === 'kill') {
      ctx.fillStyle = '#fff';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('(' + (G.mission ? G.mission.progress : 0) + '/' + obj.count + ')', w / 2, h - 92);
      ctx.textAlign = 'left';
    }
  }

  // Speed + context hint (bottom right).
  if (p.inCar) {
    panel(ctx, w - 190, h - 64, 178, 52);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.32) + ' km/h', w - 178, h - 30);
    ctx.fillStyle = '#bbb';
    ctx.font = '12px system-ui';
    ctx.fillText('E — exit car', w - 178, h - 20 + 14);
  } else if (G.mode === 'play') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px system-ui';
    ctx.fillText('E — enter car    T — taxi    P — pause', w - 250, h - 20);
  }

  // Taxi status.
  if (G.taxi) {
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(
      G.taxi.state === 'toPickup' ? 'TAXI: pick up the passenger' : 'TAXI: drive to the green marker',
      14, h - TUNING.minimap - 30,
    );
  }

  // Message banner.
  if (G.message && G.time - G.messageAt < 5) {
    ctx.font = 'bold 16px system-ui';
    const tw = ctx.measureText(G.message).width;
    panel(ctx, (w - tw - 28) / 2, 92, tw + 28, 34);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.message, w / 2, 115);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, G);

  // Mode screens.
  if (G.mode === 'title') drawTitle(ctx, G);
  else if (G.mode === 'paused') drawPaused(ctx, G);
  else if (G.mode === 'busted') drawBusted(ctx, G);
  else if (G.mode === 'gameover') drawGameOver(ctx, G);
}

function drawTitle(ctx, G) {
  const { w, h } = G.view;
  ctx.fillStyle = 'rgba(8,14,10,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 64px system-ui';
  ctx.fillText('SOLMAR BAY', w / 2, h * 0.30);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui';
  ctx.fillText('An original open-world crime game — a sun-soaked city, yours to take.', w / 2, h * 0.30 + 36);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 22px system-ui';
  const blink = Math.floor(G.time * 2) % 2 === 0;
  if (blink) ctx.fillText('Press ENTER to start', w / 2, h * 0.30 + 84);
  ctx.fillStyle = '#ddd';
  ctx.font = '15px system-ui';
  HELP_LINES.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.52 + i * 24));
  ctx.fillStyle = '#999';
  ctx.font = '12px system-ui';
  ctx.fillText('Original work — no affiliation with Rockstar Games or Grand Theft Auto.', w / 2, h - 24);
  ctx.textAlign = 'left';
}

function drawPaused(ctx, G) {
  const { w, h } = G.view;
  ctx.fillStyle = 'rgba(8,14,10,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px system-ui';
  ctx.fillText('PAUSED', w / 2, h / 2 - 10);
  ctx.font = '16px system-ui';
  ctx.fillText('Press P to resume · R to restart from save', w / 2, h / 2 + 26);
  ctx.textAlign = 'left';
}

function drawBusted(ctx, G) {
  const { w, h } = G.view;
  ctx.fillStyle = 'rgba(20,10,10,0.66)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4a';
  ctx.font = 'bold 56px system-ui';
  ctx.fillText('BUSTED!', w / 2, h / 2 - 8);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui';
  ctx.fillText(G.message || '', w / 2, h / 2 + 30);
  ctx.textAlign = 'left';
}

function drawGameOver(ctx, G) {
  const { w, h } = G.view;
  ctx.fillStyle = 'rgba(10,8,8,0.7)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4a';
  ctx.font = 'bold 56px system-ui';
  ctx.fillText('FLATLINED', w / 2, h / 2 - 8);
  ctx.fillStyle = '#fff';
  ctx.font = '18px system-ui';
  ctx.fillText('Press ENTER to get back on your feet.', w / 2, h / 2 + 30);
  ctx.textAlign = 'left';
}
