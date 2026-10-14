import { createIntents, type PlayerIntents } from '../core/types.ts';
import type { InputState } from './InputState.ts';

type Intent = keyof PlayerIntents;

/** Keyboard layout (by physical key, so it works on any keyboard layout). */
export const KEY_BINDINGS: Readonly<Record<Intent, readonly string[]>> = {
  forward: ['KeyW', 'ArrowUp'],
  turnLeft: ['KeyA', 'ArrowLeft'],
  turnRight: ['KeyD', 'ArrowRight'],
  fireFront: ['Space', 'KeyK'],
  fireLeft: ['KeyQ', 'KeyJ'],
  fireRight: ['KeyE', 'KeyL'],
};

export const PAUSE_KEYS: readonly string[] = ['Escape', 'KeyP'];

const INTENT_BY_CODE = new Map<string, Intent>(
  (Object.entries(KEY_BINDINGS) as [Intent, readonly string[]][]).flatMap(([intent, codes]) =>
    codes.map((code) => [code, intent] as const),
  ),
);

/**
 * Keyboard controls. Listeners are attached only while the gameplay context is
 * active (`attach`/`detach`), and `preventDefault` is called only for game keys, so
 * the rest of the page keeps its normal keyboard behaviour.
 */
export class KeyboardInput {
  private readonly pressed = new Set<string>();
  private readonly intents = createIntents();
  private attached = false;

  constructor(
    private readonly input: InputState,
    private readonly onPause: () => void,
    private readonly target: Window = window,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    this.target.addEventListener('blur', this.handleBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.clear();
  }

  /** Forgets every held key (keys held during a pause must not carry over). */
  clear(): void {
    this.pressed.clear();
    this.publish();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (PAUSE_KEYS.includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) this.onPause();
      return;
    }
    if (!INTENT_BY_CODE.has(event.code)) return;
    event.preventDefault();
    this.pressed.add(event.code);
    this.publish();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (!INTENT_BY_CODE.has(event.code)) return;
    event.preventDefault();
    this.pressed.delete(event.code);
    this.publish();
  };

  private readonly handleBlur = (): void => {
    this.clear();
  };

  private publish(): void {
    Object.assign(this.intents, createIntents());
    for (const code of this.pressed) {
      const intent = INTENT_BY_CODE.get(code);
      if (intent) this.intents[intent] = true;
    }
    this.input.set('keyboard', this.intents);
  }
}
