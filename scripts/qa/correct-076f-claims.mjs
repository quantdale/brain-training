// Correct stale 076-f annotations that contradict the current parent disposition.
//
// Each annotation in tasks.md is ONE long line, so matches use short single-line
// anchors and each correction is APPENDED, leaving the original claim visible as
// history rather than deleting it.
import fs from 'node:fs';
const NL = String.fromCharCode(10);
const BT = String.fromCharCode(96);
const code = (s) => BT + s + BT;
const F = 'openspec/changes/076-f-final-product-certification/tasks.md';
let s = fs.readFileSync(F, 'utf8');
let n = 0;

function correct(anchor, correction, label) {
  if (!s.includes(anchor)) { console.error('NOT FOUND: ' + label); process.exit(1); }
  if (s.includes(anchor + NL + correction.split(NL)[1])) { console.log('already applied: ' + label); return; }
  s = s.replace(anchor, anchor + NL + correction);
  n += 1;
  console.log('corrected: ' + label);
}

// 1. Task 5.3 inferred "parent 14.3 is therefore checked" from the profile and
//    gameplay conditions being satisfied. That inference is exactly the over-claim
//    5.3 exists to prevent.
correct(
  'Parent task 14.3 is therefore checked, with the linked evidence at `evidence/ROUTES_AND_A11Y.md` and the 42 `current-device/<game>/review.md` rows.',
  ['',
   '  **Corrected 2026-10-13.** The profile and gameplay conditions above are satisfied and that part stands.',
   '  What the earlier sentence got wrong is the inference drawn from it: satisfying them is not the same as',
   '  satisfying parent 14.3, which additionally requires **matched** before/after matrices for compact/large',
   '  layouts and reduced-motion. No historical before profile exists for either, so those matched matrices',
   '  cannot be produced without rebuilding the pre-redesign baseline, and **parent 14.3 stays unchecked** —',
   '  while task 5.3 itself remains done, because its condition is about profiles and gameplay, not about the',
   '  image pairing 14.3 also demands. Exact missing surfaces: ' + code('evidence/coverage-matrix.json') + ' and',
   '  ' + code('evidence/VISUAL_DECISION.md') + ' §6.'].join(NL),
  'task 5.3 inference');

// 2. Task 8.1's residual list carried 14.7 as unchecked.
correct(
  '**14.7 — LEFT UNCHECKED.** Per-game manifest, APK SHA, device hash, residual debt and explicit gaps are all present, and no game is missing. What is owed is the **3-direction scorecard / reference lock as a 076 artifact** and the matched before/after images; the Campaign 051 lock predates this APK. Owner: repository-owned follow-up.',
  ['',
   '  - **14.7 — superseded 2026-10-13: now CHECKED.** The above understated what was already present, and what',
   '    it called owed is now published: the per-game/route coverage matrix',
   '    (' + code('evidence/coverage-matrix.json') + ', 216 rows), the visual decision report',
   '    (' + code('evidence/VISUAL_DECISION.md') + '), the three-direction scorecard and reference lock',
   '    (' + code('evidence/proto-scorecard.md') + ', ' + code('evidence/REFERENCE_LOCK.md') + '), the',
   '    matched-image index, all three APK identities, and the residual gaps. The scorecard and lock are linked',
   '    as the decision records they are — graded on the prototypes before the redesign landed — rather than',
   '    restated as terminal-APK evidence.'].join(NL),
  'task 8.1 14.7 disposition');

// 3. The same paragraph claimed 14.3 was checked.
correct(
  'Parent 14.3 is checked from the 076-f side and its own parent row records the same matched-image gap.',
  ['',
   '',
   '  **Corrected 2026-10-13.** Parent **14.7** is checked from the 076-f side. Parent **14.3 remains open**,',
   '  for the one reason this campaign cannot manufacture from existing evidence: it requires matched',
   '  before/after matrices for compact/large layouts and reduced-motion, and no historical before profile',
   '  exists for either. Additionally every historical game board measured light while every accepted game row',
   '  measured dark, so no game board result frame is pairable at all. Both facts are measured from the pixels,',
   '  not assumed from filenames, and both are recorded as exact missing surfaces rather than filled with',
   '  after-only observations.'].join(NL),
  'task 8.1 14.3 claim');

// 4. Task 8.5's verdict reason named both 14.3 and 14.7 as open.
correct(
  'The remaining blockers are the two repository-owned, independently-executable gates the parent ledger still names: the matched terminal-APK before/after image set and the 3-direction scorecard / reference lock as a 076 artifact (**parent 14.3, 14.7**).',
  ['',
   '  **Updated 2026-10-13.** Parent **14.7 is now closed**: the coverage manifest, visual decision report,',
   '  three-direction scorecard and reference lock, matched-image index, artifact hashes and residual gaps are',
   '  all published. The remaining blocker is the single repository-owned gate the parent ledger still names —',
   '  the **matched** terminal-APK before/after image set (**parent 14.3**). It stays open for the reason only',
   '  the owner-excluded baseline rebuild could close: matched compact/large and reduced-motion matrices have',
   '  no historical before profile, and no game board result frame is pairable because every historical board',
   '  measured light while every accepted row measured dark.'].join(NL),
  'task 8.5 verdict reason');

fs.writeFileSync(F, s);
console.log(n + ' 076-f corrections applied');
