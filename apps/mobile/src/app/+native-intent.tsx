import { budgetRawSystemPath } from '@/routing/raw-link-budget';

/** Expo invokes this BEFORE its query parser for cold (initial=true) and warm
 * native links. Keep both paths guarded, not just app startup.
 *
 * WEB LIMIT: Expo does not invoke +native-intent on web initial entry. Static
 * web hosting must enforce equivalent raw request-target/query budgets at the
 * server/edge BEFORE serving the app. A root-layout redirect is too late to
 * protect the router parser. This native hook does not claim web protection.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return budgetRawSystemPath(path);
}
