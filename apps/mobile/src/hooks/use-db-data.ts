import { useEffect, useState } from 'react';

import type { AppDatabase } from '@/db';
import { getDb } from '@/db';

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = getDb(); // throws when initDatabase() never ran
        const result = await load(db);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e);
        }
      } finally {
        if (!cancelled) {
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
