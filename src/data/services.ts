import { useStore } from 'zustand';
import { useLastResultStore } from '../persistence/lastResultStore.ts';
import { matchesApi } from './api.ts';
import type { MatchRecord } from './contracts.ts';
import { createPendingStore } from './pendingStore.ts';
import { queryClient } from './queryClient.ts';
import { createRegistrationService, type RegistrationStatus } from './registration.ts';

/** App-wide data singletons (one query client, one pending queue, one registrar). */
export const pendingQueue = createPendingStore();

export const registration = createRegistrationService({
  queryClient,
  api: matchesApi,
  pending: pendingQueue,
  onSaved: (record: MatchRecord) => {
    useLastResultStore.getState().markRegistered(record.matchId);
  },
});

let syncInstalled = false;

/**
 * Re-sends queued registrations now and whenever the browser comes back online.
 * Failures are kept in the queue and never block the game.
 */
export function startBackgroundSync(): void {
  if (syncInstalled) return;
  syncInstalled = true;
  window.addEventListener('online', () => {
    void registration.flush();
  });
  void registration.flush();
}

export function usePendingEntries() {
  return useStore(pendingQueue.store, (state) => state.entries);
}

/** Registration status of one match, for the result screen. */
export function useRegistrationStatus(
  matchId: string | null,
  confirmed: boolean,
): RegistrationStatus | null {
  const saving = useStore(registration.state, (state) =>
    matchId ? state.saving.has(matchId) : false,
  );
  const savedThisSession = useStore(registration.state, (state) =>
    matchId ? state.saved.has(matchId) : false,
  );
  const queued = useStore(pendingQueue.store, (state) =>
    matchId ? state.entries.some((entry) => entry.record.matchId === matchId) : false,
  );
  if (!matchId) return null;
  if (saving) return 'saving';
  if (queued) return 'pending';
  if (confirmed || savedThisSession) return 'saved';
  return null;
}
