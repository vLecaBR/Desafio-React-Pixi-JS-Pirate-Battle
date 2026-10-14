import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../../config/gameConfig.ts';
import { CollisionGrid } from './collisionGrid.ts';
import { FlowField } from './flowField.ts';
import { buildMap, DEFAULT_MAP_SOURCE, type MapSource } from './map.ts';
import { TILES } from './tiles.ts';

const TILE = DEFAULT_GAME_CONFIG.world.tileSize;
const map = buildMap(DEFAULT_MAP_SOURCE, TILE);

describe('default map', () => {
  it('matches the configured world size (20 x 12 tiles of 64 px)', () => {
    expect(map.cols).toBe(20);
    expect(map.rows).toBe(12);
    expect(map.widthPx).toBe(DEFAULT_GAME_CONFIG.world.widthPx);
    expect(map.heightPx).toBe(DEFAULT_GAME_CONFIG.world.heightPx);
  });

  it('has islands and rocks that block movement', () => {
    expect(map.islands.length).toBeGreaterThanOrEqual(1);
    expect(map.rocks.length).toBeGreaterThanOrEqual(1);
    expect(map.colliders).toHaveLength(map.islands.length + map.rocks.length);
  });

  it('starts the player on open water with room to move', () => {
    const grid = new CollisionGrid(map);
    const { x, y } = map.playerStart;
    expect(grid.overlapsCircle(x, y, DEFAULT_GAME_CONFIG.spawn.clearanceRadius)).toBe(false);
  });

  it('uses the 9-slice sand tiles for rectangular islands and auto-tiles the fort', () => {
    const at = (col: number, row: number, layer: 0 | 1) =>
      map.tiles.find((t) => t.col === col && t.row === row && t.layer === layer)?.tile;
    expect(at(0, 0, 0)).toBe(TILES.SAND_ISLAND[0][0]);
    expect(at(1, 1, 0)).toBe(TILES.SAND_ISLAND[1][1]);
    expect(at(3, 2, 0)).toBe(TILES.SAND_ISLAND[2][2]);
    expect(at(0, 0, 1)).toBe(TILES.FORT.TOWER_E_S);
    expect(at(3, 2, 1)).toBe(TILES.FORT.TOWER_N_W);
    expect(at(1, 0, 1)).toBe(TILES.FORT.WALL_H);
  });

  it('keeps every water cell reachable from the player start', () => {
    const grid = new CollisionGrid(map);
    const field = new FlowField(grid);
    field.rebuild(map.playerStart.x, map.playerStart.y);
    for (let row = 0; row < map.rows; row++) {
      for (let col = 0; col < map.cols; col++) {
        if (!grid.isBlockedCell(col, row)) expect(field.costAt(col, row)).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('map validation', () => {
  const base: MapSource = {
    ground: ['....', '.ss.', '.ss.', '....'],
    objects: ['....', '....', '....', '....'],
    playerStart: { col: 0, row: 0, heading: 0 },
  };

  it('accepts a valid layout', () => {
    expect(() => buildMap(base, TILE)).not.toThrow();
  });

  it('rejects non-rectangular islands, misplaced objects and blocked starts', () => {
    expect(() => buildMap({ ...base, ground: ['....', '.ss.', '..s.', '....'] }, TILE)).toThrow(
      /rectangle/,
    );
    expect(() => buildMap({ ...base, ground: ['....', '.s..', '.s..', '....'] }, TILE)).toThrow(
      /2 x 2/,
    );
    expect(() => buildMap({ ...base, objects: ['r...', '.r..', '....', '....'] }, TILE)).toThrow(
      /water/,
    );
    expect(() => buildMap({ ...base, objects: ['....', '....', '....', '...p'] }, TILE)).toThrow(
      /island/,
    );
    expect(() => buildMap({ ...base, objects: ['....', '....', '....', '...x'] }, TILE)).toThrow(
      /unknown/,
    );
    expect(() => buildMap({ ...base, playerStart: { col: 1, row: 1, heading: 0 } }, TILE)).toThrow(
      /open water/,
    );
  });
});

describe('CollisionGrid', () => {
  const grid = new CollisionGrid(map);
  // Center island spans x 580..700, y 324..444 after the shore inset.

  it('pushes circles out of islands and back inside the arena', () => {
    const out = { x: 0, y: 0 };
    expect(grid.resolveCircle(640, 310, 20, out)).toBe(true);
    expect(310 + out.y).toBeCloseTo(304);
    expect(grid.resolveCircle(5, 400, 20, out)).toBe(true);
    expect(5 + out.x).toBe(20);
    expect(grid.resolveCircle(800, 160, 20, out)).toBe(false);
  });

  it('finds the first obstacle along a segment and computes line of sight', () => {
    const t = grid.segmentT(640, 200, 640, 600);
    expect(200 + 400 * t).toBeCloseTo(324);
    expect(grid.hasLineOfSight(640, 200, 640, 600)).toBe(false);
    expect(grid.hasLineOfSight(300, 160, 900, 160)).toBe(true);
    // The top-right island (x 964..1148, y 68..188) blocks this one.
    expect(grid.hasLineOfSight(800, 160, 1100, 160)).toBe(false);
  });
});

describe('FlowField', () => {
  it('leads around obstacles towards the target', () => {
    const grid = new CollisionGrid(map);
    const field = new FlowField(grid);
    field.rebuild(640, 520); // below the center island
    const waypoint = { x: 0, y: 0 };
    // From above the island the next step must not enter the island.
    expect(field.nextWaypoint(640, 260, waypoint)).toBe(true);
    expect(grid.isBlockedCell(grid.colOf(waypoint.x), grid.rowOf(waypoint.y))).toBe(false);
    expect(field.nextWaypoint(640, 520, waypoint)).toBe(false); // already there
  });
});
