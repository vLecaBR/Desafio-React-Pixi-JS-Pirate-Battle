/**
 * Phase 1 placeholder: validates the build and deployment pipeline with the
 * game's background scene. Replaced by the screen state machine in later phases.
 */
export function App() {
  return (
    <main className="placeholder">
      <img
        className="placeholder__title"
        src="/assets/png/default/ui/menu/title_pirate_battle.png"
        srcSet="/assets/png/default/ui/menu/title_pirate_battle.png 1x, /assets/png/retina/ui/menu/title_pirate_battle.png 2x"
        alt="Pirate Battle"
        width={384}
        height={128}
      />
      <p className="placeholder__tagline">Set sail. Take command.</p>
      <p className="placeholder__status">The fleet is being prepared. Check back soon.</p>
    </main>
  );
}
