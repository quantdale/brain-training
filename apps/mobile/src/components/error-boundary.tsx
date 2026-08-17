/**
 * ErrorBoundary — class component that catches render/lifecycle errors in its
 * subtree and shows a fallback UI with a "Try Again" reset button.
 *
 * Used at the game route level so a crash in any game screen is contained.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

export interface ErrorBoundaryProps {
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ThemedView type="surface" style={styles.card}>
          <View style={styles.content}>
            <ThemedText type="subtitle" themeColor="text">
              Something went wrong
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              An unexpected error occurred. You can try again or go back to the library.
            </ThemedText>
            <Pressable
              testID="error-boundary-retry"
              accessibilityRole="button"
              onPress={this.handleReset}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <ThemedText type="smallBold" themeColor="accent">
                Try Again
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
  },
  content: {
    gap: Spacing.two,
  },
  body: {
    marginBottom: Spacing.two,
  },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.6,
  },
});
