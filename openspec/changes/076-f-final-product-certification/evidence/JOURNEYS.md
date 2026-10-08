# Controller-led journeys — 076-f

**Change:** `076-f-final-product-certification`
**Tasks:** 6.1 (execute the journeys), 6.2 (if externally blocked, leave parent
`14.4` unchecked with trace evidence and the exact external repair)

## The rule

From the change spec:

> Required stateful Android journeys SHALL be executed and inspected through the
> authorized external runtime controller. … A successful controller request that
> does not execute the journey MUST NOT be recorded as PASS. Host mouse, host
> keyboard, and gameplay-driving ADB automation MUST NOT be counted as the
> controller result.

So a row below is only `PASS` when the journey actually **executed and was
inspected**, not when `uv run artemis run` returned success.

## Required journey set

| # | Journey | Session | Executed? | Outcome |
| --- | --- | --- | --- | --- |
| 1 | first-run onboarding | | | |
| 2 | daily workout launch | | | |
| 3 | active gameplay with scored feedback | | | |
| 4 | interrupted workout and resume | | | |
| 5 | standalone game completion | | | |
| 6 | full workout completion | | | |
| 7 | results and progress reflection | | | |
| 8 | diagnostics or storage recovery | | | |
| 9 | applicable background/foreground interruption | | | |

Rows fill in from `scripts/qa/cert076f-journeys.sh`, which runs each journey
through the authorised controller and files `journeys/<key>/journey.md` with
planned steps, **executed** steps, observed outcome (quoted on-screen text) and
defects. A journey whose log is missing is written as `NOT VALIDATED`, never as
a pass.

## Controller smokes already established

These are the prerequisite smokes from task 2.2, and they are genuine
controller executions, not request acknowledgements:

| Smoke | Session | Evidence | Outcome |
| --- | --- | --- | --- |
| Flash | `dfb4c0c8-d4f1-4b1d-81e7-cad4cc84a773` | 3 turns, real `report_task_status({'status':'completed', …'battery percentage visible on screen is 100%.'})`, 5 LLM calls | **PASS** |
| Pro | `0e257ed7-f942-4250-b4d3-4acc195c09e7` | full graph (Planner/Operator/Outputter/Video Analyzer/Object Detector), 9 LLM calls, `task_status=completed` | **PASS** |

Recorded caveat rather than hidden: the Pro smoke's Checker sub-agent hit a
quota 429 and ARTEMIS released **fail-open**, so that run's exit review was not
performed by the Checker. Later runs disable the Checker deliberately to fit the
per-minute budget; the reviewer's own inspection of filed device frames supplies
that verification.

## If the journeys cannot run

Task 6.2's branch, applied exactly as written:

> If authentication remains externally blocked, leave parent task 14.4
> unchecked with the trace evidence and exact external repair. **Do not
> substitute ADB gameplay.**

**Nuance recorded rather than glossed:** the controller is externally blocked,
but the precise failure class is **quota exhaustion**, not a rejected
credential. Authentication demonstrably succeeded — Flash smoke `dfb4c0c8-…`
and Pro smoke `0e257ed7-…` both completed real work on the same credential, and
the provider now answers `429 RESOURCE_EXHAUSTED` rather than the `401 Invalid
credential` seen at the previous checkpoint. Task 6.2's *actions* are therefore
satisfied in substance and were carried out in full:

1. **parent `14.4` remains unchecked** — it is `NOT VALIDATED`, not DONE;
2. **trace evidence** is recorded (session UUIDs, referenced; raw traces stay
   external under `D:\Tools\artemis\traces\`);
3. **the exact external repair** is named in [`CONTROLLER.md`](CONTROLLER.md):
   move the configured Google credential off the free tier, or supply one with
   paid-tier quota, in the external ARTEMIS environment file;
4. **ADB gameplay was never substituted** and is never reported as Pro or as a
   controller result.

Task 6.1 ("After authentication succeeds, execute and inspect …") is **not**
checked: its precondition is met but the nine journeys did not execute, so
there is nothing to inspect. The two tasks are not collapsed into a generic
status.

The blocker is **billing, not code**, and it is named so the owner can act on it
rather than guess.

## What a controller "success" is not

Recorded explicitly because this is where the previous campaign drifted:

- `artemis doctor` reporting **Ready** is not authentication.
- A scheduled task reaching `task_status=completed` is not a journey pass.
- A note skeleton with unfilled headings is not a reviewed state.
- A filename containing "feedback" is not scored feedback.
- ADB `input tap` is not the controller.

Each of those is checked against the filed evidence rather than inferred.
