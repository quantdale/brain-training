# Preview05 and actual clean-checkout certification

Source `d164420d9bb108dae05b350c115f62ce4e336333`, 2026-10-15. Intermediate
qualification; Campaign077 remains ACTIVE. Local immutable artifacts are under
`qa-artifacts/campaign077/native-preview05/` and the separately named checkout log.

## Native identity and preservation

Exact committed archive:1106 app files, zero source differences, inventory SHA256
`a3e8c1558dd4636a7a0cf12a6055123e217a215bc41e0365ca0f3e885efe7407`.
Native configuration matches04; generated Android project reused. Gradle release
PASS,3m52s,532 tasks (24 executed/508 up-to-date),2478 Metro modules.

APK `991438e79c0c536797a628d62e71488913c1b74d456b11d27c9b958b4b752508`,
52,305,467 bytes, `com.braintraining.app`0.1.0/1000,x86_64,target36,
debug-signed release. Packaged8-permission allowlist unchanged/PASS. Install-r
SUCCESS and actual installed APK hash matches. Not ARM64/store-signing proof.

Before/after exact SQLite db/wal/shm files are separately preserved, compared
byte-for-byte unchanged across installation. Independent working-copy checks:
integrity `ok`,8 sessions, persisted System preference absent/default, settings
SHA256 `a50813e8b2f4cf43007e4974865a96f85f080e8db3b32d006edee347b9cc2ec9`.
Previous Oct14 active workout/index2 and new Oct15 active/index0 are distinct.
The initial launch measured13,195ms (Wait13,257ms) during the full clean-checkout
test load. This is an unresolved performance observation, not accepted quiet
launch evidence; final quiet measurement remains required.

## Default screenshot review

`routes-default/manifest.json`:36/36 structural captures PASS,18 surfaces in both
directly observed themes, default411dp; no missing/blank/aborted entries. Theme
witness binds the settings above to this installed APK. Independent reviewer
actually viewed all36 PNGs and verified their hashes/witness; no newP1/P2 in these
first viewports. Root also viewed Home, Progress, Training history, populated
Attention/Deduction Table, data, saved weak Results, and first-play intro frames.

Verified visible corrections: performance/rating labels and explanation; singular
1session; UTC calendar/within24hours; duplicate recovery instruction removed.
Prior02 blank Profile does not recur in either default theme. Its original cause
is still unknown; old failed evidence remains preserved.

Limits: rating numeric endpoints fall below Attention's first viewport and need
a scrolled witness. `game-intro` is the normal first-play tutorial sheet over the
intro, exposing Watch a demo; background Start is hidden from accessibility and
cannot be claimed interactive before completion. Its thin blue sheet seam isP3.
No compact/2x/expanded/reduced-motion acceptance is inferred. Baseline has6 saved
sessions/completed4of4; current has8/new-day0of4. Gallery comparisons must disclose
this real state difference rather than claim matched workout states.

## Actual independent clean checkout

Disposable **independent clone**, not a linked worktree:
`D:/bt077-cert-d164420d`, exact clean d164420d, no inherited dependencies or native
folders; local `git clone --no-hardlinks --single-branch --branch main`, origin
reset to the canonical GitHub URL. Identity witness:
`clean-checkout-d164420d-identity.json`.

Actual command `node scripts/certification/certify-clean-checkout.mjs` with **no
skip/diagnostic options**, terminal exit0 and `certify-clean-checkout: PASS`.
Includes fresh npm ci; repo-state/ownership/strict OpenSpec; registry; provenance
against real `HEAD^` (origin/main equals HEAD); validator self-tests; offline,
secrets, workflow, dependency audit, affected map, runtime contract; full global
types/lint;22-route web export;23-pin Expo alignment; full Jest and signal
classifier; clean Git status after execution. It is not merely the self-test.

Full Jest:694 suites/7885 tests/5 snapshots PASS,297.471s;4 suites/5 explicitly
reviewed opt-in tests skipped, zero failures/unclassified skips. Preserved summary
`clean-checkout-d164420d-jest-summary.json`, SHA256
`e0aa3bf1fa9437023c88f3cca54c18472777f4a9419a3995373c17d9c180cb8a`.
No worker forced-exit warning found in this run; earlier04 remains unidentified.
The22-route web export exits0 but again emits Expo's forced-exit housekeeping
message. Composite's final Node DEP0190 warning is retained, not hidden.
The composite does not build native Android/iOS or certify device behavior.

## Next convergence

Read-only all42 reconciliation confirms all game rows/repair packets exist, with
no remaining confirmed High/Critical source issue in their ledger. It exposesP2
font-based status/control glyphs across games and celebration text outside shared
type roles. Three explicit disjoint game packets plus root-owned shared edits
finish this bounded consistency gap; puzzle stimuli/cosmetic data and all
mechanics/timing/persistence remain unchanged. Full required profiles will use
the resulting build. Pro data/restore/scrolled/offline-art journey on05 is tracked
separately; no result or full offline/gameplay PASS is claimed here.
