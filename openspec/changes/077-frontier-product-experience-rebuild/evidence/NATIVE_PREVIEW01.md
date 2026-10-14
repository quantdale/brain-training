# Native preview 01 — evidence and critique boundary

This is an intermediate uncommitted UI snapshot, not Campaign077 certification.
Local artifacts are under qa-artifacts/campaign077/native-preview01/; ARTEMIS
trace files remain external under D:/Tools/artemis/traces/.

## Identity and preservation

- APK SHA256:8c312012ca91a91f1c6bd234464879b98a89d25454f8709d1f88e9ddc42dbf42;
  53,519,415B; packagecom.braintraining.app;version0.1.0/1000;x86_64/debug-signed.
- Build:532 tasks,8m39s; SDK57/JDK17; unchanged declared permissions.
- Source inventory:a63408057cb516275ec42fa55b19acc1f2661781c4dc2865a982ede236738af6,
  1103 inventoried app/assets/plugin/config files. It predates later paused
  continuation, Vigilance, cue-input and critique refinements.
- Install-r preserved SQLite; integrityok/sessions6. Persisted preferenceSystem
  is APK-bound by theme-witness.json. Requested/observed theme are recorded
  separately per frame using live Activity configuration, not screenshot color.
- Dedicatedbraintraining-ui35/emulator-5570 visible/not minimized in read-only
  Win32 witness; no mouse/keyboard/focus automation. Final witness still required.

## Captures and independent critique

routes-default/manifest.json:12/12 valid frames, six surfaces in both themes.
font2-diagnostic/manifest.json:10/10 valid frames, five surfaces in both themes.
routes-profiles/manifest.json:FAILED on firstcompact/light/Home frame, black strip
and clipped status icons; nineteen requested frames missing. Failed artifacts
are immutable. Density-only narrower profiles will be examined to isolate live
framebuffer resizing from actual app layout, without weakening the capture gate.

The independent read-only native_design_critique reviewed all12 default frames
and10 relevant baseline frames. Strengths: bundled type, coherent vector tabs,
clear Home action, purposeful Profile settings groups. Findings: library stills
retain heavy frames/tape/fake segmented progress; fresh details repeat three
empty reports; equipped names lack slot labels; recommendation rationale reads
like diagnostics. Lead review also found four equally primary claim buttons,
long Home support copy and large-font detail clipping risks.

Current source refines these: remove framing/tape/fake bars; one honest first-run
state; human practice rationale; labeled Frame/Color/Effect; one primary Claimall
with secondary individual claims; one inbox preview; shorter Home copy; essential
detail title wrapping; alpha-bound artwork normalization and compact reflow.
These corrections still need current-source native review.

BaselineHome was completed on a different local day/state from previewHome.
The reviewer can compare visual hierarchy, but those images are not state-matched
before/after acceptance. CoordinateTurn detail lacks a baseline comparator in
the default matrix. Neither missing comparison is fabricated.

## Runtime scope

Flashaab0e61b-d88a-42a3-bae9-f8af1a9c0f41 completed261.3s/12steps. Lead inspected
summary and step12 image. Navigation reached Games and Profile Appearance/System;
returned Home shows active tab and Startworkout. Screenshot is mid-scroll, with
hero heading above viewport. No gameplay/settings/reward/data mutation was asked
or observed. Provider access works; this is a navigation/reachability smoke only.

Full game journeys, current-source profiles/assets, data/recovery/offline/perf,
final build/clean checkout/four exact-SHA CI and final visibleHome remain OPEN.
PHYSICAL_ANDROID=NOT VALIDATED;IOS_RUNTIME=NOT VALIDATED;store signingNOT READY.

## Narrower diagnostic followup

compact320-diagnostic/manifest.json:1/1 Home capture PASS. Live Activityw320dp,
h711dp,540dpi; lead inspected image and intact system icons. Density-only change
avoids framebuffer resize; this supports, but does not prove, a compositor cause
for the earlier failed chrome. Original FAILED manifest stays unchanged. The
wrapped CTA sublabel reaches the curved face edge: root will add explicit shared
vertical padding and verify current-source320dp/2x images. Full matrix stays OPEN.
