import type { z } from 'zod';

/**
 * Versioned, validated localStorage access. Every key carries its schema version
 * (e.g. `pb.options.v1`); values that are missing, corrupted or fail validation
 * fall back to defaults instead of crashing. Storage errors (private mode, quota,
 * disabled storage) are swallowed: persistence is best-effort.
 */
export function readStored<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort.
  }
}

/** Every key used by the app, documented in one place. */
export const STORAGE_KEYS = {
  options: 'pb.options.v1',
  lastResult: 'pb.lastResult.v1',
  audio: 'pb.audio.v1',
  player: 'pb.player.v1',
  pending: 'pb.pending.v1',
  mockDb: 'pb.mockdb.v1',
  mockScenario: 'pb.mock.scenario',
} as const;
