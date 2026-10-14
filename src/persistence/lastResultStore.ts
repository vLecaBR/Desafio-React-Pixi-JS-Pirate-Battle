import { z } from 'zod';
import { create } from 'zustand';
import { readStored, STORAGE_KEYS, writeStored } from './storage.ts';

export const lastResultSchema = z.object({
  matchId: z.string().min(1),
  score: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  endReason: z.enum(['time_up', 'defeated']),
  playedAt: z.string(),
  settings: z.object({
    sessionTimeSec: z.number(),
    spawnIntervalSec: z.number(),
  }),
  /** True once the server confirmed the registration of this match. */
  registered: z.boolean(),
});

export type LastResult = z.infer<typeof lastResultSchema>;

interface LastResultState {
  readonly lastResult: LastResult | null;
  save: (result: LastResult) => void;
  markRegistered: (matchId: string) => void;
}

/** Result of the last completed match, persisted so it survives a refresh. */
export const useLastResultStore = create<LastResultState>()((set, get) => ({
  lastResult: readStored(STORAGE_KEYS.lastResult, lastResultSchema),
  save: (result) => {
    writeStored(STORAGE_KEYS.lastResult, result);
    set({ lastResult: result });
  },
  markRegistered: (matchId) => {
    const current = get().lastResult;
    if (current?.matchId !== matchId || current.registered) return;
    const next = { ...current, registered: true };
    writeStored(STORAGE_KEYS.lastResult, next);
    set({ lastResult: next });
  },
}));
