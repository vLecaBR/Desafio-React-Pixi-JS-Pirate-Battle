import { useStore } from 'zustand';
import type { HudStore } from '../../game/hudStore.ts';
import { formatClock } from '../format.ts';

interface HudProps {
  readonly hud: HudStore;
  readonly onPause: () => void;
}

/**
 * Match status overlay. Subscribes to the HUD store with narrow selectors, so it
 * only re-renders when a displayed value changes (never once per frame).
 */
export function Hud({ hud, onPause }: HudProps) {
  const hp = useStore(hud, (state) => state.hp);
  const maxHp = useStore(hud, (state) => state.maxHp);
  const score = useStore(hud, (state) => state.score);
  const remaining = useStore(hud, (state) => state.remainingSec);
  const phase = useStore(hud, (state) => state.phase);

  return (
    <section className="hud" aria-label="Match status">
      <p className="hud__item">
        <span className="hud__label">Health</span> {hp} / {maxHp}
      </p>
      <p className="hud__item">
        <span className="hud__label">Score</span> {score}
      </p>
      <p className="hud__item">
        <span className="hud__label">Time left</span> {formatClock(remaining)}
      </p>
      <button type="button" className="hud__pause" onClick={onPause} disabled={phase !== 'running'}>
        Pause
      </button>
    </section>
  );
}
