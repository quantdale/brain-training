/**
 * Tutorial — first-play interactive tutorial for the Spatial Grid Navigator game.
 *
 * Three steps: a short explanation, a live demo on a small grid (a deterministic
 * command sequence the player must "execute" to find the final cell), and a
 * completion screen. Completion marks the tutorial done via the tutorial
 * lifecycle; a dev-only skip button (rendered by the parent only in dev builds)
 * uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which resets
 * its internal state without any setState-in-effect cascades.
 *
 * Migrated to shared `TutorialFrame` + `GameButton`; mechanics stay local.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { GAME_ID } from '../types';
import type { Cell, Command, Dir } from '../types';
import { simulate } from '../generator';
import { GameButton } from './button';
import { CommandList, DIR_ARROW, GridBoard, OptionCell } from './grid';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'spatial-grid-nav-tutorial-v1';
const DEMO_SIDE = 5;
const DEMO_START: Cell = { row: 2, col: 2 };
const DEMO_DIR: Dir = 'N';
const DEMO_COMMANDS: readonly Command[] = [
  { type: 'forward' },
  { type: 'right' },
  { type: 'forward' },
  { type: 'forward' },
];

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');
  const [attempt, setAttempt] = useState(0);

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A marker sits on the grid facing a direction (shown by the arrow). Read the commands:
            move forward/back along the way it faces, or turn left/right to change facing. Tap the
            cell where the marker ends up.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Try a demo"
            onPress={() => setStep('demo')}
          />
          {onSkip !== undefined ? (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-skip')}
              label="Skip tutorial (QA)"
              variant="secondary"
              onPress={onSkip}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'demo' ? (
        <DemoRound
          key={attempt}
          attempt={attempt}
          onCorrect={() => setStep('done')}
          onWrong={() => setAttempt((value) => value + 1)}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Work the commands in order, keeping track of where you face. Ready to play for real.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-done')}
            label="Got it"
            onPress={onComplete}
          />
        </View>
      ) : null}
    </TutorialFrame>
  );
}

interface DemoRoundProps {
  attempt: number;
  onCorrect: () => void;
  onWrong: () => void;
  onSkip?: () => void;
}

/** One demo run: shows the start + commands, then validates the player's pick. */
function DemoRound({ attempt, onCorrect, onWrong, onSkip }: DemoRoundProps) {
  const sim = simulate(DEMO_START, DEMO_DIR, DEMO_COMMANDS, DEMO_SIDE);
  const correct = sim.finalCell;

  // Deterministic distractors: a couple of neighbouring cells.
  const rng = createRng(`${TUTORIAL_DEMO_SEED}:${attempt}`);
  const candidates: Cell[] = [correct];
  const seen = new Set<string>([`${correct.row},${correct.col}`]);
  let guard = 0;
  while (candidates.length < 3 && guard < 50) {
    const candidate: Cell = {
      row: Math.max(0, Math.min(DEMO_SIDE - 1, correct.row + (rng.nextInt(3) - 1))),
      col: Math.max(0, Math.min(DEMO_SIDE - 1, correct.col + (rng.nextInt(3) - 1))),
    };
    const k = `${candidate.row},${candidate.col}`;
    if (!seen.has(k)) {
      seen.add(k);
      candidates.push(candidate);
    }
    guard += 1;
  }
  const options = rng.shuffle(candidates);
  const correctIndex = options.findIndex((c) => c.row === correct.row && c.col === correct.col);

  const [selected, setSelected] = useState<number | null>(null);
  const isCorrect = selected === correctIndex;

  const handlePress = (index: number) => {
    setSelected(index);
    if (index === correctIndex) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {`Facing ${DIR_ARROW[DEMO_DIR]} at the marked cell, follow the commands and tap where it ends up.`}
      </ThemedText>
      <View
        style={styles.board}
        testID={testId(GAME_ID, 'tutorial-board')}
        accessibilityLabel="Demo board">
        <GridBoard side={DEMO_SIDE} start={DEMO_START} startDir={DEMO_DIR} testID={testId(GAME_ID, 'tutorial-grid')} />
      </View>
      <CommandList commands={DEMO_COMMANDS} testID={testId(GAME_ID, 'tutorial-commands')} />
      <View style={styles.optionRow}>
        {options.map((cell, i) => (
          <OptionCell
            key={i}
            index={i}
            side={DEMO_SIDE}
            cell={cell}
            selected={selected === i}
            correct={selected === i && isCorrect}
            disabled={selected !== null}
            onPress={() => handlePress(i)}
          />
        ))}
      </View>
      {onSkip !== undefined ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-skip')}
          label="Skip tutorial (QA)"
          variant="secondary"
          onPress={onSkip}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  board: {
    alignSelf: 'stretch',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
