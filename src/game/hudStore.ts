import { createStore, type StoreApi } from 'zustand/vanilla';
import type { EndReason, MatchResult } from './core/types.ts';

export type HudPhase = 'starting' | 'running' | 'paused' | 'ended';

/**
 * Low-frequency match state for the React HUD. The game loop publishes here only
 * when a displayed value actually changes (hp, score, whole seconds, phase), so
 * React never re-renders on every frame.
 */
export interface HudState {
  readonly phase: HudPhase;
  readonly hp: number;
  readonly maxHp: number;
  readonly score: number;
  /** Remaining time in whole seconds (rounded up). */
  readonly remainingSec: number;
  readonly endReason: EndReason | null;
  readonly result: MatchResult | null;
}

export type HudStore = StoreApi<HudState>;

export function createHudStore(initial: Partial<HudState> = {}): HudStore {
  return createStore<HudState>()(() => ({
    phase: 'starting',
    hp: 0,
    maxHp: 0,
    score: 0,
    remainingSec: 0,
    endReason: null,
    result: null,
    ...initial,
  }));
}
