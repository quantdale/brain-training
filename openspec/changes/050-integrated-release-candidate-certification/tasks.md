# Tasks — Campaign 050

Campaign status: **VALIDATED**. Checked items record completed work or an
honest evidence classification; they do not convert unavailable external or
manual gates into PASS. Details are under `docs/redesign/evidence/campaign050/`.

- [x] Run the full Jest suite and all authoritative repository validators — local gates passed; Jest was 559 passed / 4 skipped suites and 6,575 passed / 5 skipped tests.
- [x] Run typecheck, lint, Expo Doctor, dependency policy, and raw-audit classification — all passed; accepted dependency advisories remain documented.
- [x] Run web export, offline validation, workflow validation, registry/provenance checks, and task ownership — all passed.
- [x] Build Android debug and release artifacts sequentially — both Gradle builds passed; non-fatal environment warnings are recorded.
- [x] Install the release APK without Metro and capture launch/log health — direct post-journey cold launch passed; the separate first-install ARTEMIS ANR is retained as conditional evidence.
- [x] Recheck the four-game workout and representative standalone-game evidence — four workout legs, Pattern Tap Back, and Signal Watch completed through ordinary flows.
- [x] Reconcile the all-42 registry/lifecycle summary to the current product SHA — Campaign 046's 42-ID certificate remains applicable because Campaigns 047–050 changed no game or registry source.
- [x] Recheck result persistence, force-stop/relaunch, backup/import smoke, and offline behavior — persistence and export share passed; import picker is NOT VALIDATED after an external Files-provider ANR; repository portability/offline evidence remains green.
- [x] Recheck Home, Games, Progress, Profile, Rewards, and Data Management — route and data-management surfaces were reached; Rewards evidence is inherited from the unchanged prior packet.
- [x] Recheck invalid-route recovery and the current Campaign 049 accessibility/state matrix — invalid route recovered; current font-scale-2 and compact matrices were 12/12 each with separate 0-violation audits.
- [x] Reconcile the Campaign 048 performance/reliability baseline and current external CI status — probes passed; current GitHub runs remain an external pre-step/account-policy boundary.
- [x] Run copy/medical-claim review and Git cleanliness/provenance checks — neutral copy scan and provenance checks passed.
- [x] Write the Campaign 050 closure and overnight handoff with explicit boundaries — closure packet and handoff updated.
- [x] Validate the OpenSpec change, update durable state, commit, and push the final checkpoint — terminal governance is reconciled after final validation and push.
