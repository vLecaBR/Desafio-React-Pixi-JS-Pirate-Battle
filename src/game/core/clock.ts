/**
 * Converts variable real frame times into a whole number of fixed simulation steps.
 *
 * Real time is clamped to `maxFrameSec` (e.g. after a hitch or a hidden tab) so the
 * simulation never tries to catch up with a huge backlog. The leftover fraction is
 * exposed as `alpha` for render interpolation between the previous and current step.
 */
export class FixedStepClock {
  private accumulator = 0;

  constructor(
    readonly stepSec: number,
    readonly maxFrameSec: number,
  ) {
    if (stepSec <= 0 || maxFrameSec <= 0) throw new RangeError('FixedStepClock: invalid timing');
  }

  /** Adds real elapsed time and returns how many fixed steps are now due. */
  advance(realDeltaSec: number): number {
    if (!Number.isFinite(realDeltaSec) || realDeltaSec <= 0) return 0;
    this.accumulator += Math.min(realDeltaSec, this.maxFrameSec);
    const steps = Math.floor(this.accumulator / this.stepSec + 1e-9);
    this.accumulator = Math.max(0, this.accumulator - steps * this.stepSec);
    return steps;
  }

  /** Fraction (0..1) of a step accumulated but not yet simulated. */
  get alpha(): number {
    return Math.min(1, this.accumulator / this.stepSec);
  }

  /** Drops any accumulated time (used when pausing and resuming). */
  reset(): void {
    this.accumulator = 0;
  }
}
