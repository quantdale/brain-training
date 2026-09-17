# Campaign 030B dynamic golden-path runtime evidence

Date: 2026-09-17

Runtime: disposable `braintraining-c030b`, serial `emulator-5562`, Android 35
Google APIs x86_64, 1080 x 2400 at density 420.

## Driver and authorization

The preferred ARTEMIS/OpenCode Go route was not usable in this session. The
external ARTEMIS evidence available at the start records the OpenCode route
returning HTTP 503. The target-bound diagnostic for `emulator-5562` reported a
successful device probe (208,924 screenshot bytes and 35 hierarchy elements),
but no helper was installed and no task was started; the fresh credential view
exposed only the configured Gemini provider, which was not an authorized
substitute. No credential was printed or written to the repository.

Campaign 030B §6.2 explicitly authorizes the deterministic fallback in this
case. The journey used only:

- explicit `adb -s emulator-5562` commands;
- UIAutomator XML and stable resource IDs/content descriptions to locate the
  current controls;
- repository-native development-only QA controls already present in the app;
- the QA force-win action to finish deterministic rounds.

No production logic, hidden backdoor, scoring rule, workout selection, or test
assertion was changed. No host mouse, keyboard, focus, or physical device was
used. The exact action/hierarchy captures are retained outside Git under
`D:\Temp\campaign030b-flow` and `D:\Temp\campaign030b-resume`.

The dynamic run used the same effective product source baseline as the exact
current checkout. Its initial debug artifact was the already rebuilt APK
`5d832caeeb2a683dedef58fbba059bad2ce2b3701963f057822daf247248ce` (83,382,549
bytes; SHA-256). The current product source had no change between that run and
the later universal APK
`80e9b29134fb70d7c45e30b7bb0fb6f6e90ee8d358b1880b9fa236e98a877d6a`. The later
universal APK was reinstalled and passed a fresh Home/tree check and the full
22-surface matrix; the packaging-only artifact distinction is recorded rather
than hidden.

## Standard workout: start → play → result → next → completion

The first run began at a populated Home / Today screen. The Home CTA
`home-workout-continue`/Start-today action opened the standard four-game
workout. The first leg was Cue Keeper (`memory-prospective-cue`). Its first-use
tutorial exposed the repository-native `tutorial-skip` and `tutorial-next`
controls; tutorial, demo, ready-intro, active-session, pause, and result states
were each captured.

| Step | Observed state and assertion | Evidence |
| --- | --- | --- |
| Cold/stable Home | Home title, Today workout, four legs, Start workout, and semantic bottom tabs were present after bootstrap | `D:\Temp\campaign030b-flow\home.xml`; first rendered proof in the visual index |
| Start workout | Home CTA entered the first game rather than a detached route | `session-start.xml`, `intro-ready.xml` |
| Intro/tutorial | Cue Keeper tutorial rendered; Skip and Next were available; after completion the ready intro exposed Start | `tutorial-next.xml`, `tutorial-done.xml`, `intro-ready.xml` and indexed tutorial/intro PNGs |
| Active gameplay | Cue Keeper session exposed `memory-prospective-cue.screen`, round 1/5, score/timer HUD, and QA controls | `screen-20260917-164915.png`, `session-start.xml`/active XML |
| Pause | Pause control opened `memory-prospective-cue.pause-overlay`; the rendered card said the challenge was hidden and timers frozen, with Resume and Quit | `paused.xml`, `screen-20260917-164943.png` |
| Resume | Resume returned to the session and the following round/result transition was observed | `resumed.xml`, `screen-20260917-165008.png` |
| Finish first game | QA force-win completed all five rounds and produced a populated Result: score 3,100, 17/17, 100%, 5/5, QA-forced, +50 XP and +10 coins, with Progress saved and Next Game | `result1.xml`, `screen-20260917-165031.png` |
| Next game | Next Game opened Context Fit (`language-context-fit`) intro/session, not Home; its active prompt and result were populated | `next-ready.xml`, `context-session.xml`, `screen-20260917-165105.png`, `screen-20260917-165132.png`, `screen-20260917-165159.png` |
| Third game | Next opened Transform Match (`spatial-transform-match`); QA force-win produced 5/5, 100%, score 750 | `next3.xml`, `transform-session.xml`, `screen-20260917-165214.png`, `screen-20260917-165255.png` |
| Fourth game | Next opened Fold Match (`spatial-fold-match`); QA force-win produced 6/6, 100%, score 900, and a populated `workout-complete` result state | `next4.xml`, `fold-session.xml`, `screen-20260917-165313.png`, `screen-20260917-165349.png` |
| Workout completion | Result visibly said “Workout complete — nice work!”; Home then showed “Workout complete”, 4 of 4 games done, all four legs Done, and disabled reroll | `result4.xml`, `home-complete.xml`, `home-complete-20260917-1655.png` |

This proves the required current-baseline mechanics through all four standard
legs: Start, intro/tutorial, active play, pause/resume, populated per-game
Result, Next Game continuation, x/4 progress, and workout completion. The
control was deterministic but still exercised the production GameHost,
GameResults, workout, persistence, and navigation paths.

## Interruption, resume, relaunch, and persistence

After the first completed run, the disposable package was cleared with
`adb -s emulator-5562 shell pm clear com.braintraining.app`. A fresh launch
returned to Home at 0/4. The second run then proved unfinished-workout and
process persistence without relying on the first run's completed state.

### Background interruption

While the first game was in progress, the emulator Home key was sent through
ADB. On foreground/relaunch, the app returned to the Cue Keeper pause overlay,
not to a completed round or a reset Home screen. The XML contained:

- `memory-prospective-cue.screen`;
- `memory-prospective-cue.pause-overlay`;
- `pause-title` with `Paused`;
- Resume and Quit controls.

The rendered pause evidence is
`D:\Temp\campaign030b-resume\pause-after-background-relaunch.png`. A delayed
capture that showed the launcher and a delayed capture that showed a round
result are intentionally not used as active-state claims.

### Process kill and unfinished-leg resume

The app was force-stopped and relaunched while the workout was unfinished. The
resulting Home XML/screenshot showed 0/4 and Cue Keeper as `Now`, with the other
three legs `Up next`. Re-entering the CTA opened Cue Keeper's intro without
replaying the already completed first-use tutorial. Finishing that leg through
the existing QA control produced a Result, then Home showed 1/4 with Cue Keeper
`Done` and Context Fit `Now`.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Cold Home after clear | 0/4, Start workout, Cue Keeper Now | `home-initial.xml` |
| Relaunch after background | Same active Cue Keeper pause overlay with frozen timers | `after-background-relaunch.xml`, `pause-after-background-relaunch.png` |
| Force-stop/relaunch mid-workout | Home returned with the persisted unfinished workout and correct current leg | `after-process-kill.xml`, `home-after-process-kill.png` |
| Resume entry | Cue Keeper intro returned without first-use tutorial replay | `reenter.xml`, `reenter-briefing.xml` |
| Complete one resumed leg | Result asserted QA-forced completion; Home advanced to 1/4 and Context Fit became Now | `reentered-result.xml`, `home-progress1.xml` |
| Relaunch after 1/4 | Home still showed 1/4, Cue Keeper Done, Context Fit Now | `home-persisted1.xml`, `home-persisted1.png` |

### Persistence and idempotency observations

The first completed run's Data Management XML reported one workout instance,
four tutorial states, four sessions, five ratings, seven history records, and
four ledger records. After the clear and one resumed leg, Data Management
reported one workout instance, one tutorial state, one session, two ratings,
two history records, and one ledger record. Reopening/relaunching did not add a
second session or ledger entry, and the 1/4 state remained stable.

The Data Management hero displayed `Local database — Empty` while those table
counters were populated. The source uses a zero storage-byte fallback when its
size query is unavailable; this is an observed storage-size presentation
inconsistency, not observed data loss. It is recorded as a medium trust/
observability follow-up and was not “fixed” in this evidence-only campaign.

## Error and offline coverage

The deterministic `braintraining://storage-unavailable` fixture rendered the
actual Storage Unavailable screen with local-data safety copy and a visible
Retry action. The screenshot is indexed in the visual baseline. One Retry tap
did not clear the fixture within that attempt; a controlled force-stop/relaunch
returned to the persisted Home state. The error presentation is therefore
observed, while successful in-place Retry recovery remains unverified.

The app's offline-first architecture and local persistence are supported by
source/tests and the offline validator. A separate runtime network-disabled
journey was **NOT VALIDATED** because the available harness did not expose a
safe network toggle/fixture for this session; no offline runtime pass is
claimed.

## Exact limitations

- This was deterministic semantic/ADB fallback evidence, not an ARTEMIS model
  trace. No ARTEMIS task was started because the authorized provider route was
  unavailable.
- The fallback proved the standard workout through all four configured legs,
  but it is not exhaustive coverage of all 42 games or every game mechanic.
- Human comprehension/usability and physical-device behavior remain
  `PENDING_PHASE_031`.
- Cold-start root-only UI dumps observed during 4–8 second bootstrap windows
  are warm-up observations, not claimed product states.
