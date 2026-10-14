import type { WeaponConfig } from '../../config/gameConfig.ts';
import { nextId, TIME_EPSILON, type SimContext } from '../context.ts';
import { forwardX, forwardY, wrapAngle } from '../math.ts';
import type { Projectile, Ship, Team, WeaponSlot } from '../types.ts';

/**
 * Cooldowns and firing. Holding a fire intent fires every time the weapon is ready.
 * - Front cannon: one projectile from the bow.
 * - Broadsides: `shots` parallel projectiles spread along the hull, perpendicular to
 *   the heading; each side has its own cooldown.
 * - Shooter cannon: one projectile from the bow when the AI flags `wantsToFire`.
 */
export function weaponsSystem(ctx: SimContext): void {
  const { state, config, intents, dt } = ctx;
  const { player } = state;

  const cd = player.cooldowns;
  cd.front = Math.max(0, cd.front - dt);
  cd.left = Math.max(0, cd.left - dt);
  cd.right = Math.max(0, cd.right - dt);

  if (player.alive) {
    const front = config.player.frontCannon;
    if (intents.fireFront && cd.front <= TIME_EPSILON) {
      cd.front = front.cooldownSec;
      fire(ctx, player, 'player', 'front', front, player.heading, 1, 0);
    }
    const broadside = config.player.broadside;
    if (intents.fireLeft && cd.left <= TIME_EPSILON) {
      cd.left = broadside.cooldownSec;
      const side = wrapAngle(player.heading - Math.PI / 2);
      fire(
        ctx,
        player,
        'player',
        'broadsideLeft',
        broadside,
        side,
        broadside.shots,
        broadside.spacingPx,
      );
    }
    if (intents.fireRight && cd.right <= TIME_EPSILON) {
      cd.right = broadside.cooldownSec;
      const side = wrapAngle(player.heading + Math.PI / 2);
      fire(
        ctx,
        player,
        'player',
        'broadsideRight',
        broadside,
        side,
        broadside.shots,
        broadside.spacingPx,
      );
    }
  }

  const cannon = config.shooter.cannon;
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.kind !== 'shooter') continue;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    if (enemy.wantsToFire && enemy.cooldown <= TIME_EPSILON && player.alive) {
      enemy.cooldown = cannon.cooldownSec;
      fire(ctx, enemy, 'enemy', 'enemyCannon', cannon, enemy.heading, 1, 0);
    }
  }
}

function fire(
  ctx: SimContext,
  ship: Ship,
  team: Team,
  weapon: WeaponSlot,
  cfg: WeaponConfig,
  direction: number,
  shots: number,
  spacing: number,
): void {
  const dirX = forwardX(direction);
  const dirY = forwardY(direction);
  // Parallel shots are spread along the hull (the ship's forward axis).
  const alongX = forwardX(ship.heading);
  const alongY = forwardY(ship.heading);
  const ids: number[] = [];
  for (let i = 0; i < shots; i++) {
    const along = (i - (shots - 1) / 2) * spacing;
    const x = ship.x + dirX * cfg.muzzleOffsetPx + alongX * along;
    const y = ship.y + dirY * cfg.muzzleOffsetPx + alongY * along;
    ids.push(spawnProjectile(ctx, ship.id, team, weapon, cfg, x, y, dirX, dirY));
  }
  ctx.emit('shotFired', {
    shooterId: ship.id,
    team,
    weapon,
    x: ship.x + dirX * cfg.muzzleOffsetPx,
    y: ship.y + dirY * cfg.muzzleOffsetPx,
    heading: direction,
    projectileIds: ids,
  });
}

function spawnProjectile(
  ctx: SimContext,
  ownerId: number,
  team: Team,
  weapon: WeaponSlot,
  cfg: WeaponConfig,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): number {
  // Reuse pooled objects to avoid garbage during long matches.
  const projectile: Projectile = ctx.projectilePool.pop() ?? createProjectile();
  projectile.id = nextId(ctx.state);
  projectile.alive = true;
  projectile.team = team;
  projectile.ownerId = ownerId;
  projectile.weapon = weapon;
  projectile.x = x;
  projectile.y = y;
  projectile.prevX = x;
  projectile.prevY = y;
  projectile.dirX = dirX;
  projectile.dirY = dirY;
  projectile.speed = cfg.projectileSpeed;
  projectile.damage = cfg.damage;
  projectile.radius = cfg.projectileRadius;
  projectile.traveled = 0;
  projectile.maxRange = cfg.rangePx;
  projectile.age = 0;
  projectile.lifetime = cfg.lifetimeSec;
  ctx.state.projectiles.push(projectile);
  return projectile.id;
}

function createProjectile(): Projectile {
  return {
    id: 0,
    alive: false,
    team: 'player',
    ownerId: 0,
    weapon: 'front',
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    dirX: 0,
    dirY: 0,
    speed: 0,
    damage: 0,
    radius: 0,
    traveled: 0,
    maxRange: 0,
    age: 0,
    lifetime: 0,
  };
}
