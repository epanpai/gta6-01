// Solmar Bay — the city itself. One job: generate the road grid, blocks,
// buildings, parks and the beach deterministically from a seed, and answer
// "what is at this point" questions (road? sidewalk? inside a building?).
import { BLOCK, GRID, ROAD_W, WORLD, BEACH_H, COLORS, mulberry32 } from './config.js';

export class City {
  constructor(seed) {
    this.rng = mulberry32(seed);
    this.roadsX = [];
    this.roadsY = [];
    for (let i = 0; i < GRID; i++) {
      this.roadsX.push(i * BLOCK + BLOCK / 2);
      this.roadsY.push(i * BLOCK + BLOCK / 2);
    }
    this.buildings = [];
    this.parks = [];
    this.parkingLots = [];
    this.trees = [];
    this.generate();
  }

  generate() {
    const rng = this.rng;
    const halfRoad = ROAD_W / 2;
    for (let bx = 0; bx < GRID - 1; bx++) {
      for (let by = 0; by < GRID - 1; by++) {
        const x0 = this.roadsX[bx] + halfRoad + 8;
        const y0 = this.roadsY[by] + halfRoad + 8;
        const x1 = this.roadsX[bx + 1] - halfRoad - 8;
        const y1 = this.roadsY[by + 1] - halfRoad - 8;
        const w = x1 - x0;
        const h = y1 - y0;
        const roll = rng();
        // South edge blocks (by = GRID-2) are beach-facing: keep them low.
        if (roll < 0.16) {
          // Park block
          this.parks.push({ x: x0, y: y0, w, h });
          const nTrees = 4 + Math.floor(rng() * 5);
          for (let i = 0; i < nTrees; i++) {
            this.trees.push({ x: x0 + 20 + rng() * (w - 40), y: y0 + 20 + rng() * (h - 40), r: 9 + rng() * 6 });
          }
          continue;
        }
        if (roll < 0.24) {
          // Parking lot with a few parked cars (spots are filled by World)
          this.parkingLots.push({ x: x0, y: y0, w, h });
          continue;
        }
        // Buildings: 1 big or 2x2 small ones.
        const big = rng() < 0.4;
        if (big) {
          this.buildings.push(this.makeBuilding(x0 + 8, y0 + 8, w - 16, h - 16, rng));
        } else {
          const gw = w / 2;
          const gh = h / 2;
          for (let gx = 0; gx < 2; gx++) {
            for (let gy = 0; gy < 2; gy++) {
              this.buildings.push(
                this.makeBuilding(x0 + gx * gw + 6, y0 + gy * gh + 6, gw - 12, gh - 12, rng),
              );
            }
          }
        }
        // A tree or two on the block corners
        if (rng() < 0.5) {
          this.trees.push({ x: x0 + 12, y: y0 + 12, r: 8 + rng() * 4 });
        }
      }
    }
    // Landmarks: city hall plaza near the centre, the docks on the east edge.
    this.landmarks = [
      { name: 'Solmar City Hall', x: this.roadsX[6], y: this.roadsY[6], kind: 'hall' },
      { name: 'Marina Docks', x: WORLD - 60, y: this.roadsY[11], kind: 'docks' },
      { name: 'Palmera Beach', x: this.roadsX[7], y: WORLD - BEACH_H / 2, kind: 'beach' },
    ];
  }

  makeBuilding(x, y, w, h, rng) {
    const color = COLORS.buildingRoof[Math.floor(rng() * COLORS.buildingRoof.length)];
    const windows = [];
    const cols = Math.max(2, Math.floor(w / 34));
    const rows = Math.max(2, Math.floor(h / 34));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        windows.push({
          x: x + 12 + cx * ((w - 24) / Math.max(1, cols - 1 || 1)),
          y: y + 12 + cy * ((h - 24) / Math.max(1, rows - 1 || 1)),
          lit: rng() < 0.35,
        });
      }
    }
    return { x, y, w, h, color, windows, hgt: 1 + Math.floor(rng() * 3) };
  }

  isOnRoad(x, y) {
    const half = ROAD_W / 2;
    for (const rx of this.roadsX) if (Math.abs(x - rx) < half) return true;
    for (const ry of this.roadsY) if (Math.abs(y - ry) < half) return true;
    return false;
  }

  isBeach(x, y) {
    return y > WORLD - BEACH_H;
  }

  isSea(x, y) {
    return y > WORLD - 70;
  }

  buildingAt(x, y) {
    for (const b of this.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // Nearest road centre coordinate on the given axis.
  nearestRoadX(x) {
    let best = this.roadsX[0];
    for (const rx of this.roadsX) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
    return best;
  }

  nearestRoadY(y) {
    let best = this.roadsY[0];
    for (const ry of this.roadsY) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
    return best;
  }

  // Snap a point to the nearest road centre line (used for traffic spawns).
  snapToRoad(x, y) {
    const dx = Math.abs(x - this.nearestRoadX(x));
    const dy = Math.abs(y - this.nearestRoadY(y));
    if (dx < dy) return { x: this.nearestRoadX(x), y, vertical: true };
    return { x, y: this.nearestRoadY(y), vertical: false };
  }
}
