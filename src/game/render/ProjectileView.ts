import { Container, Sprite, Texture } from 'pixi.js';
import type { Projectile } from '../core/types.ts';
import { RENDER } from './renderConfig.ts';
import type { GameTextures } from './textures.ts';

interface ProjectileSprites {
  readonly ball: Sprite;
  readonly trail: Sprite;
}

/**
 * Draws every live projectile as a cannonball with a fading white trail.
 * Sprites are pooled and matched to projectiles by index each frame, so no
 * per-projectile objects are created during play.
 */
export class ProjectileLayer {
  readonly container = new Container({ label: 'projectiles' });
  private readonly trails = new Container({ label: 'trails' });
  private readonly balls = new Container({ label: 'balls' });
  private readonly pool: ProjectileSprites[] = [];
  private used = 0;

  constructor(private readonly textures: GameTextures) {
    this.container.addChild(this.trails, this.balls);
  }

  get activeCount(): number {
    return this.used;
  }

  sync(projectiles: readonly Readonly<Projectile>[], alpha: number): void {
    let index = 0;
    for (const p of projectiles) {
      if (!p.alive) continue;
      const sprites = this.pool[index] ?? this.create();
      index++;
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const y = p.prevY + (p.y - p.prevY) * alpha;
      sprites.ball.visible = true;
      sprites.ball.position.set(x, y);
      sprites.ball.tint = p.team === 'enemy' ? 0x3a3a3a : 0xffffff;

      const length = Math.min(RENDER.projectile.trailLength, Math.max(2, p.traveled));
      sprites.trail.visible = true;
      sprites.trail.position.set(x, y);
      sprites.trail.height = length;
      // The trail sprite grows along its local +Y axis; point it behind the ball.
      sprites.trail.rotation = Math.atan2(p.dirX, -p.dirY);
    }
    for (let i = index; i < this.used; i++) {
      const sprites = this.pool[i];
      if (!sprites) continue;
      sprites.ball.visible = false;
      sprites.trail.visible = false;
    }
    this.used = index;
  }

  private create(): ProjectileSprites {
    const ball = new Sprite({ texture: this.textures.cannonBall, anchor: 0.5 });
    const trail = new Sprite({ texture: Texture.WHITE, anchor: { x: 0.5, y: 0 } });
    trail.width = RENDER.projectile.trailWidth;
    trail.alpha = RENDER.projectile.trailAlpha;
    this.trails.addChild(trail);
    this.balls.addChild(ball);
    const sprites = { ball, trail };
    this.pool.push(sprites);
    return sprites;
  }

  destroy(): void {
    this.pool.length = 0;
    this.container.destroy({ children: true });
  }
}
