# Campaign 054 — Adversarial Gap Review

**Status:** COMPLETE — every closure claim challenged against current evidence.
**Date:** 2026-09-19
**Method:** independently re-derive each claim from the repository, Git history,
current API responses, current test/build output, and the device DB; look
specifically for the failure classes the campaign prompt names.

## Challenges and findings

| # | Challenge | Evidence checked | Finding | Action |
| --- | --- | --- | --- | --- |
| 1 | Are stale known issues still worded as current? | `.agent/KNOWN_ISSUES.md` full read | Campaign 041 section was headed "current audit findings" with closure actions that Campaign 042/044/045/046 had already performed; 051 disposition asserted an `"isn't responding"` dialog that campaign 051 evidence does not contain | Both corrected with explicit supersession pointers; history preserved |
| 2 | Is the validation-count mismatch real and resolved? | `npm run test:ci` at `9fe9b41`; focused runs of the two H-03/H-04 suites | Authoritative 564/6,726 (4 suites/5 tests skipped, 5 snapshots); delta is exactly the `perf-probe-contract` suite (1 suite / 2 tests) missing from the intermediate measurement | Counts reconciled across change.json, VALIDATION, KNOWN_ISSUES, STATE, CURRENT_CAMPAIGN, campaign-053 packet |
| 3 | Is intermediate-SHA evidence being presented as final? | `git diff 02a7ecb..HEAD` path list; forced Metro re-bundle; APK hash; embedded `assets/index.android.bundle` hash | No executable source changed; forced rebuild reproduces the exact Campaign 053 APK and bundle hashes byte-for-byte | Provenance packet records the chain explicitly |
| 4 | Are the opt-in probes actually executed (not skipped again)? | Probe runner output for all five files | All five executed this campaign; results recorded in `SKIP_ALLOWLIST_EXEMPTION_AUDIT.md` | Closed |
| 5 | Is accepted dependency debt expired or unjustified? | `npm audit --omit=dev --json`; allowlist; ecosystem queries | `js-yaml` had a safe in-range fix and was remediated (waiver removed); `decode-uri-component` expiry 2027-03-31 with re-verified no-compatible-fix; `image-size` (metro pins `^1.0.2`, fix is `>=2.0.3`) and `uuid` are build-dev-only under policy | Dispositions current |
| 6 | Does any old conditional language conflict with current proof? | 040/041/042/043/050 labels vs later campaigns | 041 items annotated superseded; 042's `INDETERMINATE_EXTERNAL_PRE_STEP` annotated as superseded by 044's `ACCOUNT_OR_POLICY`; 050's conditional ANR re-tested; 040/043 remain historical scope labels (correct for their scopes) | No unresolved contradiction |
| 7 | Is the first-install ANR hand-waved? | 30 assessed launches (warm + true cold boot), dialog probes, per-run logcat, ANR process probes | Not reproduced in any run; 0 dialogs, 0 markers; classified `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE`, explicitly not "fixed" and not a guarantee | Boundary statement retained (single historical observation on a later-degraded AVD; physical/OEM remains manual) |
| 8 | Is the provider failure misattributed? | Two picker open/cancel cycles, full select/preview/merge, malformed rejection; app-side invocation inspected in source | App uses the standard `ACTION_OPEN_DOCUMENT` contract; DocumentsUI performed all operations; no ANR in any cycle; human usability remains manual | Technical path `CLOSED_VERIFIED`; historical ANR recorded as not reproduced |
| 9 | Is the external CI classification stale or evidence-free? | Current runs at `9fe9b41` (`35444630023/100/078/111`), jobs, zero steps, blank runners, check-run annotations; full history scan (1,013 runs; last success 2026-09-05) | All four current runs carry the provider billing annotation; no repository step ran; local equivalent gates pass | `EXTERNAL_BLOCKER_VERIFIED` / `ACCOUNT_OR_POLICY`; no YAML edited |
| 10 | Is a debug-signed APK being called a production release? | `apksigner verify --print-certs`; `build.gradle` signing config | APK is signed with `CN=Android Debug`; no release keystore exists | Recorded explicitly everywhere; store signing is `MANUAL_PLATFORM_PENDING` |
| 11 | Is the final artifact hash missing anywhere it is claimed? | Provenance packet, STATE, KNOWN_ISSUES, OpenSpec change, ledger | SHA-256 and size recorded consistently | Closed |
| 12 | Is the repository dirty or unpushed, with abandoned work? | `git status`, worktrees, branches, stashes | Committed and pushed; `HEAD == origin/main`; no temporary worktrees/branches/stashes | Verified at closure |
| 13 | Are "closed" gaps only untested assertions? | Each disposition row in `GAP_CENSUS.md` cites a packet or command | Every `CLOSED_VERIFIED` has a current run; every `SUPERSEDED_CLOSED` cites the closing campaign's packet | No unsupported closure |
| 14 | Challenge: the four-game workout used a seeded returning-player tutorial state | `tutorial_state` row shape matches the app's own writes; every input was real UI; leg results persisted | Tutorial seeding only bypasses a first-play gate; the workout flow, gameplay, results, and persistence are real; documented in the convergence packet | Accepted and documented |
| 15 | Challenge: extra sessions from the interrupted workout attempt look like duplicates | Device DB audit | Distinct session ids; no duplicate session ids, no duplicate ledger `operation_id`; rerun artifact is expected | Documented |
| 16 | Challenge: the offline logcat "OOM" hit | Line content | Matched substring inside a system launcher base64 bitmap payload (`SearchTargetUtil`), not an app line | Recorded as a false positive in the convergence packet |
| 17 | Challenge: Games grid/search claimed without a scrolled release capture | Scrolled release verification run | `games-browse-all`, `games-search`, `games-grid`, and the filter row are present below the suggested block and render on the final artifact | Recorded in the convergence packet |
| 18 | Challenge: TalkBack technical traversal not attempted | Campaign 043 rationale; current emulator check | TalkBack package is installed but a human-quality traversal is impossible for an agent, and enabling the service without a human traversal protocol changes the dedicated runtime's accessibility state for no stronger claim than the recorded hierarchy audits | Retained as `MANUAL_PLATFORM_PENDING`; honest, not a hidden pass |
| 19 | Challenge: Low-severity accepted items with no rationale | Census rows G-09/G-11/G-28/G-43 | Each carries a concrete rationale and (where applicable) a documented bound | Accepted debt explicit |
| 20 | Challenge: does the new OpenSpec packet merely paper over gaps? | `tasks.md`, `spec.md`, ledger vs raw artifacts | The packet records executed work; no task is marked complete without a raw artifact or command output | Verified |

## Residual honest limits (retained, not hidden)

- Bounded re-tests cannot prove the absence of a rare startup/provider ANR.
- The external CI account/policy blocker is outside repository authority.
- Human/platform/store evidence is unavailable in this environment.
- `image-size`/`uuid` and `decode-uri-component` remain accepted debt with
  current rationale; `decode-uri-component` has a time bound.
- Enumerated branch-level UI state coverage beyond the recorded matrices is not
  claimed.

## Verdict

No hidden repository-owned Critical/High/Medium correctness gap was found. The
remaining items are exactly the classes the campaign permits: accepted
time-bounded debt, verified external blockers, manual/platform pending items,
and bounded non-reproducible historical observations.
