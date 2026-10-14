import type { MatchSettings } from './contracts.ts';

/**
 * Query key factory. Prefix keys (`['ranking']`, `['history']`) let a successful
 * registration invalidate every page and configuration at once.
 */
export const queryKeys = {
  rankingAll: ['ranking'] as const,
  ranking: (settings: MatchSettings, page: number) =>
    ['ranking', settings.sessionTimeSec, settings.spawnIntervalSec, page] as const,
  historyAll: ['history'] as const,
  history: (playerId: string, page: number) => ['history', playerId, page] as const,
};

export const mutationKeys = {
  registerMatch: ['registerMatch'] as const,
};
