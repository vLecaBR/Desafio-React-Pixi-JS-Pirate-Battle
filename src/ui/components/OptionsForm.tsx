import { useState, type SyntheticEvent } from 'react';
import { OPTION_LIMITS, type MatchOptions } from '../../game/config/gameConfig.ts';
import { useOptionsStore, validateOption } from '../../persistence/optionsStore.ts';
import { WoodButton } from './buttons.tsx';
import { Stepper } from './Stepper.tsx';

interface OptionsFormProps {
  readonly backLabel: string;
  readonly onBack: () => void;
  /** Extra explanation shown under the fields (e.g. "applies to the next battle"). */
  readonly note?: string;
}

type Drafts = Record<keyof MatchOptions, string>;

/**
 * Edits the two match options. Values are validated as the player types; Save is
 * only enabled when every value is valid and something changed. Saved options are
 * persisted locally and used by the next match.
 */
export function OptionsForm({ backLabel, onBack, note }: OptionsFormProps) {
  const options = useOptionsStore((state) => state.options);
  const save = useOptionsStore((state) => state.save);
  const [drafts, setDrafts] = useState<Drafts>(() => ({
    sessionTimeSec: String(options.sessionTimeSec),
    spawnIntervalSec: String(options.spawnIntervalSec),
  }));
  const [status, setStatus] = useState('');

  const errors = {
    sessionTimeSec: validateOption('sessionTimeSec', drafts.sessionTimeSec),
    spawnIntervalSec: validateOption('spawnIntervalSec', drafts.spawnIntervalSec),
  };
  const valid = errors.sessionTimeSec === null && errors.spawnIntervalSec === null;
  const changed =
    Number(drafts.sessionTimeSec) !== options.sessionTimeSec ||
    Number(drafts.spawnIntervalSec) !== options.spawnIntervalSec;

  const update = (field: keyof MatchOptions, value: string) => {
    setDrafts((current) => ({ ...current, [field]: value }));
    setStatus('');
  };

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || !changed) return;
    const saved = save({
      sessionTimeSec: Number(drafts.sessionTimeSec),
      spawnIntervalSec: Number(drafts.spawnIntervalSec),
    });
    setStatus(saved ? 'Options saved.' : 'The options could not be saved.');
  };

  return (
    <form className="options-form" onSubmit={onSubmit} noValidate>
      <Stepper
        label="Game session time"
        unit="s"
        value={drafts.sessionTimeSec}
        limit={OPTION_LIMITS.sessionTimeSec}
        error={errors.sessionTimeSec}
        onChange={(value) => {
          update('sessionTimeSec', value);
        }}
      />
      <Stepper
        label="Enemy spawn time"
        unit="s"
        value={drafts.spawnIntervalSec}
        limit={OPTION_LIMITS.spawnIntervalSec}
        error={errors.spawnIntervalSec}
        onChange={(value) => {
          update('spawnIntervalSec', value);
        }}
      />
      {note && <p className="dialog__note">{note}</p>}
      <p className="status-text" role="status">
        {status}
      </p>
      <div className="panel__actions">
        <button type="submit" className="wood-button" disabled={!valid || !changed}>
          Save
        </button>
        <WoodButton variant="secondary" onClick={onBack}>
          {backLabel}
        </WoodButton>
      </div>
    </form>
  );
}
