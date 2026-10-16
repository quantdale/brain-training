import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppDatabase } from '@/db';
import { getDb } from '@/db';

/** Same deps equality React applies before re-running an effect. */
function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/**
 * The four outcomes a data-backed screen has to tell apart.
 *
 * 072: `loaded: true` used to mean "the attempt settled", so a FAILED read and
 * a SUCCESSFUL read that returned nothing were indistinguishable to any
 * consumer that only checked `loaded`. A screen asking for the user's progress
 * would render a zeroed fallback — 0 sessions, 0 XP, empty history — as though
 * that were real data. The number is plausible, so nothing looks broken; the
 * user is simply told they have done nothing.
 *
 * That is the specific failure this enum removes. `error` existed but a screen
 * that ignored it (and every screen had to remember to) got the wrong screen.
 * Now the distinction is in the return value, so the wrong thing requires
 * deliberately discarding a flag.
 */
export type DbDataStatus = 'loading' | 'success' | 'empty' | 'error';

export interface DbDataResult<T> {
  /**
   * The loaded value, or the caller's fallback before success / after a default
   * reset. `keepPreviousData` retains an observed value across refresh attempts;
   * `status` still reports loading or failure rather than claiming it is fresh.
   */
  data: T;
  /**
   * True once the attempt SETTLED, whether it succeeded or failed. Retained for
   * existing consumers; prefer {@link status} in new code, because `loaded`
   * alone cannot distinguish an empty result from a failure.
   */
  loaded: boolean;
  /** The failure, when `status === 'error'`. */
  error: unknown;
  /** Which of the four outcomes this is. */
  status: DbDataStatus;
  /** Convenience: `status === 'error'`. */
  failed: boolean;
  /** Re-run the load. Memoized for the current fallback/retention policy. */
  retry: () => void;
  /**
   * True once a load has SUCCEEDED at least once for the current mount.
   *
   * This mount-lifetime flag does not itself retain the payload: the default
   * deps reset still drops old data so route-param changes cannot paint another
   * entity's records. Same-identity refresh callers can opt into
   * `keepPreviousData` and use `status === 'loading' && !hasData` for their
   * first-load skeleton, keeping observed content / transient UI mounted during
   * later refreshes without showing the fallback as an actual empty profile.
   */
  hasData: boolean;
}

export interface UseDbDataOptions<T> {
  /**
   * Retain the last successful payload across deps refreshes and retries.
   * Defaults to false so a route-param change immediately drops the old entity.
   * Opt in only when the deps refresh the SAME identity, such as a local-profile
   * refresh counter. Loading / error status remains authoritative either way.
   */
  keepPreviousData?: boolean;
  /**
   * How to recognize a successful-but-empty result.
   *
   * Required for `status: 'empty'` to be reachable — without it the hook
   * cannot know whether `[]` means "no records" or "a legitimately empty
   * object", and guessing is how a screen ends up showing an empty state over
   * real data. Defaults to no emptiness detection, in which case a success is
   * reported as `success`.
   */
  isEmpty?: (value: T) => boolean;
  /**
   * Label included in the failure log. A production failure with no context is
   * a failure nobody can act on, and this hook is the only place that knows
   * which load broke.
   */
  label?: string;
}

/**
 * Load data from the app database into component state.
 *
 * The db may legitimately be unavailable (startup failed, tests without
 * sqlite): that is reported as `status: 'error'`, so a screen can render an
 * explicit failure with a retry instead of an empty state that looks like real
 * data. The payload is the fallback unless same-identity retention was requested
 * and an earlier read succeeded.
 */
export function useDbData<T>(
  load: (db: AppDatabase) => Promise<T>,
  deps: readonly unknown[],
  fallback: T,
  options: UseDbDataOptions<T> = {},
): DbDataResult<T> {
  const { isEmpty, label = 'db-data', keepPreviousData = false } = options;
  const [data, setData] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Never reset by a deps change or a retry: see `hasData` on the result.
  const [hasData, setHasData] = useState(false);
  const retainData = keepPreviousData && hasData;
  // Bumping this re-runs the effect; `retry()` is its programmatic equivalent.
  const [attempt, setAttempt] = useState(0);
  // The deps snapshot the current state belongs to. Kept in state (not a ref)
  // so the reset follows React's "adjust state when props change" contract and
  // a discarded concurrent render cannot persist a mismatched snapshot.
  const [trackedDeps, setTrackedDeps] = useState<readonly unknown[]>(deps);
  // 061: monotonic load generation — a slow load superseded by a newer
  // bump (rapid focus bounce, error retry mid-flight) must not overwrite
  // the fresh resolution when it finally lands.
  const seqRef = useRef(0);

  // `isEmpty` is consulted ONCE, when a load resolves, and its verdict is
  // stored. Storing the verdict rather than calling the predicate during render
  // matters for two reasons: callers pass an inline arrow whose identity
  // changes every render (so it cannot be a render dependency), and reading a
  // ref during render is itself a React violation.
  const isEmptyRef = useRef(isEmpty);
  const [empty, setEmpty] = useState(false);

  if (!sameDeps(trackedDeps, deps)) {
    // Default deps changes drop the previous payload in the SAME render pass,
    // so a route-param change cannot paint the old identity for even one tick.
    // An explicit same-identity refresh can retain a successfully observed
    // payload, while resetting the attempt flags. Supersession still runs
    // through seqRef, and the old effect's cleanup marks its in-flight
    // load cancelled before any microtask can land it.
    setTrackedDeps(deps);
    if (!retainData) setData(fallback);
    setLoaded(false);
    setError(null);
    setEmpty(false);
  }

  useEffect(() => {
    // Refresh the ref INSIDE the effect, where reading a ref is legal, so the
    // latest predicate is used without touching it during render.
    isEmptyRef.current = isEmpty;
    const seq = (seqRef.current += 1);
    let cancelled = false;
    (async () => {
      try {
        const db = getDb(); // throws when initDatabase() never ran
        const result = await load(db);
        if (!cancelled && seq === seqRef.current) {
          setData(result);
          setHasData(true);
          setError(null);
          setEmpty(isEmptyRef.current?.(result) === true);
        }
      } catch (e) {
        if (!cancelled && seq === seqRef.current) {
          setError(e);
          // Log once per failed attempt, including retained-data refreshes: the
          // old payload must not obscure a failed read in production diagnosis.
          // The caller's label identifies which screen broke.
           
          console.error(
            `[useDbData] ${label} load failed`,
            e instanceof Error ? e.message : e,
          );
        }
      } finally {
        if (!cancelled && seq === seqRef.current) {
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // `deps` is the caller-declared refresh trigger; the load closure is stable.
    // `isEmpty` is deliberately NOT a dependency: callers pass an inline arrow,
    // so including it would re-run the load on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => {
    // Retry clears stale attempt flags. Only an explicit same-identity caller
    // with a successful prior read keeps the observed payload while it runs.
    setError(null);
    setLoaded(false);
    setEmpty(false);
    if (!retainData) setData(fallback);
    setAttempt((n) => n + 1);
  }, [fallback, retainData]);

  const status: DbDataStatus = error ? 'error' : !loaded ? 'loading' : empty ? 'empty' : 'success';

  return { data, loaded, error, status, failed: status === 'error', retry, hasData };
}
