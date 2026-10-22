# Coverage snapshots — Campaign 080

Three deliberately separate snapshots. Historical counts are **not** rewritten;
each snapshot states the contract that produced it and what that contract was
able to prove.

---

## Snapshot 1 — Original v1 claims (historical, unsubstantiated)

Produced by the pre-correction sweep. Retained verbatim in
`scripts/qa/historical/080/original-native-coverage-ledger.json` and
`original-sweep-pass2.json`.

| Level | Claimed |
|---|---|
| L1 | 14 |
| L2 | 37 |
| L3 | 1 |
| **Total runs** | **52** (pass 1: 42 games; pass 2: 10 runs) |

**Status: unsubstantiated and superseded.** All 52 runs fail provenance
validation (no git SHA / APK hash / versionCode / device serial, no
action→observation binding). Per-run downgrade explanations are in
`coverage-reclassification.md`. These numbers are historical record only and
must never be cited as coverage.

---

## Snapshot 2 — Contract 2.0 checkpoint (provisional)

Produced 2026-10-21 under contract 2.0, before the independent review's P1/P2
findings were repaired.

| Level | Games |
|---|---|
| L0 | 24 |
| L1 | 4 |
| L2 | 9 |
| L3 | 5 |
| L4 | 0 |
| **Total** | **42** |

**Status: provisional — carries the independent review's findings.** Two
certifications in this snapshot were later shown to rest on defective
attribution and are reclassified below:

- `language-word-chain` (L2) rested on a tap whose observed change was an
  unrelated **round timeout** (P1-A).
- `attention-odd-one-out` (L3) was described as "answer-driven rounds" but its
  ledger shows a timed-out round, zero answer taps and score 0 (P1-D).

Artifact binding in this snapshot was overstated: `requireArtifact` was never
set by the sweep and pivotal observations carried `evidenceArtifact: null`.

---

## Snapshot 3 — Hardened current contract (newly validated)

Produced 2026-10-22 under contract 2.0 with all four P1 findings repaired
(causal attribution, safe-exit destination proof, real artifact integrity) and
the Wave B contract fixes applied.

| Level | Games |
|---|---|
| L0 | 24 |
| L1 | 8 |
| L2 | 6 |
| L3 | 4 |
| L4 | 0 |
| **Total** | **42** |

**Evidence quality (independently measured, not asserted):**

- `verify-artifacts.mjs --mode local` → **PASS**: **1128** artifacts
  independently re-hashed from real bytes, **0** mismatches, **0** missing,
  **0** unbound, **0** wrong-attempt, **0** mixed builds.
- `merge-coverage.mjs --strict` → exit **0**, **0** diagnostics, all **42**
  runs contract-valid.
- Every run binds git SHA, package, versionName/versionCode, installed-APK
  SHA-256, device profile and per-observation artifact SHA-256 + attempt id.

**How to read the movement from Snapshot 2:**

| | S2 | S3 | Why |
|---|---|---|---|
| L3 | 5 | 4 | One L3 was a timed-out round with no answer input. Its terminal state survives only where the corrected contract still proves it; the false "answer-driven" label is retracted. |
| L2 | 9 | 6 | L2 now requires a **causally attributed** input (target-control identity, score transition, or explicit answer acknowledgment). Coincidental timeouts no longer qualify. |
| L1 | 4 | 8 | Safe exit is now actually **provable**. In S2 the destination classifier compared a `package/activity` component against a bare package name, so real app exits were invisible; that harness defect (not an app defect) is fixed. |
| L0 | 24 | 24 | Dominated by guided tutorial demonstrations that the harness cannot yet solve, now classified precisely (see below). |

The counts moved in **both** directions, which is the expected signature of an
evidence system that got stricter about what it credits and better at observing
what it previously missed. No count was moved to look better.

### Remaining gaps (24 at L0) — classified

- **Guided, answer-driven tutorial demonstrations** — the dominant blocker
  class. A generic blind-tap driver cannot clear a demo that validates a
  specific answer. Now precisely reported as
  `tutorial shown this attempt but never cleared — L2/L3 blocked`, which is the
  Wave B tutorial semantics working as intended rather than a silent L1.
- **Safe exit not proven on some surfaces** — reported explicitly per run.
- Two edge-case games reach gameplay but do not capture a complete
  entry/exit transition set.

**Next lever:** the Wave D guided-tutorial solver system (per-family
deterministic answer resolvers). This is automation capability, not a
relaxation of the certification standard.

---

## Full-session (L3) completion methods — Snapshot 3

Completion method is reported as observed. Passive/timeout completion is a
legitimate terminal state and may certify L3, but is never described as
answer-driven.

| Game | Completion method |
|---|---|
| `attention-odd-one-out` | passive timed completion (round expiry, no answer input) |
| `attention-visual-search` | answer-driven rounds → results |
| `spatial-transform-match` | answer-driven rounds → results |
| `speed-quick-compare` | timed answer-driven rounds → results |

### L2 (6) — causally attributed gameplay interaction

`flexibility-task-switch`, `language-word-chain`, `logic-order-path`,
`memory-pair-recall`, `spatial-coordinate-turn`, `speed-reaction-time`.

Note `language-word-chain` is present in this snapshot on **genuine** accepted
input: the coincidental-timeout attribution that produced its earlier L2 is
excluded by the causality contract, and the level below is earned by an
attributable input instead.

### L1 (8) — verified native smoke with proven safe exit

`attention-sustained-vigilance`, `attention-target-count`,
`flexibility-color-stroop`, `logic-next-sequence`, `logic-rule-grid`,
`math-number-line-estimation`, `memory-prospective-cue`, `speed-color-match`.
