# Tasks — 074-sdk-module-contract

## 1. Module-surface validation at registration

- [ ] 1.1 Implement a validator for a game module's exported surface covering
      every member the host depends on, reusing the error style of the existing
      `defineGame` validation.
- [ ] 1.2 Invoke it from the existing registration path
      (`runBootstrap` → `catalog-registry` stage) so a non-conforming module
      fails fast at boot, naming the module and the missing member, and is not
      made available for rendering.
- [ ] 1.3 Run the validation across all 42 modules and record the result; fix any
      genuinely non-conforming module explicitly rather than relaxing the
      validator.
- [ ] 1.4 Add tests: a module omitting a member, and one with a misspelled
      member, each fail registration naming the member; a conforming module
      registers; a failing registration is classified as recovery-required rather
      than crashing.

## 2. Typed loader boundary

- [ ] 2.1 Express the host-injected tutorial surface as a declared prop on the
      game's screen type, so the generated registry carries the real type.
- [ ] 2.2 Remove the unchecked conversion at the loader boundary
      (`app/game/[id].tsx`) and pass the surface through the declared prop.
- [ ] 2.3 Update `scripts/generate-game-registry.mjs` to emit the typed surface;
      regenerate and confirm `--check` is clean (no hand-edited generated
      output).
- [ ] 2.4 `npm run typecheck` clean with no game module changes required beyond
      what the typed surface implies.

## 3. Per-game lifecycle verification

- [ ] 3.1 Rewrite the session-lifecycle contract test to scan only the 42 game
      module directories, excluding the shared host sources that currently
      satisfy it.
- [ ] 3.2 Assert, per module, that the module does not construct its own timers,
      intervals, or event subscriptions, and name the module on failure.
- [ ] 3.3 Prove the gate can fail: temporarily introduce a non-conforming
      construct in one module, confirm the gate fails naming it, then revert.
- [ ] 3.4 Confirm a newly added game module is covered automatically.

## 4. Duplicate-start guard

- [ ] 4.1 Add a guard to `useGameSession.begin()` that refuses to start while a
      previous session for the same scope is non-terminal, with an error
      distinguishable from a successful start.
- [ ] 4.2 Ensure the refused start leaves the previous session's state, timers,
      and persistence untouched.
- [ ] 4.3 Ensure a start that fails after partial initialization cleans up any
      timer, listener, or subscription it created, so it cannot block or leak
      into a later start.
- [ ] 4.4 Add tests: duplicate start refused; start after terminal phase
      succeeds; partial-failure cleanup leaves no residue; a host remount does
      not trip the guard.

## 5. Version conversion contract

- [ ] 5.1 Correct the per-game version helper so it accepts the absent generator
      version the SDK type and documentation permit for non-procedural games.
- [ ] 5.2 Correct its documentation to describe the components it actually packs.
- [ ] 5.3 Add tests: absent version accepted; a versioned generator packs
      deterministically; the same input always yields the same persisted value.
- [ ] 5.4 Confirm already-persisted sessions are unaffected (only new writes use
      the corrected conversion).

## 6. Documentation

- [ ] 6.1 Update `docs/GAME_SDK.md`: include `sdk/numeric.ts` and `sdk/perf.ts`
      in the module map, correct the catalog size, and correct the version
      contract description.
- [ ] 6.2 Remove the stale catalog-size comment in the contract test.

## 7. Verification

- [ ] 7.1 `npx jest src/sdk src/components/game-host src/__tests__/catalog-contracts`
      green; the full matrix green with no new skips; the jest signal validator
      passes.
- [ ] 7.2 `node scripts/generate-game-registry.mjs --check` clean.
- [ ] 7.3 `npm run typecheck` and `npm run lint` clean.
- [ ] 7.4 On the dedicated AVD: launch a game, background and restore it, and
      confirm no duplicate session is created and no timer/listener residue
      appears; confirm a tutorial and a full game still run to completion with
      persistence.
