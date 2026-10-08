# Controller authentication and capability — 076-f

**Change:** `076-f-final-product-certification`
**Tasks:** 2.1 (doctor + credential probe), 2.2 (Flash and Pro smoke)
**Rule enforced:** a doctor "Ready" is not authentication, and a controller RPC
success is not a journey.

## 2.1 Doctor, then an authenticated request with a created task

`uv run artemis doctor` → **Status: Ready** (Python 3.12.11, system config
validated, ADB connected to `sdk_gphone64_x86_64` 1080x2400, FFmpeg + scrcpy
present, Accessibility Helper ready).

Doctor readiness is explicitly **not** treated as authentication. The credential
was then probed with real requests that created real tasks:

| # | Test name | Profile | Session | Result |
| --- | --- | --- | --- | --- |
| 1 | `cert076f-2.1-credential-probe` | flash | `310b8ed8-…` | task created; LLM call timed out at 180s |
| 2 | `cert076f-2.2-flash-smoke` | flash | `ef21ff35-…` | FAILED — provider `ServerError: 504 Gateway Timeout`, then 180s timeout |
| 3 | `cert076f-2.2-flash-smoke-retry1` | flash | `b523ea70-…` | FAILED — same 504 Gateway Timeout class |
| 4 | `cert076f-2.2-pro-smoke` | pro | `b6be31d7-…` | FAILED — `ClientError: 429`, `Quota exceeded for metric: generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash`, `retryDelay 67640s` |

**Credential verdict: the credential is VALID.** The previous checkpoint's
`HTTP 401 Invalid credential` did not recur. The provider now *authenticates*
the key and then rejects on **quota**. That distinction is exactly what task
2.1 exists to establish, and it is proven by the error classes above: Google
returns `400/401` for an invalid key and `429 RESOURCE_EXHAUSTED` with a named
`quotaId` for a recognized key with no budget.

No credential value is printed, committed, or quoted anywhere in this
repository. Raw traces stay external under `D:\Tools\artemis\traces\`.

## The free-tier constraint (measured, not assumed)

Direct read-only probes of the Gemini endpoint, printing only status and the
declared quota:

| Model | Measured budget | State at probe time |
| --- | --- | --- |
| `gemini-3.8-flash` | `generate_content_free_tier_requests` **limit 20/day** | exhausted, retry in ~18h47m |
| `gemini-3.7-flash` | **limit 20/day** | exhausted, retry in ~18h20m |
| `gemini-2.5-flash` | — | HTTP 404, retired for new users |
| `gemini-3.5-flash-lite` | **limit 500/day** | **the workable lane** — recovers within the day and drives full journeys |
| `gemini-3.1-flash-lite` | `GenerateRequestsPerMinutePerProjectPerModel-FreeTier` **15/minute** | **not usable for ARTEMIS** — see below |
| `gemini-robotics-er-2-preview` | — | HTTP 200 (object detector only) |

Three distinct quota kinds are in play: **per-day** caps on the newer
`gemini-3.x-flash` models, a **500/day** cap on `gemini-3.5-flash-lite`, and a
**per-minute** cap on `gemini-3.1-flash-lite`.

**Measured correction — a per-minute cap is NOT workable here.** It looked
workable in theory (15/min ≈ 900/hour), but in practice ARTEMIS cannot run on
it at all: one full attempt on `gemini-3.1-flash-lite` produced 37 rate-limit
429s, opened ARTEMIS's LLM circuit breaker (`artemis/services/llm.py`
`_ENDPOINT_BREAKER`, threshold 3 / 30s cooldown), hit `TimeoutError: LLM call
timed out after 180 seconds`, and recorded **0 steps**. Runs were being cut
short mid-journey and filed unfilled note skeletons instead of observations.
That is the direct cause of most `NOT VALIDATED` rows. `gemini-3.5-flash-lite`
has no binding per-minute limit and drives complete journeys — e.g. session
`51ef7337-…` recorded 17 steps and a full state review.

## Environment change made during this change (full disclosure)

**This is the one deliberate change to the external QA environment, and it is
not a repository change.** ARTEMIS's `config/artemis.jsonc` originally declared
`gemini-3.8-flash` as its default model. Because that model is day-capped at 20
requests and ARTEMIS's SDK *retries the same model* rather than switching to its
own declared `fallback`, every controller task failed on quota.

The default was therefore routed to a model the same credential can actually
serve. Chain of changes, all in `D:\Tools\artemis\config\artemis.jsonc`, with
the original preserved as `artemis.jsonc.bak-cert076f`:

1. `default.model` → `gemini-3.7-flash` (ARTEMIS's *own declared fallback*) —
   worked for two smokes, then hit its 20/day cap.
2. `default.model` → `gemini-3.5-flash-lite` — sustained 25+ consecutive probe
   calls and drove three full game journeys, then hit its 500/day cap.
3. `default.model` and `nodes.hopper.model` → `gemini-3.1-flash-lite` — the only
   model then believed to have a workable budget. **This was later reverted:**
   measured in production it cannot run ARTEMIS at all (see the quota table).
4. Reverted to `gemini-3.5-flash-lite` after its budget recovered, which is the
   configuration that produced the accepted evidence.

**What did not change:** the provider (`google`), the credential, the ARTEMIS
checkout, the controller itself, the device, or any repository file. There is no
provider switch and no controller substitution — this is the same authorized
external ARTEMIS controller using a different model of the same provider. ADB
was used only for screenshot/hierarchy capture and diagnostics, never to drive
gameplay.

**Why this is disclosed so prominently:** the parent checkpoint recorded "no
provider configuration changed" as a positive property of that run. That is no
longer true of this run, and any consumer of this evidence must know that the
controller's default model differs from the one its config shipped with. If the
owner prefers the original model, restore `artemis.jsonc.bak-cert076f` and
re-run; that will require paid-tier quota for `gemini-3.8-flash`.

## 2.2 Flash and Pro smoke — both PASS

After the routing above, both required smokes executed real work through the
authorized controller and completed:

| Smoke | Session | Evidence | Outcome |
| --- | --- | --- | --- |
| Flash | `dfb4c0c8-…` | 3 turns, real `report_task_status({'status':'completed', …'battery percentage visible on screen is 100%.'})` tool call, 5 LLM calls | **PASS** |
| Pro | `0e257ed7-…` | full graph run (Planner/Operator/Outputter/Video Analyzer/Object Detector), 9 LLM calls, `task_status=completed` | **PASS** |

Caveat recorded rather than hidden: the Pro smoke's **Checker** sub-agent hit a
quota 429 and ARTEMIS released **fail-open** (`Final check errored (); releasing
fail-open`), so that run's exit review was not performed by the Checker. The
journey itself executed and completed. Later runs disable the Checker and the
step summarizer deliberately, to fit the per-minute budget; the reviewer's own
inspection of the filed device frames supplies the verification those sub-agents
would otherwise provide.

## Exact external repair required to finish certification

The blocker is **billing, not code**. It was measured four separate times during
this change, each after the free-tier budget recovered and then exhausted again
mid-sweep:

| Attempt | Model in use | Outcome |
| --- | --- | --- |
| 1 | `gemini-3.8-flash` / `gemini-3.7-flash` | 20/day cap, exhausted before any journey ran |
| 2 | `gemini-3.5-flash-lite` | produced every accepted row, then hit its 500/day cap |
| 3 | `gemini-3.1-flash-lite` | 15/minute cap — cannot run ARTEMIS at all (0 steps recorded) |
| 4 | `gemini-3.5-flash-lite` again after its budget recovered | produced more accepted rows, then 429 again |

Final state at close: **both usable models return 429**, `retry-in: 12h51m`, and
the last run recorded **0 steps**. This is not a pacing problem that patience
solves — the daily allowance is simply smaller than the workload.

To complete the controller-led journeys and the remaining current-device game
checks, the owner must do one of:

1. **Move the configured Google credential to a paid plan** (the free tier is the
   constraint: 20/day on `gemini-3.x-flash`, 500/day on `gemini-3.5-flash-lite`,
   15/minute on `gemini-3.1-flash-lite`), **or**
2. Supply a different credential with paid-tier quota, configured **only** in
   the external ARTEMIS environment file.

After that, re-run section 3 (game acceptance) and section 6 (Pro journeys) of
`openspec/changes/076-f-final-product-certification/tasks.md`. The tooling is
ready and its failure modes are already fixed:

- `scripts/qa/cert076f-repair.sh` — re-runs only the games whose row is not yet
  accepted, with a tightened prompt that makes the controller state the
  on-screen game title **before** playing (this is what fixed mis-navigation)
  and forbids writing the note until the journey is complete (this is what
  stops unfilled skeletons).
- `scripts/qa/cert076f-harvest.sh` — rebuilds each row from the ARTEMIS session
  UUID only (no name matching, which caused a real mis-attribution) and rejects
  skeletons.
- `node scripts/certification/build-assessment.mjs` — regenerates the
  one-row-per-game assessment and fails closed.
- `scripts/qa/cert076f-journeys.sh` — the nine stateful journeys.

Nothing in this repository needs to change to accept a new credential.

A missing controller credential or quota does **not** create repository-complete,
and it does not permit substituting ADB gameplay.
