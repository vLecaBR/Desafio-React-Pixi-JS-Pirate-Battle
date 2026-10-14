import { describe, expect, it } from 'vitest';
import { matchOptionsSchema, validateOption } from './optionsStore.ts';

describe('options validation', () => {
  it('accepts the documented limits and steps', () => {
    expect(validateOption('sessionTimeSec', '60')).toBeNull();
    expect(validateOption('sessionTimeSec', '180')).toBeNull();
    expect(validateOption('spawnIntervalSec', '1')).toBeNull();
    expect(validateOption('spawnIntervalSec', '10')).toBeNull();
    expect(validateOption('spawnIntervalSec', '2.5')).toBeNull();
  });

  it('rejects out-of-range, off-step, empty and non-numeric values with clear messages', () => {
    expect(validateOption('sessionTimeSec', '59')).toMatch(/between 60 and 180/);
    expect(validateOption('sessionTimeSec', '181')).toMatch(/between 60 and 180/);
    expect(validateOption('sessionTimeSec', '95')).toMatch(/steps of 10/);
    expect(validateOption('spawnIntervalSec', '0')).toMatch(/between 1 and 10/);
    expect(validateOption('spawnIntervalSec', '10.5')).toMatch(/between 1 and 10/);
    expect(validateOption('spawnIntervalSec', '1.25')).toMatch(/steps of 0.5/);
    expect(validateOption('spawnIntervalSec', '')).toMatch(/required/);
    expect(validateOption('spawnIntervalSec', 'abc')).toMatch(/number/);
  });

  it('validates persisted options and rejects corrupted data', () => {
    expect(
      matchOptionsSchema.safeParse({ sessionTimeSec: 90, spawnIntervalSec: 4.5 }).success,
    ).toBe(true);
    expect(
      matchOptionsSchema.safeParse({ sessionTimeSec: '90', spawnIntervalSec: 3 }).success,
    ).toBe(false);
    expect(matchOptionsSchema.safeParse({ sessionTimeSec: 500, spawnIntervalSec: 3 }).success).toBe(
      false,
    );
    expect(matchOptionsSchema.safeParse(null).success).toBe(false);
  });
});
