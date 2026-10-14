import { Dialog } from '../components/Dialog.tsx';

export type PauseReason = 'manual' | 'hidden' | 'blur' | 'portrait';

const REASON_TEXT: Readonly<Record<PauseReason, string>> = {
  manual: 'Ready when you are.',
  hidden: 'The battle paused while the tab was hidden. Ready when you are.',
  blur: 'The battle paused because the window lost focus. Ready when you are.',
  portrait: 'The battle paused while the device was in portrait. Ready when you are.',
};

interface PauseDialogProps {
  readonly open: boolean;
  readonly reason: PauseReason;
  readonly onResume: () => void;
  readonly onMainMenu: () => void;
}

/**
 * Pause menu. Resuming always requires an explicit action (Resume button, Enter on
 * the focused button, or Escape). Leaving to the main menu abandons the match,
 * which is never recorded.
 */
export function PauseDialog({ open, reason, onResume, onMainMenu }: PauseDialogProps) {
  return (
    <Dialog
      open={open}
      labelledBy="pause-title"
      describedBy="pause-description"
      onCancel={onResume}
      className="pause-dialog"
    >
      <h2 id="pause-title">Paused</h2>
      <p id="pause-description">{REASON_TEXT[reason]}</p>
      <div className="dialog__actions">
        <button type="button" className="button" onClick={onResume} autoFocus>
          Resume
        </button>
        <button type="button" className="button button--secondary" onClick={onMainMenu}>
          Main menu
        </button>
      </div>
      <p className="dialog__note">Leaving now abandons the battle; it will not be recorded.</p>
    </Dialog>
  );
}
