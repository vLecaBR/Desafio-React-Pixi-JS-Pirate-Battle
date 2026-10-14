import { create } from 'zustand';
import {
  createMatchConfig,
  DEFAULT_MATCH_OPTIONS,
  type GameConfig,
  type MatchOptions,
} from '../game/config/gameConfig.ts';
import type { MatchResult } from '../game/core/types.ts';
import { requestedSeed } from '../game/testing/testHooks.ts';

/**
 * Screen state machine (no router): a reload always lands on the menu, which also
 * ends any match in progress, as required.
 */
export type Screen = 'menu' | 'loading' | 'playing' | 'result';

export interface MatchSession {
  /** Changes on every new match ("Play again" remounts the game). */
  readonly key: number;
  /** Immutable configuration snapshot taken when the match starts. */
  readonly config: GameConfig;
  readonly seed: number;
}

interface ScreenState {
  readonly screen: Screen;
  readonly session: MatchSession | null;
  readonly lastResult: MatchResult | null;
  startMatch: (options?: MatchOptions) => void;
  assetsReady: () => void;
  finishMatch: (result: MatchResult) => void;
  goToMenu: () => void;
}

let matchCounter = 0;

function randomSeed(): number {
  if (requestedSeed !== null) return requestedSeed;
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now() >>> 0;
}

export const useScreenStore = create<ScreenState>()((set) => ({
  screen: 'menu',
  session: null,
  lastResult: null,
  startMatch: (options = DEFAULT_MATCH_OPTIONS) => {
    set({
      screen: 'loading',
      session: { key: ++matchCounter, config: createMatchConfig(options), seed: randomSeed() },
    });
  },
  assetsReady: () => {
    set((state) => (state.screen === 'loading' && state.session ? { screen: 'playing' } : state));
  },
  finishMatch: (result) => {
    set({ screen: 'result', lastResult: result });
  },
  goToMenu: () => {
    set({ screen: 'menu', session: null });
  },
}));
