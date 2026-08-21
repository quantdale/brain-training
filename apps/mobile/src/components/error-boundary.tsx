/**
 * ErrorBoundary — class component that catches render/lifecycle errors in its
 * subtree and shows a fallback UI with a "Try Again" reset button.
 *
 * Used at the game route level so a crash in any game screen is contained.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { MinTouchTarget } from '@/components/a11y';
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
  /** Incremented on retry so the crashed subtree remounts fresh (task 10.5). */
  resetKey: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true, resetKey: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Preserve diagnostic context for the consumer (e.g. game id, stack,
    // component stack) so retry never silently discards the failure.
    this.props.onError?.(error, info);
    // Screen readers get no DOM mutation cue from the default fallback swap,
    // so announce it explicitly (only for our own fallback; a custom fallback
    // owns its own UX).
    if (!this.props.fallback) {
      AccessibilityInfo.announceForAccessibility(
        'Something went wrong. An unexpected error occurred.',
      );
    }
  }

  /**
   * Retry resets the error state AND bumps the reset key. The key forces a
   * fresh mount of the previously-crashed subtree (a new key = a new
   * component identity) rather than re-rendering the same still-mounted
   * crashing component. Persisted progression is untouched.
   */
  private handleReset = () => {
    this.setState((prev) => ({ hasError: false, resetKey: prev.resetKey + 1 }));
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

    // Key the wrapper so a retry remounts the subtree instead of reusing the
    // crashed component instance. `flex: 1` keeps the wrapper layout-neutral.
    return (
      <View key={this.state.resetKey} style={styles.container}>
        {this.props.children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
    ...MinTouchTarget,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.6,
  },
});
