/**
 * Suggested Next storefront contract (Campaign 055).
 *
 * The featured moment must present the top pick as a `GameStage` — world art
 * before metadata, one action key — with its factual reason underneath and a
 * compact poster row of alternatives. This is the storefront grammar that
 * replaces the old banner-card hero.
 */

import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';

import type { GameDefinition } from '@/registry/registry';

import type { DiscoverySnapshot } from '../discovery-data';
import { SuggestedNext } from '../suggested-next';

function makeGame(
  id: string,
  name: string,
  primaryCategory: GameDefinition['primaryCategory'],
): GameDefinition {
  return {
    id,
    name,
    primaryCategory,
    description: `${name} trains your brain.`,
    sdkVersion: '0.1.0',
    gameVersion: '1.0.0',
    generatorVersion: '1.0.0',
    contentVersion: null,
    hasTutorial: false,
  };
}

const TOP = makeGame('memory-alpha', 'Memory Alpha', 'Memory');
const SECOND = makeGame('attention-evo', 'Attention Evo', 'Attention');
const THIRD = makeGame('logic-prime', 'Logic Prime', 'Logic & Problem Solving');

const SNAPSHOT: DiscoverySnapshot = {
  recommended: [
    {
      game: TOP,
      score: 3,
      score01: 1,
      components: [
        {
          key: 'novelty',
          weight: 2,
          value: 1,
          contribution: 2,
          reason: 'You have not tried this game yet.',
        },
      ],
    },
    { game: SECOND, score: 2, score01: 0.6, components: [] },
  ],
  nearBest: [THIRD],
  rusty: [],
  favorites: new Set([SECOND.id]),
  masteryByGame: new Map(),
};

describe('suggested next storefront', () => {
  it('leads with the top pick as a game stage carrying one action key', async () => {
    await render(<SuggestedNext data={SNAPSHOT} />);

    const suggested = screen.getByTestId('games-suggested-next');
    expect(within(suggested).getByText('Suggested next')).toBeOnTheScreen();

    const primary = within(suggested).getByTestId('games-suggested-primary');
    const stage = within(primary).getByTestId('games-featured');
    // World art is decorative (hidden from the a11y tree by design), so the
    // storefront contract queries it with `includeHiddenElements`.
    expect(
      within(stage).getByTestId('games-featured-world', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(within(stage).getByText('Memory Alpha')).toBeOnTheScreen();
    expect(within(stage).getByTestId('games-suggested-open')).toBeOnTheScreen();

    expect(screen.getByTestId('games-suggested-reason')).toHaveTextContent(
      'Suggested because: You have not tried this game yet.',
    );
  });

  it('shows the supporting alternatives as compact poster tiles', async () => {
    await render(<SuggestedNext data={SNAPSHOT} />);

    const alternatives = screen.getByTestId('games-suggested-alternatives');
    for (const game of [SECOND, THIRD]) {
      const tile = within(alternatives).getByTestId(`games-suggested-alternative.${game.id}`);
      expect(
        within(tile).getByTestId(`games-suggested-alternative.${game.id}-world`, {
          includeHiddenElements: true,
        }),
      ).toBeOnTheScreen();
    }
    // The top pick is the stage's job; it never repeats as an alternative.
    expect(within(alternatives).queryByTestId(`games-suggested-alternative.${TOP.id}`)).toBeNull();
  });
});
