import type { SimContext } from '../context.ts';
import { circleCirclePush, type MutableVec2 } from '../math.ts';
import type { Ship } from '../types.ts';
import {
  HULL_CIRCLES,
  hullCircleX,
  hullCircleY,
  resolveShipAgainstStatics,
  shipsTouch,
} from './hull.ts';

/** Extra reach so a Chaser pressed against the player always registers contact. */
const CONTACT_SLOP_PX = 2;

const push: MutableVec2 = { x: 0, y: 0 };

/**
 * Ship-vs-ship interactions:
 * 1. Chaser ramming: queues contact damage for the player and the Chaser explodes
 *    (destroyed by itself, so it never awards points). It is disabled immediately,
 *    so the contact damage happens exactly once.
 * 2. Separation: overlapping hulls are pushed apart, then re-resolved against statics.
 */
export function collisionsSystem(ctx: SimContext): void {
  const { state, config } = ctx;
  const { player, enemies } = state;

  if (player.alive) {
    for (const enemy of enemies) {
      if (!enemy.alive || enemy.kind !== 'chaser' || enemy.graceSec > 0) continue;
      if (!shipsTouch(enemy, player, CONTACT_SLOP_PX)) continue;
      enemy.alive = false;
      ctx.damageQueue.push({
        targetId: player.id,
        amount: config.chaser.contactDamage,
        source: 'contact',
        byPlayer: false,
      });
      ctx.emit('enemyDestroyed', {
        enemyId: enemy.id,
        kind: enemy.kind,
        killedBy: 'self',
        x: enemy.x,
        y: enemy.y,
        heading: enemy.heading,
      });
    }
  }

  const iterations = config.sim.collisionIterations;
  for (let iteration = 0; iteration < iterations; iteration++) {
    let separated = false;
    if (player.alive) {
      for (const enemy of enemies) {
        if (enemy.alive && separate(player, enemy)) separated = true;
      }
    }
    for (let i = 0; i < enemies.length; i++) {
      const a = enemies[i];
      if (!a?.alive) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const b = enemies[j];
        if (b?.alive && separate(a, b)) separated = true;
      }
    }
    if (!separated) break;
    if (player.alive) resolveShipAgainstStatics(player, ctx.grid, iterations);
    for (const enemy of enemies) {
      if (enemy.alive) resolveShipAgainstStatics(enemy, ctx.grid, iterations);
    }
  }
}

/** Pushes two overlapping ships apart by half the penetration each. */
function separate(a: Ship, b: Ship): boolean {
  let moved = false;
  for (const i of HULL_CIRCLES) {
    for (const j of HULL_CIRCLES) {
      const hit = circleCirclePush(
        hullCircleX(a, i),
        hullCircleY(a, i),
        a.radius,
        hullCircleX(b, j),
        hullCircleY(b, j),
        b.radius,
        push,
      );
      if (!hit) continue;
      a.x += push.x / 2;
      a.y += push.y / 2;
      b.x -= push.x / 2;
      b.y -= push.y / 2;
      moved = true;
    }
  }
  return moved;
}
