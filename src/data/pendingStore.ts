import { z } from 'zod';
import { createStore } from 'zustand/vanilla';
import { readStored, STORAGE_KEYS, writeStored } from '../persistence/storage.ts';
import { matchRecordSchema, type MatchRecord } from './contracts.ts';

const pendingEntrySchema = z.object({
  record: matchRecordSchema,
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
});

export type PendingEntry = z.infer<typeof pendingEntrySchema>;

const pendingListSchema = z.array(pendingEntrySchema);

export interface PendingState {
  readonly entries: readonly PendingEntry[];
}

/**
 * Persistent queue of completed matches not yet confirmed by the server
 * (`pb.pending.v1`). A record is added *before* the first request and removed only
 * after a confirmed registration, so failures, timeouts and refreshes never lose a
 * match. Records keep their original `matchId`, which makes every resend
 * idempotent on the server.
 */
export function createPendingStore(load = true) {
  const store = createStore<PendingState>()(() => ({
    entries: load ? (readStored(STORAGE_KEYS.pending, pendingListSchema) ?? []) : [],
  }));

  const persist = (entries: readonly PendingEntry[]) => {
    writeStored(STORAGE_KEYS.pending, entries);
    store.setState({ entries });
  };

  return {
    store,
    get entries(): readonly PendingEntry[] {
      return store.getState().entries;
    },
    get(matchId: string): PendingEntry | undefined {
      return store.getState().entries.find((entry) => entry.record.matchId === matchId);
    },
    add(record: MatchRecord): void {
      if (this.get(record.matchId)) return;
      persist([
        ...store.getState().entries,
        { record, attempts: 0, lastError: null, lastAttemptAt: null },
      ]);
    },
    markFailed(matchId: string, error: string): void {
      persist(
        store.getState().entries.map((entry) =>
          entry.record.matchId === matchId
            ? {
                ...entry,
                attempts: entry.attempts + 1,
                lastError: error,
                lastAttemptAt: new Date().toISOString(),
              }
            : entry,
        ),
      );
    },
    remove(matchId: string): void {
      persist(store.getState().entries.filter((entry) => entry.record.matchId !== matchId));
    },
    clear(): void {
      persist([]);
    },
    /** Re-reads the persisted queue (e.g. after another tool changed storage). */
    reload(): void {
      store.setState({ entries: readStored(STORAGE_KEYS.pending, pendingListSchema) ?? [] });
    },
  };
}

export type PendingQueue = ReturnType<typeof createPendingStore>;
