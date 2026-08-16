/**
 * Semantic testID builder (constitution §29: stable semantic IDs for
 * autonomous QA; §11 QA instrumentation requirements).
 *
 * Convention: `testId(gameId, element, ...)` produces `gameId.element...`
 * with parts in kebab-case, e.g. `testId('memory-sequence', 'tile', '3')`
 * → `memory-sequence.tile.3`.
 *
 * IDs are stable strings: they may be used as React Native `testID` props,
 * accessibility labels, and in QA automation, and must never change between
 * releases without updating the automation that depends on them.
 */
export function testId(gameId: string, ...elements: string[]): string {
  return [gameId, ...elements].filter((part) => part.length > 0).join('.');
}
