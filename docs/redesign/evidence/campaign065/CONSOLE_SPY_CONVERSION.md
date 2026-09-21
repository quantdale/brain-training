# Campaign 065 — console-spy closure

**Problem (tests critic, High):** the all-level console gate records
violations only when its installed wrappers run. 58 `jest.spyOn(console,
'error')` sites across 45+ test files replaced the wrapper with a
swallowing mock, so unexpected output in exactly the expected-failure
tests was invisible. The gate's documented contract was false there.

**Fix (guard):** `installConsoleSignalGuard` now locks the guarded
methods (`Object.defineProperty(console, level, { configurable: false,
writable: false })`) and records the installed wrappers;
`assertNoUnexpectedConsoleOutput` reports any method that is no longer the
installed wrapper. A test-level `jest.spyOn(console, …)` therefore fails
immediately instead of silently muting the gate.

**Fix (conversion):** every spy site was converted to the sanctioned
scoped expectation:

```ts
await expectConsoleNoise(/<exact message regex>/, async () => {
  <the action that deliberately emits the message>
});
```

`expectConsoleNoise` counts the message, still forwards it to the real
console, and fails the test when the message does not occur — so the
former "spy was called" assertions are subsumed by a stronger contract.

**Converted:**
- `src/games/**/__tests__/`: 39 files, 40 sites (per-game persist-failure
  suites + the 14 special-form suites with dynamic session ids).
- `src/app/**` + `src/components/**`: 11 files, 19+ sites
  (`shell-a11y`, `error-boundary`, `persistence-failure`,
  `in-game-workout-actions`, `catalog-persistence-matrix`, `rewards`,
  `home-workout-start`, `home-reroll-failure`, `results-workout-cta`,
  `settings-persist-concurrency`, `settings-persist-toast`,
  `profile-purchases`).

**Verification:** grep for `spyOn(console` returns zero hits outside the
guard's own comment; converted suites ran green per file and in batches
(39 suites/382 tests for games; 11 suites/177 tests for app+components;
the economy packet's 28 tests); the full 065 matrix is the terminal gate.
No mute, fake console, or widened allowlist was introduced; where a test
previously asserted a specific spy call, the helper enforces the same
message content and occurrence count.
