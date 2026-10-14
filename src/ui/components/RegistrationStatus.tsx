import { pendingQueue, registration, useRegistrationStatus } from '../../data/services.ts';
import { useStore } from 'zustand';

interface RegistrationStatusProps {
  readonly matchId: string;
  readonly confirmed: boolean;
}

/**
 * Registration state of a finished match: saving, saved, or pending with the last
 * error and a Retry action. Announced politely; never blocks navigation.
 */
export function RegistrationStatusLine({ matchId, confirmed }: RegistrationStatusProps) {
  const status = useRegistrationStatus(matchId, confirmed);
  const lastError = useStore(
    pendingQueue.store,
    (state) => state.entries.find((entry) => entry.record.matchId === matchId)?.lastError ?? null,
  );

  return (
    <div className="result__registration" role="status" aria-live="polite">
      {status === 'saving' && <span>Saving to the Captain&apos;s Log…</span>}
      {status === 'saved' && (
        <span className="registration--saved">Saved to the Captain&apos;s Log.</span>
      )}
      {status === 'pending' && (
        <>
          <span className="registration--pending">
            Not saved yet{lastError ? `: ${lastError}` : '.'} It will retry automatically.
          </span>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              void registration.retry(matchId);
            }}
          >
            Retry now
          </button>
        </>
      )}
      {status === null && <span>Not recorded.</span>}
    </div>
  );
}
