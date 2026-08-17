/**
 * Tutorial — first-play interactive tutorial for the Sequence Memory game.
 *
 * Three steps: a short explanation, a live demo on the real pad (a
 * deterministic 3-tile sequence the player must repeat; a wrong tap replays
 * the demo), and a completion screen. Completion marks the tutorial done via
 * the tutorial lifecycle; a dev-only skip button (rendered by the parent only
 * in dev builds) uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal reveal/input state without any setState-in-effect
 * cascades.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { generateSequence } from '../generator';
import { GAME_ID } from '../types';
import { GameButton } from './button';
import { SequencePad } from './pad';
import type { PadTileVisualState } from './tile';

/** Deterministic demo seed so the tutorial pad is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'memory-sequence-memory-tutorial-demo-v1';
const DEMO_LENGTH = 3;
const DEMO_TILE_COUNT = 4;
const DEMO_REVEAL_MS = 900;

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
    <ThemedView type="surface" style={styles.card} testID={testId(GAME_ID, 'tutorial')}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The pads light up one by one — watch closely, then tap them in the same order.
            Each sequence you get right grows longer, and the clock keeps ticking. One wrong
            tap ends the sequence and you start over.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Watch a demo"
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
        <DemoPad
          key={attempt}
          attempt={attempt}
          onWrong={() => setAttempt((value) => value + 1)}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the board hides during pauses, so keep your phone close.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-done')}
            label="Got it"
            onPress={onComplete}
          />
        </View>
      ) : null}
    </ThemedView>
  );
}

interface DemoPadProps {
  attempt: number;
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: reveals the sequence, then validates the player's taps. */
function DemoPad({ attempt, onWrong, onDone, onSkip }: DemoPadProps) {
  const [sequence] = useState<readonly number[]>(() =>
    generateSequence({
      rng: createRng(TUTORIAL_DEMO_SEED),
      sequenceIndex: attempt,
      length: DEMO_LENGTH,
      tileCount: DEMO_TILE_COUNT,
      prevSequence: null,
    }),
  );
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [wrongTile, setWrongTile] = useState<number | null>(null);

  const revealing = revealedIndex >= 0 && revealedIndex < DEMO_LENGTH;
  const completed = inputIndex >= DEMO_LENGTH;

  // Reveal pacing: one tile every DEMO_REVEAL_MS, then hand over to input.
  useEffect(() => {
    if (!revealing) {
      return;
    }
    const timer = setTimeout(() => setRevealedIndex((index) => index + 1), DEMO_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [revealing, revealedIndex]);

  const handleTap = (index: number) => {
    if (revealing || completed) {
      return;
    }
    if (index === sequence[inputIndex]) {
      setWrongTile(null);
      const next = inputIndex + 1;
      setInputIndex(next);
      if (next >= DEMO_LENGTH) {
        onDone();
      }
    } else {
      setWrongTile(index);
      onWrong();
    }
  };

  const visualFor = (index: number): PadTileVisualState => {
    if (revealing) {
      return index === revealedIndex ? 'revealed' : 'idle';
    }
    if (sequence.slice(0, inputIndex).includes(index)) {
      return 'selected';
    }
    return index === wrongTile ? 'error' : 'idle';
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {revealing
          ? 'Watch the sequence…'
          : completed
            ? 'Perfect!'
            : `Your turn — tap the ${DEMO_LENGTH - inputIndex} lit pad${DEMO_LENGTH - inputIndex > 1 ? 's' : ''}`}
      </ThemedText>
      <SequencePad
        tileCount={DEMO_TILE_COUNT}
        testID={testId(GAME_ID, 'tutorial-pad')}
        visualFor={visualFor}
        disabled={revealing}
        onPressTile={handleTap}
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
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  body: {
    gap: Spacing.three,
  },
});
