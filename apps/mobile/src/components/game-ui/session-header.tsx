/**
 * SessionHeader — shared in-session header row (task 10.2).
 *
 * Optional generic header used by game screens during an active session:
 * round/score/pause controls laid out in one flex row. Callers pass
 * the already-composed children; no game mechanics live here.
 */
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

export interface SessionHeaderProps {
  children: React.ReactNode;
}

export function SessionHeader({ children }: SessionHeaderProps) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
