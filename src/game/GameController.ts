import { Application, type Ticker } from 'pixi.js';
import { GameAudio } from './audio/GameAudio.ts';
import type { GameConfig } from './config/gameConfig.ts';
import { FixedStepClock } from './core/clock.ts';
import { Simulation, type SimulationSetup } from './core/Simulation.ts';
import type { MatchResult } from './core/types.ts';
import type { HudState, HudStore } from './hudStore.ts';
import { InputState } from './input/InputState.ts';
import { KeyboardInput } from './input/KeyboardInput.ts';
import { TouchInput } from './input/TouchInput.ts';
import { GameRenderer } from './render/GameRenderer.ts';
import { RENDER } from './render/renderConfig.ts';
import type { GameTextures } from './render/textures.ts';

export interface GameControllerOptions {
  readonly config: GameConfig;
  readonly seed: number;
  readonly textures: GameTextures;
  readonly hud: HudStore;
  readonly setup?: SimulationSetup;
  /**
   * Manual clock: the ticker only renders and the simulation advances solely via
   * `advance()`. Used by end-to-end tests to control time deterministically.
   */
  readonly manualClock?: boolean;
  readonly onMatchEnded?: (result: MatchResult) => void;
  readonly onPauseRequested?: () => void;
}

/**
 * Glue between the simulation, the PixiJS renderer, input and the React UI.
 *
 * Owns the Pixi `Application` and the match lifecycle:
 * `create()` -> `start()` -> (`pause()` / `resume()`)* -> `destroy()`.
 * The ticker accumulates real time into fixed simulation steps (FixedStepClock)
 * and renders with interpolation. `destroy()` releases listeners, the ticker, the
 * scene and the WebGL context, and is safe to call several times.
 */
export class GameController {
  readonly input = new InputState();
  /** Fed by the React touch controls; ignored while paused or after the match. */
  readonly touch = new TouchInput(this.input);
  private readonly app: Application;
  private readonly sim: Simulation;
  private readonly renderer: GameRenderer;
  private readonly keyboard: KeyboardInput;
  private readonly sounds: GameAudio;
  private readonly clock: FixedStepClock;
  private readonly unsubscribe: (() => void)[] = [];
  private started = false;
  private paused = false;
  private destroyed = false;

  /** Creates the Pixi application inside `host`. Async because WebGL init is async. */
  static async create(host: HTMLElement, options: GameControllerOptions): Promise<GameController> {
    const app = new Application();
    await app.init({
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      background: RENDER.background,
      preference: 'webgl',
    });
    return new GameController(host, app, options);
  }

  private constructor(
    host: HTMLElement,
    app: Application,
    private readonly options: GameControllerOptions,
  ) {
    this.app = app;
    const { config, seed, textures, setup } = options;
    this.sim = new Simulation({ config, seed, ...(setup ? { setup } : {}) });
    this.clock = new FixedStepClock(config.sim.fixedStepSec, config.sim.maxFrameSec);

    const canvas = app.canvas;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    host.appendChild(canvas);

    this.renderer = new GameRenderer(app, this.sim, textures);
    this.sounds = new GameAudio(this.sim);
    this.keyboard = new KeyboardInput(this.input, () => options.onPauseRequested?.());

    // Observe the host element itself (not only the window): covers layout changes,
    // mobile browser bars and orientation changes. Resizes synchronously.
    const observer = new ResizeObserver(() => {
      this.resizeToHost(host);
    });
    observer.observe(host);
    this.unsubscribe.push(() => {
      observer.disconnect();
    });
    this.resizeToHost(host);

    this.unsubscribe.push(
      this.sim.on('matchEnded', (result) => {
        this.keyboard.detach();
        this.touch.clear();
        this.publishHud();
        options.onMatchEnded?.(result);
      }),
    );
    this.publishHud();
  }

  private resizeToHost(host: HTMLElement): void {
    if (this.destroyed) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const { screen } = this.app.renderer;
    if (screen.width !== width || screen.height !== height) {
      this.app.renderer.resize(width, height);
    }
    this.renderer.resize(width, height);
    if (this.options.manualClock) this.app.render();
  }

  get simulation(): Simulation {
    return this.sim;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get rendererStats() {
    return this.renderer.stats;
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.keyboard.attach();
    this.clock.reset();
    this.sounds.start();
    this.app.ticker.add(this.tick);
    this.publishHud();
  }

  /** Suspends the simulation (time, cooldowns, spawns). Rendering continues. */
  pause(): void {
    if (this.destroyed || this.paused || this.sim.phase !== 'running') return;
    this.paused = true;
    this.releaseControls();
    this.keyboard.detach();
    this.sounds.setPaused(true);
    this.publishHud();
  }

  /** Resumes from a clean state: no accumulated time and no held controls. */
  resume(): void {
    if (this.destroyed || !this.paused) return;
    this.paused = false;
    this.releaseControls();
    this.sounds.setPaused(false);
    if (this.sim.phase === 'running') this.keyboard.attach();
    this.publishHud();
  }

  /**
   * Advances the simulation by real fixed steps covering `seconds` (respects pause
   * and match end), then renders one frame. Intended for the manual test clock.
   */
  advance(seconds: number): number {
    if (this.destroyed) return 0;
    let steps = 0;
    const total = Math.round(seconds / this.options.config.sim.fixedStepSec);
    for (; steps < total; steps++) {
      if (this.paused || !this.stepOnce()) break;
    }
    this.renderer.render(1, steps * this.options.config.sim.fixedStepSec);
    // Draw immediately: the ticker may be throttled (hidden tab, headless tests).
    this.app.render();
    this.publishHud();
    return steps;
  }

  private releaseControls(): void {
    this.clock.reset();
    this.keyboard.clear();
    this.touch.clear();
    this.input.clear();
    this.sim.clearIntents();
  }

  private stepOnce(): boolean {
    this.sim.setIntents(this.input.read());
    return this.sim.step();
  }

  private readonly tick = (ticker: Ticker): void => {
    const dt = ticker.deltaMS / 1000;
    if (!this.paused && !this.options.manualClock && this.sim.phase === 'running') {
      const steps = this.clock.advance(dt);
      for (let i = 0; i < steps; i++) {
        if (!this.stepOnce()) break;
      }
    }
    const alpha = this.paused || this.options.manualClock ? 1 : this.clock.alpha;
    this.renderer.render(alpha, Math.min(dt, this.options.config.sim.maxFrameSec));
    this.sounds.update();
    this.publishHud();
  };

  private publishHud(): void {
    const snapshot = this.sim.snapshot();
    const next: HudState = {
      phase:
        snapshot.phase === 'ended'
          ? 'ended'
          : this.paused
            ? 'paused'
            : this.started
              ? 'running'
              : 'starting',
      hp: snapshot.player.hp,
      maxHp: snapshot.player.maxHp,
      score: snapshot.score,
      remainingSec: Math.ceil(snapshot.remainingSec - 1e-9),
      endReason: snapshot.endReason,
      result: this.sim.matchResult,
    };
    const current = this.options.hud.getState();
    if (
      current.phase !== next.phase ||
      current.hp !== next.hp ||
      current.maxHp !== next.maxHp ||
      current.score !== next.score ||
      current.remainingSec !== next.remainingSec ||
      current.endReason !== next.endReason ||
      current.result !== next.result
    ) {
      this.options.hud.setState(next, true);
    }
  }

  /** Releases every resource. Idempotent; textures stay cached for the next match. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.ticker.remove(this.tick);
    this.keyboard.detach();
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.sounds.destroy();
    this.renderer.destroy();
    this.sim.destroy();
    // removeView detaches the canvas; shared textures stay in the Assets cache.
    this.app.destroy(
      { removeView: true },
      { children: true, texture: false, textureSource: false, context: true },
    );
  }
}
