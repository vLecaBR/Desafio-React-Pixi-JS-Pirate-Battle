import { useState, type PointerEvent } from 'react';
import type { TouchInput, TouchIntent } from '../../game/input/TouchInput.ts';

interface ControlSpec {
  readonly intent: TouchIntent;
  readonly label: string;
  readonly icon: string;
}

const MOVEMENT: readonly ControlSpec[] = [
  { intent: 'turnLeft', label: 'Turn left', icon: 'icon_turn_left' },
  { intent: 'forward', label: 'Sail forward', icon: 'icon_forward' },
  { intent: 'turnRight', label: 'Turn right', icon: 'icon_turn_right' },
];

const WEAPONS: readonly ControlSpec[] = [
  { intent: 'fireLeft', label: 'Fire left broadside', icon: 'icon_fire_left' },
  { intent: 'fireFront', label: 'Fire front cannon', icon: 'icon_fire_front' },
  { intent: 'fireRight', label: 'Fire right broadside', icon: 'icon_fire_right' },
];

interface TouchControlsProps {
  readonly touch: TouchInput | null;
  readonly disabled: boolean;
}

/**
 * On-screen controls for touch devices: movement on the left, weapons on the right
 * (as in the reference mockup). Pointer Events with pointer capture support holding
 * several buttons at once with different fingers.
 */
export function TouchControls({ touch, disabled }: TouchControlsProps) {
  return (
    <div className="touch-controls" aria-label="Touch controls">
      <div className="touch-controls__group touch-controls__group--movement">
        {MOVEMENT.map((spec) => (
          <TouchButton key={spec.intent} spec={spec} touch={touch} disabled={disabled} />
        ))}
      </div>
      <div className="touch-controls__group touch-controls__group--weapons">
        {WEAPONS.map((spec) => (
          <TouchButton key={spec.intent} spec={spec} touch={touch} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}

function TouchButton({
  spec,
  touch,
  disabled,
}: {
  readonly spec: ControlSpec;
  readonly touch: TouchInput | null;
  readonly disabled: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  const press = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || !touch) return;
    event.preventDefault();
    try {
      // Keep receiving this finger's events even if it slides off the button.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer already released or not capturable: the press still counts.
    }
    touch.press(spec.intent, event.pointerId);
    setPressed(true);
  };

  const release = (event: PointerEvent<HTMLButtonElement>) => {
    touch?.release(spec.intent, event.pointerId);
    setPressed(touch?.isHeld(spec.intent) ?? false);
  };

  return (
    <button
      type="button"
      className={`touch-button touch-button--${spec.intent}`}
      data-pressed={pressed && !disabled ? 'true' : undefined}
      aria-label={spec.label}
      // Keyboard users have the keyboard bindings; keep these out of the tab order.
      tabIndex={-1}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <img src={`/assets/png/default/ui/controls/${spec.icon}.png`} alt="" draggable={false} />
    </button>
  );
}
