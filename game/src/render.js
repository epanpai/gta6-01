// Top-down rendering: ground, streets, blocks, vehicles, people, effects.
// Camera lives on G.camera {x, y, zoom}; the canvas is G.view {w, h}.

import { WORLD, COLORS } from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, c, isPlayer) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  rr(ctx, -15, -8 + 3, 32, 17, 5);
  ctx.fill();
  // Body.
  ctx.fillStyle = c.color;
  rr(ctx, -17, -9, 34, 18, 6);
  ctx.fill();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  rr(ctx, -5, -7, 12, 14, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(6, -7, 3, 14);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(15, -8, 2, 4);
  ctx.fillRect(15, 4, 2, 4);
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 2;
    rr(ctx, -19, -11, 38, 22, 7);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWorld(ctx, G) {
  const { w, h } = G.view;
  const cam = G.camera;
  ctx.fillStyle = '#1d2b1e';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const city = G.city;
  const { SIZE, ROAD, PITCH } = WORLD;

  // Ground: grass, then beach sand along the south edge.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(0, SIZE - WORLD.BEACH_H, SIZE, WORLD.BEACH_H);
  // Sea.
  for (const r of city.water) {
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = COLORS.waterDeep;
    ctx.fillRect(r.x, r.y + r.h * 0.45, r.w, 3);
  }

  // Streets.
  ctx.fillStyle = COLORS.road;
  for (const x of city.streetsX) ctx.fillRect(x - ROAD / 2, 0, ROAD, SIZE);
  for (const y of city.streetsY) ctx.fillRect(0, y - ROAD / 2, SIZE, ROAD);
  // Lane dashes.
  ctx.fillStyle = COLORS.lane;
  for (const x of city.streetsX) {
    for (let y = 0; y < SIZE; y += 44) ctx.fillRect(x - 1.5, y, 3, 20);
  }
  for (const y of city.streetsY) {
    for (let x = 0; x < SIZE; x += 44) ctx.fillRect(x, y - 1.5, 20, 3);
  }

  // Blocks.
  for (const b of city.blocks) {
    if (b.kind === 'beach' || b.kind === 'marina') continue;
    if (b.kind === 'park') {
      ctx.fillStyle = COLORS.grassDark;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      if (b.pond) {
        ctx.fillStyle = COLORS.water;
        rr(ctx, b.pond.x, b.pond.y, b.pond.w, b.pond.h, 8);
        ctx.fill();
      }
      for (const t of b.trees) {
        ctx.fillStyle = COLORS.tree;
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLORS.treeLight;
        ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
      }
      continue;
    }
    if (b.kind === 'plaza') {
      ctx.fillStyle = COLORS.plaza;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    } else if (b.kind === 'parking') {
      ctx.fillStyle = '#8d9096';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        ctx.strokeRect(b.x + 10 + i * 26, b.y + 14, 20, 34);
      }
    } else {
      ctx.fillStyle = COLORS.sidewalk;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    for (const bd of b.buildings) {
      // Drop shadow from the height.
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(bd.x + 5, bd.y + 5 + bd.hgt * 0.3, bd.w, bd.h);
      ctx.fillStyle = bd.color;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(bd.x, bd.y, bd.w, 6);
      if (bd.hall) {
        ctx.fillStyle = '#f2e6c8';
        ctx.font = 'bold 13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('CITY HALL', bd.x + bd.w / 2, bd.y + bd.h / 2 + 4);
      }
    }
    for (const t of b.trees) {
      ctx.fillStyle = COLORS.tree;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Mission / taxi markers under the entities.
  drawMarker(ctx, G);

  // Pedestrians.
  for (const ped of G.peds) {
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 6, 0, Math.PI); ctx.fill();
    if (ped.fare) {
      ctx.fillStyle = '#ffd23c';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('$', ped.x, ped.y - 12);
    }
  }

  // Cars (traffic, parked, player, cops).
  for (const c of G.cars) {
    drawCarShape(ctx, c, c.isPlayer);
    if (c.kind === 'cop') {
      const on = Math.floor(G.time * 6) % 2 === 0;
      ctx.fillStyle = on ? COLORS.copLight : COLORS.copLight2;
      ctx.beginPath(); ctx.arc(c.x, c.y - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? COLORS.copLight2 : COLORS.copLight;
      ctx.beginPath(); ctx.arc(c.x, c.y + 4, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (c.kind === 'mission') {
      ctx.strokeStyle = '#ff4ad8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, 24, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // Enemies.
  for (const e of G.enemies) {
    ctx.fillStyle = '#d23b2e';
    ctx.beginPath(); ctx.arc(e.x, e.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a150c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('!', e.x, e.y + 4);
  }

  // Player on foot.
  const p = G.player;
  if (p.alive && !p.inCar) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6d00';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.stroke();
    // Aim tick.
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aim) * 12, p.y + Math.sin(p.aim) * 12);
    ctx.lineTo(p.x + Math.cos(p.aim) * 20, p.y + Math.sin(p.aim) * 20);
    ctx.stroke();
  }

  // Bullets.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Foot cops.
  for (const c of G.cops) {
    if (c.kind !== 'footcop') continue;
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f7bff';
    ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function drawMarker(ctx, G) {
  const m = G.missionMarker;
  if (!m) return;
  const pulse = 1 + Math.sin(G.time * 5) * 0.15;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = m.color || '#ffd23c';
  ctx.beginPath();
  ctx.moveTo(0, -16); ctx.lineTo(11, 0); ctx.lineTo(0, 16); ctx.lineTo(-11, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('!', 0, 5);
  ctx.restore();
  // Guide ring at the target.
  ctx.strokeStyle = m.color || '#ffd23c';
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(m.x, m.y, 26 + Math.sin(G.time * 5) * 4, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}
