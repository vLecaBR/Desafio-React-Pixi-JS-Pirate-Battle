import { useScreenStore } from '../../app/screenStore.ts';

/** Temporary main menu (the full menu arrives with the UI phase). */
export function MainMenu() {
  const startMatch = useScreenStore((state) => state.startMatch);
  return (
    <main className="screen screen--menu">
      <img
        className="screen__title"
        src="/assets/png/default/ui/menu/title_pirate_battle.png"
        srcSet="/assets/png/default/ui/menu/title_pirate_battle.png 1x, /assets/png/retina/ui/menu/title_pirate_battle.png 2x"
        alt="Pirate Battle"
        width={384}
        height={128}
      />
      <p className="screen__tagline">Set sail. Take command.</p>
      <button
        type="button"
        className="button"
        onClick={() => {
          startMatch();
        }}
      >
        Play
      </button>
      <section className="controls-help" aria-label="Controls">
        <h2>Controls</h2>
        <ul>
          <li>W / Up arrow: sail forward</li>
          <li>A, D / Left, Right arrows: turn</li>
          <li>Space / K: front cannon</li>
          <li>Q / J and E / L: left and right broadsides</li>
          <li>Esc / P: pause</li>
        </ul>
      </section>
    </main>
  );
}
