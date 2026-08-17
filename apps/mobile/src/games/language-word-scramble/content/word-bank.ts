/**
 * Curated word bank for the Word Scramble game.
 *
 * Provenance: these are original words chosen to span a range of difficulty
 * levels and categories. They do NOT duplicate the language-word-match pack.
 * Each entry has a word (the answer) and a category hint shown to the player.
 * The distractor pool is built from other words of similar length at runtime
 * by the generator (not stored per-entry to keep the bank compact).
 *
 * Words are lowercase; all scrambles are generated deterministically.
 */

export interface WordEntry {
  readonly word: string;
  readonly category: string;
}

/**
 * All words grouped by category for documentation; the flat list below is
 * what the generator actually indexes.
 */
export const WORD_BANK: readonly WordEntry[] = [
  // Nature
  { word: 'breeze', category: 'Nature' },
  { word: 'meadow', category: 'Nature' },
  { word: 'forest', category: 'Nature' },
  { word: 'river', category: 'Nature' },
  { word: 'cloud', category: 'Nature' },
  { word: 'sunset', category: 'Nature' },
  { word: 'island', category: 'Nature' },
  { word: 'valley', category: 'Nature' },
  { word: 'canyon', category: 'Nature' },
  { word: 'glacier', category: 'Nature' },
  { word: 'thunder', category: 'Nature' },
  { word: 'blossom', category: 'Nature' },
  { word: 'pebble', category: 'Nature' },
  { word: 'harvest', category: 'Nature' },
  { word: 'dewdrop', category: 'Nature' },

  // Food & Drink
  { word: 'recipe', category: 'Food & Drink' },
  { word: 'muffin', category: 'Food & Drink' },
  { word: 'noodle', category: 'Food & Drink' },
  { word: 'spice', category: 'Food & Drink' },
  { word: 'butter', category: 'Food & Drink' },
  { word: 'biscuit', category: 'Food & Drink' },
  { word: 'mustard', category: 'Food & Drink' },
  { word: 'pepper', category: 'Food & Drink' },
  { word: 'apricot', category: 'Food & Drink' },
  { word: 'walnut', category: 'Food & Drink' },
  { word: 'ginger', category: 'Food & Drink' },
  { word: 'celery', category: 'Food & Drink' },
  { word: 'parsley', category: 'Food & Drink' },
  { word: 'coconut', category: 'Food & Drink' },
  { word: 'cherry', category: 'Food & Drink' },

  // Music & Sound
  { word: 'melody', category: 'Music & Sound' },
  { word: 'rhythm', category: 'Music & Sound' },
  { word: 'chorus', category: 'Music & Sound' },
  { word: 'harmony', category: 'Music & Sound' },
  { word: 'guitar', category: 'Music & Sound' },
  { word: 'violin', category: 'Music & Sound' },
  { word: 'clarinet', category: 'Music & Sound' },
  { word: 'trumpet', category: 'Music & Sound' },
  { word: 'ukulele', category: 'Music & Sound' },
  { word: 'flute', category: 'Music & Sound' },
  { word: 'timpani', category: 'Music & Sound' },
  { word: 'cymbal', category: 'Music & Sound' },
  { word: 'sonata', category: 'Music & Sound' },

  // Travel & Places
  { word: 'voyage', category: 'Travel & Places' },
  { word: 'passport', category: 'Travel & Places' },
  { word: 'cruise', category: 'Travel & Places' },
  { word: 'harbor', category: 'Travel & Places' },
  { word: 'bridge', category: 'Travel & Places' },
  { word: 'temple', category: 'Travel & Places' },
  { word: 'market', category: 'Travel & Places' },
  { word: 'plaza', category: 'Travel & Places' },
  { word: 'station', category: 'Travel & Places' },
  { word: 'cottage', category: 'Travel & Places' },
  { word: 'lantern', category: 'Travel & Places' },
  { word: 'compass', category: 'Travel & Places' },

  // Tools & Objects
  { word: 'hammer', category: 'Tools & Objects' },
  { word: 'wrench', category: 'Tools & Objects' },
  { word: 'ladder', category: 'Tools & Objects' },
  { word: 'needle', category: 'Tools & Objects' },
  { word: 'spindle', category: 'Tools & Objects' },
  { word: 'cradle', category: 'Tools & Objects' },
  { word: 'turret', category: 'Tools & Objects' },
  { word: 'plunger', category: 'Tools & Objects' },
  { word: 'staple', category: 'Tools & Objects' },
  { word: 'pliers', category: 'Tools & Objects' },
  { word: 'chisel', category: 'Tools & Objects' },
  { word: 'beacon', category: 'Tools & Objects' },

  // Animals
  { word: 'falcon', category: 'Animals' },
  { word: 'monkey', category: 'Animals' },
  { word: 'parrot', category: 'Animals' },
  { word: 'turtle', category: 'Animals' },
  { word: 'rabbit', category: 'Animals' },
  { word: 'walrus', category: 'Animals' },
  { word: 'gopher', category: 'Animals' },
  { word: 'ferret', category: 'Animals' },
  { word: 'iguana', category: 'Animals' },
  { word: 'cobra', category: 'Animals' },
  { word: 'bison', category: 'Animals' },
  { word: 'cricket', category: 'Animals' },
  { word: 'pelican', category: 'Animals' },
  { word: 'sparrow', category: 'Animals' },

  // Emotions & Traits
  { word: 'courage', category: 'Emotions & Traits' },
  { word: 'gentle', category: 'Emotions & Traits' },
  { word: 'patient', category: 'Emotions & Traits' },
  { word: 'loyal', category: 'Emotions & Traits' },
  { word: 'humble', category: 'Emotions & Traits' },
  { word: 'clever', category: 'Emotions & Traits' },
  { word: 'curious', category: 'Emotions & Traits' },
  { word: 'brisk', category: 'Emotions & Traits' },
  { word: 'mellow', category: 'Emotions & Traits' },
  { word: 'eager', category: 'Emotions & Traits' },
  { word: 'vivid', category: 'Emotions & Traits' },
  { word: 'witty', category: 'Emotions & Traits' },
  { word: 'nimble', category: 'Emotions & Traits' },
  { word: 'jolly', category: 'Emotions & Traits' },

  // Science & Ideas
  { word: 'equation', category: 'Science & Ideas' },
  { word: 'particle', category: 'Science & Ideas' },
  { word: 'molecule', category: 'Science & Ideas' },
  { word: 'gravity', category: 'Science & Ideas' },
  { word: 'oxygen', category: 'Science & Ideas' },
  { word: 'voltage', category: 'Science & Ideas' },
  { word: 'prism', category: 'Science & Ideas' },
  { word: 'neutron', category: 'Science & Ideas' },
  { word: 'bacteria', category: 'Science & Ideas' },
  { word: 'crystal', category: 'Science & Ideas' },
  { word: 'theorem', category: 'Science & Ideas' },
  { word: 'catalyst', category: 'Science & Ideas' },

  // Colors & Shapes
  { word: 'scarlet', category: 'Colors & Shapes' },
  { word: 'indigo', category: 'Colors & Shapes' },
  { word: 'amber', category: 'Colors & Shapes' },
  { word: 'diamond', category: 'Colors & Shapes' },
  { word: 'emerald', category: 'Colors & Shapes' },
  { word: 'sapphire', category: 'Colors & Shapes' },
  { word: 'crimson', category: 'Colors & Shapes' },
  { word: 'turquoise', category: 'Colors & Shapes' },
  { word: 'beige', category: 'Colors & Shapes' },
  { word: 'octagon', category: 'Colors & Shapes' },
  { word: 'pyramid', category: 'Colors & Shapes' },
  { word: 'maroon', category: 'Colors & Shapes' },

  // Activities & Sports
  { word: 'archery', category: 'Activities & Sports' },
  { word: 'kayak', category: 'Activities & Sports' },
  { word: 'surfing', category: 'Activities & Sports' },
  { word: 'jogging', category: 'Activities & Sports' },
  { word: 'climbing', category: 'Activities & Sports' },
  { word: 'wrestling', category: 'Activities & Sports' },
  { word: 'fencing', category: 'Activities & Sports' },
  { word: 'bowling', category: 'Activities & Sports' },
  { word: 'paddle', category: 'Activities & Sports' },
  { word: 'stroll', category: 'Activities & Sports' },

  // Professions
  { word: 'surgeon', category: 'Professions' },
  { word: 'captain', category: 'Professions' },
  { word: 'lawyer', category: 'Professions' },
  { word: 'pilot', category: 'Professions' },
  { word: 'chef', category: 'Professions' },
  { word: 'architect', category: 'Professions' },
  { word: 'plumber', category: 'Professions' },
  { word: 'dentist', category: 'Professions' },
  { word: 'therapist', category: 'Professions' },
  { word: 'gardener', category: 'Professions' },
  { word: 'librarian', category: 'Professions' },
  { word: 'mechanic', category: 'Professions' },
] as const;

/**
 * Flat indexable list of words for generator access. Same data as WORD_BANK
 * but re-exported for direct numeric indexing.
 */
export const WORD_LIST: readonly string[] = WORD_BANK.map((e) => e.word);

/**
 * Category lookup by word (for the generator to return the category hint).
 */
const CATEGORY_MAP = new Map<string, string>(
  WORD_BANK.map((e) => [e.word, e.category]),
);

export function categoryForWord(word: string): string {
  return CATEGORY_MAP.get(word) ?? 'General';
}
