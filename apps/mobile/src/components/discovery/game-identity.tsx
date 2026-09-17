/**
 * Catalog-wide game identity language.
 *
 * The library has one identity vocabulary for all games: a small family
 * motif, a mechanic verb, and one sentence that tells a player what they do.
 * This is deliberately presentation-only. Stable game ids, registry metadata,
 * scoring, and session records remain owned by the SDK and game modules.
 */

import { StyleSheet, View } from 'react-native';

import type { GameDefinition } from '@/sdk';
import { Radii, Spacing } from '@/theme/tokens';

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
});
