import type { SimContext } from '../context.ts';

/** Translates the boolean intents into the player's steering for this step. */
export function inputSystem(ctx: SimContext): void {
  const { player } = ctx.state;
  if (!player.alive) return;
  const { intents } = ctx;
  player.turnInput = (intents.turnRight ? 1 : 0) - (intents.turnLeft ? 1 : 0);
  player.throttle = intents.forward ? 1 : 0;
}
