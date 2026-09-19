# Campaign 051 Final Native Validation

**Verdict:** `CAMPAIGN_051_VISUAL_REBOOT_COMPLETE` for the repository-owned
Android/native scope
**Target:** `braintraining-ui35` / `emulator-5554`
**Platform:** Android 15 / API 35, 1080x2400, density approximately 420
**Mode:** day

## Final release artifact

- `:app:assembleRelease --no-daemon` — **PASS**.
- APK install with ADB — **PASS**.
- Resolved activity — `com.braintraining.app/.MainActivity`.
- APK size — **109,576,793 bytes**.
- SHA-256 — `C91389622D7D90B58065550FC1F28A30D0086103D99A5956FDEA501667806A4C`.
- The final APK was installed after the compact Results and GameHost
  accessibility fixes and was launched Metro-free on the dedicated device.

## Native before/after visual proof

The source autopsy baseline was rebuilt as a release APK from the exact
Campaign 051 start SHA `2a1a0c38be80eb6e65a9105e8d1c22999611a66e` in a detached
worktree. The debug variant was excluded because it does not package the
Metro-free JavaScript bundle.

- Baseline release APK: 109,558,148 bytes,
  SHA-256 `DFD4C2A21ADF6388A7B2A5CC5C527680A6B45B11596E69578E7CB1C9B424C629`.
- Baseline captures: `D:\Temp\campaign051-before-home-release.png`,
  `D:\Temp\campaign051-before-games-release.png`, and
  `D:\Temp\campaign051-before-game-detail-release.png` plus UIAutomator XML.
- Restored final captures: `D:\Temp\campaign051-after-home-release-restored.png`,
  `D:\Temp\campaign051-after-games-release-restored.png`, and
  `D:\Temp\campaign051-after-game-detail-release-restored.png` plus XML.
- The final APK was reinstalled after the comparison and a fresh Home launch
  produced a nonblank frame with no filtered `ReactNativeJS:E` or
  `AndroidRuntime:E` entries in the retained sample.

The first native completion lane used the same dedicated AVD. Repeated
force-stop route probing later left Android framework services unavailable;
only the disposable `braintraining-ui35` AVD was recovered (clean boot with
data wipe), the final APK was reinstalled, and the exact artifact received a
fresh ARTEMIS smoke. This is test-device recovery, not a product data-loss
claim.

## Native visual matrix

All captures were route-verified and nonblank. Each matrix contains the same
11 surfaces: Home, Games, Game Detail, Progress, Progress Activity, Progress
Detail, Profile, Rewards, Data Management, Results, and GameHost intro.

- Default light/dark: **22/22 captures** under
  `D:\Temp\campaign051-native-final-20260919-default`.
- Compact 720x1600 light/dark: **22/22 captures** under
  `D:\Temp\campaign051-native-final-20260919-compact`.
- Android font scale 2 light/dark: **22/22 captures** under
  `D:\Temp\campaign051-native-final-20260919-font2`.
- Total current Campaign 051 matrix: **66/66 captures**.
- The capture harness now resets system font scale for every profile, so a
  compact run following font-scale-2 cannot inherit the preceding profile.

The compact pass reproduced and closed the two remaining current findings:
the tutorial's hidden-behind content is removed from the accessibility tree,
and compact Results metrics wrap into a readable 2x2 layout. The final audit
reported zero measured violations for default, compact, and font-scale-2
profiles. Clipped rows called out by the audit are scroll-under-tab evidence,
not undersized or unlabelled controls.

## Catalog and invalid-route reachability

- Generated registry count: **42 game IDs**.
- Final installed APK, paced semantic deep-link sweep: **42/42 first-pass
  route arrivals**; no retries or failures.
- Invalid `braintraining://game/not-a-real-game` route: **PASS** — rendered
  the `game-title`/not-found fallback, did not render `Storage Unavailable`,
  and returned to MainActivity/Home.

## ARTEMIS runtime evidence

All device actions were emulator-local semantic actions; no host mouse,
keyboard, focus stealing, QA controls, or force-complete controls were used.

- Pro workout trace `d347c773-7e39-491a-b8cc-d5f0b3e13c82`: started through
  visible Today's Workout context, completed four ordinary legs — Signal
  Watch (480), Next in Sequence (651), Symbol Tracker (0 by natural timeout),
  and Word Scramble (800) — with visible pause/resume, Next game x3,
  Finish workout, `4/4 games saved`, four Done rows, Progress `55 sessions /
  8 of 8`, and UI-driven Settings/Apps force-stop plus launcher relaunch.
  The task summary records exact labels and screenshots. Three optional
  provider/schema verifiers were inconclusive; the execution history and
  manual screenshot evidence independently confirm the checkpoints.
- Exact final APK Flash trace `046ba41c-2e1b-447f-b5b5-c1a04c2569b9`: recovered
  from the intentionally invalid-route starting state, opened the visible
  Games catalog, launched Signal Watch, respected its tutorial, allowed
  ordinary natural timeouts through the 30-trial session, and verified
  `Session complete / Final score 480 / +22 XP earned! +4 coins · Progress
  saved`. Visible Done/back/Home navigation ended on usable Home.
- Earlier exploratory trace `08161201-ec31-4c10-8759-0779829a19ef` and the
  stale standalone trace `8ebfe381-ddb6-4fcf-9aa6-259ed787ea4b` are excluded
  from the pass count.

## Boundaries

Human TalkBack/VoiceOver quality, physical/OEM Android, iOS runtime,
production/store signing, human system-provider usability, and external CI
execution remain external/manual boundaries. They are not inferred from this
local native evidence.
