# Performance and profiling

Target: **60 FPS** during combat in the optimised (production) build.
Raw results are in [`profiling/`](profiling/) (JSON) and summarised in
[`profiling/REPORT.md`](profiling/REPORT.md) (`npm run perf:report`).

## Reference environment

| Item     | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Machine  | Intel Core i7-8700T @ 2.40 GHz (6 cores / 12 threads), 16 GB RAM                          |
| GPU      | NVIDIA GeForce GTX 1650 (driver 32.0.16.1074)                                             |
| OS       | Windows 11 Pro (build 26200)                                                              |
| Display  | 1600 × 900 @ 59 Hz (the run itself is headless)                                           |
| Browser  | Chromium 156.0.8078.4 (Playwright 1.64.1), headless, hardware GPU via ANGLE / Direct3D 11 |
| Viewport | 1280 × 720, device pixel ratio 1                                                          |
| Build    | `vite build` (production), served by `vite preview`, MSW mocks active                     |

## Method

`npm run perf` runs two Playwright tests (`e2e/perf/*.perf.ts`, config
`playwright.perf.config.ts`, one worker so nothing competes for CPU/GPU):

1. **Three-minute match** — `/?perf=1&preset=stress&seed=3`: a complete 180 s match
   in real time with dense combat (one spawn per second, up to 10 enemies alive; the
   player's health is raised so the match lasts the full three minutes). A keyboard
   bot holds forward, alternates turning every 1.5 s and keeps all three weapons
   firing, so enemies, projectiles and effects stay near their peak.
2. **Memory over five cycles** — main menu → play 30 s of the same dense combat →
   pause → main menu, five times. After each cycle the heap is garbage-collected
   twice through the DevTools protocol and `Performance.getMetrics` is read
   (JS heap, DOM nodes, event listeners, documents), plus the number of canvases.

`?perf=1` enables `src/game/testing/perfMonitor.ts`: every frame stores the interval
between frames and the CPU cost of the tick (simulation steps + scene sync) in
fixed ring buffers (no allocation per frame); entity counts (ships, projectiles,
pooled effects, Pixi display objects) are sampled twice per second. A small corner
overlay shows the live values.

## Results — three-minute match

| Metric                                        |       Hardware GPU (reference) | Software GL (lower bound) |
| --------------------------------------------- | -----------------------------: | ------------------------: |
| Duration / frames                             |               180.0 s / 10 797 |           181.2 s / 3 721 |
| **Average FPS**                               |                       **60.0** |                      20.5 |
| Frame interval avg / p50 / **p95** / p99 (ms) | 16.67 / 16.7 / **16.7** / 16.8 |   48.7 / 50 / 66.6 / 66.7 |
| Frames over 25 ms / over 33.3 ms              |                          1 / 1 |             3 721 / 3 405 |
| Tick CPU cost avg / p95 / max (ms)            |               0.18 / 0.4 / 3.2 |            0.51 / 0.9 / 5 |
| Ships avg / max (player included)             |                       9.9 / 11 |                  9.7 / 11 |
| Projectiles avg / max                         |                        1.7 / 7 |                   1.7 / 7 |
| Pooled effects active avg / max               |                      12.4 / 45 |                 11.6 / 38 |
| Pixi display objects avg / max                |                      198 / 217 |                 202 / 220 |
| JS heap at the end                            |                          13 MB |                     13 MB |

The match ran its full 180 s (score 60, 135 enemies spawned). With the GPU the
game is locked to the display rate: p95 equals one 60 Hz frame and a single frame
(the first one, while the scene warms up) exceeded 25 ms.

The software-GL run (`PERF_SOFTWARE_GL=1 npm run perf`, Chromium's default headless
renderer, SwiftShader on the CPU) is GPU-bound: the game logic still costs only
~0.5 ms per tick, the rest of the ~49 ms frame is rasterisation emulated on the
CPU. It is reported as a lower bound for machines without hardware acceleration.

## Results — memory over five cycles

|  Cycle | JS heap used (MB) | DOM nodes | Listeners | Documents | Canvases |
| -----: | ----------------: | --------: | --------: | --------: | -------: |
| before |              4.02 |       165 |       180 |         2 |        0 |
|      1 |              8.38 |       243 |       215 |         2 |        0 |
|      2 |              8.68 |       243 |       217 |         2 |        0 |
|      3 |              9.03 |       243 |       217 |         2 |        0 |
|      4 |              9.09 |       243 |       218 |         2 |        0 |
|      5 |              9.32 |       243 |       217 |         2 |        0 |

The first cycle loads the game code (code-split), textures and sounds, which stay
cached on purpose. After that, DOM nodes, event listeners and documents are flat,
and no canvas survives a return to the menu (the Pixi application, its WebGL
context, the ticker, listeners and pools are all released). The test asserts that,
from cycle 2 to 5, the heap stays within 15 % (+3 MB) and listeners/nodes within 5 %.

### Investigation of the residual heap growth

The heap still grows slightly (~0.1–0.3 MB per cycle), so a longer run and heap
snapshots were used to find the cause:

- **Extended run** (12 cycles × 10 s, `memory-extended-*.json`): 8.53 MB at cycle 2
  → 9.87 MB at cycle 12 (≈ 0.13 MB per cycle), with listeners, nodes, documents and
  canvases constant.
- **Heap snapshot diff** (CDP `HeapProfiler`, cycle 3 vs cycle 13, unminified build):
  the _retained objects_ grew by only ~10 KB in 10 matches (≈ 1 KB per match). The
  rest of the `JSHeapUsedSize` growth is not retained application data but V8
  internals (compiled code, type feedback), which do not scale with play time.
- The ~1 KB per match was traced to **one `BindGroup` and one `EventEmitter` per
  destroyed Pixi `Application`, attached to PixiJS's own static `Texture.WHITE`**
  (a shared `BufferImageSource`). It is internal to PixiJS v8 when an application
  is destroyed and recreated, bounded (≈ 1 MB after a thousand matches) and not
  reachable from game code. Keeping one Pixi application alive for the whole
  session would avoid it, at the cost of the simpler create/destroy lifecycle
  required by the challenge (clean restart, StrictMode safety).
- While investigating, one per-match allocation of ours was removed: the splash
  ring texture used to be generated per renderer (`renderer.generateTexture`);
  it is now drawn once on a 2D canvas and shared by every match, like all other
  textures.

## Optimisations in place

- **Atlases and shared textures:** one ship/effects atlas, one UI atlas and one
  tilesheet, loaded once and reused by every match (never reloaded on restart).
- **Static tilemap cached as a texture** (`cacheAsTexture`, integer resolution):
  ~100 tile sprites cost a single draw.
- **Pooling:** projectiles (simulation objects and their sprites), effects
  (muzzle flashes, splashes, debris, explosions, sinking hulls) and health-bar fill
  textures are pooled; nothing is created per frame in steady state.
- **Allocation-light simulation:** fixed-step core with typed-array spatial grid,
  reusable snapshot view and output objects; ~0.2 ms per tick.
- **React outside the loop:** the HUD store only publishes when a displayed value
  changes (hp, score, whole seconds, phase), so React renders a few times per
  second at most, never per frame.
- **Code splitting:** PixiJS and the game load only when a match starts. Production
  JavaScript: entry 238 kB (74 kB gzip); mocks and shared libraries 431 kB
  (161 kB gzip, loaded before the first render so MSW intercepts the first query);
  game screen 76 kB (26 kB gzip) + textures module 31 kB (11 kB gzip).
- **Audio:** WAV assets compressed to OGG/M4A (5.8 MB → ~0.55 MB), decoded once.

## Limitations observed

- Measurements are **headless**. With the GPU flags (`--enable-gpu
--ignore-gpu-blocklist --use-angle=d3d11`) Chromium renders on the real GPU and
  `requestAnimationFrame` runs at 60 Hz; a headed browser on a 120/144 Hz display
  would run the loop faster (the fixed-step simulation is unaffected).
- Without hardware acceleration (software GL) the game is rasterisation-bound at
  ~20 FPS on this CPU; the simulation remains deterministic and correct because it
  advances in fixed steps independent of the frame rate.
- Browsers throttle `requestAnimationFrame` in background tabs; the game pauses
  automatically when hidden, and real frame time is clamped (100 ms) so a hitch
  never causes a burst of catch-up steps.
- `performance.memory` and `HeapProfiler` are Chromium-only; memory figures for
  other browsers were not collected.
- A manual Chrome DevTools Performance recording was not included; the automated
  CDP measurements above are reproducible with `npm run perf`.

## Reproducing

```bash
npx playwright install chromium
npm run perf                      # GPU reference (match + memory), writes docs/profiling/*.json
PERF_SOFTWARE_GL=1 npm run perf   # software rendering lower bound
PERF_CYCLES=12 PERF_PLAY_MS=10000 npx playwright test -c playwright.perf.config.ts e2e/perf/memory.perf.ts
npm run perf:report               # regenerates docs/profiling/REPORT.md
```

Open `/?perf=1` (optionally with `&preset=stress&seed=3`) in any browser to see the
live overlay; `window.__PB_PERF__.report()` returns the same numbers.
