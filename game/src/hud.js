// HUD, minimap and menus. One job: everything drawn on top of the world —
// health, money, wanted stars, mission text, the minimap, and the screens
// between play (title, pause, busted, wasted).
import { WORLD, BEACH_H } from './config.js';

export function drawStars(ctx, wanted, x, y) {
  ctx.save();
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const sx = x + i * 30;
    ctx.strokeText('★', sx, y);
    ctx.fillText('★', sx, y);
  }
  ctx.restore();
}

export class Hud {
  constructor() {
    this.toast = null; // {text, t}
  }

  showToast(text) {
    this.toast = { text, t: 3 };
  }

  draw(ctx, vw, vh, world, cam) {
    const p = world.player;
    // --- Top-left: wanted stars + heat bar ---
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.55)';
    roundRectPath(ctx, 12, 12, 178, 54, 10);
    ctx.fill();
    drawStars(ctx, world.police.wanted, 22, 32);
    if (world.police.wanted > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(22, 52, 150, 5);
      ctx.fillStyle = '#ff8c42';
      ctx.fillRect(22, 52, 150 * (world.police.decayT / 14), 5);
    }
    ctx.restore();

    // --- Top-right: money + health ---
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.55)';
    roundRectPath(ctx, vw - 212, 12, 200, 54, 10);
    ctx.fill();
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('$' + Math.floor(world.money).toLocaleString(), vw - 24, 30);
    // Health bar
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(vw - 188, 46, 164, 10);
    ctx.fillStyle = p.health > 30 ? '#4ade80' : '#ef4444';
    ctx.fillRect(vw - 188, 46, 164 * (p.health / 100), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HEALTH', vw - 188, 51);
    ctx.restore();

    // --- Mission objective (top-centre) ---
    const obj = world.currentObjectiveText();
    if (obj) {
      ctx.save();
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(obj).width + 28;
      ctx.fillStyle = 'rgba(10,14,24,0.6)';
      roundRectPath(ctx, (vw - w) / 2, 12, w, 32, 8);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj, vw / 2, 29);
      ctx.restore();
    }

    // --- Bottom-left: weapon / car status ---
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.55)';
    roundRectPath(ctx, 12, vh - 62, 300, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
      ctx.fillText(`🚗 ${p.car.name}`, 24, vh - 46);
      ctx.fillText(`${kmh} km/h`, 24, vh - 26);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.fillText('E exit · Space handbrake', 150, vh - 26);
    } else {
      const ammo = world.combat.reloadT > 0 ? 'RELOADING…' : `🔫 Pistol  ${world.combat.ammo} / ${world.combat.ammoMax}`;
      ctx.fillText(ammo, 24, vh - 46);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.fillText('E enter car · Click shoot · Shift run', 24, vh - 26);
    }
    ctx.restore();

    // --- Minimap (bottom-right) ---
    this.drawMinimap(ctx, vw, vh, world);

    // --- Channel progress (vault cracking) ---
    if (world.missions.active && world.missions.channelT > 0) {
      const s = world.missions.active.def.steps[world.missions.active.step];
      if (s && s.type === 'channel') {
        const frac = world.missions.channelT / s.seconds;
        ctx.save();
        ctx.fillStyle = 'rgba(10,14,24,0.65)';
        roundRectPath(ctx, vw / 2 - 140, vh - 120, 280, 34, 8);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(vw / 2 - 130, vh - 109, 260 * frac, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CRACKING THE VAULT…', vw / 2, vh - 88);
        ctx.restore();
      }
    }

    // --- Busted progress ---
    if (world.police.bustedT > 0.2) {
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BUSTED?!', vw / 2, 120);
      ctx.restore();
    }

    // --- Banner (mission title / briefing) ---
    const b = world.missions.banner;
    if (b) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.t);
      ctx.fillStyle = 'rgba(10,14,24,0.72)';
      roundRectPath(ctx, vw / 2 - 320, 84, 640, 86, 12);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.title, vw / 2, 112);
      ctx.fillStyle = '#fff';
      ctx.font = '15px sans-serif';
      wrapText(ctx, b.sub, vw / 2, 138, 600, 19);
      ctx.restore();
    }

    // --- Toast ---
    if (this.toast) {
      this.toast.t -= 1 / 60;
      if (this.toast.t <= 0) this.toast = null;
      else {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.toast.t);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.toast.text, vw / 2, vh - 96);
        ctx.restore();
      }
    }

    // --- Off-screen marker arrow ---
    this.drawMarkerArrow(ctx, vw, vh, world, cam);
  }

  drawMarkerArrow(ctx, vw, vh, world, cam) {
    const m = world.activeMarker();
    if (!m) return;
    const sx = (m.x - cam.x) * cam.zoom + vw / 2;
    const sy = (m.y - cam.y) * cam.zoom + vh / 2;
    if (sx > 40 && sx < vw - 40 && sy > 40 && sy < vh - 40) return;
    const cx = Math.max(50, Math.min(vw - 50, sx));
    const cy = Math.max(80, Math.min(vh - 80, sy));
    const a = Math.atan2(sy - vh / 2, sx - vw / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-8, -12);
    ctx.lineTo(-8, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const d = Math.round(Math.hypot(m.x - world.player.x, m.y - world.player.y));
    ctx.save();
    ctx.fillStyle = m.color;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${m.label} · ${d}m`, Math.max(110, Math.min(vw - 110, cx)), cy + 28);
    ctx.restore();
  }

  drawMinimap(ctx, vw, vh, world) {
    const size = 190;
    const x0 = vw - size - 14;
    const y0 = vh - size - 14;
    const scale = size / WORLD;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,24,0.72)';
    roundRectPath(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    // Ground
    ctx.fillStyle = '#3f6b34';
    ctx.fillRect(x0, y0, size, size);
    // Beach + sea
    ctx.fillStyle = '#e8cf9a';
    ctx.fillRect(x0, y0 + (WORLD - BEACH_H) * scale, size, BEACH_H * scale);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(x0, y0 + (WORLD - 70) * scale, size, 70 * scale);
    // Roads
    ctx.fillStyle = '#9aa0aa';
    for (const rx of world.city.roadsX) ctx.fillRect(x0 + rx * scale - 1, y0, 2, size);
    for (const ry of world.city.roadsY) ctx.fillRect(x0, y0 + ry * scale - 1, size, 2);
    // Mission marker
    const m = world.activeMarker();
    if (m) {
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(x0 + m.x * scale, y0 + m.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Police (flashing blue)
    if (Math.floor(performance.now() / 400) % 2 === 0) ctx.fillStyle = '#3b82f6';
    else ctx.fillStyle = '#ef4444';
    for (const c of world.police.cops) {
      ctx.beginPath();
      ctx.arc(x0 + c.x * scale, y0 + c.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Traffic (white dots, sparse)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const c of world.traffic) {
      if (Math.abs(c.x - world.player.x) > 1200 || Math.abs(c.y - world.player.y) > 1200) continue;
      ctx.fillRect(x0 + c.x * scale - 1, y0 + c.y * scale - 1, 2, 2);
    }
    // Player arrow
    const p = world.player;
    ctx.save();
    ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
    ctx.rotate(p.inCar ? p.car.angle : p.angle);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4.5);
    ctx.lineTo(-5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North + label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', x0 + 6, y0 + 14);
    ctx.font = '11px sans-serif';
    ctx.fillText('SOLMAR BAY', x0 + 6, y0 + size - 8);
    ctx.restore();
  }
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, y + i * lh));
}

// --- Full-screen menus, drawn on the canvas ---
export function drawTitle(ctx, vw, vh, world, saveExists) {
  ctx.save();
  // Golden-hour gradient sky over the city silhouette.
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, '#1b2a4a');
  g.addColorStop(0.55, '#c96f4a');
  g.addColorStop(1, '#f2c200');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  // Sun — kept clear of the title block on the right.
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(vw * 0.14, vh * 0.2, 56, 0, Math.PI * 2);
  ctx.fill();
  // Skyline silhouette
  ctx.fillStyle = '#241a2e';
  let x = 0;
  const heights = [120, 200, 150, 260, 180, 300, 140, 220, 170, 250, 130, 190];
  let i = 0;
  while (x < vw) {
    const bw = 90 + ((i * 53) % 60);
    const bh = heights[i % heights.length];
    ctx.fillRect(x, vh - bh - 90, bw, bh + 90);
    x += bw + 8;
    i++;
  }
  ctx.fillStyle = '#160f1e';
  ctx.fillRect(0, vh - 90, vw, 90);
  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillText('SOLMAR BAY', vw / 2, vh * 0.32);
  ctx.fillStyle = '#fff';
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText('an open-world crime story', vw / 2, vh * 0.32 + 36);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Steal cars. Outrun the law. Run the city.', vw / 2, vh * 0.32 + 66);
  // Buttons
  const btns = saveExists
    ? ['▶  CONTINUE', '★  NEW GAME', 'HOW TO PLAY']
    : ['▶  NEW GAME', 'HOW TO PLAY'];
  btns.forEach((label, idx) => {
    const by = vh * 0.52 + idx * 56;
    ctx.fillStyle = idx === 0 ? '#ffd23f' : 'rgba(255,255,255,0.15)';
    roundRectPath(ctx, vw / 2 - 170, by, 340, 44, 8);
    ctx.fill();
    ctx.fillStyle = idx === 0 ? '#1a1a1a' : '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(label, vw / 2, by + 28);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '13px sans-serif';
  ctx.fillText('WASD move · Mouse aim · Click shoot · E enter car · M mute · P pause', vw / 2, vh - 24);
  ctx.restore();
  return btns;
}

export function drawHowTo(ctx, vw, vh) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.92)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HOW TO PLAY', vw / 2, 90);
  const lines = [
    ['ON FOOT', 'WASD / arrows — walk (Shift to run). Mouse — aim. Click — shoot. E — enter a car.'],
    ['DRIVING', 'W / S — gas & brake, A / D — steer, Space — handbrake, E — get out.'],
    ['WANTED', 'Stealing cars, hurting people and shooting raise your wanted level.'],
    ['        ', 'Police chase you — break line of sight and lay low until the stars fade.'],
    ['MISSIONS', 'Drive to the yellow ! marker to start a mission. Finish all six to run Solmar.'],
    ['SIDE JOBS', 'Flag a taxi (press T near a waving pedestrian) for quick cash fares.'],
    ['SAVE', 'Your money and mission progress save automatically. P — pause, M — mute.'],
  ];
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'left';
  let y = 150;
  for (const [head, body] of lines) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(head, vw / 2 - 380, y);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(body, vw / 2 - 280, y);
    y += 34;
  }
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Click anywhere to go back', vw / 2, vh - 60);
  ctx.restore();
}

export function drawPaused(ctx, vw, vh) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.7)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', vw / 2, vh / 2 - 20);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('P — resume · M — mute · R — restart from save', vw / 2, vh / 2 + 20);
  ctx.restore();
}

export function drawEnd(ctx, vw, vh, kind, world) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.82)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  if (kind === 'busted') {
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('BUSTED!', vw / 2, vh / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('The Solmar PD caught you. Bail posted: $200.', vw / 2, vh / 2);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('WASTED', vw / 2, vh / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Solmar Bay claims another one. Hospital bill: $200.', vw / 2, vh / 2);
  } else {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('KING OF SOLMAR', vw / 2, vh / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(`All six missions complete. Total earned: $${world.missions.totalEarned.toLocaleString()}.`, vw / 2, vh / 2);
  }
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Click or press Enter to continue', vw / 2, vh / 2 + 48);
  ctx.restore();
}
