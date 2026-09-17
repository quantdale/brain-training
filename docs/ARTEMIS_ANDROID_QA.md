# ARTEMIS Android runtime QA

ARTEMIS is the authoritative Android runtime/device-QA system for this
repository. It is an external checkout, never a vendored dependency:

```text
D:\Tools\artemis
```

The app repository owns the product, its deterministic tests, and the
instrumentation contract. ARTEMIS owns natural-language interaction, device
observation, task traces, and Flash/Pro runtime journeys.

## Host setup

Use one dedicated Android target at a time. The normal local target is the
existing `braintraining-ui35` AVD; the attached serial must be confirmed with
`adb devices -l` before a task is scheduled.

From the external checkout:

```powershell
Set-Location D:\Tools\artemis
uv sync
uv run artemis doctor --json
uv run artemis helper status --serial <serial>
uv run artemis helper install --serial <serial>
```

`doctor --json` is the machine-readable readiness gate. A ready result requires
the Python runtime, ARTEMIS configuration, integration host, configured
OpenCode Go credential, and ADB target. The helper is installed on the target
by the first task or by the explicit `helper install` command above.

Credentials stay in the external ARTEMIS `.env` (or an existing process
environment). They must never be copied into this repository, Codex config,
MCP arguments, traces, screenshots, chat, or logs. Do not run `start.bat` from
an unattended agent session: it is a showcase bootstrapper and can offer
global MCP/rules installation. Use `uv sync`, `doctor`, and the CLI/MCP server
directly.

The upstream checkout's current configuration is not the Campaign 029 runtime
route. Use the external local override selected with
`ARTEMIS_ARTEMIS_JSONC`; keep the upstream source checkout itself clean and
record the observed model/service reason in the validation ledger. Do not
substitute another provider or model. For example, the local workstation may
use:

```powershell
$env:ARTEMIS_ARTEMIS_JSONC = 'D:\Tools\artemis-local-muse-spark.jsonc'
$env:ARTEMIS_CONFIG_DIR = 'C:\Users\<user>\AppData\Local\Artemis'
uv run artemis run "<task>" --profile flash --device-serial <serial> --standalone
Remove-Item Env:ARTEMIS_ARTEMIS_JSONC, Env:ARTEMIS_CONFIG_DIR
```

The override is a runtime compatibility measure, not an app dependency or a
committed product setting.

## ARTEMIS task profiles

Flash is for a short, bounded, reactive smoke. Pro is for a stateful journey
with checkpoints, recovery, or a final result review.

```powershell
uv run artemis run "Open the Brain Training app, open Games, start Memory, play one round legitimately, and report the results screen." `
  --profile flash --device-serial <serial> --locked-app com.braintraining.app `
  --test-name braintraining-flash --without-video-recording-tools

uv run artemis run "Run today's Brain Training workout through its available legs, use the in-game next-game or completion action after each result, then relaunch the app and verify the persisted workout state." `
  --profile pro --device-serial <serial> --locked-app com.braintraining.app `
  --test-name braintraining-pro-stateful --without-video-recording-tools
```

## OpenCode Go / Muse Spark 1.3 Contributor route

The owner-directed provider for Campaign 029 is **OpenCode Go** with model
`muse-spark-1.3-contributor` only. ARTEMIS uses the OpenAI Responses API at
`https://opencode.ai/zen/go/v1/responses`, with `reasoning.effort=xhigh` and no
fallback. Union Alpha is permanently abandoned and is historical evidence
only; no Anthropic Messages transport or alternate model is active.

The route is prepared outside this repository. The external ARTEMIS `.env`
resolves `OPENCODE_GO_API_KEY` in memory; its value must never be copied into
this repository, Codex configuration, prompts, traces, screenshots, or logs.
The adapter sends an honest User-Agent and a stable per-task
`x-opencode-session` header.

The external override pins every active ARTEMIS role, including lightweight
judges and the object/spatial path, to `openai_responses` /
`muse-spark-1.3-contributor` with `xhigh` reasoning and `fallback=null`.
Offline audit evidence: **20/20 active roles**, zero Union Alpha, Gemini,
alternate-provider, or fallback violations. The obsolete provider-specific
startup prewarm was removed from the local ARTEMIS compatibility checkout so
startup cannot send requests to an inactive provider.

Direct qualification is **PASS** for bounded text+XHigh, harmless-image
multimodal reasoning, and the structured tool path using automatic tool
selection plus stateless tool-result continuation. The first MCP Settings
trace (`4340ff06-befd-4af7-9404-527940fa68a9`) remains **INVALID / NOT
VALIDATED**: the UI sequence completed and its ledger recorded Muse calls, but
stderr also contained the obsolete Gemini startup prewarm. A fresh Codex MCP
session then loaded the corrected local ARTEMIS process and produced these
runtime gates:

- Settings Flash **PASS**:
  `9aaa2db9-5743-4bf9-9835-ab5b537fb622`.
- Brain Training Flash **PASS**:
  `e927ade5-2b2d-4e2f-a150-7c316230a85d`.
- Brain Training Pro **PASS by direct trace/step/screenshot inspection**:
  `5908e678-4b6d-4abf-8ece-2fcc41b3cc67`.

The Pro task's optional ARTEMIS verifier subchecks are recorded as
`INCONCLUSIVE` because the Muse route rejected their verifier request schemas;
this is kept distinct from the directly observed runtime evidence. The
effective route remained Muse Spark 1.3 Contributor XHigh, with no Gemini,
Union Alpha, alternate provider, or model fallback used. The local worker
session-header fix was loaded from ARTEMIS revision
`2ef304bbe17aa4fa80de033ead32000a33e74c41`, which remains local-only and was
not pushed upstream.

MCP-issued tasks resolve their LLM profile through `ARTEMIS_CONFIG_DIR`
(`llm-config.override.jsonc`) instead of `ARTEMIS_ARTEMIS_JSONC`. To keep the
same Muse pin for MCP, place the same role map in that file too (it is merged
over the upstream defaults, so every role must be pinned there) and keep
`ARTEMIS_ARTEMIS_JSONC` set for the agent behavior flags. A running Codex
session must be restarted or its MCP servers reloaded after changing either
file; configuration text alone is not live-process evidence.

For MCP clients, the runtime surface is:

- `mobile_run_task` — schedule a Flash or Pro task, optionally with
  `device_serial`, `locked_app_package`, `app_path`, and trace metadata.
- `mobile_manage_task` — poll, stop, or steer a task by trace/session id.
- `mobile_get_device_state` — capture the current screenshot or hierarchy.
- `mobile_inspect_trace` — inspect summaries, steps, screenshots, and failure
  details.
- `mobile_diagnose` — run readiness checks; use it first after a task error,
  missing device, credential/model failure, or unresponsive screen. It can
  launch an installed AVD in the background with
  `launch_avd="braintraining-ui35"` and can run `probe_device=true`.

Generate the Codex snippet from the upstream checkout and merge only the
`mcp_servers.artemis` block into the existing user config. Do not use
`uv run artemis mcp --install all`: that command also installs global testing
rules and is broader than this repository's scope. The current Codex process
may need to be restarted or its MCP servers reloaded before the new tools are
visible.

## Brain Training interaction contract

The runtime agent should use the app's live semantics rather than guessed
coordinates:

1. Launch or foreground the app and wait for the Home surface.
2. Use the Games tab or a `braintraining://game/<id>` deep link to reach a
   known game.
3. Respect tutorial/start/pause/results states and perform a legitimate
   interaction; use developer-only QA controls only when a deterministic
   persistence or failure path specifically requires them.
4. Verify a result or workout-completion surface, then exercise the requested
   back/next/resume transition.
5. Capture the ARTEMIS trace id and inspect the trace before reporting a pass.

Stable `testID`s, accessible names, deep links, seeded generators, versioned
game metadata, structured logs, and safe dev-only fixture controls are product
instrumentation seams. They remain in the app after the custom driver removal.

## Evidence and deterministic gates

ARTEMIS traces and screenshots are kept outside the product repository under
`D:\Tools\artemis\traces`. Repository-side screenshots, hierarchy dumps,
logcat, and DB snapshots use the disposable `qa-artifacts/` convention in
[`QA_ARTIFACTS.md`](QA_ARTIFACTS.md). A missing trace, incomplete task, model
error, or unavailable target is `BLOCKED`/`NOT VALIDATED`, never `PASS`.
For the Campaign 029 Pro trace, the executed operator journey and its required
route completed; only optional post-task verifier subchecks returned schema
errors, so those subchecks remain `INCONCLUSIVE` rather than being presented
as PASS.

Every change still runs the relevant offline gates, including:

```powershell
node scripts/qa/validate-runtime-qa-contract.mjs
node scripts/validate-repo-state.mjs
node scripts/validate-task-ownership.cjs
node scripts/generate-game-registry.mjs --check
node scripts/validate-provenance.mjs --check
node scripts/validate-offline.mjs --check
```

App typecheck, Jest, lint, Expo Doctor, and Android build checks remain
repository gates. The lower-level `scripts/android/` commands are limited to
AVD/app provisioning and evidence capture; they are not a second gameplay
driver and do not replace ARTEMIS runtime evidence.
