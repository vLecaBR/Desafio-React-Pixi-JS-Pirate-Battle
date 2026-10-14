import { audio } from '../../game/audio/AudioManager.ts';
import { useMuted } from '../hooks/useMuted.ts';

/** Sound on/off toggle (persisted). */
export function MuteButton() {
  const muted = useMuted();
  return (
    <button
      type="button"
      className="round-button sound-toggle"
      aria-pressed={!muted}
      aria-label="Sound"
      title={muted ? 'Sound off' : 'Sound on'}
      onClick={() => {
        audio.setMuted(!muted);
      }}
    >
      <span aria-hidden="true" className="sound-toggle__glyph">
        {muted ? '\u{1F507}' : '\u{1F50A}'}
      </span>
    </button>
  );
}
