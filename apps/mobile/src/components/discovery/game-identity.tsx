/**
 * Catalog-wide game identity language.
 *
 * The library has one identity vocabulary for all games: a small family
 * motif, a mechanic verb, and one sentence that tells a player what they do.
 * This is deliberately presentation-only. Stable game ids, registry metadata,
 * scoring, and session records remain owned by the SDK and game modules.
 */

import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { GameDefinition } from '@/sdk';
import { ArcadePalette, Radii, Spacing, type ColorTheme } from '@/theme/tokens';
import { useTheme } from '@/hooks/use-theme';

/** The eight mechanic families used by the catalog-wide identity system. */
export type GameIdentityFamily =
  | 'attention-visual-search'
  | 'memory-recall'
  | 'speed-reaction'
  | 'math-structured-input'
  | 'language-association-context'
  | 'logic-deduction'
  | 'flexibility-rule-switching'
  | 'spatial-transformation';

/** Internal motif shape; the shape is decorative and never replaces text. */
export type IdentityMotif =
  | 'search'
  | 'recall'
  | 'reaction'
  | 'input'
  | 'association'
  | 'deduction'
  | 'switching'
  | 'transformation';

export interface GameIdentity {
  readonly family: GameIdentityFamily;
  readonly motif: IdentityMotif;
  /** A short imperative that can lead a card or detail screen. */
  readonly verb: string;
  /** One concise sentence describing the player interaction. */
  readonly interaction: string;
}

export const IDENTITY_FAMILY_LABELS: Readonly<Record<GameIdentityFamily, string>> = {
  'attention-visual-search': 'Visual search',
  'memory-recall': 'Recall',
  'speed-reaction': 'Reaction',
  'math-structured-input': 'Structured input',
  'language-association-context': 'Association & context',
  'logic-deduction': 'Deduction',
  'flexibility-rule-switching': 'Rule switching',
  'spatial-transformation': 'Transformation',
};

const FAMILY_MOTIFS: Readonly<Record<GameIdentityFamily, IdentityMotif>> = {
  'attention-visual-search': 'search',
  'memory-recall': 'recall',
  'speed-reaction': 'reaction',
  'math-structured-input': 'input',
  'language-association-context': 'association',
  'logic-deduction': 'deduction',
  'flexibility-rule-switching': 'switching',
  'spatial-transformation': 'transformation',
};

/**
 * Stable presentational metadata for every generated catalog id.
 *
 * Keep this map keyed by ids rather than names: names are player-facing copy
 * and can be localized later, while ids are the catalog's durable identity.
 */
export const GAME_IDENTITIES = {
  'attention-odd-one-out': {
    family: 'attention-visual-search',
    motif: 'search',
    verb: 'Scan',
    interaction: 'Scan the board and tap the one item that breaks the pattern.',
  },
  'attention-sustained-vigilance': {
    family: 'attention-visual-search',
    motif: 'search',
    verb: 'Watch',
    interaction: 'Watch the stream and respond to signals while holding on the stop cue.',
  },
  'attention-symbol-tracker': {
    family: 'attention-visual-search',
    motif: 'search',
    verb: 'Track',
    interaction: 'Track the named symbols as the board scrambles, then pick them out.',
  },
  'attention-target-count': {
    family: 'attention-visual-search',
    motif: 'search',
    verb: 'Count',
    interaction: 'Count the highlighted targets in a flash of symbols, then choose the total.',
  },
  'attention-visual-search': {
    family: 'attention-visual-search',
    motif: 'search',
    verb: 'Find',
    interaction: 'Find the odd tile and tap it before the clock runs out.',
  },

  memory: {
    family: 'memory-recall',
    motif: 'recall',
    verb: 'Repeat',
    interaction: 'Watch the tiles light up, then repeat the sequence from memory.',
  },
  'memory-grid-recall': {
    family: 'memory-recall',
    motif: 'recall',
    verb: 'Rebuild',
    interaction: 'Study the highlighted cells, then rebuild the hidden pattern.',
  },
  'memory-pair-recall': {
    family: 'memory-recall',
    motif: 'recall',
    verb: 'Pair',
    interaction: "Learn each shape's partner, then recall the matching partner from a cue.",
  },
  'memory-pattern-tap-back': {
    family: 'memory-recall',
    motif: 'recall',
    verb: 'Replay',
    interaction: 'Watch a tile sequence, then tap it back in the same order.',
  },
  'memory-prospective-cue': {
    family: 'memory-recall',
    motif: 'recall',
    verb: 'Remember',
    interaction: 'Remember your signal symbols, then tap SIGNAL when one appears.',
  },
  'memory-running-order': {
    family: 'memory-recall',
    motif: 'recall',
    verb: 'Hold',
    interaction: 'Watch the stream, then recall only the last symbols in order.',
  },
  'memory-sequence-memory': {
    family: 'memory-recall',
    motif: 'recall',
    verb: 'Repeat',
    interaction: 'Watch the pads light up, then repeat the pattern before time runs out.',
  },

  'speed-color-match': {
    family: 'speed-reaction',
    motif: 'reaction',
    verb: 'Match',
    interaction: 'Match the swatch color, ignoring the inked word, as quickly as you can.',
  },
  'speed-order-sweep': {
    family: 'speed-reaction',
    motif: 'reaction',
    verb: 'Sweep',
    interaction: 'Sweep the numbers from smallest to largest before the timer drains.',
  },
  'speed-quick-compare': {
    family: 'speed-reaction',
    motif: 'reaction',
    verb: 'Compare',
    interaction: 'Compare two values and make the right fast decision.',
  },
  'speed-reaction-time': {
    family: 'speed-reaction',
    motif: 'reaction',
    verb: 'React',
    interaction: 'React to the signal and tap as quickly as you can.',
  },
  'speed-tap-rush': {
    family: 'speed-reaction',
    motif: 'reaction',
    verb: 'Tap',
    interaction: 'Tap each target before its window closes to keep the streak alive.',
  },

  'math-equation-builder': {
    family: 'math-structured-input',
    motif: 'input',
    verb: 'Build',
    interaction: 'Build an equation from the given numbers and operators to reach the target.',
  },
  'math-fast-math': {
    family: 'math-structured-input',
    motif: 'input',
    verb: 'Solve',
    interaction: 'Solve each arithmetic problem against the clock.',
  },
  'math-missing-operator': {
    family: 'math-structured-input',
    motif: 'input',
    verb: 'Complete',
    interaction: 'Complete the equation by choosing the operator that makes it true.',
  },
  'math-number-line-estimation': {
    family: 'math-structured-input',
    motif: 'input',
    verb: 'Estimate',
    interaction: 'Estimate where the value belongs on the number line, then tap your best spot.',
  },
  'math-value-ordering': {
    family: 'math-structured-input',
    motif: 'input',
    verb: 'Order',
    interaction: 'Order the values from smallest to largest before time runs out.',
  },

  'language-context-fit': {
    family: 'language-association-context',
    motif: 'association',
    verb: 'Connect',
    interaction: 'Connect the sentence to the word that fits its context.',
  },
  'language-sentence-builder': {
    family: 'language-association-context',
    motif: 'association',
    verb: 'Arrange',
    interaction: 'Arrange the scrambled words into the correct sentence.',
  },
  'language-word-chain': {
    family: 'language-association-context',
    motif: 'association',
    verb: 'Link',
    interaction: 'Link each word to the next by its starting letter.',
  },
  'language-word-match': {
    family: 'language-association-context',
    motif: 'association',
    verb: 'Match',
    interaction: 'Match the prompt with the word that means the same.',
  },
  'language-word-scramble': {
    family: 'language-association-context',
    motif: 'association',
    verb: 'Unscramble',
    interaction: 'Unscramble the letters using the category hint.',
  },

  'logic-code-cracker': {
    family: 'logic-deduction',
    motif: 'deduction',
    verb: 'Deduce',
    interaction: 'Deduce the hidden color code from feedback on each guess.',
  },
  'logic-deduction-table': {
    family: 'logic-deduction',
    motif: 'deduction',
    verb: 'Infer',
    interaction: 'Infer the requested value by chaining clues in the table.',
  },
  'logic-next-sequence': {
    family: 'logic-deduction',
    motif: 'deduction',
    verb: 'Predict',
    interaction: 'Predict the next term by spotting the sequence pattern.',
  },
  'logic-order-path': {
    family: 'logic-deduction',
    motif: 'deduction',
    verb: 'Place',
    interaction: 'Place each item in the one order allowed by the precedence clues.',
  },
  'logic-rule-grid': {
    family: 'logic-deduction',
    motif: 'deduction',
    verb: 'Solve',
    interaction: 'Solve the hidden grid cell by chaining row and column constraints.',
  },

  'flexibility-card-sort': {
    family: 'flexibility-rule-switching',
    motif: 'switching',
    verb: 'Sort',
    interaction: 'Sort each card by the active rule as the rule keeps changing.',
  },
  'flexibility-color-stroop': {
    family: 'flexibility-rule-switching',
    motif: 'switching',
    verb: 'Switch',
    interaction: 'Switch between ink and word rules while naming the ink color.',
  },
  'flexibility-cue-shift': {
    family: 'flexibility-rule-switching',
    motif: 'switching',
    verb: 'Shift',
    interaction: 'Read the cue, then switch the matching rule between trials.',
  },
  'flexibility-rule-flip': {
    family: 'flexibility-rule-switching',
    motif: 'switching',
    verb: 'Flip',
    interaction: 'Flip your strategy when the active color, shape, or number rule changes.',
  },
  'flexibility-task-switch': {
    family: 'flexibility-rule-switching',
    motif: 'switching',
    verb: 'Alternate',
    interaction: 'Alternate between micro-tasks and manage the cost of each switch.',
  },

  'spatial-coordinate-turn': {
    family: 'spatial-transformation',
    motif: 'transformation',
    verb: 'Orient',
    interaction: 'Follow turns and moves, then choose which way you finish facing.',
  },
  'spatial-fold-match': {
    family: 'spatial-transformation',
    motif: 'transformation',
    verb: 'Fold',
    interaction: 'Fold the grid mentally and choose the result of the merge.',
  },
  'spatial-grid-nav': {
    family: 'spatial-transformation',
    motif: 'transformation',
    verb: 'Navigate',
    interaction: "Follow the move and turn commands to find the marker's final cell.",
  },
  'spatial-mental-rotation': {
    family: 'spatial-transformation',
    motif: 'transformation',
    verb: 'Rotate',
    interaction: 'Rotate the candidate mentally and decide whether it matches.',
  },
  'spatial-transform-match': {
    family: 'spatial-transformation',
    motif: 'transformation',
    verb: 'Transform',
    interaction: 'Transform the grid by rotation or reflection, then choose the match.',
  },
} as const satisfies Readonly<Record<string, GameIdentity>>;

const FALLBACK_BY_CATEGORY: Readonly<Record<string, GameIdentity>> = {
  Memory: {
    family: 'memory-recall',
    motif: 'recall',
    verb: 'Recall',
    interaction: 'Remember the pattern, then reproduce what you saw.',
  },
  Attention: {
    family: 'attention-visual-search',
    motif: 'search',
    verb: 'Focus',
    interaction: 'Scan the challenge and select the target before time runs out.',
  },
  Speed: {
    family: 'speed-reaction',
    motif: 'reaction',
    verb: 'React',
    interaction: 'Make the right decision quickly while the clock is running.',
  },
  Math: {
    family: 'math-structured-input',
    motif: 'input',
    verb: 'Solve',
    interaction: 'Work through the structured problem and enter the right answer.',
  },
  Language: {
    family: 'language-association-context',
    motif: 'association',
    verb: 'Connect',
    interaction: 'Connect the prompt to the word or phrase that fits.',
  },
  'Logic & Problem Solving': {
    family: 'logic-deduction',
    motif: 'deduction',
    verb: 'Deduce',
    interaction: 'Use the clues to work out the one correct answer.',
  },
  Flexibility: {
    family: 'flexibility-rule-switching',
    motif: 'switching',
    verb: 'Switch',
    interaction: 'Adapt your response as the active rule changes.',
  },
  Spatial: {
    family: 'spatial-transformation',
    motif: 'transformation',
    verb: 'Transform',
    interaction: 'Change the view mentally, then choose the matching result.',
  },
};

export type GameIdentitySource = Pick<
  GameDefinition,
  'id' | 'name' | 'primaryCategory' | 'description'
>;

/** Resolve stable identity metadata with a category-safe fallback for fixtures. */
export function getGameIdentity(game: GameIdentitySource): GameIdentity {
  const identity = (GAME_IDENTITIES as Readonly<Record<string, GameIdentity>>)[game.id];
  if (identity) {
    return identity;
  }

  const fallback = FALLBACK_BY_CATEGORY[game.primaryCategory];
  if (fallback) {
    return game.description ? { ...fallback, interaction: game.description } : fallback;
  }

  return {
    family: 'attention-visual-search',
    motif: 'search',
    verb: 'Play',
    interaction: game.description ?? 'Scan the challenge and choose your answer.',
  };
}

export function identityFamilyLabel(family: GameIdentityFamily): string {
  return IDENTITY_FAMILY_LABELS[family];
}

export interface IdentityMarkProps {
  family: GameIdentityFamily;
  size?: number;
  color?: string;
  testID?: string;
}

interface MotifProps {
  motif: IdentityMotif;
  color: string;
  size: number;
}

/** Decorative, code-native family motif. Text beside it remains authoritative. */
function Motif({ motif, color, size }: MotifProps) {
  const stroke = Math.max(1.5, Math.round(size * 0.08));
  const dot = Math.max(3, Math.round(size * 0.18));
  const bar = Math.max(2, Math.round(size * 0.12));

  switch (motif) {
    case 'search':
      return (
        <View style={styles.motifCenter}>
          <View
            style={[
              styles.searchLens,
              {
                width: size * 0.38,
                height: size * 0.38,
                borderRadius: size * 0.19,
                borderWidth: stroke,
                borderColor: color,
              },
            ]}
          />
          <View
            style={[
              styles.searchHandle,
              {
                width: size * 0.28,
                height: stroke,
                backgroundColor: color,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </View>
      );
    case 'recall':
      return (
        <View style={styles.motifCenter}>
          <View style={[styles.recallBar, { width: size * 0.46, height: bar, backgroundColor: color }]} />
          <View style={[styles.recallBar, { width: size * 0.34, height: bar, backgroundColor: color }]} />
          <View style={[styles.recallBar, { width: size * 0.22, height: bar, backgroundColor: color }]} />
        </View>
      );
    case 'reaction':
      return (
        <View style={styles.reactionRow}>
          <View style={[styles.reactionBar, { width: bar, height: size * 0.25, backgroundColor: color }]} />
          <View style={[styles.reactionBar, { width: bar, height: size * 0.55, backgroundColor: color }]} />
          <View style={[styles.reactionBar, { width: bar, height: size * 0.8, backgroundColor: color }]} />
          <View style={[styles.reactionBar, { width: bar, height: size * 0.4, backgroundColor: color }]} />
        </View>
      );
    case 'input':
      return (
        <View style={styles.keypad}>
          {[0, 1, 2, 3].map((key) => (
            <View
              key={key}
              style={[styles.key, { width: dot, height: dot, borderRadius: dot * 0.3, backgroundColor: color }]}
            />
          ))}
        </View>
      );
    case 'association':
      return (
        <View style={styles.associationRow}>
          <View style={[styles.node, { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }]} />
          <View style={[styles.connector, { height: stroke, backgroundColor: color }]} />
          <View style={[styles.node, { width: dot * 1.25, height: dot * 1.25, borderRadius: dot, backgroundColor: color }]} />
          <View style={[styles.connector, { height: stroke, backgroundColor: color }]} />
          <View style={[styles.node, { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }]} />
        </View>
      );
    case 'deduction':
      return (
        <View style={styles.deductionTree}>
          <View style={[styles.node, { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }]} />
          <View style={[styles.treeBranch, { width: size * 0.48, height: stroke, backgroundColor: color }]} />
          <View style={styles.treeLeaves}>
            <View style={[styles.node, { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }]} />
            <View style={[styles.node, { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'switching':
      return (
        <View style={styles.switchingRows}>
          <View style={styles.switchingRow}>
            <View style={[styles.switchBar, { width: size * 0.38, height: stroke, backgroundColor: color }]} />
            <View style={[styles.chevron, { width: size * 0.18, height: size * 0.18, borderTopWidth: stroke, borderRightWidth: stroke, borderColor: color, transform: [{ rotate: '45deg' }] }]} />
          </View>
          <View style={styles.switchingRow}>
            <View style={[styles.chevron, { width: size * 0.18, height: size * 0.18, borderBottomWidth: stroke, borderLeftWidth: stroke, borderColor: color, transform: [{ rotate: '45deg' }] }]} />
            <View style={[styles.switchBar, { width: size * 0.38, height: stroke, backgroundColor: color }]} />
          </View>
        </View>
      );
    case 'transformation':
      return (
        <View style={styles.motifCenter}>
          <View
            style={[
              styles.transformOuter,
              {
                width: size * 0.58,
                height: size * 0.58,
                borderWidth: stroke,
                borderColor: color,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <View style={[styles.transformInner, { width: size * 0.2, height: size * 0.2, backgroundColor: color }]} />
        </View>
      );
  }
}

/**
 * A compact, decorative identity mark shared by cards and detail surfaces.
 * It is intentionally not accessible on its own: the adjacent family label,
 * verb, and interaction sentence provide the semantic channel.
 */
export function IdentityMark({ family, size = 36, color = '#1D4ED8', testID }: IdentityMarkProps) {
  const motif = FAMILY_MOTIFS[family];
  const radius = size <= 36 ? Radii.small : Radii.medium;

  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.mark, { width: size, height: size, borderRadius: radius, borderColor: color }]}>
      <Motif motif={motif} color={color} size={size} />
    </View>
  );
}

/** Size presets for the code-native world illustration. */
export type GameWorldArtSize = 'card' | 'hero' | 'stage';

export interface GameWorldArtProps {
  /** Game metadata only; no game logic or registry mutation is involved. */
  game: GameIdentitySource;
  size?: GameWorldArtSize;
  testID?: string;
}

const DOMAIN_BY_CATEGORY: Readonly<Record<string, keyof typeof ArcadePalette.light>> = {
  Memory: 'coral',
  Attention: 'cyan',
  Speed: 'yellow',
  Math: 'violet',
  Language: 'cyan',
  'Logic & Problem Solving': 'mint',
  Flexibility: 'coral',
  Spatial: 'yellow',
};

const DOMAIN_THEME_KEYS: Readonly<Record<string, string>> = {
  Memory: 'memory',
  Attention: 'attention',
  Speed: 'speed',
  Math: 'math',
  Language: 'language',
  'Logic & Problem Solving': 'logic',
  Flexibility: 'flexibility',
  Spatial: 'spatial',
};

function variantFor(id: string): number {
  return [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 3;
}

function worldColors(theme: ColorTheme, category: string) {
  const key = DOMAIN_THEME_KEYS[category] ?? 'accent';
  const staticKey = DOMAIN_BY_CATEGORY[category] ?? 'coral';
  const record = theme as unknown as Record<string, string>;
  return {
    base: record[key] ?? theme.accent,
    soft: record[`${key}Soft`] ?? theme.accentSoft,
    on: record[`${key}On`] ?? theme.accentOn,
    ink: theme.text,
    secondary: ArcadePalette.light[staticKey],
    surface: theme.surface,
  };
}

/** Small geometric tile used by the world stages. */
function WorldTile({
  color,
  size,
  style,
}: {
  color: string;
  size: number;
  style?: ViewStyle;
}) {
  return <View style={[styles.worldTile, { width: size, height: size, backgroundColor: color }, style]} />;
}

function WorldLines({ color, vertical = false }: { color: string; vertical?: boolean }) {
  return (
    <View style={styles.worldLines} pointerEvents="none">
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={[
            vertical ? styles.worldLineVertical : styles.worldLine,
            { [vertical ? 'left' : 'top']: `${(index + 1) * 20}%`, backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );
}

function WorldMotif({
  family,
  colors,
  variant,
  scale,
}: {
  family: GameIdentityFamily;
  colors: ReturnType<typeof worldColors>;
  variant: number;
  scale: number;
}) {
  const tile = Math.max(12, Math.round(20 * scale));
  const accent = variant === 1 ? colors.secondary : colors.base;
  switch (family) {
    case 'attention-visual-search':
      return (
        <>
          <WorldLines color={colors.base} />
          <View style={[styles.lens, { width: tile * 2.6, height: tile * 2.6, borderColor: accent }]} />
          <View style={[styles.lensHandle, { backgroundColor: accent, width: tile * 1.2, transform: [{ rotate: '45deg' }] }]} />
          <WorldTile color={colors.secondary} size={tile} style={styles.attentionTileOne} />
          <WorldTile color={colors.base} size={tile} style={styles.attentionTileTwo} />
          <WorldTile color={colors.on} size={tile * 0.72} style={styles.attentionTileThree} />
        </>
      );
    case 'memory-recall':
      return (
        <>
          <WorldLines color={colors.base} vertical />
          {[0, 1, 2, 3].map((index) => (
            <WorldTile
              key={index}
              color={index === (variant + 1) % 4 ? accent : colors.on}
              size={tile}
              style={{ left: `${18 + index * 18}%`, top: `${30 + (index % 2) * 18}%` }}
            />
          ))}
          <View style={[styles.memoryBar, { backgroundColor: accent, width: `${38 + variant * 12}%` }]} />
        </>
      );
    case 'speed-reaction':
      return (
        <>
          <View style={styles.speedBars}>
            {[0.28, 0.48, 0.78, 0.4, 0.62].map((height, index) => (
              <View
                key={index}
                style={[styles.speedBar, { height: `${height * 100}%`, backgroundColor: index === 2 ? accent : colors.base }]}
              />
            ))}
          </View>
          <View style={[styles.targetOuter, { borderColor: colors.on }]}>
            <View style={[styles.targetInner, { backgroundColor: accent }]} />
          </View>
        </>
      );
    case 'math-structured-input':
      return (
        <>
          <View style={styles.mathEquation}>
            <View style={[styles.mathBlock, { backgroundColor: colors.on }]} />
            <View style={[styles.mathOperator, { backgroundColor: accent }]} />
            <View style={[styles.mathBlock, { backgroundColor: colors.base }]} />
            <View style={[styles.mathEquals, { backgroundColor: colors.ink }]} />
            <View style={[styles.mathBlock, { backgroundColor: colors.secondary }]} />
          </View>
          <View style={styles.mathKeys}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <View key={index} style={[styles.mathKey, { backgroundColor: index === variant + 1 ? accent : colors.on }]} />
            ))}
          </View>
        </>
      );
    case 'language-association-context':
      return (
        <>
          <View style={styles.associationPath}>
            <View style={[styles.associationNode, { backgroundColor: colors.base }]} />
            <View style={[styles.associationConnector, { backgroundColor: accent }]} />
            <View style={[styles.associationNodeLarge, { backgroundColor: colors.on, borderColor: accent }]} />
            <View style={[styles.associationConnector, { backgroundColor: accent }]} />
            <View style={[styles.associationNode, { backgroundColor: colors.secondary }]} />
          </View>
          <View style={[styles.wordBar, { backgroundColor: colors.ink, width: `${38 + variant * 10}%` }]} />
          <View style={[styles.wordBar, { backgroundColor: accent, width: '26%' }]} />
        </>
      );
    case 'logic-deduction':
      return (
        <>
          <View style={[styles.logicStem, { backgroundColor: accent }]} />
          <View style={styles.logicLeaves}>
            {[0, 1, 2].map((index) => (
              <WorldTile key={index} color={index === variant ? accent : colors.on} size={tile * 0.8} />
            ))}
          </View>
          <View style={styles.logicClues}>
            <View style={[styles.clueLine, { backgroundColor: colors.ink, width: '70%' }]} />
            <View style={[styles.clueLine, { backgroundColor: colors.base, width: '44%' }]} />
          </View>
        </>
      );
    case 'flexibility-rule-switching':
      return (
        <>
          <View style={styles.switchBlocks}>
            <WorldTile color={colors.base} size={tile * 1.2} />
            <View style={[styles.switchArrow, { borderColor: accent, transform: [{ rotate: variant === 1 ? '135deg' : '45deg' }] }]} />
            <WorldTile color={colors.secondary} size={tile * 0.8} />
          </View>
          <View style={[styles.switchRule, { backgroundColor: colors.ink }]} />
          <View style={[styles.switchRule, { backgroundColor: accent, width: '42%' }]} />
        </>
      );
    case 'spatial-transformation':
      return (
        <>
          <View style={[styles.spatialDiamond, { borderColor: accent, transform: [{ rotate: variant === 1 ? '30deg' : '45deg' }] }]} />
          <View style={[styles.spatialCore, { backgroundColor: colors.base }]} />
          <View style={[styles.spatialOrbit, { borderColor: colors.on }]} />
          <WorldTile color={colors.secondary} size={tile * 0.72} style={styles.spatialTile} />
        </>
      );
  }
}

/**
 * Code-native stage for the catalog. It is deliberately decorative and
 * bounded: a domain world supplies the palette, while the stable mechanic
 * family supplies the shape grammar. Text beside it remains authoritative.
 */
// Change 076 review fix: genuine per-game board stills (lock section 4) —
// the still now mirrors the game's actual board grammar, not a family motif.
import { GameBoardStill } from './board-stills';

export function GameWorldArt({ game, size = 'card', testID }: GameWorldArtProps) {
  const theme = useTheme();
  const colors = worldColors(theme, game.primaryCategory);
  const identity = getGameIdentity(game);
  // Change 076 (lock section 4): instruction-first intros — the intro art is
  // a compact board still, not a decorative stage. Detail keeps a larger art.
  const height = size === 'stage' ? 180 : size === 'hero' ? 120 : 112;
  const scale = height / 112;
  const variant = variantFor(game.id);

  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.world, { height, backgroundColor: colors.soft, borderColor: colors.base }]}>
      <View style={[styles.worldCorner, { backgroundColor: colors.base }]} />
      <View style={[styles.worldCornerSecondary, { backgroundColor: colors.secondary }]} />
      {GameBoardStill({ gameId: game.id, colors, variant, scale }) ?? (
        <WorldMotif family={identity.family} colors={colors} variant={variant} scale={scale} />
      )}
      <View style={[styles.worldBadge, { backgroundColor: colors.base }]}>
        <IdentityMark family={identity.family} size={Math.round(22 * Math.min(scale, 1.5))} color={colors.on} />
      </View>
      <View style={[styles.worldTicks, { borderColor: colors.ink }]}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View key={index} style={[styles.worldTick, { backgroundColor: colors.ink, opacity: index <= variant + 1 ? 0.82 : 0.2 }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  motifCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchLens: {
    position: 'absolute',
  },
  searchHandle: {
    position: 'absolute',
    left: 2,
    top: 9,
    borderRadius: Radii.pill,
  },
  recallBar: {
    borderRadius: Radii.pill,
    marginVertical: Spacing.half,
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  reactionBar: {
    borderRadius: Radii.pill,
  },
  keypad: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  key: {},
  associationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  node: {},
  connector: {
    width: 5,
  },
  deductionTree: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  treeBranch: {
    transform: [{ rotate: '90deg' }],
    marginVertical: 2,
  },
  treeLeaves: {
    width: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchingRows: {
    gap: 3,
  },
  switchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  switchBar: {
    borderRadius: Radii.pill,
  },
  chevron: {
    borderRadius: 1,
  },
  transformOuter: {
    position: 'absolute',
    borderRadius: Radii.extraSmall,
  },
  transformInner: {
    borderRadius: Radii.extraSmall,
  },
  world: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    borderWidth: 2,
    borderRadius: Radii.small,
  },
  worldLines: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.16,
  },
  worldLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  worldLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  worldCorner: {
    position: 'absolute',
    width: 46,
    height: 46,
    right: -18,
    top: -18,
    transform: [{ rotate: '45deg' }],
    opacity: 0.9,
  },
  worldCornerSecondary: {
    position: 'absolute',
    width: 28,
    height: 28,
    left: -12,
    bottom: -10,
    transform: [{ rotate: '45deg' }],
    opacity: 0.75,
  },
  worldBadge: {
    position: 'absolute',
    right: Spacing.two,
    top: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: Radii.small,
  },
  worldTicks: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderBottomWidth: 1,
  },
  worldTick: {
    width: 10,
    height: 4,
  },
  worldTile: {
    position: 'absolute',
    borderRadius: 2,
  },
  lens: {
    position: 'absolute',
    left: '32%',
    top: '22%',
    borderWidth: 4,
    borderRadius: 999,
  },
  lensHandle: {
    position: 'absolute',
    left: '57%',
    top: '60%',
    height: 5,
  },
  attentionTileOne: { left: '18%', top: '24%' },
  attentionTileTwo: { left: '18%', top: '61%' },
  attentionTileThree: { left: '74%', top: '54%' },
  memoryBar: { position: 'absolute', left: '14%', bottom: '22%', height: 6 },
  speedBars: {
    position: 'absolute',
    left: '15%',
    right: '18%',
    bottom: '20%',
    height: '54%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  speedBar: { flex: 1, minHeight: 8 },
  targetOuter: {
    position: 'absolute',
    right: '14%',
    top: '22%',
    width: 42,
    height: 42,
    borderWidth: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetInner: { width: 14, height: 14, borderRadius: 999 },
  mathEquation: {
    position: 'absolute',
    left: '14%',
    right: '14%',
    top: '24%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mathBlock: { width: 22, height: 22, borderRadius: 2 },
  mathOperator: { width: 14, height: 4 },
  mathEquals: { width: 18, height: 4 },
  mathKeys: {
    position: 'absolute',
    left: '19%',
    right: '19%',
    bottom: '17%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  mathKey: { width: 18, height: 14, borderRadius: 2 },
  associationPath: {
    position: 'absolute',
    left: '16%',
    right: '16%',
    top: '27%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  associationNode: { width: 20, height: 20, borderRadius: 999 },
  associationNodeLarge: { width: 42, height: 42, borderRadius: 12, borderWidth: 4 },
  associationConnector: { height: 4, flex: 1, marginHorizontal: 6 },
  wordBar: { position: 'absolute', left: '17%', bottom: '24%', height: 6 },
  logicStem: { position: 'absolute', left: '50%', top: '21%', width: 4, height: '28%' },
  logicLeaves: { position: 'absolute', left: '20%', right: '20%', top: '46%', flexDirection: 'row', justifyContent: 'space-between' },
  logicClues: { position: 'absolute', left: '18%', bottom: '20%', right: '18%', gap: 7 },
  clueLine: { height: 5 },
  switchBlocks: { position: 'absolute', left: '20%', right: '20%', top: '24%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchArrow: { width: 24, height: 24, borderTopWidth: 5, borderRightWidth: 5 },
  switchRule: { position: 'absolute', left: '18%', bottom: '25%', height: 6, width: '62%' },
  spatialDiamond: { position: 'absolute', left: '35%', top: '19%', width: 54, height: 54, borderWidth: 5 },
  spatialCore: { position: 'absolute', left: '46%', top: '30%', width: 24, height: 24, transform: [{ rotate: '45deg' }] },
  spatialOrbit: { position: 'absolute', left: '26%', top: '15%', width: 90, height: 66, borderWidth: 2, borderRadius: 999, transform: [{ rotate: '-25deg' }] },
  spatialTile: { right: '15%', bottom: '22%' },
});
