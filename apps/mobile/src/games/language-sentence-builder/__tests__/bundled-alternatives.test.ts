import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { SENTENCE_BANK } from '../content/sentence-bank';
import { generateRound, hasNoDuplicateWords } from '../generator';
import { createInitialState, sentenceBuilderReducer } from '../reducer';

// Concrete reconstructions reviewed for movable adjuncts and separable particles.
const REVIEWED_ALTERNATIVES: readonly (readonly [string, readonly string[]])[] = [
  ['She walked to the store yesterday', ['Yesterday she walked to the store', 'She walked yesterday to the store']],
  ['They played soccer in the park', ['In the park they played soccer']],
  ['He cooked dinner for his family', ['For his family he cooked dinner']],
  ['We visited the museum last week', ['Last week we visited the museum']],
  ['She read a book before bedtime', ['Before bedtime she read a book']],
  ['They finished the project on time', ['On time they finished the project']],
  ['He ate lunch at noon', ['At noon he ate lunch']],
  ['We watched a movie last night', ['Last night we watched a movie']],
  ['They danced at the wedding', ['At the wedding they danced']],
  ['The children are playing outside', ['Outside the children are playing']],
  ['They are cooking dinner right now', ['Right now they are cooking dinner', 'They are right now cooking dinner']],
  ['He is working on a new project', ['On a new project he is working']],
  ['The baby is crying very loudly', ['Very loudly the baby is crying']],
  ['It is raining very hard today', ['Today it is raining very hard', 'It is raining today very hard']],
  ['The students are studying for exams', ['For exams the students are studying']],
  ['She is writing a letter to her friend', ['To her friend she is writing a letter']],
  ['If you heat water it eventually boils', ['It eventually boils if you heat water', 'If you heat water it boils eventually']],
  ['The building was constructed last year', ['Last year the building was constructed']],
  ['What time does the train leave today', ['Today what time does the train leave']],
  ['Why is the sky blue in the daytime', ['In the daytime why is the sky blue']],
  ['How many books did you read this year', ['This year how many books did you read']],
  ['Did she finish the assignment on time', ['On time did she finish the assignment']],
  ['Would you like some more coffee please', ['Please would you like some more coffee']],
  ['Who is coming to the party tonight', ['Tonight who is coming to the party']],
  ['Have you tried the new restaurant downtown', ['Downtown have you tried the new restaurant']],
  ['How does this machine work exactly', ['How exactly does this machine work']],
  ['Turn off the lights when you leave', ['Turn the lights off when you leave', 'When you leave turn the lights off']],
  ['Take out the trash right now', ['Take the trash out right now', 'Right now take out the trash', 'Right now take the trash out']],
  ['Fill in the blanks with the correct words', ['Fill the blanks in with the correct words', 'With the correct words fill in the blanks', 'With the correct words fill the blanks in']],
  ['Do not run in the hallway', ['In the hallway do not run']],
  ['He finally crossed the finish line', ['Finally he crossed the finish line', 'He crossed the finish line finally']],
  ['We need to think outside the box', ['Outside the box we need to think']],
];

describe('bundled grammatical alternatives', () => {
  it.each(REVIEWED_ALTERNATIVES)('accepts reviewed orders of "%s"', (text, alternatives) => {
    const sentence = SENTENCE_BANK.find((entry) => entry.text === text)!;
    expect(sentence).toBeDefined();
    for (const alternative of alternatives) {
      const { scrambled } = generateRound({
        rng: createRng(`review:${text}`), roundIndex: 0, bank: [sentence],
        minWords: sentence.wordCount, maxWords: sentence.wordCount,
        prevCategory: null, usedCategories: [],
      });
      let state = sentenceBuilderReducer(createInitialState(), {
        type: 'start-session', seed: 'review', sessionId: 'review', startedAtMs: 0,
      });
      state = { ...state, scrambled };
      for (const word of alternative.split(' ')) {
        state = sentenceBuilderReducer(state, {
          type: 'tap-word', atActiveMs: 0,
          index: scrambled.scrambled.findIndex((tile, index) =>
            tile.toLowerCase() === word.toLowerCase() && !state.taps.includes(index)),
        });
      }
      expect(state.roundOutcome).toBe('passed');
      expect(state.stats.score).toBe(100 + 10 * sentence.wordCount);
      expect(state.taps).toHaveLength(sentence.wordCount);
    }
  });

  it('keeps each eligible bundled accepted order a distinct-token permutation', () => {
    for (const sentence of SENTENCE_BANK.filter(hasNoDuplicateWords)) {
      const words = sentence.text.toLowerCase().split(' ').sort();
      for (const alternative of sentence.alternatives ?? []) {
        expect(alternative.toLowerCase().split(' ').sort()).toEqual(words);
      }
    }
  });
});
