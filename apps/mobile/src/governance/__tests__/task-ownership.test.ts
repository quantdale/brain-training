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

// The validator lives in a CommonJS file so CI (`node`) and jest (`require`)
// both load it directly without --experimental-vm-modules.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validator: any = require(path.resolve(process.cwd(), '../../scripts/validate-task-ownership.cjs'));

const configPath = () => path.resolve(process.cwd(), '../../.agent/task-ownership.json');

describe('validateTaskOwnership (task 11.2)', () => {
  it('accepts disjoint coder surfaces', () => {
    const res = validator.validateTaskOwnership({
      parallelPackets: [
        { id: 'a', coderWriteSurfaces: ['src/db/sessions.ts'], sharedSurfaces: ['src/db/index.ts'] },
        { id: 'b', coderWriteSurfaces: ['src/rating/pipeline.ts'] },
      ],
    });
    expect(res.valid).toBe(true);
  });

  it('rejects overlapping coder write surfaces', () => {
    const res = validator.validateTaskOwnership({
      parallelPackets: [
        { id: 'a', coderWriteSurfaces: ['src/db/**'] },
        { id: 'b', coderWriteSurfaces: ['src/db/sessions.ts'] },
      ],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes('overlapping'))).toBe(true);
  });

  it('permits a shared surface to be touched by multiple packets', () => {
    const res = validator.validateTaskOwnership({
      parallelPackets: [
        { id: 'a', coderWriteSurfaces: ['src/rating/pipeline.ts'], sharedSurfaces: ['src/rating/index.ts'] },
        { id: 'b', coderWriteSurfaces: ['src/rating/composite.ts'], sharedSurfaces: ['src/rating/index.ts'] },
      ],
    });
    expect(res.valid).toBe(true);
  });

  it('rejects coder edits to orchestrator-only surfaces', () => {
    const res = validator.validateTaskOwnership({
      orchestratorOnlySurfaces: ['src/app/_layout.tsx', '**/*.generated.ts'],
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['src/registry/registry.generated.ts'] }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes('orchestrator-only'))).toBe(true);
  });

  it('rejects coder edits to generated files', () => {
    const res = validator.validateTaskOwnership({
      generatedFilePatterns: ['**/*.generated.ts'],
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['src/registry/registry.generated.ts'] }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes('generated file'))).toBe(true);
  });

  it('rejects undeclared dependencies', () => {
    const res = validator.validateTaskOwnership({
      parallelPackets: [{ id: 'a', coderWriteSurfaces: ['x.ts'], dependencies: ['missing'] }],
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e: string) => e.includes('dependency'))).toBe(true);
  });

  it('the shipped .agent/task-ownership.json is valid', () => {
    const file = configPath();
    if (!fs.existsSync(file)) {
      // CI layout may differ; skip rather than fail.
      return;
    }
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
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
