#!/usr/bin/env node
/**
 * Word Match content pack generator (006R task 3.2).
 *
 * Regenerates the language-word-match content pack with the new semantic rule:
 * exactly one option must be a synonym of the prompt, and the other three must
 * be plausible distractors from different families.
 *
 * Usage: node scripts/generate-word-match-pack.mjs [--seed N]
 *   --seed N  use a specific random seed for reproducibility
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK_PATH = join(REPO_ROOT, 'apps', 'mobile', 'src', 'games', 'language-word-match', 'content', 'pack.json');

// Simple seeded RNG for reproducibility
class SeededRng {
  constructor(seed) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }
  
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

// Parse command line args
const seedArg = process.argv.find(a => a.startsWith('--seed='));
const seed = seedArg ? parseInt(seedArg.split('=')[1]) : Date.now();

console.log(`Generating Word Match pack with seed: ${seed}`);

// Load existing pack to get families
const existingPack = JSON.parse(readFileSync(PACK_PATH, 'utf8'));
const families = existingPack.families;
const familyNames = Object.keys(families);

const rng = new SeededRng(seed);
const items = [];
let id = 1;

// Generate items for each family
for (const [familyId, words] of Object.entries(families)) {
  // Generate up to 3 items per family (prompt + correct synonym + 3 distractors)
  const itemsPerFamily = Math.min(3, words.length - 1);
  
  for (let i = 0; i < itemsPerFamily; i++) {
    const prompt = words[i];
    
    // Pick a correct synonym (different from prompt)
    const synonyms = words.filter(w => w !== prompt);
    const correctWord = rng.pick(synonyms);
    
    // Pick 3 distractors from different families
    const distractors = [];
    const otherFamilies = rng.shuffle(familyNames.filter(f => f !== familyId));
    
    for (const otherFamily of otherFamilies) {
      if (distractors.length >= 3) break;
      
      const otherWords = families[otherFamily].filter(w => w !== prompt && w !== correctWord && !distractors.includes(w));
      if (otherWords.length > 0) {
        distractors.push(rng.pick(otherWords));
      }
    }
    
    if (distractors.length !== 3) {
      console.warn(`Warning: Could not find 3 distractors for ${prompt} in family ${familyId}`);
      continue;
    }
    
    // Create options array and shuffle
    const options = rng.shuffle([correctWord, ...distractors]);
    const correctIndex = options.indexOf(correctWord);
    
    // Assign tier based on position
    const tier = i === 0 ? 't1' : i === 1 ? 't2' : 't3';
    
    items.push({
      id: 'wm-' + String(id).padStart(4, '0'),
      prompt,
      options,
      correctIndex,
      tier,
      family: familyId,
    });
    
    id++;
  }
}

// Build new pack
const newPack = {
  packId: existingPack.packId,
  packVersion: '2.0.0', // Major version bump for semantic change
  itemCount: items.length,
  families: existingPack.families,
  items,
};

// Validate the new pack
console.log(`Generated ${items.length} items`);

// Check that each item has exactly one synonym
let valid = true;
for (const item of items) {
  const familyWords = new Set(families[item.family].map(w => w.toLowerCase()));
  const synonymCount = item.options.filter(o => familyWords.has(o.toLowerCase())).length;
  
  if (synonymCount !== 1) {
    console.error(`Invalid item ${item.id}: ${synonymCount} synonyms (expected 1)`);
    valid = false;
  }
  
  if (!familyWords.has(item.options[item.correctIndex].toLowerCase())) {
    console.error(`Invalid item ${item.id}: correct answer not in family`);
    valid = false;
  }
}

if (!valid) {
  console.error('Pack validation failed!');
  process.exit(1);
}

// Write the pack
writeFileSync(PACK_PATH, JSON.stringify(newPack, null, 2) + '\n');
console.log(`Wrote ${PACK_PATH}`);
console.log('Pack version: 2.0.0');
