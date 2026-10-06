/**
 * GameBoardStill — genuine, game-specific miniature boards (change 076 lock
 * section 4, review fix: "the still must look like the game's actual board").
 *
 * One renderer per real board grammar; the game id picks the still so e.g.
 * Odd One Out shows its target-plus-options layout, Memory shows its lit 3×3
 * sequence grid, Equation Builder shows its token slots. Arrangement shifts
 * deterministically per game via `variantFor(game.id)` so two games sharing a
 * grammar still do not render identically.
 *
 * Pure Views + percent positioning (no Skia, no assets), colored by the
 * domain palette the caller passes — the same discipline as the world art it
 * replaces for covered ids.
 */

import { View, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

export interface BoardStillColors {
  base: string;
  soft: string;
  on: string;
  ink: string;
  secondary: string;
  surface: string;
}

export interface GameBoardStillProps {
  gameId: string;
  colors: BoardStillColors;
  /** Deterministic arrangement shift (0..2) from the game id. */
  variant: number;
  /** Layout scale (height / 112). */
  scale: number;
}

const st = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
});

/** Aspect-ratio box: width is a percent of the still frame, height derives
 *  from `ar` (h/w). Percent HEIGHTS collapse inside auto-height rows, so the
 *  stills size everything off the width instead (review fix). */
function Box({
  x = 0,
  y = 0,
  w,
  ar,
  color,
  radius = 4,
  border,
  opacity = 1,
}: {
  x?: number;
  y?: number;
  /** Width as percent of the still frame. */
  w: number;
  /** Height-to-width ratio. */
  ar: number;
  color: string;
  radius?: number;
  border?: string;
  opacity?: number;
}) {
  return (
    <View
      style={{
        position: x !== undefined || y !== undefined ? 'absolute' : 'relative',
        left: x !== undefined ? `${x}%` : undefined,
        top: y !== undefined ? `${y}%` : undefined,
        width: `${w}%`,
        aspectRatio: ar,
        backgroundColor: color,
        borderRadius: radius,
        borderWidth: border ? 1.5 : 0,
        borderColor: border ?? 'transparent',
        opacity,
      }}
    />
  );
}

/** Lit 3×3 sequence grid (memory family). */
function MemoryGridStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  const lit = [variant % 9, (variant + 3) % 9, (variant + 6) % 9];
  return (
    <View style={[st.fill, st.center]}>
      <View style={{ width: '62%', height: '78%', flexDirection: 'row', flexWrap: 'wrap', gap: '4%' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <Box
            key={i}
            x={0}
            y={0}
            w={30.6} ar={ 1.0 }
            color={lit.includes(i) ? colors.base : 'transparent'} border={colors.ink}
            radius={6}
            
            opacity={lit.includes(i) ? 1 : 0.85}
          />
        ))}
      </View>
    </View>
  );
}

/** Target card + option cards (odd one out / card sort family). */
function TargetOptionsStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, { paddingHorizontal: '8%', paddingTop: '6%' }]}>
      <Box x={30} y={0} w={40} ar={ 0.95 } color={colors.base} radius={6} border={colors.ink} />
      <View style={[st.row, { position: 'absolute', left: '8%', right: '8%', top: '52%' }]}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} x={0} y={0} w={22} ar={ 1.545 } color={i === 1 ? colors.base : 'transparent'} border={colors.ink} radius={5}  opacity={i === 1 ? 1 : 0.75} />
        ))}
      </View>
    </View>
  );
}

/** Scattered search field with lens ring (visual search). */
function SearchFieldStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  const dots = [
    { x: 12, y: 18 }, { x: 68, y: 12 }, { x: 30, y: 52 },
    { x: 78, y: 60 }, { x: 14, y: 74 }, { x: 55, y: 30 + variant * 6 },
  ];
  return (
    <View style={st.fill}>
      {dots.map((d, i) => (
        <Box key={i} x={d.x} y={d.y} w={9} ar={ 1.333 } color={i === (variant % dots.length) ? colors.base : colors.secondary} radius={3} opacity={i === (variant % dots.length) ? 1 : 0.5} />
      ))}
      <Box x={40} y={38} w={26} ar={ 1.308 } color="transparent" radius={12} border={colors.base} opacity={0.9} />
    </View>
  );
}

/** Signal stream + response slots (running order / prospective cue). */
function StreamStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: '8%' }]}>
      <View style={[st.row, { width: '84%' }]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={i} x={0} y={0} w={17} ar={ 1.529 } color={i < 2 ? colors.base : colors.secondary} radius={5} opacity={i < 2 ? 1 : 0.5} />
        ))}
      </View>
      <View style={[st.row, { width: '60%' }]}>
        {[0, 1, 2].map((i) => (
          <Box key={i} x={0} y={0} w={30} ar={ 0.6 } color="transparent" radius={4} border={colors.base} />
        ))}
      </View>
    </View>
  );
}

/** Token equation slots (equation builder / missing operator / fast math). */
function EquationStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: '10%' }]}>
      <View style={[st.row, { width: '70%', justifyContent: 'center' }]}>
        <Box x={0} y={0} w={26} ar={ 1.308 } color={colors.base} radius={5} />
        <Box x={0} y={0} w={18} ar={ 1.889 } color="transparent" radius={4} border={colors.base} />
        <Box x={0} y={0} w={26} ar={ 1.308 } color={colors.base} radius={5} />
      </View>
      <View style={[st.row, { width: '76%', justifyContent: 'center' }]}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} x={0} y={0} w={22} ar={ 0.909 } color='transparent' border={colors.ink} radius={4}  opacity={0.9} />
        ))}
      </View>
    </View>
  );
}

/** Number line with draggable flag (number line estimation). */
function NumberLineStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center]}>
      <Box x={10} y={48} w={80} ar={ 0.05 } color={colors.ink} radius={2} />
      <Box x={38} y={30} w={7} ar={ 4.286 } color={colors.base} radius={2} border={colors.ink} />
      {[14, 38, 62, 86].map((x, i) => (
        <Box key={i} x={x - 1} y={54} w={2} ar={ 5.0 } color={colors.ink} opacity={0.7} />
      ))}
    </View>
  );
}

/** Value ordering bars. */
function OrderingStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, { paddingHorizontal: '14%', paddingTop: '12%', gap: '7%' }]}>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} w={58 + ((i * 13) % 34)} ar={0.28} color={i === 1 ? colors.base : 'transparent'} border={colors.ink} radius={4} opacity={i === 1 ? 1 : 0.85} />
      ))}
    </View>
  );
}

/** Linked word chips (word chain / sentence builder / context fit / match). */
function WordChipsStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  return (
    <View style={[st.fill, st.center, { gap: '9%' }]}>
      <View style={[st.row, { width: '80%', justifyContent: 'center' }]}>
        {[0, 1, 2].map((i) => (
          <Box key={i} x={0} y={0} w={28} ar={ 0.786 } color={i === variant % 3 ? colors.base : colors.surface} radius={10} border={colors.ink} opacity={i === variant % 3 ? 1 : 0.85} />
        ))}
      </View>
      <View style={[st.row, { width: '62%', justifyContent: 'center' }]}>
        {[0, 1].map((i) => (
          <Box key={i} x={0} y={0} w={28} ar={ 0.786 } color='transparent' border={colors.ink} radius={10}  opacity={0.85} />
        ))}
      </View>
    </View>
  );
}

/** Letter tiles (word scramble). */
function ScrambleStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  return (
    <View style={[st.fill, st.center]}>
      <View style={[st.row, { width: '84%', flexWrap: 'wrap', justifyContent: 'center', gap: '4%' }]}>
        {Array.from({ length: 6 }, (_, i) => (
          <Box key={i} x={0} y={0} w={13} ar={ 1.692 } color={(i + variant) % 6 === 0 ? colors.base : 'transparent'} border={colors.ink} radius={4}  opacity={(i + variant) % 6 === 0 ? 1 : 0.85} />
        ))}
      </View>
    </View>
  );
}

/** Clue/deduction grid (deduction table / code cracker / rule grid). */
function DeductionStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  return (
    <View style={[st.fill, st.center, { flexDirection: 'row', gap: '5%' }]}>
      <View style={{ width: '30%', height: '70%', gap: '8%' }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} x={0} y={0} w={100} ar={ 0.24 } color='transparent' border={colors.ink} radius={3}  opacity={0.9} />
        ))}
      </View>
      <View style={{ width: '52%', height: '70%', gap: '8%' }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} x={0} y={0} w={100} ar={ 0.24 } color={(i + variant) % 3 === 0 ? colors.base : 'transparent'} border={colors.ink} radius={3}  opacity={(i + variant) % 3 === 0 ? 1 : 0.85} />
        ))}
      </View>
    </View>
  );
}

/** Sequence chips with unknown slot (next sequence). */
function SequenceStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: '10%' }]}>
      <View style={[st.row, { width: '78%', justifyContent: 'center' }]}>
        {[0, 1, 2].map((i) => (
          <Box key={i} x={0} y={0} w={22} ar={ 1.273 } color={colors.base} radius={5} />
        ))}
        <Box x={0} y={0} w={22} ar={ 1.273 } color="transparent" radius={5} border={colors.base} />
      </View>
    </View>
  );
}

/** Path/order grid (order path / grid nav / fold / transform / rotation). */
function PathGridStill({ colors, variant }: { colors: BoardStillColors; variant: number }) {
  const path = [variant % 9, (variant + 4) % 9, (variant + 8) % 9];
  return (
    <View style={[st.fill, st.center]}>
      <View style={{ width: '58%', height: '80%', flexDirection: 'row', flexWrap: 'wrap', gap: '3%' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <Box key={i} x={0} y={0} w={30.6} ar={ 1.0 } color={path.includes(i) ? colors.base : 'transparent'} border={colors.ink} radius={4}  opacity={path.includes(i) ? 1 : 0.8} />
        ))}
      </View>
    </View>
  );
}

/** Compass needle (coordinate turn). */
function CompassStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center]}>
      <Box x={26} y={14} w={48} ar={ 1.333 } color="transparent" radius={30} border={colors.base} />
      <Box x={47} y={30} w={6} ar={ 5.0 } color={colors.base} radius={3} />
      <Box x={40} y={68} w={20} ar={ 0.6 } color={colors.secondary} radius={3} />
    </View>
  );
}

/** Reaction trigger + tap field (reaction time / tap rush / color match / quick compare). */
function TriggerStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: '8%' }]}>
      <Box x={34} y={12} w={32} ar={ 1.438 } color={colors.base} radius={16} border={colors.ink} />
      <View style={[st.row, { width: '70%', justifyContent: 'center' }]}>
        {[0, 1, 2].map((i) => (
          <Box key={i} x={0} y={0} w={12} ar={ 1.0 } color={i === 1 ? colors.base : colors.secondary} radius={6} opacity={i === 1 ? 1 : 0.5} />
        ))}
      </View>
    </View>
  );
}

/** Numbered token row (order sweep). */
function SweepStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { gap: '9%' }]}>
      <View style={[st.row, { width: '86%', justifyContent: 'center' }]}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} x={0} y={0} w={20} ar={ 1.3 } color={i === 1 ? colors.base : 'transparent'} border={colors.ink} radius={4}  opacity={i === 1 ? 1 : 0.85} />
        ))}
      </View>
      <Box x={22} y={58} w={56} ar={ 0.143 } color={colors.secondary} radius={4} opacity={0.7} />
    </View>
  );
}

/** Vigilance signal bars (sustained vigilance). */
function VigilanceStill({ colors }: { colors: BoardStillColors }) {
  return (
    <View style={[st.fill, st.center, { flexDirection: 'row', alignItems: 'flex-end', gap: '4%', height: '70%' }]}>
      {[0.5, 0.8, 0.35, 0.9, 0.6].map((h, i) => (
        <View key={i} style={{ flex: 1, alignSelf: 'stretch' }}>
          <Box w={100} ar={0.34 + (i % 2) * 0.12} color={i === 3 ? colors.base : colors.secondary} radius={2} opacity={i === 3 ? 1 : 0.55} />
        </View>
      ))}
    </View>
  );
}

/** Per-game still selection. Returns null when the family motif remains the
 *  best available still for that id. */
export function GameBoardStill({
  gameId,
  colors,
  variant,
  scale,
}: GameBoardStillProps): React.JSX.Element | null {
  void scale;
  switch (gameId) {
    case 'attention-odd-one-out':
      return <TargetOptionsStill colors={colors} />;
    case 'attention-symbol-tracker':
    case 'attention-target-count':
      return <SearchFieldStill colors={colors} variant={variant} />;
    case 'attention-visual-search':
      return <SearchFieldStill colors={colors} variant={variant} />;
    case 'attention-sustained-vigilance':
      return <VigilanceStill colors={colors} />;
    case 'memory':
    case 'memory-grid-recall':
    case 'memory-pattern-tap-back':
    case 'memory-sequence-memory':
      return <MemoryGridStill colors={colors} variant={variant} />;
    case 'memory-pair-recall':
      return <TargetOptionsStill colors={colors} />;
    case 'memory-running-order':
    case 'memory-prospective-cue':
      return <StreamStill colors={colors} />;
    case 'math-equation-builder':
    case 'math-missing-operator':
    case 'math-fast-math':
      return <EquationStill colors={colors} />;
    case 'math-number-line-estimation':
      return <NumberLineStill colors={colors} />;
    case 'math-value-ordering':
      return <OrderingStill colors={colors} />;
    case 'language-word-chain':
    case 'language-word-match':
    case 'language-context-fit':
    case 'language-sentence-builder':
      return <WordChipsStill colors={colors} variant={variant} />;
    case 'language-word-scramble':
      return <ScrambleStill colors={colors} variant={variant} />;
    case 'logic-deduction-table':
    case 'logic-code-cracker':
      return <DeductionStill colors={colors} variant={variant} />;
    case 'logic-next-sequence':
      return <SequenceStill colors={colors} />;
    case 'logic-order-path':
    case 'logic-rule-grid':
    case 'spatial-grid-nav':
    case 'spatial-fold-match':
    case 'spatial-transform-match':
    case 'spatial-mental-rotation':
      return <PathGridStill colors={colors} variant={variant} />;
    case 'spatial-coordinate-turn':
      return <CompassStill colors={colors} />;
    case 'speed-reaction-time':
    case 'speed-tap-rush':
    case 'speed-color-match':
    case 'speed-quick-compare':
      return <TriggerStill colors={colors} />;
    case 'speed-order-sweep':
      return <SweepStill colors={colors} />;
    case 'flexibility-card-sort':
      return <TargetOptionsStill colors={colors} />;
    case 'flexibility-color-stroop':
    case 'flexibility-cue-shift':
    case 'flexibility-rule-flip':
    case 'flexibility-task-switch':
      return <WordChipsStill colors={colors} variant={variant} />;
    default:
      return null;
  }
}
