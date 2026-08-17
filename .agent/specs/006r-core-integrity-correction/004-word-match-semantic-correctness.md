# 004 — Word Match Semantic Correctness Redesign

**Priority:** P1 / blocking for Language rating integrity  
**Depends on:** 003  
**Primary surfaces:** `apps/mobile/src/games/language-word-match/**`  
**May run in parallel with:** 005 after Spec 003 contract is established

## Problem statement

Current Word Match content structurally permits multiple legitimate synonyms among the four options and then designates only one `correctIndex`. The validator even requires all options to belong to the same synonym family. This makes scored outcomes semantically ambiguous and contaminates Language-domain rating evidence.

Example class of invalid item:

```text
prompt: happy
options: joyful, merry, cheerful, glad
correctIndex: one arbitrary synonym
```

A player choosing another legitimate synonym must never be scored wrong merely because the pack author chose a different index.

## Required mechanic contract

Word Match must have **exactly one defensible scored answer per item under the game's documented rule**.

Recommended corrected mechanic:

- Prompt asks for the closest/direct synonym.
- Exactly one option belongs to the prompt's declared synonym family.
- The other three options are same-part-of-speech, similar difficulty/frequency distractors from **different semantic families**.
- Distractors should be plausible enough to require reading/meaning discrimination but not valid synonyms of the prompt.

If the agent proposes a different mechanic, it must write an ADR and satisfy the same unique-answer requirement. Do not keep the current “all options are synonyms but one arbitrary index is right” contract.

## Required content schema

Redesign the pack schema so correctness is explicit and mechanically checkable. Suggested fields:

```text
id
prompt
correctWord
options (or distractors + generated option order)
tier
partOfSpeech
promptFamily
optionFamily metadata
```

The exact shape may vary, but validation must be able to prove:

- prompt non-empty and normalized consistently;
- exactly four displayed options;
- exactly one displayed option is the declared correct synonym;
- correct option differs from prompt text;
- no duplicate options;
- prompt does not appear among options;
- correct option is in prompt synonym family;
- three distractors are not in prompt synonym family;
- all four options use compatible part of speech;
- item/tier/family ids are valid;
- item ids/prompts are unique according to the content policy;
- option order is deterministic from the session seed where order is randomized.

### Semantic review strategy

Mechanical family checks are necessary but not sufficient to prove English semantics. Add a checked-in human-readable content-review table or tests for every curated item documenting prompt → intended synonym relation and distractor families. The autonomous agent must review every item rather than merely transforming the old family arrays mechanically.

Avoid offensive, discriminatory, age-inappropriate, or misleading vocabulary.

## Transitional safety

Until the corrected pack is complete and validated, Word Match must not contribute misleading rating evidence.

Choose one explicit safe transition:

1. correct the entire pack in the same convergence wave before shipping/pushing the final repaired path; or
2. temporarily mark the game ineligible for Today's Workout/rating contribution while keeping free play clearly non-rating, then re-enable only after this spec passes.

Do not leave ambiguous content rating-bearing between committed checkpoints without clearly documenting the temporary state.

## Version/provenance requirements

- Advance `packVersion` because the semantic content contract and item set change.
- If option-generation/selection logic changes, advance `generatorVersion` or classify the game as hybrid according to Spec 003.
- Persist `packId`, `packVersion`, seed/order provenance, scoring version, and game version with the session.
- Historical sessions from the old ambiguous pack remain interpretable as old-pack results; do not rewrite them to look like they were produced by the corrected pack.

## Scoring requirements

- Accuracy must only treat the unique valid option as correct.
- Normalization must be reevaluated after the content redesign; if the meaning/difficulty distribution materially changes, advance `SCORING_VERSION` as required.
- Content tier must influence challenge consistently enough that Easy/Expert do not sample identical effective difficulty without justification.
- QA-forced wins/losses remain diagnostic and must not accidentally grant production progression if the existing QA contract excludes forced evidence.

## Required tests

### Exhaustive pack tests

For every item:

- exactly one correct option;
- three distractor families differ from prompt family;
- all options have same compatible POS classification;
- ids/prompts/options unique under policy;
- tier valid;
- no prompt appears as option;
- correct synonym is declared in the prompt family;
- deterministic option ordering under fixed seed.

### Semantic regression fixtures

Include explicit fixtures for common words likely to expose ambiguity, such as adjective/verb synonym groups. The test data should show why each distractor is invalid under the rule, not merely that `correctIndex` exists.

### Gameplay tests

- answer each index path and verify only the intended answer scores correct;
- repeat a fixed seed and reproduce the same rounds/order;
- all difficulty levels select valid items;
- no item repeats too aggressively within one short session according to the game's freshness rule;
- full session persists corrected pack version.

## MUST acceptance criteria

- No shipped Word Match item has multiple options that satisfy the game's documented correct-answer rule.
- Validator no longer enforces the old ambiguous “all options in same synonym family” model.
- Every curated item is exhaustively checked by the new schema/validator.
- Pack version is advanced and persisted.
- Normalization/scoring version is reviewed and bumped if semantics changed enough to require it.
- Word Match is re-enabled as rating-bearing only after all targeted tests, typecheck, full suite, and emulator smoke pass.
- Emulator smoke demonstrates at least one correct and one plausible-but-wrong answer with expected scoring.

## Forbidden shortcuts

- Keeping four synonyms and renaming one “best synonym” without a defensible rule.
- Making distractors random unrelated words solely so uniqueness is trivial.
- Relying only on the author's `correctIndex` with no semantic family/POS validation.
- Hiding ambiguity by accepting every option as correct; that would make the game meaningless.
- Rewriting historical pack version metadata.