# Tasks — 064-dependency-security-validation-gates

- [x] 1. Spec/design/tasks strict-validated before implementation.
- [x] 2. Expiry alignment: KNOWN_ISSUES ReDoS 2026-12-31 → 2027-03-31 +
      renewal owner; dependency-audit self-test asserted.
- [x] 3. Provenance freshness: `--check-allowlist` (expired fail,
      near-expiry warn) + self-test.
- [x] 4. Jest-skip allowlist schema v3 with per-entry `expires`;
      validator expiry + `--check-allowlist`; self-test.
- [x] 5. Affected-area rules (analytics, quests/achievements/streaks,
      theme) + IMPACT_MAP mirror + `--self-test` + `--strict` docs.
- [x] 6. Console gate: all four levels guarded; deliberate emitters
      scoped; dead DUP print removed; contract test added.
- [x] 7. Secrets scanner: npm/Google/Stripe patterns + self-test;
      tracked scan clean.
- [x] 8. Offline scanner: banned specifier detection + `--check`;
      runtime ban EventSource + navigator.sendBeacon; self-tests.
- [x] 9. Probe runner: all five opt-in probes + `--list`; spot-run
      cheap probes locally.
- [x] 10. Runtime-QA contract structural checks + `--self-test`.
- [x] 11. testMatch `.spec` coverage + guard test; APK permission
      expected-set file + deny-by-default workflow gate.
- [x] 12. CI wiring + audit-ownership documentation.
- [x] 13. Full matrix: Jest, typecheck, lint, Expo Doctor, repo-state,
      task-ownership, OpenSpec `--all --strict`, all validator
      self-tests + freshness modes.
- [x] 14. Evidence root written; adversarial review closed; durable
      state updated; commit; push; `HEAD == origin/main`.
