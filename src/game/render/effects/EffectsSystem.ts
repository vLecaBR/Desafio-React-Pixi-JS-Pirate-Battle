import type { Texture } from 'pixi.js';
import { Container, Sprite } from 'pixi.js';
import { forwardX, forwardY } from '../../core/math.ts';
import type { ShipKind } from '../../core/types.ts';
import { RENDER } from '../renderConfig.ts';
import type { GameTextures } from '../textures.ts';

interface Particle {
  readonly sprite: Sprite;
  active: boolean;
  age: number;
  life: number;
  vx: number;
  vy: number;
  spin: number;
  scaleFrom: number;
  scaleTo: number;
  alphaFrom: number;
  alphaTo: number;
  /** Optional flip-book animation over the particle's life. */
  frames: readonly Texture[] | null;
}

interface SpawnOptions {
  texture: Texture;
  x: number;
  y: number;
  life: number;
  rotation?: number;
  vx?: number;
  vy?: number;
  spin?: number;
  scaleFrom?: number;
  scaleTo?: number;
  alphaFrom?: number;
  alphaTo?: number;
  tint?: number;
  frames?: readonly Texture[];
}

/**
 * Pooled visual effects (muzzle flashes, splashes, impacts, explosions, wood debris,
 * sinking hulls). Sprites are recycled, so long matches do not grow memory or
 * create garbage. Effects are cosmetic only and never influence the simulation;
 * the small randomness here intentionally does not use the simulation RNG.
 */
export class EffectsSystem {
  readonly container = new Container({ label: 'effects' });
  private readonly particles: Particle[] = [];
  private readonly free: Particle[] = [];
  private seed = 1;

  constructor(
    private readonly textures: GameTextures,
    private readonly ringTexture: Texture,
  ) {}

  get activeCount(): number {
    return this.particles.length - this.free.length;
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        this.release(p);
        continue;
      }
      const t = p.age / p.life;
      const s = p.sprite;
      s.x += p.vx * dt;
      s.y += p.vy * dt;
      s.rotation += p.spin * dt;
      s.scale.set(p.scaleFrom + (p.scaleTo - p.scaleFrom) * t);
      s.alpha = p.alphaFrom + (p.alphaTo - p.alphaFrom) * t;
      if (p.frames) {
        const frame = p.frames[Math.min(p.frames.length - 1, Math.floor(t * p.frames.length))];
        if (frame && s.texture !== frame) s.texture = frame;
      }
    }
  }

  muzzleFlash(x: number, y: number, heading: number): void {
    const fx = RENDER.effects;
    this.spawn({
      texture: this.textures.explosions[2],
      x,
      y,
      life: fx.muzzleFlashSec,
      rotation: heading,
      vx: forwardX(heading) * 40,
      vy: forwardY(heading) * 40,
      scaleFrom: fx.muzzleFlashScale,
      scaleTo: fx.muzzleFlashScale * 1.4,
      alphaFrom: 1,
      alphaTo: 0,
    });
  }

  /** Expanding ring on the water where a shot ends. */
  splash(x: number, y: number): void {
    this.spawn({
      texture: this.ringTexture,
      x,
      y,
      life: RENDER.effects.splashSec,
      scaleFrom: 0.25,
      scaleTo: 1,
      alphaFrom: 0.9,
      alphaTo: 0,
    });
  }

  /** Small puff where a shot hits an island or rock. */
  dust(x: number, y: number): void {
    this.spawn({
      texture: this.textures.explosions[2],
      x,
      y,
      life: RENDER.effects.impactSec,
      scaleFrom: 0.2,
      scaleTo: 0.45,
      alphaFrom: 0.8,
      alphaTo: 0,
      tint: 0xcfc6b8,
      spin: 2,
    });
  }

  /** Hit on a hull: small blast plus a few wood splinters. */
  impact(x: number, y: number): void {
    this.spawn({
      texture: this.textures.explosions[2],
      x,
      y,
      life: RENDER.effects.impactSec,
      scaleFrom: 0.35,
      scaleTo: 0.6,
      alphaFrom: 1,
      alphaTo: 0,
      spin: this.random(-3, 3),
    });
    this.debris(x, y, 3, 0.7);
  }

  /** Ship destroyed: 3-frame explosion, debris and the sinking grey hull. */
  explosion(kind: ShipKind, x: number, y: number, heading: number): void {
    const fx = RENDER.effects;
    this.spawn({
      texture: this.textures.ship(kind, 3),
      x,
      y,
      rotation: heading,
      life: RENDER.ship.sinkSec,
      scaleFrom: 1,
      scaleTo: 0.82,
      alphaFrom: 1,
      alphaTo: 0,
      spin: this.random(-0.25, 0.25),
    });
    const [big, medium, small] = this.textures.explosions;
    this.spawn({
      texture: small,
      frames: [small, medium, big],
      x,
      y,
      life: fx.explosionSec,
      scaleFrom: 0.9,
      scaleTo: 1.5,
      alphaFrom: 1,
      alphaTo: 0.2,
      spin: this.random(-1, 1),
    });
    this.debris(x, y, 6, 1);
    this.splash(x, y);
  }

  private debris(x: number, y: number, count: number, strength: number): void {
    const fx = RENDER.effects;
    for (let i = 0; i < count; i++) {
      const angle = this.random(0, Math.PI * 2);
      const speed = fx.debrisSpeed * strength * this.random(0.5, 1);
      const texture = this.textures.wood[Math.floor(this.random(0, this.textures.wood.length))];
      if (!texture) continue;
      this.spawn({
        texture,
        x,
        y,
        life: fx.debrisSec * this.random(0.7, 1),
        rotation: angle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: this.random(-6, 6),
        scaleFrom: 0.9,
        scaleTo: 0.6,
        alphaFrom: 1,
        alphaTo: 0,
      });
    }
  }

  private spawn(options: SpawnOptions): void {
    const p = this.free.pop() ?? this.create();
    const s = p.sprite;
    s.texture = options.texture;
    s.position.set(options.x, options.y);
    s.rotation = options.rotation ?? 0;
    s.tint = options.tint ?? 0xffffff;
    s.visible = true;
    p.active = true;
    p.age = 0;
    p.life = options.life;
    p.vx = options.vx ?? 0;
    p.vy = options.vy ?? 0;
    p.spin = options.spin ?? 0;
    p.scaleFrom = options.scaleFrom ?? 1;
    p.scaleTo = options.scaleTo ?? p.scaleFrom;
    p.alphaFrom = options.alphaFrom ?? 1;
    p.alphaTo = options.alphaTo ?? p.alphaFrom;
    p.frames = options.frames ?? null;
    s.scale.set(p.scaleFrom);
    s.alpha = p.alphaFrom;
  }

  private create(): Particle {
    const sprite = new Sprite({ anchor: 0.5 });
    this.container.addChild(sprite);
    const particle: Particle = {
      sprite,
      active: false,
      age: 0,
      life: 0,
      vx: 0,
      vy: 0,
      spin: 0,
      scaleFrom: 1,
      scaleTo: 1,
      alphaFrom: 1,
      alphaTo: 1,
      frames: null,
    };
    this.particles.push(particle);
    return particle;
  }

  private release(p: Particle): void {
    p.active = false;
    p.sprite.visible = false;
    this.free.push(p);
  }

  /** Tiny LCG: cosmetic variety without touching the simulation RNG. */
  private random(min: number, max: number): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return min + (max - min) * (this.seed / 4294967296);
  }

  destroy(): void {
    this.particles.length = 0;
    this.free.length = 0;
    this.container.destroy({ children: true });
  }
}
