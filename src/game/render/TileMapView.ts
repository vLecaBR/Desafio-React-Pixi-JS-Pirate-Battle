import { Container, Graphics, Sprite } from 'pixi.js';
import type { GameMap } from '../core/world/map.ts';
import { RENDER } from './renderConfig.ts';
import type { GameTextures } from './textures.ts';

/**
 * Static arena decoration: shallow-water halos, island tiles and objects.
 * Built once per match and rendered to a cached texture (`cacheAsTexture`), so
 * the ~100 tile sprites cost a single draw per frame. The cache is refreshed at the
 * right resolution whenever the viewport scale changes.
 */
export class TileMapView {
  readonly container = new Container({ label: 'tilemap' });
  private cachedResolution = 0;

  constructor(map: GameMap, textures: GameTextures) {
    const shallows = new Graphics({ label: 'shallows' });
    const { padding, radius, alpha } = RENDER.shallows;
    for (const island of map.islands) {
      shallows.roundRect(
        island.col * map.tileSize - padding,
        island.row * map.tileSize - padding,
        island.cols * map.tileSize + padding * 2,
        island.rows * map.tileSize + padding * 2,
        radius,
      );
    }
    shallows.fill({ color: 0xffffff, alpha });
    this.container.addChild(shallows);

    for (const layer of [0, 1] as const) {
      for (const tile of map.tiles) {
        if (tile.layer !== layer) continue;
        const sprite = new Sprite(textures.tile(tile.tile));
        sprite.position.set(tile.col * map.tileSize, tile.row * map.tileSize);
        sprite.setSize(map.tileSize, map.tileSize);
        this.container.addChild(sprite);
      }
    }
  }

  /**
   * Re-renders the cache when the effective pixel density changes. An integer
   * resolution keeps every 64 px tile on whole pixels inside the cache, which avoids
   * hairline seams between tiles; the cached texture is then smoothly scaled.
   */
  updateResolution(viewportScale: number, devicePixelRatio: number): void {
    const resolution = Math.min(3, Math.max(1, Math.ceil(viewportScale * devicePixelRatio - 0.01)));
    if (Math.abs(resolution - this.cachedResolution) < 0.01) return;
    this.cachedResolution = resolution;
    if (this.container.isCachedAsTexture) this.container.cacheAsTexture(false);
    this.container.cacheAsTexture({ resolution, antialias: true });
  }

  destroy(): void {
    if (this.container.isCachedAsTexture) this.container.cacheAsTexture(false);
    // Tile textures are shared and cached; only the display objects are destroyed.
    this.container.destroy({ children: true });
  }
}
