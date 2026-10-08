# 076 closure recovery checkpoint — 2026-10-08

**Campaign ACTIVE / release acceptance BLOCKED.** This is a preserved recovery checkpoint, not either terminal completion verdict. Source fixes and route evidence advanced; final game-state/ARTEMIS acceptance still owed. Training Studio remains locked; gameplay/scoring, persistence, economy, workout ownership, offline and registry contracts unchanged.

## Committed source and one APK identity

- Recovery started on clean `main` at `eff5de0e80823830ab180146c72b503e037ccbd5`, one commit ahead of origin/main (`c3c75b9`). No temporary branches/worktrees.
- Repairs committed/pushed as **`c324960c7619d305f01d60587f9e74c4ca93ca6a`**: Progress-detail header wraps at 2× text; regression guard failed before the change and passes afterward. Stale Task Switch test expectation corrected from fractional `Score 148.8` to rounded `Score 149`; scoring unchanged.
- Canonical x86_64 release: `./gradlew.bat :app:assembleRelease --console=plain -PreactNativeArchitectures=x86_64`, BUILD SUCCESSFUL in 3m40s. Installed and independently device-SHA checked, launched without Metro.
- APK SHA-256 **`de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`**, **48,888,204 bytes**, `com.braintraining.app` 0.1.0/1000, source `c324960…`.
- Intermediate `6e31d41e…` (source `eff5de0…`) is superseded. It had **21/22**, not the chat-reported 22/22, gap pairs: Tap Rush feedback absent. Filed `b2913bca…` closure frames are historical after later source fixes. None inherit current-APK acceptance.

## Current route evidence: reviewed and filed

- **90/90** route PNG + unique app-hierarchy pairs: `final-matrix-de6c5fcd/captures.json`, all bound to the identity above. All PNGs personally inspected in six labelled contact sheets; large-text badge directly inspected. No launcher, loading skeleton or wrong-surface frame accepted. Initial 89/90 acquisition had one ARTEMIS observation RuntimeError on fs2 game detail/dark; a bounded same-surface recovery supplied the missing pair.
- Native clipping repair confirmed: full **1 session** badge readable on its own wrapped row in 2× light/dark. Before PNG/XML/hash evidence remains in `closure-defects/progress-badge/`.
- Results reward/replay overlap suspicion rejected by actual pixels: **2/2** light/dark 2× scrolled captures in `final-scroll-de6c5fcd/captures.json` show full reward and Play again control, without overlap, at >=48dp. Observation-only emulator scroll, not gameplay or controller acceptance.
- Seven-question route review: app foreground YES; named destination visible YES; requested loaded/empty/recovery route class YES; mechanic/scored feedback N/A for these route stills; visible controls legible YES (below-fold replay additionally verified); state classification correct YES; no actionable clipping/contrast/overlap observed in these views. Large-text mid-word fact-label wrapping is Low polish; secondary CTA subtitle intentionally ellipsizes. These are not a 42-game interaction review or a fresh completion proof.
- Reproducible audits on the **filed** unique XMLs: default light/dark 15 each, compact light/dark 15 each, 2× light/dark 15 each; all exit 0 / 0 violations. **32 occluded nodes excluded as unmeasurable**, not certified targets. Scrolled Results audit: 2 surfaces, 0 violations, 0 occluded. Raw multi-window XML preserved as `.windows.txt` to avoid double-counting it as a second surface. PNG/app XML/raw XML hashes verified; capture verifier PASS for 90/90 and 2/2. After commit, use `--require-committed`.

## Local gates and source-SHA remote evidence

- Full Jest **621 passed/4 skipped suites; 7,237 passed/5 skipped tests; 5 snapshots**, signal/console gate PASS. Focused Home/Progress 2 suites/7 tests PASS. Typecheck/lint and web export PASS.
- Repo-state, task ownership, offline, secrets, provenance, workflows, affected-sync, Expo alignment, dependency audit/self-test, registry, runtime-QA contract, clean-checkout **self-test**, QA Node tests, strict OpenSpec PASS. Full clean-checkout composite NOT RUN in this recovery; do not confuse its self-test with certification. LSP: 5 existing inline-style hints + 1 unconfirmed path, not a clean-LSP claim.
- `c3c75b9` App CI `37654478658` failed on the stale display assertion. Recovery source **c324960** has all four completed GREEN workflows: App CI **37715645616**, Integrity **37715645424**, Android build **37715645412**, iOS build **37715645502**. An evidence-only checkpoint ending SHA requires its own remote check; source-SHA green is not silently final-SHA green.
- iOS **BUILD PASS / RUNTIME NOT VALIDATED**. Human TalkBack/VoiceOver, physical/OEM and store signing are not certified.

## Bounded current ARTEMIS attempts — external blocker

Doctor/ADB/helper READY did not establish valid provider authentication. Supported external MCP `mobile_run_task`, `mobile_manage_task`, and `mobile_inspect_trace` were used; no provider configuration changed and no foreground/CLI/gameplay fallback substituted.

| Model | Trace ID | Actual result |
| --- | --- | --- |
| Flash | `043dea1e-34df-4fcd-a38a-8dffa432176c` | FAILED: Task runner process terminated unexpectedly; no step evidence. Runtime/launch infrastructure, not classified as a provider 429/503. |
| Pro (one same-protocol bounded attempt) | `cecc4f2a-ae03-4868-a074-adf533e12a61` | FAILED after 15.4s: LLMPermanentError, HTTP **401 Invalid credential**. Trace inspection: no plan, no steps. **BLOCKED_EXTERNAL_ARTEMIS_PROVIDER** (authentication). |

Raw traces remain external at `D:\Tools\artemis\traces\`; no credentials or raw traces copied into Git. Historical nine capacity failures (429/503/180s) remain historical. Current first-run, daily workout, interrupted resume, result/completion and diagnostic journeys are **NOT VALIDATED**, not implicitly executed by a launch or old trace.

## Safe stopping point / resumption requirements

Owner/external action: repair the configured ARTEMIS provider credential **only in its external environment**, without sending a token in chat. Stop retries until that action; no alternate provider/controller has been selected.

Then resume on this APK/source identity: collect/review/file all **22 current-build gap states** via the authoritative controller, finish the 42-game one-line assessment and in-game target/reduced-motion checks, execute Pro journeys, remaining clean-checkout/final gates, task ledger and final coverage/report. Historical game index integrity/completeness still PASS (194 retained/16 rejected; A/F/P/R each 42/42, 168/168), but its mixed-build frames do not certify this APK. No acceptance checkbox was changed in this recovery. No terminal validated or repo-complete verdict is justified yet.
