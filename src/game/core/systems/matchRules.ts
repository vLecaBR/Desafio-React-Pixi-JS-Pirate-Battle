import type { SimContext } from '../context.ts';

/**
 * Advances the match clock and ends the match when the player is destroyed or the
 * session time is over. Once ended, `Simulation.step()` stops running systems, so
 * movement, attacks, damage, spawns and scoring are all frozen. `matchEnded` is
 * emitted exactly once.
 */
export function matchRulesSystem(ctx: SimContext): void {
  const { state, config } = ctx;
  if (state.phase !== 'running') return;
  state.ticks++;

  const endReason = !state.player.alive
    ? 'defeated'
    : state.ticks >= state.totalTicks
      ? 'time_up'
      : null;
  if (!endReason) return;

  state.phase = 'ended';
  state.endReason = endReason;
  ctx.emit('matchEnded', {
    score: state.score,
    durationMs: Math.round(state.ticks * config.sim.fixedStepSec * 1000),
    endReason,
  });
}
