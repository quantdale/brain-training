# Design — 058-product-ux-navigation-residuals

## Safe back (shared, `components/ui/back-link.tsx`)

```tsx
import { useRouter, type Href } from "expo-router";

/** Pure core (unit-tested): back when possible, else fall back. */
export function backOrFallback(canGoBack: boolean): "back" | "replace" {
  return canGoBack ? "back" : "replace";
}

/** Back with an empty-stack fallback (cold deep links). */
export function useSafeBack(fallbackHref: Href): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (backOrFallback(router.canGoBack())) router.back();
    else router.replace(fallbackHref);
  }, [router, fallbackHref]);
}
```

Call-site migration (8 usages / 6 hook sites): each route's `<BackLink onPress={() =>
router.back()} />` becomes `const goBack = useSafeBack('<fallback>')` +
`onPress={goBack}`. Game-detail's local `BackLink` (raw Pressable +
`router.back()`) is deleted in favor of the shared primitive with
`'/games'`. `router` imports that become unused are removed per file.

## Touch floors (styles only)

- `progress.tsx` activity `Tappable`, `progress-domain.tsx` back-link
  `Tappable`: add `style` with `minHeight: MinTouchTarget`,
  `justifyContent: 'center'` (check existing StyleSheet or inline with a
  named style; MinTouchTarget import from `@/theme/tokens`).
- Unknown-browse (`game-detail/[id].tsx`): `style={MinTouchTarget}` on the
  label `ThemedText` child (mirrors game-not-ready; Link-asChild hides the
  Pressable's own style).
- Recovery retry: `minHeight: 44` in `styles.retry` + `hitSlop={12}` prop
  on the Pressable + comment prohibiting Tappable (provider-freedom).
- AVS tile: `minHeight/minWidth: MinTouchTarget` in `styles.tile`
  (mirror cell.tsx incl. its comment rationale); import MinTouchTarget
  (check tile.tsx imports — Tokens vs constants path per file convention).

## EmptyState wrap

Drop `numberOfLines={1}` on the message; update the header doc
("one-line explanation" → "wrapping explanation"). No other change.

## Explicitly unchanged (with evidence, not oversight)

- TutorialFrame scroll: ScrollView measured-cycle hazard (file comment).
- error-boundary / game-not-ready: `...MinTouchTarget` already spread.
- Button/report ellipsis: fixed-chrome 2x design (button.tsx:156-159),
  full text in a11y tree.
- Game-screen quits (42× `router.back()`): in-flow stacks only; 065 sweep.
- Below-fold CTAs + short-board dead space: accepted LOW (055 record).

## Tests

- `back-link.test` (new or colocated): `backOrFallback` truth table;
  `useSafeBack` dispatches back vs replace via a mocked expo-router
  (mirror existing router-mock patterns in app tests).
- Touch floors: style-level assertions (minHeight present) for the two
  Tappables + recovery retry + AVS tile; empty-state wrap assertion
  (no numberOfLines truncation on message).
- Regression: progress / game-detail / results / recovery /
  error-boundary / AVS suites green.
