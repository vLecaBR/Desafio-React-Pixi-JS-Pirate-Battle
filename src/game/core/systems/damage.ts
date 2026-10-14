import type { SimContext } from '../context.ts';
import type { Ship } from '../types.ts';

/**
 * Applies the damage queued during this step, in order. Damage against a ship that
 * is already destroyed is discarded. Enemies destroyed by the player's weapons award
 * one point each while the match is running.
 */
export function damageSystem(ctx: SimContext): void {
  const { state, damageQueue } = ctx;
  for (const entry of damageQueue) {
    const target = findShip(ctx, entry.targetId);
    if (!target?.alive || entry.amount <= 0) continue;

    target.hp = Math.max(0, target.hp - entry.amount);
    ctx.emit('shipDamaged', {
      shipId: target.id,
      kind: target.kind,
      amount: entry.amount,
      hp: target.hp,
      maxHp: target.maxHp,
      source: entry.source,
      x: target.x,
      y: target.y,
    });
    if (target.hp > 0) continue;

    target.alive = false;
    if (target.kind === 'player') {
      ctx.emit('playerDestroyed', { x: target.x, y: target.y, heading: target.heading });
      continue;
    }
    ctx.emit('enemyDestroyed', {
      enemyId: target.id,
      kind: target.kind,
      killedBy: entry.byPlayer ? 'player' : 'self',
      x: target.x,
      y: target.y,
      heading: target.heading,
    });
    if (entry.byPlayer && state.phase === 'running') {
      state.score += 1;
      ctx.emit('scoreChanged', { score: state.score });
    }
  }
  damageQueue.length = 0;
}

function findShip(ctx: SimContext, id: number): Ship | undefined {
  const { player, enemies } = ctx.state;
  if (player.id === id) return player;
  return enemies.find((enemy) => enemy.id === id);
}
