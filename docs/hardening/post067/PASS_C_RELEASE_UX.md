# Post-067 hardening — Pass C (release / UX / a11y / hostile sequences / production gaps)

**Method:** independent read-only critic against the certified tree plus
re-derivation of the 067 a11y evidence from the archived raw dumps.

## Fixed

| Finding | Severity | Fix | Proof |
|---|---|---|---|
| Progress period tabs were TRUE 32 dp targets (initially misclassified as hit-slop-compliant) | Medium | compact segmented-control option raised to `MinTouchTarget` 44 dp; layout assertion pins it | **device proof** on the hardening artifact: fresh Progress capture + audit → 0 violations |
| `a11y-audit.mjs` misclassified controls occluded by the bottom tab bar as `target<44dp` (`viewportBottom()` had no ScrollView fallback) | Medium (evidence integrity) | viewport falls back to the dump's screen extent; pinned/overlay nodes become `occluded`, excluded from violations and reported separately; the 067 classification was corrected in the evidence | audit re-runs: Button controls move to `occluded`; only the (pre-fix) tabs remained |
| `DifficultySelector` announced a radiogroup of `button` children | Low | children now `accessibilityRole="radio"` (additive passthrough); a11y test | `difficulty-selector.a11y.test.tsx` |
| `attention-target-count` grid cells exposed unlabeled `role=image` | Low | non-interactive cells `accessible={false}`; interactive cells labelled | `grid.test.tsx` (both states) |
| 067 crafted-import UI lane explanation was wrong ("harness limitation") | Low (evidence) | corrected: "Replace Import" is a two-tap `ConfirmButton` (arm + confirm within 4 s); the shell sequence did not re-arm. Human/ARTEMIS journey remains the closure step | `LIFECYCLE_AND_PROVIDER.md`, terminal ledger |

## Verified clean

Hostile sequences: airplane-mode mid-write (no network primitives at
all); import during an active session (idempotent, `workoutChanged`
emitted); destructive double-taps (ConfirmButton + busy guards);
toasts auto-dismiss and are bounded; dev-only controls gated; overlays
cannot be bypassed by deep links; first-run empty states exist; version/
schema metadata consistent.

## Not reproduced / deferred

`A11yDialog` height strategy (exported but unused — no live path);
landscape/RTL/long-string captures (accepted debt, census C3–C5);
42-game six-way interaction expansion (accepted debt, census C2);
human TalkBack/VoiceOver, iOS, physical devices, store signing,
external CI/account policy (MANUAL/EXTERNAL).
