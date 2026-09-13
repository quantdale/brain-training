# Audit Map — Campaign 028 evidence base

All findings come from four independent read-only audits executed
2026-09-13 against tree `1733458` (clean `main`, Campaign 027 VALIDATED).
Every campaign task traces to an item here or to the durable
KNOWN_ISSUES/BACKLOG registers. Severities are the auditors' classifications.

## A. App-surface production scan (962 shipped files)

- **A1 (Medium) Silent user-action failures.** `app/(tabs)/index.tsx:476`
  (primary workout CTA), `app/rewards.tsx:274` (cosmetic purchase) and `:300`
  (equip), `app/(tabs)/profile.tsx:523/:544/:561` (milestone/quest/achievement
  claims) log and return with no user-visible feedback; Campaign 027 fixed
  sibling handlers in the same files. → W1.
- **A2 (Low, by design)** `memory-sequence-memory` is the only game without
  `roundProgress` HUD wiring; KNOWN_ISSUES already records it as intentional
  (time-boxed score attack, keeps the round chip). No action.
- **A3 (Low, reviewed)** ~55 unguarded `console.error` release-path logs are a
  deliberate diagnostic convention; no crash telemetry exists and every game
  persist returns `{ok:false}` surfaced as `persist-error`. Reviewed, no
  action (record as reviewed in W5 docs if needed).
- **A4 (Low)** 42 game screens rely on `persistX` never rejecting; contract
  verified across all 42. No action (documented as contract).
- **A5 (Low)** `components/a11y/dialog.tsx:95-101` scrim lacks
  `accessibilityRole`; `components/error-boundary.tsx:70-82` copy mentions a
  back action not present; `components/game-not-ready.tsx:42` unreachable
  `not-implemented` copy says "later wave". → W5.
- **A6 (Low)** `hooks.ts` has no `hooks.test.ts` for
  `attention-target-count`, `logic-code-cracker`, `logic-rule-grid`,
  `memory-prospective-cue`. → W5.

## B. Data-portability audit

- **B1 (Medium, untracked gap)** Password-encrypted backups (§7
  "eventually") are absent and untracked in all four tracking surfaces; the
  `checksum.ts:8-10` comment calls them deferred but §33 never listed them.
  → W5 records an explicit deferred decision; no implementation.
- **B2 (Low, deferral now obsolete)** Export runs two canonicalization
  passes: `exportLocalData` (`serialize.ts:516-525`) discards the text from
  `serializeEnvelopeWithChecksum`, then `serializeBackup` (`:558-560`)
  re-walks. `exportLocalDataBundle` (`:542-551`) already returns
  `{envelope,text}` from one pass and byte-identity is pinned by
  `serializer.test.ts:71-81` and `large-backup-memory.test.ts:160-161`
  (20k sessions). The 027 rationale ("no proof") is stale. → W2.1.
- **B3 (Medium, untracked gap)** `deserialize.ts:386-411` cross-validates
  `ratingHistory.sessionId`/`currencyLedger.sessionId` but not
  `questProgress.questId → quests.id` / `achievementUnlocks.achievementId →
  achievements.id` (FKs at `db/schema.ts:228,251`); malformed backups abort
  with an opaque SQLite FK error inside apply. → W2.2.
- **B4 (Medium, untracked gap)** `pickBackupFile` reads the entire document
  (`file-transport.ts:204-222`) before `MAX_BACKUP_TEXT_LENGTH`
  (`deserialize.ts:42,461-466`) can reject it; `.size` is available. → W2.3.
- **B5 (Low)** `onPreview` lacks a busy guard (`data-management.tsx:244-271`);
  `writeBackup` overwrites same-second names silently
  (`file-transport.ts:132-158`, `transport.ts:58-64`); rejected replace-mode
  previews report merge counters (`preview.ts:175`). → W2.4.
- **B6 (Low, robustness verified)** Checksum/future-version/shape validation,
  transactional apply/rollback, trigger capture/`finally`, crash self-heal —
  no action.

## C. Autobot harness audit

- **C1 (High, QA tooling)** `deepLink()` (`autobot.mjs:1181-1193`) discards
  `am start` output and never verifies route arrival; `flowGame:1547-1553`
  and `probeNextGame:2045-2054` wait for target markers with no route
  classification. A Bridgeless context-not-ready drop leaves the app on Home
  until the budget expires → false "screen did not load" (the recorded 4/8
  and 6/8 canary runs). → W3.1/W3.2.
- **C2 (Medium-High)** Patient pause-retry branch (`autobot.mjs:1692-1700`)
  taps once, sleeps, and sets `resumed=true` without verifying, unlike
  `:1670-1683`; a missed tap becomes "app left paused" (`:1722-1730`).
  → W3.3.
- **C3 (Medium)** Pre-warm is manual (`--mode warm-bundles`);
  `selectTargets` (`:3576-3625`) never schedules it for canaries/certify; the
  known-good 8/8 run required pre-warming by hand. → W3.4.
- **C4 (Low)** `qa-artifacts/` has no retention: 21,841 files / 671.6 MB
  locally; `docs/QA_ARTIFACTS.md` states the policy is manual. → W3.5.
- **C5 (Low)** No offline self-test for navigation helpers; CI runs only
  `autobot --self-test` (`app-ci.yml:85-87`). → W3.1/W3.6.
- **C6 (Low)** `ui-capture.mjs` files a valid-looking Home frame when the
  deep link is dropped (only `Status: ok` checked, `:193-210,391`). The
  shared verified helper closes this. → W3.2 (opportunistic).

## D. Validator/CI audit

- **D1 (High, gate integrity)** `validate-dependency-audit.mjs` never reads
  `expires`/`tracking`/`reviewedAt` (`:82-95,163-171`) and accepts unknown
  classifications, contradicting its own allowlist policy
  (`dependency-audit-allowlist.json:4,33-36`) — the `decode-uri-component`
  accepted debt stays waived forever after 2026-12-31. → W4.1.
- **D2 (Medium)** IMPACT_MAP/`validate-affected.mjs` content drift with a
  row-count-only guard (`:246-265,290-297`): persistence, db/workout,
  app-tabs, governance, content/registry, theme/design rules drift; dead
  root `package.json` globs (`:185`); the checker never runs in CI. → W4.3.
- **D3 (Medium)** `validate-repo-state.mjs` fails open on task ownership
  (empty `catch {}` at `:191,233`, `existsSync` gate at `:185,226`;
  `task-ownership.json`/`EXECUTION_PROMPT.md` not in `required` `:5-29`).
  → W4.4.
- **D4 (Medium)** Offline validator false negatives: dynamic
  `globalThis['fetch']`, aliasing, `fetch (` whitespace, any line containing
  `*` or `//` skipped (`:53-73`), `require('axios')` string, missing
  `sendBeacon`/`EventSource`, scope limited to `apps/mobile/src` `.ts(x)`.
  → W4.2.
- **D5 (Medium)** `certify-clean-checkout.mjs` gate set is stale versus CI
  (missing dependency audit, workflow hygiene, secrets, jest signal) yet
  README presents it as the certification entrypoint. → W4.6.
- **D6 (Low)** Jest-skip allowlist has no expiry/review metadata and
  `validate-jest-signal.mjs` never checks entries match a real skip or that
  `enableWith` exists (contrast `validate-workflows.mjs:141-156`). → W4.5.
- **D7 (Low)** No `schedule:` trigger on repository integrity, so network
  advisories only surface on push/PR; no Dependabot/CODEOWNERS. → W4.7
  (schedule only; bot config is a repo-admin choice).
- **D8 (Low)** Dead references: `scripts/qa/release-driver.mjs`,
  `apps/mobile/tsconfig.validate.json` (zero references),
  `scripts/qa/refero.mjs` (historical only). → W5.1.
- **D9 (Low)** Branch protection absent on `main` — owner-side repository
  administration, not autonomously actionable (already recorded in
  KNOWN_ISSUES). No action; remains an owner recommendation.

## E. Durable register items consumed

- Export canonicalization deferral (027 W2.5 / KNOWN_ISSUES) → B2 → W2.1.
- Offline validator heuristic gap (KNOWN_ISSUES) → D4 → W4.2.
- QA artifact retention (KNOWN_ISSUES) → C4 → W3.5.
- Autobot cold-start race (KNOWN_ISSUES) → C1/C2/C3 → W3.
- Runtime dependency advisory expiry (KNOWN_ISSUES / allowlist) → D1 → W4.1.
- Contradictory KNOWN_ISSUES prose, stale DEFERRED_DECISIONS transport note,
  PARITY_MATRIX gaps → W5.
