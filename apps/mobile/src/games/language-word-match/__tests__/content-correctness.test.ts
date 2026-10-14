import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';

import { loadContentPack } from '../content-validation';
import { selectRound } from '../generator';

describe('Word Match reviewed meaning regressions', () => {
  // Preserve the defining meaning, not just membership in a broad family:
  // gradual changes by degrees; a jog is a slow trot; stride is purposeful
  // walking; warm is moderate heat; true agrees with fact.
  it.each([
    ['gaze', 'stare'], ['stare', 'gaze'], ['gratified', 'satisfied'],
    ['gradual', 'incremental'], ['stride', 'march'], ['jog', 'trot'],
    ['warm', 'tepid'], ['true', 'factual'],
  ])(
    '%s keeps the intended meaning after seeded option shuffling', (prompt, answer) => {
      const item = loadContentPack().items.find((candidate) => candidate.prompt === prompt)!;
      const round = selectRound({
        rng: createRng(`meaning-${prompt}`), roundIndex: 0, pool: [item],
        usedItemIds: new Set(), previousRound: null,
      });
      expect(round.correctWord).toBe(answer);
      expect(round.options[round.correctIndex]).toBe(answer);
    },
  );

  it('does not offer a second happiness synonym as a wrong answer to jubilant', () => {
    const item = loadContentPack().items.find((candidate) => candidate.prompt === 'jubilant')!;
    const synonyms = new Set(['elated', 'delighted', 'overjoyed', 'thrilled', 'joyful']);
    expect(item.options.filter((option) => synonyms.has(option))).toEqual([item.correctWord]);
  });
});
