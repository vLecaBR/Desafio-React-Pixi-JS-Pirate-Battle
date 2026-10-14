import type { GameConfig, ShipConfig } from '../config/gameConfig.ts';
import type { Rng } from './rng.ts';
import type {
  DamageSource,
  EndReason,
  EnemyShip,
  MatchPhase,
  PlayerIntents,
  PlayerShip,
  Projectile,
  Ship,
  SimEventMap,
  SimEventType,
} from './types.ts';
import type { CollisionGrid } from './world/collisionGrid.ts';
import type { FlowField } from './world/flowField.ts';
import type { GameMap } from './world/map.ts';

export interface DamageEntry {
  targetId: number;
  amount: number;
  source: DamageSource;
  /** True when the damage comes from the player's weapons (eligible for score). */
  byPlayer: boolean;
}

export interface QueuedEvent<K extends SimEventType = SimEventType> {
  readonly type: K;
  readonly payload: SimEventMap[K];
}

/** Complete mutable state of one match. Owned by `Simulation`. */
export interface MatchState {
  phase: MatchPhase;
  /** Fixed steps simulated so far (active time = ticks * fixedStepSec). */
  ticks: number;
  /** Fixed steps in a full session. */
  readonly totalTicks: number;
  score: number;
  endReason: EndReason | null;
  spawnsSoFar: number;
  readonly player: PlayerShip;
  readonly enemies: EnemyShip[];
  readonly projectiles: Projectile[];
  spawnTimer: number;
  openingIndex: number;
  flowFieldTimer: number;
  nextId: number;
}

/** Everything a system needs for one fixed step. */
export interface SimContext {
  readonly config: GameConfig;
  readonly map: GameMap;
  readonly grid: CollisionGrid;
  readonly flowField: FlowField;
  readonly rng: Rng;
  readonly state: MatchState;
  readonly intents: Readonly<PlayerIntents>;
  readonly dt: number;
  readonly damageQueue: DamageEntry[];
  readonly projectilePool: Projectile[];
  emit<K extends SimEventType>(type: K, payload: SimEventMap[K]): void;
}

/** Comparison tolerance for timers accumulated from fixed steps. */
export const TIME_EPSILON = 1e-9;

export function shipConfigOf(config: GameConfig, ship: Ship): ShipConfig {
  switch (ship.kind) {
    case 'player':
      return config.player;
    case 'chaser':
      return config.chaser;
    case 'shooter':
      return config.shooter;
  }
}

export function nextId(state: MatchState): number {
  return state.nextId++;
}
