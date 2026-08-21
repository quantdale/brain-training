/**
 * Tutorial — first-play interactive tutorial for the Spatial Coordinate Turn game.
 *
 * Three steps: a short explanation, a live demo (a deterministic command
 * sequence the player "executes" to find the final heading), and a completion
 * screen. Completion marks the tutorial done via the tutorial lifecycle; a
 * dev-only skip button (rendered by the parent only in dev builds) uses the QA
 * skip path.
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
import type { Command, Dir } from '../types';
import { directionsOrder, simulate } from '../generator';
import { GameButton } from './button';
import { CommandList, CompassView, OptionArrow } from './compass';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'spatial-coordinate-turn-tutorial-v1';
const DEMO_DIR: Dir = 'N';
const DEMO_COMMANDS: readonly Command[] = [
  { type: 'right' },
  { type: 'forward', steps: 1 },
  { type: 'right' },
  { type: 'forward', steps: 1 },
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
            You start facing a heading (shown by the compass). Follow the turn and move commands in
            order, keeping track of which way you end up facing. Then pick the final heading from
            the arrows.
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
            Work the commands in order, rotating your facing each turn. Ready to play for real.
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

/** One demo run: shows the start heading + commands, then validates the pick. */
function DemoRound({ attempt, onCorrect, onWrong, onSkip }: DemoRoundProps) {
  const sim = simulate({ x: 0, y: 0 }, DEMO_DIR, DEMO_COMMANDS, 4);
  const correct = sim.finalHeading;
  const options = directionsOrder(4);
  const correctIndex = options.indexOf(correct);

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

  void attempt;
  void createRng; // deterministic seed is available if richer distractors are needed

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {`You start facing ${DEMO_DIR}. Follow the commands and pick the final heading.`}
      </ThemedText>
      <View style={styles.compassRow} testID={testId(GAME_ID, 'tutorial-compass')}>
        <CompassView heading={DEMO_DIR} testID={testId(GAME_ID, 'tutorial-heading')} />
      </View>
      <CommandList commands={DEMO_COMMANDS} testID={testId(GAME_ID, 'tutorial-commands')} />
      <View style={styles.optionRow}>
        {options.map((dir, i) => (
          <OptionArrow
            key={dir}
            dir={dir}
            index={i}
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
  compassRow: {
    alignItems: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
