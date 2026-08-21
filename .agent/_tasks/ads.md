You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Your sole job is to execute the task below and return a focused result.

You are implementing ONE new brain-training game for an Expo/React Native + TypeScript monorepo (apps/mobile). This is a swarm packet: you own exactly ONE new game directory and must NOT touch any shared file, the registry, the SDK, or any other game.

REPO ROOT: D:/Documents/tryPython/brain-training  (cwd). Work under apps/mobile/src/games/<gameId>/.

STUDY THESE FILES FIRST (they are the EXACT structural template to mirror):

- apps/mobile/src/games/memory-grid-recall/  (ALL files)
- apps/mobile/src/sdk/index.ts, audio-haptics.ts (use ONLY liveAudioHaptics.feedback('tap'|'correct'|'wrong'|'success'|'failure'|'record')), lifecycle.ts, rng.ts, types/results.ts, types/difficulty.ts, types/diagnostics.ts, types/qa.ts
- apps/mobile/src/components/game-ui/index.ts and each primitive.

ARCHITECTURE RULES (mirror memory-grid-recall precisely): pure reducer; createRng with rng.fork('round:'+i+':attempt:'+a); resolveDifficulty(level,{...params}); SessionLifecycle({clock}); isDevBuild() gates QA; assertDevOnly() in QA hooks; createDiagnosticMetadata + RNG_ALGORITHM_VERSION; seedToNumber like memory-grid-recall; buildSessionRecord MUST match memory-grid-recall exactly (id, gameId, gameVersion, generatorVersion, scoringVersion, seed, difficulty{level,challengeRating,parameters}, rawResult, normalizedResult, xp, startedAt, completedAt, durationMs) importing getDb from '@/db'; normalize returns {value,scale:'0..1',raw:{...raw}} clamped 0..1; components button/pause-overlay/qa-panel/tutorial; screen props {clock?,tutorialStore?,sessionSeed?,persistSession?,xpHook?}; useReducer with lifecycleRef/stateRef/finalizedRef; tutorial auto-open; finalization effect; AppState auto-pause; PauseOverlay when paused&&inSession; Tutorial when tutorialOpen; QaPanel gated by isDevBuild(); liveAudioHaptics.feedback for taps; testID via testId(gameId,...); NEVER leak the answer via a11y (the template chip shows the target — that is the task key, not leakage; each field symbol is labeled by its own identity; only mark the player's OWN selection as selected). This game has a COUNTDOWN TIMER and a QA force-timeout.

TESTS (__tests__/): mirror memory-grid-recall EXACTLY. Create generator.test.ts, scoring.test.ts, reducer.test.ts, difficulty.test.ts, session.test.ts, hooks.test.ts, screen.test.tsx. Use jest.useFakeTimers(), createFakeClock, advanceTime(clock,ms)=act(async()=>{clock.advance(ms);jest.advanceTimersByTime(ms);}), completedStore(), makePersister() (jest.fn completeSession -> {session,ledgerEntry:null,balance:0}), renderScreen(). Drive a full playthrough + persist. Cover: pause (opaque overlay + frozen timer), tutorial (open/complete/skip + replay), QA force-win/force-lose/force-timeout, seed determinism, difficulty scaling, scoring boundaries, normalization range, invalid-action guards, and a TIMEOUT round (advance the clock past timeLimitMs → round auto-ends as timeout).

SELF-VERIFY (do NOT return until green):

1. cd apps/mobile && npx jest src/games/<gameId>/__tests__ --maxWorkers=2 → must PASS 100%.
2. npx tsc --noEmit 2>&1 | grep "src/games/<gameId>" → NO errors. (PRE-EXISTING errors exist in OTHER games from concurrent workers — IGNORE them; ensure YOUR game id has zero tsc errors.)
3. Fix every issue in YOUR game until both pass. Do NOT modify files outside apps/mobile/src/games/<gameId>/.
Do NOT run git add or git commit. Report final jest pass count + tsc status.

=== YOUR GAME ===

GAME ID: attention-distractor-scan | primaryCategory: 'Attention' | secondaryDomains: ['Speed'] | name: 'Distractor Scan'
MECHANIC — find ALL symbols matching a held template amid conjunction distractors, under time pressure (distinct from Visual Search / Odd One Out / Target Count: multiple targets, template matching, conjunction distractors, timer).
Create symbols.ts exporting:

- SHAPES: readonly string[] = ['circle','square','triangle','star'] with SHAPE_GLYPH mapping {circle:'●',square:'■',triangle:'▲',star:'★'}.
- COLORS: readonly string[] = ['#EF4444','#3B82F6','#22C55E','#F59E0B'] (red, blue, green, orange).
- A symbol identity = {shape, color}. glyph+color render a symbol. label = `${colorName} ${shape}` (e.g. 'red circle'). Provide helpers allCombos() = SHAPES x COLORS (16 combos).

Difficulty params: {gridSize, targetCount, timeLimitMs, similarity, rounds}
 easy:   { gridSize:9,  targetCount:2, timeLimitMs:12000, similarity:0.3, rounds:4 }
 normal: { gridSize:16, targetCount:3, timeLimitMs:11000, similarity:0.5, rounds:5 }
 hard:   { gridSize:25, targetCount:4, timeLimitMs:10000, similarity:0.7, rounds:6 }
 expert: { gridSize:36, targetCount:5, timeLimitMs:9000,  similarity:0.9, rounds:7 }
 adaptive: { gridSize:16, targetCount:3, timeLimitMs:11000, similarity:0.5, rounds:6, minTargetCount:2, maxTargetCount:6 }
resolve<Game>Difficulty returns resolveDifficulty(level,{...params}). <game>ParamsFromProfile throws on missing numeric params. nextTargetCount(prev,passed,level,params): adaptive ±1 within [min,max]; fixed +1 on pass capped at gridSize. sessionChallengeRating: adaptive maps final targetCount into [min,max].

GENERATOR: generateRound({rng, roundIndex, gridSize, targetCount, similarity, prevTemplate}):

- template = a random combo (shape,color) via rng.fork('round:'+i+':attempt:'+a).pick(allCombos()).
- place targetCount matching symbols at targetCount distinct cells (rng.fork('cells:'+i).shuffle(allCells).slice(0,targetCount)) — these match the template exactly.
- fill the remaining (gridSize - targetCount) cells with distractors. For each distractor cell, with probability `similarity`, pick a CONJUNCTION distractor that shares exactly one feature with the template (same shape XOR same color, never the full match), else pick a fully-different combo. Always ensure the chosen combo is NOT the template. Use rng (fork per cell) to decide and to pick.
- Near-duplicate avoidance: if the template equals prevTemplate, re-draw (rare).
 Return: { template:{shape,color}, cells: {cell:number, shape:string, color:string, isTarget:boolean}[] }.

PHASES: intro, scan, roundResult, results. (No separate study; the template chip is always visible during scan.)

- scan: render the template chip (glyph+color of the template, label) AND the grid of symbols; a countdown timer. Player taps symbols to toggle selection (a symbol that matches the template and is tapped = a correct find; a non-matching tapped = wrong). The round ends when the timer reaches 0 (timeout) OR the player presses 'Done' (testID '<gameId>.done'). On end → submit.
- Timer: state has `remainingMs` initialized to timeLimitMs at scan start. An effect in scan phase (when !paused) sets an interval (every 100ms) dispatching 'scan-tick'. 'scan-tick' reducer: if phase!=='scan'||paused return; remainingMs-=100; if remainingMs<=0 → transition to roundResult as timeout (compute score with current selections). Pause cancels the interval (frozen); resume restarts it from remainingMs.
- submit (explicit or timeout): matched = selected cells that are isTarget; wrong = selected cells that are not isTarget. passed = matched===targetCount (all targets found). roundPoints = max(0, Math.round(100*matched/targetCount) - 25*wrong). Update stats: roundsPlayed+1; roundsPassed+(passed?1:0); streak; bestStreak; bestRecall=max(bestRecall,matched); totalTargets += targetCount; correctTargets += matched; wrongTaps += wrong. Mark `timedOut:boolean` on the round.
- next-round: if roundIndex+1>=rounds → results; else targetCount=nextTargetCount(...), regenerate (prevTemplate = current template).

SCREEN: scan renders template chip (testID '<gameId>.template') + a board (gridSize cells) with symbols (each cell testID '<gameId>.cell.<cell>', accessibilityLabel = its identity label; selected cells get accessibilityState selected=true for the player's OWN taps only) + a countdown text (testID '<gameId>.timer', shows remaining seconds) + a 'Done' button (testID '<gameId>.done'). roundResult shows passed/failed + matched/total + (timed out?). results StatRows: Score, Accuracy, Rounds passed, Best recall, Best streak, XP. QA force-timeout: dispatch a 'qa/force-timeout' that ends the current scan round immediately as a timeout (set remainingMs to 0 pathway) — implement as a reducer action that, when in scan, transitions to roundResult with current selections scored as timeout. Wire it via QaPanelShell extraActions (a 'Force timeout' GameButton) AND the QA hook assertDevOnly.

NORMALIZE: accuracy=roundsPassed/roundsPlayed; recallProgress=bestRecall/referenceMax where referenceMax = initialTargetCount + (rounds-1) capped at gridSize; value=accuracy*(0.5+0.5*recallProgress). referenceMax helper.
QA force-win: perfect (all rounds passed, bestRecall=referenceMax). force-lose: fail current. force-timeout: end current scan round as timeout.
STATS fields: score, roundsPlayed, roundsPassed, bestStreak, streak, bestRecall, totalTargets, correctTargets, wrongTaps.

End your return with an `acceptance-report` JSON block and report jest pass count + tsc status for your game.
