# Routes, accessibility and layout — 076-f

**Change:** `076-f-final-product-certification`
**Tasks:** 5.1 (preserve the route matrix), 5.2 (accessibility/layout coverage),
5.3 (parent task 14.3)

## 5.1 The reviewed 90/90 route matrix is PRESERVED, not regenerated

Task 5.1 says to preserve the reviewed matrix "unless a relevant source change
invalidates a surface" and to "recapture only the affected combinations".

### What changed since the matrix was captured

The matrix was captured from `c324960` / `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d`.
Since then the 076-f defect repairs (`b293a02`) changed **two shared
gameplay-presentation files** and built a new terminal artifact
(`e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f`). An earlier
version of this section claimed that *no* application, build-input, or script
source had changed at all. That was false, and it is the reconciliation finding
that unchecked 076-f task 5.1's neighbours.

What is **not** invalidated, measured in
[`SOURCE_EQUIVALENCE.md`](SOURCE_EQUIVALENCE.md):

- `SessionHeader` renders only through `GameHost`, and **no route surface
  renders it** (`grep -rn SessionHeader apps/mobile/src` → only
  `components/game-host/game-host.tsx`).
- The only shared-primitive change that reaches route screens is
  `button.tsx`'s 4 dp hit-slop, which alters **no rendered pixel** — it widens
  the touch target. It therefore does not invalidate pixel stills or
  already-measured 48 dp bounds.
- The two route screens that were themselves edited (`app/(tabs)/index.tsx`,
  `app/progress-detail.tsx`) were edited **before** the matrix was captured, so
  the matrix already depicts them.

| Evidence | Count | Identity | Status |
| --- | --- | --- | --- |
| Route pairs `final-matrix-de6c5fcd/` | 90/90 | `de6c5fcd…` / `c324960…` | **PRESERVED** — 3 profiles (default, compact, fs2/2×) × 2 themes × 15 surfaces. `SOURCE_EQUIVALENT_HISTORICAL`, `currentApplicability: false` |
| Results-scroll pairs `final-scroll-de6c5fcd/` | 2/2 | `de6c5fcd…` / `c324960…` | **PRESERVED** — same classification |

**Combinations requiring recapture: none.** The hit-slop change does not move
or repaint anything, and no route renders `SessionHeader`.

Two independent properties keep this from being a stale claim:

1. The matrix rows carry their own `apkSha256` + `codeSha` per surface, so the
   binding is asserted per capture, not per folder.
2. `build-provenance.mjs` recomputes the surface diff on every run **and exits
   non-zero while the surface is dirty**; it records `render` and `input`
   effects per changed file, and a changed file with no recorded effect
   disqualifies every historical row.

**The boundary, stated in both directions:** preserving the matrix does **not**
convert those frames into terminal-APK captures. Every one of the 92 route rows
records `currentApplicability: false`, because `de6c5fcd…` is not the terminal
APK. The matrix is preserved as reviewed evidence *for the artifact that
produced it*; terminal-APK route proof is a separate, still-owed result. And the
route rows also carry `interactionClosureChanged: true`: tap-registration and
target-size claims drawn from `de6c5fcd…` were not re-measured on the terminal
artifact. Section 5.2 measures them there.

## 5.2 Accessibility and layout coverage

### What is already measured, and how it is counted

Six reproducible audits run over the filed unique hierarchy XMLs — one per
profile/theme — with `a11y-audit.mjs`:

| Audit | Density | Surfaces | Violations | Occluded (excluded) |
| --- | --- | --- | --- | --- |
| default-light | 420 | 15 | 0 | 6 |
| default-dark | 420 | 15 | 0 | 6 |
| compact-light | 320 | 15 | 0 | 5 |
| compact-dark | 320 | 15 | 0 | 5 |
| fs2-light (2× text) | 420 | 15 | 0 | 5 |
| fs2-dark (2× text) | 420 | 15 | 0 | 5 |
| **Total** | | **90** | **0** | **32** |

The 32 occluded nodes are **kept out of the pass count**, exactly as the
requirement demands. They are enumerated per node with an explicit reason —
`rail-edge (scroll-reachable)`, `tab-bar-overlay`, `screen-edge` — and are
classified as unmeasurable, not as passing targets. Examples: `All, 42` and
`Attention, 5` domain chips on the games rail, `Color Stroop, Flexibility game,
New` cards under the tab bar, `Buy Azure Ring for 150 coins` clipped at the
screen edge. Raw multi-window XML is preserved as `.windows.txt` so it cannot be
double-counted as a second surface.

Per surface the audits record `interactive`, `labelled`, `undersized[]`,
`unlabelled[]`, `occluded[]`. Every one of the 90 surfaces reports
`undersized: []` and `unlabelled: []` — i.e. every *measured* interactive node
meets the Android 48dp floor and carries a label.

**The scope limit is stated, not smoothed over:** these audits measure the
**route** components. Per the change spec, "Route audit does not certify game
controls" — game-control reachability, labels and target size are a separate
question and are answered in the table below as they are measured.

### Coverage against the requirement

Every condition below was measured on `de6c5fcd…`. **None** is measured on the
terminal artifact `e243341f…`.

| Required condition | Status | Evidence | Artifact |
| --- | --- | --- | --- |
| default light | **COVERED** | 15 surfaces, 0 violations | `de6c5fcd…` |
| default dark | **COVERED** | 15 surfaces, 0 violations | `de6c5fcd…` |
| 2× text | **COVERED** | fs2 light + dark, 30 surfaces, 0 violations (incl. the reflowed Progress-detail badge) | `de6c5fcd…` |
| compact viewport | **COVERED** | compact light + dark, 30 surfaces, 0 violations | `de6c5fcd…` |
| normal/large viewport | **COVERED** | the default profile is the normal viewport (1080×2400 @ 420dpi); compact is the narrow case | `de6c5fcd…` |
| reduced motion | **COVERED on `de6c5fcd…`** | see below — 30 surfaces, 0 violations, 14 occluded excluded | `de6c5fcd…` |
| representative gameplay, all eight domains | **NOT VALIDATED on the terminal APK** | driven through the authorised controller under `current-device/` | — |
| actual game-control labels + 48dp floor | **NOT VALIDATED on the terminal APK** | measured per game as its current-device row lands | — |
| occluded/unmeasured excluded from pass count | **ENFORCED** | 32 occluded nodes (routes) + 14 (reduced motion) enumerated and excluded | — |

The change design pre-declared this gap and forbids papering over it:

> **Scenario: Reduced motion is absent** — WHEN light, dark, compact, and
> enlarged-text route captures exist but reduced motion was not reviewed, THEN
> the accessibility and layout acceptance requirement remains incomplete.

### Reduced motion — COVERED on `de6c5fcd…`, NOT VALIDATED on the terminal APK

Reduced motion is OS-driven (`AccessibilityInfo.isReduceMotionEnabled()`, which
the app subscribes to once via a shared store in
`components/a11y/reduced-motion.ts` and which gates decorative motion to a
static fallback). It is therefore **verified by putting the device into
Android's "Remove animations" state and re-capturing/re-auditing**, not by
asserting that the code has a hook. That was done:

```bash
adb shell settings put global transition_animation_scale 0
adb shell settings put global window_animation_scale 0
adb shell settings put global animator_duration_scale 0
node scripts/qa/ui-capture.mjs --out qa-artifacts/cert076f-reduced-motion \
  --device emulator-5554 --profile default --theme light,dark   # 30/30 PASS
node scripts/qa/a11y-audit.mjs --dir …/default/{light,dark} --density 420
```

| Reduced-motion audit | Surfaces | Violations | Occluded (excluded) |
| --- | --- | --- | --- |
| default-light | 15 | **0** | 7 |
| default-dark | 15 | **0** | 7 |
| **Total** | **30** | **0** | **14** |

Artifacts: [`reduced-motion/captures.json`](reduced-motion/captures.json),
[`reduced-motion/default-light.json`](reduced-motion/default-light.json),
[`reduced-motion/default-dark.json`](reduced-motion/default-dark.json). The 14
occluded nodes are enumerated with reasons in those files and are **kept out of
the pass count**, exactly as the requirement demands.

**The 2026-10-09 reconciliation bound these captures to `de6c5fcd…`.**
`reduced-motion/captures.json` records that APK, so the 30 surfaces are valid
evidence **for that APK's route surfaces** and are not evidence for
`e243341f…`. They do not close 076-f task 5.2, which is why 5.2 stays open.
`game-intro` in that set renders `Button`, not `SessionHeader`, and no preserved
route surface renders `SessionHeader`, so **no route combination requires
recapture for reduced motion either**. The 4 dp hit slop does not by itself
invalidate pixel stills or already-measured 48 dp bounds.

Still outstanding for 5.2 on the terminal artifact: representative gameplay from
all eight domains with actual game-control labels and the Android 48dp floor
measured on live game boards.

## 5.3 Parent task 14.3

**NOT CHECKED.** The requirement is conjunctive — "only after every required
profile and gameplay condition is satisfied". Every **profile** condition is
satisfied **on `de6c5fcd…`**, including reduced motion (30 surfaces, 0
violations), but those captures are bound to `de6c5fcd…` and are not terminal-APK
evidence. What is still outstanding is the **gameplay** half: representative
gameplay from all eight domains with actual game-control labels and the Android
48dp floor measured on live game boards **on the terminal artifact**. Checking
`14.3` now would be exactly the bulk-checking this change exists to prevent, so
it stays unchecked and `NOT VALIDATED`.

**Note on the controller:** an earlier version of this file described the
gameplay half as "quota-blocked". That is historical — the controller is
operational on the owner-directed OpenDesign endpoint (see
[`CONTROLLER.md`](CONTROLLER.md)). The remaining work is repository-owned, not
externally blocked.
