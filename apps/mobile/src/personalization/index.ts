/**
 * Public surface of Advanced Personalization V2.
 *
 * Pure, dependency-light recommendation logic over stored local history:
 * build a context from repository rows, then rank or select with full
 * per-component explanations. The legacy workout reorder
 * (`src/workout/personalize.ts`) consumes this module's shared kernel
 * (constants, staleness rule, domain signals, reason formatters) while keeping
 * its pinned public behavior.
 */

export * from './types';
export * from './weights';
export * from './signals';
export * from './explain';
export * from './context';
export * from './scoring';
