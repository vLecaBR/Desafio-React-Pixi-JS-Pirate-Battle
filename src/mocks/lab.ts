import { getLocalPlayer, resetLocalPlayerCache } from '../data/player.ts';
import { queryClient } from '../data/queryClient.ts';
import { pendingQueue } from '../data/services.ts';
import { DEFAULT_MATCH_OPTIONS } from '../game/config/gameConfig.ts';
import { useLastResultStore } from '../persistence/lastResultStore.ts';
import { useOptionsStore } from '../persistence/optionsStore.ts';
import { removeStored, STORAGE_KEYS } from '../persistence/storage.ts';
import { mockDb } from './browser.ts';
import { isScenarioId, setScenario, setScenarioSeed } from './scenarios.ts';

/**
 * Reset actions of the Network Lab (also exposed to end-to-end tests). Every
 * action also drops the query cache, so the next read reflects the new state.
 */
export const labActions = {
  /** Restores the mock database to its fixtures. */
  resetMockData(): void {
    mockDb.reset();
    queryClient.clear();
  },

  /** Drops every registration waiting to be sent. */
  clearPendingQueue(): void {
    pendingQueue.clear();
  },

  /**
   * Back to a pristine state: fixtures, empty pending queue, `success` scenario,
   * default options, no last result and a new local player identity.
   */
  resetEverything(): void {
    mockDb.reset();
    pendingQueue.clear();
    setScenario('success');
    setScenarioSeed(1);
    useOptionsStore.getState().save(DEFAULT_MATCH_OPTIONS);
    removeStored(STORAGE_KEYS.lastResult);
    useLastResultStore.setState({ lastResult: null });
    removeStored(STORAGE_KEYS.player);
    resetLocalPlayerCache();
    getLocalPlayer();
    queryClient.clear();
  },

  /** Switches the active network scenario (same as the Network Lab select). */
  setScenario(id: string): void {
    if (!isScenarioId(id)) throw new Error(`Unknown scenario: ${id}`);
    setScenario(id);
  },

  dbStats(): { records: number; revision: number } {
    return { records: mockDb.size, revision: mockDb.revision };
  },

  /** Number of stored registrations for a match id (duplicate detection in tests). */
  countRecords(matchId: string): number {
    return mockDb.count(matchId);
  },
};
