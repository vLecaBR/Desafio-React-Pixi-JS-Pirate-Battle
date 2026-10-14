import { Assets, Rectangle, Texture, type Spritesheet } from 'pixi.js';
import { TILESHEET, tileRect, type TileId } from '../core/world/tiles.ts';

/**
 * Asset manifest and texture access for the arena.
 *
 * - Ships/effects: one atlas converted from the Starling XML (single 1x atlas,
 *   see scripts/convert-ship-atlas.mjs).
 * - Tiles: the raw tilesheet; tile textures are sliced once from its source.
 * - UI (health bars over ships): TexturePacker atlas, retina variant on HiDPI screens.
 *
 * Everything is loaded once and shared by every match; restarting a match never
 * reloads or destroys textures. A failed load can be retried (PixiJS drops failed
 * promises from its cache).
 */

const BASE = '/assets';

/** A load that does not settle in this time is reported as a failure (never hangs). */
const LOAD_TIMEOUT_MS = 30_000;

export type ShipSkin = 'player' | 'chaser' | 'shooter';

/**
 * Ship sprites come in 6 colours x 4 states: `ship_1..6` intact, `7..12` damaged,
 * `13..18` heavily damaged and `19..24` sunk (grey). Colour index: 1 white,
 * 2 black, 3 red, 4 green, 5 blue, 6 yellow.
 */
const SKIN_COLOUR: Readonly<Record<ShipSkin, number>> = {
  player: 5,
  chaser: 3,
  shooter: 2,
};

export const DAMAGE_STATES = 4;

export interface GameTextures {
  readonly ship: (skin: ShipSkin, state: number) => Texture;
  readonly tile: (id: TileId) => Texture;
  readonly water: Texture;
  readonly cannonBall: Texture;
  readonly explosions: readonly [Texture, Texture, Texture];
  readonly fires: readonly [Texture, Texture];
  readonly wood: readonly Texture[];
  readonly enemyBarFrame: Texture;
  readonly enemyBarFill: { readonly green: Texture; readonly red: Texture };
  /** Fill area inside the bar frame, in logical (1x) units. */
  readonly enemyBarFillRect: Rectangle;
}

export class AssetLoadError extends Error {
  constructor(cause: unknown) {
    super('The game assets could not be loaded. Check your connection and try again.', {
      cause,
    });
    this.name = 'AssetLoadError';
  }
}

function useRetina(): boolean {
  return typeof window !== 'undefined' && window.devicePixelRatio > 1;
}

function manifest(retina: boolean) {
  return [
    { alias: 'pb-ships', src: `${BASE}/generated/ships_sheet.json` },
    {
      alias: 'pb-ui',
      src: retina
        ? `${BASE}/spritesheet/ui_sheet_retina.json`
        : `${BASE}/spritesheet/ui_sheet.json`,
    },
    {
      alias: 'pb-tiles',
      src: retina
        ? `${BASE}/tilesheet/tiles_sheet_retina.png`
        : `${BASE}/tilesheet/tiles_sheet.png`,
      data: { resolution: retina ? 2 : 1 },
    },
  ];
}

let cached: GameTextures | null = null;
let assetsInitialised: Promise<void> | null = null;

/**
 * Initialises the PixiJS asset system once. Textures are decoded on the main
 * thread: with worker decoding, a failed image request can leave the load pending
 * forever instead of rejecting (preferences must be set at init, when the parsers
 * are registered).
 */
function initAssets(): Promise<void> {
  assetsInitialised ??= Assets.init({ preferences: { preferWorkers: false } });
  return assetsInitialised;
}
let inflight: Promise<GameTextures> | null = null;

/**
 * Loads (once) every texture needed by a match. `onProgress` receives 0..1.
 * Rejects with `AssetLoadError`; calling again retries the failed files.
 */
export function loadGameAssets(onProgress?: (progress: number) => void): Promise<GameTextures> {
  if (cached) {
    onProgress?.(1);
    return Promise.resolve(cached);
  }
  if (inflight) return inflight;

  // Pixi rejects as soon as one file fails while the others keep loading and
  // reporting progress; progress is ignored once the load has settled.
  let settled = false;
  inflight = (async () => {
    try {
      await initAssets();
      const assets = manifest(useRetina());
      await withTimeout(
        Assets.load(assets, {
          onProgress: (progress: number) => {
            if (!settled) onProgress?.(progress);
          },
          strategy: 'throw',
          retryCount: 0,
        }),
        LOAD_TIMEOUT_MS,
      );
      cached = buildTextures();
      onProgress?.(1);
      return cached;
    } catch (error) {
      throw error instanceof AssetLoadError ? error : new AssetLoadError(error);
    } finally {
      settled = true;
      inflight = null;
    }
  })();
  return inflight;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Asset loading timed out after ${ms} ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** Already-loaded textures, or null. */
export function getLoadedTextures(): GameTextures | null {
  return cached;
}

function frameOf(sheet: Spritesheet, name: string): Texture {
  const texture = sheet.textures[name];
  if (!texture) throw new AssetLoadError(new Error(`Missing frame "${name}"`));
  return texture;
}

/**
 * Reads `ui.layout.fill_rect` from the atlas metadata. These values are always in
 * logical (1x) units, also in the retina atlas, so they are used as-is.
 */
function readFillRect(sheet: Spritesheet, frame: string): Rectangle {
  const frames = sheet.data.frames as Record<string, unknown>;
  const rect = (frames[frame] as { ui?: { layout?: { fill_rect?: unknown } } } | undefined)?.ui
    ?.layout?.fill_rect;
  if (
    typeof rect === 'object' &&
    rect !== null &&
    'x' in rect &&
    'y' in rect &&
    'w' in rect &&
    'h' in rect &&
    typeof rect.x === 'number' &&
    typeof rect.y === 'number' &&
    typeof rect.w === 'number' &&
    typeof rect.h === 'number'
  ) {
    return new Rectangle(rect.x, rect.y, rect.w, rect.h);
  }
  throw new AssetLoadError(new Error(`Missing fill_rect metadata for "${frame}"`));
}

function buildTextures(): GameTextures {
  const ships = Assets.get<Spritesheet>('pb-ships');
  const ui = Assets.get<Spritesheet>('pb-ui');
  const tilesheet = Assets.get<Texture>('pb-tiles');

  const tileCache = new Map<TileId, Texture>();
  const tile = (id: TileId): Texture => {
    let texture = tileCache.get(id);
    if (!texture) {
      const { x, y, w, h } = tileRect(id);
      texture = new Texture({ source: tilesheet.source, frame: new Rectangle(x, y, w, h) });
      tileCache.set(id, texture);
    }
    return texture;
  };
  if (tilesheet.width !== TILESHEET.columns * TILESHEET.tileSize) {
    throw new AssetLoadError(new Error('Unexpected tilesheet size'));
  }

  const shipTextures = new Map<string, Texture>();
  for (const skin of Object.keys(SKIN_COLOUR) as ShipSkin[]) {
    for (let state = 0; state < DAMAGE_STATES; state++) {
      const index = SKIN_COLOUR[skin] + state * 6;
      shipTextures.set(`${skin}:${state}`, frameOf(ships, `ship_${index}`));
    }
  }

  const fillRect = readFillRect(ui, 'enemy_health_frame');
  return {
    ship: (skin, state) => {
      const texture = shipTextures.get(
        `${skin}:${Math.max(0, Math.min(DAMAGE_STATES - 1, state))}`,
      );
      if (!texture) throw new Error(`Unknown ship skin ${skin}`);
      return texture;
    },
    tile,
    water: tile(73),
    cannonBall: frameOf(ships, 'cannon_ball'),
    explosions: [
      frameOf(ships, 'explosion_1'),
      frameOf(ships, 'explosion_2'),
      frameOf(ships, 'explosion_3'),
    ],
    fires: [frameOf(ships, 'fire_1'), frameOf(ships, 'fire_2')],
    wood: [1, 2, 3, 4].map((n) => frameOf(ships, `wood_${n}`)),
    enemyBarFrame: frameOf(ui, 'enemy_health_frame'),
    enemyBarFill: {
      green: frameOf(ui, 'enemy_health_fill_green'),
      red: frameOf(ui, 'enemy_health_fill_red'),
    },
    enemyBarFillRect: fillRect,
  };
}
