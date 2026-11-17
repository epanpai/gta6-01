// Rendering: the whole top-down look of Solmar Bay. One job: turn the world
// state into pixels — ground, roads, buildings, cars, people, effects.
import { BLOCK, GRID, ROAD_W, WORLD, BEACH_H, COLORS, CAR } from './config.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.w = this.canvas.width = this.canvas.clientWidth * (window.devicePixelRatio || 1);
    this.h = this.canvas.height = this.canvas.clientHeight * (window.devicePixelRatio || 1);
  }

  // Draw the world for a camera centred on (cx, cy) at the given zoom.
  draw(world, cam) {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    // Sky-gold background beyond the city edge.
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const view = {
      x0: cam.x - vw / 2 / cam.zoom - 80,
      y0: cam.y - vh / 2 / cam.zoom - 80,
      x1: cam.x + vw / 2 / cam.zoom + 80,
      y1: cam.y + vh / 2 / cam.zoom + 80,
    };

    this.drawGround(ctx, view);
    this.drawRoads(ctx, view);
    this.drawParks(ctx, world, view);
    this.drawBuildings(ctx, world, view);
    this.drawTrees(ctx, world, view);
    world.drawEntities(ctx, view);
    this.drawBeach(ctx, view);
    ctx.restore();
  }

  drawGround(ctx, view) {
    // Grass base.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    // Subtle mowing stripes.
    ctx.fillStyle = COLORS.grassDark;
    const stripe = 128;
    for (let x = Math.floor(view.x0 / stripe) * stripe; x < view.x1; x += stripe * 2) {
      ctx.fillRect(x, view.y0, stripe, view.y1 - view.y0);
    }
  }

  drawRoads(ctx, view) {
    const half = ROAD_W / 2;
    // Road beds.
    ctx.fillStyle = COLORS.road;
    for (let i = 0; i < GRID; i++) {
      const rx = i * BLOCK + BLOCK / 2;
      const ry = i * BLOCK + BLOCK / 2;
      if (rx > view.x0 - half && rx < view.x1 + half) ctx.fillRect(rx - half, view.y0, ROAD_W, view.y1 - view.y0);
      if (ry > view.y0 - half && ry < view.y1 + half) ctx.fillRect(view.x0, ry - half, view.x1 - view.x0, ROAD_W);
    }
    // Sidewalk edges.
    ctx.fillStyle = COLORS.sidewalk;
    for (let i = 0; i < GRID; i++) {
      const rx = i * BLOCK + BLOCK / 2;
      const ry = i * BLOCK + BLOCK / 2;
      if (rx > view.x0 - half - 6 && rx < view.x1 + half + 6) {
        ctx.fillRect(rx - half - 6, view.y0, 6, view.y1 - view.y0);
        ctx.fillRect(rx + half, view.y0, 6, view.y1 - view.y0);
      }
      if (ry > view.y0 - half - 6 && ry < view.y1 + half + 6) {
        ctx.fillRect(view.x0, ry - half - 6, view.x1 - view.x0, 6);
        ctx.fillRect(view.x0, ry + half, view.x1 - view.x0, 6);
      }
    }
    // Centre dashes.
    ctx.fillStyle = COLORS.lane;
    const dash = 26;
    const gap = 22;
    for (let i = 0; i < GRID; i++) {
      const rx = i * BLOCK + BLOCK / 2;
      const ry = i * BLOCK + BLOCK / 2;
      if (rx > view.x0 && rx < view.x1) {
        for (let y = Math.floor(view.y0 / (dash + gap)) * (dash + gap); y < view.y1; y += dash + gap) {
          if (this.onIntersection(rx, y + dash / 2)) continue;
          ctx.fillRect(rx - 2, y, 4, dash);
        }
      }
      if (ry > view.y0 && ry < view.y1) {
        for (let x = Math.floor(view.x0 / (dash + gap)) * (dash + gap); x < view.x1; x += dash + gap) {
          if (this.onIntersection(x + dash / 2, ry)) continue;
          ctx.fillRect(x, ry - 2, dash, 4);
        }
      }
    }
  }

  onIntersection(x, y) {
    const half = ROAD_W / 2 + 4;
    for (let i = 0; i < GRID; i++) {
      const r = i * BLOCK + BLOCK / 2;
      if (Math.abs(x - r) < half && Math.abs(y - r) < half) return true;
      if (Math.abs(x - r) < half) {
        // On a vertical road: check if y is near a horizontal road.
        for (let j = 0; j < GRID; j++) {
          const ry = j * BLOCK + BLOCK / 2;
          if (Math.abs(y - ry) < half) return true;
        }
      }
    }
    return false;
  }

  drawParks(ctx, world, view) {
    for (const p of world.city.parks) {
      if (p.x > view.x1 || p.x + p.w < view.x0 || p.y > view.y1 || p.y + p.h < view.y0) continue;
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#4a7a42';
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      // Pond
      ctx.fillStyle = '#5aa3d0';
      ctx.beginPath();
      ctx.ellipse(p.x + p.w * 0.68, p.y + p.h * 0.62, 34, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBuildings(ctx, world, view) {
    for (const b of world.city.buildings) {
      if (b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0) continue;
      // Drop shadow (sun from the south-west).
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
      // Roof.
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Roof inset.
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      // Windows / skylights.
      for (const win of b.windows) {
        ctx.fillStyle = win.lit ? '#ffe9a8' : 'rgba(0,0,0,0.18)';
        ctx.fillRect(win.x - 4, win.y - 4, 8, 8);
      }
    }
  }

  drawTrees(ctx, world, view) {
    for (const t of world.city.trees) {
      if (t.x < view.x0 || t.x > view.x1 || t.y < view.y0 || t.y > view.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3e7d32';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5da24a';
      ctx.beginPath();
      ctx.arc(t.x - 2, t.y - 2, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBeach(ctx, view) {
    // Sand strip + sea along the south edge.
    const beachY = WORLD - BEACH_H;
    if (beachY > view.y1) return;
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(view.x0, beachY, view.x1 - view.x0, BEACH_H - 70);
    // Umbrellas dotted along the beach.
    ctx.fillStyle = '#e4572e';
    for (let x = 200; x < WORLD; x += 420) {
      if (x < view.x0 || x > view.x1) continue;
      ctx.beginPath();
      ctx.arc(x, beachY + 90, 16, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, beachY + 90, 16, Math.PI, Math.PI * 1.5);
      ctx.fill();
      ctx.fillStyle = '#e4572e';
    }
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(view.x0, WORLD - 70, view.x1 - view.x0, 70 + (view.y1 - (WORLD - 70)));
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 120; x < WORLD; x += 260) {
      const wob = Math.sin((x + Date.now() / 900) / 60) * 6;
      ctx.fillRect(x, WORLD - 64 + wob, 90, 3);
    }
  }

  // Player character, drawn facing the mouse (on foot) or inside the car.
  drawPlayer(ctx, player, aimAngle) {
    if (player.inCar) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    const bob = Math.sin(player.walkPhase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.fillStyle = '#2c3e50';
    const swing = Math.sin(player.walkPhase) * 4;
    ctx.fillRect(-3 + swing * 0.4, 2, 3.5, 8);
    ctx.fillRect(0.5 - swing * 0.4, 2, 3.5, 8);
    // Jacket — Jax wears a teal jacket.
    ctx.fillStyle = '#0e7c7b';
    ctx.beginPath();
    ctx.arc(0, -2 + bob * 0.3, 8.5, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(0, -12 + bob * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(0, -14 + bob * 0.3, 5.5, Math.PI, Math.PI * 2);
    ctx.fill();
    // Pistol arm toward the aim.
    ctx.rotate(aimAngle);
    ctx.fillStyle = '#0e7c7b';
    ctx.fillRect(4, -2, 10, 4);
    ctx.fillStyle = '#222';
    ctx.fillRect(12, -1.5, 9, 3);
    ctx.restore();
  }
}
