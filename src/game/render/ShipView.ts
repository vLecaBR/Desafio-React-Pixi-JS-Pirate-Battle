import { Container, Sprite } from 'pixi.js';
import type { ShipKind } from '../core/types.ts';
import { HealthBarView, type FillTextureCache } from './HealthBarView.ts';
import { RENDER } from './renderConfig.ts';
import type { GameTextures } from './textures.ts';

/**
 * Visual representation of one ship: hull sprite (texture swapped by damage state),
 * flames when badly damaged, a red flash when hit, and its health bar (kept in a
 * separate layer so bars always draw above every ship).
 */
export class ShipView {
  readonly container = new Container({ label: 'ship' });
  readonly bar: HealthBarView;
  private readonly hull: Sprite;
  private readonly flames: Sprite[];
  private damageState = -1;
  private flashSec = 0;
  private flickerSec = 0;
  private flickerFrame = 0;
  private readonly barHalfHeight: number;

  constructor(
    readonly kind: ShipKind,
    private readonly textures: GameTextures,
    barCache: FillTextureCache,
    private readonly damageStages: readonly number[],
  ) {
    this.hull = new Sprite({ texture: textures.ship(kind, 0), anchor: 0.5 });
    this.flames = [
      new Sprite({ texture: textures.fires[0], anchor: { x: 0.5, y: 0.9 }, visible: false }),
      new Sprite({ texture: textures.fires[1], anchor: { x: 0.5, y: 0.9 }, visible: false }),
    ];
    this.flames[0]?.position.set(-8, 6);
    this.flames[1]?.position.set(10, -18);
    this.container.addChild(this.hull, ...this.flames);
    this.bar = new HealthBarView(textures, barCache);
    this.barHalfHeight = (textures.enemyBarFrame.height * RENDER.healthBar.scale) / 2;
  }

  /** Damage state 0 (intact) .. 2 (heavily damaged); 3 is the sunk sprite. */
  private stateFor(ratio: number): number {
    let state = 0;
    for (const threshold of this.damageStages) {
      if (ratio < threshold) state++;
    }
    return Math.min(state, 2);
  }

  update(x: number, y: number, heading: number, hp: number, maxHp: number, dt: number): void {
    this.container.position.set(x, y);
    this.container.rotation = heading;

    const ratio = maxHp > 0 ? hp / maxHp : 0;
    const state = this.stateFor(ratio);
    if (state !== this.damageState) {
      this.damageState = state;
      this.hull.texture = this.textures.ship(this.kind, state);
    }

    const [firstFlame, secondFlame] = this.flames;
    const [fireBelow, moreFireBelow] = RENDER.ship.fireBelow;
    if (firstFlame) firstFlame.visible = ratio < fireBelow;
    if (secondFlame) secondFlame.visible = ratio < moreFireBelow;
    this.flickerSec -= dt;
    if (this.flickerSec <= 0) {
      this.flickerSec = RENDER.ship.fireFlickerSec;
      this.flickerFrame = 1 - this.flickerFrame;
      for (const [index, flame] of this.flames.entries()) {
        if (!flame.visible) continue;
        flame.scale.set(this.flickerFrame === index % 2 ? 1 : 0.85, 1);
      }
    }

    if (this.flashSec > 0) {
      this.flashSec = Math.max(0, this.flashSec - dt);
      this.hull.tint = this.flashSec > 0 ? RENDER.ship.hitTint : 0xffffff;
    }

    // Keep the bar inside the arena when the ship hugs the top edge.
    this.bar.container.position.set(x, Math.max(this.barHalfHeight, y + RENDER.healthBar.offsetY));
    const colour = this.kind === 'player' && ratio > RENDER.healthBar.lowRatio ? 'green' : 'red';
    this.bar.update(ratio, colour);
  }

  flash(): void {
    this.flashSec = RENDER.ship.hitFlashSec;
    this.hull.tint = RENDER.ship.hitTint;
  }

  destroy(): void {
    this.bar.destroy();
    this.container.destroy({ children: true });
  }
}
