import { router } from 'expo-router';

/** Pop every workout leg to Home; Expo replaces when a cold link has no tab root. */
export function finishWorkout(): void {
  router.dismissTo('/');
}
