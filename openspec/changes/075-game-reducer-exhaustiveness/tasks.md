# Tasks — 075-game-reducer-exhaustiveness

## 1. Shared exhaustiveness helper

- [x] 1.1 Add a small, dependency-free exhaustiveness helper to
      `apps/mobile/src/sdk`, documented with what it guarantees and what it does
      not, so the pattern is expressed once rather than 42 times.

## 2. Convert the reducers

- [x] 2.1 Convert one reducer (start with
      `apps/mobile/src/games/speed-tap-rush/reducer.ts`) to assert the residual
      action is `never`; confirm typecheck passes and its suite is green with
      identical transitions.
- [x] 2.2 Proven on the real tree: adding `| { type: 'MUTATION_PROBE_UNHANDLED';
      at: number }` to `TapRushAction` made typecheck fail with
      `TS2345: Argument of type '{ type: "MUTATION_PROBE_UNHANDLED"; at: number; }'
      is not assignable to parameter of type 'never'` — naming the member and
      pointing at the assertion. Reverted; typecheck clean.
- [x] 2.3 Convert the remaining 41 reducers to the same pattern.
- [x] 2.4 Remove the 27 misleading `// Exhaustiveness guard: every action is
      handled above.` comments; describe the runtime fallback for what it
      actually is (input outside the declared union) rather than as an
      exhaustiveness guard.
- [x] 2.5 Ensure the runtime fallback is unreachable for any declared action and
      reports loudly for out-of-union input.

## 3. Catalog-wide verification

- [x] 3.1 Add a catalog-wide test asserting every game reducer contains the
      exhaustiveness assertion, reporting the number of games checked.
- [x] 3.2 Have the same test fail if a reducer reintroduces a silent
      `default: return state` for a declared union member, or the misleading
      comment.
- [x] 3.3 Prove the test can fail: temporarily convert one reducer back to the
      silent fallback, confirm the test fails naming it, then revert.
- [x] 3.4 Confirm a newly added game is covered by the same test without editing
      it.

## 4. Verification

- [x] 4.1 `npm run typecheck` clean.
- [x] 4.2 Full Jest matrix green with no new skips; the jest signal validator
      passes; `npm run lint` clean.
- [x] 4.3 **NOT VALIDATED — device lane not available in this session.** The
      device run is not claimed. What IS proven: 4,230 of 4,231 game tests pass
      unchanged across all 42 modules with identical transitions, and the single
      behavior change is confined to out-of-union input, which no production
      caller can produce (a declared action with no case is a compile error).
- [x] 4.4 `node scripts/validate-repo-state.mjs` and
      `node scripts/generate-game-registry.mjs --check` clean.
