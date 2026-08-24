// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { describe, expect, it } from '@jest/globals';
import { SessionLifecycle, IllegalTransitionError } from '../lifecycle';
import type { SessionStatus } from '../lifecycle';
import { createFakeClock } from '../timing';

describe('SessionLifecycle transitions', () => {
  it('walks the legal chain created → active → paused → active → completed', () => {
    const lifecycle = new SessionLifecycle();
    expect(lifecycle.status).toBe('created');
    lifecycle.start();
    expect(lifecycle.status).toBe('active');
    lifecycle.pause();
    expect(lifecycle.status).toBe('paused');
    lifecycle.resume();
    expect(lifecycle.status).toBe('active');
    lifecycle.complete();
    expect(lifecycle.status).toBe('completed');
  });

  it('allows complete and abandon from paused', () => {
    const completed = new SessionLifecycle();
    completed.start();
    completed.pause();
    completed.complete();
    expect(completed.status).toBe('completed');

    const abandoned = new SessionLifecycle();
    abandoned.start();
    abandoned.pause();
    abandoned.abandon();
    expect(abandoned.status).toBe('abandoned');
  });

  it('rejects illegal transitions with IllegalTransitionError', () => {
    const cases: [string, (l: SessionLifecycle) => void][] = [
      ['pause from created', (l) => l.pause()],
      ['resume from created', (l) => l.resume()],
      ['complete from created', (l) => l.complete()],
      ['abandon from created', (l) => l.abandon()],
      ['start twice', (l) => { l.start(); l.start(); }],
      ['pause twice', (l) => { l.start(); l.pause(); l.pause(); }],
      ['resume while active', (l) => { l.start(); l.resume(); }],
    ];
    for (const [label, act] of cases) {
      const lifecycle = new SessionLifecycle();
      expect(() => act(lifecycle)).toThrow(IllegalTransitionError);
    }
  });

  it('rejects every transition from terminal states', () => {
    const terminals = [
      { status: 'completed', act: (l: SessionLifecycle) => l.complete() },
      { status: 'abandoned', act: (l: SessionLifecycle) => l.abandon() },
    ] as const;
    for (const { status, act } of terminals) {
      const lifecycle = new SessionLifecycle();
      lifecycle.start();
      act(lifecycle);
      expect(lifecycle.status).toBe(status);
      expect(() => lifecycle.start()).toThrow(IllegalTransitionError);
      expect(() => lifecycle.pause()).toThrow(IllegalTransitionError);
      expect(() => lifecycle.resume()).toThrow(IllegalTransitionError);
      expect(() => lifecycle.complete()).toThrow(IllegalTransitionError);
      expect(() => lifecycle.abandon()).toThrow(IllegalTransitionError);
    }
  });

  it('reports from/to on the error', () => {
    const lifecycle = new SessionLifecycle();
    let error: unknown = null;
    try {
      lifecycle.pause();
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(IllegalTransitionError);
    const e = error as IllegalTransitionError;
    expect(e.from).toBe('created');
    expect(e.to).toBe('paused');
    expect(e.message).toContain('created → paused');
  });

  it('invokes onStatusChange with (newStatus, previousStatus) on success only', () => {
    const seen: [SessionStatus, SessionStatus][] = [];
    const lifecycle = new SessionLifecycle({
      onStatusChange: (status, previous) => seen.push([status, previous]),
    });
    lifecycle.start();
    expect(seen).toEqual([['active', 'created']]);
    lifecycle.pause();
    expect(seen[1]).toEqual(['paused', 'active']);
    expect(() => lifecycle.start()).toThrow(IllegalTransitionError);
    expect(seen).toHaveLength(2); // illegal transition never notifies
  });
});

describe('SessionLifecycle timing', () => {
  it('freezes elapsed time while paused and resumes after', () => {
    const clock = createFakeClock(0);
    const lifecycle = new SessionLifecycle({ clock });

    expect(lifecycle.elapsedMs()).toBe(0);
    lifecycle.start();
    clock.advance(1000);
    expect(lifecycle.elapsedMs()).toBe(1000);

    lifecycle.pause();
    clock.advance(5000); // paused wall time must NOT count as active
    expect(lifecycle.elapsedMs()).toBe(1000);
    expect(lifecycle.pausedDurationMs()).toBe(5000);

    lifecycle.resume();
    clock.advance(2000);
    expect(lifecycle.elapsedMs()).toBe(3000);

    lifecycle.complete();
    clock.advance(10_000); // terminal: nothing may accumulate after completion
    expect(lifecycle.elapsedMs()).toBe(3000);
    expect(lifecycle.pausedDurationMs()).toBe(5000);
  });

  it('accumulates paused time across multiple pause cycles', () => {
    const clock = createFakeClock(0);
    const lifecycle = new SessionLifecycle({ clock });
    lifecycle.start();
    clock.advance(100);
    lifecycle.pause();
    clock.advance(50);
    lifecycle.resume();
    clock.advance(100);
    lifecycle.pause();
    clock.advance(25);
    expect(lifecycle.elapsedMs()).toBe(200);
    expect(lifecycle.pausedDurationMs()).toBe(75);
  });

  it('elapsed() is 0 before start and while created', () => {
    const clock = createFakeClock(0);
    const lifecycle = new SessionLifecycle({ clock });
    clock.advance(999);
    expect(lifecycle.elapsedMs()).toBe(0);
    expect(lifecycle.pausedDurationMs()).toBe(0);
  });
});
