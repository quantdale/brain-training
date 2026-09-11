/**
 * Shared game card for the library grid and discovery shelves (Campaign 024).
 *
 * One card language everywhere a game appears outside a session: a pressable
 * {@link Card} carrying the domain identity colour (dot + category eyebrow in
 * the domain text slot), the game name and description, the mastery tier and
 * the favourite state. The accessible name folds name, category, mastery and
 * favourite state into one label with an "Open game details" hint, so every
 * card is reachable by keyboard and screen reader without extra tab stops.
 */

import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { MasterySummary, MasteryTier } from '@/mastery';
import type { GameDefinition } from '@/registry/registry';
import { DomainColors, Radii, Spacing } from '@/theme/tokens';

const TIER_LABEL: Record<MasteryTier, string> = {
  unplayed: 'New',
  learning: 'Learning',
  developing: 'Developing',
  proficient: 'Proficient',
  advanced: 'Advanced',
  mastered: 'Mastered',
};

/** Player-facing label for a mastery tier (shared with detail + shelves). */
export function masteryTierLabel(tier: MasteryTier): string {
  return TIER_LABEL[tier];
}

/**
 * Registry category → domain identity key. The registry spells categories
 * `Memory`-style while the palette keys are lowercase, so the lookup folds
 * case instead of assuming they already match.
 */
export function domainKeyFor(category: string): keyof typeof DomainColors.light | null {
  const key = category.toLowerCase() as keyof typeof DomainColors.light;
  return key in DomainColors.light ? key : null;
}

/** Subset of the definition a card needs (keeps shelves testable). */
export type GameCardGame = Pick<
  GameDefinition,
  'id' | 'name' | 'primaryCategory' | 'description'
>;

export interface GameCardProps {
  game: GameCardGame;
  /** Favourite state (the toggle itself lives on the detail screen). */
  isFavorite?: boolean;
  /** Mastery summary; omit while unloaded and the tier badge stays hidden. */
  mastery?: MasterySummary | null;
  testID?: string;
}

export const GameCard = memo(function GameCard({
  game,
  isFavorite = false,
  mastery = null,
  testID,
}: GameCardProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const domain = domainKeyFor(game.primaryCategory);
  const domainColors = domain ? DomainColors[scheme][domain] : null;
  const tier = mastery ? masteryTierLabel(mastery.tier) : null;

  return (
    <Card
      variant="plain"
      testID={testID ?? `game-card-${game.id}`}
      onPress={() => router.push(`/game-detail/${game.id}`)}
      accessibilityLabel={`${game.name}, ${game.primaryCategory} game${isFavorite ? ', favorited' : ''}${tier ? `, ${tier}` : ''}`}
      accessibilityHint="Open game details">
      <View style={styles.body}>
        <View style={styles.metaRow}>
          {domainColors ? (
            <View
              style={[styles.dot, { backgroundColor: domainColors.base }]}
            />
          ) : null}
          <ThemedText
            type="eyebrow"
            themeColor="textSecondary"
            style={domainColors ? { color: domainColors.text } : undefined}
            numberOfLines={1}>
            {game.primaryCategory}
          </ThemedText>
          <View style={styles.metaSpacer} />
          {isFavorite ? (
            <ThemedText type="body" themeColor="textSecondary">
              ★
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="headline" numberOfLines={2}>
          {game.name}
        </ThemedText>
        {game.description ? (
          <ThemedText
            type="bodySmall"
            themeColor="textSecondary"
            numberOfLines={3}>
            {game.description}
          </ThemedText>
        ) : null}
        {tier ? <Badge label={tier} size="sm" /> : null}
      </View>
    </Card>
  );
});

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
  dot: {
    width: Spacing.three,
    height: Spacing.three,
    borderRadius: Radii.pill,
  },
});
