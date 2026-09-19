## 1. Gap census

- [x] 1.1 Read and cross-check every durable source (KNOWN_ISSUES, VALIDATION,
  STATE, GOVERNANCE, CURRENT_CAMPAIGN, EXECUTION_PROMPT, DEPENDENCY_AUDIT,
  IMPACT_MAP, OpenSpec changes/archive, Campaigns 041-053 evidence, current CI,
  source/tests/build/runtime)
- [x] 1.2 Record every candidate gap with sources, first campaign, current
  evidence, owner class, severity, closure action, and final disposition
- [x] 1.3 Publish `docs/redesign/evidence/campaign054/GAP_CENSUS.md` with no
  vague "known issue" bucket

## 2. Validation-count reconciliation

- [x] 2.1 Run the authoritative full gated suite on the current tree and
  capture suites/tests/skips/snapshots/console violations
- [x] 2.2 Identify the exact source of the 563/6,724 vs 564/6,726 delta
- [x] 2.3 Correct every current documentation source while preserving
  historically correct intermediate counts
- [x] 2.4 Publish `VALIDATION_COUNT_RECONCILIATION.md`

## 3. Exact-final SHA artifact provenance

- [x] 3.1 Establish whether executable source changed after the Campaign 053
  runtime artifact
- [x] 3.2 Force a fresh Metro re-bundle and rebuild the release APK from the
  current tree
- [x] 3.3 Record exact source SHA, APK SHA-256, size, package/version, build
  mode, signing identity, embedded bundle hash, and runtime identity checks
- [x] 3.4 Publish `FINAL_SHA_ARTIFACT_PROVENANCE.md`

## 4. Stale historical gap reconciliation

- [x] 4.1 Verify later-campaign closure for the Campaign 041 SQLite NPE,
  39/42 lifecycle, release XML/a11y, compact/font-scale clipping, and state
  matrix
- [x] 4.2 Verify Campaign 042 Expo patch drift closure through Campaign 045
- [x] 4.3 Annotate superseded external-CI classifications and correct the
  unsupported Campaign 051 dialog wording
- [x] 4.4 Remove misleading current-language from `KNOWN_ISSUES.md` while
  keeping history intact

## 5. First-install / cold-start closure

- [x] 5.1 Run a repeated startup matrix (fresh install, clear-data, cold
  relaunch, warm, offline, reinstall-over) on the exact release APK
- [x] 5.2 Include a true emulator cold boot with fresh install and clear-data
  first launches
- [x] 5.3 Capture `am start -W` timing, activity state, dialog probes, logcat,
  and marker scans
- [x] 5.4 Classify honestly and publish `FIRST_INSTALL_STARTUP_CLOSURE.md`

## 6. System provider / import closure

- [x] 6.1 Re-test picker open, cancel, return-to-app, and ANR probes
- [x] 6.2 Exercise a disposable selection, preview, merge, and malformed-file
  rejection through the system picker
- [x] 6.3 Separate app invocation from provider behavior and classify
- [x] 6.4 Publish `SYSTEM_PROVIDER_IMPORT_CLOSURE.md`

## 7. External CI refresh

- [x] 7.1 Re-query the four workflows' latest runs, jobs, steps, annotations,
  and runner metadata
- [x] 7.2 Verify repository-side workflow validators and confirm no YAML edit
  masks the condition
- [x] 7.3 Publish `EXTERNAL_CI_FINAL_CLASSIFICATION.md`

## 8. Dependency/security closure

- [x] 8.1 Re-run the production/full audit and re-evaluate every accepted
  advisory
- [x] 8.2 Apply the safe in-range `js-yaml` remediation and remove its waiver
- [x] 8.3 Re-verify the Expo Router -> query-string -> decode-uri-component
  envelope and image-size/uuid toolchain dispositions
- [x] 8.4 Publish `DEPENDENCY_SECURITY_CLOSURE.md`

## 9. Skips / probes / allowlists

- [x] 9.1 Inventory all skips, opt-in probes, quarantines, allowlists,
  exemptions, suppressions, and platform skips
- [x] 9.2 Execute every safe opt-in probe
- [x] 9.3 Verify the unexpected-console baseline and catalog exemption roster
  remain empty
- [x] 9.4 Publish `SKIP_ALLOWLIST_EXEMPTION_AUDIT.md`

## 10. Governance / OpenSpec consistency

- [x] 10.1 Reconcile validation counts, historical annotations, and OpenSpec
  statuses across all durable files
- [x] 10.2 Run strict OpenSpec validation after reconciliation
- [x] 10.3 Publish `DURABLE_STATE_CONSISTENCY.md`

## 11. Full repository matrix

- [x] 11.1 Run the full gated Jest suite and the unexpected-console gate
- [x] 11.2 Run typecheck, lint, Expo Doctor, web export, and every repository
  validator
- [x] 11.3 Run Android debug and release assemblies
- [x] 11.4 Record exact counts in `FINAL_REPOSITORY_MATRIX.md`

## 12. Final Android convergence

- [x] 12.1 Fresh install and core navigation (Home, Games, Game Detail)
- [x] 12.2 Representative gameplay to a persisted Result
- [x] 12.3 Force-stop/relaunch, offline, and persistence verification
- [x] 12.4 Invalid, oversized, and malformed route boundaries
- [x] 12.5 Startup recovery fault path and restoration
- [x] 12.6 SQLite integrity and duplicate-session/reward/currency audit
- [x] 12.7 Publish `FINAL_ANDROID_CONVERGENCE.md`

## 13. Manual/platform boundaries

- [x] 13.1 Re-check availability of physical Android, iOS/macOS, TalkBack/
  VoiceOver, signing, store, and human participant capabilities
- [x] 13.2 Keep unavailable capabilities as `MANUAL_PLATFORM_PENDING` with
  executable handoffs
- [x] 13.3 Publish `MANUAL_PLATFORM_BOUNDARIES.md`

## 14. Adversarial pass and terminal ledger

- [x] 14.1 Independently challenge every closure claim and record the result
- [x] 14.2 Publish `ADVERSARIAL_GAP_REVIEW.md`
- [x] 14.3 Publish the definitive `TERMINAL_GAP_LEDGER.md` with totals and
  verdict

## 15. Git and governance completion

- [x] 15.1 Update governance, state, execution prompt, and task ownership to
  the Campaign 054 terminal record
- [x] 15.2 Commit and push coherent repairs and evidence
- [x] 15.3 Verify `HEAD == origin/main`, clean worktree, and no abandoned
  worktrees/branches/stashes
