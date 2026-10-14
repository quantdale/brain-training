import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { loadContentPack } from '../content-validation';
import { selectRound } from '../generator';

// These editorial checks complement the mechanical pack validator: a valid
// part of speech and a unique keyed string do not establish a unique meaning.
describe('Context Fit reviewed meaning regressions', () => {
  const reviewed: [string, string][] = [
    ['cf-t2-26', 'The safety rules require every visitor to wear a helmet.'],
    ['cf-t2-13', 'The committee will review the proposal for errors before any vote.'],
    ['cf-t3-02', 'His argument was compelling, but the evidence remained anecdotal, based only on personal stories.'],
    ['cf-t3-03', 'The novel\'s ending followed no clear reason or pattern, so it felt arbitrary rather than tragic.'],
    ['cf-t3-05', 'The two theories are not contradictory but merely overlapping in scope, sharing some of the same ideas.'],
    ['cf-t3-08', 'His tone was light, but the mocking subtext was unmistakably sardonic.'],
    ['cf-t3-28', 'The claim “This statement is false” creates a classic paradox.'],
    ['cf-t3-60', 'Despite setbacks she recovered quickly and remained remarkably resilient.'],
  ];

  it.each(reviewed)('%s presents the reviewed single-answer context to the player', (id, completed) => {
    const item = loadContentPack().items.find((candidate) => candidate.id === id)!;
    expect(item).toBeDefined();
    const round = selectRound({
      rng: createRng(`meaning-${id}`), roundIndex: 0, pool: [item],
      usedItemIds: new Set(), previousRound: null,
    });
    expect(round.context.replace('___', round.correctWord)).toBe(completed);
    expect(round.options[round.correctIndex]).toBe(item.answer);
  });
});
