# Campaign 043 — Independent Platform & Release-Boundary Validation

**Status:** READY FOR EXECUTION  
**Repository:** `quantdale/brain-training`  
**Starting state:** Campaign 042 technically certified at validated product SHA `557c77606b94018afa119896d81a59e06fb220f1`; terminal repository tip before overnight planning `d7b1cd5f85d610f03ff2f5e130732c92c5262447` plus overnight-roadmap documentation commits on `main`  
**Mode:** release-boundary observation + platform validation + precise manual/external handoff  
**Primary evidence root:** `docs/redesign/evidence/campaign043/`

---

## 0. Mission

Campaign 042 closed the known technical blockers for the exercised Android/emulator scope.

Campaign 043 should now independently validate as many remaining **release boundaries** as the actual environment can support, while refusing to fabricate unavailable platform or human evidence.

The key question is:

> Which release claims can be independently demonstrated now, and which claims still require a human, physical device, iOS environment, signing infrastructure, store path, or system UI unavailable to this session?

This campaign is intentionally observation-heavy and implementation-light.

Do not reopen product design or add features.

If a new current product defect is reproduced, a bounded repair is authorized. Otherwise preserve the technically certified product core.

---

## 1. Evidence doctrine

Do not blindly trust Campaign 042.

Verify the current repository/runtime before relying on its conclusions.

Confidence order:

1. current reproducible runtime observation;
2. current persisted state;
3. executable tests/validators;
4. current source/configuration;
5. current build/package behavior;
6. current external platform/API evidence;
7. historical evidence.

Label unavailable boundaries clearly.

Never describe automation as human validation.

---

## 2. Startup and Git safety

At start:

- fetch remote;
- inspect branch, HEAD, `origin/main`, status, worktrees, stashes, local-only commits;
- preserve all concurrent/user work;
- record exact starting SHA;
- inspect current Campaign 042 closure and current source;
- inventory available platform/tooling:
  - Android SDK/emulators;
  - physical Android devices visible through ADB;
  - ARTEMIS;
  - Maestro/UIAutomator;
  - computer use;
  - iOS simulator/device tooling if genuinely present;
  - signing assets/configuration without exposing secrets;
  - GitHub/network access;
  - system share/document-picker capabilities.

Never force-push, reset away unknown work, or commandeer a user-owned device.

---

## 3. Release APK baseline

Build a fresh release APK from the current product SHA.

Verify:

- build success;
- install success on a dedicated automation-owned Android runtime;
- launch with Metro/dev server unavailable;
- Home;
- Games;
- Progress;
- Profile;
- representative Game Detail;
- representative gameplay;
- Result;
- force-stop/relaunch;
- offline startup;
- persisted state;
- no RedBox/dev dependency;
- logcat free of fatal/ANR markers.

Record APK hash and package/version metadata.

---

## 4. Android system UI boundaries

Exercise supported system surfaces where the app exposes them.

Examples may include:

- document picker / Storage Access Framework;
- export destination;
- import source;
- share sheet;
- file chooser;
- permission dialog;
- external intent return behavior.

Do not assume these exist; discover actual current routes/actions first.

For each reachable boundary verify:

- app launches the intended system surface;
- cancel returns safely;
- success returns safely where an automation-owned fixture can be used;
- no navigation trap;
- no stale loading state;
- no data corruption;
- no secret/path leakage into committed evidence.

System UI automation is supporting engineering evidence, not human usability validation.

---

## 5. Physical Android boundary

Inspect whether a physical Android device is genuinely available **and clearly authorized for automation**.

If no such device exists, mark:

`PHYSICAL_ANDROID_PENDING`

Do not use an arbitrary attached device merely because ADB can see it.

If an automation-authorized device is genuinely available, perform a bounded smoke:

- install intended build;
- launch;
- Home;
- start representative game/workout;
- result;
- force-stop/relaunch;
- offline if safe;
- basic rendering;
- log review.

Do not wipe user data or change device-wide settings unnecessarily.

---

## 6. Android TalkBack boundary

If TalkBack can be enabled safely on a dedicated automation-owned runtime, perform a **technical traversal**.

This is not human screen-reader UX certification.

Inspect:

- focusability;
- focus order;
- labels;
- duplicate labels;
- hidden controls;
- modal/overlay behavior;
- bottom-tab navigation;
- primary actions;
- result navigation.

Cover representative:

- Home;
- Games;
- Game Detail;
- intro;
- Results;
- Progress;
- Profile;
- Data Management.

If tooling cannot reliably drive TalkBack, classify it as pending instead of inventing success.

---

## 7. iOS / VoiceOver boundary

Determine whether a legitimate iOS environment exists.

On a Windows-only host, absence is expected and should be stated plainly.

Do not simulate iOS validation from static source inspection.

If a genuine connected remote/macOS/iOS environment is available through authorized tooling, perform the strongest safe smoke possible.

Otherwise mark:

- `IOS_RUNTIME_PENDING`
- `VOICEOVER_PENDING`

No fake iOS evidence.

---

## 8. Human usability/accessibility boundary

An independent human participant is required for genuine human validation.

If no independent human is present, do not use the implementation agent, ARTEMIS, computer use, or scripted automation as a substitute.

Create a concise manual test protocol covering:

- cold launch understanding;
- start Today workout;
- find a game;
- understand Game Detail;
- complete result;
- understand Progress;
- locate settings/data;
- large-text/screen-reader observations;
- system share/document interactions.

Record exact tasks and observation fields, but no findings.

---

## 9. Signing/install/store boundary

Inspect current signing/release configuration without exposing secrets.

Determine what can actually be verified locally:

- unsigned/release APK;
- debug keystore only;
- legitimate release signing configuration;
- store bundle generation;
- package/version consistency.

Do not commit:

- keystores;
- passwords;
- signing properties;
- tokens;
- store credentials.

If production signing/store installation cannot be genuinely executed, record the exact boundary.

---

## 10. Bounded defect repair

If this campaign reproduces a current product defect:

1. reproduce;
2. minimize;
3. identify root cause;
4. add regression coverage where practical;
5. make the smallest coherent fix;
6. run focused tests;
7. rerun affected platform/native validation;
8. run appropriate broader gates;
9. document before/after.

Do not make speculative changes to “improve compatibility.”

---

## 11. Repository validation

At campaign closure run risk-appropriate current gates.

At minimum if product source changed:

- focused tests;
- full Jest;
- typecheck;
- lint;
- relevant validators;
- OpenSpec;
- Expo Doctor;
- Android debug/release build;
- web export;
- persistence/relaunch smoke.

If no product source changed, a lighter but still current verification is acceptable, provided exact commands/results are recorded.

---

## 12. Required evidence

Create at minimum:

- `docs/redesign/evidence/campaign043/CAMPAIGN043_CLOSURE.md`
- `RELEASE_ANDROID_BASELINE.md`
- `ANDROID_SYSTEM_UI_BOUNDARIES.md`
- `PHYSICAL_ANDROID_STATUS.md`
- `TALKBACK_TECHNICAL_TRAVERSAL.md`
- `IOS_VOICEOVER_STATUS.md`
- `SIGNING_STORE_BOUNDARY.md`
- `HUMAN_VALIDATION_HANDOFF.md`
- `DEFECT_REPAIR_LOG.md`

Do not create fake evidence for unavailable lanes.

---

## 13. Final verdict

Use exactly one:

### `CAMPAIGN_043_COMPLETE`

Only if all campaign-scoped boundaries that are genuinely available in the environment have been validated and no unresolved campaign-scoped product defect remains.

This still may include explicitly unavailable human/iOS/physical/store boundaries if the environment genuinely cannot provide them; the closure must make that distinction obvious.

### `CAMPAIGN_043_PARTIAL_MANUAL_PLATFORM_PENDING`

Use when useful automated/platform work is complete but material manual/platform evidence remains outstanding.

This is an acceptable overnight result and does not prevent independent Campaign 044 work.

### `CAMPAIGN_043_BLOCKED`

Use if a current product/platform defect blocks safe progress or release behavior cannot be established on the available supported runtime.

---

## 14. Overnight progression

Campaign 043 is part of the coupled overnight roadmap:

`docs/redesign/CAMPAIGN043_050_OVERNIGHT_ROADMAP.md`

If Campaign 043 ends PARTIAL solely because human/iOS/physical-device/store evidence is unavailable, checkpoint it honestly and proceed to Campaign 044.

Do not spend the entire overnight session waiting for unavailable manual evidence.

---

## 15. Core directive

**Validate real release boundaries. Preserve the technically certified core. Do not fabricate unavailable platform or human evidence. Repair only reproduced defects. Leave a precise handoff, then continue into Campaign 044 when safe.**
