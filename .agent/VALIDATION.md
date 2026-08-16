# Validation Evidence

## Bootstrap validation

Status at initial repository package creation:

- `node scripts/validate-repo-state.mjs`: expected to PASS after file generation.
- Application build: NOT VALIDATED — application source intentionally not implemented yet.
- Android emulator QA: NOT VALIDATED — Campaign 001 scope.
- iOS build: NOT VALIDATED — deferred until initial Android/Game SDK stability.

## Evidence policy

For every meaningful wave, append concise evidence containing:

- date/time
- commit or working-state reference
- changed subsystem
- checks actually run
- PASS/FAIL/NOT VALIDATED
- important runtime artifacts/reproduction references

Do not convert unavailable checks into PASS.
