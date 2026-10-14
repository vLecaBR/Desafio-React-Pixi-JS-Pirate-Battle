import type { EnemyKind, GameConfig } from '../config/gameConfig.ts';
import type { DamageEntry, MatchState, QueuedEvent, SimContext } from './context.ts';
import { EventBus } from './EventBus.ts';
import { Rng } from './rng.ts';
import { collisionsSystem } from './systems/collisions.ts';
import { damageSystem } from './systems/damage.ts';
import { enemyAISystem } from './systems/enemyAI.ts';
import { inputSystem } from './systems/input.ts';
import { matchRulesSystem } from './systems/matchRules.ts';
import { movementSystem } from './systems/movement.ts';
import { projectilesSystem } from './systems/projectiles.ts';
import { createEnemy, spawnerSystem } from './systems/spawner.ts';
import { weaponsSystem } from './systems/weapons.ts';
import {
  createIntents,
  type EndReason,
  type EnemyShip,
  type MatchPhase,
  type MatchResult,
  type PlayerIntents,
  type PlayerShip,
  type Projectile,
  type SimEventMap,
  type SimEventType,
} from './types.ts';
import { CollisionGrid } from './world/collisionGrid.ts';
import { FlowField } from './world/flowField.ts';
import { buildMap, DEFAULT_MAP_SOURCE, type GameMap } from './world/map.ts';

/** Optional initial state, used by deterministic presets and tests. */
export interface SimulationSetup {
  readonly player?: {
    readonly x?: number;
    readonly y?: number;
    readonly heading?: number;
    readonly hp?: number;
  };
  readonly enemies?: readonly {
    readonly kind: EnemyKind;
    readonly x: number;
    readonly y: number;
    readonly heading?: number;
    readonly hp?: number;
    readonly graceSec?: number;
  }[];
}

export interface SimulationOptions {
  /** Immutable configuration snapshot for this match (see `createMatchConfig`). */
  readonly config: GameConfig;
  readonly seed: number;
  readonly map?: GameMap;
  readonly setup?: SimulationSetup;
}

/** Read-only view of the match, for the renderer, the HUD bridge and tests. */
export interface SimSnapshot {
  readonly phase: MatchPhase;
  readonly ticks: number;
  readonly elapsedSec: number;
  readonly remainingSec: number;
  readonly score: number;
  readonly endReason: EndReason | null;
  readonly spawnsSoFar: number;
  readonly player: Readonly<PlayerShip>;
  readonly enemies: readonly Readonly<EnemyShip>[];
  readonly projectiles: readonly Readonly<Projectile>[];
}

/** Systems run in this fixed order on every step. */
const SYSTEMS: readonly ((ctx: SimContext) => void)[] = [
  inputSystem,
  enemyAISystem,
  movementSystem,
  collisionsSystem,
  weaponsSystem,
  projectilesSystem,
  damageSystem,
  removeDestroyed,
  spawnerSystem,
  matchRulesSystem,
];

/**
 * Deterministic, framework-free match simulation.
 *
 * - `step()` advances exactly one fixed step (`config.sim.fixedStepSec`); the caller
 *   owns real time (see `FixedStepClock`), so pausing is simply not stepping.
 * - Input arrives as boolean intents (`setIntents`).
 * - Randomness comes only from the seeded RNG: same seed + same inputs => same match.
 * - Events are queued during a step and dispatched after it, so listeners always
 *   observe a consistent state. Listeners must not mutate the simulation.
 */
export class Simulation {
  readonly config: GameConfig;
  readonly map: GameMap;
  readonly seed: number;

  private readonly grid: CollisionGrid;
  private readonly state: MatchState;
  private readonly ctx: SimContext;
  private readonly intents: PlayerIntents = createIntents();
  private readonly bus = new EventBus<SimEventMap>();
  private readonly pendingEvents: QueuedEvent[] = [];
  private readonly damageQueue: DamageEntry[] = [];
  private readonly projectilePool: Projectile[] = [];
  private readonly view: { -readonly [K in keyof SimSnapshot]: SimSnapshot[K] };
  private result: MatchResult | null = null;
  private destroyed = false;

  constructor(options: SimulationOptions) {
    const { config, seed, setup } = options;
    this.config = config;
    this.seed = seed;
    this.map = options.map ?? buildMap(DEFAULT_MAP_SOURCE, config.world.tileSize);
    if (this.map.widthPx !== config.world.widthPx || this.map.heightPx !== config.world.heightPx) {
      throw new Error('Simulation: map size does not match config.world');
    }
    this.grid = new CollisionGrid(this.map);

    const start = this.map.playerStart;
    const playerCfg = config.player;
    const x = setup?.player?.x ?? start.x;
    const y = setup?.player?.y ?? start.y;
    const heading = setup?.player?.heading ?? start.heading;
    const player: PlayerShip = {
      id: 1,
      kind: 'player',
      alive: true,
      x,
      y,
      heading,
      prevX: x,
      prevY: y,
      prevHeading: heading,
      speed: 0,
      hp: Math.min(setup?.player?.hp ?? playerCfg.maxHealth, playerCfg.maxHealth),
      maxHp: playerCfg.maxHealth,
      radius: playerCfg.collisionRadius,
      hullOffset: playerCfg.hullOffsetPx,
      cooldowns: { front: 0, left: 0, right: 0 },
      turnInput: 0,
      throttle: 0,
    };

    const fixedStep = config.sim.fixedStepSec;
    this.state = {
      phase: 'running',
      ticks: 0,
      totalTicks: Math.round(config.match.sessionTimeSec / fixedStep),
      score: 0,
      endReason: null,
      spawnsSoFar: 0,
      player,
      enemies: [],
      projectiles: [],
      spawnTimer: config.spawn.intervalSec - config.spawn.initialDelaySec,
      openingIndex: 0,
      flowFieldTimer: 0,
      nextId: 2,
    };

    this.ctx = {
      config,
      map: this.map,
      grid: this.grid,
      flowField: new FlowField(this.grid),
      rng: new Rng(seed),
      state: this.state,
      intents: this.intents,
      dt: fixedStep,
      damageQueue: this.damageQueue,
      projectilePool: this.projectilePool,
      emit: (type, payload) => {
        this.pendingEvents.push({ type, payload });
      },
    };

    for (const enemy of setup?.enemies ?? []) {
      const ship = createEnemy(this.ctx, enemy.kind, enemy.x, enemy.y, enemy.heading ?? 0);
      if (enemy.hp !== undefined) ship.hp = Math.min(enemy.hp, ship.maxHp);
      if (enemy.graceSec !== undefined) ship.graceSec = enemy.graceSec;
      this.state.enemies.push(ship);
    }

    this.view = {
      phase: 'running',
      ticks: 0,
      elapsedSec: 0,
      remainingSec: config.match.sessionTimeSec,
      score: 0,
      endReason: null,
      spawnsSoFar: 0,
      player,
      enemies: this.state.enemies,
      projectiles: this.state.projectiles,
    };
  }

  get phase(): MatchPhase {
    return this.state.phase;
  }

  /** Final result, available once the match has ended. */
  get matchResult(): MatchResult | null {
    return this.result;
  }

  /** Replaces the current input intents (copied, so callers may reuse their object). */
  setIntents(intents: Readonly<PlayerIntents>): void {
    Object.assign(this.intents, intents);
  }

  /** Releases every held control (used on pause/resume so nothing carries over). */
  clearIntents(): void {
    Object.assign(this.intents, createIntents());
  }

  /** Advances one fixed step. Returns false (and does nothing) once the match ended. */
  step(): boolean {
    if (this.destroyed || this.state.phase !== 'running') return false;

    const { player, enemies, projectiles } = this.state;
    player.prevX = player.x;
    player.prevY = player.y;
    player.prevHeading = player.heading;
    for (const enemy of enemies) {
      enemy.prevX = enemy.x;
      enemy.prevY = enemy.y;
      enemy.prevHeading = enemy.heading;
    }
    for (const projectile of projectiles) {
      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;
    }

    for (const system of SYSTEMS) system(this.ctx);

    if (!this.result && this.state.endReason) {
      this.result = {
        score: this.state.score,
        durationMs: Math.round(this.state.ticks * this.config.sim.fixedStepSec * 1000),
        endReason: this.state.endReason,
      };
    }
    this.flushEvents();
    return true;
  }

  on<K extends SimEventType>(type: K, listener: (payload: SimEventMap[K]) => void): () => void {
    return this.bus.on(type, listener);
  }

  /**
   * Read-only view of the live state. The returned object and its arrays are reused
   * between calls (no per-frame copies); do not keep references across steps.
   */
  snapshot(): SimSnapshot {
    const { state, view } = this;
    const elapsed = state.ticks * this.config.sim.fixedStepSec;
    view.phase = state.phase;
    view.ticks = state.ticks;
    view.elapsedSec = elapsed;
    view.remainingSec = Math.max(0, this.config.match.sessionTimeSec - elapsed);
    view.score = state.score;
    view.endReason = state.endReason;
    view.spawnsSoFar = state.spawnsSoFar;
    return view;
  }

  /** Releases listeners and internal references. Idempotent. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.bus.clear();
    this.pendingEvents.length = 0;
    this.damageQueue.length = 0;
    this.projectilePool.length = 0;
  }

  private flushEvents(): void {
    // Copy first: a listener may legitimately trigger another step (e.g. tests).
    const events = this.pendingEvents.splice(0);
    for (const event of events) this.bus.emit(event.type, event.payload);
  }
}

/**
 * Drops destroyed enemies and finished projectiles from the live arrays (preserving
 * order). Projectiles still in flight from a destroyed enemy are removed too, so a
 * destroyed enemy can no longer deal damage.
 */
function removeDestroyed(ctx: SimContext): void {
  const { enemies, projectiles } = ctx.state;

  let write = 0;
  for (const enemy of enemies) {
    if (enemy.alive) {
      enemies[write++] = enemy;
      continue;
    }
    for (const projectile of projectiles) {
      if (projectile.alive && projectile.ownerId === enemy.id) {
        projectile.alive = false;
        ctx.emit('projectileExpired', {
          projectileId: projectile.id,
          reason: 'ownerDestroyed',
          x: projectile.x,
          y: projectile.y,
        });
      }
    }
  }
  enemies.length = write;

  write = 0;
  for (const projectile of projectiles) {
    if (projectile.alive) projectiles[write++] = projectile;
    else ctx.projectilePool.push(projectile);
  }
  projectiles.length = write;
}
