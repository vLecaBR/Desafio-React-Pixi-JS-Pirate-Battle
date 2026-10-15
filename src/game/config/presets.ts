import type { SimulationSetup } from '../core/Simulation.ts';
import type { ConfigOverrides, GameConfig } from './gameConfig.ts';

/**
 * Deterministic scenarios for end-to-end tests and profiling, selected with
 * `?preset=<id>` (only honoured together with `?e2e=1` or `?perf=1`).
 *
 * Presets only change configuration values, initial positions and spawning.
 * Rules, collisions, input handling and rendering stay exactly the same.
 *
 * Map landmarks (world px): open lane y = 160 between x = 256 and x = 960;
 * the center island spans x 580..700, y 324..444; arena is 1280 x 768.
 */
export interface GamePreset {
  readonly overrides: ConfigOverrides<GameConfig>;
  readonly setup?: SimulationSetup;
}

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const SOUTH = Math.PI;

/** No automatic spawns: the preset fully controls the enemies. */
const NO_SPAWNS: ConfigOverrides<GameConfig> = { spawn: { maxAlive: 0 } };

export const PRESETS = {
  /** Empty arena, player in the open lane facing east (clear line of fire). */
  sandbox: { overrides: NO_SPAWNS, setup: { player: { x: 400, y: 160, heading: EAST } } },
  /** Facing the center island from the north. */
  'island-ahead': {
    overrides: NO_SPAWNS,
    setup: { player: { x: 640, y: 200, heading: SOUTH } },
  },
  /** Facing the east edge of the arena, open water ahead. */
  'near-edge': {
    overrides: NO_SPAWNS,
    setup: { player: { x: 1150, y: 400, heading: EAST } },
  },
  /** A Chaser heading straight for the player in the open lane. */
  'chaser-ahead': {
    overrides: NO_SPAWNS,
    setup: {
      player: { x: 400, y: 160, heading: EAST },
      enemies: [{ kind: 'chaser', x: 760, y: 160, heading: WEST, graceSec: 0 }],
    },
  },
  /** A Shooter already within attack range, facing the player. */
  'shooter-in-range': {
    overrides: NO_SPAWNS,
    setup: {
      player: { x: 300, y: 160, heading: 0 },
      enemies: [{ kind: 'shooter', x: 620, y: 160, heading: WEST, graceSec: 0 }],
    },
  },
  /** A harmless, (almost) stationary target in front of the player's bow. */
  'target-practice': {
    overrides: { spawn: { maxAlive: 0 }, shooter: { moveSpeed: 1 } },
    setup: {
      player: { x: 400, y: 160, heading: EAST },
      enemies: [{ kind: 'shooter', x: 760, y: 160, heading: EAST, hp: 50, graceSec: 1e6 }],
    },
  },
  /** Player one ram away from defeat, with a Chaser incoming. */
  'low-health': {
    overrides: NO_SPAWNS,
    setup: {
      player: { x: 400, y: 160, heading: EAST, hp: 20 },
      enemies: [{ kind: 'chaser', x: 760, y: 160, heading: WEST, graceSec: 0 }],
    },
  },
  /** Normal spawning (interval from Options), first spawn after the usual delay. */
  'spawn-test': { overrides: {} },
  /**
   * Profiling: dense combat (one spawn per second, up to 10 enemies) for a full
   * three-minute match. The player's health is raised so the run lasts 180 s.
   */
  stress: {
    overrides: {
      match: { sessionTimeSec: 180 },
      spawn: { intervalSec: 1, maxAlive: 10 },
      player: { maxHealth: 100_000 },
    },
  },
} as const satisfies Record<string, GamePreset>;

export type PresetId = keyof typeof PRESETS;

export function isPresetId(value: string | null): value is PresetId {
  return value !== null && Object.hasOwn(PRESETS, value);
}

/** Preset requested in the URL, honoured only in test/profiling mode. */
export function requestedPreset(): GamePreset | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const instrumented = params.get('e2e') === '1' || params.get('perf') === '1';
  const id = params.get('preset');
  return instrumented && isPresetId(id) ? PRESETS[id] : null;
}
