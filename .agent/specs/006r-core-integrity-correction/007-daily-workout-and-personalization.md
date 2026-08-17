# 007 — Real Daily Workout Session, Durable Rerolls, and Full-Catalog Personalization

**Priority:** P1 product / P2 persistence  
**Depends on:** 001; integrate authoritative completion contract from 002 when available  
**Primary surfaces:** `apps/mobile/src/workout/**`, workout persistence, Home, game/result navigation context, registry/query helpers  
**Shared navigation/schema owner:** orchestrator

## Problems to correct

1. Home currently presents four independent game links. There is no durable workout instance, 1/4 → 4/4 progression, workout completion, or Next Game flow.
2. `personalizedWorkout()` first selects four games and then only reorders those four by weakness/recency. It cannot bring an unselected weak/neglected domain into the workout or replace a recent game.
3. Reroll attempt count exists only in React state. Restarting grants another free reroll, resets escalation/limit, and can separate a coin debit from the state transition.
4. Home copy overstates personalization relative to the actual algorithm.

## Product contract

Today's Workout is a **durable local-date workout instance**, normally four distinct games, and is the primary training CTA.

Required player flow:

```text
Home -> Today's Workout
  -> Game 1
  -> compact authoritative result
  -> Next Game
  -> Game 2
  -> compact result
  -> Next Game
  -> Game 3
  -> compact result
  -> Next Game
  -> Game 4
  -> workout complete summary / return Home
```

The player may leave and return. Completed game sessions remain committed. The workout instance remembers which entries are complete and resumes at the next incomplete entry. A short active game that was killed mid-round restarts according to the existing game-session contract; the workout itself remains intact.

## Durable workout model

Introduce a SQLite-backed workout model keyed by local calendar date. Exact schema may vary, but it must represent:

- `local_date` (canonical key for the current product rule);
- deterministic selection version/algorithm version;
- selected ordered game ids (normally 4);
- current reroll attempt count;
- game completion/session-id association per slot;
- creation/start/completion timestamps;
- optional selection reason metadata useful for QA (weak/neglected/recent/exploration);
- any reward-claimed marker if a workout-completion reward is later/now applied.

Do not store only mutable UI state. The DB row(s) are authoritative across restarts.

A migration must preserve all existing sessions/profile data.

## Full-catalog personalization algorithm

Selection must operate over the entire eligible registered catalog, not merely reorder a base four.

### Inputs

At minimum:

- current domain ratings/skill confidence;
- never-played/neglected domains and games;
- recent sessions/game ids;
- yesterday's workout/recent-day repetition;
- player favorites only as a weak preference if appropriate, not a guarantee;
- deterministic local date + reroll attempt seed;
- catalog eligibility flags (e.g. temporarily excluded invalid game);
- controlled exploration/strong-skill inclusion.

### Required behavioral invariants

- Normally choose 4 distinct games when catalog size permits.
- Prefer domain diversity; target four distinct primary domains when enough eligible candidates exist, unless weakness/neglect constraints justify otherwise.
- Unplayed domains are treated as neglected/unknown, **not** as “not weak therefore ignore.”
- Recent games receive a real selection penalty/replacement opportunity, not merely later list position.
- Avoid same game on consecutive days when alternatives exist; if repeats are needed, keep them bounded.
- Weak domains receive higher priority, but the workout should not permanently starve stronger domains.
- Include controlled seeded randomness so the same player state does not produce a monotonous deterministic ranking forever.
- Same inputs + date + attempt + selection algorithm version produce the same ordered workout.
- Reroll attempt `N` yields a deterministic alternative and must not simply reorder the identical set unless no compliant alternative exists.
- Selection remains explainable enough that QA can inspect why each game was chosen.

### Recommended scoring approach

Use a pure candidate scoring stage plus constraint-aware selection. Suggested components (weights must be documented and tested, not necessarily these exact numbers):

- weakness priority;
- neglect/recency age;
- recent-game penalty;
- previous-day penalty;
- domain-diversity bonus/constraint;
- small seeded exploration jitter;
- small strong-skill/exploration opportunity.

Write an ADR or algorithm comment documenting weights and tie-breaking. The system must remain deterministic under a fixed seed.

## Workout navigation/context

Implement a workout-aware route/controller rather than encoding the flow only in Home component state.

Game completion must know whether it was launched as:

- free play; or
- workout slot `i` of a specific workout date/id.

On successful authoritative persistence:

- associate the resulting `sessionId` with that workout slot exactly once;
- show the compact result;
- expose `Next Game` for unfinished workout;
- on last game, mark workout complete transactionally with final slot association.

Free-play behavior remains Play Again / Done and must not be forced into workout flow.

Do not make games depend directly on workout DB schema. Pass a small platform context/route contract.

## Reroll contract

Existing rule: first reroll is free; additional rerolls cost normal currency; max current attempts remain governed by the product configuration unless deliberately changed.

Required persistence:

- reroll count is read from workout state, not React-only state;
- free reroll is available only once per workout/date;
- restart does not reset count/cost/limit;
- paid reroll is atomic with its currency debit (integrate Spec 008 spend service);
- failed debit does not change workout selection;
- successful debit but process crash cannot leave the old reroll count/selection committed;
- reroll does not erase already completed workout slots. If reroll after starting is allowed, explicitly define whether only incomplete slots can change. Recommended: once any slot is completed, reroll only replaces incomplete slots while preserving completed history.

## Date/time behavior

Use the existing local-calendar product rule. Tests must include:

- midnight rollover;
- leap day;
- timezone change around a stored workout;
- reopening yesterday's incomplete workout vs today's new workout.

Recommended behavior: Home primary CTA always targets today's local-date workout; old incomplete workout remains historical and is not silently merged into today. Document any alternative.

## Required tests

### Pure selection tests

- same inputs/date/attempt -> exact same selection;
- different attempt -> meaningful alternative when catalog allows;
- weak domain absent from naive base pick can be selected by full-catalog algorithm;
- never-played domain gets neglect priority;
- recent games are actually displaced when alternatives exist;
- four-domain diversity when eligible;
- previous-day overlap bounded;
- strong domain occasionally surfaces under controlled exploration;
- catalog exclusions respected.

### Persistence tests

- create/get today's workout idempotently;
- restart returns same selection and reroll count;
- mark one slot complete with session id exactly once;
- duplicate completion callback does not advance twice;
- resume returns next incomplete slot;
- final slot marks workout complete;
- paid reroll crash/transaction rollback leaves both balance and workout unchanged.

### Navigation/UI tests

- Home CTA launches workout controller;
- game 1 result -> Next Game -> game 2;
- free play result still has normal free-play actions;
- after app remount, workout resumes at expected slot;
- workout completion returns coherent summary/Home state.

### Emulator journey

On one AVD, execute a four-game seeded workout end-to-end using QA hooks where appropriate, but at least one game should be played through a normal input path. Capture slot progression, result transition, and final completion.

## MUST acceptance criteria

- Today's Workout is a persisted workout instance, not four independent Home links.
- Selection chooses from the full catalog using weakness + neglect + recency + diversity + controlled randomness.
- Home description accurately matches actual selection behavior.
- Reroll state survives restart and paid reroll is transactional.
- Completed slots survive interruption and are not replay-awarded accidentally.
- Free play remains independent.
- Four-game emulator journey completes without manual host input.
- Full targeted tests, typecheck, full suite pass.

## Forbidden shortcuts

- Keeping the current four-game base selection and only sorting it differently.
- Storing workout progress only in route params or React state.
- Deducting reroll currency in one transaction and updating workout state later.
- Marking a slot complete before its authoritative game session is committed.
- Treating a killed in-progress game as completed.