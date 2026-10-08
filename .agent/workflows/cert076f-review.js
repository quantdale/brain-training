// 076-f task 8.2 — independent read-only review, three parallel lanes.
// Reviewers must not edit. Findings only; CRITICAL/HIGH are blocking.
const root = (args && args.reviewRoot) || 'openspec/changes/076-f-final-product-certification';
const parent = (args && args.parentRoot) || 'openspec/changes/076-product-wide-ui-ux-reboot';

const common = `You are performing a STRICT READ-ONLY REVIEW of an Android/React Native
certification change. You must NOT edit any file. Report findings only.

Repository root is the current working directory. Read these paths:
  ${root}/evidence/  (all .md and .json files)
  ${root}/tasks.md, proposal.md, design.md, specs/terminal-product-certification/spec.md
  ${parent}/tasks.md  (the parent acceptance ledger)

Severity scale: CRITICAL, HIGH, MEDIUM, LOW.
Only CRITICAL and HIGH are blocking. Report every finding with:
  - severity, exact file path, and the specific claim or line that is wrong
  - why it is wrong, citing the authoritative evidence you checked
  - what the correct statement would be

Do not pad the report. If an area is sound, say so in one line.
End with: FINDINGS: <n> blocking (CRITICAL/HIGH), <n> non-blocking.`;

const lanes = [
  {
    key: 'provenance',
    task: `${common}

YOUR AREA: evidence provenance and source equivalence.
Read ${root}/evidence/PROVENANCE.md, SOURCE_EQUIVALENCE.md, provenance-table.md,
provenance-table.json and scripts/certification/build-provenance.mjs.

Verify specifically:
1. Does the provenance table actually contain the claimed row counts (302 =
   90 route + 2 route-scroll + 194 game + 16 rejected)? Count them.
2. Is every game frame labelled SOURCE_EQUIVALENT_HISTORICAL and explicitly
   NOT a terminal-APK capture? Find any row that overclaims.
3. Is the claim "ZERO files changed in the rendering-dependency closure since
   4a6fc53" actually supported by the generator's logic, and does the generator
   fail loudly if it stops being true?
4. Is the source-equivalence claim bounded (i.e. does it say it is invalidated
   by any later production edit)?
5. Are the two artifact identities (b2913bca at 4a6fc53 vs de6c5fcd at
   c324960) kept distinct everywhere, or is any frame described as a capture
   from an APK that did not produce it?`,
  },
  {
    key: 'assessment',
    task: `${common}

YOUR AREA: current-device game assessment, accessibility and layout.
Read ${root}/evidence/ASSESSMENT.md, assessment.json,
current-device/manual-review.json, ROUTES_AND_A11Y.md and
scripts/certification/build-assessment.mjs.

Verify specifically:
1. Does the assessment use ONLY PASS / FIXED / NOT VALIDATED / justified N/A?
   Find any row using another value or an unjustified N/A.
2. Is any row marked PASS without real evidence of active play, SCORED
   FEEDBACK (a quoted correct/incorrect/timeout verdict), pause, and result?
   An intro screen, an unanswered board, a filename, or a placeholder note
   ("(To be populated)", "(To be filled during execution)", "(Pending
   observation)") must NEVER count as scored feedback or as a pass.
3. Is the claim "4 PASS" actually supported by the underlying rows? For each
   PASS row, open its current-device/<game>/review.md and confirm the note
   describes THAT game and not a different one.
4. In ROUTES_AND_A11Y.md, is the 48dp-floor and label claim restricted to the
   nodes actually measured? Is the 32-occluded-node exclusion real and are
   occluded nodes kept OUT of the pass count? Does the file avoid claiming the
   route audit certifies game controls?
5. Is reduced motion honestly reported as still OPEN (not silently covered)?`,
  },
  {
    key: 'gates',
    task: `${common}

YOUR AREA: build/security gates, controller claims, and parent-task mapping.
Read ${root}/evidence/GATES.md, DEFECTS.md, CONTROLLER.md, JOURNEYS.md,
PARENT_RECONCILIATION.md and tasks.md.

Verify specifically:
1. Is the clean-checkout composite result reported honestly as FAIL (19/20),
   with the single failing gate named, and NOT dressed up as a pass? Is the
   self-test ever conflated with the composite?
2. Is the Expo Doctor failure classified using the repository's own settled
   decision (Change 069: upstream drift, not a repository defect) while still
   reporting the composite's literal FAIL? Is the hermetic gate
   (validate-expo-alignment.mjs) reported as a SEPARATE result rather than
   implied by the script?
3. Are the Jest baseline numbers (621 passed / 4 skipped suites, 7237 passed /
   5 skipped tests, 5 snapshots) and the strict OpenSpec total (61/61)
   reported without forcing the old 60/60?
4. Does CONTROLLER.md disclose the external QA-environment change (ARTEMIS
   default model rerouting) prominently, and does it avoid printing any
   credential?
5. In PARENT_RECONCILIATION.md: is any parent task pre-classified as DONE
   without its own linked evidence? Are the 25 unchecked parent tasks all
   accounted for? Is bulk-checking explicitly prevented?
6. Does DEFECTS.md correctly claim NO production edit (verify against
   git: only apps/mobile/src/app/(tabs)/index.tsx and progress-detail.tsx
   differ from 4a6fc53 outside __tests__)?`,
  },
];

const results = await runs.all(
  lanes.map((l) => ({ key: l.key, agent: 'reviewer', task: l.task })),
);

return {
  lanes: results.map((r, i) => ({
    key: lanes[i].key,
    output: (r && (r.output || r.result || r.final)) ?? String(r),
  })),
};
