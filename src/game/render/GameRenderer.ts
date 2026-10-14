import { Container, Graphics, TilingSprite, type Application, type Texture } from 'pixi.js';
import { angleDelta } from '../core/math.ts';
import type { Simulation } from '../core/Simulation.ts';
import type { EnemyShip, PlayerShip } from '../core/types.ts';
import { EffectsSystem } from './effects/EffectsSystem.ts';
import { FillTextureCache } from './HealthBarView.ts';
import { ProjectileLayer } from './ProjectileView.ts';
import { RENDER } from './renderConfig.ts';
import { ShipView } from './ShipView.ts';
import type { GameTextures } from './textures.ts';
import { TileMapView } from './TileMapView.ts';
import { computeViewport, type ViewportLayout } from './viewport.ts';

export interface RendererStats {
  readonly ships: number;
  readonly projectiles: number;
  readonly effects: number;
  readonly displayObjects: number;
}

/**
 * Builds the PixiJS scene for one match and keeps it in sync with the simulation.
 *
 * Layers (bottom to top): water (fills the whole canvas, letterbox included),
 * then inside the scaled `world` container: tilemap, ships, projectiles, effects
 * and health bars. The renderer only reads `Simulation.snapshot()` and listens to
 * simulation events for one-shot effects; it never changes game state.
 */
export class GameRenderer {
  private readonly water: TilingSprite;
  /** Darkens the letterbox area and outlines the arena so its limits are visible. */
  private readonly outside = new Graphics({ label: 'arena-outside' });
  private readonly world = new Container({ label: 'world' });
  private readonly tileMap: TileMapView;
  private readonly shipLayer = new Container({ label: 'ships' });
  private readonly projectiles: ProjectileLayer;
  private readonly effects: EffectsSystem;
  private readonly barLayer = new Container({ label: 'health-bars' });
  private readonly barCache: FillTextureCache;
  private readonly ringTexture: Texture;
  private readonly playerView: ShipView;
  private readonly enemyViews = new Map<number, ShipView>();
  private readonly seen = new Set<number>();
  private readonly unsubscribe: (() => void)[] = [];
  private layout: ViewportLayout;
  private shake = 0;
  private time = 0;
  private readonly reducedMotion: boolean;

  constructor(
    private readonly app: Application,
    private readonly sim: Simulation,
    private readonly textures: GameTextures,
  ) {
    const { map, config } = sim;
    this.water = new TilingSprite({ texture: textures.water, width: 1, height: 1 });
    this.tileMap = new TileMapView(map, textures);
    this.barCache = new FillTextureCache(textures);
    this.projectiles = new ProjectileLayer(textures);
    this.ringTexture = createRingTexture(app);
    this.effects = new EffectsSystem(textures, this.ringTexture);

    this.world.addChild(
      this.tileMap.container,
      this.shipLayer,
      this.projectiles.container,
      this.effects.container,
      this.barLayer,
    );
    app.stage.addChild(this.water, this.outside, this.world);

    this.playerView = this.createShipView('player');
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.layout = computeViewport(1, 1, config.world.widthPx, config.world.heightPx);
    this.resize(app.screen.width, app.screen.height);
    this.subscribe();
  }

  private createShipView(kind: PlayerShip['kind'] | EnemyShip['kind']): ShipView {
    const view = new ShipView(
      kind,
      this.textures,
      this.barCache,
      this.sim.config.visuals.damageStages,
    );
    this.shipLayer.addChild(view.container);
    this.barLayer.addChild(view.bar.container);
    return view;
  }

  /** Effects for one-shot simulation events. */
  private subscribe(): void {
    const { sim, effects } = this;
    this.unsubscribe.push(
      sim.on('shotFired', (e) => {
        effects.muzzleFlash(e.x, e.y, e.heading);
      }),
      sim.on('projectileHit', (e) => {
        if (e.target === 'ship') effects.impact(e.x, e.y);
        else effects.dust(e.x, e.y);
      }),
      sim.on('projectileExpired', (e) => {
        if (e.reason !== 'outOfBounds') effects.splash(e.x, e.y);
      }),
      sim.on('shipDamaged', (e) => {
        const view = e.kind === 'player' ? this.playerView : this.enemyViews.get(e.shipId);
        view?.flash();
        if (e.kind === 'player') this.addShake(RENDER.shake.playerHit);
      }),
      sim.on('enemyDestroyed', (e) => {
        effects.explosion(e.kind, e.x, e.y, e.heading);
        this.removeEnemyView(e.enemyId);
      }),
      sim.on('playerDestroyed', (e) => {
        effects.explosion('player', e.x, e.y, e.heading);
        this.playerView.container.visible = false;
        this.playerView.bar.container.visible = false;
        this.addShake(RENDER.shake.playerDestroyed);
      }),
    );
  }

  private addShake(amount: number): void {
    if (!this.reducedMotion) this.shake = Math.max(this.shake, amount);
  }

  /**
   * Syncs every view with the latest simulation state.
   * @param alpha interpolation factor between the previous and current step (0..1)
   * @param dt real seconds since the last frame (cosmetic animations only)
   */
  render(alpha: number, dt: number): void {
    const snapshot = this.sim.snapshot();
    this.time += dt;

    const { player } = snapshot;
    if (player.alive) syncShip(this.playerView, player, alpha, dt);

    this.seen.clear();
    for (const enemy of snapshot.enemies) {
      if (!enemy.alive) continue;
      this.seen.add(enemy.id);
      let view = this.enemyViews.get(enemy.id);
      if (!view) {
        view = this.createShipView(enemy.kind);
        this.enemyViews.set(enemy.id, view);
      }
      syncShip(view, enemy, alpha, dt);
    }
    for (const id of this.enemyViews.keys()) {
      if (!this.seen.has(id)) this.removeEnemyView(id);
    }

    this.projectiles.sync(snapshot.projectiles, alpha);
    this.effects.update(dt);

    // Water drift and screen shake are purely cosmetic.
    const { scale, offsetX, offsetY } = this.layout;
    this.water.tilePosition.set(
      offsetX + this.time * RENDER.waterDrift.x * scale,
      offsetY + this.time * RENDER.waterDrift.y * scale,
    );
    let shakeX = 0;
    let shakeY = 0;
    if (this.shake > 0) {
      shakeX = (Math.sin(this.time * 91) * this.shake) / 2;
      shakeY = (Math.cos(this.time * 77) * this.shake) / 2;
      this.shake = Math.max(0, this.shake - RENDER.shake.decayPerSec * dt);
    }
    this.world.position.set(offsetX + shakeX * scale, offsetY + shakeY * scale);
  }

  resize(width: number, height: number): void {
    const { config } = this.sim;
    this.layout = computeViewport(width, height, config.world.widthPx, config.world.heightPx);
    const { scale, offsetX, offsetY } = this.layout;
    this.world.scale.set(scale);
    this.world.position.set(offsetX, offsetY);
    this.water.setSize(width, height);
    this.water.tileScale.set(scale);
    const worldWidth = config.world.widthPx * scale;
    const worldHeight = config.world.heightPx * scale;
    this.outside
      .clear()
      .rect(0, 0, width, height)
      .fill({ color: RENDER.outside.color, alpha: RENDER.outside.alpha })
      .rect(offsetX, offsetY, worldWidth, worldHeight)
      .cut()
      .rect(offsetX, offsetY, worldWidth, worldHeight)
      .stroke({ color: 0xffffff, alpha: RENDER.outside.borderAlpha, width: 2, alignment: 1 });
    this.tileMap.updateResolution(scale, this.app.renderer.resolution);
  }

  get viewport(): ViewportLayout {
    return this.layout;
  }

  get stats(): RendererStats {
    return {
      ships: this.enemyViews.size + (this.playerView.container.visible ? 1 : 0),
      projectiles: this.projectiles.activeCount,
      effects: this.effects.activeCount,
      displayObjects: countDisplayObjects(this.app.stage),
    };
  }

  private removeEnemyView(id: number): void {
    const view = this.enemyViews.get(id);
    if (!view) return;
    this.enemyViews.delete(id);
    view.destroy();
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    for (const view of this.enemyViews.values()) view.destroy();
    this.enemyViews.clear();
    this.playerView.destroy();
    this.projectiles.destroy();
    this.effects.destroy();
    this.tileMap.destroy();
    this.barCache.destroy();
    this.world.destroy({ children: true });
    this.water.destroy();
    this.outside.destroy();
    // The ring texture is owned by this renderer (the others are shared).
    this.ringTexture.destroy(true);
  }
}

function syncShip(
  view: ShipView,
  ship: Readonly<PlayerShip | EnemyShip>,
  alpha: number,
  dt: number,
) {
  const x = ship.prevX + (ship.x - ship.prevX) * alpha;
  const y = ship.prevY + (ship.y - ship.prevY) * alpha;
  const heading = ship.prevHeading + angleDelta(ship.prevHeading, ship.heading) * alpha;
  view.update(x, y, heading, ship.hp, ship.maxHp, dt);
}

function createRingTexture(app: Application): Texture {
  const ring = new Graphics().circle(0, 0, 18).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
  const texture = app.renderer.generateTexture({ target: ring, resolution: 2, antialias: true });
  ring.destroy();
  return texture;
}

function countDisplayObjects(root: Container): number {
  let count = 1;
  for (const child of root.children) count += countDisplayObjects(child);
  return count;
}
