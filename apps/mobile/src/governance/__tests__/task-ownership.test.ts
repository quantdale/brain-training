/**
 * Task-ownership validator tests (006R tasks 11.1 / 11.2).
 *
 * Imports the shared `.mjs` validator (the single source used by CI) and the
 * real `.agent/task-ownership.json` to prove the governance rules actually
 * reject unsafe ownership and accept the shipped config.
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- cwd-resolved dynamic path cannot be a static import
const validator = require(path.resolve(process.cwd(), '../../scripts/validate-task-ownership.cjs')) as {
  validateTaskOwnership: (c: unknown) => { valid: boolean; errors: string[] };
  globOverlap: (a: string, b: string) => boolean;
  globMatch: (p: string, s: string) => boolean;
};

const activeCampaign = (JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), '../../.agent/GOVERNANCE.json'), 'utf8'),
) as { activeCampaign: string }).activeCampaign;

describe('validateTaskOwnership (task 11.2)', () => {
  it('accepts disjoint coder surfaces', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      parallelPackets: [
        { id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/a/**'], validation: 'npm run typecheck' },
        { id: 'b', coderWriteSurfaces: ['apps/mobile/src/games/b/**'], validation: 'npm run typecheck' },
      ],
      orchestratorOnlySurfaces: [],
      generatedFilePatterns: [],
    });
    expect(res.valid).toBe(true);
  });

  it('rejects overlapping coder write surfaces', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      parallelPackets: [
        { id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/a/**'], validation: 'x' },
        { id: 'b', coderWriteSurfaces: ['apps/mobile/src/games/a/foo.ts'], validation: 'x' },
      ],
      orchestratorOnlySurfaces: [],
      generatedFilePatterns: [],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('overlapping'))).toBe(true);
  });

  it('permits a shared surface to be touched by multiple packets', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      parallelPackets: [
        { id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/a/**'], sharedSurfaces: ['apps/mobile/src/games/shared.ts'], validation: 'x' },
        { id: 'b', coderWriteSurfaces: ['apps/mobile/src/games/b/**'], sharedSurfaces: ['apps/mobile/src/games/shared.ts'], validation: 'x' },
      ],
      orchestratorOnlySurfaces: [],
      generatedFilePatterns: [],
    });
    expect(res.valid).toBe(true);
  });

  it('rejects coder edits to orchestrator-only surfaces', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      orchestratorOnlySurfaces: ['.agent/GOVERNANCE.json'],
      generatedFilePatterns: [],
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['.agent/GOVERNANCE.json'], validation: 'x' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('orchestrator-only'))).toBe(true);
  });

  it('rejects coder edits to generated files', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      generatedFilePatterns: ['**/*.generated.ts'],
      orchestratorOnlySurfaces: [],
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['apps/mobile/src/registry/registry.generated.ts'], validation: 'x' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('generated file'))).toBe(true);
  });

  it('rejects broad glob that contains generated file via intersection (015 2.4)', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      generatedFilePatterns: ['**/*.generated.ts'],
      orchestratorOnlySurfaces: [],
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['apps/mobile/src/**'], validation: 'x' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('generated'))).toBe(true);
  });

  it('rejects broad glob that contains orchestrator-only surface via intersection', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      orchestratorOnlySurfaces: ['.agent/GOVERNANCE.json'],
      generatedFilePatterns: [],
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['.agent/**'], validation: 'x' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('orchestrator-only'))).toBe(true);
  });

  it('rejects duplicate packet IDs', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      parallelPackets: [
        { id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/a/**'], validation: 'x' },
        { id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/b/**'], validation: 'x' },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('Duplicate packet'))).toBe(true);
  });

  it('rejects undeclared dependencies', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/a/**'], dependencies: ['missing'], validation: 'x' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('dependency'))).toBe(true);
  });

  it('rejects cyclic dependencies', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      parallelPackets: [
        { id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/a/**'], dependencies: ['b'], validation: 'x' },
        { id: 'b', coderWriteSurfaces: ['apps/mobile/src/games/b/**'], dependencies: ['a'], validation: 'x' },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('cycle'))).toBe(true);
  });

  it('rejects packet missing validation field', () => {
    const res = validator.validateTaskOwnership({
      change: activeCampaign,
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/a/**'] }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('validation'))).toBe(true);
  });

  it('rejects stale ownership change (does not match GOVERNANCE)', () => {
    const res = validator.validateTaskOwnership({
      change: '006r-core-integrity-correction',
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['apps/mobile/src/games/a/**'], validation: 'x' }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('does not match GOVERNANCE') || e.includes('does not match active OpenSpec'))).toBe(true);
  });

  it('the shipped .agent/task-ownership.json is valid', () => {
    const file = path.resolve(process.cwd(), '../../.agent/task-ownership.json');
    if (!fs.existsSync(file)) {
      // CI layout may differ; skip rather than fail.
      return;
    }
    const config = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    const res = validator.validateTaskOwnership(config);
    if (!res.valid) console.error('task-ownership config invalid:', res.errors);
    expect(res.valid).toBe(true);
  });
});

describe('glob helpers', () => {
  it('detects directory-glob vs file overlap', () => {
    expect(validator.globOverlap('src/db/**', 'src/db/sessions.ts')).toBe(true);
  });
  it('distinguishes distinct files in the same directory', () => {
    expect(validator.globOverlap('src/db/sessions.ts', 'src/db/schema.ts')).toBe(false);
  });
  it('globMatch handles ** and *', () => {
    expect(validator.globMatch('**/*.generated.ts', 'src/registry/registry.generated.ts')).toBe(true);
    // `**` requires a subpath segment, so a nested test file matches.
    expect(validator.globMatch('**/__tests__/**/*.test.ts', 'src/x/__tests__/sub/y.test.ts')).toBe(true);
  });
});
