import { useState } from 'react';
import { WoodButton } from '../components/buttons.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { OptionsForm } from '../components/OptionsForm.tsx';
import { useFocusOnMount } from '../hooks/useFocusOnMount.ts';

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
 * Pause menu (as in the mockup: Resume, Options, Main menu). Resuming always
 * requires an explicit action (Resume button, Enter on the focused button, or
 * Escape). Options edited here only apply to the next battle: the running match
 * keeps its configuration snapshot. Leaving to the main menu abandons the match,
 * which is never recorded.
 */
export function PauseDialog({ open, reason, onResume, onMainMenu }: PauseDialogProps) {
  const [view, setView] = useState<'menu' | 'options'>('menu');

  const close = () => {
    setView('menu');
    onResume();
  };

  return (
    <Dialog
      open={open}
      labelledBy="pause-title"
      describedBy="pause-description"
      onCancel={
        view === 'options'
          ? () => {
              setView('menu');
            }
          : close
      }
      className="pause-dialog"
    >
      {view === 'menu' ? (
        <div className="dialog__body">
          <h2 id="pause-title" className="panel__heading">
            Paused
          </h2>
          <p id="pause-description" className="panel__text">
            {REASON_TEXT[reason]}
          </p>
          <div className="panel__actions">
            <WoodButton onClick={close} autoFocus>
              Resume
            </WoodButton>
            <WoodButton
              onClick={() => {
                setView('options');
              }}
            >
              Options
            </WoodButton>
            <WoodButton
              variant="secondary"
              onClick={() => {
                setView('menu');
                onMainMenu();
              }}
            >
              Main menu
            </WoodButton>
          </div>
          <p className="dialog__note">Leaving now abandons the battle; it will not be recorded.</p>
        </div>
      ) : (
        <PauseOptions
          onBack={() => {
            setView('menu');
          }}
        />
      )}
    </Dialog>
  );
}

function PauseOptions({ onBack }: { readonly onBack: () => void }) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  return (
    <div className="dialog__body">
      <h2 id="pause-title" ref={headingRef} tabIndex={-1} className="panel__heading">
        Options
      </h2>
      <p id="pause-description" className="dialog__note">
        Changes apply to the next battle. This battle keeps its current settings.
      </p>
      <OptionsForm backLabel="Back" onBack={onBack} />
    </div>
  );
}
