import { create } from 'zustand';
import { createMatchConfig, type GameConfig } from '../game/config/gameConfig.ts';
import type { MatchResult } from '../game/core/types.ts';
import { requestedSeed } from '../game/testing/testHooks.ts';
import { useLastResultStore } from '../persistence/lastResultStore.ts';
import { useOptionsStore } from '../persistence/optionsStore.ts';

/**
 * Screen state machine (no router): a reload always lands on the main menu, which
 * also ends any match in progress, as required.
 */
export type Screen = 'menu' | 'options' | 'log' | 'loading' | 'playing' | 'result';
export type LogTab = 'ranking' | 'history';

export interface MatchSession {
  /** Changes on every new match ("Play again" remounts the game). */
  readonly key: number;
  /** Immutable configuration snapshot taken when the match starts. */
  readonly config: GameConfig;
  readonly seed: number;
}

interface ScreenState {
  readonly screen: Screen;
  readonly logTab: LogTab;
  readonly session: MatchSession | null;
  startMatch: () => void;
  assetsReady: () => void;
  finishMatch: (result: MatchResult) => void;
  openOptions: () => void;
  openLog: (tab: LogTab) => void;
  setLogTab: (tab: LogTab) => void;
  showLastResult: () => void;
  goToMenu: () => void;
}

let matchCounter = 0;

function randomSeed(): number {
  if (requestedSeed !== null) return requestedSeed;
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now() >>> 0;
}

export const useScreenStore = create<ScreenState>()((set, get) => ({
  screen: 'menu',
  logTab: 'ranking',
  session: null,
  startMatch: () => {
    // Snapshot of the options in effect right now; later changes apply to new matches.
    const options = useOptionsStore.getState().options;
    set({
      screen: 'loading',
      session: { key: ++matchCounter, config: createMatchConfig(options), seed: randomSeed() },
    });
  },
  assetsReady: () => {
    set((state) => (state.screen === 'loading' && state.session ? { screen: 'playing' } : state));
  },
  finishMatch: (result) => {
    const session = get().session;
    if (!session) return;
    useLastResultStore.getState().save({
      ...result,
      playedAt: new Date().toISOString(),
      settings: {
        sessionTimeSec: session.config.match.sessionTimeSec,
        spawnIntervalSec: session.config.spawn.intervalSec,
      },
    });
    set({ screen: 'result' });
  },
  openOptions: () => {
    set({ screen: 'options' });
  },
  openLog: (tab) => {
    set({ screen: 'log', logTab: tab });
  },
  setLogTab: (tab) => {
    set({ logTab: tab });
  },
  showLastResult: () => {
    if (useLastResultStore.getState().lastResult) set({ screen: 'result' });
  },
  goToMenu: () => {
    set({ screen: 'menu', session: null });
  },
}));
