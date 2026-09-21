# Campaign 064 — closure

**Change:** `064-dependency-security-validation-gates`
**Status:** VALIDATED
**Verdict:** `CHANGE_064_COMPLETE`
**Predecessor:** `063-release-candidate-runtime-matrix` (VALIDATED)
**Product checkpoint:** unchanged (`34c9b2d`); 063 artifact remains the
certified APK.

## What changed

Twelve gate repairs, each verified against HEAD before implementation
(full claim → fix → proof table in `GATE_CHANGES.md`):

1. ReDoS expiry reconciled across `KNOWN_ISSUES.md`,
   `DEPENDENCY_AUDIT.md`, and the audit allowlist; renewal owner named.
2. Provenance waivers: `--check-allowlist` freshness gate (expired →
   fail, ≤45 days → warn), owner/renewalTrigger required, impossible
   dates (date-only and date-time) rejected, missing file fails.
3. Jest-skip waivers: schema v3 with per-entry `expires`; expiry
   enforcement in both `--summary` and `--check-allowlist` modes;
   calendar-valid dates only; renewal-safe self-test invariants.
4. Affected-area rules for analytics / quests+achievements+streaks /
   theme, mirrored in `IMPACT_MAP.md`, per-row sync association,
   `--self-test`, documented `--strict` semantics.
5. Console gate covers `error`/`warn`/`log`/`info`/`debug`; expected
   output is classified and forwarded; seven deliberate emitters scoped;
   dead debug print removed; `[perf]` source emitter suppressed under
   jest only.
6. Secrets scanner: npm / Google API / Stripe live patterns.
7. Offline scanner: banned package specifiers (static, require, dynamic,
   commented-dynamic, side-effect, template shapes); runtime ban adds
   `EventSource` and `navigator.sendBeacon`.
8. Probe runner: all five opt-in probes + `--list`.
9. Runtime-QA contract: parsed scheme, deep-link → route resolution
   (placeholders must match real dynamic routes), testID export.
10. Jest `testMatch` includes `.spec.ts(x)` + config guard test.
11. Android APK permission gate is deny-by-default against a committed
   8-entry expected set.
12. New checks wired into Repository Integrity (push + weekly);
    network-audit ownership documented; App CI stays hermetic.

## Terminal validation

| Gate | Result |
|---|---|
| Full Jest matrix | **PASS** — 583 suites (578 passed + 1 passed-with-pending — Jest's `focused` JSON label for a green suite that contains an allowlisted opt-in skip — + 4 skipped); 6,854 tests passed / 5 classified opt-in skips (6,859 total); 5 snapshots; exit 0 (269.983 s) |
| Jest signal integrity | **PASS** — `pass: true`, 5 classified skips, 0 unclassified/ambiguous, 0 unexpected console output |
| Typecheck | **PASS** (exit 0) |
| Lint | **PASS** (exit 0) |
| Expo Doctor | **PASS** (see run below) |
| OpenSpec `--all --strict` | **PASS** — 48/48 (includes change/064) |
| Repository state | **PASS** |
| Task ownership | **PASS** |
| Offline validator | self-test 30/30; scan CLEAN (983 files) |
| Secrets validator | self-test PASS; scan CLEAN (2,633 tracked text files) |
| Provenance validator | self-test 13/13; `--check-allowlist` OK (2 entries, earliest 2026-11-11) |
| Jest-skip validator | self-test PASS; `--check-allowlist` OK (5 entries, earliest 2027-03-31) |
| Affected-area validator | self-test 16/16; `--check-sync` OK (19 areas / 51 patterns); `--strict` exit 1 on unmatched |
| Runtime-QA contract | self-test 16/16; live check PASS |
| Dependency audit | self-test 41/41 |
| Workflow hygiene | self-test 44/44; PASS (4 files) |
| Probe runner | all five probes executed, baselines written, exit 0 (markers captured ⇒ console forwarding works) |
| APK permission comparison | local aapt2 diff `PERMISSION_SET_MATCH (8 permissions)` |

Raw command output: `VALIDATOR_OUTPUT.md`. Matrix log:
`D:\Temp\campaign064-matrix.log` (outside Git).

## Adversarial review

Two independent adversarial reviewers returned `NOT_READY`; all findings
were repaired:

- Critical: all-level console guard + `[perf]` emission red matrix →
  `sdk/perf.ts` suppresses the log line under jest only.
- Critical: scoped output swallowed → expected output now forwarded;
  probe runner re-run proves markers reach stdout.
- High: `await` in two non-async test callbacks → fixed; typecheck 0.
- High: placeholder deep links resolved vacuously → placeholders must
  match a real dynamic route.
- Medium: impossible calendar dates (both forms) → calendar round-trip
  validation in both validators.
- Medium: self-tests pinned shipped allowlist values → renewal-safe
  invariants (real-now expiry check, no exact dates/counts).
- Medium: provenance waivers lacked owner/trigger → schema + durable
  state updated.
- Medium: offline specifier false negatives → side-effect, template, and
  commented-dynamic shapes added.
- Low: association-blind `--check-sync` → per-row comparison.
- Low: unpinned `--strict` semantics → `strictFailure` seam.
- Low: missing provenance allowlist passed → now exit 1.
- Low: arrow throwers/untested runtime ban → constructable throwers +
  explicit EventSource/sendBeacon assertions.
- Low: stale comments/overclaims → corrected.

A third adversarial closure verifier confirmed 10 of 14 items resolved
and found 4 residuals (date-time rollover, future pinned “now”,
`jest/setup.js` comment, one proposal count); all four were repaired and
re-verified (`provenance self-test: PASS (13 checks)`).

## Boundaries (unchanged, explicit)

Local-vs-CI install divergence, network-audit BLOCKED flapping
(fail-closed by design), provenance `games/**` identity scope,
Jest-vs-native SQLite adapter divergence, Android ABI matrix, external
CI account/policy, iOS, physical/OEM, store signing, human TalkBack —
NOT VALIDATED / MANUAL / EXTERNAL, not claimed here.
