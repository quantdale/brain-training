// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';
import { createFakeClock, createMonotonicClock, Stopwatch, systemClock } from '../timing';

describe('createFakeClock', () => {
  it('starts at the given time and tracks advance/set', () => {
    const clock = createFakeClock(1000);
    expect(clock.now()).toBe(1000);
    expect(clock.advance(250)).toBe(1250);
    expect(clock.now()).toBe(1250);
    clock.set(500);
    expect(clock.now()).toBe(500);
  });

  it('allows negative advance for rewinding test scenarios', () => {
    const clock = createFakeClock(100);
    clock.advance(-40);
    expect(clock.now()).toBe(60);
  });
});

describe('Stopwatch', () => {
  it('reports 0 before start and measures against the injected clock', () => {
    const clock = createFakeClock(0);
    const watch = new Stopwatch(clock);
    expect(watch.elapsedMs()).toBe(0);
    expect(watch.isRunning).toBe(false);

    watch.start();
    expect(watch.isRunning).toBe(true);
    clock.advance(1500);
    expect(watch.elapsedMs()).toBe(1500);

    watch.reset();
    expect(watch.elapsedMs()).toBe(0);
    expect(watch.isRunning).toBe(false);
  });

  it('restarts from zero on a second start()', () => {
    const clock = createFakeClock(0);
    const watch = new Stopwatch(clock);
    watch.start();
    clock.advance(500);
    watch.start();
    clock.advance(100);
    expect(watch.elapsedMs()).toBe(100);
  });
});

describe('systemClock', () => {
  it('returns a finite non-negative millisecond value', () => {
    const now = systemClock.now();
    expect(Number.isFinite(now)).toBe(true);
    expect(now).toBeGreaterThanOrEqual(0);
  });

  it('is monotonic in practice over short intervals', () => {
    const a = systemClock.now();
    const b = systemClock.now();
    expect(b).toBeGreaterThanOrEqual(a);
  });

  it('clamps a wall-clock rollback in the fallback source', () => {
    const samples = [1000, 1200, 900, 950, 1400];
    const clock = createMonotonicClock(() => samples.shift() ?? 1400);
    expect(clock.now()).toBe(1000);
    expect(clock.now()).toBe(1200);
    expect(clock.now()).toBe(1200);
    expect(clock.now()).toBe(1200);
    expect(clock.now()).toBe(1400);
  });
});
