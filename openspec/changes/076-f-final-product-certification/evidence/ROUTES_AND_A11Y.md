# Routes, accessibility and layout — 076-f

**Change:** `076-f-final-product-certification`
**Tasks:** 5.1 (preserve the route matrix), 5.2 (accessibility/layout coverage),
5.3 (parent task 14.3)

## 5.1 The reviewed 90/90 route matrix is PRESERVED, not regenerated

Task 5.1 says to preserve the reviewed matrix "unless a relevant source change
invalidates a surface" and to "recapture only the affected combinations".

Measured in [`SOURCE_EQUIVALENCE.md`](SOURCE_EQUIVALENCE.md): since the terminal
application source `c324960`, **no application, build-input, or script source
has changed at all** — every commit after it is evidence, planning, and
documentation. The matrix was captured *from* `c324960`/`de6c5fcd…`, so there is
no intervening change that could invalidate any of its surfaces.

| Evidence | Count | Identity | Status |
| --- | --- | --- | --- |
| Route pairs `final-matrix-de6c5fcd/` | 90/90 | `de6c5fcd…` / `c324960…` | **PRESERVED** — 3 profiles (default, compact, fs2/2×) × 2 themes × 15 surfaces |
| Results-scroll pairs `final-scroll-de6c5fcd/` | 2/2 | `de6c5fcd…` / `c324960…` | **PRESERVED** |

Repeating the matrix would be redundant work, and the change design explicitly
rejects that. **Combinations requiring recapture: none.**

Two independent properties keep this from being a stale claim:

1. The matrix rows carry their own `apkSha256` + `codeSha` per surface, so the
   binding is asserted per capture, not per folder.
2. `build-provenance.mjs` recomputes the source diff on every run; if a future
   commit touched a route surface, that run would stop reporting the clean
   dependency closure.

Note the boundary that the previous campaign lost: preserving the matrix is
possible *because* source equivalence holds. It does **not** convert those
frames into terminal-APK proof of gameplay, and it does not stand in for the
current-device game checks.

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

| Required condition | Status | Evidence |
| --- | --- | --- |
| default light | **COVERED** | 15 surfaces, 0 violations |
| default dark | **COVERED** | 15 surfaces, 0 violations |
| 2× text | **COVERED** | fs2 light + dark, 30 surfaces, 0 violations (incl. the reflowed Progress-detail badge) |
| compact viewport | **COVERED** | compact light + dark, 30 surfaces, 0 violations |
| normal/large viewport | **COVERED** | the default profile is the normal viewport (1080×2400 @ 420dpi); compact is the narrow case |
| reduced motion | **COVERED** | see below — 30 surfaces, 0 violations, 14 occluded excluded |
| representative gameplay, all eight domains | **IN PROGRESS / QUOTA-BLOCKED** | driven through the authorised controller under `current-device/` |
| actual game-control labels + 48dp floor | **IN PROGRESS / QUOTA-BLOCKED** | measured per game as its current-device row lands |
| occluded/unmeasured excluded from pass count | **ENFORCED** | 32 occluded nodes (routes) + 14 (reduced motion) enumerated and excluded |

The change design pre-declared this gap and forbids papering over it:

> **Scenario: Reduced motion is absent** — WHEN light, dark, compact, and
> enlarged-text route captures exist but reduced motion was not reviewed, THEN
> the accessibility and layout acceptance requirement remains incomplete.

### Reduced motion — COVERED

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

This closes the gap the change design pre-declared and forbade papering over:
the accessibility and layout acceptance requirement is no longer incomplete for
lack of reduced-motion review. What remains open is the **gameplay** half —
per-domain game-control labels and the 48dp floor measured on live game boards,
which needs the authorised controller and is quota-blocked.

## 5.3 Parent task 14.3

**NOT CHECKED.** The requirement is conjunctive — "only after every required
profile and gameplay condition is satisfied". Every **profile** condition is now
satisfied, including reduced motion (30 surfaces, 0 violations). What is still
outstanding is the **gameplay** half: representative gameplay from all eight
domains with actual game-control labels and the Android 48dp floor measured on
live game boards. That needs the authorised controller, which is quota-blocked
(see [`CONTROLLER.md`](CONTROLLER.md)). Checking `14.3` now would be exactly the
bulk-checking this change exists to prevent, so it stays unchecked and
`NOT VALIDATED`.
