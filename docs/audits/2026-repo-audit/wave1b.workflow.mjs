const P = 'docs/audits/2026-repo-audit/LANE_BRIEF.md';
const OUT = 'docs/audits/2026-repo-audit/';

const BUDGET =
  'TIME AND OUTPUT BUDGET (mandatory, a previous attempt at this lane timed out):\n' +
  '1. FIRST ACTION: create your report file with the full skeleton from the brief and a placeholder "in progress" line. Then APPEND to it as you confirm findings. Never hold findings in memory until the end.\n' +
  '2. You have roughly 35 minutes of wall clock. Do not read whole directories line by line. Prefer grep/read with offset+limit on the specific files your checks point at. Target at most ~60 tool calls.\n' +
  '3. Finish breadth-first over the CHECKS listed for your lane, then stop. A report that covers all checks with solid evidence beats a deep report on two checks.\n' +
  '4. Reserve your last ~5 tool calls to fix up the report structure so it still parses as the brief contract.\n' +
  '5. Depth requirements for the top 3 findings only; P3 items may be one-paragraph entries with a file:line pointer.\n';

const lanes = [
  {
    key: 'l03-sdk',
    task:
      'FIRST read ' + P + ' in full and follow it exactly.\n\n' + BUDGET +
      'LANE: Game SDK + registry + generator + bootstrap. Report file: ' + OUT + 'L03-sdk-registry-bootstrap.md\n\n' +
      'FILES (read these; do not enumerate the whole tree): apps/mobile/src/sdk/*.ts (33 files), src/registry/*.ts, src/bootstrap/*.ts, src/governance/*.ts, scripts/generate-game-registry.mjs, src/constants/*.ts, and one representative consumer game src/games/speed-tap-rush/{index.ts,hooks.ts,game-definition.ts}.\n\n' +
      'CHECKS:\n' +
      '1. SDK contract completeness: can a game module bypass required hooks or leave a timer/listener running? List the required-vs-optional surface from the SDK types.\n' +
      '2. Lifecycle symmetry in components/game-host/*: mount/unmount, interval/timeout/animation cancellation, AppState, BackHandler add/remove. Cite any asymmetry.\n' +
      '3. Session identity + duplicate-start: read src/components/game-host/session-identity.ts and use-game-session.ts; can two sessions start for one game, or can a retry reuse an id?\n' +
      '4. Event typing: discriminated unions, exhaustiveness, unknown-event handling, payload validation at the host boundary.\n' +
      '5. Version metadata + drift: gameVersion/generatorVersion/scoringVersion persistence, and the drift gate scripts/validate-provenance.mjs. Does --check actually gate CI (grep .github/workflows)?\n' +
      '6. Registry integrity: find the generated registry artifact, verify it is generated and deterministic (stable order, no timestamps/absolute paths), and that generate-game-registry.mjs --check passes now (run it; read-only).\n' +
      '7. Error containment: if a game reducer/render throws, is it contained or does it crash the app? Cite the boundary or state its absence.\n' +
      '8. RNG: read src/sdk/rng.ts; confirm generators never use Math.random and the seed derivation is stable/cross-platform.\n' +
      '9. Doc truth: compare docs/GAME_SDK.md and docs/PARITY_MATRIX.md claims against the actual SDK types; list contradictions with file pointers.\n\n' +
      'Use ID prefix L03.'
  },
  {
    key: 'l04-workout',
    task:
      'FIRST read ' + P + ' in full and follow it exactly.\n\n' + BUDGET +
      'LANE: Daily Workout engine. Report file: ' + OUT + 'L04-workout-engine.md\n\n' +
      'FILES: apps/mobile/src/workout/*.ts and the workout screens under src/app (find them by grep workout). Read src/db/workout.ts only for the persistence contract (its bug surface is lane L01; cross-reference, do not duplicate).\n\n' +
      'CHECKS:\n' +
      '1. Leg advance invariants: can a leg be skipped, replayed, or double-counted? Trace start -> complete -> next -> finish in code (not tests).\n' +
      '2. Substitute-and-preserve logic (campaign056): verify in code, do not trust the notes. What invariant does it maintain and is it tested?\n' +
      '3. Economy in a workout: is a workout leg applied exactly once (vs a single game)? Find the call into completeSession and any reroll/claim dedupe.\n' +
      '4. Persistence: which parts of an in-flight workout are persisted, and what is deliberately not. Is resume after force-stop correct? Is the state machine defined for abandon/quit mid-leg?\n' +
      '5. The workout instance schema and the MAX_WORKOUT_GAME_IDS bound (grep it) - is the bound enforced on every write path?\n' +
      '6. Timer/interval cleanup per leg and on unmount; BackHandler/header back inside a workout.\n' +
      '7. Test truth: for the workout suites under src/workout/**/__tests__, list what is asserted vs merely called; name the highest-risk untested invariant.\n\n' +
      'Use ID prefix L04.'
  },
  {
    key: 'l05-routing',
    task:
      'FIRST read ' + P + ' in full and follow it exactly.\n\n' + BUDGET +
      'LANE: routing, navigation, deep links, screens. Report file: ' + OUT + 'L05-app-routing-screens.md\n\n' +
      'FILES: apps/mobile/src/app/** (39 files), src/routing/*.ts, and the shared nav helpers (grep useSafeBack).\n\n' +
      'CHECKS:\n' +
      '1. useSafeBack coverage: count screens vs uses of the helper; grep every router.back / router.replace / navigation.goBack in src/app and classify each. Is any bare router.back() left? Does the catalog-guard test really cover all screens (find and read that test)?\n' +
      '2. Deep-link envelope: read src/routing/*.ts; test by reading the validators for type/length/enum/unknown-key/unicode/over-long input. What state-changing UI can an unauthenticated link reach? Give a concrete path.\n' +
      '3. Data-driven screens: which screens lack loading/empty/error state? Give the screen + the data source.\n' +
      '4. Stale data on focus: for a screen reached after a mutation (reroll, purchase, claim, wipe), does it re-read on focus? Cite the code.\n' +
      '5. Effect correctness: scan useEffect dependency arrays in src/app for stale closures and setState-in-effect (note the three existing eslint-disable sites: app/_layout.tsx:219, hooks/use-db-data.ts:72, hooks/use-color-scheme.web.ts:12) and judge whether each disable is justified.\n' +
      '6. Android back: hardware back while a modal/dialog is open, and back during a countdown/paused session.\n' +
      '7. Oversized/duplicated screens: list the 8 largest screen files by line count and name the mixed-responsibility ones.\n\n' +
      'Use ID prefix L05.'
  },
  {
    key: 'l06-ui',
    task:
      'FIRST read ' + P + ' in full and follow it exactly.\n\n' + BUDGET +
      'LANE: shared components + theme. Report file: ' + OUT + 'L06-components-theme.md\n\n' +
      'METHOD FIRST (one command, reuse the result): list every file in src/components and its line count, and for each exported component count how many files import it. Produce the inventory; it answers the dead-code question mechanically.\n\n' +
      'CHECKS (prioritized; the first three carry the most value):\n' +
      '1. Dead / test-only exported components with no product importer (BACKLOG already flags Avatar, ScreenHeader, LevelCard, StreakCard, ResultRow/StatRow, LiveRegion - confirm the exact list and whether any ADDITIONAL ones exist).\n' +
      '2. Rendering performance: inline object/array/function props defeating memo in the most-used components; context value churn; missing memo on the components used by all 42 game screens; any expensive work in a render body.\n' +
      '3. Accessibility primitives: MinTouchTarget enforcement (find the constant and every interactive component that does not use it), hitSlop correctness, reduced-motion support (src/components/a11y/reduced-motion.ts), font-scale robustness, live regions for toasts/errors, unlabelled interactive nodes in shared components.\n' +
      '4. Animation correctness: Reanimated worklet violations, animating layout props, unsettled animations, missing cleanup, shared-value leaks.\n' +
      '5. Style-system consistency: hardcoded colors/sizes outside tokens (grep for hex colors and raw numbers in components), missing dark-mode coverage, contrast risk.\n' +
      '6. Component API correctness: unsafe default props, uncontrolled/controlled mixing, callbacks during render.\n' +
      '7. Test coverage of load-bearing primitives: which of the 10 most-used components have no suite.\n' +
      '8. Doc truth: docs/DESIGN_SYSTEM.md vs the real tokens; list contradictions.\n\n' +
      'Use ID prefix L06.'
  },
  {
    key: 'l07-economy',
    task:
      'FIRST read ' + P + ' in full and follow it exactly.\n\n' + BUDGET +
      'LANE: economy, rating, streaks, quests/achievements, cosmetics/entitlements, analytics, notifications, assistant, content. Report file: ' + OUT + 'L07-economy-gamification.md\n\n' +
      'FILES: src/rating/**, src/streaks/**, src/quests/**, src/achievements/**, src/rewards/**, src/mastery/**, src/cosmetics/**, src/entitlements/**, src/personalization/**, src/analytics/**, src/notifications/**, src/assistant/**, src/spotlight/**, src/content/**, plus src/db/{rating,ledger,quests,achievements,economy,xp-awards}.ts.\n\n' +
      'CHECKS:\n' +
      '1. Ledger integrity: is the balance derived from the ledger or cached? Find every writer and prove append-only enforcement (db/schema.ts triggers). Can balance and ledger diverge, and is there a repair path?\n' +
      '2. Double-apply protection: list every reward grant path (session complete, workout leg, reroll, claim, claim-all, cosmetics purchase, streak item) and state the idempotency key/mechanism for each. Name any path WITHOUT one.\n' +
      '3. Rating algorithm: read src/rating + src/db/rating.ts. Prove or refute that easy-mode farming cannot inflate skill ratings (difficulty weighting). Check personal-best handling, sample-size handling, and the migration/repair path (note: v12 repair semantics is accepted debt - only report NEW defects).\n' +
      '4. Streak/time logic: day boundary, timezone, DST, device-clock change, retroactive edits, streak freeze. Cite code.\n' +
      '5. Quests/achievements: offline accrual, retroactive unlock, ordering, duplicate unlock, progress after data import.\n' +
      '6. Entitlements/QA controls: is any premium path client-side only; is every dev/force control __DEV__-gated (verify in code, cite every guard).\n' +
      '7. Analytics/notifications: schema versioning, unbounded growth, PII, dedupe, consent/opt-out, notification duplication.\n' +
      '8. Assistant/personalization: untrusted user text flowing into prompts or rendered output; output length bounds.\n\n' +
      'Use ID prefix L07.'
  },
  {
    key: 'l08-tooling',
    task:
      'FIRST read ' + P + ' in full and follow it exactly.\n\n' + BUDGET +
      'LANE: build, CI, validators, scripts, dependencies, release config. Report file: ' + OUT + 'L08-tooling-ci.md\n\n' +
      'I ALREADY REPRODUCED ONE ITEM - verify it and find the rest: in apps/mobile, `npx expo-doctor` exits 1 with "6 packages out of date" (expo ~57.0.26 expected vs 57.0.24 declared/installed; also expo-constants, expo-document-picker, expo-linking, expo-router, expo-sharing). CI step "Expo doctor" in .github/workflows/app-ci.yml has no continue-on-error, so main is red on that gate while docs/hardening/post067 claims "Expo Doctor 21/21". Confirm the exact expected-vs-found table and the exit code, and state the CI impact precisely.\n\n' +
      'FILES: .github/workflows/*.yml (4), scripts/*.mjs + scripts/*.cjs + scripts/{android,certification,perf,qa}/, apps/mobile/{package.json,app.json,metro.config.js,eslint.config.js,jest/setup.js,plugins,scripts,android}, .gitignore, apps/mobile/.gitignore.\n\n' +
      'CHECKS:\n' +
      '1. CI-vs-documented-gate-string: .agent/GOVERNANCE.json greenMain.requiredLocalChecks / riskBasedChecks vs what the 4 workflows actually run. Name every check that is claimed but never run, and every run check never claimed.\n' +
      '2. Validator robustness (read the code of validate-repo-state, validate-provenance, validate-offline, validate-secrets, validate-affected, validate-workflows, validate-dependency-audit, validate-task-ownership, scripts/certification/validate-jest-signal): for each, does it fail closed? Any exit 0 on an error path, hardcoded counts that will drift, TOCTOU, or swallowed exception? Cite line numbers.\n' +
      '3. OpenSpec validation in CI: repository-integrity.yml runs `npx --yes @fission-ai/openspec@1.6.0 validate --all` while the installed CLI is 1.9.0 and the durable state claims "OpenSpec --all --strict". Establish exactly what is and is not enforced in CI, and whether the version pin creates a two-validator split.\n' +
      '4. Dependency health: unused direct deps, duplicate/overlapping packages, deprecated packages, lockfile vs package.json drift (do a read-only node script over package-lock.json), Expo SDK alignment (other than the 6 above).\n' +
      '5. Reproducibility: floating ranges, generated artifacts with timestamps or machine paths, non-determinism in scripts/generate-game-registry.mjs output.\n' +
      '6. Android release config: apps/mobile/app.json + android/ - applicationId, versionCode/versionName, permissions, allowBackup, exported components, network security config, ProGuard/R8, release signing path, Hermes/new-arch flags. Flag anything that differs from what docs claim.\n' +
      '7. Repo hygiene: the untracked assistant-config directories from `git status` (.claude .cursor .cline .devin .kimi-code .opencode .pi .omp .commandcode .agents/skills, .cline-rules etc). Determine policy, whether any contain secrets or machine-specific content, and whether .gitignore should cover them. Also inspect .quarantine/, qa-artifacts/, qa-canaries.log, campaign-log.txt for committed junk.\n\n' +
      'Use ID prefix L08.'
  },
  {
    key: 'l09-tests',
    task:
      'FIRST read ' + P + ' in full and follow it exactly.\n\n' + BUDGET +
      'LANE: test-suite quality. Report file: ' + OUT + 'L09-test-quality.md\n\n' +
      'AUTHORITATIVE BASELINE I ALREADY MEASURED: full matrix run in this tree = 598 suites (594 passed, 4 pending), 6,933 passed / 5 skipped / 0 failed, 5 snapshots, 21.75 min under load. validate-jest-signal passes (floors 575 suites / 6840 tests, 5 classified opt-in skips, earliest expiry 2027-03-31). Do not re-run the full matrix.\n\n' +
      'METHOD (cheap, mechanical - prefer this over reading): run `npx jest --listTests` in apps/mobile and save the list. Then build the module->suite coverage map mechanically: for every production file under src (excluding __tests__), check whether a suite mentions it. Report the ranked list of load-bearing production modules with NO dedicated suite, judged by size/importance.\n\n' +
      'CHECKS:\n' +
      '1. Coverage truth: which of db/, data-portability/, workout/, rating/, quests/, sdk/, app/ have per-module suites; name the biggest gaps by risk.\n' +
      '2. Mock fidelity: read jest/setup.js and src/test-utils/**. For every mock of expo-sqlite, expo-router, Reanimated, expo-file-system, expo-haptics, expo-audio: is the mock MORE PERMISSIVE than the real module in a way that could hide a defect? (Known instance to verify and expand on: the expo-sqlite mock substitutes better-sqlite3, which has no AsyncOperationQueue and passes the ROOT adapter into transaction bodies - see how many suites depend on that difference.)\n' +
      '3. False-positive tests: grep for expect(true), assertions only on mocks, snapshot-only suites, toHaveBeenCalled on stubs, tests with no assertion. Give file:line for the worst.\n' +
      '4. Time/locale dependence: grep for new Date(), Date.now(), toLocaleString, toLocaleDateString, Intl, localeCompare in suites without an injected clock. List the top offenders.\n' +
      '5. Isolation: suites that write files, depend on execution order, or share module singletons.\n' +
      '6. Skips: the 4 pending suites / 5 skipped tests - are the waivers honest and time-bounded?\n' +
      '7. The 2.6MB jest-summary.json at apps/mobile/jest-summary.json and the 304KB snapshot in src/app/__tests__/visual-baselines.test.tsx - is either committed to git? (git ls-files). If committed, that is a finding.\n\n' +
      'Use ID prefix L09.'
  },
  {
    key: 'l10-docs',
    task:
      'FIRST read ' + P + ' in full and follow it exactly.\n\n' + BUDGET +
      'LANE: documentation truth + governance coherence. (A separate lane covers security; do not duplicate it.)\nReport file: ' + OUT + 'L10-docs-governance.md\n\n' +
      'I ALREADY REPRODUCED ONE STALE CLAIM - verify it and find the rest: docs/hardening/post067/HARDENING_CLOSURE.md claims "Expo Doctor 21/21" and the terminal matrix is green, but `npx expo-doctor` exits 1 today (6 Expo packages behind SDK requirements). So the recorded terminal matrix is no longer reproducible on this tree. Establish precisely which documented claims are now false.\n\n' +
      'CHECKS:\n' +
      '1. Claim verification table: for each material claim in README.md, ONBOARDING.md, docs/{ARCHITECTURE,GAME_SDK,DESIGN_SYSTEM,ANDROID_AUTOMATION,ARTEMIS_ANDROID_QA,PARITY_MATRIX,QA_ARTIFACTS,RECOVERY_DRILL,DEFERRED_DECISIONS,MASTER_PLAN}.md and .agent/{STATE,CURRENT_CAMPAIGN,BACKLOG,DEPENDENCY_AUDIT,IMPACT_MAP}.md - commands, counts (suite/test/game/schema numbers), file paths, capabilities - mark TRUE / STALE / UNVERIFIABLE with a pointer to the code that proves it. Prioritise numbers and commands (they go stale fastest).\n' +
      '2. docs/MASTER_PLAN.md verdict: is it current, superseded, or misleading? List the exact corrections required. This verdict drives the master-plan deliverable.\n' +
      '3. Open backlog: each still-open item in .agent/BACKLOG.md (allowBackup decision, iOS, SAF consent, coverage thresholds, backup fsync, snapshot review debt, v12 rating repair, content/registry layering, type-only import cycle, test-only UI components, uiautomator race, jest-skip waivers) - is it STILL OPEN in the code? For each: OPEN / ALREADY-FIXED / WRONG-SCOPE, with a code pointer. An item already fixed but recorded open (or vice versa) is a finding.\n' +
      '4. Governance coherence: .agent/GOVERNANCE.json vs .agent/CURRENT_CAMPAIGN.md vs openspec/changes/*/change.json statuses vs the tree. Is GOVERNANCE.activeCampaign:null with an activeProgram whose state is COMPLETE coherent? Is the recovery path (a cold agent reading CURRENT_CAMPAIGN.md -> OVERNIGHT_056_067_STATE.md -> change 067) unambiguous? Report the first place it misleads.\n' +
      '5. KNOWN_ISSUES.md (36KB): list every entry, classify it as RESOLVED-but-still-listed / OPEN / STALE, with evidence. Be complete but terse.\n\n' +
      'Use ID prefix L10.'
  }
];

const results = await runs.all(
  lanes.map((l) => ({
    key: l.key,
    agent: 'delegate',
    task: l.task,
    context: 'fresh',
    model: 'opencode-go/deepseek-v4.1-flash',
    timeoutMs: 2700000
  }))
);

const out = [];
out.push('WAVE 1B AUDIT FLEET COMPLETE - lanes: ' + lanes.length);
for (const r of results) {
  out.push('');
  out.push('===== ' + r.key + ' =====');
  out.push(typeof r.output === 'string' ? r.output : JSON.stringify(r).slice(0, 3000));
}
return out.join('\n');
