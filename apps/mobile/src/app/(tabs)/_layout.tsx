/**
 * Tabs layout — renders the native tab shell.
 *
 * Providers live in the root layout (`src/app/_layout.tsx`); this layout
 * only hosts the tab navigator so non-tab routes (e.g. `game/[id]`) can be
 * pushed outside the tab bar.
 */

import AppTabs from '@/components/app-tabs';

export default function TabsLayout() {
  return <AppTabs />;
}
