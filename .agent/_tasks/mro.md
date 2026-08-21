You are a delegated subagent running from a fork of the parent session. Treat the inherited conversation as reference-only context, not a live thread to continue. Your sole job is to execute the task below and return a focused result.

You are implementing ONE new brain-training game for an Expo/React Native + TypeScript monorepo (apps/mobile). This is a swarm packet: you own exactly ONE new game directory and must NOT touch any shared file, the registry, the SDK, or any other game.

REPO ROOT: D:/Documents/tryPython/brain-training  (cwd). Work under apps/mobile/src/games/<gameId>/.

STUDY THESE FILES FIRST (they are the EXACT structural template to mirror):

- apps/mobile/src/games/memory-grid-recall/  (ALL files: types.ts, generator.ts, difficulty.ts, scoring.ts, reducer.ts, session.ts, hooks.ts, versions.ts, game-definition.ts, game.json, index.ts, screen.tsx, components/*.tsx, __tests__/*)
- apps/mobile/src/sdk/index.ts
- apps/mobile/src/sdk/audio-haptics.ts  (use ONLY liveAudioHaptics.feedback('tap'|'correct'|'wrong'|'success'|'failure'|'record') — do NOT invent new sfx names)
- apps/mobile/src/sdk/lifecycle.ts, rng.ts, types/results.ts, types/difficulty.ts, types/diagnostics.ts, types/qa.ts
- apps/mobile/src/components/game-ui/index.ts  and each primitive (game-button, pause-overlay, qa-panel-shell, tutorial-frame, difficulty-selector, session-header, result-row, use-reduced-motion)

ARCHITECTURE RULES (mirror memory-grid-recall precisely):

- Pure reducer (no timers/side effects). Screen owns timers, SessionLifecycle, tutorial, QA, persistence.
- Use createRng(seed) for ALL generation. Fork per round: rng.fork('round:'+i+':attempt:'+a). Never Math.random in generators.
- resolveDifficulty(level, {...params}) for fixed/adaptive. isDifficultyLevel guard in force-state.
- SessionLifecycle({clock}) start/pause/resume/complete/abandon. isDevBuild() gates QA panel. assertDevOnly() inside QA hooks.
- createDiagnosticMetadata + RNG_ALGORITHM_VERSION in generatorInfo. seedToNumber like memory-grid-recall/session.ts.
- buildSessionRecord shape MUST match memory-grid-recall exactly (id, gameId, gameVersion, generatorVersion, scoringVersion, seed, difficulty{level,challengeRating,parameters}, rawResult, normalizedResult, xp, startedAt, completedAt, durationMs). Import getDb from '@/db'.
- normalize result returns {value, scale:'0..1', raw:{...raw}}; clamp 0..1.
- Components: button.tsx (re-export GameButton), pause-overlay.tsx (thin wrap PauseOverlay), qa-panel.tsx (thin wrap QaPanelShell passing onForceWin/onForceLose), tutorial.tsx (3-step: TutorialFrame + GameButton, intro/demo/done), plus game-specific render components.
- screen.tsx: props {clock?, tutorialStore?, sessionSeed?, persistSession?, xpHook?}; useReducer; lifecycleRef/stateRef/finalizedRef; tutorial auto-open effect; finalization effect (phase==='results' && !finalizedRef ...) building raw + normalize + persist via persistSession; startSession/pause/resume/quitToLibrary; AppState auto-pause; visualFor callback; PauseOverlay when paused&&inSession; Tutorial when tutorialOpen; QaPanel gated by isDevBuild(); use liveAudioHaptics.feedback for taps.
- testID via testId(gameId, ...). NEVER leak the answer through accessibility labels (neutral labels like 'Cell 5'/'Symbol red circle'; only mark the player's OWN selection as selected).
- game.json: {id, name, primaryCategory, secondaryDomains:[...], description, sdkVersion:'0.1.0', gameVersion:'1.0.0', generatorVersion:'1.0.0', contentVersion:null, hasTutorial:true}. primaryCategory must be 'Memory' or 'Attention' as the spec says.

TESTS (__tests__/): mirror memory-grid-recall test conventions EXACTLY. Create: generator.test.ts, scoring.test.ts, reducer.test.ts, difficulty.test.ts, session.test.ts, hooks.test.ts, screen.test.tsx. Use jest.useFakeTimers(), createFakeClock, an advanceTime(clock,ms) helper that does act(async()=>{clock.advance(ms); jest.advanceTimersByTime(ms);}), a completedStore() (in-memory tutorial store with completed:true), a makePersister() (jest.fn completeSession returning {session,ledgerEntry:null,balance:0}), and a renderScreen() helper. Drive a FULL playthrough end-to-end and persist. Cover pause (opaque overlay + frozen timers), tutorial (open/complete/skip + replay), QA force-win/force-lose, seed determinism, difficulty scaling, scoring boundaries, normalization range, invalid-action guards.

SELF-VERIFY BEFORE RETURNING (do NOT return until green):

1. cd apps/mobile && npx jest src/games/<gameId>/__tests__ --maxWorkers=2  → must PASS 100%.
2. npx tsc --noEmit 2>&1 | grep "src/games/<gameId>"  → must show NO errors. (The working tree has PRE-EXISTING errors in OTHER games from concurrent parallel-wave workers — IGNORE those; only ensure YOUR game id has zero tsc errors.)
3. Fix every issue in YOUR game until both checks pass. Do NOT modify files outside apps/mobile/src/games/<gameId>/.
Do NOT run git add or git commit. Report final jest pass count and tsc status for your game.

=== YOUR GAME ===

GAME ID: memory-running-order  |  primaryCategory: 'Memory'  |  secondaryDomains: ['Attention']  |  name: 'Running Order'
MECHANIC — working-memory update: reproduce the LAST K items of a longer stream IN ORDER (the player must hold only the recent subsequence and forget earlier items).
Create a symbols.ts exporting RUNNING_ORDER_SYMBOLS: readonly {id:number, glyph:string, color:string, label:string}[] of 6 DISTINCT symbols (e.g. {id:0,glyph:'●',color:'#EF4444',label:'red circle'}, {1,'▲','#3B82F6','blue triangle'}, {2,'■','#22C55E','green square'}, {3,'★','#F59E0B','orange star'}, {4,'◆','#A855F7','purple diamond'}, {5,'✚','#14B8A6','teal plus'}). glyph+color+label all distinct.

Difficulty params (NO gridSize; instead streamLen/recallLength/flashMs/rounds):
 easy:   { streamLen:3, initialRecallLength:2, flashMs:900,  rounds:4 }
 normal: { streamLen:4, initialRecallLength:3, flashMs:800,  rounds:5 }
 hard:   { streamLen:6, initialRecallLength:3, flashMs:650,  rounds:6 }
 expert: { streamLen:8, initialRecallLength:4, flashMs:550,  rounds:7 }
 adaptive: { streamLen:5, initialRecallLength:2, flashMs:750, rounds:6, minRecallLength:2, maxRecallLength:5 }
resolve<Game>Difficulty(level) returns resolveDifficulty(level,{...params}). <game>ParamsFromProfile throws on missing numeric params. nextRecallLength(prev, passed, level, params): adaptive ±1 within [min,max]; fixed +1 on pass (cap at streamLen). sessionChallengeRating: adaptive maps final recallLength into [min,max].

GENERATOR: generateStream({rng, roundIndex, streamLen, recallLength, prevLast}): pick streamLen symbol ids (0..5) via rng.fork('round:'+i+':attempt:'+a).shuffle(RUNNING_ORDER_SYMBOLS).slice(0,streamLen); the "last subsequence" = stream.slice(streamLen-recallLength). Near-duplicate avoidance: if prevLast (the previous round's last subsequence) equals the new last subsequence, re-draw (like memory-grid-recall isNearDuplicateSet for identical sets). Since order matters, compare arrays element-wise.

PHASES: intro, reveal, input, roundResult, results. reveal shows the stream ONE symbol at a time for flashMs each: revealedIndex 0..streamLen; at revealedIndex===streamLen → phase 'input' (mirror memory reveal-tick). input: palette of the 6 symbols; tapping a palette symbol appends its id to 'answer' (array); a 'Back' button removes the last; a 'Submit' button finalizes (also auto-finalize when answer.length===recallLength). submit: trueLast = stream.slice(streamLen-recallLength). matched = count i in 0..recallLength-1 where answer[i]===trueLast[i] (treat missing as wrong). wrong = recallLength - matched. roundPoints = max(0, Math.round(100*matched/recallLength) - 25*wrong). passed = matched===recallLength. Update stats: roundsPlayed+1; roundsPassed + (passed?1:0); streak; bestStreak; bestRecall=max(bestRecall,matched); totalTargets += recallLength; correctTargets += matched; wrongTaps += wrong. next-round: if roundIndex+1>=rounds → results; else recallLength=nextRecallLength(...), regenerate stream (prevLast = current last).

SCREEN: reveal renders the current symbol BIG and centered (use a ThemedText with the glyph + color, testID '<gameId>.reveal-symbol'); input renders palette (6 cells each showing glyph+color, testID '<gameId>.palette.<id>', accessibilityLabel = symbol.label) and answer slots (testID '<gameId>.answer.<i>'); Back + Submit buttons (testID '<gameId>.back', '<gameId>.submit'). roundResult shows passed/failed + matched/total. results StatRows: Score, Accuracy, Rounds passed, Best recall, Best streak, XP.
NORMALIZE: accuracy=roundsPassed/roundsPlayed; recallProgress=bestRecall/referenceMax where referenceMax = initialRecallLength + (rounds-1); value=accuracy*(0.5+0.5*recallProgress). referenceMaxTargets helper.
QA force-win: perfect (all rounds passed, bestRecall=referenceMax). force-lose: fail current.
STATS fields: score, roundsPlayed, roundsPassed, bestStreak, streak, bestRecall, totalTargets, correctTargets, wrongTaps.

End your return with an `acceptance-report` JSON block and report jest pass count + tsc status for your game.
