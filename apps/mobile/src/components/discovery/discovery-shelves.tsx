/**
 * Discovery shelves for the Games library (Campaign 024 UX wave).
 *
 * Rule-based replay rails over the snapshot from `useDiscoveryData` — this
 * component is presentational (no db access of its own) so the hero, the
 * shelves and the grid all render one consistent snapshot. Shelf entries use
 * the same {@link GameCard} language as the library grid; each section header
 * carries a "See all" action that expands the rail past its collapsed window.
 * Renders nothing when there is no evidence yet.
 */

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SectionHeader } from '@/components/shell';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/theme/tokens';
import type { GameDefinition } from '@/registry/registry';
import type { DiscoverySnapshot } from './discovery-data';
import { GameCard } from './game-card';

/** Rails show this many entries until "See all" expands them. */
const COLLAPSED_COUNT = 3;

interface Shelf {
  key: string;
  title: string;
  testID: string;
  games: GameDefinition[];
}

export function DiscoveryShelves({ data }: { data: DiscoverySnapshot }) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  // The top recommendation already leads the library as the featured hero.
  const shelves: Shelf[] = [
    {
      key: 'recommended',
      title: 'Recommended for today',
      testID: 'games-discovery-recommended',
      games: data.recommended.slice(1).map((entry) => entry.game),
    },
    {
      key: 'near-best',
      title: 'Near a personal best',
      testID: 'games-discovery-near-best',
      games: data.nearBest,
    },
    {
      key: 'rusty',
      title: 'Getting rusty',
      testID: 'games-discovery-rusty',
      games: data.rusty,
    },
  ].filter((shelf) => shelf.games.length > 0);

  if (shelves.length === 0) {
    return null;
  }

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <ThemedView testID="games-discovery">
      {shelves.map((shelf) => {
        const isOpen = expanded.has(shelf.key);
        const expandable = shelf.games.length > COLLAPSED_COUNT;
        const shown = isOpen ? shelf.games : shelf.games.slice(0, COLLAPSED_COUNT);
        return (
          <View key={shelf.key} style={styles.shelf} testID={shelf.testID}>
            <SectionHeader
              title={shelf.title}
              actionLabel={expandable ? (isOpen ? 'Show less' : 'See all') : undefined}
              onActionPress={expandable ? () => toggle(shelf.key) : undefined}
              actionTestID={expandable ? `${shelf.testID}-see-all` : undefined}
              actionAccessibilityLabel={
                expandable
                  ? isOpen
                    ? `Show fewer ${shelf.title} games`
                    : `See all ${shelf.title} games`
                  : undefined
              }
            />
            {shown.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                isFavorite={data.favorites.has(game.id)}
                mastery={data.masteryByGame.get(game.id) ?? null}
                testID={`${shelf.testID}.${game.id}`}
              />
            ))}
          </View>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  shelf: {
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
});
