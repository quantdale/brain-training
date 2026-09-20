# Design — 061-performance-lifecycle-cleanup

## Progress throttle (`app/(tabs)/progress.tsx`)

```tsx
const FOCUS_RELOAD_MIN_MS = 5000;
const lastLoadRef = useRef(0);
useFocusEffect(
  useCallback(() => {
    setNowMs(Date.now());
    const now = Date.now();
    if (now - lastLoadRef.current > FOCUS_RELOAD_MIN_MS) {
      lastLoadRef.current = now;
      setRefreshKey((k) => k + 1);
    }
  }, []),
);
```

`retry` keeps bumping the key directly. Worst-case staleness ≈ 5s +
load time — below any real session duration, documented.

## Discovery stabilization (`discovery-data.ts`)

```ts
const prevRef = useRef<DiscoverySnapshot | null>(null);
// after computing fresh:
const prev = prevRef.current;
if (prev) {
  for (const [id, summary] of next.masteryByGame) {
    const old = prev.masteryByGame.get(id);
    if (old && JSON.stringify(old) === JSON.stringify(summary)) {
      next.masteryByGame.set(id, old);
    }
  }
  if (sameMembers(prev.favorites, next.favorites)) next.favorites = prev.favorites;
}
prevRef.current = next;
```

Where? `useDbData` returns data; stabilization must wrap the RESULT —
do it in `useDiscoveryData` via `useMemo` on `[data]`? `data` identity
changes per load; memo compares against prevRef and returns stabilized.
Implement inside `useDiscoveryData` after the hook (not inside
`loadDiscovery`, which must stay pure/testable). Shelves stay
fresh-computed (few nodes, cheap).

## Countdown (shared `game-ui/countdown.tsx`; twins deleted)

Tap-rush and quick-compare carried byte-identical copies. The shared
barrel primitive (`game-ui`) is canonical — both screens import from
there — per the barrel's stated purpose (canonical extraction of
drifted per-game copies).

```tsx
useEffect(() => {
  const timer = setInterval(() => {
    const left = Math.max(0, deadlineMs - clock.now());
    setRemaining(left);
    if (left <= 0) clearInterval(timer);
  }, TICK_MS);
  return () => clearInterval(timer);
}, [deadlineMs, clock]);
```

Note: `setRemaining(0)` repeatedly with same value bails out in React,
but the interval itself is the waste — clearing stops the 20Hz churn.

## Animation cleanups

Capture-then-stop in the three effects:
`const animation = Animated.timing(...); animation.start(); return () =>
animation.stop();`

## ProgressRing ticks

`const ticks = useMemo(() => buildTicks(...), [filled, theme, size,
stroke, count, tone])` — extract the loop into the memo. Per-frame
`setNumericValue` still fires (cheap scalar set); element identities are
stable so reconciliation skips the 56 views.

## usePressFeedback handles (`motion.ts`)

```ts
const animRef = useRef<Animated.CompositeAnimation | null>(null);
const run = (anim: Animated.CompositeAnimation) => {
  animRef.current?.stop();
  animRef.current = anim;
  anim.start(() => { if (animRef.current === anim) animRef.current = null; });
};
// unmount effect: animRef.current?.stop(); animRef.current = null; scale.setValue(1);
```

Press-in/out call `run(...)` instead of bare `.start()`.

## useDbData sequence (`use-db-data.ts`)

```ts
const seqRef = useRef(0);
useEffect(() => {
  const seq = (seqRef.current += 1);
  let cancelled = false;
  ... if (!cancelled && seq === seqRef.current) { set... }
  return () => { cancelled = true; };
}, deps);
```

## focus.ts cancel

```ts
export function requestAccessibilityFocus(target, attempts = FOCUS_ATTEMPTS): () => void {
  ...
  const timer: ... // track setTimeout id
  ...
  return () => { clearTimeout(timer); }; // + generation guard
}
```

Simplest correct: keep a per-call `cancelled` flag + clearTimeout handle;
`useInitialA11yFocus` returns the cancel from its effect. Multiple
sequential requests on one ref: latest wins by ref-target check already;
add a module generation counter so a new request cancels the old one's
pending timer (prevents stale-timer focus after overlay transitions).

## Toast cap (`toast.tsx`)

```ts
const MAX_QUEUED_TOASTS = 8;
export function showToast(options) {
  toastQueue.push({ ...options, id: nextToastId++ });
  while (toastQueue.length > MAX_QUEUED_TOASTS) toastQueue.shift();
  toastListeners.forEach((notify) => notify());
}
```

## Deliberately unchanged (evidence in proposal)

Search debounce, hydration cache, startup order, release instrumentation,
probe infra, first-interaction windows.
