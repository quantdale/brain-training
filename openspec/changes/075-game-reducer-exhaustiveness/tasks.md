# Tasks — 075-game-reducer-exhaustiveness

## 1. Shared exhaustiveness helper

- [ ] 1.1 Add a small, dependency-free exhaustiveness helper to
      `apps/mobile/src/sdk`, documented with what it guarantees and what it does
      not, so the pattern is expressed once rather than 42 times.

## 2. Convert the reducers

- [ ] 2.1 Convert one reducer (start with
      `apps/mobile/src/games/speed-tap-rush/reducer.ts`) to assert the residual
      action is `never`; confirm typecheck passes and its suite is green with
      identical transitions.
- [ ] 2.2 Prove the assertion works: temporarily add an unhandled member to that
      game's action union, confirm typecheck fails naming it, then revert.
- [ ] 2.3 Convert the remaining 41 reducers to the same pattern.
- [ ] 2.4 Remove the 27 misleading `// Exhaustiveness guard: every action is
      handled above.` comments; describe the runtime fallback for what it
      actually is (input outside the declared union) rather than as an
      exhaustiveness guard.
- [ ] 2.5 Ensure the runtime fallback is unreachable for any declared action and
      reports loudly for out-of-union input.

## 3. Catalog-wide verification

- [ ] 3.1 Add a catalog-wide test asserting every game reducer contains the
      exhaustiveness assertion, reporting the number of games checked.
- [ ] 3.2 Have the same test fail if a reducer reintroduces a silent
      `default: return state` for a declared union member, or the misleading
      comment.
- [ ] 3.3 Prove the test can fail: temporarily convert one reducer back to the
      silent fallback, confirm the test fails naming it, then revert.
- [ ] 3.4 Confirm a newly added game is covered by the same test without editing
      it.

## 4. Verification

- [ ] 4.1 `npm run typecheck` clean.
- [ ] 4.2 Full Jest matrix green with no new skips; the jest signal validator
      passes; `npm run lint` clean.
- [ ] 4.3 Confirm no behavioral change: run several games end to end on the
      dedicated AVD (at least one from each of the speed, attention, memory, and
      logic domains) and confirm identical transitions, scoring, and persistence.
- [ ] 4.4 `node scripts/validate-repo-state.mjs` and
      `node scripts/generate-game-registry.mjs --check` clean.
