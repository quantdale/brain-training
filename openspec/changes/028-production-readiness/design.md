# Design — Campaign 028: Production-Readiness Closure

## Principles

1. **Smallest correct change.** Every fix is the minimum that removes the
   defect class, pinned by a regression test that fails on the old behavior.
2. **Follow existing patterns.** Error surfacing mirrors the Campaign 027
   toast pattern; validation mirrors the existing typed rejection gates;
   harness retry mirrors the existing trace/dump discipline.
3. **Fail closed, disclose honestly.** Gates must enforce their own written
   policy; retries must be traced; unavailable evidence is recorded, never
   faked.
4. **No behavior change to gameplay, scoring, persistence formats, or
   navigation.** The only format-adjacent change is stricter import
   *validation* (reject malformed cross-FK data earlier with a typed error).
5. **Shared-hotspot ownership.** The orchestrator owns `scripts/**`,
   `.agent/**`, `openspec/**`, `docs/**`, `.github/**` and generated files;
   code packets own disjoint app surfaces.

## Workstream designs

### W1 — User-action reliability

Each failure handler currently logs and returns while the UI stays silent.
The repair mirrors the 027 pattern: set a danger toast (the screens already
own a toast channel) and keep the operation safely retryable. Sites:

- `app/(tabs)/index.tsx` `onStartTemplate` — Home's primary CTA.
- `app/rewards.tsx` cosmetic purchase and equip handlers.
- `app/(tabs)/profile.tsx` milestone/quest/achievement claim handlers.

Tests extend the existing route failure-path suites (`src/app/__tests__/`)
by injecting a rejection and asserting user-visible handling. No state
machine changes.

### W2 — Data-portability robustness

- **Single-pass export.** `exportLocalDataBundle(db)` already returns
  `{ envelope, text }` from one canonical walk; `serializeEnvelopeWithChecksum`
  returns text+checksum from the same pass. Byte identity is pinned by
  `serializer.test.ts` and `large-backup-memory.test.ts` (20k sessions).
  The production screen migrates to `exportLocalDataBundle` and stops calling
  `serializeBackup` on the result. `exportLocalData`/`serializeBackup` remain
  public for compatibility and tests.
- **Cross-FK validation.** `deserialize.ts` already validates
  `ratingHistory.sessionId` and `currencyLedger.sessionId`; add
  `questProgress.questId`/`achievementUnlocks.achievementId` against the
  backup's own `quests`/`achievements` id sets, producing the same typed
  validation rejection instead of an opaque SQLite FK abort.
- **Pre-read size guard.** `file-transport.ts` `pickBackupFile` obtains a
  `DocumentPicker` asset; where `.size` is available, reject files above the
  deserialize cap before `file.text()`.
- **Preview re-entrancy + backup-name collision.** Add the missing `busy`
  guard to `onPreview`; make `defaultBackupName` collision-resistant beyond
  one-second resolution (suffix on collision) so a repeated export cannot
  silently overwrite the previous backup.

### W3 — QA harness reliability

- **Route classification.** A pure `routeState(xml, targetId, catalogIds)`
  returns `target | loading | home | other-game:<id> | unknown` using
  existing markers (`<id>.screen`/`<id>.intro`, `game-not-ready-loading`,
  `home-` ids, `extractMountedGameId`).
- **Verified deep link.** `deepLinkToGame` retries (bounded, env-tunable) when
  the post-intent state is `home`/`unknown`, waits patiently while `loading`,
  and escalates to a cold-start intent (`force-stop` + `am start` URL) after a
  delivered-but-ignored intent. `flowGame` and `probeNextGame` consume the
  verified helper. Every attempt is traced; failure reasons include attempt
  count and last route.
- **Pause/resume symmetry.** The patient-retry branch uses the same
  verified-dismiss loop as the first branch; `resumed` is set only after the
  overlay is observed gone.
- **Scheduled pre-warm.** Before canaries/certify/all, a best-effort prewarm
  of planned game routes runs (skippable with `QA_PREWARM=0`), recorded in
  `run.json` as a non-certification block.
- **Bounded retention.** `pruneRunDirs()` before creating a new run dir
  deletes only harness-owned run directories matching the run-id pattern,
  never the current run, never dirs without `run.json`, never curated
  evidence directories; honors `QA_KEEP_RUNS` (default 10) and
  `QA_NO_PRUNE`; deletions are logged.

### W4 — Validator/CI hardening

- **Dependency-audit expiry.** Schema-enforce `runtime-accepted-debt`
  (future ISO `expires` + non-empty `tracking`), reject unknown
  classifications, and treat expired entries as BLOCKED violations. Reuse
  the `validate-provenance.mjs` future-expiry pattern; extend self-tests.
- **Offline validator.** Fix the comment heuristic so `*` and `//` inside
  code do not skip a line (only actual comment tails), add
  `(?:globalThis|global|window)\s*\[\s*['"\`]` dynamic access, whitespace
  tolerant `\bfetch\s*\(`, `sendBeacon`/`EventSource`, and a scope-aware
  scan; add `--self-test` fixtures and run it in CI.
- **IMPACT_MAP sync.** Give `validate-affected.mjs` a structured rule export
  (`--list-areas --json`) and have the repo-state validator (or the checker
  itself) compare actual path patterns with the table; run
  `validate-affected.mjs --list-areas` in CI so drift fails the build.
- **Repo-state fail-open.** Add `.agent/task-ownership.json` and
  `.agent/EXECUTION_PROMPT.md` to the required list; replace empty `catch {}`
  around ownership parsing with reported errors; add a check that every
  `node scripts/...` path referenced by workflows exists.
- **Jest-skip staleness.** `validate-jest-signal.mjs` verifies every
  allowlist entry's `file` exists and contains its `enableWith` token, and
  fails on stale entries (mirroring `validate-workflows.mjs` pin allowlists).
- **Certify parity.** `certify-clean-checkout.mjs` gains the missing gates
  (dependency audit, workflow hygiene, secrets, jest signal) so its verdict
  matches CI, and its docs stay truthful.
- **Scheduled advisory freshness.** `repository-integrity.yml` gains a weekly
  `schedule` so the network dependency audit surfaces new advisories without
  a push.

### W5 — Cleanup and documentation truth

Remove verified-dead files; fix contradictory/stale prose; record
password-encrypted backups as an explicit deferred decision with a corrected
code comment; fix two copy/a11y nits; add the four missing `hooks` unit
tests. Every deletion is verified unreferenced first.

## Integration and validation model

- Per-packet cheap validation (`tsc`, targeted Jest).
- Orchestrator convergence: full matrix, lint, all validators, OpenSpec.
- Runtime on `emulator-5560`: scheduled-prewarm canaries, daily-workout
  journey, a11y audit; `ui-capture` deep-link verification benefits from the
  shared helper.
- No force-push; coherent commits pushed as waves land.
