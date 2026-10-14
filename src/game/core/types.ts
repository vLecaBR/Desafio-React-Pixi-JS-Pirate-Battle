import type { EnemyKind } from '../config/gameConfig.ts';

export type { EnemyKind };

export type ShipKind = 'player' | EnemyKind;
export type Team = 'player' | 'enemy';
export type MatchPhase = 'running' | 'ended';
export type EndReason = 'time_up' | 'defeated';
export type WeaponSlot = 'front' | 'broadsideLeft' | 'broadsideRight' | 'enemyCannon';

/** Boolean intents produced by keyboard/touch input (or by tests/bots). */
export interface PlayerIntents {
  forward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
}

export function createIntents(): PlayerIntents {
  return {
    forward: false,
    turnLeft: false,
    turnRight: false,
    fireFront: false,
    fireLeft: false,
    fireRight: false,
  };
}

interface ShipBase {
  readonly id: number;
  alive: boolean;
  x: number;
  y: number;
  heading: number;
  /** Pose at the start of the current step, for render interpolation. */
  prevX: number;
  prevY: number;
  prevHeading: number;
  /** Current forward speed (px/s). */
  speed: number;
  hp: number;
  readonly maxHp: number;
  readonly radius: number;
  readonly hullOffset: number;
}

export interface PlayerShip extends ShipBase {
  readonly kind: 'player';
  readonly cooldowns: { front: number; left: number; right: number };
  /** -1 (port/left), 0 or 1 (starboard/right), from the current intents. */
  turnInput: number;
  /** 0 or 1, from the current intents (the player only sails forward). */
  throttle: number;
}

export interface EnemyShip extends ShipBase {
  readonly kind: EnemyKind;
  /** Remaining time before it may fire or deal contact damage. */
  graceSec: number;
  /** Remaining weapon cooldown (Shooter only). */
  cooldown: number;
  /** Throttle (0..1) chosen by the AI this step. */
  throttle: number;
  /** Desired heading chosen by the AI this step. */
  desiredHeading: number;
  /** Set by the AI when the target is in range and aligned (Shooter only). */
  wantsToFire: boolean;
}

export type Ship = PlayerShip | EnemyShip;

export interface Projectile {
  id: number;
  alive: boolean;
  team: Team;
  ownerId: number;
  weapon: WeaponSlot;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  dirX: number;
  dirY: number;
  speed: number;
  damage: number;
  radius: number;
  traveled: number;
  maxRange: number;
  age: number;
  lifetime: number;
}

export type DamageSource = 'projectile' | 'contact';

export interface MatchResult {
  readonly score: number;
  readonly durationMs: number;
  readonly endReason: EndReason;
}

/** Events emitted once per occurrence, after the step that produced them. */
export interface SimEventMap {
  shotFired: {
    shooterId: number;
    team: Team;
    weapon: WeaponSlot;
    x: number;
    y: number;
    heading: number;
    projectileIds: readonly number[];
  };
  projectileHit: {
    projectileId: number;
    team: Team;
    target: 'ship' | 'obstacle';
    targetId: number | null;
    x: number;
    y: number;
  };
  projectileExpired: {
    projectileId: number;
    reason: 'range' | 'lifetime' | 'outOfBounds' | 'ownerDestroyed';
    x: number;
    y: number;
  };
  shipDamaged: {
    shipId: number;
    kind: ShipKind;
    amount: number;
    hp: number;
    maxHp: number;
    source: DamageSource;
    x: number;
    y: number;
  };
  enemySpawned: { enemyId: number; kind: EnemyKind; x: number; y: number; heading: number };
  enemyDestroyed: {
    enemyId: number;
    kind: EnemyKind;
    killedBy: 'player' | 'self';
    x: number;
    y: number;
    heading: number;
  };
  playerDestroyed: { x: number; y: number; heading: number };
  scoreChanged: { score: number };
  matchEnded: MatchResult;
}

export type SimEventType = keyof SimEventMap;
