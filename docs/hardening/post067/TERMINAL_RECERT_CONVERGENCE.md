# Post-067 terminal re-certification — residual convergence record

**Prompt:** `.agent/POST067_TERMINAL_RECERTIFICATION_CONVERGENCE_PROMPT.md`
**Starting SHA:** `e444ec3` (remote `main`, docs-only prompt commit; executable tree identical to `2a765cc`)
**Executable baseline:** `2a765cc` (067 certification evidence + post-067 hardening source fixes)
**067-certified artifact:** `B7AA4102…` from `a17c019` — HISTORICAL (predates hardening fixes)
**Prior hardening build:** `146F63BF…` (109,602,821 bytes) — device-proven on bounded lanes only, NOT full-matrix certified
**Mode:** terminal closure / no new numbered change (Change 068 NOT created; 056–067 remain VALIDATED, OpenSpec 51/51 strict)

## Pass R1 — current-tree invariant attack (whole-repo, read-only)

**Scope:** persistence, backup/import/export, workout/lifecycle, rating/progression/economy,
shell/routing/Game SDK, sampled games (Memory/Logic/Math/Spatial + shared guards centrally),
native config consistency. Verified against source, not summaries.

**Findings (5 Low, 0 Critical/High/Medium):**

| ID | Finding | Disposition |
|---|---|---|
| R1-F1 | `use-workout-result-advance`: reroll landing between result load and advance commit loses the CAS race silently (session safe, leg needs replay; ms window + paid reroll required) | LOW_ACCEPTED_DEBT — follow-up recorded in `.agent/BACKLOG.md` (recheck-after-advance disclosure); duplicate-surface path must not gain a noisy false error |
| R1-F2 | `file-transport`: `.tmp`/dotfile names writable but invisible in restore list | CLOSED_VERIFIED — `validateBackupName` rejects leading-`.`/trailing-`.tmp` + symmetry test |
| R1-F3 | `sdk/lifecycle`: backwards (test) clock banks negative segments | CLOSED_VERIFIED — `Math.max(0, …)` floor on live readings + banked segments + regression test |
| R1-F4 | `app/results.tsx` personal-best guard reads `Date.now()` twice | CLOSED_VERIFIED — single `now` capture |
| R1-F5 | `preview.ts` merge note overclaims profile-name behavior for empty backup names | CLOSED_VERIFIED — note qualified + re-signed-envelope test |

## Pass R2 — historical reintroduction + test-blindness attack (whole-repo, read-only)

**Seed:** git history `a17c019..HEAD` (105 files, bounded product delta, no schema change),
055 defect repairs (`f95c5dd`, `53468e4`, `34c9b2d`), 066 census, 067 ledger, post-067 Pass A/B/C.
Guard-presence re-verified; 42/42 `normalizedResult` adoption recounted; 42/42 `useSafeBack` census.

**Reintroduction checklist:** R1 HUD-clip PASS, R2 tutorial dead-end PASS, R3 duplicate-score
PASS (with R2-F3 note), R4 deep-link exit PASS, R5 fingerprint/bootstrap PASS (sampled),
R6 FK/idempotency PASS, R7 economy dedupe PASS, R8 focus sync PASS, R9 import/export PASS,
R10 touch-target/a11y PASS, R12 new-code patterns PASS (except F1/F2).

**Findings (5 Low, 0 Critical/High/Medium):**

| ID | Finding | Disposition |
|---|---|---|
| R2-F1 | Two local `clamp01` clones diverge from canonical non-finite contract (`logic-deduction-table/reducer.ts`, `math-number-line-estimation/components/number-line.tsx`); guard test later caught a third (`logic-order-path/generator.ts`) | CLOSED_VERIFIED — all three single-sourced + tripwire test failing on any new local definition outside `sdk/` (one allowlisted delegating wrapper, delegation asserted) |
| R2-F2 | Affected-map has no rules for `hooks/**`, `platform/**`, `components/a11y/**`, `components/settings/**` (light validation could under-prescribe) | CLOSED_VERIFIED — 2 new RULES + mirrored IMPACT_MAP rows; `--check-sync` OK (21 areas), `--self-test` 16/16, previously-unmatched hardening paths now map with 0 unmatched |
| R2-F3 | Three retained single `Score` StatRows render unrounded `String(score)` (formatting-only; no duplicate-row reintroduction) | CLOSED_VERIFIED — `Math.round` at the 3 StatRows + matching 3 header `score=` call sites (other 34 header sites pass composite strings and are intentionally untouched) |
| R2-F4 | Jest floor allowances permit silent mass-test loss (`minTotalSuites 575` vs 598, `minTotalTests 6840` vs ~6945) | LOW_ACCEPTED_DEBT — floors are deliberate review buffers; exact per-entry pinning (v4) covers the skip path; recorded in `.agent/BACKLOG.md` |
| R2-F5 | Global Jest mocks diverge from production backends by construction (node SQLite adapter, expo-audio/haptics, expo-router) | LOW_ACCEPTED_DEBT (architecture) — device-proof requirement retained for adapter/router/exit changes |

## Pass R3 — production artifact + hostile-journey attack (whole-repo, read-only)

**Lens:** hostile user + hostile environment (packaging, process death, malformed routes,
partial workflows, stale state, hostile imports, repeated actions, hostile navigation,
a11y, font-scale/dark/compact, error states, perf hotspots, release diagnostics).

**Findings (3 Medium bounded + 7 Low, 0 Critical/High):**

| ID | Finding | Disposition |
|---|---|---|
| R3-F1 (Medium) | Plaintext backups ride Android auto-backup (files domain; only DB excluded) | ACCEPTED (disclosed) — user-initiated backups, app-private dir, in-app copy discloses; exclusion is an owner product decision in `.agent/BACKLOG.md` (062). No remote exfiltration. |
| R3-F2 (Medium) | Large-export memory amplification (snapshot + chunks + joined text + state string) | ACCEPTED (probe-bounded) — bytes correct (single-pass pinned); 5k/20k probes green incl. 20k export 1.16 s / 15.2M chars / 966 chunks / ~97 MB node heap delta this session; low-RAM OEM bound documented, not a correctness defect |
| R3-F3 (Medium) | Upstream `decode-uri-component` ReDoS runs before the app envelope | ACCEPTED_TIME_BOUNDED_DEBT — pre-existing, expires 2027-03-31, gate-enforced, recorded in KNOWN_ISSUES + allowlist; envelope prevents selection/persistence (jank/DoS only, not corruption) |
| R3-F4 (Low) | Cold deep link to `/game/[id]` intro has no in-app exit (system back exits app) | CLOSED_VERIFIED — shared GameHost intro gains a ghost "Back to games" (`intro-back`) routed via the standard `onQuit` safe-back; labelled, 44 dp (sm), hidden while tutorial owns focus + press test |
| R3-F5 (Low) | Reject paths echo attacker-controlled strings unbounded into UI/logcat | CLOSED_VERIFIED — `echoId` truncation (80 chars + length marker) at all 11 `deserialize.ts` sites + both `preview.ts` displayName echoes; short ids render verbatim (message contracts preserved) + adversarial bound test |
| R3-F6 (Low) | Pending-launch ownership is memory-only; pre-persist death degrades to standalone | ACCEPTED (by design) — durable provenance lives in `rawResult` post-save; no false credit; replay-the-leg is the bounded retry |
| R3-F7 (Low) | Paid-reroll lost-confirmation edge can double-charge one UI intent | ACCEPTED (by design, bounded to reroll flow) — per-key dedupe + refresh-on-conflict; ledger-winner re-read recorded as follow-up in `.agent/BACKLOG.md` |
| R3-F8 (Low) | Broad storage permissions without `maxSdkVersion` scoping | LOW_ACCEPTED_DEBT — neutered under scoped storage; recorded in `.agent/BACKLOG.md`; changing the set without aapt2 verification available would risk the deny-by-default gate |
| R3-F9 (Low) | Import accepts unknown gameIds; unplayable legs persist until reconcile heals | ACCEPTED (by design) — forward-compat posture; covered by deserialize + reconcile gates |
| R3-F10 (Low) | `claimAllRewards` sequential per-item, not one atomic txn | ACCEPTED (by design) — kill mid-loop leaves remainder claimable; per-item atomicity is the right granularity |

## Pass R4 — fresh post-fix convergence check (whole-repo, read-only, post-fix tree)

**Scope:** all 9 fixes (correctness, contract consistency, fix-introduced regressions,
over-broadening) + neighborhood void-scan + disposition challenges.

**Verdict: 9/9 SOUND, 0 REGRESSION, 0 disposition challenges, 0 new material issues.**

One Low note: R4-N1 (header `score=` vs StatRow rounding asymmetry) — CLOSED_VERIFIED by
rounding the 3 matching header call sites (34 composite-string sites intentionally untouched).

**Terminal residual census: 0 open repository-owned Critical/High/Medium defects.**
Accepted items are Lows / time-bounded debt / disclosed product decisions with concrete
rationale above; none disguises a correctness defect.

## Executable diff of this closure (vs `2a765cc`)

Source fixes (10 with R4-N1) + regression tests + `logic-order-path` generatorVersion
`1.0.0 → 1.0.1` (provenance contract: generator.ts is a watched identity file; behavior
identical) + regenerated `registry.generated.ts` + affected-map rules/rows + 5 fresh
`scripts/perf/baselines/` probe outputs. No schema/migration/route/economy change.

## Repository matrix (post-fix tree, stable at rerun)

- Full gated Jest (`npm run test:ci`): **PASS** — 598 suites (594 passed + 4 skipped),
  6,939 passed + 5 classified opt-in skips, 5 snapshots, 0 unexpected console output,
  exit 0 (110.2 s). A concurrent mid-edit run caught exactly one failure (registry
  `--check` while `game.json` was bumped ahead of regeneration); the clean rerun on
  the stable tree is fully green.
- Jest signal: **PASS** (`--summary /tmp/jest-final2.json`); allowlist OK (5 entries,
  floors 575/6840, earliest expiry 2027-03-31); self-test PASS.
- Typecheck / lint: **PASS** (exit 0 / 0).
- Expo Doctor: **PASS** 21/21. OpenSpec `--all --strict`: **PASS** 51/51 (056–067 VALIDATED).
- repo-state / task-ownership: **PASS**. Affected-map `--check-sync` OK (21 areas,
  55 patterns) + `--self-test` 16/16 + `--strict` 0 unmatched on the four
  previously-unmatched hardening paths.
- Registry `--check`: **PASS** (after regeneration for the 1.0.1 bump). Provenance:
  no drift + freshness OK + empty allowlist.
- Offline CLEAN (985 files); secrets CLEAN (2,723 tracked files); workflows PASS (4 files);
  dependency-audit exit 0 (accepted advisories with time-bounded ReDoS to 2027-03-31);
  runtime-QA contract PASS.
- Opt-in probes 5/5 with fresh same-host baselines (`scripts/perf/baselines/`, 20k export
  1.16 s / 15.2M chars / 966 chunks / ~97 MB node heap delta — no amplification regression).
- Web export: **PASS**.
- Android debug/release builds: **PASS** — `:app:assembleRelease` and
  `:app:assembleDebug` both exit 0 on this host (SDK 35.0.0, JDK 21).
  See FINAL_POST_HARDENING_CERTIFICATION.md.

## Native/device lanes — BLOCKED (environment, evidenced)

Full detail in FINAL_POST_HARDENING_CERTIFICATION.md §Native. In short: final
artifact `5FE03134…` built and provenance-bound (bundle `423A8718…`, 10/10 + 4
new-tree markers, 8/8 permissions, debug-signed local release), but the sandbox
host cannot run an Android guest — broken host-kernel KVM (`kvm_spurious_fault`
BUG on every vCPU creation, 8 occurrences in `dmesg`), no GPU, no nested virt.
Five boot attempts across `braintraining-qa35` and fresh `braintraining-ui35`
(emulator 37.1.11, KVM, modern `-gpu swiftshader`) never reached adb. Native
matrix, workout, SQLite, logs, provider UI paths, six-way pixels and device
a11y on the final artifact are NOT VALIDATED (device-blocked, not product).
