# Campaign 064 — gate changes (claim → fix → proof)

**Change:** `064-dependency-security-validation-gates`
**Program:** `.agent/CAMPAIGN056_067_OVERNIGHT_AUTONOMOUS_PROGRAM_PROMPT.md` (SHA `428d293`)
**Predecessor:** `063-release-candidate-runtime-matrix` (VALIDATED)
**Product checkpoint:** unchanged (`34c9b2d`); 064 touches no product source.

| # | Census claim (verified at HEAD) | Fix | Proof |
|---|---|---|---|
| 1 | `KNOWN_ISSUES.md` stated ReDoS expiry `2026-12-31` while the allowlist and `DEPENDENCY_AUDIT.md` state `2027-03-31` | Doc reconciled to `2027-03-31`; renewal owner + trigger named in both durable-state files | `git diff .agent/KNOWN_ISSUES.md .agent/DEPENDENCY_AUDIT.md`; dependency-audit self-test 41/41 |
| 2 | Provenance waivers expire `2026-11-11` with no freshness check | `validate-provenance.mjs --check-allowlist` (expired → exit 1, ≤45d → warn, owner required, impossible dates rejected, missing file fails) + 7 new self-test checks | `provenance self-test: PASS (12 checks)`; `--check-allowlist` OK (2 entries, earliest 2026-11-11) |
| 3 | Five jest-skip waivers had no expiry | Allowlist schema v3 requires `expires`; validator fails expired, warns ≤60d, `--check-allowlist` mode | `validate-jest-signal self-test: PASS`; `--check-allowlist` OK (5 entries, earliest 2027-03-31); expired/near fixtures exercised in-packet |
| 4 | No affected-area rules for analytics/quests/achievements/streaks/theme; `--strict` unused | Three rules added + IMPACT_MAP mirror + `--self-test` (16 checks) + per-row sync association + documented strict semantics | `validate-affected self-test: 16 passed, 0 failed`; `--check-sync` OK (19 areas / 51 patterns); strict exits 1 on an unmatched path |
| 5 | Console gate covered only `error`/`warn` | Guard now intercepts `error`, `warn`, `log`, `info`, `debug`; `GUARDED_CONSOLE_LEVELS` exported; expected output is classified and still forwarded; 7 deliberate emitters scoped with `expectConsoleNoise`, 1 dead debug print deleted; the `[perf]` source emitter is suppressed under jest only (device logging unchanged) | `console-signal.test.ts` (all-level, scoping, non-occurrence, reset) + full matrix zero unexpected output + probe runner captures all 5 markers |
| 6 | Secrets scanner would miss npm/Google/Stripe formats | Three patterns + positive/negative self-tests | `validate-secrets self-test: PASS`; tracked scan `CLEAN — 2633 files` |
| 7 | Offline scanner could not see specifier-only imports; runtime ban patched 3 globals | Raw-code banned-specifier scan (8 packages; `from`/`require`/dynamic/comment/side-effect/template shapes) + `--check` alias + self-tests; runtime ban adds `EventSource` and a `navigator.sendBeacon` Proxy with constructable throwers | `validate-offline self-test: 30 passed, 0 failed`; scan CLEAN (983 files); `offline-boundary.test.ts` PASS (incl. EventSource/sendBeacon throw assertions) |
| 8 | Probe runner covered 2 of 5 opt-in probes | All five probes wired with per-probe env + `--list`; marker capture verified after the console-gate change (forwarding keeps markers on stdout) | `--list` shows 5; runner executed all five and wrote baselines |
| 9 | Runtime-QA contract was string-presence only | `app.json` parsed structurally; documented deep links (including `game/<id>` placeholders, which now must match a real dynamic route) resolved against the real route tree; testID export asserted; `--self-test` (16 checks) | `Runtime QA contract self-test: PASS (16 checks)`; real check PASS |
| 10 | Jest `testMatch` ignored `*.spec.*` | `.spec.ts`/`.spec.tsx` globs added + config guard test (patterns present; every test file under `__tests__`) | `jest-config-coverage.test.ts` PASS |
| 11 | Android permission check rejected only 2 permissions | `scripts/android/expected-apk-permissions.txt` (8 entries) + deny-by-default diff in the workflow, blocked-permission greps retained | Local aapt2 comparison against the 063 APK: `PERMISSION_SET_MATCH (8 permissions)` |
| 12 | Audit ownership undocumented; weekly schedule comment overclaimed | New self-tests + freshness checks wired into repository-integrity (push + weekly); audit ownership comment; App CI stays hermetic with a pointer | `validate-workflows` PASS (4 files); workflow diff |

## Boundaries recorded (not fixed, with reasons)

- **Local-vs-CI install divergence:** CI runs `npm ci`; the lockfile is
  canonical and local `node_modules` is not a repository artifact.
  External/architectural, not a gate defect.
- **Network-dependent audit BLOCKED flapping:** by design fail-closed
  (exit 2); owned by repository-integrity (push + weekly), never added to
  hermetic App CI.
- **Provenance identity scope:** `games/<id>` challenge-identity files only;
  registry reproducibility is guarded by `generate-game-registry.mjs --check`.
- **Jest SQLite vs production native adapter:** test-only Node backend by
  design; on-device certification (063) is the compensating evidence.
- **Android ABI matrix:** smoke builds x86_64 only; a device-ABI matrix is
  runtime-certification scope (067 / post-067), not a static gate.
