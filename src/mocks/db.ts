import { z } from 'zod';
import {
  compareRanking,
  matchRecordSchema,
  sameSettings,
  type HistoryPage,
  type MatchRecord,
  type MatchSettings,
  type RankingPage,
} from '../data/contracts.ts';
import { readStored, STORAGE_KEYS, writeStored } from '../persistence/storage.ts';
import { createFixtures } from './fixtures.ts';

const dbSchema = z.object({
  revision: z.number().int().nonnegative(),
  matches: z.array(matchRecordSchema),
});

type DbState = z.infer<typeof dbSchema>;

/**
 * In-browser "server" database for the mocked API, persisted in localStorage
 * (`pb.mockdb.v1`) so confirmed registrations survive a refresh. It starts from the
 * deterministic fixtures; `reset()` restores them. `revision` increases on every
 * write and is returned with every page (stale-response guard on the client).
 */
export class MockDb {
  private state: DbState;

  constructor(private readonly persist = true) {
    this.state = (persist ? readStored(STORAGE_KEYS.mockDb, dbSchema) : null) ?? initialState();
    this.save();
  }

  get revision(): number {
    return this.state.revision;
  }

  get size(): number {
    return this.state.matches.length;
  }

  /** How many stored records use this id (always 0 or 1 thanks to idempotency). */
  count(matchId: string): number {
    return this.state.matches.filter((match) => match.matchId === matchId).length;
  }

  find(matchId: string): MatchRecord | undefined {
    return this.state.matches.find((match) => match.matchId === matchId);
  }

  /** Idempotent insert: an existing `matchId` returns the stored record unchanged. */
  insert(record: MatchRecord): { record: MatchRecord; created: boolean } {
    const existing = this.find(record.matchId);
    if (existing) return { record: existing, created: false };
    this.state = { revision: this.state.revision + 1, matches: [...this.state.matches, record] };
    this.save();
    return { record, created: true };
  }

  ranking(
    settings: MatchSettings,
    page: number,
    pageSize: number,
    extra: readonly MatchRecord[] = [],
  ): RankingPage {
    const sorted = [...this.state.matches, ...extra]
      .filter((match) => sameSettings(match.settings, settings))
      .sort(compareRanking)
      .map((match, index) => ({ ...match, rank: index + 1 }));
    return paginate(sorted, page, pageSize, this.state.revision);
  }

  history(
    playerId: string,
    page: number,
    pageSize: number,
    extra: readonly MatchRecord[] = [],
  ): HistoryPage {
    const sorted = [...this.state.matches, ...extra]
      .filter((match) => match.playerId === playerId)
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt) || a.matchId.localeCompare(b.matchId));
    return paginate(sorted, page, pageSize, this.state.revision);
  }

  /** Restores the fixtures (keeps the revision increasing so caches refresh). */
  reset(): void {
    this.state = { revision: this.state.revision + 1, matches: createFixtures() };
    this.save();
  }

  private save(): void {
    if (this.persist) writeStored(STORAGE_KEYS.mockDb, this.state);
  }
}

function initialState(): DbState {
  return { revision: 1, matches: createFixtures() };
}

function paginate<T>(items: readonly T[], page: number, pageSize: number, revision: number) {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages,
    revision,
  };
}
