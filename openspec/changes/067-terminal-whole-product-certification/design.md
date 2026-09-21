# Design — 067-terminal-whole-product-certification

## Sequence

1. **Freeze** — strict-validate this package, record the source commit
   that will be certified, ensure the working tree is clean.
2. **Artifact** — `:app:assembleRelease` (no-daemon, versioned outputs);
   identity via sha256 + bytes + `aapt2 dump badging` + permission-set
   diff; bundle hash extracted from the APK and compared with the 10
   freshness markers (same recipe as 063); launch with Metro stopped to
   prove independence.
3. **Repository matrix** — the 065/066 gate string: Jest with
   `--json` summary + `validate-jest-signal --summary` (exact pinning,
   floors), opt-in probe runner 5/5, typecheck, lint, Expo Doctor,
   registry/provenance/offline/secrets/workflows/repo-state/
   task-ownership, dependency audit, OpenSpec strict.
4. **Native journey** — reuse the 063 matrix recipe on the new artifact:
   3 clean installs + relaunches (bounded first-install ANR watch),
   offline/force-stop, route + recovery matrix, provider open/cancel,
   real completion(s) driven through hierarchy-guided taps, workout-leg
   journey if reachable, relaunch retention, SQLite audit, filtered
   logcat scan. Every lane starts PASS or NOT VALIDATED; nothing is
   assumed from 063.
5. **Pixels/a11y** — `scripts/qa/ui-capture.mjs` + `scripts/qa/a11y-audit.mjs`
   across the six combinations; interaction surfaces for the 42 games
   where feasible; the 066 census C1–C5 items disposed here.
6. **Deferrals** — 065 audit-map deferred list + 066 census: execute on
   the artifact (cold deep-link fallback B1, UI import/wipe B4) or
   record accepted debt with reasons.
7. **Ledger + closure** — terminal ledger, durable state, adversarial
   review, commit/push.

## Defect loop

A reproduced defect → minimal source fix + focused regression test →
rebuild → re-run every affected lane → record; certification only for
the final artifact identity. No speculative work.

## Evidence layout

`docs/redesign/evidence/campaign067/`: `ARTIFACT.md`,
`MACHINE_EVIDENCE.md`, `STARTUP_MATRIX.md`, `ROUTE_MATRIX.md`,
`PIXEL_A11Y_MATRIX.md`, `LIFECYCLE_AND_PROVIDER.md`,
`COMPLETION_PERSISTENCE.md`, `SQLITE_AUDIT.md`, `LOG_REVIEW.md`,
`DEFERRAL_DISPOSITION.md`, `TERMINAL_LEDGER.md`,
`CAMPAIGN067_CLOSURE.md`. Raw captures under `D:\Temp\campaign067-*`.

## Boundaries

Emulator-local input only; one dedicated AVD; human TalkBack/VoiceOver,
iOS, physical/OEM, store signing, external CI and account policy remain
MANUAL/EXTERNAL and are listed explicitly in the terminal ledger.
