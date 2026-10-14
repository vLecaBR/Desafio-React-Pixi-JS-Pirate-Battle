import type { EnemyKind } from '../../config/gameConfig.ts';
import { nextId, TIME_EPSILON, type SimContext } from '../context.ts';
import { angleDelta, headingOf } from '../math.ts';
import type { EnemyShip } from '../types.ts';

/**
 * Spawns one enemy every `spawn.intervalSec` of active time while fewer than
 * `maxAlive` are alive. The first spawns follow `guaranteedOpening` (so both enemy
 * types always appear), then types are drawn with the configured weights.
 *
 * Spawn points are sampled with the seeded RNG and must be:
 * - inside the arena, away from its edges;
 * - free of obstacles and ships within `clearanceRadius`;
 * - at least `minDistanceFromPlayer` away from the player;
 * - outside the cone in front of the player (where it would sail into them).
 * After `maxAttempts` rejected samples the cycle is skipped.
 */
export function spawnerSystem(ctx: SimContext): void {
  const { state, config, dt } = ctx;
  const spawn = config.spawn;
  state.spawnTimer += dt;
  if (state.spawnTimer < spawn.intervalSec - TIME_EPSILON) return;
  state.spawnTimer -= spawn.intervalSec;

  if (!state.player.alive) return;
  const alive = state.enemies.reduce((count, enemy) => count + (enemy.alive ? 1 : 0), 0);
  if (alive >= spawn.maxAlive) return;

  const kind: EnemyKind =
    spawn.guaranteedOpening[state.openingIndex] ?? ctx.rng.weighted(spawn.weights);
  const point = findSpawnPoint(ctx);
  if (!point) return;
  if (state.openingIndex < spawn.guaranteedOpening.length) state.openingIndex++;

  const { player } = state;
  const heading = headingOf(player.x - point.x, player.y - point.y);
  const enemy = createEnemy(ctx, kind, point.x, point.y, heading);
  state.enemies.push(enemy);
  state.spawnsSoFar++;
  ctx.emit('enemySpawned', { enemyId: enemy.id, kind, x: enemy.x, y: enemy.y, heading });
}

export function createEnemy(
  ctx: Pick<SimContext, 'config' | 'state'>,
  kind: EnemyKind,
  x: number,
  y: number,
  heading: number,
): EnemyShip {
  const cfg = kind === 'chaser' ? ctx.config.chaser : ctx.config.shooter;
  return {
    id: nextId(ctx.state),
    kind,
    alive: true,
    x,
    y,
    heading,
    prevX: x,
    prevY: y,
    prevHeading: heading,
    speed: 0,
    hp: cfg.maxHealth,
    maxHp: cfg.maxHealth,
    radius: cfg.collisionRadius,
    hullOffset: cfg.hullOffsetPx,
    graceSec: ctx.config.spawn.spawnGraceSec,
    cooldown: 0,
    throttle: 0,
    desiredHeading: heading,
    wantsToFire: false,
  };
}

function findSpawnPoint(ctx: SimContext): { x: number; y: number } | null {
  const { config, grid, rng, state } = ctx;
  const spawn = config.spawn;
  const { player } = state;
  const minDistanceSq = spawn.minDistanceFromPlayer ** 2;
  const coneDistanceSq = spawn.forwardConeDistancePx ** 2;

  for (let attempt = 0; attempt < spawn.maxAttempts; attempt++) {
    const x = rng.range(spawn.edgeMarginPx, grid.widthPx - spawn.edgeMarginPx);
    const y = rng.range(spawn.edgeMarginPx, grid.heightPx - spawn.edgeMarginPx);

    const dx = x - player.x;
    const dy = y - player.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < minDistanceSq) continue;
    if (
      distanceSq < coneDistanceSq &&
      Math.abs(angleDelta(player.heading, headingOf(dx, dy))) < spawn.forwardConeHalfAngleRad
    ) {
      continue;
    }
    if (grid.overlapsCircle(x, y, spawn.clearanceRadius)) continue;

    const blockedByShip = state.enemies.some((enemy) => {
      if (!enemy.alive) return false;
      const reach = spawn.clearanceRadius + enemy.radius + enemy.hullOffset;
      return (enemy.x - x) ** 2 + (enemy.y - y) ** 2 < reach * reach;
    });
    if (blockedByShip) continue;

    return { x, y };
  }
  return null;
}
