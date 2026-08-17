# Packet 006-a: Error Boundaries + Performance Optimizations

**Write surface:** `apps/mobile/src/app/` (error boundary), `apps/mobile/src/games/**` (React.memo)
**Orchestrator-owned files:** `apps/mobile/src/app/` — this packet may edit app shell files.

## Objective

Add error boundaries around game screens and optimize performance with React.memo.

## Tasks

### 1. Error Boundary Component

Create `apps/mobile/src/components/error-boundary.tsx`:
- Class component implementing `componentDidCatch` and `getDerivedStateFromError`.
- Props: `fallback` (React node), `onError` (callback for logging).
- Renders fallback UI on error; provides "Try Again" button to reset.
- Export as named export.

### 2. Wrap Game Route with Error Boundary

Edit `apps/mobile/src/app/game/[id].tsx`:
- Wrap the game screen render in the new Error Boundary.
- Fallback: simple error card with "Something went wrong" + retry button.
- Log errors to console (structured format for QA).

### 3. React.memo on Frequently Re-rendered Components

Add `React.memo` to these components across ALL 20 games:
- `components/button.tsx` (GameButton) — memoize with shallow comparison.
- `components/pause-overlay.tsx` — memoize (renders rarely, but expensive).
- `components/qa-panel.tsx` — memoize (dev-only, but cheap).
- `components/tutorial.tsx` — memoize (modal overlay).

Do NOT memoize screen-level components (they own state). Only memoize leaf/utility components that receive stable props.

### 4. Lazy-load Game Screens in Registry

Edit `apps/mobile/src/registry/registry.generated.ts` (orchestrator-owned):
- Change `gameScreenLoaders` from eager imports to `React.lazy` wrappers.
- Each loader becomes: `() => React.lazy(() => import('@/games/<id>'))`.
- Ensure the route handler wraps lazy screens in `React.Suspense` with a loading fallback.

## Validation

From `apps/mobile`:
1. `npx tsc --noEmit` — must be clean.
2. `npx jest` — full suite must pass.
3. Manual check: error boundary renders on intentionally broken game (QA only).

## Notes

- Do not add error boundaries to individual game screens — one boundary at the route level is sufficient.
- React.memo should use default shallow comparison unless a custom comparator is justified.
- Lazy-loading may slightly increase first-load time for individual games but improves initial bundle size.
