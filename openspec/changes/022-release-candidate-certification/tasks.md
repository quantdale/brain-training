# Tasks — Campaign 022 Release-Candidate Certification

## 1. Debt triage and disposition

- [ ] 1.1 `xp_awards` idempotency (Medium): full write-path audit, adversarial
      tests, then fix (migration + rollback/retry/idempotency tests) or
      documented-proof downgrade.
- [ ] 1.2 Offline validator heuristic gap (Low): determine whether any concrete
      runtime network escape exists; fix or keep Low with honest documentation.
- [ ] 1.3 Provenance-allowlist dead entries, seeding mock seam, QA artifact
      retention (Low): classify and disposition (fix, defer with rationale, or
      reclassify FALSE/OBSOLETE).

## 2. Release artifact

- [ ] 2.1 Clean dependency install + Expo Doctor on candidate tree.
- [ ] 2.2 Clean Expo prebuild + release Gradle assembly (APK; AAB if
      credential-free).
- [ ] 2.3 Artifact inspection: SHA-256, size, versionName/versionCode,
      minSdk/targetSdk, permissions, ABIs, no dev/debug-only behavior.

## 3. Standalone runtime certification (dedicated AVD)

- [ ] 3.1 Install release artifact from uninstalled state; launch; prove no
      Metro dependency; navigate all primary tabs.
- [ ] 3.2 Broad game certification across the registry (open → interact →
      pause/resume → complete → exactly-one session row → invariants → result
      navigation), failures investigated individually.
- [ ] 3.3 Workout V3 runtime certification: daily + focus domains, resume after
      process death, no double-payment, provenance integrity.
- [ ] 3.4 Lifecycle torture: force-stop/kill mid-game, mid-workout, on results;
      relaunch cycles; duplicate-write and stale-timer checks.
- [ ] 3.5 Terminate → cold relaunch → data persists; uninstall/reinstall
      behavior.

## 4. Data integrity certification

- [ ] 4.1 Real-SQLite soak: integrity_check, FK/invariant checks, migration
      replay, large-history corpus, malformed-but-recoverable fixtures.
- [ ] 4.2 Backup/export/restore round-trip equivalence on device (sessions,
      XP, ratings, achievements, quests, workout state, preferences) plus
      adversarial archives (truncated, malformed, incompatible, duplicate,
      interrupted).

## 5. Platform evidence

- [ ] 5.1 Accessibility: accessibility-tree audit across primary surfaces;
      TalkBack classified honestly.
- [ ] 5.2 SAF/system sheets: app-side round trip PASS vs system-sheet NOT
      VALIDATED with exact manual steps.
- [ ] 5.3 Physical Android device if authorized hardware present, else
      NOT VALIDATED.
- [ ] 5.4 Performance soak: cold/warm launch, repeated completions, memory/
      timer/listener/statement accumulation.
- [ ] 5.5 Offline proof: startup, gameplay, workout, progression, backup,
      relaunch with device network disabled.
- [ ] 5.6 Security/privacy: packaged permissions, logs, exported data
      contents, secret scan over artifacts.
- [ ] 5.7 iOS: runtime only if macOS environment exists; else compile-smoke
      maintained + runtime NOT VALIDATED.

## 6. Convergence and verdict

- [ ] 6.1 Full final regression matrix on the final candidate SHA.
- [ ] 6.2 All four workflows green at exact final SHA; run IDs recorded.
- [ ] 6.3 Durable release-readiness matrix + GO / CONDITIONAL GO / NO-GO
      verdict; STATE/VALIDATION/KNOWN_ISSUES truth-repaired; clean tree;
      `main == origin/main`.
