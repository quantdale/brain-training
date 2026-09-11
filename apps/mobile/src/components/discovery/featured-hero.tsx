/**
 * Featured hero for the Games library (Campaign 024, PATTERNS-CORE 11).
 *
 * The single recommendation card that leads the library: a `hero` Card with
 * the domain accent (category eyebrow in the domain text slot), the game
 * name, the kernel's one-line why, and the current mastery/favourite state.
 * The whole card is one tap target into the detail screen — no nested
 * buttons, so assistive technology meets exactly one action here.
 */

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DomainColors, Spacing } from '@/theme/tokens';
import type { DiscoverySnapshot } from './discovery-data';
import { domainKeyFor, masteryTierLabel } from './game-card';

export function FeaturedHero({ data }: { data: DiscoverySnapshot }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const top = data.recommended[0];
  if (!top) {
    return null;
  }
  const { game } = top;
  const why = top.components[0]?.reason;
  const domain = domainKeyFor(game.primaryCategory);
  const domainColors = domain ? DomainColors[scheme][domain] : null;
  const summary = data.masteryByGame.get(game.id);
  const favorite = data.favorites.has(game.id);

  return (
    <Card
      variant="hero"
      padding="lg"
      testID="games-featured"
      onPress={() => router.push(`/game-detail/${game.id}`)}
      accessibilityLabel={`Featured game: ${game.name}, ${game.primaryCategory} game${favorite ? ', favorited' : ''}${summary ? `, ${masteryTierLabel(summary.tier)}` : ''}${why ? `. ${why}` : ''}`}
      accessibilityHint="Open game details">
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Badge label="Recommended" size="sm" />
          <View style={styles.metaSpacer} />
          {summary ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {masteryTierLabel(summary.tier)}
            </ThemedText>
          ) : null}
          {favorite ? (
            <ThemedText type="body" themeColor="textSecondary">
              ★
            </ThemedText>
          ) : null}
        </View>
        <ThemedText
          type="eyebrow"
          themeColor="textSecondary"
          style={domainColors ? { color: domainColors.text } : undefined}
          numberOfLines={1}>
          {game.primaryCategory}
        </ThemedText>
        <ThemedText type="title" numberOfLines={2}>
          {game.name}
        </ThemedText>
        {why ? (
          <ThemedText
            type="bodySmall"
            themeColor="textSecondary"
            numberOfLines={2}>
            {why}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaSpacer: {
    flex: 1,
  },
});
