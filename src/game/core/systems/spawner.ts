import type { EnemyKind } from '../../config/gameConfig.ts';
import { nextId, TIME_EPSILON, type SimContext } from '../context.ts';
import { angleDelta, headingOf } from '../math.ts';
import type { EnemyShip } from '../types.ts';
import type { CollisionGrid } from '../world/collisionGrid.ts';

/**
 * Spawns one enemy every `spawn.intervalSec` of active time while fewer than
 * `maxAlive` are alive. The first spawns follow `guaranteedOpening` (so both enemy
 * types always appear), then types are drawn with the configured weights.
 *
 * Spawn points must be:
 * - inside the arena, away from its edges;
 * - free of obstacles and ships within `clearanceRadius`;
 * - at least `minDistanceFromPlayer` away from the player;
 * - outside the cone in front of the player (where it would sail into them).
 *
 * Candidates are the centers of the tiles that are statically clear (computed once
 * per map). Each cycle filters them against the dynamic rules and picks one with the
 * seeded RNG, plus a small jitter (up to `maxAttempts` jitter tries, falling back to
 * the tile center). The cycle is skipped only when no tile satisfies the rules.
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

const candidateCache = new WeakMap<
  CollisionGrid,
  Map<number, readonly { x: number; y: number }[]>
>();

/** Tile centers that are free of obstacles within `clearance` and inside the margins. */
function staticCandidates(
  grid: CollisionGrid,
  clearance: number,
  margin: number,
): readonly { x: number; y: number }[] {
  let byClearance = candidateCache.get(grid);
  if (!byClearance) {
    byClearance = new Map();
    candidateCache.set(grid, byClearance);
  }
  const key = clearance * 10_000 + margin;
  let list = byClearance.get(key);
  if (!list) {
    const points: { x: number; y: number }[] = [];
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const x = (col + 0.5) * grid.tileSize;
        const y = (row + 0.5) * grid.tileSize;
        if (x < margin || y < margin || x > grid.widthPx - margin || y > grid.heightPx - margin) {
          continue;
        }
        if (!grid.overlapsCircle(x, y, clearance)) points.push({ x, y });
      }
    }
    list = points;
    byClearance.set(key, list);
  }
  return list;
}

function findSpawnPoint(ctx: SimContext): { x: number; y: number } | null {
  const { config, grid, rng, state } = ctx;
  const spawn = config.spawn;
  const { player } = state;
  const minDistanceSq = spawn.minDistanceFromPlayer ** 2;
  const coneDistanceSq = spawn.forwardConeDistancePx ** 2;

  const isValid = (x: number, y: number): boolean => {
    const dx = x - player.x;
    const dy = y - player.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < minDistanceSq) return false;
    if (
      distanceSq < coneDistanceSq &&
      Math.abs(angleDelta(player.heading, headingOf(dx, dy))) < spawn.forwardConeHalfAngleRad
    ) {
      return false;
    }
    if (x < spawn.edgeMarginPx || y < spawn.edgeMarginPx) return false;
    if (x > grid.widthPx - spawn.edgeMarginPx || y > grid.heightPx - spawn.edgeMarginPx) {
      return false;
    }
    if (grid.overlapsCircle(x, y, spawn.clearanceRadius)) return false;
    return !state.enemies.some((enemy) => {
      if (!enemy.alive) return false;
      const reach = spawn.clearanceRadius + enemy.radius + enemy.hullOffset;
      return (enemy.x - x) ** 2 + (enemy.y - y) ** 2 < reach * reach;
    });
  };

  const valid = staticCandidates(grid, spawn.clearanceRadius, spawn.edgeMarginPx).filter((p) =>
    isValid(p.x, p.y),
  );
  if (valid.length === 0) return null;

  const base = valid[rng.int(valid.length)];
  if (!base) return null;
  const jitter = grid.tileSize / 2;
  for (let attempt = 0; attempt < spawn.maxAttempts; attempt++) {
    const x = base.x + rng.range(-jitter, jitter);
    const y = base.y + rng.range(-jitter, jitter);
    if (isValid(x, y)) return { x, y };
  }
  return { x: base.x, y: base.y };
}
