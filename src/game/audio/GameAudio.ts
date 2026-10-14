import type { Simulation } from '../core/Simulation.ts';
import { audio, SOUND_IDS, type SoundId } from './AudioManager.ts';

const LOW_HEALTH_RATIO = 0.3;
const TIME_WARNING_SEC = 10;
const OCEAN_VOLUME = 0.3;
const SAILING_MAX_VOLUME = 0.35;

/**
 * Maps simulation events to sounds for one match. Purely reactive: it listens to
 * events and reads the snapshot, never changing the game. Disposed with the match.
 */
export class GameAudio {
  private readonly unsubscribe: (() => void)[] = [];
  private shotVariant = 0;
  private lowHealthPlayed = false;
  private timeWarningPlayed = false;
  private sailingVolume = 0;

  constructor(private readonly sim: Simulation) {
    audio.preload(SOUND_IDS);
    const fire: readonly SoundId[] = ['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'];
    const nextFire = () => fire[this.shotVariant++ % fire.length] ?? 'cannon_fire_1';

    this.unsubscribe.push(
      sim.on('shotFired', (e) => {
        if (e.team === 'enemy') audio.play(nextFire(), { volume: 0.3, rate: 0.9 });
        else if (e.weapon === 'front') audio.play(nextFire(), { volume: 0.55 });
        else audio.play('cannon_broadside', { volume: 0.65 });
      }),
      sim.on('projectileHit', (e) => {
        if (e.target === 'ship') {
          audio.play(e.projectileId % 2 ? 'ship_wood_hit_1' : 'ship_wood_hit_2', { volume: 0.6 });
        } else {
          audio.play('cannonball_water_hit_2', { volume: 0.3, rate: 0.8 });
        }
      }),
      sim.on('projectileExpired', (e) => {
        if (e.reason === 'range' || e.reason === 'lifetime') {
          audio.play(e.projectileId % 2 ? 'cannonball_water_hit_1' : 'cannonball_water_hit_2', {
            volume: 0.25,
          });
        }
      }),
      sim.on('shipDamaged', (e) => {
        if (e.kind === 'player' && e.source === 'contact') {
          audio.play('ship_collision', { volume: 0.8 });
        }
        if (e.kind === 'player' && !this.lowHealthPlayed && e.hp > 0) {
          if (e.hp / e.maxHp <= LOW_HEALTH_RATIO) {
            this.lowHealthPlayed = true;
            audio.play('health_low', { volume: 0.6 });
          }
        }
      }),
      sim.on('enemyDestroyed', (e) => {
        audio.play(e.enemyId % 2 ? 'ship_explosion_1' : 'ship_explosion_2', { volume: 0.7 });
        if (e.killedBy === 'player') audio.play('score_point', { volume: 0.45 });
      }),
      sim.on('playerDestroyed', () => {
        audio.play('ship_explosion_2', { volume: 0.9 });
        audio.play('ship_sinking', { volume: 0.7 });
      }),
      sim.on('matchEnded', (result) => {
        audio.stopLoop('ship_sailing_loop');
        audio.stopLoop('ocean_ambience_loop');
        audio.play(result.endReason === 'time_up' ? 'game_complete' : 'game_over', {
          volume: 0.7,
        });
      }),
    );
  }

  start(): void {
    audio.play('game_start', { volume: 0.6 });
    audio.startLoop('ocean_ambience_loop', OCEAN_VOLUME);
    audio.startLoop('ship_sailing_loop', 0);
  }

  /** Called every rendered frame; only touches audio when values change. */
  update(): void {
    const snapshot = this.sim.snapshot();
    const { player } = snapshot;
    const target = player.alive
      ? (player.speed / this.sim.config.player.moveSpeed) * SAILING_MAX_VOLUME
      : 0;
    if (Math.abs(target - this.sailingVolume) > 0.02) {
      this.sailingVolume = target;
      audio.setLoopVolume('ship_sailing_loop', target);
    }
    if (
      !this.timeWarningPlayed &&
      snapshot.phase === 'running' &&
      snapshot.remainingSec <= TIME_WARNING_SEC
    ) {
      this.timeWarningPlayed = true;
      audio.play('time_warning', { volume: 0.6 });
    }
  }

  setPaused(paused: boolean): void {
    audio.play(paused ? 'game_pause' : 'game_resume', { volume: 0.5 });
    audio.setLoopsSuspended(paused);
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    audio.stopAllLoops();
  }
}
