/**
 * Shared game card for the library grid and discovery shelves (Campaign 024;
 * Campaign 026 identity rebuild; Campaign 032 catalog identity).
 *
 * One card language everywhere a game appears outside a session: a pressable
 * {@link Card} carrying a restrained mechanic identity — a family motif, a
 * mechanic verb, and one interaction sentence — with the existing domain hue
 * retained as a quiet category cue. The accessible name folds name, category,
 * mastery and favourite state into one label with an "Open game details" hint,
 * so every card is reachable by keyboard and screen reader without extra tab
 * stops.
 */

import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameWorldArt, getGameIdentity, IdentityMark } from '@/components/discovery/game-identity';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { MasterySummary, MasteryTier } from '@/mastery';
import type { GameDefinition } from '@/registry/registry';
import { DomainColors, Spacing, type DomainName } from '@/theme/tokens';

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
export function domainKeyFor(category: string): DomainName | null {
  const key = category.toLowerCase() as DomainName;
  return key in DomainColors.light ? key : null;
}

/** The four colour slots a surface needs from one domain family. */
export interface DomainHue {
  base: string;
  soft: string;
  softText: string;
  on: string;
}

/**
 * Resolve a domain identity family for the active theme.
 *
 * The v3 token table publishes domain families structurally (`DomainColors`);
 * the flat `Colors` palette may also expose them (`memory`, `memorySoft`, …).
 * Prefer the flat slot when the active theme has it and fall back to the
 * structured family otherwise, so a card can never render an undefined hue
 * while the theme foundation is still landing.
 */
export function useDomainHue(category: string): DomainHue | null {
  const theme = useTheme() as unknown as Record<string, string | undefined>;
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const domain = domainKeyFor(category);
  if (!domain) {
    return null;
  }
  const flat: DomainHue = {
    base: theme[domain] ?? '',
    soft: theme[`${domain}Soft`] ?? '',
    softText: theme[`${domain}SoftText`] ?? '',
    on: theme[`${domain}On`] ?? '',
  };
  if (flat.base && flat.soft && flat.softText && flat.on) {
    return flat;
  }
  const family = DomainColors[scheme][domain];
  return { base: family.base, soft: family.soft, softText: family.softText, on: family.on };
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
  const theme = useTheme();
  const hue = useDomainHue(game.primaryCategory);
  const identity = getGameIdentity(game);
  const tier = mastery ? masteryTierLabel(mastery.tier) : null;

  return (
    <Card
      variant="plain"
      shape="poster"
      padding="none"
      testID={testID ?? `game-card-${game.id}`}
      onPress={() => router.push(`/game-detail/${game.id}`)}
      accessibilityLabel={`${game.name}, ${game.primaryCategory} game${isFavorite ? ', favorited' : ''}${tier ? `, ${tier}` : ''}`}
      accessibilityHint="Open game details">
      <GameWorldArt game={game} size="card" testID={testID ? `${testID}-world` : `game-card-${game.id}-world`} />
      {/* Domain edge keeps the existing category cue without competing with the mechanic identity. */}
      <View
        style={[styles.ribbon, hue ? { backgroundColor: hue.base } : { backgroundColor: theme.border }]}
      />
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <IdentityMark
            family={identity.family}
            size={34}
            color={hue?.softText ?? theme.textSecondary}
            testID={testID ? `${testID}-identity` : `game-card-${game.id}-identity`}
          />
          <ThemedText
            type="eyebrow"
            themeColor="textSecondary"
            style={hue ? { color: hue.softText } : undefined}
            numberOfLines={1}>
            {identity.verb} · {game.primaryCategory}
          </ThemedText>
          <View style={styles.metaSpacer} />
          {isFavorite ? (
            <ThemedText type="body" themeColor="warning" allowFontScaling={false}>
              ★
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="headline" numberOfLines={2}>
          {game.name}
        </ThemedText>
        {identity.interaction ? (
          <ThemedText type="bodySmall" themeColor="textSecondary" numberOfLines={3}>
            {identity.interaction}
          </ThemedText>
        ) : null}
        {tier ? <Badge label={tier} size="sm" /> : null}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  ribbon: {
    height: Spacing.oneHalf,
  },
  body: {
    padding: Spacing.twoHalf,
    gap: Spacing.oneHalf,
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
