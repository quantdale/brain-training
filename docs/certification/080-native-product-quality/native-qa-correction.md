# Native QA correction report — Campaign 080

Date: 2026-10-21
Contract: `coverage-contract/2.0` (`scripts/qa/coverage-contract.mjs`)
Status: **REPAIRED** — all five independent-review findings (F-080-001..005)
addressed in code, proven by adversarial regression tests, and demonstrated on
historical and fresh evidence.

---

## Summary

The Campaign 080 native QA harness claimed gameplay coverage it had not
proven. Its classifier awarded Level 2 for *attempted* taps and Start presses,
recorded safe exit without observing any destination, and its merger could
fabricate a session that never happened. This is an engineering-certification
defect: the evidence system, not the application, was the primary failure.

The repair separates three things the v1 harness conflated:

1. **Actions** — what the harness requested/executed (`actionRequested`,
   `actionExecuted`).
2. **States** — what the application was observably doing before and after
   (`stateBefore`, `stateAfter`, control inventories, score, board values).
3. **Capabilities** — what one coherent execution attempt actually proved
   (derived, never asserted).

Classification is now **derived only from proven capabilities**. Every proof is
bound to before/after hierarchy observations, a single execution-attempt id, the
git SHA, the installed APK sha256, and the device profile.

> **Correction (independent review, P1-D).** This paragraph previously claimed
> "Every proof is bound to … artifact hashes". That overstated both the code and
> the evidence at the time: `requireArtifact` was never set by the real sweep,
> `expectedSha1` was never written, and pivotal observations (e.g.
> `attention-odd-one-out` obs8/obs9, the playing→results sessionEnd proof)
> carried `evidenceArtifact: null` while still certifying L3.
>
> Repaired in contract 2.0: certification-critical observations now carry a
> REAL artifact binding (file + SHA-256 + execution-attempt id),
> `verifyArtifactBytes()` recomputes the digest from independently read bytes,
> and three evidence modes are explicitly distinct — **local runtime
> certification** (artifacts present and re-hashed), **portable evidence
> verification** (gitignored native artifacts may be absent in a fresh checkout;
> absence is reported, never silently passed), and **source-level fixture
> testing**. Historical records are preserved unchanged; they are re-labelled,
> not rewritten.

---

## Finding F-080-001 — Level 2 false-positive classification

**v1 code (defective):**

```js
if (m.inputSubmitted || m.feedbackObserved || m.roundAdvanced || m.started) return 2;
```

An attempted tap or Start press produced L2. Games could be "interactive" while
still displaying their tutorial. Confirmed examples in the historical ledger:
`language-word-chain` (tutorial never cleared across all 17 recorded phases,
Start never pressed, no feedback, no round advance — yet L2 PASS),
`logic-deduction-table`, `spatial-mental-rotation`, `memory-pair-recall`
(Start recorded only — L2).

**Fix.** L2 is now derived from capabilities that cannot be asserted, only
observed:

- `gameplayEntered` — an evidence event whose **before** observation is
  intro/tutorial and whose **after** observation is positively identified
  active gameplay (`stage` + `pause`, no intro).
- `inputAccepted` — a gameplay input event **acknowledged by an observed
  gameplay-state change** (fingerprint delta: round/score/feedback/board). A
  successful `adb input tap` process is never acceptance.
- `autonomousGameplayEvent` — input-independent progression (passive/timed
  games), observed across two playing-state observations with no input between.
- `feedbackObserved` — feedback markers that **appear newly after** an
  in-playing input (pre-existing markers do not count).
- `roundAdvanced` — an observed round-counter increase.

A Start press alone yields at most verified smoke (L1). A tutorial-side tap
yields nothing.

**Proof.** `coverage-contract.test.mjs` N3, N4, N5, N6, N7, N8, R1, R2
(28/28 green). Historical replay: `language-word-chain` v1 claim L2 →
L0-depth (tutorial-only, see `coverage-reclassification.md`).

---

## Finding F-080-002 — Level 1 safe-exit verification not authoritative

**v1 code (defective):**

```js
pressBack(serial);
milestones.safeExit = true;   // unconditional
```

**Fix.** `safeExit` is VERIFIED only when the **post-action observation** shows
the game screen was left and a destination was observed (app screen markers or
device launcher). The exit ladder mirrors real app navigation discovered on
device: Back from gameplay opens the pause overlay; verified exit drives
Back → `pause-overlay` → `gameId.quit` → destination observation. From the
intro: `gameId.intro-back`. A stuck tutorial is skipped first. If no
destination is observed, `safeExit` is **FAILED** and no complete L1 is issued.

**Proof.** Tests N9 (Back without exit → no L1) and R1. Fresh runs mark
`smoke INCOMPLETE` rather than L1 when exit is unproven.

---

## Finding F-080-003 — Merger does not perform logical OR

**v1 code (defective):**

```js
prev.milestones = { ...g.milestones, ...prev.milestones };  // object precedence
```

This silently discarded observations and let two separate runs form one
fictitious lifecycle (Start from run A + Results from run B).

**Fix.** `merge-coverage.mjs` rewritten with provenance-aware semantics:

- every execution attempt keeps its own record (run id, build identity, device
  profile, events, observations, artifact hashes, failures);
- **certified level comes from a single sufficiently proven run** — cross-run
  blending is structurally impossible;
- a **capability union** across runs is reported separately, labelled
  union-of-observations, with per-run provenance; when a union "looks complete"
  but no single run proves it, a `cross-run-union-not-a-journey` diagnostic is
  emitted and the level stays down;
- genuine boolean unions use `or3` (true > false > unknown) — reference values
  are published in the output;
- conflicts are preserved with the authoritative observation rule; failed
  attempts are never discarded.

**Proof.** `merge-coverage.test.mjs` (independent adversarial suite,
12 mandatory semantic tests).

---

## Finding F-080-004 — Weak state-transition proof

**v1:** `started`, `inputSubmitted`, `feedbackObserved`, `safeExit` were all
recorded from action issuance.

**Fix.** Structured evidence events per prompt §3.1 (`actionRequested`,
`actionExecuted`, `actionAcknowledged`, `stateBefore`, `stateAfter`,
`transitionObserved`, `transitionValid`, `observationTimestamp`,
`evidenceArtifact`, `executionAttemptId`). An action is **acknowledged only
when the observed application state changed**; the contract rejects any
acknowledged action that is not bound to ordered before/after observations, and
rejects a claimed `state` that contradicts the raw control inventory
(anti-spoofing). Game states are derived from stable semantic ids
(`gameId.intro/start/stage/pause/round.N/results`) via `observeState`.

**Proof.** Tests N4, N6, N8, N13, N17 (validation rejects unbound/misbound
events), plus the anti-spoofing consistency check in `validateRunRecord`.

**In-repair contract bug found by the adversarial suite:** the first draft of
`stateFingerprint()` returned an object; comparing fingerprints with `!==`
compared *references* and therefore always reported "changed" — re-creating the
exact false-positive class this campaign exists to remove. The suite caught it
(N5, N6 red). Fixed by returning a canonical string fingerprint. This is
recorded because it proves the adversarial suite has teeth.

---

## Finding F-080-005 — Incomplete provenance of native evidence

**v1 ledger:** free-text build label only; no commit/APK/package-version/device
serial binding; artifacts not tied to attempts.

**Fix.** Every run record binds `buildIdentity` (git SHA, package,
versionName, versionCode, **installed-APK sha256 computed on device**),
`deviceProfile` (serial, model, abi, display, density, renderer), unique
`executionAttemptId`, and per-observation artifact hashes. The sweep **refuses
to run** when git SHA, APK hash or versionCode cannot be established. Historical
evidence that lacks these fields fails `validateRunRecord` and cannot certify —
it is retained as historical observation with `provenanceStatus: INCOMPLETE`,
never reassigned to a later build.

**Proof.** Tests N12 (wrong-game evidence), N14 (mixed-APK evidence), N15
(hash mismatch), N16 (partial ledger), N17 (missing device metadata), and the
reclassification output (all 52 historical runs fail provenance validation).

---

## Adjudications made during repair (independence record)

The adversarial suite was written by an independent agent against the frozen
contract. Five initial failures were adjudicated on the merits:

| Case | Verdict | Action |
|---|---|---|
| N5, N6 | **contract bug** (reference comparison always true) | fixed contract (string fingerprint) |
| R1, R2 | **fixture bug** (events carried the wrong `executionAttemptId`) | fixed fixture; contract's cross-attempt rejection retained (it is negative case N13 by design) |
| N18 vs N10 | **semantic gap** | contract refined: `sessionEnded` is ATTEMPTED when a results surface was reached with an unproven transition **or** the run was interrupted mid-gameplay; NOT EXECUTED when the run deliberately exited without ending the session |

Final state: `node --test scripts/qa/coverage-contract.test.mjs` **28/28**;
whole QA node suite **72/72** at the time of writing.

---

## What the corrected system refuses to do (negative controls)

1. Award L2 for a Start press or tutorial-side tap.
2. Award L1 without an observed post-exit destination.
3. Count a tap without an observed application response.
4. Count feedback that was already on screen before the interaction.
5. Count a round advance without a round-counter increase.
6. Accept a results screen as current unless it follows this session's
   gameplay inside one attempt.
7. Combine two attempts, two APKs, or two games into one journey.
8. Accept missing/mismatched artifact hashes or missing device metadata.
9. Silently drop a failed attempt because another attempt succeeded.
10. Let a pass/fail milestone flip be overwritten instead of OR-ed.

Full enumeration with fixtures: `scripts/qa/coverage-contract.test.mjs`,
`scripts/qa/merge-coverage.test.mjs`.
