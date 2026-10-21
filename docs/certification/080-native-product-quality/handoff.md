# Next-operator handoff — Campaign 080

Campaign: `080-native-product-quality`
Date: 2026-10-21
Purpose: give the next operator / owner everything needed to continue safely.

---

## Current repository state

- Canonical branch `main`; working tree clean at report time; no temporary
  worktrees/branches left behind.
- Campaign 080 active → closing. Durable state synchronized in `.agent/STATE.md`,
  `.agent/CURRENT_CAMPAIGN.md`, `.agent/GOVERNANCE.json`, `.agent/EXECUTION_PROMPT.md`,
  `.agent/task-ownership.json`, and `openspec/changes/080-native-product-quality/`.
- **Application source unchanged this campaign** (only QA harness scripts,
  certification docs, OpenSpec/governance). The 8,018-test suite is green
  (711 passed suites / 5 classified skips), typecheck clean, lint clean, strict
  OpenSpec 207/207, repo-state PASS.
- Local gates re-run at the integrated revision before close; the four hosted
  workflows must be confirmed green on the exact final commit (recorded in
  `.agent/STATE.md` post-integration).

## Exact commands to reproduce the key results

```bash
# Native 42-game coverage (device: emulator-5554 / braintraining-qa36)
node scripts/qa/native-game-sweep.mjs --deep-level \
  --out scripts/qa/native-coverage-ledger.json
node scripts/qa/merge-coverage.mjs \
  scripts/qa/native-coverage-ledger.json <pass2.json> \
  --out scripts/qa/native-coverage-merged.json \
  --matrix docs/certification/080-native-product-quality/native-coverage-matrix.md

# Local gates (from apps/mobile)
npx tsc --noEmit            # typecheck
npm run lint                # lint
npm test                    # full jest (711/8018/5-skip)

# Repository gates (repo root)
node scripts/validate-repo-state.mjs
node scripts/generate-spec-store.mjs --check
npx @fission-ai/openspec@1.9.0 validate --all --strict
node scripts/validate-dependency-audit.mjs      # network-dependent

# Performance (source probes, not a CI gate)
npm run perf:probe          # from apps/mobile
```

## Actual remaining blockers / gaps (honest)

**External (need hardware / tooling / owner):**
- **Android ARM64 runtime** — no arm64-v8a image validated; x86_64 emulation does
  not qualify ARM64. Install an ARM64 system image for a representative flow.
- **Android physical runtime** — no device connected. See checklist below.
- **iOS simulator runtime** — no boot/install/launch smoke lane established
  (only compilation is green). Feasible on a macOS runner with `simctl` +
  `xcodebuild`; add only with a stability budget.
- **iOS physical runtime** — no device.
- **TalkBack runtime acceptance** — not executed; only semantic-label inspection.
- **Owner subjective acceptance / taste** — not claimed.

**In-repo (achievable next):**
- Re-run the a11y/responsive profile matrix (large font, compact, dark, reduced
  motion, landscape) across representative games.
- Drive Workout V3 to full native completion (generation → legs → interruption →
  resume → rewards), and re-verify duplicate-reward suppression live.
- Backup/restore on-device round-trip with controlled fixtures + upgrade/migration
  over real prior data.
- Push more games to Level 3 (full session completion) — extend the driver with
  per-family input (drag/swipe, keypad) for the 4 L1 games and longer session
  budgets.
- Visual P3 pass: Odd One Out triangle affordance (confirmed) + the 3 unconfirmed
  items in `visual-accessibility.md`.

## Physical-device acceptance checklist (external)

1. Enable Developer options + USB debugging on a physical Android (ARM64) device.
2. `adb devices` shows the device; `adb install -r` the release APK.
3. Verify: cold start, home render, one game per cognitive domain played to
   completion, pause/resume/quit, offline airplane journey, and a 10-min
   continuous-play thermal/memory sample (`dumpsys meminfo`, `gfxinfo`).
4. Record ARM64-native behavior, touch responsiveness, thermal, and battery.
5. Attach artifacts; do not infer physical results from x86_64 emulation.

## Owner acceptance requirements

Public-release authorization is **separate** from this engineering verdict and
requires: physical Android + iOS runtime qualification (or explicit owner
acceptance of those gaps), screen-reader acceptance, and the owner's subjective
product acceptance. None of these are claimed here.

## Governance note

Branch protection keeps force-push + deletion blocked for everyone (ruleset
25523614). The classic required-status-check rule still has an administrator
direct-push bypass (`enforce_admins: false`) to preserve the autonomous
direct-push integration model; the precise tradeoff and a recommended
non-bypass successor model are in `governance.md` H2 (owner decision).

## Safe continuation procedure

1. `git fetch && git status` (confirm clean `main`), `node scripts/validate-repo-state.mjs`.
2. Boot the dedicated AVD `braintraining-qa36`; do not wipe owner app data.
3. Pick an in-repo gap above; follow DISCOVER → REPRODUCE → FIX → TEST → MEASURE →
   REVIEW → INTEGRATE; keep the green baseline; never fake green.
4. Keep Android build / emulator / ARM64 / physical and iOS compile / simulator /
   physical statuses separate in every report.
