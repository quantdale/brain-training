# Tutorial blocks Start — focused repair

Starting point: clean `main` / `origin/main` at `41b0777fad595b0b6cc87a3b51c4609a241fa372`.
This is a bounded defect repair; Campaign 078 stays closed and no new campaign is activated.

## Cause and scope

All 42 game screens use `GameHost` and all 42 tutorials use `TutorialFrame`.
The host absolutely positioned the tutorial over the introduction inside
`ScreenShell`'s scrolling content. The overlay contributed no content height;
the underlying introduction determined the scroll range. The frame combined
`maxHeight: '100%'` with clipped overflow. A taller teaching step could therefore
lose its final controls without adding any reachable scroll area. The background
Start remained painted, enabled and present in the native hierarchy; hiding its
accessibility descendants did not establish touch isolation. Per-game Start
guards differed, making that covered action unreliable as well as misleading.

On the installed baseline at 840×1400px / 420dpi (320×533dp), font scale 2,
Deduction Table's demo displayed a sliver of Start below its last choice. After
an ordinary wrong `water` answer, two additional upward swipes still did not
expose `Try again`. The original PNG and hierarchy are retained here. The
hierarchy lists a clickable enabled Start at `[87,1135][753,1282]`, underneath
the visible tutorial. Earlier Equation Builder initially obscured controls but
could recover by scrolling; that run is **not** evidence of a permanent trap.

## Implementation

- `GameHost` renders the tutorial **instead of** introduction controls while it
  is open, in the normal route scroll flow. A short step retains bottom alignment;
  a long step increases scrollable page height. Existing completion callbacks
  unmount the tutorial and restore the normal introduction and Start.
- `TutorialFrame` removes the percentage height cap. Its existing card, accent,
  typography, children and overflow used to clip the accent rail stay intact.
- Grid Navigator and Transform Match retain their bounded inner ScrollViews,
  including Campaign 077's `nestedScrollEnabled` repair. No game-specific
  mechanics, content, routes, persistence, scoring or buttons change.
- Safe-area handling remains in the existing route `ScreenShell`. No modal,
  animation gate, generic QA skip, global z-index or hardcoded footer is added.
- The affected-area validator and its documentation now include shared
  `components/game-ui/**` in the existing visual-layer rule. The initial strict
  path check exposed this missing classification; the synchronized 56-pattern
  map, 16 validator self-tests and strict classification of both changed
  production files pass.

## Regression checks

New `tutorial-start-flow.test.tsx`: 16 combinations of default/compact viewport,
font 1/2, light/dark and normal/reduced motion. Real Order Path, ScreenShell,
settings and motion hooks exercise first play and replay, ordinary tutorial
completion, enabled Start, active round and a legal playable move. Two additional
guards reject an absolute tutorial ancestor and an intrinsic percentage cap.
The original source fails all 18 checks. The updated long-content frame test
also fails on the old cap; both existing nested-scroll controls pass unchanged.
These are interaction/wiring guards; RNTL does not prove Yoga/native touch geometry.

Full Jest: **709 suites / 7,998 tests / five snapshots passed**, five existing
classified opt-in skips; no failed tests or snapshot updates. TypeScript and
full lint passed. Strict OpenSpec **63/63**; registry, real-base provenance,
ownership, repo state, offline boundary, runtime-QA contract, secrets, workflows,
affected-area map, Expo alignment, clean-checkout validator self-test, web export
and dependency audit passed. Audit retains ten reviewed advisories. The self-test
is not a new independent clean-checkout certification.

Initial test fixture captions and required persistence-result properties were
corrected before the final full-source run. The first build invocation used an
incorrect copy working directory and was cancelled before compilation; the
second build uses the verified current production inputs. Initial proof scripts
needed explicit UTF-8 and code-source filtering; only the corrected checks count.

## Android identity and preservation

Accepted local release build: **576 tasks, 10m48s**, x86_64/debug signing.
APK: `apps/mobile/qa-artifacts/tutorial-start-fix/brain-training-tutorial-fix.apk`,
52,733,916 bytes. SHA-256:
`319a89f703e10d813632340b807ca29d5bd3305cf1b6dd39059fb69b77221a4b`.
The installed APK has the same hash. All 1,162 non-test tracked app inputs match
the build directory; 942 own code sources in the generated source map match,
including both changed production files.

Installation used a verified complete device transfer and `pm install -r`.
Protected SQLite db/wal/shm files were retained before installation and remained
byte-identical afterward. Verification copies pass integrity_check; all 13 tables
and **18 saved sessions** match. No clearing, fixture injection or restore occurs.
Original emulator: visible `braintraining-ui35`, port 5570, process 108764;
840×1400 override, 420dpi, font2, light, animation scale1. Other device untouched.

## Runtime and delivery

After installation, Pro `6e9d0491-aabc-41e6-870e-809fed7b7a35` reached an ordinary
wrong answer, Retry, a fresh solved demo and the completion card. Its plan ledger
ended the run early; its terminal COMPLETED status does not qualify the omitted
Start/gameplay steps. Its first Retry tap was at a partly visible bottom edge;
that frame alone is not accepted as full-button visibility evidence.
Flash `f848789c-2363-4fed-9fc8-c38ba3e532c6` then tapped Got it, scrolled to the
fully visible Start, pressed it and reached the active deduction board. Ordinary
Android Back paused it; `0295e368-d346-42d7-8da3-93d71ab32ed5` used normal Quit to
discard the unsaved game. Selected originals: [completion](after-completion.png),
[unobstructed Start](after-start.jpg), [active board](after-gameplay.jpg).

Order Path qualifies all eight viewport/font/theme combinations
through actual tutorial completion and visible enabled Start. Root inspected
the actual tutorial and post-completion images, not just automation summaries.
The first compact/font2/light attempt incorrectly reported completion without
opening the tutorial; it is rejected. Separate short tasks and direct
[tutorial PNG](compact-font2-tutorial.png)/hierarchy qualified its real Got it
control and completion. The compact/font2/dark reduced-motion case also has
directly inspected tutorial and returned-Start originals. [NATIVE_MATRIX.json](NATIVE_MATRIX.json)
binds every profile to device settings, trace IDs, screenshot hashes and enabled
Start bounds. No native game was started in that matrix.

Grid Navigator Flash `0481e39e-6b93-40c9-80b6-04e0bd6dae77` completed the actual
demo at compact/font2/dark/reduced motion. Root inspected all four commands and
all three reachable [answer boards](grid-nested-choices.jpg), accepted normal
completion, Got it and the [returned Start](grid-start.png). Six inner drags
were used; the four-drag diagnostic limit was exceeded, so no four-swipe or
gesture-efficiency claim is made. Campaign 077's nested-scroll repair remains
intact. Transform Match's sibling nested-scroll guard also passes in source.

The final matched wrong-answer replay, Flash
`2988baee-23e3-4976-a423-030d64740ad7`, reached a fully visible, enabled Retry.
Root directly captured and inspected [the actual PNG](after-retry.png) and
[native hierarchy](after-retry.xml): Retry is `[105,1064][735,1201]` in the
840×1400 framebuffer, comfortably above the gesture bar. The tutorial is present;
the underlying Start is absent. Contrast with [the before PNG](before-deduction.png)
and [before hierarchy](before-deduction.xml), where Retry is missing and the
covered Start is still clickable. Wrong-direction automation swipes were corrected;
the accepted result is this final stable frame, not the earlier task's assertion.

Flash `79c35a31-0dd8-424b-840b-dd38c02e932a` then used ordinary Retry, answer
feedback, completion and Got it to return to the [stable introduction](after-final-start.png).
Root inspected the full enabled Start at `[87,984][753,1131]`; tutorial nodes
are absent. No real game was started in this final repetition.

Final [data comparison](DATA_PRESERVATION.json) passes integrity and preserves
all 18 sessions, currency, ratings, profile/settings and all five earlier workout
rows. Ten tables remain exactly unchanged. Existing 21 quest-progress rows are
identical; opening Home normally initialized six zero-progress daily/weekly rows
and one Oct19 workout at index0/4 (no skipped games). Only the three exercised
tutorials receive normal completion/replay metadata. The first overstrict
runtime assertion rejected these normal date-initialization additions; explicit
row-by-row superset verification establishes no earlier data was changed/lost.

Flash `1907b453-18ac-40fb-803f-6b24464f6366` visited Home → Progress → Profile →
Games. Root inspected actual route headings/selected tabs and loaded Progress;
Home/Profile still show loading skeletons in the brief transition frames. This
qualifies navigation only, not their complete data presentation.

This is the qualified delivery candidate. All four workflows must succeed at
the **actual ending commit** before delivery. A final post-CI native refresh
must confirm the same APK, visible running emulator and an unobstructed Deduction
Start with original display/font/theme/motion settings. Those post-commit facts
are written to local `apps/mobile/qa-artifacts/tutorial-start-fix/FINAL_DELIVERY.json`
and the final owner response; this pre-commit report does not infer their outcome.

Existing 2× category/kicker text is cramped in the unchanged introduction header;
it does not cover Start. This unrelated presentation issue is preserved.
External ARTEMIS traces stay outside Git. Raw local checks are under
`apps/mobile/qa-artifacts/tutorial-start-fix/`.
