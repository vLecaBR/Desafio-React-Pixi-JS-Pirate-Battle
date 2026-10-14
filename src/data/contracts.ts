import { z } from 'zod';

/**
 * Typed contracts of the ranking and match-history REST API, shared by the client
 * (Axios + TanStack Query) and the MSW mocks. Every response is validated with
 * these schemas, so a malformed payload becomes a handled "contract" error.
 */

export const endReasonSchema = z.enum(['time_up', 'defeated']);
export type EndReason = z.infer<typeof endReasonSchema>;

export const matchSettingsSchema = z.object({
  sessionTimeSec: z.number().int().positive(),
  spawnIntervalSec: z.number().positive(),
});
export type MatchSettings = z.infer<typeof matchSettingsSchema>;

export const matchRecordSchema = z.object({
  /** Generated when the match ends; also the idempotency key of the registration. */
  matchId: z.string().min(1),
  playerId: z.string().min(1),
  playerName: z.string().min(1).max(40),
  /** ISO timestamp of the end of the match. */
  playedAt: z.iso.datetime(),
  score: z.number().int().nonnegative(),
  /** Effective active time, pauses excluded. */
  durationMs: z.number().int().nonnegative(),
  endReason: endReasonSchema,
  settings: matchSettingsSchema,
});
export type MatchRecord = z.infer<typeof matchRecordSchema>;

export const rankingEntrySchema = matchRecordSchema.extend({
  rank: z.number().int().positive(),
});
export type RankingEntry = z.infer<typeof rankingEntrySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    /** Server data version, incremented on every write (stale-response guard). */
    revision: z.number().int().nonnegative(),
  });
}

export const rankingPageSchema = pageSchema(rankingEntrySchema);
export const historyPageSchema = pageSchema(matchRecordSchema);
export type RankingPage = z.infer<typeof rankingPageSchema>;
export type HistoryPage = z.infer<typeof historyPageSchema>;

export const registerResponseSchema = z.object({
  record: matchRecordSchema,
  /** false when the match was already registered (idempotent replay). */
  created: z.boolean(),
});
export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export const PAGE_SIZE = 5;

/** REST routes (relative to the API base URL). */
export const API_ROUTES = {
  ranking: '/ranking',
  matches: '/matches',
  playerMatches: (playerId: string) => `/players/${encodeURIComponent(playerId)}/matches`,
  /** Route pattern of `playerMatches` (path parameter syntax used by the mocks). */
  playerMatchesPattern: '/players/:playerId/matches',
} as const;

export const API_BASE_URL = '/api';
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Deterministic ranking order (documented tie-break):
 * score desc -> durationMs desc -> playedAt asc -> matchId asc.
 * A longer survival wins a tie, then the earliest achievement, then a stable id.
 */
export function compareRanking(a: MatchRecord, b: MatchRecord): number {
  return (
    b.score - a.score ||
    b.durationMs - a.durationMs ||
    a.playedAt.localeCompare(b.playedAt) ||
    a.matchId.localeCompare(b.matchId)
  );
}

export function sameSettings(a: MatchSettings, b: MatchSettings): boolean {
  return a.sessionTimeSec === b.sessionTimeSec && a.spawnIntervalSec === b.spawnIntervalSec;
}
