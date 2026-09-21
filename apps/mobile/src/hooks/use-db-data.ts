import { useEffect, useRef, useState } from 'react';

import type { AppDatabase } from '@/db';
import { getDb } from '@/db';

/** Same deps equality React applies before re-running an effect. */
function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

/**
 * Load data from the app database into component state.
 *
 * The db may legitimately be unavailable (startup failed, tests without
 * sqlite): in that case `loaded` becomes true with `data` at its fallback and
 * `error` set, so screens render a graceful empty state instead of crashing.
 */
export function useDbData<T>(
  load: (db: AppDatabase) => Promise<T>,
  deps: readonly unknown[],
  fallback: T,
): { data: T; loaded: boolean; error: unknown } {
  const [data, setData] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // The deps snapshot the current state belongs to. Kept in state (not a ref)
  // so the reset follows React's "adjust state when props change" contract and
  // a discarded concurrent render cannot persist a mismatched snapshot.
  const [trackedDeps, setTrackedDeps] = useState<readonly unknown[]>(deps);
  // 061: monotonic load generation — a slow load superseded by a newer
  // bump (rapid focus bounce, error retry mid-flight) must not overwrite
  // the fresh resolution when it finally lands.
  const seqRef = useRef(0);

  if (!sameDeps(trackedDeps, deps)) {
    // Deps changed: drop the previous payload during the SAME render pass, so
    // a same-route param change can never paint the old payload for even one
    // tick. The effect below then loads the new payload; supersession still
    // runs through seqRef, and the old effect's cleanup marks its in-flight
    // load cancelled before any microtask can land it.
    setTrackedDeps(deps);
    setData(fallback);
    setLoaded(false);
    setError(null);
  }

  useEffect(() => {
    const seq = (seqRef.current += 1);
    let cancelled = false;
    (async () => {
      try {
        const db = getDb(); // throws when initDatabase() never ran
        const result = await load(db);
        if (!cancelled && seq === seqRef.current) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled && seq === seqRef.current) {
          setError(e);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loaded, error };
}
