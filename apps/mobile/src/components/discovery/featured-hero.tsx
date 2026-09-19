/**
 * Featured hero for the Games library (Campaign 024; Campaign 026 identity
 * rebuild).
 *
 * The single recommendation card that leads the library, and the strongest
 * colour on the screen: a `hero` Card dyed in the recommended game's domain
 * family with an identity spark mark, the category eyebrow, the game name and
 * the kernel's one-line why. The whole card is one tap target into the detail
 * screen — no nested buttons, so assistive technology meets exactly one action
 * here. "Open game details" is copy, not a second control.
 */

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GameWorldArt } from '@/components/discovery/game-identity';
import { useTheme } from '@/hooks/use-theme';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Spark } from '@/components/ui/spark';
import { Spacing } from '@/theme/tokens';
import type { DiscoverySnapshot } from './discovery-data';
import { masteryTierLabel, useDomainHue } from './game-card';

export function FeaturedHero({ data }: { data: DiscoverySnapshot }) {
  const theme = useTheme();
  const top = data.recommended[0];
  const hue = useDomainHue(top?.game.primaryCategory ?? '');
  const topGame = top?.game;
  const why = top?.components[0]?.reason;
  const summary = topGame ? data.masteryByGame.get(topGame.id) : undefined;
  const favorite = topGame ? data.favorites.has(topGame.id) : false;

  if (!top || !topGame) {
    return null;
  }

  const textColor = hue ? hue.softText : theme.accentText;

  return (
    <Card
      variant="hero"
      shape="poster"
      padding="none"
      testID="games-featured"
      style={{
        backgroundColor: hue?.soft ?? theme.accentSoft,
        // 2 dp dyed-hero border, matching the game intro/detail, progress
        // and mastery heroes (Campaign 026 visual-QA: one hero border weight).
        borderWidth: hue ? 2 : 0,
        borderColor: hue?.base,
      }}
      onPress={() => router.push(`/game-detail/${topGame.id}`)}
      accessibilityLabel={`Featured game: ${topGame.name}, ${topGame.primaryCategory} game${favorite ? ', favorited' : ''}${summary ? `, ${masteryTierLabel(summary.tier)}` : ''}${why ? `. ${why}` : ''}`}
      accessibilityHint="Open game details">
      <GameWorldArt game={topGame} size="hero" testID="games-featured-world" />
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Badge label="★ Recommended" size="sm" />
          <View style={styles.metaSpacer} />
          {summary ? (
            <ThemedText type="caption" style={{ color: textColor }}>
              {masteryTierLabel(summary.tier)}
            </ThemedText>
          ) : null}
          {favorite ? (
            <ThemedText type="body" style={{ color: textColor }} allowFontScaling={false}>
              ★
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.heroRow}>
          <View style={styles.heroTexts}>
            <ThemedText type="eyebrow" style={{ color: textColor }} numberOfLines={1}>
              {topGame.primaryCategory}
            </ThemedText>
            <ThemedText type="title" numberOfLines={2}>
              {topGame.name}
            </ThemedText>
            {why ? (
              <ThemedText type="bodySmall" style={{ color: textColor }} numberOfLines={2}>
                {why}
              </ThemedText>
            ) : null}
          </View>
          <Spark size={44} color={hue?.base ?? theme.accent} />
        </View>
        <ThemedText type="label" style={{ color: textColor }}>
          Open game details ›
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.twoHalf,
    padding: Spacing.four,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaSpacer: {
    flex: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroTexts: {
    flex: 1,
    flexShrink: 1,
    gap: Spacing.one,
  },
});
