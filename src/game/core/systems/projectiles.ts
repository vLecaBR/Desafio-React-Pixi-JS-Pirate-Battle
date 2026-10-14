import { TIME_EPSILON, type SimContext } from '../context.ts';
import { segmentCircleT } from '../math.ts';
import type { Projectile, Ship } from '../types.ts';
import { HULL_CIRCLES, hullCircleX, hullCircleY } from './hull.ts';

/**
 * Moves projectiles and resolves hits with a swept test (segment from the current
 * to the next position), so fast shots never tunnel through thin targets.
 * The earliest hit wins: a ship of the opposing team or a static obstacle.
 * A projectile is consumed by its first hit (`alive = false`), so its damage is
 * queued exactly once.
 */
export function projectilesSystem(ctx: SimContext): void {
  const { state, grid, dt } = ctx;
  for (const p of state.projectiles) {
    if (!p.alive) continue;
    p.prevX = p.x;
    p.prevY = p.y;

    const travel = Math.min(p.speed * dt, p.maxRange - p.traveled);
    const nx = p.x + p.dirX * travel;
    const ny = p.y + p.dirY * travel;

    const tObstacle = grid.segmentT(p.x, p.y, nx, ny);
    let tShip = Infinity;
    let hitShip: Ship | null = null;
    if (p.team === 'player') {
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        const t = sweptHit(p, nx, ny, enemy);
        if (t < tShip) {
          tShip = t;
          hitShip = enemy;
        }
      }
    } else if (state.player.alive) {
      tShip = sweptHit(p, nx, ny, state.player);
      if (tShip !== Infinity) hitShip = state.player;
    }

    if (hitShip && tShip <= tObstacle) {
      p.x += (nx - p.x) * tShip;
      p.y += (ny - p.y) * tShip;
      p.alive = false;
      ctx.damageQueue.push({
        targetId: hitShip.id,
        amount: p.damage,
        source: 'projectile',
        byPlayer: p.team === 'player',
      });
      ctx.emit('projectileHit', {
        projectileId: p.id,
        team: p.team,
        target: 'ship',
        targetId: hitShip.id,
        x: p.x,
        y: p.y,
      });
      continue;
    }

    if (tObstacle !== Infinity) {
      p.x += (nx - p.x) * tObstacle;
      p.y += (ny - p.y) * tObstacle;
      p.alive = false;
      ctx.emit('projectileHit', {
        projectileId: p.id,
        team: p.team,
        target: 'obstacle',
        targetId: null,
        x: p.x,
        y: p.y,
      });
      continue;
    }

    p.x = nx;
    p.y = ny;
    p.traveled += travel;
    p.age += dt;

    let reason: 'outOfBounds' | 'range' | 'lifetime' | null = null;
    if (p.x < 0 || p.y < 0 || p.x > grid.widthPx || p.y > grid.heightPx) reason = 'outOfBounds';
    else if (p.traveled >= p.maxRange - 1e-6) reason = 'range';
    else if (p.age >= p.lifetime - TIME_EPSILON) reason = 'lifetime';
    if (reason) {
      p.alive = false;
      ctx.emit('projectileExpired', { projectileId: p.id, reason, x: p.x, y: p.y });
    }
  }
}

function sweptHit(p: Projectile, nx: number, ny: number, ship: Ship): number {
  let best = Infinity;
  for (const index of HULL_CIRCLES) {
    const t = segmentCircleT(
      p.x,
      p.y,
      nx,
      ny,
      hullCircleX(ship, index),
      hullCircleY(ship, index),
      ship.radius + p.radius,
    );
    if (t < best) best = t;
  }
  return best;
}
