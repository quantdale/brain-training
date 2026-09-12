/**
 * WorkoutTemplateDetails — selected-template panel (campaign 012 / W07;
 * campaign 026 identity).
 *
 * The "what am I about to play" block for the More-workouts picker: the
 * selected template's name and description, an explicit length line
 * (Short/Standard/Extended + game count) so length variants read as first
 * class, and the durable resume/completed state for today's instance of that
 * template ("2 of 4 done" / "Completed today"). The resume meter is the kit
 * `ProgressBar`; the panel is an outlined card so it reads as a quiet
 * sub-panel inside the surface it sits on. Purely presentational: all data
 * comes in through props (engine summary + engine template spec), no clock,
 * db or router access.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, ProgressBar } from '@/components/ui';
import { Spacing } from '@/theme/tokens';
import type { WorkoutStatus } from '@/db';
import type { WorkoutLengthSpec, WorkoutTemplate } from '@/workout/templates';

/** Today's persisted progress for one template (latest matching instance). */
export interface TemplateDetailsResume {
  completedGames: number;
  totalGames: number;
  status: WorkoutStatus;
}

export function WorkoutTemplateDetails({
  template,
  lengthSpec,
  resume,
  testID = 'workout-template-details',
}: {
  template: WorkoutTemplate;
  /** Selected length variant spec (label + game count). */
  lengthSpec: WorkoutLengthSpec;
  /** Today's resume state for this template; null when never started. */
  resume: TemplateDetailsResume | null;
  testID?: string;
}) {
  const isCompleted = resume?.status === 'completed';
  const isResumable =
    resume?.status === 'active' &&
    resume.completedGames > 0 &&
    resume.totalGames > resume.completedGames;

  return (
    <Card variant="outlined" padding="sm" style={styles.card} testID={testID}>
      <View
        testID={`${testID}-heading`}
        accessibilityLabel={`${template.name}, ${lengthSpec.label} workout, ${lengthSpec.gameCount} games`}>
        <ThemedText type="label">{template.name}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {lengthSpec.label} · {lengthSpec.gameCount} games
        </ThemedText>
      </View>
      <ThemedText type="bodySmall" themeColor="textSecondary">
        {template.description}
      </ThemedText>
      {isCompleted ? (
        <ThemedText
          type="bodySmall"
          themeColor="successText"
          testID={`${testID}-done`}>
          Completed today — nice work. Come back tomorrow for a fresh mix.
        </ThemedText>
      ) : null}
      {isResumable && resume ? (
        <View testID={`${testID}-resume`} style={styles.resumeBlock}>
          <ProgressBar
            value={resume.completedGames / resume.totalGames}
            tone="accent"
            label="Resume progress"
            valueLabel={`${resume.completedGames}/${resume.totalGames}`}
            testID={`${testID}-resume-bar`}
          />
          <ThemedText type="caption" themeColor="textSecondary">
            In progress — {resume.completedGames} of {resume.totalGames} done.
            Starting again picks up where you left off.
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.oneHalf,
  },
  resumeBlock: {
    gap: Spacing.one,
  },
});
