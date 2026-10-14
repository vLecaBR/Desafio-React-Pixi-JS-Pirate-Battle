# Testing

Pirate Battle is tested at three levels:

| Level               | Tool       | Scope                                                                   | Command                                          |
| ------------------- | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| Unit / integration  | Vitest     | Simulation core, config, input, data layer, mocks (Axios ↔ MSW in Node) | `npm run test:unit`                              |
| Headless smoke      | tsx        | Full 120 s matches with a bot, determinism check                        | `npm run sim:smoke`                              |
| End-to-end + visual | Playwright | The production build in Chromium desktop and mobile                     | `npm run test:e2e`, `npm run test:visual:docker` |

## End-to-end tests

The suite runs against `vite preview` of the production build (started automatically
by Playwright), with the MSW mocks active, in two projects:

- `chromium-desktop` — Desktop Chrome, 1280 × 720.
- `chromium-mobile` — Pixel 7 in landscape (touch, coarse pointer).

Tests tagged `@desktop` or `@mobile` run in one project only; untagged tests (main
flows: options, movement, match end, result, navigation, ranking, registration) run
in both.

### Determinism and the test clock

Pages are opened with `?e2e=1`, which enables test instrumentation:

- **Manual clock.** The render loop keeps drawing, but the simulation only advances
  through `window.__PB__.advance(ms)`, which runs the _real_ fixed steps (input,
  rules, collisions) and renders a frame. Tests therefore control time exactly; real
  waiting never changes the result.
- **`window.__PB__.state()`** returns a serialisable snapshot (phase, pause, time,
  score, player, enemies, projectiles) to assert on.
- **`?seed=`** fixes the simulation RNG (spawn points, enemy mix) and the seeded
  jitter of API retries.
- **`?preset=`** selects a deterministic scenario that only changes configuration and
  initial positions (`sandbox`, `island-ahead`, `near-edge`, `chaser-ahead`,
  `shooter-in-range`, `target-practice`, `low-health`, `spawn-test`, `stress`). The
  rules, collisions, input and rendering are untouched.
- **`?scenario=`** selects the mocked network scenario; `window.__PB_LAB__` exposes
  the Network Lab actions (switch scenario, reset, count stored records).

Combat tests drive the ship with real keyboard events (`page.keyboard.down/up`) and,
on mobile, real multi-touch through the DevTools protocol, then verify the effects in
the snapshot and in the HUD.

### Isolation

Every test runs in a fresh browser context: empty `localStorage` (options, last
result, pending queue, mock database) and a newly registered service worker. A
console guard fails any test that logs an unexpected `console.error` or throws an
uncaught error. Failure scenarios explicitly allow the browser's network log lines
(`Failed to load resource`) produced by the mocked 4xx/5xx responses.

### Coverage of the challenge items

| #   | Requirement                                                     | Spec                       |
| --- | --------------------------------------------------------------- | -------------------------- |
| 1   | Options navigation, validation, persistence                     | `options.spec.ts`          |
| 2   | Asset loading, failure and retry                                | `assets.spec.ts`           |
| 3   | Start, movement, rotation, arena limits, island collision       | `movement.spec.ts`         |
| 4   | Front/side fire, damage, cooldown, score without duplicates     | `weapons.spec.ts`          |
| 5   | Chaser and Shooter behaviour, spawn interval                    | `enemies.spec.ts`          |
| 6   | End by time and by death, frozen simulation, clean restart      | `match-end.spec.ts`        |
| 7   | Pause, focus loss, resume without time advancing                | `pause.spec.ts`            |
| 8   | Result screen and persistence after refresh                     | `result.spec.ts`           |
| 9   | Abandoning, repeated navigation, touch controls                 | `navigation-touch.spec.ts` |
| 10  | Ranking/history queries, pagination, loading, empty, error      | `log-queries.spec.ts`      |
| 11  | Registration, both tabs updated, pending recovery after refresh | `register.spec.ts`         |
| 12  | Resend after timeout without duplicates, stale responses        | `idempotency.spec.ts`      |
| —   | Visual regression: menu, stable arena, result                   | `visual.spec.ts`           |

### Reports and traces

- HTML report: `reports/playwright-html` (`npm run report`).
- Traces, screenshots and videos are kept for failed tests in `test-results/`
  (`npx playwright show-trace <trace.zip>`).

## Visual regression

Baselines live in `e2e/__screenshots__/` and are generated inside the official
Playwright Docker image, so font rasterisation and GPU differences between host
systems never cause false diffs:

```bash
npm run test:visual:docker          # compare
npm run test:visual:docker:update   # regenerate baselines
```

The arena screenshot is deterministic: in test mode cosmetic animations (water
drift, screen shake) only advance with the test clock, and the frame is rendered
from a fixed seed and preset.
