# Parent task reconciliation — 076-f

**Change:** `076-f-final-product-certification`
**Task:** 8.1 — reconcile parent tasks `14.2`, `14.7`, `14.8` individually, and
(through sections 3 and 5) the 20 game-domain tasks and `14.3`, `14.4`.

## The rule this file enforces

From the change spec:

> Each unchecked parent OpenSpec task SHALL be reconciled individually as DONE,
> BLOCKED_EXTERNAL, NOT VALIDATED, or FAILED. A task MUST NOT be checked unless
> linked evidence satisfies that task's acceptance criteria. Classifications
> MUST NOT be collapsed into a generic complete status.

So: **one classification per task, each with its own evidence, none bulk-checked.**
A task is only marked `- [x]` in
`openspec/changes/076-product-wide-ui-ux-reboot/tasks.md` when it is `DONE` *and*
the evidence is linked in the same commit.

Parent ledger before this change: **57/82 checked, 25 unchecked**.
The 25 are the 20 game-domain tasks in sections 6–13 plus `14.2`, `14.3`,
`14.4`, `14.7`, `14.8`. `14.5` and `14.6` were already checked and are **not**
reopened — there is no contradiction with them.

## Vocabulary

| Classification | Meaning |
| --- | --- |
| `DONE` | Linked evidence satisfies this task's own acceptance criteria. Only this value allows a checkbox. |
| `BLOCKED_EXTERNAL` | The work is executable in principle but an external dependency outside the repository is preventing it. Owner of the gap is named. |
| `NOT VALIDATED` | The check was not performed, so nothing is claimed. Owner of the gap is named. |
| `FAILED` | The check ran and did not pass. |

## The 20 game-domain tasks (parent sections 6–13)

Each maps to exactly one current-device row under
[`current-device/<game>/`](current-device/). The parent task text is
"Redesign and individually play/capture `<game>` … states", so the evidence must
be that game's own play/capture of active, feedback, pause/end states.

| Parent task | Game | Evidence row | Classification |
| --- | --- | --- | --- |
| 6.1 | attention-odd-one-out | `current-device/attention-odd-one-out/` | **DONE** — PASS - active board, scored feedback quoted verbatim (time-up verdict with the odd item revealed), pause overlay with Resume/Quit, resume confirmed at Round 2/6, and the result screen independently confirmed against the filed device frame (Score 125 / 17% / 1-6 / Timeouts 5 / XP 12 / +2 coins). Selection mechanic retained. |
| 6.2 | attention-sustained-vigilance | `current-device/attention-sustained-vigilance/` | **DONE** — PASS - sustained-timing mechanic observed: the GO/hold instruction, Trial 1/30 chip, Score and Pause controls. |
| 6.3 | attention-symbol-tracker | `current-device/attention-symbol-tracker/` | **DONE** — PASS - tracking mechanic observed: Track 2 symbols and the memorise instruction; scored feedback quoted verbatim including the miss verdict and the timeout submission note. |
| 6.5 | attention-visual-search | `current-device/attention-visual-search/` | **NOT VALIDATED** — Controller MIS-NAVIGATED and played a Flexibility Match-by-SHAPE demo. The note is real and detailed and is NOT evidence of visual search. Re-run required. |
| 7.2 | flexibility-color-stroop | `current-device/flexibility-color-stroop/` | **NOT VALIDATED** — Run killed before producing a review note. Re-run required. |
| 7.5 | flexibility-task-switch | `current-device/flexibility-task-switch/` | **NOT VALIDATED** — Review note is an unfilled skeleton. Re-run required. |
| 8.1 | language-context-fit | `current-device/language-context-fit/` | **NOT VALIDATED** — Review note is an unfilled skeleton. Re-run required. |
| 8.3 | language-word-chain | `current-device/language-word-chain/` | **NOT VALIDATED** — Review note is an unfilled skeleton. Re-run required. |
| 8.4 | language-word-match | `current-device/language-word-match/` | **NOT VALIDATED** — Not yet observed. |
| 8.5 | language-word-scramble | `current-device/language-word-scramble/` | **NOT VALIDATED** — Not yet observed. |
| 9.1 | logic-code-cracker | `current-device/logic-code-cracker/` | **NOT VALIDATED** — Not yet observed. |
| 10.1 | math-equation-builder | `current-device/math-equation-builder/` | **NOT VALIDATED** — Not yet observed. |
| 10.2 | math-fast-math | `current-device/math-fast-math/` | **NOT VALIDATED** — Not yet observed. |
| 10.4 | math-number-line-estimation | `current-device/math-number-line-estimation/` | **NOT VALIDATED** — Not yet observed. |
| 10.5 | math-value-ordering | `current-device/math-value-ordering/` | **NOT VALIDATED** — Not yet observed. |
| 11.5 | memory-prospective-cue | `current-device/memory-prospective-cue/` | **NOT VALIDATED** — Not yet observed. |
| 11.6 | memory-running-order | `current-device/memory-running-order/` | **NOT VALIDATED** — Not yet observed. |
| 12.3 | spatial-grid-nav | `current-device/spatial-grid-nav/` | **NOT VALIDATED** — Not yet observed. |
| 13.3 | speed-quick-compare | `current-device/speed-quick-compare/` | **NOT VALIDATED** — Not yet observed. |
| 13.5 | speed-tap-rush | `current-device/speed-tap-rush/` | **NOT VALIDATED** — Not yet observed. |

The classification column is filled from
[`ASSESSMENT.md`](ASSESSMENT.md) when the current-device sweep is complete. It
is deliberately *not* pre-filled here: pre-filling would be exactly the
"checking a box before its evidence exists" failure this change exists to stop.

**A parent game task is checked if and only if** its row shows PASS (or FIXED
with the fix and its regression guard) across active, scored feedback,
pause/resume, result, input and visual states, and that row is linked in the
same commit that checks the box.

## `14.2` — 42/42 active boards compared on device

> Compare screenshots for 42/42 active boards and applicable feedback/result
> states on device, with legibility, distinct mechanics, labels/touch and action
> placement recorded individually.

This is the **all-42** task, and it is conjunctive: "42/42 … recorded
individually". It cannot be checked while any of the 42 rows is unrecorded.

- **Owner of any gap:** the external Google credential's free-tier quota (see
  [`CONTROLLER.md`](CONTROLLER.md)) — specifically the ~15 requests/minute cap
  that throttles the authorised controller's ability to play 42 games.
- **Classification:** filled from ASSESSMENT.md at close.

## `14.3` — matched matrices, all profiles and reduced motion

> Review matched route and representative game before/after matrices for
> default light/dark, dark/light 2× text, compact/large layouts and
> reduced-motion, correcting clipping, low contrast or hidden actions.

Conjunctive over every profile **and reduced motion**. The change spec's
scenario is unambiguous: when reduced motion has not been reviewed, "the
accessibility and layout acceptance requirement remains incomplete".

- Currently **open** on reduced motion and on the per-domain game-control
  measurements — see [`ROUTES_AND_A11Y.md`](ROUTES_AND_A11Y.md).
- **Classification:** `NOT VALIDATED` until those land. **Not checked.**

## `14.4` — ARTEMIS Flash smoke and Pro journeys

> Run ARTEMIS Flash smoke and Pro first-run, daily workout, resume, game result,
> workout completion, diagnostic and error-recovery journeys; inspect traces and
> fix Critical/High findings.

- Flash smoke: **PASS** (`dfb4c0c8-…`). Pro smoke: **PASS** (`0e257ed7-…`) —
  both real controller executions, recorded in [`CONTROLLER.md`](CONTROLLER.md).
- The nine stateful journeys: see [`JOURNEYS.md`](JOURNEYS.md).
- **Exact external repair** if they cannot run: move the configured Google
  credential off the free tier (or supply one with paid quota) in the external
  ARTEMIS environment file. Nothing in this repository changes to accept it.
- **Classification:** filled from JOURNEYS.md at close. Per the change design,
  if the journeys remain blocked this task **stays unchecked** — ADB gameplay is
  never substituted for the controller.

## `14.7` — final scrubbed coverage manifest and visual decision report

> Publish final scrubbed coverage manifest and visual decision report:
> per-game/route status, 3-direction scorecard/reference lock, matched images,
> APK SHA, residual debt and explicit NOT VALIDATED/BLOCKED gaps. Do not claim
> completion with any game missing.

This is a *reporting* task and it explicitly requires publishing "explicit NOT
VALIDATED/BLOCKED gaps". But it also forbids claiming completion with any game
missing, so it is only `DONE` when the per-game picture is complete **and** the
report is published.

- **Owner of any gap:** same external credential/quota owner as `14.2`.
- **Classification:** filled at close.

## `14.8` — durable state, commit and push

> Update durable `.agent/` campaign/state/validation/issues at meaningful
> checkpoints, commit and push coherent buildable work to `origin/main`, and
> verify no abandoned worktrees.

Wholly repository-owned and fully executable regardless of controller state.

- **Classification:** `DONE` once the durable files are updated and the ending
  SHA is pushed with no abandoned worktrees. See
  [`../..`](../) and the ending-SHA record in [`GATES.md`](GATES.md)/[`VERDICT.md`](VERDICT.md).

## Bulk-checking is the thing being prevented

Nothing in this file is a substitute for the per-task evidence. The reason this
change exists as a *separate* certification change is that the previous campaign
let historical screenshots be read as terminal proof. If any row above is ever
checked without its linked evidence, that failure has been reintroduced.
