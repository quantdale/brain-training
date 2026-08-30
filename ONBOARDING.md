# Fresh-machine onboarding

This is the canonical bootstrap entry point for a new workstation or a fresh coding-agent environment. Complete this document before implementation work. The objective is a reproducible machine that can build, test, inspect, and operate this repository without rediscovering tooling mid-campaign.

## 1. Preflight rule

1. Clone the repository and enter its root.
2. Confirm the intended repository/branch and fetch current `origin/main`.
3. Read the repository control-plane documents before changing code: `AGENTS.md`, `README.md`, `docs/PROJECT_CONSTITUTION.md`, `.agent/STATE.md`, `.agent/CURRENT_CAMPAIGN.md`.
4. Install/verify the machine prerequisites below.
5. Enable the committed agent integrations and repository-local skills.
6. Restore dependencies from lockfiles/pins; do not casually upgrade them during bootstrap.
7. Run the baseline validation commands.
8. Only then begin a development campaign. If a prerequisite cannot be satisfied, record it as an environment blocker rather than weakening a gate.

Credentials, API keys, signing material, account logins, licensed models/assets, and other secrets are machine/user responsibilities. Never commit them.

## 2. Supported host and prerequisites

**Primary host:** Windows/Linux/macOS authoring; Android is the primary validated device platform. iOS build validation requires macOS/Xcode.

**Required machine tools**
- Git
- Node.js compatible with Expo 57 / TypeScript 6 and npm
- Android Studio/Android SDK + platform-tools/ADB for Android work
- JDK required by the installed Expo/Android toolchain
- Chromium/Playwright only when a campaign needs browser tooling

**Task-dependent / optional tools**
- Android emulator/AVD for device journeys
- macOS + Xcode for iOS validation


## 3. Agent setup

- Load repository instructions before acting. Prefer committed repository state over chat history.
- Repository-local skills: `continue-development`, `goal`, `harden`.
- Agent adapter/config directories present in this repository should be discovered and used in-place; do not duplicate them globally unless the harness cannot load repository-local configuration.
- Relevant committed agent surfaces: `.agent/`, `.agents/`, `.claude/`, `.kimi-code/`, `.opencode/`.
- MCP policy: No root `.mcp.json` is committed. Prefer the existing ADB/device QA harness under `scripts/qa/`; do not substitute host mouse/keyboard automation.
- Keep MCP/plugin authority narrow. Documentation/diagnostic MCPs are not permission to change architecture, bypass tests, or publish.
- Authentication for GitHub and coding-agent CLIs is configured separately on the machine. Never write tokens into tracked files.

## 4. Bootstrap

Run the repository's pinned bootstrap, not an improvised dependency upgrade:

```bash
cd apps/mobile
npm ci
cd ../..
node scripts/validate-repo-state.mjs
```

Expo dependencies are pinned under `apps/mobile/package.json` (Expo 57 / React Native 0.86.3). Device journeys are repository-owned and ADB-local.


## 5. Editor/LSP baseline

Use the workspace TypeScript server plus ESLint/Expo diagnostics. For React Native/Expo work, make sure the editor resolves the app's local TypeScript and Metro configuration rather than a global TS version.

The editor is optional; the language servers are not. Agents should have diagnostics/type information available before editing non-trivial code.

## 6. Baseline verification

```bash
node scripts/validate-repo-state.mjs
cd apps/mobile
npm run typecheck
npm run test:ci
npm run lint
npx expo-doctor
cd ../..
node scripts/generate-game-registry.mjs --check
node scripts/validate-provenance.mjs --check
node scripts/validate-task-ownership.cjs
node scripts/validate-offline.mjs --check
```

A fresh machine is considered **development-ready** only when the applicable non-external gates above pass. Hardware/device/signing/account gates may remain explicitly blocked if the repository already classifies them that way.

## 7. Fresh-agent instruction

Use this exact operating rule when handing the repository to a new agent:

> Read `ONBOARDING.md` first. Set up every applicable prerequisite, repository-local skill, MCP/plugin, dependency, browser/device/runtime tool, and validation gate described there. Then read the repository's durable agent state and only start implementation after preflight is green or a genuine environment blocker is recorded. Do not replace pinned tooling, skip gates, or invent work to compensate for a missing machine capability.
