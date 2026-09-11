# Durable Project State

**Last update:** 2026-09-11 — Campaign 024 ACTIVATED (frontend UX modernization).
**Canonical branch:** `main`
**Active campaign:** 024-frontend-ux-modernization
**Last campaign:** `023-production-gamification-overhaul`
**Last campaign status:** VALIDATED

## Current status

Campaign 024 — Frontend UX Modernization is **ACTIVE**. It executes the owner's
2026-09-11 goal-mode directive issued after Campaign 023's terminal closure:
research modern UI/UX with Refero MCP and apply it across the entire frontend,
drawing on Duolingo / Brilliant.org / Elevate-class gamified iOS apps, improving
visual hierarchy, micro-interactions, responsive layout, accessibility and
overall UX until the result is production-ready, fully functional, performant
and visually refined.

Scope boundary: no gameplay, scoring, rating, persistence, sync, AI or
monetization change; no new games; the locked decisions in
`docs/PROJECT_CONSTITUTION.md` remain authoritative.

## Activation evidence (2026-09-11)

- Recon swarm produced a full surface/component/accessibility/motion inventory;
  findings and evidence are in
  `openspec/changes/024-frontend-ux-modernization/audit-map.md`.
- Refero research briefs committed under the campaign's `research/` directory
  (core-shell patterns + play/feedback patterns, 33 iOS reference screens).
- **New capability — native visual evidence:** the repository previously
  recorded "headless screencap returns a constant blank frame" as an
  operational limitation (Campaign 023). Root cause identified: both project ATD
  AVDs set `hw.gpu.enabled=no`. A GPU-enabled AVD (`braintraining-ui35`,
  android-35 google_apis, 2048 MB, headless) boots in ~90 s and returns real
  frames; screenshot capture and display-profile switching become verifiable
  evidence classes for this campaign.
- Baseline "before" screenshots of the Campaign 023 release APK were captured
  on that device (`qa-artifacts/campaign024/`).

## Last campaign (023) — terminal summary

42/42 games audited and repaired; gamified design-system surfaces wired through
catalog; production release build + standalone/offline runtime verified; runtime
certification 42/42 games PASS (aggregate certify flag false solely from one
never-idle dump pause-probe miss, disproven as a product defect by a direct
pause/resume probe). Still NOT VALIDATED / EXTERNALLY BLOCKED: store signing
credentials, manual TalkBack, SAF/system sheets, physical device, iOS runtime.

## Continuation rule

Campaign 024 is the executable authority. Do not restart Campaign 023. A future
campaign requires a new owner directive or a separately justified planning pass
against then-current repository evidence. Historical campaign records remain
recoverable from Git, `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`,
OpenSpec history, and prior commits.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `openspec/changes/024-frontend-ux-modernization/EXECUTION.md`
7. `.agent/VALIDATION.md` and `.agent/KNOWN_ISSUES.md`
