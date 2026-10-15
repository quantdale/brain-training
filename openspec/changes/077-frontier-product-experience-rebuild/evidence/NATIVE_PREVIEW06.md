# Native preview06 — final source convergence

Source `afabda3a74201d3bbd7da22da9d0ecbf99bf7878`; this checkpoint is not a
claim that Campaign077 is complete. Device/runtime/profile acceptance remains
separate from source and build certification.

## Installed identity and preservation

- Dedicated visible AVD braintraining-ui35 / emulator-5570. No host input or
  focus automation; the capture process owns this device until terminal.
- Exact committed app snapshot:1107 files, zero source differences, inventory
  SHA256 `9c920440a6ac82cfe3837de08b1d610d847c9859b6884fb56f6efdbdc72c9188`.
- Gradle release build PASS,532 tasks,2m36s,2480 Metro modules. APK
  `079b7e520e347c9856e40082177505da742ee27948527abccf4ebdca6d05ffad`,
  52,309,219 bytes; com.braintraining.app0.1.0/1000,x86_64,debug-signed,target36.
  All eight packaged permissions match the existing allowlist.
- Install-r SUCCESS and device APK hash match. Exact SQLite db/wal/shm bytes
  unchanged across installation. Separate verification copy integrityok,8 saved
  sessions. System appearance preference/settings SHA retained:
  `a50813e8b2f4cf43007e4974865a96f85f080e8db3b32d006edee347b9cc2ec9`.
- Initial cold launch TotalTime6668ms/WaitTime6734ms during certification/web
  load. This is an observation, NOT quiet performance acceptance.

Local immutable evidence is under `qa-artifacts/campaign077/native-preview06/`:
source/build identity, APK, permissions/badging, exact before/after SQLite files,
working verification copies, preservation JSON, cold launch and theme witness.
External ARTEMIS traces remain external and are not copied into Git.

## Build-source and packaged-asset corroboration

Gradle preflight began while the final snapshot was being copied. Metro ran
after snapshot completion. To establish actual packaged source rather than
infer it from the build command, root checked the generated source map against
committed bytes:941 mapped own source files match, all56 changed production files
are present and identical, zero differences/missing changed files. One virtual
require.context router module was initially misclassified as a disk file; the
corrected probe explicitly classifies that generated module, excluding no
production file. Initial probe failure is not relabeled PASS.

Snapshot completed06:55:25UTC; source map generated06:57:44UTC. Packaged Hermes
bundle equals the generated bundle byte for byte. Bundle SHA256
`d627fe1487479762830bac77f640a36888d764644f781332327bb6674b35d87e`;
map SHA256 `31418a54659801438ab1a2e36fd4b75393c0e614763fc495350edc0f9e8c438e`.
See local `bundle-source-proof.json`.

All nine512px illustrations are pixel-identical inside the APK after AAPT
resource renaming; all three Manrope fonts are byte-identical. Combined decoded
RGBA footprint if all nine illustrations were resident is9,437,184 bytes. This
is a static footprint, not measured process memory. Brand density variants are
separate. The initial asset helper used a nonexistent font metadata field and
was corrected before the passing inspection. See `packaged-asset-proof.json`.

## Actual independent clean checkout

`D:/bt077-cert-afabda3a` is an independent --no-hardlinks clone with full main
history and canonical origin, clean before execution, no inherited dependencies
or native folders. It ran the unflagged command:

`node scripts/certification/certify-clean-checkout.mjs`

Result PASS/exit0, including fresh npmci, real non-HEAD parent provenance,
registry/ownership/repo-state, strict OpenSpec62 items, offline/secrets/runtime-QA,
workflow/affected-map, dependency audit, Expo alignment, TypeScript, full-source
lint, web export22 routes, full Jest and skip classifier. Tracked mutation after
the full run PASS. Jest702 suites/7903 tests/5 snapshots PASS,382.226s;4 skipped
suites/5 explicitly reviewed opt-in tests, zero failed tests/suites. These counts
include the final inline-data feedback correction. No worker forced-exit warning
was observed in this log; the older04 warning remains unidentified.

Preserved log `qa-artifacts/campaign077/clean-checkout-afabda3a.log`, identity
JSON alongside it, and copied summary `clean-checkout-afabda3a-jest-summary.json`
SHA256 `d81ef4c6c3414129f8dcf1d5c3724a69ce91927b097932b9ae4a389d27b93f31`.
The log retains npm deprecations, Expo CLI forced-exit housekeeping and the final
NodeDEP0190 shell warning. npmci's mixed dependency report is not a claim of zero
advisories: the production audit retains10 accepted advisories with no new
unallowlisted moderate+ production finding. This is actual certification,
distinct from the composite self-test. It does not prove native gameplay.

## Profiles and remaining runtime work

The180-frame matrix completed its structural gate180/180:18 surfaces×two directly witnessed themes×five
profiles (default411dp,compact320dp,font2,expanded720dp,reduced motion). Actual
review rejects identified frames; structural completion is not visual acceptance.
Density-only compact/larger provisioning avoids the old
framebuffer resize failure. Baseline compact360dp/larger800dp are responsive-family
comparisons, not pixel-matched pairs. Baseline six/current eight sessions and
baseline completed4/4/current new-day0/4 are explicitly different states.

Independent actual-image review has rejected several entries despite the old
structural gate: expanded/light Home is loading and Games displays Home;
font2/dark Home and Profile are loading; expanded/dark Home is splash and Games
shows fallback recommendations; reduced-motion/dark Home is loading. Preserve
these originals. The old harness took PNG before a slower hierarchy dump and
therefore could validate later state against earlier pixels. A bounded repair
now checks a settled hierarchy before PNG and an exactly equal hierarchy after,
records both hashes, and rejects loading markers. Two tests fail on the old
order;11 capture/theme tests now PASS. Independent read-only review caught missing
PNG hashing and unequal bracket-hash acceptance in the first implementation;
both corrected before a new capture. Original180 cannot be accepted from its
structural result alone. Current process uses the old loaded harness.

Actual review also found fourP2 families: Android2x heading descenders clipped,
automatic backup naming disclosed only in a truncated placeholder, saved backup
filenames squeezed beside three actions, and a no-response mean timing displayed
as0ms performance. Next source repairs are implemented; native07 proof remains
required. Two real heading caller regressions failed before,18 after PASS; two
data layout checks failed before,49 after PASS; two metric adapter/domain caller
checks failed before, full analytics/repository9 suites174 tests after PASS.
Reaction JSON1 projection and full-blob extraction now both skip nonpositive
samples before choosing a real fallback, without changing persisted history,
scoring or generation. The metric diagnostic's first redirected path and its
runInBand/maxWorkers command were invalid; a later attempted red run overlapped
the edit and passed, so only the isolated terminal red04 failures count as
fail-before evidence. No earlier attempt is relabeled a valid red regression.

Focused normal-UI Merge/Replace write and text-change invalidation, tutorial
compact/2x risk checks, current-day full workout/offline gameplay, quiet startup/
memory/frame/logcat, ending-SHA four-workflow CI and visible Home handoff remain
OPEN. Physical Android/iOS runtime NOT VALIDATED; ARM64 unproven; store signing
NOT READY; owner taste approval awaits personal review.

At this source all four GitHub workflows SUCCESS: App38695294948, Repository
Integrity38695294961, Android38695294918, iOS38695294897. These certify afabda3a,
not the eventual ending commit or subsequent visual corrections.
