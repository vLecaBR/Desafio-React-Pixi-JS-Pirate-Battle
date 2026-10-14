import { shipConfigOf, type SimContext } from '../context.ts';
import { approach, forwardX, forwardY, rotateTowards, wrapAngle } from '../math.ts';
import type { Ship } from '../types.ts';
import { resolveShipAgainstStatics } from './hull.ts';

/**
 * Rotation and forward motion for every ship, followed by static collision
 * resolution. Ships only move forward; speed eases towards `throttle * moveSpeed`.
 */
export function movementSystem(ctx: SimContext): void {
  const { player, enemies } = ctx.state;
  if (player.alive) {
    const cfg = ctx.config.player;
    player.heading = wrapAngle(player.heading + player.turnInput * cfg.turnSpeedRad * ctx.dt);
    integrate(ctx, player, player.throttle);
  }
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const cfg = shipConfigOf(ctx.config, enemy);
    enemy.heading = rotateTowards(enemy.heading, enemy.desiredHeading, cfg.turnSpeedRad * ctx.dt);
    integrate(ctx, enemy, enemy.throttle);
  }
}

function integrate(ctx: SimContext, ship: Ship, throttle: number): void {
  const cfg = shipConfigOf(ctx.config, ship);
  const target = cfg.moveSpeed * throttle;
  const rate = target > ship.speed ? cfg.accelerationPxPerSec2 : cfg.decelerationPxPerSec2;
  ship.speed = approach(ship.speed, target, rate * ctx.dt);
  ship.x += forwardX(ship.heading) * ship.speed * ctx.dt;
  ship.y += forwardY(ship.heading) * ship.speed * ctx.dt;
  resolveShipAgainstStatics(ship, ctx.grid, ctx.config.sim.collisionIterations);
}
