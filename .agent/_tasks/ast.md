You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Your sole job is to execute the task below and return a focused result.

You are implementing ONE new brain-training game for an Expo/React Native + TypeScript monorepo (apps/mobile). This is a swarm packet: you own exactly ONE new game directory and must NOT touch any shared file, the registry, the SDK, or any other game.

REPO ROOT: D:/Documents/tryPython/brain-training  (cwd). Work under apps/mobile/src/games/<gameId>/.

STUDY THESE FILES FIRST (they are the EXACT structural template to mirror):

- apps/mobile/src/games/memory-grid-recall/  (ALL files: types.ts, generator.ts, difficulty.ts, scoring.ts, reducer.ts, session.ts, hooks.ts, versions.ts, game-definition.ts, game.json, index.ts, screen.tsx, components/*.tsx, __tests__/*)
- apps/mobile/src/sdk/index.ts
- apps/mobile/src/sdk/audio-haptics.ts  (use ONLY liveAudioHaptics.feedback('tap'|'correct'|'wrong'|'success'|'failure'|'record') — do NOT invent new sfx names)
- apps/mobile/src/sdk/lifecycle.ts, rng.ts, types/results.ts, types/difficulty.ts, types/diagnostics.ts, types/qa.ts
- apps/mobile/src/components/game-ui/index.ts and each primitive.

ARCHITECTURE RULES (mirror memory-grid-recall precisely): pure reducer (no timers/side effects); createRng for all generation with rng.fork('round:'+i+':attempt:'+a); resolveDifficulty(level,{...params}); SessionLifecycle({clock}) start/pause/resume/complete/abandon; isDevBuild() gates QA; assertDevOnly() in QA hooks; createDiagnosticMetadata + RNG_ALGORITHM_VERSION in generatorInfo; seedToNumber like memory-grid-recall; buildSessionRecord MUST match memory-grid-recall exactly (id, gameId, gameVersion, generatorVersion, scoringVersion, seed, difficulty{level,challengeRating,parameters}, rawResult, normalizedResult, xp, startedAt, completedAt, durationMs) importing getDb from '@/db'; normalize returns {value,scale:'0..1',raw:{...raw}} clamped 0..1; components button/pause-overlay/qa-panel/tutorial; screen props {clock?,tutorialStore?,sessionSeed?,persistSession?,xpHook?}; useReducer with lifecycleRef/stateRef/finalizedRef; tutorial auto-open; finalization effect; AppState auto-pause; PauseOverlay when paused&&inSession; Tutorial when tutorialOpen; QaPanel gated by isDevBuild(); liveAudioHaptics.feedback for taps; testID via testId(gameId,...); NEVER leak the answer through accessibility labels (mark only the player's OWN selection as selected; pattern/target cells must NOT be exposed via a11y as answers).

TESTS (__tests__/): mirror memory-grid-recall EXACTLY. Create generator.test.ts, scoring.test.ts, reducer.test.ts, difficulty.test.ts, session.test.ts, hooks.test.ts, screen.test.tsx. Use jest.useFakeTimers(), createFakeClock, advanceTime(clock,ms)=act(async()=>{clock.advance(ms);jest.advanceTimersByTime(ms);}), completedStore() (in-memory tutorial store completed:true), makePersister() (jest.fn completeSession returning {session,ledgerEntry:null,balance:0}), renderScreen(). Drive a full playthrough + persist. Cover pause (opaque overlay + frozen timers), tutorial (open/complete/skip + replay), QA force-win/force-lose, seed determinism, difficulty scaling, scoring boundaries, normalization range, invalid-action guards.

SELF-VERIFY (do NOT return until green):

1. cd apps/mobile && npx jest src/games/<gameId>/__tests__ --maxWorkers=2 → must PASS 100%.
2. npx tsc --noEmit 2>&1 | grep "src/games/<gameId>" → NO errors. (PRE-EXISTING errors exist in OTHER games from concurrent workers — IGNORE them; ensure YOUR game id has zero tsc errors.)
3. Fix every issue in YOUR game until both pass. Do NOT modify files outside apps/mobile/src/games/<gameId>/.
Do NOT run git add or git commit. Report final jest pass count + tsc status.

=== YOUR GAME ===

GAME ID: attention-symbol-tracker | primaryCategory: 'Attention' | secondaryDomains: ['Memory'] | name: 'Symbol Tracker'
MECHANIC — multiple-object identity tracking under position scramble + distraction (a discrete "track after transformation" task; NO fragile animation timing).
Create symbols.ts exporting TRACKER_SYMBOLS: readonly {id:number, glyph:string, color:string, label:string}[] of 10 DISTINCT symbols. Use distinct glyph+color+label, e.g.:
 {0,'●','#EF4444','red circle'},{1,'▲','#3B82F6','blue triangle'},{2,'■','#22C55E','green square'},{3,'★','#F59E0B','orange star'},{4,'◆','#A855F7','purple diamond'},{5,'✚','#14B8A6','teal plus'},{6,'⬟','#EC4899','pink pentagon'},{7,'❤','#F43F5E','rose heart'},{8,'⬢','#6366F1','indigo hexagon'},{9,'⏺','#0EA5E9','sky ring'}.
All glyph+color+label distinct. The player tracks by IDENTITY (glyph+color), not position.

Difficulty params: {gridSize, tokenCount, trackCount, observeMs, distractors, rounds}
 easy:   { gridSize:9,  tokenCount:3, trackCount:1, observeMs:2200, distractors:0, rounds:4 }
 normal: { gridSize:9,  tokenCount:5, trackCount:2, observeMs:2000, distractors:0, rounds:5 }
 hard:   { gridSize:12, tokenCount:6, trackCount:3, observeMs:1700, distractors:2, rounds:6 }
 expert: { gridSize:12, tokenCount:8, trackCount:3, observeMs:1500, distractors:4, rounds:7 }
 adaptive: { gridSize:9, tokenCount:5, initialTrackCount:1, observeMs:1900, distractors:0, rounds:6, minTrackCount:1, maxTrackCount:3 }
resolve<Game>Difficulty returns resolveDifficulty(level,{...params}). <game>ParamsFromProfile throws on missing numeric params. nextTrackCount(prev,passed,level,params): adaptive ±1 within [min,max]; fixed +1 on pass capped at tokenCount. sessionChallengeRating: adaptive maps final trackCount into [min,max].

GENERATOR: generateRound({rng, roundIndex, gridSize, tokenCount, trackCount, distractors, prevTrackIds}):

- choose tokenCount distinct symbol ids from TRACKER_SYMBOLS (ids 0..9) via rng.fork('round:'+i+':attempt:'+a).shuffle(TRACKER_SYMBOLS).slice(0,tokenCount).
- choose tokenCount distinct cells of the grid via rng.fork('cells:'+i).shuffle(allCells).slice(0,tokenCount) — map each token to a cell (initialPositions).
- choose trackCount of the tokens as track targets (rng.fork('track:'+i).shuffle(tokenIds).slice(0,trackCount)).
- compute a scramble permutation of ALL grid cells (rng.fork('scramble:'+i).shuffle(allCells)) → each token's final cell = permutation[initialCell]. The responded board shows the same tokens at their final cells.
- distractors: pick `distractors` extra symbol ids (distinct from token ids, from the remaining palette) placed at `distractors` remaining empty cells in the responded board.
- Near-duplicate avoidance: if the previous round's tracked symbol-id SET equals the new tracked set (identical track targets), re-draw (like isNearDuplicateSet).
 Return: { tokens: {id, cell, finalCell}[], trackIds:number[], distractorIds:number[], distractorCells:number[] }.

PHASES: intro, observe, respond, roundResult, results.

- observe: render the tokens at their INITIAL cells with track targets highlighted (e.g. a ring/border for trackIds), for observeMs (use a study-style timer: effect dispatches 'observe-tick' after observeMs → phase 'respond'; pause cancels/resumes like memory-grid-recall study).
- respond: render ALL tokens at their FINAL cells (same identities, scrambled positions) + distractors, for the player to tap the `trackCount` tracked tokens. tapping toggles selection. auto-finalize when selections.length===trackCount OR explicit Submit.
- submit: matched = selections that are in trackIds; wrong = selections not in trackIds. passed = matched===trackCount && wrong===0. roundPoints = max(0, Math.round(100*matched/trackCount) - 25*wrong). Update stats: roundsPlayed+1; roundsPassed+(passed?1:0); streak; bestStreak; bestRecall=max(bestRecall,matched); totalTargets += trackCount; correctTargets += matched; wrongTaps += wrong.
- next-round: if roundIndex+1>=rounds → results; else trackCount=nextTrackCount(...), regenerate (prevTrackIds = current trackIds).

SCREEN: observe renders a board (gridSize cells) with tokens at initial cells; track targets visually marked (NOT via a11y label that leaks the answer — track marking must be visual only; a11y label each token by its symbol.label). respond renders the board with tokens at final cells + distractors; tapped tracked tokens get accessibilityState selected=true (player's own selection only). Provide a 'Submit' button (testID '<gameId>.submit'). roundResult shows passed/failed + matched/total. results StatRows: Score, Accuracy, Rounds passed, Best recall, Best streak, XP.
NORMALIZE: accuracy=roundsPassed/roundsPlayed; recallProgress=bestRecall/referenceMax where referenceMax = initialTrackCount + (rounds-1); value=accuracy*(0.5+0.5*recallProgress). referenceMax helper.
QA force-win: perfect (all rounds passed, bestRecall=referenceMax). force-lose: fail current.
STATS fields: score, roundsPlayed, roundsPassed, bestStreak, streak, bestRecall, totalTargets, correctTargets, wrongTaps.

End your return with an `acceptance-report` JSON block and report jest pass count + tsc status for your game.
