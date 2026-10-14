import { QueryClient } from '@tanstack/react-query';
import { Rng } from '../game/core/rng.ts';
import { isTestMode, requestedSeed } from '../game/testing/testHooks.ts';
import { isRetryable } from './apiError.ts';

/** Maximum automatic retries for transient failures (queries and registration). */
export const MAX_RETRIES = 2;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 4000;

/**
 * Exponential backoff with jitter. In test mode the jitter is seeded, so retry
 * timings are reproducible.
 */
export function createRetryDelay(random: () => number = Math.random) {
  return (attempt: number): number => {
    const exponential = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
    return Math.round(exponential / 2 + random() * (exponential / 2));
  };
}

export function retryPolicy(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_RETRIES && isRetryable(error);
}

export function createQueryClient(): QueryClient {
  const rng = isTestMode ? new Rng(requestedSeed ?? 1) : null;
  const retryDelay = createRetryDelay(rng ? () => rng.next() : Math.random);
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: retryPolicy,
        retryDelay,
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: retryPolicy,
        retryDelay,
      },
    },
  });
}

export const queryClient = createQueryClient();
