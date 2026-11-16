import { execFileSync } from 'node:child_process';
import { describe, expect, it } from '@jest/globals';

/** A fresh process is required: Jest's sandboxed process.env cannot set V8's TZ. */
describe('civil period keys across timezone travel', () => {
  it('preserves the Gregorian date that Pacific/Apia skipped completely', () => {
    const source = require.resolve('../period');
    const compiler = require.resolve('typescript');
    const result = execFileSync(process.execPath, ['-e', `
      const fs = require('node:fs');
      const ts = require(process.argv[2]);
      const exports = {};
      const js = ts.transpileModule(fs.readFileSync(process.argv[1], 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS }
      }).outputText;
      new Function('exports', js)(exports);
      console.log(JSON.stringify({
        rolledDay: new Date(2011, 11, 30).getDate(),
        daily: exports.periodKeyFor('daily', '2011-12-30'),
        weekly: exports.periodKeyFor('weekly', '2011-12-30'),
        early: exports.periodKeyFor('weekly', '0100-01-01')
      }));
    `, source, compiler], {
      env: { ...process.env, TZ: 'Pacific/Apia' },
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(JSON.parse(result)).toEqual({
      rolledDay: 31,
      daily: '2011-12-30',
      weekly: '2011-W52',
      early: '0099-W53',
    });
  });
});
