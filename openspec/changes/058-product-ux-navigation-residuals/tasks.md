# Tasks — 058-product-ux-navigation-residuals

- [x] 1. `back-link.tsx`: `backOrFallback` + `useSafeBack`; migrate 8 app-route back usages via 6 hook sites (incl. game-detail local → shared, `accessibilityLabel="Back to Games"` preserved); router imports all still used elsewhere — none removed.
- [x] 2. Touch floors: progress activity link, domain back link, unknown-browse label, recovery retry (+hitSlop, +no-Tappable comment), AVS tile.
- [x] 3. EmptyState message wrap + doc update.
- [x] 4. Tests: safe-back core/hook, floor/wrap assertions (both text links, unknown-browse, recovery, AVS); affected suites green; visual-baselines 3 snapshots regenerated (diff verified).
- [x] 5. Full matrix (571 suites / 6,818 tests / 5 snapshots, exit 0) + typecheck + lint + validators + OpenSpec strict 42/42; adversarial NOT_READY fully repaired; durable state; commit; push.
