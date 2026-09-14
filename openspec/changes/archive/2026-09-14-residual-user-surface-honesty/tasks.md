## 1. Home reroll and workout empty

- [x] 1.1 Catch reroll rejection on Home; danger toast; CTA retryable; balance unchanged.
- [x] 1.2 Workout load failure with a non-empty catalog must not use "games are registered" empty copy; avoid loading flash if cheap.

## 2. Progress and Profile errors

- [x] 2.1 Progress tab: show error + retry when `useDbData` errors; empty state only when loaded and error-free.
- [x] 2.2 Profile: same.

## 3. Sensory persist

- [x] 3.1 Toast on sfx/haptics persist failure (theme persist pattern).

## 4. Tests

- [x] 4.1 Home reroll injected rejection.
- [x] 4.2 Progress injected snapshot rejection.
- [x] 4.3 Profile injected load rejection.
- [x] 4.4 Sensory persist injected rejection.

## 5. Verification

- [x] 5.1 Targeted app-route Jest + `tsc --noEmit` PASS.
