# Native07 — reviewed corrections and remaining certification

Current product source `d62bbfc75cc7eb8ba2fabdf31a43666ef91bdcd8`.
Campaign077 remains ACTIVE. No full current-profile/runtime/ending-SHA acceptance
is inferred from the following source/build and bounded native results.

## Build, install and data

Gradle532tasks PASS5m11s (24executed/508up-to-date),2480 Metro modules. Exact
committed snapshot1107files, inventory
`da77641abecdac62a481bd3a6994fff9fc960be979500cdfea2adf886aceebab`, zero differences.
Preparation completed before starting Gradle. Source map941 own files/all4 changed
production files exactly match committed source; packaged Hermes bundle equals
generated bundle. Bundle SHA256
`6898d4f6c37fa34018246fc25e1d86eead79e03f1981806c207460bec5077a02`.

APK `f1a7d86fcc1920c5d14b9e61684f4a6919a697ca9b068232baadcb4255ac6347`,
52,312,459B; com.braintraining.app0.1.0/1000,x86_64/debug-signed,target36.
Eight permissions match prior allowlist. Install-r SUCCESS/device hash match;
exact SQLite db/wal/shm bytes unchanged across install. Separate verification
copy integrityok/eight sessions; settingsSHAa50813e8...ec9 unchanged. Oct15active
workout0/4 and Oct14active/index2 retained. No gameplay/restore write is inferred.
Local immutable identity/APK/map/permissions/before-after data and theme witness:
`qa-artifacts/campaign077/native-preview07/`.

## Native heading proof and capture correction

The first bracketed focused14-frame run FAILED after Home/Games when Profile
remained loading during the old three-attempt budget. It correctly retained a
failed manifest and no nonexistent PNG hash, rather than qualifying loading.
The loading route was also cold-restarted too early, restarting its reads.
The harness now polls observed settled state under a90sec deadline, avoids cold
restart while a loading marker exists, still requires exact before/after XML
equality, and aborts honestly at its deadline.11 capture/theme tests PASS. This
changes readiness waiting, not acceptance thresholds; original failed run stays.

The new focused run completed14/14 under `focused-font2-readiness02`. Root actually
viewed every frame:Home/Games/Profile/Progress/Activity/Data/Results in both
light and dark2x. They show retained data and
reachable Home/workout CTA; Profile preferences require scrolling. Shared
headings render complete g/y descenders. Original pixel probes now PASS on Games
"Suggested next", Activity "Training days" and title "Activity", with blank ink
margin below the glyphs rather than an abrupt cutoff at the text-box edge.
This accepts the specific reviewed2x heading appearances, not the missing full
profile matrix. Backup automatic-name/storage explanation now wraps visibly in
both themes; its last line/Export require scrolling at2x. No hidden-action PASS
is inferred from the first viewport. Results remain honest0%/Keep training with
reachable replay; Profile identity and System preference are visible. No newP1/P2
found in these14 images. Exact before/after XML hashes, every PNG/XML hash and
requested/observed theme checked; manifest SHA256
`19808be25dc36db2aba5a362b759d5cf216e7b2e89fb0cd06069acdf9b9bc266`.

Pro data07 `51d82686-3931-4f8e-ba80-6ecac2ce6839` is RUNNING with officialMCP
40sec monitor. Checker deliberately OFF after the previous inconclusive checker
timeouts; no automatic assertion PASS is claimed. Root independently viewed
step3 actual screenshot: campaign077-data-proof is now readable on one fullwidth
row and all three actions below it are legible/reachable; the long auto filename
wraps to two lines. The wrapping backup hint is also visible. Successful writes,
text-edit invalidation and post-task database proof remain OPEN until observed.

## CI canary recovery

AppCI38709536007 at d62bbfc7 FAILED one suite/five tests: five canary snapshots
contain one additional inactive false style entry per ThemedText after the new
conditional native metrics slot. All differences were inspected:46 inserted
`false` entries, no altered visual value. Local unchanged canary5/5 fail likewise.
Expected snapshots updated intentionally; canary5/5 PASS, then unchanged verify
5/5 PASS. No production/source condition was weakened. CI reports701suites7912
tests passed/five failed; this is not full green. Existing iOS38709536019 and
Integrity38709536048 SUCCESS; Android38709536099 was still running at last poll.
New ending-SHA four-workflow proof remains required.

The actual independent d62bbfc7 clean-checkout composite is RUNNING. It uses the
committed old canaries and is expected to retain the same five failures; do not
edit its checkout during execution or report it as successful. A subsequent
committed snapshot correction needs an actual unflagged composite run.

## Quiet launch and performance observations

First post-install cold draw10681ms. After build terminal with no npm/Jest/lint/
export/capture/controller running, planned repeat cold draws5425/3715/3258ms;
each retained186XP/49coins and reached loaded Home. First observed loaded-data
times22496/18217/18204ms include repeated uiautomator dump latency and screenshot
collection; they are upper observation bounds, not exact data-ready timing.
The host's totalCPU sample just before collection was1percent. No network or
settings changes. Native log has no observed FATAL EXCEPTION/ANR/OOM, but does
contain skipped-frame/HWUI long-frame diagnostics.

One final-process sample: totalPSS149372KiB/RSS262228KiB. This is a point sample,
not a leak test. Gfxinfo64 launch/Home frames,60janky (93.75%),median150ms,
p90=250ms. These substantial startup/jank observations remain unresolved, not
performance PASS. Uiautomator/launch sampling and virtual GPU timing need bounded
controls and actual interaction evidence; unsupported GPU histogram buckets must
not be read as physical GPU performance. AVD config has4cores/2GiB/hostGPU/60Hz,
1080×2400; no unrelated emulator was touched. Local `startup-repeat/` retains all
three cold logs/screens/hierarchies,meminfo,gfxinfo,app logcat and context.

## Later bounded warm controls

After Data07 ended,12 navigation observations ran with no build/Jest/lint/export
or ARTEMIS task active. Each reset gfx stats, navigated normally, observed10s
without any screenshot/hierarchy capture inside that window, then preserved
gfx and a route-qualifying hierarchy. All12 observed their intended route and
have no loading/skeleton IDs after the window. Six normal-motion observations
contain119frames/108janky; six reduced-motion observations60frames/59janky.
Per-window medians range129–450ms. These are poor measured navigation results,
not a60fps acceptance or an actual-gameplay latency measurement.

Host CPU points ranged41–100percent, with unrelated host processes active.
No unrelated process was stopped. Reduced-motion host load differed from normal,
so this does not isolate animation as a cause. WHPX reports installed/usable;
actual SurfaceFlinger GLES identifies NVIDIA RTX4050 hardware translation.
Read-only Win32 verification confirms this emulator visible/not minimized.
These diagnostics rule out those particular fallback/minimized explanations;
they do not establish why frames are slow or make them acceptable.

Memory after the normal route sequence: PSS224102KiB/RSS339656KiB; after reduced:
PSS245392KiB/RSS362200KiB. These two points are not a leak test. Motion scale
was restored exactly1→0→1. Local `native-preview07/warm-render-control/` and
`native07-warm-rendering-control.log` preserve all samples/host points/XML.
Performance remains UNRESOLVED pending current-build comparison and a valid
lower-contention control. [RUNTIME_DATA07.md](RUNTIME_DATA07.md) separately
supersedes the old open Merge/Replace/text-edit acceptance below.

## Still required

Full current-source profiles/independent critique and gallery, all-domain artwork
detail checks, normal-UI Merge/Replace/text-edit proof, selective compact/2x
tutorial risks, full current-day workout/continuation/restart/offline gameplay,
quiet interaction/performance controls, final clean checkout/four-workflowCI and
visible Home handoff. PHYSICAL_ANDROID/IOS_RUNTIME NOT VALIDATED; ARM64 unproven;
store signing NOT READY; owner review remains personal.
