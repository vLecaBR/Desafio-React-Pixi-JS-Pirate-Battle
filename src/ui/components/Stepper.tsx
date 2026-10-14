import { useId } from 'react';
import type { NumericLimit } from '../../game/config/gameConfig.ts';
import { RoundButton } from './buttons.tsx';

interface StepperProps {
  readonly label: string;
  /** Raw text of the input (may be temporarily invalid while typing). */
  readonly value: string;
  readonly unit: string;
  readonly limit: NumericLimit;
  readonly error: string | null;
  readonly onChange: (value: string) => void;
}

/**
 * Numeric field with − / + buttons (as in the Options mockup) and an editable,
 * labelled input. Limits are shown; errors are linked with aria-describedby and
 * announced with role="alert".
 */
export function Stepper({ label, value, unit, limit, error, onChange }: StepperProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const numeric = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(numeric);

  const step = (direction: 1 | -1) => {
    const base = valid ? numeric : direction > 0 ? limit.min - limit.step : limit.max + limit.step;
    const snapped = Math.round((base + direction * limit.step) / limit.step) * limit.step;
    const clamped = Math.min(limit.max, Math.max(limit.min, snapped));
    onChange(String(Math.round(clamped * 100) / 100));
  };

  return (
    <div className="stepper">
      <label className="stepper__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="stepper__row">
        <RoundButton
          label={`Decrease ${label.toLowerCase()}`}
          icon="icon_minus"
          small
          disabled={valid && numeric <= limit.min}
          onClick={() => {
            step(-1);
          }}
        />
        <span className="stepper__field">
          <input
            id={inputId}
            className="stepper__input"
            type="number"
            inputMode="decimal"
            min={limit.min}
            max={limit.max}
            step={limit.step}
            value={value}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            onChange={(event) => {
              onChange(event.target.value);
            }}
          />
          <span aria-hidden="true">{unit}</span>
        </span>
        <RoundButton
          label={`Increase ${label.toLowerCase()}`}
          icon="icon_plus"
          small
          disabled={valid && numeric >= limit.max}
          onClick={() => {
            step(1);
          }}
        />
      </div>
      <span id={hintId} className="stepper__hint">
        {limit.min}–{limit.max} {unit}, in steps of {limit.step} {unit}
      </span>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
