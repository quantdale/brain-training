/**
 * Tutorial — first-play interactive tutorial for the Mental Rotation game.
 *
 * Three steps: a short explanation, a live demo on the real shape board (two
 * fixed rounds — one SAME, one DIFFERENT — generated deterministically from
 * `TUTORIAL_DEMO_SEED`; a wrong answer shows the explanation and replays the
 * round via a remount with a new `key`, which resets the demo's internal
 * state), and a completion screen. Completion marks the tutorial done via the
 * tutorial lifecycle; a dev-only skip button (rendered by the parent only in
 * dev builds) uses the QA skip path.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

import { generateRound } from '../generator';
import type { RotationRound } from '../generator';
import { GAME_ID } from '../types';
import type { RoundKind, SpatialDifficultyParams } from '../types';
import { BlockShape } from './block-shape';
import { GameButton } from './button';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'spatial-tutorial-demo-v1';

/** Demo rounds mirror a hard-level round (no timer in the tutorial). */
const DEMO_PARAMS: SpatialDifficultyParams = {
  blocks: 4,
  angleMask: 14,
  timeBudgetMs: 16_000,
  rounds: 1,
};

const DEMO_ATTEMPTS = 10;

type TutorialStep = 'intro' | 'demo' | 'done';

/** Deterministic demo round of the wanted kind (bounded re-draws). Exported for tests. */
export function buildDemoRound(seed: string, salt: string, wantedKind: RoundKind): RotationRound {
  for (let attempt = 0; attempt < DEMO_ATTEMPTS; attempt += 1) {
    const round = generateRound({
      rng: createRng(seed).fork(`demo:${salt}:attempt:${attempt}`),
      roundIndex: 0,
      params: DEMO_PARAMS,
      prevTarget: null,
    });
    if (round.kind === wantedKind) {
      return round;
    }
  }
  // Deterministic fallback (kinds are ~50/50, so this is unreachable in practice).
  return generateRound({
    rng: createRng(seed).fork(`demo:${salt}:final`),
    roundIndex: 0,
    params: DEMO_PARAMS,
    prevTarget: null,
  });
}

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');
  const [demoIndex, setDemoIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [rounds] = useState<readonly RotationRound[]>(() => [
    buildDemoRound(TUTORIAL_DEMO_SEED, 'same', 'same'),
    buildDemoRound(TUTORIAL_DEMO_SEED, 'different', 'different'),
  ]);

  return (
    <ThemedView type="surface" style={styles.card} testID={testId(GAME_ID, 'tutorial')}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Compare the two shapes. If the candidate is the target rotated in your mind’s eye —
            every block and its color in the same arrangement — answer “Same”. If it is mirrored
            or has a block changed, answer “Different”. Answer before the timer runs out.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Try an example"
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
        <DemoCard
          key={`${demoIndex}:${attempt}`}
          round={rounds[demoIndex]}
          roundNumber={demoIndex + 1}
          roundCount={rounds.length}
          onCorrect={() => {
            if (demoIndex + 1 >= rounds.length) {
              setStep('done');
            } else {
              setDemoIndex((index) => index + 1);
            }
          }}
          onWrong={() => setAttempt((value) => value + 1)}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Rotations keep every block and color. Mirrored or altered shapes are different — and
            the shapes hide while the game is paused.
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

interface DemoCardProps {
  round: RotationRound;
  roundNumber: number;
  roundCount: number;
  onCorrect: () => void;
  onWrong: () => void;
  onSkip?: () => void;
}

/** One demo round: shapes + Same/Different answers, with retry on a wrong answer. */
function DemoCard({ round, roundNumber, roundCount, onCorrect, onWrong, onSkip }: DemoCardProps) {
  const [wrongAnswer, setWrongAnswer] = useState<RoundKind | null>(null);

  const handleAnswer = (answer: RoundKind) => {
    if (wrongAnswer !== null) {
      return;
    }
    if (answer === round.kind) {
      onCorrect();
    } else {
      setWrongAnswer(answer);
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Example {roundNumber} of {roundCount}</ThemedText>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, 'tutorial-demo-status')}>
        Same = an exact rotated copy (colors move with the blocks).
      </ThemedText>
      <View style={styles.shapesRow}>
        <View style={styles.shapeSlot}>
          <ThemedText type="caption" themeColor="textSecondary">
            Target
          </ThemedText>
          <BlockShape blocks={round.target} kind="target" />
        </View>
        <View style={styles.shapeSlot}>
          <ThemedText type="caption" themeColor="textSecondary">
            Candidate
          </ThemedText>
          <BlockShape blocks={round.candidate} kind="candidate" />
        </View>
      </View>

      {wrongAnswer !== null ? (
        <ThemedText
          type="small"
          themeColor="warning"
          testID={testId(GAME_ID, 'tutorial-wrong')}>
          {round.kind === 'same'
            ? 'Not quite — the candidate IS the target rotated. Compare block positions and colors.'
            : 'Not quite — the candidate is NOT a rotation (it is mirrored or has a changed block).'}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <GameButton
          testID={testId(GAME_ID, 'tutorial-same')}
          label="Same"
          onPress={() => handleAnswer('same')}
        />
        <GameButton
          testID={testId(GAME_ID, 'tutorial-different')}
          label="Different"
          variant="secondary"
          onPress={() => handleAnswer('different')}
        />
      </View>
      {wrongAnswer !== null ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-try-again')}
          label="Try again"
          variant="secondary"
          onPress={onWrong}
        />
      ) : null}
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
  shapesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  shapeSlot: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
