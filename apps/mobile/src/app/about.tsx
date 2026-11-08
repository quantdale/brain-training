/**
 * About & privacy — the in-app privacy statement App Review expects, plus the
 * version support needs. Every claim here is enforced elsewhere: the offline
 * gate (`scripts/validate-offline.mjs`) bans network APIs in production source.
 */
import Constants from "expo-constants";
import { Platform, StyleSheet, View } from "react-native";

import { ScreenShell } from "@/components/screen-shell";
import { ThemedText } from "@/components/themed-text";
import { BackLink, Card, useSafeBack } from "@/components/ui";
import { Spacing } from "@/constants/theme";

const DEVICE_BACKUP_NOTE =
  Platform.OS === "ios"
    ? "iCloud and computer backups of this iPhone can include this app's data."
    : "Android's device backup can carry exported backup files to a new phone.";

const SECTIONS = [
  {
    title: "Your data stays here",
    body: `Your training history is stored on this device. There is no account, and the app sends nothing over the internet. ${DEVICE_BACKUP_NOTE}`,
  },
  {
    title: "No tracking",
    body: "No analytics, advertising or crash reporting. Nothing is sold or shared.",
  },
  {
    title: "You're in control",
    body: "Export or permanently delete everything from Backups & data in Profile.",
  },
  {
    title: "Not medical advice",
    body: "These games are for fun and practice. They don't diagnose, treat or prevent any condition.",
  },
] as const;

export default function AboutScreen() {
  const goBack = useSafeBack("/profile");
  const version = Constants.expoConfig?.version ?? "Unknown";

  return (
    <ScreenShell>
      <BackLink
        testID="about-back"
        label="Profile"
        accessibilityLabel="Back to Profile"
        onPress={goBack}
      />
      <ThemedText type="title" testID="about-title" accessibilityRole="header">
        About & privacy
      </ThemedText>
      {SECTIONS.map((section) => (
        <Card key={section.title} style={styles.card}>
          <ThemedText type="label" accessibilityRole="header">
            {section.title}
          </ThemedText>
          <ThemedText type="bodySmall" themeColor="textSecondary">
            {section.body}
          </ThemedText>
        </Card>
      ))}
      <View style={styles.version}>
        <ThemedText type="caption" themeColor="textMuted" testID="about-version">
          Version {version}
        </ThemedText>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
  },
  version: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
});
