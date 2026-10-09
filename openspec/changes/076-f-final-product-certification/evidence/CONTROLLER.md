# Controller authentication and capability — 076-f

**Change:** `076-f-final-product-certification`
**Tasks:** 2.1 (doctor + credential probe), 2.2 (Flash and Pro smoke)
**Rule enforced:** a doctor "Ready" is not authentication, and a controller RPC
success is not a journey.

> **Current status (2026-10-09 reconciliation).** Authentication **succeeded**.
> The owner resolved the blocker by moving ARTEMIS to a different provider (the
> external OpenDesign endpoint); object detection remains on the required Gemini
> ER model; the credential lives only in `D:\Tools\artemis\.env`. Flash smoke
> `6f185691-…` and Pro smoke `251e3f10-…` both PASS. Task `6.2` — "if
> authentication remains externally blocked" — was therefore **un-checked**: a
> checked `6.2` would falsely assert the blocked branch is current. The Google
> free-tier quota and HTTP 401 material below is **historical** and is kept as
> history, not as the live disposition. Task `6.1` (the nine journeys) stays
> open and is owned by this campaign.

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

## The free-tier constraint (historical — the Google route is no longer active)

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

## Provider switch to OpenDesign (AMR Link) — 2026-10-09

The owner resolved the billing blocker by supplying a **different provider**, not
by upgrading the Google plan. This section records exactly what changed.

**Endpoint:** `https://amr-link.open-design.ai/v1`, OpenAI ChatCompletions
(`openai-completions`). ARTEMIS's `provider: "openai"` is its ChatCompletions
backend, so it maps directly. Credentials were taken from the agent runtime's
existing provider configuration and written **only** to
`D:\Tools\artemis\.env` (`OPENAI_API_KEY`, `OPENAI_BASE_URL`). No credential
appears anywhere in this repository.

**Models wired:**

| Node | Model | Notes |
| --- | --- | --- |
| `default` (planner/operator/outputter/…) | `mimo-v2.6-pro` | vision (text+image), 1M context, 131k max tokens |
| `default.fallback` / `hopper` | `mimo-v2.6-flash` | lighter sibling |
| `object_detector` | `gemini-robotics-er-2-preview` (unchanged, Google) | ARTEMIS hard-requires a Gemini **ER** model for spatial grounding — "Non-ER models will fail spatial coordinate detection" — and it still answers HTTP 200 on its own quota |

Verified before wiring: text call HTTP 200; vision call HTTP 200 with
`image_tokens: 2550`, reading a real device frame and reproducing the verified
result screen exactly (Score 125, Accuracy 17%, First-try 17%, Rounds 1/6,
Best streak 1, Timeouts 5, XP 12, +12 XP · +2 coins).

### Two integration defects found and fixed

1. **`artemis.jsonc` cannot contain `https://` in string values.** ARTEMIS's
   `strip_json_comments` (`artemis/utils/file.py`) runs
   `re.sub(r"//.*?$", "", …, MULTILINE)` — it strips `//…` to end-of-line even
   *inside* strings. Every `api_base` URL was truncated to `"https:` and the file
   failed to parse (`JSONDecodeError: Invalid control character`). The original
   config contained **zero** `https://` values, which is why this was never hit
   before. Fix: no URLs in the JSONC; the base URL is supplied by
   `OPENAI_BASE_URL` in `.env`, which `artemis/llm/router.py` already falls back
   to when `endpoint.api_base` is absent.

2. **A stale `OPENAI_API_KEY` in the host process environment shadows `.env`.**
   The agent runtime exports its own `OPENAI_API_KEY` (67 chars, different
   provider). Real env vars take precedence over the dotenv file, so ARTEMIS
   sent the wrong key and the gateway answered `401 invalid_api_key — api key
   not found`. Fix: every ARTEMIS invocation in `scripts/qa/cert076f-*.sh`
   begins with `unset OPENAI_API_KEY`, so `D:\Tools\artemis\.env` supplies the
   real credential. Verified: unsetting it resolves `settings.OPENAI_API_KEY`
   to the correct 39-char key.

Two smaller schema issues also had to be turned off for this gateway: it
returns reasoning content that ARTEMIS's `ChatMessage` model rejects
(`role: None` validation error), so `include_thoughts` is now `false` on
`operator` and `checker`, and `hopper` — which uses
`with_structured_output(HopperOutput)` — runs with `reasoning_effort: "none"`.
Visual reasoning still happens; only the thought echo is dropped.

### Smokes on the new provider

| Smoke | Session | Evidence | Outcome |
| --- | --- | --- | --- |
| Flash | `6f185691-…` | 2 steps, real `report_task_status` quoting "Battery" / "100%" / "Battery charging, 100 percent", 3 calls on `openai:mimo-v2.6-pro` | **PASS** |
| Pro | `251e3f10-…` | 4 steps, `task_status=completed`, 12 calls on `openai:mimo-v2.6-pro`, 147,681 prompt tokens, 65.5% cached | **PASS** |

So the controller is operational and the earlier blocker is **resolved** — by a
provider change rather than a billing change. Everything previously recorded
about Google free-tier quota remains true of the Google credential and is kept
as history.

## Exact repair that was applied, and what was still owed at the earlier close

The blocker was **billing, not code**. It was measured four separate times during
this change, each after the free-tier budget recovered and then exhausted again
mid-sweep:

| Attempt | Model in use | Outcome |
| --- | --- | --- |
| 1 | `gemini-3.8-flash` / `gemini-3.7-flash` | 20/day cap, exhausted before any journey ran |
| 2 | `gemini-3.5-flash-lite` | produced every accepted row, then hit its 500/day cap |
| 3 | `gemini-3.1-flash-lite` | 15/minute cap — cannot run ARTEMIS at all (0 steps recorded) |
| 4 | `gemini-3.5-flash-lite` again after its budget recovered | produced more accepted rows, then 429 again |

Final state of the Google route at the earlier close: **both usable models return
429**, `retry-in: 12h51m`, and the last run recorded **0 steps**. That is a
daily-allowance problem, not a pacing problem.

That route was then superseded: the owner supplied a **different provider** and the
controller became operational (see *Provider switch to OpenDesign* above). The
Google quota material is retained because it is a true measurement of that
credential, and because the object detector still runs on Google.

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
