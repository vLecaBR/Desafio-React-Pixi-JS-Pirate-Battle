import { create } from 'zustand';
import type { MatchRecord } from '../data/contracts.ts';
import { getLocalPlayer } from '../data/player.ts';
import { registration } from '../data/services.ts';
import { createMatchConfig, type GameConfig } from '../game/config/gameConfig.ts';
import { requestedPreset } from '../game/config/presets.ts';
import type { SimulationSetup } from '../game/core/Simulation.ts';
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
  /** Initial state from a test/profiling preset, if any. */
  readonly setup?: SimulationSetup;
}

interface ScreenState {
  readonly screen: Screen;
  readonly logTab: LogTab;
  readonly session: MatchSession | null;
  startMatch: () => void;
  assetsReady: () => void;
  /** Records a completed match (last result + registration). Does not change screen. */
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
    const preset = requestedPreset();
    set({
      screen: 'loading',
      session: {
        key: ++matchCounter,
        config: createMatchConfig(options, preset?.overrides ?? {}),
        seed: randomSeed(),
        ...(preset?.setup ? { setup: preset.setup } : {}),
      },
    });
  },
  assetsReady: () => {
    set((state) => (state.screen === 'loading' && state.session ? { screen: 'playing' } : state));
  },
  finishMatch: (result) => {
    const session = get().session;
    if (!session) return;
    const player = getLocalPlayer();
    // The match id is created once, when the match ends: it is the idempotency key
    // of every (re)send of this record.
    const record: MatchRecord = {
      matchId: crypto.randomUUID(),
      playerId: player.playerId,
      playerName: player.playerName,
      playedAt: new Date().toISOString(),
      score: result.score,
      durationMs: result.durationMs,
      endReason: result.endReason,
      settings: {
        sessionTimeSec: session.config.match.sessionTimeSec,
        spawnIntervalSec: session.config.spawn.intervalSec,
      },
    };
    useLastResultStore.getState().save({
      matchId: record.matchId,
      score: record.score,
      durationMs: record.durationMs,
      endReason: record.endReason,
      playedAt: record.playedAt,
      settings: record.settings,
      registered: false,
    });
    // Queued and sent in the background; never blocks Play again / Main menu.
    void registration.submit(record);
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
