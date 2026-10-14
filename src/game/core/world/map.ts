import { TILES, type TileId } from './tiles.ts';

/**
 * Arena layout, described as two ASCII layers of 20 x 12 cells (64 px each,
 * 1280 x 768 world pixels). Inspired by `ui_scene_background.png`: a fort island in
 * the top-left corner, a large grass island in the bottom-right corner and smaller
 * islands and rocks in between to provide cover.
 *
 * Ground layer:
 *   `.` water
 *   `s` sand island cell (each island must be a filled rectangle of at least 2 x 2)
 *   `g` grass island cell (each island must be a 4 x 4 block)
 *
 * Object layer (`.` = nothing):
 *   `r` rock, `m` mossy rock  -> solid, must be placed on water
 *   `p` plant                 -> decoration, must be placed on an island
 *   `T` fort tower, `-` horizontal wall, `|` vertical wall -> decoration on an island
 */
const GROUND = [
  'ssss................',
  'ssss...........sss..',
  'ssss...........sss..',
  '....................',
  '....................',
  '.........ss.........',
  '.........ss.........',
  '....................',
  '...sss..........gggg',
  '...sss..........gggg',
  '................gggg',
  '................gggg',
] as const;

const OBJECTS = [
  'T--T................',
  '|..|............p...',
  'T--T................',
  '.......r............',
  '..............m.....',
  '....................',
  '....................',
  '....m...............',
  '....p...............',
  '............r.......',
  '......r.............',
  '....................',
] as const;

/** Island collision boxes are inset so ships can touch the visible shoreline. */
const SHORE_INSET_PX = 4;

/** Approximate collision radii of the rock tiles (small, large, medium). */
const ROCK_RADII = [17, 24, 19] as const;

export interface MapIsland {
  readonly kind: 'sand' | 'grass';
  readonly col: number;
  readonly row: number;
  readonly cols: number;
  readonly rows: number;
}

export interface MapRock {
  readonly col: number;
  readonly row: number;
  readonly mossy: boolean;
  readonly variant: number;
  readonly radius: number;
}

export type StaticCollider =
  | {
      readonly kind: 'box';
      readonly minX: number;
      readonly minY: number;
      readonly maxX: number;
      readonly maxY: number;
    }
  | { readonly kind: 'circle'; readonly x: number; readonly y: number; readonly r: number };

/** One drawable tile: `layer` 0 = island ground, 1 = objects on top. */
export interface MapTile {
  readonly col: number;
  readonly row: number;
  readonly tile: TileId;
  readonly layer: 0 | 1;
}

export interface GameMap {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly waterTile: TileId;
  readonly islands: readonly MapIsland[];
  readonly rocks: readonly MapRock[];
  readonly colliders: readonly StaticCollider[];
  readonly tiles: readonly MapTile[];
  readonly playerStart: { readonly x: number; readonly y: number; readonly heading: number };
}

export interface MapSource {
  readonly ground: readonly string[];
  readonly objects: readonly string[];
  readonly playerStart: { readonly col: number; readonly row: number; readonly heading: number };
}

export const DEFAULT_MAP_SOURCE: MapSource = {
  ground: GROUND,
  objects: OBJECTS,
  playerStart: { col: 6, row: 5, heading: Math.PI / 2 },
};

function charAt(layer: readonly string[], col: number, row: number): string {
  return layer[row]?.[col] ?? '.';
}

function findRectangles(
  ground: readonly string[],
  cols: number,
  rows: number,
  symbol: string,
): { col: number; row: number; cols: number; rows: number }[] {
  const visited = new Uint8Array(cols * rows);
  const result: { col: number; row: number; cols: number; rows: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (visited[row * cols + col] || charAt(ground, col, row) !== symbol) continue;
      // Flood fill the 4-connected component.
      const stack = [[col, row] as const];
      visited[row * cols + col] = 1;
      let minC = col;
      let maxC = col;
      let minR = row;
      let maxR = row;
      let count = 0;
      while (stack.length > 0) {
        const [c, r] = stack.pop() ?? [0, 0];
        count++;
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        for (const [nc, nr] of [
          [c + 1, r],
          [c - 1, r],
          [c, r + 1],
          [c, r - 1],
        ] as const) {
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          if (visited[nr * cols + nc] || charAt(ground, nc, nr) !== symbol) continue;
          visited[nr * cols + nc] = 1;
          stack.push([nc, nr]);
        }
      }
      const w = maxC - minC + 1;
      const h = maxR - minR + 1;
      if (count !== w * h) {
        throw new Error(`Map: '${symbol}' island at (${minC}, ${minR}) is not a filled rectangle`);
      }
      result.push({ col: minC, row: minR, cols: w, rows: h });
    }
  }
  return result;
}

function nineSliceIndex(index: number, size: number): 0 | 1 | 2 {
  if (index === 0) return 0;
  if (index === size - 1) return 2;
  return 1;
}

function fortTile(objects: readonly string[], col: number, row: number): TileId {
  const symbol = charAt(objects, col, row);
  if (symbol === '-') return TILES.FORT.WALL_H;
  if (symbol === '|') return TILES.FORT.WALL_V;
  const n = charAt(objects, col, row - 1) === '|';
  const s = charAt(objects, col, row + 1) === '|';
  const e = charAt(objects, col + 1, row) === '-';
  const w = charAt(objects, col - 1, row) === '-';
  const F = TILES.FORT;
  if (n && s) return F.TOWER_N_S;
  if (e && w) return F.TOWER_E_W;
  if (e && s) return F.TOWER_E_S;
  if (w && s) return F.TOWER_W_S;
  if (n && e) return F.TOWER_N_E;
  if (n && w) return F.TOWER_N_W;
  if (n) return F.TOWER_N;
  if (s) return F.TOWER_S;
  if (e) return F.TOWER_E;
  if (w) return F.TOWER_W;
  return F.TOWER;
}

/** Parses and validates a map source. Throws on malformed layouts. */
export function buildMap(source: MapSource, tileSize: number): GameMap {
  const rows = source.ground.length;
  const cols = source.ground[0]?.length ?? 0;
  if (rows === 0 || cols === 0) throw new Error('Map: empty ground layer');
  if (source.objects.length !== rows) throw new Error('Map: layer row counts differ');
  for (const layer of [source.ground, source.objects]) {
    for (const line of layer) {
      if (line.length !== cols) throw new Error('Map: all rows must have the same length');
    }
  }

  const islands: MapIsland[] = [];
  const tiles: MapTile[] = [];
  const colliders: StaticCollider[] = [];

  for (const rect of findRectangles(source.ground, cols, rows, 's')) {
    if (rect.cols < 2 || rect.rows < 2) {
      throw new Error(`Map: sand island at (${rect.col}, ${rect.row}) must be at least 2 x 2`);
    }
    islands.push({ kind: 'sand', ...rect });
    for (let r = 0; r < rect.rows; r++) {
      for (let c = 0; c < rect.cols; c++) {
        const tile = TILES.SAND_ISLAND[nineSliceIndex(r, rect.rows)][nineSliceIndex(c, rect.cols)];
        tiles.push({ col: rect.col + c, row: rect.row + r, tile, layer: 0 });
      }
    }
  }

  for (const rect of findRectangles(source.ground, cols, rows, 'g')) {
    if (rect.cols !== 4 || rect.rows !== 4) {
      throw new Error(`Map: grass island at (${rect.col}, ${rect.row}) must be exactly 4 x 4`);
    }
    islands.push({ kind: 'grass', ...rect });
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const tile = TILES.GRASS_ISLAND[r]?.[c];
        if (tile === undefined) throw new Error('Map: grass island tile matrix must be 4 x 4');
        tiles.push({ col: rect.col + c, row: rect.row + r, tile, layer: 0 });
      }
    }
  }

  for (const island of islands) {
    colliders.push({
      kind: 'box',
      minX: island.col * tileSize + SHORE_INSET_PX,
      minY: island.row * tileSize + SHORE_INSET_PX,
      maxX: (island.col + island.cols) * tileSize - SHORE_INSET_PX,
      maxY: (island.row + island.rows) * tileSize - SHORE_INSET_PX,
    });
  }

  const rocks: MapRock[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const symbol = charAt(source.objects, col, row);
      if (symbol === '.') continue;
      const onWater = charAt(source.ground, col, row) === '.';
      const where = `'${symbol}' at (${col}, ${row})`;

      if (symbol === 'r' || symbol === 'm') {
        if (!onWater) throw new Error(`Map: rock ${where} must be placed on water`);
        const variant = (col * 7 + row * 3) % 3;
        const radius = ROCK_RADII[variant as 0 | 1 | 2];
        const mossy = symbol === 'm';
        rocks.push({ col, row, mossy, variant, radius });
        const tile = (mossy ? TILES.ROCKS_MOSSY : TILES.ROCKS)[variant as 0 | 1 | 2];
        tiles.push({ col, row, tile, layer: 1 });
        colliders.push({
          kind: 'circle',
          x: (col + 0.5) * tileSize,
          y: (row + 0.5) * tileSize,
          r: radius,
        });
      } else if (symbol === 'p') {
        if (onWater) throw new Error(`Map: plant ${where} must be placed on an island`);
        tiles.push({ col, row, tile: TILES.PLANTS[((col + row) % 3) as 0 | 1 | 2], layer: 1 });
      } else if (symbol === 'T' || symbol === '-' || symbol === '|') {
        if (onWater) throw new Error(`Map: fort piece ${where} must be placed on an island`);
        tiles.push({ col, row, tile: fortTile(source.objects, col, row), layer: 1 });
      } else {
        throw new Error(`Map: unknown object ${where}`);
      }
    }
  }

  const start = source.playerStart;
  if (
    charAt(source.ground, start.col, start.row) !== '.' ||
    charAt(source.objects, start.col, start.row) !== '.'
  ) {
    throw new Error('Map: the player must start on open water');
  }

  return {
    cols,
    rows,
    tileSize,
    widthPx: cols * tileSize,
    heightPx: rows * tileSize,
    waterTile: TILES.WATER,
    islands,
    rocks,
    colliders,
    tiles,
    playerStart: {
      x: (start.col + 0.5) * tileSize,
      y: (start.row + 0.5) * tileSize,
      heading: start.heading,
    },
  };
}
