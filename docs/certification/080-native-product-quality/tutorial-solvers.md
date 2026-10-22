# Guided-tutorial solver system — Campaign 080, Wave D

**Status:** IMPLEMENTED + TESTED + NATIVE-VALIDATED (partial sweep, see §6)
**Component:** `scripts/qa/tutorial-solver.mjs` (+ `.test.mjs`)
**Contract:** tested against the REAL recorded control inventories, not fixtures

---

## 1. The problem this actually solved

24 of 42 games sat at L0 for one dominant reason: their tutorial is a **guided,
answer-driven demo**. A generic driver that taps whatever looks pressable never
clears one, because the demo validates a *specific* answer.

This is worth stating precisely, because the distinction is the whole point:
**the application was very likely fine; the automation lacked the capability to
demonstrate it.** The response is therefore to give the harness the capability,
never to relax what counts as certification.

## 2. What counts as a legitimate solve

Every solver step must let the harness prove the full chain the campaign
requires. Blind tapping cannot satisfy steps 5–7, which is exactly why it can
never fake a solve:

| # | Requirement | Proven by |
|---|---|---|
| 1 | Current problem observed | the observation's parsed control inventory |
| 2 | Valid response identified | the solver, **with a stated reason** |
| 3 | Response submitted | harness taps the returned target |
| 4 | Application response observed | before/after fingerprint + causal attribution |
| 5 | Tutorial advanced | observed state leaves `tutorial` |
| 6 | Tutorial completed | contract `tutorialCompleted` axis |
| 7 | Gameplay entered | observed tutorial/intro → playing transition |

The solver is responsible only for steps 1–2. A plan targeting a control that is
**not in the observed inventory is refused**, so the harness cannot emit a tap
off-screen — blind tapping is impossible by construction rather than by
convention. A plan with no explanation is treated as a guess and rejected.

## 3. Two solve tiers — never conflated

| Tier | Meaning | Evidence strength |
|---|---|---|
| `DERIVED` | the answer is **computed** from the observed problem using the game's own documented rule | strongest: the solver *knew* the answer |
| `REVEAL_GUIDED` | the app teaches by **revealing**; after an attempt it labels the answer (`Correct: coat`) or marks a cell verdict, and offers a retry | legitimate observe-then-submit, graded lower |

Reading an explicit application accessibility label and then selecting the
revealed answer is a real interaction — but it is **not** knowledge-derived
play, and the per-step tier is persisted on every run so a coverage report can
never present one as the other.

## 4. Families implemented

`arithmetic-keypad`, `equation-build`, `missing-operator`, `order-by-value`,
`grid-rebuild`, `sequence-replay`, `reveal-choice`, `word-order`,
`code-guess`, `binary-judgement`, `timed-target`, `navigate`.

There is no provider dependency: everything is pure, deterministic and local. A
language-model outage cannot stall the campaign, and a solver answer is
reproducible on any machine.

## 5. Derived answers were verified, not assumed

A `DERIVED` claim is a correctness claim, so each was audited:

- **`spatial-mental-rotation`** — the target rotated **180°** reproduces the
  candidate exactly, colour groups included (verified by hand-drawing both grids
  and comparing normalised cell sets; the 0°/90°/270° rotations do not match, so
  the result is discriminating rather than trivially true).
- **`memory-running-order`** — replays **blue square, then green triangle**,
  derived from `TUTORIAL_DEMO_STREAM = [0,1,2]` with `TUTORIAL_DEMO_RECALL = 2`
  in the game's own source.
- **`math-fast-math`** — derives the sum of the shown operands (the demo fixes
  `operators: ['+']` and is untimed by contract): observed `3 + 5` → presses `8`.
- **`math-missing-operator`** — *solves* the operator from the spoken equation
  (`5 question mark 3 equals 8` → `+`).
- **`speed-order-sweep`** — ascending order from the app's own numeric labels.

One case was deliberately **downgraded** rather than overclaimed:
`memory-pair-recall`'s tutorial is a passive demonstration with a disabled
`CuePanel`, so it is modelled as `navigate`. Claiming a grid rebuild there would
have fabricated an interaction.

## 6. Native outcome

### 6.1 Confirmed harness defect found by this work

Validating the solvers natively surfaced a **separate, real harness defect**:
`math-fast-math` could never exceed L1.

Root cause: the round timed out; the feedback overlay rendered `next-problem`;
the sweep's advance-control list was a fixed literal set that did not contain
it; `chooseGameplayAction()` returned null; the loop fell through to its
"passive" branch and never tapped again. Score stayed 0, no post-input feedback
transition was ever observed, and a run that had **already proven gameplay entry
and an accepted input** was capped at L1.

The list was also missing `next-trial` and `submit-estimate`, both present in the
recorded inventories. Fixed by recognising advance controls by *pattern* in the
pure contract (`pickAdvanceControl`), with 8 regression tests.

### 6.2 Result of that fix

| Game | Before | After | Note |
|---|---|---|---|
| `math-fast-math` | L0 | **L3 VERIFIED** | tutorial solved then full lifecycle |
| `math-missing-operator` | L0 | **L2 VERIFIED** | tutorial cleared, 3/3 `DERIVED` steps |
| `memory-running-order` | L0 | L1 | see blocker below |

### 6.3 Remaining blocker — stated honestly

`memory-running-order` is capped at L1 for a reason that is **not** an app
defect: gameplay requires *replaying a flashed sequence*
("Recall the last 3 in order"). The palette is visible, but the stimulus flashes
for 800 ms before input opens, so the harness cannot observe the stream it must
replay. This is recorded as a gameplay-automation gap. It was deliberately **not**
worked around by tapping arbitrary palette symbols, which would have produced a
fabricated interaction.

## 7. Solver coverage

Against the recorded ledger: **22/22 tutorial-bearing games yield a justified
plan, 0 blind**, of which **8 are `DERIVED`** and 14 `REVEAL_GUIDED`. The
real-data tests assert this, so a renamed testID fails the suite instead of
silently regressing games to L0.

## 8. Test coverage

25 solver tests (contract + real-data) + 8 advance-control regression tests.
The real-data tests import the committed ledger and run the solvers against the
exact control inventories the Android emulator produced — the validation is
against the app's real accessibility tree, not a fixture written to make the
tests pass.

## 9. Limits

- `REVEAL_GUIDED` clears are legitimate interactions but weaker evidence than
  `DERIVED`; they are labelled per step and must not be cited as
  knowledge-derived play.
- Solver coverage proves *tutorial* capability. It does not by itself certify
  subsequent gameplay, which still requires the full journey.
- The flash-sequence gameplay family (e.g. `memory-running-order`) remains
  automation-blocked; seeing the stimulus is a camera/polling limit, not a
  solver limit.
