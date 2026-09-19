/**
 * `GamePosterTile` — the catalog's browse unit (campaign 055).
 *
 * Campaign 052: "the immediate browse experience is a repeated stack of large
 * cards whose metadata grammar outweighs game desire… Symbol Tracker, Next in
 * Sequence, Word Scramble and Card Sort have different objects but share nearly
 * the same large framed-card grammar." The storefront fix is a dense poster
 * grid: every tile repeats the same *slot* (art field + identity plinth) while
 * the art itself carries the difference. Metadata is compressed to a name, a
 * kicker and at most one state badge.
 *
 * All navigation, favourite and mastery contracts are unchanged; the tile is a
 * presentation wrapper around the same registry data and detail route.
 */

import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameWorldArt, getGameIdentity, IdentityMark } from '@/components/discovery/game-identity';
import { masteryTierLabel, useDomainHue } from '@/components/discovery/game-card';
import { ThemedText } from '@/components/themed-text';
import { Tappable } from '@/components/ui/tappable';
import { useTheme } from '@/hooks/use-theme';
import type { MasterySummary } from '@/mastery';
import type { GameDefinition } from '@/registry/registry';
import { Radii, Spacing } from '@/theme/tokens';
import { HAIRLINE } from '@/components/ui/radius';

export interface GamePosterTileProps {
  game: Pick<GameDefinition, 'id' | 'name' | 'primaryCategory'>;
  isFavorite?: boolean;
  mastery?: MasterySummary | null;
  testID?: string;
}

export const GamePosterTile = memo(function GamePosterTile({
  game,
  isFavorite = false,
  mastery = null,
  testID,
}: GamePosterTileProps) {
  const theme = useTheme();
  const hue = useDomainHue(game.primaryCategory);
  const identity = getGameIdentity(game);
  const tier = mastery ? masteryTierLabel(mastery.tier) : null;
  const tileID = testID ?? `game-card-${game.id}`;

  return (
    <Tappable
      testID={tileID}
      onPress={() => router.push(`/game-detail/${game.id}`)}
      accessibilityLabel={`${game.name}, ${game.primaryCategory} game${isFavorite ? ', favorited' : ''}${tier ? `, ${tier}` : ''}`}
      accessibilityHint="Open game details"
      style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
      pressedStyle={{ backgroundColor: theme.backgroundSelected, opacity: 0.95 }}>
      <View style={styles.art}>
        <GameWorldArt game={game} size="card" testID={`${tileID}-world`} />
      </View>
      <View style={styles.plinth}>
        <View style={styles.kickerRow}>
          <IdentityMark
            family={identity.family}
            size={18}
            color={hue?.base ?? theme.textSecondary}
            testID={`${tileID}-identity`}
          />
          <ThemedText
            type="eyebrow"
            themeColor="textSecondary"
            numberOfLines={1}
            style={styles.kicker}>
            {identity.verb}
          </ThemedText>
          {isFavorite ? (
            <ThemedText type="caption" themeColor="warning" allowFontScaling={false} aria-hidden>
              ★
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="bodyLarge" numberOfLines={2} style={styles.name}>
          {game.name}
        </ThemedText>
        {tier ? (
          <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
            {tier}
          </ThemedText>
        ) : null}
      </View>
    </Tappable>
  );
});

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: Radii.small,
    borderWidth: HAIRLINE,
    overflow: 'hidden',
  },
  art: {
    // Poster art is the tile's headline; the plinth carries the name.
    height: 104,
  },
  plinth: {
    padding: Spacing.two,
    gap: Spacing.one,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  kicker: {
    flex: 1,
  },
  name: {
    fontWeight: '800',
  },
});
