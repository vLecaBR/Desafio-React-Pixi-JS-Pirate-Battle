import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './clock.ts';
import { EventBus } from './EventBus.ts';
import {
  angleDelta,
  circleAabbPush,
  forwardX,
  forwardY,
  headingOf,
  rotateTowards,
  segmentAabbT,
  segmentCircleT,
  wrapAngle,
} from './math.ts';
import { Rng, seedFromString } from './rng.ts';

describe('math', () => {
  it('uses heading 0 = north and clockwise angles', () => {
    expect(forwardX(0)).toBeCloseTo(0);
    expect(forwardY(0)).toBeCloseTo(-1);
    expect(forwardX(Math.PI / 2)).toBeCloseTo(1);
    expect(forwardY(Math.PI / 2)).toBeCloseTo(0);
    expect(headingOf(0, -1)).toBeCloseTo(0);
    expect(headingOf(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(headingOf(0, 1)).toBeCloseTo(Math.PI);
  });

  it('wraps angles and computes the shortest difference', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
  });

  it('rotates towards a target without overshooting', () => {
    expect(rotateTowards(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(rotateTowards(0, 0.1, 0.25)).toBeCloseTo(0.1);
    expect(rotateTowards(Math.PI - 0.1, -Math.PI + 0.1, 0.05)).toBeCloseTo(Math.PI - 0.05);
  });

  it('sweeps segments against circles and boxes', () => {
    expect(segmentCircleT(0, 0, 10, 0, 5, 0, 1)).toBeCloseTo(0.4);
    expect(segmentCircleT(0, 0, 10, 0, 5, 5, 1)).toBe(Infinity);
    expect(segmentCircleT(5, 0, 10, 0, 5, 0, 1)).toBe(0);
    expect(segmentAabbT(0, 5, 10, 5, 4, 0, 6, 10)).toBeCloseTo(0.4);
    expect(segmentAabbT(0, 50, 10, 50, 4, 0, 6, 10)).toBe(Infinity);
  });

  it('pushes circles out of boxes, including from inside', () => {
    const out = { x: 0, y: 0 };
    expect(circleAabbPush(0, 5, 2, 1, 0, 10, 10, out)).toBe(true);
    expect(out.x).toBeCloseTo(-1);
    expect(circleAabbPush(2, 5, 1, 1, 0, 10, 10, out)).toBe(true);
    expect(out.x).toBeCloseTo(-2);
    expect(circleAabbPush(-5, 5, 1, 1, 0, 10, 10, out)).toBe(false);
  });
});

describe('Rng', () => {
  it('is deterministic per seed and uniform enough', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const values = Array.from({ length: 1000 }, () => a.next());
    expect(Array.from({ length: 1000 }, () => b.next())).toEqual(values);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('respects weights', () => {
    const rng = new Rng(7);
    const counts = { a: 0, b: 0, never: 0 };
    for (let i = 0; i < 2000; i++) counts[rng.weighted({ a: 3, b: 1, never: 0 })]++;
    expect(counts.never).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.4);
    expect(counts.a / counts.b).toBeLessThan(3.6);
  });

  it('derives stable seeds from strings', () => {
    expect(seedFromString('pirate')).toBe(seedFromString('pirate'));
    expect(seedFromString('pirate')).not.toBe(seedFromString('battle'));
  });
});

describe('FixedStepClock', () => {
  it('converts real time into whole fixed steps and keeps the remainder', () => {
    const clock = new FixedStepClock(1 / 60, 0.1);
    expect(clock.advance(1 / 120)).toBe(0);
    expect(clock.alpha).toBeCloseTo(0.5);
    expect(clock.advance(1 / 120)).toBe(1);
    expect(clock.advance(0.05)).toBe(3);
  });

  it('clamps long frames and can be reset', () => {
    const clock = new FixedStepClock(1 / 60, 0.1);
    expect(clock.advance(5)).toBe(6);
    clock.advance(0.01);
    clock.reset();
    expect(clock.alpha).toBe(0);
    expect(clock.advance(-1)).toBe(0);
    expect(clock.advance(Number.NaN)).toBe(0);
  });
});

describe('EventBus', () => {
  it('delivers typed events and supports unsubscribe and clear', () => {
    const bus = new EventBus<{ ping: { n: number } }>();
    const received: number[] = [];
    const off = bus.on('ping', ({ n }) => received.push(n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    bus.on('ping', ({ n }) => received.push(n * 10));
    bus.clear();
    bus.emit('ping', { n: 3 });
    expect(received).toEqual([1]);
    expect(bus.size).toBe(0);
  });
});
