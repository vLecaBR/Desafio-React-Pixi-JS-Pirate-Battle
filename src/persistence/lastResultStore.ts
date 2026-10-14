import { z } from 'zod';
import { create } from 'zustand';
import { readStored, STORAGE_KEYS, writeStored } from './storage.ts';

export const lastResultSchema = z.object({
  score: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  endReason: z.enum(['time_up', 'defeated']),
  playedAt: z.string(),
  settings: z.object({
    sessionTimeSec: z.number(),
    spawnIntervalSec: z.number(),
  }),
});

export type LastResult = z.infer<typeof lastResultSchema>;

interface LastResultState {
  readonly lastResult: LastResult | null;
  save: (result: LastResult) => void;
}

/** Result of the last completed match, persisted so it survives a refresh. */
export const useLastResultStore = create<LastResultState>()((set) => ({
  lastResult: readStored(STORAGE_KEYS.lastResult, lastResultSchema),
  save: (result) => {
    writeStored(STORAGE_KEYS.lastResult, result);
    set({ lastResult: result });
  },
}));
