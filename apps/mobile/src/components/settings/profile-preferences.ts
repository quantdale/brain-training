/** One writer lane for sensory/theme changes and authoritative import/wipe.
 * Reserve the barrier synchronously, drain accepted writes BEFORE restoration,
 * and ignore controls until canonical preferences have been hydrated. A write
 * queued behind an import would otherwise replay pre-import sibling values. */
let pending: Promise<unknown> = Promise.resolve();
let authoritativeChanges = 0;
// A failed canonical read is not a completed restoration. Keep this latch
// beyond the mutation's queue slot and the DataManagement route's lifetime.
let hydrationRequired = false;

export function requirePreferenceHydration(): void {
  hydrationRequired = true;
}

export function completePreferenceHydration(): void {
  hydrationRequired = false;
}

export function preferenceChangesBlocked(): boolean {
  return authoritativeChanges > 0 || hydrationRequired;
}

export function enqueuePreferenceWrite(write: () => Promise<unknown>): Promise<void> {
  if (preferenceChangesBlocked()) return Promise.resolve();
  const result = pending.then(write).then(() => undefined);
  pending = result.catch(() => undefined);
  return result;
}

export function withAuthoritativePreferences<T>(change: () => Promise<T>): Promise<T> {
  authoritativeChanges += 1;
  const result = pending.then(change).finally(() => { authoritativeChanges -= 1; });
  pending = result.catch(() => undefined);
  return result;
}
