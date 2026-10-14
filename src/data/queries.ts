import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { matchesApi } from './api.ts';
import type { HistoryPage, MatchSettings, RankingPage } from './contracts.ts';
import { queryKeys } from './queryKeys.ts';

/**
 * Stale-response guard. TanStack Query already aborts superseded requests (key
 * change or `cancelRefetch`), but a response can still arrive after newer data
 * for the same key was cached (e.g. a slow refetch racing an invalidation). Each
 * page carries the server `revision`; an older revision never replaces newer data.
 */
export function keepNewest<T extends { revision: number }>(cached: T | undefined, fresh: T): T {
  return cached && cached.revision > fresh.revision ? cached : fresh;
}

function guarded<T extends { revision: number }>(
  client: QueryClient,
  key: QueryKey,
  fetcher: () => Promise<T>,
): Promise<T> {
  return fetcher().then((fresh) => keepNewest(client.getQueryData<T>(key), fresh));
}

/**
 * Ranking for one configuration (matches are only compared with the same
 * settings). Previous page data stays visible while the next page loads, and the
 * query refetches every time the tab is shown.
 */
export function useRankingQuery(settings: MatchSettings, page: number) {
  const client = useQueryClient();
  const key = queryKeys.ranking(settings, page);
  return useQuery<RankingPage>({
    queryKey: key,
    queryFn: ({ signal }) =>
      guarded(client, key, () => matchesApi.getRanking(settings, page, signal)),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/** Match history of the local player, most recent first. */
export function useHistoryQuery(playerId: string, page: number) {
  const client = useQueryClient();
  const key = queryKeys.history(playerId, page);
  return useQuery<HistoryPage>({
    queryKey: key,
    queryFn: ({ signal }) =>
      guarded(client, key, () => matchesApi.getHistory(playerId, page, signal)),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}
