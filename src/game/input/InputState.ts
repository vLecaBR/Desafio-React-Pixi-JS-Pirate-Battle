import { createIntents, type PlayerIntents } from '../core/types.ts';

export type InputSourceId = 'keyboard' | 'touch';

/**
 * Merges the intents of every input source (keyboard and touch can be used at the
 * same time). The simulation reads the merged intents once per fixed step.
 */
export class InputState {
  private readonly sources = new Map<InputSourceId, PlayerIntents>();
  private readonly merged = createIntents();

  set(source: InputSourceId, intents: Readonly<PlayerIntents>): void {
    let current = this.sources.get(source);
    if (!current) {
      current = createIntents();
      this.sources.set(source, current);
    }
    Object.assign(current, intents);
  }

  /** Merged intents (logical OR of every source). The object is reused. */
  read(): Readonly<PlayerIntents> {
    const merged = this.merged;
    Object.assign(merged, createIntents());
    for (const intents of this.sources.values()) {
      merged.forward ||= intents.forward;
      merged.turnLeft ||= intents.turnLeft;
      merged.turnRight ||= intents.turnRight;
      merged.fireFront ||= intents.fireFront;
      merged.fireLeft ||= intents.fireLeft;
      merged.fireRight ||= intents.fireRight;
    }
    return merged;
  }

  /** Releases every control of every source (pause, resume, focus loss). */
  clear(): void {
    for (const intents of this.sources.values()) Object.assign(intents, createIntents());
  }
}
