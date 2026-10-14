import { expect, type Page } from '@playwright/test';
import type { TestStateSnapshot } from '../../src/game/testing/testHooks.ts';

export type GameState = TestStateSnapshot;

interface LabActions {
  resetMockData(): void;
  clearPendingQueue(): void;
  resetEverything(): void;
  setScenario(id: string): void;
  dbStats(): { records: number; revision: number };
  countRecords(matchId: string): number;
}

/** Current simulation snapshot (throws if no match is running). */
export async function state(page: Page): Promise<GameState> {
  const snapshot = await page.evaluate(() => window.__PB__?.state() ?? null);
  if (!snapshot) throw new Error('No match is running');
  return snapshot;
}

/**
 * Advances the simulation by real fixed steps (test clock). Respects pause and the
 * end of the match, exactly like real time would.
 */
export async function advance(page: Page, ms: number): Promise<void> {
  await page.evaluate((duration) => window.__PB__?.advance(duration), ms);
}

/** Clicks Play and waits for the match to be running. */
export async function startMatch(page: Page): Promise<GameState> {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => window.__PB__?.state()?.phase === 'running', undefined, {
    timeout: 20_000,
  });
  return state(page);
}

/** Holds real keyboard keys while the simulation advances, then releases them. */
export async function holdKeys(page: Page, keys: readonly string[], ms: number): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  await advance(page, ms);
  for (const key of keys) await page.keyboard.up(key);
}

/** Taps a key and lets one step run so the simulation reads it. */
export async function tapKey(page: Page, key: string, ms = 50): Promise<void> {
  await page.keyboard.down(key);
  await advance(page, ms);
  await page.keyboard.up(key);
}

/** Number of stored registrations for a match in the mocked server (duplicate check). */
export async function countRecords(page: Page, matchId: string): Promise<number> {
  return page.evaluate((id) => (window.__PB_LAB__ as LabActions).countRecords(id), matchId);
}

/** Switches the mocked network scenario (e.g. the server recovers). */
export async function setScenario(page: Page, scenario: string): Promise<void> {
  await page.evaluate((id) => {
    (window.__PB_LAB__ as LabActions).setScenario(id);
  }, scenario);
}

/** Size and revision of the mocked server database. */
export async function dbStats(page: Page): Promise<{ records: number; revision: number }> {
  return page.evaluate(() => (window.__PB_LAB__ as LabActions).dbStats());
}

export async function lastMatchId(page: Page): Promise<string> {
  const id = await page.evaluate(() => {
    const raw = window.localStorage.getItem('pb.lastResult.v1');
    return raw ? (JSON.parse(raw) as { matchId: string }).matchId : null;
  });
  expect(id).not.toBeNull();
  return id ?? '';
}

/** Changes the network scenario through the Network Lab dialog (real UI). */
export async function selectScenario(page: Page, scenario: string): Promise<void> {
  await page.getByRole('button', { name: 'Network lab' }).click();
  const dialog = page.getByRole('dialog', { name: 'Network lab' });
  await dialog.getByLabel('Scenario').selectOption(scenario);
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
}

/** Sets both options through the Options screen and returns to the menu. */
export async function setOptions(
  page: Page,
  sessionTimeSec: number,
  spawnIntervalSec: number,
): Promise<void> {
  await page.getByRole('button', { name: 'Options' }).click();
  await page.getByRole('spinbutton', { name: 'Game session time' }).fill(String(sessionTimeSec));
  await page.getByRole('spinbutton', { name: 'Enemy spawn time' }).fill(String(spawnIntervalSec));
  const save = page.getByRole('button', { name: 'Save' });
  if (await save.isEnabled()) {
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Options saved.' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Main menu' }).click();
}

/**
 * Advances and reads the state in one page task. The result screen replaces the
 * game 1.2 s (real time) after the match ends, so reads after the end must not be
 * split across several round trips.
 */
export async function advanceAndState(page: Page, ms: number): Promise<GameState> {
  const snapshot = await page.evaluate((duration) => {
    window.__PB__?.advance(duration);
    return window.__PB__?.state() ?? null;
  }, ms);
  if (!snapshot) throw new Error('No match is running');
  return snapshot;
}

/** Reads the state, advances, and reads it again — atomically (see above). */
export async function stateAroundAdvance(page: Page, ms: number): Promise<[GameState, GameState]> {
  const snapshots = await page.evaluate((duration) => {
    const before = window.__PB__?.state() ?? null;
    window.__PB__?.advance(duration);
    return [before, window.__PB__?.state() ?? null] as const;
  }, ms);
  const [before, after] = snapshots;
  if (!before || !after) throw new Error('No match is running');
  return [before, after];
}

/** Ends the running match by letting the preset's Chaser sink the player (`low-health`). */
export async function finishByDefeat(page: Page): Promise<GameState> {
  const final = await page.evaluate(() => {
    for (let i = 0; i < 40; i++) {
      const current = window.__PB__?.state() ?? null;
      if (!current || current.phase === 'ended') return current;
      window.__PB__?.advance(500);
    }
    return window.__PB__?.state() ?? null;
  });
  expect(final?.phase).toBe('ended');
  if (!final) throw new Error('No match is running');
  return final;
}

/**
 * Finishes the match by defeat, then keeps advancing while holding a fire key, and
 * returns the state at the end and after — all in one page task (see above).
 */
export async function defeatThenAdvance(
  page: Page,
  ms: number,
  heldCode: string,
): Promise<[GameState, GameState]> {
  const snapshots = await page.evaluate(
    ([duration, code]) => {
      for (let i = 0; i < 40; i++) {
        const current = window.__PB__?.state();
        if (!current || current.phase === 'ended') break;
        window.__PB__?.advance(500);
      }
      const ended = window.__PB__?.state() ?? null;
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
      window.__PB__?.advance(duration);
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      return [ended, window.__PB__?.state() ?? null] as const;
    },
    [ms, heldCode] as const,
  );
  const [ended, later] = snapshots;
  if (!ended || !later) throw new Error('No match is running');
  return [ended, later];
}
