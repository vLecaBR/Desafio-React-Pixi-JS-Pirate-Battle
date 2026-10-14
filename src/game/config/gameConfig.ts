/**
 * Single source of truth for gameplay balancing.
 *
 * Systems read every tunable number from a `GameConfig`; none of them hard-codes
 * gameplay values. A match receives an immutable snapshot built by
 * `createMatchConfig()`, so changing options mid-match only affects the next one.
 *
 * Units: distances in world pixels, time in seconds, angles in radians,
 * speeds in px/s and angular speeds in rad/s.
 */

export interface WeaponConfig {
  /** Damage applied by each projectile. */
  readonly damage: number;
  /** Minimum time between two shots of this weapon. */
  readonly cooldownSec: number;
  readonly projectileSpeed: number;
  /** Maximum travel distance before the projectile expires. */
  readonly rangePx: number;
  /** Maximum lifetime before the projectile expires (whichever comes first). */
  readonly lifetimeSec: number;
  /** Used for projectile-vs-ship hit tests (swept circle). */
  readonly projectileRadius: number;
  /** Distance from the ship center to the muzzle along the firing direction. */
  readonly muzzleOffsetPx: number;
}

export interface BroadsideConfig extends WeaponConfig {
  /** Number of parallel projectiles fired per side. */
  readonly shots: number;
  /** Spacing between the parallel projectiles along the hull. */
  readonly spacingPx: number;
}

/**
 * Ships collide as two circles (bow and stern) placed at `±hullOffsetPx` from the
 * center along the heading, each with `collisionRadius`.
 */
export interface ShipConfig {
  readonly maxHealth: number;
  readonly moveSpeed: number;
  readonly turnSpeedRad: number;
  readonly accelerationPxPerSec2: number;
  readonly decelerationPxPerSec2: number;
  readonly collisionRadius: number;
  readonly hullOffsetPx: number;
}

export interface PlayerConfig extends ShipConfig {
  readonly frontCannon: WeaponConfig;
  readonly broadside: BroadsideConfig;
}

export interface ChaserConfig extends ShipConfig {
  /** Damage dealt to the player when the Chaser rams it (the Chaser explodes). */
  readonly contactDamage: number;
}

export interface ShooterConfig extends ShipConfig {
  /** The Shooter only fires when the player is within this distance. */
  readonly attackRangePx: number;
  /** The Shooter stops approaching once it is this close. */
  readonly preferredDistancePx: number;
  /** Maximum angle between its bow and the player to allow firing. */
  readonly aimToleranceRad: number;
  readonly requireLineOfSight: boolean;
  readonly cannon: WeaponConfig;
}

export type EnemyKind = 'chaser' | 'shooter';

export interface SpawnConfig {
  /** Time between spawn attempts. Exposed in Options. */
  readonly intervalSec: number;
  /** Delay before the first spawn attempt of a match. */
  readonly initialDelaySec: number;
  readonly maxAlive: number;
  /** Spawn points are at least this far from the player. */
  readonly minDistanceFromPlayer: number;
  /** Spawn points are kept away from the arena edges. */
  readonly edgeMarginPx: number;
  /** Free radius required around a spawn point (no obstacles or ships). */
  readonly clearanceRadius: number;
  /** Spawn points inside this cone in front of the player are rejected... */
  readonly forwardConeHalfAngleRad: number;
  /** ...when they are also closer than this distance. */
  readonly forwardConeDistancePx: number;
  readonly maxAttempts: number;
  /** Relative weights of each enemy type after the guaranteed opening. */
  readonly weights: Readonly<Record<EnemyKind, number>>;
  /** Enemy types spawned first, in order (guarantees both types appear). */
  readonly guaranteedOpening: readonly EnemyKind[];
  /** Newly spawned enemies neither fire nor deal contact damage for this long. */
  readonly spawnGraceSec: number;
}

export interface AiConfig {
  /** How often the navigation flow field towards the player is rebuilt. */
  readonly flowFieldIntervalSec: number;
  /** Heading error above which the ship slows down to turn. */
  readonly sharpTurnAngleRad: number;
  /** Throttle (0..1) used while turning sharply. */
  readonly sharpTurnThrottle: number;
}

export interface GameConfig {
  readonly match: { readonly sessionTimeSec: number };
  readonly spawn: SpawnConfig;
  readonly player: PlayerConfig;
  readonly chaser: ChaserConfig;
  readonly shooter: ShooterConfig;
  readonly ai: AiConfig;
  readonly world: {
    readonly widthPx: number;
    readonly heightPx: number;
    readonly tileSize: number;
  };
  readonly sim: {
    /** Fixed simulation step. */
    readonly fixedStepSec: number;
    /** Real frame time is clamped to this value before being accumulated. */
    readonly maxFrameSec: number;
    /** Positional collision solver iterations per step. */
    readonly collisionIterations: number;
  };
  readonly visuals: {
    /** Health ratios (descending) at which ships switch to the next damage sprite. */
    readonly damageStages: readonly [number, number, number];
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  match: { sessionTimeSec: 120 },
  spawn: {
    intervalSec: 3,
    initialDelaySec: 1.5,
    maxAlive: 8,
    minDistanceFromPlayer: 420,
    edgeMarginPx: 48,
    clearanceRadius: 72,
    forwardConeHalfAngleRad: Math.PI / 4,
    forwardConeDistancePx: 640,
    maxAttempts: 40,
    weights: { chaser: 0.55, shooter: 0.45 },
    guaranteedOpening: ['chaser', 'shooter'],
    spawnGraceSec: 1,
  },
  player: {
    maxHealth: 100,
    moveSpeed: 150,
    turnSpeedRad: 2.6,
    accelerationPxPerSec2: 320,
    decelerationPxPerSec2: 260,
    collisionRadius: 20,
    hullOffsetPx: 24,
    frontCannon: {
      damage: 25,
      cooldownSec: 0.45,
      projectileSpeed: 560,
      rangePx: 520,
      lifetimeSec: 1.2,
      projectileRadius: 5,
      muzzleOffsetPx: 56,
    },
    broadside: {
      damage: 20,
      cooldownSec: 1.4,
      projectileSpeed: 460,
      rangePx: 360,
      lifetimeSec: 1,
      projectileRadius: 5,
      muzzleOffsetPx: 30,
      shots: 3,
      spacingPx: 22,
    },
  },
  chaser: {
    maxHealth: 40,
    moveSpeed: 125,
    turnSpeedRad: 2.2,
    accelerationPxPerSec2: 260,
    decelerationPxPerSec2: 220,
    collisionRadius: 20,
    hullOffsetPx: 24,
    contactDamage: 25,
  },
  shooter: {
    maxHealth: 60,
    moveSpeed: 90,
    turnSpeedRad: 1.8,
    accelerationPxPerSec2: 200,
    decelerationPxPerSec2: 200,
    collisionRadius: 20,
    hullOffsetPx: 24,
    attackRangePx: 360,
    preferredDistancePx: 280,
    aimToleranceRad: 0.12,
    requireLineOfSight: true,
    cannon: {
      damage: 10,
      cooldownSec: 1.8,
      projectileSpeed: 400,
      rangePx: 420,
      lifetimeSec: 1.3,
      projectileRadius: 5,
      muzzleOffsetPx: 56,
    },
  },
  ai: {
    flowFieldIntervalSec: 0.25,
    sharpTurnAngleRad: Math.PI / 2,
    sharpTurnThrottle: 0.35,
  },
  world: { widthPx: 1280, heightPx: 768, tileSize: 64 },
  sim: { fixedStepSec: 1 / 60, maxFrameSec: 0.1, collisionIterations: 3 },
  visuals: { damageStages: [0.66, 0.33, 0] },
};

/** Player-facing options (persisted locally, validated by the Options screen). */
export interface MatchOptions {
  readonly sessionTimeSec: number;
  readonly spawnIntervalSec: number;
}

export interface NumericLimit {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

/** Documented limits of the two parameters exposed in Options. */
export const OPTION_LIMITS: Readonly<Record<keyof MatchOptions, NumericLimit>> = {
  sessionTimeSec: { min: 60, max: 180, step: 10 },
  spawnIntervalSec: { min: 1, max: 10, step: 0.5 },
};

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
  sessionTimeSec: DEFAULT_GAME_CONFIG.match.sessionTimeSec,
  spawnIntervalSec: DEFAULT_GAME_CONFIG.spawn.intervalSec,
};

export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Recursively freezes an object graph (plain objects and arrays). */
export function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value as DeepReadonly<T>;
}

/** Deep-clone-and-patch helper for tests, presets and tooling. */
export type ConfigOverrides<T> = {
  readonly [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? ConfigOverrides<T[K]>
      : T[K];
};

function mergeInto(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = target[key];
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current !== null &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      mergeInto(current as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = Array.isArray(value) ? [...(value as unknown[])] : value;
    }
  }
}

/**
 * Builds the immutable configuration snapshot used by one match:
 * defaults + player options (+ optional overrides for presets/tests).
 */
export function createMatchConfig(
  options: MatchOptions = DEFAULT_MATCH_OPTIONS,
  overrides: ConfigOverrides<GameConfig> = {},
  base: GameConfig = DEFAULT_GAME_CONFIG,
): GameConfig {
  const config = structuredClone(base) as unknown as Record<string, unknown>;
  mergeInto(config, {
    match: { sessionTimeSec: options.sessionTimeSec },
    spawn: { intervalSec: options.spawnIntervalSec },
  });
  mergeInto(config, overrides);
  const result = config as unknown as GameConfig;
  const problems = validateGameConfig(result);
  if (problems.length > 0) {
    throw new RangeError(`Invalid game configuration:\n- ${problems.join('\n- ')}`);
  }
  deepFreeze(result);
  return result;
}

/** Returns a list of human-readable problems (empty when the config is valid). */
export function validateGameConfig(config: GameConfig): string[] {
  const problems: string[] = [];
  const positive = (path: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) problems.push(`${path} must be > 0 (got ${value})`);
  };
  const nonNegative = (path: string, value: number) => {
    if (!Number.isFinite(value) || value < 0) problems.push(`${path} must be >= 0 (got ${value})`);
  };

  positive('match.sessionTimeSec', config.match.sessionTimeSec);
  positive('spawn.intervalSec', config.spawn.intervalSec);
  nonNegative('spawn.initialDelaySec', config.spawn.initialDelaySec);
  nonNegative('spawn.maxAlive', config.spawn.maxAlive);
  positive('spawn.maxAttempts', config.spawn.maxAttempts);
  nonNegative('spawn.spawnGraceSec', config.spawn.spawnGraceSec);
  if (config.spawn.weights.chaser < 0 || config.spawn.weights.shooter < 0) {
    problems.push('spawn.weights must be >= 0');
  }
  if (config.spawn.weights.chaser + config.spawn.weights.shooter <= 0) {
    problems.push('spawn.weights must not all be 0');
  }

  const ship = (path: string, s: ShipConfig) => {
    positive(`${path}.maxHealth`, s.maxHealth);
    positive(`${path}.moveSpeed`, s.moveSpeed);
    positive(`${path}.turnSpeedRad`, s.turnSpeedRad);
    positive(`${path}.accelerationPxPerSec2`, s.accelerationPxPerSec2);
    positive(`${path}.decelerationPxPerSec2`, s.decelerationPxPerSec2);
    positive(`${path}.collisionRadius`, s.collisionRadius);
    nonNegative(`${path}.hullOffsetPx`, s.hullOffsetPx);
  };
  const weapon = (path: string, w: WeaponConfig) => {
    nonNegative(`${path}.damage`, w.damage);
    positive(`${path}.cooldownSec`, w.cooldownSec);
    positive(`${path}.projectileSpeed`, w.projectileSpeed);
    positive(`${path}.rangePx`, w.rangePx);
    positive(`${path}.lifetimeSec`, w.lifetimeSec);
    nonNegative(`${path}.projectileRadius`, w.projectileRadius);
    nonNegative(`${path}.muzzleOffsetPx`, w.muzzleOffsetPx);
  };

  ship('player', config.player);
  weapon('player.frontCannon', config.player.frontCannon);
  weapon('player.broadside', config.player.broadside);
  if (!Number.isInteger(config.player.broadside.shots) || config.player.broadside.shots < 1) {
    problems.push('player.broadside.shots must be a positive integer');
  }
  ship('chaser', config.chaser);
  nonNegative('chaser.contactDamage', config.chaser.contactDamage);
  ship('shooter', config.shooter);
  weapon('shooter.cannon', config.shooter.cannon);
  positive('shooter.attackRangePx', config.shooter.attackRangePx);
  positive('shooter.preferredDistancePx', config.shooter.preferredDistancePx);
  if (config.shooter.preferredDistancePx > config.shooter.attackRangePx) {
    problems.push('shooter.preferredDistancePx must not exceed shooter.attackRangePx');
  }
  positive('ai.flowFieldIntervalSec', config.ai.flowFieldIntervalSec);
  positive('sim.fixedStepSec', config.sim.fixedStepSec);
  positive('sim.maxFrameSec', config.sim.maxFrameSec);
  positive('sim.collisionIterations', config.sim.collisionIterations);
  return problems;
}
