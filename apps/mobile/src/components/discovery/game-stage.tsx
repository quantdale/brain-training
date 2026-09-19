/**
 * `GameStage` — the shared game-world hero (campaign 055).
 *
 * Campaign 052: "the hero art behaves more like a mechanic diagram than a
 * compelling game world" and the same framed banner was reused across Games,
 * Game Detail and the GameHost intro. `GameStage` composes the existing
 * code-native world art with a compact identity plinth — kicker (motif +
 * category/verb), game title and an action slot — so a game is presented the
 * same way everywhere it is introduced, with its world visible before any
 * metadata sentence.
 *
 * It is presentation only: same registry data, same testIDs supplied by the
 * caller, same decorative-art a11y hiding inherited from `GameWorldArt`.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameWorldArt, getGameIdentity, IdentityMark } from '@/components/discovery/game-identity';
import { useDomainHue } from '@/components/discovery/game-card';
import { ThemedText } from '@/components/themed-text';
import { ArcadePanel } from '@/components/ui/arcade-panel';
import { useTheme } from '@/hooks/use-theme';
import type { GameDefinition } from '@/registry/registry';
import { Spacing, type TypographyName } from '@/theme/tokens';

export interface GameStageProps {
  game: Pick<GameDefinition, 'id' | 'name' | 'primaryCategory' | 'description'>;
  /** Kicker text above the title; defaults to the identity verb + category. */
  kicker?: string;
  /** Trailing slot on the kicker row (mastery badge, favourite state). */
  meta?: ReactNode;
  /** Art size: `hero` for in-flow heroes, `stage` for the detail hero. */
  size?: 'hero' | 'stage';
  /** Title typography; callers may drop to `headline` inside dense cards. */
  titleType?: TypographyName;
  /** Action slot under the title (Play key, Start key). */
  children?: ReactNode;
  testID?: string;
  artTestID?: string;
  titleTestID?: string;
  identityTestID?: string;
  describeTestID?: string;
  /** Optional one-line interaction sentence under the title. */
  showInteraction?: boolean;
  style?: object;
}

export function GameStage({
  game,
  kicker,
  meta,
  size = 'hero',
  titleType = 'gameTitle',
  children,
  testID,
  artTestID,
  titleTestID,
  identityTestID,
  describeTestID,
  showInteraction = false,
  style,
}: GameStageProps) {
  const theme = useTheme();
  const hue = useDomainHue(game.primaryCategory);
  const identity = getGameIdentity(game);
  const kickerText = kicker ?? `${identity.verb} · ${game.primaryCategory}`;

  return (
    <ArcadePanel padding="none" testID={testID} style={style}>
      <GameWorldArt game={game} size={size} testID={artTestID} />
      <View style={styles.body}>
        <View style={styles.kickerRow}>
          <IdentityMark
            family={identity.family}
            size={26}
            color={hue?.softText ?? theme.textSecondary}
            testID={identityTestID}
          />
          <ThemedText
            type="eyebrow"
            themeColor="textSecondary"
            style={styles.kicker}
            numberOfLines={1}>
            {kickerText}
          </ThemedText>
          {meta}
        </View>
        <ThemedText type={titleType} testID={titleTestID} numberOfLines={2}>
          {game.name}
        </ThemedText>
        {showInteraction && identity.interaction ? (
          <ThemedText type="bodyRead" themeColor="textSecondary" testID={describeTestID}>
            {identity.interaction}
          </ThemedText>
        ) : null}
        {children}
      </View>
    </ArcadePanel>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  kicker: {
    flex: 1,
  },
});
