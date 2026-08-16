# Affected-Area Validation Map

This map begins conservative and should become machine-checkable as the real codebase forms.

| Changed area | Minimum light validation |
|---|---|
| `AGENTS.md`, `.agent/**`, `docs/**` | repository-state validator; doc/reference consistency |
| package manifest/lockfile | clean dependency install; repository validator; available typecheck/build |
| app navigation/shell | typecheck; affected unit tests; app launch + navigation smoke |
| SQLite/schema/migrations | migration tests; persistence tests; launch; representative read/write smoke |
| Game SDK shared contracts | typecheck; SDK unit/contract tests; representative canary games; app launch |
| individual game module | typecheck; game unit/contract tests; targeted emulator smoke for that game |
| scoring/rating | normalization/rating unit tests; representative fixed-seed fixtures; regression samples |
| currency/progression | transaction-ledger/progression tests; persistence reload smoke |
| Android QA harness | harness self-test; no-host-input proof; screenshot/log artifact check |
| visual/design-system shared layer | affected screenshots + representative canary screens |
| CI/scripts | run script locally where possible; validate workflow syntax/behavior through GitHub Actions |

Full catalog, stress, broad visual regression, failure injection, and deep performance profiling belong to explicit hardening campaigns unless a Critical/High issue requires targeted repair.
