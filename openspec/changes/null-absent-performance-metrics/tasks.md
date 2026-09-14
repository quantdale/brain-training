## 1. Color Stroop

- [x] 1.1 Persist `fastestResponseMs` as `number | null`; Infinity → `null`.
- [x] 1.2 Update session tests; JSON round-trip is `null`.

## 2. Sibling sentinels

- [x] 2.1 `attention-target-count` `bestRoundTimeMs`, `logic-rule-grid` `bestRoundTimeMs`, `logic-code-cracker` `bestSolveGuesses`, `logic-order-path` `bestRoundTimeMs` → `null` when absent.

## 3. Analytics

- [x] 3.1 Skip `null` in reaction-best extractors; skip historical `<= 0` for those best-reaction fields if required for old Color Stroop zeros.
- [x] 3.2 Fixture: `fastestResponseMs: null` does not create a 0 ms best.

## 4. Verification

- [x] 4.1 Targeted game session + analytics Jest and `tsc --noEmit` PASS.
- [x] 4.2 Bump scoring/session provenance versions only if persisted JSON shape is a declared versioned field (follow `validate-provenance` if those files are listed).
