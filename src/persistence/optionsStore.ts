import { z } from 'zod';
import { create } from 'zustand';
import {
  DEFAULT_MATCH_OPTIONS,
  OPTION_LIMITS,
  type MatchOptions,
  type NumericLimit,
} from '../game/config/gameConfig.ts';
import { readStored, STORAGE_KEYS, writeStored } from './storage.ts';

function isOnStep(value: number, limit: NumericLimit): boolean {
  const steps = (value - limit.min) / limit.step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

function limitedNumber(limit: NumericLimit) {
  return z
    .number()
    .min(limit.min)
    .max(limit.max)
    .refine((value) => isOnStep(value, limit));
}

export const matchOptionsSchema = z.object({
  sessionTimeSec: limitedNumber(OPTION_LIMITS.sessionTimeSec),
  spawnIntervalSec: limitedNumber(OPTION_LIMITS.spawnIntervalSec),
});

/**
 * Validates one option typed by the player. Returns a user-facing error message,
 * or null when the value is valid.
 */
export function validateOption(field: keyof MatchOptions, raw: string): string | null {
  const limit = OPTION_LIMITS[field];
  const name = field === 'sessionTimeSec' ? 'Game session time' : 'Enemy spawn time';
  if (raw.trim() === '') return `${name} is required.`;
  const value = Number(raw);
  if (!Number.isFinite(value)) return `${name} must be a number.`;
  if (value < limit.min || value > limit.max) {
    return `${name} must be between ${limit.min} and ${limit.max} seconds.`;
  }
  if (!isOnStep(value, limit)) return `${name} must use steps of ${limit.step} seconds.`;
  return null;
}

function loadOptions(): MatchOptions {
  return readStored(STORAGE_KEYS.options, matchOptionsSchema) ?? DEFAULT_MATCH_OPTIONS;
}

interface OptionsState {
  readonly options: MatchOptions;
  save: (options: MatchOptions) => boolean;
}

/** Player options, persisted locally and validated on load (corrupted -> defaults). */
export const useOptionsStore = create<OptionsState>()((set) => ({
  options: loadOptions(),
  save: (options) => {
    const parsed = matchOptionsSchema.safeParse(options);
    if (!parsed.success) return false;
    writeStored(STORAGE_KEYS.options, parsed.data);
    set({ options: parsed.data });
    return true;
  },
}));
