import type { AxiosInstance } from 'axios';
import {
  API_ROUTES,
  historyPageSchema,
  IDEMPOTENCY_HEADER,
  PAGE_SIZE,
  rankingPageSchema,
  registerResponseSchema,
  type HistoryPage,
  type MatchRecord,
  type MatchSettings,
  type RankingPage,
  type RegisterResponse,
} from './contracts.ts';
import { httpClient, parseResponse } from './httpClient.ts';

/** Ranking/history API. Every call forwards the TanStack Query abort signal. */
export interface MatchesApi {
  getRanking(settings: MatchSettings, page: number, signal?: AbortSignal): Promise<RankingPage>;
  getHistory(playerId: string, page: number, signal?: AbortSignal): Promise<HistoryPage>;
  /** Idempotent: replaying the same `matchId` returns the existing record. */
  registerMatch(record: MatchRecord, signal?: AbortSignal): Promise<RegisterResponse>;
}

export function createMatchesApi(client: AxiosInstance): MatchesApi {
  return {
    async getRanking(settings, page, signal) {
      const response = await client.get<unknown>(API_ROUTES.ranking, {
        params: {
          sessionTimeSec: settings.sessionTimeSec,
          spawnIntervalSec: settings.spawnIntervalSec,
          page,
          pageSize: PAGE_SIZE,
        },
        ...(signal ? { signal } : {}),
      });
      return parseResponse(rankingPageSchema, response.data);
    },

    async getHistory(playerId, page, signal) {
      const response = await client.get<unknown>(API_ROUTES.playerMatches(playerId), {
        params: { page, pageSize: PAGE_SIZE },
        ...(signal ? { signal } : {}),
      });
      return parseResponse(historyPageSchema, response.data);
    },

    async registerMatch(record, signal) {
      const response = await client.post<unknown>(API_ROUTES.matches, record, {
        headers: { [IDEMPOTENCY_HEADER]: record.matchId },
        ...(signal ? { signal } : {}),
      });
      return parseResponse(registerResponseSchema, response.data);
    },
  };
}

export const matchesApi = createMatchesApi(httpClient);
