/**
 * WorkoutTemplateDetails — selected-template panel (campaign 012 / W07).
 *
 * The "what am I about to play" block for the More-workouts picker: the
 * selected template's name and description, an explicit length line
 * (Short/Standard/Extended + game count) so length variants read as first
 * class, and the durable resume/completed state for today's instance of that
 * template ("2 of 4 done" / "Completed today"). Purely presentational: all
 * data comes in through props (engine summary + engine template spec), no
 * clock, db or router access.
 */

import { StyleSheet, View } from 'react-native';

import { ProgressTrack } from '@/components/shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';
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
    <ThemedView type="surface" style={styles.card} testID={testID}>
      <View
        testID={`${testID}-heading`}
        accessibilityLabel={`${template.name}, ${lengthSpec.label} workout, ${lengthSpec.gameCount} games`}>
        <ThemedText type="smallBold">{template.name}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {lengthSpec.label} · {lengthSpec.gameCount} games
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {template.description}
      </ThemedText>
      {isCompleted ? (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          testID={`${testID}-done`}>
          Completed today — nice work. Come back tomorrow for a fresh mix.
        </ThemedText>
      ) : null}
      {isResumable && resume ? (
        <View testID={`${testID}-resume`} style={styles.resumeBlock}>
          <ProgressTrack
            ratio={resume.completedGames / resume.totalGames}
            testID={`${testID}-resume-bar`}
          />
          <ThemedText type="caption" themeColor="textSecondary">
            In progress — {resume.completedGames} of {resume.totalGames} done.
            Starting again picks up where you left off.
          </ThemedText>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Sits inside the surface More-workouts card (surface-on-surface), so a
  // hairline border keeps the panel edge visible — same treatment as the
  // secondary CTA pills on Home.
  card: {
    borderRadius: Radii.medium,
    borderWidth: 1,
    borderColor: 'rgba(120,120,140,0.2)',
    padding: Spacing.two,
    gap: Spacing.oneHalf,
  },
  resumeBlock: {
    gap: Spacing.half,
  },
});
