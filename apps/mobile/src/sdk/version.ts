/**
 * Version metadata for the shared Game SDK.
 *
 * These constants are recorded in `GameDefinition` / `DiagnosticMetadata` so
 * historical results can always be interpreted against the exact code that
 * produced them (constitution §21: "Historical results preserve
 * scoring/generator/version metadata").
 */

/** Version of the Game SDK contract surface. Bump on breaking SDK API changes. */
export const SDK_VERSION = '0.1.0';

/**
 * Version of the deterministic RNG algorithm (`mulberry32-v1`).
 *
 * Reproducibility rule: a seed produces the same sequence only for the same
 * algorithm version. Games must persist `(seed, generatorVersion, gameVersion,
 * difficulty)` alongside results; if the RNG algorithm ever changes, bump this
 * constant (old sequences stay reproducible through the recorded version).
 */
export const RNG_ALGORITHM_VERSION = 'mulberry32-v1';
