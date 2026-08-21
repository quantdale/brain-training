/**
 * Curated sentence bank for the Sentence Builder game.
 *
 * ~80 sentences across 10 grammatical categories. Each sentence is hand-crafted
 * to be unambiguous in its correct word order and appropriate for the target
 * word-count tiers. Sentences whose clauses can be swapped without changing
 * their words (e.g. conditionals: "She might join us if she finishes early" /
 * "If she finishes early she might join us") declare every defensible order in
 * `alternatives`, so the reducer accepts any of them instead of falsely
 * rejecting a grammatical reconstruction. The bank is versioned (exported as a
 * frozen array) so any change that alters gameplay is detectable via the
 * generator version.
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

function s(
  text: string,
  category: string,
  alternatives?: readonly string[],
): CuratedSentence {
  const words = text.split(/\s+/);
  return alternatives === undefined
    ? { text, category, wordCount: words.length }
    : { text, category, wordCount: words.length, alternatives };
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
  s('The bird flew across the sky', 'simple-past'),       // 6
  s('We watched a movie last night', 'simple-past'),      // 6
  s('She painted a beautiful landscape', 'simple-past'),  // 6
  s('They danced at the wedding', 'simple-past'),         // 5
  s('He fixed the broken chair', 'simple-past'),          // 5

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
  s('The students are studying for exams', 'present-continuous'), // 7
  s('He is building a model airplane', 'present-continuous'),    // 6
  s('We are waiting for the bus', 'present-continuous'),         // 6
  s('The dog is chasing its tail', 'present-continuous'),        // 6
  s('She is writing a letter to her friend', 'present-continuous'), // 8

  // ---- Compound Sentences (10) ----
  s('I wanted to go but it was raining', 'compound', ['It was raining but I wanted to go']),        // 8
  s('She likes coffee and he prefers tea', 'compound', ['He prefers tea and she likes coffee']),      // 7
  s('The sun was shining so we went outside', 'compound'),   // 8
  s('He studied hard but failed the exam', 'compound', ['He failed the exam but studied hard']),      // 7
  s('We can leave now or we can wait here', 'compound', ['We can wait here or we can leave now']),    // 8
  s('She was tired so she went to bed', 'compound'),         // 7
  s('I will call you and you can decide', 'compound', ['You can decide and I will call you']),        // 8
  s('The store was closed so we came home', 'compound'),     // 8
  s('He likes tea but she prefers coffee', 'compound', ['She prefers coffee but he likes tea']),      // 7
  s('It was late so we went to sleep', 'compound'),          // 7
  s('The movie was good and we enjoyed it', 'compound', ['We enjoyed it and the movie was good']),    // 8
  s('She ran fast but tripped on the curb', 'compound'),     // 8
  s('We need milk so I will go to the store', 'compound'),   // 9
  s('He was hungry so he ate a sandwich', 'compound'),       // 8
  s('The rain stopped and the sun came out', 'compound', ['The sun came out and the rain stopped']),  // 8

  // ---- Complex Sentences (10) ----
  s('Although it was cold they went swimming', 'complex', ['They went swimming although it was cold']),                              // 7
  s('She finished early so she helped her friends', 'complex'),                         // 8
  s('The teacher explained the lesson clearly before the test began', 'complex', ['Before the test began the teacher explained the lesson clearly']),        // 11
  s('When the bell rang the students rushed outside', 'complex', ['The students rushed outside when the bell rang']),                       // 8
  s('He kept studying even though he was exhausted', 'complex', ['Even though he was exhausted he kept studying']),                     // 8
  s('If you practice daily you will improve quickly', 'complex', ['You will improve quickly if you practice daily']),                       // 8
  s('The package arrived after we had given up hope', 'complex', ['After we had given up hope the package arrived']),                       // 9
  s('Since it was raining we decided to stay inside', 'complex', ['We decided to stay inside since it was raining']),                       // 9
  s('She left early because she felt sick', 'complex', ['Because she felt sick she left early']),                                 // 7
  s('We stayed home since the roads were icy', 'complex', ['Since the roads were icy we stayed home']),                              // 8
  s('While the baby slept the parents cleaned the house', 'complex', ['The parents cleaned the house while the baby slept']),                   // 9
  s('He passed the test because he studied every night', 'complex', ['Because he studied every night he passed the test']),                    // 9
  s('After the concert ended we went for ice cream', 'complex', ['We went for ice cream after the concert ended']),                        // 9
  s('Although she was nervous she gave a great speech', 'complex', ['She gave a great speech although she was nervous']),                    // 8
  s('When the power went out we lit candles', 'complex', ['We lit candles when the power went out']),                               // 7

  // ---- Conditional (10) ----
  // Every conditional admits a swapped clause order, so all of them declare
  // their alternative ("main clause first") form as equally acceptable.
  s('If I had known I would have brought an umbrella', 'conditional', ['I would have brought an umbrella if I had known']),     // 10
  s('She would travel more if she had more free time', 'conditional', ['If she had more free time she would travel more']),     // 9
  s('If it rains tomorrow we will cancel the picnic', 'conditional', ['We will cancel the picnic if it rains tomorrow']),      // 9
  s('He would pass the test if he studied harder', 'conditional', ['If he studied harder he would pass the test']),         // 8
  s('We could go to the beach if the weather improves', 'conditional', ['If the weather improves we could go to the beach']),    // 9
  s('If you heat water it eventually boils', 'conditional'),               // 7
  s('She might join us if she finishes early', 'conditional', ['If she finishes early she might join us']),             // 8
  s('If I were you I would accept the offer', 'conditional', ['I would accept the offer if I were you']),              // 8
  s('If you study hard you will pass the test', 'conditional', ['You will pass the test if you study hard']),            // 8
  s('We would save money if we cooked at home', 'conditional', ['If we cooked at home we would save money']),            // 8
  s('If the phone rings I will answer it', 'conditional', ['I will answer it if the phone rings']),                 // 8
  s('She would be happy if she got the promotion', 'conditional', ['If she got the promotion she would be happy']),         // 9
  s('If we leave now we will arrive on time', 'conditional', ['We will arrive on time if we leave now']),              // 8
  s('He could learn French if he practiced daily', 'conditional', ['If he practiced daily he could learn French']),         // 9
  s('If you exercise regularly you will feel better', 'conditional', ['You will feel better if you exercise regularly']),      // 8

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
  s('The food was prepared by the chef', 'passive'),                 // 7
  s('The building was constructed last year', 'passive'),            // 6
  s('The prize was awarded to the winner', 'passive'),               // 7
  s('The rules were explained by the teacher', 'passive'),           // 7
  s('The painting was created by a famous artist', 'passive'),       // 8

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
  s('What is your favorite season of the year', 'questions'),        // 8
  s('Have you tried the new restaurant downtown', 'questions'),      // 8
  s('Where did you learn to cook so well', 'questions'),             // 8
  s('Why did the chicken cross the road', 'questions'),              // 8
  s('How does this machine work exactly', 'questions', ['Exactly how does this machine work']),              // 7

  // ---- Imperatives (10) ----
  s('Please close the door behind you', 'imperatives', ['Close the door behind you please']),             // 6
  s('Turn off the lights when you leave', 'imperatives', ['When you leave turn off the lights']),            // 7
  s('Mix the ingredients in a large bowl', 'imperatives', ['In a large bowl mix the ingredients']),           // 7
  s('Do not touch the hot stove', 'imperatives'),                    // 6
  s('Open your books to page forty two', 'imperatives'),             // 7
  s('Put the groceries in the refrigerator', 'imperatives'),         // 7
  s('Write your name at the top', 'imperatives'),                    // 6
  s('Be careful when crossing the street', 'imperatives', ['When crossing the street be careful']),           // 7
  s('Hand me that red pen please', 'imperatives', ['Please hand me that red pen']),                   // 6
  s('Take out the trash right now', 'imperatives'),                  // 6
  s('Please sit down and be quiet', 'imperatives', ['Sit down and be quiet please']),                  // 6
  s('Fill in the blanks with the correct words', 'imperatives'),     // 8
  s('Remember to lock the door when you leave', 'imperatives', ['When you leave remember to lock the door']),      // 8
  s('Do not run in the hallway', 'imperatives'),                     // 6
  s('Bring your notebook to class tomorrow', 'imperatives', ['Tomorrow bring your notebook to class']),        // 7

  // ---- Comparatives (10) ----
  s('This book is much more interesting than the last one', 'comparatives'),  // 10
  s('She runs faster than anyone else on the team', 'comparatives'),          // 9
  s('The blue whale is the largest animal in the world', 'comparatives'),     // 10
  s('Winter is colder than summer in the north', 'comparatives', ['In the north winter is colder than summer']),             // 8
  s('This test was easier than I expected', 'comparatives'),                  // 7
  s('An elephant is heavier than a rhinoceros', 'comparatives'),              // 7
  s('My sister is taller than my brother', 'comparatives'),                   // 7
  s('Gold is more expensive than silver', 'comparatives'),                    // 6
  s('This task is harder than the previous one', 'comparatives'),             // 8
  s('He runs faster than his brother does', 'comparatives'),                  // 7
  s('This restaurant is better than the one we tried yesterday', 'comparatives'), // 10
  s('Mount Everest is taller than any other mountain', 'comparatives'),       // 8
  s('Her painting is more beautiful than mine', 'comparatives'),              // 7
  s('This problem is simpler than it looks', 'comparatives'),                 // 7
  s('A marathon is longer than a 5K race', 'comparatives'),                   // 8

  // ---- Idiomatic Expressions (10) ----
  s('She let the cat out of the bag', 'idiomatic'),                // 8
  s('He decided to bite the bullet', 'idiomatic'),                 // 6
  s('Do not put all your eggs in one basket', 'idiomatic'),        // 9
  s('She broke the ice at the party', 'idiomatic', ['At the party she broke the ice']),                // 7
  s('We need to hit the nail on the head', 'idiomatic'),           // 8
  s('He was feeling under the weather', 'idiomatic'),              // 6
  s('They decided to call it a night', 'idiomatic'),               // 6
  s('She wanted to kill two birds with one stone', 'idiomatic'),   // 9
  s('He finally crossed the finish line', 'idiomatic'),            // 7
  s('We should burn the midnight oil', 'idiomatic'),               // 6
  s('She decided to take the bull by the horns', 'idiomatic'),     // 8
  s('He was barking up the wrong tree', 'idiomatic'),              // 7
  s('We need to think outside the box', 'idiomatic'),              // 7
  s('She felt like a fish out of water', 'idiomatic'),             // 8
  s('He was over the moon about the news', 'idiomatic'),           // 8
]) as readonly CuratedSentence[];
