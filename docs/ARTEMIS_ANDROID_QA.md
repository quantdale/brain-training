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
the Python runtime, ARTEMIS configuration, integration host, Google credential,
and ADB target. The helper is installed on the target by the first task or by
the explicit `helper install` command above.

Credentials stay in the external ARTEMIS `.env` (or an existing process
environment). They must never be copied into this repository, Codex config,
MCP arguments, traces, screenshots, chat, or logs. Do not run `start.bat` from
an unattended agent session: it is a showcase bootstrapper and can offer
global MCP/rules installation. Use `uv sync`, `doctor`, and the CLI/MCP server
directly.

The upstream checkout's current configuration is the default. If a configured
model is temporarily unavailable to the credential, use an external local
override file selected with `ARTEMIS_ARTEMIS_JSONC`; keep the upstream source
checkout itself clean and record the observed model/service reason in the
validation ledger. For example, the local workstation may use:

```powershell
$env:ARTEMIS_ARTEMIS_JSONC = 'D:\Tools\artemis-local-gemini35.jsonc'
uv run artemis run "<task>" --profile flash --device-serial <serial> --standalone
Remove-Item Env:ARTEMIS_ARTEMIS_JSONC
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

## OpenCode Go / `union-alpha` provider route

The owner-directed provider for Campaign 029 is OpenCode Go / `union-alpha`
only (Anthropic-style Messages endpoint). The route is prepared external to
this repository; nothing provider-specific lives in product code.

```powershell
$env:ARTEMIS_ARTEMIS_JSONC = 'D:\Tools\artemis-local-union-alpha.jsonc'
$env:ANTHROPIC_API_KEY    = $env:OPENCODE_GO_API_KEY          # alias only, never stored
$env:ANTHROPIC_BASE_URL   = 'https://opencode.ai/zen/go'      # SDK appends /v1/messages
$env:ANTHROPIC_CUSTOM_HEADERS = "User-Agent: artemis-braintraining-qa/0.1`nx-opencode-session: $([guid]::NewGuid())"
Remove-Item Env:ANTHROPIC_API_KEY, Env:ANTHROPIC_BASE_URL, Env:ANTHROPIC_CUSTOM_HEADERS
```

The override pins every ARTEMIS role (including the lightweight judge nodes and
the object detector) to `anthropic`/`union-alpha` with the same-model fallback,
and disables the two lens paths that ride a raw Google model with no provider
routing (`flash.step_summarizer.enabled=false`,
`memory.transcript.enabled=false`). The external checkout carries one small
local compatibility commit for custom Anthropic headers and those disable
flags; upstream is never pushed. Offline audit (no provider call): 20/20 roles
resolve to `anthropic`/`union-alpha`.

Current status: **BLOCKED / NOT VALIDATED** for all live tasks because
`OPENCODE_GO_API_KEY` is not present in the environment or the external
ARTEMIS `.env`. Do not substitute Gemini or any other model.

MCP-issued tasks resolve their LLM profile through `ARTEMIS_CONFIG_DIR`
(`llm-config.override.jsonc`) instead of `ARTEMIS_ARTEMIS_JSONC`. To keep the
same pin for MCP, place the same role map in that file too (it is merged over
the upstream defaults, so every role must be pinned there) and keep
`ARTEMIS_ARTEMIS_JSONC` set for the agent behavior flags.

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
