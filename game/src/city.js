// Procedural Solmar Bay: a 14x14-block coastal city on a street grid.
// Streets run along x = i*PITCH and y = j*PITCH; blocks sit between them.
// The south row is Palmera Beach, the east top corner is the marina.

import { WORLD, COLORS } from './config.js';
import { makeRng, range, intRange, pick, clamp } from './rng.js';

const ROOFS = [COLORS.roofA, COLORS.roofB, COLORS.roofC, COLORS.roofD, COLORS.roofE];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const { GRID, BLOCK, ROAD, PITCH, SIZE } = WORLD;
  const city = {
    seed, size: SIZE,
    blocks: [], // {bx,by,kind,buildings:[],trees:[],x,y,w,h}
    water: [], // {x,y,w,h} blocked, drawn as sea
    streetsX: [], // street centre lines
    streetsY: [],
    playerSpawn: { x: 7 * PITCH, y: 6 * PITCH + ROAD / 2 + 30 },
  };
  for (let i = 0; i <= GRID; i++) {
    city.streetsX.push(i * PITCH);
    city.streetsY.push(i * PITCH);
  }

  // Pick a few park blocks (never the plaza, garage, warehouse or hall blocks).
  const reserved = new Set(['7,7', '3,5', '12,8', '2,11', '5,2', '10,3', '6,10']);
  const parks = new Set();
  while (parks.size < 5) {
    const bx = intRange(rng, 1, GRID - 2);
    const by = intRange(rng, 1, GRID - 2);
    const k = bx + ',' + by;
    if (!reserved.has(k)) parks.add(k);
  }

  for (let by = 0; by < GRID; by++) {
    for (let bx = 0; bx < GRID; bx++) {
      const x0 = bx * PITCH + ROAD / 2;
      const y0 = by * PITCH + ROAD / 2;
      const w = BLOCK, h = BLOCK;
      const key = bx + ',' + by;
      let kind = 'buildings';
      if (by === GRID - 1) kind = 'beach';
      else if (bx === GRID - 1 && by <= 3) kind = 'marina';
      else if (key === '7,7') kind = 'plaza';
      else if (parks.has(key)) kind = 'park';
      else if (rng() < 0.12) kind = 'parking';

      const block = { bx, by, kind, x: x0, y: y0, w, h, buildings: [], trees: [] };
      if (kind === 'buildings') {
        const n = intRange(rng, 1, 3);
        for (let i = 0; i < n; i++) {
          const bw = range(rng, 34, 58);
          const bh = range(rng, 34, 58);
          const px = x0 + range(rng, 4, Math.max(5, w - bw - 4));
          const py = y0 + range(rng, 4, Math.max(5, h - bh - 4));
          block.buildings.push({
            x: px, y: py, w: bw, h: bh,
            hgt: intRange(rng, 8, 34),
            color: pick(rng, ROOFS),
          });
        }
      } else if (kind === 'park') {
        const n = intRange(rng, 6, 10);
        for (let i = 0; i < n; i++) {
          block.trees.push({ x: x0 + range(rng, 8, w - 8), y: y0 + range(rng, 8, h - 8), r: range(rng, 6, 11) });
        }
        if (rng() < 0.6) block.pond = { x: x0 + w * 0.3, y: y0 + h * 0.3, w: w * 0.4, h: h * 0.35 };
      } else if (kind === 'plaza') {
        block.buildings.push({
          x: x0 + w * 0.2, y: y0 + h * 0.2, w: w * 0.6, h: h * 0.6,
          hgt: 40, color: COLORS.roofB, hall: true,
        });
        block.trees.push({ x: x0 + 14, y: y0 + 14, r: 9 });
        block.trees.push({ x: x0 + w - 14, y: y0 + 14, r: 9 });
        block.trees.push({ x: x0 + 14, y: y0 + h - 14, r: 9 });
        block.trees.push({ x: x0 + w - 14, y: y0 + h - 14, r: 9 });
      }
      city.blocks.push(block);
    }
  }

  // Sea: a band along the very south edge, and the marina basin top-east.
  city.water.push({ x: 0, y: SIZE - 42, w: SIZE, h: 42 });
  city.water.push({ x: SIZE - WORLD.MARINA_W, y: 0, w: WORLD.MARINA_W, h: 4 * PITCH });
  return city;
}

export function blockCenter(city, bx, by) {
  const { ROAD, PITCH } = WORLD;
  return { x: bx * PITCH + ROAD / 2 + WORLD.BLOCK / 2, y: by * PITCH + ROAD / 2 + WORLD.BLOCK / 2 };
}

export function isRoad(city, x, y) {
  const { ROAD, PITCH, SIZE } = WORLD;
  if (x < 0 || y < 0 || x > SIZE || y > SIZE) return false;
  const half = ROAD / 2;
  const fx = ((x % PITCH) + PITCH) % PITCH;
  const fy = ((y % PITCH) + PITCH) % PITCH;
  return fx < half || fx > PITCH - half || fy < half || fy > PITCH - half;
}

export function nearestRoadPoint(city, x, y) {
  const { PITCH } = WORLD;
  const cx = Math.round(x / PITCH) * PITCH;
  const cy = Math.round(y / PITCH) * PITCH;
  // Snap to the closer of the vertical / horizontal street through the point.
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx <= dy) return { x: cx, y: clamp(y, 0, WORLD.SIZE) };
  return { x: clamp(x, 0, WORLD.SIZE), y: cy };
}

export function randomRoadPoint(city, rng) {
  const { GRID, PITCH, SIZE } = WORLD;
  const vertical = rng() < 0.5;
  const line = intRange(rng, 0, GRID) * PITCH;
  const along = range(rng, 40, SIZE - 40);
  return vertical ? { x: line, y: along } : { x: along, y: line };
}

export function inWater(city, x, y) {
  return city.water.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

// Push a circle out of every building and water rect. Returns corrected pos.
export function collideCircle(city, x, y, r) {
  for (const b of city.blocks) {
    for (const bd of b.buildings) {
      const nx = clamp(x, bd.x, bd.x + bd.w);
      const ny = clamp(y, bd.y, bd.y + bd.h);
      const dx = x - nx, dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          y = ny + (dy / d) * r;
        } else {
          // Centre inside the rect: push out along the smallest penetration.
          const pl = x - bd.x + r, pr = bd.x + bd.w - x + r;
          const pt = y - bd.y + r, pb = bd.y + bd.h - y + r;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = bd.x - r;
          else if (m === pr) x = bd.x + bd.w + r;
          else if (m === pt) y = bd.y - r;
          else y = bd.y + bd.h + r;
        }
      }
    }
  }
  for (const w of city.water) {
    const nx = clamp(x, w.x, w.x + w.w);
    const ny = clamp(y, w.y, w.y + w.h);
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * r;
      y = ny + (dy / d) * r;
    }
  }
  x = clamp(x, r, WORLD.SIZE - r);
  y = clamp(y, r, WORLD.SIZE - r);
  return { x, y };
}
