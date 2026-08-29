/**
 * Hooks contract tests.
 *
 * `src/hooks` was the only module in the tree with no direct test coverage.
 * These tests close that gap and pin the two behaviours that are cheap to
 * break and expensive to diagnose in production:
 *
 * 1. `useTheme` must NEVER return `undefined`. React Native's shipped typings
 *    declare `useColorScheme(): ColorSchemeName`, but the native implementation
 *    is Flow `?ColorSchemeName` — i.e. `ColorSchemeName | null | undefined` —
 *    and really does yield `null` before the system appearance is known. The
 *    historical `scheme === 'unspecified' ? 'light' : scheme` guard only
 *    handled the sentinel string, so `null` fell through to
 *    `Colors[null] === undefined`, and every one of the ~78 `useTheme()`
 *    consumers crashed the first time it read `theme.text`.
 * 2. `useDbData` degrades to its fallback instead of throwing when the
 *    database is unavailable (failed startup, Node tests without sqlite), and
 *    never writes state after unmount.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';

import { Colors } from '@/constants/theme';
import { getDb } from '@/db';
import type { AppDatabase } from '@/db';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDbData } from '@/hooks/use-db-data';
import { useTheme } from '@/hooks/use-theme';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(),
}));

jest.mock('@/db', () => ({
  getDb: jest.fn(),
}));

/** The runtime really can hand back `null`/`undefined` despite the typings. */
type Scheme = string | null | undefined;

const schemeMock = useColorScheme as unknown as { mockReturnValue(v: Scheme): void };

const getDbMock = getDb as unknown as {
  mockReturnValue(v: unknown): void;
  mockImplementation(fn: () => unknown): void;
};

describe('useTheme', () => {
  beforeEach(() => {
    schemeMock.mockReturnValue('light');
  });

  it('returns the light palette for an explicit light scheme', async () => {
    schemeMock.mockReturnValue('light');
    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.light);
  });

  it('returns the dark palette for an explicit dark scheme', async () => {
    schemeMock.mockReturnValue('dark');
    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.dark);
  });

  it('falls back to light for the unspecified sentinel', async () => {
    schemeMock.mockReturnValue('unspecified');
    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.light);
  });

  // Regression: the old `scheme === 'unspecified' ? 'light' : scheme` guard
  // let null through, so `Colors[null]` was `undefined` and every consumer
  // threw on its first `theme.x` read.
  it('falls back to light when the scheme is null', async () => {
    schemeMock.mockReturnValue(null);
    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.light);
  });

  it('falls back to light when the scheme is undefined', async () => {
    schemeMock.mockReturnValue(undefined);
    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.light);
  });

  it('never returns undefined for any scheme the runtime can produce', async () => {
    const reachable: Scheme[] = ['light', 'dark', 'unspecified', null, undefined];

    for (const scheme of reachable) {
      schemeMock.mockReturnValue(scheme);
      const { result } = await renderHook(() => useTheme());

      expect(result.current).toBeDefined();
      expect(typeof result.current.text).toBe('string');
      expect(typeof result.current.background).toBe('string');
    }
  });
});

describe('theme token parity', () => {
  it('exposes identical keys across both palettes', () => {
    // A token added to only one palette resolves to `undefined` in the other
    // scheme at runtime — invisible to TypeScript, visible as a broken UI.
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });
});

describe('useDbData', () => {
  beforeEach(() => {
    getDbMock.mockReturnValue({});
  });

  it('loads data and clears the error on success', async () => {
    const load = jest.fn(async (_db: AppDatabase) => 42);
    const { result } = await renderHook(() => useDbData(load, [], 0));

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.data).toBe(42);
    expect(result.current.error).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('degrades to the fallback instead of throwing when the db is unavailable', async () => {
    getDbMock.mockImplementation(() => {
      throw new Error('database unavailable');
    });
    const load = jest.fn(async (_db: AppDatabase) => 42);
    const { result } = await renderHook(() => useDbData(load, [], -1));

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.data).toBe(-1);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(load).not.toHaveBeenCalled();
  });

  it('surfaces a load failure without discarding the fallback', async () => {
    const load = jest.fn(async (_db: AppDatabase) => {
      throw new Error('query failed');
    });
    const { result } = await renderHook(() => useDbData(load, [], 7));

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(result.current.data).toBe(7);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('reloads when the caller-declared deps change', async () => {
    const load = jest.fn(async (_db: AppDatabase) => 1);
    const rendered = await renderHook(({ dep }: { dep: number }) => useDbData(load, [dep], 0), {
      initialProps: { dep: 1 },
    });

    await waitFor(() => expect(rendered.result.current.loaded).toBe(true));
    expect(load).toHaveBeenCalledTimes(1);

    await rendered.rerender({ dep: 2 });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('does not apply state after unmount', async () => {
    let resolveLoad: ((value: number) => void) | undefined;
    const load = jest.fn(
      (_db: AppDatabase) =>
        new Promise<number>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const rendered = await renderHook(() => useDbData(load, [], 0));
    expect(rendered.result.current.loaded).toBe(false);

    rendered.unmount();
    resolveLoad?.(99);
    // Let the (now-cancelled) continuation run to completion.
    await Promise.resolve();

    expect(rendered.result.current.loaded).toBe(false);
    expect(rendered.result.current.data).toBe(0);
    expect(rendered.result.current.error).toBeNull();
  });
});
