/**
 * Semantic names for the tiles of `assets/tilesheet/tiles_sheet.png`.
 *
 * The sheet is a 16 x 6 grid of 64 x 64 px tiles with no margin. Tile ids match the
 * individual files `png/<density>/tiles/tile_<id>.png` and are 1-based, row-major:
 * `id = row * 16 + column + 1`. The mapping was verified pixel by pixel against the
 * individual PNGs (zero difference for all 96 tiles).
 *
 * Multi-tile pieces are described as row-major matrices so the map can stamp them.
 * Tiles with transparency (rocks, plants, foam, fort pieces, island borders) are meant to
 * be drawn on top of water.
 */

export const TILESHEET = {
  columns: 16,
  rows: 6,
  tileSize: 64,
} as const;

export type TileId = number;

export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Pixel rectangle of a tile inside the 1x tilesheet. */
export function tileRect(id: TileId): TileRect {
  if (!Number.isInteger(id) || id < 1 || id > TILESHEET.columns * TILESHEET.rows) {
    throw new RangeError(`Invalid tile id: ${id}`);
  }
  const index = id - 1;
  const { columns, tileSize } = TILESHEET;
  return {
    x: (index % columns) * tileSize,
    y: Math.floor(index / columns) * tileSize,
    w: tileSize,
    h: tileSize,
  };
}

/** File name of a tile, without extension (e.g. `tile_73`). */
export function tileName(id: TileId): string {
  return `tile_${id}`;
}

export const TILES = {
  /** Opaque animated-looking water; the base layer of the whole arena. */
  WATER: 73,

  /** 3 x 3 rounded sand island (transparent outside the shoreline). */
  SAND_ISLAND: [
    [1, 2, 3],
    [17, 18, 19],
    [33, 34, 35],
  ],

  /** 4 x 4 grass island with a sand beach (transparent outside the shoreline). */
  GRASS_ISLAND: [
    [6, 7, 8, 9],
    [22, 23, 24, 25],
    [38, 39, 40, 41],
    [54, 55, 56, 57],
  ],

  /** Opaque sand fill tiles (2 x 2 with a swirl pattern, plus two plain variants). */
  SAND_SWIRL: [
    [4, 5],
    [20, 21],
  ],
  SAND_PLAIN: [68, 69],

  /** 2 x 2 sand clearing surrounded by grass (opaque). */
  SAND_CLEARING_IN_GRASS: [
    [36, 37],
    [52, 53],
  ],

  /** Opaque sand tiles with props; the `_GRASS_EDGE` variants have grass along the top. */
  SAND_SHIPWRECK: 81,
  SAND_SHIPWRECK_GRASS_EDGE: 82,
  SAND_CANNON_DEBRIS: 83,
  SAND_CANNON_DEBRIS_GRASS_EDGE: 84,
  SAND_ROCK: 85,
  SAND_ROCK_GRASS_EDGE: 86,

  /** Semi-transparent white shallow-water / foam halo, 3 x 3 and 2 x 2 versions. */
  SHALLOWS_LARGE: [
    [10, 11, 12],
    [26, 27, 28],
    [42, 43, 44],
  ],
  SHALLOWS_SMALL: [
    [58, 59],
    [74, 75],
  ],

  /** Single-tile rocks over transparency (small, large, medium). */
  ROCKS: [49, 50, 51],
  ROCKS_MOSSY: [65, 66, 67],

  /** Decorative plants over transparency. */
  PLANTS: [70, 71, 72],
  PLANTS_SMALL: [87, 88],

  /** Stone fort pieces. N/E/S/W name the sides where a wall connects. */
  FORT: {
    TOWER: 13,
    TOWER_HATCH: 14,
    TOWER_N_S: 29,
    TOWER_E_W: 30,
    TOWER_S: 45,
    TOWER_E: 46,
    TOWER_N: 61,
    TOWER_W: 62,
    TOWER_E_S: 77,
    TOWER_W_S: 78,
    TOWER_N_E: 93,
    TOWER_N_W: 94,

    WALL_V: 15,
    WALL_H: 16,
    WALL_V_CANNON_E: 31,
    WALL_V_CANNON_W: 32,
    WALL_H_CANNON_S_1: 47,
    WALL_H_CANNON_S_2: 48,
    WALL_V_CAP_N: 63,
    WALL_V_CAP_S: 79,
    WALL_H_CAP_W: 64,
    WALL_H_CAP_E: 80,
    WALL_V_BULGE: 95,
    WALL_H_BULGE: 96,

    WALL_V_RUINED_1: 89,
    WALL_H_RUINED_1: 90,
    WALL_V_RUINED_2: 91,
    WALL_H_RUINED_2: 92,

    BRIDGE_V: 60,
    BRIDGE_H: 76,
  },
} as const;
