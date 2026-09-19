# Campaign 054 — Gap Census

**Status:** FINAL after Campaign 054 execution (runtime dispositions updated)
**Date:** 2026-09-19
**Baseline:** Campaign 053 terminal `8350db2`; start SHA `9fe9b41` (prompt
commit; product source identical to `02a7ecb`).
**Scope of sources reviewed:** `.agent/KNOWN_ISSUES.md`,
`.agent/VALIDATION.md`, `.agent/STATE.md`, `.agent/GOVERNANCE.json`,
`.agent/CURRENT_CAMPAIGN.md`, `.agent/EXECUTION_PROMPT.md`,
`.agent/DEPENDENCY_AUDIT.md`, `.agent/IMPACT_MAP.md`, `.agent/BACKLOG.md`,
`.agent/DECISIONS.md`, `.agent/task-ownership.json`, all 37 current OpenSpec
changes plus the archive, Campaigns 041-053 evidence packets, current GitHub
Actions runs, the current dependency audit, the current Jest suite, current
Android builds, and current emulator runtime behavior.

## Disposition semantics

| Disposition | Meaning |
| --- | --- |
| `CLOSED_VERIFIED` | Closed (or newly closed) and verified in Campaign 054 with current evidence |
| `SUPERSEDED_CLOSED` | Closed/replaced by an earlier campaign; verified still closed now; history preserved |
| `ACCEPTED_TIME_BOUNDED_DEBT` | Explicitly accepted with rationale and (where applicable) an expiry/review condition |
| `EXTERNAL_BLOCKER_VERIFIED` | Proven external (account/policy/service); repository side is coherent |
| `MANUAL_PLATFORM_PENDING` | Genuinely requires unavailable human/platform/store capability; handoff recorded |
| `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE` | Repeated bounded reproduction failed; not claimed as impossible |
| `OPEN_PRODUCT_DEFECT` | Current repository-owned product defect (target: zero Critical/High/Medium) |

## Census

### A. Product correctness / runtime

| ID | Gap | Source(s) | First campaign | Superseded? | Reproducible now? | Owner | Sev | Closure action | Final disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-01 | SQLite `NativeDatabase.prepareAsync` NPE in workout load | KNOWN_ISSUES 041 section, VALIDATION 042 | 041 | yes (042) | no | repository | Med | Verified repair in source + 042 revalidation | `SUPERSEDED_CLOSED` |
| G-02 | Catalog lifecycle 39/42 result-complete | KNOWN_ISSUES 041, VALIDATION 046 | 041 | yes (042+046) | no | repository | Med | Verified 046 42/42 + 053 registry matrix | `SUPERSEDED_CLOSED` |
| G-03 | Release XML/a11y capture blocked (UiAutomation) | KNOWN_ISSUES 041 | 041 | yes (042) | no | repository/tooling | Med | 042 release UIAutomator a11y (22 surfaces, 0 violations); 043/049/051 release PNG+XML | `SUPERSEDED_CLOSED` |
| G-04 | Compact/font-scale Home row clipping risk | KNOWN_ISSUES 041 | 041 | yes (042/049/051) | no | repository | Low/Med | Actionable defect repaired (042); residual card-copy debt; Home rebuilt (051) | `SUPERSEDED_CLOSED` |
| G-05 | First-install ANR (`Brain Training isn't responding`) | KNOWN_ISSUES 050/051, VALIDATION 050 | 050 | no | no (30 runs) | repository | Med (was) | 30-launch bounded matrix incl. true emulator cold boot + filtered logcat | `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE` |
| G-06 | Android Files/import-provider ANR on dismissal | KNOWN_ISSUES 050, VALIDATION 050 | 050 | no | not reproduced (open/cancel/full-path) | platform/provider | Med (was) | Full export → picker → select → preview (Valid, 0 additions) → merge → malformed rejection on the exact APK; 0 ANR evidence | `CLOSED_VERIFIED` (technical path; human usability remains MANUAL_PLATFORM_PENDING) |
| G-07 | Debug LogBox a11y contamination | KNOWN_ISSUES 041 | 041 | yes | no | repository | Low | Release matrices 042-051 carry 0 measured violations; debug LogBox is a dev-tool artifact | `SUPERSEDED_CLOSED` |
| G-08 | Native state-matrix scope (11 routes x 2 themes) | KNOWN_ISSUES 041 | 041 | yes | no | repository | Low | 042/049/050/051/053 + 054 convergence added invalid-route, recovery, settings, journey, responsive states | `SUPERSEDED_CLOSED` |
| G-09 | `attention-visual-search` best-reaction 0 sentinel | KNOWN_ISSUES open maintenance | 023/028 | no | by design | repository | Low | Documented design; Progress ignores non-positive bests | `ACCEPTED_TIME_BOUNDED_DEBT` (Low, rationale recorded) |
| G-10 | Seeding test-fixture seam noise | KNOWN_ISSUES open maintenance | 026 | yes | no | repository | Low | Empty-baseline unexpected-console gate active; full suite emits nothing | `CLOSED_VERIFIED` |
| G-11 | Ordinary card-copy edge clipping (non-actionable) | KNOWN_ISSUES 042 | 042 | no | yes | repository | Low | Classified `DOCUMENTED_DEBT` with rationale; no actionable control affected | `ACCEPTED_TIME_BOUNDED_DEBT` (Low, rationale recorded) |
| G-12 | Device-representative frame timing | KNOWN_ISSUES 024 | 024 | no | no (emulator GPU) | physical device | Low | Requires physical device; handoff recorded | `MANUAL_PLATFORM_PENDING` |

### B. Validation / documentation integrity

| ID | Gap | Source(s) | First campaign | Superseded? | Reproducible now? | Owner | Sev | Closure action | Final disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-13 | Suite/test count mismatch 563/6,724 vs 564/6,726 | terminal commit vs change.json/VALIDATION/KNOWN_ISSUES/STATE | 053 | no | yes (resolved) | repository | Med (docs) | Authoritative full run 564/6,726; delta root-caused to `perf-probe-contract` suite; all docs reconciled | `CLOSED_VERIFIED` |
| G-14 | Historical known-issues phrased as current | KNOWN_ISSUES 041/042 sections | 041 | yes | yes (fixed) | repository | Med (docs) | 041 section rewritten as historical/superseded with closing evidence | `CLOSED_VERIFIED` |
| G-15 | Campaign 051 "isn't responding" wording not in 051 evidence | KNOWN_ISSUES 051 section vs campaign051 evidence | 051 | no | yes (fixed) | repository | Low | Corrected to the evidence's "transient Android System UI dialog"; 050 attribution preserved | `CLOSED_VERIFIED` |
| G-16 | OpenSpec 045-049 statuses stale `ACTIVE` after validated campaigns | openspec/changes/045..049/change.json | 045-049 | no | yes (fixed) | repository | Med (governance) | Status set to `VALIDATED` with terminal notes; strict validation 37/37 after | `CLOSED_VERIFIED` |
| G-17 | Intermediate-SHA runtime evidence presented as terminal | VALIDATION 053 runtime section, CURRENT_CAMPAIGN 053 | 053 | no | yes (resolved) | repository | Med | Bit-identical forced re-bundle at current tree; provenance doc | `CLOSED_VERIFIED` |
| G-18 | Missing explicit final APK hash at terminal docs | terminal governance | 053 | no | yes (added) | repository | Low | SHA-256 + size + build modes recorded in `FINAL_SHA_ARTIFACT_PROVENANCE.md` | `CLOSED_VERIFIED` |
| G-19 | Raw `npm audit` nonzero vs policy PASS ambiguity | KNOWN_ISSUES 041, DEPENDENCY_AUDIT | 020 | no | yes | repository | Low | Current exact counts recorded (19: 15 moderate / 4 high) and mapped to 4 accepted dispositions | `CLOSED_VERIFIED` |

### C. Dependencies / security

| ID | Gap | Source(s) | First campaign | Superseded? | Reproducible now? | Owner | Sev | Closure action | Final disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-20 | `js-yaml` GHSA-2883-xcg3-v3hh (high) | DEPENDENCY_AUDIT, allowlist | 042 | no | fixed | repository | High (toolchain) | In-range patch lockfile update (`3.15.1→3.15.2`, `4.3.1→4.3.2`); waiver removed | `CLOSED_VERIFIED` |
| G-21 | `decode-uri-component` ReDoS (runtime) | allowlist, KNOWN_ISSUES | 027 | no | no compatible fix | upstream + Expo SDK | Med | Re-verified ecosystem state; disposition renewed to 2027-03-31 | `ACCEPTED_TIME_BOUNDED_DEBT` |
| G-22 | `image-size` x2 infinite loops (high) | allowlist, DEPENDENCY_AUDIT | 020 | no | no in-range fix | upstream/Metro | High (toolchain) | Build/dev-only reachability re-verified (metro pins `^1.0.2`; fix is >=2.0.3) | `ACCEPTED_TIME_BOUNDED_DEBT` |
| G-23 | `uuid` buffer-bounds (moderate) | allowlist | 020 | no | no in-range fix | upstream/Expo toolchain | Med | Toolchain-only; vulnerable pattern not exercised | `ACCEPTED_TIME_BOUNDED_DEBT` |

### D. Skips / probes / allowlists / exemptions

| ID | Gap | Source(s) | First campaign | Superseded? | Reproducible now? | Owner | Sev | Closure action | Final disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-24 | 5 allowlisted opt-in probes skipped in CI | jest-skip-allowlist, VALIDATION | 016 | no | executed | repository | Low | All probes executed this campaign; results recorded | `CLOSED_VERIFIED` |
| G-25 | 42-game persistence exemption roster | campaign 053 matrix | 053 | no | verified | repository | Low | Roster remains empty; mechanism present and tested | `CLOSED_VERIFIED` |
| G-26 | Unexpected-console baseline | jest/setup.js gate | 053 | no | verified | repository | Low | Baseline empty; full suite green with gate active | `CLOSED_VERIFIED` |
| G-27 | jest-skip allowlist staleness | validate-jest-signal | 028 | no | verified | repository | Low | 5 entries, schema v2, reviewed condition pinned by probe contract; no stale entries | `CLOSED_VERIFIED` |
| G-28 | Tooling: a11y viewport-clipped measurement class | KNOWN_ISSUES 026 | 026 | understood | n/a | tooling | Low | Documented tooling bound; clipped nodes excluded from violation count | `ACCEPTED_TIME_BOUNDED_DEBT` (tooling, rationale) |

### E. External / platform / manual boundaries

| ID | Gap | Source(s) | First campaign | Superseded? | Reproducible now? | Owner | Sev | Closure action | Final disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-29 | GitHub Actions pre-step failures | KNOWN_ISSUES, campaign 044/050/053 | 041 | classification upgraded 044 | external | account/policy | Med (release admin) | Current runs re-queried; all four zero-step jobs with billing annotation; no workflows edited | `EXTERNAL_BLOCKER_VERIFIED` |
| G-30 | `main` branch protection not configured | KNOWN_ISSUES operational recommendation | 022 | no | owner action | account admin | Low | Handoff recorded; requires owner authorization | `MANUAL_PLATFORM_PENDING` |
| G-31 | Human-quality TalkBack traversal | KNOWN_ISSUES, campaign 043 handoff | 043 | no | unavailable | human | Med (release) | Handoff recorded; technical hierarchy checks listed as separate evidence | `MANUAL_PLATFORM_PENDING` |
| G-32 | VoiceOver / iOS runtime | KNOWN_ISSUES | 031 | no | unavailable | platform (macOS) | Med (release) | Handoff recorded; no macOS/Xcode host exists here | `MANUAL_PLATFORM_PENDING` |
| G-33 | Physical/OEM Android behavior | KNOWN_ISSUES | 031 | no | unavailable | device | Med (release) | Handoff recorded; only emulators attached | `MANUAL_PLATFORM_PENDING` |
| G-34 | Production/store signing | KNOWN_ISSUES, android build config | 031 | no | unavailable | credentials | High (release) | Release APK verified debug-signed; handoff recorded | `MANUAL_PLATFORM_PENDING` |
| G-35 | Store-install path | KNOWN_ISSUES | 031 | no | unavailable | account/store | Med (release) | Handoff recorded | `MANUAL_PLATFORM_PENDING` |
| G-36 | Independent human participant | KNOWN_ISSUES | 031 | no | unavailable | human | Med (release) | Handoff recorded | `MANUAL_PLATFORM_PENDING` |
| G-37 | Human system-provider usability | campaign 050 boundaries | 050 | technical path re-tested | human usability unavailable | human | Low | Technical picker path verified; human judgment remains manual | `MANUAL_PLATFORM_PENDING` |
| G-38 | Full-catalog `--mode certify` aggregate gate | KNOWN_ISSUES 024 | 024 | yes (coverage superseded) | blocked by second attached device | tooling/environment | Low | 42/42 coverage achieved by 046 registry traversal + 051 routes + 053 matrix; aggregate gate not runnable with the user's device attached | `SUPERSEDED_CLOSED` |
| G-39 | ARTEMIS provider verifier subchecks INCONCLUSIVE | campaign 029 history | 029 | historical | external provider | ARTEMIS provider | Low | Historical/external; manual trace inspection was authoritative | `EXTERNAL_BLOCKER_VERIFIED` |
| G-40 | Expo dev-server web-bundle crash | KNOWN_ISSUES 024 | 024 | yes | no (web export passes) | tooling/environment | Low | Web export PASS in current matrix; dev-server issue is environmental | `SUPERSEDED_CLOSED` |
| G-41 | Emulator app-surface wedge after long soaks | KNOWN_ISSUES 026 | 026 | yes | no (recovery known) | tooling/environment | Low | Clean-boot recovery is the documented remedy; 054 matrices ran clean on cold boot | `SUPERSEDED_CLOSED` |
| G-42 | Historical baseline black frames | KNOWN_ISSUES 026 | 026 | yes | n/a | evidence | Low | Regenerated with `regeneratedFrom` notes | `SUPERSEDED_CLOSED` |

### F. Campaign 054 observations

| ID | Gap | Source(s) | First campaign | Superseded? | Reproducible now? | Owner | Sev | Closure action | Final disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-43 | Node 24 `DEP0190` warning in a validator child-process call (CI uses Node 22) | this campaign | 054 | no | yes (tooling) | tooling | Low | Recorded as tooling observation; does not affect CI (Node 22) or the app; no source change made under this campaign's no-unrelated-cleanup rule | `ACCEPTED_TIME_BOUNDED_DEBT` (tooling, Low) |
| G-44 | `apps/mobile` docs vs `docs/PARITY_MATRIX.md` — parity records referenced but stored at `docs/DEFERRED_DECISIONS.md`/`docs/PARITY_MATRIX.md`, not `.agent/` | BACKLOG/DECISIONS pointers | 028 | no | verified present | repository | Low | Confirmed the referenced files exist at `docs/`; no `.agent/` copies required | `CLOSED_VERIFIED` |

## Totals (final)

| Disposition | Count |
| --- | ---: |
| `CLOSED_VERIFIED` | 15 |
| `SUPERSEDED_CLOSED` | 10 |
| `ACCEPTED_TIME_BOUNDED_DEBT` | 7 |
| `EXTERNAL_BLOCKER_VERIFIED` | 2 |
| `MANUAL_PLATFORM_PENDING` | 9 |
| `NOT_REPRODUCIBLE_WITH_BOUNDED_EVIDENCE` | 1 |
| `OPEN_PRODUCT_DEFECT` | 0 |
| **Total** | **44** |
