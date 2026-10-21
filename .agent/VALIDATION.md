# Fresh-machine dev-environment qualification + Repository Integrity repair — 2026-10-21

Fresh Windows host, clean origin/main. ONBOARDING §6 baseline: typecheck
exit 0; full Jest 711 suites/711 passed (4 classified opt-in skips)/8,018
tests passed (5 classified skips)/5 snapshots PASS in 238.7s; expo lint
exit 0; generate-game-registry --check OK (fresh); validate-provenance
--check OK; validate-task-ownership OK; validate-offline --check CLEAN
(1,007 files). Network `npx expo-doctor` 20/21 exit 1 on upstream patch
drift only — classified advisory/upstream-drift in GOVERNANCE per Change
069; hermetic `scripts/validate-expo-alignment.mjs` PASS (22/22 aligned).
Declared Repository Integrity job mirrored locally: 18/18 steps PASS
(secrets 3,962 files CLEAN, workflows 44/44, affected-map sync 21 areas/
56 patterns + self-test 16/16, spec-store 140/140, offline 30/30,
dependency-audit 41/41 + gate PASS with documented accepted advisories,
expo-alignment 54/54, jest-signal, provenance 13/13, runtime-QA-contract
16/16, certify-clean-checkout 14/14, both allowlist freshness checks).
OpenSpec strict 203/203 PASS.

Regression found and repaired during setup: `node
scripts/validate-affected.mjs --self-test` rejected its own documented
flag (exit 2) — the F-6 unknown-flag fix in d26cd536 omitted --self-test
from the parse allowlist, reddening the Repository Integrity self-test
step on main at d26cd536 (run 39479920967) while the other three
workflows were green. Fix 2f18738f routes --self-test through the parse
loop. Post-fix contracts: self-test 16/16 exit 0 from repo root AND
apps/mobile (F-5), unknown flags still exit 2 (F-6), --check-sync/--help/
--list-areas exit 0, local job mirror 18/18. CI at 2f18738f: Repository
Integrity 39530950259 SUCCESS, App CI 39530950190 SUCCESS, Android Build
Smoke 39530950268 SUCCESS, iOS Build Smoke 39530950355 SUCCESS.

Toolchain qualification beyond the baseline: local clean native build
(`expo prebuild --platform android --clean` + `gradlew :app:assembleRelease
-PreactNativeArchitectures=x86_64`) BUILD SUCCESSFUL 9m17s/532 tasks;
APK 52,735,180B; `aapt2 dump permissions` matches
scripts/android/expected-apk-permissions.txt exactly (deny-by-default
gate). Emulator-local app smoke on braintraining-qa36: install/foreground/
screenshot/hierarchy/logcat 5/5 PASS (qa-artifacts/20261021-023751-app-
smoke; Home renders Today's Workout + profile state). ARTEMIS external
checkout D:\Tools\artemis (google/artemis 351ca84) `uv sync` OK; `artemis
doctor --json`: python_runtime/system_config/integration_host/android_adb/
toolchain PASS (FFmpeg + scrcpy installed via winget), vision_ocr_key
optional PASS. NOT VALIDATED / BLOCKED (user-owned, per ONBOARDING §1):
ARTEMIS provider credential (doctor gemini_api_key fail) — owner action
`$env:BT_NEW_KEY='<key>'; node scripts/qa/set-artemis-key.mjs`; physical
device/ARM64/iOS runtime remain the standing unvalidated limits.

# Explore-findings convergence — qualified, 2026-10-19

Bounded F-1..F-10 repair wave (docs/audits/openspec-explore-2026-10-19.md §5).
Per-fix evidence: F-1 `generate-spec-store.mjs --check` OK + openspec strict
203/203 (63 changes + 140 generated specs); F-2 `openspec list --json` 0/63
non-complete (006r 12.11 closed on public CI runs 114/117 `success` at
`69af63a6`); F-4 repo-state gate FAILed on the tracked dump before `git rm`
(negative proof) and `--self-test` 16/16; F-5/6/7 exit-code reproductions
(usage exit 2, script-relative root OK from apps/mobile); F-9/F-10 regression
suites green (progress 15/15; five fixed games 50 suites/569 tests; collectible
tile 3/3; button layout + kit contract 45/45). One obsolete word-match reducer
test that pinned the dead-Pause policy was rewritten to the corrected contract
with a dated rationale; one game-cover harness bound was raised 10 s to 60 s
after a load-only ETIMEDOUT was reproduced as a too-tight execFileSync bound
(the check itself is 2 s standalone and still fails hard on real drift).
Final matrix on the committed source: full Jest 711 suites (711 passed,
4 classified opt-in skips) / 8,018 tests (5 classified skips) / 5 snapshots
PASS in 311.7 s; `tsc --noEmit` exit 0; `expo lint` exit 0; web export
(22 routes) exit 0; `openspec validate --all --strict` 203/203; repo-state
(+16-case root-hygiene self-test), registry, spec-store, provenance,
ownership, offline, runtime-QA-contract, secrets, workflow hygiene,
affected-map sync, expo alignment, dependency audit, jest-signal and
certify-clean-checkout self-tests all PASS. F-11 boundaries remain NOT
VALIDATED, not claimed.

# Focused scale/responsive repair — qualified, 2026-10-19

Metadata3 valid before failures; short-tutorial alignment1 valid before failure.
Initial focused72PASS; final full710suites8002tests/five unchanged snapshots,
five existing classified opt-in skips/294.919s PASS. Global types/final types,
full lint, strict63, declared source/security/repo gates, web22 PASS. APK
10e7a10ea80c3a985d3bc67981b6f7df559ce3c00400caa255c20b182bab9dde,
52734320B,576tasks6m8s. All1162 production inputs/942 own mapped code/bundle/
expected8permissions verified. Update install exactSQLite3files/all13tables/
18sessions PASS. Compact320dp/font2 header Place reappears, title893→766px;
actual tutorial Gotit[105,1064][427,1201], underlyingStart absent. Seven native
profile pairs reviewed/default1,1.5,2/compact1,2/light,dark; Start56dp/difficulty
48–54.48dp. Normal tutorial y1573→199px/fullGotit/noStart→realRound1/5 PASS.
Grid all4commands/all3fullboards/normalcompletion; Transform inner scrolling/
correctselection/completion/fullStart PASS (not allfullcandidateboardsinoneframe).
Settled newAPK Home/Games/detail/Progress/Profile/oldResults normal UI reviewed.
Runtime integrityok/18sessions/all12nontutorialtables exact; onlytutorialmetadata
changes. Original external config byte-for-byte restored after live fallback;
credentials untouched. Visible5570 normal1080x2400/420/font1/day/allmotion1/intro
fullStart witnessed. Four sourceCI d11964ed SUCCESS; exact ending-SHA fourCI/live
refresh recorded post-commit in local FINAL_DELIVERY.json/final response.
Full bounded report under docs/bugfixes/ui-scaling; historical limits retained.

# Focused tutorial/Start repair — 2026-10-19

Original source: new18 interaction/scroll-ownership regressions allFAIL, plus
intrinsic-height guardFAIL/two nested-scroll controlsPASS. Final full-source
Jest709suites7998tests/five unchanged snapshotsPASS/504.652s; five existing
classified opt-in skips, zero failures. Global TypeScript02/full ESLint exit0.
Strict OpenSpec63/63, registry/real-base provenance/ownership/repo/offline1007/
runtimeQA/secrets/workflow4/affected-map/Expo23/self-test14/web22/dependencyaudit
PASS; ten accepted advisories remain. No independent fresh-checkout claim.
Native baseline Deduction at320dp/font2 shows coveredStart/clippedRetry after
2swipes. Actual after fullRetry[105,1064][735,1201]/normal completion/fullStart/
activeboard/Pause/Quit qualify repair; selected originals personally inspected.
OrderPath8/8 native viewport/font/theme cases, normal/reducedmotion and Grid
all4commands/all3choices/normalcompletion/returnedStart PASS; RNTL guards retain
both nested-scroll callers. Incorrect actor completion/partial-button frames
rejected; final accepted copies retained. Shell4tab navigation/headings PASS,
Home/Profile data still loading in brief captures; no fullleaf acceptance.
Build576tasks10m48s,1,162 inputs exact/942 mapped own code exact including both
changed files. APK319a89f7…221a4b/52,733,916B/devicehash/install-r/all3SQLite files/
all13tables exact at install. Runtime integrityok/18sessions/economy/profile/
ratings unchanged; all5oldworkouts/21oldquest-progress rows exact. Addonly normal
tutorial metadata, Oct19newactiveplan0/4 and6zero daily/weekly progress rows.
Impact map now56patterns: shared game-ui omission repaired, self-test16 and
strict two-production-file classification PASS. Full Jest predates this two-line
map addition; current final CI reruns the source gates. Final exact-SHA CI/live
handoff observed post-commit in local FINAL_DELIVERY.json and final response.
Full focused evidence: docs/bugfixes/tutorial-start/REPORT.md.

# Campaign078 — terminal candidate qualification

Source and native qualification complete; final exact-SHA workflows must all succeed before delivery. Whole Jest708passed suites7979passed tests/five snapshots/five classified skips PASS predates final sizing repair; current focused17tests/typecheck/lint PASS. Final AppCI runs full current source. Strict63OpenSpec/registry/provenance/ownership/repo/offline/secrets/runtimeQA/Expo/workflow/impact/web22routes/dependency gate PASS. Ten accepted production advisories remain.

Accepted APKfc2c99f7f4ffb668ed6ea9d79a5f91714e33178834b7bee6868360db045c605d /52733728B, production359a80be.989 mapped own sources/all42 packaged PNG decoded pixels match. NativeA clipping failure repaired/rebuilt; exact installed APK/same signing/permissions/protected SQLite PASS. Owner15sessions/all14tables exact/integrityok after runtime.

Root actual all42 light/dark review; sampled font2/320dp/320dp-dark-font2/548dp responsive frames; actual full-library recording; native ARTEMIS Memory details/introduction/return6actions PASS within checker-off/navigation-only scope. Offline COLD1348ms at12:06UTC records Wi-Fi0/mobile0/defaultnetworknone and traversal to list end. Prior partial ARTEMIS traversal/Probenchmark are not accepted. No full42 gameplay rerun.

Matched16gesture counters:266/650jank40.92%→255/66938.12%,p95113→101ms; legacy92.77→94.32%. PSS182247→208391KiB(+25.53MiB/+14.35%); settled206273. Texture cache110.02KB→40.41MB. Bounded emulator observations, not causal improvement/60FPS/physical/leak-free claims. Asset budget569529B/decoded26.25MiB; APKdelta+422249B,JSbundle−8416B.

Visible/unminimized5570/Games and original settings witnessed; post-CI refresh/clean-pushed-main/four exactSHA Actions IDs go in local FINAL_DELIVERY.json. Full evidence in078 FINAL_REPORT/NATIVE_VALIDATION/PERFORMANCE/OFFLINE_PROOF.077/076 historical records below remain unchanged.

# Terminal candidate qualification — Campaign077

NATIVE_VISUAL15:180actual originals/121staticPASS59P3/noP1P2/144independent+36root,
150genuine baseline pairs30unmatched/15independent direct pairs. RUNTIME_FINAL15:
matched normal/reduced filter taskCOMPLETED315.2s, actual device clips/frames,
six warm windows106frames91janky/host38-74%, three PSS points/scoped logs. Poor
jank, encoded distortion and historical ANRs retained; no60fps/leak/physical
latency claim. All13 tables exact afterGrid throughfinal runtime, integrityok/
13sessions28668/settings/olderworkouts intact. Necessary returnCOLD1703ms.
LIVE_HANDOFF15:06:23:42UTC actual visible/unminimized5570/currentAPK/foreground
Home/original PNG0f92e763...8012f/equalXMLb8c50c08...718c personally viewed,
all original display/theme/motion/rotation/network restored. Ending candidate
is integrated into main only after exact-SHA four CI success; final delivery/
Actions metadata supplies SHA/run IDs and clean/pushed/no-temp-branch proof.

# Current qualification — native15/source9e5b, 2026-10-18 PH

Actual independent732-commit/no-hardlinks fresh checkout/fresh npm ci/full
unflagged certify-clean-checkout exits0/PASS.708suites7981tests/five unchanged
snapshots,362.801s; four suites/five classified opt-in skips, zero failures;
no current Jest worker forced-exit warning. All declared gates and independent
tracked/untracked Git cleanliness PASS. SummarySHA256
1173a12f337c4da1e18d655208422e5c7f5ef85bbae609151cac672c9a6e410c;
logSHA2567edc2bbb8d78c2616c61d6a6e73fc9120f617f6f08a1a8133b670dcc2ff4e7b7.
All four sourceCI SUCCESS39087739520/39087739481/39087739454/39087739469.
Native15 build/install/source/assets/permissions/devicehash/exact SQLite PASS;
firstCOLD1797ms/settled offlineHome and actual same320dp/font2 Grid normal
scroll/completion/visibleStart/Home qualify bounded native-after. Only normal
tutorial metadata changes,13sessions/economy/oldworkouts/settings retained.
NATIVE_PREVIEW15/TUTORIAL_SCROLL_RECOVERY15 contain identities/originals/limits.
Final current180 matrix/critique/motion/perf/endingCI/livehandoff remain OPEN.

## Historical chronological records below

Earlier live/pending statements describe their dated checkpoints; current state
is above and in STATE/tasks/FINAL_REPORT. They do not override later terminal proof.

# Validation — Campaign077

## Native15 Grid repair and initial runtime — 2026-10-18 PH

Source9e5b2a1b/APK8919b11b...b6502/52,311,479B exact build/map/assets/permissions/
install/deviceSHA/three protectedfiles PASS; firstCOLD1797ms/defaultHome viewed.
Same320dp/font2/offline Proe36e terminalCOMPLETED356.3s, checkerOFF. Root views
original afterswipes/all4commands/all3choices/acceptedcompletion/Gotitdismissal/
visibleunpressedStart/Home; independentb97a5849...a7b582 boundedPASS. Root posttask
Home6c0dd37f...bef7b/equalXML942558e0...195be/currentAPKfocus; copiedSQLite
d5364b06...30d34 integrityok/13sessions28668/12tablesexact/onlyGrid normaltutorial
completionmetadata. Originaldensity420/font1 restored. Externalvideo0images/
0steps is not qualified; originals provideproof. NATIVE_PREVIEW15.md.
Final180matrix exclusive5570 exec34154 and fullfreshsource composite35659 LIVE;
no outcomes inferred, timing measurements waitforappropriateidleconditions.

## Native14 tutorial reachability failure — 2026-10-18 PH

Offline Pro3ca1611c at combined320dp/font2 reaches actual Grid replay Demo,
but four in-sheet swipes leave clipped commands and unreachable choices.
Root personally views original step22. This branch FAILS reachability;
viewport-height assertions are insufficient. Transform Match's shorter demo
completes through ordinary visible choice/Got it to Start, never pressed;
root views step35 candidate original. Terminal task/data/restore checks pending.
Installed-Yoga geometry-only long-content probe yields positive scroll ranges;
native gesture negotiation repair and same-profile new-APK proof remain OPEN.
All four29d70a45 CI SUCCESS; these do not qualify the new repair.

## Native14 actual input/feedback and history — 2026-10-18 PH

Root personallyviews3originalPNGs and actualfeedback/Pause/Home; independent
feedbacke4f248d2...2ca2d/Submit e1f2f56c...90f36 qualify bounded controls. Disabled/
enabledpaintedSubmit948×126px/samebounds/originaltap5401380registered; Next
347×125px/readablehorizontalinsidecard. Actualdevicebatch1.73s<unchanged12,
arbitrarytapcoincidentalHitnotclean-solve. NormalPause/Quitdiscards→Home28668/
Oct18zeroof4. ShellXML137 unavailable/rawboundsnotclaimed. Outputter400 after
completedUIpaused; doctorready/rootstopterminalCANCELLED, notcheckerPASS.
Afterdata8e7b6aa5...2663d integrityok/13sessions/economy/ratings/settings/4older
workouts exactlyunchanged;11tables exact, addonly3zeroOct18quests+index0plan.
ActualenabledPNGrealgraybackingrectangleP3; duration/causeunknown/videoanalysis
pending, nottransient/fixedclaim. BUTTON_NATIVE14.md. Currentcombined320dp2x/
offlineprovisionPASS; tutorialPro3ca1611c live, outcomeNOTVALIDATEDuntilreview.

## Frozen0c full source qualification / native14 recovery — 2026-10-18 PH

Actualcoldprocess boot1/servicesready/new5d0b4626 kernel, afterbootold13APK/
every3file/all13table rows exact/integrityok. Completeverified devicefile native14
52,311,495B/SHA c0d3c146...5c4ad installs SUCCESS00:35:12UTC, installedhash/
exactSQLite/settings/13sessions PASS. FirstactualcoldStatusok/COLD6102ms01:13:29,
rootsettledHome personallyviewed286XP68coins/newOct18plan0of4/0days, PNG95bb4327...
a8fdf/equalXMLb8c50c08...718c/currentAPK/focus. Notquiet/performancePASS. Doctor5/5
ready; singlePro984a122b liveforcurrentinput/feedback, notyetacceptedresult.

Later new4d1a kernel/device proves original reboot ran;686 Watchdog81s at00:27:42
while SettingsProvider reads aconfigdefaults, replacement1068/no fullboot.
Premature CEcopy98-byte missing-path error is INVALID_NOT_A_BACKUP, no SQLite
or corruption claim. Targetadbd uid0 observed. Actual qemu44452 exits after one
supported console close. Entire stoppedAVD42files/9,226,994,882B/everyfilecopied+
independently rehashed/allqcowbackingchains PASS, proofd30a8e5c...b4be8.
SameAVD/port no-snapshot coldprocess108764 starts00:33:45. Actual readiness/
protected data/APK/install/runtime stillNOTVALIDATED; no wipe/config/otherdevice.

Actual fresh independent no-hardlinks/full730commit checkout/freshnpmci/full
unflagged composite terminalPASS/exit0:708suites7979tests/fiveunchanged snapshots,
zero failures/four skipped suites/five classifiedoptins/all declared gates/clean
tracked-untracked Git. Summaryb4ee11152a7855560ed81b5f681bb0815849a745c940795a9c2732ccb9434556;
logee946b60f9e55ad362522c437be81bf2b214746505b19530d3caaccea45c9ea6.
No observed workerforcedexit. Actual currentgameJSON verifies every42ID and436
suites4829assertions; no game source changed since independently audited2cdb.
Allfour0cCI SUCCESS App39080473302/Integrity39080473387/
Android39080473193attempt2/iOS39080473273. FailedAndroid1Foojayresolution retained.

Native14 source/build/map/assets/permission PASS; stagedAPKc0d3c146...5c4ad,
52,311,495B/532tasks7m03s. Initialinstall FAIL:5,912,007bytes short thenparseerror.
Hostall1565CRC/v2signature PASS; protectedfilesunchanged PASS. Independent7dfd4941...
79371f distinguishes truncatedinput from later system-server watchdog. Pre-reboot
all13table rows/currentfiles EXACT/13sessions28668/Oct16completed4. Oneguest-only
reboot requestclienttimeout30s; laterADBoffline/sameqemu44452consoleRunning,
notterminalbootfailureorinstalledPASS. Service/boot/data/APK recovery OPEN.

## Feedback height source repair — 2026-10-18 PH

Actual installed RN0.86.3 Yoga C++ red: feedback face1438.1dp/labely1171.05 in
840dp fixture. Root compiled19 actual Yoga units; all50 emitted outputs equal
the runner. After conditional explicit-height growth:13 current cases PASS,
48dp face/52.1905cell/same131.81width, explicit72cell68.1905face, font48→face64,
Submit320×48 logical dp identical disabled/enabled. Native text/pixels separate.
Jestbefore02 valid9FAIL20controls49.499s; afterfocused29PASS13.542s; finalintegrated
7suites65tests/fiveunchanged snapshots31.627s PASS. Initialinvalid Jestflags and
empty compilefailure retained, no greenclaim. Finalglobaltypes02/scopedlint exit0.
Independentreview661277d03b025eb66f912909fe3c7ef2879cf2bcb6c54c510aa603805c404d72
no concreteP1P2/weakened assertions. Full0csourcecert/native14hostbuild subsequently
PASS as above; actual installation/inputafter remain OPEN.

## Storage recovery and native13 feedback regression — resumed2026-10-17 PH

Compressed sampler archive358files/3,628,817,474 payloadB/27,804,435 archiveB,
SHAf7663dc2afc9a962eb373a6971fe1fc55f4950e2e81e47515110854eca412646;
allmember hashes match device originals. Separate current-path/metadata/symlink/
process/AVD preflight PASS; scoped six-folder cleanup restores40%used. Actual
Flashce889327 Retry once and root settled PNG1fb1949a...8dace/equalXML16bc5812...8652
qualify Home28668/completed4; fresh SQLite integrityok/13sessions/14ledger and
all13 complete table-row hashes unchanged. Original failed captures/archives
retained. RUNTIME_ENV_RECOVERY13.md records exact paths/hashes/limits.

Postcleanup30s trace5943934c...f75be covers startup prefix and draw6331ms;
independentff1cfc8a...e66f4 clips clocks/phases and finds later shifted CPU work.
Initial10826ms trace lacks3.388s prefix; no aggregate clean CPU comparison or
quiet/60fps PASS. Stop identical trace retries; continue actual visual/motion.

Allfour6b4dc1dc CI SUCCESS App38942552773/Integrity38942552651/
Android38942552800/iOS38942552626. Android attempt1 NDK zip failure before build
retained; one failed-job rerun attempt2 succeeds. EndingSHA remains separate.

Flash a4105fb9 terminalCOMPLETED260.3s, actual recording valid h2641080x2400/
242.817s/3,381,589B. First estimate52s afterStart exceeds12s budget; enabledSubmit
geometry INCONCLUSIVE. Actual timeout feedback instead exposes persistent P2
huge vertical Next button/no visible label. Root original4fbfcc5c...6f10 viewed;
independent encoded PTS126.236/128.466/166.031 corroborate, disabledSubmit120.265
control. Installed-Yoga red-capable repro/fix/native-after remain OPEN.

## Native13 saved full-workout boundary — 2026-10-17 PH

Pro4300 terminalCOMPLETED11743.6s/sevenINCONCLUSIVE/finalizer400. Root personally
viewed actual R4feedback, completedResults, offline restartedHome and fresh
post-terminal staticHome. StaticPNG4da94349ffbd4528e8a9b4a1a509cf3091f0fdbe14968bfa34067196194bbe22;
equalXML16bc58128cd707a6c8f6a5a6db6754740a466937c19826a72e4ba9ceaf878652;
currentAPK/focus. ActualHome286XP68coins/4days/allfourDone. NormalFinish and
successful recovered restart observed; firstrestart ANR remains a failure.

Fresh after-workout-4 capture/SQLite verification PASS/integrityok/13sessions/
14ledger/old9andprevious11sessions unchanged/four matching provenance/versioned
nonforcedlegrecords/four unique gameplay effects/actualpipelineXPcurrency formula/
sameplan/Oct16completed4played0skip/settings/olderworkouts unchanged. Source2cdb/
APK797d0309...53dd6. SequenceMemory ordinarytimeout0/0%/+8XP1coin; RunningOrder
220/25%accuracy/21%normalized/+15XP3coins. Missed/guessed cues and oldNumberLine
contamination preserved; no source-answer/fixture/clock/data changes.

Black postrebootPNG c35bacdb...af514 rejected; later normalSettings and unchanged
warmHome fcf7d3ba...da1c8 viewed. Wrongscreen-home marker retainsstructuralFAIL;
equalXML/focus/APK/actualpixels separately qualify recovery, not oldblackcause.
One30s schedulingtrace SHA6f5d4e45a7e789c9cdef0554c83ccd8de45c3ec1c040474b75930b47ee120048
draw10826ms/hostCPU36→48; nativegraphics+shader/JIT/JS/runnablecost/delayedftrace
coverage55setupnotices. MeasurementONLY/noquiet60fpsPASS. Final180matrix terminal
FAIL firstcompactHome/SQLite diskI/O. Root guestdf98%/138MiB and systemSQLITE_FULL/
ENOSPC; independent trace attribution identifies3.38GiB of task4300rawframes.
Archive02 in progress after original180s prehash timeout/no deletion. Independent
workoutreviewf301a355...66f2 closes originalledger/workout-chain/hash coverage gap.
Currentmatrix/broader motion/performance/finalgatesOPEN.

## Frozen2cdb source certified / native13 installed

Actual independent full-history no-hardlinks checkout local02/freshnpmci/full
unflagged composite terminalPASS;708suites7967tests/fiveunchanged snapshots
367.479s/four skippedsuitesfiveclassifiedoptins/zero failures/alldeclaredgates/
tracked-untrackedclean. Summary874b8ae8b6a781d4586b4db97731838f2471b60ee55aa0df26c8e35b4242b40c;
logdbc80699be30a5c2e3273d747a21d65614ad7da37f57b48b9ee3d2b48659b35c.
Original stalledGitHubclone cancelledbeforecert/partialretained, newindependent
objects/nonshallow728commits verified. Allfour2cdbCI SUCCESS exact38883436658/
38883436576/38883436566/38883436562. EndingSHA remains separate.
Native13 build576tasks68executed508uptodate/11m6s/maxworkers1; exact1107files/
941mappedown/onechangedproduction/packagedbundle/assets/fonts/eightpermissions
PASS. APK797d0309a5204c0ba77df18a3c15a63c61ef1491decd918df9045e8edc553dd6,
52,311,435B/install-r/devicehash/exactSQLitebytes11sessions/settingsPASS.
Initialcoldtimeout15146ms; fresh startuphelperfailedsecondcold15835ms, first
draw7758/loadedHome29907ms/hostCPU70→100; notquiet/perfPASS. Diagnostics retained.
Same secondPID laterdraw48747ms/47372ms beforeRunningmain/no newANR; independent
source/diagnostics review identifies nofirstpartyloop/stack. Hostfree439MiB.
Exactall13table rows/sessions11/26364/2of4 preserved before guest-onlyreboot,
sameGUIprocess/config/APK/RAM/no wipe. NewbootID/ADBseen, boot1/dataafterpending;
initialprematurepmqueryexit20 failedbeforeoutputcreation, retainedseparately.
Afterboot1 protectedcopyfailedheader(permissiondenied/adbdnonroot), INVALIDbytes
retained; targeted5570adbdroot restored/freshrooted02 all13table rows unchanged
PASS/integrityok11sessions26364/2of4/sameAPK. Singlepostrebootnativecontrol:
Settingstimeout→focus18204ms; appCOLDdraw12197ms/focus13259ms. Samehostfree477MiB,
noquietPASS orsourcecausality/exoneration. No extra reboot/config/RAM/wipe/input.

Native12 sameleg2 recovery45eCOMPLETED521.4s actual300/75%/3of4/+25XP5coins/
nextSequence, Home26364/2of4 rootviewed. SeparatepreservedSQLite integrityok/
11sessions12ledger/2newnonforcedversionedlegprovenance+uniquegameplayeffects,
old9/ledger/settings/XPawards/olderworkouts unchanged/zero skipped. Independent
fourimage review88a4b773...ff7a82. R3visible source; R1R2R4guesses/NumberLine
contamination retained. WiFi1 correctedexact2/1/airplane0afterterminal.
ExternalARTEMISoperator repairrealofflinebeforeFAIL/afterPASS/11controls/
independent7actualmethodcases; newlivebatch2screenshots+nextprovider200/no400.
No credential/provider/envchange, noexternalcodeinGit. RUNTIME_WORKOUT12 and
NATIVE_PREVIEW13/ARTEMIS_HISTORY_RECOVERY13 recordscope; full077ACTIVE.

## Shared Button convergence and settled native pause sample

Full-source zero-warning lint exit0. Fresh types02 failed TS2352 in test-only
JsonElement cast; corrected real null guard/typed flatten, globaltypes03 exit0.
Final affected3suites27tests PASS13.929s, no snapshots; earlier integrated9/52
and five unchanged canaries retained. Independent review02 SHA256
61f4f5cc271865983cf61625f813a94a02ea21fadebe1aca8974703c79085601, no weaker
assertions/newP1P2. New-source full certification/native13/current profiles open.

Procf3530df terminalCOMPLETED891.2s, normal tutorial/start/Pause/no answer.
Post-terminal actual opaque PNG66d953...a1b2, identical compressed XML brackets
4565d4...8988, installed12APK/focus PASS. Independent all11-node/unprefixed-content
review finds only pause copy; SHA261eb695538effb80fb6be2eaa54fafea33db98312e823345de8ef22a8c02a7d.
One static TransformMatch sample qualified; NumberLine tree cause/timer/resume/
all-game states not inferred. FreshProefb6e256 exclusively5570/40s watch resumes
SAME liveleg2 offline to saved Results before root preservation/install.
RUNTIME_WORKOUT12.md records exact hashes and remaining scope.

## Native12 actual-use button finding / bounded workout checkpoint

Evidence1da9b524 allfourCI SUCCESS App38857644412/Integrity38857644748/
Android38857644818/iOS38857644847. Native12/af9 remainsinstalled. Pro79f6
terminalCOMPLETED1716.3s at savedNumberLine leg1 (150/1of10/12XP2coins), current
workout1of4/nextTransformMatch. Actual laterHome238XP59coins/4days independently
rootviewed. One hit used unavailable paused-hierarchy cue; no clean solve/full
workoutPASS. Root mistaken paused-state capture was actualResults/equalXML/focus/
APK, originalexpectedpauseFAILretained; RUNTIME_WORKOUT12.md records limits.

ActualenabledSubmit geometrychange has shared Button sourcecause. Before2suites
8FAIL12controls47.495s; after20PASS16.342s. Integrated01 one obsolete disabledlip
assertionfails/51pass; correctedshadow+stablegeometryassertion, integrated02
9suites52PASS20.159s. Visualcanary5/fiveunchangedsnapshotsPASS9.398s. Globaltypes/
scopedzerowarninglintPASS. IndepreviewSHA37efed087d0efc093425a4338d1ce4d025848f6574b63f2fa52228d57500562a
no concreteP1P2; JestownershipguardsarenotYoga/nativeafterproof. Fullcurrent
sourcecertification/newAPK/nativeafter/profilegates remainrequired.

Pausedsourcehidepropspresent/7filesexactaf9; storedmixedtreeexposureunresolved,
diagnosisSHAd8b4710363fc9df02b49045f18a101dc6a289d5360f1d64e5bc2de18412dc711.
Procf3530df live/exclusive5570/40swatch forbaseline/offlineleg2/tutorial/normal
pause, leavinglivepausedstate forrootstaticcaptureafterterminal. No competing
device actions or install/force-stop during unsaved game. Full077ACTIVE.

## Native12 current-source qualification in progress

af9bd997 native12 build532tasks/4m39s; exact1107files/941mappedown/fourchanged
production files/source-map/bundle/assets/eight permissions PASS. APK949c1347...ea459
52,310,815B, device hash/install-r/exactSQLite beforeafter/integrity9sessions/
settingsSystem retained. Initial cold timeout19153ms under certload remains
unresolved; actual root-viewed ARTEMIS original initial Home loaded226XP57coins/
Oct16newplan0of4/full3daysunit. Pro43e4906c terminalCANCELLED1011.8s on finalization
400, doctorready5/5; independent15originals/twooverlays qualify defaultcaption/
separateProgresslists/font2headings/actualQuestsopenclose/restoredHome. Moreinsights
stillINCONCLUSIVE. Flash59failed182.7s beforedisclosure, actual2nofocusANRs plus
launcher/SettingsANRs; static correctedfocuscontrol Settings3914/app6699ms cold
draw, actualfocusedwindows observed. Firstwrongdumpsysfield assayINVALID preserved.
No sourcecause/fixclaim. Warm settledProgress/equalPNGXML verified; Flash698816ed
thenFAILED onwrongrowtap(actualoverlayTargetCount21%→Results), no disclosure
activation. RootsettledResultscapture/equalXML/focusPASS. Pro d1133102 then
used one rawcenter540,2043 tap at freshbounds[42,1980][1038,2106]; actual expanded
Summary2/226/9/57 and Training balance personally viewed by root/independent.
Post-terminal root equalXML/PNG/focus/exactAPK proof passes; independent review
SHA4651ce165acfa8f28dc8fd9d153c5885f49e6534c9147d44a0ae56c2e6c3efc9.
TerminalCANCELLED508.2s finalizer400, doctorready5/5, no collapse/automaticPASS.
Actual stale helper lists led to official external uiautomator backend setting,
all other.env bytes unchanged/supported idle-daemon restart/no-browser. Optional
Showcase build Node-version failure retained; daemonready5/5. Pro79f6d0e9 now
exclusively5570/40swatch/backendUIAutomator2 for freshness/full offline workout;
actual initial screenshot/hierarchy freshness and ordinary collapse qualified
(rawdispatch540,729/actualoriginal2, root personally viewed); generated overlay1
misplacescrosshair and is not independent geometry proof. Full workout results
pending. STARTUP_ANR12/NATIVE_PREVIEW12.md retain limits.
Fresh independent af9 full unflagged composite terminalPASS/
exit0,707suites7948tests/five unchanged snapshots250.875s;4skipped suites/
5classified opt-ins/zero failures, all declared gates and Git clean PASS.
SummarySHAb4370f6ead135d2e9f0d7e61b8aa14842b01ccaf68d0da3c9b683e551bbe669b;
logSHA2896c1f4af9cb147a643bb94aafc21c7faf14bd43b8f6f2507115be43e683c0b.
No observed Jest worker forced-exit warning; original warnings retained.
NATIVE_PREVIEW12.md records full evidence boundaries; ending-SHA still separate.
All four sourceaf9 workflows SUCCESS: App38848398321,Integrity38848398236,
Android38848398214,iOS38848398238.

## Later scrolled critique / source repairs in progress

SCROLLED_RECOVERY11.md supersedes earlier static noP1/P2 acceptance for real
Profile overflow, Home missing-word native drawing, persistent Progress P2
overlap and transient false-empty ProfileP2. Original screenshots/reviews retained.
Profile before02 valid3FAIL/5controls, after2suites19PASS. Home before3FAIL/4controls,
after5suites35tests/five unchanged snapshots PASS/lint0. Native actual-glyph probe
defaultcaption FAIL0.342, font2controlPASS1.0; firstprobeXMLancestorassumptionfailed
beforepixelassertion and is not validredproof. Sharedgridbefore5FAIL/7controls,
after4suites34PASS/lint0, realReport/Row caller styleguards; no Yoga/nativeafterclaim.
Profile opt-in retention after02 PASS6suites45tests/five snapshots13.296s;
initial after animation act-warning failure retained. Integrated27suites197tests/
five unchanged snapshots PASS39.328s, globaltypes/full-source zero-warninglint exit0.
Independent four-fix review no concreteP1/P2, reportSHA256
2a2748f6db54e5d081021f92518b3f63931a370b59e7a19db06eb592046a98c6.
New native/current-source composite remainOPEN.

Pro1e916e91 actualbranches/finalHome image-qualified with independent31reference/
30uniqueimage review, terminalCANCELLED3176.2s on finalization400, doctorready5/5.
No automaticcheckerPASS. Flashpreviousgeometryfailuresretained. All13DBtables
identical across both non-game tasks, preservedbeforeworkout integrityok/8sessions/
9ledgerrows/settingshasha508...2ec9 BEFORE gameplay. Pro5e04e218 terminalCOMPLETED
1543.6s; root actualimages show opaquePause/sameRoundResume/correctfeedback/
saved590/100%/+40XP8coins/1of4/restartedHome226XP57coins. Independent preserved
SQLite integrityok/9sessions/10ledgerrows, exactone new non-forced WordScramble
with provenance/versions/unique gameplay operation; old8sessions/ledger/settings/
olderworkouts unchanged. Oct15 active1/4/zero skipped. Date rollover means full
current-day workout remainsopen; motion clip missedpresses do not qualify latency.
RUNTIME_WORKOUT11.md records limits. Allfour24f7bd78 workflowsSUCCESS
(App38789837582,Integrity38789837751,Android38789837824,iOS38789837647).

## Native11 static visual milestone

Remaining144 andcompactdark18 terminalPASS/exit0, eachimmutableverifierPASS.
Together with explicitcompactlight18 subset:180 unique APK-bound/staticframes,
allactualPNGpersonalviews/independentcritique noP1P2. AggregatereviewSHA256
e01d371a23e82c187239e8dfb85127292a86a5f08d8f1c9ec26b4782714fbfa3.
Gallery180comparisons/150fresh077 baselinepairs/30additionalstates, actual
perimageverdictsverified; comparisonsSHA256
8f3c54551dc0a5da546bea9084a0cd9c17de5416e5688a27193c4129432f2d59.
Independenttargeted15defaultlightbefore/afterpairreview recorded separately.
Extraall-domain12/12immutableframes/actualreview noP1P2; artreviewSHA256
9c050e136c82374e389160c6259c239f2eedc58ab1f9cd0151b7701f6fba13ba.
NATIVE_VISUAL11.md preserves P3 findings, originalfailedmatrix and state/geometry/
staticlimits. No motion/interactive/gameplay/perf acceptance inferred.

Allfour1da74ad0 workflows SUCCESS: App38757594184,Integrity38757594254,
Android38757594177,iOS38757594137. Flashf4822ca9 non-gameinteractive RUNNING,
officialMCP40swatch. PrimaryGemini credentials valid; no secrets/envchanges.
Remaining runtime/completed-state/perf/handoff/endingSHA gates stayOPEN.

## Native11 installed / current product source qualified

93353ede actual fresh unflagged composite PASS/exit0:705suites/7929tests/
5snapshots,331.763s,4skippedsuites/5classified opt-in tests, zero failures;
all declared gates/independent Git clean. SummarySHA256
b2c7a4e9fc5c9275391084e2e6dfa2fdce4c030a0b6bbf5bcc89545d68990170;
logSHA2568c9a0da9dc882594cbd5eea8252ca2f3dd66ffa7a01c53544275a0bf7b6acd8a.
All four933 workflows SUCCESS: App38733717754, Integrity38733717905,
Android38733717778, iOS38733718113. NATIVE_PREVIEW11.md records boundaries.

Native11 exact source/build/assets/eight permissions/install/device hash pass;
532tasks4m15s, APK9aa17cda...12246/52,310,459B. SQLite exact bytes unchanged,
integrityok/eight sessions/System settings hash retained. Initialcold11166ms
not quiet acceptance. Confirmation09 actual XML bounds probes3/3 PASS; only
compact armed PNG has armed visual label. All13 SQLite table rows unchanged
across confirmation. Expired default/font2 PNGs and default over-cap attempts
are recorded, not claimed as ideal controller evidence. First180matrix97505
terminalFAIL on firstfont2Home/noPNG/laterGames tree. Explicit first18 compact/
light subset passes immutable verifier/independent all18 image review noP1/P2.
RootURI controls both reach Home; QA stops before display profile change,
syntax/eight capture tests PASS, exact routing cause unproven. Fresh remaining
144capture77716 RUNNING/font2HomeGames qualified; compactdark18 separate.
Final visual/runtime/offline/workout/performance/handoff remain OPEN.

## Fresh1ef composite / shared press-policy regression

Actualfresh independent1ef4a587 full unflaggedcomposite terminalexit0/PASS,
704suites7923tests5snapshots339.064s/failed0;4skippedsuites5classifiedopt-ins.
All declaredgates and independenttrackedGitstatusclean. SummarySHA256
a844d78f21e891192a008080e20656a0bd5ffcc942302e98d2a94bcdcb1a2a84;
logSHA2566ec3426370c14e19209a2108bf52c117dc632d350f602737109e39bbff9ca6ea.
DEP0190retained/no observedJestworkerforced-exit. Latermotionfix notincluded.

RealTappable/live motionstore before4FAIL0.97vs1/2controlsPASS20.747s;
existingcleanup nowdepends on effectiveanimatepolicy. After6suites42PASS25.009s,
lint0. InitialglobaltypesTS2345 readonlytesttuplefixedwithoutassertionchange;
focused6PASS3.567s,globaltypes02exit0/scopedlint02exit0/strict62/ownership/repostate
PASS. Independentread-onlyfinalreview noP1/P2. FinalnewAPK/nativeproofopen.

Native10 exact1ef built/staged532tasks4m54s/1107files/941mappedown/assets/eight
permissionsPASS,APK5855fa95...23f75/52,310,423B. NOTINSTALLED and excludeslater
motionfix. Pro872ded85 owns5570; reporteddefaultarmedbounds require actualrawfile
rootqualification. Fullprofile/workout/offline/perf/endingCI/handoff remainopen.

## Native09 installed / storage healthy-route source recovery

Native09 exact624a5a77 build532tasks4m56s/1107files/941mappedownfiles/bothchanged
productionfiles/eightpermissions/9artwork/3fonts PASS. APK0afcb249...8487a9c,
52,310,075B; install-r/devicehash/exactSQLitebeforeafter/integrity8sessions/
settingsSystem PASS. Postinstallcold11637ms notquietacceptance. Pro872ded85
nonwritinggeometryRUNNING/exclusive5570/40sMCPwatch; no nativegeometryPASSyet.

Independentrouteinventoryfound P2healthy directStorageUnavailable deadRetry;
2realcaller redfailures before35.485s. Sourcefallbackafter5suites53testsPASS20.057s;
globalinitialTS2345fixeddefaultparameter, finaltypesexit0/2suites5testsPASS13.408s/
scopedlint0. Newnative10proofrequired;09excludeslaterstoragefix. Separate native
Settings/Home controls bothpoorjank atCPU37–63percent supportenvironmentcontribution,
not60fps/appcostexoneration. NATIVE_PREVIEW09/STORAGE_ROUTE_RECOVERY recordlimits.

## Data07 independent qualification / confirmed native reflow

Trace51d82686-3931-4f8e-ba80-6ecac2ce6839 terminalCANCELLED3816.6s because finalization
provider400 malformedtoolhistory; doctorready5/5. ActualMerge38/Replace63/textedit
50–51/restart8sessions67/finalHome69 rootimages inspected. Independent preserved
SQLite integrityok,8sessionrows/versions and exportedledger/rating/XP projections,
workouts/settings/186XP49coins unchanged. Initial raw-ID verifier failure was an
invalidassumption: sourceexport omits/regenerates three autoincrement IDs. Corrected
projection passes onpreservedfiles; profile.updated_at differs, otherprofilefields
match. RUNTIME_DATA07.md contains exactfacts/limits; no automaticcheckerPASS.

Captured actual confirmationXML replay FAIL: resting458,2227→845,2353 becomes
armed84,2374→769,2400; originaltapoutside, previeworiginunchanged. Fullwidthsource
fix twoaffected suites54testsPASS54.744s/types/scopedlint exit0; actualnew-APK
greenprobe remainsrequired. Native08stagedneverinstalled; native09build planned.

## Actual current-source composite and staged native08

Fresh independent D:/bt077-cert-6c0829c8 full unflagged composite terminalPASS;
trackedmutationPASS/independentGitclean. 703suites7921tests5snapshots436.351s,
four skipped suites/five classified opt-in tests, zero failures/updates. Types/
full lint/web22/strict62/security/provenance/registry/offline and all declared
composite gates PASS. SummarySHA1080cd2b4f22df7a36259a2504e38c5fe1d80edf804d50e7fbd9ff35297a3d3a.
Initial reused-clone preflight failure preserved; fresh02 didnotweaken guard.
Allfour6c CI SUCCESS: App38714343817,Integrity38714344003,
Android38714343901,iOS38714343701. EndingSHA obligation remains separate.

Native08 build/stagePASS532tasks5m54s/1107exactfiles/941mappedownfiles/
onechangedHome exact/permissions8/9artworkpixels/3fontbytes. APKcbb5aeb2...a4f2f,
52,310,051B. Installation/device/runtime OPEN while Prodata07 owns5570. Root
viewed actualMergecompletion38 and preview/edit50/51; disabledapply corroborated
bycontrollerhierarchy. Replacewrite/restart/posttaskSQLite pending. Detailed
proof, initial failure and warning boundaries: evidence/NATIVE_PREVIEW08.md.

## Home read-availability recovery

Native06 fallbackimages showrealP2 Home falsezero/emptyclaims whileloading. New
realcaller pending/error regressions:initialfixturemethoderrorinvalidatedfirst
run; correctedbefore02 has2validfails/2controlsPASS. Sourceavailabilityguard and
visibleexistingretry card fix; combined6suites32tests5snapshots PASS20.807s after,
includingretry186XP andgenuineempty/existing controls. Types/scopedlintPASS.
OnlyHome/integratedtabs canaryblocks intentionallychange,other3byteidentical;
Home renamedaccuratelydb-unavailable recovery. Native08proof stillOPEN.

c87f4d43 allfourCI SUCCESS: App38711583870,Integrity38711583738,
Android38711583880,iOS38711583703. Oldactuald62composite FAIL5canariesonly,
701suites7912testsPASS/5fail440.635s,allothergates/cleanstatusPASS. Finalsource
composite/newendingCIrequired. Native07focused2x14/14exactbrackets/themes/hashes
PASS/rootall14imageviews, Prodata07RUNNING/exclusive5570/40secMCPmonitor.

## Native07 correction checkpoint

d62bbfc7 APKf1a7d86f...6347 build532tasks5m11s/install/exactdata/devicehash/
8permissions/source1107files/941mappedfiles PASS. First focusedfont2 capture
FAILED onloadingProfile, preservedmanifest/no falselyacceptedPNG. Bracketed
readiness02 RUNNING; original3nativeheadingpixelprobesPASS and actual5light2x
frames rootreviewed. Fullmatrix acceptance stillOPEN.

d62AppCI FAIL1suite5canarysnapshots (701suites7912testsPASS,5failed). Local5
fail reproduced, all46snapshotinsertions are inactivefalse styles; expected
snapshotsupdated5PASS, unchangedverify5PASS. Actualold d62 fullcompositeRUNNING
notgreen. New-source finalcomposite/fourCIrequired. Types/fullsource lint PASS.

Quiet planned cold5425/3715/3258ms,firstpostinstall10681ms; retainedloadedHome.
PSS149372KiB/RSS262228KiB pointonly. Gfx64launch/Homeframes60janky93.75percent,
median150ms,p90=250ms; skippedframe/HWUI logdiagnostics but no observedfatal/ANR/
OOM. Performance remains UNRESOLVED pending bounded controls; no60fpsclaim.
Native07 identity/probes/failures/limits recordedin evidence/NATIVE_PREVIEW07.md.

## Current certification checkpoint — native06 / afabda3a

Subsequent actual profile review found4P2 families and7 currently identified
loading/stale frames. Source fixes: heading2 red-before/18after tests; data2
red-before/49after; metric2 valid red-before/analytics+repository9suites174after;
capture2 old-order red-before/11after. Global current types PASS; current lint
in progress. Native07/profile recapture still required. Exact failure boundaries,
including invalid diagnostic invocations and overlapped red attempt, are in
NATIVE_PREVIEW06.md. No all180 visual acceptance is claimed.

Actual independent clean checkout PASS/exit0, fresh npmci/full unflagged composite,
702suites7903tests5snapshots382.226s,4skippedsuites5reviewedtests,failed0; current
types/full lint/strict62/provenance/registry/offline/security/web22 and every
declared composite gate/unchanged tracked status PASS. Summary SHA256
d81ef4c6c3414129f8dcf1d5c3724a69ce91927b097932b9ae4a389d27b93f31.
This supersedes the earlier final-source full-run requirement, not runtime gates.

Native06 exact1107file inventory9c920440a6ac82cfe3837de08b1d610d847c9859b6884fb56f6efdbdc72c9188;
build532tasks2m36s PASS; APK079b7e520e347c9856e40082177505da742ee27948527abccf4ebdca6d05ffad,
52,309,219B,install/devicehash/eightpermissions PASS. Exact SQLite bytes unchanged,
verification integrityok/eight sessions/settings retained. Metro source-map941 own
files/all56 changed production files match committed source; bundle inside APK
equals generated bundle. Nine packaged illustrations pixel-identical,three fonts
byte-identical;9MiB static decoded art footprint is not measured process memory.
Initial virtual-context/font-metadata probe errors and preflight-copy overlap are
explicitly reconciled in NATIVE_PREVIEW06.md; no failed probe is relabeled.

180-frame native profile capture RUNNING; actual visual acceptance/restore writes/
full workout/offline gameplay/quiet performance/ending-SHA CI/visible handoff OPEN.
Cold6668ms under load is not accepted quiet performance. No physical/iOS runtime
or store signing claim. Existing terminal traces and initial failures stay intact.

## Startup — 2026-10-14

- Complete mandatory startup/history/owner brief reading: COMPLETE via lead/independent read-only auditor.
- Clean main/origin/advertised remote c7bbf0ddfa184204027d8b6df14deab5abf87a6e; one worktree; divergence0/0; fetch/fast-forward already current.
- Repo-state PASS before activation (reported historical076);077 reconciliation checks pending below.
- Host/installed baseline APK SHA256 c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6;48,888,528B;com.braintraining.app0.1.0/1000;x86_64/debug-signed.
- GUI braintraining-ui35/emulator-5570 boot1/PID44452 visible=true/minimized=false, read-onlyWin32 witness.
- ARTEMIS diagnose ready5/5 required environment checks,target idle; provider execution not inferred.
- Fresh initial Progress screenshot/hierarchy qa-artifacts/campaign077/baseline/initial.*; observedthemeUNKNOWN pending direct witness. Brightness is not evidence.
- Read-only focused existing game coverage5suites/136tests PASS; it omits newly reproduced bugs and does not close them.

## Open certification

## Current wave — 2026-10-14

- Static baseline150/150 COMPLETE:default30 plus four profiles120, all15 shipping
  leaf routes×both themes. No aborted frame/UNKNOWN theme; direct APK-bound
  persisted preference/live Activity witnesses, reduced-motion scale0.
- Focused packets PASS: Logic22suites234tests; first input/timing20/216 (coverage
  93.02/91.05/94.41/93.61%); Math23/233 plus150 independent-oracle seeded puzzles;
  restore preview49 tests; workout result retry8 tests. These overlap existing
  tests; whole-app aggregate remains unmeasured for077.
- Shared foundation: palette/reference/role/tab/button checks44/45 initial
  assertions, one obsolete negative muted-contrast assertion corrected; six
  Home/control suites28/29 initial assertions, new completed-skip matcher
  corrected and Home-skip4/4 PASS. Shared ESLint PASS. Full integrated rerun
  remains required; no failed initial result is labeled PASS.
- Discovery/HUD:6/7suites39/40 initial; old detail board assertion contradicted
  intentional accepted artwork and was updated to assert local contain/pointer
  semantics. Rerun pending.
- Integrated foundation14suites/82tests PASS; Profile/Rewards5/30 PASS;
  result-skipped/content convergence5/31 PASS. Skipped completion regression
  failed before with4/4 and now reports3 played/1skipped without new economy
  effects. Later discovery critique rerun7/8 suites42/43 assertions: old featured
  art expectation fails in compact default; breakpoint-specific tests now
  distinguish normal and compact/2× layouts; current rerun open.
- Paused continuation:13 valid caller/reducer suites39/39 failed before;
  full owned122suites1319tests PASS and strengthened same-batch pause/resume
  replay39/39 PASS. Full tsc and scoped zero-warning lint PASS at that boundary.
  Scoring/generator retained; game metadata advanced; registry regeneration
  required after all current writers finish.
- Repo-state/ownership/Expo alignment/offline/secrets/runtime-QA/workflow/
  affected-map checks PASS; resolved-theme witness3tests PASS; strict077
  OpenSpec PASS. These are current gate results, not final all-checks closure.
- Expo alignment PASS with compatible SVG15.15.4/Lucide1.56.0. Dependency audit
  PASS:10 accepted advisories, no unallowlisted moderate+ production findings.
- ARTEMIS retries initially401/noactions. Root reproduced inherited-key vs
  external-file mismatch as boolean only; preloading external.env before
  settings fixed source match. Supported background daemon restarted with same
  provider/model; read-only trace6dd49ad9-499e-4ab7-b2aa-7df8e972cc3b completed
  126.6s/21steps, final screenshot System Active independently inspected; no401/
  auth/traceback, stderr file absent. Runtime access qualified; new app gameplay
  NOT VALIDATED. External traces are not copied into Git.
- Actual ImageGen17calls/14preserved raster sources+3directions, including4
  rejected drafts. Accepted9illustrations+5branding variants/3fonts in manifest;
  image bytes1,303,797. Source alpha/dimensions and224px light/dark composites
  inspected. Independent source critique found secondary domain hues,
  recommendation filters/reflow and uneven optical asset sizes; first two
  corrected, native size judgment pending.
- Native SVG build PASS56tasks/2m40s. Full preview release build PASS532tasks/
  8m39s. Snapshot inventory a63408057cb516275ec42fa55b19acc1f2661781c4dc2865a982ede236738af6;
  APK8c312012ca91a91f1c6bd234464879b98a89d25454f8709d1f88e9ddc42dbf42,
  53,519,415B,0.1.0/1000,x86_64; permissions unchanged. This uncommitted UI
  snapshot precedes later pause/recommendation repairs, not final source proof.
  Installed-r preserving data; new SQLite integrityok/sessions6 and persisted
  System witness bound to installed hash. Default native capture now running;
  no post-change gameplay PASS yet. Native capture/physical/iOS/clean-checkout/
  final-SHA CI remain separately open.

Fresh baseline/profile/state coverage, defect regressions/fixes, actual ImageGen art, full relevant Jest/typecheck/lint/OpenSpec/declared gates,native build/permissions/data/offline/clean-checkout,post-change critique/runtime and final-SHA CI are NOT VALIDATED for077. Full scope remains open. Historical623/7248 and four green c7bbf0dd workflows are baseline history only.

PHYSICAL_ANDROID=NOT VALIDATED;IOS_RUNTIME=NOT VALIDATED;store signingNOT READY. Ending-SHA iOS compile required separately.

Complete pre077 chronology is unchanged under `.agent/history/pre-077-c7bbf0dd/` with hash manifest. Historical image-theme corrections/open14.3 criteria remain there and unchangedOpenSpec evidence.

## Integrated checkpoint reconciliation — 2026-10-14

This section supersedes earlier in-progress observations above; initial failures
remain recorded. Source/test evidence and native evidence are separate.

- Completed additional packets: paused continuation122 suites/1319 tests;
  remaining cue22/290; Vigilance7/101. Real red-before probes and deadline controls
  are recorded in DEFECTS.md. Generated registry/provenance/ownership now PASS.
- Full source TypeScript PASS (empty checkpoint-typecheck-final.log, exit0).
  Full source ESLint PASS, zero errors/warnings (empty full-lint.log, exit0).
  Strict OpenSpec all62 items PASS; dependency audit PASS with10 accepted
  advisories/no new moderate+ production finding; clean-checkout self-test14 PASS.
  This self-test is not actual clean-checkout certification.
- Whole Jest01 FAILED:663 suites passed/1 failed/4 skipped;7611 tests passed/
  3 failed/5 skipped;5 snapshots passed,743.608s. All3 failures were the unchanged
  design-system guide contract asserting stale076 palette/radii. Guide corrected
  to actual077 source; unchanged9-test suite PASS. No tests were disabled or
  weakened. Full rerun02 remains in progress.
- Intentional visual canary update reflects the real design migration;5/5
  snapshots PASS. Subsequent actual Home label grouping (`Level n`) removes
  generated trailing whitespace;5 tests PASS with2 snapshots updated/3 unchanged.
  git diff --check now PASS. Snapshots do not qualify actual native appearance.
- Jest signal classification PASS:5 existing exact opt-in skips classified,
  zero unclassified/ambiguous/count mismatches; suite/test floors pass. This
  classifier does not erase Jest01's3 assertion failures.
- Web export PASS,22 static routes. Current native preview02 build in progress.
- Asset manifest now17 outputs/imageBytes1,613,200 after alpha-bound optical
  normalization. Source/light-dark composites inspected; native after-normalization
  review remains open. Earlier1,303,797-byte record describes the prior outputs.
- Native preview01 built/installed:532 tasks/8m39s; APK
  8c312012ca91a91f1c6bd234464879b98a89d25454f8709d1f88e9ddc42dbf42,
  53,519,415B; source inventorya63408057cb516275ec42fa55b19acc1f2661781c4dc2865a982ede236738af6.
  SQLite after install integrityok/sessions6/persistedSystem witness matches APK.
- Native default matrix12/12 PASS (Home/Games/Profile/Rewards/two game details,
  both themes); independent reviewer inspected all12. Separatefont2 diagnostic
 10/10 PASS. Compact/font2 matrix FAILED after firstcompact/light/Home status-bar
  discontinuity and19 missing frames. Preserve its failed manifest. This is not
  accepted compact evidence; density-only320dp diagnosis/recapture is planned.
- Independent preview critique: type/nav/Home/Profile improve clarity; library
  framing/tape/fake bars, technical rationale, redundant fresh detail reports,
  multiple equal claim CTAs and ambiguous equipped slot names need refinement.
  Current source corrects these; preview02/native acceptance remains open.
- ARTEMIS preview01 navigation-only Flash aab0e61b-d88a-42a3-bae9-f8af1a9c0f41
  completed261.3s/12steps; summary and final screenshot independently inspected.
  Games opened; Appearance/System reached near top; Home tab/Startworkout visible.
  Final image is mid-scroll with hero heading above viewport, so it does not
  certify final Home composition. No settings/rewards/data/gameplay changed.
  Provider access is working; trace stays external. No gameplay PASS is inferred.

Remaining required gameplay/state/visual/profile/data/offline/performance,
actual clean-checkout/native final source/ending-SHA CI/handoff gates stay open.

- Additional diagnostic: preview01 density-onlycompact320 Home1/1 PASS, actual
  Activityw320dp/h711dp/540dpi, intact system icons, image inspected. This suggests
  framebuffer resizing caused the earlier invalid chrome; it does not certify
  all compact screens. CTA wrapped sublabel touches curved face edge, revealing
  a real shared vertical-padding followup for next source wave.
- Independent scoped checkpoint_contract_review found no introduced regression
  in workout retry CAS/skipped copy, restore text/mode/revision/current-consent
  binding, or Profile/Rewards transactions/partial claim refresh. Source review
  only, no new runtime or broad test claim.
- Staged secret scan CLEAN3647 text files. Current-source staged whitespace check
  PASS; exact owner brief and seven immutable historical files retain original
  whitespace and separately pass8 staged byte/hash checks. Supplied owner brief
  remains SHA256b282291269598dee75536dc8ca26bef79667105bca2dcb798326bdfef362e611.
- Runtime-QA/offline/workflow/affected-map/repo-state gates rerun PASS; theme/
  capture validator7 tests PASS. Original failed matrices remain immutable.

## Green source checkpoint918c20ed — 2026-10-14

- Full Jest02 PASS:664 suites/7614 tests,5 reviewed opt-in skips,5 snapshots;
  1043.05s. JSONsuccess=true,failed suites/tests0; skip classification PASS.
  Jest01 remains the recorded failed initial run; no result was overwritten.
- TypeScript PASS and full-source ESLint PASS/zero warnings at918c20ed, bothexit0.
  Registry/provenance/ownership/repo-state rerun PASS after the local commit.
- Native preview02 PASS:532 tasks/14m5s;1103-file source inventory has zero
  differences from918c20ed app source. InventorySHA256
  02a946c803fcb9ad50664772d9b94c337d534beefc2e23c1b796c6540ae4a62c.
  APK949915d17e11e3f350481f6b1b6a1db621f51cc2d13111b893a5749d38401b57,
  52,264,147B. Metro2474 modules versus preview01's4313 after bounded per-icon
  imports. This is an intermediate preview, not final native certification.
- Prior preview01 APK retained locally with verified8c312012… SHA. Exact SQLite
  files preserved separately before install; verification used a working copy,
  integrityok/sessions6. An initial backup query mistakenly namedsessions instead
  ofgame_sessions and failed before install; corrected verification passed.
  adb install-r SUCCESS; post-install data/theme/visual/runtime proof remains open.
- Independent no-finding contract review covers only specified result/data/
  Rewards callers; all other open game/presentation/certification work remains.

## Observation/input/Progress convergence — 2026-10-15 local

- Combined current-source wave PASS:169 suites/1735 tests/5 snapshots,90.358s;
  convergence-wave03.json success=true,failed suites/tests0. Covers14 changed
  game modules and affected Progress/Profile/discovery/detail/shared UI callers.
  Packet counts overlap this run and must not be summed into whole-app totals.
- Global TypeScript exit0 (convergence-typecheck06.log empty); full-source
  ESLint exit0/zero warnings (convergence-wave03-lint.log empty). Current registry,
  provenance, ownership, Expo23 pins, offline1005 files, runtime-QA, workflow4,
  affected-map55 patterns and repo-state PASS. Strict OpenSpec62/62 PASS.
- Staged secret boundary CLEAN3680 text files. Initial staged whitespace check
  found incidental new-test whitespace;16 test files trimmed, staged check PASS.
  No historical/owner-brief bytes were modified.
- Observation20/212; flexibility49/486; memory/search33/392; tutorial5/33 and
  focused math/word/deduction callers5/40 pass. Valid red-before probes and
  exact failure/fixture corrections are in DEFECTS.md. The five-module run03
  had one stale version assertion (56 suites585 tests pass/one fail); corrected
  metadata test passes, then the combined169-suite run above passes unchanged
  behavioral expectations. Initial FastMath pause deadline regression was
  repaired before this combined gate. No failing run is relabeled.
- Progress5 routes implemented, focused5 suites40 tests PASS; final empty-history
  action rechecked4/4. Display-only rating slope2 points/day no longer displays200;
  analytics/rating/storage rules unchanged. Actual supplementary Refero IDs and
  adopted/rejected lessons are recorded in evidence/PROGRESS_WAVE.md.
- Shared row/CTA/discovery/Profile/detail critique fixes5 suites19 tests PASS;
  two intentional canary snapshots updated, combined run5 snapshots PASS.
  Actual native review is required; snapshot success is not visual acceptance.
- Preview02 post-install theme/data witness matches949915d1… APK, integrityok/
  sessions6. Default12/12 capture gate passes, but independent review identifies
  one blank light Profile identity. Reduced-motion and cold default controls
  each render it; source mitigation and same-sequence/new-build proof remain
  separate. Full details and immutable failure: evidence/NATIVE_PREVIEW02.md.
- Four CI workflows at pushed ebcb45e8 all SUCCESS: App38590943062,
  Integrity38590943337, Android38590943431, iOS38590943042. Not ending-SHA proof.

Native preview03, current-source profiles/gameplay/data/offline/performance,
remaining Results/data/supporting presentation, actual clean checkout, final
source build/ending-SHA CI and visible Home handoff remain OPEN. ARTEMIS access
works; no credential change is requested. Full Campaign077 remains ACTIVE.

## Whole Jest/native preview03 follow-up — 2026-10-15 local

- Whole Jest03 FAILED2 suites/2 tests:690 suites/7873 tests pass, five reviewed
  opt-in skips/five snapshots pass,319.696s. Both failures are old UI contracts:
  ListRow expects a text chevron; app-shell expects the now-disclosed summary
  immediately. AppCI38639600811 artifact has the exact same two failures.
- Corrective tests verify the actual decorative SVG, retained accessible action,
  current rating and explicit More insights before the preserved summary.
  Focused2 suites/30 tests PASS. Whole Jest04 PASS692 suites/7875 tests,
  five reviewed opt-in skips/five snapshots,290.748s;success=true,failed0.
  Global TypeScript07 exit0 and affected test lint exit0/zero warnings.
- Native preview03 source8d772c7b,1106-file inventory zero differences,
  SHA256f731f65d637781a7b8c9afdf6f1b3b20dab98b16c8b521d995fe65f2e0667a22.
  Build532 tasks/3m11s PASS; APK30fb56fc9b291d470270698a2f441626266eac898292b577e4ca5acd1a644723,
  52,304,659B. Install-r SUCCESS and device hash match. An early invocation
  preceded APK copy and failed to stat without changes; repeated only after
  the copy/hash precondition passed. Eight packaged permissions match allowlist.
  Exact SQLite before/after preserved; separate verification copies integrityok,
  sessions6 and unchanged persistedSystem settings witness. Cold launch6288ms
  under check load is an observation, not accepted performance proof.
- Default native22/22 structural captures PASS,11 surfaces×two directly
  witnessed themes. Independent reviewer inspected all22; Profile identity is
  visible in both current frames, and earlier discovery/detail corrections
  appear. No missing/overlapping essential content P1 found in default frames.
  Preserve original02blank. Required P2 corrections and open populated/profile
  coverage are in NATIVE_PREVIEW03.md; do not infer all-state visual acceptance.
- ARTEMIS Proa3f662cd-4ee7-49a0-9f7e-771019f3bd82 running for actual workout/
  pause/relaunch/persistence. Initial Android settings showONLINE, not offline.
  No terminal result yet; task owns emulator-5570 until terminal. No credential
  changes or forced session results. External logs/notes stay external.
- Jest04 also emitted one worker forced-exit warning after successful assertions;
  no such warning in02/03. Initial focused --detectOpenHandles did not start
  tests (ENOENT global temp haste cache); isolated cache diagnostic02 PASS2
  suites/30 tests,50.433s, exit0 and no reported open handles. This narrows the
  evidence but does not identify or claim to repair the broad worker warning.
  Retain as final convergence followup in KNOWN_ISSUES.md.

## Results/data/Progress and runtime blocker recovery — 2026-10-15 local

Root current convergence03 PASS34 suites433 tests,40.102s; global TypeScript04
exit0 and full-source zero-warning ESLint03 exit0, affected final Grid tests/
spacing lint04 exit0. Initial forgotten icon imports49 failures and a stale
version assertion are preserved in evidence/PRESENTATION_RECOVERY.md, not
relabeled. Current hermetic registry/provenance/ownership/repo-state/offline/
runtime-QA/Expo/workflow/affected-map checks PASS.

Pro trace a3f662cd step42 screenshot independently exposes a real clipped
GridNavigator first-play tutorial. Root stopped repeated tap attempts; a new
source fix has2 valid red-before layout regressions/one normal completion
control, all3 now PASS. Game1.2, scoring/generation retained. Current installed
preview03 lacks the fix. New-APK native proof remains required. Related isolated
TransformMatch repair is in progress, no PASS claimed. Existing Pro run remains
running with two actual saved legs; root requested honest blocked leg3/final
persistence/Home report. It is ONLINE, no offline evidence. Full077 scope open.

## Final source-wave integration before preview04

- Transform11 suites143 tests PASS13.277s, owned lint0;4 valid red-before layout/
  visible-pattern failures +1 normal-completion control, targeted5/5 after. Initial
  post-fix3 hidden-grid query fixture failures retained, corrected queries only.
- Integrated convergence04 PASS45 suites576 tests35.323s, failed0; TS05 exit0,
  affected current-source lint05 exit0. No worker forced-exit warning in this
  focused run; broad Jest04 warning is not claimed resolved. Capture/theme
  harness15 tests PASS; two optional populated analytics surfaces added.
- Proa3f662cd terminal CANCELLED after root stopped a provider400 malformed
  tool-message-history pause during finalization. Environment diagnose5/5 ready.
  Existing report and step52 independently inspected: Home2/4,186XP/49coins,
  ContinueGridNavigator; actual online2-leg/opaque-pause/restart evidence only.
  Step42 confirms clippedGrid tutorial; leg3 BLOCKED,leg4 NOT VALIDATED. No full
  workout or offlinePASS. New-APK continuation required.
- Before install, exact SQLite db/wal/shm retained in native-preview04/
  sqlite-preserved-before-install03. Separate verification copy integrityok/
  sessions8. Initial run-as access failed(non-debuggable release); first root
  attempt used nonexistent Android databases path. Both failed header checks,
  not backups. Correct inspected Expo files/SQLite path then passed.

## Frozen source95e38eac / native04 installed

Whole Jest05 PASS694 suites7885tests/5snapshots,5 reviewed opt-in skips,269.629s;
JSON success=true,failed0; classifier PASS. No worker forced-exit/open-handle
warning in05. Earlier04 warning is retained as unidentified, not claimed fixed.
Native04 build/install/data/hash/permissions/cold-launch identity is in
NATIVE_PREVIEW04.md; Flash repaired-tutorial smoke is running, no result yet.
No profile/complete workout/offline/data/performance/clean-checkout/final CI PASS
is inferred from the whole-unit-test result or installation.

## Preview04 qualified default / critique convergence source

Default capture34/34 PASS; independent all34 PNG/witness/hash review found noP1
and residual P2 labels/rating endpoints/elapsed-date copy. Flash a6b84b21completed
70.3s/7steps; root personally inspected actual allthree candidate/confirmation/
Start/Home frames. Normal tutorial now reachable; no actual game started. Later
GMTdayrollover createsnewOct15 workout0/4; pre05SQLite verifies previousOct14
active/index2 retained, newOct15active/index0, sessions8/integrityok.
Copy corrections final5suites48tests PASS, canary5tests/5snapshots PASS separately,
globaltypes/currentlintPASS. Firstcopytest hadone old exact-range caption mismatch,
corrected to explicitly expectUTC. Prior requestednonexistentvisualcanary path
matched nothing; actualvisual-baselines suite run explicitly. No fake extra suite.
Dependency auditPASS10accepted/no newmoderate+production; webexport22routes/exit0
PASS with CLIforced-exit housekeepingmessage. Four95e CIworkflowsallSUCCESS exactIDs
inNATIVE_PREVIEW04.md. Native05/profile/runtime/data/offline/performance/actualclean
checkout/ending-SHA finalcertification remainopen.

## Preview05 / actual clean checkout — 2026-10-15

- d164420d native05 build532tasks PASS3m52s; exact1106-file source inventory
  a3e8c1558dd4636a7a0cf12a6055123e217a215bc41e0365ca0f3e885efe7407,
  zero differences. APK991438e79c0c536797a628d62e71488913c1b74d456b11d27c9b958b4b752508,
  52,305,467B;8 permissions unchanged. Install-r/devicehash PASS; exact SQLite
  db/wal/shm unchanged; working copy integrityok/sessions8/settingshash retained.
  Launch13,195ms under full-checkout load is unresolved/not quiet perfPASS.
- Default36/36 capture PASS,18 surfaces×directly observedlight/dark411dp. Reviewer
  viewed everyPNG/hash/witness, noP1/P2. Root inspected9 keyframes. Endpoints
  below fold remain unproven; game-intro is first-play sheet, background Start
  hidden, not an accessible-action proof. P3 thinblue seam preserved.
- Actual independent clone atd164420d, fresh dependencies/no inherited native
  folders; full unflagged certify-clean-checkout PASS/exit0. All composite gates
  including real parent provenance/types/lint/web/dependency/strictspecs/full
  Jest/classifier/cleanstatus PASS.694suites7885tests5snapshots,297.471s,5 reviewed
  skips,failed0. Preserved summary SHAe0aa3bf1fa9437023c88f3cca54c18472777f4a9419a3995373c17d9c180cb8a.
  No worker forced-exit warning. Expo forced-exit and final NodeDEP0190 warning
  retained; no clean-teardown or native/runtime claim. NATIVE_PREVIEW05.md.
- Root shared status/type focused2suites19tests PASS38.582s. Requested nonexistent
  spotlight-card test path adds no suite; actual spotlight.test.ts path identified.
  Final source integration still pending three bounded functional-vector packets.
- Prodata05ca16b7bc running with40sec MCPwatch. No merge/replace/offline/data journey
  outcome inferred. New06 native/fullprofile/runtime/perf/finalCI/handoff open.

## Status/operation convergence

A17suites78tests;B149/1680;C19/88 PASS. Initial C13suites26assertions failed on
unsupported RNTL14 fixture APIs; root corrected actual SVG queries, not app logic.
Initial types fail fixture APIs/three readonly tuple signatures; current
standalone types05 PASS/exit0. Initial lint9unusedimports, partialfix02 retained;
current full-source lint03 PASS/exit0 plus scoped9files zero warnings.
Whole Jest06 PASS702suites7903tests5snapshots306.233s,5reviewedskips/classifierPASS.
It predates final inline-data feedback:2 valid before failures, after49/49 PASS.
Final clean-source composite/full Jest still required. Strict62/registry/
provenance/ownership/offline1006/runtime-QA/Expo23/workflow4/map55/repo-state PASS.

Data05completed107steps6973.7s;9 asserts ALL INCONCLUSIVE, no checkerPASS. Root
independent post-task SQLite integrityok/counts preserved/settings unchanged;
network0/2/1restored. Root viewed actual Memory accidental-start/Attention988→945/
offline representative/finalHome images. Replacewrite/text-edit invalidation
NOT VALIDATED; offlineart/navigation distinct from gameplay. Post-tasklaunch
timeout14.7s under checkload remains unresolved until quiet final measurements.
Full details in STATUS_CONVERGENCE.md/RUNTIME_DATA05.md. Native06/profile/workout/
focusedrestore/perf/finalcertification/handoff stillOPEN.
