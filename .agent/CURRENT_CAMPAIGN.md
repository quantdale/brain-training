# Campaign 027 — Deep Hardening

**Status:** VALIDATED / TERMINAL
**Campaign id:** `027-deep-hardening`
**Predecessor:** `026-visual-identity-rebuild` (VALIDATED)
**Mode:** day
**Start SHA:** `832971c` (activation docs on `63e6326`)
**Closure SHA:** `212469d`
**Change:** `027-deep-hardening` (VALIDATED)

## Terminal outcome

The owner-invoked deep hardening campaign executed all six workstreams from
the 2026-09-13 forensic audit:

- **W1 correctness** — vigilance stimulus lifetime, color-stroop dead actions,
  speed-color-match null-safe metric, spatial-coordinate-turn adaptive
  escalation (generator 1.2.0), word-scramble dead budget (generator 1.2.0),
  plus a sibling scan that removed one further dead action.
- **W3 reliability** — the missing `math-value-ordering` screen test, a
  persistence-failure contract, and route failure coverage that surfaced and
  fixed five silent failure handlers (rewards claim/claim-all, generic streak
  purchases, the spurious "No item to apply", and the swallowed workout
  advance).
- **W2 performance/startup** — bounded quest evaluation with exact lifetime
  aggregates, Profile snapshot reuse, version-gated definition seeding,
  dev-only bootstrap perf marks; export canonicalization deferred with a
  recorded rationale.
- **W4 tooling/CI** — workflow-validator rules with 44/44 self-tests, a
  fail-closed production dependency-audit gate (26/26 self-tests) that
  escalated one real runtime advisory with no compatible fix as expiring,
  tracked debt, and 16 pinned action SHAs.
- **W5 documentation truth** and **W6 cleanup** — ADRs, status docs and
  KNOWN_ISSUES corrected; ten dead exports, two unreferenced scripts and the
  inert allowlist removed.

Final matrix: **540 suites / 6450 tests PASS**, `tsc`/lint clean, all
validators green, canaries **8/8** and the daily-workout journey **PASS** at
the closure tree. Full evidence: `.agent/VALIDATION.md` (Campaign 027).

## Archive notes

- The execution prompt (`.agent/EXECUTION_PROMPT.md`) is archived VALIDATED.
- No successor campaign is active; a new campaign requires explicit owner
  authorization and genuinely new scope.
