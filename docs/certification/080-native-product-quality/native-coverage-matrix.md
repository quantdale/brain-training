# Native coverage matrix — Campaign 080 (authoritative, verified)

**Ledger:** `scripts/qa/native-coverage-ledger-v8.json`
**Contract:** `coverage-contract/2.0`
**Build:** git `ba15ae58`, apk-sha256 `15fe8db35441678a74ea8a9a510058224197b86bde8564ed58bff60882c008cc`,
package `com.braintraining.app`, versionName `0.1.0`, versionCode `1000`
**Evidence status:** `verify-artifacts.mjs --mode local --strict` → **PASS, exit 0**

```
runs=42  builds=1  verdict=PASS
verified=1119  mismatch=0  missing=0  unreadable=0  wrongAttempt=0
wrongBuild=0  unbound=0  unsafePath=0  reused=0  duplicateAttempt=0
badContent=0  capabilityUnbound=0  mixedBuild=0
```

Every one of the 1119 artifacts was re-hashed from its real bytes on disk.
This is the first ledger since contract 2.0 whose evidence independently
verifies end to end (see §4 for why the intermediate ledgers do not).

---

## 1. Certified distribution

| Level | Count | Previous certified baseline |
|---|---:|---:|
| L0 | 14 | 24 |
| L1 | 8 | 8 |
| L2 | 13 | 6 |
| L3 | 7 | 4 |
| L4 | 0 | 0 |
| **Total** | **42** | **42** |

The movement is the signature of a contract that got *better at observing*, not
looser: L3 nearly doubled, L2 more than doubled, L0 nearly halved — while the
evidence gate stayed at PASS with **zero** tolerance counters.

## 2. Per-game matrix

| Game | Domain | Level | Status | Tutorial solve trail |
|---|---|---:|---|---|
| `attention-odd-one-out` | Attention | L3 | VERIFIED | no tutorial shown |
| `attention-visual-search` | Attention | L3 | VERIFIED | no tutorial shown |
| `attention-target-count` | Attention | L1 | VERIFIED | no tutorial shown |
| `attention-sustained-vigilance` | Attention | L1 | VERIFIED | no tutorial shown |
| `attention-symbol-tracker` | Attention | L0 | PARTIAL | 3 REVEAL + 3 NAV |
| `flexibility-card-sort` | Flexibility | L2 | VERIFIED | no tutorial shown |
| `flexibility-color-stroop` | Flexibility | L2 | VERIFIED | no tutorial shown |
| `flexibility-cue-shift` | Flexibility | L2 | VERIFIED | no tutorial shown |
| `flexibility-rule-flip` | Flexibility | L2 | VERIFIED | no tutorial shown |
| `flexibility-task-switch` | Flexibility | L2 | VERIFIED | no tutorial shown |
| `language-sentence-builder` | Language | L2 | VERIFIED | no tutorial shown |
| `language-word-chain` | Language | L2 | VERIFIED | no tutorial shown |
| `language-context-fit` | Language | L0 | PARTIAL | 2 REVEAL + 1 NAV, then `NO_LEGITIMATE_STEP` |
| `language-word-match` | Language | L0 | PARTIAL | 2 REVEAL + 1 NAV, then `NO_LEGITIMATE_STEP` |
| `language-word-scramble` | Language | L0 | PARTIAL | 4 REVEAL + 1 NAV, then `NO_LEGITIMATE_STEP` |
| `logic-order-path` | Logic | L2 | VERIFIED | no tutorial shown |
| `logic-code-cracker` | Logic | L1 | VERIFIED | no tutorial shown |
| `logic-next-sequence` | Logic | L1 | VERIFIED | no tutorial shown |
| `logic-rule-grid` | Logic | L1 | VERIFIED | no tutorial shown |
| `logic-deduction-table` | Logic | L0 | PARTIAL | 2 REVEAL + 1 NAV |
| `math-fast-math` | Math | L3 | VERIFIED | no tutorial shown |
| `math-number-line-estimation` | Math | L3 | VERIFIED | no tutorial shown |
| `math-missing-operator` | Math | L2 | VERIFIED | no tutorial shown |
| `math-equation-builder` | Math | L0 | PARTIAL | 23 REVEAL + 1 NAV |
| `math-value-ordering` | Math | L0 | PARTIAL | no tutorial shown |
| `memory-pair-recall` | Memory | L2 | VERIFIED | no tutorial shown |
| `memory-running-order` | Memory | L1 | VERIFIED | no tutorial shown |
| `memory-prospective-cue` | Memory | L1 | VERIFIED | no tutorial shown |
| `memory` | Memory | L0 | PARTIAL | 9 REVEAL + 1 NAV, `NO_LEGITIMATE_STEP` |
| `memory-grid-recall` | Memory | L0 | PARTIAL | 11 REVEAL + 1 NAV, `NO_LEGITIMATE_STEP` |
| `memory-pattern-tap-back` | Memory | L0 | PARTIAL | 9 REVEAL + 1 NAV, `NO_LEGITIMATE_STEP` |
| `memory-sequence-memory` | Memory | L0 | PARTIAL | 4 REVEAL + 1 NAV, `NO_LEGITIMATE_STEP` |
| `spatial-fold-match` | Spatial | L3 | VERIFIED | no tutorial shown |
| `spatial-transform-match` | Spatial | L3 | VERIFIED | no tutorial shown |
| `spatial-coordinate-turn` | Spatial | L2 | VERIFIED | no tutorial shown |
| `spatial-mental-rotation` | Spatial | L0 | PARTIAL | 1 DERIVED + 1 REVEAL + 1 NAV |
| `spatial-grid-nav` | Spatial | L0 | PARTIAL | no tutorial shown |
| `speed-quick-compare` | Speed | L3 | VERIFIED | no tutorial shown |
| `speed-color-match` | Speed | L2 | VERIFIED | no tutorial shown |
| `speed-reaction-time` | Speed | L2 | VERIFIED | no tutorial shown |
| `speed-order-sweep` | Speed | L1 | VERIFIED | no tutorial shown |
| `speed-tap-rush` | Speed | L0 | PARTIAL | 1 DERIVED + 1 NAV, `NO_LEGITIMATE_STEP` |

## 3. Domain distribution

| Domain | Games | L3 | L2 | L1 | L0 |
|---|---:|---:|---:|---:|---:|
| Attention | 5 | 2 | 0 | 2 | 1 |
| Flexibility | 5 | 0 | 5 | 0 | 0 |
| Language | 5 | 0 | 2 | 0 | 3 |
| Logic | 5 | 0 | 1 | 3 | 1 |
| Math | 5 | 3 | 1 | 0 | 1 |
| Memory | 6 | 0 | 1 | 2 | 3 |
| Spatial | 5 | 3 | 1 | 0 | 1 |
| Speed | 6 | 1 | 3 | 1 | 1 |
| **Total** | **42** | **7** | **13** | **8** | **14** |

All eight cognitive domains have distinct native evidence, and seven of the
eight now contain at least one L2-and-above certification.

## 4. Evidence-integrity note — superseded ledgers

`native-coverage-ledger-v2/v4/v5/v6.json` are **retained as historical records
but FAIL independent verification** and their numbers are **not** cited as
certification.

Cause: the sweep's artifact root was a fixed path, so each new sweep overwrote
the previous sweep's screenshots and hierarchies while the older ledgers still
recorded the original digests. Measured across those four ledgers, **482 of 1100
artifact paths were claimed with more than one different sha256**.

This is exactly the failure class the certification engine exists to refuse
("a screenshot must not be accepted merely because its filename resembles the
expected artifact"), and the verifier caught it. No digest was regenerated and
no ledger was rewritten to look green — the correct response to unverifiable
evidence is to re-establish it, which v8 does under per-run artifact isolation.

## 5. How to reproduce

```bash
node scripts/qa/verify-artifacts.mjs scripts/qa/native-coverage-ledger-v8.json --mode local --strict
node scripts/qa/merge-coverage.mjs --strict
node --test scripts/qa/*.test.mjs
```

---

## 6. Post-v8 harness improvements and their effect (measured)

Three further harness defects were found by reading the app's own tutorial
contracts rather than by trial and error. Each is fixed, tested, and its effect
measured on the affected games.

### 6.1 "Clear and retry" does NOT re-reveal — fixed, measured

The memory/attention demos are two-phase: targets are briefly revealed, then
hidden. Probing a cell makes the app render its own verdict
(`Correct: Cell 4` / `Wrong pick: Cell 2`), so the solver can *learn* the target
set. The decisive contract detail is that **retry clears the selections but does
not re-reveal the targets**. The previous solver retried as soon as a retry
control merely existed, discarding what it had learned and restarting the guess
loop forever.

Correct order is `probe → learn → clear wrong picks → select the learned cells`,
with `knownCorrect` explicitly carried **across** the reset.

Measured effect: `memory-grid-recall` **L0 → L1 VERIFIED** (tutorial fully
cleared: 12 steps → `tutorial-demo-done` → `tutorial-done`).

### 6.2 Retry spelling and repeatable stimulus — fixed

- `tutorial-retry` (language family) and `tutorial-demo-retry` (grid family) are
  both recognised.
- A demo stating a remaining count (`Tap the target (3 left)`) marks its stimulus
  **repeatable**; without a count the control stays one-shot, so this cannot
  degrade into blind re-tapping.

### 6.3 Remaining L0 stand a DIFFERENT, honestly-stated blocker

The residual stalls are **stimulus-observation-rate limits, not app defects and
not solver defects**:

- `memory`, `memory-pattern-tap-back`, `memory-sequence-memory` and
  `memory-running-order` reveal a sequence **one tile at a time** with a short
  flash, then require it be replayed **in order**. A ~900 ms polling loop cannot
  sample every flash, so the harness never learns the sequence it must replay.
  The app correctly refuses a wrong tap and ends the attempt.
- `attention-symbol-tracker`, `language-*`, `logic-deduction-table`,
  `math-equation-builder`, `spatial-*` and `speed-tap-rush` each report an
  explicit `NO_LEGITIMATE_STEP` where the demo's next requirement was not
  observable through the current polling contract.

Recording these as automation gaps is the honest disposition. They were
deliberately **not** converted into "passed" by tapping arbitrary controls, which
would fabricate interactions the user never performed. Closing them requires a
faster observation channel (e.g. continuous screencap or accessibility-event
streaming) rather than a change to certification rules.

## 7. What is NOT claimed

- No L4 certification exists (requires verified resilience subcapabilities).
- Physical-device, ARM64 and iOS runtime coverage are unavailable here.
- `REVEAL_GUIDED` tutorial clears are legitimate interactions but weaker
  evidence than `DERIVED`; they are labelled per step and never presented as
  knowledge-derived play.
- Tutorial completion does not by itself certify subsequent gameplay; levels are
  derived from the full axis set.
