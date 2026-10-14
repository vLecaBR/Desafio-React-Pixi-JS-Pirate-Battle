import { describe, expect, it, vi } from 'vitest';
import { InputState } from './InputState.ts';
import { KeyboardInput } from './KeyboardInput.ts';
import { TouchInput } from './TouchInput.ts';

/** Minimal KeyboardEvent stand-in (Node has EventTarget but no KeyboardEvent). */
function keyEvent(type: 'keydown' | 'keyup', code: string, repeat = false) {
  const event = new Event(type, { cancelable: true });
  return Object.assign(event, { code, repeat, altKey: false, ctrlKey: false, metaKey: false });
}

function createKeyboard() {
  const target = new EventTarget();
  const input = new InputState();
  const onPause = vi.fn();
  const keyboard = new KeyboardInput(input, onPause, target as unknown as Window);
  return { target, input, onPause, keyboard };
}

describe('InputState', () => {
  it('merges keyboard and touch sources with a logical OR', () => {
    const input = new InputState();
    input.set('keyboard', { ...input.read(), forward: true });
    input.set('touch', { ...input.read(), forward: false, fireFront: true });
    expect(input.read()).toMatchObject({ forward: true, fireFront: true, turnLeft: false });
    input.clear();
    expect(Object.values(input.read()).some(Boolean)).toBe(false);
  });
});

describe('TouchInput', () => {
  it('supports several fingers and keeps a control held until its last pointer lifts', () => {
    const input = new InputState();
    const touch = new TouchInput(input);
    touch.press('turnLeft', 1);
    touch.press('forward', 2);
    touch.press('fireFront', 3);
    expect(input.read()).toMatchObject({ turnLeft: true, forward: true, fireFront: true });

    touch.press('forward', 4);
    touch.release('forward', 2);
    expect(input.read().forward).toBe(true);
    touch.release('forward', 4);
    expect(input.read().forward).toBe(false);

    touch.clear();
    expect(Object.values(input.read()).some(Boolean)).toBe(false);
  });
});

describe('KeyboardInput', () => {
  it('maps physical keys to intents only while attached', () => {
    const { target, input, keyboard } = createKeyboard();
    target.dispatchEvent(keyEvent('keydown', 'KeyW'));
    expect(input.read().forward).toBe(false); // not attached yet

    keyboard.attach();
    const down = keyEvent('keydown', 'KeyW');
    target.dispatchEvent(down);
    target.dispatchEvent(keyEvent('keydown', 'ArrowLeft'));
    target.dispatchEvent(keyEvent('keydown', 'KeyE'));
    expect(down.defaultPrevented).toBe(true);
    expect(input.read()).toMatchObject({ forward: true, turnLeft: true, fireRight: true });

    target.dispatchEvent(keyEvent('keyup', 'KeyW'));
    expect(input.read().forward).toBe(false);

    keyboard.detach();
    expect(Object.values(input.read()).some(Boolean)).toBe(false);
    target.dispatchEvent(keyEvent('keydown', 'KeyW'));
    expect(input.read().forward).toBe(false);
  });

  it('leaves non-game keys alone', () => {
    const { target, keyboard } = createKeyboard();
    keyboard.attach();
    const tab = keyEvent('keydown', 'Tab');
    target.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('requests pause once per key press (ignores auto-repeat)', () => {
    const { target, onPause, keyboard } = createKeyboard();
    keyboard.attach();
    target.dispatchEvent(keyEvent('keydown', 'Escape'));
    target.dispatchEvent(keyEvent('keydown', 'Escape', true));
    target.dispatchEvent(keyEvent('keydown', 'KeyP'));
    expect(onPause).toHaveBeenCalledTimes(2);
  });

  it('releases every held key when the window loses focus', () => {
    const { target, input, keyboard } = createKeyboard();
    keyboard.attach();
    target.dispatchEvent(keyEvent('keydown', 'Space'));
    expect(input.read().fireFront).toBe(true);
    target.dispatchEvent(new Event('blur'));
    expect(input.read().fireFront).toBe(false);
  });
});
