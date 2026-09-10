# Known Issues / Blockers

## Current status — Campaign 022 VALIDATED, release verdict CONDITIONAL GO

Campaign 022 is terminal. There is no active campaign and no repository-owned release blocker remains. The application is **not yet fully store/public-release cleared** because several evidence classes are deliberately external/manual:

- production/Play store signing credentials and store-signing reproducibility;
- manual TalkBack accessibility review;
- Android SAF/share/document-picker system-sheet flows;
- physical-device behavior;
- manual iOS runtime UX on a suitable macOS/iOS environment.

These remain **NOT VALIDATED / DEFERRED / EXTERNALLY BLOCKED** as applicable. They are not failures of the repository-owned automated matrix, and they must not be reported as PASS until actually performed.

## Open non-blocking maintenance

- **`xp_awards` schema-level idempotency idea — NON-BLOCKING MAINTENANCE:** Campaign 022 proved every production award writer commits inside one serialized transaction behind a CAS claim gate, with currency ledger operations additionally guarded by operation-id uniqueness. A blanket `UNIQUE(source)` would be wrong because legitimate legacy/generic sources such as `system` may repeat during supported restore semantics. Keep the adversarial proof in the Campaign 022 audit map rather than adding the incorrect constraint.
- **Offline validator heuristic gap — Low:** the static validator can miss runtime-reassembled network-call strings. Runtime/offline certification is the stronger evidence for the shipped boundary; improve the heuristic only in a scoped maintenance campaign.
- **Seeding test-fixture seam noise — Low:** partial Jest DB facades can emit non-fatal startup noise not representative of the production facade.
- **Permanent provenance allowlist dead entries — Low:** legacy permanent entries are ignored by design and are misleading configuration debt; remove only in an identity-aware maintenance change.
- **QA artifact retention — Low:** transient `qa-artifacts/` output is gitignored but can accumulate locally; add bounded retention before automation volume grows materially.
- **Build/dev dependency advisories:** retain the existing dependency-audit classification and re-evaluate with planned framework/toolchain upgrades; do not force unrelated dependency churn into a release-doc cleanup.
- **Achievements sync scope — Low:** quest/achievement evaluation scans up to
  5000 recent sessions (`SYNC_SESSION_SCAN_LIMIT`,
  `apps/mobile/src/progression/sync.ts`); measured flat ~78 ms at cap (W13
  baselines), far above realistic foundations-phase history. Documented cap,
  non-blocking.
- **Constitution-deferred product systems (not bugs):** cloud sync/auth,
  telemetry, and monetization/ads remain deferred by
  `docs/PROJECT_CONSTITUTION.md`; they are planned future layers, not open
  defects, and must not be implemented without an owner-authorized campaign.

## Campaign 023 non-blocking findings (added 2026-09-11)

All are Low/Medium, non-blocking, and outside the campaign's Critical/High repair
scope. Each was confirmed by the all-games audit wave and deliberately deferred
with rationale.

- **Adaptive escalation gap — `spatial-coordinate-turn` (Medium):** the game
declares adaptive difficulty axes (`minDirections/maxDirections`, steps, move
max) but `next-round` always uses the session-start plan, so adaptive sessions
record the computed minimum challenge. The declared axes are internally
inconsistent (`directions` typed `4 | 8` while the challenge mapping treats it
as a 4–8 continuum), so a fix needs a product decision; all other games now
escalate correctly.
- **Late-tap SFX mismatch (Low):** `attention-odd-one-out`, `attention-visual-search`,
and `math-fast-math` play tap feedback before the reducer's post-deadline guard
resolves the round as a timeout, so a tap in the scheduling gap can sound
correct while scoring a timeout. Fixing requires exposing the resolution
instant to the screen layer without duplicating timing logic.
- **Vigilance digit visible after resolution (Low):** `attention-sustained-vigilance`
keeps the digit on screen after a trial resolves despite the feedback comment;
cosmetic display-only gap.
- **Missing vigilance screen test (Low):** `attention-sustained-vigilance` has no
screen-level test file (timer/ref behavior covered indirectly through the
reducer and shared hooks); add parity coverage in a maintenance pass.
- **Stale tutorial copy — `language-word-scramble` (Low):** the tutorial claims
bonus points for speed and expiring rounds, but the game is intentionally
untimed. Copy fix, not behavior fix.
- **Dead actions — `flexibility-color-stroop` (Low):** `show-stimulus` /
`show-flip-cue` actions are declared and handled but never dispatched, and the
latter is unguarded; remove or wire them in an identity-aware cleanup.
- **`speed-color-match` persisted `Infinity` (Low):** an all-timeout session
serializes `fastestReactionMs` as JSON `null` while the raw type says `number`;
the rating metric extraction coalesces it today, but the persisted value should
be `null`-typed explicitly.
- **Headless screenshot/responsive limitation (operational):** with
`emulator -no-window`, `screencap` returns a constant blank frame and runtime
`wm size` switching wedges the ATD renderer. Runtime visual/screenshot and
profile-switch evidence require a windowed or GPU-host emulator session.

## Operational recommendation (owner-side, not a product blocker)

- **`main` branch protection not configured:** observed 2026-09-05/06 — the
  GitHub repository has no branch-protection rules and no required status
  checks on `main`, so direct pushes can bypass CI. Recommended: protect
  `main` and require the four release checks. Repository-administration
  changes require explicit owner authorization; not executed autonomously.

## Evidence location

Exact Campaign 022 artifact hashes, 42/42 certify evidence, Workout/lifecycle/SQLite/backup/offline/security evidence, platform classifications, workflow run IDs, and prior campaign history remain in `.agent/VALIDATION.md` and the OpenSpec packet. Historical blockers and earlier campaign limitations remain available in Git history; this living file intentionally contains only the current actionable truth.
