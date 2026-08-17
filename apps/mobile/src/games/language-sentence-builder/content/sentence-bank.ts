/**
 * Curated sentence bank for the Sentence Builder game.
 *
 * ~80 sentences across 10 grammatical categories. Each sentence is hand-crafted
 * to be unambiguous in its correct word order and appropriate for the target
 * word-count tiers. The bank is versioned (exported as a frozen array) so any
 * change that alters gameplay is detectable via the generator version.
 */
import type { CuratedSentence } from '../types';

/**
 * Category slugs used throughout the game. Each maps to a player-facing label
 * displayed as the category hint during a round.
 */
export const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  'simple-past': 'Simple Past Tense',
  'present-continuous': 'Present Continuous',
  compound: 'Compound Sentences',
  complex: 'Complex Sentences',
  conditional: 'Conditional',
  passive: 'Passive Voice',
  questions: 'Questions',
  imperatives: 'Imperatives',
  comparatives: 'Comparatives',
  idiomatic: 'Idiomatic Expressions',
} as const;

function s(text: string, category: string): CuratedSentence {
  const words = text.split(/\s+/);
  return { text, category, wordCount: words.length };
}

/**
 * The sentence bank. Frozen to prevent accidental mutation at runtime.
 * Must contain at least 80 sentences across 10 categories (8 per category).
 */
export const SENTENCE_BANK: readonly CuratedSentence[] = Object.freeze([
  // ---- Simple Past Tense (10) ----
  s('The cat sat on the mat', 'simple-past'),             // 5
  s('She walked to the store yesterday', 'simple-past'),  // 6
  s('They played soccer in the park', 'simple-past'),     // 6
  s('He cooked dinner for his family', 'simple-past'),    // 6
  s('We visited the museum last week', 'simple-past'),    // 6
  s('The dog barked at the stranger', 'simple-past'),     // 6
  s('She read a book before bedtime', 'simple-past'),     // 6
  s('They finished the project on time', 'simple-past'),  // 6
  s('The boy kicked the ball hard', 'simple-past'),       // 6
  s('He ate lunch at noon', 'simple-past'),               // 5

  // ---- Present Continuous (10) ----
  s('The children are playing outside', 'present-continuous'),   // 5
  s('She is reading an interesting novel', 'present-continuous'), // 7
  s('They are cooking dinner right now', 'present-continuous'),  // 6
  s('The birds are singing in the trees', 'present-continuous'), // 7
  s('He is working on a new project', 'present-continuous'),     // 6
  s('We are planning a trip to Paris', 'present-continuous'),    // 6
  s('The cat is sleeping on the couch', 'present-continuous'),   // 7
  s('She is learning to play piano', 'present-continuous'),      // 6
  s('The baby is crying very loudly', 'present-continuous'),     // 6
  s('It is raining very hard today', 'present-continuous'),      // 6

  // ---- Compound Sentences (10) ----
  s('I wanted to go but it was raining', 'compound'),        // 8
  s('She likes coffee and he prefers tea', 'compound'),      // 7
  s('The sun was shining so we went outside', 'compound'),   // 8
  s('He studied hard but failed the exam', 'compound'),      // 7
  s('We can leave now or we can wait here', 'compound'),     // 8
  s('She was tired so she went to bed', 'compound'),         // 7
  s('I will call you and you can decide', 'compound'),       // 8
  s('The store was closed so we came home', 'compound'),     // 8
  s('He likes tea but she prefers coffee', 'compound'),      // 7
  s('It was late so we went to sleep', 'compound'),          // 7

  // ---- Complex Sentences (10) ----
  s('Although it was cold they went swimming', 'complex'),                              // 7
  s('She finished early so she helped her friends', 'complex'),                         // 8
  s('The teacher explained the lesson clearly before the test began', 'complex'),        // 11
  s('When the bell rang the students rushed outside', 'complex'),                       // 8
  s('He kept studying even though he was exhausted', 'complex'),                        // 8
  s('If you practice daily you will improve quickly', 'complex'),                       // 8
  s('The package arrived after we had given up hope', 'complex'),                       // 9
  s('Since it was raining we decided to stay inside', 'complex'),                       // 9
  s('She left early because she felt sick', 'complex'),                                 // 7
  s('We stayed home since the roads were icy', 'complex'),                              // 8

  // ---- Conditional (10) ----
  s('If I had known I would have brought an umbrella', 'conditional'),     // 10
  s('She would travel more if she had more free time', 'conditional'),     // 9
  s('If it rains tomorrow we will cancel the picnic', 'conditional'),      // 9
  s('He would pass the test if he studied harder', 'conditional'),         // 8
  s('We could go to the beach if the weather improves', 'conditional'),    // 9
  s('If you heat water it eventually boils', 'conditional'),               // 7
  s('She might join us if she finishes early', 'conditional'),             // 8
  s('If I were you I would accept the offer', 'conditional'),              // 8
  s('If you study hard you will pass the test', 'conditional'),            // 8
  s('We would save money if we cooked at home', 'conditional'),            // 8

  // ---- Passive Voice (10) ----
  s('The letter was written by the manager', 'passive'),             // 7
  s('The cake was baked by my grandmother', 'passive'),              // 7
  s('The window was broken by the storm', 'passive'),                // 7
  s('The report was submitted to the director', 'passive'),          // 7
  s('The car is being repaired at the shop', 'passive'),             // 8
  s('The song was sung by the choir', 'passive'),                    // 7
  s('The bridge was designed by an architect', 'passive'),           // 7
  s('The students were given extra homework', 'passive'),            // 7
  s('The floor was swept by the cleaner', 'passive'),                // 7
  s('The door was locked from the inside', 'passive'),               // 7

  // ---- Questions (10) ----
  s('What time does the train leave today', 'questions'),            // 8
  s('Have you ever been to a foreign country', 'questions'),         // 8
  s('Where did you put my glasses', 'questions'),                    // 6
  s('Why is the sky blue in the daytime', 'questions'),              // 8
  s('Can you help me move this table', 'questions'),                 // 7
  s('How many books did you read this year', 'questions'),           // 8
  s('Did she finish the assignment on time', 'questions'),           // 8
  s('Would you like some more coffee please', 'questions'),          // 8
  s('Who is coming to the party tonight', 'questions'),              // 7
  s('Do you know where the keys are', 'questions'),                  // 7

  // ---- Imperatives (10) ----
  s('Please close the door behind you', 'imperatives'),             // 6
  s('Turn off the lights when you leave', 'imperatives'),            // 7
  s('Mix the ingredients in a large bowl', 'imperatives'),           // 7
  s('Do not touch the hot stove', 'imperatives'),                    // 6
  s('Open your books to page forty two', 'imperatives'),             // 7
  s('Put the groceries in the refrigerator', 'imperatives'),         // 7
  s('Write your name at the top', 'imperatives'),                    // 6
  s('Be careful when crossing the street', 'imperatives'),           // 7
  s('Hand me that red pen please', 'imperatives'),                   // 6
  s('Take out the trash right now', 'imperatives'),                  // 6

  // ---- Comparatives (10) ----
  s('This book is much more interesting than the last one', 'comparatives'),  // 10
  s('She runs faster than anyone else on the team', 'comparatives'),          // 9
  s('The blue whale is the largest animal in the world', 'comparatives'),     // 10
  s('Winter is colder than summer in the north', 'comparatives'),             // 8
  s('This test was easier than I expected', 'comparatives'),                  // 7
  s('An elephant is heavier than a rhinoceros', 'comparatives'),              // 7
  s('My sister is taller than my brother', 'comparatives'),                   // 7
  s('Gold is more expensive than silver', 'comparatives'),                    // 6
  s('This task is harder than the previous one', 'comparatives'),             // 8
  s('He runs faster than his brother does', 'comparatives'),                  // 7

  // ---- Idiomatic Expressions (10) ----
  s('She let the cat out of the bag', 'idiomatic'),                // 8
  s('He decided to bite the bullet', 'idiomatic'),                 // 6
  s('Do not put all eggs in one basket', 'idiomatic'),             // 8
  s('She broke the ice at the party', 'idiomatic'),                // 7
  s('We need to hit the nail on the head', 'idiomatic'),           // 8
  s('He was feeling under the weather', 'idiomatic'),              // 6
  s('They decided to call it a night', 'idiomatic'),               // 6
  s('She decided to kill two birds', 'idiomatic'),                 // 5
  s('He finally crossed the finish line', 'idiomatic'),            // 7
  s('We should burn the midnight oil', 'idiomatic'),               // 6
]) as readonly CuratedSentence[];
