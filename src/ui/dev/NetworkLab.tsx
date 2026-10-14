import { useId, useState } from 'react';
import { useStore } from 'zustand';
import { usePendingEntries } from '../../data/services.ts';
import { labActions } from '../../mocks/lab.ts';
import {
  isScenarioId,
  scenarioStore,
  SCENARIOS,
  setScenario,
  setScenarioSeed,
} from '../../mocks/scenarios.ts';
import { mockStatus } from '../../mocks/start.ts';
import { WoodButton } from '../components/buttons.tsx';
import { Dialog } from '../components/Dialog.tsx';

interface NetworkLabProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * Developer/demo panel for the mocked API: pick a network scenario, seed the random
 * latency, and restore the initial state. Also available with `?lab=1`.
 */
export default function NetworkLab({ open, onClose }: NetworkLabProps) {
  const scenario = useStore(scenarioStore, (state) => state.scenario);
  const seed = useStore(scenarioStore, (state) => state.seed);
  const pending = usePendingEntries();
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState(() => labActions.dbStats());
  const selectId = useId();
  const seedId = useId();
  const active = SCENARIOS.find((item) => item.id === scenario);

  const done = (message: string) => {
    setStats(labActions.dbStats());
    setStatus(message);
  };

  return (
    <Dialog
      open={open}
      labelledBy="lab-title"
      describedBy="lab-description"
      onCancel={onClose}
      className="network-lab"
    >
      <div className="dialog__body">
        <h2 id="lab-title" className="panel__heading">
          Network lab
        </h2>
        <p id="lab-description" className="dialog__note">
          Mocked API ({mockStatus()}): {stats.records} records, revision {stats.revision},{' '}
          {pending.length} pending registration{pending.length === 1 ? '' : 's'}.
        </p>

        <div className="lab-field">
          <label htmlFor={selectId}>Scenario</label>
          <select
            id={selectId}
            value={scenario}
            aria-describedby={`${selectId}-hint`}
            onChange={(event) => {
              if (isScenarioId(event.target.value)) {
                setScenario(event.target.value);
                done(`Scenario set to ${event.target.value}.`);
              }
            }}
          >
            {SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <span id={`${selectId}-hint`} className="stepper__hint">
            {active?.description}
          </span>
        </div>

        <div className="lab-field">
          <label htmlFor={seedId}>Latency seed</label>
          <input
            id={seedId}
            type="number"
            min={0}
            step={1}
            value={seed}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 0) setScenarioSeed(value);
            }}
          />
        </div>

        <div className="panel__actions">
          <WoodButton
            variant="secondary"
            onClick={() => {
              labActions.resetMockData();
              done('Mock data restored.');
            }}
          >
            Reset mock data
          </WoodButton>
          <WoodButton
            variant="secondary"
            onClick={() => {
              labActions.clearPendingQueue();
              done('Pending queue cleared.');
            }}
          >
            Clear pending queue
          </WoodButton>
          <WoodButton
            variant="secondary"
            onClick={() => {
              labActions.resetEverything();
              done('Everything was reset.');
            }}
          >
            Reset everything
          </WoodButton>
        </div>
        <p className="status-text" role="status">
          {status}
        </p>
        <WoodButton onClick={onClose}>Close</WoodButton>
      </div>
    </Dialog>
  );
}
