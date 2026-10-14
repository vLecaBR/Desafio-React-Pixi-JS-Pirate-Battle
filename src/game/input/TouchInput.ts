import { createIntents, type PlayerIntents } from '../core/types.ts';
import type { InputState } from './InputState.ts';

export type TouchIntent = keyof PlayerIntents;

/**
 * Touch controls state. Each on-screen button reports press/release with its
 * pointer id, so several fingers can hold different controls at once (turn + sail
 * + fire). A control stays active while at least one pointer holds it.
 */
export class TouchInput {
  private readonly held = new Map<TouchIntent, Set<number>>();
  private readonly intents = createIntents();

  constructor(private readonly input: InputState) {}

  press(intent: TouchIntent, pointerId: number): void {
    let pointers = this.held.get(intent);
    if (!pointers) {
      pointers = new Set();
      this.held.set(intent, pointers);
    }
    pointers.add(pointerId);
    this.publish();
  }

  release(intent: TouchIntent, pointerId: number): void {
    this.held.get(intent)?.delete(pointerId);
    this.publish();
  }

  isHeld(intent: TouchIntent): boolean {
    return (this.held.get(intent)?.size ?? 0) > 0;
  }

  /** Releases every control (pause, resume, focus loss). */
  clear(): void {
    this.held.clear();
    this.publish();
  }

  private publish(): void {
    for (const key of Object.keys(this.intents) as TouchIntent[]) {
      this.intents[key] = this.isHeld(key);
    }
    this.input.set('touch', this.intents);
  }
}
