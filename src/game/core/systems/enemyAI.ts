import type { SimContext } from '../context.ts';
import { angleDelta, headingOf, type MutableVec2 } from '../math.ts';
import type { EnemyShip } from '../types.ts';
import type { CollisionGrid } from '../world/collisionGrid.ts';

const waypoint: MutableVec2 = { x: 0, y: 0 };

/**
 * Steering decisions for every enemy:
 * - Chaser: heads straight for the player when the corridor is clear, otherwise
 *   follows the flow field around islands.
 * - Shooter: same navigation until the player is within attack range with line of
 *   sight; then it holds at the preferred distance, turns its bow to the player and
 *   flags `wantsToFire` once aligned.
 */
export function enemyAISystem(ctx: SimContext): void {
  const { state, config, grid, flowField, dt } = ctx;
  const { player } = state;

  state.flowFieldTimer -= dt;
  if (state.flowFieldTimer <= 0) {
    flowField.rebuild(player.x, player.y);
    state.flowFieldTimer += config.ai.flowFieldIntervalSec;
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.graceSec = Math.max(0, enemy.graceSec - dt);
    enemy.wantsToFire = false;

    if (!player.alive) {
      enemy.throttle = 0;
      continue;
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);

    // Navigation target: the player when the corridor is clear, else the next waypoint.
    let targetX = player.x;
    let targetY = player.y;
    if (!corridorIsClear(grid, enemy, player.x, player.y)) {
      if (flowField.nextWaypoint(enemy.x, enemy.y, waypoint)) {
        targetX = waypoint.x;
        targetY = waypoint.y;
      }
    }
    enemy.desiredHeading = headingOf(targetX - enemy.x, targetY - enemy.y);
    enemy.throttle = 1;

    if (enemy.kind === 'shooter') {
      const cfg = config.shooter;
      const lineOfSight = grid.hasLineOfSight(enemy.x, enemy.y, player.x, player.y);
      const inRange = distance <= cfg.attackRangePx && (lineOfSight || !cfg.requireLineOfSight);
      if (inRange) {
        enemy.desiredHeading = headingOf(dx, dy);
        enemy.throttle = distance > cfg.preferredDistancePx ? 1 : 0;
        const aimError = Math.abs(angleDelta(enemy.heading, enemy.desiredHeading));
        enemy.wantsToFire = aimError <= cfg.aimToleranceRad && enemy.graceSec <= 0;
      }
    }

    // Slow down for sharp turns so ships do not orbit around their target.
    const turn = Math.abs(angleDelta(enemy.heading, enemy.desiredHeading));
    if (turn > config.ai.sharpTurnAngleRad) {
      enemy.throttle = Math.min(enemy.throttle, config.ai.sharpTurnThrottle);
    }
  }
}

/** Line of sight wide enough for the hull: center ray plus two side rays. */
function corridorIsClear(grid: CollisionGrid, ship: EnemyShip, tx: number, ty: number): boolean {
  if (!grid.hasLineOfSight(ship.x, ship.y, tx, ty)) return false;
  const dx = tx - ship.x;
  const dy = ty - ship.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return true;
  const nx = (-dy / length) * ship.radius;
  const ny = (dx / length) * ship.radius;
  return (
    grid.hasLineOfSight(ship.x + nx, ship.y + ny, tx + nx, ty + ny) &&
    grid.hasLineOfSight(ship.x - nx, ship.y - ny, tx - nx, ty - ny)
  );
}
