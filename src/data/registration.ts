import { MutationObserver, type QueryClient } from '@tanstack/react-query';
import { createStore } from 'zustand/vanilla';
import type { MatchesApi } from './api.ts';
import { describeApiError } from './apiError.ts';
import type { MatchRecord, RegisterResponse } from './contracts.ts';
import type { PendingQueue } from './pendingStore.ts';
import { mutationKeys, queryKeys } from './queryKeys.ts';

export type RegistrationStatus = 'saving' | 'saved' | 'pending';

interface RegistrationState {
  /** Match ids with a request in flight. */
  readonly saving: ReadonlySet<string>;
  /** Match ids confirmed by the server during this session. */
  readonly saved: ReadonlySet<string>;
}

interface RegistrationDeps {
  readonly queryClient: QueryClient;
  readonly api: MatchesApi;
  readonly pending: PendingQueue;
  /** Called once the server confirms a record (created or already existing). */
  readonly onSaved?: (record: MatchRecord) => void;
}

/**
 * Registers completed matches through a TanStack Query mutation
 * (`['registerMatch']`), outside the React tree so it keeps running while the
 * player navigates or starts another match.
 *
 * Guarantees:
 * - The record is queued (persisted) before the first request; it is removed only
 *   after the server confirms it, so failures and refreshes never lose it.
 * - The `matchId` generated at the end of the match is the idempotency key: a
 *   resend after a timeout gets the existing record (200) instead of a duplicate.
 * - At most one request per match is in flight (repeated Retry clicks reuse it).
 * - On success, every ranking and history query is invalidated, so both tabs show
 *   the new record.
 */
export function createRegistrationService({
  queryClient,
  api,
  pending,
  onSaved,
}: RegistrationDeps) {
  const state = createStore<RegistrationState>()(() => ({
    saving: new Set<string>(),
    saved: new Set<string>(),
  }));
  const inflight = new Map<string, Promise<boolean>>();

  const update = (matchId: string, change: 'start' | 'saved' | 'failed') => {
    const { saving, saved } = state.getState();
    const nextSaving = new Set(saving);
    nextSaving.delete(matchId);
    if (change === 'start') nextSaving.add(matchId);
    const nextSaved = new Set(saved);
    if (change === 'saved') nextSaved.add(matchId);
    state.setState({ saving: nextSaving, saved: nextSaved });
  };

  const send = async (record: MatchRecord): Promise<boolean> => {
    const observer = new MutationObserver<RegisterResponse, unknown, MatchRecord>(queryClient, {
      mutationKey: mutationKeys.registerMatch,
      mutationFn: (variables) => api.registerMatch(variables),
    });
    update(record.matchId, 'start');
    try {
      const response = await observer.mutate(record);
      pending.remove(record.matchId);
      update(record.matchId, 'saved');
      onSaved?.(response.record);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.rankingAll }),
        queryClient.invalidateQueries({ queryKey: queryKeys.historyAll }),
      ]);
      return true;
    } catch (error) {
      pending.markFailed(record.matchId, describeApiError(error));
      update(record.matchId, 'failed');
      return false;
    } finally {
      observer.reset();
    }
  };

  const submit = (record: MatchRecord): Promise<boolean> => {
    const running = inflight.get(record.matchId);
    if (running) return running;
    pending.add(record);
    const promise = send(record).finally(() => {
      inflight.delete(record.matchId);
    });
    inflight.set(record.matchId, promise);
    return promise;
  };

  return {
    state,
    submit,
    /** Re-sends every queued record (boot, back online, Captain's Log, Retry). */
    flush(): Promise<boolean[]> {
      return Promise.all(pending.entries.map((entry) => submit(entry.record)));
    },
    /** Retries one queued match. */
    retry(matchId: string): Promise<boolean> {
      const entry = pending.get(matchId);
      return entry ? submit(entry.record) : Promise.resolve(false);
    },
    statusOf(matchId: string, confirmed: boolean): RegistrationStatus | null {
      if (state.getState().saving.has(matchId)) return 'saving';
      if (pending.get(matchId)) return 'pending';
      if (confirmed || state.getState().saved.has(matchId)) return 'saved';
      return null;
    },
    isInFlight(matchId: string): boolean {
      return inflight.has(matchId);
    },
  };
}

export type RegistrationService = ReturnType<typeof createRegistrationService>;
