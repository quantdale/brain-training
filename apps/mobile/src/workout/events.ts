/**
 * Lightweight workout-change notifier (006R hardening).
 *
 * The durable daily workout can be advanced on the result screen while Home is
 * already mounted, so Home must learn about the change without a remount and
 * without a router-dependent focus hook (which is awkward to exercise in unit
 * tests). `advance`/`reroll` emit here; `useWorkout` subscribes and re-reads the
 * persisted instance. Kept router-free and synchronous so it never outlives a
 * test render.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Notify subscribers that the persisted workout instance changed. */
export function emitWorkoutChanged(): void {
  listeners.forEach((listener) => listener());
}

/** Subscribe to workout changes; returns an unsubscribe function. */
export function onWorkoutChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
