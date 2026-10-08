# 076 closure recovery checkpoint

Release acceptance remains **BLOCKED / IN PROGRESS**, not certified. This record supersedes the obsolete remaining-work claims in RESUMPTION.md without relabeling historical evidence.

## Reconciled source and artifact

- On recovery: clean `main`, HEAD `eff5de0e80823830ab180146c72b503e037ccbd5`, one commit ahead of origin/main (`c3c75b9`). No temporary worktrees. Repo-state validator PASS.
- Installed/captured intermediate APK: `6e31d41e64d100636487476ab452f959466d363b2aa933bc40c9f654f65f4674`, 48,888,488 bytes; source `eff5de0e80823830ab180146c72b503e037ccbd5`, package com.braintraining.app 0.1.0/1000, x86_64 release.
- Home stage-ink numeral fix (`eff5de0`) visually confirmed in default/compact/2× light/dark samples. Earlier three fixes: Tap Rush hit testing (`e259171`), integer HUD display and number-line feedback geometry (`4a6fc53`).

## Evidence inventory, not automatic acceptance

- Ignored `qa-artifacts/076-final/final-6e31d41e/` has **21/22** PNG/XML gap-state pairs. The repeated chat claim of 22/22 was incorrect: `speed-tap-rush-feedback` is absent. These new pairs still require individual visual review and filing.
- Ignored `matrix-6e31d41e/` has 90 named pairs and predicate-valid latest rows. Visual inspection rejected launcher/compositor-race and hydration frames; those names were recaptured. Counts are acquisition checks, not acceptance.
- Six intermediate automated 48dp audits exited 0. They predate later recaptures and are not final acceptance; rerun over the final immutable set.
- 2× dark sheet inspected: no launcher/loading frames; ordinary mid-word wraps are Low polish, not a claim of excellent large-text typography. Results CTA partly below the fold requires reachability verification.
- **Captured responsive defect:** Progress detail's Recent personal best header does not wrap. At 2× light/dark, `1 session` appears as `1 ses` cut at the card edge. The XML text remains complete but visible bounds are clipped (`[891,760][1038,834]` in light). Preserve actual PNG/XML in `closure-defects/progress-badge/`; do not call the matrix green.
- Focused fix: wrapping `cardHeader`, stable header test ID; regression guard fails before the fix (`flexWrap` undefined), then passes. Jest renderer pins the layout contract, not native pixel layout. Device revalidation is still required.

## Local and remote checks

- Focused Home/Progress tests: 2 suites, 7 tests PASS; full Jest 621 passed/4 skipped suites, 7,237 passed/5 skipped tests, 5 snapshots, signal validator PASS. Typecheck/lint and web export PASS. All declared repository validators, dependency audit/self-test, clean-checkout self-test, QA Node tests and strict OpenSpec PASS. LSP has 5 pre-existing inline-style hints and 1 unconfirmed path; no clean-LSP claim.
- Origin `c3c75b9`: Integrity `37654478713`, Android build `37654478649`, iOS build `37654478748` PASS. App CI `37654478658` FAIL: Task Switch pause test expects fractional `Score 148.8` but HUD now correctly displays `Score 149`. Correct that stale display assertion without changing scoring or disabling the test; full local/remote rerun owed.
- iOS compile evidence is **BUILD PASS / RUNTIME NOT VALIDATED**.

## Next dependency barrier

Commit the captured clipping fix and test-only CI correction, run full local gates, build/install a new committed-source x86_64 APK, and bind a fresh immutable capture set to that identity. Earlier `6e31d41e` and filed `b2913bca` frames are intermediate/historical only. Recollect 22 gap states and 90 route matrix, review every accepted frame, rerun audits and hashes, attempt bounded ARTEMIS Flash/Pro through the external supported MCP server, then close only evidenced tasks and push/verify final CI. The 146 historical game frames remain explicitly mixed-build, not final-build proof. No redesign, scoring/persistence change, host input or unrelated process manipulation is authorized.
