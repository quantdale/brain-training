/**
 * Performance guards — `useDbData` load discipline (campaign 009 W13).
 *
 * Every shell screen fetches through this hook, so its refresh contract IS the
 * screens' rerender/query budget. Guarded here deterministically:
 *
 * 1. One load per deps change — unrelated parent rerenders never refetch.
 * 2. A stale in-flight response is discarded when deps change mid-flight
 *    (the `cancelled` flag) — no wasted state churn, no wrong-data flash.
 * 3. Unmount during an in-flight load resolves silently (no post-unmount work).
 *
 * Rendered via react-test-renderer (the same renderer @testing-library/
 * react-native wraps): the probe publishes the hook result during render, so
 * assertions never depend on effect-flush timing.
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { initDatabase } from '@/db';
import { useDbData } from '@/hooks/use-db-data';

beforeEach(async () => {
  await initDatabase();
});

/** Latest value published by the probe DURING render (no effect indirection). */
let latest:
  | ReturnType<typeof useDbData<unknown>>
  | undefined;

function Probe(props: {
  load: (db: unknown) => Promise<unknown>;
  deps: readonly unknown[];
  fallback: unknown;
}) {
  // Test harness: publishing during render is the point — assertions must not
  // depend on effect-flush timing. Not rendered for UI; no user-visible output.
  // eslint-disable-next-line react-hooks/globals
  latest = useDbData(
    props.load as never,
    props.deps,
    props.fallback as never,
  );
  return null;
}

async function mountProbe(props: {
  load: (db: unknown) => Promise<unknown>;
  deps: readonly unknown[];
  fallback: unknown;
}): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<Probe {...props} />);
  });
  return renderer;
}

/** Drain microtasks so resolved promises inside the hook settle. */
const flushMicrotasks = () => new Promise<void>((r) => setImmediate(r));

describe('perf: useDbData loads once per deps change', () => {
  it('does not refetch when the parent rerenders with unchanged deps', async () => {
    let loads = 0;
    const load = async () => {
      loads += 1;
      return { n: loads };
    };

    const renderer = await mountProbe({
      load,
      deps: [1],
      fallback: { n: 0 },
    });
    expect(latest?.loaded).toBe(true);
    expect(loads).toBe(1);

    // Unrelated parent rerenders (new props/state elsewhere) keep the same
    // deps array VALUES — the hook must treat them as no-ops.
    await act(async () => {
      renderer.update(<Probe load={load} deps={[1]} fallback={{ n: 0 }} />);
    });
    await act(async () => {
      renderer.update(<Probe load={load} deps={[1]} fallback={{ n: 0 }} />);
    });
    expect(loads).toBe(1);
    expect(latest?.data).toEqual({ n: 1 });

    // A genuine deps change reloads exactly once.
    await act(async () => {
      renderer.update(<Probe load={load} deps={[2]} fallback={{ n: 0 }} />);
    });
    expect(loads).toBe(2);
    expect(latest?.data).toEqual({ n: 2 });
    await act(async () => {
      renderer.unmount();
    });
  });
});

describe('perf: useDbData discards stale in-flight responses', () => {
  /** Manually-resolved load so the test controls response ordering. */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it('keeps only the newest result when an older load settles last', async () => {
    const first = deferred<{ tag: string }>();
    const second = deferred<{ tag: string }>();
    const loaderMock = jest
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValue(second.promise);
    const loader = loaderMock as unknown as (
      db: unknown,
    ) => Promise<{ tag: string }>;

    const renderer = await mountProbe({
      load: loader,
      deps: [1],
      fallback: { tag: 'fallback' },
    });
    expect(latest?.loaded).toBe(false);

    // Dep change issues the second load while the first is in flight.
    await act(async () => {
      renderer.update(
        <Probe load={loader} deps={[2]} fallback={{ tag: 'fallback' }} />,
      );
    });
    expect(loaderMock).toHaveBeenCalledTimes(2);

    // The NEWER response lands first…
    await act(async () => {
      second.resolve({ tag: 'second' });
    });
    await flushMicrotasks();
    expect(latest?.data).toEqual({ tag: 'second' });

    // …then the STALE one settles: it must NOT overwrite the newer data.
    await act(async () => {
      first.resolve({ tag: 'first' });
    });
    await flushMicrotasks();
    expect(latest?.data).toEqual({ tag: 'second' });
    await act(async () => {
      renderer.unmount();
    });
  });

  it('unmount during an in-flight load resolves without effect', async () => {
    const pending = deferred<string>();
    const loaderMock = jest.fn().mockReturnValue(pending.promise);
    const loader = loaderMock as unknown as (db: unknown) => Promise<string>;

    const renderer = await mountProbe({
      load: loader,
      deps: [],
      fallback: 'fallback',
    });
    expect(latest?.loaded).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
    // The cancelled closure swallows the late resolution — no throw, and the
    // captured snapshot can never observe a post-unmount update.
    await act(async () => {
      pending.resolve('late');
    });
    await flushMicrotasks();
    expect(latest?.loaded).toBe(false);
    expect(latest?.data).toBe('fallback');
  });
});
