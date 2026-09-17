/**
 * One recommendation model for the Games route.
 *
 * The personalization kernel still computes the useful signals (recommended,
 * near-best, and rusty). This component gives those signals one hierarchy:
 * one primary suggestion, its factual reason, and a small set of supporting
 * alternatives. The source shelves are not rendered as competing sections.
 */

import { StyleSheet, View } from 'react-native';

import { SectionHeader } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { GameCard } from '@/components/discovery/game-card';
import type { GameDefinition } from '@/registry/registry';
import { Spacing } from '@/theme/tokens';
import type { DiscoverySnapshot } from './discovery-data';

const ALTERNATIVE_COUNT = 2;

function uniqueGames(data: DiscoverySnapshot): GameDefinition[] {
  const seen = new Set<string>(data.recommended[0] ? [data.recommended[0].game.id] : []);
  const games: GameDefinition[] = [];
  const candidates = [
    ...data.recommended.slice(1).map((entry) => entry.game),
    ...data.nearBest,
    ...data.rusty,
  ];
  for (const game of candidates) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    games.push(game);
    if (games.length >= ALTERNATIVE_COUNT) break;
  }
  return games;
}

export function SuggestedNext({ data }: { data: DiscoverySnapshot }) {
  const top = data.recommended[0];
  const alternatives = uniqueGames(data);

  return (
    <View testID="games-suggested-next" style={styles.root}>
      <SectionHeader
        eyebrow="START HERE"
        title="Suggested next"
        caption="A focused pick based on your recent training"
      />
      {top ? (
        <View style={styles.primary} testID="games-suggested-primary">
          {top.components[0]?.reason ? (
            <ThemedText type="caption" themeColor="textSecondary" testID="games-suggested-reason">
              Suggested because: {top.components[0].reason}
            </ThemedText>
          ) : null}
          <GameCard
            game={top.game}
            isFavorite={data.favorites.has(top.game.id)}
            mastery={data.masteryByGame.get(top.game.id) ?? null}
            testID="games-featured"
          />
        </View>
      ) : (
        <ThemedText type="bodySmall" themeColor="textSecondary">
          Pick any game below to start a focused session.
        </ThemedText>
      )}
      {alternatives.length > 0 ? (
        <View style={styles.alternatives} testID="games-suggested-alternatives">
          <ThemedText type="eyebrow" themeColor="textMuted">
            MORE GOOD FITS
          </ThemedText>
          {alternatives.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              isFavorite={data.favorites.has(game.id)}
              mastery={data.masteryByGame.get(game.id) ?? null}
              testID={`games-suggested-alternative.${game.id}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.two,
  },
  primary: {
    gap: Spacing.one,
  },
  alternatives: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
