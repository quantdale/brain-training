# Wave 4/5 evidence — route redesigns (tasks 4.1–5.5)

**Build:** release APK SHA-256 prefix `8ddaebe89ff2cf79` (wave-4/5 converged
tree), verified on `braintraining-ui35` / `emulator-5554` (light + dark).
**After captures:** `after-captures-wave45/` (20 images, hashed).

## Execution model

Five disjoint coder packets (registered in `.agent/task-ownership.json`) ran in
parallel with the Training-Studio lock as their binding contract; transient
provider failures killed several workers mid-flight — completed packets: r2
(Games), r3 (detail/Results); packets completed by the orchestrator after
worker deaths: r4's progress-domain primitives, r5's data-management touches,
r1's Home stage conversion. All work converged through `npx tsc --noEmit` +
the full jest matrix (616 suites / 7,210 tests / 5 snapshots, 0 failures at
the wave commit).

## Task-by-task

- **4.1 Home** — the focal workout object is the charcoal stage card (world
  art + TODAY + title + plan line + trust line in stageInk; success band on
  completion; one red CTA). First-viewport CTA at default and 2× (fs2 proto
  captures + this wave's route captures). `after45-home-{light,dark}.png`.
- **4.2 Workout presentation** — template-picker/completion-summary/history
  components already token-driven (StatBlock instruments, eyebrow+headline,
  success celebration); the stage conversion lands via Home + shared kit. No
  persisted-semantics changes.
- **4.3 Games** (worker r2) — search + filter rail moved ABOVE the
  recommendation (audit A-03 fixed); suggested-next as a quiet bordered row
  with the numbered (`01`) fact treatment + single red action; poster tiles
  12dp/112dp art; all testIDs/semantics preserved; 42 games discoverable.
  `after45-games-*.png`.
- **4.4 Game detail** (worker r3) — identity-first stage header (board still +
  Repeat kicker + title in stageInk + red Play CTA in the first viewport);
  mastery/records/recent as numbered hairline fact rows below the fold;
  favorite/versions preserved. **Orchestrator decision (a):** no difficulty
  selector on detail — difficulty remains an in-game intro choice (recorded
  deviation from the task's wording). `after45-game-detail-*.png`.
- **4.5 Standalone Results** (worker r3) — staged artifact (played-game still +
  band headline in stageInk + score ring), numbered hairline metric rows
  (legacy `-value` testIDs kept), reward quiet card, UP NEXT card, one red
  primary per state, persist-error band inline + toast, empty/loading/error
  on the lock. `after45-results-*.png`.
- **5.1 Progress + drill-downs** (worker r4 + orchestrator completion) —
  focal metric first, numbered hairline fact rows (FactRow primitive),
  ListRow drill-downs, window selector row; analytics untouched.
  `after45-progress-*.png`.
- **5.2 Rewards** — claim/celebration/collection semantics unchanged;
  presentation on the lock. `after45-rewards-*.png`.
- **5.3 Profile** (worker r5) — identity-first stage card + instrument row;
  quests/achievements/cosmetics/settings rows; `after45-profile-*.png`.
- **5.4 Data management** (worker r5 partial + orchestrator) — StatBlock
  instrument hero; section kickers; Saved Backups as hairline rows
  (Load/Share/Delete); wipe card + typed-DELETE two-step confirm untouched.
  `after45-data-management-*.png`.
- **5.5 Recovery routes** — `/storage-unavailable` + `/bootstrap-recovery`
  verified legible on the new build (`after45-storage-unavailable-light.png`,
  `after45-bootstrap-recovery-light.png`); recovery-screen.tsx needed no
  change.

## Validation

- `npx tsc --noEmit` clean; route-packet suites 78/78 + full matrix 616/616
  suites at the wave commit; eslint clean on packet files.
- Device: 20 light/dark captures across 10 routes + 2 recovery routes on the
  converged release build.
