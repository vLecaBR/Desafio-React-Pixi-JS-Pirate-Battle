# Pirate Battle

A top-down 2D naval shooter built with **React, TypeScript (strict) and PixiJS**.
Sail between the islands, sink Chasers and Shooters, and climb the Captain's Log.

- **Live demo:** _the Vercel URL is added here after deployment_ (the deployed build runs
  the mocked API, so ranking and history work on the public URL).
- **Challenge statement:** [CHALLENGE.md](CHALLENGE.md)
- **Architecture and decisions:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Testing strategy:** [docs/TESTING.md](docs/TESTING.md) ·
  **Profiling:** [docs/PROFILING.md](docs/PROFILING.md) · **Credits:** [CREDITS.md](CREDITS.md)

| Responsibility                                  | Technology                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Menus, forms, panels, dialogs, HUD              | React 19                                                                        |
| Language                                        | TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Arena, ships, projectiles, effects, health bars | PixiJS 8                                                                        |
| Ranking and history remote state                | TanStack Query 5                                                                |
| HTTP client                                     | Axios                                                                           |
| API mocks (development, tests and production)   | MSW 2                                                                           |
| End-to-end and visual regression tests          | Playwright                                                                      |
| Build / unit tests                              | Vite 8 / Vitest                                                                 |

## Requirements

- **Node.js** `^20.19.0 || >=22.12.0` (Vite 8 requirement) and npm 10+.
- For end-to-end tests: Chromium for Playwright (`npx playwright install chromium`).
- For visual regression baselines: Docker (the official Playwright image is used).

## Setup

```bash
npm ci
npx playwright install --with-deps chromium   # only needed for the E2E tests
npm run dev                                   # http://localhost:5173
```

With npm 11+ the allowed install scripts are declared in `package.json`
(`allowScripts`): `msw` (worker update) and `ffmpeg-static` (only used by
`npm run assets:audio`).

## Commands

| Command                             | What it does                                                          |
| ----------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                       | Development server (React StrictMode, query devtools)                 |
| `npm run build`                     | Type-check and production build into `dist/`                          |
| `npm run preview`                   | Serve the production build on http://localhost:4173                   |
| `npm run lint`                      | ESLint (type-aware, zero warnings)                                    |
| `npm run typecheck`                 | TypeScript project build without emit                                 |
| `npm run format` / `format:check`   | Prettier                                                              |
| `npm run test:unit`                 | Vitest: simulation, config, input, data layer, mocks                  |
| `npm run sim:smoke`                 | Headless 120 s matches with a bot + determinism check                 |
| `npm run test:e2e`                  | Playwright, Chromium desktop and mobile, against the production build |
| `npm run test:e2e:ui`               | Playwright UI mode                                                    |
| `npm run report`                    | Open the last HTML report (`reports/playwright-html`)                 |
| `npm run test:visual:docker`        | Visual regression inside the Playwright Docker image                  |
| `npm run test:visual:docker:update` | Regenerate the visual baselines (Docker)                              |
| `npm run perf` / `perf:report`      | Profiling runs and their Markdown report                              |
| `npm run assets:atlas`              | Convert the Starling XML ship atlas to TexturePacker JSON             |
| `npm run assets:audio`              | Convert the WAV sounds to OGG + M4A                                   |

Generated assets (`public/assets/generated/`) are committed, so a clean checkout
never needs the asset scripts.

## Environment variables

All optional (see `.env.example`):

| Variable              | Default | Effect                                                                                    |
| --------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `VITE_ENABLE_MOCKS`   | enabled | Set to `false` to disable the MSW mocks (the API then targets `/api` on the same origin). |
| `VITE_API_TIMEOUT_MS` | `4000`  | Axios timeout for ranking/history requests.                                               |

## Controls

| Action                                    | Keyboard              | Touch (landscape)           |
| ----------------------------------------- | --------------------- | --------------------------- |
| Sail forward                              | `W` / `↑`             | ⬆ button (left group)       |
| Turn left / right                         | `A` / `←` · `D` / `→` | ↶ / ↷ buttons (left group)  |
| Front cannon (1 shot)                     | `Space` / `K`         | center button (right group) |
| Left / right broadside (3 parallel shots) | `Q` / `J` · `E` / `L` | side buttons (right group)  |
| Pause                                     | `Esc` / `P`           | pause button (HUD)          |

Movement and fire work at the same time (keys or several fingers). Game keys are
only captured during gameplay. The game pauses automatically when the tab is
hidden, the window loses focus or a phone is rotated to portrait (landscape only on
touch devices); resuming always needs an explicit action.

## Gameplay configuration

All balancing lives in [`src/game/config/gameConfig.ts`](src/game/config/gameConfig.ts)
(`GameConfig` + `DEFAULT_GAME_CONFIG`); systems contain no gameplay numbers.

| Group                  | Fields                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `match`                | `sessionTimeSec`                                                                                                                                                                         |
| `spawn`                | `intervalSec`, `initialDelaySec`, `maxAlive`, `minDistanceFromPlayer`, `edgeMarginPx`, `clearanceRadius`, forward cone, `weights` (chaser/shooter), `guaranteedOpening`, `spawnGraceSec` |
| `player`               | health, move/turn speed, acceleration, hull circles, `frontCannon` and `broadside` weapons                                                                                               |
| `chaser`               | health, speeds, hull, `contactDamage`                                                                                                                                                    |
| `shooter`              | health, speeds, hull, `attackRangePx`, `preferredDistancePx`, `aimToleranceRad`, `requireLineOfSight`, `cannon`                                                                          |
| weapons                | `damage`, `cooldownSec`, `projectileSpeed`, `rangePx`, `lifetimeSec`, `projectileRadius`, `muzzleOffsetPx` (+ `shots`, `spacingPx` for broadsides)                                       |
| `ai`, `sim`, `visuals` | flow-field refresh, sharp-turn throttle, fixed step (1/60 s), frame clamp, damage-sprite thresholds                                                                                      |

The **Options** screen exposes two of them, validated and persisted locally
(`pb.options.v1`):

| Option            | Limits                   | Step  | Default |
| ----------------- | ------------------------ | ----- | ------- |
| Game session time | 60–180 s                 | 10 s  | 120 s   |
| Enemy spawn time  | 1–10 s (always positive) | 0.5 s | 3 s     |

Each match uses an immutable snapshot of the configuration taken when it starts;
changes made later (also from the pause menu) apply to the next match.

## Ranking, history and network scenarios

The ranking and match-history REST API (`/api/ranking`, `/api/players/:id/matches`,
`POST /api/matches`) is mocked with MSW in every environment, including the
deployed build. Confirmed registrations are stored in `localStorage`
(`pb.mockdb.v1`) and show up in both tabs; registrations that could not be
confirmed stay in a persistent pending queue (`pb.pending.v1`) and are retried.

### Selecting a scenario

- URL: `?scenario=<id>` (remembered for the next visits), e.g.
  `http://localhost:4173/?scenario=slow`.
- UI: **Network lab** link at the bottom of the main menu (or `?lab=1`).
- Randomness: `?seed=<n>` seeds the variable latency; `?latency=<ms>` overrides the
  fixed latencies.

| Scenario                          | Behaviour                                                                  |
| --------------------------------- | -------------------------------------------------------------------------- |
| `success`                         | Normal responses after 150 ms                                              |
| `empty`                           | Ranking and history return no items                                        |
| `many-pages`                      | Extra records so both tabs have several pages                              |
| `slow`                            | Every response takes 2.5 s                                                 |
| `variable-latency`                | Seeded random latency, 100 ms – 1.8 s                                      |
| `out-of-order`                    | Reads alternate 1.8 s / 0.1 s, so an older request can answer last         |
| `timeout`                         | Nothing answers before the 4 s client timeout                              |
| `network-error`                   | Connection failures                                                        |
| `http-4xx`                        | Reads 400, registrations 422                                               |
| `http-5xx`                        | Reads 500, registrations 503                                               |
| `ranking-fails` / `history-fails` | Only that tab fails (500)                                                  |
| `post-timeout-after-commit`       | The registration is saved, but the answer arrives after the client timeout |
| `outage-on-finish`                | Registrations fail (503) until another scenario is selected                |

### Restoring the initial state

Network lab → **Reset mock data** (fixtures), **Clear pending queue**, or
**Reset everything** (fixtures, pending queue, `success` scenario, default options,
last result and a new local player).

### Reproducing failures

- **Timeout after the server saved the match (no duplicate):** open
  `/?scenario=post-timeout-after-commit`, play until the match ends. The result shows
  _Saving…_; the first request times out (4 s) although the server stored it, the
  automatic retry gets the existing record (`200`, `created: false`) and the status
  becomes _Saved_. The Network lab still shows one more record only.
- **Outage at the end of the match and recovery after a refresh:** open
  `/?scenario=outage-on-finish`, finish a match → _Not saved yet … Retry now_.
  Reload the page: the menu shows _1 battle is waiting to be saved_. Open the Network
  lab, select **Success**, then press **Retry** (menu) or **Retry now** (result
  screen) → _Saved_, and the match appears in Ranking and Match history.
- **Stale responses:** `/?scenario=out-of-order`, open Ranking and change the
  battle-length filter twice quickly: the table always matches the last selection.
- **Query errors:** `/?scenario=ranking-fails` (or `history-fails`, `http-5xx`,
  `network-error`, `timeout`) → open the Captain's Log: an accessible error with
  **Retry**; the game and the options keep working.
- **Asset loading failure:** block `/assets/tilesheet/*` in DevTools (Network →
  Block request URL) and press Play → _Loading failed_ with **Try again**.

## Testing

- Unit and integration: `npm run test:unit` (94 tests).
- End-to-end: `npm run test:e2e` builds the app, serves it and runs 55 tests in
  Chromium desktop (1280 × 720) and Chromium mobile (Pixel 7, landscape). Tests use a
  deterministic test clock (`?e2e=1`), seeds and presets while driving the game with
  real keyboard and touch input. See [docs/TESTING.md](docs/TESTING.md).
- Visual regression: menu, stable arena and result screen; baselines in
  `e2e/__screenshots__/`, generated and compared in Docker
  (`npm run test:visual:docker`).
- Reports: HTML report in `reports/playwright-html/` (`npm run report`); traces,
  screenshots and videos of failures in `test-results/`
  (`npx playwright show-trace <trace.zip>`). A sample failure trace is kept in
  `reports/traces/`.

## Performance

Three-minute match on the production build (hardware GPU, 1280 × 720): **60 FPS
average, p95 frame interval 16.7 ms**, simulation + scene sync ≈ 0.2 ms per frame;
memory stable across five play/exit cycles. Method, environment, results and
limitations: [docs/PROFILING.md](docs/PROFILING.md).

## Deployment

The app is a static SPA. On Vercel (`vercel.json` is included):

1. Import the repository (framework preset **Vite**; build `npm run build`, output
   `dist`).
2. No environment variables are required (mocks are enabled by default).
3. `vercel.json` rewrites every route to `index.html` except `/assets`, `/static`
   and `/mockServiceWorker.js` (so missing assets return a real 404), sets long-term
   caching for hashed bundles and disables caching of the service worker.

## Project structure

```text
src/
  app/            App shell and screen state machine
  game/
    config/       GameConfig (balancing) and test/profiling presets
    core/         Deterministic simulation (no PixiJS/React): systems, world, math
    render/       PixiJS renderer, views, pooled effects, textures, viewport
    input/        Keyboard and touch input merged into intents
    audio/        Web Audio manager and game sounds
    testing/      Test hooks, autopilot, perf monitor
    GameController.ts   Loop, pause, lifecycle, bridge to the UI
  data/           Contracts, Axios client, TanStack Query, registration, pending queue
  mocks/          MSW handlers, mock database, fixtures, scenarios, Network Lab actions
  persistence/    Versioned, validated localStorage (options, last result)
  ui/             React screens, components, HUD, dialogs, styles, fonts
e2e/              Playwright specs, fixtures, helpers, visual baselines, perf runs
scripts/          Asset conversion, smoke test, Docker visual runner, profiling report
docs/             TESTING.md, PROFILING.md and profiling results
```
