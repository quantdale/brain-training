/**
 * Public surface of the Progress analytics feature. Pure aggregation functions
 * live alongside small, read-only data-loaders used by the screens. The loaders
 * only call existing `AppDatabase` query methods (no new schema, no migrations)
 * and hand already-persisted rows to the pure analytics functions.
 */

export * from './types';
export * from './format';
export * from './windows';
export * from './metrics-map';
export * from './domain-insights';
export * from './composite-explainer';
export * from './activity-calendar';
export * from './game-insights';
export * from './queries';
