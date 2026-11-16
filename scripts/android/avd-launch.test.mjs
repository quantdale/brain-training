import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const avd = fileURLToPath(new URL('./avd.sh', import.meta.url)).replaceAll('\\', '/');
function fixture(emulatorBody, suffix = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avd-launch-'));
  const sdk = path.join(dir, 'fake SDK');
  fs.mkdirSync(path.join(sdk, 'platform-tools'), { recursive: true });
  fs.mkdirSync(path.join(sdk, 'emulator'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'avds', 'test-only.avd'), { recursive: true });
  // No real SDK or device is ever queried, including adb start-server.
  fs.writeFileSync(path.join(sdk, 'platform-tools/adb'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  if (emulatorBody !== null) fs.writeFileSync(path.join(sdk, `emulator/emulator${suffix}`), `#!/usr/bin/env bash\n${emulatorBody}\n`, { mode: 0o755 });
  const marker = path.join(dir, 'invoked.txt');
  const result = spawnSync('bash', [avd, 'boot', '--no-wait', '--no-snapshot'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, BT_SDK: sdk.replaceAll('\\', '/'), ANDROID_AVD_HOME: path.join(dir, 'avds').replaceAll('\\', '/'), BT_AVD_NAME: 'test-only', BT_EMULATOR_EXTRA_ARGS: '', TEST_MARKER: marker.replaceAll('\\', '/') },
  });
  return { dir, marker, result };
}
for (const suffix of ['', '.exe']) {
  test(`T05 launches the resolved SDK executable${suffix} with intact arguments`, () => {
    const { dir, marker, result } = fixture('printf "%s\\n" "$@" > "$TEST_MARKER"\nsleep 3', suffix);
    try {
      assert.equal(result.status, 0, result.stderr);
      assert.ok(fs.existsSync(marker), 'nohup must execute the SDK binary, not a shell function');
      const args = fs.readFileSync(marker, 'utf8').trim().split(/\r?\n/);
      assert.deepEqual(args.slice(0, 2), ['-avd', 'test-only']);
      assert.ok(args.includes('-no-window'));
      assert.ok(args.includes('-no-snapshot'));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
for (const body of ['exit 23', null]) {
  test(`T05 --no-wait fails for ${body === null ? 'missing executable' : 'immediate launch failure'}`, () => {
    const { dir, result } = fixture(body);
    try {
      assert.equal(result.status, 1, result.stdout);
      assert.match(result.stderr, /emulator.*(failed|not found)/i);
      assert.doesNotMatch(result.stdout, /emulator launched;/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}
