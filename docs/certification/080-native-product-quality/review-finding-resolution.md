# Review finding resolution register — Campaign 080

**Superseding checkpoint — 2026-10-24:** Independent executable re-review
**ACCEPTS the seven round-3 engine repairs at481bf8aa**,171/171 checks and prior
probes executed; no new scoped P1/P2. Full bounded decision:
[`independent-round3-closeout.md`](./independent-round3-closeout.md).
B5's app-side vocabulary split has also landed in the shipping source. The
register below preserves earlier intake/implementation snapshots, including
then-pending statuses; it does not supersede the dated re-review. Fresh native
catalog evidence, the later focus correction and final-SHA release convergence
remain pending, not accepted by that engine-only verdict.

**Purpose.** The independent adversarial review's findings are preserved
verbatim in [`independent-review.md`](./independent-review.md). This register is
the **separate** record of what was implemented, what was tested, and what is
still open. The original findings are deliberately **not** rewritten as though
they had never existed.

**Reviewer verdict at intake:** ACCEPT WITH FINDINGS — 4 × P1, 6 × P2.
**Register status at initial intake:** implementation complete for all P1s
and all actionable P2s; second independent review then pending (see §3).

---

## 1. P1 findings

### P1-1 — Causal attribution of inputs and feedback

**Finding (preserved).** Autonomous transitions inside a tap window were
credited as accepted input. Confirmed case `language-word-chain`: a tap on
`chain-word.2` was marked accepted while the recorded state change was a round
timeout. A fingerprint difference alone was treated as proof of input causality.

**Implementation.** `scripts/qa/coverage-contract.mjs` now exposes
`classifyInputCausality()`, which returns exactly one of
`INPUT_ACCEPTED`, `AUTONOMOUS_TIMEOUT`, `AUTONOMOUS_PROGRESSION`,
`AMBIGUOUS_CAUSALITY`, `NO_RESPONSE`. Certification of acceptance requires an
**attributable** signal — target-control identity change, a score transition, or
an explicit answer acknowledgment — and no competing autonomous marker in the
same window. A fresh timeout marker in the window makes the verdict
`AUTONOMOUS_TIMEOUT` (or `AMBIGUOUS` if a response signal co-occurs), never
`INPUT_ACCEPTED`. The full per-event causal ledger is published on the
`inputCausality` axis so an auditor can see every rejection and its reason.

Timeouts are **not** globally rejected: they qualify through
`autonomousGameplayEvent`, the appropriate capability for passive/timed games,
rather than being fabricated as tap acceptance.

**Tests.** `coverage-contract.adversarial.test.mjs` A1–A5, plus
`coverage-contract.test.mjs`. Mandatory shapes covered: tap followed by
unrelated timeout; tap with no application response; correct tap producing
answer feedback; incorrect tap producing answer feedback; tap immediately before
timeout; tap after timeout; passive gameplay with no input; action and
autonomous transition in the same observation window. The recorded Word Chain
failure is a pinned regression fixture. `MUTATION 1` and `MUTATION 5` prove the
protections have teeth.

**Status:** IMPLEMENTED + TESTED. Independent verification pending.

---

### P1-2 — False safe-exit certification

**Finding (preserved).** A failed hierarchy dump produced no parsed game
controls, which the harness emitted as `non-game-app-screen`; the contract mapped
that to `EXITED` and certified `safeExit`. Android input execution was marked
successful despite a tolerant command path that suppressed failures.

**Implementation.** `deriveScreenKind()` classifies the device from proven facts
— hierarchy status (`ok` / `empty` / `malformed` / `adb-failure`), parsed game
control count, foreground window identity, and process liveness — into
`game-screen`, `app-destination`, `launcher`, `system-dialog`,
`permission-dialog`, `crash`, `hierarchy-failure`, `adb-failure`, `unknown`.
Only `app-destination` is a navigation destination by default; the explicit
`exitContract.acceptableDestinations` field can widen it deliberately.
`safeExit` now requires **all** of: `actionExecuted === true`, a valid
before-state, a valid after-state, a confirmed destination under the exit
contract, and no crash / dialog / transient tooling failure. The harness reports
`actionExecuted` truthfully (it previously emitted `true` unconditionally while
running `adb` with `tolerant: true`).

**Tests.** `coverage-contract.adversarial.test.mjs` B1–B11. Mandatory shapes
covered: Back command fails; ADB command returns nonzero; dump returns empty
content; dump returns malformed XML; system dialog obscures the application;
process crashes to launcher; Back only opens Pause; Quit reaches the expected
app destination; delayed navigation eventually succeeds; screenshot and
hierarchy disagree. `B2` reproduces the exact historical
`non-game-app-screen` mechanism and asserts it is rejected. `MUTATION 2` proves
the protection has teeth.

**Status:** IMPLEMENTED + TESTED. Independent verification pending.

---

### P1-3 — Artifact verification was not real

**Finding (preserved).** `requireArtifact` was never set by the real sweep,
`expectedSha1` was never supplied, so artifact verification could pass despite
missing critical proof. Documentation claimed stronger binding than the code
provided.

**Implementation.** `requireArtifact` is now genuinely set from
`ArtifactPolicy` on certification-critical observations. Artifacts carry
`file` + `sha256` + `bytes` + `kind` + `executionAttemptId`. The dead
`expectedSha1 !== sha1` comparison is removed. New
`scripts/qa/verify-artifacts.mjs` independently reads each artifact from disk
and recomputes its digest from the actual bytes. Missing mandatory artifact,
unreadable artifact, hash mismatch, wrong-attempt artifact, wrong build identity
and missing observation provenance are each handled explicitly. Three evidence
modes are distinct and implemented:

| Mode | Meaning |
|---|---|
| `local` | Local runtime certification — artifacts must exist and re-hash correctly. |
| `portable` | Portable evidence verification — gitignored native artifacts may be absent in a fresh checkout; absence is reported as NOT VERIFIABLE, never a silent pass and never a false fail. |
| `source` | Source-level fixture testing — artifact presence advisory, structure and binding still validated. |

**New finding from the verifier (not in the original review).** Run against the
existing ledger, `verify-artifacts.mjs` independently confirmed P1-3 and found
more: **908** artifacts verify against real bytes (legacy SHA-1, explicitly
graded lower), **10** recorded hashes do **not** match the files on disk — all
in the `math-fast-math` run, with identical computed digests recurring across
distinct recorded digests, consistent with overwritten/reused artifact files —
and **76** observations carry no artifact binding at all, including pivotal
`exit` safe-exit proofs. The previous contract could not detect any of this.

**Tests.** `coverage-contract.adversarial.test.mjs` C1–C4, `N15` in
`coverage-contract.test.mjs`. `MUTATION 3` proves self-asserted hashes do not
verify.

**Status:** IMPLEMENTED + TESTED. Historical artifacts are preserved and
re-labelled, never rewritten. Independent verification pending.

---

### P1-4 — Overstated certification narratives

**Finding (preserved).** Three documentation claims exceeded the evidence:
`attention-odd-one-out` L3 described as answer-driven; `language-word-chain`
input described as accepted; `speed-color-match` demo clearing claimed but not
evidenced; plus a general claim that every proof had an independently verified
artifact.

**Implementation.** Corrected in place, with the correction recorded next to the
retracted claim:

- `full-session-validation.md` — `attention-odd-one-out` reclassified to
  **passive timed completion** (round expired before any answer input, zero
  answer taps, score 0). The narrower L3 terminal-state result is preserved.
- `full-session-validation.md` — the `speed-color-match` "cleared the demo and
  reached L2" claim is retracted as unevidenced (the certified run has no
  tutorial phase at all).
- `native-qa-correction.md` — "Every proof is bound to … artifact hashes"
  retracted and replaced with the accurate description of the repaired binding.
- `coverage-audit.md` — run-count contradiction fixed (`0 / 42` → `0 / 52`).
- `merge-coverage.mjs` — schemaVersion check now precedes the `runs[]` shape
  check so the mandated `reclassify-historical.mjs` guidance is reachable
  (docs-vs-code inconsistency #6).

**Status:** IMPLEMENTED. Documentation claims are now consistent with code and
evidence.

---

## 2. P2 findings

| # | Finding (preserved) | Disposition |
|---|---|---|
| B1 | `knownGameId` is caller-controlled; no registry check | **IMPLEMENTED.** `validateRunRecord(record, {knownGames})` validates against the authoritative generated game registry; `merge-coverage.mjs` loads `apps/mobile/src/games/*/game.json` and emits an explicit `registry-unavailable` diagnostic rather than silently trusting the caller if it cannot resolve. `MUTATION 4` proves enforcement. |
| B2 | Matrix axes union certified capability with invalid historical runs | **IMPLEMENTED.** `merge-coverage.mjs` now builds `capabilityUnion` from **contract-valid runs only**; invalid runs are surfaced separately as `historicalObservations` with `certifying: false`, and a conflict is recorded whenever an invalid run claims a capability the certified column excludes. |
| B3 | Results currency is order-based, not content-bound | **IMPLEMENTED.** Results must follow this session's last playing observation with a clean gap (no intro/tutorial/exit/unknown), match the expected game identity, and not contradict the session's score on a `higher-is-better` scale. Lower-is-better scales (e.g. reaction time in ms) are explicitly exempt to avoid false negatives. The `firstState()` limitation is fixed: the **last** attributable results surface is used, so a stale early results screen no longer permanently fails the axis. |
| B4 | Malformed input can crash the merger; duplicate attempts undetected | **IMPLEMENTED.** Array/object schema guards throughout, structured `corrupt-run-entry` diagnostics (a type-corrupt JSON object yields a deterministic actionable result, not an uncontrolled exception), `duplicate-execution-attempt-id` detection across all inputs, no silent omission of failed runs, and `--strict` exit semantics documented. |
| B5 | `trial-wrong` vocabulary conflates wrong-pick with timeout/missed | **PARTIAL — see §3.** The contract now classifies `trial-wrong` as **ambiguous** feedback that cannot by itself certify input acceptance (`AMBIGUOUS_FEEDBACK_RE`), which closes the certification hazard. The app-side vocabulary split (`speed-color-match` emits distinct testIDs for wrong selection vs missed stimulus) requires an application source change and is tracked as remaining work. |
| B6 | Tutorial-completion requirement is inconsistent between docs and code | **IMPLEMENTED.** `TutorialStatus` / `deriveTutorialStatus()` establish one authoritative rule: `NOT_REQUIRED`, `COMPLETED_THIS_ATTEMPT`, `PREVIOUSLY_COMPLETED`, `REQUIRED_NOT_CLEARED`, `UNKNOWN`. A tutorial shown and never cleared blocks L2/L3; a returning player with persisted tutorial completion is never forced to repeat a tutorial for QA. `W-B3` covers all five states. |

---

## 3. Still open / next actions

1. **Second independent adversarial review** — required to convert
   IMPLEMENTED + TESTED into independently verified. The reviewer must attempt
   to reproduce each of the ten original findings against the new code and fresh
   evidence, and classify each FIX VERIFIED / FIX INCOMPLETE / NOT PROBED /
   NEW FINDING.
2. **B5 app-side vocabulary** — `speed-color-match` (and any similar timed game)
   should emit distinct testIDs for wrong selection vs missed stimulus vs
   timeout. Requires an application source change plus regression tests covering
   both source logic and native-event interpretation. The certification hazard
   is already closed contract-side.
3. **Historical artifact defects** — the 10 hash mismatches and 76 unbound
   observations found by `verify-artifacts.mjs` affect the **historical** record.
   Fresh sweeps under the repaired harness produce SHA-256-bound evidence; the
   historical record is preserved and re-labelled, not rewritten.
4. **Fresh 42-game sweep under the hardened contract** — in progress; results
   form the third coverage snapshot.

---

# ROUND 2 register (2026-10-23) — dispositions for the second review

Source of truth for findings: `qa-artifacts/080/review/codex-review-final.md`
(immutable). Repair evidence: `qa-artifacts/080/contract-repair-p1-report.md`.

| Finding | Round-2 verdict | Disposition now |
|---|---|---|
| P1-1 input/feedback causal attribution | FIX_INCOMPLETE | **REPAIRED** — execution-gated causality + regression pin (re-review pending) |
| P1-2 false safe-exit / failed command | FIX_VERIFIED | Closed |
| P1-3 artifact binding / certification attestation | FIX_INCOMPLETE | **REPAIRED** — per-run artifact attestation in merge-coverage + pins (re-review pending) |
| P1-4 overstated narratives | FIX_VERIFIED | Closed |
| P2-B1 unknown game IDs | FIX_VERIFIED | Closed |
| P2-B2 invalid historical runs leaking into axes | FIX_VERIFIED | Closed |
| P2-B3 results currency / stale results | FIX_INCOMPLETE | OPEN — packet 2 |
| P2-B4 malformed ledgers / duplicate attempts | FIX_INCOMPLETE | OPEN — packet 2 |
| P2-B5 timed stimulus vocabulary | FIX_VERIFIED | Closed |
| P2-B6 tutorial completion semantics | FIX_INCOMPLETE | OPEN — packet 2 |
| F-080-NEW-001 fail-open artifact exit | FIX_VERIFIED | Closed |
| F-080-NEW-002 mixed-build single-scope pass | FIX_VERIFIED | Closed |
| NF-080-001 failed commands certify milestones | NEW | **REPAIRED** with P1-1 |
| NF-080-002 safe-exit self-asserted screen kind / stale hierarchy | NEW | OPEN — packet 2 (incl. dumpHierarchy stale-XML deletion) |
| NF-080-003 empty/malformed/unknown runs pass artifact certification | NEW | OPEN — packet 2 |
| NF-080-004 content sniffing accepts truncated hierarchy / fake PNG | NEW | OPEN — packet 2 |
| NF-080-005 cross-attempt copied evidence informational only | NEW | OPEN — packet 2 |
| NF-080-006 self-asserted build identity / quarantine unenforced | NEW | PARTIAL — quarantine enforcement policy specified for packet 2 |
| NF-080-007 tutorial-like gameplay certifies L2 | NEW | OPEN — packet 2 |
| NF-080-008 duplicate event sequence numbers accepted | NEW | OPEN — packet 2 |

No finding is closed by relabelling. "REPAIRED" means implemented with tests;
"Closed" means the independent reviewer verified the fix by execution.
