import { useScreenStore } from '../../app/screenStore.ts';
import { registration, usePendingEntries } from '../../data/services.ts';
import { useLastResultStore } from '../../persistence/lastResultStore.ts';
import { WoodButton } from '../components/buttons.tsx';
import { MenuLayout } from '../components/MenuLayout.tsx';
import { MuteButton } from '../components/MuteButton.tsx';
import { formatClock } from '../format.ts';
import { useFocusOnMount } from '../hooks/useFocusOnMount.ts';

export function MainMenu() {
  const startMatch = useScreenStore((state) => state.startMatch);
  const openOptions = useScreenStore((state) => state.openOptions);
  const openLog = useScreenStore((state) => state.openLog);
  const showLastResult = useScreenStore((state) => state.showLastResult);
  const lastResult = useLastResultStore((state) => state.lastResult);
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const pending = usePendingEntries();

  return (
    <MenuLayout labelledBy="menu-title" corner={<MuteButton />}>
      <h1 id="menu-title" ref={headingRef} tabIndex={-1} className="visually-hidden">
        Pirate Battle
      </h1>
      <img
        className="panel__title-image"
        src="/assets/png/default/ui/menu/title_pirate_battle.png"
        srcSet="/assets/png/default/ui/menu/title_pirate_battle.png 1x, /assets/png/retina/ui/menu/title_pirate_battle.png 2x"
        alt=""
        width={384}
        height={128}
      />
      <p className="panel__tagline">Set sail. Take command.</p>

      <div className="panel__actions">
        <WoodButton onClick={startMatch}>Play</WoodButton>
        <WoodButton onClick={openOptions}>Options</WoodButton>
      </div>

      <img className="main-menu__ship" src="/assets/png/default/ships/ship_2.png" alt="" />
      <p className="panel__text">Navigate the islands. Survive the battle.</p>

      {lastResult && (
        <div className="last-battle">
          <p>
            <strong>Last battle:</strong> {lastResult.score} points ·{' '}
            {formatClock(lastResult.durationMs / 1000)} ·{' '}
            {lastResult.endReason === 'time_up' ? 'Time up' : 'Defeated'}
          </p>
          <button type="button" className="text-button" onClick={showLastResult}>
            View result
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="last-battle" role="status">
          <p>
            {pending.length === 1
              ? '1 battle is waiting to be saved.'
              : `${pending.length} battles are waiting to be saved.`}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              void registration.flush();
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div className="panel__actions--row">
        <WoodButton
          variant="secondary"
          onClick={() => {
            openLog('ranking');
          }}
        >
          Ranking
        </WoodButton>
        <WoodButton
          variant="secondary"
          onClick={() => {
            openLog('history');
          }}
        >
          Match history
        </WoodButton>
      </div>

      <details className="how-to-play">
        <summary>How to play</summary>
        <div className="how-to-play__body">
          <p className="panel__text">
            Sink as many enemy ships as you can before time runs out. Chasers ram you; Shooters fire
            from range. Each ship you sink is worth 1 point.
          </p>
          <h3>Keyboard</h3>
          <dl>
            <dt>
              <kbd>W</kbd> / <kbd>↑</kbd>
            </dt>
            <dd>Sail forward</dd>
            <dt>
              <kbd>A</kbd> <kbd>D</kbd> / <kbd>←</kbd> <kbd>→</kbd>
            </dt>
            <dd>Turn left / right</dd>
            <dt>
              <kbd>Space</kbd> / <kbd>K</kbd>
            </dt>
            <dd>Front cannon</dd>
            <dt>
              <kbd>Q</kbd> / <kbd>J</kbd>
            </dt>
            <dd>Left broadside (3 shots)</dd>
            <dt>
              <kbd>E</kbd> / <kbd>L</kbd>
            </dt>
            <dd>Right broadside (3 shots)</dd>
            <dt>
              <kbd>Esc</kbd> / <kbd>P</kbd>
            </dt>
            <dd>Pause</dd>
          </dl>
          <h3>Touch (landscape)</h3>
          <dl>
            <dt>Left buttons</dt>
            <dd>Turn left, sail forward, turn right</dd>
            <dt>Right buttons</dt>
            <dd>Left broadside, front cannon, right broadside</dd>
          </dl>
          <p className="panel__text">You can sail, turn and fire at the same time.</p>
        </div>
      </details>
    </MenuLayout>
  );
}
