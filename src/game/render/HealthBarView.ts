import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { RENDER } from './renderConfig.ts';
import type { GameTextures } from './textures.ts';

export type BarColour = 'green' | 'red';

/**
 * Health bar drawn above a ship, using the atlas frame + fill sprites.
 * The fill is clipped on the X axis from the left (as described by the atlas
 * `fill_rect` metadata) by using a sub-texture of the fill frame. Sub-textures are
 * cached per colour and pixel width, so updates never allocate after warm-up.
 */
export class HealthBarView {
  readonly container = new Container({ label: 'health-bar' });
  private readonly fill = new Sprite();
  private lastRatio = -1;
  private lastColour: BarColour | null = null;

  constructor(
    textures: GameTextures,
    private readonly cache: FillTextureCache,
  ) {
    const frame = new Sprite(textures.enemyBarFrame);
    const rect = textures.enemyBarFillRect;
    this.fill.position.set(rect.x, rect.y);
    this.container.addChild(frame, this.fill);
    this.container.scale.set(RENDER.healthBar.scale);
    this.container.pivot.set(textures.enemyBarFrame.width / 2, textures.enemyBarFrame.height / 2);
  }

  update(ratio: number, colour: BarColour): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (clamped === this.lastRatio && colour === this.lastColour) return;
    this.lastRatio = clamped;
    this.lastColour = colour;
    const texture = this.cache.get(colour, clamped);
    this.fill.texture = texture ?? Texture.EMPTY;
    this.fill.visible = texture !== null;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

/** Shared, per-renderer cache of clipped fill textures. */
export class FillTextureCache {
  private readonly entries = new Map<string, Texture>();

  constructor(private readonly textures: GameTextures) {}

  get(colour: BarColour, ratio: number): Texture | null {
    const rect = this.textures.enemyBarFillRect;
    const width = Math.round(rect.width * ratio);
    if (width <= 0) return null;
    const key = `${colour}:${width}`;
    let texture = this.entries.get(key);
    if (!texture) {
      const base = this.textures.enemyBarFill[colour];
      texture = new Texture({
        source: base.source,
        frame: new Rectangle(base.frame.x + rect.x, base.frame.y + rect.y, width, rect.height),
      });
      this.entries.set(key, texture);
    }
    return texture;
  }

  destroy(): void {
    // Only the lightweight Texture views are destroyed; the shared source stays.
    for (const texture of this.entries.values()) texture.destroy(false);
    this.entries.clear();
  }
}
